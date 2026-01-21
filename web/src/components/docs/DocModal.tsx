import React from 'react';
import { X } from 'lucide-react';
import { ButtonWithHotkey } from '../ui/HotkeyBadge';
import { MarkdownEditor } from './MarkdownEditor';
import { useKeyboardShortcuts } from '../../hooks/useKeyboard';
import type { Doc, CreateDocRequest, UpdateDocRequest } from '../../api/docs';

// ============================================
// Doc Modal - Create/Edit documents
// ============================================

interface DocModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: CreateDocRequest | UpdateDocRequest) => Promise<void>;
  doc?: Doc | null;
  docs: Doc[]; // For parent selection
  isLoading?: boolean;
}

export function DocModal({ 
  isOpen, 
  onClose, 
  onSave, 
  doc, 
  docs,
  isLoading 
}: DocModalProps) {
  const [title, setTitle] = React.useState('');
  const [content, setContent] = React.useState('');
  const [parentId, setParentId] = React.useState<number | ''>('');
  const [error, setError] = React.useState('');
  
  const titleInputRef = React.useRef<HTMLInputElement>(null);
  const isEditing = !!doc;

  // Populate form when editing
  React.useEffect(() => {
    if (doc) {
      setTitle(doc.title);
      setContent(doc.content || '');
      setParentId(doc.parentId || '');
    } else {
      setTitle('');
      setContent('');
      setParentId('');
    }
    setError('');
  }, [doc, isOpen]);

  // Focus title input when modal opens
  React.useEffect(() => {
    if (isOpen && !doc) {
      setTimeout(() => titleInputRef.current?.focus(), 100);
    }
  }, [isOpen, doc]);

  // Keyboard shortcuts
  useKeyboardShortcuts([
    {
      keys: 'Escape',
      description: 'Close modal',
      handler: onClose,
      global: true,
    },
    {
      keys: 'Ctrl+s',
      description: 'Save document',
      handler: () => handleSubmit(),
      global: true,
    },
  ]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    try {
      const data: CreateDocRequest | UpdateDocRequest = {
        title: title.trim(),
        content: content || undefined,
        parentId: parentId || undefined,
      };
      
      await onSave(data);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save document');
    }
  };

  // Get available parent docs (exclude current doc and its descendants)
  const availableParents = React.useMemo(() => {
    if (!doc) return docs;
    
    // Simple filter - just exclude the current doc for now
    return docs.filter(d => d.id !== doc.id);
  }, [docs, doc]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-lapis-900/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden bg-parchment-50 rounded-tablet shadow-tablet border border-parchment-300 m-4 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-parchment-300 shrink-0">
          <h2 className="text-lg font-inscription text-lapis-600">
            {isEditing ? 'Edit Scroll' : 'New Scroll'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-parchment-200 text-lapis-500"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          {/* Error */}
          {error && (
            <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-tablet text-red-600 text-sm">
              {error}
            </div>
          )}

          {/* Title & Parent */}
          <div className="px-6 py-4 space-y-4 shrink-0">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-lapis-600 mb-1">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                ref={titleInputRef}
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Document title..."
                className="w-full px-3 py-2 rounded-tablet border border-parchment-300 
                           bg-parchment-100 text-lapis-700
                           focus:border-lapis-400 focus:ring-1 focus:ring-lapis-400 focus:outline-none
                           placeholder:text-lapis-400"
              />
            </div>

            {/* Parent selection */}
            {availableParents.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-lapis-600 mb-1">
                  Parent Document
                </label>
                <select
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2 rounded-tablet border border-parchment-300 
                             bg-parchment-100 text-lapis-700
                             focus:border-lapis-400 focus:ring-1 focus:ring-lapis-400 focus:outline-none"
                >
                  <option value="">None (root level)</option>
                  {availableParents.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Content Editor */}
          <div className="flex-1 overflow-hidden border-t border-parchment-300">
            <MarkdownEditor
              value={content}
              onChange={setContent}
              placeholder="Write your scroll content in Markdown..."
              className="h-full"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-parchment-300 bg-parchment-100 shrink-0">
          <ButtonWithHotkey
            type="button"
            variant="ghost"
            onClick={onClose}
            hotkey="Escape"
          >
            Cancel
          </ButtonWithHotkey>
          <ButtonWithHotkey
            type="submit"
            variant="primary"
            onClick={handleSubmit}
            disabled={isLoading}
            hotkey="Ctrl+S"
          >
            {isLoading ? 'Saving...' : (isEditing ? 'Save Changes' : 'Create Document')}
          </ButtonWithHotkey>
        </div>
      </div>
    </div>
  );
}
