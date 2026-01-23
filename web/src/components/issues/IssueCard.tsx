import React from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Clock, 
  User,
  GripVertical,
  MoreHorizontal,
  Edit3,
  Trash2
} from 'lucide-react';
import type { Issue, PriorityType } from '../../api/issues';

// Strip markdown syntax for plain text preview
function stripMarkdown(text: string): string {
  return text
    // Remove headers
    .replace(/^#{1,6}\s+/gm, '')
    // Remove bold/italic
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    // Remove links, keep text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove images
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
    // Remove inline code
    .replace(/`([^`]+)`/g, '$1')
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, '')
    // Remove blockquotes
    .replace(/^>\s+/gm, '')
    // Remove horizontal rules
    .replace(/^[-*_]{3,}\s*$/gm, '')
    // Remove list markers
    .replace(/^[\s]*[-*+]\s+/gm, '')
    .replace(/^[\s]*\d+\.\s+/gm, '')
    // Remove checkboxes
    .replace(/\[[ x]\]\s*/gi, '')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

// ============================================
// Issue Card - Kanban board card component
// Modern Mesopotamian clay tablet aesthetic
// ============================================

interface IssueCardProps {
  issue: Issue;
  onView?: (issue: Issue) => void;
  onEdit?: (issue: Issue) => void;
  onDelete?: (issue: Issue) => void;
  isDragging?: boolean;
}

// Priority styling with Mesopotamian color palette
const priorityStyles: Record<PriorityType, { 
  color: string; 
  icon: string;
}> = {
  critical: { 
    color: 'text-red-700 bg-red-100 border-red-300', 
    icon: '🔺'
  },
  high: { 
    color: 'text-clay-700 bg-clay-100 border-clay-300', 
    icon: '▲'
  },
  medium: { 
    color: 'text-gold-700 bg-gold-100 border-gold-300', 
    icon: '●'
  },
  low: { 
    color: 'text-lapis-600 bg-lapis-100 border-lapis-300', 
    icon: '▽'
  },
};

export function IssueCard({ issue, onView, onEdit, onDelete, isDragging }: IssueCardProps) {
  const { t } = useTranslation();
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

  const priorityStyle = priorityStyles[issue.priority] || priorityStyles.medium;
  const getPriorityLabel = (p: PriorityType) => t(`issueModal.priorities.${p}`);
  
  // Format due date with relative time
  const formatDueDate = (dateStr?: string) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return { text: t('issueCard.dueDate.overdue', { days: Math.abs(diffDays) }), className: 'text-red-600 bg-red-50', urgent: true };
    if (diffDays === 0) return { text: t('issueCard.dueDate.today'), className: 'text-clay-600 bg-clay-50', urgent: true };
    if (diffDays === 1) return { text: t('issueCard.dueDate.tomorrow'), className: 'text-gold-600 bg-gold-50', urgent: false };
    if (diffDays <= 7) return { text: t('issueCard.dueDate.days', { days: diffDays }), className: 'text-lapis-600 bg-lapis-50', urgent: false };
    return { 
      text: date.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' }), 
      className: 'text-lapis-500 bg-parchment-200',
      urgent: false 
    };
  };

  const dueInfo = formatDueDate(issue.dueDate);

  return (
    <div
      className={`
        group relative
        bg-gradient-to-b from-parchment-50 to-parchment-100
        rounded-lg
        border border-parchment-300
        shadow-sm
        cursor-grab active:cursor-grabbing
        transition-all duration-200
        hover:shadow-tablet hover:border-lapis-300
        ${isDragging 
          ? 'opacity-60 scale-105 shadow-lg ring-2 ring-lapis-400 rotate-1' 
          : 'hover:-translate-y-0.5'
        }
      `}
      onClick={() => onView?.(issue)}
    >
      {/* Top accent line based on priority */}
      <div className={`
        absolute top-0 left-2 right-2 h-0.5 rounded-full
        ${issue.priority === 'critical' ? 'bg-red-400' : ''}
        ${issue.priority === 'high' ? 'bg-clay-400' : ''}
        ${issue.priority === 'medium' ? 'bg-gold-400' : ''}
        ${issue.priority === 'low' ? 'bg-lapis-300' : ''}
      `} />

      {/* Drag Handle - visible on hover */}
      <div 
        className="
          absolute left-0 top-0 bottom-0 w-6
          flex items-center justify-center
          opacity-0 group-hover:opacity-100
          transition-opacity duration-150
          cursor-grab active:cursor-grabbing
        "
        onMouseDown={(e) => e.stopPropagation()}
      >
        <GripVertical size={14} className="text-lapis-400" />
      </div>

      {/* Content */}
      <div className="p-3 pl-5">
        {/* Title */}
        <h4 className="text-sm font-medium text-lapis-700 line-clamp-2 pr-6 leading-snug">
          {issue.title}
        </h4>

        {/* Description preview (if exists) */}
        {issue.description && (
          <p className="text-xs text-lapis-500 mt-1 line-clamp-1 opacity-70">
            {stripMarkdown(issue.description)}
          </p>
        )}

        {/* Tags row */}
        <div className="flex items-center gap-1.5 flex-wrap mt-2">
          {/* Priority badge */}
          <span className={`
            inline-flex items-center gap-1 
            text-[10px] font-semibold 
            px-1.5 py-0.5 rounded-md border
            ${priorityStyle.color}
          `}>
            <span className="text-[8px]">{priorityStyle.icon}</span>
            {getPriorityLabel(issue.priority)}
          </span>

          {/* Labels */}
          {issue.labels?.slice(0, 2).map((label) => (
            <span
              key={label}
              className="
                text-[10px] px-1.5 py-0.5 rounded-md
                bg-parchment-200 text-lapis-600 
                border border-parchment-300
                font-medium
              "
            >
              {label}
            </span>
          ))}
          {issue.labels && issue.labels.length > 2 && (
            <span className="text-[10px] text-lapis-400 font-medium">
              +{issue.labels.length - 2}
            </span>
          )}
        </div>

        {/* Footer row */}
        <div className="flex items-center justify-between mt-3 pt-2 border-t border-parchment-200">
          {/* Assignee */}
          <div className="flex items-center gap-1.5">
            {issue.assignee ? (
              <div className="flex items-center gap-1.5">
                <div className="
                  w-5 h-5 rounded-full 
                  bg-gradient-to-br from-lapis-400 to-lapis-600
                  flex items-center justify-center
                  ring-1 ring-parchment-300
                ">
                  <span className="text-[10px] text-parchment-100 font-semibold">
                    {(issue.assignee.fullName?.[0] || issue.assignee.username[0]).toUpperCase()}
                  </span>
                </div>
                <span className="text-[11px] text-lapis-600 font-medium">
                  {issue.assignee.fullName?.split(' ')[0] || issue.assignee.username}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-lapis-400">
                <User size={12} strokeWidth={2.5} />
                <span className="text-[11px]">{t('issueModal.unassigned')}</span>
              </div>
            )}
          </div>

          {/* Due date */}
          {dueInfo && (
            <div className={`
              flex items-center gap-1 px-1.5 py-0.5 rounded-md
              ${dueInfo.className}
            `}>
              <Clock size={10} strokeWidth={2.5} />
              <span className={`text-[10px] font-medium ${dueInfo.urgent ? 'animate-pulse' : ''}`}>
                {dueInfo.text}
              </span>
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
          className="
            p-1.5 rounded-md
            bg-parchment-100 border border-transparent
            opacity-0 group-hover:opacity-100 
            hover:bg-parchment-200 hover:border-parchment-300
            transition-all duration-150
          "
        >
          <MoreHorizontal size={14} className="text-lapis-500" />
        </button>
        
        {showMenu && (
          <div className="
            absolute right-0 top-full mt-1 
            bg-parchment-50 
            border border-parchment-300 
            rounded-lg shadow-lg 
            py-1 z-20 min-w-[140px]
            animate-scale-in
          ">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit?.(issue);
                setShowMenu(false);
              }}
              className="
                w-full px-3 py-2 text-left text-sm text-lapis-600 
                hover:bg-parchment-200 
                flex items-center gap-2
              "
            >
              <Edit3 size={14} />
              {t('issueCard.editInscription')}
            </button>
            <div className="h-px bg-parchment-200 my-1" />
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.(issue);
                setShowMenu(false);
              }}
              className="
                w-full px-3 py-2 text-left text-sm text-red-600 
                hover:bg-red-50 
                flex items-center gap-2
              "
            >
              <Trash2 size={14} />
              {t('common.delete')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
