import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { Markdown } from '../components/ui/Markdown';
import { useQueryClient } from '@tanstack/react-query';
import { 
  Plus, 
  FolderOpen, 
  FileText, 
  ChevronRight, 
  ArrowLeft,
  Edit3,
  Trash2,
  Loader2,
  User,
  Clock,
  X,
  Check,
  Eye
} from 'lucide-react';
import { useWebSocket } from '../context/WebSocketContext';
import { ButtonWithHotkey } from '../components/ui/HotkeyBadge';
import { useConfirmDialog } from '../components/ui/ConfirmDialog';
import { useKeyboardShortcuts } from '../hooks/useKeyboard';
import { useDocs, useDoc, useCreateDoc, useUpdateDoc, useDeleteDoc, queryKeys } from '../hooks/useApi';
import type { Doc, CreateDocRequest, UpdateDocRequest } from '../api/docs';

// ============================================
// Docs Page - The Library (Documentation)
// Inline editing without modals
// ============================================

type PageMode = 'list' | 'view' | 'edit' | 'create';

export function DocsPage() {
  const { t } = useTranslation();
  const { docId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // React Query hooks
  const { data: docs = [], isLoading, isError, error } = useDocs();
  const { data: selectedDocData } = useDoc(docId ? Number(docId) : undefined);
  const createDocMutation = useCreateDoc();
  const updateDocMutation = useUpdateDoc();
  const deleteDocMutation = useDeleteDoc();
  
  // Local state for selected doc (synced from query)
  const [selectedDoc, setSelectedDoc] = React.useState<Doc | null>(null);
  
  // Page mode: list, view, edit, or create
  const [mode, setMode] = React.useState<PageMode>('list');
  
  // Edit form state
  const [editTitle, setEditTitle] = React.useState('');
  const [editContent, setEditContent] = React.useState('');
  const [editParentId, setEditParentId] = React.useState<number | ''>('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false);
  
  const titleInputRef = React.useRef<HTMLInputElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  
  // Confirm dialog
  const { confirm, DialogComponent: ConfirmDialogComponent } = useConfirmDialog();
  
  // WebSocket for conflict detection and sync
  const { setEditingItem, syncVersion } = useWebSocket();
  const lastSyncVersionRef = React.useRef(syncVersion);
  
  // Track if we're in an edit session (to prevent auto-refresh)
  const [isEditSession, setIsEditSession] = React.useState(false);
  const syncRequestedAtRef = React.useRef<string | null>(null);

  // Helper to load doc data into form
  const loadDocIntoForm = React.useCallback((doc: Doc) => {
    console.log('[DocsPage] loadDocIntoForm called with:', doc.title);
    setEditTitle(doc.title);
    setEditContent(doc.content || '');
    setEditParentId(doc.parentId || '');
  }, []);

  // Start edit session when entering edit mode
  React.useEffect(() => {
    if (mode === 'edit') {
      setIsEditSession(true);
    }
  }, [mode]);

  // End edit session when leaving edit mode
  React.useEffect(() => {
    if (mode !== 'edit') {
      setIsEditSession(false);
    }
  }, [mode]);

  // When syncVersion increases, record the current updatedAt
  React.useEffect(() => {
    if (syncVersion > lastSyncVersionRef.current) {
      console.log('[DocsPage] Sync requested, current updatedAt:', selectedDocData?.updatedAt);
      lastSyncVersionRef.current = syncVersion;
      syncRequestedAtRef.current = selectedDocData?.updatedAt || 'pending';
    }
  }, [syncVersion, selectedDocData?.updatedAt]);

  // Sync selected doc from query
  React.useEffect(() => {
    if (selectedDocData) {
      // Always update selectedDoc for display
      setSelectedDoc(selectedDocData);
      
      // Check if we're waiting for fresh data after a sync request
      if (syncRequestedAtRef.current !== null) {
        if (selectedDocData.updatedAt !== syncRequestedAtRef.current) {
          console.log('[DocsPage] Fresh data arrived (new updatedAt):', selectedDocData.updatedAt);
          syncRequestedAtRef.current = null;
          loadDocIntoForm(selectedDocData);
          return;
        }
        // Still waiting
        return;
      }
      
      // Don't auto-refresh form during edit session
      if (isEditSession) {
        return;
      }
      
      // Set mode to view if not editing
      if (mode !== 'edit' && mode !== 'create') {
        setMode('view');
      }
    }
  }, [selectedDocData, isEditSession, mode, loadDocIntoForm]);

  // Handle URL param changes
  React.useEffect(() => {
    if (!docId) {
      setSelectedDoc(null);
      if (mode !== 'create') {
        setMode('list');
      }
    }
  }, [docId]);
  
  // Close view if the selected doc was deleted (no longer in the list)
  React.useEffect(() => {
    if (docId && docs.length > 0 && mode !== 'create') {
      const docExists = docs.some(d => d.id === Number(docId));
      if (!docExists) {
        // Doc was deleted by another user
        navigate('/docs');
      }
    }
  }, [docs, docId, mode, navigate]);

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

  // Helper to select doc and update URL
  const selectDoc = React.useCallback((doc: Doc | null) => {
    if (doc) {
      navigate(`/docs/${doc.id}`);
    } else {
      navigate('/docs');
    }
  }, [navigate]);

  // Enter edit mode
  const enterEditMode = React.useCallback((doc?: Doc) => {
    const docToEdit = doc || selectedDoc;
    if (docToEdit) {
      setEditTitle(docToEdit.title);
      setEditContent(docToEdit.content || '');
      setEditParentId(docToEdit.parentId || '');
      setMode('edit');
      setEditingItem('doc', docToEdit.id);
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [selectedDoc, setEditingItem]);

  // Enter create mode
  const enterCreateMode = React.useCallback(() => {
    setEditTitle('');
    setEditContent('');
    setEditParentId('');
    setSelectedDoc(null);
    setMode('create');
    setEditingItem(null, null);
    setTimeout(() => titleInputRef.current?.focus(), 100);
  }, [setEditingItem]);

  // Cancel editing
  const cancelEdit = React.useCallback(async () => {
    if (hasUnsavedChanges) {
      const confirmed = await confirm({
        title: t('common.confirm'),
        message: t('docs.discardChanges'),
        confirmLabel: t('common.yes'),
        cancelLabel: t('common.no'),
        variant: 'warning',
      });
      if (!confirmed) return;
    }
    setEditingItem(null, null);
    if (mode === 'create') {
      setMode('list');
      navigate('/docs');
    } else {
      setMode('view');
    }
    setHasUnsavedChanges(false);
  }, [mode, hasUnsavedChanges, navigate, confirm, t, setEditingItem]);

  // Save document
  const saveDocument = React.useCallback(async () => {
    if (!editTitle.trim()) {
      titleInputRef.current?.focus();
      return;
    }
    
    const data: CreateDocRequest | UpdateDocRequest = {
      title: editTitle.trim(),
      content: editContent || undefined,
      parentId: editParentId || undefined,
    };
    
    if (mode === 'edit' && selectedDoc) {
      const updated = await updateDocMutation.mutateAsync({ 
        id: selectedDoc.id, 
        data: data as UpdateDocRequest 
      });
      setSelectedDoc(updated);
      setMode('view');
      setEditingItem(null, null);
    } else if (mode === 'create') {
      const created = await createDocMutation.mutateAsync(data as CreateDocRequest);
      setSelectedDoc(created);
      navigate(`/docs/${created.id}`);
      setMode('view');
    }
    setHasUnsavedChanges(false);
  }, [editTitle, editContent, editParentId, mode, selectedDoc, navigate, updateDocMutation, createDocMutation, setEditingItem]);

  // Delete document
  const handleDeleteDoc = async (doc: Doc) => {
    const confirmed = await confirm({
      title: t('common.delete'),
      message: t('docs.deleteConfirm', { title: doc.title }),
      confirmLabel: t('common.delete'),
      variant: 'danger',
    });
    if (!confirmed) return;
    
    await deleteDocMutation.mutateAsync(doc.id);
    if (selectedDoc?.id === doc.id) {
      setSelectedDoc(null);
      setMode('list');
      navigate('/docs');
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
    const locale = i18n.language === 'ar' ? 'ar-SA' : 'en-US';
    const date = new Date(dateStr);
    return date.toLocaleDateString(locale, {
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
  const isSaving = createDocMutation.isPending || updateDocMutation.isPending;
  const hasLoaded = docs.length > 0 || !isLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {(mode === 'view' || mode === 'edit') && (
            <button
              onClick={async () => {
                if (mode === 'edit' && hasUnsavedChanges) {
                  const shouldDiscard = await confirm({
                    title: t('common.confirm'),
                    message: t('docs.discardChanges'),
                    confirmLabel: t('common.yes'),
                    cancelLabel: t('common.no'),
                    variant: 'warning',
                  });
                  if (!shouldDiscard) return;
                }
                selectDoc(null);
                setMode('list');
              }}
              className="p-2 rounded-tablet hover:bg-parchment-200 text-lapis-500 transition-colors"
            >
              <ArrowLeft size={20} className="rtl:rotate-180" />
            </button>
          )}
          {mode === 'create' && (
            <button
              onClick={cancelEdit}
              className="p-2 rounded-tablet hover:bg-parchment-200 text-lapis-500 transition-colors"
            >
              <ArrowLeft size={20} className="rtl:rotate-180" />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-inscription text-lapis-600">
              {mode === 'create' 
                ? t('docs.newScroll')
                : mode === 'edit' 
                  ? t('docs.editingScroll')
                  : selectedDoc 
                    ? selectedDoc.title 
                    : t('docs.title')}
            </h1>
            <p className="text-lapis-500 text-sm">
              {mode === 'create'
                ? t('docs.createNew')
                : mode === 'edit'
                  ? hasUnsavedChanges ? t('docs.unsavedChanges') : t('docs.noChanges')
                  : selectedDoc 
                    ? t('docs.lastUpdated', { date: formatDate(selectedDoc.updatedAt) })
                    : t('docs.tagline')}
            </p>
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-2">
          {mode === 'list' && (
            <ButtonWithHotkey
              variant="primary"
              hotkey="c"
              onClick={enterCreateMode}
            >
              <Plus size={18} />
              {t('docs.newDocument')}
            </ButtonWithHotkey>
          )}
          
          {mode === 'view' && selectedDoc && (
            <>
              <ButtonWithHotkey
                variant="secondary"
                onClick={() => enterEditMode()}
                hotkey="e"
              >
                <Edit3 size={18} />
                {t('common.edit')}
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
                {t('common.cancel')}
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
                {isSaving ? t('issueModal.saving') : t('common.save')}
              </ButtonWithHotkey>
            </>
          )}
        </div>
      </div>

      {/* Error message */}
      {isError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-tablet text-red-600">
          {error instanceof Error ? error.message : t('common.noResults')}
          <button 
            onClick={() => queryClient.invalidateQueries({ queryKey: queryKeys.docs.all })} 
            className="ml-2 underline"
          >
            {t('common.retry')}
          </button>
        </div>
      )}

      {/* Loading state */}
      {isLoading && docs.length === 0 && mode === 'list' && (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-lapis-100 mb-4">
              <span className="text-3xl animate-pulse">𒀭</span>
            </div>
            <p className="text-lapis-500 font-inscription">{t('docs.retrieving')}</p>
          </div>
        </div>
      )}

      {/* Document View Mode */}
      {mode === 'view' && selectedDoc && (
        <div className="tablet-card p-6 transition-all duration-200">
          <div className="prose prose-mesopotamian max-w-none">
            {selectedDoc.content ? (
              <Markdown>{selectedDoc.content}</Markdown>
            ) : (
              <p className="text-lapis-400 italic">{t('docs.noContent')}</p>
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
              <span>{t('docs.created', { date: formatDate(selectedDoc.createdAt) })}</span>
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
                {t('docs.titleLabel')} <span className="text-red-500">*</span>
              </label>
              <input
                ref={titleInputRef}
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder={t('docs.titlePlaceholder')}
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
                  {t('docs.parentDocument')}
                </label>
                <select
                  value={editParentId}
                  onChange={(e) => setEditParentId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2 rounded-tablet border border-parchment-300 
                             bg-parchment-100 text-lapis-700
                             focus:border-lapis-400 focus:ring-1 focus:ring-lapis-400 focus:outline-none
                             transition-colors"
                >
                  <option value="">{t('docs.parentNone')}</option>
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
            placeholder={t('docs.contentPlaceholder')}
          />
        </div>
      )}

      {/* Document List */}
      {mode === 'list' && hasLoaded && (
        <>
          {docs.length === 0 ? (
            <div className="tablet-card p-8 text-center">
              <FolderOpen className="mx-auto text-lapis-300" size={48} />
              <h3 className="mt-4 font-inscription text-lg text-lapis-600">
                {t('docs.emptyLibrary')}
              </h3>
              <p className="mt-2 text-lapis-500 text-sm">
                {t('docs.emptyLibraryHint')}
              </p>
              <p className="mt-4 text-xs text-lapis-400">
                {t('docs.markdownSupport')}
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
                  }}
                  onDelete={() => handleDeleteDoc(doc)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Features hint (only shown when no docs) */}
      {mode === 'list' && docs.length === 0 && hasLoaded && (
        <div className="bg-lapis-500/5 border border-lapis-200 rounded-tablet p-4">
          <h3 className="font-medium text-lapis-600 mb-2">{t('docs.features.title')}</h3>
          <ul className="text-sm text-lapis-500 space-y-1">
            <li>{t('docs.features.markdown')}</li>
            <li>{t('docs.features.inline')}</li>
            <li>{t('docs.features.hierarchy')}</li>
            <li>{t('docs.features.keyboard')}</li>
          </ul>
        </div>
      )}

      {/* Confirm Dialog */}
      {ConfirmDialogComponent}
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
  placeholder
}: InlineMarkdownEditorProps) {
  const { t } = useTranslation();
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
            {t('docs.editor.edit')}
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
            {t('docs.editor.split')}
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
            {t('docs.editor.preview')}
          </button>
        </div>

        {/* Hints */}
        <div className="text-xs text-lapis-400">
          {t('docs.editor.hint')}
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
                <Markdown>{value}</Markdown>
              ) : (
                <p className="text-lapis-400 italic">{t('docs.editor.previewPlaceholder')}</p>
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
          className="text-lapis-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 rtl:rotate-180" 
        />
      </div>

      {/* Card footer */}
      <div className="mt-3 pt-3 border-t border-parchment-200 flex items-center justify-between">
        <div className="text-xs text-lapis-400">
          {new Date(doc.updatedAt).toLocaleDateString(i18n.language === 'ar' ? 'ar-SA' : 'en-US', {
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
