import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, ArrowDown, Cpu, Menu, RefreshCw, WifiOff, X } from 'lucide-react';
import { clsx } from 'clsx';
import { SkeletonMessage, Button, Tooltip } from './ui';
import { MessageBubble } from './MessageBubble';
import { Welcome } from './Welcome';
import { MessageComposer } from './MessageComposer';
import { useConversationStore, useChatStore, useSettingsStore, useUIStore } from '../stores';
import { api } from '../services/api';
import type { Message, StreamEvent } from '../types';

function newLocalMessage(partial: Partial<Message> & { content: string; role: Message['role'] }): Message {
  const now = new Date().toISOString();
  return {
    id: `local-${now}-${Math.random().toString(36).slice(2, 9)}`,
    conversationId: '',
    status: 'completed',
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

export function ChatArea() {
  const { conversationId: routeConversationId } = useParams<{ conversationId?: string }>();
  const navigate = useNavigate();

  const messages = useConversationStore((s) => s.messages);
  const activeConversation = useConversationStore((s) => s.activeConversation);
  const activeConversationId = useConversationStore((s) => s.activeConversationId);
  const isLoadingConversation = useConversationStore((s) => s.isLoadingConversation);
  const setActiveConversation = useConversationStore((s) => s.setActiveConversation);
  const addMessage = useConversationStore((s) => s.addMessage);
  const updateMessage = useConversationStore((s) => s.updateMessage);
  const removeMessage = useConversationStore((s) => s.removeMessage);
  const updateConversation = useConversationStore((s) => s.updateConversation);
  const addConversation = useConversationStore((s) => s.addConversation);
  const setLoadingConversation = useConversationStore((s) => s.setLoadingConversation);
  const setMobileSidebarOpen = useUIStore((s) => s.setMobileSidebarOpen);

  const preferences = useSettingsStore((s) => s.preferences);
  const models = useSettingsStore((s) => s.models);
  const modelsLoaded = useSettingsStore((s) => s.modelsLoaded);
  const ollamaHealthy = useSettingsStore((s) => s.ollamaHealthy);

  const isGenerating = useChatStore((s) => (routeConversationId ? Boolean(s.generations[routeConversationId]) : false));

  const [banner, setBanner] = useState<string | null>(null);
  const [modelNotice, setModelNotice] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);
  const loadSeqRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);
  const streamRef = useRef<{
    targetId: string | null;
    messageId: string | null;
    content: string;
    buffer: string;
    raf: number | null;
  }>({ targetId: null, messageId: null, content: '', buffer: '', raf: null });
  const tempUserMessageIdRef = useRef<string | null>(null);
  // Safety net for the optimistic prompt text: survives even if a
  // conversation load replaces the store between send and the 'start' event.
  const pendingUserContentRef = useRef<string | null>(null);

  // Effective model: fall back to the first installed model when the stored
  // preference is no longer available on this machine.
  const effectiveModel = useMemo(() => {
    const preferred = preferences?.model;
    if (!modelsLoaded || models.length === 0) return preferred;
    if (preferred && models.some((m) => m.name === preferred)) return preferred;
    return models[0].name;
  }, [preferences?.model, models, modelsLoaded]);

  useEffect(() => {
    if (
      modelsLoaded &&
      models.length > 0 &&
      preferences?.model &&
      !models.some((m) => m.name === preferences.model)
    ) {
      setModelNotice(`"${preferences.model}" is not installed — using ${models[0].name} instead.`);
    } else {
      setModelNotice(null);
    }
  }, [modelsLoaded, models, preferences?.model]);

  const isNearBottom = useCallback(() => {
    const el = containerRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 100;
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    endRef.current?.scrollIntoView({ behavior, block: 'end' });
  }, []);

  const handleScroll = useCallback(() => {
    const near = isNearBottom();
    nearBottomRef.current = near;
    setShowJumpToBottom((prev) => (prev !== !near ? !near : prev));
  }, [isNearBottom]);

  /* ------------------------- conversation loading ------------------------- */

  useEffect(() => {
    const seq = ++loadSeqRef.current;

    if (!routeConversationId) {
      setActiveConversation(null, []);
      setBanner(null);
      return;
    }

    if (activeConversationId === routeConversationId && activeConversation) {
      return; // already loaded
    }

    let cancelled = false;
    setLoadingConversation(true);
    setBanner(null);

    api.conversations
      .get(routeConversationId)
      .then((response) => {
        if (cancelled || loadSeqRef.current !== seq) return;
        // Merge any in-flight stream content so returning mid-generation
        // shows the live text instead of the last DB flush.
        const streaming = useChatStore.getState().streamingContent;
        const merged = response.messages.map((m) => {
          const live = streaming[m.id];
          return live && live.conversationId === response.conversation.id && m.status === 'streaming'
            ? { ...m, content: live.content }
            : m;
        });
        setActiveConversation(response.conversation, merged);
        nearBottomRef.current = true;
        requestAnimationFrame(() => scrollToBottom('auto'));
      })
      .catch((error) => {
        if (cancelled || loadSeqRef.current !== seq) return;
        if (error instanceof Error && 'statusCode' in error && (error as { statusCode: number }).statusCode === 404) {
          navigate('/chat', { replace: true });
          return;
        }
        setBanner('Failed to load conversation. Check your connection and try again.');
        setActiveConversation(null, []);
      })
      .finally(() => {
        if (!cancelled && loadSeqRef.current === seq) setLoadingConversation(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeConversationId]);

  /* --------------------------- streaming plumbing --------------------------- */

  const flushStream = useCallback(() => {
    const stream = streamRef.current;
    stream.raf = null;
    if (!stream.messageId) return;
    if (stream.buffer) {
      stream.content += stream.buffer;
      stream.buffer = '';
    }
    const viewing = useConversationStore.getState().activeConversationId === stream.targetId;
    if (viewing) {
      updateMessage(stream.messageId, { content: stream.content });
    }
    if (nearBottomRef.current && (useSettingsStore.getState().preferences?.autoScroll ?? true)) {
      endRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
    }
  }, [updateMessage]);

  const queueDelta = useCallback(
    (delta: string) => {
      const stream = streamRef.current;
      stream.buffer += delta;
      if (stream.raf === null) {
        stream.raf = requestAnimationFrame(flushStream);
      }
    },
    [flushStream]
  );

  const finalizeStream = useCallback(
    (status: Message['status']) => {
      const stream = streamRef.current;
      if (stream.raf !== null) {
        cancelAnimationFrame(stream.raf);
        stream.raf = null;
      }
      if (stream.messageId) {
        const viewing = useConversationStore.getState().activeConversationId === stream.targetId;
        if (viewing) {
          updateMessage(stream.messageId, { content: stream.content, status });
        }
        useChatStore.getState().dropStreamContent(stream.messageId);
        if (status === 'completed') {
          useConversationStore.getState().updateConversation(stream.targetId || '', {
            lastMessagePreview: stream.content.slice(0, 120),
            updatedAt: new Date().toISOString(),
          });
        }
      }
      streamRef.current = { targetId: null, messageId: null, content: '', buffer: '', raf: null };
      tempUserMessageIdRef.current = null;
      pendingUserContentRef.current = null;
    },
    [updateMessage]
  );

  const handleStreamEvent = useCallback(
    (event: StreamEvent, targetId: string) => {
      const viewing = useConversationStore.getState().activeConversationId === targetId;

      switch (event.type) {
        case 'start': {
          useChatStore.getState().attachAssistantMessage(targetId, event.assistantMessageId);
          if (!viewing) break;

          // Capture the local message content BEFORE removing it: the real
          // record replaces the optimistic one and must keep the prompt text.
          const messagesNow = useConversationStore.getState().messages;
          const tempId = tempUserMessageIdRef.current;
          const temp = tempId ? messagesNow.find((m) => m.id === tempId) : undefined;
          const promptContent = temp?.content ?? pendingUserContentRef.current ?? '';
          if (tempId) {
            removeMessage(tempId);
            tempUserMessageIdRef.current = null;
          }
          pendingUserContentRef.current = null;

          const refreshed = useConversationStore.getState().messages;
          const hasUser = refreshed.some((m) => m.id === event.userMessageId);
          if (!hasUser) {
            addMessage(
              newLocalMessage({
                id: event.userMessageId,
                conversationId: targetId,
                role: 'user',
                content: promptContent,
              })
            );
          }
          const hasAssistant = refreshed.some((m) => m.id === event.assistantMessageId);
          if (!hasAssistant) {
            addMessage(
              newLocalMessage({
                id: event.assistantMessageId,
                conversationId: targetId,
                role: 'assistant',
                content: '',
                status: 'streaming',
              })
            );
          }
          break;
        }

        case 'delta': {
          const stream = streamRef.current;
          if (!stream.messageId) {
            // First delta of a regenerate (no start event) or late start.
            stream.targetId = targetId;
            stream.messageId = event.assistantMessageId;
            stream.content = useChatStore.getState().streamingContent[event.assistantMessageId]?.content || '';
          }
          if (viewing) {
            const messagesNow = useConversationStore.getState().messages;
            const exists = messagesNow.some((m) => m.id === event.assistantMessageId);
            if (!exists) {
              addMessage(
                newLocalMessage({
                  id: event.assistantMessageId,
                  conversationId: targetId,
                  role: 'assistant',
                  content: '',
                  status: 'streaming',
                })
              );
            } else {
              const current = messagesNow.find((m) => m.id === event.assistantMessageId);
              if (current && current.status !== 'streaming') {
                updateMessage(event.assistantMessageId, { status: 'streaming' });
              }
            }
          }
          useChatStore.getState().appendStreamContent(event.assistantMessageId, targetId, event.content);
          queueDelta(event.content);
          break;
        }

        case 'title': {
          updateConversation(event.conversationId, { title: event.title });
          break;
        }

        case 'done': {
          finalizeStream('completed');
          useChatStore.getState().endGeneration(targetId);
          break;
        }

        case 'aborted': {
          finalizeStream('aborted');
          useChatStore.getState().endGeneration(targetId);
          break;
        }

        case 'error': {
          finalizeStream('error');
          setBanner(event.message);
          useChatStore.getState().endGeneration(targetId);
          break;
        }

        default:
          break;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [addMessage, removeMessage, updateMessage, updateConversation, queueDelta, finalizeStream]
  );

  /* ------------------------------- actions ------------------------------- */

  const sendMessage = useCallback(
    async (content: string, conversationId: string) => {
      const controller = new AbortController();
      controllerRef.current = controller;
      useChatStore.getState().beginGeneration(conversationId, controller);

      streamRef.current = { targetId: conversationId, messageId: null, content: '', buffer: '', raf: null };
      nearBottomRef.current = true;

      const tempMessage = newLocalMessage({ conversationId, role: 'user', content });
      tempUserMessageIdRef.current = tempMessage.id;
      pendingUserContentRef.current = content;
      if (useConversationStore.getState().activeConversationId === conversationId) {
        addMessage(tempMessage);
      }

      try {
        await api.ai.chat(
          {
            conversationId,
            message: content,
            model: effectiveModel || undefined,
            temperature: preferences?.temperature,
            systemPrompt: preferences?.systemPrompt || undefined,
          },
          (event) => handleStreamEvent(event, conversationId),
          controller.signal
        );
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          // Explicit stop or navigation: server-side abort has been requested
          // separately; the partial output is preserved there.
          finalizeStream('aborted');
        } else {
          finalizeStream('error');
          setBanner(
            error instanceof Error
              ? error.message
              : 'Failed to send the message. Check your connection and try again.'
          );
        }
        useChatStore.getState().endGeneration(conversationId);
      } finally {
        controllerRef.current = null;
      }
    },
    [addMessage, effectiveModel, preferences?.temperature, preferences?.systemPrompt, handleStreamEvent, finalizeStream]
  );

  const handleSend = useCallback(
    async (content: string) => {
      setBanner(null);

      // Reuse the active conversation, or create one and move to its route
      // before generating so the URL and store stay consistent.
      let targetId = routeConversationId || null;
      if (!targetId) {
        try {
          const response = await api.conversations.create();
          addConversation({
            ...response.conversation,
            messageCount: 0,
            lastMessagePreview: undefined,
          });
          targetId = response.conversation.id;
          setActiveConversation(response.conversation, []);
          navigate(`/chat/${targetId}`);
        } catch {
          setBanner('Could not start a new conversation. Please try again.');
          return;
        }
      }

      void sendMessage(content, targetId);
    },
    [routeConversationId, addConversation, navigate, setActiveConversation, sendMessage]
  );

  const handleRegenerate = useCallback(
    (assistantMessageId: string) => {
      if (!routeConversationId || isGenerating) return;
      setBanner(null);

      const controller = new AbortController();
      controllerRef.current = controller;
      useChatStore.getState().beginGeneration(routeConversationId, controller);
      streamRef.current = {
        targetId: routeConversationId,
        messageId: assistantMessageId,
        content: '',
        buffer: '',
        raf: null,
      };
      useChatStore.getState().attachAssistantMessage(routeConversationId, assistantMessageId);
      updateMessage(assistantMessageId, { status: 'streaming', content: '' });
      nearBottomRef.current = true;

      void (async () => {
        try {
          await api.ai.regenerate(
            routeConversationId,
            assistantMessageId,
            (event) => handleStreamEvent(event, routeConversationId),
            controller.signal
          );
        } catch (error) {
          if ((error as Error).name === 'AbortError') {
            finalizeStream('aborted');
          } else {
            finalizeStream('error');
            setBanner(error instanceof Error ? error.message : 'Regeneration failed.');
          }
          useChatStore.getState().endGeneration(routeConversationId);
        } finally {
          controllerRef.current = null;
        }
      })();
    },
    [routeConversationId, isGenerating, updateMessage, handleStreamEvent, finalizeStream]
  );

  const handleStop = useCallback(() => {
    if (!routeConversationId) return;
    const generation = useChatStore.getState().generations[routeConversationId];
    if (generation?.assistantMessageId) {
      // Tell the server first so the partial answer is persisted as aborted.
      void api.ai
        .abort(routeConversationId, generation.assistantMessageId)
        .catch(() => undefined)
        .finally(() => {
          generation.controller.abort();
        });
    } else {
      generation?.controller.abort();
    }
  }, [routeConversationId]);

  // Cleanup: if the component unmounts mid-generation, abort the request.
  useEffect(() => {
    return () => {
      if (controllerRef.current) {
        controllerRef.current.abort();
      }
      if (streamRef.current.raf !== null) {
        cancelAnimationFrame(streamRef.current.raf);
      }
    };
  }, []);

  /* ------------------------------ health retry ------------------------------ */

  const [isRetryingHealth, setIsRetryingHealth] = useState(false);
  const refreshHealth = useCallback(async () => {
    setIsRetryingHealth(true);
    try {
      const [healthRes, modelsRes] = await Promise.allSettled([api.ai.health(), api.ai.models()]);
      if (healthRes.status === 'fulfilled') {
        useSettingsStore.getState().setOllamaHealthy(healthRes.value.ai.reachable);
      }
      if (modelsRes.status === 'fulfilled') {
        useSettingsStore.getState().setModels(modelsRes.value.models);
      }
    } finally {
      setIsRetryingHealth(false);
    }
  }, []);

  useEffect(() => {
    if (ollamaHealthy) return;
    const interval = setInterval(refreshHealth, 20000);
    const onFocus = () => void refreshHealth();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [ollamaHealthy, refreshHealth]);

  /* -------------------------------- render -------------------------------- */

  const placeholder = ollamaHealthy
    ? 'Message Auron AI…'
    : 'Start Ollama to chat (`ollama serve`)…';

  const header = (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line-subtle bg-surface-primary/60 px-4 backdrop-blur-md">
      <button
        type="button"
        onClick={() => setMobileSidebarOpen(true)}
        className="icon-btn lg:hidden"
        aria-label="Open sidebar"
      >
        <Menu size={20} />
      </button>
      <h1 className="min-w-0 flex-1 truncate text-sm font-semibold text-content-primary">
        {activeConversation?.title || 'New chat'}
      </h1>
      {effectiveModel && (
        <Tooltip content={modelsLoaded && models.length > 0 ? 'Selected model' : 'Model'}>
          <span className="hidden items-center gap-1.5 rounded-full border border-line-subtle bg-surface-secondary px-2.5 py-1 text-xs font-medium text-content-secondary sm:inline-flex">
            <Cpu size={12} className="text-accent" />
            {effectiveModel}
          </span>
        </Tooltip>
      )}
    </header>
  );

  if (!routeConversationId) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        {header}
        <Welcome onSelectPrompt={handleSend} />
        <MessageComposer onSend={handleSend} onStop={handleStop} isGenerating={false} placeholder={placeholder} />
      </div>
    );
  }

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
      {header}

      {/* Banners */}
      {(!ollamaHealthy || modelNotice || banner) && (
        <div className="shrink-0 space-y-px">
          {!ollamaHealthy && (
            <div className="flex items-center justify-center gap-2 border-b border-warn/20 bg-warn-subtle px-4 py-2 text-sm text-warn">
              <WifiOff size={14} className="shrink-0" />
              <span className="min-w-0 truncate">
                Ollama is not reachable. Start it with <code className="font-mono">ollama serve</code>, then retry.
              </span>
              <Button variant="ghost" size="sm" icon={<RefreshCw size={13} className={clsx(isRetryingHealth && 'animate-spin-slow')} />} onClick={refreshHealth} loading={isRetryingHealth}>
                Retry
              </Button>
            </div>
          )}
          {modelNotice && ollamaHealthy && (
            <div className="flex items-center justify-center gap-2 border-b border-line-subtle bg-surface-secondary px-4 py-2 text-sm text-content-secondary">
              <Cpu size={14} className="shrink-0 text-accent" />
              <span className="min-w-0 truncate">{modelNotice}</span>
            </div>
          )}
          {banner && (
            <div className="flex items-center justify-between gap-2 border-b border-danger/20 bg-danger-subtle px-4 py-2 text-sm text-danger">
              <span className="flex min-w-0 items-center gap-2">
                <AlertCircle size={14} className="shrink-0" />
                <span className="min-w-0 truncate">{banner}</span>
              </span>
              <button type="button" onClick={() => setBanner(null)} className="icon-btn shrink-0" aria-label="Dismiss error">
                <X size={14} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="relative flex-1 overflow-y-auto"
        role="log"
        aria-live="polite"
        aria-label="Chat messages"
      >
        <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6">
          {isLoadingConversation && messages.length === 0 ? (
            <div className="space-y-8 pt-4">
              <SkeletonMessage />
              <SkeletonMessage />
            </div>
          ) : messages.length === 0 && !isGenerating ? (
            <Welcome compact onSelectPrompt={handleSend} />
          ) : (
            <>
              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  onRegenerate={
                    message.role === 'assistant' && !isGenerating ? handleRegenerate : undefined
                  }
                  isStreaming={
                    isGenerating &&
                    message.status === 'streaming' &&
                    useChatStore.getState().generations[routeConversationId || '']?.assistantMessageId === message.id
                  }
                />
              ))}
              {isGenerating && !streamRef.current.messageId && (
                <WaitingIndicator />
              )}
            </>
          )}
          <div ref={endRef} className="h-px" />
        </div>

        {showJumpToBottom && messages.length > 0 && (
          <button
            type="button"
            onClick={() => {
              nearBottomRef.current = true;
              setShowJumpToBottom(false);
              scrollToBottom();
            }}
            className="icon-btn sticky bottom-4 left-1/2 -translate-x-1/2 border border-line-subtle bg-surface-elevated shadow-md"
            aria-label="Scroll to bottom"
          >
            <ArrowDown size={16} />
          </button>
        )}
      </div>

      <MessageComposer onSend={handleSend} onStop={handleStop} isGenerating={isGenerating} placeholder={placeholder} />
    </div>
  );
}

function WaitingIndicator() {
  return (
    <div className="flex items-center gap-3 animate-message-in" aria-label="Auron AI is thinking">
      <div className="flex items-center gap-1.5 rounded-2xl bg-surface-secondary px-4 py-3">
        <span className="dot-pulse" />
        <span className="dot-pulse" style={{ animationDelay: '160ms' }} />
        <span className="dot-pulse" style={{ animationDelay: '320ms' }} />
      </div>
    </div>
  );
}
