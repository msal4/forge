import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { usersApi, type User } from '../../api/users';
import { Avatar } from '../ui/Avatar';

// ============================================
// Mention Input Component
// Textarea with @mention autocomplete dropdown
// Uses portal to avoid clipping by parent overflow
// ============================================

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  disabled?: boolean;
}

export interface MentionInputRef {
  focus: () => void;
  blur: () => void;
}

interface DropdownPosition {
  top: number;
  left: number;
}

export const MentionInput = forwardRef<MentionInputRef, MentionInputProps>(({
  value,
  onChange,
  onKeyDown,
  placeholder,
  rows = 3,
  className = '',
  disabled = false,
}, ref) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const [showDropdown, setShowDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStart, setMentionStart] = useState(-1);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition>({ top: 0, left: 0 });

  // Expose focus/blur methods
  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
    blur: () => textareaRef.current?.blur(),
  }));

  // Fetch users list
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list(),
  });

  // Filter users based on mention query
  const filteredUsers = users.filter(user => {
    if (!mentionQuery) return true;
    const query = mentionQuery.toLowerCase();
    return (
      user.username.toLowerCase().includes(query) ||
      user.fullName.toLowerCase().includes(query)
    );
  }).slice(0, 5); // Limit to 5 results

  // Calculate dropdown position based on textarea position
  const updateDropdownPosition = useCallback(() => {
    if (!textareaRef.current) return;
    
    const rect = textareaRef.current.getBoundingClientRect();
    
    // Position dropdown below the textarea
    setDropdownPosition({
      top: rect.bottom + window.scrollY + 4,
      left: rect.left + window.scrollX,
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
    if (showDropdown && filteredUsers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, filteredUsers.length - 1));
        return;
      }
      
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        return;
      }
      
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        insertMention(filteredUsers[selectedIndex]);
        return;
      }
      
      if (e.key === 'Tab') {
        e.preventDefault();
        insertMention(filteredUsers[selectedIndex]);
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

  // Insert selected mention
  const insertMention = (user: User) => {
    if (mentionStart < 0) return;
    
    const cursorPos = textareaRef.current?.selectionStart ?? value.length;
    const before = value.substring(0, mentionStart);
    const after = value.substring(cursorPos);
    const mention = `@${user.username} `;
    
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

  // Render dropdown using portal to avoid clipping
  const renderDropdown = () => {
    if (!showDropdown || filteredUsers.length === 0) return null;
    
    return createPortal(
      <div
        ref={dropdownRef}
        className="
          fixed z-[9999]
          w-64 max-h-48 overflow-y-auto
          bg-parchment-50 rounded-lg
          shadow-lg border border-parchment-300
        "
        style={{
          top: dropdownPosition.top,
          left: dropdownPosition.left,
        }}
      >
        <ul className="py-1">
          {filteredUsers.map((user, index) => (
            <li key={user.id}>
              <button
                type="button"
                onClick={() => insertMention(user)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2
                  text-left text-sm
                  transition-colors
                  ${index === selectedIndex 
                    ? 'bg-lapis-100 text-lapis-700' 
                    : 'text-lapis-600 hover:bg-parchment-100'
                  }
                `}
              >
                {/* Avatar */}
                <div className="flex-shrink-0">
                  <Avatar 
                    name={user.fullName || user.username}
                    avatarUrl={user.avatarUrl}
                    size="sm"
                  />
                </div>
                
                {/* User info */}
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">
                    {user.fullName || user.username}
                  </div>
                  <div className="text-xs text-stone-500 truncate">
                    @{user.username}
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>,
      document.body
    );
  };

  return (
    <>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        className={className}
      />
      {renderDropdown()}
    </>
  );
});

MentionInput.displayName = 'MentionInput';

export default MentionInput;
