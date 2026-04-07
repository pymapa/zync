/**
 * Activities service tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ActivitiesService } from '../activities';
import { createMockStoredActivity, createMockStravaActivity, createMockDatabase } from './mocks';
import { LRUCache } from '../cache/cache';

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
  getActivityById: vi.fn(),
}));

vi.mock('../../types/mappers', () => ({
  mapStravaActivity: vi.fn((a) => ({
    id: a.id,
    name: a.name,
    type: a.sport_type,
    distanceMeters: a.distance,
    movingTimeSeconds: a.moving_time,
    elapsedTimeSeconds: a.elapsed_time,
    elevationGainMeters: a.total_elevation_gain,
    startDate: a.start_date,
    startDateLocal: a.start_date_local,
    averageSpeed: a.average_speed,
    maxSpeed: a.max_speed,
    averageHeartRate: a.average_heartrate,
    maxHeartRate: a.max_heartrate,
    kudosCount: a.kudos_count,
    commentCount: a.comment_count,
  })),
  mapStravaDetailedActivity: vi.fn((a) => ({
    id: a.id,
    name: a.name,
    type: a.sport_type,
    distanceMeters: a.distance,
    movingTimeSeconds: a.moving_time,
    elapsedTimeSeconds: a.elapsed_time,
    elevationGainMeters: a.total_elevation_gain,
    startDate: a.start_date,
    startDateLocal: a.start_date_local,
    averageSpeed: a.average_speed,
    maxSpeed: a.max_speed,
    averageHeartRate: a.average_heartrate,
    maxHeartRate: a.max_heartrate,
    kudosCount: a.kudos_count,
    commentCount: a.comment_count,
    description: a.description,
    calories: a.calories,
  })),
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
import { getActivities, getActivityById } from '../strava/activities';

describe('ActivitiesService', () => {
  let service: ActivitiesService;
  let mockDb: ReturnType<typeof createMockDatabase>;
  let mockCache: LRUCache<unknown>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = createMockDatabase();
    vi.mocked(getDatabase).mockReturnValue(mockDb as any);

    mockCache = new LRUCache({ maxSize: 100, defaultTtlSeconds: 300 });
    service = new ActivitiesService(mockCache);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('listActivities', () => {
    const defaultParams = {
      userId: 1,
      accessToken: 'test_token',
      page: 1,
      perPage: 30,
    };

    describe('source: local', () => {
      it('should fetch activities from database', async () => {
        const storedActivities = [
          createMockStoredActivity({ id: 1 }),
          createMockStoredActivity({ id: 2 }),
        ];
        mockDb.searchActivities.mockReturnValue(storedActivities);

        const result = await service.listActivities({
          ...defaultParams,
          source: 'local',
        });

        expect(mockDb.searchActivities).toHaveBeenCalledWith({
          userId: 1,
          startDateFrom: undefined,
          startDateTo: undefined,
          limit: 30,
          offset: 0,
        });
        expect(result.activities).toHaveLength(2);
        expect(result.source).toBe('local');
        expect(result.cached).toBe(false);
      });

      it('should calculate offset from page', async () => {
        mockDb.searchActivities.mockReturnValue([]);

        await service.listActivities({
          ...defaultParams,
          page: 3,
          perPage: 20,
          source: 'local',
        });

        expect(mockDb.searchActivities).toHaveBeenCalledWith(expect.objectContaining({
          limit: 20,
          offset: 40, // (3-1) * 20
        }));
      });

      it('should set hasMore based on result count', async () => {
        mockDb.searchActivities.mockReturnValue(
          Array.from({ length: 30 }, (_, i) => createMockStoredActivity({ id: i }))
        );

        const result = await service.listActivities({
          ...defaultParams,
          perPage: 30,
          source: 'local',
        });

        expect(result.hasMore).toBe(true);
      });

      it('should set hasMore false when less than perPage returned', async () => {
        mockDb.searchActivities.mockReturnValue([createMockStoredActivity()]);

        const result = await service.listActivities({
          ...defaultParams,
          perPage: 30,
          source: 'local',
        });

        expect(result.hasMore).toBe(false);
      });

      it('should pass date filters to database', async () => {
        mockDb.searchActivities.mockReturnValue([]);

        await service.listActivities({
          ...defaultParams,
          before: 1700000000,
          after: 1600000000,
          source: 'local',
        });

        expect(mockDb.searchActivities).toHaveBeenCalledWith(expect.objectContaining({
          startDateFrom: 1600000000,
          startDateTo: 1700000000,
        }));
      });
    });

    describe('source: strava', () => {
      it('should fetch activities from Strava API', async () => {
        const stravaActivities = [
          createMockStravaActivity({ id: 1 }),
          createMockStravaActivity({ id: 2 }),
        ];
        vi.mocked(getActivities).mockResolvedValue(stravaActivities);

        const result = await service.listActivities({
          ...defaultParams,
          source: 'strava',
        });

        expect(getActivities).toHaveBeenCalled();
        expect(result.activities).toHaveLength(2);
        expect(result.source).toBe('strava');
      });

      it('should cache Strava results', async () => {
        vi.mocked(getActivities).mockResolvedValue([createMockStravaActivity()]);

        // First call
        await service.listActivities({ ...defaultParams, source: 'strava' });
        // Second call
        const result = await service.listActivities({ ...defaultParams, source: 'strava' });

        expect(getActivities).toHaveBeenCalledTimes(1);
        expect(result.cached).toBe(true);
      });
    });

    describe('source: auto (default)', () => {
      it('should use local database first', async () => {
        const storedActivities = [createMockStoredActivity()];
        mockDb.searchActivities.mockReturnValue(storedActivities);

        const result = await service.listActivities(defaultParams);

        expect(mockDb.searchActivities).toHaveBeenCalled();
        expect(getActivities).not.toHaveBeenCalled();
        expect(result.source).toBe('local');
      });

      it('should fallback to Strava when local is empty on page 1', async () => {
        mockDb.searchActivities.mockReturnValue([]);
        vi.mocked(getActivities).mockResolvedValue([createMockStravaActivity()]);

        const result = await service.listActivities({ ...defaultParams, page: 1 });

        expect(mockDb.searchActivities).toHaveBeenCalled();
        expect(getActivities).toHaveBeenCalled();
        expect(result.source).toBe('strava');
      });

      it('should NOT fallback to Strava on page > 1', async () => {
        mockDb.searchActivities.mockReturnValue([]);

        const result = await service.listActivities({ ...defaultParams, page: 2 });

        expect(mockDb.searchActivities).toHaveBeenCalled();
        expect(getActivities).not.toHaveBeenCalled();
        expect(result.source).toBe('local');
        expect(result.activities).toHaveLength(0);
      });
    });
  });

  describe('getActivity', () => {
    const defaultParams = {
      userId: 1,
      accessToken: 'test_token',
      activityId: 12345,
    };

    describe('source: local', () => {
      it('should fetch activity from database', async () => {
        const storedActivity = createMockStoredActivity({ id: 12345, hasDetailedData: true });
        mockDb.getActivityById.mockReturnValue(storedActivity);

        const result = await service.getActivity({
          ...defaultParams,
          source: 'local',
        });

        expect(mockDb.getActivityById).toHaveBeenCalledWith(12345, 1);
        expect(result?.activity.id).toBe(12345);
        expect(result?.source).toBe('local');
      });

      it('should return null when activity not found', async () => {
        mockDb.getActivityById.mockReturnValue(null);

        const result = await service.getActivity({
          ...defaultParams,
          source: 'local',
        });

        expect(result).toBeNull();
      });
    });

    describe('source: strava', () => {
      it('should fetch activity from Strava API', async () => {
        const stravaActivity = createMockStravaActivity({ id: 12345 });
        vi.mocked(getActivityById).mockResolvedValue(stravaActivity as any);

        const result = await service.getActivity({
          ...defaultParams,
          source: 'strava',
        });

        expect(getActivityById).toHaveBeenCalled();
        expect(result?.source).toBe('strava');
      });

      it('should cache Strava result', async () => {
        vi.mocked(getActivityById).mockResolvedValue(createMockStravaActivity() as any);

        // First call
        await service.getActivity({ ...defaultParams, source: 'strava' });
        // Second call
        const result = await service.getActivity({ ...defaultParams, source: 'strava' });

        expect(getActivityById).toHaveBeenCalledTimes(1);
        expect(result?.cached).toBe(true);
      });
    });

    describe('source: auto (default)', () => {
      it('should use local database first', async () => {
        const storedActivity = createMockStoredActivity({ id: 12345, hasDetailedData: true });
        mockDb.getActivityById.mockReturnValue(storedActivity);

        const result = await service.getActivity(defaultParams);

        expect(mockDb.getActivityById).toHaveBeenCalled();
        expect(getActivityById).not.toHaveBeenCalled();
        expect(result?.source).toBe('local');
      });

      it('should fallback to Strava when not in local database', async () => {
        mockDb.getActivityById.mockReturnValue(null);
        vi.mocked(getActivityById).mockResolvedValue(createMockStravaActivity() as any);

        const result = await service.getActivity(defaultParams);

        expect(mockDb.getActivityById).toHaveBeenCalled();
        expect(getActivityById).toHaveBeenCalled();
        expect(result?.source).toBe('strava');
      });
    });
  });

  describe('getStats', () => {
    it('should return aggregated stats from database', async () => {
      mockDb.getActivityStats.mockReturnValue({
        totalMovingTimeSeconds: 7200,
        cyclingDistanceMeters: 50000,
        runningDistanceMeters: 10000,
        totalCalories: 1500,
        activityCount: 5,
      });

      const result = await service.getStats({ userId: 1, period: 'week' });

      expect(result.totalMovingTimeSeconds).toBe(7200);
      expect(result.cyclingDistanceMeters).toBe(50000);
      expect(result.runningDistanceMeters).toBe(10000);
      expect(result.totalCalories).toBe(1500);
      expect(result.activityCount).toBe(5);
      expect(result.period).toBe('week');
    });

    it('should pass correct date range for week period', () => {
      service.getStats({ userId: 1, period: 'week' });

      expect(mockDb.getActivityStats).toHaveBeenCalledWith({
        userId: 1,
        startDateFrom: expect.any(Number),
        startDateTo: undefined,
      });

      // Verify the date is a Monday at midnight
      const call = mockDb.getActivityStats.mock.calls[0]![0];
      const date = new Date(call.startDateFrom! * 1000);
      expect(date.getDay()).toBe(1); // Monday
      expect(date.getHours()).toBe(0);
      expect(date.getMinutes()).toBe(0);
    });

    it('should pass correct date range for last_week period', () => {
      service.getStats({ userId: 1, period: 'last_week' });

      expect(mockDb.getActivityStats).toHaveBeenCalledWith({
        userId: 1,
        startDateFrom: expect.any(Number),
        startDateTo: expect.any(Number),
      });

      const call = mockDb.getActivityStats.mock.calls[0]![0];
      const fromDate = new Date(call.startDateFrom! * 1000);
      const toDate = new Date(call.startDateTo! * 1000);

      // Both should be Mondays at midnight
      expect(fromDate.getDay()).toBe(1);
      expect(toDate.getDay()).toBe(1);
      expect(fromDate.getHours()).toBe(0);
      expect(toDate.getHours()).toBe(0);
      // Difference should be exactly 7 calendar days (use UTC to avoid DST shifts)
      const diffMs = Date.UTC(toDate.getFullYear(), toDate.getMonth(), toDate.getDate())
        - Date.UTC(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
      expect(diffMs / (24 * 60 * 60 * 1000)).toBe(7);
    });

    it('should pass correct date range for month period', () => {
      service.getStats({ userId: 1, period: 'month' });

      const call = mockDb.getActivityStats.mock.calls[0]![0];
      const date = new Date(call.startDateFrom! * 1000);

      expect(date.getDate()).toBe(1); // First of month
      expect(date.getHours()).toBe(0);
    });

    it('should pass correct date range for year period', () => {
      service.getStats({ userId: 1, period: 'year' });

      const call = mockDb.getActivityStats.mock.calls[0]![0];
      const date = new Date(call.startDateFrom! * 1000);

      expect(date.getMonth()).toBe(0); // January
      expect(date.getDate()).toBe(1); // First
    });

    it('should pass correct date range for last_year period', () => {
      service.getStats({ userId: 1, period: 'last_year' });

      const call = mockDb.getActivityStats.mock.calls[0]![0];
      const fromDate = new Date(call.startDateFrom! * 1000);
      const toDate = new Date(call.startDateTo! * 1000);

      const now = new Date();
      expect(fromDate.getFullYear()).toBe(now.getFullYear() - 1);
      expect(fromDate.getMonth()).toBe(0);
      expect(fromDate.getDate()).toBe(1);

      expect(toDate.getFullYear()).toBe(now.getFullYear());
      expect(toDate.getMonth()).toBe(0);
      expect(toDate.getDate()).toBe(1);
    });

    it('should pass no date filters for all period', () => {
      service.getStats({ userId: 1, period: 'all' });

      expect(mockDb.getActivityStats).toHaveBeenCalledWith({
        userId: 1,
        startDateFrom: undefined,
        startDateTo: undefined,
      });
    });
  });

  describe('Activity mapping', () => {
    it('should map stored activity to Activity type correctly', async () => {
      const stored = createMockStoredActivity({
        id: 999,
        name: 'Test Run',
        type: 'Run',
        distanceMeters: 10000,
        movingTimeSeconds: 3600,
      });
      mockDb.searchActivities.mockReturnValue([stored]);

      const result = await service.listActivities({
        userId: 1,
        accessToken: 'token',
        source: 'local',
      });

      const activity = result.activities[0];
      expect(activity).toBeDefined();
      expect(activity!.id).toBe(999);
      expect(activity!.name).toBe('Test Run');
      expect(activity!.type).toBe('Run');
      expect(activity!.distanceMeters).toBe(10000);
      expect(activity!.movingTimeSeconds).toBe(3600);
    });

    it('should parse latlng from JSON string', async () => {
      const stored = createMockStoredActivity({
        startLatlng: '[60.17, 24.94]',
        endLatlng: '[60.18, 24.95]',
        hasDetailedData: true,
      });
      mockDb.getActivityById.mockReturnValue(stored);

      const result = await service.getActivity({
        userId: 1,
        accessToken: 'token',
        activityId: 1,
        source: 'local',
      });

      expect(result?.activity.startLatLng).toEqual([60.17, 24.94]);
      expect(result?.activity.endLatLng).toEqual([60.18, 24.95]);
    });

    it('should handle invalid JSON in latlng gracefully', async () => {
      const stored = createMockStoredActivity({
        startLatlng: 'invalid json',
        endLatlng: null,
        hasDetailedData: true,
      });
      mockDb.getActivityById.mockReturnValue(stored);

      const result = await service.getActivity({
        userId: 1,
        accessToken: 'token',
        activityId: 1,
        source: 'local',
      });

      expect(result?.activity.startLatLng).toBeNull();
      expect(result?.activity.endLatLng).toBeNull();
    });
  });
});
