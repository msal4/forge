// ============================================
// Search API - Global Search
// ============================================

import { api, type RequestOptions } from './client';
import type { IssueStatusType } from './issues';

// Search result item
export interface SearchResult {
  type: 'issue' | 'doc';
  id: number;
  title: string;
  status?: IssueStatusType; // Only for issues
}

// Search response
export interface SearchResponse {
  results: SearchResult[];
}

// API functions
export const searchApi = {
  // Global search across issues and docs
  search: (query: string, options?: RequestOptions) =>
    api.get<SearchResponse>(`/search?q=${encodeURIComponent(query)}`, options),
};
