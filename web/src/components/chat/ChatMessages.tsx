import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useChat, ChatMessage } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';

// ============================================
// Chat Messages - Scrollable message list
// ============================================

export function ChatMessages() {
  const { messages, activeRoom, markRoomRead } = useChat();
  const { user } = useAuth();
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const roomMessages = activeRoom ? messages[activeRoom] || [] : [];

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [roomMessages.length]);

  // Clear unread count when the bottom sentinel is visible
  useEffect(() => {
    const el = bottomRef.current;
    if (!el || !activeRoom) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          markRoomRead(activeRoom);
        }
      },
      { threshold: 1.0 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [activeRoom, markRoomRead]);

  if (roomMessages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 text-lapis-400 dark:text-parchment-500 text-sm">
        {t('chat.noMessages')}
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin"
    >
      {roomMessages.map((message, index) => (
        <MessageBubble 
          key={message.id} 
          message={message} 
          isOwnMessage={message.from.id === user?.id}
          showSender={shouldShowSender(roomMessages, index)}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

// Helper to determine if we should show sender name
function shouldShowSender(messages: ChatMessage[], index: number): boolean {
  if (index === 0) return true;
  const current = messages[index];
  const previous = messages[index - 1];
  
  // Show sender if different from previous message or if more than 5 minutes apart
  if (current.from.id !== previous.from.id) return true;
  if (current.timestamp - previous.timestamp > 5 * 60 * 1000) return true;
  
  return false;
}

interface MessageBubbleProps {
  message: ChatMessage;
  isOwnMessage: boolean;
  showSender: boolean;
}

function MessageBubble({ message, isOwnMessage, showSender }: MessageBubbleProps) {
  const { t } = useTranslation();

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'}`}>
      {/* Sender name with avatar initial */}
      {showSender && !isOwnMessage && (
        <div className="flex items-center gap-1.5 mb-1 px-1">
          <span className="w-5 h-5 rounded-full bg-lapis-500 dark:bg-lapis-400
                           text-white text-[10px] font-medium flex items-center justify-center flex-shrink-0">
            {(message.from.fullName || message.from.username).charAt(0).toUpperCase()}
          </span>
          <span className="text-xs text-lapis-500 dark:text-parchment-400">
            {message.from.fullName || message.from.username}
          </span>
        </div>
      )}
      {showSender && isOwnMessage && (
        <span className="text-xs text-lapis-500 dark:text-parchment-400 mb-1 px-1">
          {t('chat.you')}
        </span>
      )}
      
      {/* Message bubble */}
      <div
        className={`
          max-w-[85%] px-3 py-2 rounded-xl
          ${isOwnMessage
            ? 'bg-lapis-500 dark:bg-lapis-600 text-white rounded-br-sm'
            : 'bg-parchment-200 dark:bg-lapis-800 text-lapis-700 dark:text-parchment-200 rounded-bl-sm'
          }
        `}
      >
        <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
      </div>
      
      {/* Timestamp */}
      <span className={`text-xs text-lapis-400 dark:text-parchment-500 mt-0.5 px-1`}>
        {formatTime(message.timestamp)}
      </span>
    </div>
  );
}
