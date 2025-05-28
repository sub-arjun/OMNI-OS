import { useRef, useCallback, useEffect } from 'react';
import Debug from 'debug';

const debug = Debug('OMNI-OS:hooks:useMermaidRenderer');

type MermaidAPI = {
  initialize: (config: any) => void;
  render: (id: string, definition: string) => Promise<{svg: string}>;
};

// Global cache for rendered diagrams that persists across component instances
const globalDiagramCache = new Map<string, string>();
// Global cache for rendered diagram DOM elements
const globalDiagramElements = new Map<string, string>();

export default function useMermaidRenderer(messageId: string) {
  const mermaidRef = useRef<MermaidAPI | null>(null);
  const processedDiagramsRef = useRef<Set<string>>(new Set());
  
  // Load mermaid library
  const loadMermaid = useCallback(async (): Promise<MermaidAPI | null> => {
    if (mermaidRef.current) return mermaidRef.current;
    
    try {
      const mermaidModule = await import('mermaid');
      const mermaid = mermaidModule.default;
      
      mermaid.initialize({
        startOnLoad: false,
        theme: 'default',
        fontSize: 14,
        securityLevel: 'loose',
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
      
      mermaidRef.current = mermaid;
      return mermaid;
    } catch (error) {
      console.error('Failed to load mermaid:', error);
      return null;
    }
  }, []);
  
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
          // Render the diagram
          const renderId = `mermaid-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
          const result = await mermaid.render(renderId, content);
          svg = result.svg;
          
          // Cache the result globally
          globalDiagramCache.set(cacheKey, svg);
          debug(`Rendered and cached diagram for message ${messageId}`);
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
      } catch (error) {
        console.error(`[Mermaid] Error rendering diagram ${diagramId}:`, error);
        
        // Show error fallback
        const errorDiv = document.createElement('div');
        errorDiv.className = 'mermaid-error-fallback';
        errorDiv.innerHTML = `
          <p>Failed to render diagram: ${error}</p>
          <pre>${decodeURIComponent(atob(encodedContent))}</pre>
        `;
        
        if (placeholder.parentNode) {
          placeholder.parentNode.replaceChild(errorDiv, placeholder);
        }
        
        // Mark as processed even on error to avoid retrying
        processedDiagramsRef.current.add(diagramId);
      }
    }
  }, [messageId, loadMermaid]);
  
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
  
  return { processMermaidDiagrams };
} 