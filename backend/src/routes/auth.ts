import { Router } from 'express';
import { z } from 'zod';
import { authService } from '../services/authService';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = Router();

const signupSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
  confirmPassword: z.string(),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
}).refine(data => data.name || data.email, {
  message: 'At least one field is required',
});

router.post('/signup', validateBody(signupSchema), asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  const result = await authService.signup(name, email, password);

  res.cookie('auron_session', result.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  });

  res.status(201).json({
    user: result.user,
    token: result.token,
  });
}));

router.post('/login', validateBody(loginSchema), asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await authService.login(email, password);

  res.cookie('auron_session', result.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });

  res.json({
    user: result.user,
    token: result.token,
  });
}));

router.post('/logout', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res) => {
  if (req.token) {
    await authService.logout(req.token);
  }

  res.clearCookie('auron_session');
  res.json({ message: 'Logged out successfully' });
}));

router.post('/logout-all', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res) => {
  if (req.user) {
    await authService.logoutAll(req.user.id);
  }

  res.clearCookie('auron_session');
  res.json({ message: 'Logged out from all devices' });
}));

router.get('/me', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res) => {
  res.json({ user: req.user });
}));

router.post('/change-password', authMiddleware, validateBody(changePasswordSchema), asyncHandler(async (req: AuthenticatedRequest, res) => {
  if (!req.user) throw new AppError('UNAUTHORIZED', 'User not found', 401);

  const { currentPassword, newPassword } = req.body;
  await authService.changePassword(req.user.id, currentPassword, newPassword);

  // Clear cookie since all sessions are invalidated
  res.clearCookie('auron_session');
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
  res.clearCookie('auron_session');
  res.json({ message: 'Account deleted successfully' });
}));

export default router;