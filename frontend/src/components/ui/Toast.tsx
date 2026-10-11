import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { clsx } from 'clsx';
import { useUIStore } from '../../stores';

const TOAST_DURATION_MS = 4500;

/** Toasts backed by the UI store so any component can raise one. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const toasts = useUIStore((s) => s.toasts);
  const removeToast = useUIStore((s) => s.removeToast);

  return (
    <>
      {children}
      {createPortal(
        <div
          className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2"
          role="region"
          aria-live="polite"
          aria-label="Notifications"
        >
          {toasts.map((toast) => (
            <ToastItem key={toast.id} id={toast.id} message={toast.message} type={toast.type} onRemove={removeToast} />
          ))}
        </div>,
        document.body
      )}
    </>
  );
}

interface ToastItemProps {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  onRemove: (id: string) => void;
}

function ToastItem({ id, message, type, onRemove }: ToastItemProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    timerRef.current = setTimeout(() => onRemove(id), TOAST_DURATION_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [id, onRemove]);

  const icons = {
    success: <CheckCircle size={18} className="text-ok" />,
    error: <AlertCircle size={18} className="text-danger" />,
    info: <Info size={18} className="text-accent" />,
  };

  return (
    <div
      className={clsx(
        'pointer-events-auto flex items-start gap-2.5 rounded-lg border px-3.5 py-3 shadow-lg animate-slide-in-right',
        'bg-surface-elevated border-line-subtle'
      )}
      role="alert"
    >
      <span className="mt-0.5 shrink-0">{icons[type]}</span>
      <p className="flex-1 text-sm text-content-primary">{message}</p>
      <button
        onClick={() => onRemove(id)}
        className="shrink-0 rounded p-0.5 text-content-muted transition-colors hover:text-content-primary"
        aria-label="Dismiss notification"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function useToast() {
  const addToast = useUIStore((s) => s.addToast);
  const removeToast = useUIStore((s) => s.removeToast);
  return { addToast, removeToast };
}
