import React, { useState, useRef, useEffect } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js';
import { Copy, RotateCcw, ThumbsUp, ThumbsDown, MoreHorizontal, Check } from 'lucide-react';
import { clsx } from 'clsx';
import { Avatar, Button, TooltipTrigger, Dropdown, ToastProvider, useToast } from '../ui';
import type { Message } from '../types';
import { formatDistanceToNow } from 'date-fns';
import 'highlight.js/styles/github-dark.min.css';

marked.setOptions({
  breaks: true,
  gfm: true,
});

const renderer = new marked.Renderer();

renderer.code = ({ text, lang }) => {
  const highlighted = lang && hljs.getLanguage(lang)
    ? hljs.highlight(text, { language: lang }).value
    : hljs.highlightAuto(text).value;

  return `<div class="code-block relative group">
    <div class="code-block-header flex items-center justify-between">
      <span class="text-xs text-text-muted">${lang || 'plaintext'}</span>
      <button class="code-block-copy btn-ghost p-1.5 text-xs opacity-0 group-hover:opacity-100 transition-opacity" data-code="${encodeURIComponent(text)}" aria-label="Copy code">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
      </button>
    </div>
    <pre class="overflow-x-auto rounded-b-lg p-4"><code class="hljs language-${lang || ''}">${highlighted}</code></pre>
  </div>`;
};

renderer.blockquote = ({ text }) => {
  return `<blockquote class="border-l-4 border-primary-500 pl-4 italic text-text-secondary my-2 dark:border-primary-400">${text}</blockquote>`;
};

function MessageBubble({ message, onCopy, onRegenerate, onRetry, showActions = true, isStreaming = false }: {
  message: Message;
  onCopy: () => void;
  onRegenerate: () => void;
  onRetry?: () => void;
  showActions?: boolean;
  isStreaming?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const messageRef = useRef<HTMLDivElement>(null);
  const { addToast } = useToast();

  useEffect(() => {
    if (messageRef.current) {
      messageRef.current.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightElement(block as HTMLElement);
      });
    }
  }, [message.content]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    addToast('Copied to clipboard', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDropdownAction = (action: 'regenerate' | 'retry') => {
    setShowDropdown(false);
    if (action === 'regenerate') onRegenerate();
    if (action === 'retry' && onRetry) onRetry();
  };

  const sanitizedHtml = DOMPurify.sanitize(marked.parse(message.content));

  return (
    <div
      ref={messageRef}
      className={clsx(
        'flex gap-3 animate-message-enter',
        message.role === 'user' ? 'flex-row-reverse' : ''
      )}
      data-message-id={message.id}
    >
      <Avatar
        name={message.role === 'user' ? 'You' : 'Auron AI'}
        size="sm"
        className="mt-1 shrink-0"
      />
      <div className={clsx('flex-1 min-w-0', message.role === 'user' && 'text-right')}>
        <div
          className={clsx(
            'inline-block max-w-[85%] px-4 py-2.5 rounded-2xl',
            message.role === 'user'
              ? 'bg-primary-600 text-white rounded-tr-sm'
              : 'bg-surface-100 dark:bg-surface-800 text-text-primary rounded-tl-sm'
          )}
        >
          {message.role === 'assistant' ? (
            <div
              className="prose prose-sm dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
            />
          ) : (
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          )}
          {message.status === 'error' && (
            <div className="mt-2 flex items-center gap-2 text-error-DEFAULT text-sm">
              <span>Failed to generate response</span>
              <Button variant="ghost" size="sm" onClick={onRetry} icon={<RotateCcw size={14} />}>
                Retry
              </Button>
            </div>
          )}
          {message.status === 'aborted' && (
            <div className="mt-2 text-warning-DEFAULT text-sm">
              Generation stopped
            </div>
          )}
        </div>

        <div className={clsx('flex items-center gap-1 mt-1.5', message.role === 'user' ? 'justify-end' : 'justify-start')}>
          {showActions && message.role === 'assistant' && message.status === 'completed' && (
            <TooltipTrigger content="Copy" delay={0}>
              <Button
                variant="ghost"
                size="sm"
                icon={copied ? <Check size={16} className="text-success-DEFAULT" /> : <Copy size={16} />}
                onClick={handleCopy}
                aria-label="Copy message"
              />
            </TooltipTrigger>
          )}
          {showActions && message.role === 'assistant' && message.status === 'completed' && (
            <TooltipTrigger content="Regenerate" delay={0}>
              <Button
                variant="ghost"
                size="sm"
                icon={<RotateCcw size={16} />}
                onClick={onRegenerate}
                aria-label="Regenerate response"
              />
            </TooltipTrigger>
          )}
          {showActions && message.role === 'assistant' && message.status === 'completed' && (
            <Dropdown
              trigger={
                <TooltipTrigger content="More options" delay={0}>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<MoreHorizontal size={16} />}
                    aria-label="More options"
                  />
                </TooltipTrigger>
              }
              items={[
                { label: 'Regenerate', icon: <RotateCcw size={16} />, onClick: () => handleDropdownAction('regenerate') },
                { label: 'Retry', icon: <RotateCcw size={16} />, onClick: () => handleDropdownAction('retry') },
                { label: 'Copy', icon: <Copy size={16} />, onClick: () => { handleCopy(); setShowDropdown(false); } },
              ]}
              align="right"
            />
          )}
          {message.status === 'completed' && (
            <span className="text-xs text-text-muted px-1">
              {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default MessageBubble;