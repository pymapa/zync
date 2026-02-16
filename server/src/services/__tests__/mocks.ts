/**
 * Test mocks and utilities
 */

import { vi } from 'vitest';
import type { StravaActivity } from '../strava/types';
import type { StoredActivity, SyncStatus } from '../database/types';

/**
 * Create a mock Strava activity
 */
export function createMockStravaActivity(overrides: Partial<StravaActivity> = {}): StravaActivity {
  return {
    id: 12345678,
    resource_state: 2,
    external_id: null,
    upload_id: null,
    athlete: { id: 1, resource_state: 1 },
    name: 'Morning Run',
    distance: 5000,
    moving_time: 1800,
    elapsed_time: 1900,
    total_elevation_gain: 50,
    type: 'Run',
    sport_type: 'Run',
    workout_type: null,
    start_date: '2024-01-15T08:00:00Z',
    start_date_local: '2024-01-15T10:00:00',
    timezone: '(GMT+02:00) Europe/Helsinki',
    utc_offset: 7200,
    location_city: null,
    location_state: null,
    location_country: null,
    achievement_count: 0,
    kudos_count: 5,
    comment_count: 2,
    athlete_count: 1,
    photo_count: 0,
    map: {
      id: 'a12345',
      summary_polyline: 'abc123polyline',
      resource_state: 2,
    },
    trainer: false,
    commute: false,
    manual: false,
    private: false,
    visibility: 'everyone',
    flagged: false,
    gear_id: null,
    start_latlng: [60.1699, 24.9384],
    end_latlng: [60.1750, 24.9400],
    average_speed: 2.78,
    max_speed: 3.5,
    average_cadence: 85,
    average_watts: null,
    weighted_average_watts: null,
    kilojoules: null,
    device_watts: false,
    has_heartrate: true,
    average_heartrate: 145,
    max_heartrate: 165,
    heartrate_opt_out: false,
    display_hide_heartrate_option: false,
    elev_high: null,
    elev_low: null,
    upload_id_str: null,
    external_id_str: null,
    from_accepted_tag: false,
    pr_count: 0,
    total_photo_count: 0,
    has_kudoed: false,
    ...overrides,
  };
}

/**
 * Create a mock stored activity
 */
export function createMockStoredActivity(overrides: Partial<StoredActivity> = {}): StoredActivity {
  return {
    id: 12345678,
    userId: 1,
    name: 'Morning Run',
    type: 'Run',
    distanceMeters: 5000,
    movingTimeSeconds: 1800,
    elapsedTimeSeconds: 1900,
    elevationGainMeters: 50,
    startDate: Math.floor(new Date('2024-01-15T08:00:00Z').getTime() / 1000),
    startDateLocal: '2024-01-15T10:00:00',
    averageSpeed: 2.78,
    maxSpeed: 3.5,
    averageHeartrate: 145,
    maxHeartrate: 165,
    calories: null,
    description: null,
    averageCadence: 85,
    averageWatts: null,
    kudosCount: 5,
    commentCount: 2,
    summaryPolyline: 'abc123polyline',
    startLatlng: '[60.1699, 24.9384]',
    endLatlng: '[60.1750, 24.9400]',
    startLat: 60.1699,
    startLng: 24.9384,
    endLat: 60.1750,
    endLng: 24.9400,
    geohash: 'ud9wm1j',
    deviceName: null,
    gearId: null,
    maxWatts: null,
    weightedAverageWatts: null,
    kilojoules: null,
    sufferScore: null,
    elevHigh: null,
    elevLow: null,
    photosJson: null,
    hasDetailedData: false,
    createdAt: Math.floor(Date.now() / 1000),
    updatedAt: Math.floor(Date.now() / 1000),
    ...overrides,
  };
}

/**
 * Create a mock sync status
 */
export function createMockSyncStatus(overrides: Partial<SyncStatus> = {}): SyncStatus {
  return {
    userId: 1,
    lastSyncAt: Math.floor(Date.now() / 1000),
    lastActivityId: 12345678,
    syncState: 'completed',
    totalActivities: 100,
    errorMessage: null,
    syncStartedAt: null,
    createdAt: Math.floor(Date.now() / 1000) - 86400,
    updatedAt: Math.floor(Date.now() / 1000),
    ...overrides,
  };
}

/**
 * Create mock database interface
 */
export function createMockDatabase() {
  return {
    init: vi.fn(),
    close: vi.fn(),
    upsertActivity: vi.fn(),
    upsertActivities: vi.fn(),
    getActivityById: vi.fn(),
    searchActivities: vi.fn(),
    deleteUserActivities: vi.fn(),
    getUserActivityCount: vi.fn().mockReturnValue(0),
    getActivityStats: vi.fn().mockReturnValue({
      totalMovingTimeSeconds: 0,
      cyclingDistanceMeters: 0,
      runningDistanceMeters: 0,
      totalCalories: 0,
      activityCount: 0,
    }),
    getSyncStatus: vi.fn(),
    createSyncStatus: vi.fn(),
    updateSyncStatus: vi.fn(),
    deleteSyncStatus: vi.fn(),
    tryAcquireSyncLock: vi.fn().mockReturnValue(true),
    resetStuckSync: vi.fn().mockReturnValue(false),
    // Detailed activity methods
    upsertDetailedActivity: vi.fn(),
    getActivityLaps: vi.fn().mockReturnValue([]),
    getActivitySplitsMetric: vi.fn().mockReturnValue([]),
    getActivityBestEfforts: vi.fn().mockReturnValue([]),
    getActivitySegmentEfforts: vi.fn().mockReturnValue([]),
    deleteActivityDetails: vi.fn(),
  };
}

/**
 * Create mock LRU cache
 */
export function createMockCache() {
  const cache = new Map<string, unknown>();
  return {
    get: vi.fn((key: string) => cache.get(key)),
    set: vi.fn((key: string, value: unknown) => {
      cache.set(key, value);
    }),
    delete: vi.fn((key: string) => cache.delete(key)),
    clear: vi.fn(() => cache.clear()),
  };
}

/**
 * Create mock Strava client
 */
export function createMockStravaClient(activities: StravaActivity[][] = []) {
  let pageIndex = 0;
  return {
    get: vi.fn().mockImplementation(() => {
      const result = activities[pageIndex] || [];
      pageIndex++;
      return Promise.resolve(result);
    }),
  };
}
