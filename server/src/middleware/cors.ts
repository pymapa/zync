/**
 * CORS middleware configuration
 * Allows requests from configured frontend URL only
 */

import cors from 'cors';
import { config } from '../config';

// In development, allow multiple localhost ports in case Vite uses a fallback port
const getAllowedOrigins = (): string | string[] => {
  if (config.nodeEnv === 'development') {
    // Allow common Vite dev server ports
    return [
      config.frontend.url,
    ];
  }
  return config.frontend.url;
};

export const corsMiddleware = cors({
  origin: getAllowedOrigins(),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400, // 24 hours
});
