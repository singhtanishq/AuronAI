import { ModelInfo, ChatRequest, StreamChunk } from '../types';

export interface AIProvider {
  name: string;
  generate(request: ChatRequest): Promise<string>;
  stream(request: ChatRequest, onChunk: (chunk: StreamChunk) => void): Promise<void>;
  listModels(): Promise<ModelInfo[]>;
  healthCheck(): Promise<{ reachable: boolean; models: number; defaultModel?: string; error?: string }>;
  abort(): void;
}

export abstract class BaseAIProvider implements AIProvider {
  abstract name: string;
  protected aborted = false;

  abstract generate(request: ChatRequest): Promise<string>;
  abstract stream(request: ChatRequest, onChunk: (chunk: StreamChunk) => void): Promise<void>;
  abstract listModels(): Promise<ModelInfo[]>;
  abstract healthCheck(): Promise<{ reachable: boolean; models: number; error?: string }>;

  abort(): void {
    this.aborted = true;
  }

  protected resetAbort(): void {
    this.aborted = false;
  }

  protected isAborted(): boolean {
    return this.aborted;
  }
}