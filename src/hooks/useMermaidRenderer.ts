import { useRef, useCallback, useEffect } from 'react';
import Debug from 'debug';
import useToast from './useToast';

const debug = Debug('OMNI-OS:hooks:useMermaidRenderer');

type MermaidAPI = {
  initialize: (config: any) => void;
  render: (id: string, definition: string) => Promise<{svg: string}>;
  parseError?: (err: Error) => void;
};

// Global cache for rendered diagrams that persists across component instances
const globalDiagramCache = new Map<string, string>();
// Global cache for rendered diagram DOM elements
const globalDiagramElements = new Map<string, string>();

// Hide mermaid's default error display
function hideMermaidErrors() {
  // Add CSS to hide mermaid's default error display
  if (!document.getElementById('mermaid-error-override')) {
    const style = document.createElement('style');
    style.id = 'mermaid-error-override';
    style.textContent = `
      /* Hide mermaid's default error display */
      .error-icon { display: none !important; }
      .error-text { display: none !important; }
      #d0 { display: none !important; }
      #d1 { display: none !important; }
      #d2 { display: none !important; }
      [id^="mermaid-"] text.error-text { display: none !important; }
      [id^="mermaid-"] g.error-icon { display: none !important; }
      /* Hide any element containing the specific error text */
      body > div:has(> text:contains("Syntax error in text")),
      body > div:has(> div:contains("Syntax error in text")),
      body > svg:has(text:contains("Syntax error in text")) {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
  }
  
  // Also use MutationObserver to catch and hide any error elements created dynamically
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof Element) {
          // Check for mermaid error elements
          if (node.textContent?.includes('Syntax error in text') || 
              node.textContent?.includes('mermaid version') ||
              node.id?.startsWith('d') && node.querySelector?.('text')?.textContent?.includes('Syntax error')) {
            (node as HTMLElement).style.display = 'none';
          }
        }
      });
    });
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Clean up after 10 seconds to avoid memory leaks
  setTimeout(() => observer.disconnect(), 10000);
}

export default function useMermaidRenderer(messageId: string) {
  const mermaidRef = useRef<MermaidAPI | null>(null);
  const processedDiagramsRef = useRef<Set<string>>(new Set());
  const { notifyError } = useToast();
  
  // Load mermaid library
  const loadMermaid = useCallback(async (): Promise<MermaidAPI | null> => {
    if (mermaidRef.current) return mermaidRef.current;
    
    try {
      const mermaidModule = await import('mermaid');
      const mermaid = mermaidModule.default;
      
      // Configure mermaid with custom error handling
      mermaid.initialize({
        startOnLoad: false,
        theme: 'default',
        fontSize: 14,
        securityLevel: 'loose',
        suppressErrorRendering: true, // Try to suppress error rendering if supported
        themeVariables: {
          background: '#ffffff',
          primaryColor: '#f4f4f4',
          secondaryColor: '#f4f4f4',
          tertiaryColor: '#ffffff',
          primaryTextColor: '#333333',
          secondaryTextColor: '#333333',
          tertiaryTextColor: '#333333',
          noteTextColor: '#333333',
          noteBkgColor: '#fff5ad'
        }
      });
      
      // Override parseError if it exists
      if (mermaid.parseError) {
        mermaid.parseError = (err: unknown) => {
          console.error('[Mermaid] Parse error:', err);
          // Don't show the default error display
        };
      }
      
      mermaidRef.current = mermaid;
      return mermaid;
    } catch (error) {
      console.error('Failed to load mermaid:', error);
      notifyError('Failed to load diagram renderer');
      return null;
    }
  }, [notifyError]);
  
  // Process mermaid diagrams in the DOM
  const processMermaidDiagrams = useCallback(async () => {
    console.log(`[Mermaid] Processing diagrams for message ${messageId}`);
    
    const messageElement = document.getElementById(messageId);
    if (!messageElement) {
      console.log(`[Mermaid] Message element not found for ID: ${messageId}`);
      return;
    }
    
    const placeholders = messageElement.querySelectorAll('.mermaid-placeholder');
    console.log(`[Mermaid] Found ${placeholders.length} placeholders in message ${messageId}`);
    
    if (placeholders.length === 0) return;
    
    const mermaid = await loadMermaid();
    if (!mermaid) {
      console.error('[Mermaid] Failed to load mermaid library');
      return;
    }
    
    debug(`Processing ${placeholders.length} mermaid placeholders for message ${messageId}`);
    
    // Hide any mermaid errors before processing
    hideMermaidErrors();
    
    for (const placeholder of Array.from(placeholders)) {
      const encodedContent = placeholder.getAttribute('data-content');
      const diagramId = placeholder.getAttribute('data-diagram-id');
      
      console.log(`[Mermaid] Processing diagram ${diagramId}`);
      
      if (!encodedContent || !diagramId) {
        console.log(`[Mermaid] Missing data for diagram ${diagramId}: encodedContent=${!!encodedContent}`);
        continue;
      }
      
      // Check if we have a cached DOM element for this diagram
      const cachedElement = globalDiagramElements.get(diagramId);
      if (cachedElement) {
        console.log(`[Mermaid] Restoring cached DOM element for ${diagramId}`);
        const container = document.createElement('div');
        container.innerHTML = cachedElement;
        const restoredElement = container.firstChild as HTMLElement;
        
        if (placeholder.parentNode && restoredElement) {
          placeholder.parentNode.replaceChild(restoredElement, placeholder);
          console.log(`[Mermaid] Successfully restored cached diagram ${diagramId}`);
        }
        continue;
      }
      
      // Skip if already processed (and not just restored from cache)
      if (processedDiagramsRef.current.has(diagramId)) {
        console.log(`[Mermaid] Diagram ${diagramId} already processed, skipping`);
        continue;
      }
      
      try {
        const content = decodeURIComponent(atob(encodedContent));
        console.log(`[Mermaid] Decoded content for ${diagramId}:`, content.substring(0, 100) + '...');
        
        const cacheKey = `${messageId}-${content}`;
        
        // Check global cache first
        let svg = globalDiagramCache.get(cacheKey);
        
        if (!svg) {
          console.log(`[Mermaid] Rendering new diagram ${diagramId}`);
          
          // Hide errors before rendering
          hideMermaidErrors();
          
          try {
            // Render the diagram
            const renderId = `mermaid-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
            const result = await mermaid.render(renderId, content);
            svg = result.svg;
            
            // Cache the result globally
            globalDiagramCache.set(cacheKey, svg);
            debug(`Rendered and cached diagram for message ${messageId}`);
          } catch (renderError: any) {
            // Handle render error gracefully
            console.error(`[Mermaid] Render error for ${diagramId}:`, renderError);
            
            // Show toast notification instead of mermaid's default error
            const errorMessage = renderError?.message || 'Unknown error';
            if (errorMessage.includes('Syntax error')) {
              notifyError('Diagram syntax error - please check the diagram format');
            } else {
              notifyError(`Failed to render diagram: ${errorMessage}`);
            }
            
            // Continue to show fallback below
            throw renderError;
          }
        } else {
          console.log(`[Mermaid] Using cached diagram for ${diagramId}`);
          debug(`Using cached diagram for message ${messageId}`);
        }
        
        // Create container and insert the SVG
        const container = document.createElement('div');
        container.className = 'mermaid-container';
        container.setAttribute('data-diagram-id', diagramId);
        container.setAttribute('data-message-id', messageId);
        container.style.backgroundColor = '#ffffff';
        container.innerHTML = svg;
        
        // Cache the DOM element
        globalDiagramElements.set(diagramId, container.outerHTML);
        
        // Replace placeholder with container
        if (placeholder.parentNode) {
          placeholder.parentNode.replaceChild(container, placeholder);
          console.log(`[Mermaid] Successfully replaced placeholder for ${diagramId}`);
        } else {
          console.error(`[Mermaid] No parent node for placeholder ${diagramId}`);
        }
        
        // Mark as processed
        processedDiagramsRef.current.add(diagramId);
        
        // Hide any error elements that might have been created
        hideMermaidErrors();
      } catch (error: any) {
        console.error(`[Mermaid] Error processing diagram ${diagramId}:`, error);
        
        // Show clean error fallback with the source code
        const errorDiv = document.createElement('div');
        errorDiv.className = 'mermaid-error-fallback';
        errorDiv.innerHTML = `
          <p style="color: #666; margin-bottom: 8px;">Failed to render diagram</p>
          <pre style="background: #f5f5f5; padding: 12px; border-radius: 4px; overflow-x: auto;">${decodeURIComponent(atob(encodedContent))}</pre>
        `;
        
        if (placeholder.parentNode) {
          placeholder.parentNode.replaceChild(errorDiv, placeholder);
        }
        
        // Mark as processed even on error to avoid retrying
        processedDiagramsRef.current.add(diagramId);
        
        // Make sure to hide any error elements
        hideMermaidErrors();
      }
    }
    
    // Final cleanup of any error elements
    setTimeout(() => hideMermaidErrors(), 100);
  }, [messageId, loadMermaid, notifyError]);
  
  // Clear cache for old messages to prevent memory leaks
  useEffect(() => {
    // Keep only the last 50 diagrams in cache
    if (globalDiagramCache.size > 50) {
      const entries = Array.from(globalDiagramCache.entries());
      const toRemove = entries.slice(0, entries.length - 50);
      toRemove.forEach(([key]) => globalDiagramCache.delete(key));
    }
    
    // Also clean up DOM element cache
    if (globalDiagramElements.size > 50) {
      const entries = Array.from(globalDiagramElements.entries());
      const toRemove = entries.slice(0, entries.length - 50);
      toRemove.forEach(([key]) => globalDiagramElements.delete(key));
    }
  }, []);
  
  // Hide mermaid errors on mount
  useEffect(() => {
    hideMermaidErrors();
  }, []);
  
  return { processMermaidDiagrams };
} 