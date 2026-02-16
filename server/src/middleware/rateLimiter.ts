/**
 * Rate limiting middleware
 * Prevents abuse and protects against brute force attacks
 */

import rateLimit from 'express-rate-limit';
import { config } from '../config';
import { Request } from 'express';
import { Session } from '../services/session/store';

// Extend Request type to include session
interface RequestWithSession extends Request {
  session?: Session;
}

/**
 * General rate limiter for authenticated endpoints
 * 80 requests per 15 minutes per user
 */
export const userRateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequestsPerUser,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  keyGenerator: (req: Request): string => {
    // Rate limit by user ID if authenticated, otherwise by IP
    const session = (req as RequestWithSession).session;
    if (session?.userId) {
      return `user:${session.userId}`;
    }
    // Use socket.remoteAddress as fallback if req.ip is undefined (e.g., behind proxy without trust proxy config)
    return req.ip || req.socket.remoteAddress || 'unknown';
  },
  handler: (req, res) => {
    res.status(429).json({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please try again later.',
      },
    });
  },
});

/**
 * Strict rate limiter for authentication endpoints
 * 5 requests per minute to prevent brute force attacks
 */
export const authRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: config.rateLimit.maxAuthRequests,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  keyGenerator: (req: Request): string => {
    // Use socket.remoteAddress as fallback if req.ip is undefined (e.g., behind proxy without trust proxy config)
    return req.ip || req.socket.remoteAddress || 'unknown';
  },
  handler: (req, res) => {
    res.status(429).json({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many authentication attempts. Please try again in a minute.',
      },
    });
  },
});
