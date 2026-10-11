import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { authService } from '../services/authService';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { config } from '../config';

const router = Router();

const signupSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().max(254),
  password: z.string().min(config.auth.passwordMinLength).max(config.auth.passwordMaxLength),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(config.auth.passwordMaxLength),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(config.auth.passwordMinLength).max(config.auth.passwordMaxLength),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().max(254).optional(),
}).refine((data) => data.name !== undefined || data.email !== undefined, {
  message: 'At least one field is required',
});

// Strict budget for credential guessing; /api/auth/me is mounted outside this
// limiter so normal app loads are never throttled by it.
const credentialsLimiter = rateLimit({
  windowMs: config.rateLimit.authWindowMs,
  max: config.rateLimit.authMaxAttempts,
  message: {
    code: 'RATE_LIMITED',
    message: 'Too many authentication attempts, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

function setSessionCookie(res: import('express').Response, token: string): void {
  res.cookie(config.session.cookieName, token, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'lax',
    maxAge: config.session.cookieMaxAgeMs,
    path: '/',
  });
}

router.post('/signup', credentialsLimiter, validateBody(signupSchema), asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  const result = await authService.signup(name, email, password);

  setSessionCookie(res, result.token);
  res.status(201).json({ user: result.user });
}));

router.post('/login', credentialsLimiter, validateBody(loginSchema), asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await authService.login(email, password);

  setSessionCookie(res, result.token);
  res.json({ user: result.user });
}));

router.post('/logout', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res) => {
  if (req.token) {
    await authService.logout(req.token);
  }
  res.clearCookie(config.session.cookieName, { path: '/' });
  res.json({ message: 'Logged out successfully' });
}));

router.post('/logout-all', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res) => {
  if (req.user) {
    await authService.logoutAll(req.user.id);
  }
  res.clearCookie(config.session.cookieName, { path: '/' });
  res.json({ message: 'Logged out from all devices' });
}));

router.get('/me', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res) => {
  res.json({ user: req.user });
}));

router.get('/sessions', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const sessions = await authService.listSessions(req.user!.id, req.token);
  res.json({ sessions });
}));

router.delete('/sessions/:id', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const revoked = await authService.revokeSession(req.user!.id, req.params.id);
  if (!revoked) {
    throw new AppError('NOT_FOUND', 'Session not found', 404);
  }
  res.json({ message: 'Session revoked' });
}));

router.post('/change-password', authMiddleware, validateBody(changePasswordSchema), asyncHandler(async (req: AuthenticatedRequest, res) => {
  if (!req.user) throw new AppError('UNAUTHORIZED', 'User not found', 401);

  const { currentPassword, newPassword } = req.body;
  await authService.changePassword(req.user.id, currentPassword, newPassword);

  // All sessions (including this one) were invalidated server-side.
  res.clearCookie(config.session.cookieName, { path: '/' });
  res.json({ message: 'Password changed successfully. Please log in again.' });
}));

router.patch('/profile', authMiddleware, validateBody(updateProfileSchema), asyncHandler(async (req: AuthenticatedRequest, res) => {
  if (!req.user) throw new AppError('UNAUTHORIZED', 'User not found', 401);

  const user = await authService.updateProfile(req.user.id, req.body);
  res.json({ user });
}));

router.delete('/account', authMiddleware, validateBody(z.object({ password: z.string().min(1) })), asyncHandler(async (req: AuthenticatedRequest, res) => {
  if (!req.user) throw new AppError('UNAUTHORIZED', 'User not found', 401);

  await authService.deleteAccount(req.user.id, req.body.password);
  res.clearCookie(config.session.cookieName, { path: '/' });
  res.json({ message: 'Account deleted successfully' });
}));

export default router;
