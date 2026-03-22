import { Router } from 'express';
import { z } from 'zod';
import { chatService } from '../services/chatService';
import { getAIProvider } from '../providers';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = Router();

const chatSchema = z.object({
  conversationId: z.string().uuid().optional(),
  message: z.string().min(1).max(50000),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  systemPrompt: z.string().max(5000).optional(),
});

const regenerateSchema = z.object({
  conversationId: z.string().uuid(),
  assistantMessageId: z.string().uuid(),
});

router.post('/chat', authMiddleware, validateBody(chatSchema), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { conversationId, message, model, temperature, systemPrompt } = req.body;

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendChunk = (chunk: any) => {
    res.write(`data: ${JSON.stringify(chunk)}\n\n`);
  };

  const sendError = (error: string) => {
    sendChunk({ type: 'error', error });
  };

  const sendDone = (messageId: string, conversationId: string) => {
    sendChunk({ type: 'done', messageId, conversationId });
  };

  try {
    const result = await chatService.sendMessage({
      userId: req.user!.id,
      conversationId,
      message,
      model,
      temperature,
      systemPrompt,
      onChunk: (chunk) => {
        if (chunk.type === 'content') {
          sendChunk(chunk);
        } else if (chunk.type === 'done') {
          sendDone(chunk.messageId!, chunk.conversationId!);
        } else if (chunk.type === 'error') {
          sendError(chunk.error!);
        }
      },
    });

    // Send final confirmation with conversation info
    sendChunk({
      type: 'complete',
      conversationId: result.conversationId,
      userMessageId: result.userMessageId,
      assistantMessageId: result.assistantMessageId,
    });
  } catch (error) {
    logger.error('Chat error', error as Record<string, unknown>);
    sendError(error instanceof Error ? error.message : 'Chat failed');
  } finally {
    res.end();
  }
}));

router.post('/regenerate', authMiddleware, validateBody(regenerateSchema), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { conversationId, assistantMessageId } = req.body;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendChunk = (chunk: any) => {
    res.write(`data: ${JSON.stringify(chunk)}\n\n`);
  };

  const sendError = (error: string) => {
    sendChunk({ type: 'error', error });
  };

  const sendDone = (messageId: string, conversationId: string) => {
    sendChunk({ type: 'done', messageId, conversationId });
  };

  try {
    const result = await chatService.regenerateResponse(req.user!.id, conversationId, assistantMessageId, (chunk) => {
      if (chunk.type === 'content') {
        sendChunk(chunk);
      } else if (chunk.type === 'done') {
        sendDone(chunk.messageId!, chunk.conversationId!);
      } else if (chunk.type === 'error') {
        sendError(chunk.error!);
      }
    });

    sendChunk({ type: 'complete', content: result.content });
  } catch (error) {
    logger.error('Regenerate error', error as Record<string, unknown>);
    sendError(error instanceof Error ? error.message : 'Regeneration failed');
  } finally {
    res.end();
  }
}));

router.post('/abort', authMiddleware, validateBody(z.object({
  conversationId: z.string().uuid(),
  assistantMessageId: z.string().uuid(),
})), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { conversationId, assistantMessageId } = req.body;
  await chatService.abortGeneration(conversationId, assistantMessageId);
  res.json({ message: 'Generation aborted' });
}));

router.get('/models', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const provider = getAIProvider();
  const models = await provider.listModels();
  res.json({ models });
}));

router.get('/health', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const provider = getAIProvider();
  const health = await provider.healthCheck();
  res.json({ ai: health });
}));

export default router;