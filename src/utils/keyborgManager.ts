/**
 * Keyborg Manager - Utility to manage Keyborg instances and prevent disposal issues
 * 
 * Keyborg is a keyboard focus management library used internally by Fluent UI.
 * This manager helps prevent "Keyborg instance is being disposed incorrectly" errors
 * that occur during rapid component mounting/unmounting.
 */

let keyborgCleanupQueue: (() => void)[] = [];
let cleanupTimer: NodeJS.Timeout | null = null;

/**
 * Schedule Keyborg cleanup with debouncing to prevent disposal during rapid updates
 */
export function scheduleKeyborgCleanup(cleanup: () => void) {
  keyborgCleanupQueue.push(cleanup);
  
  // Clear existing timer
  if (cleanupTimer) {
    clearTimeout(cleanupTimer);
  }
  
  // Schedule cleanup after a delay to allow components to stabilize
  cleanupTimer = setTimeout(() => {
    // Process all pending cleanups
    while (keyborgCleanupQueue.length > 0) {
      const cleanupFn = keyborgCleanupQueue.shift();
      try {
        cleanupFn?.();
      } catch (error) {
        console.warn('[Keyborg Manager] Error during cleanup:', error);
      }
    }
    cleanupTimer = null;
  }, 100); // 100ms delay to allow for component stabilization
}

/**
 * Clear all pending Keyborg cleanups (useful when unmounting the app)
 */
export function clearPendingKeyborgCleanups() {
  if (cleanupTimer) {
    clearTimeout(cleanupTimer);
    cleanupTimer = null;
  }
  keyborgCleanupQueue = [];
}

/**
 * Wrap a component to automatically handle Keyborg cleanup on unmount
 */
export function withKeyborgCleanup<T extends Function>(Component: T): T {
  return ((...args: any[]) => {
    const result = Component(...args);
    
    // If it's a React component, wrap it with cleanup handling
    if (result && typeof result === 'object' && 'type' in result) {
      // This is a simplified approach - in practice, you'd want to use a HOC
      console.warn('[Keyborg Manager] Component wrapping not fully implemented');
    }
    
    return result;
  }) as any as T;
}

// Auto-cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', clearPendingKeyborgCleanups);
} 