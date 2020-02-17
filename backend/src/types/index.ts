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

export interface ChatRequest {
  conversationId?: string;
  message: string;
  model?: string;
  temperature?: number;
  systemPrompt?: string;
}

export interface ChatResponse {
  conversationId: string;
  messageId: string;
  content: string;
  done: boolean;
}

export interface StreamChunk {
  type: 'content' | 'done' | 'error';
  content?: string;
  messageId?: string;
  conversationId?: string;
  error?: string;
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
  };
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

export interface JwtPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}