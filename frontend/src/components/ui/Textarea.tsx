import { forwardRef, useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  autoResize?: boolean;
  minRows?: number;
  maxRows?: number;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      error,
      hint,
      autoResize = true,
      minRows = 3,
      maxRows = 10,
      className = '',
      id,
      ...props
    },
    ref
  ) => {
    const textareaId = id || label?.toLowerCase().replace(/\s+/g, '-');
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [rows, setRows] = useState(minRows);

    useEffect(() => {
      if (autoResize && textareaRef.current) {
        const textarea = textareaRef.current;
        textarea.style.height = 'auto';
        const newRows = Math.min(
          Math.max(Math.ceil(textarea.scrollHeight / 24), minRows),
          maxRows
        );
        setRows(newRows);
        textarea.style.height = `${newRows * 24}px`;
      }
    }, [autoResize, minRows, maxRows, props.value]);

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={textareaId} className="block text-sm font-medium text-text-secondary mb-1.5">
            {label}
          </label>
        )}
        <textarea
          ref={(el) => {
            textareaRef.current = el;
            if (typeof ref === 'function') ref(el);
            else if (ref) ref.current = el;
          }}
          id={textareaId}
          rows={rows}
          className={clsx(
            'w-full px-3 py-2 text-sm bg-background-primary border rounded-lg text-text-primary placeholder-text-muted transition-all duration-150 resize-none',
            'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'dark:bg-surface-800 dark:border-border-dark dark:focus:ring-primary-400',
            error ? 'border-error-DEFAULT focus:ring-error-DEFAULT' : 'border-border-medium',
            className
          )}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${textareaId}-error` : hint ? `${textareaId}-hint` : undefined}
          {...props}
        />
        {error && (
          <p id={`${textareaId}-error`} className="mt-1.5 text-sm text-error-DEFAULT" role="alert">
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={`${textareaId}-hint`} className="mt-1.5 text-sm text-text-muted">
            {hint}
          </p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';