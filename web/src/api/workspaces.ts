import { api } from './client';
import type { User } from './users';

export interface Workspace {
  id: number;
  key: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWorkspaceRequest {
  key: string;
  name: string;
  description?: string;
}

export const workspacesApi = {
  list: () => api.get<Workspace[]>('/workspaces'),

  create: (data: CreateWorkspaceRequest) =>
    api.post<Workspace>('/workspaces', data),

  listMembers: (workspaceId: number) =>
    api.get<User[]>(`/workspaces/${workspaceId}/members`),

  setMembers: (workspaceId: number, userIds: number[]) =>
    api.put<User[]>(`/workspaces/${workspaceId}/members`, { userIds }),
};
