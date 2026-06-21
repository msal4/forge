// ============================================
// API Client - Centralized fetch wrapper
// ============================================

import i18n from '../i18n';

const API_BASE = '/api';

let currentWorkspaceId: number | null = null;

export function setApiWorkspaceId(id: number | null) {
  currentWorkspaceId = id;
}

export function getApiWorkspaceId() {
  return currentWorkspaceId;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface RequestOptions extends Omit<RequestInit, 'signal'> {
  signal?: AbortSignal;
}

async function request<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'Accept-Language': i18n.language || 'en',
      ...(currentWorkspaceId ? { 'X-Workspace-Id': String(currentWorkspaceId) } : {}),
      ...options.headers,
    },
  });

  // Handle no-content responses
  if (response.status === 204) {
    return undefined as T;
  }

  const data = await response.json();

  if (!response.ok) {
    throw new ApiError(
      response.status,
      data.error || 'unknown_error',
      data.message || 'An error occurred'
    );
  }

  return data;
}

export const api = {
  get: <T>(endpoint: string, options?: RequestOptions) => 
    request<T>(endpoint, options),
  
  post: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),
  
  put: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    }),
  
  patch: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    }),
  
  delete: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'DELETE' }),
};
