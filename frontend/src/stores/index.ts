import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User, Conversation, ConversationWithMeta, Message, UserPreferences, ModelInfo } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
  setLoading: (loading: boolean) => void;
  updateUser: (user: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: true,
      setAuth: (user, token) => set({ user, token, isAuthenticated: true, isLoading: false }),
      clearAuth: () => set({ user: null, token: null, isAuthenticated: false, isLoading: false }),
      setLoading: (isLoading) => set({ isLoading }),
      updateUser: (updates) => set((state) => ({
        user: state.user ? { ...state.user, ...updates } : null,
      })),
    }),
    {
      name: 'auron-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

interface ConversationState {
  conversations: ConversationWithMeta[];
  pinnedConversations: ConversationWithMeta[];
  activeConversationId: string | null;
  activeConversation: Conversation | null;
  messages: Message[];
  isLoading: boolean;
  isCreating: boolean;
  searchQuery: string;
  searchResults: ConversationWithMeta[];
  isSearching: boolean;
  setConversations: (conversations: ConversationWithMeta[]) => void;
  setPinnedConversations: (conversations: ConversationWithMeta[]) => void;
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
  setCreating: (creating: boolean) => void;
  setSearchQuery: (query: string) => void;
  setSearchResults: (results: ConversationWithMeta[]) => void;
  setSearching: (searching: boolean) => void;
  clearActiveConversation: () => void;
}

export const useConversationStore = create<ConversationState>((set) => ({
  conversations: [],
  pinnedConversations: [],
  activeConversationId: null,
  activeConversation: null,
  messages: [],
  isLoading: false,
  isCreating: false,
  searchQuery: '',
  searchResults: [],
  isSearching: false,
  setConversations: (conversations) => set({ conversations }),
  setPinnedConversations: (pinnedConversations) => set({ pinnedConversations }),
  addConversation: (conversation) => set((state) => ({
    conversations: [conversation, ...state.conversations],
  })),
  updateConversation: (id, updates) => set((state) => ({
    conversations: state.conversations.map((c) =>
      c.id === id ? { ...c, ...updates } : c
    ),
    pinnedConversations: state.pinnedConversations.map((c) =>
      c.id === id ? { ...c, ...updates } : c
    ),
    activeConversation: state.activeConversation?.id === id
      ? { ...state.activeConversation, ...updates }
      : state.activeConversation,
  })),
  removeConversation: (id) => set((state) => ({
    conversations: state.conversations.filter((c) => c.id !== id),
    pinnedConversations: state.pinnedConversations.filter((c) => c.id !== id),
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
    messages: state.messages.map((m) => m.id === id ? { ...m, ...updates } : m),
  })),
  removeMessage: (id) => set((state) => ({
    messages: state.messages.filter((m) => m.id !== id),
  })),
  setMessages: (messages) => set({ messages }),
  setLoading: (isLoading) => set({ isLoading }),
  setCreating: (isCreating) => set({ isCreating }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSearchResults: (searchResults) => set({ searchResults }),
  setSearching: (isSearching) => set({ isSearching }),
  clearActiveConversation: () => set({
    activeConversation: null,
    activeConversationId: null,
    messages: [],
  }),
}));

interface SettingsState {
  preferences: UserPreferences | null;
  models: ModelInfo[];
  isLoading: boolean;
  ollamaHealthy: boolean;
  setPreferences: (preferences: UserPreferences) => void;
  updatePreference: <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => void;
  setModels: (models: ModelInfo[]) => void;
  setLoading: (loading: boolean) => void;
  setOllamaHealthy: (healthy: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      preferences: null,
      models: [],
      isLoading: false,
      ollamaHealthy: false,
      setPreferences: (preferences) => set({ preferences }),
      updatePreference: (key, value) => set((state) => ({
        preferences: state.preferences ? { ...state.preferences, [key]: value } : null,
      })),
      setModels: (models) => set({ models }),
      setLoading: (isLoading) => set({ isLoading }),
      setOllamaHealthy: (ollamaHealthy) => set({ ollamaHealthy }),
    }),
    {
      name: 'auron-settings',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        preferences: state.preferences,
      }),
    }
  )
);

interface UIState {
  sidebarCollapsed: boolean;
  theme: 'light' | 'dark' | 'system';
  isMobileSidebarOpen: boolean;
  isCommandPaletteOpen: boolean;
  toasts: Array<{ id: string; message: string; type: 'success' | 'error' | 'info' }>;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  toggleMobileSidebar: () => void;
  setMobileSidebarOpen: (open: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  addToast: (message: string, type: 'success' | 'error' | 'info') => void;
  removeToast: (id: string) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      theme: 'system',
      isMobileSidebarOpen: false,
      isCommandPaletteOpen: false,
      toasts: [],
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      setTheme: (theme) => set({ theme }),
      toggleMobileSidebar: () => set((state) => ({ isMobileSidebarOpen: !state.isMobileSidebarOpen })),
      setMobileSidebarOpen: (isMobileSidebarOpen) => set({ isMobileSidebarOpen }),
      setCommandPaletteOpen: (isCommandPaletteOpen) => set({ isCommandPaletteOpen }),
      addToast: (message, type) => set((state) => ({
        toasts: [...state.toasts, { id: Date.now().toString(), message, type }],
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

interface ChatState {
  isGenerating: boolean;
  abortController: AbortController | null;
  currentAssistantMessageId: string | null;
  setGenerating: (generating: boolean, messageId?: string, abortController?: AbortController) => void;
  abortGeneration: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  isGenerating: false,
  abortController: null,
  currentAssistantMessageId: null,
  setGenerating: (isGenerating, messageId, abortController) => set({
    isGenerating,
    currentAssistantMessageId: messageId || null,
    abortController: abortController || null,
  }),
  abortGeneration: () => set((state) => {
    state.abortController?.abort();
    return { isGenerating: false, abortController: null, currentAssistantMessageId: null };
  }),
}));