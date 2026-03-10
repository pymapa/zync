/**
 * Health check routes
 */

import { Router, Request, Response } from 'express';

export function createHealthRouter(): Router {
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

  return router;
}
