import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Users } from 'lucide-react';
import { useWebSocket } from '../../context/WebSocketContext';
import { usersApi, type User } from '../../api/users';
import { Avatar } from './Avatar';

// Maximum number of avatars to show before "+X more"
const MAX_VISIBLE_AVATARS = 4;

/**
 * ActiveUsers - Sidebar widget showing currently connected (WebSocket) users
 * Updates in real-time when users connect/disconnect
 */
export function ActiveUsers() {
  const { t } = useTranslation();
  const { lastEvent, status } = useWebSocket();
  const [activeUsers, setActiveUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch active users from API
  const fetchActiveUsers = useCallback(async () => {
    try {
      const response = await usersApi.getActive();
      setActiveUsers(response.users);
    } catch (error) {
      console.error('[ActiveUsers] Failed to fetch active users:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchActiveUsers();
  }, [fetchActiveUsers]);

  // Refetch when presence.update event is received
  useEffect(() => {
    if (lastEvent?.type === 'presence.update') {
      fetchActiveUsers();
    }
  }, [lastEvent, fetchActiveUsers]);

  // Don't show anything if WebSocket is not connected
  if (status !== 'connected') {
    return null;
  }

  // Show loading skeleton
  if (loading) {
    return (
      <div className="px-3 py-2">
        <div className="flex items-center gap-2 text-xs text-lapis-500 mb-2">
          <Users size={14} />
          <span>{t('presence.onlineNow')}</span>
        </div>
        <div className="flex -space-x-2 rtl:space-x-reverse">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-8 h-8 rounded-full bg-parchment-300 animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  // No users (shouldn't happen since current user should be connected)
  if (activeUsers.length === 0) {
    return null;
  }

  const visibleUsers = activeUsers.slice(0, MAX_VISIBLE_AVATARS);
  const remainingCount = activeUsers.length - MAX_VISIBLE_AVATARS;

  return (
    <div className="px-3 py-2">
      {/* Header */}
      <div className="flex items-center gap-2 text-xs text-lapis-500 mb-2">
        <Users size={14} />
        <span>{t('presence.onlineNow')}</span>
        <span className="ml-auto rtl:ml-0 rtl:mr-auto text-lapis-400">
          {activeUsers.length}
        </span>
      </div>

      {/* Stacked avatars with online indicator */}
      <div className="flex items-center -space-x-2 rtl:space-x-reverse">
        {visibleUsers.map((user) => (
          <div key={user.id} className="relative" title={user.fullName || user.username}>
            <Avatar
              name={user.fullName || user.username}
              avatarUrl={user.avatarUrl}
              username={user.username}
              size="md"
              className="ring-2 ring-parchment-50"
            />
            {/* Green online dot */}
            <span 
              className="absolute bottom-0 ltr:right-0 rtl:left-0 block w-2.5 h-2.5 
                         bg-green-500 rounded-full ring-2 ring-parchment-50"
              aria-hidden="true"
            />
          </div>
        ))}
        
        {/* Overflow indicator */}
        {remainingCount > 0 && (
          <div 
            className="w-8 h-8 rounded-full bg-parchment-300 ring-2 ring-parchment-50
                       flex items-center justify-center text-xs font-medium text-lapis-600"
            title={activeUsers.slice(MAX_VISIBLE_AVATARS).map(u => u.fullName || u.username).join(', ')}
          >
            +{remainingCount}
          </div>
        )}
      </div>

      {/* Show "Just you" if only one user */}
      {activeUsers.length === 1 && (
        <p className="text-xs text-lapis-400 mt-1.5">
          {t('presence.justYou')}
        </p>
      )}
    </div>
  );
}
