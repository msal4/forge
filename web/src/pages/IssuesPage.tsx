import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, RefreshCw, Loader2 } from 'lucide-react';
import { ButtonWithHotkey } from '../components/ui/HotkeyBadge';
import { IssueCard } from '../components/issues/IssueCard';
import { IssueModal } from '../components/issues/IssueModal';
import { FilterBar } from '../components/issues/FilterBar';
import { useKeyboardShortcuts } from '../hooks/useKeyboard';
import { useIssueFilters } from '../hooks/useIssueFilters';
import { 
  issuesApi, 
  IssueStatus, 
  type Issue, 
  type IssueStatusType,
  type CreateIssueRequest,
  type UpdateIssueRequest 
} from '../api/issues';
import { usersApi, type User } from '../api/users';

// ============================================
// Issues Page - The Tablet (Kanban Board)
// ============================================

// Kanban column configuration (Mesopotamian theme)
const COLUMNS = [
  { 
    id: IssueStatus.TO_INSCRIBE, 
    title: 'To Inscribe', 
    subtitle: 'Awaiting the chisel',
    icon: '𒀭',
    borderColor: 'border-t-parchment-500',
    headerBg: 'bg-parchment-200',
    dropBg: 'bg-parchment-100',
  },
  { 
    id: IssueStatus.CARVING, 
    title: 'Carving', 
    subtitle: 'Work in progress',
    icon: '𒁹',
    borderColor: 'border-t-clay-500',
    headerBg: 'bg-clay-100',
    dropBg: 'bg-clay-50',
  },
  { 
    id: IssueStatus.BAKED, 
    title: 'Baked', 
    subtitle: 'Fired and complete',
    icon: '𒂗',
    borderColor: 'border-t-gold-500',
    headerBg: 'bg-gold-100',
    dropBg: 'bg-gold-50',
  },
] as const;

export function IssuesPage() {
  const { issueId } = useParams();
  const navigate = useNavigate();
  
  // Data state
  const [issues, setIssues] = React.useState<Issue[]>([]);
  const [users, setUsers] = React.useState<User[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [hasLoaded, setHasLoaded] = React.useState(false); // Track if initial load is complete
  const [error, setError] = React.useState<string | null>(null);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [modalMode, setModalMode] = React.useState<'view' | 'edit' | 'create'>('view');
  const [selectedIssue, setSelectedIssue] = React.useState<Issue | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  
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

  // Load issues and users
  const loadData = React.useCallback(async (signal?: AbortSignal) => {
    try {
      setIsLoading(true);
      setError(null);
      const [issuesData, usersData] = await Promise.all([
        issuesApi.list({ signal }),
        usersApi.list({ signal }),
      ]);
      setIssues(issuesData);
      setUsers(usersData);
      setHasLoaded(true);
      return issuesData;
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name === 'AbortError') {
        return [];
      }
      setError(err instanceof Error ? err.message : 'Failed to load data');
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load data on mount
  React.useEffect(() => {
    const controller = new AbortController();
    loadData(controller.signal);
    return () => controller.abort();
  }, [loadData]);

  // Handle URL param changes for issue selection
  // Note: Don't close modal if in create mode (no issueId but modal should stay open)
  React.useEffect(() => {
    if (issueId && issues.length > 0) {
      const issue = issues.find(i => i.id === Number(issueId));
      if (issue) {
        setSelectedIssue(issue);
        setModalMode('view');
        setIsModalOpen(true);
      }
    } else if (!issueId && modalMode !== 'create') {
      setIsModalOpen(false);
      setSelectedIssue(null);
    }
  }, [issueId, issues, modalMode]);

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

  // Keyboard shortcuts
  useKeyboardShortcuts([
    {
      keys: 'c',
      description: 'Create new issue',
      handler: () => {
        setSelectedIssue(null);
        setModalMode('create');
        setIsModalOpen(true);
      },
      category: 'actions',
    },
    {
      keys: 'r',
      description: 'Refresh issues',
      handler: loadData,
      category: 'actions',
    },
    {
      keys: 'f',
      description: 'Focus filter search',
      handler: focusSearch,
      category: 'actions',
    },
  ]);

  // Create or update issue
  const handleSaveIssue = async (data: CreateIssueRequest | UpdateIssueRequest) => {
    setIsSaving(true);
    try {
      if (selectedIssue) {
        const updated = await issuesApi.update(selectedIssue.id, data as UpdateIssueRequest);
        setIssues(prev => prev.map(i => i.id === updated.id ? updated : i));
        setSelectedIssue(updated); // Update selected issue for detail view
      } else {
        const created = await issuesApi.create(data as CreateIssueRequest);
        setIssues(prev => [created, ...prev]);
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Delete issue
  const handleDeleteIssue = async (issue: Issue) => {
    if (!confirm(`Delete "${issue.title}"?`)) return;
    
    try {
      await issuesApi.delete(issue.id);
      setIssues(prev => prev.filter(i => i.id !== issue.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete issue');
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, issue: Issue) => {
    setDraggedIssue(issue);
    e.dataTransfer.effectAllowed = 'move';
    // Add a slight delay for the drag image
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
    // Only clear if we're leaving the column entirely
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

    const originalIssue = draggedIssue;
    const updatedIssue = { ...draggedIssue, status };
    
    // Optimistic update
    setIssues(prev => prev.map(i => i.id === draggedIssue.id ? updatedIssue : i));
    setDraggedIssue(null);
    setDragOverColumn(null);

    try {
      await issuesApi.updateStatus(originalIssue.id, status);
    } catch (err) {
      // Revert on error
      setIssues(prev => prev.map(i => i.id === originalIssue.id ? originalIssue : i));
      setError(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  // View issue handler (opens modal in view mode)
  const handleViewIssue = (issue: Issue) => {
    navigate(`/issues/${issue.id}`);
  };

  // Edit issue handler (opens modal in edit mode)
  const handleEditIssue = (issue: Issue) => {
    setModalMode('edit');
    navigate(`/issues/${issue.id}`);
  };

  // Handle mode change within modal
  const handleModeChange = (mode: 'view' | 'edit') => {
    setModalMode(mode);
  };

  // Close modal
  const handleCloseModal = () => {
    if (modalMode === 'create') {
      // For create mode, just close the modal (no URL to navigate away from)
      setIsModalOpen(false);
      setModalMode('view');
    } else {
      // For view/edit mode, navigate away from the issue URL
      navigate('/issues');
    }
  };

  // Handle delete from modal
  const handleDeleteFromModal = async (issue: Issue) => {
    await handleDeleteIssue(issue);
    handleCloseModal();
  };

  // Stats - use filtered count for display, total for reference
  const totalIssues = issues.length;
  const filteredTotal = filteredIssues.length;
  const completedIssues = issuesByStatus[IssueStatus.BAKED].length;

  return (
    <>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-inscription text-lapis-600 flex items-center gap-2">
            <span className="text-3xl">𒋰</span>
            The Tablet
          </h1>
          <p className="text-lapis-500 text-sm mt-1">
            {totalIssues === 0 
              ? 'No inscriptions yet — begin your record'
              : hasActiveFilters
                ? `${completedIssues} of ${filteredTotal} filtered inscriptions complete`
                : `${completedIssues} of ${totalIssues} inscriptions complete`
            }
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ButtonWithHotkey
            variant="secondary"
            hotkey="r"
            onClick={() => loadData()}
            disabled={isLoading}
          >
            {isLoading ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
            Refresh
          </ButtonWithHotkey>
          <ButtonWithHotkey
            variant="primary"
            hotkey="c"
            onClick={() => {
              setSelectedIssue(null);
              setModalMode('create');
              setIsModalOpen(true);
            }}
          >
            <Plus size={18} />
            New Inscription
          </ButtonWithHotkey>
        </div>
      </div>

      {/* Filter Bar - always show once we have issues, even during refresh */}
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
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-tablet text-red-600 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-sm underline hover:no-underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Loading state - only show full loading screen on initial load */}
      {isLoading && !hasLoaded && (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-lapis-100 mb-4">
              <span className="text-3xl animate-pulse">𒀭</span>
            </div>
            <p className="text-lapis-500 font-inscription">Unearthing the tablets...</p>
          </div>
        </div>
      )}

      {/* Kanban Board - show once initially loaded, even during refresh */}
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
                setSelectedIssue(null);
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
        issue={selectedIssue}
        users={users}
        mode={modalMode}
        onClose={handleCloseModal}
        onSave={handleSaveIssue}
        onDelete={handleDeleteFromModal}
        onModeChange={handleModeChange}
        isLoading={isSaving}
      />
    </>
  );
}

// ============================================
// Kanban Column Component
// ============================================

interface ColumnConfig {
  id: IssueStatusType;
  title: string;
  subtitle: string;
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
  return (
    <div
      className={`
        flex flex-col
        bg-parchment-50 rounded-tablet 
        border border-parchment-300
        border-t-4 ${column.borderColor}
        shadow-tablet
        transition-all duration-200
        ${isDragOver ? 'ring-2 ring-lapis-400 ring-offset-2 scale-[1.01]' : ''}
      `}
      onDragOver={(e) => onDragOver(e, column.id)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, column.id)}
    >
      {/* Column Header */}
      <div className={`px-4 py-3 ${column.headerBg} border-b border-parchment-200 rounded-t-tablet`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl opacity-60">{column.icon}</span>
            <div>
              <h3 className="font-inscription text-lapis-600 text-lg">{column.title}</h3>
              <p className="text-xs text-lapis-500">{column.subtitle}</p>
            </div>
          </div>
          <span className={`
            text-sm font-medium px-2.5 py-1 rounded-full
            ${issues.length > 0 ? 'bg-lapis-500 text-parchment-100' : 'bg-parchment-300 text-lapis-500'}
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
  const messages: Record<IssueStatusType, { icon: string; title: string; subtitle: string }> = {
    [IssueStatus.TO_INSCRIBE]: {
      icon: '𒀭',
      title: isFiltering ? 'No matches found' : 'Ready for inscriptions',
      subtitle: isFiltering ? 'Try adjusting your filters' : 'Create a new task to begin',
    },
    [IssueStatus.CARVING]: {
      icon: '𒁹',
      title: isFiltering ? 'No matches found' : 'No work in progress',
      subtitle: isFiltering ? 'Try adjusting your filters' : 'Drag tasks here to start carving',
    },
    [IssueStatus.BAKED]: {
      icon: '𒂗',
      title: isFiltering ? 'No matches found' : 'Nothing completed yet',
      subtitle: isFiltering ? 'Try adjusting your filters' : 'Finished tasks will appear here',
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
          ? 'border-lapis-400 bg-lapis-50' 
          : 'border-parchment-300'
        }
      `}
    >
      <span className={`text-4xl mb-3 ${isDragOver ? 'animate-bounce' : 'opacity-40'}`}>
        {message.icon}
      </span>
      <p className={`text-sm font-medium ${isDragOver ? 'text-lapis-600' : 'text-lapis-500'}`}>
        {isDragOver ? 'Drop here!' : message.title}
      </p>
      <p className="text-xs text-lapis-400 mt-1">
        {isDragOver ? 'Release to move the inscription' : message.subtitle}
      </p>
      {columnId === IssueStatus.TO_INSCRIBE && !isDragOver && (
        <button
          onClick={onCreateIssue}
          className="mt-4 text-xs text-lapis-500 hover:text-lapis-600 underline"
        >
          + Create new inscription
        </button>
      )}
    </div>
  );
}
