// ============================================
// Releases API - The Granary
// ============================================

import { api, appendWorkspaceQuery, type RequestOptions } from './client';

export interface ReleaseFile {
  id: number;
  releaseId: number;
  filename: string;
  size: number;
  mimeType: string;
  createdAt: string;
}

export interface Release {
  id: number;
  projectId: number;
  version: string;
  title: string;
  description?: string;
  authorId: number;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
  // Populated relations
  author?: {
    id: number;
    username: string;
    fullName: string;
  };
  files: ReleaseFile[];
}

export interface CreateReleaseRequest {
  version: string;
  title: string;
  description?: string;
}

export const releasesApi = {
  // List all releases
  list: (options?: RequestOptions) =>
    api.get<Release[]>('/releases', options),

  // Get single release by ID
  get: (id: number, options?: RequestOptions) =>
    api.get<Release>(`/releases/${id}`, options),

  // Create new release
  create: (data: CreateReleaseRequest, options?: RequestOptions) =>
    api.post<Release>('/releases', data, options),

  // Delete release
  delete: (id: number, options?: RequestOptions) =>
    api.delete<{ message: string }>(`/releases/${id}`, options),

  // Upload file to release
  uploadFile: (releaseId: number, file: File, options?: RequestOptions) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.uploadForm<ReleaseFile>(`/releases/${releaseId}/files`, formData, options);
  },

  // Get download URL for file (uses query param for browser navigation)
  getDownloadUrl: (releaseId: number, filename: string) =>
    appendWorkspaceQuery(
      `/api/releases/${releaseId}/download/${encodeURIComponent(filename)}`
    ),
};
