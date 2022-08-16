import React from 'react';
import { clsx } from 'clsx';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  iconOnly?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      loading = false,
      icon,
      iconPosition = 'left',
      fullWidth = false,
      iconOnly = false,
      className = '',
      disabled,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const base =
      'inline-flex items-center justify-center gap-2 font-medium rounded-lg select-none ' +
      'transition-colors duration-fast ease-out focus-visible:outline-none focus-visible:ring-2 ' +
      'focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background-primary ' +
      'disabled:opacity-50 disabled:pointer-events-none';

    const variantClasses = {
      primary:
        'bg-accent-solid text-accent-on hover:bg-accent-hover active:brightness-90 shadow-sm',
      secondary:
        'bg-surface-secondary text-content-primary border border-line-subtle hover:bg-surface-hover active:brightness-95',
      ghost:
        'bg-transparent text-content-secondary hover:bg-surface-hover hover:text-content-primary active:bg-surface-secondary',
      danger:
        'bg-danger text-white hover:brightness-110 active:brightness-90 shadow-sm',
    };

    const sizeClasses = iconOnly
      ? {
          sm: 'h-7 w-7',
          md: 'h-9 w-9',
          lg: 'h-11 w-11',
        }
      : {
          sm: 'h-7 px-2.5 text-xs',
          md: 'h-9 px-3.5 text-sm',
          lg: 'h-11 px-5 text-base',
        };

    return (
      <button
        ref={ref}
        type={type}
        className={clsx(base, variantClasses[variant], sizeClasses[size], fullWidth && 'w-full', className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <svg className="animate-spin-slow h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : icon && iconPosition === 'left' ? (
          <span className="shrink-0" aria-hidden="true">{icon}</span>
        ) : null}
        {children}
        {icon && iconPosition === 'right' && !loading && (
          <span className="shrink-0" aria-hidden="true">{icon}</span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
