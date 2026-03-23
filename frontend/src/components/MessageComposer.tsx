import { useRef, useEffect, useState, useCallback } from 'react';
import { Send, Paperclip, X, Smile } from 'lucide-react';
import { Button, Textarea } from './ui';
import { useChatStore } from '../stores';

interface MessageComposerProps {
  onSend: (message: string) => void;
  onStop?: () => void;
  disabled?: boolean;
  placeholder?: string;
}

export function MessageComposer({ onSend, onStop, disabled = false, placeholder = 'Message Auron AI...' }: MessageComposerProps) {
  const { isGenerating, abortGeneration } = useChatStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState('');
  const [height, setHeight] = useState(52);
  const [showStop, setShowStop] = useState(false);

  const adjustHeight = useCallback(() => {
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      textarea.style.height = 'auto';
      const newHeight = Math.min(Math.max(textarea.scrollHeight, 52), 200);
      setHeight(newHeight);
      textarea.style.height = `${newHeight}px`;
    }
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !disabled && !isGenerating) {
        handleSubmit();
      }
    }
  };

  const handleSubmit = () => {
    if (value.trim() && !disabled && !isGenerating) {
      onSend(value.trim());
      setValue('');
      setHeight(52);
      if (textareaRef.current) {
        textareaRef.current.style.height = '52px';
      }
    }
  };

  const handleStop = () => {
    if (onStop) onStop();
    else abortGeneration();
  };

  useEffect(() => {
    setShowStop(isGenerating);
  }, [isGenerating]);

  return (
    <div className="border-t border-border-light dark:border-border-dark bg-background-primary/50 backdrop-blur-sm">
      <div className="mx-auto max-w-4xl px-4 py-4">
        <div className="relative">
          <div className="flex items-end gap-2">
            <div className="flex-1 relative">
              <Textarea
                ref={textareaRef}
                value={value}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                disabled={disabled || isGenerating}
                rows={1}
                minRows={1}
                maxRows={8}
                autoResize={true}
                className="pr-20 resize-none"
                style={{ height }}
                aria-label="Message input"
              />
              <div className="absolute bottom-2 right-2 flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Smile size={18} />}
                  disabled={isGenerating}
                  aria-label="Add emoji"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Paperclip size={18} />}
                  disabled={isGenerating}
                  aria-label="Attach file"
                />
              </div>
            </div>
            <div className="flex items-end gap-2">
              {showStop && onStop ? (
                <Button
                  variant="secondary"
                  size="md"
                  icon={<X size={18} />}
                  onClick={handleStop}
                  aria-label="Stop generation"
                  className="h-10"
                >
                  Stop
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="md"
                  icon={<Send size={18} />}
                  onClick={handleSubmit}
                  disabled={disabled || isGenerating || !value.trim()}
                  aria-label="Send message"
                  className="h-10"
                />
              )}
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-text-muted">
            <span>Enter to send, Shift+Enter for new line</span>
            <span className="flex items-center gap-4">
              {isGenerating && (
                <span className="flex items-center gap-1 text-primary-600 dark:text-primary-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" style={{ animationDelay: '300ms' }}></span>
                  Generating...
                </span>
              )}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}