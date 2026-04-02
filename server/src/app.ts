/**
 * Express application setup
 * Configures middleware and routes
 */

import express, { Express } from 'express';
import path from 'path';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { Pool } from 'pg';
import { config } from './config';
import type { ISessionStore } from './services/session/interface';
import { PostgresSessionStore } from './services/session/pg-store';
import { LRUCache } from './services/cache/cache';
import { initDatabase } from './services/database/index';
import { corsMiddleware } from './middleware/cors';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { createApiRouter } from './routes';
import { logger } from './utils/logger';

export interface AppServices {
  sessionStore: ISessionStore;
  cache: LRUCache<unknown>;
  pgPool: Pool;
}

export async function createApp(): Promise<{ app: Express; services: AppServices }> {
  const app = express();

  // Trust proxy configuration
  if (config.trustProxy > 0) {
    app.set('trust proxy', config.trustProxy);
    logger.info('Trust proxy enabled', { trustProxy: config.trustProxy });
  }

  // Initialize PostgreSQL pool (shared between session store and database)
  const pgPool = new Pool({ connectionString: config.databaseUrl });

  // Initialize session store
  const sessionStore: ISessionStore = new PostgresSessionStore(pgPool, config.cookie.maxAge);

  await sessionStore.init();

  // Initialize cache
  const cache = new LRUCache({
    maxSize: config.cache.maxSize,
    defaultTtlSeconds: config.cache.defaultTtlSeconds,
  });

  // Initialize database (shares pg pool with session store)
  await initDatabase(pgPool);
  logger.info('Database initialized successfully');

  // Security middleware
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
    })
  );

  // CORS
  app.use(corsMiddleware);

  // Body parsing
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Cookie parsing with signature verification
  app.use(cookieParser(config.cookie.secret));

  // Request logging
  app.use((req, res, next) => {
    logger.info('Incoming request', {
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
    next();
  });

  // Mount API routes
  app.use('/api', createApiRouter(sessionStore, cache));

  // Serve static frontend in production
  if (config.nodeEnv === 'production') {
    const clientDist = path.join(__dirname, '../../client/dist');
    app.use(express.static(clientDist));
    // SPA fallback: serve index.html for all non-API routes
    app.get('*', (req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  // 404 handler (only reaches here for non-production or API routes)
  app.use(notFoundHandler);

  // Global error handler (must be last)
  app.use(errorHandler);

  logger.info('Express application configured successfully');

  return {
    app,
    services: {
      sessionStore,
      cache,
      pgPool,
    },
  };
}
