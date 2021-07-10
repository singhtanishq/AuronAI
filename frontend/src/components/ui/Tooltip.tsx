import { useState, useRef, useEffect, createContext, useContext, ReactElement } from 'react';
import { createPortal } from 'react-dom';
import { cloneElement, isValidElement } from 'react';

interface TooltipContextType {
  registerTooltip: (id: string, element: HTMLElement | null) => void;
  unregisterTooltip: (id: string) => void;
  showTooltip: (id: string) => void;
  hideTooltip: (id: string) => void;
}

const TooltipContext = createContext<TooltipContextType | null>(null);

interface TooltipProviderProps {
  children: React.ReactNode;
}

export function TooltipProvider({ children }: TooltipProviderProps) {
  const tooltipsRef = useRef<Map<string, { element: HTMLElement | null; visible: boolean }>>(new Map());
  const [, forceUpdate] = useState({});

  const registerTooltip = (id: string, element: HTMLElement | null) => {
    tooltipsRef.current.set(id, { element, visible: false });
  };

  const unregisterTooltip = (id: string) => {
    tooltipsRef.current.delete(id);
  };

  const showTooltip = (id: string) => {
    const tooltip = tooltipsRef.current.get(id);
    if (tooltip) {
      tooltip.visible = true;
      forceUpdate((s) => ({ ...s }));
    }
  };

  const hideTooltip = (id: string) => {
    const tooltip = tooltipsRef.current.get(id);
    if (tooltip) {
      tooltip.visible = false;
      forceUpdate((s) => ({ ...s }));
    }
  };

  return (
    <TooltipContext.Provider value={{ registerTooltip, unregisterTooltip, showTooltip, hideTooltip }}>
      {children}
      <TooltipRender tooltips={tooltipsRef.current} />
    </TooltipContext.Provider>
  );
}

interface TooltipRenderProps {
  tooltips: Map<string, { element: HTMLElement | null; visible: boolean }>;
}

function TooltipRender({ tooltips }: TooltipRenderProps) {
  const [positions, setPositions] = useState<Record<string, { top: number; left: number }>>({});

  useEffect(() => {
    const updatePositions = () => {
      const newPositions: Record<string, { top: number; left: number }> = {};
      tooltips.forEach((tooltip, id) => {
        if (tooltip.visible && tooltip.element) {
          const rect = tooltip.element.getBoundingClientRect();
          newPositions[id] = {
            top: rect.bottom + 8,
            left: rect.left + rect.width / 2,
          };
        }
      });
      setPositions(newPositions);
    };

    updatePositions();
    window.addEventListener('scroll', updatePositions, true);
    window.addEventListener('resize', updatePositions);
    return () => {
      window.removeEventListener('scroll', updatePositions, true);
      window.removeEventListener('resize', updatePositions);
    };
  }, [tooltips]);

  return createPortal(
    <div className="pointer-events-none fixed z-50" style={{ top: 0, left: 0 }}>
      {Array.from(tooltips.entries()).map(([id, tooltip]) => {
        if (!tooltip.visible || !positions[id]) return null;
        return (
          <div
            key={id}
            className="absolute px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded shadow-lg animate-fade-in"
            style={{
              top: positions[id].top,
              left: positions[id].left,
              transform: 'translateX(-50%)',
            }}
          >
            {tooltip.element?.getAttribute('data-tooltip')}
          </div>
        );
      })}
    </div>,
    document.body
  );
}

export function useTooltip() {
  const context = useContext(TooltipContext);
  if (!context) {
    throw new Error('useTooltip must be used within a TooltipProvider');
  }
  return context;
}

interface TooltipTriggerProps {
  children: React.ReactElement;
  content: string;
  delay?: number;
}

export function TooltipTrigger({ children, content, delay = 200 }: TooltipTriggerProps) {
  const { registerTooltip, unregisterTooltip, showTooltip, hideTooltip } = useTooltip();
  const tooltipId = useRef(`tooltip-${Math.random().toString(36).slice(2, 9)}`);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const child = React.Children.only(children);

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => showTooltip(tooltipId.current), delay);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    hideTooltip(tooltipId.current);
  };

  return cloneElement(child, {
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
    'data-tooltip': content,
  } as Record<string, unknown>);
}