/**
 * Authentication middleware
 * Validates session and attaches session data to request
 */

import { Request, Response, NextFunction } from 'express';
import { SessionStore, Session } from '../services/session/store';
import { UnauthorizedError, AppError, ErrorCode } from '../utils/errors';
import { logger } from '../utils/logger';
import { config } from '../config';

// Extend Express Request to include session
declare global {
  namespace Express {
    interface Request {
      session?: Session;
    }
  }
}

export function createAuthMiddleware(sessionStore: SessionStore) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      // Get session ID from signed cookie
      const sessionId = req.signedCookies[config.cookie.name];

      if (!sessionId) {
        throw new UnauthorizedError('No session found. Please log in.');
      }

      // Validate session
      const session = sessionStore.get(sessionId);

      if (!session) {
        // Session expired or doesn't exist
        res.clearCookie(config.cookie.name);
        throw new AppError(
          401,
          ErrorCode.SESSION_NOT_FOUND,
          'Session expired. Please log in again.'
        );
      }

      // Check if access token is expired
      const now = Math.floor(Date.now() / 1000);
      if (now >= session.tokenExpiresAt) {
        // Token expired - client should call refresh endpoint
        throw new AppError(
          401,
          ErrorCode.TOKEN_EXPIRED,
          'Access token expired. Please refresh your session.'
        );
      }

      // Attach session to request
      req.session = session;

      logger.debug('Request authenticated', {
        userId: session.userId,
        sessionId: session.id,
      });

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Optional authentication middleware
 * Does not throw error if no session, but attaches session if present
 */
export function createOptionalAuthMiddleware(sessionStore: SessionStore) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const sessionId = req.signedCookies[config.cookie.name];

      if (sessionId) {
        const session = sessionStore.get(sessionId);
        if (session) {
          req.session = session;
        }
      }

      next();
    } catch (error) {
      // Silently continue without authentication
      next();
    }
  };
}
