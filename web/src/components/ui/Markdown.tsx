import React, { useEffect, useRef, useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import mermaid from 'mermaid';
import { useNavigate } from 'react-router-dom';

// Mermaid theme variables for light and dark modes
const lightThemeVars = {
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
};

const darkThemeVars = {
  primaryColor: '#1a365d',      // lapis
  primaryTextColor: '#f5f0e6',  // parchment
  primaryBorderColor: '#d4a017', // gold
  lineColor: '#f5f0e6',
  secondaryColor: '#12243f',
  tertiaryColor: '#0c1627',
  background: '#080e19',
  mainBkg: '#1a365d',
  nodeBorder: '#d4a017',
  clusterBkg: '#12243f',
  titleColor: '#f5f0e6',
  edgeLabelBackground: '#0c1627',
};

// Check if dark mode is active
function isDarkMode(): boolean {
  return document.documentElement.classList.contains('dark');
}

// Initialize mermaid with theme settings
function initMermaid() {
  mermaid.initialize({
    startOnLoad: false,
    theme: 'base',
    themeVariables: isDarkMode() ? darkThemeVars : lightThemeVars,
    fontFamily: 'ui-serif, Georgia, serif',
  });
}

// Mermaid diagram component
function MermaidDiagram({ chart }: { chart: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const renderDiagram = async () => {
      if (!containerRef.current) return;

      try {
        // Re-initialize mermaid with current theme before rendering
        initMermaid();
        
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
      <div className="p-4 bg-clay-100 dark:bg-clay-900/50 border border-clay-300 dark:border-clay-700 rounded-lg text-clay-700 dark:text-clay-300 text-sm">
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

// Check if a mention is the @everyone broadcast keyword
function isEveryoneMention(username: string): boolean {
  return username === 'everyone' || username === 'الجميع';
}

function replaceMentions(text: string, users?: MentionUser[]): string {
  // Supports Unicode word chars for Arabic @الجميع
  return text.replace(
    /@([\w\p{L}]+)/gu,
    (_match, mentionedUsername) => {
      // Handle @everyone / @الجميع with distinct styling
      if (isEveryoneMention(mentionedUsername)) {
        return `<span class="mention mention-everyone"><strong>@${mentionedUsername}</strong></span>`;
      }
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

function maskCodeRegions(text: string): { masked: string; regions: string[] } {
  const regions: string[] = [];

  const mask = (match: string) => {
    const index = regions.length;
    regions.push(match);
    return `\uE000${index}\uE000`;
  };

  let masked = text.replace(/```[\s\S]*?```/g, mask);
  masked = masked.replace(/`[^`\n]+`/g, mask);

  return { masked, regions };
}

function restoreCodeRegions(masked: string, regions: string[]): string {
  return masked.replace(/\uE000(\d+)\uE000/g, (_match, index) => regions[Number(index)] ?? _match);
}

// Preprocess markdown to convert @mentions to clickable links
function preprocessMentions(text: string, users?: MentionUser[]): string {
  const { masked, regions } = maskCodeRegions(text);
  return restoreCodeRegions(replaceMentions(masked, users), regions);
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
