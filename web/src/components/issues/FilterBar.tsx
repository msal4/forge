import React from 'react';
import { useTranslation } from 'react-i18next';
import { Search, User, Tag, X, ChevronDown, Filter } from 'lucide-react';
import type { User as UserType } from '../../api/users';
import type { IssueFilters } from '../../hooks/useIssueFilters';
import { HotkeyBadge } from '../ui/HotkeyBadge';
import { Avatar } from '../ui/Avatar';

// ============================================
// Filter Bar Component
// Mesopotamian-themed filtering for the Kanban board
// ============================================

interface FilterBarProps {
  filters: IssueFilters;
  users: UserType[];
  availableLabels: string[];
  hasActiveFilters: boolean;
  onSearchChange: (query: string) => void;
  onAssigneeChange: (assigneeId: number | null) => void;
  onToggleLabel: (label: string) => void;
  onClearFilters: () => void;
  searchInputRef: React.RefObject<HTMLInputElement>;
  totalCount: number;
  filteredCount: number;
}

export function FilterBar({
  filters,
  users,
  availableLabels,
  hasActiveFilters,
  onSearchChange,
  onAssigneeChange,
  onToggleLabel,
  onClearFilters,
  searchInputRef,
  totalCount,
  filteredCount,
}: FilterBarProps) {
  const { t } = useTranslation();
  const [showAssigneeDropdown, setShowAssigneeDropdown] = React.useState(false);
  const [showLabelsDropdown, setShowLabelsDropdown] = React.useState(false);
  
  const assigneeRef = React.useRef<HTMLDivElement>(null);
  const labelsRef = React.useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (assigneeRef.current && !assigneeRef.current.contains(event.target as Node)) {
        setShowAssigneeDropdown(false);
      }
      if (labelsRef.current && !labelsRef.current.contains(event.target as Node)) {
        setShowLabelsDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle escape to clear search or blur
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      if (filters.searchQuery) {
        onSearchChange('');
      } else {
        searchInputRef.current?.blur();
      }
    }
  };

  const selectedAssignee = users.find(u => u.id === filters.selectedAssignee);
  const isFiltering = totalCount !== filteredCount;

  return (
    <div className="bg-parchment-100 border-b border-clay-200 px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        {/* Search Input - "Chiseled" style */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search 
            size={16} 
            className="absolute left-3 top-1/2 -translate-y-1/2 text-lapis-400 pointer-events-none" 
          />
          <input
            ref={searchInputRef}
            type="text"
            value={filters.searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder={t('issues.filter.searchPlaceholder')}
            className="
              w-full h-9 pl-9 pr-8 
              bg-parchment-50 text-lapis-700 text-sm
              border border-parchment-300 rounded-tablet
              placeholder:text-lapis-400
              focus:outline-none focus:border-lapis-400 focus:ring-2 focus:ring-lapis-200
              transition-all
            "
          />
          {filters.searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-lapis-400 hover:text-lapis-600 rounded"
            >
              <X size={14} />
            </button>
          )}
          {!filters.searchQuery && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
              <HotkeyBadge keys="f" />
            </div>
          )}
        </div>

        {/* Assignee Dropdown - "Cylinder Seal" style */}
        <div ref={assigneeRef} className="relative">
          <button
            onClick={() => setShowAssigneeDropdown(!showAssigneeDropdown)}
            className={`
              h-9 px-3 flex items-center gap-2
              bg-parchment-50 text-sm
              border rounded-tablet
              transition-all
              ${filters.selectedAssignee !== null
                ? 'border-lapis-400 text-lapis-700 bg-lapis-50'
                : 'border-parchment-300 text-lapis-600 hover:border-lapis-300'
              }
            `}
          >
            <User size={14} />
            <span className="max-w-[100px] truncate">
              {selectedAssignee ? selectedAssignee.fullName || selectedAssignee.username : t('issues.filter.assignee')}
            </span>
            <ChevronDown size={14} className={`transition-transform ${showAssigneeDropdown ? 'rotate-180' : ''}`} />
          </button>

          {showAssigneeDropdown && (
            <div className="
              absolute top-full left-0 mt-1 z-20
              min-w-[180px] max-h-64 overflow-y-auto
              bg-parchment-50 border border-parchment-300 
              rounded-tablet shadow-tablet
              py-1
              animate-fade-in
            ">
              <button
                onClick={() => { onAssigneeChange(null); setShowAssigneeDropdown(false); }}
                className={`
                  w-full px-3 py-2 text-left text-sm 
                  hover:bg-parchment-200 transition-colors
                  flex items-center gap-2
                  ${filters.selectedAssignee === null ? 'bg-parchment-200 text-lapis-700' : 'text-lapis-600'}
                `}
              >
                <div className="w-6 h-6 rounded-full bg-parchment-300 flex items-center justify-center">
                  <User size={12} className="text-lapis-400" />
                </div>
                {t('issues.filter.allAssignees')}
              </button>
              {users.map(user => (
                <button
                  key={user.id}
                  onClick={() => { onAssigneeChange(user.id); setShowAssigneeDropdown(false); }}
                  className={`
                    w-full px-3 py-2 text-left text-sm 
                    hover:bg-parchment-200 transition-colors
                    flex items-center gap-2
                    ${filters.selectedAssignee === user.id ? 'bg-parchment-200 text-lapis-700' : 'text-lapis-600'}
                  `}
                >
                  <Avatar 
                    name={user.fullName || user.username}
                    size="sm"
                  />
                  <span className="truncate">{user.fullName || user.username}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Labels Dropdown */}
        <div ref={labelsRef} className="relative">
          <button
            onClick={() => setShowLabelsDropdown(!showLabelsDropdown)}
            disabled={availableLabels.length === 0}
            className={`
              h-9 px-3 flex items-center gap-2
              bg-parchment-50 text-sm
              border rounded-tablet
              transition-all
              ${availableLabels.length === 0 
                ? 'opacity-50 cursor-not-allowed border-parchment-300 text-lapis-400' 
                : filters.selectedLabels.length > 0
                  ? 'border-lapis-400 text-lapis-700 bg-lapis-50'
                  : 'border-parchment-300 text-lapis-600 hover:border-lapis-300'
              }
            `}
          >
            <Tag size={14} />
            <span>
              {filters.selectedLabels.length > 0 
                ? `${filters.selectedLabels.length} ${t('issues.filter.labels').toLowerCase()}`
                : t('issues.filter.labels')
              }
            </span>
            <ChevronDown size={14} className={`transition-transform ${showLabelsDropdown ? 'rotate-180' : ''}`} />
          </button>

          {showLabelsDropdown && availableLabels.length > 0 && (
            <div className="
              absolute top-full left-0 mt-1 z-20
              min-w-[180px] max-h-64 overflow-y-auto
              bg-parchment-50 border border-parchment-300 
              rounded-tablet shadow-tablet
              py-1
              animate-fade-in
            ">
              {availableLabels.map(label => {
                const isSelected = filters.selectedLabels.includes(label);
                return (
                  <button
                    key={label}
                    onClick={() => onToggleLabel(label)}
                    className={`
                      w-full px-3 py-2 text-left text-sm 
                      hover:bg-parchment-200 transition-colors
                      flex items-center gap-2
                      ${isSelected ? 'bg-lapis-50 text-lapis-700' : 'text-lapis-600'}
                    `}
                  >
                    <div className={`
                      w-4 h-4 rounded border flex items-center justify-center
                      ${isSelected 
                        ? 'bg-lapis-500 border-lapis-500 text-parchment-50' 
                        : 'border-parchment-400'
                      }
                    `}>
                      {isSelected && (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M2 5L4 7L8 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                    <span className="truncate">{label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Active Filter Tokens (Clay Tokens) */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 ml-2">
            <div className="w-px h-6 bg-parchment-300" />
            
            {/* Search token */}
            {filters.searchQuery && (
              <FilterToken 
                label={`"${filters.searchQuery}"`}
                onRemove={() => onSearchChange('')}
              />
            )}
            
            {/* Assignee token */}
            {selectedAssignee && (
              <FilterToken 
                label={selectedAssignee.fullName || selectedAssignee.username}
                icon={<User size={12} />}
                onRemove={() => onAssigneeChange(null)}
              />
            )}
            
            {/* Label tokens */}
            {filters.selectedLabels.map(label => (
              <FilterToken 
                key={label}
                label={label}
                icon={<Tag size={12} />}
                onRemove={() => onToggleLabel(label)}
              />
            ))}

            {/* Clear all button */}
            <button
              onClick={onClearFilters}
              className="
                px-2 py-1 text-xs font-medium
                text-lapis-500 hover:text-lapis-700
                hover:bg-parchment-200 rounded
                transition-colors
              "
            >
              {t('common.clearFilters')}
            </button>
          </div>
        )}

        {/* Results count */}
        {isFiltering && (
          <div className="ml-auto text-xs text-lapis-500">
            <Filter size={12} className="inline mr-1" />
            {t('issues.filter.showing', { filtered: filteredCount, total: totalCount })}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// Filter Token Component ("Clay Token")
// ============================================

interface FilterTokenProps {
  label: string;
  icon?: React.ReactNode;
  onRemove: () => void;
}

function FilterToken({ label, icon, onRemove }: FilterTokenProps) {
  return (
    <span className="
      inline-flex items-center gap-1.5 
      px-2 py-1 
      bg-clay-100 text-clay-800 
      border border-clay-200
      rounded-tablet text-xs font-medium
      animate-fade-in
    ">
      {icon}
      <span className="max-w-[100px] truncate">{label}</span>
      <button
        onClick={onRemove}
        className="ml-0.5 p-0.5 hover:bg-clay-200 rounded transition-colors"
      >
        <X size={12} />
      </button>
    </span>
  );
}
