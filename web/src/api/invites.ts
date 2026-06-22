import { api, type RequestOptions } from './client';

export interface InviteWorkspaceSummary {
  id: number;
  key: string;
  name: string;
}

export interface InvitePreview {
  username: string;
  fullName: string;
  email: string;
  workspaces: InviteWorkspaceSummary[];
  expiresAt: string;
  status: 'pending' | 'expired' | 'used';
}

export interface UserInvite {
  id: number;
  username: string;
  fullName: string;
  email: string;
  workspaces: InviteWorkspaceSummary[];
  inviteUrl: string;
  expiresAt: string;
  createdAt: string;
}

export interface CreateInviteRequest {
  username: string;
  fullName?: string;
  email?: string;
  workspaceKeys: string[];
  expiresInDays?: 1 | 2;
}

export interface AcceptInviteResponse {
  token: string;
  user: {
    id: number;
    username: string;
    email: string;
    fullName: string;
  };
}

export const invitesApi = {
  list: (options?: RequestOptions) => api.get<UserInvite[]>('/invites', options),

  create: (data: CreateInviteRequest, options?: RequestOptions) =>
    api.post<UserInvite>('/invites', data, options),

  revoke: (id: number, options?: RequestOptions) =>
    api.delete<{ message: string }>(`/invites/${id}`, options),

  preview: (token: string, options?: RequestOptions) =>
    api.get<InvitePreview>(`/invites/${token}`, options),

  accept: (token: string, password: string, options?: RequestOptions) =>
    api.post<AcceptInviteResponse>(`/invites/${token}/accept`, { password }, options),
};
