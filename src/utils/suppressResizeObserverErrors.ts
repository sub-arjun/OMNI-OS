/**
 * Utility to aggressively suppress ResizeObserver loop errors in the browser
 * 
 * ResizeObserver loop errors can occur when multiple layout changes happen in quick succession,
 * but they're generally harmless warnings rather than actual errors that affect functionality.
 * 
 * This utility uses multiple layers of defense to prevent these errors from appearing.
 */

// List of patterns to identify ResizeObserver-related errors
const RESIZE_OBSERVER_PATTERNS = [
  'ResizeObserver loop',
  'ResizeObserver Loop',
  'ResizeObserver completed with undelivered notifications',
  'ResizeObserver error'
];

// Helper to check if a message matches any ResizeObserver error pattern
function isResizeObserverError(message: string): boolean {
  if (!message) return false;
  return RESIZE_OBSERVER_PATTERNS.some(pattern => message.includes(pattern));
}

// Original browser error handlers
let originalConsoleError: typeof console.error | null = null;
let originalConsoleWarn: typeof console.warn | null = null;
let originalOnError: typeof window.onerror | null = null;
let originalOnUnhandledRejection: typeof window.onunhandledrejection | null = null;

/**
 * Aggressively suppresses ResizeObserver errors using multiple techniques
 */
export function suppressResizeObserverErrors(): () => void {
  // Don't reinstall if already installed
  if (originalConsoleError) return () => {};

  // Store original console methods
  originalConsoleError = console.error;
  originalConsoleWarn = console.warn;
  originalOnError = window.onerror;
  originalOnUnhandledRejection = window.onunhandledrejection;
  
  // Replace console.error with a filtered version
  console.error = function(...args) {
    // Skip logging ResizeObserver errors
    if (args[0] && typeof args[0] === 'string' && isResizeObserverError(args[0])) {
      return;
    }
    
    // Check if it's an error object with a message about ResizeObserver
    if (args[0] instanceof Error && args[0].message && isResizeObserverError(args[0].message)) {
      return;
    }
    
    // Pass through to the original console.error
    if (originalConsoleError) {
      originalConsoleError.apply(console, args);
    }
  };
  
  // Also hook console.warn to catch warnings
  console.warn = function(...args) {
    // Skip logging ResizeObserver warnings
    if (args[0] && typeof args[0] === 'string' && isResizeObserverError(args[0])) {
      return;
    }
    
    // Pass through to the original console.warn
    if (originalConsoleWarn) {
      originalConsoleWarn.apply(console, args);
    }
  };
  
  // Intercept global errors
  window.onerror = function(message, source, lineno, colno, error) {
    // Check if this is a ResizeObserver error
    if (message && typeof message === 'string' && isResizeObserverError(message)) {
      // Prevent the error from propagating
      return true;
    }
    
    // Pass through to original handler
    if (originalOnError) {
      return originalOnError.call(window, message, source, lineno, colno, error);
    }
    return false;
  };
  
  // Intercept unhandled Promise rejections
  window.onunhandledrejection = function(event) {
    // Check if this is a ResizeObserver error
    const message = event.reason?.message || String(event.reason);
    if (isResizeObserverError(message)) {
      // Prevent the rejection from propagating
      event.preventDefault();
      return;
    }
    
    // Pass through to original handler
    if (originalOnUnhandledRejection) {
      return originalOnUnhandledRejection.call(window, event);
    }
  };
  
  // Patch the Error object to filter ResizeObserver errors at source
  const originalErrorToString = Error.prototype.toString;
  Error.prototype.toString = function() {
    if (this.message && isResizeObserverError(this.message)) {
      // Return empty message for ResizeObserver errors
      return '';
    }
    return originalErrorToString.call(this);
  };
  
  // Return a cleanup function
  return () => {
    // Restore original functions
    if (originalConsoleError) console.error = originalConsoleError;
    if (originalConsoleWarn) console.warn = originalConsoleWarn;
    if (originalOnError) window.onerror = originalOnError;
    if (originalOnUnhandledRejection) window.onunhandledrejection = originalOnUnhandledRejection;
    Error.prototype.toString = originalErrorToString;
    
    // Reset stored originals
    originalConsoleError = null;
    originalConsoleWarn = null;
    originalOnError = null;
    originalOnUnhandledRejection = null;
  };
}

// Track if we've already initialized
let isInitialized = false;

/**
 * Initialize ResizeObserver error suppression
 * This should be called as early as possible
 */
export function initSuppressResizeObserverErrors(): void {
  if (isInitialized) return;
  
  suppressResizeObserverErrors();
  
  // Additional step: Try to patch the ResizeObserver implementation itself
  try {
    if (typeof ResizeObserver !== 'undefined') {
      const originalResizeObserver = ResizeObserver;
      // @ts-ignore - we're deliberately replacing the global ResizeObserver
      window.ResizeObserver = class PatchedResizeObserver extends originalResizeObserver {
        constructor(callback: ResizeObserverCallback) {
          // Wrap the callback to catch errors
          const safeCallback: ResizeObserverCallback = (entries, observer) => {
            try {
              callback(entries, observer);
            } catch (e) {
              // Silently catch any errors from the callback
              if (!(e instanceof Error) || !isResizeObserverError(e.message)) {
                console.error('Error in ResizeObserver callback (not a loop error):', e);
              }
            }
          };
          super(safeCallback);
        }
      };
    }
  } catch (e) {
    // If patching fails, continue with other methods
    console.warn('Failed to patch ResizeObserver', e);
  }
  
  // Handle potential error overlays from React
  try {
    // Add a style to hide React error overlays that mention ResizeObserver
    const style = document.createElement('style');
    style.textContent = `
      [data-reactroot] div:has(pre:contains("ResizeObserver")) { 
        display: none !important;
      }
      
      div:has(> div[role="dialog"]:has(pre:contains("ResizeObserver"))) {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
  } catch (e) {
    // Browser might not support :has selector, so continue with other methods
  }
  
  isInitialized = true;
}

/**
 * Clean up ResizeObserver error suppression
 */
export function cleanupSuppressResizeObserverErrors(): void {
  if (!isInitialized) return;
  
  suppressResizeObserverErrors();
  isInitialized = false;
} 