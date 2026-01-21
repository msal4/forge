import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Command } from 'cmdk';
import {
  Search,
  FileText,
  BookOpen,
  Package,
  Home,
  Plus,
  Loader2,
} from 'lucide-react';
import { useKeyboard } from '../../context/KeyboardContext';
import { searchApi, type SearchResult } from '../../api';

// ============================================
// Command Menu - Powered by cmdk
// A floating stone tablet for keyboard-first navigation
// ============================================

export function CommandMenu() {
  const { isCommandPaletteOpen, closeCommandPalette } = useKeyboard();
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const navigate = useNavigate();

  // Debounced search effect
  useEffect(() => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await searchApi.search(query, { signal: controller.signal });
        setSearchResults(response.results);
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Search failed:', error);
        }
      } finally {
        setIsSearching(false);
      }
    }, 200);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [query]);

  // Reset state when menu closes
  useEffect(() => {
    if (!isCommandPaletteOpen) {
      setQuery('');
      setSearchResults([]);
    }
  }, [isCommandPaletteOpen]);

  // Navigate and close
  const goTo = useCallback((path: string) => {
    navigate(path);
    closeCommandPalette();
  }, [navigate, closeCommandPalette]);

  // Handle search result selection
  const handleResultSelect = useCallback((result: SearchResult) => {
    if (result.type === 'issue') {
      navigate(`/issues?issue=${result.id}`);
    } else {
      navigate(`/docs/${result.id}`);
    }
    closeCommandPalette();
  }, [navigate, closeCommandPalette]);

  // Get status display text
  const getStatusDisplay = (status?: string) => {
    switch (status) {
      case 'to_inscribe': return 'To Inscribe';
      case 'carving': return 'Carving';
      case 'baked': return 'Baked';
      default: return '';
    }
  };

  if (!isCommandPaletteOpen) return null;

  const hasSearchResults = searchResults.length > 0;
  const showNavigation = !query.trim();

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-lapis-900/50 backdrop-blur-sm animate-fade-in"
        onClick={closeCommandPalette}
      />

      {/* Command Menu - Floating Stone Tablet */}
      <div className="flex min-h-full items-start justify-center p-4 pt-[15vh]">
        <Command
          className="
            relative w-full max-w-xl
            bg-parchment-100 
            border-2 border-clay-500
            rounded-lg
            shadow-tablet
            overflow-hidden
            animate-scale-in
          "
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              closeCommandPalette();
            }
          }}
        >
          {/* Search Input */}
          <div className="flex items-center border-b-2 border-parchment-300 px-4">
            {isSearching ? (
              <Loader2 className="text-lapis-400 animate-spin" size={20} />
            ) : (
              <Search className="text-lapis-400" size={20} />
            )}
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Type a command or search..."
              className="
                w-full bg-transparent px-3 py-4
                text-lapis-700 placeholder-lapis-400
                outline-none border-none ring-0
                focus:outline-none focus:border-none focus:ring-0
                font-body
              "
              style={{ boxShadow: 'none' }}
              autoFocus
            />
            <kbd className="
              hidden sm:flex items-center gap-1
              px-2 py-1
              bg-parchment-200 border border-parchment-400
              rounded text-xs text-lapis-500
              font-mono
            ">
              ESC
            </kbd>
          </div>

          {/* Results List */}
          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="px-4 py-8 text-center text-lapis-500">
              {query.trim() ? `No results for "${query}"` : 'Start typing to search...'}
            </Command.Empty>

            {/* Navigation Section - shown when no query */}
            {showNavigation && (
              <Command.Group
                heading={
                  <span className="font-inscription text-sm text-lapis-600 uppercase tracking-wider">
                    Navigation
                  </span>
                }
                className="mb-2"
              >
                <Command.Item
                  value="home"
                  onSelect={() => goTo('/')}
                  className="command-item"
                >
                  <Home size={18} className="text-lapis-400" />
                  <span className="flex-1">Go to Home</span>
                  <kbd className="shortcut-badge">g h</kbd>
                </Command.Item>

                <Command.Item
                  value="issues tablet"
                  onSelect={() => goTo('/issues')}
                  className="command-item"
                >
                  <FileText size={18} className="text-lapis-400" />
                  <div className="flex-1">
                    <span>Go to Issues</span>
                    <span className="ml-2 text-lapis-500 text-sm">The Tablet</span>
                  </div>
                  <kbd className="shortcut-badge">g i</kbd>
                </Command.Item>

                <Command.Item
                  value="docs library documentation"
                  onSelect={() => goTo('/docs')}
                  className="command-item"
                >
                  <BookOpen size={18} className="text-lapis-400" />
                  <div className="flex-1">
                    <span>Go to Docs</span>
                    <span className="ml-2 text-lapis-500 text-sm">The Library</span>
                  </div>
                  <kbd className="shortcut-badge">g d</kbd>
                </Command.Item>

                <Command.Item
                  value="releases granary"
                  onSelect={() => goTo('/releases')}
                  className="command-item"
                >
                  <Package size={18} className="text-lapis-400" />
                  <div className="flex-1">
                    <span>Go to Releases</span>
                    <span className="ml-2 text-lapis-500 text-sm">The Granary</span>
                  </div>
                  <kbd className="shortcut-badge">g r</kbd>
                </Command.Item>
              </Command.Group>
            )}

            {/* Actions Section - shown when no query */}
            {showNavigation && (
              <Command.Group
                heading={
                  <span className="font-inscription text-sm text-lapis-600 uppercase tracking-wider">
                    Actions
                  </span>
                }
                className="mb-2"
              >
                <Command.Item
                  value="create new issue"
                  onSelect={() => goTo('/issues?new=true')}
                  className="command-item"
                >
                  <Plus size={18} className="text-clay-500" />
                  <span className="flex-1">Create New Issue</span>
                  <kbd className="shortcut-badge">c</kbd>
                </Command.Item>

                <Command.Item
                  value="create new document"
                  onSelect={() => goTo('/docs?new=true')}
                  className="command-item"
                >
                  <Plus size={18} className="text-clay-500" />
                  <span className="flex-1">Create New Document</span>
                </Command.Item>

                <Command.Item
                  value="create new release"
                  onSelect={() => goTo('/releases?new=true')}
                  className="command-item"
                >
                  <Plus size={18} className="text-clay-500" />
                  <span className="flex-1">Create New Release</span>
                </Command.Item>
              </Command.Group>
            )}

            {/* Search Results - shown when there's a query */}
            {hasSearchResults && (
              <Command.Group
                heading={
                  <span className="font-inscription text-sm text-lapis-600 uppercase tracking-wider">
                    Results
                  </span>
                }
              >
                {searchResults.map((result) => (
                  <Command.Item
                    key={`${result.type}-${result.id}`}
                    value={`${result.type} ${result.title}`}
                    onSelect={() => handleResultSelect(result)}
                    className="command-item"
                  >
                    {result.type === 'issue' ? (
                      <FileText size={18} className="text-lapis-400" />
                    ) : (
                      <BookOpen size={18} className="text-lapis-400" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="truncate">{result.title}</div>
                      <div className="text-xs text-lapis-500">
                        {result.type === 'issue' ? 'Issue' : 'Document'}
                        {result.status && (
                          <span className="ml-2 text-clay-600">
                            {getStatusDisplay(result.status)}
                          </span>
                        )}
                      </div>
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>

          {/* Footer */}
          <div className="
            flex items-center justify-between
            border-t-2 border-parchment-300
            px-4 py-2
            text-xs text-lapis-500
            bg-parchment-50
          ">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-parchment-200 border border-parchment-400 rounded text-[10px] font-mono">
                  &#8593;&#8595;
                </kbd>
                navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-parchment-200 border border-parchment-400 rounded text-[10px] font-mono">
                  &#8629;
                </kbd>
                select
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-parchment-200 border border-parchment-400 rounded text-[10px] font-mono">
                  esc
                </kbd>
                close
              </span>
            </div>
          </div>
        </Command>
      </div>

      {/* Styles for cmdk items */}
      <style>{`
        .command-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.5rem 0.75rem;
          border-radius: 0.5rem;
          cursor: pointer;
          transition: all 0.1s ease;
          color: #1a365d;
        }
        
        .command-item[data-selected="true"] {
          background-color: #bcd1ff;
          color: #0c1627;
        }
        
        .command-item[data-selected="true"] .text-lapis-400,
        .command-item[data-selected="true"] .text-lapis-500 {
          color: #12243f;
        }
        
        .command-item[data-selected="true"] .text-clay-500 {
          color: #b04d32;
        }
        
        .command-item:hover:not([data-selected="true"]) {
          background-color: #f5f0e6;
        }
        
        .shortcut-badge {
          padding: 0.125rem 0.5rem;
          background-color: #f5f0e6;
          border: 1px solid #dfd1b8;
          border-radius: 0.25rem;
          font-size: 0.625rem;
          font-family: ui-monospace, monospace;
          color: #1a365d;
        }
        
        .command-item[data-selected="true"] .shortcut-badge {
          background-color: #8eb3ff;
          border-color: #5988ff;
        }
        
        [cmdk-group-heading] {
          padding: 0.5rem 0.75rem;
          font-size: 0.75rem;
        }
      `}</style>
    </div>
  );
}
