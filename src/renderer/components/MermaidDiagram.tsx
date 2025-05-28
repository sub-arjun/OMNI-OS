import React, { useEffect, useRef, useState } from 'react';
import Debug from 'debug';

const debug = Debug('OMNI-OS:components:MermaidDiagram');

type MermaidAPI = {
  initialize: (config: any) => void;
  run: (options: { nodes: HTMLElement[] }) => Promise<void>;
};

interface MermaidDiagramProps {
  content: string;
  id?: string;
}

export default function MermaidDiagram({ content, id }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isRendered, setIsRendered] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mermaidRef = useRef<MermaidAPI | null>(null);
  const renderingRef = useRef(false);
  
  useEffect(() => {
    const loadAndRenderDiagram = async () => {
      if (!containerRef.current || renderingRef.current || isRendered) return;
      
      renderingRef.current = true;
      
      try {
        // Load mermaid dynamically if not already loaded
        if (!mermaidRef.current) {
          const mermaidModule = await import('mermaid');
          mermaidRef.current = mermaidModule.default;
          
          // Initialize with light theme
          mermaidRef.current.initialize({
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
        }
        
        // Create mermaid div
        const mermaidDiv = document.createElement('div');
        mermaidDiv.className = 'mermaid';
        mermaidDiv.textContent = content;
        mermaidDiv.style.visibility = 'hidden';
        
        // Clear container and append new div
        containerRef.current.innerHTML = '';
        containerRef.current.appendChild(mermaidDiv);
        
        // Render the diagram
        await mermaidRef.current.run({ nodes: [mermaidDiv] });
        mermaidDiv.style.visibility = 'visible';
        setIsRendered(true);
        setError(null);
        
        debug(`Successfully rendered mermaid diagram ${id}`);
      } catch (err) {
        console.error('Error rendering Mermaid diagram:', err);
        setError('Failed to render diagram');
        setIsRendered(false);
        
        // Show fallback
        if (containerRef.current) {
          containerRef.current.innerHTML = `
            <div class="mermaid-error-fallback">
              <p>Failed to render diagram. Showing source code instead:</p>
              <pre>${content}</pre>
            </div>
          `;
        }
      } finally {
        renderingRef.current = false;
      }
    };
    
    loadAndRenderDiagram();
  }, [content, id, isRendered]);
  
  return (
    <div 
      ref={containerRef}
      className="mermaid-container"
      data-diagram-id={id}
      style={{ backgroundColor: '#ffffff' }}
    >
      {!isRendered && !error && (
        <div className="text-center p-4">
          <span className="text-gray-500">Loading diagram...</span>
        </div>
      )}
    </div>
  );
} 