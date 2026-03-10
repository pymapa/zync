/**
 * Express application setup
 * Configures middleware and routes
 */

import express, { Express } from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { config } from './config';
import { SessionStore } from './services/session/store';
import { LRUCache } from './services/cache/cache';
import { initDatabase } from './services/database/index';
import { corsMiddleware } from './middleware/cors';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { createApiRouter } from './routes';
import { logger } from './utils/logger';

export interface AppServices {
  sessionStore: SessionStore;
  cache: LRUCache<unknown>;
}

export function createApp(): { app: Express; services: AppServices } {
  const app = express();

  // Trust proxy configuration
  // Enable this if the app is behind a reverse proxy (nginx, load balancer, etc.)
  // This allows Express to trust X-Forwarded-* headers for req.ip, req.protocol, etc.
  if (config.trustProxy > 0) {
    app.set('trust proxy', config.trustProxy);
    logger.info('Trust proxy enabled', { trustProxy: config.trustProxy });
  }

  // Initialize services
  const sessionStore = new SessionStore(config.cookie.maxAge);
  const cache = new LRUCache({
    maxSize: config.cache.maxSize,
    defaultTtlSeconds: config.cache.defaultTtlSeconds,
  });

  // Initialize database
  initDatabase();
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

  // 404 handler
  app.use(notFoundHandler);

  // Global error handler (must be last)
  app.use(errorHandler);

  logger.info('Express application configured successfully');

  return {
    app,
    services: {
      sessionStore,
      cache,
    },
  };
}
