import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  FileText, 
  BookOpen, 
  Package, 
  Settings, 
  Home,
  Plus,
  Command
} from 'lucide-react';
import { useKeyboard } from '../../context/KeyboardContext';
import { HotkeyBadge } from './HotkeyBadge';

// ============================================
// Command Palette - Triggered by Cmd+K / Ctrl+K
// ============================================

interface CommandItem {
  id: string;
  title: string;
  description?: string;
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void;
  category: 'navigation' | 'actions' | 'recent';
}

export function CommandPalette() {
  const { isCommandPaletteOpen, closeCommandPalette } = useKeyboard();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  
  // Define all commands
  const commands = useMemo<CommandItem[]>(() => [
    // Navigation
    {
      id: 'home',
      title: 'Go to Home',
      icon: <Home size={18} />,
      shortcut: 'g+h',
      action: () => { navigate('/'); closeCommandPalette(); },
      category: 'navigation',
    },
    {
      id: 'issues',
      title: 'Go to Issues (The Tablet)',
      description: 'View and manage issues',
      icon: <FileText size={18} />,
      shortcut: 'g+i',
      action: () => { navigate('/issues'); closeCommandPalette(); },
      category: 'navigation',
    },
    {
      id: 'docs',
      title: 'Go to Docs (The Library)',
      description: 'Browse documentation',
      icon: <BookOpen size={18} />,
      shortcut: 'g+d',
      action: () => { navigate('/docs'); closeCommandPalette(); },
      category: 'navigation',
    },
    {
      id: 'releases',
      title: 'Go to Releases (The Granary)',
      description: 'Manage releases and downloads',
      icon: <Package size={18} />,
      shortcut: 'g+r',
      action: () => { navigate('/releases'); closeCommandPalette(); },
      category: 'navigation',
    },
    {
      id: 'settings',
      title: 'Go to Settings',
      icon: <Settings size={18} />,
      shortcut: 'g+s',
      action: () => { navigate('/settings'); closeCommandPalette(); },
      category: 'navigation',
    },
    // Actions
    {
      id: 'create-issue',
      title: 'Create New Issue',
      description: 'Inscribe a new tablet',
      icon: <Plus size={18} />,
      shortcut: 'c',
      action: () => { navigate('/issues/new'); closeCommandPalette(); },
      category: 'actions',
    },
    {
      id: 'create-doc',
      title: 'Create New Document',
      description: 'Add to the library',
      icon: <Plus size={18} />,
      action: () => { navigate('/docs/new'); closeCommandPalette(); },
      category: 'actions',
    },
    {
      id: 'create-release',
      title: 'Create New Release',
      description: 'Store in the granary',
      icon: <Plus size={18} />,
      action: () => { navigate('/releases/new'); closeCommandPalette(); },
      category: 'actions',
    },
  ], [navigate, closeCommandPalette]);
  
  // Filter commands based on query
  const filteredCommands = useMemo(() => {
    if (!query) return commands;
    
    const lowerQuery = query.toLowerCase();
    return commands.filter(cmd => 
      cmd.title.toLowerCase().includes(lowerQuery) ||
      cmd.description?.toLowerCase().includes(lowerQuery)
    );
  }, [commands, query]);
  
  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {
      navigation: [],
      actions: [],
      recent: [],
    };
    
    filteredCommands.forEach(cmd => {
      groups[cmd.category].push(cmd);
    });
    
    return groups;
  }, [filteredCommands]);
  
  // Reset state when palette opens
  useEffect(() => {
    if (isCommandPaletteOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isCommandPaletteOpen]);
  
  // Keyboard navigation within palette
  useEffect(() => {
    if (!isCommandPaletteOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(i => Math.min(i + 1, filteredCommands.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(i => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].action();
          }
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCommandPaletteOpen, filteredCommands, selectedIndex]);
  
  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);
  
  if (!isCommandPaletteOpen) return null;
  
  let flatIndex = 0;
  
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-lapis-900/50 backdrop-blur-sm animate-fade-in"
        onClick={closeCommandPalette}
      />
      
      {/* Palette */}
      <div className="flex min-h-full items-start justify-center p-4 pt-[15vh]">
        <div 
          className="relative w-full max-w-xl transform overflow-hidden rounded-xl bg-parchment-100 shadow-2xl animate-scale-in"
        >
          {/* Search Input */}
          <div className="flex items-center border-b border-parchment-300 px-4">
            <Search className="text-lapis-400" size={20} />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Type a command or search..."
              className="w-full bg-transparent px-3 py-4 text-lapis-700 placeholder-lapis-400 focus:outline-none font-body"
            />
            <div className="flex items-center gap-1 text-lapis-400">
              <Command size={14} />
              <span className="text-xs">K</span>
            </div>
          </div>
          
          {/* Results */}
          <div className="max-h-96 overflow-y-auto p-2">
            {filteredCommands.length === 0 ? (
              <div className="px-4 py-8 text-center text-lapis-500">
                No commands found for "{query}"
              </div>
            ) : (
              <>
                {/* Navigation */}
                {groupedCommands.navigation.length > 0 && (
                  <div className="mb-2">
                    <div className="px-3 py-1.5 text-xs font-semibold text-lapis-500 uppercase tracking-wider">
                      Navigation
                    </div>
                    {groupedCommands.navigation.map(cmd => {
                      const isSelected = flatIndex === selectedIndex;
                      const currentIndex = flatIndex++;
                      return (
                        <CommandItem
                          key={cmd.id}
                          item={cmd}
                          isSelected={isSelected}
                          onClick={() => cmd.action()}
                          onMouseEnter={() => setSelectedIndex(currentIndex)}
                        />
                      );
                    })}
                  </div>
                )}
                
                {/* Actions */}
                {groupedCommands.actions.length > 0 && (
                  <div className="mb-2">
                    <div className="px-3 py-1.5 text-xs font-semibold text-lapis-500 uppercase tracking-wider">
                      Actions
                    </div>
                    {groupedCommands.actions.map(cmd => {
                      const isSelected = flatIndex === selectedIndex;
                      const currentIndex = flatIndex++;
                      return (
                        <CommandItem
                          key={cmd.id}
                          item={cmd}
                          isSelected={isSelected}
                          onClick={() => cmd.action()}
                          onMouseEnter={() => setSelectedIndex(currentIndex)}
                        />
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
          
          {/* Footer */}
          <div className="flex items-center justify-between border-t border-parchment-300 px-4 py-2 text-xs text-lapis-500">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 bg-parchment-200 rounded text-[10px]">↑↓</kbd>
                navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 bg-parchment-200 rounded text-[10px]">↵</kbd>
                select
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 bg-parchment-200 rounded text-[10px]">esc</kbd>
                close
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Individual command item
interface CommandItemProps {
  item: CommandItem;
  isSelected: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
}

function CommandItem({ item, isSelected, onClick, onMouseEnter }: CommandItemProps) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={`
        w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left
        transition-colors duration-100
        ${isSelected 
          ? 'bg-lapis-500 text-parchment-100' 
          : 'text-lapis-700 hover:bg-parchment-200'
        }
      `}
    >
      <span className={isSelected ? 'text-parchment-200' : 'text-lapis-400'}>
        {item.icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{item.title}</div>
        {item.description && (
          <div className={`text-xs truncate ${isSelected ? 'text-parchment-300' : 'text-lapis-500'}`}>
            {item.description}
          </div>
        )}
      </div>
      {item.shortcut && (
        <HotkeyBadge 
          keys={item.shortcut} 
          className={isSelected ? 'bg-lapis-400 border-lapis-300 text-parchment-100' : ''}
        />
      )}
    </button>
  );
}
