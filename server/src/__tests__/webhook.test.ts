/**
 * Webhook endpoint tests
 * Tests verification challenge and event handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';

// Mock config before importing app
vi.mock('../config', () => ({
  config: {
    port: 3001,
    nodeEnv: 'test',
    trustProxy: 0,
    strava: {
      clientId: 'test_client_id',
      clientSecret: 'test_client_secret',
      authorizationUrl: 'https://www.strava.com/oauth/authorize',
      tokenUrl: 'https://www.strava.com/oauth/token',
      apiBaseUrl: 'https://www.strava.com/api/v3',
      webhookVerifyToken: 'TEST_VERIFY_TOKEN',
    },
    frontend: {
      url: 'http://localhost:5173',
    },
    cookie: {
      secret: 'test_cookie_secret_minimum_32_chars_long',
      name: 'testSessionId',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    },
    rateLimit: {
      windowMs: 15 * 60 * 1000,
      maxRequestsPerUser: 80,
      maxAuthRequests: 5,
    },
    cache: {
      maxSize: 1000,
      defaultTtlSeconds: 300,
    },
  },
}));

import { createApp } from '../app';
import { getDatabase, closeDatabase, initDatabase } from '../services/database';

describe('Webhook Endpoints', () => {
  let app: Express;

  beforeEach(() => {
    // Ensure database is closed from previous tests
    try {
      closeDatabase();
    } catch (error) {
      // Ignore if not initialized
    }

    // Initialize app with test database
    const { app: testApp } = createApp();
    app = testApp;

    // Clean up webhook events from previous tests
    const db = getDatabase();
    const cleanupSql = (db as any).getDb().prepare('DELETE FROM webhook_events');
    cleanupSql.run();
  });

  afterEach(() => {
    // Clean up
    closeDatabase();
  });

  describe('GET /api/webhooks/strava - Verification Challenge', () => {
    it('should accept valid verification challenge', async () => {
      const response = await request(app)
        .get('/api/webhooks/strava')
        .query({
          'hub.mode': 'subscribe',
          'hub.challenge': 'test_challenge_123',
          'hub.verify_token': 'TEST_VERIFY_TOKEN',
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        'hub.challenge': 'test_challenge_123',
      });
    });

    it('should reject verification with invalid token', async () => {
      const response = await request(app)
        .get('/api/webhooks/strava')
        .query({
          'hub.mode': 'subscribe',
          'hub.challenge': 'test_challenge_123',
          'hub.verify_token': 'WRONG_TOKEN',
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toMatchObject({
        code: 'VERIFICATION_FAILED',
      });
    });

    it('should reject verification with missing parameters', async () => {
      const response = await request(app)
        .get('/api/webhooks/strava')
        .query({
          'hub.mode': 'subscribe',
        });

      expect(response.status).toBe(400);
    });

    it('should reject verification with wrong mode', async () => {
      const response = await request(app)
        .get('/api/webhooks/strava')
        .query({
          'hub.mode': 'unsubscribe',
          'hub.challenge': 'test_challenge_123',
          'hub.verify_token': 'TEST_VERIFY_TOKEN',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/webhooks/strava - Event Handling', () => {
    it('should accept and store activity create event', async () => {
      const eventPayload = {
        object_type: 'activity',
        object_id: 12345,
        aspect_type: 'create',
        owner_id: 11111,
        subscription_id: 123,
        event_time: 1234567890,
      };

      const response = await request(app)
        .post('/api/webhooks/strava')
        .send(eventPayload);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
      });

      // Verify event was stored in database by querying for this specific activity
      const db = getDatabase();
      const events = db.getWebhookEventsByActivity(11111, 12345);
      expect(events).toHaveLength(1);
      expect(events[0]!).toMatchObject({
        objectType: 'activity',
        objectId: 12345,
        aspectType: 'create',
        ownerId: 11111,
        subscriptionId: 123,
        status: 'pending',
      });
    });

    it('should accept and store activity update event with updates', async () => {
      const eventPayload = {
        object_type: 'activity',
        object_id: 22222,
        aspect_type: 'update',
        updates: {
          title: 'Morning Run',
          type: 'Run',
        },
        owner_id: 22222,
        subscription_id: 123,
        event_time: 1234567890,
      };

      const response = await request(app)
        .post('/api/webhooks/strava')
        .send(eventPayload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify updates were stored as JSON
      const db = getDatabase();
      const events = db.getWebhookEventsByActivity(22222, 22222);
      expect(events).toHaveLength(1);
      expect(events[0]!.updatesJson).toBeTruthy();
      const updates = JSON.parse(events[0]!.updatesJson!);
      expect(updates).toEqual({
        title: 'Morning Run',
        type: 'Run',
      });
    });

    it('should accept activity delete event', async () => {
      const eventPayload = {
        object_type: 'activity',
        object_id: 33333,
        aspect_type: 'delete',
        owner_id: 33333,
        subscription_id: 123,
        event_time: 1234567890,
      };

      const response = await request(app)
        .post('/api/webhooks/strava')
        .send(eventPayload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const db = getDatabase();
      const events = db.getWebhookEventsByActivity(33333, 33333);
      expect(events[0]!.aspectType).toBe('delete');
    });

    it('should accept athlete update event', async () => {
      const ownerId = 44444;
      const eventPayload = {
        object_type: 'athlete',
        object_id: ownerId,
        aspect_type: 'update',
        updates: {
          authorized: 'false',
        },
        owner_id: ownerId,
        subscription_id: 123,
        event_time: 1234567890,
      };

      const response = await request(app)
        .post('/api/webhooks/strava')
        .send(eventPayload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // For athlete events, object_id and owner_id are the same
      const db = getDatabase();
      const stmt = db['db'].prepare('SELECT * FROM webhook_events WHERE owner_id = ? AND object_type = ?');
      const events = stmt.all(ownerId, 'athlete');
      expect(events).toHaveLength(1);
      expect(events[0].object_type).toBe('athlete');
    });

    it('should reject event with invalid payload', async () => {
      const response = await request(app)
        .post('/api/webhooks/strava')
        .send({
          object_type: 'invalid_type',
          object_id: 12345,
        });

      expect(response.status).toBe(400);
    });

    it('should reject event with missing required fields', async () => {
      const response = await request(app)
        .post('/api/webhooks/strava')
        .send({
          object_type: 'activity',
          aspect_type: 'create',
          // Missing owner_id, subscription_id, etc.
        });

      expect(response.status).toBe(400);
    });

    it('should handle multiple events correctly', async () => {
      const events = [
        {
          object_type: 'activity',
          object_id: 9111,
          aspect_type: 'create',
          owner_id: 97890,
          subscription_id: 123,
          event_time: 1234567890,
        },
        {
          object_type: 'activity',
          object_id: 9222,
          aspect_type: 'update',
          updates: { title: 'Updated' },
          owner_id: 97890,
          subscription_id: 123,
          event_time: 1234567891,
        },
        {
          object_type: 'activity',
          object_id: 9333,
          aspect_type: 'delete',
          owner_id: 97890,
          subscription_id: 123,
          event_time: 1234567892,
        },
      ];

      for (const event of events) {
        const response = await request(app)
          .post('/api/webhooks/strava')
          .send(event);

        expect(response.status).toBe(200);
      }

      // Verify all three events were stored
      const db = getDatabase();
      const event1 = db.getWebhookEventsByActivity(97890, 9111);
      const event2 = db.getWebhookEventsByActivity(97890, 9222);
      const event3 = db.getWebhookEventsByActivity(97890, 9333);

      expect(event1).toHaveLength(1);
      expect(event2).toHaveLength(1);
      expect(event3).toHaveLength(1);
    });
  });

  describe('Database Operations', () => {
    // These tests use the database initialized in the parent describe block
    // No need to initialize again

    it('should retrieve events by activity', () => {
      const db = getDatabase();

      // Use unique IDs to avoid conflicts with other tests
      const ownerId = 77890;
      const activity1 = 7111;
      const activity2 = 7222;

      // Create events for different activities
      db.createWebhookEvent({
        subscriptionId: 123,
        ownerId,
        objectType: 'activity',
        objectId: activity1,
        aspectType: 'create',
        eventTime: 1234567890,
      });

      db.createWebhookEvent({
        subscriptionId: 123,
        ownerId,
        objectType: 'activity',
        objectId: activity1,
        aspectType: 'update',
        eventTime: 1234567891,
      });

      db.createWebhookEvent({
        subscriptionId: 123,
        ownerId,
        objectType: 'activity',
        objectId: activity2,
        aspectType: 'create',
        eventTime: 1234567892,
      });

      const activity111Events = db.getWebhookEventsByActivity(ownerId, activity1);
      expect(activity111Events).toHaveLength(2);
      expect(activity111Events.every((e) => e.objectId === activity1)).toBe(true);
    });

    it('should mark events as processed', () => {
      const db = getDatabase();

      const ownerId = 87890;
      const activityId = 8111;

      const eventId = db.createWebhookEvent({
        subscriptionId: 123,
        ownerId,
        objectType: 'activity',
        objectId: activityId,
        aspectType: 'create',
        eventTime: 1234567890,
      });

      // Mark as processed
      db.markWebhookEventProcessed(eventId);

      const activityEvents = db.getWebhookEventsByActivity(ownerId, activityId);
      expect(activityEvents[0]!.status).toBe('processed');
      expect(activityEvents[0]!.processedAt).toBeTruthy();
    });

    it('should mark events as processed with error', () => {
      const db = getDatabase();

      const ownerId = 88890;
      const activityId = 8211;

      const eventId = db.createWebhookEvent({
        subscriptionId: 123,
        ownerId,
        objectType: 'activity',
        objectId: activityId,
        aspectType: 'create',
        eventTime: 1234567890,
      });

      db.markWebhookEventProcessed(eventId, 'Test error message');

      const activityEvents = db.getWebhookEventsByActivity(ownerId, activityId);
      expect(activityEvents[0]!.status).toBe('failed');
      expect(activityEvents[0]!.errorMessage).toBe('Test error message');
    });

    it('should cleanup old processed events', () => {
      const db = getDatabase();

      // Use very unique IDs to avoid conflicts with other tests
      const ownerId = 999890;
      const activityId1 = 999311;
      const activityId2 = 999322;

      // Create and process some events
      const eventId1 = db.createWebhookEvent({
        subscriptionId: 123,
        ownerId,
        objectType: 'activity',
        objectId: activityId1,
        aspectType: 'create',
        eventTime: Math.floor(Date.now() / 1000),
      });

      const eventId2 = db.createWebhookEvent({
        subscriptionId: 123,
        ownerId,
        objectType: 'activity',
        objectId: activityId2,
        aspectType: 'create',
        eventTime: Math.floor(Date.now() / 1000),
      });

      // Mark both as processed
      db.markWebhookEventProcessed(eventId1);
      db.markWebhookEventProcessed(eventId2);

      // Cleanup events older than 30 days (should not delete any recent events)
      const deletedCount = db.cleanupOldWebhookEvents(30 * 24 * 60 * 60);
      expect(deletedCount).toBe(0);

      // Both events should still exist
      const events = db.getWebhookEventsByActivity(ownerId, activityId1);
      expect(events).toHaveLength(1);

      // Cleanup with a negative time window (delete all processed events, even future ones)
      // Pass a negative value so cutoffTime is in the future
      const deletedNow = db.cleanupOldWebhookEvents(-1);
      expect(deletedNow).toBeGreaterThanOrEqual(2);

      // Events should be deleted now
      const eventsAfterCleanup = db.getWebhookEventsByActivity(ownerId, activityId1);
      expect(eventsAfterCleanup).toHaveLength(0);
    });
  });
});
