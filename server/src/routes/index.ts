/**
 * Route aggregator
 * Mounts all API routes
 */

import { Router } from 'express';
import { SessionStore } from '../services/session/store';
import { LRUCache } from '../services/cache/cache';
import type { WebhookProcessor } from '../workers/webhook-processor';
import { createHealthRouter } from './health.routes';
import { createAuthRouter } from './auth.routes';
import { createActivitiesRouter } from './activities.routes';
import { createAthleteRouter } from './athlete.routes';
import { createSyncRouter } from './sync.routes';
import { createWebhookRouter } from './webhook.routes';

export function createApiRouter(
  sessionStore: SessionStore,
  cache: LRUCache<unknown>,
  webhookProcessor?: WebhookProcessor
): Router {
  const router = Router();

  // Mount route modules
  router.use('/health', createHealthRouter(webhookProcessor));
  router.use('/auth', createAuthRouter(sessionStore, cache));
  router.use('/activities', createActivitiesRouter(sessionStore, cache));
  router.use('/athlete', createAthleteRouter(sessionStore, cache));
  router.use('/sync', createSyncRouter(sessionStore));
  router.use('/webhooks', createWebhookRouter());

  return router;
}
