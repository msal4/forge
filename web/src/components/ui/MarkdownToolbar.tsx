import React, { useRef } from 'react';
import { ImageIcon, Loader2 } from 'lucide-react';

// ============================================
// Markdown Toolbar Component
// Toolbar with image upload button for markdown editors
// ============================================

interface MarkdownToolbarProps {
  onImageSelect: (file: File) => void;
  uploading?: boolean;
  disabled?: boolean;
  className?: string;
}

export function MarkdownToolbar({
  onImageSelect,
  uploading = false,
  disabled = false,
  className = '',
}: MarkdownToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImageSelect(file);
      // Reset input so same file can be selected again
      e.target.value = '';
    }
  };

  return (
    <div className={`flex items-center gap-1 px-2 py-1 bg-parchment-100 border border-parchment-300 border-b-0 rounded-t-lg ${className}`}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif"
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled || uploading}
      />

      {/* Image upload button */}
      <button
        type="button"
        onClick={handleButtonClick}
        disabled={disabled || uploading}
        title="Insert image (paste or drag-drop also works)"
        className="
          flex items-center gap-1.5 px-2 py-1
          text-sm text-lapis-600
          rounded hover:bg-parchment-200
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-colors
        "
      >
        {uploading ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            <span className="text-xs">Uploading...</span>
          </>
        ) : (
          <>
            <ImageIcon size={16} />
            <span className="text-xs hidden sm:inline">Image</span>
          </>
        )}
      </button>

      {/* Hint text */}
      <span className="ml-auto text-xs text-stone-400 hidden md:inline">
        Paste or drag images
      </span>
    </div>
  );
}
