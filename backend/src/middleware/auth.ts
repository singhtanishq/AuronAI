import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/authService';
import { UserPublic } from '../types';
import { logger } from '../utils/logger';
import { config } from '../config';

export interface AuthenticatedRequest extends Request {
  user?: UserPublic;
  token?: string;
}

function extractToken(req: AuthenticatedRequest): string | undefined {
  return req.cookies?.[config.session.cookieName];
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = extractToken(req);

  if (!token) {
    res.status(401).json({ code: 'UNAUTHORIZED', message: 'Authentication required' });
    return;
  }

  authService
    .validateToken(token)
    .then((user) => {
      if (!user) {
        res.status(401).json({ code: 'UNAUTHORIZED', message: 'Invalid or expired session' });
        return;
      }
      req.user = user;
      req.token = token;
      next();
    })
    .catch((error) => {
      logger.error('Auth middleware error', error as Record<string, unknown>);
      res.status(401).json({ code: 'UNAUTHORIZED', message: 'Authentication failed' });
    });
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ code: 'UNAUTHORIZED', message: 'Authentication required' });
    return;
  }
  next();
}
