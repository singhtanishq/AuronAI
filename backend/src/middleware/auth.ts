import { Request, Response, NextFunction } from 'express';
import { authService, decodeToken } from '../services/authService';
import { UserPublic } from '../types';
import { logger } from '../utils/logger';

export interface AuthenticatedRequest extends Request {
  user?: UserPublic;
  token?: string;
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const cookieToken = req.cookies?.auron_session;

  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : cookieToken;

  if (!token) {
    res.status(401).json({ code: 'UNAUTHORIZED', message: 'Authentication required' });
    return;
  }

  authService.validateToken(token).then((user) => {
    if (!user) {
      res.status(401).json({ code: 'UNAUTHORIZED', message: 'Invalid or expired token' });
      return;
    }

    req.user = user;
    req.token = token;
    next();
  }).catch((error) => {
    logger.error('Auth middleware error', error);
    res.status(401).json({ code: 'UNAUTHORIZED', message: 'Authentication failed' });
  });
}

export function optionalAuthMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const cookieToken = req.cookies?.auron_session;

  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : cookieToken;

  if (!token) {
    next();
    return;
  }

  authService.validateToken(token).then((user) => {
    if (user) {
      req.user = user;
      req.token = token;
    }
    next();
  }).catch(() => {
    // Ignore errors for optional auth
    next();
  });
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ code: 'UNAUTHORIZED', message: 'Authentication required' });
    return;
  }
  next();
}