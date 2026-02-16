/**
 * Webhook routes for Strava event callbacks
 */

import { Router } from 'express';
import { createWebhookController } from '../controllers/webhook.controller';
import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for webhook endpoints
 * Strava can send bursts of events, but we still want to protect against abuse
 */
const webhookRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 100, // Allow up to 100 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many webhook requests, please try again later',
    },
  },
  // Use IP-based rate limiting since webhooks come from Strava's servers
  keyGenerator: (req) => req.ip || 'unknown',
});

export function createWebhookRouter(): Router {
  const router = Router();
  const webhookController = createWebhookController();

  // Apply rate limiting to all webhook routes
  router.use(webhookRateLimiter);

  /**
   * GET /api/webhooks/strava
   * Webhook subscription verification endpoint
   * Strava calls this with hub.mode, hub.verify_token, and hub.challenge
   * to verify the callback URL when creating a subscription
   */
  router.get('/strava', webhookController.handleVerification);

  /**
   * POST /api/webhooks/strava
   * Webhook event receiver endpoint
   * Strava sends POST requests to this endpoint when events occur
   * (activity created, updated, deleted, etc.)
   */
  router.post('/strava', webhookController.handleEvent);

  return router;
}
