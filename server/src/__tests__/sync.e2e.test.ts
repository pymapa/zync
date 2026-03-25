/**
 * End-to-end tests for sync API endpoints
 * Tests the complete HTTP request/response flow including authentication, validation, and database integration
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { Express } from 'express';

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

// Mock auth middleware to bypass cookie signing in tests
vi.mock('../middleware/auth', async (importOriginal) => {
  // Import error classes at mock time
  const errors = await import('../utils/errors');

  return {
    createAuthMiddleware: (sessionStore: any) => {
      return (req: any, res: any, next: any) => {
        try {
          // Look for session ID in regular cookies (not signed) for testing
          const sessionId = req.cookies?.testSessionId || req.signedCookies?.testSessionId;

          if (!sessionId) {
            throw new errors.UnauthorizedError('No session found. Please log in.');
          }

          const session = sessionStore.get(sessionId);
          if (!session) {
            throw new errors.AppError(
              401,
              errors.ErrorCode.SESSION_NOT_FOUND,
              'Session expired. Please log in again.'
            );
          }

          // Attach session to request
          req.session = session;
          next();
        } catch (error) {
          next(error);
        }
      };
    },
    createOptionalAuthMiddleware: (sessionStore: any) => {
      return (req: any, res: any, next: any) => {
        try {
          const sessionId = req.cookies?.testSessionId || req.signedCookies?.testSessionId;
          if (sessionId) {
            const session = sessionStore.get(sessionId);
            if (session) {
              req.session = session;
            }
          }
          next();
        } catch (error) {
          next();
        }
      };
    },
  };
});

// Mock dependencies
vi.mock('../services/strava/client', () => {
  return {
    StravaClient: class MockStravaClient {
      constructor(public accessToken: string) {}
      get = vi.fn();
    },
  };
});

vi.mock('../services/strava/activities', () => ({
  getActivities: vi.fn(),
}));

vi.mock('../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { createApp } from '../app';
import { getDatabase, closeDatabase } from '../services/database';
import { SessionStore } from '../services/session/store';
import type { SyncStatus } from '../services/database/types';
import * as syncService from '../services/sync';
import * as stravaActivities from '../services/strava/activities';
import { createMockStravaActivity } from '../services/__tests__/mocks';

describe('Sync API E2E Tests', () => {
  let app: Express;
  let sessionStore: SessionStore;
  const TEST_USER_ID = 999;
  const TEST_ACCESS_TOKEN = 'test_access_token_123';
  let testSessionId: string;

  beforeAll(() => {
    // Create app with test database
    const appInstance = createApp();
    app = appInstance.app;
    sessionStore = appInstance.services.sessionStore;
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Create a test session for authentication
    const session = sessionStore.create(
      TEST_USER_ID,
      TEST_ACCESS_TOKEN,
      'test_refresh_token',
      Date.now() + 3600000, // expires in 1 hour
      {
        id: TEST_USER_ID,
        firstName: 'Test',
        lastName: 'User',
        profileUrl: 'https://example.com/profile.jpg',
        city: null,
        state: null,
        country: null,
      }
    );
    testSessionId = session.id;

    // Clean up test user data in database
    const db = getDatabase();
    db.deleteUserActivities(TEST_USER_ID);
    db.deleteSyncStatus(TEST_USER_ID);
  });

  afterEach(() => {
    // Clean up test session
    if (testSessionId) {
      sessionStore.destroy(testSessionId);
    }

    // Clean up test user data
    const db = getDatabase();
    db.deleteUserActivities(TEST_USER_ID);
    db.deleteSyncStatus(TEST_USER_ID);
  });

  afterAll(() => {
    sessionStore.shutdown();
    closeDatabase();
  });

  describe('POST /api/sync', () => {
    it('should trigger sync and return 202 Accepted', async () => {
      // Mock Strava API to return empty activities
      vi.mocked(stravaActivities.getActivities).mockResolvedValue([]);

      const response = await request(app)
        .post('/api/sync')
        .set('Cookie', `testSessionId=${testSessionId}`)
        .send({})
        .expect(202);

      expect(response.body).toMatchObject({
        message: expect.stringContaining('Sync started successfully'),
        syncStarted: true,
        userId: TEST_USER_ID,
      });

      // Wait for async sync to complete
      await new Promise(resolve => setTimeout(resolve, 300));

      // Verify sync status was updated in database
      const db = getDatabase();
      const syncStatus = db.getSyncStatus(TEST_USER_ID);
      expect(syncStatus).toBeTruthy();
      expect(syncStatus?.syncState).toBe('completed');
    });

    it('should return 409 Conflict if sync already in progress', async () => {
      // Manually set sync state to 'syncing' in the database to simulate an in-progress sync
      const db = getDatabase();
      db.createSyncStatus(TEST_USER_ID);
      db.updateSyncStatus(TEST_USER_ID, {
        syncState: 'syncing',
        syncStartedAt: Math.floor(Date.now() / 1000),
      });

      // Try to start a sync while one is already in progress
      const response = await request(app)
        .post('/api/sync')
        .set('Cookie', `testSessionId=${testSessionId}`)
        .send({})
        .expect(409);

      expect(response.body).toMatchObject({
        message: expect.stringContaining('Sync already in progress'),
        syncStarted: false,
        userId: TEST_USER_ID,
      });

      expect(response.body.syncStatus).toBeTruthy();
      expect(response.body.syncStatus.syncState).toBe('syncing');
    });

    it('should return 401 Unauthorized without valid session', async () => {
      const response = await request(app)
        .post('/api/sync')
        .send({})
        .expect(401);

      expect(response.body).toMatchObject({
        error: {
          code: expect.any(String),
          message: expect.any(String),
        },
      });
    });

    it('should validate request body and return 400 on invalid input', async () => {
      const response = await request(app)
        .post('/api/sync')
        .set('Cookie', `testSessionId=${testSessionId}`)
        .send({
          pageSize: 300, // Invalid: max is 200
        })
        .expect(400);

      // Error is serialized as an object with code and message
      expect(response.body.error).toBeTruthy();
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should accept optional pageSize and maxPages parameters', async () => {
      vi.mocked(stravaActivities.getActivities).mockResolvedValue([]);

      const response = await request(app)
        .post('/api/sync')
        .set('Cookie', `testSessionId=${testSessionId}`)
        .send({
          pageSize: 100,
          maxPages: 50,
        })
        .expect(202);

      expect(response.body.syncStarted).toBe(true);
    });

    it('should sync activities from Strava and store in database', async () => {
      const activities = [
        createMockStravaActivity({ id: 1, name: 'Morning Run' }),
        createMockStravaActivity({ id: 2, name: 'Evening Ride' }),
      ];

      vi.mocked(stravaActivities.getActivities)
        .mockResolvedValueOnce(activities)
        .mockResolvedValueOnce([]);

      await request(app)
        .post('/api/sync')
        .set('Cookie', `testSessionId=${testSessionId}`)
        .send({})
        .expect(202);

      // Wait for sync to complete
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify activities were stored
      const db = getDatabase();
      const storedActivities = db.searchActivities({ userId: TEST_USER_ID, limit: 10 });
      expect(storedActivities).toHaveLength(2);
      expect(storedActivities[0]!.name).toBe('Morning Run');
      expect(storedActivities[1]!.name).toBe('Evening Ride');
    });
  });

  describe('GET /api/sync/status', () => {
    it('should return current sync status', async () => {
      // Create a sync status first
      const db = getDatabase();
      db.createSyncStatus(TEST_USER_ID);
      db.updateSyncStatus(TEST_USER_ID, {
        syncState: 'completed',
        totalActivities: 42,
        lastActivityId: 12345,
      });

      const response = await request(app)
        .get('/api/sync/status')
        .set('Cookie', `testSessionId=${testSessionId}`)
        .expect(200);

      expect(response.body).toMatchObject({
        userId: TEST_USER_ID,
        hasNeverSynced: false,
        syncStatus: {
          syncState: 'completed',
          totalActivities: 42,
          lastActivityId: 12345,
        },
      });
    });

    it('should return hasNeverSynced true for new user', async () => {
      const response = await request(app)
        .get('/api/sync/status')
        .set('Cookie', `testSessionId=${testSessionId}`)
        .expect(200);

      expect(response.body).toMatchObject({
        userId: TEST_USER_ID,
        hasNeverSynced: true,
        syncStatus: null,
      });
    });

    it('should return 401 Unauthorized without valid session', async () => {
      await request(app)
        .get('/api/sync/status')
        .expect(401);
    });

    it('should show syncing state while sync is in progress', async () => {
      // Create sync status in syncing state
      const db = getDatabase();
      const now = Math.floor(Date.now() / 1000);
      db.createSyncStatus(TEST_USER_ID);
      db.updateSyncStatus(TEST_USER_ID, {
        syncState: 'syncing',
        syncStartedAt: now,
        totalActivities: 10,
      });

      const response = await request(app)
        .get('/api/sync/status')
        .set('Cookie', `testSessionId=${testSessionId}`)
        .expect(200);

      expect(response.body.syncStatus.syncState).toBe('syncing');
      expect(response.body.syncStatus.syncStartedAt).toBe(now);
    });

    it('should show error state with error message', async () => {
      const db = getDatabase();
      db.createSyncStatus(TEST_USER_ID);
      db.updateSyncStatus(TEST_USER_ID, {
        syncState: 'error',
        errorMessage: 'Network timeout',
        syncStartedAt: null,
      });

      const response = await request(app)
        .get('/api/sync/status')
        .set('Cookie', `testSessionId=${testSessionId}`)
        .expect(200);

      expect(response.body.syncStatus.syncState).toBe('error');
      expect(response.body.syncStatus.errorMessage).toBe('Network timeout');
    });
  });

  describe('POST /api/sync/reset', () => {
    it('should reset stuck sync that exceeded timeout', async () => {
      const db = getDatabase();
      const elevenMinutesAgo = Math.floor(Date.now() / 1000) - (11 * 60);

      // Create a stuck sync (started 11 minutes ago)
      db.createSyncStatus(TEST_USER_ID);
      db.updateSyncStatus(TEST_USER_ID, {
        syncState: 'syncing',
        syncStartedAt: elevenMinutesAgo,
      });

      const response = await request(app)
        .post('/api/sync/reset')
        .set('Cookie', `testSessionId=${testSessionId}`)
        .expect(200);

      expect(response.body).toMatchObject({
        message: expect.stringContaining('reset'),
        wasReset: true,
        userId: TEST_USER_ID,
      });

      // Verify sync status was reset to error
      const syncStatus = db.getSyncStatus(TEST_USER_ID);
      expect(syncStatus?.syncState).toBe('error');
      expect(syncStatus?.syncStartedAt).toBeNull();
    });

    it('should return 409 Conflict if sync is active and not timed out', async () => {
      const db = getDatabase();
      const twoMinutesAgo = Math.floor(Date.now() / 1000) - (2 * 60);

      // Create an active sync (started 2 minutes ago)
      db.createSyncStatus(TEST_USER_ID);
      db.updateSyncStatus(TEST_USER_ID, {
        syncState: 'syncing',
        syncStartedAt: twoMinutesAgo,
      });

      const response = await request(app)
        .post('/api/sync/reset')
        .set('Cookie', `testSessionId=${testSessionId}`)
        .expect(409);

      expect(response.body).toMatchObject({
        message: expect.stringContaining('still in progress'),
        wasReset: false,
        userId: TEST_USER_ID,
      });
    });

    it('should return 200 with wasReset false if no stuck sync exists', async () => {
      const db = getDatabase();

      // Create a completed sync (not stuck)
      db.createSyncStatus(TEST_USER_ID);
      db.updateSyncStatus(TEST_USER_ID, {
        syncState: 'completed',
        syncStartedAt: null,
      });

      const response = await request(app)
        .post('/api/sync/reset')
        .set('Cookie', `testSessionId=${testSessionId}`)
        .expect(200);

      expect(response.body).toMatchObject({
        message: expect.stringContaining('No stuck sync'),
        wasReset: false,
        userId: TEST_USER_ID,
      });
    });

    it('should return 401 Unauthorized without valid session', async () => {
      await request(app)
        .post('/api/sync/reset')
        .expect(401);
    });
  });

  describe('Sync workflow integration', () => {
    it('should complete full sync workflow: trigger -> polling -> completion', async () => {
      // Wait for any lingering async operations from previous tests to settle
      await new Promise(resolve => setTimeout(resolve, 1500));

      const activities = Array.from({ length: 10 }, (_, i) =>
        createMockStravaActivity({ id: i + 1, name: `Activity ${i + 1}` })
      );

      let callCount = 0;
      vi.mocked(stravaActivities.getActivities).mockImplementation(async () => {
        callCount++;
        return callCount === 1 ? activities : [];
      });

      // 1. Trigger sync
      const triggerResponse = await request(app)
        .post('/api/sync')
        .set('Cookie', `testSessionId=${testSessionId}`)
        .send({})
        .expect(202);

      expect(triggerResponse.body.syncStarted).toBe(true);

      // 2. Poll status (should be syncing initially, then completed)
      let syncState = 'syncing';
      let attempts = 0;
      const maxAttempts = 20;

      while (syncState !== 'completed' && syncState !== 'error' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 200));

        const statusResponse = await request(app)
          .get('/api/sync/status')
          .set('Cookie', `testSessionId=${testSessionId}`)
          .expect(200);

        syncState = statusResponse.body.syncStatus?.syncState || 'syncing';
        attempts++;
      }

      // 3. Verify final state is completed
      expect(syncState).toBe('completed');

      // Verify activities were stored in the database
      const db = getDatabase();
      const storedCount = db.getUserActivityCount(TEST_USER_ID);

      const finalStatus = await request(app)
        .get('/api/sync/status')
        .set('Cookie', `testSessionId=${testSessionId}`)
        .expect(200);

      expect(finalStatus.body.syncStatus).toMatchObject({
        syncState: 'completed',
        syncStartedAt: null,
        errorMessage: null,
      });
      // totalActivities reflects the DB count at sync completion
      expect(finalStatus.body.syncStatus.totalActivities).toBe(storedCount);
    });

    it('should handle sync error and set error state', async () => {
      // Mock API error - use mockImplementation to be resilient to lingering calls
      vi.mocked(stravaActivities.getActivities).mockImplementation(async () => {
        throw new Error('Strava API rate limit exceeded');
      });

      // Trigger sync
      await request(app)
        .post('/api/sync')
        .set('Cookie', `testSessionId=${testSessionId}`)
        .send({})
        .expect(202);

      // Wait for sync to fail
      await new Promise(resolve => setTimeout(resolve, 500));

      // Check status shows error
      const statusResponse = await request(app)
        .get('/api/sync/status')
        .set('Cookie', `testSessionId=${testSessionId}`)
        .expect(200);

      expect(statusResponse.body.syncStatus.syncState).toBe('error');
      expect(statusResponse.body.syncStatus.errorMessage).toContain('rate limit');
    });

    it('should prevent concurrent syncs for same user', async () => {
      // First, trigger a sync and set up the DB to be in 'syncing' state
      // This simulates what happens when a sync is already running
      const db = getDatabase();
      db.createSyncStatus(TEST_USER_ID);
      db.updateSyncStatus(TEST_USER_ID, {
        syncState: 'syncing',
        syncStartedAt: Math.floor(Date.now() / 1000),
      });

      // Try to start a sync while one is already in progress
      const response = await request(app)
        .post('/api/sync')
        .set('Cookie', `testSessionId=${testSessionId}`)
        .send({})
        .expect(409);

      expect(response.body.syncStarted).toBe(false);
      expect(response.body.message).toContain('Sync already in progress');
    });
  });

  describe('Data integrity tests', () => {
    it('should upsert activities correctly on re-sync', async () => {
      const originalActivities = [
        createMockStravaActivity({ id: 123, name: 'Original Name', kudos_count: 5 }),
      ];

      // First sync - use mockImplementation with counter to be resilient to lingering calls
      let firstSyncCalls = 0;
      vi.mocked(stravaActivities.getActivities).mockImplementation(async () => {
        firstSyncCalls++;
        return firstSyncCalls === 1 ? originalActivities : [];
      });

      await request(app)
        .post('/api/sync')
        .set('Cookie', `testSessionId=${testSessionId}`)
        .send({})
        .expect(202);

      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify first sync
      const db = getDatabase();
      let activity = db.getActivityById(123, TEST_USER_ID);
      expect(activity?.name).toBe('Original Name');
      expect(activity?.kudosCount).toBe(5);

      // Update activity and re-sync
      const updatedActivities = [
        createMockStravaActivity({ id: 123, name: 'Updated Name', kudos_count: 15 }),
      ];

      let secondSyncCalls = 0;
      vi.mocked(stravaActivities.getActivities).mockImplementation(async () => {
        secondSyncCalls++;
        return secondSyncCalls === 1 ? updatedActivities : [];
      });

      await request(app)
        .post('/api/sync')
        .set('Cookie', `testSessionId=${testSessionId}`)
        .send({})
        .expect(202);

      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify activity was updated, not duplicated
      activity = db.getActivityById(123, TEST_USER_ID);
      expect(activity?.name).toBe('Updated Name');
      expect(activity?.kudosCount).toBe(15);

      const allActivities = db.searchActivities({ userId: TEST_USER_ID, limit: 100 });
      expect(allActivities).toHaveLength(1); // No duplicate
    });

    it('should handle activities with null location data', async () => {
      const indoorActivity = createMockStravaActivity({
        id: 999,
        name: 'Indoor Trainer',
        start_latlng: undefined,
        end_latlng: undefined,
      });

      let callCount = 0;
      vi.mocked(stravaActivities.getActivities).mockImplementation(async () => {
        callCount++;
        return callCount === 1 ? [indoorActivity] : [];
      });

      await request(app)
        .post('/api/sync')
        .set('Cookie', `testSessionId=${testSessionId}`)
        .send({})
        .expect(202);

      await new Promise(resolve => setTimeout(resolve, 500));

      const db = getDatabase();
      const activity = db.getActivityById(999, TEST_USER_ID);
      expect(activity).toBeTruthy();
      expect(activity!.startLat).toBeNull();
      expect(activity!.startLng).toBeNull();
      expect(activity!.geohash).toBeNull();
    });
  });
});
