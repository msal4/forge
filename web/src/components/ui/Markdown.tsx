import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import mermaid from 'mermaid';

// Initialize mermaid with theme settings
mermaid.initialize({
  startOnLoad: false,
  theme: 'base',
  themeVariables: {
    primaryColor: '#d4b896',      // parchment
    primaryTextColor: '#1a365d',  // lapis
    primaryBorderColor: '#c9a86c', // clay
    lineColor: '#1a365d',
    secondaryColor: '#f5f0e6',
    tertiaryColor: '#fff',
    background: '#faf8f5',
    mainBkg: '#d4b896',
    nodeBorder: '#1a365d',
    clusterBkg: '#f5f0e6',
    titleColor: '#1a365d',
    edgeLabelBackground: '#faf8f5',
  },
  fontFamily: 'ui-serif, Georgia, serif',
});

// Mermaid diagram component
function MermaidDiagram({ chart }: { chart: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const renderDiagram = async () => {
      if (!containerRef.current) return;

      try {
        // Generate unique ID for this diagram
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
        const { svg } = await mermaid.render(id, chart);
        setSvg(svg);
        setError(null);
      } catch (err) {
        console.error('Mermaid rendering error:', err);
        setError(err instanceof Error ? err.message : 'Failed to render diagram');
      }
    };

    renderDiagram();
  }, [chart]);

  if (error) {
    return (
      <div className="p-4 bg-clay-100 border border-clay-300 rounded-lg text-clay-700 text-sm">
        <p className="font-medium">Diagram Error</p>
        <pre className="mt-2 text-xs overflow-auto">{error}</pre>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="my-4 flex justify-center overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

// Custom code block component
function CodeBlock({ className, children, ...props }: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) {
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';
  const code = String(children).replace(/\n$/, '');

  // Render mermaid diagrams
  if (language === 'mermaid') {
    return <MermaidDiagram chart={code} />;
  }

  // Regular code block
  return (
    <code className={className} {...props}>
      {children}
    </code>
  );
}

// Main Markdown component
interface MarkdownProps {
  children: string;
  className?: string;
}

export function Markdown({ children, className = '' }: MarkdownProps) {
  return (
    <div className={`prose prose-lapis max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code: CodeBlock,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

export default Markdown;
