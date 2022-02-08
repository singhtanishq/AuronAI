import { AIProvider } from './aiProvider';
import { OllamaProvider } from './ollamaProvider';

let providerInstance: AIProvider | null = null;
let providerFactory: () => AIProvider = () => new OllamaProvider();

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
