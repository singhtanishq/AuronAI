import React, { useRef, useState, useCallback, useId } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  placement?: 'top' | 'bottom';
  delay?: number;
}

interface Position {
  top: number;
  left: number;
  placement: 'top' | 'bottom';
}

/**
 * Lightweight tooltip with hover and keyboard-focus triggers, portal
 * rendering, and viewport-aware placement. The wrapped element must accept
 * standard event props (any DOM element or forwardRef component).
 */
export function Tooltip({ content, children, placement = 'top', delay = 250 }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const tooltipId = useId();

  const show = useCallback(() => {
    timerRef.current = setTimeout(() => {
      const el = wrapperRef.current?.firstElementChild as HTMLElement | null;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const top = placement === 'top' ? rect.top - 8 : rect.bottom + 8;
      const left = Math.max(8, Math.min(rect.left + rect.width / 2, window.innerWidth - 8));
      setPosition({ top, left, placement });
      setVisible(true);
    }, delay);
  }, [placement, delay]);

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
  }, []);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return (
    <>
      <span
        ref={wrapperRef}
        className="inline-flex"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        aria-describedby={visible ? tooltipId : undefined}
      >
        {children}
      </span>
      {visible && position
        ? createPortal(
            <div
              id={tooltipId}
              role="tooltip"
              className="pointer-events-none fixed z-[70] -translate-x-1/2 whitespace-nowrap rounded-md bg-content-primary px-2 py-1 text-xs font-medium text-background-primary shadow-md animate-fade-in"
              style={{
                top: position.top,
                left: position.left,
                transform: `translate(-50%, ${position.placement === 'top' ? '-100%' : '0'})`,
              }}
            >
              {content}
            </div>,
            document.body
          )
        : null}
    </>
  );
}
