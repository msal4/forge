import React from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useWebSocket } from '../context/WebSocketContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { ButtonWithHotkey } from '../components/ui/HotkeyBadge';
import { IssueCard } from '../components/issues/IssueCard';
import { IssueModal } from '../components/issues/IssueModal';
import { FilterBar } from '../components/issues/FilterBar';
import { useConfirmDialog } from '../components/ui/ConfirmDialog';
import { useKeyboardShortcuts } from '../hooks/useKeyboard';
import { useIssueFilters } from '../hooks/useIssueFilters';
import { useIssue } from '../hooks/useApi';
import { 
  useIssues, 
  useUsers, 
  useCreateIssue, 
  useUpdateIssue, 
  useUpdateIssueStatus, 
  useDeleteIssue,
  queryKeys,
} from '../hooks/useApi';
import { 
  IssueStatus, 
  type Issue, 
  type IssueStatusType,
  type CreateIssueRequest,
  type UpdateIssueRequest 
} from '../api/issues';

// ============================================
// Issues Page - The Tablet (Kanban Board)
// ============================================

// Kanban column configuration (Mesopotamian theme)
const COLUMNS = [
  { 
    id: IssueStatus.TO_INSCRIBE, 
    titleKey: 'issues.columns.toInscribe.title',
    subtitleKey: 'issues.columns.toInscribe.subtitle',
    icon: '𒀭',
    borderColor: 'border-t-parchment-500',
    headerBg: 'bg-parchment-200 dark:bg-lapis-800',
    dropBg: 'bg-parchment-100 dark:bg-lapis-800/50',
  },
  { 
    id: IssueStatus.CARVING, 
    titleKey: 'issues.columns.carving.title',
    subtitleKey: 'issues.columns.carving.subtitle',
    icon: '𒁹',
    borderColor: 'border-t-clay-500',
    headerBg: 'bg-clay-100 dark:bg-clay-900/50',
    dropBg: 'bg-clay-50 dark:bg-clay-900/30',
  },
  { 
    id: IssueStatus.BAKED, 
    titleKey: 'issues.columns.baked.title',
    subtitleKey: 'issues.columns.baked.subtitle',
    icon: '𒂗',
    borderColor: 'border-t-gold-500',
    headerBg: 'bg-gold-100 dark:bg-gold-900/50',
    dropBg: 'bg-gold-50 dark:bg-gold-900/30',
  },
] as const;

export function IssuesPage() {
  const { issueId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { workspacePath } = useWorkspace();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  
  // Get default tab from query params (for notification navigation)
  const defaultTab = searchParams.get('tab') as 'comments' | 'activity' | null;
  
  // React Query hooks
  const { data: issues = [], isLoading, isError, error } = useIssues();
  const { data: users = [] } = useUsers();
  const createIssueMutation = useCreateIssue();
  const updateIssueMutation = useUpdateIssue();
  const updateStatusMutation = useUpdateIssueStatus();
  const deleteIssueMutation = useDeleteIssue();
  
  // Track if we've ever loaded (for UI stability)
  const hasLoaded = issues.length > 0 || !isLoading;
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [modalMode, setModalMode] = React.useState<'view' | 'edit' | 'create'>('view');
  const [selectedIssueId, setSelectedIssueId] = React.useState<number | null>(null);
  
  // Fetch selected issue with real-time updates via React Query
  const { data: selectedIssue } = useIssue(selectedIssueId ?? undefined);
  
  // Drag and drop state
  const [draggedIssue, setDraggedIssue] = React.useState<Issue | null>(null);
  const [dragOverColumn, setDragOverColumn] = React.useState<IssueStatusType | null>(null);

  // Filtering
  const {
    filters,
    setSearchQuery,
    setSelectedAssignee,
    toggleLabel,
    clearFilters,
    hasActiveFilters,
    filteredIssues,
    availableLabels,
    searchInputRef,
    focusSearch,
  } = useIssueFilters(issues);

  // Confirm dialog
  const { confirm, DialogComponent: ConfirmDialogComponent } = useConfirmDialog();
  
  // WebSocket for conflict detection
  const { setEditingItem } = useWebSocket();

  // Handle URL param changes for issue selection
  React.useEffect(() => {
    if (issueId) {
      const id = Number(issueId);
      // Only update if selecting a different issue
      if (selectedIssueId !== id) {
        setSelectedIssueId(id);
        // Only set to 'view' for fresh navigations (not when already editing)
        if (modalMode !== 'edit') {
          setModalMode('view');
        }
      }
      setIsModalOpen(true);
    } else if (!issueId && modalMode !== 'create') {
      setIsModalOpen(false);
      setSelectedIssueId(null);
    }
  }, [issueId]); // Only depend on issueId
  
  // Close modal if the selected issue was deleted (no longer in the list)
  React.useEffect(() => {
    if (selectedIssueId && issues.length > 0 && isModalOpen && modalMode !== 'create') {
      const issueExists = issues.some(i => i.id === selectedIssueId);
      if (!issueExists) {
        // Issue was deleted by another user
        navigate(workspacePath('/issues'));
      }
    }
  }, [issues, selectedIssueId, isModalOpen, modalMode, navigate]);

  // Group filtered issues by status
  const issuesByStatus = React.useMemo(() => {
    const grouped: Record<IssueStatusType, Issue[]> = {
      [IssueStatus.TO_INSCRIBE]: [],
      [IssueStatus.CARVING]: [],
      [IssueStatus.BAKED]: [],
    };
    
    filteredIssues.forEach(issue => {
      if (grouped[issue.status]) {
        grouped[issue.status].push(issue);
      }
    });
    
    return grouped;
  }, [filteredIssues]);

  // Keyboard shortcuts - disable single-key shortcuts when modal is open in edit/create mode
  const shortcutsEnabled = !isModalOpen || modalMode === 'view';
  useKeyboardShortcuts(shortcutsEnabled ? [
    {
      keys: 'c',
      description: 'Create new issue',
      handler: () => {
        if (isModalOpen) return; // Don't create while viewing
        setSelectedIssueId(null);
        setModalMode('create');
        setIsModalOpen(true);
      },
      category: 'actions',
    },
    {
      keys: 'f',
      description: 'Focus filter search',
      handler: () => {
        if (isModalOpen) return;
        focusSearch();
      },
      category: 'actions',
    },
    {
      keys: 'e',
      description: 'Edit issue',
      handler: () => {
        if (isModalOpen && modalMode === 'view' && selectedIssueId) {
          setModalMode('edit');
        }
      },
      category: 'actions',
    },
  ] : []);

  // Create or update issue
  const handleSaveIssue = async (data: CreateIssueRequest | UpdateIssueRequest) => {
    if (selectedIssueId && selectedIssue) {
      await updateIssueMutation.mutateAsync({ 
        id: selectedIssue.id, 
        data: data as UpdateIssueRequest 
      });
      // No need to setSelectedIssue - React Query will update it automatically
    } else {
      await createIssueMutation.mutateAsync(data as CreateIssueRequest);
    }
  };

  // Delete issue
  const handleDeleteIssue = async (issue: Issue) => {
    const confirmed = await confirm({
      title: t('common.delete'),
      message: t('issues.deleteConfirm', { title: issue.title }),
      confirmLabel: t('common.delete'),
      variant: 'danger',
    });
    if (!confirmed) return;
    await deleteIssueMutation.mutateAsync(issue.id);
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, issue: Issue) => {
    setDraggedIssue(issue);
    e.dataTransfer.effectAllowed = 'move';
    const target = e.currentTarget as HTMLElement;
    target.style.opacity = '0.5';
  };

  const handleDragEnd = (e: React.DragEvent) => {
    const target = e.currentTarget as HTMLElement;
    target.style.opacity = '1';
    setDraggedIssue(null);
    setDragOverColumn(null);
  };

  const handleDragOver = (e: React.DragEvent, status: IssueStatusType) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumn !== status) {
      setDragOverColumn(status);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom
    ) {
      setDragOverColumn(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, status: IssueStatusType) => {
    e.preventDefault();
    
    if (!draggedIssue || draggedIssue.status === status) {
      setDraggedIssue(null);
      setDragOverColumn(null);
      return;
    }

    setDraggedIssue(null);
    setDragOverColumn(null);

    // Use mutation with optimistic update
    updateStatusMutation.mutate({ id: draggedIssue.id, status });
  };

  // View issue handler
  const handleViewIssue = (issue: Issue) => {
    navigate(workspacePath(`/issues/${issue.id}`));
  };

  // Edit issue handler
  const handleEditIssue = (issue: Issue) => {
    setModalMode('edit');
    navigate(workspacePath(`/issues/${issue.id}`));
  };

  // Handle mode change within modal
  const handleModeChange = (mode: 'view' | 'edit') => {
    console.log('[IssuesPage] handleModeChange:', mode, 'selectedIssueId:', selectedIssueId);
    setModalMode(mode);
    // Track editing state for conflict detection
    if (mode === 'edit' && selectedIssueId) {
      console.log('[IssuesPage] Setting editing item to issue:', selectedIssueId);
      setEditingItem('issue', selectedIssueId);
    } else {
      console.log('[IssuesPage] Clearing editing item');
      setEditingItem(null, null);
    }
  };

  // Close modal
  const handleCloseModal = () => {
    // Clear editing state
    setEditingItem(null, null);
    
    if (modalMode === 'create') {
      setIsModalOpen(false);
      setSelectedIssueId(null);
      setModalMode('view');
    } else {
      navigate(workspacePath('/issues'));
    }
  };

  // Handle delete from modal
  const handleDeleteFromModal = async (issue: Issue) => {
    await handleDeleteIssue(issue);
    handleCloseModal();
  };

  // Stats
  const totalIssues = issues.length;
  const filteredTotal = filteredIssues.length;
  const completedIssues = issuesByStatus[IssueStatus.BAKED].length;

  const isSaving = createIssueMutation.isPending || updateIssueMutation.isPending;

  return (
    <>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-inscription text-lapis-600 dark:text-parchment-200 flex items-center gap-2">
            <span className="text-3xl">𒋰</span>
            {t('issues.title')}
          </h1>
          <p className="text-lapis-500 dark:text-parchment-400 text-sm mt-1">
            {totalIssues === 0 
              ? t('issues.noInscriptions')
              : hasActiveFilters
                ? t('issues.completionStatusFiltered', { completed: completedIssues, filtered: filteredTotal })
                : t('issues.completionStatus', { completed: completedIssues, total: totalIssues })
            }
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ButtonWithHotkey
            variant="primary"
            hotkey="c"
            onClick={() => {
              setSelectedIssueId(null);
              setModalMode('create');
              setIsModalOpen(true);
            }}
          >
            <Plus size={18} />
            {t('issues.newInscription')}
          </ButtonWithHotkey>
        </div>
      </div>

      {/* Filter Bar - always show once we have issues */}
      {(issues.length > 0 || hasActiveFilters) && (
        <FilterBar
          filters={filters}
          users={users}
          availableLabels={availableLabels}
          hasActiveFilters={hasActiveFilters}
          onSearchChange={setSearchQuery}
          onAssigneeChange={setSelectedAssignee}
          onToggleLabel={toggleLabel}
          onClearFilters={clearFilters}
          searchInputRef={searchInputRef}
          totalCount={totalIssues}
          filteredCount={filteredTotal}
        />
      )}

      {/* Error message */}
      {isError && (
        <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-tablet text-red-600 dark:text-red-400 flex items-center justify-between">
          <span>{error instanceof Error ? error.message : 'Failed to load data'}</span>
          <button 
            onClick={() => queryClient.invalidateQueries({ queryKey: queryKeys.issues.all })} 
            className="text-sm underline hover:no-underline"
          >
            {t('common.retry')}
          </button>
        </div>
      )}

      {/* Loading state - only show full loading screen on initial load */}
      {isLoading && issues.length === 0 && (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-lapis-100 dark:bg-lapis-800 mb-4">
              <span className="text-3xl animate-pulse">𒀭</span>
            </div>
            <p className="text-lapis-500 dark:text-parchment-400 font-inscription">{t('issues.unearthing')}</p>
          </div>
        </div>
      )}

      {/* Kanban Board - show once initially loaded */}
      {hasLoaded && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {COLUMNS.map(column => (
            <KanbanColumn
              key={column.id}
              column={column}
              issues={issuesByStatus[column.id]}
              onViewIssue={handleViewIssue}
              onEditIssue={handleEditIssue}
              onDeleteIssue={handleDeleteIssue}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              isDragOver={dragOverColumn === column.id}
              draggedIssueId={draggedIssue?.id}
              onCreateIssue={() => {
                setSelectedIssueId(null);
                setModalMode('create');
                setIsModalOpen(true);
              }}
              isFiltering={hasActiveFilters}
            />
          ))}
        </div>
      )}

    </div>

      {/* Unified Issue Modal */}
      <IssueModal
        isOpen={isModalOpen}
        issue={selectedIssue ?? null}
        users={users}
        mode={modalMode}
        onClose={handleCloseModal}
        onSave={handleSaveIssue}
        onDelete={handleDeleteFromModal}
        onModeChange={handleModeChange}
        isLoading={isSaving}
        defaultTab={defaultTab || 'comments'}
      />

      {/* Confirm Dialog */}
      {ConfirmDialogComponent}
    </>
  );
}

// ============================================
// Kanban Column Component
// ============================================

interface ColumnConfig {
  id: IssueStatusType;
  titleKey: string;
  subtitleKey: string;
  icon: string;
  borderColor: string;
  headerBg: string;
  dropBg: string;
}

interface KanbanColumnProps {
  column: ColumnConfig;
  issues: Issue[];
  onViewIssue: (issue: Issue) => void;
  onEditIssue: (issue: Issue) => void;
  onDeleteIssue: (issue: Issue) => void;
  onDragStart: (e: React.DragEvent, issue: Issue) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent, status: IssueStatusType) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, status: IssueStatusType) => void;
  isDragOver: boolean;
  draggedIssueId?: number;
  onCreateIssue: () => void;
  isFiltering?: boolean;
}

function KanbanColumn({
  column,
  issues,
  onViewIssue,
  onEditIssue,
  onDeleteIssue,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  isDragOver,
  draggedIssueId,
  onCreateIssue,
  isFiltering = false,
}: KanbanColumnProps) {
  const { t } = useTranslation();
  
  return (
    <div
      className={`
        flex flex-col
        bg-parchment-50 dark:bg-lapis-900 rounded-tablet 
        border border-parchment-300 dark:border-lapis-700
        border-t-4 ${column.borderColor}
        shadow-tablet dark:shadow-none
        transition-all duration-200
        ${isDragOver ? 'ring-2 ring-lapis-400 dark:ring-gold-500 ring-offset-2 dark:ring-offset-lapis-950 scale-[1.01]' : ''}
      `}
      onDragOver={(e) => onDragOver(e, column.id)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, column.id)}
    >
      {/* Column Header */}
      <div className={`px-4 py-3 ${column.headerBg} border-b border-parchment-200 dark:border-lapis-700 rounded-t-tablet`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl opacity-60">{column.icon}</span>
            <div>
              <h3 className="font-inscription text-lapis-600 dark:text-parchment-200 text-lg">{t(column.titleKey)}</h3>
              <p className="text-xs text-lapis-500 dark:text-parchment-400">{t(column.subtitleKey)}</p>
            </div>
          </div>
          <span className={`
            text-sm font-medium px-2.5 py-1 rounded-full
            ${issues.length > 0 ? 'bg-lapis-500 text-parchment-100 dark:bg-gold-600 dark:text-lapis-950' : 'bg-parchment-300 dark:bg-lapis-700 text-lapis-500 dark:text-parchment-400'}
          `}>
            {issues.length}
          </span>
        </div>
      </div>

      {/* Column Content */}
      <div 
        className={`
          flex-1 p-3 space-y-3 min-h-[300px]
          transition-colors duration-200
          ${isDragOver ? column.dropBg : ''}
        `}
      >
        {issues.length === 0 ? (
          <EmptyColumnState 
            columnId={column.id} 
            isDragOver={isDragOver}
            onCreateIssue={onCreateIssue}
            isFiltering={isFiltering}
          />
        ) : (
          issues.map(issue => (
            <div
              key={issue.id}
              draggable
              onDragStart={(e) => onDragStart(e, issue)}
              onDragEnd={onDragEnd}
              className="transform transition-transform duration-150"
            >
              <IssueCard
                issue={issue}
                onView={onViewIssue}
                onEdit={onEditIssue}
                onDelete={onDeleteIssue}
                isDragging={draggedIssueId === issue.id}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ============================================
// Empty Column State
// ============================================

interface EmptyColumnStateProps {
  columnId: IssueStatusType;
  isDragOver: boolean;
  onCreateIssue: () => void;
  isFiltering?: boolean;
}

function EmptyColumnState({ columnId, isDragOver, onCreateIssue, isFiltering = false }: EmptyColumnStateProps) {
  const { t } = useTranslation();
  
  const messages: Record<IssueStatusType, { icon: string; titleKey: string; subtitleKey: string }> = {
    [IssueStatus.TO_INSCRIBE]: {
      icon: '𒀭',
      titleKey: isFiltering ? 'issues.empty.noMatches' : 'issues.empty.toInscribe.title',
      subtitleKey: isFiltering ? 'issues.empty.adjustFilters' : 'issues.empty.toInscribe.subtitle',
    },
    [IssueStatus.CARVING]: {
      icon: '𒁹',
      titleKey: isFiltering ? 'issues.empty.noMatches' : 'issues.empty.carving.title',
      subtitleKey: isFiltering ? 'issues.empty.adjustFilters' : 'issues.empty.carving.subtitle',
    },
    [IssueStatus.BAKED]: {
      icon: '𒂗',
      titleKey: isFiltering ? 'issues.empty.noMatches' : 'issues.empty.baked.title',
      subtitleKey: isFiltering ? 'issues.empty.adjustFilters' : 'issues.empty.baked.subtitle',
    },
  };

  const message = messages[columnId];

  return (
    <div 
      className={`
        flex flex-col items-center justify-center 
        py-12 px-4 text-center
        border-2 border-dashed rounded-tablet
        transition-all duration-200
        ${isDragOver 
          ? 'border-lapis-400 dark:border-gold-500 bg-lapis-50 dark:bg-lapis-800' 
          : 'border-parchment-300 dark:border-lapis-700'
        }
      `}
    >
      <span className={`text-4xl mb-3 ${isDragOver ? 'animate-bounce' : 'opacity-40'}`}>
        {message.icon}
      </span>
      <p className={`text-sm font-medium ${isDragOver ? 'text-lapis-600 dark:text-gold-400' : 'text-lapis-500 dark:text-parchment-400'}`}>
        {isDragOver ? t('issues.dropHere') : t(message.titleKey)}
      </p>
      <p className="text-xs text-stone-500 dark:text-parchment-500 mt-1">
        {isDragOver ? t('issues.releaseToMove') : t(message.subtitleKey)}
      </p>
      {columnId === IssueStatus.TO_INSCRIBE && !isDragOver && !isFiltering && (
        <button
          onClick={onCreateIssue}
          className="mt-4 text-xs text-lapis-500 dark:text-parchment-400 hover:text-lapis-600 dark:hover:text-parchment-200 underline"
        >
          {t('issues.createNew')}
        </button>
      )}
    </div>
  );
}
