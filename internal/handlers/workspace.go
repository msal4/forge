package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"regexp"
	"strconv"
	"strings"

	"sarray-forge/internal/middleware"
	"sarray-forge/internal/models"
)

const workspaceHeader = "X-Workspace-Id"

// resolveWorkspaceID reads workspace ID from header or query param.
func (h *Handlers) resolveWorkspaceID(r *http.Request) (int64, error) {
	if header := r.Header.Get(workspaceHeader); header != "" {
		id, err := strconv.ParseInt(header, 10, 64)
		if err != nil || id <= 0 {
			return 0, err
		}
		return id, nil
	}

	if query := r.URL.Query().Get("workspace_id"); query != "" {
		id, err := strconv.ParseInt(query, 10, 64)
		if err != nil || id <= 0 {
			return 0, err
		}
		return id, nil
	}

	return 0, sql.ErrNoRows
}

func (h *Handlers) userIsAdmin(userID int64) bool {
	var isAdmin bool
	err := h.db.QueryRow("SELECT is_admin FROM users WHERE id = ?", userID).Scan(&isAdmin)
	return err == nil && isAdmin
}

func (h *Handlers) userHasWorkspaceAccess(userID, workspaceID int64) bool {
	if h.userIsAdmin(userID) {
		return true
	}
	var count int
	err := h.db.QueryRow(`
		SELECT COUNT(*) FROM workspace_members
		WHERE user_id = ? AND project_id = ?
	`, userID, workspaceID).Scan(&count)
	return err == nil && count > 0
}

// requireWorkspaceContext validates auth, resolves workspace, and checks access.
func (h *Handlers) requireWorkspaceContext(w http.ResponseWriter, r *http.Request) (userID, workspaceID int64, ok bool) {
	userID, _, authOK := middleware.GetUserFromContext(r.Context())
	if !authOK {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Not authenticated")
		return 0, 0, false
	}

	workspaceID, err := h.resolveWorkspaceID(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "missing_workspace", "Workspace context is required (X-Workspace-Id header)")
		return 0, 0, false
	}

	var exists int
	if err := h.db.QueryRow("SELECT 1 FROM projects WHERE id = ? AND is_archived = 0", workspaceID).Scan(&exists); err != nil {
		writeError(w, http.StatusNotFound, "workspace_not_found", "Workspace not found")
		return 0, 0, false
	}

	if !h.userHasWorkspaceAccess(userID, workspaceID) {
		writeError(w, http.StatusForbidden, "forbidden", "You do not have access to this workspace")
		return 0, 0, false
	}

	return userID, workspaceID, true
}

func (h *Handlers) requireIssueWorkspaceAccess(w http.ResponseWriter, r *http.Request, issueID int64) (userID, workspaceID int64, ok bool) {
	userID, workspaceID, ok = h.requireWorkspaceContext(w, r)
	if !ok {
		return 0, 0, false
	}

	var projectID int64
	err := h.db.QueryRow("SELECT project_id FROM issues WHERE id = ?", issueID).Scan(&projectID)
	if err != nil {
		writeError(w, http.StatusNotFound, "not_found", "Issue not found")
		return 0, 0, false
	}
	if projectID != workspaceID {
		writeError(w, http.StatusNotFound, "not_found", "Issue not found")
		return 0, 0, false
	}
	return userID, workspaceID, true
}

func (h *Handlers) requireDocWorkspaceAccess(w http.ResponseWriter, r *http.Request, docID int64) (userID, workspaceID int64, ok bool) {
	userID, workspaceID, ok = h.requireWorkspaceContext(w, r)
	if !ok {
		return 0, 0, false
	}

	var projectID int64
	err := h.db.QueryRow("SELECT project_id FROM docs WHERE id = ?", docID).Scan(&projectID)
	if err != nil {
		writeError(w, http.StatusNotFound, "not_found", "Doc not found")
		return 0, 0, false
	}
	if projectID != workspaceID {
		writeError(w, http.StatusNotFound, "not_found", "Doc not found")
		return 0, 0, false
	}
	return userID, workspaceID, true
}

func (h *Handlers) requireReleaseWorkspaceAccess(w http.ResponseWriter, r *http.Request, releaseID int64) (userID, workspaceID int64, ok bool) {
	userID, workspaceID, ok = h.requireWorkspaceContext(w, r)
	if !ok {
		return 0, 0, false
	}

	var projectID int64
	err := h.db.QueryRow("SELECT project_id FROM releases WHERE id = ?", releaseID).Scan(&projectID)
	if err != nil {
		writeError(w, http.StatusNotFound, "not_found", "Release not found")
		return 0, 0, false
	}
	if projectID != workspaceID {
		writeError(w, http.StatusNotFound, "not_found", "Release not found")
		return 0, 0, false
	}
	return userID, workspaceID, true
}

func (h *Handlers) scanWorkspace(row interface{ Scan(...any) error }) (models.Workspace, error) {
	var ws models.Workspace
	err := row.Scan(&ws.ID, &ws.Key, &ws.Name, &ws.Description, &ws.CreatedAt, &ws.UpdatedAt)
	return ws, err
}

// ListWorkspaces handles GET /api/workspaces
func (h *Handlers) ListWorkspaces(w http.ResponseWriter, r *http.Request) {
	userID, _, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Not authenticated")
		return
	}

	var rows *sql.Rows
	var err error
	if h.userIsAdmin(userID) {
		rows, err = h.db.Query(`
			SELECT id, key, name, description, created_at, updated_at
			FROM projects WHERE is_archived = 0 ORDER BY name
		`)
	} else {
		rows, err = h.db.Query(`
			SELECT p.id, p.key, p.name, p.description, p.created_at, p.updated_at
			FROM projects p
			JOIN workspace_members wm ON wm.project_id = p.id
			WHERE p.is_archived = 0 AND wm.user_id = ?
			ORDER BY p.name
		`, userID)
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to fetch workspaces")
		return
	}
	defer rows.Close()

	workspaces := []models.Workspace{}
	for rows.Next() {
		ws, err := h.scanWorkspace(rows)
		if err != nil {
			continue
		}
		workspaces = append(workspaces, ws)
	}

	writeJSON(w, http.StatusOK, workspaces)
}

// CreateWorkspace handles POST /api/workspaces
func (h *Handlers) CreateWorkspace(w http.ResponseWriter, r *http.Request) {
	userID, _, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Not authenticated")
		return
	}
	if !h.userIsAdmin(userID) {
		writeError(w, http.StatusForbidden, "forbidden", "Only admins can create workspaces")
		return
	}

	var req models.CreateWorkspaceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", "Invalid request body")
		return
	}

	req.Key = strings.ToUpper(strings.TrimSpace(req.Key))
	req.Name = strings.TrimSpace(req.Name)
	if req.Key == "" || req.Name == "" {
		writeError(w, http.StatusBadRequest, "missing_fields", "Key and name are required")
		return
	}
	if !regexp.MustCompile(`^[A-Z][A-Z0-9_-]{1,31}$`).MatchString(req.Key) {
		writeError(w, http.StatusBadRequest, "invalid_key", "Key must be 2-32 chars: uppercase letters, numbers, underscore, hyphen")
		return
	}

	var count int
	h.db.QueryRow("SELECT COUNT(*) FROM projects WHERE key = ? COLLATE NOCASE", req.Key).Scan(&count)
	if count > 0 {
		writeError(w, http.StatusConflict, "duplicate_key", "Workspace key already exists")
		return
	}

	result, err := h.db.Exec(`
		INSERT INTO projects (key, name, description, lead_id)
		VALUES (?, ?, ?, ?)
	`, req.Key, req.Name, req.Description, userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to create workspace")
		return
	}

	workspaceID, _ := result.LastInsertId()
	_, _ = h.db.Exec("INSERT OR IGNORE INTO workspace_members (user_id, project_id) VALUES (?, ?)", userID, workspaceID)

	var ws models.Workspace
	err = h.db.QueryRow(`
		SELECT id, key, name, description, created_at, updated_at
		FROM projects WHERE id = ?
	`, workspaceID).Scan(&ws.ID, &ws.Key, &ws.Name, &ws.Description, &ws.CreatedAt, &ws.UpdatedAt)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to fetch created workspace")
		return
	}

	writeJSON(w, http.StatusCreated, ws)
}

// ListWorkspaceMembers handles GET /api/workspaces/{id}/members
func (h *Handlers) ListWorkspaceMembers(w http.ResponseWriter, r *http.Request) {
	userID, _, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Not authenticated")
		return
	}

	workspaceID, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_id", "Invalid workspace ID")
		return
	}

	if !h.userHasWorkspaceAccess(userID, workspaceID) {
		writeError(w, http.StatusForbidden, "forbidden", "You do not have access to this workspace")
		return
	}

	rows, err := h.db.Query(`
		SELECT u.id, u.username, u.email, u.full_name, u.avatar_url, u.language, u.is_admin, u.created_at, u.updated_at
		FROM workspace_members wm
		JOIN users u ON wm.user_id = u.id
		WHERE wm.project_id = ?
		ORDER BY u.username
	`, workspaceID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to fetch members")
		return
	}
	defer rows.Close()

	members := []models.User{}
	for rows.Next() {
		var user models.User
		if err := rows.Scan(
			&user.ID, &user.Username, &user.Email, &user.FullName,
			&user.AvatarURL, &user.Language, &user.IsAdmin, &user.CreatedAt, &user.UpdatedAt,
		); err != nil {
			continue
		}
		members = append(members, user)
	}

	writeJSON(w, http.StatusOK, members)
}

// SetWorkspaceMembers handles PUT /api/workspaces/{id}/members
func (h *Handlers) SetWorkspaceMembers(w http.ResponseWriter, r *http.Request) {
	userID, _, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Not authenticated")
		return
	}
	if !h.userIsAdmin(userID) {
		writeError(w, http.StatusForbidden, "forbidden", "Only admins can manage workspace members")
		return
	}

	workspaceID, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_id", "Invalid workspace ID")
		return
	}

	var req models.SetWorkspaceMembersRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", "Invalid request body")
		return
	}

	var exists int
	if err := h.db.QueryRow("SELECT 1 FROM projects WHERE id = ?", workspaceID).Scan(&exists); err != nil {
		writeError(w, http.StatusNotFound, "workspace_not_found", "Workspace not found")
		return
	}

	tx, err := h.db.Begin()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to update members")
		return
	}
	defer tx.Rollback()

	if _, err := tx.Exec("DELETE FROM workspace_members WHERE project_id = ?", workspaceID); err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to update members")
		return
	}

	for _, memberID := range req.UserIDs {
		if _, err := tx.Exec(`
			INSERT INTO workspace_members (user_id, project_id)
			SELECT id, ? FROM users WHERE id = ? AND is_active = 1
		`, workspaceID, memberID); err != nil {
			writeError(w, http.StatusInternalServerError, "db_error", "Failed to update members")
			return
		}
	}

	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to update members")
		return
	}

	h.ListWorkspaceMembers(w, r)
}

// AddWorkspaceMembers handles POST /api/workspaces/{id}/members
func (h *Handlers) AddWorkspaceMembers(w http.ResponseWriter, r *http.Request) {
	userID, _, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Not authenticated")
		return
	}
	if !h.userIsAdmin(userID) {
		writeError(w, http.StatusForbidden, "forbidden", "Only admins can manage workspace members")
		return
	}

	workspaceID, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_id", "Invalid workspace ID")
		return
	}

	var req models.AddWorkspaceMembersRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", "Invalid request body")
		return
	}

	userIDs := req.UserIDs
	if req.UserID != nil {
		userIDs = append(userIDs, *req.UserID)
	}
	if len(userIDs) == 0 {
		writeError(w, http.StatusBadRequest, "missing_users", "userId or userIds is required")
		return
	}

	var exists int
	if err := h.db.QueryRow("SELECT 1 FROM projects WHERE id = ?", workspaceID).Scan(&exists); err != nil {
		writeError(w, http.StatusNotFound, "workspace_not_found", "Workspace not found")
		return
	}

	for _, memberID := range userIDs {
		if _, err := h.db.Exec(`
			INSERT OR IGNORE INTO workspace_members (user_id, project_id)
			SELECT id, ? FROM users WHERE id = ? AND is_active = 1
		`, workspaceID, memberID); err != nil {
			writeError(w, http.StatusInternalServerError, "db_error", "Failed to add workspace member")
			return
		}
	}

	h.ListWorkspaceMembers(w, r)
}
