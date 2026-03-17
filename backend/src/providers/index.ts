import { AIProvider } from './aiProvider';
import { OllamaProvider, createOllamaProvider } from './ollamaProvider';
import { config } from '../config';
import { logger } from '../utils/logger';

let providerInstance: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (!providerInstance) {
    providerInstance = createProvider();
  }
  return providerInstance;
}

function createProvider(): AIProvider {
  // Currently only Ollama is supported, but architecture allows for more providers
  logger.info('Creating Ollama AI provider');
  return createOllamaProvider();
}

export function resetAIProvider(): void {
  if (providerInstance) {
    providerInstance.abort();
    providerInstance = null;
  }
}

export function setAIProvider(provider: AIProvider): void {
  if (providerInstance) {
    providerInstance.abort();
  }
  providerInstance = provider;
}