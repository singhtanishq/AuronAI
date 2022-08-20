import React, { forwardRef, useId } from 'react';
import { clsx } from 'clsx';
import { Eye, EyeOff } from 'lucide-react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string | React.ReactNode;
  icon?: React.ReactNode;
  showPasswordToggle?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      hint,
      icon,
      showPasswordToggle = false,
      className = '',
      id,
      type = 'text',
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const [showPassword, setShowPassword] = React.useState(false);
    const inputType = showPasswordToggle && showPassword ? 'text' : type;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-content-secondary">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-content-muted">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            type={inputType}
            className={clsx(
              'w-full rounded-lg border bg-surface-primary py-2 text-sm text-content-primary',
              'placeholder:text-content-muted transition-colors duration-fast',
              'focus:outline-none focus:ring-2 focus:ring-accent/60 focus:border-transparent',
              'disabled:cursor-not-allowed disabled:opacity-50',
              icon ? 'pl-10' : 'pl-3',
              showPasswordToggle ? 'pr-10' : 'pr-3',
              error ? 'border-danger' : 'border-line-subtle focus:border-transparent',
              className
            )}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
            {...props}
          />
          {showPasswordToggle && (
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-content-muted transition-colors hover:text-content-primary"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          )}
        </div>
        {error && (
          <p id={`${inputId}-error`} className="mt-1.5 text-sm text-danger" role="alert">
            {error}
          </p>
        )}
        {hint && !error && (
          <div id={`${inputId}-hint`} className="mt-1.5 text-sm text-content-muted">
            {hint}
          </div>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
