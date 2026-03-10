/**
 * Route aggregator
 * Mounts all API routes
 */

import { Router } from 'express';
import { SessionStore } from '../services/session/store';
import { LRUCache } from '../services/cache/cache';
import { createHealthRouter } from './health.routes';
import { createAuthRouter } from './auth.routes';
import { createActivitiesRouter } from './activities.routes';
import { createAthleteRouter } from './athlete.routes';
import { createSyncRouter } from './sync.routes';

export function createApiRouter(
  sessionStore: SessionStore,
  cache: LRUCache<unknown>
): Router {
  const router = Router();

  // Mount route modules
  router.use('/health', createHealthRouter());
  router.use('/auth', createAuthRouter(sessionStore, cache));
  router.use('/activities', createActivitiesRouter(sessionStore, cache));
  router.use('/athlete', createAthleteRouter(sessionStore, cache));
  router.use('/sync', createSyncRouter(sessionStore));

  return router;
}
