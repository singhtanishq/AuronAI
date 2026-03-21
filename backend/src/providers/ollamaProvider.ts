import { config } from '../config';
import { ModelInfo, ChatRequest, StreamChunk, OllamaModel } from '../types';
import { AIProvider, BaseAIProvider } from './aiProvider';
import { logger } from '../utils/logger';

export class OllamaProvider extends BaseAIProvider {
  name = 'ollama';
  private baseUrl: string;
  private defaultModel: string;
  private timeout: number;
  private abortController: AbortController | null = null;

  constructor() {
    super();
    this.baseUrl = config.ollama.baseUrl.replace(/\/$/, '');
    this.defaultModel = config.ollama.defaultModel;
    this.timeout = config.ollama.timeout;
  }

  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
    };
  }

  private async fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
    this.abortController = new AbortController();
    const timeoutId = setTimeout(() => this.abortController?.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: this.abortController.signal,
        headers: {
          ...this.getHeaders(),
          ...options.headers,
        },
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async generate(request: ChatRequest): Promise<string> {
    this.resetAbort();
    const model = request.model || this.defaultModel;

    const messages = [
      ...(request.systemPrompt ? [{ role: 'system' as const, content: request.systemPrompt }] : []),
      { role: 'user' as const, content: request.message },
    ];

    const response = await this.fetchWithTimeout(
      `${this.baseUrl}/api/chat`,
      {
        method: 'POST',
        body: JSON.stringify({
          model,
          messages,
          stream: false,
          options: {
            temperature: request.temperature ?? 0.7,
          },
        }),
      },
      this.timeout
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama generate failed: ${response.status} ${error}`);
    }

    const data = await response.json() as { message: { content: string } };
    return data.message.content;
  }

  async stream(request: ChatRequest, onChunk: (chunk: StreamChunk) => void): Promise<void> {
    this.resetAbort();
    const model = request.model || this.defaultModel;
    const conversationId = request.conversationId;
    let messageId: string | undefined;

    const messages = [
      ...(request.systemPrompt ? [{ role: 'system' as const, content: request.systemPrompt }] : []),
      { role: 'user' as const, content: request.message },
    ];

    const response = await this.fetchWithTimeout(
      `${this.baseUrl}/api/chat`,
      {
        method: 'POST',
        body: JSON.stringify({
          model,
          messages,
          stream: true,
          options: {
            temperature: request.temperature ?? 0.7,
          },
        }),
      },
      this.timeout
    );

    if (!response.ok) {
      const error = await response.text();
      onChunk({ type: 'error', error: `Ollama stream failed: ${response.status} ${error}`, conversationId });
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      onChunk({ type: 'error', error: 'No response body', conversationId });
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let firstChunk = true;

    try {
      while (!this.isAborted()) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const data = JSON.parse(line) as {
              message?: { content: string };
              done?: boolean;
              error?: string;
            };

            if (data.error) {
              onChunk({ type: 'error', error: data.error, conversationId });
              return;
            }

            if (data.message?.content) {
              if (firstChunk) {
                messageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
                onChunk({
                  type: 'content',
                  content: data.message.content,
                  messageId,
                  conversationId,
                });
                firstChunk = false;
              } else {
                onChunk({
                  type: 'content',
                  content: data.message.content,
                  messageId,
                  conversationId,
                });
              }
            }

            if (data.done) {
              onChunk({
                type: 'done',
                messageId,
                conversationId,
              });
              return;
            }
          } catch (parseError) {
            logger.warn('Failed to parse Ollama stream chunk', { line, error: parseError });
          }
        }
      }
    } catch (error) {
      if (this.isAborted()) {
        onChunk({ type: 'error', error: 'Generation aborted', conversationId, messageId });
      } else {
        logger.error('Ollama stream error', error);
        onChunk({ type: 'error', error: error instanceof Error ? error.message : 'Stream error', conversationId, messageId });
      }
    } finally {
      reader.releaseLock();
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const response = await this.fetchWithTimeout(
        `${this.baseUrl}/api/tags`,
        { method: 'GET' },
        10000
      );

      if (!response.ok) {
        throw new Error(`Failed to list models: ${response.status}`);
      }

      const data = await response.json() as { models: OllamaModel[] };
      return data.models.map((m) => ({
        name: m.name,
        modifiedAt: m.modified_at,
        size: m.size,
        digest: m.digest,
        details: m.details ? {
          parentModel: m.details.parent_model,
          format: m.details.format,
          family: m.details.family,
          families: m.details.families,
          parameterSize: m.details.parameter_size,
          quantizationLevel: m.details.quantization_level,
        } : undefined,
      }));
    } catch (error) {
      logger.error('Failed to list Ollama models', error as Record<string, unknown>);
      return [];
    }
  }

  async healthCheck(): Promise<{ reachable: boolean; models: number; error?: string }> {
    try {
      const response = await this.fetchWithTimeout(
        `${this.baseUrl}/api/tags`,
        { method: 'GET' },
        5000
      );

      if (!response.ok) {
        return { reachable: false, models: 0, error: `HTTP ${response.status}` };
      }

      const data = await response.json() as { models: OllamaModel[] };
      return {
        reachable: true,
        models: data.models?.length || 0,
        defaultModel: this.defaultModel,
      };
    } catch (error) {
      return {
        reachable: false,
        models: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  abort(): void {
    super.abort();
    this.abortController?.abort();
  }
}

export function createOllamaProvider(): OllamaProvider {
  return new OllamaProvider();
}