/**
 * Custom error classes for structured error handling
 */

export enum ErrorCode {
  // Authentication errors
  UNAUTHORIZED = 'UNAUTHORIZED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',

  // Authorization errors
  FORBIDDEN = 'FORBIDDEN',

  // Validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_REQUEST = 'INVALID_REQUEST',

  // External service errors
  STRAVA_API_ERROR = 'STRAVA_API_ERROR',
  OAUTH_ERROR = 'OAUTH_ERROR',

  // Rate limiting
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // General errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  NOT_FOUND = 'NOT_FOUND',
}

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(): Record<string, unknown> {
    const errorResponse: Record<string, unknown> = {
      code: this.code,
      message: this.message,
    };

    if (this.details !== undefined) {
      errorResponse.details = this.details;
    }

    return {
      error: errorResponse,
    };
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required', details?: unknown) {
    super(401, ErrorCode.UNAUTHORIZED, message, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access forbidden', details?: unknown) {
    super(403, ErrorCode.FORBIDDEN, message, details);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(400, ErrorCode.VALIDATION_ERROR, message, details);
  }
}

export class StravaAPIError extends AppError {
  constructor(message: string, details?: unknown) {
    super(502, ErrorCode.STRAVA_API_ERROR, message, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', details?: unknown) {
    super(404, ErrorCode.NOT_FOUND, message, details);
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Rate limit exceeded', details?: unknown) {
    super(429, ErrorCode.RATE_LIMIT_EXCEEDED, message, details);
  }
}
