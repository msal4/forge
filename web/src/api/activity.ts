// ============================================
// Activity API - Modification History
// ============================================

import { api, type RequestOptions } from './client';

// User reference in activity logs
export interface ActivityUser {
  id: number;
  username: string;
  fullName: string;
}

// Text diff for content/description changes
export interface TextDiff {
  old?: string;
  new?: string;
  addedChars?: number;
  removedChars?: number;
}

// Generic change value (can be string, number, array, or TextDiff)
export interface ChangeValue {
  old?: unknown;
  new?: unknown;
  addedChars?: number;
  removedChars?: number;
}

// Activity log entry
export interface ActivityLog {
  id: number;
  action: string;
  entityType: 'issue' | 'doc' | 'release';
  entityId: number;
  entityTitle?: string;
  user?: ActivityUser;
  changes?: Record<string, ChangeValue>;
  createdAt: string;
}

// Activity log response with pagination
export interface ActivityLogResponse {
  activities: ActivityLog[];
  hasMore: boolean;
}

// API functions
export const activityApi = {
  // Get activity for an issue
  getIssueActivity: (
    issueId: number,
    options?: RequestOptions & { limit?: number; offset?: number }
  ) => {
    const { signal, limit = 10, offset = 0 } = options || {};
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    params.set('offset', String(offset));
    return api.get<ActivityLogResponse>(
      `/issues/${issueId}/activity?${params.toString()}`,
      { signal }
    );
  },

  // Get activity for a doc
  getDocActivity: (
    docId: number,
    options?: RequestOptions & { limit?: number; offset?: number }
  ) => {
    const { signal, limit = 10, offset = 0 } = options || {};
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    params.set('offset', String(offset));
    return api.get<ActivityLogResponse>(
      `/docs/${docId}/activity?${params.toString()}`,
      { signal }
    );
  },
};

// ============================================
// Helper Functions for Display
// ============================================

// Format action for display
export function formatAction(action: string): string {
  const actionMap: Record<string, string> = {
    'issue.created': 'created this issue',
    'issue.updated': 'updated this issue',
    'issue.deleted': 'deleted this issue',
    'issue.status_changed': 'changed status',
    'doc.created': 'created this document',
    'doc.updated': 'updated this document',
    'doc.deleted': 'deleted this document',
  };
  return actionMap[action] || action;
}

// Format status value for display
export function formatStatus(status: string): string {
  const statusMap: Record<string, string> = {
    to_inscribe: 'To Inscribe',
    carving: 'Carving',
    baked: 'Baked',
  };
  return statusMap[status] || status;
}

// Format priority value for display
export function formatPriority(priority: string): string {
  const priorityMap: Record<string, string> = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    critical: 'Critical',
  };
  return priorityMap[priority] || priority;
}

// Format field name for display
export function formatFieldName(field: string): string {
  const fieldMap: Record<string, string> = {
    title: 'title',
    description: 'description',
    content: 'content',
    status: 'status',
    priority: 'priority',
    assigneeId: 'assignee',
    labels: 'labels',
    dueDate: 'due date',
    parentId: 'parent document',
  };
  return fieldMap[field] || field;
}

// Check if two dates are on the same day
function isSameDay(d1: Date, d2: Date): boolean {
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
}

// Check if date is yesterday
function isYesterday(date: Date, now: Date): boolean {
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  return isSameDay(date, yesterday);
}

// Format time in 12-hour format
function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
}

// Format relative time
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  // Just now (< 1 minute)
  if (diffSecs < 60) {
    return 'just now';
  }
  
  // Minutes ago (< 1 hour)
  if (diffMins < 60) {
    return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
  }
  
  // Hours ago (same day)
  if (isSameDay(date, now)) {
    if (diffHours === 1) {
      return '1 hour ago';
    }
    return `${diffHours} hours ago`;
  }
  
  // Yesterday
  if (isYesterday(date, now)) {
    return `yesterday at ${formatTime(date)}`;
  }
  
  // Within this week (< 7 days)
  if (diffDays < 7) {
    const dayName = date.toLocaleDateString([], { weekday: 'long' });
    return `${dayName} at ${formatTime(date)}`;
  }
  
  // Within this year
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString([], { 
      month: 'short', 
      day: 'numeric'
    }) + ` at ${formatTime(date)}`;
  }
  
  // Different year
  return date.toLocaleDateString([], { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });
}

// Format full date for tooltip
export function formatFullDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString([], {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// Check if a change value is a text diff (has addedChars/removedChars)
export function isTextDiff(value: ChangeValue): value is TextDiff {
  return (
    typeof value === 'object' &&
    value !== null &&
    ('addedChars' in value || 'removedChars' in value)
  );
}
