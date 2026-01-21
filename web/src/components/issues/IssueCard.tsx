import React from 'react';
import { 
  AlertCircle, 
  Clock, 
  User,
  GripVertical,
  MoreHorizontal
} from 'lucide-react';
import type { Issue, PriorityType } from '../../api/issues';

// ============================================
// Issue Card - Kanban board card component
// ============================================

interface IssueCardProps {
  issue: Issue;
  onEdit?: (issue: Issue) => void;
  onDelete?: (issue: Issue) => void;
  isDragging?: boolean;
}

// Priority styling
const priorityConfig: Record<PriorityType, { color: string; label: string }> = {
  critical: { color: 'text-red-600 bg-red-100 border-red-200', label: 'Critical' },
  high: { color: 'text-clay-600 bg-clay-100 border-clay-200', label: 'High' },
  medium: { color: 'text-gold-700 bg-gold-100 border-gold-200', label: 'Medium' },
  low: { color: 'text-lapis-500 bg-lapis-100 border-lapis-200', label: 'Low' },
};

export function IssueCard({ issue, onEdit, onDelete, isDragging }: IssueCardProps) {
  const [showMenu, setShowMenu] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);
  
  // Close menu when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const priorityStyle = priorityConfig[issue.priority] || priorityConfig.medium;
  
  // Format due date
  const formatDueDate = (dateStr?: string) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return { text: 'Overdue', className: 'text-red-600' };
    if (diffDays === 0) return { text: 'Today', className: 'text-clay-600' };
    if (diffDays === 1) return { text: 'Tomorrow', className: 'text-gold-600' };
    if (diffDays <= 7) return { text: `${diffDays}d`, className: 'text-lapis-500' };
    return { text: date.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' }), className: 'text-lapis-400' };
  };

  const dueInfo = formatDueDate(issue.dueDate);

  return (
    <div
      className={`
        group relative
        bg-parchment-50 rounded-tablet border border-parchment-300
        p-3 cursor-pointer
        hover:border-lapis-300 hover:shadow-tablet
        transition-all duration-150
        ${isDragging ? 'opacity-50 shadow-lg ring-2 ring-lapis-400' : ''}
      `}
      onClick={() => onEdit?.(issue)}
    >
      {/* Drag Handle */}
      <div 
        className="absolute left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-50 cursor-grab active:cursor-grabbing"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <GripVertical size={14} className="text-lapis-400" />
      </div>

      {/* Content */}
      <div className="pl-3">
        {/* Title */}
        <h4 className="text-sm font-medium text-lapis-700 line-clamp-2 mb-2">
          {issue.title}
        </h4>

        {/* Meta row */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Priority badge */}
          <span className={`
            inline-flex items-center gap-1 
            text-[10px] font-medium 
            px-1.5 py-0.5 rounded border
            ${priorityStyle.color}
          `}>
            <AlertCircle size={10} />
            {priorityStyle.label}
          </span>

          {/* Labels */}
          {issue.labels?.slice(0, 2).map((label) => (
            <span
              key={label}
              className="text-[10px] px-1.5 py-0.5 rounded bg-parchment-200 text-lapis-600 border border-parchment-300"
            >
              {label}
            </span>
          ))}
          {issue.labels && issue.labels.length > 2 && (
            <span className="text-[10px] text-lapis-400">
              +{issue.labels.length - 2}
            </span>
          )}
        </div>

        {/* Footer row */}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-parchment-200">
          {/* Assignee */}
          <div className="flex items-center gap-1">
            {issue.assignee ? (
              <>
                <div className="w-5 h-5 rounded-full bg-lapis-500 flex items-center justify-center">
                  <span className="text-[10px] text-parchment-100 font-medium">
                    {issue.assignee.fullName?.[0] || issue.assignee.username[0]}
                  </span>
                </div>
                <span className="text-[10px] text-lapis-500">
                  {issue.assignee.fullName?.split(' ')[0] || issue.assignee.username}
                </span>
              </>
            ) : (
              <div className="flex items-center gap-1 text-lapis-400">
                <User size={12} />
                <span className="text-[10px]">Unassigned</span>
              </div>
            )}
          </div>

          {/* Due date */}
          {dueInfo && (
            <div className={`flex items-center gap-1 ${dueInfo.className}`}>
              <Clock size={10} />
              <span className="text-[10px]">{dueInfo.text}</span>
            </div>
          )}
        </div>
      </div>

      {/* Actions menu */}
      <div className="absolute top-2 right-2" ref={menuRef}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
          className="p-1 rounded hover:bg-parchment-200 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <MoreHorizontal size={14} className="text-lapis-500" />
        </button>
        
        {showMenu && (
          <div className="absolute right-0 top-full mt-1 bg-parchment-50 border border-parchment-300 rounded-tablet shadow-lg py-1 z-10 min-w-[120px]">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit?.(issue);
                setShowMenu(false);
              }}
              className="w-full px-3 py-1.5 text-left text-sm text-lapis-600 hover:bg-parchment-200"
            >
              Edit
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.(issue);
                setShowMenu(false);
              }}
              className="w-full px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50"
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
