// ============================================
// Users API
// ============================================

import { api, type RequestOptions } from './client';
import type { Issue } from './issues';
import type { Doc } from './docs';
import type { Release } from './releases';
import type { ActivityLog } from './activity';

export interface User {
  id: number;
  username: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  language: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfileStats {
  issuesAssigned: number;
  issuesReported: number;
  docsAuthored: number;
  releases: number;
  comments: number;
}

export interface UserProfile extends User {
  stats: UserProfileStats;
}

export interface UserComment {
  id: number;
  content: string;
  entityType: 'issue' | 'doc' | 'release';
  entityId: number;
  entityTitle: string;
  createdAt: string;
  updatedAt: string;
}

export interface TelegramStatus {
  linked: boolean;
  enabled: boolean;
  chatId?: string; // Masked chat ID (e.g., "***1234")
}

export interface TelegramLinkResponse {
  linkUrl: string;
}

export const usersApi = {
  // List all users
  list: (options?: RequestOptions) => api.get<User[]>('/users', options),

  // Get current user
  me: (options?: RequestOptions) => api.get<User>('/users/me', options),

  // Change password
  changePassword: (newPassword: string, options?: RequestOptions) =>
    api.post<{ message: string }>('/auth/change-password', { newPassword }, options),

  // ============================================
  // Telegram Integration
  // ============================================

  // Get Telegram link status
  getTelegramStatus: (options?: RequestOptions) =>
    api.get<TelegramStatus>('/users/me/telegram', options),

  // Generate Telegram deep link for linking account
  generateTelegramLink: (options?: RequestOptions) =>
    api.post<TelegramLinkResponse>('/users/me/telegram/link', {}, options),

  // Unlink Telegram account
  unlinkTelegram: (options?: RequestOptions) =>
    api.delete<{ status: string }>('/users/me/telegram', options),

  // ============================================
  // Language Preference
  // ============================================

  // Update user language preference
  updateLanguage: (language: string, options?: RequestOptions) =>
    api.put<{ language: string }>('/users/me/language', { language }, options),

  // ============================================
  // Profile Management
  // ============================================

  // Update profile (full name)
  updateProfile: (fullName: string, options?: RequestOptions) =>
    api.put<User>('/users/me/profile', { fullName }, options),

  // Upload avatar
  uploadAvatar: async (file: File, options?: RequestOptions): Promise<User> => {
    const formData = new FormData();
    formData.append('avatar', file);
    
    const response = await fetch('/api/users/me/avatar', {
      method: 'POST',
      body: formData,
      credentials: 'include',
      signal: options?.signal,
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to upload avatar');
    }
    
    return response.json();
  },

  // Delete avatar
  deleteAvatar: (options?: RequestOptions) =>
    api.delete<User>('/users/me/avatar', options),

  // ============================================
  // User Profile View (username-based endpoints)
  // ============================================

  // Get user profile with stats by username
  getProfile: (username: string, options?: RequestOptions) =>
    api.get<UserProfile>(`/profile/${username}`, options),

  // Get user's issues by username
  getUserIssues: (username: string, role?: 'assigned' | 'reported', options?: RequestOptions) =>
    api.get<Issue[]>(`/profile/${username}/issues${role ? `?role=${role}` : ''}`, options),

  // Get user's docs by username
  getUserDocs: (username: string, options?: RequestOptions) =>
    api.get<Doc[]>(`/profile/${username}/docs`, options),

  // Get user's releases by username
  getUserReleases: (username: string, options?: RequestOptions) =>
    api.get<Release[]>(`/profile/${username}/releases`, options),

  // Get user's comments by username
  getUserComments: (username: string, options?: RequestOptions) =>
    api.get<UserComment[]>(`/profile/${username}/comments`, options),

  // Get user's activity by username
  getUserActivity: (username: string, params?: { limit?: number; offset?: number }, options?: RequestOptions) => {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.offset) searchParams.set('offset', params.offset.toString());
    const queryString = searchParams.toString();
    return api.get<{ activities: ActivityLog[]; hasMore: boolean }>(
      `/profile/${username}/activity${queryString ? `?${queryString}` : ''}`,
      options
    );
  },
};
