package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"strings"
)

const (
	APITokenPrefix = "forge_"
	tokenPrefixLen = 8
)

// HashAPIToken returns the SHA-256 hex hash of a token secret.
func HashAPIToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

// GenerateAPIToken creates a new forge_ API token and its display prefix.
func GenerateAPIToken() (secret, displayPrefix string, err error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", "", fmt.Errorf("failed to generate token: %w", err)
	}
	secret = APITokenPrefix + base64.RawURLEncoding.EncodeToString(bytes)
	if len(secret) < tokenPrefixLen {
		displayPrefix = secret
	} else {
		displayPrefix = secret[:tokenPrefixLen]
	}
	return secret, displayPrefix, nil
}

// IsAPIToken returns true if the credential looks like a personal API token.
func IsAPIToken(token string) bool {
	return strings.HasPrefix(token, APITokenPrefix)
}

// ValidateAPIToken checks an API token and returns the owning user ID.
func (h *Handler) ValidateAPIToken(token string) (int64, error) {
	if !IsAPIToken(token) {
		return 0, fmt.Errorf("not an API token")
	}

	hash := HashAPIToken(token)
	var tokenID, userID int64
	var isActive bool

	err := h.db.QueryRow(`
		SELECT t.id, t.user_id, u.is_active
		FROM api_tokens t
		JOIN users u ON t.user_id = u.id
		WHERE t.token_hash = ? AND t.revoked_at IS NULL
	`, hash).Scan(&tokenID, &userID, &isActive)

	if err != nil {
		if err == sql.ErrNoRows {
			return 0, fmt.Errorf("invalid or revoked API token")
		}
		return 0, fmt.Errorf("database error: %w", err)
	}

	if !isActive {
		return 0, fmt.Errorf("user account is deactivated")
	}

	_, _ = h.db.Exec(`
		UPDATE api_tokens SET last_used_at = CURRENT_TIMESTAMP WHERE id = ? AND (
			last_used_at IS NULL OR last_used_at < datetime('now', '-1 minute')
		)
	`, tokenID)

	return userID, nil
}

// ResolveUserIDFromToken validates session or API token credentials.
func (h *Handler) ResolveUserIDFromToken(token string) (int64, error) {
	if token == "" {
		return 0, fmt.Errorf("missing token")
	}
	if IsAPIToken(token) {
		return h.ValidateAPIToken(token)
	}
	return h.ValidateSessionAndGetUserID(token)
}
