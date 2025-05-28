/* eslint-disable react/no-danger */
import { useTranslation } from 'react-i18next';
// @ts-ignore
import MarkdownIt from 'markdown-it';
// @ts-ignore
import mathjax3 from 'markdown-it-mathjax3';
import hljs from 'highlight.js/lib/common';
import MarkdownItCodeCopy from '../libs/markdownit-plugins/CodeCopy';
import useToast from './useToast';
import { useCallback } from 'react';

// Unique ID generator for Mermaid diagrams
function generateMermaidId(content: string) {
  // Create a simple hash of the content to generate a consistent ID
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `mermaid-diagram-${Math.abs(hash).toString(36)}`;
}

export default function useMarkdown() {
  const { notifySuccess } = useToast();
  const { t } = useTranslation();
  
  const md = new MarkdownIt({
    breaks: true,
    linkify: true,
    html: true,
    typographer: true,
    highlight(str: string, lang: string, attrs: string) {
      // Special handling for Mermaid diagrams
      if (lang === 'mermaid') {
        console.log(`[Mermaid] Highlight called with lang="${lang}", content length=${str.length}`);
        
        // Clean up the mermaid content - replace HTML tags with their text equivalents
        let cleanContent = str
          .replace(/<br\s*\/?>/gi, '\n') // Replace <br> with newline
          .replace(/<[^>]+>/g, ''); // Remove any other HTML tags
        
        // Additional cleaning for Mermaid syntax compatibility
        // Replace parentheses in node labels to avoid parsing issues
        cleanContent = cleanContent
          .replace(/\[([^\]]*)\]/g, (match, content) => {
            // Replace parentheses inside square brackets with dashes
            const cleanedContent = content.replace(/[()]/g, '-');
            return `[${cleanedContent}]`;
          });
        
        console.log(`[Mermaid] Cleaned content:`, cleanContent);
        
        const diagramId = generateMermaidId(cleanContent);
        // Return a placeholder that will be processed by useMermaidRenderer
        const encodedContent = btoa(encodeURIComponent(cleanContent));
        const placeholder = `<div class="mermaid-placeholder" data-diagram-id="${diagramId}" data-content="${encodedContent}">
          <pre class="mermaid-source"><code>${str}</code></pre>
        </div>`;
        console.log(`[Mermaid] Generated placeholder for diagram ${diagramId}`);
        return placeholder;
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
            `<pre class="hljs">` +
            `<code>${
              hljs.highlight(code, {
                language: lang,
                ignoreIllegals: true,
              }).value
            }${isLoading ? loader : ''}</code></pre>`
          );
        } catch (__) {
          return (
            `<pre class="hljs">` +
            `<code>${hljs.highlightAuto(code).value}${
              isLoading ? loader : ''
            }</code>` +
            `</pre>`
          );
        }
      }
      return (
        `<pre class="hljs">` +
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
  
  // Enable fenced code blocks (should be enabled by default, but good to be explicit)
  md.enable('fence');
  
  // Override paragraph rendering to ensure word wrapping
  const defaultParagraphRenderer = md.renderer.rules.paragraph_open || function(
    tokens: any[], 
    idx: number, 
    options: any, 
    env: any, 
    self: any
  ) {
    return self.renderToken(tokens, idx, options);
  };
  
  md.renderer.rules.paragraph_open = function(
    tokens: any[], 
    idx: number, 
    options: any, 
    env: any, 
    self: any
  ) {
    // Add classes for word wrapping
    tokens[idx].attrJoin('class', 'break-words');
    return defaultParagraphRenderer(tokens, idx, options, env, self);
  };
  
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
  
  const render = useCallback((str: string): string => {
    // Only log if the input contains mermaid-related content
    if (str.includes('```mermaid')) {
      console.log('[Mermaid] Render called with mermaid content:', str.substring(0, 200) + '...');
      console.log('[Mermaid] Input contains mermaid code block');
    }
    
    const result = md.render(str);
    
    // Only log if the result contains mermaid placeholders
    if (result.includes('mermaid-placeholder')) {
      console.log('[Mermaid] Rendered markdown contains mermaid placeholder');
      console.log('[Mermaid] Result preview:', result.substring(0, 500) + '...');
    }
    
    return result;
  }, []);
  
  return {
    render
  };
}
