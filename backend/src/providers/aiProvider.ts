import { ChatRequest, ModelInfo, ProviderHealth, StreamChunk, StreamResult } from '../types';

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly upstreamStatus?: number
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export interface AIProvider {
  name: string;
  generate(request: ChatRequest): Promise<string>;
  stream(
    request: ChatRequest,
    onChunk: (chunk: StreamChunk) => void,
    signal?: AbortSignal
  ): Promise<StreamResult>;
  listModels(): Promise<ModelInfo[]>;
  healthCheck(): Promise<ProviderHealth>;
}
