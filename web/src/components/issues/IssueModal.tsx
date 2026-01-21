import React from 'react';
import { X, AlertCircle, User, Calendar, Tag } from 'lucide-react';
import { ButtonWithHotkey } from '../ui/HotkeyBadge';
import { useKeyboardShortcuts } from '../../hooks/useKeyboard';
import type { Issue, CreateIssueRequest, UpdateIssueRequest, PriorityType } from '../../api/issues';
import { Priority } from '../../api/issues';
import type { User as UserType } from '../../api/users';

// ============================================
// Issue Modal - Create/Edit issues
// Modern Mesopotamian clay tablet aesthetic
// ============================================

interface IssueModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: CreateIssueRequest | UpdateIssueRequest) => Promise<void>;
  issue?: Issue | null;
  users: UserType[];
  isLoading?: boolean;
}

// Priority options with visual indicators
const priorityOptions = [
  { value: Priority.LOW, label: 'Low', icon: '▽', color: 'text-lapis-500' },
  { value: Priority.MEDIUM, label: 'Medium', icon: '●', color: 'text-gold-600' },
  { value: Priority.HIGH, label: 'High', icon: '▲', color: 'text-clay-600' },
  { value: Priority.CRITICAL, label: 'Critical', icon: '🔺', color: 'text-red-600' },
];

export function IssueModal({ 
  isOpen, 
  onClose, 
  onSave, 
  issue, 
  users,
  isLoading 
}: IssueModalProps) {
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [priority, setPriority] = React.useState<PriorityType>(Priority.MEDIUM);
  const [assigneeId, setAssigneeId] = React.useState<number | ''>('');
  const [dueDate, setDueDate] = React.useState('');
  const [labels, setLabels] = React.useState<string[]>([]);
  const [labelInput, setLabelInput] = React.useState('');
  const [error, setError] = React.useState('');
  
  const titleInputRef = React.useRef<HTMLInputElement>(null);
  const isEditing = !!issue;

  // Populate form when editing
  React.useEffect(() => {
    if (issue) {
      setTitle(issue.title);
      setDescription(issue.description || '');
      setPriority(issue.priority);
      setAssigneeId(issue.assigneeId || '');
      setDueDate(issue.dueDate?.split('T')[0] || '');
      setLabels(issue.labels || []);
    } else {
      // Reset form for new issue
      setTitle('');
      setDescription('');
      setPriority(Priority.MEDIUM);
      setAssigneeId('');
      setDueDate('');
      setLabels([]);
    }
    setError('');
    setLabelInput('');
  }, [issue, isOpen]);

  // Focus title input when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setTimeout(() => titleInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Keyboard shortcuts
  useKeyboardShortcuts([
    {
      keys: 'Escape',
      description: 'Close modal',
      handler: onClose,
      global: true,
    },
    {
      keys: 'Ctrl+Enter',
      description: 'Save issue',
      handler: () => handleSubmit(),
      global: true,
    },
  ]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    if (!title.trim()) {
      setError('Title is required');
      titleInputRef.current?.focus();
      return;
    }

    try {
      const data: CreateIssueRequest | UpdateIssueRequest = {
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        assigneeId: assigneeId || undefined,
        labels: labels.length > 0 ? labels : undefined,
        dueDate: dueDate || undefined,
      };
      
      await onSave(data);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save issue');
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-lapis-900/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="
        relative w-full max-w-lg max-h-[90vh] overflow-hidden
        bg-gradient-to-b from-parchment-50 to-parchment-100
        rounded-xl shadow-2xl 
        border border-parchment-300
        animate-scale-in
        flex flex-col
      ">
        {/* Decorative top border */}
        <div className="h-1 bg-gradient-to-r from-clay-400 via-gold-400 to-lapis-400" />
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-parchment-300 bg-parchment-100/50">
          <div className="flex items-center gap-3">
            <span className="text-2xl opacity-60">𒁹</span>
            <div>
              <h2 className="text-lg font-inscription text-lapis-600">
                {isEditing ? 'Edit Inscription' : 'New Inscription'}
              </h2>
              <p className="text-xs text-lapis-500">
                {isEditing ? 'Modify the clay tablet' : 'Carve your task into the tablet'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-parchment-200 text-lapis-500 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm flex items-center gap-2">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-semibold text-lapis-600 mb-2">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              ref={titleInputRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be inscribed?"
              className="
                w-full px-4 py-3 rounded-lg 
                border-2 border-parchment-300 
                bg-parchment-50 text-lapis-700
                focus:border-lapis-400 focus:ring-2 focus:ring-lapis-400/20 focus:outline-none
                placeholder:text-lapis-400
                transition-all duration-200
              "
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-lapis-600 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Additional details for the inscription..."
              rows={3}
              className="
                w-full px-4 py-3 rounded-lg 
                border-2 border-parchment-300 
                bg-parchment-50 text-lapis-700 resize-none
                focus:border-lapis-400 focus:ring-2 focus:ring-lapis-400/20 focus:outline-none
                placeholder:text-lapis-400
                transition-all duration-200
              "
            />
          </div>

          {/* Priority & Assignee */}
          <div className="grid grid-cols-2 gap-4">
            {/* Priority */}
            <div>
              <label className="block text-sm font-semibold text-lapis-600 mb-2">
                <AlertCircle size={14} className="inline mr-1.5 opacity-70" />
                Priority
              </label>
              <div className="grid grid-cols-2 gap-2">
                {priorityOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPriority(opt.value)}
                    className={`
                      px-3 py-2 rounded-lg text-sm font-medium
                      border-2 transition-all duration-150
                      flex items-center justify-center gap-1.5
                      ${priority === opt.value 
                        ? 'border-lapis-400 bg-lapis-50 text-lapis-700' 
                        : 'border-parchment-300 bg-parchment-50 text-lapis-600 hover:border-parchment-400'
                      }
                    `}
                  >
                    <span className={opt.color}>{opt.icon}</span>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Assignee */}
            <div>
              <label className="block text-sm font-semibold text-lapis-600 mb-2">
                <User size={14} className="inline mr-1.5 opacity-70" />
                Assignee
              </label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value ? Number(e.target.value) : '')}
                className="
                  w-full px-4 py-3 rounded-lg 
                  border-2 border-parchment-300 
                  bg-parchment-50 text-lapis-700
                  focus:border-lapis-400 focus:ring-2 focus:ring-lapis-400/20 focus:outline-none
                  transition-all duration-200
                "
              >
                <option value="">Unassigned</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.fullName || user.username}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-sm font-semibold text-lapis-600 mb-2">
              <Calendar size={14} className="inline mr-1.5 opacity-70" />
              Due Date
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="
                w-full px-4 py-3 rounded-lg 
                border-2 border-parchment-300 
                bg-parchment-50 text-lapis-700
                focus:border-lapis-400 focus:ring-2 focus:ring-lapis-400/20 focus:outline-none
                transition-all duration-200
              "
            />
          </div>

          {/* Labels */}
          <div>
            <label className="block text-sm font-semibold text-lapis-600 mb-2">
              <Tag size={14} className="inline mr-1.5 opacity-70" />
              Labels
            </label>
            
            {/* Existing labels */}
            {labels.length > 0 && (
              <div className="flex gap-2 mb-3 flex-wrap">
                {labels.map((label) => (
                  <span 
                    key={label}
                    className="
                      inline-flex items-center gap-1.5 px-2.5 py-1 
                      bg-lapis-100 text-lapis-700 text-sm rounded-lg 
                      border border-lapis-200
                      font-medium
                    "
                  >
                    {label}
                    <button
                      type="button"
                      onClick={() => removeLabel(label)}
                      className="hover:text-red-500 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            
            {/* Add label input */}
            <div className="flex gap-2">
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
                placeholder="Add a label..."
                className="
                  flex-1 px-4 py-2 rounded-lg 
                  border-2 border-parchment-300 
                  bg-parchment-50 text-lapis-700 text-sm
                  focus:border-lapis-400 focus:ring-2 focus:ring-lapis-400/20 focus:outline-none
                  placeholder:text-lapis-400
                  transition-all duration-200
                "
              />
              <button
                type="button"
                onClick={addLabel}
                disabled={!labelInput.trim()}
                className="
                  px-4 py-2 rounded-lg
                  bg-parchment-200 text-lapis-600 text-sm font-medium
                  border-2 border-parchment-300
                  hover:bg-parchment-300 hover:border-parchment-400
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-all duration-150
                "
              >
                Add
              </button>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="
          flex items-center justify-between gap-3 
          px-6 py-4 
          border-t border-parchment-300 
          bg-parchment-100
        ">
          <p className="text-xs text-lapis-400">
            Press <kbd className="px-1.5 py-0.5 bg-parchment-200 rounded text-[10px]">Ctrl+Enter</kbd> to save
          </p>
          <div className="flex items-center gap-3">
            <ButtonWithHotkey
              type="button"
              variant="ghost"
              onClick={onClose}
            >
              Cancel
            </ButtonWithHotkey>
            <ButtonWithHotkey
              type="submit"
              variant="primary"
              onClick={handleSubmit}
              disabled={isLoading}
            >
              {isLoading ? 'Inscribing...' : (isEditing ? 'Save Changes' : 'Create Inscription')}
            </ButtonWithHotkey>
          </div>
        </div>
      </div>
    </div>
  );
}
