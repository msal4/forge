// ============================================
// Issues API - The Tablet
// ============================================

import { api } from './client';

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
  title: string;
  description?: string;
  status: IssueStatusType;
  priority: PriorityType;
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
  };
  reporter?: {
    id: number;
    username: string;
    fullName: string;
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

// API functions
export const issuesApi = {
  // List all issues, optionally filtered
  list: (params?: { status?: IssueStatusType; assigneeId?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.assigneeId) searchParams.set('assignee_id', String(params.assigneeId));
    const query = searchParams.toString();
    return api.get<Issue[]>(`/issues${query ? `?${query}` : ''}`);
  },

  // Get single issue by ID
  get: (id: number) => api.get<Issue>(`/issues/${id}`),

  // Create new issue
  create: (data: CreateIssueRequest) => api.post<Issue>('/issues', data),

  // Update issue
  update: (id: number, data: UpdateIssueRequest) => 
    api.put<Issue>(`/issues/${id}`, data),

  // Update just the status (for drag-and-drop)
  updateStatus: (id: number, status: IssueStatusType) =>
    api.patch<Issue>(`/issues/${id}/status`, { status }),

  // Delete issue
  delete: (id: number) => api.delete<{ message: string }>(`/issues/${id}`),
};
