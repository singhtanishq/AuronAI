import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger';
import { config } from '../config';

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

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction): void {
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
      details: err.errors.map(e => ({ field: e.path.join('.'), message: e.message })),
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      code: err.code,
      message: err.message,
      details: err.details,
    });
    return;
  }

  // Handle specific known errors
  if (err.name === 'UnauthorizedError' || err.message.includes('jwt')) {
    res.status(401).json({ code: 'UNAUTHORIZED', message: 'Invalid or expired token' });
    return;
  }

  if (err.message.includes('ECONNREFUSED') || err.message.includes('fetch failed')) {
    res.status(503).json({
      code: 'SERVICE_UNAVAILABLE',
      message: 'Unable to connect to the local AI engine. Make sure Ollama is running.',
    });
    return;
  }

  // Generic error
  const statusCode = 500;
  const message = config.nodeEnv === 'production'
    ? 'An internal server error occurred'
    : err.message;

  res.status(statusCode).json({
    code: 'INTERNAL_ERROR',
    message,
    ...(config.nodeEnv !== 'production' && { stack: err.stack }),
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