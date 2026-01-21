import React from 'react';
import { Plus, RefreshCw, Loader2 } from 'lucide-react';
import { ButtonWithHotkey } from '../components/ui/HotkeyBadge';
import { IssueCard } from '../components/issues/IssueCard';
import { IssueModal } from '../components/issues/IssueModal';
import { useKeyboardShortcuts } from '../hooks/useKeyboard';
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
  { id: IssueStatus.TO_INSCRIBE, title: 'To Inscribe', subtitle: 'Todo', color: 'border-t-parchment-400' },
  { id: IssueStatus.CARVING, title: 'Carving', subtitle: 'In Progress', color: 'border-t-clay-400' },
  { id: IssueStatus.BAKED, title: 'Baked', subtitle: 'Done', color: 'border-t-gold-500' },
] as const;

export function IssuesPage() {
  // Data state
  const [issues, setIssues] = React.useState<Issue[]>([]);
  const [users, setUsers] = React.useState<User[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingIssue, setEditingIssue] = React.useState<Issue | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  
  // Drag and drop state
  const [draggedIssue, setDraggedIssue] = React.useState<Issue | null>(null);
  const [dragOverColumn, setDragOverColumn] = React.useState<IssueStatusType | null>(null);

  // Load issues and users
  const loadData = React.useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [issuesData, usersData] = await Promise.all([
        issuesApi.list(),
        usersApi.list(),
      ]);
      setIssues(issuesData);
      setUsers(usersData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Group issues by status
  const issuesByStatus = React.useMemo(() => {
    const grouped: Record<IssueStatusType, Issue[]> = {
      [IssueStatus.TO_INSCRIBE]: [],
      [IssueStatus.CARVING]: [],
      [IssueStatus.BAKED]: [],
    };
    
    issues.forEach(issue => {
      if (grouped[issue.status]) {
        grouped[issue.status].push(issue);
      }
    });
    
    return grouped;
  }, [issues]);

  // Keyboard shortcuts
  useKeyboardShortcuts([
    {
      keys: 'c',
      description: 'Create new issue',
      handler: () => {
        setEditingIssue(null);
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
  ]);

  // Create or update issue
  const handleSaveIssue = async (data: CreateIssueRequest | UpdateIssueRequest) => {
    setIsSaving(true);
    try {
      if (editingIssue) {
        const updated = await issuesApi.update(editingIssue.id, data as UpdateIssueRequest);
        setIssues(prev => prev.map(i => i.id === updated.id ? updated : i));
      } else {
        const created = await issuesApi.create(data as CreateIssueRequest);
        setIssues(prev => [...prev, created]);
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
  const handleDragStart = (issue: Issue) => {
    setDraggedIssue(issue);
  };

  const handleDragEnd = () => {
    setDraggedIssue(null);
    setDragOverColumn(null);
  };

  const handleDragOver = (e: React.DragEvent, status: IssueStatusType) => {
    e.preventDefault();
    setDragOverColumn(status);
  };

  const handleDrop = async (status: IssueStatusType) => {
    if (!draggedIssue || draggedIssue.status === status) {
      handleDragEnd();
      return;
    }

    // Optimistic update
    const updatedIssue = { ...draggedIssue, status };
    setIssues(prev => prev.map(i => i.id === draggedIssue.id ? updatedIssue : i));
    handleDragEnd();

    try {
      await issuesApi.updateStatus(draggedIssue.id, status);
    } catch (err) {
      // Revert on error
      setIssues(prev => prev.map(i => i.id === draggedIssue.id ? draggedIssue : i));
      setError(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  // Edit issue handler
  const handleEditIssue = (issue: Issue) => {
    setEditingIssue(issue);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-inscription text-lapis-600">
            The Tablet
          </h1>
          <p className="text-lapis-500 text-sm">
            Track your inscriptions through the ages
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ButtonWithHotkey
            variant="secondary"
            hotkey="r"
            onClick={loadData}
            disabled={isLoading}
          >
            {isLoading ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
            Refresh
          </ButtonWithHotkey>
          <ButtonWithHotkey
            variant="primary"
            hotkey="c"
            onClick={() => {
              setEditingIssue(null);
              setIsModalOpen(true);
            }}
          >
            <Plus size={18} />
            New Issue
          </ButtonWithHotkey>
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
      {isLoading && issues.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 size={32} className="animate-spin text-lapis-500 mx-auto mb-2" />
            <p className="text-lapis-500">Loading tablets...</p>
          </div>
        </div>
      )}

      {/* Kanban Board */}
      {!isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {COLUMNS.map(column => (
            <KanbanColumn
              key={column.id}
              id={column.id}
              title={column.title}
              subtitle={column.subtitle}
              color={column.color}
              issues={issuesByStatus[column.id]}
              onEditIssue={handleEditIssue}
              onDeleteIssue={handleDeleteIssue}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              isDragOver={dragOverColumn === column.id}
              draggedIssueId={draggedIssue?.id}
            />
          ))}
        </div>
      )}

      {/* Issue Modal */}
      <IssueModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingIssue(null);
        }}
        onSave={handleSaveIssue}
        issue={editingIssue}
        users={users}
        isLoading={isSaving}
      />
    </div>
  );
}

// ============================================
// Kanban Column Component
// ============================================

interface KanbanColumnProps {
  id: IssueStatusType;
  title: string;
  subtitle: string;
  color: string;
  issues: Issue[];
  onEditIssue: (issue: Issue) => void;
  onDeleteIssue: (issue: Issue) => void;
  onDragStart: (issue: Issue) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent, status: IssueStatusType) => void;
  onDrop: (status: IssueStatusType) => void;
  isDragOver: boolean;
  draggedIssueId?: number;
}

function KanbanColumn({
  id,
  title,
  subtitle,
  color,
  issues,
  onEditIssue,
  onDeleteIssue,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  isDragOver,
  draggedIssueId,
}: KanbanColumnProps) {
  return (
    <div
      className={`
        tablet-card overflow-hidden
        border-t-4 ${color}
        transition-all duration-150
        ${isDragOver ? 'ring-2 ring-lapis-400 ring-offset-2' : ''}
      `}
      onDragOver={(e) => onDragOver(e, id)}
      onDragLeave={() => {}}
      onDrop={() => onDrop(id)}
    >
      {/* Column Header */}
      <div className="px-4 py-3 bg-parchment-100 border-b border-parchment-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-inscription text-lapis-600">{title}</h3>
            <p className="text-xs text-lapis-500">{subtitle}</p>
          </div>
          <span className="text-sm font-medium text-lapis-500 bg-parchment-200 px-2 py-0.5 rounded-full">
            {issues.length}
          </span>
        </div>
      </div>

      {/* Column Content */}
      <div 
        className={`
          p-3 min-h-[200px] space-y-3
          ${isDragOver ? 'bg-lapis-50' : ''}
        `}
      >
        {issues.length === 0 ? (
          <div className="text-center py-8 text-lapis-400 text-sm">
            <p>No issues here yet</p>
            <p className="text-xs mt-1">Drag issues here or create new ones</p>
          </div>
        ) : (
          issues.map(issue => (
            <div
              key={issue.id}
              draggable
              onDragStart={() => onDragStart(issue)}
              onDragEnd={onDragEnd}
            >
              <IssueCard
                issue={issue}
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
