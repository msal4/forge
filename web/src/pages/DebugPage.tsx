import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Database, Table, Play, AlertTriangle, ChevronRight, Key, Hash } from 'lucide-react';
import { debugApi, TableInfo, QueryResponse, ColumnInfo } from '../api/debug';

export function DebugPage() {
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [sql, setSql] = useState('');
  const [queryResult, setQueryResult] = useState<QueryResponse | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);

  // Fetch debug status
  const { data: status } = useQuery({
    queryKey: ['debug-status'],
    queryFn: debugApi.getStatus,
  });

  // Fetch tables list
  const { data: tables, isLoading: tablesLoading } = useQuery({
    queryKey: ['debug-tables'],
    queryFn: debugApi.listTables,
  });

  // Fetch selected table data
  const { data: tableData, isLoading: tableLoading } = useQuery({
    queryKey: ['debug-table', selectedTable],
    queryFn: () => (selectedTable ? debugApi.getTableData(selectedTable) : null),
    enabled: !!selectedTable,
  });

  // Execute query mutation
  const queryMutation = useMutation({
    mutationFn: debugApi.executeQuery,
    onSuccess: (data) => {
      setQueryResult(data);
      setQueryError(null);
    },
    onError: (error: Error) => {
      setQueryError(error.message);
      setQueryResult(null);
    },
  });

  const handleExecuteQuery = () => {
    if (sql.trim()) {
      queryMutation.mutate(sql);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleExecuteQuery();
    }
  };

  // Auto-select first table on load
  useEffect(() => {
    if (tables && tables.length > 0 && !selectedTable) {
      setSelectedTable(tables[0].name);
    }
  }, [tables, selectedTable]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-parchment-300 bg-parchment-100 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Database className="w-6 h-6 text-lapis-600" />
            <h1 className="text-2xl font-inscription text-lapis-800">Database Debug Console</h1>
          </div>
          {status && (
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-tablet text-sm ${
              status.canWrite 
                ? 'bg-clay-100 text-clay-700 border border-clay-300' 
                : 'bg-parchment-200 text-lapis-600 border border-parchment-300'
            }`}>
              {status.canWrite ? (
                <>
                  <AlertTriangle className="w-4 h-4" />
                  <span>Full Access (Read/Write)</span>
                </>
              ) : (
                <>
                  <Database className="w-4 h-4" />
                  <span>Read-Only Access</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Tables sidebar */}
        <div className="w-64 flex-shrink-0 border-r border-parchment-300 bg-parchment-50 overflow-y-auto">
          <div className="p-4">
            <h2 className="text-sm font-semibold text-lapis-700 uppercase tracking-wide mb-3">
              Tables
            </h2>
            {tablesLoading ? (
              <div className="text-sm text-lapis-500">Loading...</div>
            ) : (
              <ul className="space-y-1">
                {tables?.map((table: TableInfo) => (
                  <li key={table.name}>
                    <button
                      onClick={() => setSelectedTable(table.name)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                        selectedTable === table.name
                          ? 'bg-lapis-100 text-lapis-800 font-medium'
                          : 'text-lapis-600 hover:bg-parchment-200'
                      }`}
                    >
                      <Table className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{table.name}</span>
                      {selectedTable === table.name && (
                        <ChevronRight className="w-4 h-4 ml-auto flex-shrink-0" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Main panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Table viewer */}
          <div className="flex-1 overflow-auto p-6">
            {tableLoading ? (
              <div className="text-lapis-500">Loading table data...</div>
            ) : tableData ? (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-lapis-800">
                    {tableData.name}
                  </h2>
                  <span className="text-sm text-lapis-500">
                    {tableData.total} rows {tableData.total > 100 && '(showing first 100)'}
                  </span>
                </div>

                {/* Schema info */}
                <div className="mb-4 p-3 bg-parchment-100 rounded-lg border border-parchment-300">
                  <h3 className="text-xs font-semibold text-lapis-600 uppercase tracking-wide mb-2">
                    Schema
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {tableData.columns.map((col: ColumnInfo) => (
                      <div
                        key={col.name}
                        className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs ${
                          col.primaryKey
                            ? 'bg-gold-100 text-gold-800 border border-gold-300'
                            : 'bg-parchment-200 text-lapis-700'
                        }`}
                      >
                        {col.primaryKey && <Key className="w-3 h-3" />}
                        <span className="font-medium">{col.name}</span>
                        <span className="text-lapis-500">{col.type}</span>
                        {col.notNull && <span className="text-clay-600">*</span>}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Data table */}
                <div className="overflow-x-auto border border-parchment-300 rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-parchment-200">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-lapis-700 uppercase tracking-wide border-b border-parchment-300">
                          <Hash className="w-3 h-3 inline" />
                        </th>
                        {tableData.columns.map((col: ColumnInfo) => (
                          <th
                            key={col.name}
                            className="px-3 py-2 text-left text-xs font-semibold text-lapis-700 uppercase tracking-wide border-b border-parchment-300"
                          >
                            {col.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-parchment-200">
                      {tableData.rows?.length > 0 ? (
                        tableData.rows.map((row, idx) => (
                          <tr key={idx} className="hover:bg-parchment-50">
                            <td className="px-3 py-2 text-lapis-400 font-mono text-xs">
                              {idx + 1}
                            </td>
                            {tableData.columns.map((col: ColumnInfo) => (
                              <td
                                key={col.name}
                                className="px-3 py-2 font-mono text-xs text-lapis-800 max-w-xs truncate"
                                title={String(row[col.name] ?? '')}
                              >
                                {row[col.name] === null ? (
                                  <span className="text-lapis-400 italic">NULL</span>
                                ) : (
                                  String(row[col.name])
                                )}
                              </td>
                            ))}
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={tableData.columns.length + 1}
                            className="px-3 py-8 text-center text-lapis-500"
                          >
                            No data in this table
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-lapis-500">Select a table to view its data</div>
            )}
          </div>

          {/* SQL Console */}
          <div className="flex-shrink-0 border-t border-parchment-300 bg-parchment-100 p-4">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-sm font-semibold text-lapis-700">SQL Console</h3>
              <span className="text-xs text-lapis-500">
                (Ctrl+Enter to execute)
              </span>
            </div>
            <div className="flex gap-3">
              <textarea
                value={sql}
                onChange={(e) => setSql(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={status?.canWrite 
                  ? "Enter SQL query (SELECT, INSERT, UPDATE, DELETE...)" 
                  : "Enter SELECT query..."
                }
                className="flex-1 h-24 px-3 py-2 bg-white border border-parchment-300 rounded-lg font-mono text-sm text-lapis-800 placeholder:text-lapis-400 focus:outline-none focus:ring-2 focus:ring-lapis-500 focus:border-transparent resize-none"
              />
              <button
                onClick={handleExecuteQuery}
                disabled={queryMutation.isPending || !sql.trim()}
                className="px-4 py-2 h-fit bg-lapis-600 text-white rounded-lg hover:bg-lapis-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                <Play className="w-4 h-4" />
                Run
              </button>
            </div>

            {/* Query results */}
            {(queryResult || queryError) && (
              <div className="mt-3">
                {queryError ? (
                  <div className="p-3 bg-clay-50 border border-clay-300 rounded-lg text-clay-700 text-sm">
                    <span className="font-semibold">Error:</span> {queryError}
                  </div>
                ) : queryResult?.message ? (
                  <div className="p-3 bg-green-50 border border-green-300 rounded-lg text-green-700 text-sm">
                    {queryResult.message}
                    {queryResult.rowsAffected !== undefined && (
                      <span className="ml-2">({queryResult.rowsAffected} rows affected)</span>
                    )}
                  </div>
                ) : queryResult?.rows ? (
                  <div className="overflow-x-auto max-h-48 border border-parchment-300 rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-parchment-200 sticky top-0">
                        <tr>
                          {queryResult.columns?.map((col) => (
                            <th
                              key={col}
                              className="px-3 py-2 text-left text-xs font-semibold text-lapis-700 uppercase tracking-wide"
                            >
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-parchment-200 bg-white">
                        {queryResult.rows.map((row, idx) => (
                          <tr key={idx} className="hover:bg-parchment-50">
                            {queryResult.columns?.map((col) => (
                              <td
                                key={col}
                                className="px-3 py-2 font-mono text-xs text-lapis-800 max-w-xs truncate"
                              >
                                {row[col] === null ? (
                                  <span className="text-lapis-400 italic">NULL</span>
                                ) : (
                                  String(row[col])
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="bg-parchment-100 px-3 py-1 text-xs text-lapis-500 border-t border-parchment-300">
                      {queryResult.rows.length} rows returned
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
