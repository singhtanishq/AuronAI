import React from 'react';

export function AppLogo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const dims = size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-16 w-16' : 'h-12 w-12';
  const icon = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-8 w-8' : 'h-6 w-6';
  return (
    <span
      className={`inline-flex ${dims} items-center justify-center rounded-2xl bg-accent-solid shadow-lg shadow-accent/25`}
      aria-hidden="true"
    >
      <svg className={`${icon} text-white`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4.255-.949L3 20l1.395-3.72C3.514 15.782 3 14.128 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
        />
      </svg>
    </span>
  );
}
