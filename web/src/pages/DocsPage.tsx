import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  Plus, 
  FolderOpen, 
  FileText, 
  ChevronRight, 
  ArrowLeft,
  Edit3,
  Trash2,
  Loader2,
  RefreshCw,
  User,
  Clock,
  X,
  Check,
  Eye
} from 'lucide-react';
import { ButtonWithHotkey } from '../components/ui/HotkeyBadge';
import { useKeyboardShortcuts } from '../hooks/useKeyboard';
import { docsApi, type Doc, type CreateDocRequest, type UpdateDocRequest } from '../api/docs';

// ============================================
// Docs Page - The Library (Documentation)
// Inline editing without modals
// ============================================

type PageMode = 'list' | 'view' | 'edit' | 'create';

export function DocsPage() {
  const { docId } = useParams();
  const navigate = useNavigate();
  
  // Data state
  const [docs, setDocs] = React.useState<Doc[]>([]);
  const [selectedDoc, setSelectedDoc] = React.useState<Doc | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  
  // Page mode: list, view, edit, or create
  const [mode, setMode] = React.useState<PageMode>('list');
  
  // Edit form state
  const [editTitle, setEditTitle] = React.useState('');
  const [editContent, setEditContent] = React.useState('');
  const [editParentId, setEditParentId] = React.useState<number | ''>('');
  const [isSaving, setIsSaving] = React.useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false);
  
  const titleInputRef = React.useRef<HTMLInputElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Helper to select doc and update URL
  const selectDoc = React.useCallback((doc: Doc | null) => {
    if (doc) {
      navigate(`/docs/${doc.id}`);
    } else {
      navigate('/docs');
    }
  }, [navigate]);

  // Load docs
  const loadDocs = React.useCallback(async (signal?: AbortSignal) => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await docsApi.list({ signal });
      setDocs(data);
      return data;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return [];
      }
      setError(err instanceof Error ? err.message : 'Failed to load documents');
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load data on mount
  React.useEffect(() => {
    const controller = new AbortController();
    loadDocs(controller.signal);
    return () => controller.abort();
  }, [loadDocs]);

  // Handle URL param changes for doc selection
  React.useEffect(() => {
    if (docId && docs.length > 0) {
      const doc = docs.find(d => d.id === Number(docId));
      if (doc) {
        // Fetch full doc content
        docsApi.get(doc.id).then(fullDoc => {
          setSelectedDoc(fullDoc);
          if (mode !== 'edit') {
            setMode('view');
          }
        }).catch(err => {
          setError(err instanceof Error ? err.message : 'Failed to load document');
        });
      }
    } else if (!docId) {
      setSelectedDoc(null);
      if (mode !== 'create') {
        setMode('list');
      }
    }
  }, [docId, docs]);

  // Track unsaved changes
  React.useEffect(() => {
    if (mode === 'edit' && selectedDoc) {
      const titleChanged = editTitle !== selectedDoc.title;
      const contentChanged = editContent !== (selectedDoc.content || '');
      const parentChanged = editParentId !== (selectedDoc.parentId || '');
      setHasUnsavedChanges(titleChanged || contentChanged || parentChanged);
    } else if (mode === 'create') {
      setHasUnsavedChanges(editTitle.trim() !== '' || editContent.trim() !== '');
    } else {
      setHasUnsavedChanges(false);
    }
  }, [mode, editTitle, editContent, editParentId, selectedDoc]);

  // Enter edit mode
  const enterEditMode = React.useCallback((doc?: Doc) => {
    const docToEdit = doc || selectedDoc;
    if (docToEdit) {
      setEditTitle(docToEdit.title);
      setEditContent(docToEdit.content || '');
      setEditParentId(docToEdit.parentId || '');
      setMode('edit');
      // Focus textarea after transition
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [selectedDoc]);

  // Enter create mode
  const enterCreateMode = React.useCallback(() => {
    setEditTitle('');
    setEditContent('');
    setEditParentId('');
    setSelectedDoc(null);
    setMode('create');
    // Focus title input after transition
    setTimeout(() => titleInputRef.current?.focus(), 100);
  }, []);

  // Cancel editing
  const cancelEdit = React.useCallback(() => {
    if (hasUnsavedChanges) {
      if (!confirm('You have unsaved changes. Discard them?')) {
        return;
      }
    }
    if (mode === 'create') {
      setMode('list');
      navigate('/docs');
    } else {
      setMode('view');
    }
    setHasUnsavedChanges(false);
  }, [mode, hasUnsavedChanges, navigate]);

  // Save document
  const saveDocument = React.useCallback(async () => {
    if (!editTitle.trim()) {
      setError('Title is required');
      titleInputRef.current?.focus();
      return;
    }

    setIsSaving(true);
    setError(null);
    
    try {
      const data: CreateDocRequest | UpdateDocRequest = {
        title: editTitle.trim(),
        content: editContent || undefined,
        parentId: editParentId || undefined,
      };
      
      if (mode === 'edit' && selectedDoc) {
        const updated = await docsApi.update(selectedDoc.id, data as UpdateDocRequest);
        setDocs(prev => prev.map(d => d.id === updated.id ? updated : d));
        setSelectedDoc(updated);
        setMode('view');
      } else if (mode === 'create') {
        const created = await docsApi.create(data as CreateDocRequest);
        setDocs(prev => [...prev, created]);
        setSelectedDoc(created);
        navigate(`/docs/${created.id}`);
        setMode('view');
      }
      setHasUnsavedChanges(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save document');
    } finally {
      setIsSaving(false);
    }
  }, [editTitle, editContent, editParentId, mode, selectedDoc, navigate]);

  // Delete document
  const handleDeleteDoc = async (doc: Doc) => {
    if (!confirm(`Delete "${doc.title}"? This cannot be undone.`)) return;
    
    try {
      await docsApi.delete(doc.id);
      setDocs(prev => prev.filter(d => d.id !== doc.id));
      if (selectedDoc?.id === doc.id) {
        setSelectedDoc(null);
        setMode('list');
        navigate('/docs');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete document');
    }
  };

  // View document
  const handleViewDoc = async (doc: Doc) => {
    selectDoc(doc);
  };

  // Keyboard shortcuts
  useKeyboardShortcuts([
    {
      keys: 'c',
      description: 'Create new document',
      handler: () => {
        if (mode === 'list') {
          enterCreateMode();
        }
      },
      category: 'actions',
    },
    {
      keys: 'e',
      description: 'Edit document',
      handler: () => {
        if (mode === 'view' && selectedDoc) {
          enterEditMode();
        }
      },
      category: 'actions',
    },
    {
      keys: 'r',
      description: 'Refresh documents',
      handler: () => {
        if (mode === 'list') {
          loadDocs();
        }
      },
      category: 'actions',
    },
    {
      keys: 'Escape',
      description: 'Back / Cancel',
      handler: () => {
        if (mode === 'edit' || mode === 'create') {
          cancelEdit();
        } else if (mode === 'view') {
          selectDoc(null);
        }
      },
      category: 'navigation',
    },
    {
      keys: 'Ctrl+s',
      description: 'Save document',
      handler: () => {
        if (mode === 'edit' || mode === 'create') {
          saveDocument();
        }
      },
      category: 'actions',
      global: true,
    },
  ]);

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('de-DE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  // Get available parent docs
  const availableParents = React.useMemo(() => {
    if (!selectedDoc) return docs;
    return docs.filter(d => d.id !== selectedDoc.id);
  }, [docs, selectedDoc]);

  const isEditing = mode === 'edit' || mode === 'create';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {(mode === 'view' || mode === 'edit') && (
            <button
              onClick={() => {
                if (isEditing && hasUnsavedChanges) {
                  if (!confirm('You have unsaved changes. Discard them?')) {
                    return;
                  }
                }
                selectDoc(null);
                setMode('list');
              }}
              className="p-2 rounded-tablet hover:bg-parchment-200 text-lapis-500 transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          {mode === 'create' && (
            <button
              onClick={cancelEdit}
              className="p-2 rounded-tablet hover:bg-parchment-200 text-lapis-500 transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-inscription text-lapis-600">
              {mode === 'create' 
                ? 'New Scroll'
                : mode === 'edit' 
                  ? 'Editing Scroll'
                  : selectedDoc 
                    ? selectedDoc.title 
                    : 'The Library'}
            </h1>
            <p className="text-lapis-500 text-sm">
              {mode === 'create'
                ? 'Create a new document'
                : mode === 'edit'
                  ? hasUnsavedChanges ? 'Unsaved changes' : 'No changes'
                  : selectedDoc 
                    ? `Last updated ${formatDate(selectedDoc.updatedAt)}`
                    : 'Scrolls of knowledge, preserved for eternity'}
            </p>
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-2">
          {mode === 'list' && (
            <>
              <ButtonWithHotkey
                variant="secondary"
                hotkey="r"
                onClick={() => loadDocs()}
                disabled={isLoading}
              >
                {isLoading ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                Refresh
              </ButtonWithHotkey>
              <ButtonWithHotkey
                variant="primary"
                hotkey="c"
                onClick={enterCreateMode}
              >
                <Plus size={18} />
                New Document
              </ButtonWithHotkey>
            </>
          )}
          
          {mode === 'view' && selectedDoc && (
            <>
              <ButtonWithHotkey
                variant="secondary"
                onClick={() => enterEditMode()}
                hotkey="e"
              >
                <Edit3 size={18} />
                Edit
              </ButtonWithHotkey>
              <ButtonWithHotkey
                variant="ghost"
                onClick={() => handleDeleteDoc(selectedDoc)}
                className="text-red-600 hover:bg-red-50"
              >
                <Trash2 size={18} />
              </ButtonWithHotkey>
            </>
          )}
          
          {isEditing && (
            <>
              <ButtonWithHotkey
                variant="ghost"
                onClick={cancelEdit}
                hotkey="Escape"
              >
                <X size={18} />
                Cancel
              </ButtonWithHotkey>
              <ButtonWithHotkey
                variant="primary"
                onClick={saveDocument}
                disabled={isSaving}
                hotkey="Ctrl+S"
              >
                {isSaving ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Check size={18} />
                )}
                {isSaving ? 'Saving...' : 'Save'}
              </ButtonWithHotkey>
            </>
          )}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-tablet text-red-600">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Loading state */}
      {isLoading && docs.length === 0 && mode === 'list' && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 size={32} className="animate-spin text-lapis-500 mx-auto mb-2" />
            <p className="text-lapis-500">Loading scrolls...</p>
          </div>
        </div>
      )}

      {/* Document View Mode */}
      {mode === 'view' && selectedDoc && (
        <div className="tablet-card p-6 transition-all duration-200">
          <div className="prose prose-mesopotamian max-w-none">
            {selectedDoc.content ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{selectedDoc.content}</ReactMarkdown>
            ) : (
              <p className="text-lapis-400 italic">This scroll is empty.</p>
            )}
          </div>
          
          {/* Document metadata */}
          <div className="mt-6 pt-4 border-t border-parchment-300 flex items-center gap-4 text-sm text-lapis-500">
            {selectedDoc.author && (
              <div className="flex items-center gap-1">
                <User size={14} />
                <span>{selectedDoc.author.fullName || selectedDoc.author.username}</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <Clock size={14} />
              <span>Created {formatDate(selectedDoc.createdAt)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Document Edit/Create Mode */}
      {isEditing && (
        <div className="tablet-card overflow-hidden transition-all duration-200">
          {/* Title & Parent */}
          <div className="p-6 space-y-4 border-b border-parchment-200">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-lapis-600 mb-1">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                ref={titleInputRef}
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Document title..."
                className="w-full px-3 py-2 rounded-tablet border border-parchment-300 
                           bg-parchment-100 text-lapis-700 text-lg font-medium
                           focus:border-lapis-400 focus:ring-1 focus:ring-lapis-400 focus:outline-none
                           placeholder:text-lapis-400 transition-colors"
              />
            </div>

            {/* Parent selection */}
            {availableParents.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-lapis-600 mb-1">
                  Parent Document
                </label>
                <select
                  value={editParentId}
                  onChange={(e) => setEditParentId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2 rounded-tablet border border-parchment-300 
                             bg-parchment-100 text-lapis-700
                             focus:border-lapis-400 focus:ring-1 focus:ring-lapis-400 focus:outline-none
                             transition-colors"
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
          <InlineMarkdownEditor
            value={editContent}
            onChange={setEditContent}
            textareaRef={textareaRef}
            placeholder="Write your scroll content in Markdown..."
          />
        </div>
      )}

      {/* Document List */}
      {mode === 'list' && !isLoading && (
        <>
          {docs.length === 0 ? (
            <div className="tablet-card p-8 text-center">
              <FolderOpen className="mx-auto text-lapis-300" size={48} />
              <h3 className="mt-4 font-inscription text-lg text-lapis-600">
                The Library awaits your scrolls
              </h3>
              <p className="mt-2 text-lapis-500 text-sm">
                Create your first document to begin building your knowledge base.
              </p>
              <p className="mt-4 text-xs text-lapis-400">
                Supports Markdown with live preview
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {docs.map(doc => (
                <DocCard
                  key={doc.id}
                  doc={doc}
                  onClick={() => handleViewDoc(doc)}
                  onEdit={() => {
                    selectDoc(doc);
                    // Wait for doc to load then enter edit mode
                    docsApi.get(doc.id).then(fullDoc => {
                      setSelectedDoc(fullDoc);
                      enterEditMode(fullDoc);
                    });
                  }}
                  onDelete={() => handleDeleteDoc(doc)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Features hint (only shown when no docs) */}
      {mode === 'list' && docs.length === 0 && !isLoading && (
        <div className="bg-lapis-500/5 border border-lapis-200 rounded-tablet p-4">
          <h3 className="font-medium text-lapis-600 mb-2">Documentation Features</h3>
          <ul className="text-sm text-lapis-500 space-y-1">
            <li>Full Markdown support with live preview</li>
            <li>Inline editing without interruptions</li>
            <li>Hierarchical organization with folders</li>
            <li>Keyboard shortcuts for power users</li>
          </ul>
        </div>
      )}
    </div>
  );
}

// ============================================
// Inline Markdown Editor Component
// ============================================

interface InlineMarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  placeholder?: string;
}

type EditorViewMode = 'edit' | 'preview' | 'split';

function InlineMarkdownEditor({ 
  value, 
  onChange, 
  textareaRef,
  placeholder = 'Write your content in Markdown...'
}: InlineMarkdownEditorProps) {
  const [viewMode, setViewMode] = React.useState<EditorViewMode>('split');

  // Handle keyboard shortcuts for editor
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.key) return;
      
      // Ctrl/Cmd + E to toggle edit mode
      if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault();
        setViewMode(viewMode === 'edit' ? 'split' : 'edit');
      }
      // Ctrl/Cmd + Shift + P to toggle preview
      if ((e.ctrlKey || e.metaKey) && e.key === 'p' && e.shiftKey) {
        e.preventDefault();
        setViewMode(viewMode === 'preview' ? 'split' : 'preview');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode]);

  return (
    <div className="flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-parchment-100 border-b border-parchment-200">
        {/* View mode tabs */}
        <div className="flex items-center gap-1 bg-parchment-200 rounded-tablet p-0.5">
          <button
            type="button"
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
            type="button"
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
            type="button"
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

        {/* Hints */}
        <div className="text-xs text-lapis-400">
          Ctrl+E toggle edit | Ctrl+Shift+P preview
        </div>
      </div>

      {/* Editor/Preview area */}
      <div className="flex min-h-[500px]">
        {/* Editor */}
        {viewMode !== 'preview' && (
          <div className={`${viewMode === 'split' ? 'w-1/2 border-r border-parchment-200' : 'w-full'} flex flex-col`}>
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              className="
                flex-1 w-full p-4 resize-none
                font-code text-sm text-lapis-700
                bg-parchment-50 
                focus:outline-none
                placeholder:text-lapis-400
                min-h-[500px]
              "
              spellCheck={false}
            />
          </div>
        )}

        {/* Preview */}
        {viewMode !== 'edit' && (
          <div className={`${viewMode === 'split' ? 'w-1/2' : 'w-full'} overflow-auto bg-parchment-50`}>
            <div className="p-4 prose prose-mesopotamian max-w-none">
              {value ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
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

// ============================================
// Doc Card Component
// ============================================

interface DocCardProps {
  doc: Doc;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function DocCard({ doc, onClick, onEdit, onDelete }: DocCardProps) {
  // Extract preview from content
  const preview = React.useMemo(() => {
    if (!doc.content) return 'No content yet...';
    // Strip markdown and get first 150 chars
    const text = doc.content
      .replace(/#{1,6}\s+/g, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/`[^`]+`/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .trim();
    return text.length > 150 ? text.slice(0, 150) + '...' : text;
  }, [doc.content]);

  return (
    <div
      className="
        tablet-card p-4 cursor-pointer group
        hover:border-lapis-300 hover:shadow-tablet
        transition-all duration-150
      "
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-tablet bg-lapis-100 text-lapis-500">
          <FileText size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-lapis-600 truncate group-hover:text-lapis-700">
            {doc.title}
          </h3>
          <p className="text-sm text-lapis-500 mt-1 line-clamp-2">
            {preview}
          </p>
        </div>
        <ChevronRight 
          size={18} 
          className="text-lapis-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" 
        />
      </div>

      {/* Card footer */}
      <div className="mt-3 pt-3 border-t border-parchment-200 flex items-center justify-between">
        <div className="text-xs text-lapis-400">
          {new Date(doc.updatedAt).toLocaleDateString('de-DE', {
            day: 'numeric',
            month: 'short',
          })}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="p-1 rounded hover:bg-parchment-200 text-lapis-500"
          >
            <Edit3 size={14} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1 rounded hover:bg-red-50 text-red-500"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
