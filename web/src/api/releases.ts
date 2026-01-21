// ============================================
// Releases API - The Granary
// ============================================

import { ApiError } from './client';

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

const API_BASE = '/api';

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const data = await response.json();

  if (!response.ok) {
    throw new ApiError(
      response.status,
      data.error || 'unknown_error',
      data.message || 'An error occurred'
    );
  }

  return data;
}

export const releasesApi = {
  // List all releases
  list: () => request<Release[]>('/releases'),

  // Get single release by ID
  get: (id: number) => request<Release>(`/releases/${id}`),

  // Create new release
  create: (data: CreateReleaseRequest) => 
    request<Release>('/releases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  // Delete release
  delete: (id: number) => 
    request<{ message: string }>(`/releases/${id}`, { method: 'DELETE' }),

  // Upload file to release
  uploadFile: async (releaseId: number, file: File): Promise<ReleaseFile> => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch(`${API_BASE}/releases/${releaseId}/files`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new ApiError(
        response.status,
        data.error || 'upload_error',
        data.message || 'Failed to upload file'
      );
    }

    return data;
  },

  // Get download URL for file
  getDownloadUrl: (releaseId: number, filename: string) =>
    `${API_BASE}/releases/${releaseId}/download/${encodeURIComponent(filename)}`,
};
