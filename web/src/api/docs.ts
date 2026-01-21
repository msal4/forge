// ============================================
// Docs API - The Library
// ============================================

import { api } from './client';

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
  list: (params?: { parentId?: number | 'root' }) => {
    const searchParams = new URLSearchParams();
    if (params?.parentId !== undefined) {
      searchParams.set('parent_id', String(params.parentId));
    }
    const query = searchParams.toString();
    return api.get<Doc[]>(`/docs${query ? `?${query}` : ''}`);
  },

  // Get single doc by ID or slug
  get: (idOrSlug: number | string) => api.get<Doc>(`/docs/${idOrSlug}`),

  // Create new doc
  create: (data: CreateDocRequest) => api.post<Doc>('/docs', data),

  // Update doc
  update: (id: number, data: UpdateDocRequest) => 
    api.put<Doc>(`/docs/${id}`, data),

  // Delete doc
  delete: (id: number) => api.delete<{ message: string }>(`/docs/${id}`),
};
