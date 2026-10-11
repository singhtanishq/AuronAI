import { getAIProvider } from '../providers';
import { conversationRepository } from '../repositories/conversationRepository';
import { messageRepository } from '../repositories/messageRepository';
import { preferencesRepository } from '../repositories/preferencesRepository';
import { buildSystemPrompt } from '../prompts/systemPrompt';
import { ChatRequest, ContextMessage, Message, StreamChunk } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { config } from '../config';

export class ChatError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'CHAT_ERROR'
  ) {
    super(message);
    this.name = 'ChatError';
  }
}

export class ConcurrencyError extends ChatError {
  constructor(message: string) {
    super(message, 'CONCURRENCY_LIMIT');
  }
}

interface ChatServiceOptions {
  userId: string;
  conversationId?: string;
  message: string;
  model?: string;
  temperature?: number;
  systemPrompt?: string;
  onChunk?: (chunk: StreamChunk) => void;
  onTitle?: (conversationId: string, title: string) => void;
}

export interface ChatResult {
  conversationId: string;
  userMessageId: string;
  assistantMessageId: string;
  content: string;
  status: 'completed' | 'aborted' | 'error';
  error?: string;
  title?: string;
}

interface ActiveGeneration {
  userId: string;
  conversationId: string;
  assistantMessageId: string;
  controller: AbortController;
}

/** One entry per in-flight generation; abort targets are validated against this. */
const activeGenerations = new Map<string, ActiveGeneration>();

export function activeGenerationCountForUser(userId: string): number {
  let count = 0;
  for (const generation of activeGenerations.values()) {
    if (generation.userId === userId) count += 1;
  }
  return count;
}

export function abortAllGenerations(): void {
  for (const generation of activeGenerations.values()) {
    generation.controller.abort();
  }
}

/**
 * Build the message history sent to the model.
 *
 * - Newest messages are preferred; older turns are dropped once the budget
 *   is exhausted (the current user prompt is handled separately and is
 *   never truncated).
 * - A single oversized history message is trimmed from its head with an
 *   explicit omission marker rather than silently dropped.
 */
export function buildContextHistory(
  history: Array<{ role: ContextMessage['role']; content: string }>,
  budgetChars: number,
  maxMessageChars: number
): ContextMessage[] {
  const kept: ContextMessage[] = [];
  let used = 0;

  for (let i = history.length - 1; i >= 0; i -= 1) {
    const entry = history[i];
    let content = entry.content;
    if (!content.trim()) continue;

    if (content.length > maxMessageChars) {
      content = `[... earlier text omitted ...]\n${content.slice(-maxMessageChars)}`;
    }

    if (used + content.length > budgetChars) {
      if (kept.length === 0 && entry.role === 'user') {
        // Always keep at least the most recent user turn.
        kept.unshift({ role: entry.role, content });
        used += content.length;
      }
      break;
    }

    kept.unshift({ role: entry.role, content });
    used += content.length;
  }

  return kept;
}

function estimateTokens(content: string): number {
  return Math.round(content.length / 4);
}

export const chatService = {
  async sendMessage(options: ChatServiceOptions): Promise<ChatResult> {
    const { userId, conversationId, message, model, temperature, systemPrompt, onChunk, onTitle } = options;

    if (activeGenerationCountForUser(userId) >= config.chat.maxConcurrentGenerationsPerUser) {
      throw new ConcurrencyError(
        'You already have a generation in progress. Wait for it to finish or stop it first.'
      );
    }

    let conversation;
    if (conversationId) {
      const existing = await conversationRepository.findById(conversationId, userId);
      if (!existing) {
        throw new ChatError('Conversation not found', 'NOT_FOUND');
      }
      conversation = existing;
    } else {
      conversation = await conversationRepository.create(userId, 'New Chat');
    }

    const preferences = await preferencesRepository.get(userId);
    const effectiveModel = model || preferences.model;
    const effectiveSystemPrompt = buildSystemPrompt(systemPrompt || preferences.systemPrompt);
    const effectiveTemperature = temperature ?? preferences.temperature;

    // User message and assistant placeholder are persisted before generation
    // starts so a crash never loses the user's prompt.
    const userMessage = await messageRepository.createUserMessage(conversation.id, message);
    const assistantMessage = await messageRepository.createAssistantMessage(
      conversation.id,
      effectiveModel,
      'streaming'
    );

    return this.runGeneration({
      userId,
      conversationId: conversation.id,
      assistantMessageId: assistantMessage.id,
      request: {
        message,
        model: effectiveModel,
        temperature: effectiveTemperature,
        systemPrompt: effectiveSystemPrompt,
        history: [],
      },
      historyConversationId: conversation.id,
      excludeMessageIds: [userMessage.id, assistantMessage.id],
      userMessageId: userMessage.id,
      onChunk,
      onTitle,
      previousTitle: conversation.title,
      firstUserMessage: message,
    });
  },

  async regenerateResponse(
    userId: string,
    conversationId: string,
    assistantMessageId: string,
    onChunk?: (chunk: StreamChunk) => void
  ): Promise<ChatResult> {
    if (activeGenerationCountForUser(userId) >= config.chat.maxConcurrentGenerationsPerUser) {
      throw new ConcurrencyError(
        'You already have a generation in progress. Wait for it to finish or stop it first.'
      );
    }

    const conversation = await conversationRepository.findById(conversationId, userId);
    if (!conversation) {
      throw new ChatError('Conversation not found', 'NOT_FOUND');
    }

    const assistantMessage = await messageRepository.findById(assistantMessageId);
    // The message must belong to this user's conversation — not just exist.
    if (!assistantMessage || assistantMessage.role !== 'assistant' || assistantMessage.conversationId !== conversationId) {
      throw new ChatError('Assistant message not found', 'NOT_FOUND');
    }

    const messages = await messageRepository.findByConversationId(conversationId);
    const assistantIndex = messages.findIndex((m) => m.id === assistantMessageId);
    if (assistantIndex < 0) {
      throw new ChatError('Assistant message not found', 'NOT_FOUND');
    }

    // The user message immediately preceding the assistant message is the
    // prompt being regenerated; everything before it is history.
    let userMessage: Message | null = null;
    let userIndex = -1;
    for (let i = assistantIndex - 1; i >= 0; i -= 1) {
      if (messages[i].role === 'user') {
        userMessage = messages[i];
        userIndex = i;
        break;
      }
    }
    if (!userMessage) {
      throw new ChatError('No user message to regenerate from', 'INVALID_REQUEST');
    }

    const history = messages
      .slice(0, userIndex)
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role as ContextMessage['role'], content: m.content }));

    const preferences = await preferencesRepository.get(userId);
    const effectiveModel = assistantMessage.model || preferences.model;
    const effectiveSystemPrompt = buildSystemPrompt(preferences.systemPrompt);
    const effectiveTemperature = preferences.temperature;

    await messageRepository.updateContent(assistantMessageId, '');
    await messageRepository.finalize(assistantMessageId, { status: 'streaming' });

    return this.runGeneration({
      userId,
      conversationId: conversation.id,
      assistantMessageId,
      request: {
        message: userMessage.content,
        model: effectiveModel,
        temperature: effectiveTemperature,
        systemPrompt: effectiveSystemPrompt,
        history,
      },
      historyConversationId: undefined,
      excludeMessageIds: [],
      userMessageId: userMessage.id,
      onChunk,
      previousTitle: conversation.title,
      firstUserMessage: undefined,
    });
  },

  /**
   * Shared generation pipeline: streams from the provider, persists partial
   * content while streaming, and records a correct terminal state.
   */
  async runGeneration(params: {
    userId: string;
    conversationId: string;
    assistantMessageId: string;
    request: ChatRequest;
    historyConversationId?: string;
    excludeMessageIds: string[];
    userMessageId: string;
    onChunk?: (chunk: StreamChunk) => void;
    onTitle?: (conversationId: string, title: string) => void;
    previousTitle?: string;
    firstUserMessage?: string;
  }): Promise<ChatResult> {
    const {
      userId,
      conversationId,
      assistantMessageId,
      request,
      historyConversationId,
      excludeMessageIds,
      userMessageId,
      onChunk,
      onTitle,
      previousTitle,
      firstUserMessage,
    } = params;

    // Assemble prior turns for context, excluding the records created for
    // this generation.
    if (request.history.length === 0 && historyConversationId) {
      const recent = await messageRepository.findRecentByConversationId(historyConversationId, 40);
      request.history = buildContextHistory(
        recent
          .filter((m) => !excludeMessageIds.includes(m.id) && m.role !== 'system')
          .map((m) => ({ role: m.role as ContextMessage['role'], content: m.content })),
        config.chat.maxContextChars,
        config.chat.maxHistoryMessageChars
      );
    }

    const generationId = uuidv4();
    const controller = new AbortController();
    activeGenerations.set(generationId, {
      userId,
      conversationId,
      assistantMessageId,
      controller,
    });

    const startTime = Date.now();
    let fullContent = '';
    let dirty = false;

    const flushTimer = setInterval(() => {
      if (dirty) {
        dirty = false;
        messageRepository.updateContent(assistantMessageId, fullContent).catch(() => {
          // Partial-flush failures are non-fatal; the final write retries.
        });
      }
    }, config.chat.contentFlushIntervalMs);

    try {
      const provider = getAIProvider();
      const result = await provider.stream(
        request,
        (chunk) => {
          if (chunk.content) {
            fullContent += chunk.content;
            dirty = true;
            onChunk?.({ type: 'content', content: chunk.content });
          }
        },
        controller.signal
      );

      const finalMessage = await messageRepository.finalize(assistantMessageId, {
        status: result.status === 'completed' ? 'completed' : result.status,
        content: fullContent,
        tokenCount: estimateTokens(fullContent),
        generationTimeMs: Date.now() - startTime,
      });

      if (result.status === 'completed') {
        await conversationRepository.touch(conversationId);
      }

      let title: string | undefined;
      if (result.status === 'completed' && previousTitle === 'New Chat' && firstUserMessage) {
        title = await this.generateTitle(firstUserMessage, fullContent, request.model || '');
        if (title && title !== 'New Chat') {
          await conversationRepository.updateFields(conversationId, userId, { title });
          onTitle?.(conversationId, title);
        }
      }

      if (result.status === 'error') {
        return {
          conversationId,
          userMessageId,
          assistantMessageId,
          content: fullContent,
          status: 'error',
          error: result.error || 'Generation failed',
        };
      }

      return {
        conversationId,
        userMessageId,
        assistantMessageId,
        content: fullContent,
        status: result.status,
        title,
      };
    } finally {
      clearInterval(flushTimer);
      activeGenerations.delete(generationId);
    }
  },

  /**
   * Abort a generation. The caller must own the generation: user id,
   * conversation, and assistant message must all match the active entry.
   */
  abortGeneration(userId: string, conversationId: string, assistantMessageId: string): boolean {
    for (const generation of activeGenerations.values()) {
      if (
        generation.userId === userId &&
        generation.conversationId === conversationId &&
        generation.assistantMessageId === assistantMessageId
      ) {
        generation.controller.abort();
        return true;
      }
    }
    return false;
  },

  async generateTitle(userMessage: string, assistantResponse: string, model: string): Promise<string | undefined> {
    try {
      const provider = getAIProvider();
      const titlePrompt = `Generate a short, descriptive title (max 50 characters) for this conversation. Respond with only the title, no quotes, no extra text.\n\nUser: ${userMessage.slice(0, 500)}\n\nAssistant: ${assistantResponse.slice(0, 500)}`;

      const title = await provider.generate({
        message: titlePrompt,
        model,
        temperature: 0.3,
        systemPrompt: 'You generate concise, descriptive chat titles. Respond with only the title, no quotes, no extra text.',
      });

      let cleanTitle = title.trim().replace(/^["']|["']$/g, '').replace(/\s+/g, ' ').trim();
      if (cleanTitle.length > 50) {
        cleanTitle = `${cleanTitle.slice(0, 47)}...`;
      }
      return cleanTitle || undefined;
    } catch (error) {
      logger.warn('Title generation failed, using fallback', { error: (error as Error).message });
      // Fallback: first few words of the user's message.
      const words = userMessage.trim().split(/\s+/).slice(0, 6).join(' ');
      if (!words) return undefined;
      return words.length > 50 ? `${words.slice(0, 47)}...` : words;
    }
  },
};
