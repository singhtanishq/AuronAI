import { config } from '../config';
import { ChatRequest, ModelInfo, OllamaModel, ProviderHealth, StreamChunk, StreamResult } from '../types';
import { AIProvider, ProviderError } from './aiProvider';
import { logger } from '../utils/logger';

interface OllamaChatChunk {
  message?: { content: string };
  done?: boolean;
  error?: string;
}

/**
 * Ollama AI provider.
 *
 * Every stream owns its own AbortController, wired to the caller-provided
 * signal, so concurrent generations never clobber each other's abort state.
 */
export class OllamaProvider implements AIProvider {
  name = 'ollama';
  private readonly baseUrl: string;
  private readonly defaultModel: string;
  private readonly overallTimeoutMs: number;
  private readonly idleTimeoutMs: number;

  constructor() {
    this.baseUrl = config.ollama.baseUrl;
    this.defaultModel = config.ollama.defaultModel;
    this.overallTimeoutMs = config.ollama.timeoutMs;
    this.idleTimeoutMs = config.ollama.idleTimeoutMs;
  }

  private buildMessages(request: ChatRequest): Array<{ role: string; content: string }> {
    const messages: Array<{ role: string; content: string }> = [];
    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }
    for (const entry of request.history ?? []) {
      messages.push({ role: entry.role, content: entry.content });
    }
    messages.push({ role: 'user', content: request.message });
    return messages;
  }

  private async request(pathname: string, init: RequestInit, timeoutMs: number): Promise<Response> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${pathname}`, {
        ...init,
        signal: init.signal ?? AbortSignal.timeout(timeoutMs),
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      if ((error as Error).name === 'TimeoutError' || (error as Error).name === 'AbortError') {
        throw new ProviderError('Could not reach Ollama in time. Make sure Ollama is running.');
      }
      throw new ProviderError(
        'Unable to connect to Ollama. Make sure Ollama is installed and running (`ollama serve`).'
      );
    }

    if (!response.ok) {
      let detail = '';
      try {
        const body = await response.text();
        try {
          const parsed = JSON.parse(body) as { error?: string };
          detail = parsed.error || body.slice(0, 300);
        } catch {
          detail = body.slice(0, 300);
        }
      } catch {
        // ignore body read failures
      }
      throw new ProviderError(
        `Ollama request failed (${response.status})${detail ? `: ${detail}` : ''}`,
        response.status
      );
    }

    return response;
  }

  async generate(request: ChatRequest): Promise<string> {
    const response = await this.request(
      '/api/chat',
      {
        method: 'POST',
        body: JSON.stringify({
          model: request.model || this.defaultModel,
          messages: this.buildMessages(request),
          stream: false,
          options: { temperature: request.temperature ?? 0.7 },
        }),
      },
      this.overallTimeoutMs
    );

    const data = (await response.json()) as { message?: { content: string }; error?: string };
    if (data.error) {
      throw new ProviderError(`Ollama error: ${data.error}`);
    }
    return data.message?.content ?? '';
  }

  async stream(
    request: ChatRequest,
    onChunk: (chunk: StreamChunk) => void,
    signal?: AbortSignal
  ): Promise<StreamResult> {
    const model = request.model || this.defaultModel;
    const controller = new AbortController();

    let abortedByCaller = false;
    let timedOut = false;

    const onExternalAbort = () => {
      abortedByCaller = true;
      controller.abort();
    };
    if (signal) {
      if (signal.aborted) {
        return { status: 'aborted', content: '' };
      }
      signal.addEventListener('abort', onExternalAbort, { once: true });
    }

    const overallTimer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.overallTimeoutMs);

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: this.buildMessages(request),
          stream: true,
          options: { temperature: request.temperature ?? 0.7 },
        }),
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(overallTimer);
      signal?.removeEventListener('abort', onExternalAbort);
      if (abortedByCaller) return { status: 'aborted', content: '' };
      if (timedOut) {
        return { status: 'error', content: '', error: 'Ollama did not start responding in time.' };
      }
      return {
        status: 'error',
        content: '',
        error: 'Unable to connect to Ollama. Make sure Ollama is installed and running (`ollama serve`).',
      };
    }

    if (!response.ok || !response.body) {
      clearTimeout(overallTimer);
      signal?.removeEventListener('abort', onExternalAbort);
      let detail = '';
      try {
        const body = await response.text();
        try {
          const parsed = JSON.parse(body) as { error?: string };
          detail = parsed.error || body.slice(0, 300);
        } catch {
          detail = body.slice(0, 300);
        }
      } catch {
        // ignore
      }
      return {
        status: 'error',
        content: '',
        error: `Ollama request failed (${response.status})${detail ? `: ${detail}` : ''}`,
      };
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let content = '';
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    void this.idleTimeoutMs;

    const armIdleTimer = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, this.idleTimeoutMs);
    };

    try {
      armIdleTimer();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        armIdleTimer();

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          let data: OllamaChatChunk;
          try {
            data = JSON.parse(trimmed) as OllamaChatChunk;
          } catch {
            logger.warn('Skipping malformed Ollama stream chunk');
            continue;
          }

          if (data.error) {
            return { status: 'error', content, error: `Ollama error: ${data.error}` };
          }

          if (data.message?.content) {
            content += data.message.content;
            onChunk({ type: 'content', content: data.message.content });
          }

          if (data.done) {
            return { status: 'completed', content };
          }
        }
      }

      // Stream ended without an explicit done flag — treat whatever arrived
      // as complete; Ollama normally sends done:true on the final line.
      if (buffer.trim()) {
        try {
          const data = JSON.parse(buffer.trim()) as OllamaChatChunk;
          if (data.message?.content) {
            content += data.message.content;
            onChunk({ type: 'content', content: data.message.content });
          }
        } catch {
          // ignore trailing partial data
        }
      }
      return { status: 'completed', content };
    } catch (error) {
      if (abortedByCaller) {
        return { status: 'aborted', content };
      }
      if (timedOut) {
        return { status: 'error', content, error: 'Generation timed out.' };
      }
      logger.error('Ollama stream error', error as Record<string, unknown>);
      return { status: 'error', content, error: 'The response stream failed unexpectedly.' };
    } finally {
      if (idleTimer) clearTimeout(idleTimer);
      clearTimeout(overallTimer);
      signal?.removeEventListener('abort', onExternalAbort);
      try {
        await reader.cancel();
      } catch {
        // reader may already be closed
      }
      reader.releaseLock();
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const response = await this.request('/api/tags', { method: 'GET' }, 10000);
      const data = (await response.json()) as { models?: OllamaModel[] };
      return (data.models ?? []).map((m) => ({
        name: m.name,
        modifiedAt: m.modified_at,
        size: m.size,
        digest: m.digest,
        details: m.details
          ? {
              parentModel: m.details.parent_model,
              format: m.details.format,
              family: m.details.family,
              families: m.details.families,
              parameterSize: m.details.parameter_size,
              quantizationLevel: m.details.quantization_level,
            }
          : undefined,
      }));
    } catch (error) {
      logger.warn('Failed to list Ollama models', { error: (error as Error).message });
      return [];
    }
  }

  async healthCheck(): Promise<ProviderHealth> {
    try {
      const response = await this.request('/api/tags', { method: 'GET' }, 5000);
      const data = (await response.json()) as { models?: OllamaModel[] };
      return {
        reachable: true,
        models: data.models?.length || 0,
        defaultModel: this.defaultModel,
      };
    } catch (error) {
      return {
        reachable: false,
        models: 0,
        defaultModel: this.defaultModel,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
