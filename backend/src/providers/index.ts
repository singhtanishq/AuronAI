import { AIProvider, ProviderError } from './aiProvider';

let providerInstance: AIProvider | null = null;
let providerFactory: () => AIProvider = createDefaultProvider;

function createDefaultProvider(): AIProvider {
  // Lazy require avoids a static dependency cycle at module load.
  const { OllamaProvider } = require('./ollamaProvider') as typeof import('./ollamaProvider');
  return new OllamaProvider();
}

export function getAIProvider(): AIProvider {
  if (!providerInstance) {
    providerInstance = providerFactory();
  }
  return providerInstance;
}

/** Test seam: substitute a provider implementation (e.g. a mock Ollama). */
export function setAIProvider(provider: AIProvider): void {
  providerInstance = provider;
}

export function setProviderFactory(factory: () => AIProvider): void {
  providerFactory = factory;
  providerInstance = null;
}

export function resetAIProvider(): void {
  providerInstance = null;
}
