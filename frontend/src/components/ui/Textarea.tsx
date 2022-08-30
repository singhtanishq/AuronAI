import { forwardRef, useCallback, useId, useRef } from 'react';
import { clsx } from 'clsx';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  autoResize?: boolean;
  maxHeight?: number;
}

/**
 * Auto-resizing textarea. One sizing mechanism: height follows content up to
 * `maxHeight`, then the box scrolls. Callers must not fight it with inline
 * styles or row math.
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      error,
      hint,
      autoResize = true,
      maxHeight = 200,
      className = '',
      id,
      onChange,
      ...props
    },
    forwardedRef
  ) => {
    const generatedId = useId();
    const textareaId = id || generatedId;
    const innerRef = useRef<HTMLTextAreaElement | null>(null);

    const resize = useCallback(() => {
      const textarea = innerRef.current;
      if (!textarea || !autoResize) return;
      textarea.style.height = 'auto';
      const next = Math.min(textarea.scrollHeight, maxHeight);
      textarea.style.height = `${next}px`;
      textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
    }, [autoResize, maxHeight]);

    const handleRef = (el: HTMLTextAreaElement | null) => {
      innerRef.current = el;
      if (typeof forwardedRef === 'function') {
        forwardedRef(el);
      } else if (forwardedRef && typeof forwardedRef === 'object') {
        (forwardedRef as { current: HTMLTextAreaElement | null }).current = el;
      }
      if (el) {
        // Size correctly on mount (e.g. prefilled values).
        requestAnimationFrame(resize);
      }
    };

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={textareaId} className="mb-1.5 block text-sm font-medium text-content-secondary">
            {label}
          </label>
        )}
        <textarea
          ref={handleRef}
          id={textareaId}
          onChange={(event) => {
            resize();
            onChange?.(event);
          }}
          className={clsx(
            'w-full resize-none rounded-lg border border-line-subtle bg-surface-primary px-3 py-2 text-sm',
            'text-content-primary placeholder:text-content-muted transition-colors duration-fast',
            'focus:outline-none focus:ring-2 focus:ring-accent/60 focus:border-transparent',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error ? 'border-danger' : '',
            className
          )}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${textareaId}-error` : hint ? `${textareaId}-hint` : undefined}
          {...props}
        />
        {error && (
          <p id={`${textareaId}-error`} className="mt-1.5 text-sm text-danger" role="alert">
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={`${textareaId}-hint`} className="mt-1.5 text-sm text-content-muted">
            {hint}
          </p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
