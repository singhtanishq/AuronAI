import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { logger } from '../utils/logger';

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body) as T;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        res.status(400).json({
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details,
        });
        return;
      }
      logger.error('Validation error', error as Record<string, unknown>);
      res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Invalid request body' });
    }
  };
}

export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse(req.query) as T;
      req.query = parsed as any;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        res.status(400).json({
          code: 'VALIDATION_ERROR',
          message: 'Invalid query parameters',
          details,
        });
        return;
      }
      res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Invalid query parameters' });
    }
  };
}

export function validateParams<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse(req.params) as T;
      req.params = parsed as any;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        res.status(400).json({
          code: 'VALIDATION_ERROR',
          message: 'Invalid route parameters',
          details,
        });
        return;
      }
      res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Invalid route parameters' });
    }
  };
}