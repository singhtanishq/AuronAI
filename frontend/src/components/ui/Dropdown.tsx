import { useState, useRef, useEffect, cloneElement } from 'react';
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
  trigger: React.ReactElement;
  items: DropdownItem[];
  align?: 'left' | 'right';
  width?: number;
}

export function Dropdown({ trigger, items, align = 'right', width }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerElementRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        triggerElementRef.current &&
        !triggerElementRef.current.contains(e.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        triggerElementRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggle = () => setIsOpen((prev) => !prev);
  const close = () => setIsOpen(false);

  const triggerWithRef = cloneElement(trigger, {
    ref: triggerElementRef,
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      toggle();
      trigger.props.onClick?.(e);
    },
    'aria-haspopup': 'menu',
    'aria-expanded': isOpen,
  });

  const dropdownContent = isOpen ? (
    <div
      ref={dropdownRef}
      className={clsx(
        'fixed z-50 mt-1.5 rounded-lg bg-background-primary border border-border-light shadow-xl animate-fade-in',
        'dark:bg-surface-900 dark:border-border-dark',
        align === 'right' ? 'right-0' : 'left-0'
      )}
      style={{ minWidth: width || 180, maxWidth: width || 280 }}
      role="menu"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="py-1">
        {items.map((item, index) => (
          <button
            key={index}
            onClick={() => {
              item.onClick();
              close();
            }}
            disabled={item.disabled}
            className={clsx(
              'w-full flex items-center gap-3 px-3 py-2 text-sm text-left transition-colors',
              'hover:bg-surface-100 dark:hover:bg-surface-800',
              item.danger ? 'text-error-DEFAULT' : 'text-text-primary',
              item.disabled ? 'opacity-50 cursor-not-allowed' : ''
            )}
            role="menuitem"
            tabIndex={-1}
          >
            {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
            <span className="flex-1">{item.label}</span>
            {item.shortcut && (
              <span className="flex-shrink-0 text-xs text-text-muted font-mono">
                {item.shortcut}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  ) : null;

  return (
    <>
      {triggerWithRef}
      {typeof window !== 'undefined' && dropdownContent && createPortal(dropdownContent, document.body)}
    </>
  );
}