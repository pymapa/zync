/**
 * Configuration loader with validation
 * Validates all required environment variables at startup
 */

import { z } from 'zod';
import { logger } from '../utils/logger';

const configSchema = z.object({
  port: z.coerce.number().min(1).max(65535).default(3001),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  trustProxy: z.coerce.number().min(0).default(0), // Set to 1 if behind reverse proxy (nginx, load balancer, etc.)
  databaseUrl: z.string().min(1, 'DATABASE_URL is required'), // PostgreSQL connection string
  strava: z.object({
    clientId: z.string().min(1, 'STRAVA_CLIENT_ID is required'),
    clientSecret: z.string().min(1, 'STRAVA_CLIENT_SECRET is required'),
    authorizationUrl: z.string().url().default('https://www.strava.com/oauth/authorize'),
    tokenUrl: z.string().url().default('https://www.strava.com/oauth/token'),
    apiBaseUrl: z.string().url().default('https://www.strava.com/api/v3'),
  }),
  frontend: z.object({
    url: z.string().url(),
  }),
  cookie: z.object({
    secret: z.string().min(32, 'COOKIE_SECRET must be at least 32 characters'),
    name: z.string().default('zync.sid'),
    maxAge: z.number().default(30 * 24 * 60 * 60 * 1000), // 30 days
  }),
  rateLimit: z.object({
    windowMs: z.number().default(15 * 60 * 1000), // 15 minutes
    maxRequestsPerUser: z.number().default(80),
    maxAuthRequests: z.number().default(5),
  }),
  cache: z.object({
    maxSize: z.number().default(1000),
    defaultTtlSeconds: z.number().default(300), // 5 minutes
  }),
});

export type Config = z.infer<typeof configSchema>;

function loadConfig(): Config {
  try {
    const rawConfig = {
      port: process.env.PORT,
      nodeEnv: process.env.NODE_ENV,
      trustProxy: process.env.TRUST_PROXY,
      databaseUrl: process.env.DATABASE_URL,
      strava: {
        clientId: process.env.STRAVA_CLIENT_ID,
        clientSecret: process.env.STRAVA_CLIENT_SECRET,
        authorizationUrl: process.env.STRAVA_AUTHORIZATION_URL,
        tokenUrl: process.env.STRAVA_TOKEN_URL,
        apiBaseUrl: process.env.STRAVA_API_BASE_URL,
      },
      frontend: {
        url: process.env.FRONTEND_URL,
      },
      cookie: {
        secret: process.env.COOKIE_SECRET,
        name: process.env.COOKIE_NAME,
        maxAge: process.env.COOKIE_MAX_AGE
          ? parseInt(process.env.COOKIE_MAX_AGE, 10)
          : undefined,
      },
      rateLimit: {
        windowMs: process.env.RATE_LIMIT_WINDOW_MS
          ? parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10)
          : undefined,
        maxRequestsPerUser: process.env.RATE_LIMIT_MAX_REQUESTS_PER_USER
          ? parseInt(process.env.RATE_LIMIT_MAX_REQUESTS_PER_USER, 10)
          : undefined,
        maxAuthRequests: process.env.RATE_LIMIT_MAX_AUTH_REQUESTS
          ? parseInt(process.env.RATE_LIMIT_MAX_AUTH_REQUESTS, 10)
          : undefined,
      },
      cache: {
        maxSize: process.env.CACHE_MAX_SIZE
          ? parseInt(process.env.CACHE_MAX_SIZE, 10)
          : undefined,
        defaultTtlSeconds: process.env.CACHE_DEFAULT_TTL_SECONDS
          ? parseInt(process.env.CACHE_DEFAULT_TTL_SECONDS, 10)
          : undefined,
      },
    };

    const config = configSchema.parse(rawConfig);

    logger.info('Configuration loaded successfully', {
      port: config.port,
      nodeEnv: config.nodeEnv,
      frontendUrl: config.frontend.url,
    });

    return config;
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error('Configuration validation failed', error, {
        errors: error.errors,
      });
      throw new Error(
        `Configuration validation failed: ${error.errors
          .map(e => `${e.path.join('.')}: ${e.message}`)
          .join(', ')}`
      );
    }
    throw error;
  }
}

export const config = loadConfig();
