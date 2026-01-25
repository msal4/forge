import React, { useEffect, useRef, useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import mermaid from 'mermaid';
import { useNavigate } from 'react-router-dom';

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

// User type for mention linking
interface MentionUser {
  id: number;
  username: string;
}

// Preprocess markdown to convert @mentions to clickable links
function preprocessMentions(text: string, users?: MentionUser[]): string {
  // Match @username but not inside code blocks or inline code
  // This regex avoids matching inside backticks
  return text.replace(
    /(?<!`)@([a-zA-Z0-9_]+)(?!`)/g,
    (_match, mentionedUsername) => {
      // Try to find the user to verify they exist
      const user = users?.find(u => u.username.toLowerCase() === mentionedUsername.toLowerCase());
      if (user) {
        return `<a href="/profile/${user.username}" class="mention" data-mention="${mentionedUsername}">@${mentionedUsername}</a>`;
      }
      // If user not found, just render as styled span
      return `<span class="mention">@${mentionedUsername}</span>`;
    }
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
  /** Optional list of users for linking @mentions to profiles */
  users?: MentionUser[];
}

export function Markdown({ children, className = '', users }: MarkdownProps) {
  const navigate = useNavigate();
  
  // Preprocess to convert @mentions to clickable links
  const processedContent = preprocessMentions(children, users);

  // Intercept clicks on internal links (mentions) to use React Router navigation
  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest('a');
    
    if (anchor) {
      const href = anchor.getAttribute('href');
      // Check if it's an internal link (starts with /)
      if (href?.startsWith('/')) {
        e.preventDefault();
        navigate(href);
      }
    }
  }, [navigate]);
  
  return (
    <div 
      className={`prose prose-lapis max-w-none ${className}`}
      onClick={handleClick}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          code: CodeBlock,
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}

export default Markdown;
