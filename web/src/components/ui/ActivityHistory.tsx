import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  History, 
  ChevronDown, 
  ChevronRight, 
  Clock,
  ArrowRight,
  FileText,
  Loader2
} from 'lucide-react';
import { 
  type ActivityLog, 
  type ChangeValue,
  isTextDiff
} from '../../api/activity';
import { useIssueActivity, useDocActivity } from '../../hooks/useApi';
import { DiffModal } from './DiffModal';

interface ActivityHistoryProps {
  entityType: 'issue' | 'doc';
  entityId: number;
}

export function ActivityHistory({ entityType, entityId }: ActivityHistoryProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);

  // Use the appropriate React Query hook based on entity type
  const issueActivityQuery = useIssueActivity(entityType === 'issue' ? entityId : undefined);
  const docActivityQuery = useDocActivity(entityType === 'doc' ? entityId : undefined);
  
  // Select the active query based on entity type
  const activeQuery = entityType === 'issue' ? issueActivityQuery : docActivityQuery;
  
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    isError,
  } = activeQuery;

  // Flatten all pages into a single activities array
  const activities = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap(page => page.activities);
  }, [data]);

  // Diff modal state
  const [diffModal, setDiffModal] = useState<{
    isOpen: boolean;
    title: string;
    oldText: string;
    newText: string;
  }>({ isOpen: false, title: '', oldText: '', newText: '' });

  const handleViewDiff = (fieldName: string, change: ChangeValue) => {
    if (isTextDiff(change)) {
      const fieldLabel = t(`history.fields.${fieldName}`, fieldName);
      setDiffModal({
        isOpen: true,
        title: t('history.diff.title', { field: fieldLabel }),
        oldText: change.old || '',
        newText: change.new || '',
      });
    }
  };

  const handleLoadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  // Get the latest activity (first in the list)
  const latestActivity = activities[0];
  const remainingActivities = activities.slice(1);
  const hasRemainingActivities = remainingActivities.length > 0 || hasNextPage;

  // Don't render anything if loading initial data
  if (isLoading) {
    return (
      <div className="border-t border-parchment-200 mt-6 pt-4">
        <div className="flex items-center gap-2 text-sm text-lapis-400">
          <Loader2 size={14} className="animate-spin" />
          {t('history.loading')}
        </div>
      </div>
    );
  }

  // Don't render if no activities and no error
  if (!latestActivity && !isError) {
    return null;
  }

  return (
    <div className="border-t border-parchment-200 mt-6 pt-4">
      {/* Section Header */}
      <div className="flex items-center gap-2 text-sm font-semibold text-lapis-600 mb-3">
        <History size={16} />
        <span>{t('history.title')}</span>
      </div>

      {isError ? (
        <div className="text-sm text-clay-600">{t('history.failedToLoad')}</div>
      ) : (
        <>
          {/* Latest Activity - Always visible */}
          {latestActivity && (
            <div className="relative ml-2">
              {/* Show vertical line only if there are more activities */}
              {(isExpanded && remainingActivities.length > 0) && (
                <div className="absolute left-[7px] top-6 bottom-0 w-0.5 bg-parchment-300" />
              )}
              
              <ActivityEntry
                activity={latestActivity}
                onViewDiff={handleViewDiff}
              />
            </div>
          )}

          {/* Expand/Collapse for remaining activities */}
          {hasRemainingActivities && (
            <div className="mt-2 ml-2">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-1 text-xs text-lapis-500 hover:text-lapis-700 transition-colors"
              >
                {isExpanded ? (
                  <>
                    <ChevronDown size={14} />
                    <span>{t('history.hideOlder')}</span>
                  </>
                ) : (
                  <>
                    <ChevronRight size={14} />
                    <span>
                      {remainingActivities.length > 0 
                        ? t('history.showOlder', { count: remainingActivities.length }) + (hasNextPage ? '+' : '')
                        : t('history.showOlderMore')
                      }
                    </span>
                  </>
                )}
              </button>

              {/* Expanded Activities */}
              {isExpanded && (
                <div className="mt-3 relative">
                  {/* Vertical line */}
                  {remainingActivities.length > 0 && (
                    <div className="absolute left-[7px] top-0 bottom-2 w-0.5 bg-parchment-300" />
                  )}

                  {/* Activity entries */}
                  <div className="space-y-4">
                    {remainingActivities.map((activity) => (
                      <ActivityEntry
                        key={activity.id}
                        activity={activity}
                        onViewDiff={handleViewDiff}
                      />
                    ))}
                  </div>

                  {/* Load more button */}
                  {hasNextPage && (
                    <div className="mt-4 ml-6">
                      <button
                        onClick={handleLoadMore}
                        disabled={isFetchingNextPage}
                        className="text-xs text-lapis-500 hover:text-lapis-700 hover:underline transition-colors disabled:opacity-50"
                      >
                        {isFetchingNextPage ? (
                          <span className="flex items-center gap-1">
                            <Loader2 size={12} className="animate-spin" />
                            {t('history.loading')}
                          </span>
                        ) : (
                          t('history.loadMore')
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Diff Modal */}
      <DiffModal
        isOpen={diffModal.isOpen}
        onClose={() => setDiffModal(prev => ({ ...prev, isOpen: false }))}
        title={diffModal.title}
        oldText={diffModal.oldText}
        newText={diffModal.newText}
      />
    </div>
  );
}

interface ActivityEntryProps {
  activity: ActivityLog;
  onViewDiff: (fieldName: string, change: ChangeValue) => void;
}

function ActivityEntry({ activity, onViewDiff }: ActivityEntryProps) {
  const { t, i18n } = useTranslation();
  const isCreated = activity.action.endsWith('.created');
  
  // Format relative time with translations
  const formatRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    // Check if same day
    const isSameDay = date.getFullYear() === now.getFullYear() &&
                      date.getMonth() === now.getMonth() &&
                      date.getDate() === now.getDate();

    // Check if yesterday
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.getFullYear() === yesterday.getFullYear() &&
                        date.getMonth() === yesterday.getMonth() &&
                        date.getDate() === yesterday.getDate();

    const timeStr = date.toLocaleTimeString(i18n.language, { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });

    if (diffSecs < 60) {
      return t('history.justNow');
    }
    if (diffMins < 60) {
      return diffMins === 1 
        ? t('history.minuteAgo') 
        : t('history.minutesAgo', { count: diffMins });
    }
    if (isSameDay) {
      return diffHours === 1 
        ? t('history.hourAgo') 
        : t('history.hoursAgo', { count: diffHours });
    }
    if (isYesterday) {
      return t('history.yesterdayAt', { time: timeStr });
    }
    if (diffDays < 7) {
      const dayName = date.toLocaleDateString(i18n.language, { weekday: 'long' });
      return t('history.dayAt', { day: dayName, time: timeStr });
    }
    if (date.getFullYear() === now.getFullYear()) {
      const dateStr = date.toLocaleDateString(i18n.language, { month: 'short', day: 'numeric' });
      return t('history.dateAt', { date: dateStr, time: timeStr });
    }
    return date.toLocaleDateString(i18n.language, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatFullDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString(i18n.language, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <div className="relative flex gap-3">
      {/* Timeline dot */}
      <div 
        className={`relative z-10 w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5 ${
          isCreated 
            ? 'bg-lapis-500 border-lapis-500' 
            : 'bg-parchment-50 border-lapis-400'
        }`}
      />

      {/* Content */}
      <div className="flex-1 min-w-0 pb-2">
        {/* User and action */}
        <div className="text-sm">
          <span className="font-medium text-lapis-700">
            {activity.user?.fullName || activity.user?.username || 'System'}
          </span>
          <span className="text-lapis-500 ms-1">
            {t(`history.actions.${activity.action}`, activity.action)}
          </span>
        </div>

        {/* Changes detail */}
        {activity.changes && Object.keys(activity.changes).length > 0 && (
          <div className="mt-1.5 space-y-1">
            {Object.entries(activity.changes).map(([field, change]) => (
              <ChangeDetail
                key={field}
                field={field}
                change={change as ChangeValue}
                onViewDiff={onViewDiff}
              />
            ))}
          </div>
        )}

        {/* Timestamp */}
        <div 
          className="mt-1 flex items-center gap-1 text-xs text-lapis-400"
          title={formatFullDate(activity.createdAt)}
        >
          <Clock size={12} />
          {formatRelativeTime(activity.createdAt)}
        </div>
      </div>
    </div>
  );
}

interface ChangeDetailProps {
  field: string;
  change: ChangeValue;
  onViewDiff: (fieldName: string, change: ChangeValue) => void;
}

function ChangeDetail({ field, change, onViewDiff }: ChangeDetailProps) {
  const { t, i18n } = useTranslation();

  // Handle text diff (description/content)
  if (isTextDiff(change)) {
    const fieldLabel = t(`history.fields.${field}`, field);
    return (
      <div className="flex items-center gap-2 text-xs text-lapis-500 bg-parchment-100 rounded px-2 py-1">
        <FileText size={12} className="flex-shrink-0" />
        <span>{t('history.changes.updated', { field: fieldLabel })}</span>
        <span className="text-lapis-400">
          ({change.addedChars ? `+${change.addedChars}` : ''}{change.addedChars && change.removedChars ? ' / ' : ''}{change.removedChars ? `-${change.removedChars}` : ''} {t('history.changes.chars')})
        </span>
        <button
          onClick={() => onViewDiff(field, change)}
          className="ms-auto text-lapis-600 hover:text-lapis-800 hover:underline"
        >
          {t('history.changes.viewDiff')}
        </button>
      </div>
    );
  }

  // Handle status change with special formatting
  if (field === 'status') {
    return (
      <div className="flex items-center gap-2 text-xs">
        <StatusBadge status={String(change.old)} />
        <ArrowRight size={12} className="text-lapis-400" />
        <StatusBadge status={String(change.new)} />
      </div>
    );
  }

  // Handle priority change
  if (field === 'priority') {
    return (
      <div className="flex items-center gap-2 text-xs">
        <PriorityBadge priority={String(change.old)} />
        <ArrowRight size={12} className="text-lapis-400" />
        <PriorityBadge priority={String(change.new)} />
      </div>
    );
  }

  // Handle labels change
  if (field === 'labels') {
    const oldLabels = (change.old as string[] | undefined) || [];
    const newLabels = (change.new as string[] | undefined) || [];
    const added = newLabels.filter(l => !oldLabels.includes(l));
    const removed = oldLabels.filter(l => !newLabels.includes(l));

    return (
      <div className="text-xs text-lapis-500">
        {added.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-green-600">+</span>
            {added.map(label => (
              <span key={label} className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded">
                {label}
              </span>
            ))}
          </div>
        )}
        {removed.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap mt-1">
            <span className="text-red-600">-</span>
            {removed.map(label => (
              <span key={label} className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded line-through">
                {label}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Handle assignee change (new format with names)
  if (field === 'assignee') {
    const oldName = (change as Record<string, unknown>).oldName as string || t('history.changes.unassigned');
    const newName = (change as Record<string, unknown>).newName as string || t('history.changes.unassigned');
    return (
      <div className="text-xs text-lapis-500">
        {t('history.changes.changedAssignee')} <span className="text-lapis-400 line-through">{oldName || t('history.changes.unassigned')}</span>
        <ArrowRight size={10} className="inline mx-1" />
        <span className="text-lapis-600">{newName || t('history.changes.unassigned')}</span>
      </div>
    );
  }

  // Handle legacy assigneeId format (for old activity logs)
  if (field === 'assigneeId') {
    const oldVal = change.old ? `User #${change.old}` : t('history.changes.unassigned');
    const newVal = change.new ? `User #${change.new}` : t('history.changes.unassigned');
    return (
      <div className="text-xs text-lapis-500">
        {t('history.changes.changedAssignee')} <span className="text-lapis-400 line-through">{oldVal}</span>
        <ArrowRight size={10} className="inline mx-1" />
        <span className="text-lapis-600">{newVal}</span>
      </div>
    );
  }

  // Handle title change
  if (field === 'title') {
    return (
      <div className="text-xs text-lapis-500">
        <div>
          <span className="text-lapis-400 line-through">{String(change.old)}</span>
        </div>
        <div className="flex items-center gap-1">
          <ArrowRight size={10} />
          <span className="text-lapis-600">{String(change.new)}</span>
        </div>
      </div>
    );
  }

  // Handle due date change
  if (field === 'dueDate') {
    const formatDate = (val: unknown): string => {
      if (!val) return t('issueModal.noDueDate');
      const date = new Date(String(val));
      return date.toLocaleDateString(i18n.language, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    };
    return (
      <div className="text-xs text-lapis-500">
        {t('history.fields.dueDate')}:{' '}
        <span className="text-lapis-400 line-through mx-1">{formatDate(change.old)}</span>
        <ArrowRight size={10} className="inline" />
        <span className="text-lapis-600 ms-1">{formatDate(change.new)}</span>
      </div>
    );
  }

  // Generic change display
  const fieldLabel = t(`history.fields.${field}`, field);
  const oldVal = change.old !== undefined && change.old !== null ? String(change.old) : '-';
  const newVal = change.new !== undefined && change.new !== null ? String(change.new) : '-';

  return (
    <div className="text-xs text-lapis-500">
      {fieldLabel}: 
      <span className="text-lapis-400 line-through mx-1">{oldVal}</span>
      <ArrowRight size={10} className="inline" />
      <span className="text-lapis-600 ms-1">{newVal}</span>
    </div>
  );
}

// Status badge component
function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const colors: Record<string, string> = {
    to_inscribe: 'bg-parchment-200 text-lapis-600',
    carving: 'bg-gold-100 text-gold-700',
    baked: 'bg-green-100 text-green-700',
  };

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[status] || 'bg-parchment-200 text-lapis-600'}`}>
      {t(`history.statuses.${status}`, status)}
    </span>
  );
}

// Priority badge component
function PriorityBadge({ priority }: { priority: string }) {
  const { t } = useTranslation();
  const colors: Record<string, string> = {
    low: 'bg-lapis-100 text-lapis-600',
    medium: 'bg-gold-100 text-gold-700',
    high: 'bg-clay-100 text-clay-700',
    critical: 'bg-red-100 text-red-700',
  };

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[priority] || 'bg-parchment-200 text-lapis-600'}`}>
      {t(`history.priorities.${priority}`, priority)}
    </span>
  );
}

export default ActivityHistory;
