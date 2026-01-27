import React from 'react';
import { useTranslation } from 'react-i18next';
import { SmilePlus } from 'lucide-react';
import { LoadingIndicator } from '../ui/LoadingIndicator';
import { REACTION_EMOJIS, type ReactionSummary } from '../../api/reactions';

// ============================================
// Reaction Picker Component
// Displays existing reactions and allows adding new ones
// ============================================

interface ReactionPickerProps {
  /** Grouped reaction summaries */
  reactions: ReactionSummary[];
  /** Called when user clicks an emoji (toggle) */
  onToggle: (emoji: string) => void;
  /** Is a toggle operation in progress? */
  isLoading?: boolean;
  /** Compact mode for smaller displays */
  compact?: boolean;
  /** Disabled state */
  disabled?: boolean;
}

export function ReactionPicker({
  reactions,
  onToggle,
  isLoading = false,
  compact = false,
  disabled = false,
}: ReactionPickerProps) {
  const { t } = useTranslation();
  const [showPicker, setShowPicker] = React.useState(false);
  const pickerRef = React.useRef<HTMLDivElement>(null);

  // Close picker when clicking outside
  React.useEffect(() => {
    if (!showPicker) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPicker]);

  // Close on escape
  React.useEffect(() => {
    if (!showPicker) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowPicker(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showPicker]);

  const handleEmojiClick = (emoji: string) => {
    onToggle(emoji);
    setShowPicker(false);
  };

  // Get list of emojis already used (to show in picker which are active)
  const usedEmojis = new Set(reactions.map(r => r.emoji));

  return (
    <div className="flex items-center gap-1 flex-wrap" ref={pickerRef}>
      {/* Existing reactions as clickable badges */}
      {reactions.map(({ emoji, count, reacted, users }) => (
        <button
          key={emoji}
          onClick={() => onToggle(emoji)}
          disabled={disabled || isLoading}
          title={users.length > 0 
            ? users.map(u => u.fullName || u.username).join(', ')
            : undefined
          }
          className={`
            inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-sm
            border transition-colors
            disabled:opacity-50 disabled:cursor-not-allowed
            ${reacted
              ? 'bg-lapis-100 border-lapis-300 text-lapis-700 hover:bg-lapis-200'
              : 'bg-parchment-50 border-parchment-300 text-lapis-600 hover:border-lapis-300 hover:bg-parchment-100'
            }
            ${compact ? 'text-xs px-1.5 py-0.5' : ''}
          `}
        >
          <span>{emoji}</span>
          <span className={`font-medium ${compact ? 'text-[10px]' : 'text-xs'}`}>{count}</span>
        </button>
      ))}

      {/* Add reaction button with popover */}
      <div className="relative">
        <button
          onClick={() => setShowPicker(!showPicker)}
          disabled={disabled || isLoading}
          className={`
            p-1 rounded hover:bg-parchment-100 transition-colors
            disabled:opacity-50 disabled:cursor-not-allowed
            ${showPicker ? 'bg-parchment-100' : ''}
            ${compact ? 'p-0.5' : ''}
          `}
          title={t('reactions.addReaction', 'Add reaction')}
        >
          {isLoading ? (
            <LoadingIndicator size="xs" className="text-lapis-400" inline />
          ) : (
            <SmilePlus className={`text-lapis-400 hover:text-lapis-600 ${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} />
          )}
        </button>

        {/* Emoji picker popover - use end-0 in RTL to avoid clipping by modal edge */}
        {showPicker && (
          <div
            className="
              absolute z-50 bottom-full mb-1 
              ltr:left-0 rtl:right-0
              bg-parchment-50 border border-parchment-300 rounded-lg shadow-lg
              p-2 animate-fade-in
            "
          >
            <div className="flex gap-1">
              {REACTION_EMOJIS.map(emoji => {
                const isActive = usedEmojis.has(emoji);
                const summary = reactions.find(r => r.emoji === emoji);
                const hasReacted = summary?.reacted ?? false;
                
                return (
                  <button
                    key={emoji}
                    onClick={() => handleEmojiClick(emoji)}
                    className={`
                      p-1.5 rounded text-lg transition-colors
                      ${hasReacted 
                        ? 'bg-lapis-100 hover:bg-lapis-200' 
                        : isActive 
                          ? 'bg-parchment-100 hover:bg-parchment-200'
                          : 'hover:bg-parchment-100'
                      }
                    `}
                    title={emoji}
                  >
                    {emoji}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// Compact inline version for comments
// Shows reactions inline with add button at the end
// ============================================

interface InlineReactionsProps {
  reactions: ReactionSummary[];
  onToggle: (emoji: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export function InlineReactions({
  reactions,
  onToggle,
  isLoading = false,
  disabled = false,
}: InlineReactionsProps) {
  return (
    <ReactionPicker
      reactions={reactions}
      onToggle={onToggle}
      isLoading={isLoading}
      disabled={disabled}
      compact
    />
  );
}

export default ReactionPicker;
