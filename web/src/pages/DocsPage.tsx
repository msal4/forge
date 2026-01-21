import React from 'react';
import ReactMarkdown from 'react-markdown';
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
  Clock
} from 'lucide-react';
import { ButtonWithHotkey } from '../components/ui/HotkeyBadge';
import { DocModal } from '../components/docs/DocModal';
import { useKeyboardShortcuts } from '../hooks/useKeyboard';
import { docsApi, type Doc, type CreateDocRequest, type UpdateDocRequest } from '../api/docs';

// ============================================
// Docs Page - The Library (Documentation)
// ============================================

export function DocsPage() {
  // Data state
  const [docs, setDocs] = React.useState<Doc[]>([]);
  const [selectedDoc, setSelectedDoc] = React.useState<Doc | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingDoc, setEditingDoc] = React.useState<Doc | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  // Load docs
  const loadDocs = React.useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await docsApi.list();
      setDocs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  // Keyboard shortcuts
  useKeyboardShortcuts([
    {
      keys: 'c',
      description: 'Create new document',
      handler: () => {
        setEditingDoc(null);
        setIsModalOpen(true);
      },
      category: 'actions',
    },
    {
      keys: 'r',
      description: 'Refresh documents',
      handler: loadDocs,
      category: 'actions',
    },
    {
      keys: 'Escape',
      description: 'Back to list',
      handler: () => setSelectedDoc(null),
      category: 'navigation',
    },
  ]);

  // Save document
  const handleSaveDoc = async (data: CreateDocRequest | UpdateDocRequest) => {
    setIsSaving(true);
    try {
      if (editingDoc) {
        const updated = await docsApi.update(editingDoc.id, data as UpdateDocRequest);
        setDocs(prev => prev.map(d => d.id === updated.id ? updated : d));
        if (selectedDoc?.id === updated.id) {
          setSelectedDoc(updated);
        }
      } else {
        const created = await docsApi.create(data as CreateDocRequest);
        setDocs(prev => [...prev, created]);
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Delete document
  const handleDeleteDoc = async (doc: Doc) => {
    if (!confirm(`Delete "${doc.title}"? This cannot be undone.`)) return;
    
    try {
      await docsApi.delete(doc.id);
      setDocs(prev => prev.filter(d => d.id !== doc.id));
      if (selectedDoc?.id === doc.id) {
        setSelectedDoc(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete document');
    }
  };

  // Edit document handler
  const handleEditDoc = (doc: Doc) => {
    setEditingDoc(doc);
    setIsModalOpen(true);
  };

  // View document
  const handleViewDoc = async (doc: Doc) => {
    try {
      const fullDoc = await docsApi.get(doc.id);
      setSelectedDoc(fullDoc);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load document');
    }
  };

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('de-DE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {selectedDoc && (
            <button
              onClick={() => setSelectedDoc(null)}
              className="p-2 rounded-tablet hover:bg-parchment-200 text-lapis-500"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-inscription text-lapis-600">
              {selectedDoc ? selectedDoc.title : 'The Library'}
            </h1>
            <p className="text-lapis-500 text-sm">
              {selectedDoc 
                ? `Last updated ${formatDate(selectedDoc.updatedAt)}`
                : 'Scrolls of knowledge, preserved for eternity'
              }
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!selectedDoc && (
            <>
              <ButtonWithHotkey
                variant="secondary"
                hotkey="r"
                onClick={loadDocs}
                disabled={isLoading}
              >
                {isLoading ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                Refresh
              </ButtonWithHotkey>
              <ButtonWithHotkey
                variant="primary"
                hotkey="c"
                onClick={() => {
                  setEditingDoc(null);
                  setIsModalOpen(true);
                }}
              >
                <Plus size={18} />
                New Document
              </ButtonWithHotkey>
            </>
          )}
          {selectedDoc && (
            <>
              <ButtonWithHotkey
                variant="secondary"
                onClick={() => handleEditDoc(selectedDoc)}
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
      {isLoading && docs.length === 0 && !selectedDoc && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 size={32} className="animate-spin text-lapis-500 mx-auto mb-2" />
            <p className="text-lapis-500">Loading scrolls...</p>
          </div>
        </div>
      )}

      {/* Document View */}
      {selectedDoc && (
        <div className="tablet-card p-6">
          <div className="prose prose-mesopotamian max-w-none">
            {selectedDoc.content ? (
              <ReactMarkdown>{selectedDoc.content}</ReactMarkdown>
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

      {/* Document List */}
      {!selectedDoc && !isLoading && (
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
                  onEdit={() => handleEditDoc(doc)}
                  onDelete={() => handleDeleteDoc(doc)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Features hint (only shown when no docs) */}
      {!selectedDoc && docs.length === 0 && !isLoading && (
        <div className="bg-lapis-500/5 border border-lapis-200 rounded-tablet p-4">
          <h3 className="font-medium text-lapis-600 mb-2">Documentation Features</h3>
          <ul className="text-sm text-lapis-500 space-y-1">
            <li>Full Markdown support with live preview</li>
            <li>Split view editor for writing</li>
            <li>Hierarchical organization with folders</li>
            <li>Full-text search across all documents</li>
          </ul>
        </div>
      )}

      {/* Doc Modal */}
      <DocModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingDoc(null);
        }}
        onSave={handleSaveDoc}
        doc={editingDoc}
        docs={docs}
        isLoading={isSaving}
      />
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
