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
  model: z.string().min(1).max(200).optional(),
  temperature: z.number().min(0).max(2).optional(),
  systemPrompt: z.string().max(5000).optional(),
}).refine((data) => Object.keys(data).length > 0, {
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

export default router;
