import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useKeyboardShortcuts, useCommandPalette, formatShortcut, KeyBinding } from '../hooks/useKeyboard';
import { useAuth } from './AuthContext';
import { useWorkspace } from './WorkspaceContext';

// ============================================
// Keyboard Context - Global keyboard management
// ============================================

interface KeyboardContextValue {
  // Command palette state
  isCommandPaletteOpen: boolean;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  
  // All registered shortcuts (for help display)
  shortcuts: KeyBinding[];
  
  // Format shortcut for display
  formatShortcut: (keys: string) => string;
}

const KeyboardContext = createContext<KeyboardContextValue | null>(null);

export function useKeyboard() {
  const context = useContext(KeyboardContext);
  if (!context) {
    throw new Error('useKeyboard must be used within a KeyboardProvider');
  }
  return context;
}

interface KeyboardProviderProps {
  children: React.ReactNode;
}

export function KeyboardProvider({ children }: KeyboardProviderProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { workspacePath } = useWorkspace();
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  
  const openCommandPalette = useCallback(() => setIsCommandPaletteOpen(true), []);
  const closeCommandPalette = useCallback(() => setIsCommandPaletteOpen(false), []);
  
  // Set up command palette shortcut
  useCommandPalette(isCommandPaletteOpen, openCommandPalette, closeCommandPalette);
  
  // Define all global keyboard shortcuts
  const shortcuts = useMemo<KeyBinding[]>(() => [
    // Navigation shortcuts (g + key sequences)
    {
      keys: 'g+i',
      description: 'Go to Issues (The Tablet)',
      handler: () => navigate(workspacePath('/issues')),
      category: 'navigation',
    },
    {
      keys: 'g+d',
      description: 'Go to Docs (The Library)',
      handler: () => navigate(workspacePath('/docs')),
      category: 'navigation',
    },
    {
      keys: 'g+r',
      description: 'Go to Releases (The Granary)',
      handler: () => navigate(workspacePath('/releases')),
      category: 'navigation',
    },
    {
      keys: 'g+h',
      description: 'Go to Home',
      handler: () => navigate(workspacePath()),
      category: 'navigation',
    },
    {
      keys: 'g+s',
      description: 'Go to Settings',
      handler: () => navigate(workspacePath('/settings')),
      category: 'navigation',
    },
    {
      keys: 'g+p',
      description: 'Go to My Profile',
      handler: () => {
        if (user?.username) {
          navigate(`/profile/${user.username}`);
        }
      },
      category: 'navigation',
    },
    
    // Action shortcuts
    {
      keys: 'c',
      description: 'Create new item',
      handler: () => {
        // Dispatch custom event that pages can listen to
        window.dispatchEvent(new CustomEvent('forge:create'));
      },
      category: 'actions',
    },
    {
      keys: '/',
      description: 'Focus search',
      handler: () => {
        const searchInput = document.querySelector('[data-search-input]') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
        } else {
          openCommandPalette();
        }
      },
      category: 'actions',
    },
    {
      keys: '?',
      description: 'Show keyboard shortcuts',
      handler: () => {
        window.dispatchEvent(new CustomEvent('forge:show-shortcuts'));
      },
      category: 'general',
    },
    
    // General shortcuts
    {
      keys: 'Escape',
      description: 'Close modal/cancel',
      handler: () => {
        window.dispatchEvent(new CustomEvent('forge:escape'));
      },
      global: true,
      category: 'general',
    },
  ], [navigate, openCommandPalette, user?.username, workspacePath]);
  
  // Register all shortcuts
  useKeyboardShortcuts(shortcuts);
  
  const value = useMemo(() => ({
    isCommandPaletteOpen,
    openCommandPalette,
    closeCommandPalette,
    shortcuts,
    formatShortcut,
  }), [isCommandPaletteOpen, openCommandPalette, closeCommandPalette, shortcuts]);
  
  return (
    <KeyboardContext.Provider value={value}>
      {children}
    </KeyboardContext.Provider>
  );
}
