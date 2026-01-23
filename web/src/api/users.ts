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

export const usersApi = {
  // List all users
  list: (options?: RequestOptions) => api.get<User[]>('/users', options),

  // Get current user
  me: (options?: RequestOptions) => api.get<User>('/users/me', options),

  // Change password
  changePassword: (currentPassword: string, newPassword: string, options?: RequestOptions) =>
    api.post<{ message: string }>('/auth/change-password', { currentPassword, newPassword }, options),
};
