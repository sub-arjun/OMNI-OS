import React, { useEffect } from 'react';
import useMarkdown from 'hooks/useMarkdown';
import useMermaidRenderer from 'hooks/useMermaidRenderer';

export default function TestMermaid() {
  const { render } = useMarkdown();
  const { processMermaidDiagrams } = useMermaidRenderer('test-mermaid-component');
  
  const testContent = `
Here's a test mermaid diagram:

\`\`\`mermaid
graph TD
    A[Start] --> B{Is it working?}
    B -->|Yes| C[Great!]
    B -->|No| D[Debug more]
    C --> E[End]
    D --> E[End]
\`\`\`

End of test.
`;

  useEffect(() => {
    console.log('[TestMermaid] Component mounted, processing diagrams...');
    // Process diagrams after render
    setTimeout(() => {
      processMermaidDiagrams();
    }, 100);
  }, [processMermaidDiagrams]);

  const html = render(testContent);
  console.log('[TestMermaid] Rendered HTML:', html);

  return (
    <div id="test-mermaid-component" style={{ padding: '20px', backgroundColor: '#f0f0f0' }}>
      <h2>Mermaid Test Component</h2>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
} 