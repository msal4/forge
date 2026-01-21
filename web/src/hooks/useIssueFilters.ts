import { useState, useMemo, useCallback, useRef } from 'react';
import type { Issue } from '../api/issues';

// ============================================
// Issue Filters Hook
// Client-side filtering for the Kanban board
// ============================================

export interface IssueFilters {
  searchQuery: string;
  selectedAssignee: number | null;
  selectedLabels: string[];
}

export interface UseIssueFiltersReturn {
  // Filter state
  filters: IssueFilters;
  
  // Filter setters
  setSearchQuery: (query: string) => void;
  setSelectedAssignee: (assigneeId: number | null) => void;
  setSelectedLabels: (labels: string[]) => void;
  toggleLabel: (label: string) => void;
  
  // Clear filters
  clearFilters: () => void;
  hasActiveFilters: boolean;
  
  // Filtered issues
  filteredIssues: Issue[];
  
  // Available labels (extracted from all issues)
  availableLabels: string[];
  
  // Search input ref for keyboard focus
  searchInputRef: React.RefObject<HTMLInputElement>;
  focusSearch: () => void;
}

const initialFilters: IssueFilters = {
  searchQuery: '',
  selectedAssignee: null,
  selectedLabels: [],
};

export function useIssueFilters(issues: Issue[]): UseIssueFiltersReturn {
  const [filters, setFilters] = useState<IssueFilters>(initialFilters);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Extract all unique labels from issues
  const availableLabels = useMemo(() => {
    const labelSet = new Set<string>();
    issues.forEach(issue => {
      (issue.labels || []).forEach(label => labelSet.add(label));
    });
    return Array.from(labelSet).sort();
  }, [issues]);

  // Filter issues based on current filters
  const filteredIssues = useMemo(() => {
    return issues.filter(issue => {
      // Text search (title and description, case-insensitive)
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        const titleMatch = issue.title.toLowerCase().includes(query);
        const descMatch = (issue.description || '').toLowerCase().includes(query);
        if (!titleMatch && !descMatch) {
          return false;
        }
      }

      // Assignee filter
      if (filters.selectedAssignee !== null) {
        if (issue.assigneeId !== filters.selectedAssignee) {
          return false;
        }
      }

      // Labels filter (issue must have ALL selected labels)
      if (filters.selectedLabels.length > 0) {
        const issueLabels = issue.labels || [];
        const hasAllLabels = filters.selectedLabels.every(label => 
          issueLabels.includes(label)
        );
        if (!hasAllLabels) {
          return false;
        }
      }

      return true;
    });
  }, [issues, filters]);

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return (
      filters.searchQuery !== '' ||
      filters.selectedAssignee !== null ||
      filters.selectedLabels.length > 0
    );
  }, [filters]);

  // Setters
  const setSearchQuery = useCallback((query: string) => {
    setFilters(prev => ({ ...prev, searchQuery: query }));
  }, []);

  const setSelectedAssignee = useCallback((assigneeId: number | null) => {
    setFilters(prev => ({ ...prev, selectedAssignee: assigneeId }));
  }, []);

  const setSelectedLabels = useCallback((labels: string[]) => {
    setFilters(prev => ({ ...prev, selectedLabels: labels }));
  }, []);

  const toggleLabel = useCallback((label: string) => {
    setFilters(prev => {
      const isSelected = prev.selectedLabels.includes(label);
      return {
        ...prev,
        selectedLabels: isSelected
          ? prev.selectedLabels.filter(l => l !== label)
          : [...prev.selectedLabels, label],
      };
    });
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(initialFilters);
  }, []);

  const focusSearch = useCallback(() => {
    searchInputRef.current?.focus();
  }, []);

  return {
    filters,
    setSearchQuery,
    setSelectedAssignee,
    setSelectedLabels,
    toggleLabel,
    clearFilters,
    hasActiveFilters,
    filteredIssues,
    availableLabels,
    searchInputRef,
    focusSearch,
  };
}
