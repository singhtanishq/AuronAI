import { getAIProvider } from '../providers';
import { conversationRepository } from '../repositories/conversationRepository';
import { messageRepository } from '../repositories/messageRepository';
import { preferencesRepository } from '../repositories/preferencesRepository';
import { buildSystemPrompt } from '../prompts/systemPrompt';
import { ChatRequest, StreamChunk, Message, Conversation } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

interface ChatServiceOptions {
  userId: string;
  conversationId?: string;
  message: string;
  model?: string;
  temperature?: number;
  systemPrompt?: string;
  onChunk?: (chunk: StreamChunk) => void;
}

interface ChatResult {
  conversationId: string;
  userMessageId: string;
  assistantMessageId: string;
  content: string;
}

export const chatService = {
  async sendMessage(options: ChatServiceOptions): Promise<ChatResult> {
    const { userId, conversationId, message, model, temperature, systemPrompt, onChunk } = options;

    let conversation: Conversation;

    if (conversationId) {
      const existing = await conversationRepository.findById(conversationId, userId);
      if (!existing) {
        throw new Error('Conversation not found');
      }
      conversation = existing;
    } else {
      conversation = await conversationRepository.create(userId, 'New Chat');
    }

    // Save user message
    const userMessage = await messageRepository.createUserMessage(conversation.id, message);

    // Get user preferences for model and system prompt
    const preferences = await preferencesRepository.get(userId);
    const effectiveModel = model || preferences.model;
    const effectiveSystemPrompt = buildSystemPrompt(systemPrompt || preferences.systemPrompt);
    const effectiveTemperature = temperature ?? preferences.temperature;

    // Create assistant message placeholder
    const assistantMessage = await messageRepository.createAssistantMessage(
      conversation.id,
      '',
      effectiveModel,
      'streaming'
    );

    const startTime = Date.now();
    let fullContent = '';
    let tokenCount = 0;

    const provider = getAIProvider();

    // Build context with recent messages
    const recentMessages = await messageRepository.findRecentByConversationId(conversation.id, 20);
    const contextMessages = recentMessages
      .filter(m => m.id !== userMessage.id && m.id !== assistantMessage.id)
      .map(m => ({ role: m.role, content: m.content }));

    const chatRequest: ChatRequest = {
      conversationId: conversation.id,
      message,
      model: effectiveModel,
      temperature: effectiveTemperature,
      systemPrompt: effectiveSystemPrompt,
    };

    try {
      await provider.stream(chatRequest, (chunk) => {
        if (chunk.type === 'content' && chunk.content) {
          fullContent += chunk.content;
          tokenCount += chunk.content.length / 4; // Rough estimation
          onChunk?.(chunk);
        } else if (chunk.type === 'done') {
          onChunk?.(chunk);
        } else if (chunk.type === 'error') {
          onChunk?.(chunk);
        }
      });

      // Update assistant message with final content
      await messageRepository.completeMessage(assistantMessage.id, {
        tokenCount: Math.round(tokenCount),
        generationTimeMs: Date.now() - startTime,
      });

      // Update conversation timestamp and potentially generate title
      await conversationRepository.updateTimestamp(conversation.id);

      // Auto-generate title if this is the first exchange
      const messageCount = await messageRepository.countByConversationId(conversation.id);
      if (messageCount <= 2 && conversation.title === 'New Chat') {
        const title = await this.generateTitle(message, fullContent, effectiveModel);
        await conversationRepository.updateTitle(conversation.id, userId, title);
      }

      return {
        conversationId: conversation.id,
        userMessageId: userMessage.id,
        assistantMessageId: assistantMessage.id,
        content: fullContent,
      };
    } catch (error) {
      logger.error('Chat service error', error as Record<string, unknown>);
      await messageRepository.updateStatus(assistantMessage.id, 'error');
      throw error;
    }
  },

  async regenerateResponse(
    userId: string,
    conversationId: string,
    assistantMessageId: string,
    onChunk?: (chunk: StreamChunk) => void
  ): Promise<{ content: string }> {
    const conversation = await conversationRepository.findById(conversationId, userId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    const assistantMessage = await messageRepository.findById(assistantMessageId);
    if (!assistantMessage || assistantMessage.role !== 'assistant') {
      throw new Error('Assistant message not found');
    }

    // Find the user message that preceded this assistant message
    const messages = await messageRepository.findByConversationId(conversationId);
    const assistantIndex = messages.findIndex(m => m.id === assistantMessageId);
    const userMessage = assistantIndex > 0 ? messages[assistantIndex - 1] : null;

    if (!userMessage || userMessage.role !== 'user') {
      throw new Error('No user message to regenerate from');
    }

    // Get preferences
    const preferences = await preferencesRepository.get(userId);
    const effectiveModel = preferences.model;
    const effectiveSystemPrompt = buildSystemPrompt(preferences.systemPrompt);
    const effectiveTemperature = preferences.temperature;

    // Reset assistant message content and status
    await messageRepository.updateContent(assistantMessageId, '');
    await messageRepository.updateStatus(assistantMessageId, 'streaming');

    const startTime = Date.now();
    let fullContent = '';
    let tokenCount = 0;

    const provider = getAIProvider();

    // Build context (messages before the user message)
    const contextMessages = messages
      .slice(0, assistantIndex)
      .map(m => ({ role: m.role, content: m.content }));

    const chatRequest: ChatRequest = {
      conversationId: conversation.id,
      message: userMessage.content,
      model: effectiveModel,
      temperature: effectiveTemperature,
      systemPrompt: effectiveSystemPrompt,
    };

    try {
      await provider.stream(chatRequest, (chunk) => {
        if (chunk.type === 'content' && chunk.content) {
          fullContent += chunk.content;
          tokenCount += chunk.content.length / 4;
          onChunk?.({ ...chunk, messageId: assistantMessageId });
        } else if (chunk.type === 'done') {
          onChunk?.({ ...chunk, messageId: assistantMessageId });
        } else if (chunk.type === 'error') {
          onChunk?.({ ...chunk, messageId: assistantMessageId });
        }
      });

      await messageRepository.completeMessage(assistantMessageId, {
        tokenCount: Math.round(tokenCount),
        generationTimeMs: Date.now() - startTime,
      });

      await conversationRepository.updateTimestamp(conversation.id);

      return { content: fullContent };
    } catch (error) {
      logger.error('Regenerate error', error);
      await messageRepository.updateStatus(assistantMessageId, 'error');
      throw error;
    }
  },

  async abortGeneration(conversationId: string, assistantMessageId: string): Promise<void> {
    const provider = getAIProvider();
    provider.abort();
    await messageRepository.abortMessage(assistantMessageId);
  },

  async generateTitle(userMessage: string, assistantResponse: string, model: string): Promise<string> {
    try {
      const provider = getAIProvider();
      const titlePrompt = `Generate a short, descriptive title (max 50 characters) for this conversation:\n\nUser: ${userMessage}\n\nAssistant: ${assistantResponse.substring(0, 500)}\n\nTitle:`;

      const title = await provider.generate({
        message: titlePrompt,
        model,
        temperature: 0.3,
        systemPrompt: 'You generate concise, descriptive chat titles. Respond with only the title, no quotes, no extra text.',
      });

      // Clean up the title
      let cleanTitle = title.trim().replace(/^["']|["']$/g, '').replace(/\n/g, ' ');
      if (cleanTitle.length > 50) {
        cleanTitle = cleanTitle.substring(0, 47) + '...';
      }
      return cleanTitle || 'New Chat';
    } catch (error) {
      logger.warn('Failed to generate title, using fallback', error);
      // Fallback: use first few words of user message
      const words = userMessage.trim().split(/\s+/).slice(0, 6).join(' ');
      return words.length > 50 ? words.substring(0, 47) + '...' : (words || 'New Chat');
    }
  },

  async getConversationContext(conversationId: string, maxMessages: number = 20): Promise<Message[]> {
    return messageRepository.findRecentByConversationId(conversationId, maxMessages);
  },
};