import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { usersApi, type User } from '../../api/users';
import { Avatar } from '../ui/Avatar';
import { useTranslation } from 'react-i18next';
import { Users } from 'lucide-react';

// ============================================
// Mention Input Component
// Textarea with @mention autocomplete dropdown
// Uses portal to avoid clipping by parent overflow
// ============================================

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onImagePaste?: (file: File) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  disabled?: boolean;
}

export interface MentionInputRef {
  focus: () => void;
  blur: () => void;
  insertAtCursor: (text: string) => void;
  getTextarea: () => HTMLTextAreaElement | null;
}

interface DropdownPosition {
  top: number;
  left: number;
}

// Keywords that trigger the @everyone option
const EVERYONE_KEYWORDS = ['everyone', 'every', 'all', 'الجميع', 'الكل'];

// Special "everyone" entry used in dropdown
interface EveryoneEntry {
  type: 'everyone';
}

type DropdownItem = { type: 'user'; user: User } | EveryoneEntry;

export const MentionInput = forwardRef<MentionInputRef, MentionInputProps>(({
  value,
  onChange,
  onKeyDown,
  onImagePaste,
  placeholder,
  rows = 3,
  className = '',
  disabled = false,
}, ref) => {
  const { t } = useTranslation();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [showDropdown, setShowDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStart, setMentionStart] = useState(-1);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition>({ top: 0, left: 0 });
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Expose methods to parent
  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
    blur: () => textareaRef.current?.blur(),
    insertAtCursor: (text: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const before = value.substring(0, start);
      const after = value.substring(end);
      
      const newValue = before + text + after;
      onChange(newValue);
      
      // Move cursor after inserted text
      requestAnimationFrame(() => {
        const newPos = start + text.length;
        textarea.setSelectionRange(newPos, newPos);
        textarea.focus();
      });
    },
    getTextarea: () => textareaRef.current,
  }));

  // Fetch users list
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list(),
  });

  // Check if @everyone should appear in dropdown
  const showEveryone = !mentionQuery || EVERYONE_KEYWORDS.some(kw =>
    kw.startsWith(mentionQuery.toLowerCase()) || mentionQuery.toLowerCase().startsWith(kw)
  );

  // Filter users based on mention query
  const filteredUsers = users.filter(user => {
    if (!mentionQuery) return true;
    const query = mentionQuery.toLowerCase();
    return (
      user.username.toLowerCase().includes(query) ||
      user.fullName.toLowerCase().includes(query)
    );
  }).slice(0, 5); // Limit to 5 results

  // Build combined dropdown items: @everyone first (if matching), then users
  const dropdownItems: DropdownItem[] = [
    ...(showEveryone ? [{ type: 'everyone' as const }] : []),
    ...filteredUsers.map(user => ({ type: 'user' as const, user })),
  ];

  // Calculate dropdown position based on caret position in textarea
  const updateDropdownPosition = useCallback(() => {
    if (!textareaRef.current) return;
    
    const textarea = textareaRef.current;
    const rect = textarea.getBoundingClientRect();
    const cursorPos = textarea.selectionStart;
    
    // Get computed styles for accurate measurement
    const styles = window.getComputedStyle(textarea);
    const lineHeight = parseFloat(styles.lineHeight) || parseFloat(styles.fontSize) * 1.2;
    
    // Create a mirror div to measure caret position
    const mirror = document.createElement('div');
    mirror.style.cssText = `
      position: absolute;
      visibility: hidden;
      white-space: pre-wrap;
      word-wrap: break-word;
      overflow-wrap: break-word;
      width: ${textarea.clientWidth}px;
      font-family: ${styles.fontFamily};
      font-size: ${styles.fontSize};
      line-height: ${styles.lineHeight};
      padding: ${styles.padding};
      border: ${styles.border};
      box-sizing: border-box;
    `;
    
    // Get text up to cursor and add a marker span
    const textBeforeCursor = textarea.value.substring(0, cursorPos);
    mirror.innerHTML = textBeforeCursor.replace(/\n$/, '\n ') + '<span id="caret-marker">|</span>';
    
    document.body.appendChild(mirror);
    
    const marker = mirror.querySelector('#caret-marker');
    let caretTop = 0;
    let caretLeft = 0;
    
    if (marker) {
      const markerRect = marker.getBoundingClientRect();
      const mirrorRect = mirror.getBoundingClientRect();
      caretTop = markerRect.top - mirrorRect.top;
      caretLeft = markerRect.left - mirrorRect.left;
    }
    
    document.body.removeChild(mirror);
    
    // Calculate position relative to viewport, accounting for scroll within textarea
    const scrollTop = textarea.scrollTop;
    const top = rect.top + caretTop - scrollTop + lineHeight + 4;
    const left = rect.left + caretLeft;
    
    // Ensure dropdown doesn't go off-screen
    const dropdownHeight = 200; // approximate max height
    const dropdownWidth = 256;
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    
    // If dropdown would go below viewport, show it above the cursor
    const finalTop = top + dropdownHeight > viewportHeight 
      ? rect.top + caretTop - scrollTop - dropdownHeight - 4
      : top;
    
    // If dropdown would go off right edge, align to right edge
    const finalLeft = left + dropdownWidth > viewportWidth
      ? viewportWidth - dropdownWidth - 8
      : left;
    
    setDropdownPosition({
      top: finalTop,
      left: finalLeft,
    });
  }, []);

  // Update position when dropdown opens or window scrolls/resizes
  useEffect(() => {
    if (!showDropdown) return;
    
    updateDropdownPosition();
    
    const handleScroll = () => updateDropdownPosition();
    const handleResize = () => updateDropdownPosition();
    
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [showDropdown, updateDropdownPosition]);

  // Handle text changes - detect @ mentions
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart;
    
    onChange(newValue);
    
    // Check if we're in a mention context
    // Look backwards from cursor for @ that isn't preceded by a word char
    let foundMentionStart = -1;
    let query = '';
    
    for (let i = cursorPos - 1; i >= 0; i--) {
      const char = newValue[i];
      
      if (char === '@') {
        // Check if @ is at start or preceded by whitespace
        if (i === 0 || /\s/.test(newValue[i - 1])) {
          foundMentionStart = i;
          query = newValue.substring(i + 1, cursorPos);
          break;
        }
        break; // Not a valid mention start
      }
      
      // Stop if we hit whitespace
      if (/\s/.test(char)) {
        break;
      }
      
      // Stop if we go too far back
      if (cursorPos - i > 20) {
        break;
      }
    }
    
    if (foundMentionStart >= 0) {
      setMentionStart(foundMentionStart);
      setMentionQuery(query);
      setShowDropdown(true);
      setSelectedIndex(0);
      updateDropdownPosition();
    } else {
      setShowDropdown(false);
      setMentionStart(-1);
      setMentionQuery('');
    }
  };

  // Handle keyboard navigation in dropdown
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showDropdown && dropdownItems.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, dropdownItems.length - 1));
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        return;
      }

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        selectDropdownItem(dropdownItems[selectedIndex]);
        return;
      }

      if (e.key === 'Tab') {
        e.preventDefault();
        selectDropdownItem(dropdownItems[selectedIndex]);
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        setShowDropdown(false);
        return;
      }
    }

    // Pass through to parent handler
    onKeyDown?.(e);
  };

  // Insert a mention string at the current mention position
  const insertMentionText = (mentionText: string) => {
    if (mentionStart < 0) return;

    const cursorPos = textareaRef.current?.selectionStart ?? value.length;
    const before = value.substring(0, mentionStart);
    const after = value.substring(cursorPos);
    const mention = `@${mentionText} `;

    const newValue = before + mention + after;
    onChange(newValue);

    // Reset state
    setShowDropdown(false);
    setMentionStart(-1);
    setMentionQuery('');

    // Move cursor after mention
    requestAnimationFrame(() => {
      const newCursorPos = mentionStart + mention.length;
      textareaRef.current?.setSelectionRange(newCursorPos, newCursorPos);
      textareaRef.current?.focus();
    });
  };

  // Select a dropdown item (user or @everyone)
  const selectDropdownItem = (item: DropdownItem) => {
    if (item.type === 'everyone') {
      insertMentionText('everyone');
    } else {
      insertMentionText(item.user.username);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  // Handle paste - check for images
  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (!onImagePaste) return;
    
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          onImagePaste(file);
        }
        return;
      }
    }
  }, [onImagePaste]);

  // Handle drag events for image drop
  const handleDragOver = useCallback((e: React.DragEvent<HTMLTextAreaElement>) => {
    if (!onImagePaste) return;
    
    // Check if dragging files
    if (e.dataTransfer?.types?.includes('Files')) {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOver(true);
    }
  }, [onImagePaste]);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    if (!onImagePaste) return;

    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;

    // Find first image file
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        onImagePaste(file);
        return;
      }
    }
  }, [onImagePaste]);

  // Render dropdown using portal to avoid clipping
  const renderDropdown = () => {
    if (!showDropdown || dropdownItems.length === 0) return null;

    return createPortal(
      <div
        ref={dropdownRef}
        className="
          fixed z-[9999]
          w-64 max-h-48 overflow-y-auto
          bg-parchment-50 dark:bg-lapis-800 rounded-lg
          shadow-lg border border-parchment-300 dark:border-lapis-600
        "
        style={{
          top: dropdownPosition.top,
          left: dropdownPosition.left,
        }}
      >
        <ul className="py-1">
          {dropdownItems.map((item, index) => (
            <li key={item.type === 'everyone' ? '__everyone__' : item.user.id}>
              <button
                type="button"
                onClick={() => selectDropdownItem(item)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2
                  text-left text-sm
                  transition-colors
                  ${index === selectedIndex
                    ? 'bg-lapis-100 dark:bg-lapis-700 text-lapis-700 dark:text-parchment-200'
                    : 'text-lapis-600 dark:text-parchment-300 hover:bg-parchment-100 dark:hover:bg-lapis-700'
                  }
                `}
              >
                {item.type === 'everyone' ? (
                  <>
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-lapis-200 dark:bg-lapis-600 flex items-center justify-center">
                      <Users className="w-4 h-4 text-lapis-600 dark:text-parchment-300" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{t('mentions.everyone')}</div>
                      <div className="text-xs text-stone-500 dark:text-parchment-500 truncate">@everyone</div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex-shrink-0">
                      <Avatar
                        name={item.user.fullName || item.user.username}
                        avatarUrl={item.user.avatarUrl}
                        size="sm"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {item.user.fullName || item.user.username}
                      </div>
                      <div className="text-xs text-stone-500 dark:text-parchment-500 truncate">
                        @{item.user.username}
                      </div>
                    </div>
                  </>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>,
      document.body
    );
  };

  // Combine className with drag-over state
  const textareaClassName = `${className} ${
    isDraggingOver 
      ? 'ring-2 ring-lapis-400 ring-offset-1 border-lapis-400' 
      : ''
  }`;

  return (
    <>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        className={textareaClassName}
      />
      {renderDropdown()}
    </>
  );
});

MentionInput.displayName = 'MentionInput';

export default MentionInput;
