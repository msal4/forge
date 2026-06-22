package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"sarray-forge/internal/auth"
	"sarray-forge/internal/middleware"
	"sarray-forge/internal/models"
)

func requireSessionCredential(w http.ResponseWriter, r *http.Request) bool {
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		return true // cookie session
	}
	parts := strings.SplitN(authHeader, " ", 2)
	if len(parts) == 2 && strings.EqualFold(parts[0], "bearer") {
		if auth.IsAPIToken(strings.TrimSpace(parts[1])) {
			writeError(w, http.StatusForbidden, "forbidden", "Manage API keys using a browser session")
			return false
		}
	}
	return true
}

func scanAPIToken(row interface{ Scan(...any) error }, includeRevoked bool) (models.APIToken, error) {
	var token models.APIToken
	var lastUsed sql.NullTime
	var revoked sql.NullTime
	err := row.Scan(&token.ID, &token.Name, &token.TokenPrefix, &lastUsed, &token.CreatedAt, &revoked)
	if err != nil {
		return token, err
	}
	if lastUsed.Valid {
		token.LastUsedAt = &lastUsed.Time
	}
	if includeRevoked && revoked.Valid {
		token.RevokedAt = &revoked.Time
	}
	return token, nil
}

// ListAPITokens handles GET /api/users/me/tokens
func (h *Handlers) ListAPITokens(w http.ResponseWriter, r *http.Request) {
	if !requireSessionCredential(w, r) {
		return
	}

	userID, _, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Not authenticated")
		return
	}

	rows, err := h.db.Query(`
		SELECT id, name, token_prefix, last_used_at, created_at, revoked_at
		FROM api_tokens
		WHERE user_id = ? AND revoked_at IS NULL
		ORDER BY created_at DESC
	`, userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to list API keys")
		return
	}
	defer rows.Close()

	tokens := []models.APIToken{}
	for rows.Next() {
		token, err := scanAPIToken(rows, false)
		if err != nil {
		 continue
		}
		tokens = append(tokens, token)
	}

	writeJSON(w, http.StatusOK,(tokens))
}

// CreateAPIToken handles POST /api/users/me/tokens
func (h *Handlers) CreateAPIToken(w http.ResponseWriter, r *http.Request) {
	if !requireSessionCredential(w, r) {
		return
	}

	userID, _, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Not authenticated")
		return
	}

	var req models.CreateAPITokenRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", "Invalid request body")
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		writeError(w, http.StatusBadRequest, "missing_name", "Name is required")
		return
	}
	if len(req.Name) > 64 {
		writeError(w, http.StatusBadRequest, "name_too_long", "Name must be 64 characters or less")
		return
	}

	secret, prefix, err := auth.GenerateAPIToken()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "token_error", "Failed to generate API key")
		return
	}

	hash := auth.HashAPIToken(secret)
	result, err := h.db.Exec(`
		INSERT INTO api_tokens (user_id, name, token_prefix, token_hash)
		VALUES (?, ?, ?, ?)
	`, userID, req.Name, prefix, hash)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to create API key")
		return
	}

	tokenID, _ := result.LastInsertId()
	var createdAt time.Time
	err = h.db.QueryRow(`
		SELECT created_at FROM api_tokens WHERE id = ? AND user_id = ? 
	`, tokenID, userID).Scan(&createdAt)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to fetch created API key")
		return
	}

	writeJSON(w, http.StatusCreated, models.CreateAPITokenResponse{
		Token: models.APIToken{
			ID:          tokenID,
			Name:        req.Name,
			TokenPrefix: prefix,
			CreatedAt:   createdAt,
		},
		Secret: secret,
	})
}

// RevokeAPIToken handles DELETE /api/users/me/tokens/{id}
func (h *Handlers) RevokeAPIToken(w http.ResponseWriter, r *http.Request) {
	if !requireSessionCredential(w, r) {
		return
	}

	userID, _, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Not authenticated")
		return
	}

	tokenID, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_id", "Invalid token ID")
		return
	}

	result, err := h.db.Exec(`
		UPDATE api_tokens SET revoked_at = CURRENT_TIMESTAMP
		WHERE id = ? AND user_id = ? AND revoked_at IS NULL
	`, tokenID, userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to revoke API key")
		return
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		writeError(w, http.StatusNotFound, "not_found", "API key not found")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "API key revoked"})
}
