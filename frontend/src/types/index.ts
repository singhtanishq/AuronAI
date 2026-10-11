export interface User {
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

export interface ConversationWithMeta extends Conversation {
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

export interface ChatRequest {
  conversationId?: string;
  message: string;
  model?: string;
  temperature?: number;
  systemPrompt?: string;
}

/**
 * Server-sent events emitted by /api/ai/chat and /api/ai/regenerate.
 * One generation produces exactly one assistant message; `delta` events
 * append to it, `start` establishes the real record ids.
 */
export type StreamEvent =
  | { type: 'start'; conversationId: string; userMessageId: string; assistantMessageId: string }
  | { type: 'delta'; assistantMessageId: string; content: string }
  | { type: 'title'; conversationId: string; title: string }
  | { type: 'done'; conversationId: string; userMessageId?: string; assistantMessageId: string }
  | { type: 'aborted'; conversationId: string; assistantMessageId: string }
  | { type: 'error'; assistantMessageId?: string; message: string };

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

export interface ProviderHealth {
  reachable: boolean;
  models: number;
  defaultModel?: string;
  error?: string;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    database: boolean;
    ollama: boolean;
  };
  ollama?: {
    reachable: boolean;
    models: number;
    defaultModel?: string;
    error?: string;
  };
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  sidebarCollapsed: boolean;
  enterToSend: boolean;
  showTimestamps: boolean;
  autoScroll: boolean;
  model: string;
  temperature: number;
  systemPrompt: string;
}

export interface SessionInfo {
  id: string;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface SearchResult {
  conversations: ConversationWithMeta[];
  total: number;
  query: string;
}

export interface ApiErrorShape {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  statusCode: number;
}
