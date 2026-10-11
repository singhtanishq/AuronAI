import { config } from '../config';
import { messageRepository } from '../repositories/messageRepository';
import { chatService } from '../services/chatService';
import { getAIProvider, setAIProvider, resetAIProvider } from '../providers';
import type { AIProvider } from '../providers/aiProvider';
import type { ChatRequest, ModelInfo, ProviderHealth, StreamChunk, StreamResult } from '../types';
import { buildContextHistory } from '../services/chatService';

/**
 * Scripted mock provider: replays queued chunk groups per stream call and
 * records every request for assertions on context construction.
 */
class MockProvider implements AIProvider {
  name = 'mock';

  /** Each entry: chunks to emit, then the terminal result. */
  scripts: Array<{ chunks: string[]; result: StreamResult }> = [];
  requests: ChatRequest[] = [];
  private scriptIndex = 0;

  queue(chunks: string[], result: StreamResult): void {
    this.scripts.push({ chunks, result });
  }

  async generate(request: ChatRequest): Promise<string> {
    this.requests.push(request);
    return 'Mock Title';
  }

  async stream(
    request: ChatRequest,
    onChunk: (chunk: StreamChunk) => void,
    _signal?: AbortSignal
  ): Promise<StreamResult> {
    this.requests.push(request);
    const script = this.scripts[this.scriptIndex];
    this.scriptIndex += 1;
    if (!script) {
      return { status: 'error', content: '', error: 'No scripted response' };
    }
    for (const chunk of script.chunks) {
      onChunk({ type: 'content', content: chunk });
    }
    return { ...script.result, content: script.chunks.join('') };
  }

  async listModels(): Promise<ModelInfo[]> {
    return [{ name: 'mock-model', modifiedAt: '', size: 1, digest: 'x' }];
  }

  async healthCheck(): Promise<ProviderHealth> {
    return { reachable: true, models: 1, defaultModel: 'mock-model' };
  }
}

describe('buildContextHistory', () => {
  it('keeps the newest turns and drops older ones beyond the budget', () => {
    const history = [
      { role: 'user' as const, content: 'a'.repeat(100) },
      { role: 'assistant' as const, content: 'b'.repeat(100) },
      { role: 'user' as const, content: 'c'.repeat(100) },
      { role: 'assistant' as const, content: 'd'.repeat(100) },
    ];
    const result = buildContextHistory(history, 250, 1000);
    expect(result).toHaveLength(2);
    expect(result[0].content).toBe('c'.repeat(100));
    expect(result[1].content).toBe('d'.repeat(100));
  });

  it('preserves chronological order', () => {
    const history = [
      { role: 'user' as const, content: 'first' },
      { role: 'assistant' as const, content: 'second' },
    ];
    const result = buildContextHistory(history, 1000, 1000);
    expect(result.map((r) => r.content)).toEqual(['first', 'second']);
  });

  it('trims the head of an oversized single message with a marker', () => {
    const big = 'x'.repeat(500);
    const result = buildContextHistory([{ role: 'user', content: big }], 1000, 100);
    expect(result).toHaveLength(1);
    expect(result[0].content.startsWith('[... earlier text omitted ...]')).toBe(true);
    expect(result[0].content.endsWith('x'.repeat(100))).toBe(true);
  });

  it('never returns the current prompt truncated to nothing', () => {
    const result = buildContextHistory([{ role: 'user', content: 'y'.repeat(400) }], 100, 1000);
    // Even when over budget, the most recent user turn survives.
    expect(result).toHaveLength(1);
  });
});

describe('chatService', () => {
  let mock: MockProvider;
  const email = `chat-${Date.now()}@example.com`;
  let userId = '';

  beforeAll(async () => {
    const { authService } = await import('../services/authService');
    const { user } = await authService.signup('Chat Tester', email, 'password123');
    userId = user.id;
  });

  beforeEach(() => {
    mock = new MockProvider();
    setAIProvider(mock);
  });

  afterAll(() => {
    resetAIProvider();
  });

  it('persists the full streamed content on the assistant message (regression: empty-content bug)', async () => {
    mock.queue(['The ', 'answer ', 'is ', 'straightforward.'], { status: 'completed', content: '' });

    const result = await chatService.sendMessage({
      userId,
      message: 'What is the answer?',
      model: 'mock-model',
    });

    expect(result.status).toBe('completed');
    const stored = await messageRepository.findById(result.assistantMessageId);
    expect(stored?.status).toBe('completed');
    expect(stored?.content).toBe('The answer is straightforward.');

    const userMessage = await messageRepository.findById(result.userMessageId);
    expect(userMessage?.content).toBe('What is the answer?');
  });

  it('sends prior conversation history to the provider and excludes current-turn placeholders', async () => {
    mock.queue(['First response'], { status: 'completed', content: '' });

    const first = await chatService.sendMessage({
      userId,
      message: 'Question one',
      model: 'mock-model',
    });
    expect(first.status).toBe('completed');

    mock.queue(['Second response'], { status: 'completed', content: '' });
    const second = await chatService.sendMessage({
      userId,
      conversationId: first.conversationId,
      message: 'Question two',
      model: 'mock-model',
    });

    const secondRequest = mock.requests[mock.requests.length - 1];
    // History must contain the previous exchange, chronologically ordered.
    expect(secondRequest.history).toHaveLength(2);
    expect(secondRequest.history?.[0]).toEqual({ role: 'user', content: 'Question one' });
    expect(secondRequest.history?.[1]).toEqual({ role: 'assistant', content: 'First response' });
    // The current message is separate and not duplicated in history.
    expect(secondRequest.message).toBe('Question two');
    expect(secondRequest.history?.some((h) => h.content === 'Question two')).toBe(false);

    expect(second.status).toBe('completed');
    const stored = await messageRepository.findById(second.assistantMessageId);
    expect(stored?.content).toBe('Second response');
  });

  it('marks the assistant message as error with partial content when the upstream fails', async () => {
    mock.queue(['partial answer'], { status: 'error', content: '', error: 'Ollama error: model missing' });

    const result = await chatService.sendMessage({
      userId,
      message: 'Trigger failure',
      model: 'mock-model',
    });

    expect(result.status).toBe('error');
    expect(result.error).toContain('model missing');
    const stored = await messageRepository.findById(result.assistantMessageId);
    expect(stored?.status).toBe('error');
    expect(stored?.content).toBe('partial answer');
  });

  it('marks the assistant message aborted and preserves partial output', async () => {
    mock.queue(['partial text before stop'], { status: 'aborted', content: '' });

    const result = await chatService.sendMessage({
      userId,
      message: 'Long question',
      model: 'mock-model',
    });

    expect(result.status).toBe('aborted');
    const stored = await messageRepository.findById(result.assistantMessageId);
    expect(stored?.status).toBe('aborted');
    expect(stored?.content).toBe('partial text before stop');
  });

  it('refuses to stream into a conversation owned by another user', async () => {
    const { authService } = await import('../services/authService');
    const { user: other } = await authService.signup('Other User', `other-${Date.now()}@example.com`, 'password123');

    const first = await chatService.sendMessage({ userId, message: 'mine', model: 'mock-model' });
    mock.queue(['should never stream'], { status: 'completed', content: '' });

    await expect(
      chatService.sendMessage({
        userId: other.id,
        conversationId: first.conversationId,
        message: 'intrusion',
      })
    ).rejects.toThrow('Conversation not found');
  });

  it('validates generation ownership on abort', async () => {
    const first = await chatService.sendMessage({ userId, message: 'to abort', model: 'mock-model' });
    expect(first.status).toBe('completed');

    // No active generation: abort is a safe no-op returning false.
    expect(chatService.abortGeneration(userId, first.conversationId, first.assistantMessageId)).toBe(false);
  });

  it('regenerates using the preceding user message without duplicating it in history', async () => {
    mock.queue(['original answer'], { status: 'completed', content: '' });
    const sent = await chatService.sendMessage({ userId, message: 'regen me', model: 'mock-model' });

    mock.queue(['regenerated answer'], { status: 'completed', content: '' });
    const result = await chatService.regenerateResponse(userId, sent.conversationId, sent.assistantMessageId);

    expect(result.status).toBe('completed');
    const regenRequest = mock.requests[mock.requests.length - 1];
    expect(regenRequest.message).toBe('regen me');
    expect(regenRequest.history?.some((h) => h.content === 'regen me')).toBe(false);

    const stored = await messageRepository.findById(sent.assistantMessageId);
    expect(stored?.content).toBe('regenerated answer');
    expect(stored?.status).toBe('completed');
  });

  it('refuses to regenerate a message from another user or the wrong conversation', async () => {
    const { authService } = await import('../services/authService');
    const { user: other } = await authService.signup('Other Two', `other2-${Date.now()}@example.com`, 'password123');

    const sent = await chatService.sendMessage({ userId, message: 'secret', model: 'mock-model' });

    await expect(
      chatService.regenerateResponse(other.id, sent.conversationId, sent.assistantMessageId)
    ).rejects.toThrow();
  });

  it('enforces the per-user concurrent generation limit', async () => {
    // A script whose stream never completes until aborted keeps the slot busy.
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const blockingProvider: AIProvider = {
      ...mock,
      name: 'blocking',
      stream: async (_request, _onChunk, signal) => {
        await gate;
        if (signal?.aborted) return { status: 'aborted', content: '' };
        return { status: 'completed', content: '' };
      },
    };
    setAIProvider(blockingProvider);

    const firstPromise = chatService.sendMessage({ userId, message: 'long running', model: 'mock-model' });

    await expect(
      chatService.sendMessage({ userId, message: 'second concurrent', model: 'mock-model' })
    ).rejects.toThrow('generation in progress');

    release();
    await firstPromise;
  });

  it('estimates token counts and generation time metadata', async () => {
    mock.queue(['abcd'.repeat(25)], { status: 'completed', content: '' });
    const result = await chatService.sendMessage({ userId, message: 'count me', model: 'mock-model' });
    const stored = await messageRepository.findById(result.assistantMessageId);
    expect(stored?.tokenCount).toBeGreaterThan(0);
    expect(stored?.generationTimeMs).toBeGreaterThanOrEqual(0);
  });
});

describe('provider factory', () => {
  it('falls back to the ollama provider by default', async () => {
    resetAIProvider();
    const { getAIProvider: get } = await import('../providers');
    expect(get().name).toBe('ollama');
    expect(getAIProvider).toBeDefined();
  });
});
