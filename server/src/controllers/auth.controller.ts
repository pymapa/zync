/**
 * Authentication controller
 * Handles OAuth flow, session management, and token refresh
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import type { ISessionStore } from '../services/session/interface';
import { LRUCache } from '../services/cache/cache';
import { config } from '../config';
import { logger } from '../utils/logger';
import { UnauthorizedError, ValidationError, AppError, ErrorCode } from '../utils/errors';
import { secureCompare } from '../utils/crypto';
import {
  generateAuthorizationUrl,
  exchangeCodeForToken,
  refreshAccessToken,
  PKCEChallenge,
} from '../services/strava/oauth';
import type { GetMeResponse } from '../types';
import { mapStravaAthlete } from '../types/mappers';

// Validation schemas
const getAuthUrlSchema = z.object({
  redirectUri: z.string().url(),
});

const callbackSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
  scope: z.string().optional(),
});

// Temporary store for PKCE challenges (keyed by state token)
// In production with multiple servers, this would need to be in Redis
const pkceStore = new Map<string, PKCEChallenge>();
const pkceCleanupTimers = new Map<string, NodeJS.Timeout>();

/**
 * Cleanup PKCE challenge and its associated timer
 */
function cleanupPKCE(state: string): void {
  pkceStore.delete(state);
  const timer = pkceCleanupTimers.get(state);
  if (timer) {
    clearTimeout(timer);
    pkceCleanupTimers.delete(state);
  }
}

export function createAuthController(
  sessionStore: ISessionStore,
  cache: LRUCache<unknown>
) {
  /**
   * POST /api/auth/strava/url
   * Generate OAuth authorization URL with PKCE
   */
  const getStravaAuthUrl = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const body = getAuthUrlSchema.parse(req.body);

      const { url, pkce } = generateAuthorizationUrl({
        redirectUri: body.redirectUri,
      });

      // Store PKCE challenge temporarily (expires in 10 minutes)
      pkceStore.set(pkce.state, pkce);
      const timer = setTimeout(() => cleanupPKCE(pkce.state), 10 * 60 * 1000);
      pkceCleanupTimers.set(pkce.state, timer);

      logger.info('Generated Strava authorization URL', {
        state: pkce.state,
      });

      res.json({
        url,
        state: pkce.state,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/auth/strava/callback
   * Handle OAuth callback, exchange code for tokens, create session
   */
  const handleStravaCallback = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const query = callbackSchema.parse(req.query);

      // Retrieve PKCE challenge
      const pkce = pkceStore.get(query.state);

      // Verify state matches FIRST with timing-safe comparison (prevents timing side channel)
      // This must happen before any conditional logic based on pkce existence
      if (!pkce || !secureCompare(query.state, pkce.state)) {
        throw new ValidationError('Invalid or expired state token');
      }

      // Clean up PKCE challenge and timer
      cleanupPKCE(query.state);

      // Exchange authorization code for tokens
      const tokenResponse = await exchangeCodeForToken({
        code: query.code,
        codeVerifier: pkce.codeVerifier,
      });

      // Create session with mapped user data
      const user = mapStravaAthlete(tokenResponse.athlete);
      const session = await sessionStore.create(
        tokenResponse.athlete.id,
        tokenResponse.access_token,
        tokenResponse.refresh_token,
        tokenResponse.expires_at,
        user
      );

      // Set httpOnly cookie
      // Security note: SameSite is 'lax' rather than 'strict' because OAuth callback
      // is a GET request from Strava (external site). 'strict' would block the cookie.
      // This is safe because we use state token CSRF protection on the callback endpoint.
      res.cookie(config.cookie.name, session.id, {
        httpOnly: true,
        secure: config.nodeEnv === 'production',
        sameSite: 'lax',
        maxAge: config.cookie.maxAge,
        signed: true,
      });

      logger.info('User authenticated successfully', {
        userId: session.userId,
        sessionId: session.id,
      });

      // Redirect to frontend dashboard after successful authentication
      res.redirect(`${config.frontend.url}/dashboard`);
    } catch (error) {
      // Redirect to frontend with error on failure
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
      res.redirect(`${config.frontend.url}/login?error=${encodeURIComponent(errorMessage)}`);
    }
  };

  /**
   * POST /api/auth/refresh
   * Refresh expired access token using refresh token
   */
  const refreshToken = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.session) {
        throw new UnauthorizedError('No active session');
      }

      const { refreshToken: currentRefreshToken, userId } = req.session;

      // Refresh the access token
      const tokenResponse = await refreshAccessToken(currentRefreshToken);

      // Update session with new tokens
      const updated = await sessionStore.updateTokens(
        req.session.id,
        tokenResponse.access_token,
        tokenResponse.refresh_token,
        tokenResponse.expires_at
      );

      if (!updated) {
        throw new AppError(
          500,
          ErrorCode.INTERNAL_ERROR,
          'Failed to update session'
        );
      }

      // Clear user's cache since token changed
      cache.deleteUserCache(userId);

      logger.info('Access token refreshed', {
        userId,
        sessionId: req.session.id,
      });

      res.json({
        message: 'Token refreshed successfully',
        expiresAt: tokenResponse.expires_at,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/auth/logout
   * Destroy session and clear cookie
   */
  const logout = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.session) {
        throw new UnauthorizedError('No active session');
      }

      const { id: sessionId, userId } = req.session;

      // Destroy session
      await sessionStore.destroy(sessionId);

      // Clear user's cache
      cache.deleteUserCache(userId);

      // Clear cookie
      res.clearCookie(config.cookie.name);

      logger.info('User logged out', { userId, sessionId });

      res.json({
        message: 'Logged out successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/auth/me
   * Get current authenticated user
   */
  const getCurrentUser = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.session) {
        throw new UnauthorizedError('Not authenticated');
      }

      const response: GetMeResponse = {
        user: req.session.user,
        tokenExpiresAt: req.session.tokenExpiresAt,
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  return {
    getStravaAuthUrl,
    handleStravaCallback,
    refreshToken,
    logout,
    getCurrentUser,
  };
}
