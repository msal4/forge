// ============================================
// Users API
// ============================================

import { api, type RequestOptions } from './client';

export interface User {
  id: number;
  username: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
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
};
