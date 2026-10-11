import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { conversationRepository } from '../repositories/conversationRepository';
import { chatService, ChatError, ConcurrencyError } from '../services/chatService';
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

type SsePayload = Record<string, unknown>;

/**
 * SSE event writer that refuses to write after the client disconnected, and
 * sends keep-alive comments so intermediate proxies do not time out.
 */
function createSseWriter(res: import('express').Response) {
  let closed = false;
  res.on('close', () => {
    closed = true;
  });

  const pingInterval = setInterval(() => {
    if (!closed && !res.writableEnded) {
      res.write(': keep-alive\n\n');
    }
  }, 15000);

  return {
    send(payload: SsePayload): void {
      if (closed || res.writableEnded) return;
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    },
    finish(): void {
      clearInterval(pingInterval);
      if (!closed && !res.writableEnded) {
        res.end();
      }
    },
  };
}

function startSse(res: import('express').Response): void {
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
}

/** Aborts the in-flight generation when the client disconnects mid-stream. */
function disconnectSignal(res: import('express').Response): AbortSignal {
  const controller = new AbortController();
  res.on('close', () => controller.abort());
  return controller.signal;
}

function sseErrorMessage(error: unknown): string {
  if (error instanceof ChatError || error instanceof AppError) {
    return error.message;
  }
  return 'Chat failed';
}

router.post('/chat', authMiddleware, generationLimiter, validateBody(chatSchema), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { conversationId, message, model, temperature, systemPrompt } = req.body;
  const userId = req.user!.id;

  // Validate what can produce a clean HTTP error before switching to SSE.
  if (conversationId) {
    const conversation = await conversationRepository.findById(conversationId, userId);
    if (!conversation) {
      throw new AppError('NOT_FOUND', 'Conversation not found', 404);
    }
  }
  try {
    chatService.checkCanGenerate(userId);
  } catch (error) {
    if (error instanceof ConcurrencyError) {
      throw new AppError(error.code, error.message, 429);
    }
    throw error;
  }

  startSse(res);
  const sse = createSseWriter(res);
  let assistantMessageId = '';

  try {
    const result = await chatService.sendMessage({
      userId,
      conversationId,
      message,
      model,
      temperature,
      systemPrompt,
      signal: disconnectSignal(res),
      onStart: (info) => {
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
      sse.send({
        type: 'error',
        assistantMessageId: result.assistantMessageId,
        message: result.error || 'Generation failed',
      });
    } else if (result.status === 'aborted') {
      sse.send({
        type: 'aborted',
        conversationId: result.conversationId,
        assistantMessageId: result.assistantMessageId,
      });
    } else {
      sse.send({
        type: 'done',
        conversationId: result.conversationId,
        userMessageId: result.userMessageId,
        assistantMessageId: result.assistantMessageId,
      });
    }
  } catch (error) {
    logger.error('Chat error', error as Record<string, unknown>);
    sse.send({ type: 'error', assistantMessageId, message: sseErrorMessage(error) });
  } finally {
    sse.finish();
  }
}));

router.post('/regenerate', authMiddleware, generationLimiter, validateBody(regenerateSchema), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { conversationId, assistantMessageId } = req.body;
  const userId = req.user!.id;

  try {
    chatService.checkCanGenerate(userId);
  } catch (error) {
    if (error instanceof ConcurrencyError) {
      throw new AppError(error.code, error.message, 429);
    }
    throw error;
  }

  startSse(res);
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
    sse.send({ type: 'error', assistantMessageId, message: sseErrorMessage(error) });
  } finally {
    sse.finish();
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

// Model/health listings hit Ollama; a short TTL avoids hammering it when
// several clients or tabs refresh simultaneously.
let modelsCache: { at: number; data: unknown } | null = null;
const MODELS_CACHE_TTL = 15000;

router.get('/models', authMiddleware, asyncHandler(async (_req, res) => {
  const now = Date.now();
  if (modelsCache && now - modelsCache.at < MODELS_CACHE_TTL) {
    res.json(modelsCache.data);
    return;
  }
  const provider = getAIProvider();
  const models = await provider.listModels();
  const payload = { models };
  modelsCache = { at: now, data: payload };
  res.json(payload);
}));

router.get('/health', authMiddleware, asyncHandler(async (_req, res) => {
  const provider = getAIProvider();
  const health = await provider.healthCheck();
  res.json({ ai: health });
}));

export default router;
