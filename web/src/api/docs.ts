// ============================================
// Docs API - The Library
// ============================================

import { api, type RequestOptions } from './client';

export interface Doc {
  id: number;
  title: string;
  content?: string;
  slug: string;
  parentId?: number;
  authorId: number;
  createdAt: string;
  updatedAt: string;
  // Populated relations
  author?: {
    id: number;
    username: string;
    fullName: string;
  };
  // For tree view
  children?: Doc[];
}

export interface CreateDocRequest {
  title: string;
  content?: string;
  parentId?: number;
}

export interface UpdateDocRequest {
  title?: string;
  content?: string;
  parentId?: number | null;
}

export const docsApi = {
  // List all docs, optionally filtered by parent
  list: (options?: RequestOptions & { parentId?: number | 'root' }) => {
    const { signal, parentId } = options || {};
    const searchParams = new URLSearchParams();
    if (parentId !== undefined) {
      searchParams.set('parent_id', String(parentId));
    }
    const query = searchParams.toString();
    return api.get<Doc[]>(`/docs${query ? `?${query}` : ''}`, { signal });
  },

  // Get single doc by ID or slug
  get: (idOrSlug: number | string, options?: RequestOptions) => 
    api.get<Doc>(`/docs/${idOrSlug}`, options),

  // Create new doc
  create: (data: CreateDocRequest, options?: RequestOptions) => 
    api.post<Doc>('/docs', data, options),

  // Update doc
  update: (id: number, data: UpdateDocRequest, options?: RequestOptions) => 
    api.put<Doc>(`/docs/${id}`, data, options),

  // Delete doc
  delete: (id: number, options?: RequestOptions) => 
    api.delete<{ message: string }>(`/docs/${id}`, options),
};
