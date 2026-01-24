// ============================================
// Comments API
// ============================================

import { api, type RequestOptions } from './client';
import type { User } from './users';

// Comment type
export interface Comment {
  id: number;
  issueId?: number;
  docId?: number;
  releaseId?: number;
  authorId: number;
  author?: User;
  content: string;
  createdAt: string;
  updatedAt: string;
}

// Request types
export interface CreateCommentRequest {
  content: string;
}

// API functions
export const commentsApi = {
  // Issue comments
  listForIssue: (issueId: number, options?: RequestOptions) =>
    api.get<Comment[]>(`/issues/${issueId}/comments`, options),

  createForIssue: (issueId: number, data: CreateCommentRequest, options?: RequestOptions) =>
    api.post<Comment>(`/issues/${issueId}/comments`, data, options),

  deleteForIssue: (issueId: number, commentId: number, options?: RequestOptions) =>
    api.delete<{ message: string }>(`/issues/${issueId}/comments/${commentId}`, options),

  // Doc comments
  listForDoc: (docId: number, options?: RequestOptions) =>
    api.get<Comment[]>(`/docs/${docId}/comments`, options),

  createForDoc: (docId: number, data: CreateCommentRequest, options?: RequestOptions) =>
    api.post<Comment>(`/docs/${docId}/comments`, data, options),

  deleteForDoc: (docId: number, commentId: number, options?: RequestOptions) =>
    api.delete<{ message: string }>(`/docs/${docId}/comments/${commentId}`, options),

  // Release comments
  listForRelease: (releaseId: number, options?: RequestOptions) =>
    api.get<Comment[]>(`/releases/${releaseId}/comments`, options),

  createForRelease: (releaseId: number, data: CreateCommentRequest, options?: RequestOptions) =>
    api.post<Comment>(`/releases/${releaseId}/comments`, data, options),

  deleteForRelease: (releaseId: number, commentId: number, options?: RequestOptions) =>
    api.delete<{ message: string }>(`/releases/${releaseId}/comments/${commentId}`, options),
};
