/**
 * Tests for webhook event database operations
 * Validates duplicate handling, concurrent processing, and retry logic
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { SQLiteDatabase } from '../services/database/sqlite';
import type { WebhookEventInput } from '../types/webhook';
import fs from 'fs';
import path from 'path';

describe('Webhook Event Database', () => {
  let db: SQLiteDatabase;
  const testDir = path.join(__dirname, '../../test-data');
  const testDbPath = path.join(testDir, 'test-webhook.db');

  beforeEach(() => {
    // Clean up test database directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });

    db = new SQLiteDatabase(testDir);
    db.init();
  });

  afterEach(() => {
    db.close();
    // Clean up test database directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Duplicate Event Handling', () => {
    test('should ignore duplicate events with same unique key', () => {
      const event: WebhookEventInput = {
        subscriptionId: 12345,
        ownerId: 67890,
        objectType: 'activity',
        objectId: 11111,
        aspectType: 'create',
        eventTime: 1640000000,
      };

      // Insert same event twice
      const id1 = db.createWebhookEvent(event);
      const id2 = db.createWebhookEvent(event);

      expect(id1).toBeGreaterThan(0);
      expect(id2).toBe(id1); // Should return existing ID

      // Verify only one event exists
      const events = db.getWebhookEventsByActivity(event.ownerId, event.objectId);
      expect(events).toHaveLength(1);
    });

    test('should allow different events with different unique keys', () => {
      const baseEvent: WebhookEventInput = {
        subscriptionId: 12345,
        ownerId: 67890,
        objectType: 'activity',
        objectId: 11111,
        aspectType: 'create',
        eventTime: 1640000000,
      };

      // Different event_time
      const id1 = db.createWebhookEvent(baseEvent);
      const id2 = db.createWebhookEvent({
        ...baseEvent,
        eventTime: 1640000001,
      });

      // Different aspect_type
      const id3 = db.createWebhookEvent({
        ...baseEvent,
        aspectType: 'update',
      });

      // Different object_id
      const id4 = db.createWebhookEvent({
        ...baseEvent,
        objectId: 11112,
      });

      expect(id1).not.toBe(id2);
      expect(id1).not.toBe(id3);
      expect(id1).not.toBe(id4);

      const events = db.getWebhookEventsByActivity(baseEvent.ownerId, baseEvent.objectId);
      expect(events.length).toBeGreaterThanOrEqual(3); // At least 3 for this activity
    });
  });

  describe('Atomic Event Claiming', () => {
    test('should atomically claim pending events', () => {
      // Create 5 pending events
      for (let i = 0; i < 5; i++) {
        db.createWebhookEvent({
          subscriptionId: 12345,
          ownerId: 67890,
          objectType: 'activity',
          objectId: 11111 + i,
          aspectType: 'create',
          eventTime: 1640000000 + i,
        });
      }

      // Claim 3 events
      const claimed = db.getUnprocessedWebhookEvents(3);

      expect(claimed).toHaveLength(3);
      expect(claimed.every(e => e.status === 'processing')).toBe(true);

      // Trying to claim again should get the remaining 2
      const claimed2 = db.getUnprocessedWebhookEvents(3);
      expect(claimed2).toHaveLength(2);
      expect(claimed2.every(e => e.status === 'processing')).toBe(true);

      // No overlap between batches
      const claimedIds = claimed.map(e => e.id);
      const claimed2Ids = claimed2.map(e => e.id);
      expect(claimedIds.some(id => claimed2Ids.includes(id))).toBe(false);
    });

    test('should return empty array when no pending events', () => {
      const claimed = db.getUnprocessedWebhookEvents(10);
      expect(claimed).toHaveLength(0);
    });
  });

  describe('Processing State Tracking', () => {
    test('should track event through processing lifecycle', () => {
      const eventId = db.createWebhookEvent({
        subscriptionId: 12345,
        ownerId: 67890,
        objectType: 'activity',
        objectId: 11111,
        aspectType: 'create',
        eventTime: 1640000000,
      });

      // Initially pending
      let events = db.getWebhookEventsByActivity(67890, 11111);
      expect(events[0].status).toBe('pending');
      expect(events[0].retryCount).toBe(0);
      expect(events[0].processedAt).toBeNull();

      // Claim it (becomes processing)
      const claimed = db.getUnprocessedWebhookEvents(1);
      expect(claimed[0].status).toBe('processing');

      // Mark as processed
      db.markWebhookEventProcessed(eventId);

      events = db.getWebhookEventsByActivity(67890, 11111);
      expect(events[0].status).toBe('processed');
      expect(events[0].processedAt).toBeGreaterThan(0);
      expect(events[0].errorMessage).toBeNull();
    });

    test('should mark event as failed with error message', () => {
      const eventId = db.createWebhookEvent({
        subscriptionId: 12345,
        ownerId: 67890,
        objectType: 'activity',
        objectId: 11111,
        aspectType: 'create',
        eventTime: 1640000000,
      });

      // Claim and fail it
      db.getUnprocessedWebhookEvents(1);
      db.markWebhookEventProcessed(eventId, 'API rate limit exceeded');

      const events = db.getWebhookEventsByActivity(67890, 11111);
      expect(events[0].status).toBe('failed');
      expect(events[0].errorMessage).toBe('API rate limit exceeded');
    });
  });

  describe('Retry Logic', () => {
    test('should retry failed events up to max retries', () => {
      const eventId = db.createWebhookEvent({
        subscriptionId: 12345,
        ownerId: 67890,
        objectType: 'activity',
        objectId: 11111,
        aspectType: 'create',
        eventTime: 1640000000,
      });

      // Claim and fail
      db.getUnprocessedWebhookEvents(1);
      db.markWebhookEventProcessed(eventId, 'Temporary error');

      // Retry 1
      let retried = db.retryWebhookEvent(eventId, 3);
      expect(retried).toBe(true);
      let events = db.getWebhookEventsByActivity(67890, 11111);
      expect(events[0].status).toBe('pending');
      expect(events[0].retryCount).toBe(1);
      expect(events[0].errorMessage).toBeNull();

      // Claim and fail again
      db.getUnprocessedWebhookEvents(1);
      db.markWebhookEventProcessed(eventId, 'Still failing');

      // Retry 2
      retried = db.retryWebhookEvent(eventId, 3);
      expect(retried).toBe(true);
      events = db.getWebhookEventsByActivity(67890, 11111);
      expect(events[0].retryCount).toBe(2);

      // Claim and fail again
      db.getUnprocessedWebhookEvents(1);
      db.markWebhookEventProcessed(eventId, 'Still failing');

      // Retry 3
      retried = db.retryWebhookEvent(eventId, 3);
      expect(retried).toBe(true);
      events = db.getWebhookEventsByActivity(67890, 11111);
      expect(events[0].retryCount).toBe(3);

      // Claim and fail again
      db.getUnprocessedWebhookEvents(1);
      db.markWebhookEventProcessed(eventId, 'Still failing');

      // Cannot retry anymore (max retries = 3)
      retried = db.retryWebhookEvent(eventId, 3);
      expect(retried).toBe(false);
      events = db.getWebhookEventsByActivity(67890, 11111);
      expect(events[0].status).toBe('failed');
      expect(events[0].retryCount).toBe(3);
    });

    test('should not retry processed events', () => {
      const eventId = db.createWebhookEvent({
        subscriptionId: 12345,
        ownerId: 67890,
        objectType: 'activity',
        objectId: 11111,
        aspectType: 'create',
        eventTime: 1640000000,
      });

      // Process successfully
      db.getUnprocessedWebhookEvents(1);
      db.markWebhookEventProcessed(eventId);

      // Try to retry
      const retried = db.retryWebhookEvent(eventId, 3);
      expect(retried).toBe(false);

      const events = db.getWebhookEventsByActivity(67890, 11111);
      expect(events[0].status).toBe('processed');
      expect(events[0].retryCount).toBe(0);
    });
  });

  describe('Stuck Event Recovery', () => {
    test('should reset stuck processing events', async () => {
      const eventId = db.createWebhookEvent({
        subscriptionId: 12345,
        ownerId: 67890,
        objectType: 'activity',
        objectId: 11111,
        aspectType: 'create',
        eventTime: 1640000000,
      });

      // Claim event (becomes processing)
      db.getUnprocessedWebhookEvents(1);

      // Verify it's processing
      let events = db.getWebhookEventsByActivity(67890, 11111);
      expect(events[0].status).toBe('processing');

      // Immediately trying to reset won't work (not stuck yet)
      let resetCount = db.resetStuckWebhookEvents(1); // 1 second timeout
      expect(resetCount).toBe(0);

      // Wait for timeout (simulate stuck worker) - use 2 seconds to ensure we're well past threshold
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Now reset should work (events stuck for > 1 second)
      resetCount = db.resetStuckWebhookEvents(1);
      expect(resetCount).toBe(1);

      events = db.getWebhookEventsByActivity(67890, 11111);
      expect(events[0].status).toBe('pending');
      expect(events[0].retryCount).toBe(1);
      expect(events[0].errorMessage).toBe('Reset after processing timeout');
    }, 10000); // Increase test timeout to 10s
  });

  describe('Cleanup Operations', () => {
    test('should delete old processed events', async () => {
      // Create an old processed event (simulate by mocking created_at)
      const eventId = db.createWebhookEvent({
        subscriptionId: 12345,
        ownerId: 67890,
        objectType: 'activity',
        objectId: 11111,
        aspectType: 'create',
        eventTime: 1640000000,
      });

      db.getUnprocessedWebhookEvents(1);
      db.markWebhookEventProcessed(eventId);

      // Manually update created_at to be 31 days old
      const thirtyOneDaysAgo = Math.floor(Date.now() / 1000) - (31 * 24 * 60 * 60);
      (db as any).getDb().prepare(`
        UPDATE webhook_events
        SET created_at = ?
        WHERE id = ?
      `).run(thirtyOneDaysAgo, eventId);

      // Cleanup events older than 30 days
      const deletedCount = db.cleanupOldWebhookEvents(30 * 24 * 60 * 60);
      expect(deletedCount).toBe(1);

      const events = db.getWebhookEventsByActivity(67890, 11111);
      expect(events).toHaveLength(0);
    });

    test('should not delete recent processed events', () => {
      const eventId = db.createWebhookEvent({
        subscriptionId: 12345,
        ownerId: 67890,
        objectType: 'activity',
        objectId: 11111,
        aspectType: 'create',
        eventTime: 1640000000,
      });

      db.getUnprocessedWebhookEvents(1);
      db.markWebhookEventProcessed(eventId);

      // Try to cleanup (event is recent)
      const deletedCount = db.cleanupOldWebhookEvents(30 * 24 * 60 * 60);
      expect(deletedCount).toBe(0);

      const events = db.getWebhookEventsByActivity(67890, 11111);
      expect(events).toHaveLength(1);
    });

    test('should not delete pending or processing events', () => {
      // Pending event
      db.createWebhookEvent({
        subscriptionId: 12345,
        ownerId: 67890,
        objectType: 'activity',
        objectId: 11111,
        aspectType: 'create',
        eventTime: 1640000000,
      });

      // Processing event
      db.createWebhookEvent({
        subscriptionId: 12345,
        ownerId: 67890,
        objectType: 'activity',
        objectId: 11112,
        aspectType: 'create',
        eventTime: 1640000001,
      });
      db.getUnprocessedWebhookEvents(1);

      // Try to cleanup (events are not processed/failed)
      const deletedCount = db.cleanupOldWebhookEvents(0); // Even with 0 threshold
      expect(deletedCount).toBe(0);
    });
  });

  describe('Timestamp Consistency', () => {
    test('should use consistent timestamp source', () => {
      const beforeCreate = Math.floor(Date.now() / 1000);

      const eventId = db.createWebhookEvent({
        subscriptionId: 12345,
        ownerId: 67890,
        objectType: 'activity',
        objectId: 11111,
        aspectType: 'create',
        eventTime: 1640000000,
      });

      const afterCreate = Math.floor(Date.now() / 1000);

      const events = db.getWebhookEventsByActivity(67890, 11111);
      const createdAt = events[0].createdAt;

      // Timestamp should be within expected range
      expect(createdAt).toBeGreaterThanOrEqual(beforeCreate);
      expect(createdAt).toBeLessThanOrEqual(afterCreate);
    });

    test('should update updated_at on status changes', async () => {
      const eventId = db.createWebhookEvent({
        subscriptionId: 12345,
        ownerId: 67890,
        objectType: 'activity',
        objectId: 11111,
        aspectType: 'create',
        eventTime: 1640000000,
      });

      const events1 = db.getWebhookEventsByActivity(67890, 11111);
      const initialUpdatedAt = events1[0].updatedAt;

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Claim event
      db.getUnprocessedWebhookEvents(1);

      const events2 = db.getWebhookEventsByActivity(67890, 11111);
      expect(events2[0].updatedAt).toBeGreaterThan(initialUpdatedAt);
    }, 5000);
  });
});
