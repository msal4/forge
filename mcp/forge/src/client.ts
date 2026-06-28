export interface Workspace {
  id: number;
  key: string;
  name: string;
  description?: string;
}

export interface User {
  id: number;
  username: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  language?: string;
  isAdmin: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Issue {
  id: number;
  projectId: number;
  issueNumber: number;
  title: string;
  description?: string;
  status: string;
  priority: string;
  rank: string;
  assigneeId?: number;
  reporterId: number;
  labels: string[];
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: number;
  issueId?: number;
  docId?: number;
  releaseId?: number;
  authorId: number;
  author?: {
    id: number;
    username: string;
    fullName: string;
    avatarUrl?: string;
  };
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityLog {
  id: number;
  action: string;
  entityType: string;
  entityId: number;
  entityTitle?: string;
  user?: {
    id: number;
    username: string;
    fullName: string;
  };
  changes?: Record<string, unknown>;
  createdAt: string;
}

export interface ActivityLogResponse {
  activities: ActivityLog[];
  hasMore: boolean;
}

export interface Doc {
  id: number;
  projectId: number;
  title: string;
  content?: string;
  slug: string;
  parentId?: number;
  authorId: number;
  author?: {
    id: number;
    username: string;
    fullName: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface SearchResult {
  type: 'issue' | 'doc';
  id: number;
  title: string;
  status?: string;
}

export interface InviteWorkspaceSummary {
  id: number;
  key: string;
  name: string;
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

export class ForgeClient {
  private baseUrl: string;
  private token: string;
  private workspaceMap: Map<string, Workspace>;
  private defaultWorkspaceKey: string;

  constructor(baseUrl: string, token: string, workspaces: Workspace[], defaultWorkspaceKey: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.token = token;
    this.defaultWorkspaceKey = defaultWorkspaceKey.toUpperCase();
    this.workspaceMap = new Map(workspaces.map((ws) => [ws.key.toUpperCase(), ws]));
  }

  getDefaultWorkspaceKey() {
    return this.defaultWorkspaceKey;
  }

  resolveWorkspaceKey(workspaceKey?: string): string {
    return (workspaceKey ?? this.defaultWorkspaceKey).toUpperCase();
  }

  private resolveWorkspaceId(workspaceKey?: string): number {
    const key = this.resolveWorkspaceKey(workspaceKey);
    const workspace = this.workspaceMap.get(key);
    if (!workspace) {
      const available = [...this.workspaceMap.keys()].join(', ') || '(none)';
      throw new Error(`Workspace "${key}" not found. Available: ${available}`);
    }
    return workspace.id;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    scoped = true,
    workspaceKey?: string
  ): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      Accept: 'application/json',
    };

    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    if (scoped) {
      headers['X-Workspace-Id'] = String(this.resolveWorkspaceId(workspaceKey));
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const text = await response.text();
    let data: unknown = undefined;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    if (!response.ok) {
      const message =
        typeof data === 'object' &&
        data !== null &&
        'message' in data &&
        typeof (data as { message: unknown }).message === 'string'
          ? (data as { message: string }).message
          : `HTTP ${response.status}`;
      throw new Error(message);
    }

    return data as T;
  }

  async validateAuth() {
    return this.request<{ id: number; username: string; email: string }>(
      'GET',
      '/api/auth/me',
      undefined,
      false
    );
  }

  async listWorkspaces() {
    return this.request<Workspace[]>('GET', '/api/workspaces', undefined, false);
  }

  async listUsers(workspaceKey?: string): Promise<User[]> {
    return this.request<User[]>('GET', '/api/users', undefined, true, workspaceKey);
  }

  async listAllUsers(): Promise<User[]> {
    return this.request<User[]>('GET', '/api/users?all=true', undefined, false);
  }

  async createInvite(data: {
    username: string;
    fullName?: string;
    email?: string;
    workspaceKeys: string[];
    expiresInDays?: number;
  }): Promise<UserInvite> {
    return this.request<UserInvite>('POST', '/api/invites', data, false);
  }

  async listInvites(): Promise<UserInvite[]> {
    return this.request<UserInvite[]>('GET', '/api/invites', undefined, false);
  }

  async revokeInvite(id: number): Promise<{ message: string }> {
    return this.request<{ message: string }>('DELETE', `/api/invites/${id}`, undefined, false);
  }

  async addWorkspaceMembers(
    workspaceKey: string,
    userIds: number[]
  ): Promise<User[]> {
    const workspaceId = this.resolveWorkspaceId(workspaceKey);
    return this.request<User[]>(
      'POST',
      `/api/workspaces/${workspaceId}/members`,
      { userIds },
      false
    );
  }

  async listIssues(
    params?: { status?: string; assigneeId?: number; workspaceKey?: string }
  ): Promise<Issue[]> {
    const search = new URLSearchParams();
    if (params?.status) search.set('status', params.status);
    if (params?.assigneeId) search.set('assignee_id', String(params.assigneeId));
    const query = search.toString();
    return this.request<Issue[]>(
      'GET',
      `/api/issues${query ? `?${query}` : ''}`,
      undefined,
      true,
      params?.workspaceKey
    );
  }

  async getIssue(id: number, workspaceKey?: string) {
    return this.request<Issue>('GET', `/api/issues/${id}`, undefined, true, workspaceKey);
  }

  async createIssue(
    data: {
      title: string;
      description?: string;
      priority?: string;
      assigneeId?: number;
      labels?: string[];
      dueDate?: string;
    },
    workspaceKey?: string
  ): Promise<Issue> {
    return this.request<Issue>('POST', '/api/issues', data, true, workspaceKey);
  }

  async updateIssue(
    id: number,
    data: {
      title?: string;
      description?: string;
      status?: string;
      priority?: string;
      assigneeId?: number | null;
      labels?: string[];
      dueDate?: string | null;
    },
    workspaceKey?: string
  ): Promise<Issue> {
    return this.request<Issue>('PUT', `/api/issues/${id}`, data, true, workspaceKey);
  }

  async deleteIssue(id: number, workspaceKey?: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(
      'DELETE',
      `/api/issues/${id}`,
      undefined,
      true,
      workspaceKey
    );
  }

  async moveIssue(
    id: number,
    data: { status: string; beforeId?: number | null; afterId?: number | null },
    workspaceKey?: string
  ): Promise<Issue> {
    return this.request<Issue>('PATCH', `/api/issues/${id}/move`, data, true, workspaceKey);
  }

  async setIssueStatus(
    id: number,
    status: string,
    workspaceKey?: string
  ): Promise<Issue> {
    return this.request<Issue>('PATCH', `/api/issues/${id}/status`, { status }, true, workspaceKey);
  }

  async listIssueComments(id: number, workspaceKey?: string): Promise<Comment[]> {
    return this.request<Comment[]>(
      'GET',
      `/api/issues/${id}/comments`,
      undefined,
      true,
      workspaceKey
    );
  }

  async createIssueComment(
    id: number,
    content: string,
    workspaceKey?: string
  ): Promise<Comment> {
    return this.request<Comment>(
      'POST',
      `/api/issues/${id}/comments`,
      { content },
      true,
      workspaceKey
    );
  }

  async getIssueActivity(
    id: number,
    params?: { limit?: number; offset?: number },
    workspaceKey?: string
  ): Promise<ActivityLogResponse> {
    const search = new URLSearchParams();
    if (params?.limit !== undefined) search.set('limit', String(params.limit));
    if (params?.offset !== undefined) search.set('offset', String(params.offset));
    const query = search.toString();
    return this.request<ActivityLogResponse>(
      'GET',
      `/api/issues/${id}/activity${query ? `?${query}` : ''}`,
      undefined,
      true,
      workspaceKey
    );
  }

  async listDocs(params?: {
    parentId?: number | 'root';
    workspaceKey?: string;
  }): Promise<Doc[]> {
    const search = new URLSearchParams();
    if (params?.parentId !== undefined) {
      search.set('parent_id', params.parentId === 'root' ? 'root' : String(params.parentId));
    }
    const query = search.toString();
    return this.request<Doc[]>(
      'GET',
      `/api/docs${query ? `?${query}` : ''}`,
      undefined,
      true,
      params?.workspaceKey
    );
  }

  async getDoc(idOrSlug: number | string, workspaceKey?: string): Promise<Doc> {
    return this.request<Doc>(
      'GET',
      `/api/docs/${idOrSlug}`,
      undefined,
      true,
      workspaceKey
    );
  }

  async createDoc(
    data: { title: string; content?: string; parentId?: number },
    workspaceKey?: string
  ): Promise<Doc> {
    return this.request<Doc>('POST', '/api/docs', data, true, workspaceKey);
  }

  async updateDoc(
    id: number,
    data: { title?: string; content?: string; parentId?: number | null },
    workspaceKey?: string
  ): Promise<Doc> {
    return this.request<Doc>('PUT', `/api/docs/${id}`, data, true, workspaceKey);
  }

  async deleteDoc(id: number, workspaceKey?: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(
      'DELETE',
      `/api/docs/${id}`,
      undefined,
      true,
      workspaceKey
    );
  }

  async search(query: string, workspaceKey?: string) {
    return this.request<{ results: SearchResult[] }>(
      'GET',
      `/api/search?q=${encodeURIComponent(query)}`,
      undefined,
      true,
      workspaceKey
    );
  }
}

export function getConfig() {
  const baseUrl = process.env.FORGE_URL?.trim();
  const token = process.env.FORGE_TOKEN?.trim();
  const workspaceKey = (process.env.FORGE_WORKSPACE?.trim() || 'FORGE').toUpperCase();

  if (!baseUrl) {
    throw new Error('FORGE_URL is required');
  }
  if (!token) {
    throw new Error('FORGE_TOKEN is required');
  }

  return { baseUrl, token, workspaceKey };
}

export async function initClient(): Promise<{ client: ForgeClient; workspaceKey: string }> {
  const { baseUrl, token, workspaceKey } = getConfig();
  const bootstrap = new ForgeClient(baseUrl, token, [], workspaceKey);

  await bootstrap.validateAuth();
  const workspaces = await bootstrap.listWorkspaces();

  if (!workspaces.find((ws) => ws.key.toUpperCase() === workspaceKey)) {
    const keys = workspaces.map((ws) => ws.key).join(', ') || '(none)';
    throw new Error(`Workspace "${workspaceKey}" not found. Available: ${keys}`);
  }

  const client = new ForgeClient(baseUrl, token, workspaces, workspaceKey);
  const workspace = workspaces.find((ws) => ws.key.toUpperCase() === workspaceKey)!;
  return { client, workspaceKey: workspace.key };
}
