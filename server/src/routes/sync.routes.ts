/**
 * Sync routes
 * Endpoints for syncing activities from Strava to local database
 */

import { Router } from 'express';
import { SessionStore } from '../services/session/store';
import { createSyncController } from '../controllers/sync.controller';
import { createAuthMiddleware } from '../middleware/auth';
import { userRateLimiter } from '../middleware/rateLimiter';

export function createSyncRouter(sessionStore: SessionStore): Router {
  const router = Router();
  const syncController = createSyncController();
  const authMiddleware = createAuthMiddleware(sessionStore);

  // All routes require authentication and are rate limited
  router.use(authMiddleware);
  router.use(userRateLimiter);

  /**
   * POST /api/sync
   * Trigger sync of activities from Strava to local database
   *
   * Request body (optional):
   * {
   *   pageSize?: number (1-200, default: 200)
   *   maxPages?: number (1-500, default: 100)
   * }
   *
   * Response: 202 Accepted
   * {
   *   message: string
   *   syncStarted: boolean
   *   userId: number
   *   estimatedTimeSeconds?: number
   * }
   *
   * The sync runs asynchronously. Use GET /api/sync/status to check progress.
   */
  router.post('/', syncController.triggerSync);

  /**
   * GET /api/sync/status
   * Get current sync status for authenticated user
   *
   * Response: 200 OK
   * {
   *   userId: number
   *   syncStatus: {
   *     lastSyncAt: number
   *     lastActivityId: number | null
   *     syncState: 'pending' | 'syncing' | 'completed' | 'error'
   *     totalActivities: number
   *     errorMessage: string | null
   *     syncStartedAt: number | null
   *     createdAt: number
   *     updatedAt: number
   *   } | null
   *   hasNeverSynced: boolean
   * }
   */
  router.get('/status', syncController.getSyncStatus);

  /**
   * POST /api/sync/reset
   * Reset a stuck sync
   *
   * Use this endpoint when a sync is stuck in 'syncing' state for too long.
   * Will only reset if the sync has exceeded the timeout (10 minutes).
   *
   * Response: 200 OK
   * {
   *   message: string
   *   wasReset: boolean
   *   userId: number
   * }
   */
  router.post('/reset', syncController.resetSync);

  return router;
}
