import { Router } from 'express';
import { z } from 'zod';
import { preferencesRepository } from '../repositories/preferencesRepository';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

const updatePreferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  sidebarCollapsed: z.boolean().optional(),
  enterToSend: z.boolean().optional(),
  showTimestamps: z.boolean().optional(),
  autoScroll: z.boolean().optional(),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  systemPrompt: z.string().max(5000).optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field is required',
});

router.get('/', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const preferences = await preferencesRepository.get(req.user!.id);
  res.json({ preferences });
}));

router.patch('/', authMiddleware, validateBody(updatePreferencesSchema), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const preferences = await preferencesRepository.update(req.user!.id, req.body);
  res.json({ preferences });
}));

router.patch('/theme', authMiddleware, validateBody(z.object({ theme: z.enum(['light', 'dark', 'system']) })), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const preferences = await preferencesRepository.setTheme(req.user!.id, req.body.theme);
  res.json({ preferences });
}));

router.patch('/sidebar', authMiddleware, validateBody(z.object({ collapsed: z.boolean() })), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const preferences = await preferencesRepository.setSidebarCollapsed(req.user!.id, req.body.collapsed);
  res.json({ preferences });
}));

router.patch('/model', authMiddleware, validateBody(z.object({ model: z.string().min(1) })), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const preferences = await preferencesRepository.setModel(req.user!.id, req.body.model);
  res.json({ preferences });
}));

router.patch('/temperature', authMiddleware, validateBody(z.object({ temperature: z.number().min(0).max(2) })), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const preferences = await preferencesRepository.setTemperature(req.user!.id, req.body.temperature);
  res.json({ preferences });
}));

router.patch('/system-prompt', authMiddleware, validateBody(z.object({ systemPrompt: z.string().max(5000) })), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const preferences = await preferencesRepository.setSystemPrompt(req.user!.id, req.body.systemPrompt);
  res.json({ preferences });
}));

export default router;