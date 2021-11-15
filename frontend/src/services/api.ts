import type { User, Conversation, ConversationWithMeta, Message, ChatRequest, StreamChunk, ModelInfo, HealthStatus, UserPreferences, PaginatedResponse, SearchResult } from '../types';

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

function getStoredToken(): string | null {
  try {
    const authData = localStorage.getItem('auron-auth');
    if (authData) {
      const parsed = JSON.parse(authData);
      return parsed.token || null;
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

async function handleResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type');
  const isJson = contentType?.includes('application/json');

  if (!response.ok) {
    let errorData: ApiError | null = null;
    if (isJson) {
      errorData = await response.json();
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

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getStoredToken();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers as Record<string, string>,
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  return handleResponse<T>(response);
}

export const api = {
  // Auth
  auth: {
    signup: (data: { name: string; email: string; password: string; confirmPassword: string }) =>
      fetchApi<{ user: User; token: string }>('/auth/signup', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    login: (data: { email: string; password: string }) =>
      fetchApi<{ user: User; token: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    logout: () =>
      fetchApi<{ message: string }>('/auth/logout', { method: 'POST' }),

    logoutAll: () =>
      fetchApi<{ message: string }>('/auth/logout-all', { method: 'POST' }),

    me: () =>
      fetchApi<{ user: User }>('/auth/me'),

    changePassword: (data: { currentPassword: string; newPassword: string; confirmPassword: string }) =>
      fetchApi<{ message: string }>('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    updateProfile: (data: { name?: string; email?: string }) =>
      fetchApi<{ user: User }>('/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    deleteAccount: (password: string) =>
      fetchApi<{ message: string }>('/auth/account', {
        method: 'DELETE',
        body: JSON.stringify({ password }),
      }),
  },

  // Conversations
  conversations: {
    list: (params?: { page?: number; pageSize?: number; includeArchived?: boolean }) => {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', String(params.page));
      if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize));
      if (params?.includeArchived) searchParams.set('includeArchived', 'true');
      const query = searchParams.toString();
      return fetchApi<PaginatedResponse<ConversationWithMeta>>(`/conversations${query ? `?${query}` : ''}`);
    },

    search: (query: string, limit = 20) =>
      fetchApi<SearchResult>(`/conversations/search?q=${encodeURIComponent(query)}&limit=${limit}`),

    pinned: () =>
      fetchApi<{ data: ConversationWithMeta[] }>('/conversations/pinned'),

    create: (title?: string) =>
      fetchApi<{ conversation: Conversation }>('/conversations', {
        method: 'POST',
        body: JSON.stringify({ title }),
      }),

    get: (id: string) =>
      fetchApi<{ conversation: Conversation; messages: Message[] }>(`/conversations/${id}`),

    update: (id: string, data: { title?: string; pinned?: boolean; archived?: boolean }) =>
      fetchApi<{ conversation: Conversation }>(`/conversations/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    delete: (id: string) =>
      fetchApi<{ message: string }>(`/conversations/${id}`, { method: 'DELETE' }),

    deleteAll: () =>
      fetchApi<{ message: string; count: number }>('/conversations', {
        method: 'DELETE',
        body: JSON.stringify({ confirm: 'DELETE ALL' }),
      }),
  },

  // AI/Chat
  ai: {
    chat: (data: ChatRequest, onChunk: (chunk: StreamChunk) => void, signal?: AbortSignal) => {
      const token = getStoredToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      return fetch(`${API_BASE}/ai/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
        credentials: 'include',
        signal,
      }).then(async (response) => {
        if (!response.ok) {
          const error = await response.json();
          throw new ApiError(error.code || 'CHAT_ERROR', error.message || 'Chat failed', response.status);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim()) continue;
            if (line.startsWith('data: ')) {
              try {
                const chunk = JSON.parse(line.slice(6)) as StreamChunk;
                onChunk(chunk);
              } catch (e) {
                console.warn('Failed to parse SSE chunk:', line);
              }
            }
          }
        }
      });
    },

    regenerate: (conversationId: string, assistantMessageId: string, onChunk: (chunk: StreamChunk) => void, signal?: AbortSignal) => {
      const token = getStoredToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      return fetch(`${API_BASE}/ai/regenerate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ conversationId, assistantMessageId }),
        credentials: 'include',
        signal,
      }).then(async (response) => {
        if (!response.ok) {
          const error = await response.json();
          throw new ApiError(error.code || 'REGENERATE_ERROR', error.message || 'Regeneration failed', response.status);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim()) continue;
            if (line.startsWith('data: ')) {
              try {
                const chunk = JSON.parse(line.slice(6)) as StreamChunk;
                onChunk(chunk);
              } catch (e) {
                console.warn('Failed to parse SSE chunk:', line);
              }
            }
          }
        }
      });
    },

    abort: (conversationId: string, assistantMessageId: string) =>
      fetchApi<{ message: string }>('/ai/abort', {
        method: 'POST',
        body: JSON.stringify({ conversationId, assistantMessageId }),
      }),

    models: () =>
      fetchApi<{ models: ModelInfo[] }>('/ai/models'),

    health: () =>
      fetchApi<{ reachable: boolean; models: number; defaultModel?: string; error?: string }>('/ai/health', {
      cache: 'no-store',
  }),

  // Settings
  settings: {
    get: () =>
      fetchApi<{ preferences: UserPreferences }>('/settings'),

    update: (data: Partial<UserPreferences>) =>
      fetchApi<{ preferences: UserPreferences }>('/settings', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    setTheme: (theme: 'light' | 'dark' | 'system') =>
      fetchApi<{ preferences: UserPreferences }>('/settings/theme', {
        method: 'PATCH',
        body: JSON.stringify({ theme }),
      }),

    setSidebarCollapsed: (collapsed: boolean) =>
      fetchApi<{ preferences: UserPreferences }>('/settings/sidebar', {
        method: 'PATCH',
        body: JSON.stringify({ collapsed }),
      }),

    setModel: (model: string) =>
      fetchApi<{ preferences: UserPreferences }>('/settings/model', {
        method: 'PATCH',
        body: JSON.stringify({ model }),
      }),

    setTemperature: (temperature: number) =>
      fetchApi<{ preferences: UserPreferences }>('/settings/temperature', {
        method: 'PATCH',
        body: JSON.stringify({ temperature }),
      }),

    setSystemPrompt: (systemPrompt: string) =>
      fetchApi<{ preferences: UserPreferences }>('/settings/system-prompt', {
        method: 'PATCH',
        body: JSON.stringify({ systemPrompt }),
      }),
  },

  // Health
  health: {
    check: () =>
      fetchApi<HealthStatus>('/health'),

    aiHealth: () =>
      fetchApi<{ reachable: boolean; models: number; defaultModel?: string; error?: string }>('/health/ai'),

    models: () =>
      fetchApi<{ models: ModelInfo[] }>('/health/models'),
  },
};

// Re-export types for convenience
export type { User, Conversation, ConversationWithMeta, Message, ChatRequest, StreamChunk, ModelInfo, HealthStatus, UserPreferences, PaginatedResponse, SearchResult };