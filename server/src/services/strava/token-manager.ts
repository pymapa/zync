/**
 * Token Manager Service
 *
 * Manages Strava access tokens with automatic refresh.
 * This service provides a layer of abstraction for obtaining valid tokens
 * for webhook processing and background jobs.
 */

import type { ISessionStore } from '../session/interface';
import { refreshAccessToken } from './oauth';
import { logger } from '../../utils/logger';
import { AppError, ErrorCode } from '../../utils/errors';

export interface ValidToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export class TokenManager {
  private sessionStore: ISessionStore;

  constructor(sessionStore: ISessionStore) {
    this.sessionStore = sessionStore;
  }

  /**
   * Get a valid access token for a user, refreshing if necessary
   * @param userId - Strava athlete ID
   * @returns Valid access token with metadata
   * @throws AppError if no session/refresh token found for user
   */
  async getValidToken(userId: number): Promise<ValidToken> {
    const session = await this.sessionStore.getByUserId(userId);

    if (!session) {
      throw new AppError(
        401,
        ErrorCode.UNAUTHORIZED,
        `No active session found for user ${userId}. User may need to re-authenticate.`,
        { userId }
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const tokenExpiresAt = session.tokenExpiresAt;

    // Check if token is expired or will expire in next 5 minutes (300 seconds)
    // Using a buffer ensures we don't use a token that might expire mid-request
    const isTokenExpiringSoon = tokenExpiresAt <= now + 300;

    if (isTokenExpiringSoon) {
      logger.info('Access token expired or expiring soon, refreshing', {
        userId,
        expiresAt: tokenExpiresAt,
        currentTime: now,
      });

      const tokenResponse = await refreshAccessToken(session.refreshToken);

      // Update session with new tokens
      const updated = await this.sessionStore.updateTokens(
        session.id,
        tokenResponse.access_token,
        tokenResponse.refresh_token,
        tokenResponse.expires_at
      );

      if (!updated) {
        throw new AppError(
          500,
          ErrorCode.INTERNAL_ERROR,
          'Failed to update session with refreshed tokens',
          { userId, sessionId: session.id }
        );
      }

      logger.info('Access token refreshed successfully', {
        userId,
        newExpiresAt: tokenResponse.expires_at,
      });

      return {
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
        expiresAt: tokenResponse.expires_at,
      };
    }

    return {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      expiresAt: session.tokenExpiresAt,
    };
  }

  /**
   * Check if a user has valid credentials available
   * @param userId - Strava athlete ID
   * @returns true if user has a session with tokens
   */
  async hasValidCredentials(userId: number): Promise<boolean> {
    const session = await this.sessionStore.getByUserId(userId);
    return session !== null && session !== undefined;
  }
}
