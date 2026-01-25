import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, FileText, BookOpen, Package, X } from 'lucide-react';
import { LoadingIndicator } from './LoadingIndicator';
import { notificationsApi, type Notification, type EntityType } from '../../api/notifications';
import { useWebSocket } from '../../context/WebSocketContext';
import { useToast } from '../../context/ToastContext';
import { Avatar } from './Avatar';

// ============================================
// Notification Bell Component
// Shows unread count badge and dropdown with notifications
// ============================================

// Format relative time
function formatRelativeTime(dateString: string, t: ReturnType<typeof useTranslation>['t']): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return t('dates.justNow');
  if (diffMins < 60) return t('dates.minutesAgo', { count: diffMins });
  if (diffHours < 24) return t('dates.hoursAgo', { count: diffHours });
  if (diffDays === 1) return t('dates.yesterday');
  if (diffDays < 7) return t('dates.daysAgo', { count: diffDays });
  
  return date.toLocaleDateString(undefined, { 
    month: 'short', 
    day: 'numeric',
  });
}

// Get entity icon with background
function getEntityIcon(entityType: EntityType) {
  const iconClass = "w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0";
  
  switch (entityType) {
    case 'issue':
      return (
        <div className={`${iconClass} bg-lapis-100`}>
          <FileText size={14} className="text-lapis-600" />
        </div>
      );
    case 'doc':
      return (
        <div className={`${iconClass} bg-emerald-100`}>
          <BookOpen size={14} className="text-emerald-600" />
        </div>
      );
    case 'release':
      return (
        <div className={`${iconClass} bg-amber-100`}>
          <Package size={14} className="text-amber-600" />
        </div>
      );
  }
}

// Get entity route
function getEntityRoute(entityType: EntityType, entityId: number, tab?: string): string {
  const base = (() => {
    switch (entityType) {
      case 'issue':
        return `/issues/${entityId}`;
      case 'doc':
        return `/docs/${entityId}`;
      case 'release':
        return `/releases/${entityId}`;
    }
  })();
  return tab ? `${base}?tab=${tab}` : base;
}

export function NotificationBell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { lastEvent } = useWebSocket();
  const { showToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Fetch unread count
  const { data: countData } = useQuery({
    queryKey: ['notifications', 'count'],
    queryFn: () => notificationsApi.getUnreadCount(),
    refetchInterval: 60000, // Refetch every minute as backup
  });

  // Fetch notifications when dropdown is open
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: () => notificationsApi.list(50),
    enabled: isOpen,
  });

  // Listen for WebSocket notification events
  const lastEventRef = useRef(lastEvent);
  useEffect(() => {
    if (lastEvent === lastEventRef.current) return;
    lastEventRef.current = lastEvent;
    
    if (lastEvent?.type === 'notification_created') {
      // Refetch notifications and count
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  }, [lastEvent, queryClient]);

  // Mark single notification as read
  const markReadMutation = useMutation({
    mutationFn: (id: number) => notificationsApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Mark all as read
  const markAllReadMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Handle click on notification
  const handleNotificationClick = (notification: Notification) => {
    // Mark as read if not already
    if (!notification.isRead) {
      markReadMutation.mutate(notification.id);
    }
    
    // For deleted entities, show toast instead of navigating
    if (notification.notificationType === 'entity_deleted') {
      showToast(t('notifications.itemDeleted'), 'info');
      setIsOpen(false);
      return;
    }
    
    // For entity updates, navigate to activity tab
    if (notification.notificationType === 'entity_updated') {
      navigate(getEntityRoute(notification.entityType, notification.entityId, 'activity'));
      setIsOpen(false);
      return;
    }
    
    // Navigate to entity (default - comments tab for comment notifications)
    navigate(getEntityRoute(notification.entityType, notification.entityId));
    setIsOpen(false);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close on escape
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const unreadCount = countData?.unread ?? 0;
  const hasUnread = unreadCount > 0;

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`
          relative flex items-center justify-center
          w-10 h-10 rounded-tablet
          transition-colors
          ${isOpen 
            ? 'bg-lapis-100 text-lapis-700' 
            : 'text-lapis-500 hover:bg-parchment-200 hover:text-lapis-600'
          }
        `}
        aria-label={t('notifications.title')}
      >
        <Bell size={20} />
        
        {/* Unread badge */}
        {hasUnread && (
          <span className="
            absolute -top-0.5 -right-0.5
            min-w-[18px] h-[18px] px-1
            flex items-center justify-center
            text-[10px] font-bold text-parchment-50
            bg-clay-500 rounded-full
            ring-2 ring-parchment-50
          ">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="
            absolute top-full ltr:left-0 rtl:right-0 mt-2
            w-96 max-h-[28rem]
            bg-parchment-50 rounded-lg
            shadow-lg border border-parchment-300
            flex flex-col
            z-50
          "
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-parchment-200">
            <h3 className="font-semibold text-lapis-700">
              {t('notifications.title')}
            </h3>
            <div className="flex items-center gap-2">
              {hasUnread && (
                <button
                  onClick={() => markAllReadMutation.mutate()}
                  disabled={markAllReadMutation.isPending}
                  className="
                    flex items-center gap-1.5
                    px-2 py-1 rounded text-xs
                    text-lapis-500 hover:text-lapis-700 hover:bg-parchment-100
                    disabled:opacity-50
                    transition-colors
                  "
                  title={t('notifications.markAllRead')}
                >
                  <CheckCheck size={14} />
                  <span className="hidden sm:inline">{t('notifications.markAllRead')}</span>
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded text-stone-400 hover:text-lapis-600 hover:bg-parchment-100"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Notifications List */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="py-8">
                <LoadingIndicator size="md" className="text-stone-400" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-stone-400">
                <Bell size={32} className="mb-2 opacity-50" />
                <span className="text-sm">{t('notifications.empty')}</span>
              </div>
            ) : (
              <ul className="divide-y divide-parchment-100">
                {notifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onClick={() => handleNotificationClick(notification)}
                    formatRelativeTime={(date) => formatRelativeTime(date, t)}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Individual notification item
interface NotificationItemProps {
  notification: Notification;
  onClick: () => void;
  formatRelativeTime: (date: string) => string;
}

function NotificationItem({ notification, onClick, formatRelativeTime }: NotificationItemProps) {
  const { t } = useTranslation();
  const actorName = notification.actor?.fullName || notification.actor?.username || 'Someone';
  
  // Determine if this is a modification or deletion notification
  const isModification = notification.notificationType === 'entity_updated';
  const isDeletion = notification.notificationType === 'entity_deleted';
  
  return (
    <li>
      <button
        onClick={onClick}
        className={`
          w-full flex gap-3 px-4 py-3 text-left
          transition-colors
          ${notification.isRead 
            ? 'opacity-60 hover:opacity-80 hover:bg-parchment-100/50' 
            : 'hover:bg-parchment-100'
          }
          ${isDeletion ? 'bg-clay-50/50' : ''}
        `}
      >
        {/* Entity Icon */}
        <div className="flex-shrink-0 mt-0.5">
          {getEntityIcon(notification.entityType)}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Entity title with action tag */}
          <div className="flex items-center gap-2">
            {/* Action tag */}
            {isModification && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gold-100 text-gold-700 flex-shrink-0">
                {t('notifications.tags.modified')}
              </span>
            )}
            {isDeletion && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-clay-100 text-clay-700 flex-shrink-0">
                {t('notifications.tags.deleted')}
              </span>
            )}
            <span className={`text-sm truncate ${notification.isRead ? 'text-lapis-600' : 'text-lapis-700 font-semibold'}`}>
              {notification.title}
            </span>
            <span className="text-xs text-stone-500 flex-shrink-0">
              {formatRelativeTime(notification.createdAt)}
            </span>
          </div>
          
          {/* Action message with actor (secondary) */}
          <div className="flex items-center gap-1.5 mt-1">
            <Avatar 
              name={actorName}
              avatarUrl={notification.actor?.avatarUrl}
              username={notification.actor?.username}
              size="xs"
            />
            <span className={`text-xs ${notification.isRead ? 'text-stone-500' : 'text-lapis-500'}`}>
              {notification.message}
            </span>
          </div>
        </div>

        {/* Unread indicator */}
        {!notification.isRead && (
          <div className="flex-shrink-0 self-center">
            <div className="w-2 h-2 rounded-full bg-clay-500" />
          </div>
        )}
      </button>
    </li>
  );
}

export default NotificationBell;
