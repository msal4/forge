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

function buildHeaders(extra?: HeadersInit, body?: BodyInit | null): HeadersInit {
  const headers: Record<string, string> = {
    'Accept-Language': i18n.language || 'en',
  };

  if (currentWorkspaceId) {
    headers['X-Workspace-Id'] = String(currentWorkspaceId);
  }

  if (extra) {
    if (extra instanceof Headers) {
      extra.forEach((value, key) => {
        headers[key] = value;
      });
    } else if (Array.isArray(extra)) {
      for (const [key, value] of extra) {
        headers[key] = value;
      }
    } else {
      Object.assign(headers, extra);
    }
  }

  // Let the browser set multipart boundaries for FormData uploads.
  if (body instanceof FormData) {
    delete headers['Content-Type'];
  }

  return headers;
}

export function appendWorkspaceQuery(endpoint: string): string {
  if (!currentWorkspaceId) return endpoint;
  const separator = endpoint.includes('?') ? '&' : '?';
  return `${endpoint}${separator}workspace_id=${currentWorkspaceId}`;
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
  const body = options.body ?? null;

  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: buildHeaders(
      {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body
    ),
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

async function uploadForm<T>(
  endpoint: string,
  formData: FormData,
  options: RequestOptions = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    method: 'POST',
    credentials: 'include',
    body: formData,
    headers: buildHeaders(options.headers, formData),
  });

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

  uploadForm: <T>(endpoint: string, formData: FormData, options?: RequestOptions) =>
    uploadForm<T>(endpoint, formData, options),
};
