/**
 * Intercepts and hides Mermaid's default error display
 * This utility ensures that Mermaid errors are shown as toast notifications
 * instead of the library's default SVG error display
 */

export function initializeMermaidErrorInterceptor() {
  // Intercept and hide Mermaid error elements as they're created
  const originalAppendChild = Element.prototype.appendChild;
  const originalInsertBefore = Element.prototype.insertBefore;
  
  // Track if we've already patched to avoid double-patching
  if ((window as any).__mermaidErrorInterceptorInitialized) {
    return;
  }
  
  (window as any).__mermaidErrorInterceptorInitialized = true;
  
  // Helper to check if an element is a Mermaid error
  function isMermaidError(element: Node): boolean {
    if (element instanceof SVGElement || element instanceof HTMLElement) {
      const textContent = element.textContent || '';
      const id = (element as any).id || '';
      
      // Check for known error patterns
      if (textContent.includes('Syntax error in text') || 
          textContent.includes('mermaid version') ||
          id === 'd0' || id === 'd1' || id === 'd2') {
        return true;
      }
      
      // Check for error class names
      if (element instanceof Element) {
        if (element.classList.contains('error-icon') || 
            element.classList.contains('error-text') ||
            element.querySelector('.error-icon') ||
            element.querySelector('.error-text')) {
          return true;
        }
      }
    }
    return false;
  }
  
  // Override appendChild
  Element.prototype.appendChild = function<T extends Node>(node: T): T {
    if (isMermaidError(node)) {
      console.log('[MermaidErrorInterceptor] Blocked error element from being added');
      // Return the node without adding it
      return node;
    }
    return originalAppendChild.call(this, node) as T;
  };
  
  // Override insertBefore
  Element.prototype.insertBefore = function<T extends Node>(node: T, child: Node | null): T {
    if (isMermaidError(node)) {
      console.log('[MermaidErrorInterceptor] Blocked error element from being inserted');
      // Return the node without inserting it
      return node;
    }
    return originalInsertBefore.call(this, node, child) as T;
  };
  
  // Also add a style to hide any that might slip through
  const style = document.createElement('style');
  style.id = 'mermaid-error-interceptor-styles';
  style.textContent = `
    /* Hide any Mermaid error elements that slip through */
    #d0, #d1, #d2,
    .error-icon, 
    .error-text,
    text.error-text,
    g.error-icon {
      display: none !important;
    }
    
    /* Hide SVG elements that are direct children of body and contain errors */
    body > svg {
      display: none !important;
    }
  `;
  
  if (!document.getElementById('mermaid-error-interceptor-styles')) {
    document.head.appendChild(style);
  }
  
  // Clean up any existing error elements
  function cleanupErrorElements() {
    // Remove direct SVG children of body
    document.querySelectorAll('body > svg').forEach(svg => {
      if (svg.textContent?.includes('Syntax error') || 
          svg.textContent?.includes('mermaid version')) {
        svg.remove();
      }
    });
    
    // Remove elements with error IDs
    ['d0', 'd1', 'd2'].forEach(id => {
      const elem = document.getElementById(id);
      if (elem) elem.remove();
    });
    
    // Remove elements with error classes
    document.querySelectorAll('.error-icon, .error-text').forEach(elem => {
      elem.remove();
    });
  }
  
  // Initial cleanup
  cleanupErrorElements();
  
  // Periodic cleanup for any stragglers
  const cleanupInterval = setInterval(cleanupErrorElements, 1000);
  
  // Stop after 30 seconds to avoid performance impact
  setTimeout(() => clearInterval(cleanupInterval), 30000);
}

/**
 * Clean up the error interceptor (useful for testing)
 */
export function cleanupMermaidErrorInterceptor() {
  (window as any).__mermaidErrorInterceptorInitialized = false;
  
  // Remove our style element
  const styleElement = document.getElementById('mermaid-error-interceptor-styles');
  if (styleElement) {
    styleElement.remove();
  }
} 