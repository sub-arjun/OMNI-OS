import React, { useEffect, useRef } from 'react';

interface ClickAwayListenerProps {
  onClickAway: () => void;
  children: React.ReactNode;
  className?: string;
  active?: boolean;
}

/**
 * ClickAwayListener - A component that detects clicks outside of its children
 * and triggers the onClickAway callback when detected.
 * 
 * @param {Function} onClickAway - Callback function to be called when clicking outside
 * @param {React.ReactNode} children - The content to be rendered within the click away listener
 * @param {string} className - Optional CSS class name
 * @param {boolean} active - Whether the listener is active (default: true)
 */
export default function ClickAwayListener({
  onClickAway,
  children,
  className,
  active = true,
}: ClickAwayListenerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;
    
    if (active) {
      const handleClickOutside = (event: MouseEvent) => {
        if (
          containerRef.current && 
          !containerRef.current.contains(event.target as Node) &&
          // Don't trigger for clicks on dialog backdrops or already handled elements
          !(event.target as HTMLElement).closest('.fui-DialogSurface') &&
          !(event.target as HTMLElement).closest('.fui-MenuPopover') &&
          !(event.target as HTMLElement).closest('.fui-PopoverSurface')
        ) {
          onClickAway();
        }
      };

      // Delay adding the event listener to avoid immediate triggering
      timeoutId = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 10);
      
      return () => {
        if (timeoutId) clearTimeout(timeoutId);
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
    
    // Always return a cleanup function even when inactive
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [onClickAway, active]);

  return (
    <div ref={containerRef} className={className}>
      {children}
    </div>
  );
} 