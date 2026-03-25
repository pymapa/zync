/**
 * Activities routes
 */

import { Router } from 'express';
import { SessionStore } from '../services/session/store';
import { LRUCache } from '../services/cache/cache';
import { createActivitiesController } from '../controllers/activities.controller';
import { createAuthMiddleware } from '../middleware/auth';
import { userRateLimiter } from '../middleware/rateLimiter';

export function createActivitiesRouter(
  sessionStore: SessionStore,
  cache: LRUCache<unknown>
): Router {
  const router = Router();
  const activitiesController = createActivitiesController(cache);
  const authMiddleware = createAuthMiddleware(sessionStore);

  // All routes require authentication and are rate limited
  router.use(authMiddleware);
  router.use(userRateLimiter);

  /**
   * GET /api/activities
   * List activities with pagination
   * Query params: page, perPage, before, after
   */
  router.get('/', activitiesController.listActivities);

  /**
   * GET /api/activities/stats
   * Get aggregated activity stats
   * Query params: period (week, month, year, last_year, all)
   */
  router.get('/stats', activitiesController.getStats);

  /**
   * GET /api/activities/stats/daily
   * Get daily activity stats for charts
   * Query params: period (week, month, year, last_year, all)
   */
  router.get('/stats/daily', activitiesController.getDailyStats);

  /**
   * GET /api/activities/:id
   * Get detailed activity by ID
   */
  router.get('/:id', activitiesController.getActivity);

  /**
   * GET /api/activities/:id/streams
   * Get stream data (heartrate, velocity, altitude) for an activity
   */
  router.get('/:id/streams', activitiesController.getStreams);

  /**
   * GET /api/activities/:id/photos
   * Get all photos for an activity from Strava
   */
  router.get('/:id/photos', activitiesController.getPhotos);

  return router;
}
