import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useChat } from '../../context/ChatContext';
import { ChatRoomList } from './ChatRoomList';
import { ChatMessages } from './ChatMessages';
import { ChatInput } from './ChatInput';

// ============================================
// Chat Panel - Slide-out chat container
// ============================================

export function ChatPanel() {
  const { isPanelOpen, closePanel, activeRoom, togglePanel } = useChat();
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        // Only handle Escape in inputs
        if (e.key === 'Escape' && isPanelOpen) {
          closePanel();
        }
        return;
      }

      // 't' to toggle chat
      if (e.key === 't' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        togglePanel();
        return;
      }

      // Escape to close
      if (e.key === 'Escape' && isPanelOpen) {
        closePanel();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isPanelOpen, closePanel, togglePanel]);

  if (!isPanelOpen) return null;

  return (
    <>
      {/* Backdrop for mobile */}
      <div 
        className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40 lg:hidden"
        onClick={closePanel}
      />
      
      {/* Panel */}
      <div 
        ref={panelRef}
        className={`
          fixed top-0 ltr:right-0 rtl:left-0 bottom-0 z-50
          w-80 bg-parchment-50 dark:bg-lapis-900
          ltr:border-l rtl:border-r border-parchment-300 dark:border-lapis-700
          shadow-xl
          flex flex-col
          transform transition-transform duration-200 ease-out
          ${isPanelOpen ? 'translate-x-0' : 'ltr:translate-x-full rtl:-translate-x-full'}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-parchment-300 dark:border-lapis-700">
          <h2 className="font-inscription text-lg text-lapis-600 dark:text-parchment-200">
            {t('chat.title')}
          </h2>
          <button
            onClick={closePanel}
            className="p-1.5 rounded-lg text-lapis-500 dark:text-parchment-400 
                       hover:bg-parchment-200 dark:hover:bg-lapis-800 transition-colors"
            aria-label={t('common.close')}
          >
            <X size={18} />
          </button>
        </div>

        {/* Room list */}
        <ChatRoomList />

        {/* Messages area */}
        {activeRoom ? (
          <>
            <ChatMessages />
            <ChatInput />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center p-4 text-lapis-500 dark:text-parchment-400 text-sm">
            {t('chat.selectRoom')}
          </div>
        )}

        {/* Ephemeral notice */}
        <div className="px-3 py-2 text-xs text-center text-lapis-400 dark:text-parchment-500 border-t border-parchment-200 dark:border-lapis-800">
          {t('chat.ephemeralNotice')}
        </div>
      </div>
    </>
  );
}
