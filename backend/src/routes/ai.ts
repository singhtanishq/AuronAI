import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { chatService, ChatError } from '../services/chatService';
import { getAIProvider } from '../providers';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { config } from '../config';

const router = Router();

const chatSchema = z.object({
  conversationId: z.string().uuid().optional(),
  message: z.string().min(1).max(50000),
  model: z.string().min(1).max(200).optional(),
  temperature: z.number().min(0).max(2).optional(),
  systemPrompt: z.string().max(5000).optional(),
});

const regenerateSchema = z.object({
  conversationId: z.string().uuid(),
  assistantMessageId: z.string().uuid(),
});

const abortSchema = z.object({
  conversationId: z.string().uuid(),
  assistantMessageId: z.string().uuid(),
});

const generationLimiter = rateLimit({
  windowMs: config.rateLimit.generationWindowMs,
  max: config.rateLimit.generationMaxRequests,
  message: { code: 'RATE_LIMITED', message: 'Too many generation requests, please slow down' },
  standardHeaders: true,
  legacyHeaders: false,
});

/** SSE event writer that refuses to write after the client disconnected. */
function createSseWriter(res: import('express').Response) {
  let closed = false;
  res.on('close', () => {
    closed = true;
  });

  return {
    get closed(): boolean {
      return closed || res.writableEnded;
    },
    send(payload: Record<string, unknown>): void {
      if (this.closed) return;
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    },
    ping(): void {
      if (this.closed) return;
      res.write(`: keep-alive\n\n`);
    },
  };
}

// Model/health listings hit Ollama; a short TTL avoids hammering it when
// several clients or tabs refresh simultaneously.
let modelsCache: { at: number; data: unknown } | null = null;
const MODELS_CACHE_TTL = 15000;

router.post('/chat', authMiddleware, generationLimiter, validateBody(chatSchema), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { conversationId, message, model, temperature, systemPrompt } = req.body;
  const userId = req.user!.id;

  const sse = createSseWriter(res);
  let assistantMessageId = '';
  let activeConversationId = conversationId || '';

  const sseHeaders = () => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
  };

  try {
    const result = await chatService.sendMessage({
      userId,
      conversationId,
      message,
      model,
      temperature,
      systemPrompt,
      signal: req.res?.req?.aborted ? undefined : disconnectSignal(res),
      onStart: (info) => {
        activeConversationId = info.conversationId;
        assistantMessageId = info.assistantMessageId;
        sse.send({
          type: 'start',
          conversationId: info.conversationId,
          userMessageId: info.userMessageId,
          assistantMessageId: info.assistantMessageId,
        });
      },
      onChunk: (chunk) => {
        sse.send({ type: 'delta', assistantMessageId, content: chunk.content });
      },
      onTitle: (convId, title) => {
        sse.send({ type: 'title', conversationId: convId, title });
      },
    });

    if (result.status === 'error') {
      sse.send({ type: 'error', assistantMessageId, message: result.error || 'Generation failed' });
    } else if (result.status === 'aborted') {
      sse.send({ type: 'aborted', conversationId: result.conversationId, assistantMessageId });
    } else {
      sse.send({
        type: 'done',
        conversationId: result.conversationId,
        userMessageId: result.userMessageId,
        assistantMessageId: result.assistantMessageId,
      });
    }
  } catch (error) {
    // Failures before the stream starts (validation, ownership, limits) still
    // reach the client through the SSE channel because headers may already be
    // sent for the streaming path.
    logger.error('Chat error', error as Record<string, unknown>);
    sseHeaders();
    const message = error instanceof ChatError || error instanceof AppError
      ? error.message
      : 'Chat failed';
    sse.send({ type: 'error', assistantMessageId, message });
  } finally {
    if (!sse.closed) res.end();
  }
}));

router.post('/regenerate', authMiddleware, generationLimiter, validateBody(regenerateSchema), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { conversationId, assistantMessageId } = req.body;
  const userId = req.user!.id;

  const sse = createSseWriter(res);

  try {
    const result = await chatService.regenerateResponse(
      userId,
      conversationId,
      assistantMessageId,
      (chunk) => {
        sse.send({ type: 'delta', assistantMessageId, content: chunk.content });
      }
    );

    if (result.status === 'error') {
      sse.send({ type: 'error', assistantMessageId, message: result.error || 'Regeneration failed' });
    } else if (result.status === 'aborted') {
      sse.send({ type: 'aborted', conversationId, assistantMessageId });
    } else {
      sse.send({ type: 'done', conversationId, assistantMessageId });
    }
  } catch (error) {
    logger.error('Regenerate error', error as Record<string, unknown>);
    const message = error instanceof ChatError || error instanceof AppError
      ? error.message
      : 'Regeneration failed';
    sse.send({ type: 'error', assistantMessageId, message });
  } finally {
    if (!sse.closed) res.end();
  }
}));

/**
 * Abort an in-flight generation. Ownership is enforced: the generation must
 * belong to the requesting user and match the given conversation/message.
 */
router.post('/abort', authMiddleware, validateBody(abortSchema), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { conversationId, assistantMessageId } = req.body;
  const aborted = chatService.abortGeneration(req.user!.id, conversationId, assistantMessageId);
  res.json({ aborted });
}));

router.get('/models', authMiddleware, asyncHandler(async (_req, res) => {
  const now = Date.now();
  if (modelsCache && now - modelsCache.at < MODELS_CACHE_TTL) {
    res.json(modelsCache.data as { models: unknown[] });
    return;
  }
  const provider = getAIProvider();
  const models = await provider.listModels();
  modelsCache = { at: now, data: { models } };
  res.json({ models });
}));

router.get('/health', authMiddleware, asyncHandler(async (_req, res) => {
  const provider = getAIProvider();
  const health = await provider.healthCheck();
  res.json({ ai: health });
}));

export default router;

/** Abort the generation if the client disconnects mid-stream. */
function disconnectSignal(res: import('express').Response): AbortSignal {
  const controller = new AbortController();
  res.on('close', () => controller.abort());
  return controller.signal;
}
