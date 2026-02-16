/**
 * Health check routes
 */

import { Router, Request, Response } from 'express';
import type { WebhookProcessor } from '../workers/webhook-processor';

export function createHealthRouter(webhookProcessor?: WebhookProcessor): Router {
  const router = Router();

  /**
   * GET /api/health
   * Basic health check endpoint
   */
  router.get('/', (req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  /**
   * GET /api/health/webhook-processor
   * Webhook processor status and statistics
   */
  if (webhookProcessor) {
    router.get('/webhook-processor', (req: Request, res: Response) => {
      const stats = webhookProcessor.getStats();
      const rateLimitState = webhookProcessor.getRateLimitState();

      res.json({
        status: 'running',
        statistics: {
          eventsProcessed: stats.eventsProcessed,
          eventsFailed: stats.eventsFailed,
          apiCallsMade: stats.apiCallsMade,
          tokenRefreshes: stats.tokenRefreshes,
        },
        rateLimits: {
          fifteenMinute: {
            used: rateLimitState.fifteenMinuteRequests,
            limit: 200,
            windowStart: new Date(rateLimitState.fifteenMinuteWindowStart).toISOString(),
          },
          daily: {
            used: rateLimitState.dailyRequests,
            limit: 2000,
            windowStart: new Date(rateLimitState.dailyWindowStart).toISOString(),
          },
        },
        timestamp: new Date().toISOString(),
      });
    });
  }

  return router;
}
