import React from 'react';

export function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background-primary">
      <div className="space-y-5 text-center animate-fade-in" role="status" aria-label="Loading Auron AI">
        <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-solid shadow-lg shadow-accent/20">
          <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4.255-.949L3 20l1.395-3.72C3.514 15.782 3 14.128 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-bold text-content-primary">Auron AI</h1>
          <p className="mt-1 text-sm text-content-muted">Loading your workspace…</p>
        </div>
        <div className="flex justify-center gap-1.5">
          <span className="dot-pulse" />
          <span className="dot-pulse" style={{ animationDelay: '160ms' }} />
          <span className="dot-pulse" style={{ animationDelay: '320ms' }} />
        </div>
      </div>
    </div>
  );
}
