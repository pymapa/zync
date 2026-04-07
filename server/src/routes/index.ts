/**
 * Route aggregator
 * Mounts all API routes
 */

import { Router } from 'express';
import type { ISessionStore } from '../services/session/interface';
import { LRUCache } from '../services/cache/cache';
import { createHealthRouter } from './health.routes';
import { createAuthRouter } from './auth.routes';
import { createActivitiesRouter } from './activities.routes';
import { createAthleteRouter } from './athlete.routes';
import { createSyncRouter } from './sync.routes';

export function createApiRouter(
  sessionStore: ISessionStore,
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
