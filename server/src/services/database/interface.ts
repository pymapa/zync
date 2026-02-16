/**
 * Database interface - abstraction layer for swapping DBMS implementations
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
import type {
  StoredWebhookEvent,
  WebhookEventInput,
} from '../../types/webhook';

export interface IDatabase {
  /**
   * Initialize database connection and run migrations
   */
  init(): void;

  /**
   * Close database connection gracefully
   */
  close(): void;

  // Activity operations
  upsertActivity(activity: ActivityInput): void;
  upsertActivities(activities: ActivityInput[]): void;
  getActivityById(activityId: number, userId: number): StoredActivity | null;
  searchActivities(filters: ActivitySearchFilters): StoredActivity[];
  deleteUserActivities(userId: number): void;
  getUserActivityCount(userId: number): number;
  getActivityStats(filters: ActivityStatsFilters): ActivityStats;
  getActivityStreaks(userId: number): ActivityStreaks;
  getDailyActivityStats(filters: ActivityStatsFilters): DailyActivityStats[];

  /**
   * Store complete detailed activity data including all nested structures.
   * This atomically stores the activity and all related data (laps, splits, efforts).
   * Sets hasDetailedData flag to true.
   */
  upsertDetailedActivity(data: DetailedActivityData): void;

  /**
   * Get activity laps for a specific activity
   */
  getActivityLaps(activityId: number): StoredActivityLap[];

  /**
   * Get metric splits for a specific activity
   */
  getActivitySplitsMetric(activityId: number): StoredActivitySplitMetric[];

  /**
   * Get best efforts for a specific activity
   */
  getActivityBestEfforts(activityId: number): StoredActivityBestEffort[];

  /**
   * Get segment efforts for a specific activity
   */
  getActivitySegmentEfforts(activityId: number): StoredActivitySegmentEffort[];

  /**
   * Delete all detailed activity data (laps, splits, efforts) for an activity.
   * Note: The main activity record is NOT deleted.
   */
  deleteActivityDetails(activityId: number): void;

  // Sync status operations
  getSyncStatus(userId: number): SyncStatus | null;
  createSyncStatus(userId: number): SyncStatus;
  updateSyncStatus(userId: number, updates: SyncStatusUpdate): void;
  deleteSyncStatus(userId: number): void;

  /**
   * Atomically check if sync can be started and acquire lock.
   * Prevents TOCTOU race conditions.
   * @returns true if lock acquired, false if sync already in progress
   */
  tryAcquireSyncLock(userId: number, timeoutMs?: number): boolean;

  /**
   * Reset a stuck sync that has exceeded the timeout.
   * @param userId - User ID
   * @param timeoutMs - Timeout in milliseconds (default 10 minutes)
   * @returns true if sync was reset, false if no stuck sync found
   */
  resetStuckSync(userId: number, timeoutMs?: number): boolean;

  // Webhook event operations
  /**
   * Store a webhook event from Strava
   * @param event - Webhook event data
   * @returns The ID of the created event
   */
  createWebhookEvent(event: WebhookEventInput): number;

  /**
   * Get unprocessed webhook events
   * @param limit - Maximum number of events to retrieve
   * @returns Array of unprocessed webhook events
   */
  getUnprocessedWebhookEvents(limit?: number): StoredWebhookEvent[];

  /**
   * Mark a webhook event as processed
   * @param eventId - ID of the webhook event
   * @param errorMessage - Optional error message if processing failed
   */
  markWebhookEventProcessed(eventId: number, errorMessage?: string): void;

  /**
   * Get webhook events for a specific activity
   * @param ownerId - Strava athlete ID
   * @param activityId - Activity ID
   * @returns Array of webhook events for this activity
   */
  getWebhookEventsByActivity(
    ownerId: number,
    activityId: number
  ): StoredWebhookEvent[];

  /**
   * Delete old processed webhook events
   * @param olderThanSeconds - Delete events older than this many seconds (default 30 days)
   * @returns Number of deleted events
   */
  cleanupOldWebhookEvents(olderThanSeconds?: number): number;

  /**
   * Retry a failed webhook event
   * Resets status to 'pending' and increments retry count
   * @param eventId - ID of the webhook event to retry
   * @param maxRetries - Maximum number of retries allowed (default 3)
   * @returns true if event was reset for retry, false if max retries exceeded
   */
  retryWebhookEvent(eventId: number, maxRetries?: number): boolean;

  /**
   * Reset stuck webhook events that have been in 'processing' state too long
   * This handles cases where a worker crashed or timed out
   * @param timeoutSeconds - Events in 'processing' longer than this are reset (default 300s = 5min)
   * @returns Number of events reset
   */
  resetStuckWebhookEvents(timeoutSeconds?: number): number;
}
