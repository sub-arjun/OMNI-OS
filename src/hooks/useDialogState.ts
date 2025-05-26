import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Custom hook to manage Dialog state and prevent Keyborg disposal issues
 * @param initialOpen - Initial open state
 * @returns Dialog state and handlers
 */
export function useDialogState(initialOpen = false) {
  const [open, setOpen] = useState(initialOpen);
  const isMounted = useRef(true);
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleOpenChange = useCallback((event: any, data: any) => {
    if (!isMounted.current) return;
    
    // Debounce state changes to prevent rapid mounting/unmounting
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      if (isMounted.current) {
        setOpen(data.open);
      }
    }, 0);
  }, []);

  const openDialog = useCallback(() => {
    if (isMounted.current) {
      setOpen(true);
    }
  }, []);

  const closeDialog = useCallback(() => {
    if (isMounted.current) {
      setOpen(false);
    }
  }, []);

  return {
    open,
    onOpenChange: handleOpenChange,
    openDialog,
    closeDialog,
  };
} 