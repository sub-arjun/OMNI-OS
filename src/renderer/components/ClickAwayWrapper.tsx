import React, { useEffect, useRef, useState } from 'react';
import ClickAwayListener from './ClickAwayListener';

interface ClickAwayWrapperProps {
  children: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

/**
 * ClickAwayWrapper - A wrapper component that adds click-away functionality to any component
 * 
 * @param {React.ReactNode} children - The component to be wrapped
 * @param {boolean} isOpen - Whether the wrapped component is open
 * @param {Function} onClose - Callback function to close the wrapped component
 * @param {string} className - Optional CSS class name
 */
export default function ClickAwayWrapper({
  children,
  isOpen,
  onClose,
  className,
}: ClickAwayWrapperProps) {
  // Add a small delay before enabling click-away to prevent
  // the menu from immediately closing when opened
  const [active, setActive] = useState(false);
  
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    if (isOpen) {
      timeoutId = setTimeout(() => {
        setActive(true);
      }, 50);
    } else {
      setActive(false);
    }
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isOpen]);
  
  return (
    <ClickAwayListener onClickAway={onClose} active={active && isOpen} className={className}>
      {children}
    </ClickAwayListener>
  );
} 