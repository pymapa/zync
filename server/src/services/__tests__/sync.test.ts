/**
 * Sync service tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  mapStravaActivityToInput,
  startSync,
  getSyncProgress,
  tryAcquireSyncLock,
  resetStuckSync
} from '../sync';
import { createMockStravaActivity, createMockDatabase, createMockSyncStatus } from './mocks';

// Mock dependencies
vi.mock('../database', () => ({
  getDatabase: vi.fn(),
}));

vi.mock('../strava/client', () => {
  return {
    StravaClient: class MockStravaClient {
      constructor(public accessToken: string) {}
      get = vi.fn();
    },
  };
});

vi.mock('../strava/activities', () => ({
  getActivities: vi.fn(),
}));

vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { getDatabase } from '../database';
import { getActivities } from '../strava/activities';

describe('Sync Service', () => {
  let mockDb: ReturnType<typeof createMockDatabase>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDatabase();
    vi.mocked(getDatabase).mockReturnValue(mockDb as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('mapStravaActivityToInput', () => {
    it('should map all basic fields correctly', () => {
      const stravaActivity = createMockStravaActivity();
      const result = mapStravaActivityToInput(stravaActivity, 1);

      expect(result.id).toBe(stravaActivity.id);
      expect(result.userId).toBe(1);
      expect(result.name).toBe('Morning Run');
      expect(result.type).toBe('Run');
      expect(result.distanceMeters).toBe(5000);
      expect(result.movingTimeSeconds).toBe(1800);
      expect(result.elapsedTimeSeconds).toBe(1900);
      expect(result.elevationGainMeters).toBe(50);
      expect(result.averageSpeed).toBe(2.78);
      expect(result.maxSpeed).toBe(3.5);
    });

    it('should map heart rate data', () => {
      const stravaActivity = createMockStravaActivity({
        average_heartrate: 150,
        max_heartrate: 175,
      });
      const result = mapStravaActivityToInput(stravaActivity, 1);

      expect(result.averageHeartrate).toBe(150);
      expect(result.maxHeartrate).toBe(175);
    });

    it('should handle missing heart rate data', () => {
      const stravaActivity = createMockStravaActivity({
        average_heartrate: undefined,
        max_heartrate: undefined,
      });
      const result = mapStravaActivityToInput(stravaActivity, 1);

      expect(result.averageHeartrate).toBeNull();
      expect(result.maxHeartrate).toBeNull();
    });

    it('should map location data correctly', () => {
      const stravaActivity = createMockStravaActivity({
        start_latlng: [60.1699, 24.9384],
        end_latlng: [60.1750, 24.9400],
      });
      const result = mapStravaActivityToInput(stravaActivity, 1);

      expect(result.startLat).toBe(60.1699);
      expect(result.startLng).toBe(24.9384);
      expect(result.endLat).toBe(60.1750);
      expect(result.endLng).toBe(24.9400);
      expect(result.startLatlng).toBe('[60.1699,24.9384]');
      expect(result.endLatlng).toBe('[60.175,24.94]');
    });

    it('should handle missing location data', () => {
      const stravaActivity = createMockStravaActivity({
        start_latlng: undefined,
        end_latlng: undefined,
      });
      const result = mapStravaActivityToInput(stravaActivity, 1);

      expect(result.startLat).toBeNull();
      expect(result.startLng).toBeNull();
      expect(result.endLat).toBeNull();
      expect(result.endLng).toBeNull();
      expect(result.startLatlng).toBeNull();
      expect(result.endLatlng).toBeNull();
    });

    it('should map polyline from map object', () => {
      const stravaActivity = createMockStravaActivity({
        map: {
          id: 'a123',
          summary_polyline: 'encoded_polyline_string',
          resource_state: 2,
        },
      });
      const result = mapStravaActivityToInput(stravaActivity, 1);

      expect(result.summaryPolyline).toBe('encoded_polyline_string');
    });

    it('should handle missing map data', () => {
      const stravaActivity = createMockStravaActivity({
        map: undefined,
      });
      const result = mapStravaActivityToInput(stravaActivity, 1);

      expect(result.summaryPolyline).toBeNull();
    });

    it('should convert start_date to timestamp', () => {
      const stravaActivity = createMockStravaActivity({
        start_date: '2024-01-15T08:00:00Z',
      });
      const result = mapStravaActivityToInput(stravaActivity, 1);

      // Database stores Unix timestamps in seconds, not milliseconds
      expect(result.startDate).toBe(Math.floor(new Date('2024-01-15T08:00:00Z').getTime() / 1000));
    });

    it('should map social counts', () => {
      const stravaActivity = createMockStravaActivity({
        kudos_count: 10,
        comment_count: 3,
      });
      const result = mapStravaActivityToInput(stravaActivity, 1);

      expect(result.kudosCount).toBe(10);
      expect(result.commentCount).toBe(3);
    });
  });

  describe('startSync', () => {
    it('should create sync status if not exists', async () => {
      mockDb.getSyncStatus.mockReturnValue(null);
      mockDb.createSyncStatus.mockReturnValue(createMockSyncStatus({ syncState: 'pending' }));
      vi.mocked(getActivities).mockResolvedValue([]);

      await startSync(1, 'test_token');

      expect(mockDb.createSyncStatus).toHaveBeenCalledWith(1);
    });

    it('should update sync status to syncing at start', async () => {
      mockDb.getSyncStatus.mockReturnValue(createMockSyncStatus());
      vi.mocked(getActivities).mockResolvedValue([]);

      await startSync(1, 'test_token');

      expect(mockDb.updateSyncStatus).toHaveBeenCalledWith(1, expect.objectContaining({
        syncState: 'syncing',
      }));
    });

    it('should fetch and store activities', async () => {
      const activities = [
        createMockStravaActivity({ id: 1 }),
        createMockStravaActivity({ id: 2 }),
      ];

      mockDb.getSyncStatus.mockReturnValue(createMockSyncStatus());
      vi.mocked(getActivities).mockResolvedValueOnce(activities).mockResolvedValueOnce([]);

      const result = await startSync(1, 'test_token');

      expect(mockDb.upsertActivities).toHaveBeenCalledTimes(1);
      expect(result.totalActivitiesFetched).toBe(2);
      expect(result.totalActivitiesStored).toBe(2);
    });

    it('should paginate through all activities', async () => {
      const page1 = Array.from({ length: 200 }, (_, i) => createMockStravaActivity({ id: i + 1 }));
      const page2 = Array.from({ length: 50 }, (_, i) => createMockStravaActivity({ id: i + 201 }));

      mockDb.getSyncStatus.mockReturnValue(createMockSyncStatus({ lastActivityId: null, totalActivities: 0 }));

      // Clear any previous mock implementations and set up chain
      vi.mocked(getActivities).mockReset();
      vi.mocked(getActivities)
        .mockResolvedValueOnce(page1)
        .mockResolvedValueOnce(page2);

      const result = await startSync(1, 'test_token', {
        delayBetweenPages: 0,
        pageSize: 200
      });

      expect(getActivities).toHaveBeenCalledTimes(2);
      expect(result.totalActivitiesFetched).toBe(250);
      expect(result.pagesProcessed).toBe(2);
      expect(result.syncMode).toBe('full');
    });

    it('should update sync status to completed on success', async () => {
      mockDb.getSyncStatus.mockReturnValue(createMockSyncStatus());
      vi.mocked(getActivities).mockResolvedValue([]);

      await startSync(1, 'test_token');

      expect(mockDb.updateSyncStatus).toHaveBeenLastCalledWith(1, expect.objectContaining({
        syncState: 'completed',
      }));
    });

    it('should update sync status to error on failure', async () => {
      mockDb.getSyncStatus.mockReturnValue(createMockSyncStatus());
      vi.mocked(getActivities).mockRejectedValue(new Error('API Error'));

      await expect(startSync(1, 'test_token')).rejects.toThrow();

      expect(mockDb.updateSyncStatus).toHaveBeenCalledWith(1, expect.objectContaining({
        syncState: 'error',
      }));
    });

    it('should respect maxPages limit', async () => {
      const fullPage = Array.from({ length: 200 }, (_, i) => createMockStravaActivity({ id: i + 1 }));

      mockDb.getSyncStatus.mockReturnValue(createMockSyncStatus({ lastActivityId: null, totalActivities: 0 }));
      vi.mocked(getActivities).mockResolvedValue(fullPage);

      const result = await startSync(1, 'test_token', {
        maxPages: 3,
        delayBetweenPages: 0
      });

      expect(getActivities).toHaveBeenCalledTimes(3);
      expect(result.status).toBe('partial');
    });

    it('should return completed status when all activities fetched', async () => {
      mockDb.getSyncStatus.mockReturnValue(createMockSyncStatus());
      vi.mocked(getActivities).mockResolvedValue([]);

      const result = await startSync(1, 'test_token');

      expect(result.status).toBe('completed');
    });

    it('should track lastActivityId from most recent activity', async () => {
      const activities = [
        createMockStravaActivity({ id: 999 }),
        createMockStravaActivity({ id: 998 }),
      ];

      mockDb.getSyncStatus.mockReturnValue(createMockSyncStatus());
      vi.mocked(getActivities).mockResolvedValueOnce(activities).mockResolvedValueOnce([]);

      await startSync(1, 'test_token');

      expect(mockDb.updateSyncStatus).toHaveBeenCalledWith(1, expect.objectContaining({
        lastActivityId: 999,
      }));
    });
  });

  describe('getSyncProgress', () => {
    it('should return sync status if exists', async () => {
      const syncStatus = createMockSyncStatus({ totalActivities: 150 });
      mockDb.getSyncStatus.mockReturnValue(syncStatus);

      const result = await getSyncProgress(1);

      expect(result).toEqual(syncStatus);
    });

    it('should return null if user has never synced', async () => {
      mockDb.getSyncStatus.mockReturnValue(null);

      const result = await getSyncProgress(1);

      expect(result).toBeNull();
    });
  });

  describe('startSync - Additional Test Scenarios', () => {
    describe('Empty activities handling', () => {
      it('should handle user with no activities gracefully', async () => {
        mockDb.getSyncStatus.mockReturnValue(createMockSyncStatus());
        mockDb.getUserActivityCount.mockReturnValue(0);
        vi.mocked(getActivities).mockResolvedValue([]);

        const result = await startSync(1, 'test_token');

        expect(result.status).toBe('completed');
        expect(result.totalActivitiesFetched).toBe(0);
        expect(result.totalActivitiesStored).toBe(0);
        expect(mockDb.updateSyncStatus).toHaveBeenCalledWith(1, expect.objectContaining({
          syncState: 'completed',
          totalActivities: 0,
        }));
      });
    });

    describe('State transitions', () => {
      it('should transition from pending to syncing to completed', async () => {
        mockDb.getSyncStatus.mockReturnValue(createMockSyncStatus({ syncState: 'pending' }));
        mockDb.getUserActivityCount.mockReturnValue(5);

        const activities = Array.from({ length: 5 }, (_, i) =>
          createMockStravaActivity({ id: i + 1 })
        );
        vi.mocked(getActivities).mockResolvedValueOnce(activities).mockResolvedValueOnce([]);

        await startSync(1, 'test_token', { delayBetweenPages: 0 });

        // Check that state was set to syncing after first successful API call
        expect(mockDb.updateSyncStatus).toHaveBeenCalledWith(1, expect.objectContaining({
          syncState: 'syncing',
        }));

        // Check that final state is completed
        expect(mockDb.updateSyncStatus).toHaveBeenLastCalledWith(1, expect.objectContaining({
          syncState: 'completed',
          syncStartedAt: null,
        }));
      });

      it('should not set syncing state if first API call fails', async () => {
        mockDb.getSyncStatus.mockReturnValue(createMockSyncStatus({ syncState: 'pending' }));

        // Reset and setup mock to properly reject
        vi.mocked(getActivities).mockReset();
        vi.mocked(getActivities).mockRejectedValueOnce(new Error('API Error on first page'));

        await expect(startSync(1, 'test_token')).rejects.toThrow();

        // Should set error state but never set syncing state
        // (syncing state is only set AFTER first successful API call)
        const calls = mockDb.updateSyncStatus.mock.calls;
        const syncingStateCalls = calls.filter(call =>
          call[1]?.syncState === 'syncing'
        );

        expect(syncingStateCalls).toHaveLength(0);

        // Should have set error state
        expect(mockDb.updateSyncStatus).toHaveBeenCalledWith(1, expect.objectContaining({
          syncState: 'error',
          errorMessage: 'API Error on first page',
          syncStartedAt: null,
        }));
      });

      it('should set error state and clear syncStartedAt on failure', async () => {
        mockDb.getSyncStatus.mockReturnValue(createMockSyncStatus({ lastActivityId: null, totalActivities: 0 }));

        // First page succeeds, second page fails
        vi.mocked(getActivities)
          .mockResolvedValueOnce(Array.from({ length: 200 }, (_, i) =>
            createMockStravaActivity({ id: i + 1 })
          ))
          .mockRejectedValueOnce(new Error('Network timeout on page 2'));

        await expect(startSync(1, 'test_token', { delayBetweenPages: 0 })).rejects.toThrow();

        expect(mockDb.updateSyncStatus).toHaveBeenCalledWith(1, expect.objectContaining({
          syncState: 'error',
          errorMessage: 'Network timeout on page 2',
          syncStartedAt: null,
        }));
      });
    });

    describe('Error state with error message', () => {
      it('should set errorMessage on database error', async () => {
        mockDb.getSyncStatus.mockReturnValue(createMockSyncStatus());
        const activities = [createMockStravaActivity({ id: 1 })];
        vi.mocked(getActivities).mockResolvedValue(activities);

        // Simulate database error on upsert
        mockDb.upsertActivities.mockImplementation(() => {
          throw new Error('Database write failure: disk quota exceeded');
        });

        await expect(startSync(1, 'test_token')).rejects.toThrow();

        expect(mockDb.updateSyncStatus).toHaveBeenCalledWith(1, expect.objectContaining({
          syncState: 'error',
          errorMessage: 'Database write failure: disk quota exceeded',
        }));
      });

      it('should clear errorMessage on successful sync after previous error', async () => {
        mockDb.getSyncStatus.mockReturnValue(
          createMockSyncStatus({
            syncState: 'error',
            errorMessage: 'Previous error'
          })
        );
        vi.mocked(getActivities).mockResolvedValue([]);

        await startSync(1, 'test_token');

        // Check that errorMessage is cleared on success
        expect(mockDb.updateSyncStatus).toHaveBeenCalledWith(1, expect.objectContaining({
          syncState: 'completed',
          errorMessage: null,
        }));
      });
    });

    describe('Pagination edge cases', () => {
      it('should process multiple pages correctly with progress updates', async () => {
        mockDb.getSyncStatus.mockReturnValue(createMockSyncStatus({ lastActivityId: null, totalActivities: 0 }));
        mockDb.getUserActivityCount.mockReturnValue(450);

        const page1 = Array.from({ length: 200 }, (_, i) =>
          createMockStravaActivity({ id: i + 1 })
        );
        const page2 = Array.from({ length: 200 }, (_, i) =>
          createMockStravaActivity({ id: i + 201 })
        );
        const page3 = Array.from({ length: 50 }, (_, i) =>
          createMockStravaActivity({ id: i + 401 })
        );

        vi.mocked(getActivities)
          .mockResolvedValueOnce(page1)
          .mockResolvedValueOnce(page2)
          .mockResolvedValueOnce(page3);

        const result = await startSync(1, 'test_token', {
          delayBetweenPages: 0,
          pageSize: 200
        });

        expect(result.totalActivitiesFetched).toBe(450);
        expect(result.pagesProcessed).toBe(3);
        expect(result.status).toBe('completed');

        // Verify final lastActivityId is the highest ID seen across all pages
        expect(mockDb.updateSyncStatus).toHaveBeenLastCalledWith(1, expect.objectContaining({
          lastActivityId: 450,
        }));
      });

      it('should stop pagination when page returns less than pageSize', async () => {
        mockDb.getSyncStatus.mockReturnValue(createMockSyncStatus({ lastActivityId: null, totalActivities: 0 }));

        const page1 = Array.from({ length: 200 }, (_, i) =>
          createMockStravaActivity({ id: i + 1 })
        );
        const page2 = Array.from({ length: 150 }, (_, i) =>
          createMockStravaActivity({ id: i + 201 })
        );

        vi.mocked(getActivities)
          .mockResolvedValueOnce(page1)
          .mockResolvedValueOnce(page2);

        const result = await startSync(1, 'test_token', {
          delayBetweenPages: 0,
          pageSize: 200
        });

        expect(getActivities).toHaveBeenCalledTimes(2);
        expect(result.totalActivitiesFetched).toBe(350);
        expect(result.status).toBe('completed');
      });
    });

    describe('Activity upsert behavior', () => {
      it('should update existing activity on conflict', async () => {
        mockDb.getSyncStatus.mockReturnValue(createMockSyncStatus());

        const updatedActivity = createMockStravaActivity({
          id: 123,
          name: 'Updated Morning Run',
          kudos_count: 15
        });
        vi.mocked(getActivities).mockResolvedValueOnce([updatedActivity]).mockResolvedValueOnce([]);

        await startSync(1, 'test_token', { delayBetweenPages: 0 });

        expect(mockDb.upsertActivities).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              id: 123,
              name: 'Updated Morning Run',
              kudosCount: 15,
            })
          ])
        );
      });
    });
  });

  describe('tryAcquireSyncLock', () => {
    it('should acquire lock when no sync in progress', async () => {
      mockDb.tryAcquireSyncLock.mockReturnValue(true);

      const result = await tryAcquireSyncLock(1);

      expect(result).toBe(true);
      expect(mockDb.tryAcquireSyncLock).toHaveBeenCalledWith(1, undefined);
    });

    it('should not acquire lock when sync is in progress', async () => {
      mockDb.tryAcquireSyncLock.mockReturnValue(false);

      const result = await tryAcquireSyncLock(1);

      expect(result).toBe(false);
    });

    it('should pass timeout parameter to database', async () => {
      mockDb.tryAcquireSyncLock.mockReturnValue(true);
      const customTimeout = 300000; // 5 minutes

      await tryAcquireSyncLock(1, customTimeout);

      expect(mockDb.tryAcquireSyncLock).toHaveBeenCalledWith(1, customTimeout);
    });

    it('should acquire lock if previous sync timed out', async () => {
      // Mock database behavior: first sync timed out, so lock is available
      mockDb.tryAcquireSyncLock.mockReturnValue(true);

      const result = await tryAcquireSyncLock(1, 600000);

      expect(result).toBe(true);
    });
  });

  describe('resetStuckSync', () => {
    it('should reset stuck sync that exceeded timeout', async () => {
      mockDb.resetStuckSync.mockReturnValue(true);

      const result = await resetStuckSync(1);

      expect(result).toBe(true);
      expect(mockDb.resetStuckSync).toHaveBeenCalledWith(1, undefined);
    });

    it('should not reset sync that is still active', async () => {
      mockDb.resetStuckSync.mockReturnValue(false);

      const result = await resetStuckSync(1);

      expect(result).toBe(false);
    });

    it('should pass timeout parameter to database', async () => {
      mockDb.resetStuckSync.mockReturnValue(true);
      const customTimeout = 300000; // 5 minutes

      await resetStuckSync(1, customTimeout);

      expect(mockDb.resetStuckSync).toHaveBeenCalledWith(1, customTimeout);
    });

    it('should return false when no stuck sync exists', async () => {
      mockDb.resetStuckSync.mockReturnValue(false);

      const result = await resetStuckSync(1, 600000);

      expect(result).toBe(false);
    });
  });
});
