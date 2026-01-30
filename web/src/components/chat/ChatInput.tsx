import React, { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useChat } from '../../context/ChatContext';

// ============================================
// Chat Input - Message input with send
// ============================================

export function ChatInput() {
  const [message, setMessage] = useState('');
  const { sendMessage } = useChat();
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when component mounts or room changes
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    
    sendMessage(message);
    setMessage('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Submit on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form 
      onSubmit={handleSubmit}
      className="p-3 border-t border-parchment-300 dark:border-lapis-700"
    >
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('chat.inputPlaceholder')}
          className="flex-1 px-3 py-2 
                     bg-parchment-100 dark:bg-lapis-800 
                     border border-parchment-300 dark:border-lapis-700
                     rounded-tablet text-sm
                     text-lapis-700 dark:text-parchment-200
                     placeholder:text-lapis-400 dark:placeholder:text-parchment-500
                     focus:outline-none focus:ring-2 focus:ring-gold-400/30 dark:focus:ring-gold-500/40
                     focus:border-transparent"
          maxLength={2000}
        />
        <button
          type="submit"
          disabled={!message.trim()}
          className="p-2 rounded-tablet
                     bg-lapis-500 dark:bg-lapis-600
                     text-white
                     hover:bg-lapis-600 dark:hover:bg-lapis-500
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors"
          aria-label={t('chat.send')}
        >
          <Send size={18} />
        </button>
      </div>
    </form>
  );
}
