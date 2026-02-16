/**
 * Athlete routes
 */

import { Router } from 'express';
import { SessionStore } from '../services/session/store';
import { LRUCache } from '../services/cache/cache';
import { createAthleteController } from '../controllers/athlete.controller';
import { createAuthMiddleware } from '../middleware/auth';
import { userRateLimiter } from '../middleware/rateLimiter';

export function createAthleteRouter(
  sessionStore: SessionStore,
  cache: LRUCache<unknown>
): Router {
  const router = Router();
  const athleteController = createAthleteController(cache);
  const authMiddleware = createAuthMiddleware(sessionStore);

  // All routes require authentication and are rate limited
  router.use(authMiddleware);
  router.use(userRateLimiter);

  /**
   * GET /api/athlete
   * Get authenticated athlete's profile
   */
  router.get('/', athleteController.getProfile);

  /**
   * GET /api/athlete/stats
   * Get athlete statistics
   */
  router.get('/stats', athleteController.getStats);

  return router;
}
