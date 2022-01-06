export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  avatarColor?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserPublic {
  id: string;
  name: string;
  email: string;
  avatarColor?: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  pinned: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationWithMessageCount extends Conversation {
  messageCount: number;
  lastMessageAt?: string;
  lastMessagePreview?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model?: string;
  status: 'pending' | 'streaming' | 'completed' | 'error' | 'aborted';
  tokenCount?: number;
  generationTimeMs?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ContextMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatRequest {
  /** The current user message. Never truncated. */
  message: string;
  /** Prior conversation turns, oldest first, already budgeted by the caller. */
  history?: ContextMessage[];
  model?: string;
  temperature?: number;
  systemPrompt?: string;
}

/**
 * Terminal outcome of a provider stream. The provider must resolve with one of
 * these states; an upstream failure must never look like a successful stream.
 */
export interface StreamResult {
  status: 'completed' | 'aborted' | 'error';
  content: string;
  error?: string;
}

export interface StreamChunk {
  type: 'content';
  content: string;
}

export interface ModelInfo {
  name: string;
  modifiedAt: string;
  size: number;
  digest: string;
  details?: {
    parentModel?: string;
    format?: string;
    family?: string;
    families?: string[];
    parameterSize?: string;
    quantizationLevel?: string;
  };
}

export interface OllamaModel {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details?: {
    parent_model?: string;
    format?: string;
    family?: string;
    families?: string[];
    parameter_size?: string;
    quantization_level?: string;
  };
}

export interface ProviderHealth {
  reachable: boolean;
  models: number;
  defaultModel?: string;
  error?: string;
}

export interface SessionInfo {
  id: string;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  statusCode: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface SearchResult {
  conversations: ConversationWithMessageCount[];
  total: number;
  query: string;
}

export type Theme = 'light' | 'dark' | 'system';

export interface UserPreferences {
  theme: Theme;
  sidebarCollapsed: boolean;
  enterToSend: boolean;
  showTimestamps: boolean;
  autoScroll: boolean;
  model: string;
  temperature: number;
  systemPrompt: string;
}
