import type {
  User,
  Conversation,
  ConversationWithMeta,
  Message,
  ChatRequest,
  StreamEvent,
  ModelInfo,
  ProviderHealth,
  HealthStatus,
  UserPreferences,
  SessionInfo,
  PaginatedResponse,
  SearchResult,
  ApiErrorShape,
} from '../types';
import { SseParser } from '../utils/sse';

const API_BASE = '/api';

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Invoked when the server rejects the session (401). The auth context
 * registers a handler so stale client state clears itself exactly once.
 */
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (response.status === 401 && onUnauthorized) {
    onUnauthorized();
  }

  const contentType = response.headers.get('content-type');
  const isJson = contentType?.includes('application/json');

  if (!response.ok) {
    let errorData: ApiErrorShape | null = null;
    if (isJson) {
      try {
        errorData = await response.json();
      } catch {
        errorData = null;
      }
    }
    throw new ApiError(
      errorData?.code || 'API_ERROR',
      errorData?.message || `Request failed with status ${response.status}`,
      response.status,
      errorData?.details
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }
  if (isJson) {
    return response.json();
  }
  return response.text() as T;
}

async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  // Authentication rides on the HttpOnly session cookie — no bearer tokens,
  // nothing session-related in localStorage.
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: 'include',
  });
  return handleResponse<T>(response);
}

function jsonInit(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  };
}

/**
 * Shared SSE reader for the streaming endpoints. Resolves when the stream
 * closes; every complete event is forwarded to `onEvent` in order.
 */
async function streamSse(
  endpoint: string,
  body: unknown,
  onEvent: (event: StreamEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'include',
    signal,
  });

  if (!response.ok) {
    if (response.status === 401 && onUnauthorized) onUnauthorized();
    let errorData: ApiErrorShape | null = null;
    try {
      errorData = await response.json();
    } catch {
      errorData = null;
    }
    throw new ApiError(
      errorData?.code || 'STREAM_ERROR',
      errorData?.message || `Chat failed with status ${response.status}`,
      response.status,
      errorData?.details
    );
  }

  if (!response.body) {
    throw new ApiError('STREAM_ERROR', 'The server returned an empty stream', 502);
  }

  const reader = response.body.getReader();
  const parser = new SseParser();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const event of parser.push(decoder.decode(value, { stream: true }))) {
        onEvent(event);
      }
    }
    for (const event of parser.flush()) {
      onEvent(event);
    }
  } finally {
    reader.releaseLock();
  }
}

export const api = {
  auth: {
    signup: (data: { name: string; email: string; password: string; confirmPassword: string }) =>
      fetchApi<{ user: User }>('/auth/signup', jsonInit('POST', data)),

    login: (data: { email: string; password: string }) =>
      fetchApi<{ user: User }>('/auth/login', jsonInit('POST', data)),

    logout: () => fetchApi<{ message: string }>('/auth/logout', { method: 'POST' }),

    logoutAll: () => fetchApi<{ message: string }>('/auth/logout-all', { method: 'POST' }),

    me: () => fetchApi<{ user: User }>('/auth/me'),

    changePassword: (data: { currentPassword: string; newPassword: string; confirmPassword: string }) =>
      fetchApi<{ message: string }>('/auth/change-password', jsonInit('POST', data)),

    updateProfile: (data: { name?: string; email?: string }) =>
      fetchApi<{ user: User }>('/auth/profile', jsonInit('PATCH', data)),

    deleteAccount: (password: string) =>
      fetchApi<{ message: string }>('/auth/account', jsonInit('DELETE', { password })),

    listSessions: () => fetchApi<{ sessions: SessionInfo[] }>('/auth/sessions'),

    revokeSession: (id: string) =>
      fetchApi<{ message: string }>(`/auth/sessions/${id}`, { method: 'DELETE' }),
  },

  conversations: {
    list: (params?: { page?: number; pageSize?: number; includeArchived?: boolean }) => {
      const searchParams = new URLSearchParams();
      if (params?.page && params.page > 1) searchParams.set('page', String(params.page));
      if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize));
      if (params?.includeArchived) searchParams.set('includeArchived', 'true');
      const query = searchParams.toString();
      return fetchApi<PaginatedResponse<ConversationWithMeta>>(
        `/conversations${query ? `?${query}` : ''}`
      );
    },

    search: (query: string, limit = 20) =>
      fetchApi<SearchResult>(`/conversations/search?q=${encodeURIComponent(query)}&limit=${limit}`),

    pinned: () => fetchApi<{ data: ConversationWithMeta[] }>('/conversations/pinned'),

    create: (title?: string) =>
      fetchApi<{ conversation: Conversation }>('/conversations', jsonInit('POST', { title })),

    get: (id: string) =>
      fetchApi<{ conversation: Conversation; messages: Message[] }>(`/conversations/${id}`),

    update: (id: string, data: { title?: string; pinned?: boolean; archived?: boolean }) =>
      fetchApi<{ conversation: Conversation }>(`/conversations/${id}`, jsonInit('PATCH', data)),

    delete: (id: string) =>
      fetchApi<{ message: string }>(`/conversations/${id}`, { method: 'DELETE' }),

    deleteAll: () =>
      fetchApi<{ message: string; count: number }>('/conversations', jsonInit('DELETE', { confirm: 'DELETE ALL' })),
  },

  ai: {
    chat: (
      data: ChatRequest,
      onEvent: (event: StreamEvent) => void,
      signal?: AbortSignal
    ) => streamSse('/ai/chat', data, onEvent, signal),

    regenerate: (
      conversationId: string,
      assistantMessageId: string,
      onEvent: (event: StreamEvent) => void,
      signal?: AbortSignal
    ) => streamSse('/ai/regenerate', { conversationId, assistantMessageId }, onEvent, signal),

    abort: (conversationId: string, assistantMessageId: string) =>
      fetchApi<{ aborted: boolean }>('/ai/abort', jsonInit('POST', { conversationId, assistantMessageId })),

    models: () => fetchApi<{ models: ModelInfo[] }>('/ai/models'),

    health: () => fetchApi<{ ai: ProviderHealth }>('/ai/health'),
  },

  settings: {
    get: () => fetchApi<{ preferences: UserPreferences }>('/settings'),
    update: (data: Partial<UserPreferences>) =>
      fetchApi<{ preferences: UserPreferences }>('/settings', jsonInit('PATCH', data)),
  },

  health: {
    check: () => fetchApi<HealthStatus>('/health'),
  },
};
