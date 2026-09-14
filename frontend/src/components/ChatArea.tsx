import { useRef, useEffect, useCallback, useState } from 'react';
import { Loader2, RotateCcw, AlertCircle, WifiOff, Cpu, X } from 'lucide-react';
import { Skeleton, SkeletonMessage } from './ui';
import { MessageBubble } from './MessageBubble';
import { Welcome } from './Welcome';
import { MessageComposer } from './MessageComposer';
import { useConversationStore, useChatStore, useSettingsStore } from '../stores';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import type { Message, StreamChunk } from '../types';

export function ChatArea() {
  const { isAuthenticated } = useAuth();
  const {
    activeConversation,
    activeConversationId,
    messages,
    setActiveConversation,
    setMessages,
    addMessage,
    updateMessage,
    setLoading,
    isLoading,
  } = useConversationStore();
  const { isGenerating, setGenerating, abortGeneration } = useChatStore();
  const { preferences, ollamaHealthy } = useSettingsStore();
  const [showWelcome, setShowWelcome] = useState(!activeConversationId);
  const [error, setError] = useState<string | null>(null);
  const [initialLoad, setInitialLoad] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const userHasScrolled = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback((smooth = true) => {
    if (messagesEndRef.current && !userHasScrolled.current) {
      messagesEndRef.current.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    }
  }, []);

  const handleScroll = useCallback(() => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
      userHasScrolled.current = scrollHeight - scrollTop - clientHeight > 100;
    }
  }, []);

  const loadConversation = useCallback(async (conversationId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.conversations.get(conversationId);
      setActiveConversation(response.conversation, response.messages);
      setShowWelcome(false);
      setInitialLoad(false);
      setTimeout(() => scrollToBottom(false), 100);
    } catch (err) {
      setError('Failed to load conversation');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [setLoading, setActiveConversation, scrollToBottom]);

  const handleSendMessage = useCallback(async (content: string) => {
    if (!activeConversationId && !isGenerating) {
      try {
        const response = await api.conversations.create();
        setTimeout(() => {
          useConversationStore.getState().setActiveConversationId(response.conversation.id);
        }, 0);
      } catch {
        setError('Failed to create conversation');
        return;
      }
    }

    setGenerating(true);
    setError(null);
    abortControllerRef.current = new AbortController();

    const tempUserMessage: Message = {
      id: `temp-${Date.now()}`,
      conversationId: activeConversationId || '',
      role: 'user',
      content,
      status: 'completed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    addMessage(tempUserMessage);

    try {
      await api.ai.chat(
        {
          conversationId: activeConversationId || undefined,
          message: content,
          model: preferences?.model || undefined,
          temperature: preferences?.temperature,
          systemPrompt: preferences?.systemPrompt || undefined,
        },
        (chunk: StreamChunk) => {
          if (chunk.type === 'content' && chunk.content) {
            const existingIndex = messages.findIndex((m) => m.id === chunk.messageId);
            if (existingIndex >= 0) {
              updateMessage(chunk.messageId!, { content: messages[existingIndex].content + chunk.content });
            } else {
              const assistantMessage: Message = {
                id: chunk.messageId!,
                conversationId: chunk.conversationId!,
                role: 'assistant',
                content: chunk.content,
                status: 'streaming',
                model: preferences?.model,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
              addMessage(assistantMessage);
            }
            scrollToBottom();
          } else if (chunk.type === 'done') {
            updateMessage(chunk.messageId!, { status: 'completed' });
          } else if (chunk.type === 'error') {
            updateMessage(chunk.messageId!, { status: 'error' });
            setError(chunk.error || 'Generation failed');
          } else if (chunk.type === 'complete') {
            if (chunk.conversationId && !activeConversationId) {
              loadConversation(chunk.conversationId);
            }
          }
        },
        abortControllerRef.current.signal
      );
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Ignore abort errors
      } else {
        setError(err instanceof Error ? err.message : 'Failed to send message');
      }
    } finally {
      setGenerating(false);
      abortControllerRef.current = null;
    }
  }, [
    activeConversationId,
    isGenerating,
    preferences,
    messages,
    addMessage,
    updateMessage,
    setGenerating,
    setError,
    loadConversation,
    scrollToBottom,
  ]);

  const handleRegenerate = useCallback(async (assistantMessageId: string) => {
    if (!activeConversationId) return;

    setGenerating(true, assistantMessageId);
    setError(null);
    abortControllerRef.current = new AbortController();

    try {
      await api.ai.regenerate(
        activeConversationId,
        assistantMessageId,
        (chunk) => {
          if (chunk.type === 'content' && chunk.content) {
            const existingIndex = messages.findIndex((m) => m.id === chunk.messageId);
            if (existingIndex >= 0) {
              updateMessage(chunk.messageId!, { content: chunk.content });
            }
            scrollToBottom();
          } else if (chunk.type === 'done') {
            updateMessage(chunk.messageId!, { status: 'completed' });
          } else if (chunk.type === 'error') {
            updateMessage(chunk.messageId!, { status: 'error' });
            setError(chunk.error || 'Regeneration failed');
          }
        },
        abortControllerRef.current.signal
      );
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Ignore
      } else {
        setError(err instanceof Error ? err.message : 'Regeneration failed');
      }
    } finally {
      setGenerating(false);
      abortControllerRef.current = null;
    }
  }, [activeConversationId, messages, updateMessage, setGenerating, setError, scrollToBottom]);

  const handleRetry = useCallback(async (assistantMessageId: string) => {
    const msgIndex = messages.findIndex((m) => m.id === assistantMessageId);
    const userMessage = msgIndex > 0 ? messages[msgIndex - 1] : null;
    if (!userMessage || userMessage.role !== 'user') return;
    handleRegenerate(assistantMessageId);
  }, [messages, handleRegenerate]);

  const handleStop = useCallback(() => {
    abortGeneration();
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, [abortGeneration]);

  useEffect(() => {
    if (activeConversationId) {
      loadConversation(activeConversationId);
    } else {
      setShowWelcome(true);
      setMessages([]);
      setInitialLoad(false);
    }
  }, [activeConversationId, loadConversation, setMessages]);

  useEffect(() => {
    if (messages.length > 0 && !userHasScrolled.current) {
      scrollToBottom();
    }
  }, [messages.length, scrollToBottom]);

  if (!isAuthenticated) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <Cpu className="w-16 h-16 text-text-muted mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-text-primary">Please sign in to continue</h2>
        </div>
      </div>
    );
  }

  if (showWelcome || !activeConversation) {
    return <Welcome onSelectPrompt={handleSendMessage} />;
  }

  if (isLoading && messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {[1, 2, 3].map((i) => (
            <SkeletonMessage key={i} />
          ))}
        </div>
        <MessageComposer onSend={handleSendMessage} onStop={handleStop} disabled={true} />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {!ollamaHealthy && (
        <div className="px-4 py-2 bg-warning-light dark:bg-warning-dark/20 border-b border-border-light dark:border-border-dark">
          <div className="flex items-center justify-center gap-2 text-sm text-warning-dark dark:text-warning-light">
            <WifiOff size={14} />
            <span>Ollama is not connected. Make sure Ollama is running.</span>
          </div>
        </div>
      )}

      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-6 space-y-6"
        onScroll={handleScroll}
        role="log"
        aria-live="polite"
        aria-label="Chat messages"
      >
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            onCopy={() => navigator.clipboard.writeText(message.content)}
            onRegenerate={() => handleRegenerate(message.id)}
            onRetry={() => handleRetry(message.id)}
            isStreaming={message.status === 'streaming'}
          />
        ))}

        {isGenerating && (
          <div className="flex gap-3 animate-message-enter">
            <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0 mt-1">
              <svg className="w-5 h-5 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.514 15.782 3 14.128 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="bg-surface-100 dark:bg-surface-800 rounded-2xl rounded-tl-sm px-4 py-2.5">
                <div className="flex gap-1">
                  <span className="w-8 h-4 rounded bg-surface-200 dark:bg-surface-700 animate-pulse"></span>
                  <span className="w-12 h-4 rounded bg-surface-200 dark:bg-surface-700 animate-pulse" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-6 h-4 rounded bg-surface-200 dark:bg-surface-700 animate-pulse" style={{ animationDelay: '300ms' }}></span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {error && (
        <div className="px-4 py-3 bg-error-light dark:bg-error-dark/20 border-t border-border-light dark:border-border-dark">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-error-dark dark:text-error-light">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
            <button className="p-1 text-text-muted hover:text-text-primary" onClick={() => setError(null)} aria-label="Dismiss error">
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      <MessageComposer
        onSend={handleSendMessage}
        onStop={handleStop}
        disabled={isGenerating || !ollamaHealthy}
        placeholder={ollamaHealthy ? 'Message Auron AI...' : 'Connect Ollama to start chatting...'}
      />
    </div>
  );
}