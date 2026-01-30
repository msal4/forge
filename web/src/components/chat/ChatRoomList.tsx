
import { Users, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import type { OnlineUser } from '../../context/WebSocketContext';

// ============================================
// Chat Room List - Team + DM rooms
// ============================================

export function ChatRoomList() {
  const { rooms, activeRoom, switchRoom, onlineUsers, openDM } = useChat();
  const { user } = useAuth();
  const { t } = useTranslation();

  // Get online users that aren't the current user and don't have a DM room yet
  const availableDMUsers = onlineUsers.filter(u => {
    if (u.id === user?.id) return false;
    // Check if there's already a DM room with this user
    return !rooms.some(room => room.type === 'dm' && room.userId === u.id);
  });

  return (
    <div className="border-b border-parchment-300 dark:border-lapis-700">
      {/* Room list */}
      <div className="p-2 space-y-0.5 max-h-48 overflow-y-auto scrollbar-thin">
        {rooms.map(room => (
          <button
            key={room.id}
            onClick={() => switchRoom(room.id)}
            className={`
              w-full flex items-center gap-2 px-3 py-2 rounded-tablet text-sm
              transition-colors
              ${activeRoom === room.id
                ? 'bg-lapis-100 dark:bg-lapis-800 text-lapis-700 dark:text-parchment-200'
                : 'text-lapis-600 dark:text-parchment-300 hover:bg-parchment-200 dark:hover:bg-lapis-800/50'
              }
            `}
          >
            {room.type === 'team' ? (
              <Users size={16} className="flex-shrink-0" />
            ) : (
              <User size={16} className="flex-shrink-0" />
            )}
            <span className="flex-1 truncate ltr:text-left rtl:text-right">{room.name}</span>
            {room.unreadCount > 0 && (
              <span className="flex-shrink-0 min-w-[20px] h-5 px-1.5 flex items-center justify-center
                             bg-clay-500 text-white text-xs font-medium rounded-full">
                {room.unreadCount > 99 ? '99+' : room.unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Online users for quick DM */}
      {availableDMUsers.length > 0 && (
        <div className="px-2 pb-2">
          <div className="text-xs text-lapis-400 dark:text-parchment-500 px-3 py-1">
            {t('chat.startDM')}
          </div>
          <div className="flex flex-wrap gap-1 px-2">
            {availableDMUsers.map(onlineUser => (
              <OnlineUserChip
                key={onlineUser.id}
                user={onlineUser}
                onSelect={() => openDM(onlineUser.id, onlineUser.username, onlineUser.fullName)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Chip to show online user with avatar initial
interface OnlineUserChipProps {
  user: OnlineUser;
  onSelect: () => void;
}

function OnlineUserChip({ user, onSelect }: OnlineUserChipProps) {
  const displayName = user.fullName || user.username;
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <button
      onClick={onSelect}
      className="inline-flex items-center gap-1.5 px-2 py-1
                 bg-parchment-200 dark:bg-lapis-800
                 hover:bg-parchment-300 dark:hover:bg-lapis-700
                 text-xs text-lapis-600 dark:text-parchment-300
                 rounded-full transition-colors"
    >
      <span className="w-4 h-4 rounded-full bg-lapis-500 dark:bg-lapis-400
                       text-white text-[10px] font-medium flex items-center justify-center flex-shrink-0">
        {initial}
      </span>
      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full flex-shrink-0" />
      <span>{displayName}</span>
    </button>
  );
}
