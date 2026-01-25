package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"sarray-forge/internal/middleware"
)

// Admin email that has write access to the debug console
const debugAdminEmail = "salman@sarray.de"

// TableInfo represents metadata about a database table
type TableInfo struct {
	Name string `json:"name"`
}

// ColumnInfo represents metadata about a table column
type ColumnInfo struct {
	CID        int     `json:"cid"`
	Name       string  `json:"name"`
	Type       string  `json:"type"`
	NotNull    bool    `json:"notNull"`
	Default    *string `json:"default"`
	PrimaryKey bool    `json:"primaryKey"`
}

// TableDataResponse contains table schema and data
type TableDataResponse struct {
	Name    string                   `json:"name"`
	Columns []ColumnInfo             `json:"columns"`
	Rows    []map[string]interface{} `json:"rows"`
	Total   int                      `json:"total"`
}

// QueryRequest represents a SQL query request
type QueryRequest struct {
	SQL string `json:"sql"`
}

// QueryResponse represents the result of a SQL query
type QueryResponse struct {
	Columns      []string                 `json:"columns"`
	Rows         []map[string]interface{} `json:"rows"`
	RowsAffected int64                    `json:"rowsAffected,omitempty"`
	Message      string                   `json:"message,omitempty"`
}

// DebugStatusResponse shows user's debug access level
type DebugStatusResponse struct {
	CanWrite bool   `json:"canWrite"`
	Email    string `json:"email"`
}

// ListTables handles GET /api/debug/tables
func (h *Handlers) ListTables(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.Query(`
		SELECT name FROM sqlite_master 
		WHERE type='table' AND name NOT LIKE 'sqlite_%'
		ORDER BY name
	`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to list tables")
		return
	}
	defer rows.Close()

	var tables []TableInfo
	for rows.Next() {
		var t TableInfo
		if err := rows.Scan(&t.Name); err != nil {
			writeError(w, http.StatusInternalServerError, "db_error", "Failed to scan table")
			return
		}
		tables = append(tables, t)
	}

	writeJSON(w, http.StatusOK, tables)
}

// GetTableData handles GET /api/debug/tables/{name}
func (h *Handlers) GetTableData(w http.ResponseWriter, r *http.Request) {
	tableName := r.PathValue("name")
	if tableName == "" {
		writeError(w, http.StatusBadRequest, "invalid_table", "Table name is required")
		return
	}

	// Validate table name exists (prevent SQL injection)
	var exists int
	err := h.db.QueryRow(`
		SELECT COUNT(*) FROM sqlite_master 
		WHERE type='table' AND name = ?
	`, tableName).Scan(&exists)
	if err != nil || exists == 0 {
		writeError(w, http.StatusNotFound, "not_found", "Table not found")
		return
	}

	// Get column info using PRAGMA
	pragmaRows, err := h.db.Query("PRAGMA table_info(" + tableName + ")")
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to get table info")
		return
	}

	var columns []ColumnInfo
	for pragmaRows.Next() {
		var col ColumnInfo
		var notNull, pk int
		if err := pragmaRows.Scan(&col.CID, &col.Name, &col.Type, &notNull, &col.Default, &pk); err != nil {
			pragmaRows.Close()
			writeError(w, http.StatusInternalServerError, "db_error", "Failed to scan column info")
			return
		}
		col.NotNull = notNull == 1
		col.PrimaryKey = pk == 1
		columns = append(columns, col)
	}
	pragmaRows.Close()

	// Get total count
	var total int
	h.db.QueryRow("SELECT COUNT(*) FROM " + tableName).Scan(&total)

	// Get data (limit to 100 rows for safety)
	dataRows, err := h.db.Query("SELECT * FROM " + tableName + " LIMIT 100")
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to query table data")
		return
	}
	defer dataRows.Close()

	colNames, _ := dataRows.Columns()
	var rows []map[string]interface{}

	for dataRows.Next() {
		// Create a slice of interface{} to hold the values
		values := make([]interface{}, len(colNames))
		valuePtrs := make([]interface{}, len(colNames))
		for i := range values {
			valuePtrs[i] = &values[i]
		}

		if err := dataRows.Scan(valuePtrs...); err != nil {
			writeError(w, http.StatusInternalServerError, "db_error", "Failed to scan row")
			return
		}

		row := make(map[string]interface{})
		for i, colName := range colNames {
			val := values[i]
			// Convert []byte to string for readability
			if b, ok := val.([]byte); ok {
				row[colName] = string(b)
			} else {
				row[colName] = val
			}
		}
		rows = append(rows, row)
	}

	writeJSON(w, http.StatusOK, TableDataResponse{
		Name:    tableName,
		Columns: columns,
		Rows:    rows,
		Total:   total,
	})
}

// ExecuteQuery handles POST /api/debug/query
func (h *Handlers) ExecuteQuery(w http.ResponseWriter, r *http.Request) {
	_, email, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Authentication required")
		return
	}

	var req QueryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", "Invalid request body")
		return
	}

	sql := strings.TrimSpace(req.SQL)
	if sql == "" {
		writeError(w, http.StatusBadRequest, "invalid_sql", "SQL query is required")
		return
	}

	// Check if it's a write operation
	upperSQL := strings.ToUpper(sql)
	isWriteOp := strings.HasPrefix(upperSQL, "INSERT") ||
		strings.HasPrefix(upperSQL, "UPDATE") ||
		strings.HasPrefix(upperSQL, "DELETE") ||
		strings.HasPrefix(upperSQL, "DROP") ||
		strings.HasPrefix(upperSQL, "ALTER") ||
		strings.HasPrefix(upperSQL, "CREATE")

	// Only admin can execute write operations
	if isWriteOp && email != debugAdminEmail {
		writeError(w, http.StatusForbidden, "forbidden", "Write operations are only allowed for admin users")
		return
	}

	// Execute the query
	if isWriteOp {
		result, err := h.db.Exec(sql)
		if err != nil {
			writeError(w, http.StatusBadRequest, "query_error", err.Error())
			return
		}
		rowsAffected, _ := result.RowsAffected()
		writeJSON(w, http.StatusOK, QueryResponse{
			RowsAffected: rowsAffected,
			Message:      "Query executed successfully",
		})
		return
	}

	// SELECT query
	rows, err := h.db.Query(sql)
	if err != nil {
		writeError(w, http.StatusBadRequest, "query_error", err.Error())
		return
	}
	defer rows.Close()

	colNames, _ := rows.Columns()
	var resultRows []map[string]interface{}

	for rows.Next() {
		values := make([]interface{}, len(colNames))
		valuePtrs := make([]interface{}, len(colNames))
		for i := range values {
			valuePtrs[i] = &values[i]
		}

		if err := rows.Scan(valuePtrs...); err != nil {
			writeError(w, http.StatusInternalServerError, "scan_error", err.Error())
			return
		}

		row := make(map[string]interface{})
		for i, colName := range colNames {
			val := values[i]
			if b, ok := val.([]byte); ok {
				row[colName] = string(b)
			} else {
				row[colName] = val
			}
		}
		resultRows = append(resultRows, row)
	}

	writeJSON(w, http.StatusOK, QueryResponse{
		Columns: colNames,
		Rows:    resultRows,
	})
}

// GetDebugStatus handles GET /api/debug/status
func (h *Handlers) GetDebugStatus(w http.ResponseWriter, r *http.Request) {
	_, email, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Authentication required")
		return
	}

	writeJSON(w, http.StatusOK, DebugStatusResponse{
		CanWrite: email == debugAdminEmail,
		Email:    email,
	})
}
