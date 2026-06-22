export interface Workspace {
  id: number;
  key: string;
  name: string;
  description?: string;
}

export interface Issue {
  id: number;
  projectId: number;
  issueNumber: number;
  title: string;
  description?: string;
  status: string;
  priority: string;
  assigneeId?: number;
  reporterId: number;
  labels: string[];
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SearchResult {
  type: 'issue' | 'doc';
  id: number;
  title: string;
  status?: string;
}

export class ForgeClient {
  private baseUrl: string;
  private token: string;
  private workspaceId: number | null = null;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.token = token;
  }

  setWorkspaceId(id: number) {
    this.workspaceId = id;
  }

  getWorkspaceId() {
    return this.workspaceId;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    scoped = true
  ): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      Accept: 'application/json',
    };

    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    if (scoped) {
      if (!this.workspaceId) {
        throw new Error('Workspace not configured');
      }
      headers['X-Workspace-Id'] = String(this.workspaceId);
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

  async listIssues(params?: { status?: string; assigneeId?: number }): Promise<Issue[]> {
    const search = new URLSearchParams();
    if (params?.status) search.set('status', params.status);
    if (params?.assigneeId) search.set('assignee_id', String(params.assigneeId));
    const query = search.toString();
    return this.request<Issue[]>('GET', `/api/issues${query ? `?${query}` : ''}`);
  }

  async getIssue(id: number) {
    return this.request<Issue>('GET', `/api/issues/${id}`);
  }

  async createIssue(data: {
    title: string;
    description?: string;
    priority?: string;
    assigneeId?: number;
    labels?: string[];
    dueDate?: string;
  }): Promise<Issue> {
    return this.request<Issue>('POST', '/api/issues', data);
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
    }
  ): Promise<Issue> {
    return this.request<Issue>('PUT', `/api/issues/${id}`, data);
  }

  async search(query: string) {
    return this.request<{ results: SearchResult[] }>(
      'GET',
      `/api/search?q=${encodeURIComponent(query)}`
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
  const client = new ForgeClient(baseUrl, token);

  await client.validateAuth();
  const workspaces = await client.listWorkspaces();
  const workspace = workspaces.find((ws) => ws.key.toUpperCase() === workspaceKey);
  if (!workspace) {
    const keys = workspaces.map((ws) => ws.key).join(', ') || '(none)';
    throw new Error(`Workspace "${workspaceKey}" not found. Available: ${keys}`);
  }

  client.setWorkspaceId(workspace.id);
  return { client, workspaceKey: workspace.key };
}
