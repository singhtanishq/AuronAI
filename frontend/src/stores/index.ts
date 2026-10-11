import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User, Conversation, ConversationWithMeta, Message, UserPreferences, ModelInfo } from '../types';

/* ============================== Auth ============================== */

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (user: User) => void;
  clearAuth: () => void;
  setLoading: (loading: boolean) => void;
  updateUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      setAuth: (user) => set({ user, isAuthenticated: true, isLoading: false }),
      clearAuth: () => set({ user: null, isAuthenticated: false, isLoading: false }),
      setLoading: (isLoading) => set({ isLoading }),
      updateUser: (user) => set({ user }),
    }),
    {
      name: 'auron-auth',
      storage: createJSONStorage(() => localStorage),
      // Only the display profile is cached. Session credentials live
      // exclusively in the HttpOnly cookie.
      partialize: (state) => ({ user: state.user }),
    }
  )
);

/* =========================== Conversations =========================== */

interface ConversationState {
  conversations: ConversationWithMeta[];
  activeConversation: Conversation | null;
  activeConversationId: string | null;
  messages: Message[];
  isLoading: boolean;
  isLoadingConversation: boolean;
  searchQuery: string;
  searchResults: ConversationWithMeta[] | null;
  isSearching: boolean;
  setConversations: (conversations: ConversationWithMeta[]) => void;
  addConversation: (conversation: ConversationWithMeta) => void;
  updateConversation: (id: string, updates: Partial<ConversationWithMeta>) => void;
  removeConversation: (id: string) => void;
  setActiveConversation: (conversation: Conversation | null, messages: Message[]) => void;
  setActiveConversationId: (id: string | null) => void;
  addMessage: (message: Message) => void;
  updateMessage: (id: string, updates: Partial<Message>) => void;
  removeMessage: (id: string) => void;
  setMessages: (messages: Message[]) => void;
  setLoading: (loading: boolean) => void;
  setLoadingConversation: (loading: boolean) => void;
  setSearchQuery: (query: string) => void;
  setSearchResults: (results: ConversationWithMeta[] | null) => void;
  setSearching: (searching: boolean) => void;
  clearActiveConversation: () => void;
}

export const useConversationStore = create<ConversationState>((set) => ({
  conversations: [],
  activeConversation: null,
  activeConversationId: null,
  messages: [],
  isLoading: false,
  isLoadingConversation: false,
  searchQuery: '',
  searchResults: null,
  isSearching: false,
  setConversations: (conversations) => set({ conversations }),
  addConversation: (conversation) => set((state) => ({
    conversations: [conversation, ...state.conversations.filter((c) => c.id !== conversation.id)],
  })),
  updateConversation: (id, updates) => set((state) => ({
    conversations: state.conversations.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    activeConversation:
      state.activeConversation?.id === id ? { ...state.activeConversation, ...updates } : state.activeConversation,
  })),
  removeConversation: (id) => set((state) => ({
    conversations: state.conversations.filter((c) => c.id !== id),
    activeConversation: state.activeConversation?.id === id ? null : state.activeConversation,
    activeConversationId: state.activeConversationId === id ? null : state.activeConversationId,
  })),
  setActiveConversation: (conversation, messages) => set({
    activeConversation: conversation,
    activeConversationId: conversation?.id || null,
    messages: messages || [],
  }),
  setActiveConversationId: (id) => set({ activeConversationId: id }),
  addMessage: (message) => set((state) => ({
    messages: [...state.messages, message],
  })),
  updateMessage: (id, updates) => set((state) => ({
    messages: state.messages.map((m) => (m.id === id ? { ...m, ...updates } : m)),
  })),
  removeMessage: (id) => set((state) => ({
    messages: state.messages.filter((m) => m.id !== id),
  })),
  setMessages: (messages) => set({ messages }),
  setLoading: (isLoading) => set({ isLoading }),
  setLoadingConversation: (isLoadingConversation) => set({ isLoadingConversation }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSearchResults: (searchResults) => set({ searchResults }),
  setSearching: (isSearching) => set({ isSearching }),
  clearActiveConversation: () => set({
    activeConversation: null,
    activeConversationId: null,
    messages: [],
  }),
}));

/* ============================== Chat ============================== */

export interface GenerationState {
  conversationId: string;
  /** Set once the server confirms the real assistant record id ('start'). */
  assistantMessageId: string | null;
  controller: AbortController;
}

interface ChatState {
  generations: Record<string, GenerationState>;
  /** Live content of in-flight assistant messages, keyed by message id, so a
   * conversation switch and return can restore the streamed text. */
  streamingContent: Record<string, { conversationId: string; content: string }>;
  beginGeneration: (conversationId: string, controller: AbortController) => void;
  attachAssistantMessage: (conversationId: string, messageId: string) => void;
  appendStreamContent: (messageId: string, conversationId: string, delta: string) => void;
  endGeneration: (conversationId: string) => void;
  dropStreamContent: (messageId: string) => void;
  isGenerating: (conversationId: string | null | undefined) => boolean;
}

export const useChatStore = create<ChatState>((set, get) => ({
  generations: {},
  streamingContent: {},
  beginGeneration: (conversationId, controller) => set((state) => ({
    generations: {
      ...state.generations,
      [conversationId]: { conversationId, assistantMessageId: null, controller },
    },
  })),
  attachAssistantMessage: (conversationId, messageId) => set((state) => {
    const generation = state.generations[conversationId];
    if (!generation) return state;
    return {
      generations: {
        ...state.generations,
        [conversationId]: { ...generation, assistantMessageId: messageId },
      },
    };
  }),
  appendStreamContent: (messageId, conversationId, delta) => set((state) => {
    const existing = state.streamingContent[messageId];
    return {
      streamingContent: {
        ...state.streamingContent,
        [messageId]: {
          conversationId,
          content: (existing?.content || '') + delta,
        },
      },
    };
  }),
  endGeneration: (conversationId) => set((state) => {
    const generations = { ...state.generations };
    delete generations[conversationId];
    return { generations };
  }),
  dropStreamContent: (messageId) => set((state) => {
    const streamingContent = { ...state.streamingContent };
    delete streamingContent[messageId];
    return { streamingContent };
  }),
  isGenerating: (conversationId) =>
    Boolean(conversationId && get().generations[conversationId]),
}));

/* ============================= Settings ============================= */

interface SettingsState {
  preferences: UserPreferences | null;
  models: ModelInfo[];
  modelsLoaded: boolean;
  ollamaHealthy: boolean;
  setPreferences: (preferences: UserPreferences) => void;
  setModels: (models: ModelInfo[]) => void;
  setOllamaHealthy: (healthy: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      preferences: null,
      models: [],
      modelsLoaded: false,
      ollamaHealthy: false,
      setPreferences: (preferences) => set({ preferences }),
      setModels: (models) => set({ models, modelsLoaded: true }),
      setOllamaHealthy: (ollamaHealthy) => set({ ollamaHealthy }),
    }),
    {
      name: 'auron-settings',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ preferences: state.preferences }),
    }
  )
);

/* ================================ UI ================================ */

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

let toastCounter = 0;

interface UIState {
  sidebarCollapsed: boolean;
  theme: 'light' | 'dark' | 'system';
  isMobileSidebarOpen: boolean;
  toasts: Toast[];
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setMobileSidebarOpen: (open: boolean) => void;
  addToast: (message: string, type?: Toast['type']) => void;
  removeToast: (id: string) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      theme: 'system',
      isMobileSidebarOpen: false,
      toasts: [],
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      setTheme: (theme) => set({ theme }),
      setMobileSidebarOpen: (isMobileSidebarOpen) => set({ isMobileSidebarOpen }),
      addToast: (message, type = 'info') => set((state) => ({
        toasts: [...state.toasts.slice(-3), { id: `toast-${Date.now()}-${toastCounter++}`, message, type }],
      })),
      removeToast: (id) => set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      })),
    }),
    {
      name: 'auron-ui',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        theme: state.theme,
      }),
    }
  )
);
