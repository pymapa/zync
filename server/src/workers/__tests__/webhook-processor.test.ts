/**
 * Webhook processor tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebhookProcessor } from '../webhook-processor';
import { IDatabase } from '../../services/database/interface';
import { SessionStore } from '../../services/session/store';
import type { StoredWebhookEvent } from '../../types/webhook';

// Mock dependencies
const mockDatabase: Partial<IDatabase> = {
  getUnprocessedWebhookEvents: vi.fn(),
  markWebhookEventProcessed: vi.fn(),
  resetStuckWebhookEvents: vi.fn(),
  retryWebhookEvent: vi.fn(),
  getActivityById: vi.fn(),
  deleteActivityDetails: vi.fn(),
  deleteSyncStatus: vi.fn(),
  deleteUserActivities: vi.fn(),
  upsertDetailedActivity: vi.fn(),
};

describe('WebhookProcessor', () => {
  let processor: WebhookProcessor;
  let sessionStore: SessionStore;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create session store
    sessionStore = new SessionStore(30 * 24 * 60 * 60 * 1000); // 30 days

    // Create processor
    processor = new WebhookProcessor({
      database: mockDatabase as IDatabase,
      sessionStore,
      pollIntervalMs: 100, // Short interval for tests
      batchSize: 5,
      maxRetries: 3,
      processingTimeoutSeconds: 300,
    });
  });

  afterEach(async () => {
    // Stop processor if running
    await processor.stop();
    sessionStore.shutdown();
  });

  describe('start and stop', () => {
    it('should start the processor', () => {
      processor.start();
      // Processor should be running (no easy way to assert this without exposing internal state)
      expect(mockDatabase.resetStuckWebhookEvents).toHaveBeenCalled();
    });

    it('should stop the processor gracefully', async () => {
      processor.start();
      await processor.stop();
      // Should complete without error
    });

    it('should not start twice', () => {
      processor.start();
      processor.start(); // Should log warning but not throw
      // No assertion needed, just checking it doesn't throw
    });
  });

  describe('rate limiting', () => {
    it('should track rate limits', () => {
      const rateLimits = processor.getRateLimitState();
      expect(rateLimits.fifteenMinuteRequests).toBe(0);
      expect(rateLimits.dailyRequests).toBe(0);
    });
  });

  describe('statistics', () => {
    it('should initialize stats to zero', () => {
      const stats = processor.getStats();
      expect(stats.eventsProcessed).toBe(0);
      expect(stats.eventsFailed).toBe(0);
      expect(stats.apiCallsMade).toBe(0);
      expect(stats.tokenRefreshes).toBe(0);
    });
  });

  describe('event processing', () => {
    it('should handle empty event queue', async () => {
      (mockDatabase.getUnprocessedWebhookEvents as any).mockReturnValue([]);

      processor.start();

      // Wait a bit for poll
      await new Promise((resolve) => setTimeout(resolve, 150));

      await processor.stop();

      expect(mockDatabase.getUnprocessedWebhookEvents).toHaveBeenCalled();
    });

    it('should handle athlete deauthorization events', async () => {
      const deauthEvent: StoredWebhookEvent = {
        id: 1,
        subscriptionId: 123,
        ownerId: 456,
        objectType: 'athlete',
        objectId: 456,
        aspectType: 'update',
        updatesJson: JSON.stringify({ authorized: false }),
        eventTime: Math.floor(Date.now() / 1000),
        status: 'pending',
        retryCount: 0,
        lastRetryAt: null,
        processedAt: null,
        errorMessage: null,
        createdAt: Math.floor(Date.now() / 1000),
        updatedAt: Math.floor(Date.now() / 1000),
      };

      (mockDatabase.getUnprocessedWebhookEvents as any).mockReturnValue([deauthEvent]);

      processor.start();
      await new Promise((resolve) => setTimeout(resolve, 150));
      await processor.stop();

      expect(mockDatabase.deleteSyncStatus).toHaveBeenCalledWith(456);
      expect(mockDatabase.deleteUserActivities).toHaveBeenCalledWith(456);
      expect(mockDatabase.markWebhookEventProcessed).toHaveBeenCalledWith(1);
    });

    it('should handle activity deletion events', async () => {
      const deleteEvent: StoredWebhookEvent = {
        id: 2,
        subscriptionId: 123,
        ownerId: 456,
        objectType: 'activity',
        objectId: 789,
        aspectType: 'delete',
        updatesJson: null,
        eventTime: Math.floor(Date.now() / 1000),
        status: 'pending',
        retryCount: 0,
        lastRetryAt: null,
        processedAt: null,
        errorMessage: null,
        createdAt: Math.floor(Date.now() / 1000),
        updatedAt: Math.floor(Date.now() / 1000),
      };

      (mockDatabase.getUnprocessedWebhookEvents as any).mockReturnValue([deleteEvent]);
      (mockDatabase.getActivityById as any).mockReturnValue({ id: 789, userId: 456 });

      processor.start();
      await new Promise((resolve) => setTimeout(resolve, 150));
      await processor.stop();

      expect(mockDatabase.deleteActivityDetails).toHaveBeenCalledWith(789);
      expect(mockDatabase.markWebhookEventProcessed).toHaveBeenCalledWith(2);
    });
  });

  describe('error handling', () => {
    it('should handle errors and mark event as failed', async () => {
      const event: StoredWebhookEvent = {
        id: 3,
        subscriptionId: 123,
        ownerId: 999, // Non-existent user
        objectType: 'activity',
        objectId: 789,
        aspectType: 'create',
        updatesJson: null,
        eventTime: Math.floor(Date.now() / 1000),
        status: 'pending',
        retryCount: 0,
        lastRetryAt: null,
        processedAt: null,
        errorMessage: null,
        createdAt: Math.floor(Date.now() / 1000),
        updatedAt: Math.floor(Date.now() / 1000),
      };

      (mockDatabase.getUnprocessedWebhookEvents as any).mockReturnValue([event]);

      processor.start();
      await new Promise((resolve) => setTimeout(resolve, 150));
      await processor.stop();

      // Should attempt to process and fail due to missing user
      expect(mockDatabase.markWebhookEventProcessed).toHaveBeenCalledWith(
        3,
        expect.stringContaining('No active session found')
      );
    });
  });
});
