/**
 * Sync service - fetches activities from Strava and stores them in SQLite
 *
 * This service handles:
 * - Initial sync of all activities
 * - Incremental sync of new activities
 * - Rate limiting respect (100 req/15min, 1000 req/day)
 * - Progress tracking in sync_status table
 * - Proper error handling and recovery
 */

import { StravaClient } from '../strava/client';
import { getActivities } from '../strava/activities';
import type { StravaActivity } from '../strava/types';
import { getDatabase } from '../database';
import type { ActivityInput, SyncStatus } from '../database/types';
import { logger } from '../../utils/logger';
import { AppError, ErrorCode } from '../../utils/errors';
import { encodeGeohash } from '../database/geohash';

/**
 * Configuration for sync operation
 */
interface SyncConfig {
  pageSize: number; // Activities per page (max 200)
  delayBetweenPages: number; // Milliseconds to wait between pages
  maxPages: number; // Safety limit to prevent runaway syncs
  safetyBufferSeconds: number; // Buffer subtracted from lastSyncAt for the `after` filter
}

const DEFAULT_SYNC_CONFIG: SyncConfig = {
  pageSize: 200, // Maximum allowed by Strava
  delayBetweenPages: 1000, // 1 second to respect rate limits
  maxPages: 100, // Stop after 100 pages (20,000 activities) for safety
  safetyBufferSeconds: 86400, // 24-hour buffer on the `after` timestamp
};

/**
 * Map Strava activity to ActivityInput for database storage
 * Handles all field transformations including location data
 */
export function mapStravaActivityToInput(
  stravaActivity: StravaActivity,
  userId: number
): ActivityInput {
  // Extract location coordinates from start_latlng array
  const startLat =
    stravaActivity.start_latlng && stravaActivity.start_latlng.length === 2
      ? stravaActivity.start_latlng[0]
      : null;
  const startLng =
    stravaActivity.start_latlng && stravaActivity.start_latlng.length === 2
      ? stravaActivity.start_latlng[1]
      : null;

  const endLat =
    stravaActivity.end_latlng && stravaActivity.end_latlng.length === 2
      ? stravaActivity.end_latlng[0]
      : null;
  const endLng =
    stravaActivity.end_latlng && stravaActivity.end_latlng.length === 2
      ? stravaActivity.end_latlng[1]
      : null;

  // Convert start_latlng array to string format for storage
  const startLatlng =
    stravaActivity.start_latlng && stravaActivity.start_latlng.length === 2
      ? JSON.stringify(stravaActivity.start_latlng)
      : null;
  const endLatlng =
    stravaActivity.end_latlng && stravaActivity.end_latlng.length === 2
      ? JSON.stringify(stravaActivity.end_latlng)
      : null;

  return {
    id: stravaActivity.id,
    userId,
    name: stravaActivity.name,
    type: stravaActivity.sport_type,
    distanceMeters: stravaActivity.distance,
    movingTimeSeconds: stravaActivity.moving_time,
    elapsedTimeSeconds: stravaActivity.elapsed_time,
    elevationGainMeters: stravaActivity.total_elevation_gain,
    startDate: Math.floor(new Date(stravaActivity.start_date).getTime() / 1000), // Convert to Unix timestamp (seconds)
    startDateLocal: stravaActivity.start_date_local,
    averageSpeed: stravaActivity.average_speed,
    maxSpeed: stravaActivity.max_speed,
    averageHeartrate: stravaActivity.average_heartrate ?? null,
    maxHeartrate: stravaActivity.max_heartrate ?? null,
    calories: null, // Not available in list endpoint
    description: null, // Not available in list endpoint
    averageCadence: stravaActivity.average_cadence ?? null,
    averageWatts: stravaActivity.average_watts ?? null,
    kudosCount: stravaActivity.kudos_count,
    commentCount: stravaActivity.comment_count,
    summaryPolyline: stravaActivity.map?.summary_polyline ?? null,
    startLatlng,
    endLatlng,
    startLat,
    startLng,
    endLat,
    endLng,
  };
}

/**
 * Result of a sync operation
 */
export interface SyncResult {
  userId: number;
  totalActivitiesFetched: number;
  totalActivitiesStored: number;
  pagesProcessed: number;
  startedAt: number;
  completedAt: number;
  status: 'completed' | 'partial' | 'error';
  syncMode: 'full' | 'incremental';
  error?: string;
}

/**
 * Start syncing activities for a user
 *
 * This function:
 * 1. Creates or updates sync_status record to 'syncing'
 * 2. Paginates through Strava API to fetch all activities
 * 3. Stores activities in database using upsert (handles duplicates)
 * 4. Updates sync_status with progress and completion
 * 5. Respects rate limits with delays between requests
 *
 * @param userId - The user ID to sync activities for
 * @param accessToken - Valid Strava access token
 * @param config - Optional sync configuration overrides
 * @returns Promise resolving to sync result
 */
export async function startSync(
  userId: number,
  accessToken: string,
  config: Partial<SyncConfig> = {}
): Promise<SyncResult> {
  const syncConfig = { ...DEFAULT_SYNC_CONFIG, ...config };
  const db = getDatabase();
  const client = new StravaClient(accessToken);

  const startedAt = Math.floor(Date.now() / 1000); // Convert to Unix timestamp (seconds)
  let totalActivitiesFetched = 0;
  let totalActivitiesStored = 0;
  let pagesProcessed = 0;

  // Get or create sync status
  let syncStatus = await db.getSyncStatus(userId);
  if (!syncStatus) {
    syncStatus = await db.createSyncStatus(userId);
  }

  // Determine sync mode: full on first sync, incremental thereafter
  const isFirstSync =
    syncStatus.lastActivityId === null || syncStatus.totalActivities === 0;

  const syncMode: 'full' | 'incremental' = isFirstSync ? 'full' : 'incremental';

  const afterTimestamp: number | undefined = isFirstSync
    ? undefined
    : syncStatus.lastSyncAt - syncConfig.safetyBufferSeconds;

  const knownLastActivityId: number | null = isFirstSync
    ? null
    : syncStatus.lastActivityId;

  let highestIdSeen: number | null = null;

  logger.info('Starting activity sync', {
    userId,
    syncMode,
    pageSize: syncConfig.pageSize,
    existingActivities: syncStatus.totalActivities,
    afterTimestamp,
    knownLastActivityId,
  });

  try {
    let currentPage = 1;
    let hasMoreActivities = true;
    let hasSetSyncingState = false;

    while (hasMoreActivities && currentPage <= syncConfig.maxPages) {
      logger.debug('Fetching activities page', {
        userId,
        page: currentPage,
        pageSize: syncConfig.pageSize,
      });

      // Fetch activities from Strava
      const activities = await getActivities(client, {
        page: currentPage,
        perPage: syncConfig.pageSize,
        after: afterTimestamp,
      });

      // Only set syncing state AFTER first successful API call
      // This prevents getting stuck in 'syncing' if initial request fails
      if (!hasSetSyncingState) {
        await db.updateSyncStatus(userId, {
          syncState: 'syncing',
          syncStartedAt: startedAt,
          errorMessage: null, // Clear any previous error
        });
        hasSetSyncingState = true;
      }

      const fetchedCount = activities.length;
      totalActivitiesFetched += fetchedCount;

      logger.debug('Fetched activities', {
        userId,
        page: currentPage,
        count: fetchedCount,
      });

      // If we got activities, process and store them
      if (fetchedCount > 0) {
        // Map Strava activities to database input format
        const activityInputs = activities.map((activity) =>
          mapStravaActivityToInput(activity, userId)
        );

        // Batch upsert to database
        await db.upsertActivities(activityInputs);
        totalActivitiesStored += activityInputs.length;

        // Track highest activity ID seen this run
        const pageMaxId = Math.max(...activities.map((a) => a.id));
        if (highestIdSeen === null || pageMaxId > highestIdSeen) {
          highestIdSeen = pageMaxId;
        }

        // Update sync progress
        await db.updateSyncStatus(userId, {
          lastActivityId: highestIdSeen ?? undefined,
          totalActivities: await db.getUserActivityCount(userId),
        });

        logger.info('Stored activities batch', {
          userId,
          page: currentPage,
          count: activityInputs.length,
          totalStored: totalActivitiesStored,
        });

        // Early termination — incremental syncs only.
        // Strava returns newest-first and IDs are monotonically increasing,
        // so once a page's minimum ID is at or below our known high-water mark
        // everything behind it is already stored. The page itself is fully
        // upserted above before we break.
        if (knownLastActivityId !== null) {
          const pageMinId = Math.min(...activities.map((a) => a.id));
          if (pageMinId <= knownLastActivityId) {
            pagesProcessed++;
            logger.info('Early termination: reached known activities', {
              userId,
              pageMinId,
              knownLastActivityId,
              pagesProcessed,
            });
            break;
          }
        }
      }

      pagesProcessed++;

      // Check if we got a full page (if not, we've reached the end)
      hasMoreActivities = fetchedCount === syncConfig.pageSize;

      // If there are more pages, add delay to respect rate limits
      if (hasMoreActivities && currentPage < syncConfig.maxPages) {
        logger.debug('Waiting before next page', {
          userId,
          delayMs: syncConfig.delayBetweenPages,
        });
        await sleep(syncConfig.delayBetweenPages);
      }

      currentPage++;
    }

    const completedAt = Math.floor(Date.now() / 1000); // Convert to Unix timestamp (seconds)
    const finalActivityCount = await db.getUserActivityCount(userId);

    // Update sync status to completed
    await db.updateSyncStatus(userId, {
      syncState: 'completed',
      lastSyncAt: completedAt,
      totalActivities: finalActivityCount,
      lastActivityId: highestIdSeen ?? knownLastActivityId ?? undefined,
      syncStartedAt: null, // Clear sync start time
      errorMessage: null, // Clear any previous error
    });

    logger.info('Activity sync completed', {
      userId,
      syncMode,
      totalActivitiesFetched,
      totalActivitiesStored,
      pagesProcessed,
      finalActivityCount,
      durationMs: completedAt - startedAt,
    });

    return {
      userId,
      totalActivitiesFetched,
      totalActivitiesStored,
      pagesProcessed,
      startedAt,
      completedAt,
      status:
        pagesProcessed >= syncConfig.maxPages ? 'partial' : 'completed',
      syncMode,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';

    // Update sync status to error with message
    await db.updateSyncStatus(userId, {
      syncState: 'error',
      errorMessage,
      syncStartedAt: null, // Clear sync start time
    });

    logger.error('Activity sync failed', {
      userId,
      error: errorMessage,
      totalActivitiesFetched,
      totalActivitiesStored,
      pagesProcessed,
    });

    // Re-throw as AppError for consistent error handling
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(
      500,
      ErrorCode.INTERNAL_ERROR,
      `Sync failed: ${errorMessage}`,
      {
        userId,
        totalActivitiesFetched,
        totalActivitiesStored,
        pagesProcessed,
      }
    );
  }
}

/**
 * Get current sync progress for a user
 *
 * @param userId - The user ID to get sync status for
 * @returns Sync status or null if user has never synced
 */
export async function getSyncProgress(userId: number): Promise<SyncStatus | null> {
  const db = getDatabase();
  const syncStatus = await db.getSyncStatus(userId);

  if (!syncStatus) {
    return null;
  }

  return syncStatus;
}

/**
 * Try to acquire sync lock atomically.
 * Prevents TOCTOU race conditions when starting sync.
 *
 * @param userId - The user ID to acquire lock for
 * @param timeoutMs - Timeout in ms to consider stuck syncs (default 10 min)
 * @returns true if lock acquired, false if sync already in progress
 */
export async function tryAcquireSyncLock(userId: number, timeoutMs?: number): Promise<boolean> {
  const db = getDatabase();
  return await db.tryAcquireSyncLock(userId, timeoutMs);
}

/**
 * Reset a stuck sync that has exceeded the timeout.
 *
 * @param userId - The user ID
 * @param timeoutMs - Timeout in milliseconds (default 10 minutes)
 * @returns true if sync was reset, false if no stuck sync found
 */
export async function resetStuckSync(userId: number, timeoutMs?: number): Promise<boolean> {
  const db = getDatabase();
  return await db.resetStuckSync(userId, timeoutMs);
}

/**
 * Sleep utility for rate limiting
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
