// ============================================
// Notifications API
// ============================================

import { api, type RequestOptions } from './client';
import type { User } from './users';

// Notification types
export type NotificationType =
  | 'mention'
  | 'mention_everyone'
  | 'assigned'
  | 'comment_on_owned'
  | 'comment_on_assigned'
  | 'entity_updated'
  | 'entity_deleted'
  | 'reaction';

export type EntityType = 'issue' | 'doc' | 'release';

export interface Notification {
  id: number;
  userId: number;
  actorId: number;
  actor?: User;
  notificationType: NotificationType;
  entityType: EntityType;
  entityId: number;
  commentId?: number;
  title: string;
  message: string;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}

export interface NotificationCount {
  unread: number;
}

// API functions
export const notificationsApi = {
  // List notifications for current user
  list: (limit?: number, options?: RequestOptions) =>
    api.get<Notification[]>(`/notifications${limit ? `?limit=${limit}` : ''}`, options),

  // Get unread count for badge
  getUnreadCount: (options?: RequestOptions) =>
    api.get<NotificationCount>('/notifications/count', options),

  // Mark a single notification as read
  markRead: (id: number, options?: RequestOptions) =>
    api.post<Notification>(`/notifications/${id}/read`, undefined, options),

  // Mark all notifications as read
  markAllRead: (options?: RequestOptions) =>
    api.post<{ marked: number }>('/notifications/read-all', undefined, options),
};
