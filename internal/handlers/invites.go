package handlers

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"sarray-forge/internal/auth"
	"sarray-forge/internal/middleware"
	"sarray-forge/internal/models"
)

const inviteTokenBytes = 32

var usernamePattern = regexp.MustCompile(`^[a-z][a-z0-9_-]{1,31}$`)

// CreateInvite handles POST /api/invites
func (h *Handlers) CreateInvite(w http.ResponseWriter, r *http.Request) {
	userID, _, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Not authenticated")
		return
	}
	if !h.userIsAdmin(userID) {
		writeError(w, http.StatusForbidden, "forbidden", "Only admins can create invites")
		return
	}

	var req models.CreateInviteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", "Invalid request body")
		return
	}

	username := auth.NormalizeUsername(strings.TrimSpace(req.Username))
	if username == "" || !usernamePattern.MatchString(username) {
		writeError(w, http.StatusBadRequest, "invalid_username", "Username must be 2-32 chars: lowercase letters, numbers, underscore, hyphen")
		return
	}

	email := strings.TrimSpace(strings.ToLower(req.Email))
	if email == "" {
		email = fmt.Sprintf("%s@%s", username, auth.Domain)
	}
	if !strings.HasSuffix(email, "@"+auth.Domain) {
		writeError(w, http.StatusBadRequest, "invalid_email", fmt.Sprintf("Email must use @%s domain", auth.Domain))
		return
	}

	if len(req.WorkspaceKeys) == 0 {
		writeError(w, http.StatusBadRequest, "missing_workspaces", "At least one workspace key is required")
		return
	}

	var existing int
	if err := h.db.QueryRow(`
		SELECT COUNT(*) FROM users
		WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE
	`, username, email).Scan(&existing); err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to validate user")
		return
	}
	if existing > 0 {
		writeError(w, http.StatusConflict, "user_exists", "A user with this username or email already exists")
		return
	}

	workspaceIDs, workspaces, err := h.resolveWorkspaceKeys(req.WorkspaceKeys)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_workspace", err.Error())
		return
	}

	expiresInDays := 2
	if req.ExpiresInDays != nil {
		if *req.ExpiresInDays != 1 && *req.ExpiresInDays != 2 {
			writeError(w, http.StatusBadRequest, "invalid_expiry", "expiresInDays must be 1 or 2")
			return
		}
		expiresInDays = *req.ExpiresInDays
	}

	token, err := generateInviteToken()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "token_error", "Failed to generate invite token")
		return
	}

	workspaceIDsJSON, _ := json.Marshal(workspaceIDs)
	expiresAt := time.Now().UTC().Add(time.Duration(expiresInDays) * 24 * time.Hour)
	fullName := strings.TrimSpace(req.FullName)
	if fullName == "" {
		fullName = username
	}

	result, err := h.db.Exec(`
		INSERT INTO user_invites (token, username, email, full_name, workspace_ids, created_by, expires_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, token, username, email, fullName, string(workspaceIDsJSON), userID, expiresAt.UTC().Format("2006-01-02 15:04:05"))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to create invite")
		return
	}

	inviteID, _ := result.LastInsertId()
	inviteURL := h.inviteURL(r, token)

	writeJSON(w, http.StatusCreated, models.CreateInviteResponse{
		UserInvite: models.UserInvite{
			ID:         inviteID,
			Username:   username,
			FullName:   fullName,
			Email:      email,
			Workspaces: workspaces,
			InviteURL:  inviteURL,
			ExpiresAt:  expiresAt,
			CreatedAt:  time.Now().UTC(),
		},
	})
}

func (h *Handlers) ListInvites(w http.ResponseWriter, r *http.Request) {
	userID, _, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Not authenticated")
		return
	}
	if !h.userIsAdmin(userID) {
		writeError(w, http.StatusForbidden, "forbidden", "Only admins can list invites")
		return
	}

	rows, err := h.db.Query(`
		SELECT id, token, username, email, full_name, workspace_ids, expires_at, created_at
		FROM user_invites
		WHERE used_at IS NULL AND expires_at > datetime('now')
		ORDER BY created_at DESC
	`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to list invites")
		return
	}
	defer rows.Close()

	invites := []models.UserInvite{}
	for rows.Next() {
		var invite models.UserInvite
		var token, workspaceIDsJSON string
		var expiresAt, createdAt string
		if err := rows.Scan(
			&invite.ID, &token, &invite.Username, &invite.Email, &invite.FullName,
			&workspaceIDsJSON, &expiresAt, &createdAt,
		); err != nil {
			continue
		}
		invite.ExpiresAt = parseSQLiteTime(expiresAt)
		invite.CreatedAt = parseSQLiteTime(createdAt)
		invite.Workspaces, _ = h.workspacesFromIDsJSON(workspaceIDsJSON)
		invite.InviteURL = h.inviteURL(r, token)
		invites = append(invites, invite)
	}

	writeJSON(w, http.StatusOK, invites)
}

// RevokeInvite handles DELETE /api/invites/{id}
func (h *Handlers) RevokeInvite(w http.ResponseWriter, r *http.Request) {
	userID, _, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Not authenticated")
		return
	}
	if !h.userIsAdmin(userID) {
		writeError(w, http.StatusForbidden, "forbidden", "Only admins can revoke invites")
		return
	}

	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_id", "Invalid invite ID")
		return
	}

	result, err := h.db.Exec(`
		DELETE FROM user_invites WHERE id = ? AND used_at IS NULL
	`, id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to revoke invite")
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		writeError(w, http.StatusNotFound, "not_found", "Invite not found or already used")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "Invite revoked"})
}

// GetInvitePreview handles GET /api/invites/{token}
func (h *Handlers) GetInvitePreview(w http.ResponseWriter, r *http.Request) {
	token := strings.TrimSpace(r.PathValue("token"))
	if token == "" {
		writeError(w, http.StatusNotFound, "not_found", "Invite not found")
		return
	}

	preview, statusCode, err := h.loadInvitePreview(token)
	if err != nil {
		writeError(w, statusCode, "invite_invalid", err.Error())
		return
	}

	writeJSON(w, http.StatusOK, preview)
}

// AcceptInvite handles POST /api/invites/{token}/accept
func (h *Handlers) AcceptInvite(w http.ResponseWriter, r *http.Request) {
	if h.authHandler == nil {
		writeError(w, http.StatusInternalServerError, "server_error", "Auth handler not configured")
		return
	}

	token := strings.TrimSpace(r.PathValue("token"))
	if token == "" {
		writeError(w, http.StatusNotFound, "not_found", "Invite not found")
		return
	}

	var req models.AcceptInviteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", "Invalid request body")
		return
	}
	if len(req.Password) < 6 {
		writeError(w, http.StatusBadRequest, "weak_password", "Password must be at least 6 characters")
		return
	}

	var (
		inviteID      int64
		username      string
		email         string
		fullName      string
		workspaceJSON string
		expiresAtRaw  string
		usedAt        sql.NullString
	)
	err := h.db.QueryRow(`
		SELECT id, username, email, full_name, workspace_ids, expires_at, used_at
		FROM user_invites WHERE token = ?
	`, token).Scan(&inviteID, &username, &email, &fullName, &workspaceJSON, &expiresAtRaw, &usedAt)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "not_found", "Invite not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to load invite")
		return
	}
	if usedAt.Valid {
		writeError(w, http.StatusGone, "invite_used", "This invite has already been used")
		return
	}
	expiresAt := parseSQLiteTime(expiresAtRaw)
	if time.Now().UTC().After(expiresAt) {
		writeError(w, http.StatusGone, "invite_expired", "This invite has expired")
		return
	}

	var existing int
	if err := h.db.QueryRow(`
		SELECT COUNT(*) FROM users
		WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE
	`, username, email).Scan(&existing); err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to validate user")
		return
	}
	if existing > 0 {
		writeError(w, http.StatusConflict, "user_exists", "A user with this username or email already exists")
		return
	}

	if strings.TrimSpace(fullName) == "" {
		fullName = username
	}

	passwordHash, err := auth.HashPassword(req.Password)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "hash_error", "Failed to hash password")
		return
	}

	var workspaceIDs []int64
	if err := json.Unmarshal([]byte(workspaceJSON), &workspaceIDs); err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Invalid invite workspace data")
		return
	}

	tx, err := h.db.Begin()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to accept invite")
		return
	}
	defer tx.Rollback()

	result, err := tx.Exec(`
		INSERT INTO users (username, email, password_hash, full_name, is_active)
		VALUES (?, ?, ?, ?, 1)
	`, username, email, passwordHash, fullName)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to create user")
		return
	}

	newUserID, _ := result.LastInsertId()
	for _, workspaceID := range workspaceIDs {
		if _, err := tx.Exec(`
			INSERT OR IGNORE INTO workspace_members (user_id, project_id)
			VALUES (?, ?)
		`, newUserID, workspaceID); err != nil {
			writeError(w, http.StatusInternalServerError, "db_error", "Failed to add workspace membership")
			return
		}
	}

	if _, err := tx.Exec(`
		UPDATE user_invites SET used_at = datetime('now') WHERE id = ? AND used_at IS NULL
	`, inviteID); err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to mark invite as used")
		return
	}

	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to accept invite")
		return
	}

	sessionToken, err := h.authHandler.EstablishSession(w, r, newUserID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "session_error", "Account created but failed to create session")
		return
	}

	user, err := h.authHandler.GetUserByID(newUserID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "user_error", "Account created but failed to load user")
		return
	}

	writeJSON(w, http.StatusOK, models.LoginResponse{
		Token: sessionToken,
		User:  *user,
	})
}

func (h *Handlers) loadInvitePreview(token string) (*models.InvitePreview, int, error) {
	var (
		username      string
		email         string
		fullName      string
		workspaceJSON string
		expiresAtRaw  string
		usedAt        sql.NullString
	)
	err := h.db.QueryRow(`
		SELECT username, email, full_name, workspace_ids, expires_at, used_at
		FROM user_invites WHERE token = ?
	`, token).Scan(&username, &email, &fullName, &workspaceJSON, &expiresAtRaw, &usedAt)
	if err == sql.ErrNoRows {
		return nil, http.StatusNotFound, fmt.Errorf("invite not found")
	}
	if err != nil {
		return nil, http.StatusInternalServerError, fmt.Errorf("failed to load invite")
	}

	status := "pending"
	expiresAt := parseSQLiteTime(expiresAtRaw)
	if usedAt.Valid {
		status = "used"
		return &models.InvitePreview{
			Username: username,
			FullName: fullName,
			Email:    email,
			Status:   status,
			ExpiresAt: expiresAt,
		}, http.StatusGone, fmt.Errorf("this invite has already been used")
	}
	if time.Now().UTC().After(expiresAt) {
		status = "expired"
		return &models.InvitePreview{
			Username: username,
			FullName: fullName,
			Email:    email,
			Status:   status,
			ExpiresAt: expiresAt,
		}, http.StatusGone, fmt.Errorf("this invite has expired")
	}

	workspaces, err := h.workspacesFromIDsJSON(workspaceJSON)
	if err != nil {
		return nil, http.StatusInternalServerError, fmt.Errorf("failed to load workspaces")
	}

	return &models.InvitePreview{
		Username:   username,
		FullName:   fullName,
		Email:      email,
		Workspaces: workspaces,
		ExpiresAt:  expiresAt,
		Status:     status,
	}, http.StatusOK, nil
}

func (h *Handlers) resolveWorkspaceKeys(keys []string) ([]int64, []models.InviteWorkspaceSummary, error) {
	workspaceIDs := make([]int64, 0, len(keys))
	workspaces := make([]models.InviteWorkspaceSummary, 0, len(keys))
	seen := map[string]bool{}

	for _, key := range keys {
		normalized := strings.ToUpper(strings.TrimSpace(key))
		if normalized == "" || seen[normalized] {
			continue
		}
		seen[normalized] = true

		var ws models.InviteWorkspaceSummary
		err := h.db.QueryRow(`
			SELECT id, key, name FROM projects WHERE key = ? COLLATE NOCASE
		`, normalized).Scan(&ws.ID, &ws.Key, &ws.Name)
		if err == sql.ErrNoRows {
			return nil, nil, fmt.Errorf("workspace %q not found", normalized)
		}
		if err != nil {
			return nil, nil, fmt.Errorf("failed to resolve workspace %q", normalized)
		}
		workspaceIDs = append(workspaceIDs, ws.ID)
		workspaces = append(workspaces, ws)
	}

	if len(workspaceIDs) == 0 {
		return nil, nil, fmt.Errorf("at least one valid workspace key is required")
	}

	return workspaceIDs, workspaces, nil
}

func (h *Handlers) workspacesFromIDsJSON(workspaceIDsJSON string) ([]models.InviteWorkspaceSummary, error) {
	var workspaceIDs []int64
	if err := json.Unmarshal([]byte(workspaceIDsJSON), &workspaceIDs); err != nil {
		return nil, err
	}

	workspaces := make([]models.InviteWorkspaceSummary, 0, len(workspaceIDs))
	for _, id := range workspaceIDs {
		var ws models.InviteWorkspaceSummary
		err := h.db.QueryRow(`
			SELECT id, key, name FROM projects WHERE id = ?
		`, id).Scan(&ws.ID, &ws.Key, &ws.Name)
		if err != nil {
			continue
		}
		workspaces = append(workspaces, ws)
	}
	return workspaces, nil
}

func (h *Handlers) inviteURL(r *http.Request, token string) string {
	base := h.baseURL
	if base == "" {
		scheme := "http"
		if r.TLS != nil {
			scheme = "https"
		}
		base = fmt.Sprintf("%s://%s", scheme, r.Host)
	}
	return fmt.Sprintf("%s/invite/%s", base, token)
}

func generateInviteToken() (string, error) {
	bytes := make([]byte, inviteTokenBytes)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

func parseSQLiteTime(value string) time.Time {
	if value == "" {
		return time.Time{}
	}
	layouts := []string{
		time.RFC3339,
		"2006-01-02 15:04:05",
		"2006-01-02T15:04:05Z",
	}
	for _, layout := range layouts {
		if parsed, err := time.Parse(layout, value); err == nil {
			return parsed.UTC()
		}
	}
	return time.Time{}
}
