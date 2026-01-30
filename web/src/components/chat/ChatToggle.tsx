
import { MessageCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useChat } from '../../context/ChatContext';
import { HotkeyBadge } from '../ui/HotkeyBadge';

// ============================================
// Chat Toggle - Header button with unread badge
// ============================================

export function ChatToggle() {
  const { togglePanel, totalUnreadCount, isPanelOpen } = useChat();
  const { t } = useTranslation();

  return (
    <button
      onClick={togglePanel}
      className={`
        relative p-2 rounded-lg transition-colors group
        ${isPanelOpen
          ? 'bg-lapis-100 dark:bg-lapis-800 text-lapis-600 dark:text-parchment-200'
          : 'text-lapis-500 dark:text-parchment-400 hover:bg-parchment-200 dark:hover:bg-lapis-800'
        }
      `}
      aria-label={t('chat.toggle')}
      title={`${t('chat.toggle')} (T)`}
    >
      <MessageCircle size={20} />
      
      {/* Unread badge */}
      {totalUnreadCount > 0 && (
        <span className="absolute -top-1 -right-1 
                        min-w-[18px] h-[18px] px-1
                        flex items-center justify-center
                        bg-clay-500 text-white text-xs font-medium
                        rounded-full">
          {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
        </span>
      )}
      
      {/* Hotkey hint on hover */}
      <div className="absolute -bottom-8 ltr:right-0 rtl:left-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <HotkeyBadge keys="t" size="sm" />
      </div>
    </button>
  );
}
