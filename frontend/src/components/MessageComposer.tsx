import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUp, Square } from 'lucide-react';
import { clsx } from 'clsx';
import { Button } from './ui';
import { useSettingsStore } from '../stores';

const MAX_MESSAGE_LENGTH = 50000;

interface MessageComposerProps {
  onSend: (message: string) => void;
  onStop: () => void;
  isGenerating: boolean;
  placeholder?: string;
}

export function MessageComposer({ onSend, onStop, isGenerating, placeholder }: MessageComposerProps) {
  const enterToSend = useSettingsStore((s) => s.preferences?.enterToSend ?? true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState('');

  const canSubmit = value.trim().length > 0 && !isGenerating && value.length <= MAX_MESSAGE_LENGTH;

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isGenerating) return;
    onSend(trimmed);
    setValue('');
    // Return focus so the next message can be typed immediately.
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, [value, isGenerating, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const submitRequested = enterToSend
        ? e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing
        : e.key === 'Enter' && (e.metaKey || e.ctrlKey);

      if (submitRequested) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [enterToSend, handleSubmit]
  );

  // Keep focus in the composer when generation finishes so follow-ups are fast.
  useEffect(() => {
    if (!isGenerating) {
      textareaRef.current?.focus();
    }
  }, [isGenerating]);

  const nearLimit = value.length > MAX_MESSAGE_LENGTH - 500;

  return (
    <div className="border-t border-line-subtle bg-surface-primary/80 backdrop-blur-md">
      <div className="mx-auto w-full max-w-3xl px-4 pb-3 pt-3">
        <div className="flex items-end gap-2 rounded-2xl border border-line-subtle bg-surface-elevated p-2 shadow-sm transition-colors duration-fast focus-within:border-accent/50">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder || 'Message Auron AI…'}
            rows={1}
            aria-label="Message input"
            className="max-h-52 min-h-[40px] w-full flex-1 resize-none bg-transparent px-2 py-2 text-[0.9375rem] text-content-primary placeholder:text-content-muted focus:outline-none"
          />
          {isGenerating ? (
            <Button
              variant="secondary"
              iconOnly
              size="lg"
              onClick={onStop}
              aria-label="Stop generating"
              className="shrink-0"
            >
              <Square size={15} className="fill-current" />
            </Button>
          ) : (
            <Button
              variant="primary"
              iconOnly
              size="lg"
              onClick={handleSubmit}
              disabled={!canSubmit}
              aria-label="Send message"
              className="shrink-0"
            >
              <ArrowUp size={18} />
            </Button>
          )}
        </div>
        <div className="mt-1.5 flex items-center justify-between px-1 text-xs text-content-muted">
          <span>
            {enterToSend ? 'Enter to send · Shift+Enter for a new line' : 'Ctrl+Enter to send · Enter for a new line'}
          </span>
          {nearLimit && (
            <span className={clsx(value.length > MAX_MESSAGE_LENGTH ? 'text-danger' : 'text-warn')}>
              {value.length.toLocaleString()} / {MAX_MESSAGE_LENGTH.toLocaleString()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
