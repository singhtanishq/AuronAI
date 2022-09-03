import { useCallback, useEffect, useRef, useState, cloneElement, ReactElement } from 'react';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';

interface DropdownItem {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
  shortcut?: string;
}

interface DropdownProps {
  trigger: ReactElement;
  items: DropdownItem[];
  align?: 'left' | 'right';
  width?: number;
}

interface Position {
  top: number;
  left: number;
}

/**
 * Menu anchored to its trigger with viewport-aware positioning and full
 * keyboard support (Enter/Space open, arrows navigate, Escape closes).
 */
export function Dropdown({ trigger, items, align = 'right', width }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const triggerRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const activeIndexRef = useRef(-1);

  const updatePosition = useCallback(() => {
    const triggerEl = triggerRef.current;
    if (!triggerEl) return;

    const rect = triggerEl.getBoundingClientRect();
    const menuWidth = width || 200;
    const menuHeight = menuRef.current?.offsetHeight || items.length * 38 + 8;

    let left = align === 'right' ? rect.right - menuWidth : rect.left;
    left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8));

    let top = rect.bottom + 6;
    if (top + menuHeight > window.innerHeight - 8) {
      top = Math.max(8, rect.top - menuHeight - 6);
    }

    setPosition({ top, left });
  }, [align, width, items.length]);

  const openMenu = useCallback(() => {
    updatePosition();
    setIsOpen(true);
    activeIndexRef.current = -1;
  }, [updatePosition]);

  const closeMenu = useCallback((restoreFocus = false) => {
    setIsOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        menuRef.current?.contains(e.target as Node)
      ) {
        return;
      }
      closeMenu();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const menu = menuRef.current;
      if (!menu) return;

      const focusables = Array.from(
        menu.querySelectorAll<HTMLButtonElement>('button:not([disabled])')
      );

      switch (e.key) {
        case 'Escape':
          e.stopPropagation();
          closeMenu(true);
          break;
        case 'ArrowDown':
          e.preventDefault();
          activeIndexRef.current = Math.min(activeIndexRef.current + 1, focusables.length - 1);
          focusables[activeIndexRef.current]?.focus();
          break;
        case 'ArrowUp':
          e.preventDefault();
          activeIndexRef.current = Math.max(activeIndexRef.current - 1, 0);
          focusables[activeIndexRef.current]?.focus();
          break;
        case 'Home':
          e.preventDefault();
          activeIndexRef.current = 0;
          focusables[0]?.focus();
          break;
        case 'End':
          e.preventDefault();
          activeIndexRef.current = focusables.length - 1;
          focusables[focusables.length - 1]?.focus();
          break;
        default:
          break;
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', closeMenu);
    window.addEventListener('scroll', closeMenu, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', closeMenu);
      window.removeEventListener('scroll', closeMenu, true);
    };
  }, [isOpen, closeMenu]);

  const triggerWithRef = cloneElement(trigger as ReactElement<Record<string, unknown>>, {
    ref: triggerRef,
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (isOpen) {
        closeMenu();
      } else {
        openMenu();
      }
      const original = (trigger as ReactElement<{ onClick?: (e: React.MouseEvent) => void }>).props.onClick;
      original?.(e);
    },
    'aria-haspopup': 'menu',
    'aria-expanded': isOpen,
  });

  const menu = isOpen && position ? (
    <div
      ref={menuRef}
      className="fixed z-50 rounded-lg border border-line-subtle bg-surface-elevated py-1 shadow-lg animate-scale-in"
      style={{ top: position.top, left: position.left, minWidth: width || 200, maxWidth: 300 }}
      role="menu"
    >
      {items.map((item, index) => (
        <button
          key={`${item.label}-${index}`}
          onClick={() => {
            if (item.disabled) return;
            item.onClick();
            closeMenu();
          }}
          disabled={item.disabled}
          className={clsx(
            'flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors duration-fast',
            'hover:bg-surface-hover',
            item.danger ? 'text-danger' : 'text-content-primary',
            item.disabled ? 'cursor-not-allowed opacity-50' : ''
          )}
          role="menuitem"
          tabIndex={-1}
        >
          {item.icon && <span className="shrink-0 opacity-80">{item.icon}</span>}
          <span className="flex-1 truncate">{item.label}</span>
          {item.shortcut && (
            <span className="shrink-0 font-mono text-xs text-content-muted">{item.shortcut}</span>
          )}
        </button>
      ))}
    </div>
  ) : null;

  return (
    <>
      {triggerWithRef}
      {menu && createPortal(menu, document.body)}
    </>
  );
}
