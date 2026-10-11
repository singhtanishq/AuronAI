import { Router } from 'express';
import { z } from 'zod';
import { conversationRepository } from '../repositories/conversationRepository';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { validateBody, validateQuery, validateParams } from '../middleware/validation';
import { asyncHandler, AppError } from '../middleware/errorHandler';

const router = Router();

const createConversationSchema = z.object({
  title: z.string().max(200).optional(),
});

const updateConversationSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  pinned: z.boolean().optional(),
  archived: z.boolean().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field is required',
});

const searchQuerySchema = z.object({
  q: z.string().min(1).max(200),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  // String "false" must mean false; z.coerce.boolean() would coerce any
  // non-empty string to true.
  includeArchived: z.preprocess(
    (value) => value === 'true' || value === '1' || value === true,
    z.boolean().default(false)
  ),
});

const conversationParamsSchema = z.object({
  id: z.string().uuid(),
});

router.get('/', authMiddleware, validateQuery(listQuerySchema), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { page, pageSize, includeArchived } = req.query as { page: number; pageSize: number; includeArchived: boolean };
  const result = await conversationRepository.listPaginated(req.user!.id, page, pageSize, includeArchived);
  res.json(result);
}));

router.get('/search', authMiddleware, validateQuery(searchQuerySchema), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { q, limit } = req.query as { q: string; limit: number };
  const result = await conversationRepository.search(req.user!.id, q, limit);
  res.json(result);
}));

router.get('/pinned', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const conversations = await conversationRepository.list(req.user!.id, { pinnedOnly: true });
  res.json({ data: conversations });
}));

router.post('/', authMiddleware, validateBody(createConversationSchema), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { title } = req.body;
  const conversation = await conversationRepository.create(req.user!.id, title || 'New Chat');
  res.status(201).json({ conversation });
}));

router.get('/:id', authMiddleware, validateParams(conversationParamsSchema), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const result = await conversationRepository.findByIdWithMessages(id, req.user!.id);

  if (!result) {
    throw new AppError('NOT_FOUND', 'Conversation not found', 404);
  }

  res.json(result);
}));

router.patch('/:id', authMiddleware, validateParams(conversationParamsSchema), validateBody(updateConversationSchema), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { title, pinned, archived } = req.body;

  // Values are set explicitly (not toggled), so a client sending
  // { pinned: true } on an already-pinned conversation is a safe no-op.
  const conversation = await conversationRepository.updateFields(id, req.user!.id, {
    title,
    pinned,
    archived,
  });

  if (!conversation) {
    throw new AppError('NOT_FOUND', 'Conversation not found', 404);
  }

  res.json({ conversation });
}));

router.delete('/:id', authMiddleware, validateParams(conversationParamsSchema), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const deleted = await conversationRepository.delete(id, req.user!.id);

  if (!deleted) {
    throw new AppError('NOT_FOUND', 'Conversation not found', 404);
  }

  res.json({ message: 'Conversation deleted' });
}));

router.delete('/', authMiddleware, validateBody(z.object({ confirm: z.literal('DELETE ALL') })), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const count = await conversationRepository.deleteAll(req.user!.id);
  res.json({ message: `Deleted ${count} conversations`, count });
}));

export default router;
