// ============================================
// Users API
// ============================================

import { api } from './client';

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
  list: () => api.get<User[]>('/users'),

  // Get current user
  me: () => api.get<User>('/users/me'),
};
