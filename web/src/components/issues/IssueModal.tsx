import React from 'react';
import { 
  X, 
  Edit3, 
  Trash2, 
  Check,
  Clock, 
  User, 
  Tag, 
  Calendar,
  FileText,
  ChevronDown
} from 'lucide-react';
import { useKeyboardShortcuts } from '../../hooks/useKeyboard';
import { HotkeyBadge } from '../ui/HotkeyBadge';
import type { Issue, CreateIssueRequest, UpdateIssueRequest, PriorityType, IssueStatusType } from '../../api/issues';
import { Priority, IssueStatus } from '../../api/issues';
import type { User as UserType } from '../../api/users';

// ============================================
// Unified Issue Modal - View & Edit modes
// Seamless transition between viewing and editing
// ============================================

interface IssueModalProps {
  isOpen: boolean;
  issue: Issue | null;  // null = create new
  users: UserType[];
  mode: 'view' | 'edit' | 'create';
  onClose: () => void;
  onSave: (data: CreateIssueRequest | UpdateIssueRequest) => Promise<void>;
  onDelete?: (issue: Issue) => void;
  onModeChange: (mode: 'view' | 'edit') => void;
  isLoading?: boolean;
}

// Priority config
const priorityConfig: Record<PriorityType, { 
  color: string; 
  bgColor: string;
  label: string;
  icon: string;
}> = {
  critical: { color: 'text-red-700', bgColor: 'bg-red-100 border-red-300', label: 'Critical', icon: '🔺' },
  high: { color: 'text-clay-700', bgColor: 'bg-clay-100 border-clay-300', label: 'High', icon: '▲' },
  medium: { color: 'text-gold-700', bgColor: 'bg-gold-100 border-gold-300', label: 'Medium', icon: '●' },
  low: { color: 'text-lapis-600', bgColor: 'bg-lapis-100 border-lapis-300', label: 'Low', icon: '▽' },
};

// Status config
const statusConfig: Record<IssueStatusType, { label: string; color: string; icon: string }> = {
  to_inscribe: { label: 'To Inscribe', color: 'bg-parchment-200 text-lapis-600 border-parchment-300', icon: '𒀭' },
  carving: { label: 'Carving', color: 'bg-gold-100 text-gold-700 border-gold-300', icon: '𒁹' },
  baked: { label: 'Baked', color: 'bg-green-100 text-green-700 border-green-300', icon: '𒂗' },
};

export function IssueModal({ 
  isOpen, 
  issue,
  users,
  mode,
  onClose, 
  onSave,
  onDelete,
  onModeChange,
  isLoading
}: IssueModalProps) {
  // Form state
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [priority, setPriority] = React.useState<PriorityType>(Priority.MEDIUM);
  const [status, setStatus] = React.useState<IssueStatusType>(IssueStatus.TO_INSCRIBE);
  const [assigneeId, setAssigneeId] = React.useState<number | null>(null);
  const [dueDate, setDueDate] = React.useState('');
  const [labels, setLabels] = React.useState<string[]>([]);
  const [labelInput, setLabelInput] = React.useState('');
  const [error, setError] = React.useState('');
  
  // Dropdown states
  const [showStatusDropdown, setShowStatusDropdown] = React.useState(false);
  const [showPriorityDropdown, setShowPriorityDropdown] = React.useState(false);
  const [showAssigneeDropdown, setShowAssigneeDropdown] = React.useState(false);
  
  const titleInputRef = React.useRef<HTMLInputElement>(null);
  const isEditing = mode === 'edit' || mode === 'create';
  const isCreating = mode === 'create';

  // Populate form from issue
  React.useEffect(() => {
    if (issue) {
      setTitle(issue.title);
      setDescription(issue.description || '');
      setPriority(issue.priority);
      setStatus(issue.status);
      setAssigneeId(issue.assigneeId || null);
      setDueDate(issue.dueDate?.split('T')[0] || '');
      setLabels(issue.labels || []);
    } else {
      setTitle('');
      setDescription('');
      setPriority(Priority.MEDIUM);
      setStatus(IssueStatus.TO_INSCRIBE);
      setAssigneeId(null);
      setDueDate('');
      setLabels([]);
    }
    setError('');
    setLabelInput('');
  }, [issue, isOpen]);

  // Focus title when entering edit mode
  React.useEffect(() => {
    if (isEditing && isOpen) {
      setTimeout(() => titleInputRef.current?.focus(), 100);
    }
  }, [isEditing, isOpen]);

  // Close dropdowns when clicking outside
  React.useEffect(() => {
    const handleClick = () => {
      setShowStatusDropdown(false);
      setShowPriorityDropdown(false);
      setShowAssigneeDropdown(false);
    };
    if (isOpen) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [isOpen]);

  // Handle cancel/escape - edit mode goes to view, view/create closes
  const handleCancel = () => {
    if (mode === 'edit') {
      // Reset form to original issue values and go back to view
      if (issue) {
        setTitle(issue.title);
        setDescription(issue.description || '');
        setPriority(issue.priority);
        setStatus(issue.status);
        setAssigneeId(issue.assigneeId || null);
        setDueDate(issue.dueDate?.split('T')[0] || '');
        setLabels(issue.labels || []);
      }
      setError('');
      onModeChange('view');
    } else {
      onClose();
    }
  };

  // Keyboard shortcuts
  useKeyboardShortcuts([
    { keys: 'Escape', description: 'Close/Cancel', handler: handleCancel, global: true },
    { 
      keys: 'e', 
      description: 'Edit', 
      handler: () => mode === 'view' && onModeChange('edit'), 
      global: true 
    },
    { 
      keys: 'Ctrl+Enter', 
      description: 'Save', 
      handler: () => isEditing && handleSave(), 
      global: true 
    },
  ]);

  const handleSave = async () => {
    if (!title.trim()) {
      setError('Title is required');
      titleInputRef.current?.focus();
      return;
    }

    try {
      const formattedDueDate = dueDate ? new Date(dueDate).toISOString() : undefined;
      
      const data: CreateIssueRequest | UpdateIssueRequest = {
        title: title.trim(),
        description: description.trim() || '',
        priority,
        ...(mode !== 'create' && { status }),
        assigneeId: assigneeId || undefined,
        labels,
        dueDate: formattedDueDate,
      };
      
      await onSave(data);
      if (mode === 'create') {
        onClose();
      } else {
        onModeChange('view');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    }
  };

  const addLabel = () => {
    const label = labelInput.trim().toLowerCase();
    if (label && !labels.includes(label)) {
      setLabels([...labels, label]);
      setLabelInput('');
    }
  };

  const removeLabel = (labelToRemove: string) => {
    setLabels(labels.filter(l => l !== labelToRemove));
  };

  // Helper functions
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString('en-US', { 
      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' 
    });
  };

  const formatRelativeTime = (dateStr: string) => {
    const diffDays = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return formatDate(dateStr);
  };

  const isDueOverdue = dueDate && new Date(dueDate) < new Date() && status !== 'baked';
  const selectedAssignee = users.find(u => u.id === assigneeId);
  const priorityStyle = priorityConfig[priority];
  const statusStyle = statusConfig[status];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4 pb-8 overflow-y-auto overflow-x-hidden">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-lapis-900/60 backdrop-blur-sm animate-fade-in" 
        onClick={onClose} 
      />
      
      {/* Modal */}
      <div className="
        relative w-full max-w-2xl
        bg-parchment-50
        rounded-xl shadow-2xl border border-parchment-300
        flex flex-col
        overflow-hidden
        animate-scale-in
      ">
        {/* Priority color bar */}
        <div className={`h-1.5 transition-colors duration-200 ${
          priority === 'critical' ? 'bg-red-500' :
          priority === 'high' ? 'bg-clay-500' :
          priority === 'medium' ? 'bg-gold-500' : 'bg-lapis-400'
        }`} />
        
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-parchment-200 bg-parchment-100/50">
          <div className="flex-1 pr-4">
            {/* Status & Priority badges */}
            <div className="flex items-center gap-2 mb-3">
              {/* Status dropdown/badge */}
              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); isEditing && !isCreating && setShowStatusDropdown(!showStatusDropdown); }}
                  disabled={!isEditing || isCreating}
                  className={`
                    inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg
                    text-sm font-medium border transition-all
                    ${statusStyle.color}
                    ${isEditing && !isCreating ? 'cursor-pointer hover:ring-2 hover:ring-lapis-300' : ''}
                  `}
                >
                  <span>{statusStyle.icon}</span>
                  {statusStyle.label}
                  {isEditing && !isCreating && <ChevronDown size={14} />}
                </button>
                {showStatusDropdown && (
                  <div className="absolute top-full left-0 mt-1 bg-parchment-50 border border-parchment-300 rounded-lg shadow-lg py-1 z-10 min-w-[140px]">
                    {Object.entries(statusConfig).map(([key, cfg]) => (
                      <button
                        key={key}
                        onClick={() => { setStatus(key as IssueStatusType); setShowStatusDropdown(false); }}
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-parchment-200 flex items-center gap-2
                          ${status === key ? 'bg-parchment-200' : ''}`}
                      >
                        <span>{cfg.icon}</span> {cfg.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Priority dropdown/badge */}
              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); isEditing && setShowPriorityDropdown(!showPriorityDropdown); }}
                  disabled={!isEditing}
                  className={`
                    inline-flex items-center gap-1 px-2 py-1 rounded-lg
                    text-xs font-semibold border transition-all
                    ${priorityStyle.bgColor} ${priorityStyle.color}
                    ${isEditing ? 'cursor-pointer hover:ring-2 hover:ring-lapis-300' : ''}
                  `}
                >
                  <span className="text-[10px]">{priorityStyle.icon}</span>
                  {priorityStyle.label}
                  {isEditing && <ChevronDown size={12} />}
                </button>
                {showPriorityDropdown && (
                  <div className="absolute top-full left-0 mt-1 bg-parchment-50 border border-parchment-300 rounded-lg shadow-lg py-1 z-10 min-w-[120px]">
                    {Object.entries(priorityConfig).map(([key, cfg]) => (
                      <button
                        key={key}
                        onClick={() => { setPriority(key as PriorityType); setShowPriorityDropdown(false); }}
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-parchment-200 flex items-center gap-2
                          ${priority === key ? 'bg-parchment-200' : ''}`}
                      >
                        <span className={cfg.color}>{cfg.icon}</span> {cfg.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            {/* Title */}
            <div className="min-h-[32px] flex items-center">
              {isEditing ? (
                <input
                  ref={titleInputRef}
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="What needs to be inscribed?"
                  className="
                    w-full text-xl font-inscription font-normal text-lapis-700
                    bg-transparent
                    border-none outline-none ring-0
                    focus:border-none focus:outline-none focus:ring-0
                    placeholder:text-lapis-400
                    caret-lapis-500
                  "
                  style={{ boxShadow: 'none' }}
                />
              ) : (
                <h2 className="text-xl font-inscription font-normal text-lapis-700 leading-tight">
                  {title}
                </h2>
              )}
            </div>
          </div>
          
          {/* Action buttons */}
          <div className="flex items-center gap-1">
            {mode === 'view' && (
              <>
                <button
                  onClick={() => onModeChange('edit')}
                  className="p-2 rounded-lg hover:bg-parchment-200 text-lapis-500 transition-colors"
                  title="Edit (e)"
                >
                  <Edit3 size={18} />
                </button>
                {onDelete && issue && (
                  <button
                    onClick={() => onDelete(issue)}
                    className="p-2 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </>
            )}
            {mode === 'edit' && (
              <>
                <button
                  onClick={handleSave}
                  disabled={isLoading}
                  className="p-2 rounded-lg hover:bg-green-50 text-green-600 transition-colors"
                  title="Save (Ctrl+Enter)"
                >
                  <Check size={18} />
                </button>
                <button 
                  onClick={handleCancel}
                  className="p-2 rounded-lg hover:bg-parchment-200 text-lapis-500 transition-colors"
                  title="Cancel edit (Esc)"
                >
                  <X size={20} />
                </button>
              </>
            )}
            {(mode === 'view' || mode === 'create') && (
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-parchment-200 text-lapis-500 transition-colors">
                <X size={20} />
              </button>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            {error}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-stable scrollbar-thin">
          {/* Description */}
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-lapis-600 mb-3">
              <FileText size={16} />
              Description
            </h3>
            {isEditing ? (
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add a description..."
                rows={4}
                className="
                  w-full min-h-[120px] p-4 rounded-lg 
                  bg-parchment-100/50 text-lapis-700 resize-none
                  border border-parchment-300 
                  outline-none focus:border-lapis-400 focus:bg-parchment-100
                  placeholder:text-lapis-400
                  transition-colors
                "
              />
            ) : description ? (
              <div className="min-h-[120px] text-lapis-700 bg-parchment-100/30 rounded-lg p-4 whitespace-pre-wrap">
                {description}
              </div>
            ) : (
              <div className="min-h-[120px] flex items-center justify-center text-lapis-400 italic text-sm bg-parchment-100/30 rounded-lg">
                No description provided.
              </div>
            )}
          </div>

          {/* Labels */}
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-lapis-600 mb-3">
              <Tag size={16} />
              Labels
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              {labels.map((label) => (
                <span
                  key={label}
                  className="
                    inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                    bg-lapis-100 text-lapis-700 border border-lapis-200
                    text-sm font-medium
                  "
                >
                  {label}
                  {isEditing && (
                    <button onClick={() => removeLabel(label)} className="hover:text-red-500">
                      <X size={14} />
                    </button>
                  )}
                </span>
              ))}
              {labels.length === 0 && !isEditing && (
                <span className="text-lapis-400 italic text-sm">No labels</span>
              )}
              {isEditing && (
                <input
                  type="text"
                  value={labelInput}
                  onChange={(e) => setLabelInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addLabel();
                    }
                  }}
                  placeholder="+ Add label"
                  className="
                    px-3 py-1.5 rounded-lg text-sm w-28
                    bg-transparent text-lapis-600
                    outline-none
                    placeholder:text-lapis-400
                    focus:bg-parchment-100 focus:w-40
                    transition-all
                  "
                />
              )}
            </div>
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 p-4 rounded-lg bg-parchment-100/60 border border-parchment-200">
            {/* Assignee */}
            <div>
              <h4 className="flex items-center gap-1.5 text-xs font-semibold text-lapis-500 mb-2">
                <User size={12} />
                Assignee
              </h4>
              <div className="h-10 flex items-center">
                {isEditing ? (
                  <div className="relative w-full">
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowAssigneeDropdown(!showAssigneeDropdown); }}
                      className="
                        w-full h-10 flex items-center gap-2 px-3 rounded-lg text-left
                        border border-parchment-300 bg-parchment-100/50
                        hover:border-lapis-400 hover:bg-parchment-100 transition-colors
                      "
                    >
                      {selectedAssignee ? (
                        <>
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-lapis-400 to-lapis-600 flex items-center justify-center flex-shrink-0">
                            <span className="text-[10px] text-parchment-100 font-semibold">
                              {(selectedAssignee.fullName?.[0] || selectedAssignee.username[0]).toUpperCase()}
                            </span>
                          </div>
                          <span className="text-sm text-lapis-700 truncate">{selectedAssignee.fullName || selectedAssignee.username}</span>
                        </>
                      ) : (
                        <span className="text-sm text-lapis-400">Unassigned</span>
                      )}
                      <ChevronDown size={14} className="ml-auto text-lapis-400 flex-shrink-0" />
                    </button>
                    {showAssigneeDropdown && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-parchment-50 border border-parchment-300 rounded-lg shadow-lg py-1 z-10 max-h-48 overflow-y-auto">
                        <button
                          onClick={() => { setAssigneeId(null); setShowAssigneeDropdown(false); }}
                          className={`w-full px-3 py-2 text-left text-sm hover:bg-parchment-200 ${!assigneeId ? 'bg-parchment-200' : ''}`}
                        >
                          <span className="text-lapis-400">Unassigned</span>
                        </button>
                        {users.map((user) => (
                          <button
                            key={user.id}
                            onClick={() => { setAssigneeId(user.id); setShowAssigneeDropdown(false); }}
                            className={`w-full px-3 py-2 text-left text-sm hover:bg-parchment-200 flex items-center gap-2
                              ${assigneeId === user.id ? 'bg-parchment-200' : ''}`}
                          >
                            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-lapis-400 to-lapis-600 flex items-center justify-center">
                              <span className="text-[9px] text-parchment-100 font-semibold">
                                {(user.fullName?.[0] || user.username[0]).toUpperCase()}
                              </span>
                            </div>
                            {user.fullName || user.username}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : selectedAssignee ? (
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-lapis-400 to-lapis-600 flex items-center justify-center ring-2 ring-parchment-200">
                      <span className="text-xs text-parchment-100 font-semibold">
                        {(selectedAssignee.fullName?.[0] || selectedAssignee.username[0]).toUpperCase()}
                      </span>
                    </div>
                    <span className="text-sm text-lapis-700 font-medium">{selectedAssignee.fullName || selectedAssignee.username}</span>
                  </div>
                ) : (
                  <span className="text-sm text-lapis-400 italic">Unassigned</span>
                )}
              </div>
            </div>

            {/* Reporter (view only) */}
            <div>
              <h4 className="flex items-center gap-1.5 text-xs font-semibold text-lapis-500 mb-2">
                <User size={12} />
                Reporter
              </h4>
              <div className="h-10 flex items-center">
                {issue?.reporter ? (
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-clay-400 to-clay-600 flex items-center justify-center ring-2 ring-parchment-200">
                      <span className="text-xs text-parchment-100 font-semibold">
                        {(issue.reporter.fullName?.[0] || issue.reporter.username[0]).toUpperCase()}
                      </span>
                    </div>
                    <span className="text-sm text-lapis-700 font-medium">{issue.reporter.fullName || issue.reporter.username}</span>
                  </div>
                ) : (
                  <span className="text-sm text-lapis-400 italic">{isCreating ? 'You' : 'Unknown'}</span>
                )}
              </div>
            </div>

            {/* Due Date */}
            <div>
              <h4 className="flex items-center gap-1.5 text-xs font-semibold text-lapis-500 mb-2">
                <Calendar size={12} />
                Due Date
              </h4>
              <div className="h-10 flex items-center">
                {isEditing ? (
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="
                      w-full h-10 px-3 rounded-lg text-sm
                      border border-parchment-300 bg-parchment-100/50 text-lapis-700
                      focus:border-lapis-400 focus:bg-parchment-100 outline-none transition-all
                    "
                  />
                ) : dueDate ? (
                  <span className={`text-sm font-medium ${isDueOverdue ? 'text-red-600' : 'text-lapis-700'}`}>
                    {formatDate(dueDate)}
                    {isDueOverdue && <span className="ml-2 text-xs text-red-500">(Overdue)</span>}
                  </span>
                ) : (
                  <span className="text-sm text-lapis-400 italic">No due date</span>
                )}
              </div>
            </div>

            {/* Created (view only) */}
            <div>
              <h4 className="flex items-center gap-1.5 text-xs font-semibold text-lapis-500 mb-2">
                <Clock size={12} />
                Created
              </h4>
              <div className="h-10 flex items-center">
                <span className="text-sm text-lapis-700">
                  {issue?.createdAt ? formatRelativeTime(issue.createdAt) : 'Now'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-parchment-200 bg-parchment-100/80">
          <div className="text-xs text-lapis-400">
            {issue?.updatedAt && !isCreating && (
              <span>Last updated: {formatRelativeTime(issue.updatedAt)}</span>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            {isEditing ? (
              <>
                <button
                  onClick={handleCancel}
                  className="
                    px-4 py-2 rounded-lg text-sm font-medium
                    text-lapis-600 hover:bg-parchment-200
                    transition-colors
                    flex items-center gap-2
                  "
                >
                  Cancel
                  <HotkeyBadge keys="Escape" />
                </button>
                <button
                  onClick={handleSave}
                  disabled={isLoading}
                  className="
                    px-5 py-2 rounded-lg text-sm font-medium
                    bg-lapis-500 text-parchment-50
                    hover:bg-lapis-600 
                    disabled:opacity-50 disabled:cursor-not-allowed
                    transition-colors
                    flex items-center gap-2
                  "
                >
                  {isLoading ? (
                    <span className="inline-block w-4 h-4 border-2 border-parchment-200 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Check size={16} />
                  )}
                  {isCreating ? 'Create Issue' : 'Save Changes'}
                  <HotkeyBadge keys="Ctrl+Enter" variant="dark" />
                </button>
              </>
            ) : (
              <p className="text-xs text-lapis-400 flex items-center gap-1">
                Press <HotkeyBadge keys="e" /> to edit
                {' '}&bull;{' '}
                <HotkeyBadge keys="Escape" /> to close
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
