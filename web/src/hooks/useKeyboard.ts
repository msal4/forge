import { useEffect, useCallback, useRef } from 'react';

// ============================================
// Keyboard Shortcut System for Sarray Forge
// ============================================

export interface KeyBinding {
  // The key or key sequence (e.g., 'c', 'g+i', 'Ctrl+k')
  keys: string;
  // Human-readable description
  description: string;
  // Handler function
  handler: () => void;
  // Whether this is a global shortcut (works even when focused on input)
  global?: boolean;
  // Category for grouping in help dialog
  category?: 'navigation' | 'actions' | 'editing' | 'general';
}

// Key sequence state management
interface KeySequenceState {
  keys: string[];
  timestamp: number;
}

const SEQUENCE_TIMEOUT = 1000; // 1 second timeout for key sequences

/**
 * Parse a key string into components
 * Examples: 'c' -> { key: 'c', ctrl: false, meta: false, shift: false }
 *           'Ctrl+k' -> { key: 'k', ctrl: true, meta: false, shift: false }
 */
function parseKeyString(keyString: string): {
  key: string;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
  alt: boolean;
} {
  const parts = keyString.toLowerCase().split('+');
  const key = parts[parts.length - 1];
  
  return {
    key,
    ctrl: parts.includes('ctrl'),
    meta: parts.includes('cmd') || parts.includes('meta'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt'),
  };
}

/**
 * Check if an event matches a key binding
 */
function matchesKey(event: KeyboardEvent, keyString: string): boolean {
  // Guard against undefined event.key
  if (!event.key) return false;
  
  const parsed = parseKeyString(keyString);
  const eventKey = event.key.toLowerCase();
  
  // Handle special cases
  const keyMatch = eventKey === parsed.key || 
    (parsed.key === 'escape' && event.key === 'Escape') ||
    (parsed.key === 'enter' && event.key === 'Enter');
  
  const ctrlMatch = parsed.ctrl === (event.ctrlKey || event.metaKey);
  const shiftMatch = parsed.shift === event.shiftKey;
  const altMatch = parsed.alt === event.altKey;
  
  // For simple keys without modifiers, ensure no modifiers are pressed
  if (!parsed.ctrl && !parsed.meta && !parsed.shift && !parsed.alt) {
    return keyMatch && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey;
  }
  
  return keyMatch && ctrlMatch && shiftMatch && altMatch;
}

/**
 * Hook for registering keyboard shortcuts
 */
export function useKeyboardShortcuts(bindings: KeyBinding[]) {
  const sequenceState = useRef<KeySequenceState>({ keys: [], timestamp: 0 });
  
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Guard against undefined event.key (can happen with some input methods)
    if (!event.key) return;
    
    // Don't trigger shortcuts when typing in inputs (unless global)
    const target = event.target as HTMLElement;
    const isInput = target?.tagName === 'INPUT' || 
                    target?.tagName === 'TEXTAREA' || 
                    target?.isContentEditable;
    
    const now = Date.now();
    
    // Reset sequence if timeout exceeded
    if (now - sequenceState.current.timestamp > SEQUENCE_TIMEOUT) {
      sequenceState.current.keys = [];
    }
    
    // Add current key to sequence
    const currentKey = event.key.toLowerCase();
    sequenceState.current.keys.push(currentKey);
    sequenceState.current.timestamp = now;
    
    // Check each binding
    for (const binding of bindings) {
      // Skip non-global bindings when in input
      if (isInput && !binding.global) continue;
      
      // Skip if binding.keys is not defined
      if (!binding.keys) continue;
      
      // Check for key sequences (e.g., 'g+i')
      const keysLower = binding.keys.toLowerCase();
      if (binding.keys.includes('+') && 
          !keysLower.includes('ctrl') && 
          !keysLower.includes('cmd') && 
          !keysLower.includes('meta') &&
          !keysLower.includes('shift') &&
          !keysLower.includes('alt')) {
        const sequenceKeys = keysLower.split('+');
        const currentSequence = sequenceState.current.keys.slice(-sequenceKeys.length);
        
        if (JSON.stringify(currentSequence) === JSON.stringify(sequenceKeys)) {
          event.preventDefault();
          binding.handler();
          sequenceState.current.keys = [];
          return;
        }
      }
      // Check for single key or modifier combinations
      else if (matchesKey(event, binding.keys)) {
        event.preventDefault();
        binding.handler();
        sequenceState.current.keys = [];
        return;
      }
    }
  }, [bindings]);
  
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

/**
 * Hook for the Command Palette (Cmd+K / Ctrl+K)
 */
export function useCommandPalette(
  isOpen: boolean,
  onOpen: () => void,
  onClose: () => void
) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Guard against undefined event.key
      if (!event.key) return;
      
      // Cmd+K or Ctrl+K to toggle command palette
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          onOpen();
        }
      }
      
      // Escape to close
      if (event.key === 'Escape' && isOpen) {
        event.preventDefault();
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onOpen, onClose]);
}

/**
 * Get display string for a keyboard shortcut
 * Converts internal format to display format
 */
export function formatShortcut(keys: string): string {
  if (!keys) return '';
  
  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  
  return keys
    .split('+')
    .map(part => {
      const lower = part.toLowerCase();
      switch (lower) {
        case 'ctrl': return isMac ? '⌃' : 'Ctrl';
        case 'cmd':
        case 'meta': return isMac ? '⌘' : 'Ctrl';
        case 'shift': return isMac ? '⇧' : 'Shift';
        case 'alt': return isMac ? '⌥' : 'Alt';
        case 'enter': return '↵';
        case 'escape': return 'Esc';
        default: return part.toUpperCase();
      }
    })
    .join(isMac ? '' : '+');
}
