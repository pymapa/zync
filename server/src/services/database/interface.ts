/**
 * Database interface - abstraction layer for swapping DBMS implementations
 * All methods are async to support both sync (SQLite) and async (PostgreSQL) backends
 */

import type {
  SyncStatus,
  StoredActivity,
  ActivityInput,
  ActivitySearchFilters,
  SyncStatusUpdate,
  DetailedActivityData,
  StoredActivityLap,
  StoredActivitySplitMetric,
  StoredActivityBestEffort,
  StoredActivitySegmentEffort,
  ActivityStats,
  ActivityStatsFilters,
  DailyActivityStats,
  ActivityStreaks,
} from './types';

export interface IDatabase {
  /**
   * Initialize database connection and run migrations
   */
  init(): Promise<void>;

  /**
   * Close database connection gracefully
   */
  close(): Promise<void>;

  // Activity operations
  upsertActivity(activity: ActivityInput): Promise<void>;
  upsertActivities(activities: ActivityInput[]): Promise<void>;
  getActivityById(activityId: number, userId: number): Promise<StoredActivity | null>;
  searchActivities(filters: ActivitySearchFilters): Promise<StoredActivity[]>;
  deleteUserActivities(userId: number): Promise<void>;
  getUserActivityCount(userId: number): Promise<number>;
  getActivityStats(filters: ActivityStatsFilters): Promise<ActivityStats>;
  getActivityStreaks(userId: number): Promise<ActivityStreaks>;
  getDailyActivityStats(filters: ActivityStatsFilters): Promise<DailyActivityStats[]>;

  /**
   * Store complete detailed activity data including all nested structures.
   * This atomically stores the activity and all related data (laps, splits, efforts).
   * Sets hasDetailedData flag to true.
   */
  upsertDetailedActivity(data: DetailedActivityData): Promise<void>;

  /**
   * Get activity laps for a specific activity
   */
  getActivityLaps(activityId: number): Promise<StoredActivityLap[]>;

  /**
   * Get metric splits for a specific activity
   */
  getActivitySplitsMetric(activityId: number): Promise<StoredActivitySplitMetric[]>;

  /**
   * Get best efforts for a specific activity
   */
  getActivityBestEfforts(activityId: number): Promise<StoredActivityBestEffort[]>;

  /**
   * Get segment efforts for a specific activity
   */
  getActivitySegmentEfforts(activityId: number): Promise<StoredActivitySegmentEffort[]>;

  /**
   * Delete all detailed activity data (laps, splits, efforts) for an activity.
   * Note: The main activity record is NOT deleted.
   */
  deleteActivityDetails(activityId: number): Promise<void>;

  // Sync status operations
  getSyncStatus(userId: number): Promise<SyncStatus | null>;
  createSyncStatus(userId: number): Promise<SyncStatus>;
  updateSyncStatus(userId: number, updates: SyncStatusUpdate): Promise<void>;
  deleteSyncStatus(userId: number): Promise<void>;

  /**
   * Atomically check if sync can be started and acquire lock.
   * Prevents TOCTOU race conditions.
   * @returns true if lock acquired, false if sync already in progress
   */
  tryAcquireSyncLock(userId: number, timeoutMs?: number): Promise<boolean>;

  /**
   * Reset a stuck sync that has exceeded the timeout.
   * @param userId - User ID
   * @param timeoutMs - Timeout in milliseconds (default 10 minutes)
   * @returns true if sync was reset, false if no stuck sync found
   */
  resetStuckSync(userId: number, timeoutMs?: number): Promise<boolean>;

}
