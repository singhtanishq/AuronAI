import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
import { Copy, Check, RotateCcw, AlertTriangle, Ban } from 'lucide-react';
import { clsx } from 'clsx';
import { Avatar, Button, Tooltip } from './ui';
import type { Message } from '../types';
import { renderMarkdown } from '../utils/markdown';
import { copyToClipboard, formatTimestamp } from '../utils/format';
import { useSettingsStore } from '../stores';

interface MessageBubbleProps {
  message: Message;
  onRegenerate?: (messageId: string) => void;
  isStreaming?: boolean;
}

/**
 * One rendered message. Markdown is parsed once per content change and
 * sanitized; code-block copy buttons inside the rendered HTML are handled via
 * event delegation on the container.
 */
export const MessageBubble = memo(function MessageBubble({
  message,
  onRegenerate,
  isStreaming = false,
}: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const showTimestamps = useSettingsStore((s) => s.preferences?.showTimestamps ?? true);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout>>();

  const html = useMemo(() => (isUser ? null : renderMarkdown(message.content)), [isUser, message.content]);

  const handleCopy = useCallback(async () => {
    const ok = await copyToClipboard(message.content);
    if (!ok) return;
    setCopied(true);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 1800);
  }, [message.content]);

  // Delegated handler for copy buttons inside rendered markdown.
  const handleContentClick = useCallback(async (e: React.MouseEvent) => {
    const target = (e.target as HTMLElement).closest<HTMLButtonElement>('.code-block-copy');
    if (!target) return;
    const encoded = target.getAttribute('data-code');
    if (encoded === null) return;
    const ok = await copyToClipboard(decodeURIComponent(encoded));
    if (!ok) return;
    target.textContent = 'Copied';
    setTimeout(() => {
      target.textContent = 'Copy';
    }, 1800);
  }, []);

  const canAct = message.status === 'completed' || message.status === 'error' || message.status === 'aborted';

  return (
    <div
      className={clsx('group flex w-full gap-3 animate-message-in', isUser ? 'justify-end' : 'justify-start')}
      data-message-id={message.id}
    >
      {!isUser && (
        <Avatar name="Auron AI" size="sm" className="mt-1 shrink-0" />
      )}

      <div className={clsx('flex min-w-0 flex-col', isUser ? 'items-end' : 'items-start', 'max-w-[92%] sm:max-w-[85%]')}>
        {isUser ? (
          <div className="rounded-2xl rounded-br-md bg-accent-solid px-4 py-2.5 text-white shadow-sm">
            <p className="whitespace-pre-wrap break-words text-[0.9375rem] leading-relaxed">{message.content}</p>
          </div>
        ) : (
          <div
            className="w-full min-w-0 cursor-default"
            onClick={handleContentClick}
            // Sanitized by renderMarkdown (DOMPurify) before reaching the DOM.
            dangerouslySetInnerHTML={{ __html: html || '' }}
          />
        )}

        {message.status === 'error' && !isUser && (
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-danger/30 bg-danger-subtle px-3 py-2 text-sm text-danger">
            <AlertTriangle size={15} className="shrink-0" />
            <span>Generation failed{message.content ? ' — partial response kept' : ''}.</span>
            {onRegenerate && (
              <Button variant="ghost" size="sm" icon={<RotateCcw size={13} />} onClick={() => onRegenerate(message.id)}>
                Retry
              </Button>
            )}
          </div>
        )}

        {message.status === 'aborted' && !isUser && (
          <div className="mt-2 flex items-center gap-2 text-sm text-warn">
            <Ban size={14} className="shrink-0" />
            <span>Generation stopped{message.content ? ' — partial response kept' : ''}.</span>
          </div>
        )}

        {isStreaming && (
          <span className="ml-0.5 mt-1 inline-block h-4 w-[2px] animate-blink bg-accent" aria-hidden="true" />
        )}

        {canAct && !isStreaming && (
          <div className={clsx('mt-1 flex items-center gap-0.5 transition-opacity', 'sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100')}>
            {!isUser && (
              <Tooltip content={copied ? 'Copied' : 'Copy message'}>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="icon-btn"
                  aria-label="Copy message"
                >
                  {copied ? <Check size={15} className="text-ok" /> : <Copy size={15} />}
                </button>
              </Tooltip>
            )}
            {!isUser && onRegenerate && message.status !== 'error' && (
              <Tooltip content="Regenerate">
                <button
                  type="button"
                  onClick={() => onRegenerate(message.id)}
                  className="icon-btn"
                  aria-label="Regenerate response"
                >
                  <RotateCcw size={15} />
                </button>
              </Tooltip>
            )}
            {showTimestamps && (
              <span className="px-1 text-xs text-content-muted">{formatTimestamp(message.createdAt)}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
