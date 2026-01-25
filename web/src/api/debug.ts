import { api } from './client';

export interface TableInfo {
  name: string;
}

export interface ColumnInfo {
  cid: number;
  name: string;
  type: string;
  notNull: boolean;
  default: string | null;
  primaryKey: boolean;
}

export interface TableDataResponse {
  name: string;
  columns: ColumnInfo[];
  rows: Record<string, unknown>[];
  total: number;
}

export interface QueryResponse {
  columns?: string[];
  rows?: Record<string, unknown>[];
  rowsAffected?: number;
  message?: string;
}

export interface DebugStatus {
  canWrite: boolean;
  email: string;
}

export const debugApi = {
  // Get debug access status for current user
  getStatus: () => api.get<DebugStatus>('/debug/status'),

  // List all tables in the database
  listTables: () => api.get<TableInfo[]>('/debug/tables'),

  // Get schema and data for a specific table
  getTableData: (tableName: string) => 
    api.get<TableDataResponse>(`/debug/tables/${encodeURIComponent(tableName)}`),

  // Execute a SQL query
  executeQuery: (sql: string) => 
    api.post<QueryResponse>('/debug/query', { sql }),
};
