import React from 'react';
import { X, AlertCircle, User, Calendar, Tag } from 'lucide-react';
import { ButtonWithHotkey } from '../ui/HotkeyBadge';
import { useKeyboardShortcuts } from '../../hooks/useKeyboard';
import type { Issue, CreateIssueRequest, UpdateIssueRequest, PriorityType } from '../../api/issues';
import { Priority } from '../../api/issues';
import type { User as UserType } from '../../api/users';

// ============================================
// Issue Modal - Create/Edit issues
// ============================================

interface IssueModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: CreateIssueRequest | UpdateIssueRequest) => Promise<void>;
  issue?: Issue | null;
  users: UserType[];
  isLoading?: boolean;
}

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
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-lapis-900/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-auto bg-parchment-50 rounded-tablet shadow-tablet border border-parchment-300 m-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-parchment-300">
          <h2 className="text-lg font-inscription text-lapis-600">
            {isEditing ? 'Edit Issue' : 'New Inscription'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-parchment-200 text-lapis-500"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-tablet text-red-600 text-sm">
              {error}
            </div>
          )}

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
              placeholder="What needs to be inscribed?"
              className="w-full px-3 py-2 rounded-tablet border border-parchment-300 
                         bg-parchment-100 text-lapis-700
                         focus:border-lapis-400 focus:ring-1 focus:ring-lapis-400 focus:outline-none
                         placeholder:text-lapis-400"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-lapis-600 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Additional details..."
              rows={3}
              className="w-full px-3 py-2 rounded-tablet border border-parchment-300 
                         bg-parchment-100 text-lapis-700 resize-none
                         focus:border-lapis-400 focus:ring-1 focus:ring-lapis-400 focus:outline-none
                         placeholder:text-lapis-400"
            />
          </div>

          {/* Priority & Assignee */}
          <div className="grid grid-cols-2 gap-4">
            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-lapis-600 mb-1">
                <AlertCircle size={14} className="inline mr-1" />
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as PriorityType)}
                className="w-full px-3 py-2 rounded-tablet border border-parchment-300 
                           bg-parchment-100 text-lapis-700
                           focus:border-lapis-400 focus:ring-1 focus:ring-lapis-400 focus:outline-none"
              >
                <option value={Priority.LOW}>Low</option>
                <option value={Priority.MEDIUM}>Medium</option>
                <option value={Priority.HIGH}>High</option>
                <option value={Priority.CRITICAL}>Critical</option>
              </select>
            </div>

            {/* Assignee */}
            <div>
              <label className="block text-sm font-medium text-lapis-600 mb-1">
                <User size={14} className="inline mr-1" />
                Assignee
              </label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-3 py-2 rounded-tablet border border-parchment-300 
                           bg-parchment-100 text-lapis-700
                           focus:border-lapis-400 focus:ring-1 focus:ring-lapis-400 focus:outline-none"
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
            <label className="block text-sm font-medium text-lapis-600 mb-1">
              <Calendar size={14} className="inline mr-1" />
              Due Date
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 rounded-tablet border border-parchment-300 
                         bg-parchment-100 text-lapis-700
                         focus:border-lapis-400 focus:ring-1 focus:ring-lapis-400 focus:outline-none"
            />
          </div>

          {/* Labels */}
          <div>
            <label className="block text-sm font-medium text-lapis-600 mb-1">
              <Tag size={14} className="inline mr-1" />
              Labels
            </label>
            <div className="flex gap-2 mb-2 flex-wrap">
              {labels.map((label) => (
                <span 
                  key={label}
                  className="inline-flex items-center gap-1 px-2 py-0.5 
                             bg-parchment-200 text-lapis-600 text-sm rounded border border-parchment-300"
                >
                  {label}
                  <button
                    type="button"
                    onClick={() => removeLabel(label)}
                    className="hover:text-red-500"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
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
                placeholder="Add label..."
                className="flex-1 px-3 py-2 rounded-tablet border border-parchment-300 
                           bg-parchment-100 text-lapis-700 text-sm
                           focus:border-lapis-400 focus:ring-1 focus:ring-lapis-400 focus:outline-none
                           placeholder:text-lapis-400"
              />
              <ButtonWithHotkey
                type="button"
                variant="secondary"
                size="sm"
                onClick={addLabel}
              >
                Add
              </ButtonWithHotkey>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-parchment-300 bg-parchment-100">
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
            hotkey="Ctrl+Enter"
          >
            {isLoading ? 'Saving...' : (isEditing ? 'Save Changes' : 'Create Issue')}
          </ButtonWithHotkey>
        </div>
      </div>
    </div>
  );
}
