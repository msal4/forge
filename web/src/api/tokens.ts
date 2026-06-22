import { api } from './client';

export interface APIToken {
  id: number;
  name: string;
  tokenPrefix: string;
  lastUsedAt?: string;
  createdAt: string;
}

export interface CreateAPITokenResponse {
  token: APIToken;
  secret: string;
}

export const apiTokensApi = {
  list: () => api.get<APIToken[]>('/users/me/tokens'),

  create: (name: string) =>
    api.post<CreateAPITokenResponse>('/users/me/tokens', { name }),

  revoke: (id: number) =>
    api.delete<{ message: string }>(`/users/me/tokens/${id}`),
};
