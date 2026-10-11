import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger';
import { config } from '../config';
import { AuthError } from '../services/authService';
import { ChatError, ConcurrencyError } from '../services/chatService';
import { ProviderError } from '../providers/aiProvider';

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

const AUTH_ERROR_STATUS: Record<string, number> = {
  VALIDATION_ERROR: 400,
  INVALID_CREDENTIALS: 401,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  EMAIL_TAKEN: 409,
};

const CHAT_ERROR_STATUS: Record<string, number> = {
  NOT_FOUND: 404,
  INVALID_REQUEST: 400,
  CONCURRENCY_LIMIT: 429,
  CHAT_ERROR: 500,
};

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof AuthError) {
    return new AppError(error.code, error.message, AUTH_ERROR_STATUS[error.code] ?? 400);
  }
  if (error instanceof ConcurrencyError) {
    return new AppError(error.code, error.message, 429);
  }
  if (error instanceof ChatError) {
    return new AppError(error.code, error.message, CHAT_ERROR_STATUS[error.code] ?? 500);
  }
  if (error instanceof ProviderError) {
    return new AppError('PROVIDER_UNAVAILABLE', error.message, 503);
  }
  return new AppError('INTERNAL_ERROR', error instanceof Error ? error.message : 'Unknown error', 500);
}

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  logger.error('Request error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  if (err instanceof ZodError) {
    res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: 'Invalid request data',
      details: err.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
    });
    return;
  }

  const appError = toAppError(err);

  if (appError.statusCode !== 500) {
    res.status(appError.statusCode).json({
      code: appError.code,
      message: appError.message,
      details: appError.details,
    });
    return;
  }

  const message = config.isProduction ? 'An internal server error occurred' : err.message;

  res.status(500).json({
    code: 'INTERNAL_ERROR',
    message,
    ...(!config.isProduction && { stack: err.stack }),
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({ code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` });
}

export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
