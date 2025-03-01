/* eslint-disable react/no-danger */
import { useTranslation } from 'react-i18next';
// @ts-ignore
import MarkdownIt from 'markdown-it';
// @ts-ignore
import mathjax3 from 'markdown-it-mathjax3';
import hljs from 'highlight.js/lib/common';
// Remove static import of mermaid
import MarkdownItCodeCopy from '../libs/markdownit-plugins/CodeCopy';
import useToast from './useToast';
import { useEffect, useRef } from 'react';

// Define mermaid module type for dynamic import
type MermaidAPI = {
  initialize: (config: any) => void;
  run: (options: { nodes: HTMLElement[] }) => Promise<void>;
};

// Unique ID generator for Mermaid diagrams
function generateMermaidId() {
  return `mermaid-diagram-${Math.random().toString(36).substring(2, 10)}`;
}

export default function useMarkdown() {
  const { notifySuccess } = useToast();
  const { t } = useTranslation();
  // Reference to store the mermaid module once loaded
  const mermaidRef = useRef<MermaidAPI | null>(null);
  // Track if we're currently loading mermaid
  const loadingMermaid = useRef(false);
  
  // Load mermaid dynamically
  const loadMermaid = async (): Promise<MermaidAPI | null> => {
    // Return existing reference if already loaded
    if (mermaidRef.current) {
      return mermaidRef.current;
    }
    
    // Prevent multiple concurrent loads
    if (loadingMermaid.current) {
      // Wait for current load to finish
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (mermaidRef.current) {
            clearInterval(checkInterval);
            resolve(mermaidRef.current);
          }
        }, 100);
      });
    }
    
    try {
      loadingMermaid.current = true;
      // Dynamic import
      const mermaidModule = await import('mermaid');
      const mermaid = mermaidModule.default;
      
      // Initialize with current theme
      mermaid.initialize({
        startOnLoad: false,
        theme: document.body.getAttribute('data-theme') === 'dark' ? 'dark' : 'default',
        fontSize: 14,
        securityLevel: 'loose' // May help with certain rendering issues
      });
      
      mermaidRef.current = mermaid;
      return mermaid;
    } catch (error) {
      console.error('Failed to load mermaid:', error);
      return null;
    } finally {
      loadingMermaid.current = false;
    }
  };
  
  // Initialize mermaid and set up theme observer
  useEffect(() => {
    // Load mermaid initially
    loadMermaid();
    
    // Update theme when it changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'data-theme' && mermaidRef.current) {
          const theme = document.body.getAttribute('data-theme') === 'dark' ? 'dark' : 'default';
          mermaidRef.current.initialize({
            startOnLoad: false,
            theme: theme,
            fontSize: 14,
            securityLevel: 'loose'
          });
        }
      });
    });
    
    observer.observe(document.body, { attributes: true });
    
    return () => observer.disconnect();
  }, []);
  
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
    highlight(str: string, lang: string) {
      // Special handling for Mermaid diagrams
      if (lang === 'mermaid') {
        const diagramId = generateMermaidId();
        // Just mark it as mermaid and let external processor handle it
        return `<pre class="mermaid-diagram" data-lang="mermaid"><code id="${diagramId}">${str}</code></pre>`;
      }

      // notice: 硬编码解决 ellipsis-loader 被转移为代码显示的问题。
      const loader = '<span class="blinking-cursor" /></span>';
      const isLoading = str.indexOf(loader) > -1;
      let code = str;
      if (isLoading) {
        code = str.replace(loader, '');
      }

      if (lang && hljs.getLanguage(lang)) {
        try {
          return (
            `<pre className="hljs">` +
            `<code>${
              hljs.highlight(code, {
                language: lang,
                ignoreIllegals: true,
              }).value
            }${isLoading ? loader : ''}</code></pre>`
          );
        } catch (__) {
          return (
            `<pre className="hljs">` +
            `<code>${hljs.highlightAuto(code).value}${
              isLoading ? loader : ''
            }</code>` +
            `</pre>`
          );
        }
      }
      return (
        `<pre className="hljs">` +
        `<code>${hljs.highlightAuto(code).value}${
          isLoading ? loader : ''
        }</code>` +
        `</pre>`
      );
    },
  })
    .use(mathjax3)
    .use(MarkdownItCodeCopy, {
      element:
        '<svg class="___1okpztj f1w7gpdv fez10in fg4l7m0 f16hsg94 fwpfdsa f88nxoq f1e2fz10" fill="currentColor" aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M4 4.09v6.41A2.5 2.5 0 0 0 6.34 13h4.57c-.2.58-.76 1-1.41 1H6a3 3 0 0 1-3-3V5.5c0-.65.42-1.2 1-1.41ZM11.5 2c.83 0 1.5.67 1.5 1.5v7c0 .83-.67 1.5-1.5 1.5h-5A1.5 1.5 0 0 1 5 10.5v-7C5 2.67 5.67 2 6.5 2h5Zm0 1h-5a.5.5 0 0 0-.5.5v7c0 .28.22.5.5.5h5a.5.5 0 0 0 .5-.5v-7a.5.5 0 0 0-.5-.5Z" fill="currentColor"></path></svg>',
      onSuccess: () => {
        notifySuccess(t('Common.Notification.Copied'));
      },
    });
  const defaultRender =
    md.renderer.rules.link_open ||
    function (tokens: any, idx: any, options: any, env: any, self: any) {
      return self.renderToken(tokens, idx, options);
    };
  md.renderer.rules.link_open = function (
    tokens: any,
    idx: any,
    options: any,
    env: any,
    self: any,
  ) {
    // Add a new `target` attribute, or replace the value of the existing one.
    tokens[idx].attrSet('target', '_blank');
    // Pass the token to the default renderer.
    return defaultRender(tokens, idx, options, env, self);
  };
  
  // Process mermaid diagrams after they've been rendered as code blocks
  const processMermaidDiagrams = async () => {
    try {
      const mermaid = await loadMermaid();
      if (!mermaid) {
        console.error('Mermaid library not available');
        return;
      }
      
      const diagrams = document.querySelectorAll('pre.mermaid-diagram:not(.processed)');
      if (diagrams.length === 0) return;
      
      diagrams.forEach(async (pre) => {
        try {
          // Mark as processed immediately to prevent double processing
          pre.classList.add('processed');
          
          const code = pre.querySelector('code');
          if (!code || !code.textContent) return;
          
          // Create a new div for the rendered diagram
          const container = document.createElement('div');
          container.className = 'mermaid-container';
          
          // Create a div to hold the actual diagram with proper classes
          const mermaidDiv = document.createElement('div');
          mermaidDiv.className = 'mermaid';
          mermaidDiv.style.visibility = 'hidden'; // Hide until rendered
          mermaidDiv.textContent = code.textContent;
          
          // Add a fallback message in case rendering fails
          const fallbackDiv = document.createElement('div');
          fallbackDiv.className = 'mermaid-error-fallback';
          fallbackDiv.style.display = 'none';
          fallbackDiv.innerHTML = `<p>Failed to render diagram. Showing source code instead:</p>
                                  <pre>${code.textContent}</pre>`;
          
          container.appendChild(mermaidDiv);
          container.appendChild(fallbackDiv);
          
          // Replace the pre element with the mermaid container
          if (pre.parentNode) {
            pre.parentNode.replaceChild(container, pre);
          }
          
          try {
            // Render the diagram using the imported mermaid library
            await mermaid.run({ nodes: [mermaidDiv] });
            mermaidDiv.style.visibility = 'visible';
          } catch (renderError) {
            console.error('Error rendering Mermaid diagram:', renderError);
            // Show fallback on error
            mermaidDiv.style.display = 'none';
            fallbackDiv.style.display = 'block';
          }
        } catch (diagramError) {
          console.error('Error processing Mermaid diagram:', diagramError);
        }
      });
    } catch (error) {
      console.error('Error in processMermaidDiagrams:', error);
    }
  };
  
  return {
    render: (str: string): string => {
      const result = md.render(str);
      // Defer mermaid processing to allow the DOM to be updated
      setTimeout(processMermaidDiagrams, 100);
      return result;
    }
  };
}
