/**
 * Global error handling middleware
 * Catches all errors and returns consistent error responses
 */

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Handle known application errors
  if (error instanceof AppError) {
    logger.warn('Application error', {
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
      path: req.path,
      method: req.method,
    });

    res.status(error.statusCode).json(error.toJSON());
    return;
  }

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    logger.warn('Validation error', {
      errors: error.errors,
      path: req.path,
      method: req.method,
    });

    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: error.errors.map(err => ({
          path: err.path.join('.'),
          message: err.message,
        })),
      },
    });
    return;
  }

  // Handle unexpected errors
  logger.error('Unexpected error', error, {
    path: req.path,
    method: req.method,
    body: req.body,
  });

  // Don't leak internal error details in production
  const message =
    process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : error.message;

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message,
    },
  });
}

/**
 * 404 handler for undefined routes
 */
export function notFoundHandler(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  logger.warn('Route not found', {
    path: req.path,
    method: req.method,
  });

  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
}
