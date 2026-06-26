// ============================================
// Issues API - The Tablet
// ============================================

import { api, type RequestOptions } from './client';

// Issue status values (Mesopotamian theme)
export const IssueStatus = {
  TO_INSCRIBE: 'to_inscribe',  // Todo
  CARVING: 'carving',          // In Progress
  BAKED: 'baked',              // Done
} as const;

export type IssueStatusType = typeof IssueStatus[keyof typeof IssueStatus];

// Priority levels
export const Priority = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const;

export type PriorityType = typeof Priority[keyof typeof Priority];

// Issue type
export interface Issue {
  id: number;
  projectId: number;
  issueNumber: number;
  projectKey?: string;
  title: string;
  description?: string;
  status: IssueStatusType;
  priority: PriorityType;
  rank: string;
  assigneeId?: number;
  reporterId: number;
  labels: string[];
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  // Populated relations
  assignee?: {
    id: number;
    username: string;
    fullName: string;
    avatarUrl?: string;
  };
  reporter?: {
    id: number;
    username: string;
    fullName: string;
    avatarUrl?: string;
  };
}

// Request types
export interface CreateIssueRequest {
  title: string;
  description?: string;
  priority?: PriorityType;
  assigneeId?: number;
  labels?: string[];
  dueDate?: string;
}

export interface UpdateIssueRequest {
  title?: string;
  description?: string;
  status?: IssueStatusType;
  priority?: PriorityType;
  assigneeId?: number | null;
  labels?: string[];
  dueDate?: string | null;
}

export interface UpdateIssueStatusRequest {
  status: IssueStatusType;
}

// Move an issue to a position on the board (Kanban drag-and-drop). beforeId is
// the issue that ends up directly above the dropped card, afterId the one
// directly below; either may be null (top, bottom, or empty column).
export interface MoveIssueRequest {
  status: IssueStatusType;
  beforeId?: number | null;
  afterId?: number | null;
}

// API functions
export const issuesApi = {
  // List all issues, optionally filtered
  list: (options?: RequestOptions & { status?: IssueStatusType; assigneeId?: number }) => {
    const { signal, status, assigneeId } = options || {};
    const searchParams = new URLSearchParams();
    if (status) searchParams.set('status', status);
    if (assigneeId) searchParams.set('assignee_id', String(assigneeId));
    const query = searchParams.toString();
    return api.get<Issue[]>(`/issues${query ? `?${query}` : ''}`, { signal });
  },

  // Get single issue by ID
  get: (id: number, options?: RequestOptions) => 
    api.get<Issue>(`/issues/${id}`, options),

  // Create new issue
  create: (data: CreateIssueRequest, options?: RequestOptions) => 
    api.post<Issue>('/issues', data, options),

  // Update issue
  update: (id: number, data: UpdateIssueRequest, options?: RequestOptions) => 
    api.put<Issue>(`/issues/${id}`, data, options),

  // Update just the status (for drag-and-drop)
  updateStatus: (id: number, status: IssueStatusType, options?: RequestOptions) =>
    api.patch<Issue>(`/issues/${id}/status`, { status }, options),

  // Move an issue to a dropped position (for drag-and-drop reordering)
  move: (id: number, data: MoveIssueRequest, options?: RequestOptions) =>
    api.patch<Issue>(`/issues/${id}/move`, data, options),

  // Delete issue
  delete: (id: number, options?: RequestOptions) => 
    api.delete<{ message: string }>(`/issues/${id}`, options),
};
