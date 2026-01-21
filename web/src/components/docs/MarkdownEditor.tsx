import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Eye, Edit3, Maximize2, Minimize2 } from 'lucide-react';
import { HotkeyBadge } from '../ui/HotkeyBadge';

// ============================================
// Markdown Editor with Live Preview
// ============================================

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

type ViewMode = 'edit' | 'preview' | 'split';

export function MarkdownEditor({ 
  value, 
  onChange, 
  placeholder = 'Write your content in Markdown...',
  className = '' 
}: MarkdownEditorProps) {
  const [viewMode, setViewMode] = React.useState<ViewMode>('split');
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Handle keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.key) return;
      
      // Ctrl/Cmd + E to toggle edit mode
      if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault();
        setViewMode(viewMode === 'edit' ? 'split' : 'edit');
      }
      // Ctrl/Cmd + P to toggle preview
      if ((e.ctrlKey || e.metaKey) && e.key === 'p' && e.shiftKey) {
        e.preventDefault();
        setViewMode(viewMode === 'preview' ? 'split' : 'preview');
      }
      // Escape to exit fullscreen
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, isFullscreen]);

  // Auto-resize textarea
  React.useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea && viewMode !== 'preview') {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.max(textarea.scrollHeight, 300)}px`;
    }
  }, [value, viewMode]);

  const containerClasses = isFullscreen
    ? 'fixed inset-0 z-50 bg-parchment-50'
    : className;

  return (
    <div className={`flex flex-col ${containerClasses}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-parchment-100 border-b border-parchment-300 rounded-t-tablet">
        {/* View mode tabs */}
        <div className="flex items-center gap-1 bg-parchment-200 rounded-tablet p-0.5">
          <button
            onClick={() => setViewMode('edit')}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-tablet text-sm font-medium
              transition-colors
              ${viewMode === 'edit' 
                ? 'bg-parchment-50 text-lapis-600 shadow-sm' 
                : 'text-lapis-500 hover:text-lapis-600'}
            `}
          >
            <Edit3 size={14} />
            Edit
          </button>
          <button
            onClick={() => setViewMode('split')}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-tablet text-sm font-medium
              transition-colors
              ${viewMode === 'split' 
                ? 'bg-parchment-50 text-lapis-600 shadow-sm' 
                : 'text-lapis-500 hover:text-lapis-600'}
            `}
          >
            Split
          </button>
          <button
            onClick={() => setViewMode('preview')}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-tablet text-sm font-medium
              transition-colors
              ${viewMode === 'preview' 
                ? 'bg-parchment-50 text-lapis-600 shadow-sm' 
                : 'text-lapis-500 hover:text-lapis-600'}
            `}
          >
            <Eye size={14} />
            Preview
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <HotkeyBadge keys="Ctrl+E" size="sm" />
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded hover:bg-parchment-200 text-lapis-500"
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>

      {/* Editor/Preview area */}
      <div className={`flex-1 flex ${isFullscreen ? 'h-full' : 'min-h-[400px]'}`}>
        {/* Editor */}
        {viewMode !== 'preview' && (
          <div className={`${viewMode === 'split' ? 'w-1/2 border-r border-parchment-300' : 'w-full'} flex flex-col`}>
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              className={`
                flex-1 w-full p-4 resize-none
                font-code text-sm text-lapis-700
                bg-parchment-50 
                focus:outline-none
                placeholder:text-lapis-400
                ${isFullscreen ? 'h-full' : 'min-h-[400px]'}
              `}
              spellCheck={false}
            />
          </div>
        )}

        {/* Preview */}
        {viewMode !== 'edit' && (
          <div className={`${viewMode === 'split' ? 'w-1/2' : 'w-full'} overflow-auto bg-parchment-50`}>
            <div className="p-4 prose prose-mesopotamian max-w-none">
              {value ? (
                <ReactMarkdown>{value}</ReactMarkdown>
              ) : (
                <p className="text-lapis-400 italic">Preview will appear here...</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
