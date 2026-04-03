/**
 * Authentication routes
 */

import { Router } from 'express';
import type { ISessionStore } from '../services/session/interface';
import { LRUCache } from '../services/cache/cache';
import { createAuthController } from '../controllers/auth.controller';
import { createAuthMiddleware } from '../middleware/auth';
import { authRateLimiter } from '../middleware/rateLimiter';

export function createAuthRouter(
  sessionStore: ISessionStore,
  cache: LRUCache<unknown>
): Router {
  const router = Router();
  const authController = createAuthController(sessionStore, cache);
  const authMiddleware = createAuthMiddleware(sessionStore);

  /**
   * POST /api/auth/strava/url
   * Generate Strava OAuth authorization URL with PKCE
   */
  router.post('/strava/url', authRateLimiter, authController.getStravaAuthUrl);

  /**
   * GET /api/auth/strava/callback
   * Handle OAuth callback from Strava
   */
  router.get('/strava/callback', authRateLimiter, authController.handleStravaCallback);

  /**
   * POST /api/auth/refresh
   * Refresh expired access token
   * Requires valid session
   */
  router.post('/refresh', authMiddleware, authController.refreshToken);

  /**
   * POST /api/auth/logout
   * Logout and destroy session
   * Requires valid session
   */
  router.post('/logout', authMiddleware, authController.logout);

  /**
   * GET /api/auth/me
   * Get current authenticated user
   * Requires valid session
   */
  router.get('/me', authMiddleware, authController.getCurrentUser);

  return router;
}
