/**
 * Sync controller
 * Handles sync-related HTTP requests with proper validation and error handling
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { startSync, getSyncProgress, tryAcquireSyncLock, resetStuckSync } from '../services/sync';
import { UnauthorizedError, AppError, ErrorCode } from '../utils/errors';
import { logger } from '../utils/logger';

// Sync timeout in milliseconds (10 minutes)
const SYNC_TIMEOUT_MS = 10 * 60 * 1000;

// Validation schemas
const startSyncBodySchema = z.object({
  // Optional configuration overrides
  pageSize: z.number().min(1).max(200).optional(),
  maxPages: z.number().min(1).max(500).optional(),
});

/**
 * Response types for sync endpoints
 */
interface StartSyncResponse {
  message: string;
  syncStarted: boolean;
  userId: number;
  estimatedTimeSeconds?: number;
}

interface SyncStatusResponse {
  userId: number;
  syncStatus: {
    lastSyncAt: number | null;
    lastActivityId: number | null;
    syncState: 'pending' | 'syncing' | 'completed' | 'error';
    totalActivities: number;
    errorMessage: string | null;
    syncStartedAt: number | null;
    createdAt: number;
    updatedAt: number;
  } | null;
  hasNeverSynced: boolean;
}

export function createSyncController() {
  /**
   * POST /api/sync
   * Start syncing activities from Strava to local database
   *
   * This endpoint triggers an async sync operation. The sync runs in the background
   * and the client can poll GET /api/sync/status to check progress.
   *
   * Security considerations:
   * - Requires valid authentication (session with valid access token)
   * - Rate limited to prevent abuse
   * - Only syncs activities for authenticated user
   * - Validates all inputs before processing
   */
  const triggerSync = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.session) {
        throw new UnauthorizedError('Authentication required');
      }

      const { userId, accessToken } = req.session;

      // Validate request body (optional configuration)
      const body = startSyncBodySchema.parse(req.body || {});

      logger.info('Sync triggered by user', { userId });

      // Atomically check and acquire sync lock (prevents TOCTOU)
      const lockAcquired = await tryAcquireSyncLock(userId, SYNC_TIMEOUT_MS);
      if (!lockAcquired) {
        const currentStatus = await getSyncProgress(userId);
        logger.warn('Sync already in progress', { userId });
        res.status(409).json({
          message: 'Sync already in progress. Please wait for it to complete.',
          syncStarted: false,
          userId,
          syncStatus: currentStatus,
        });
        return;
      }

      // Start sync asynchronously - don't await
      // The sync will update the sync_status table as it progresses
      // Only pass defined values to avoid overwriting defaults with undefined
      const syncOptions: { pageSize?: number; maxPages?: number } = {};
      if (body.pageSize !== undefined) syncOptions.pageSize = body.pageSize;
      if (body.maxPages !== undefined) syncOptions.maxPages = body.maxPages;

      startSync(userId, accessToken, syncOptions).catch((error) => {
        // Log errors but don't crash the server
        // Error state is already saved in database by startSync
        logger.error('Background sync failed', {
          userId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      });

      // Return immediately to client
      const response: StartSyncResponse = {
        message: 'Sync started successfully. Use GET /api/sync/status to check progress.',
        syncStarted: true,
        userId,
        estimatedTimeSeconds: 30, // Rough estimate, actual time varies
      };

      res.status(202).json(response);
    } catch (error) {
      // Handle Zod validation errors
      if (error instanceof z.ZodError) {
        const validationError = new AppError(
          400,
          ErrorCode.VALIDATION_ERROR,
          'Invalid request body',
          error.errors
        );
        next(validationError);
        return;
      }

      next(error);
    }
  };

  /**
   * GET /api/sync/status
   * Get current sync status for authenticated user
   *
   * Returns:
   * - Current sync state (pending, syncing, completed, error)
   * - Last sync timestamp
   * - Total activities synced
   * - Last activity ID processed
   *
   * Security considerations:
   * - Requires valid authentication
   * - Users can only access their own sync status
   */
  const getSyncStatus = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.session) {
        throw new UnauthorizedError('Authentication required');
      }

      const { userId } = req.session;

      logger.debug('Fetching sync status', { userId });

      const syncStatus = await getSyncProgress(userId);

      const response: SyncStatusResponse = {
        userId,
        syncStatus: syncStatus
          ? {
              lastSyncAt: syncStatus.lastSyncAt,
              lastActivityId: syncStatus.lastActivityId,
              syncState: syncStatus.syncState,
              totalActivities: syncStatus.totalActivities,
              errorMessage: syncStatus.errorMessage,
              syncStartedAt: syncStatus.syncStartedAt,
              createdAt: syncStatus.createdAt,
              updatedAt: syncStatus.updatedAt,
            }
          : null,
        hasNeverSynced: syncStatus === null,
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/sync/reset
   * Reset a stuck sync for authenticated user
   *
   * This endpoint allows users to reset a sync that is stuck in 'syncing' state.
   * Useful when sync has timed out or when the server restarted mid-sync.
   */
  const resetSync = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.session) {
        throw new UnauthorizedError('Authentication required');
      }

      const { userId } = req.session;

      logger.info('Sync reset requested', { userId });

      const wasReset = await resetStuckSync(userId, SYNC_TIMEOUT_MS);

      if (wasReset) {
        logger.info('Stuck sync was reset', { userId });
        res.json({
          message: 'Sync has been reset. You can now start a new sync.',
          wasReset: true,
          userId,
        });
      } else {
        // Check current state
        const currentStatus = await getSyncProgress(userId);
        const isSyncing = currentStatus?.syncState === 'syncing';

        if (isSyncing) {
          // Sync is in progress but hasn't timed out yet
          res.status(409).json({
            message: 'Sync is still in progress and has not timed out. Please wait.',
            wasReset: false,
            userId,
            syncStatus: currentStatus,
          });
        } else {
          // No stuck sync to reset
          res.json({
            message: 'No stuck sync found to reset.',
            wasReset: false,
            userId,
          });
        }
      }
    } catch (error) {
      next(error);
    }
  };

  return {
    triggerSync,
    getSyncStatus,
    resetSync,
  };
}
