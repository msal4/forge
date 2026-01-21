package auth

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"sarray-forge/internal/db"
	"sarray-forge/internal/models"
)

const (
	// Domain is the company email domain - all users belong to this domain
	Domain = "sarray.de"

	// SessionDuration is how long a session token is valid
	SessionDuration = 7 * 24 * time.Hour // 7 days

	// CookieName is the name of the session cookie
	CookieName = "sarray_session"
)

// Handler handles authentication operations
type Handler struct {
	db *db.DB
}

// NewHandler creates a new auth handler
func NewHandler(database *db.DB) *Handler {
	return &Handler{db: database}
}

// Login handles the POST /api/auth/login endpoint
// Smart Login Logic: If user enters "zahra", it automatically becomes "zahra@sarray.de"
func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req models.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "Invalid JSON body")
		return
	}

	// Validate required fields
	if req.Username == "" {
		writeError(w, http.StatusBadRequest, "missing_username", "Username is required")
		return
	}
	if req.Password == "" {
		writeError(w, http.StatusBadRequest, "missing_password", "Password is required")
		return
	}

	// ============================================
	// SMART LOGIN LOGIC
	// ============================================
	// Normalize the username: strip whitespace and convert to lowercase
	username := strings.TrimSpace(strings.ToLower(req.Username))

	// If user provided email, extract the username part
	// Otherwise, use the username as-is
	if strings.Contains(username, "@") {
		parts := strings.Split(username, "@")
		username = parts[0]
		// Optionally validate domain
		if len(parts) > 1 && parts[1] != Domain {
			writeError(w, http.StatusUnauthorized, "invalid_domain",
				fmt.Sprintf("Only @%s email addresses are allowed", Domain))
			return
		}
	}

	// Construct the full email (smart auto-append)
	email := fmt.Sprintf("%s@%s", username, Domain)

	// ============================================
	// Authenticate User
	// ============================================
	user, err := h.authenticateUser(username, email, req.Password)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "auth_failed", "Invalid username or password")
		return
	}

	// Create session token
	token, err := h.createSession(user.ID, user.Email)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "session_error", "Failed to create session")
		return
	}

	// Set session cookie
	http.SetCookie(w, &http.Cookie{
		Name:     CookieName,
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		Secure:   r.TLS != nil, // Secure only over HTTPS
		SameSite: http.SameSiteLaxMode,
		MaxAge:   int(SessionDuration.Seconds()),
	})

	// Return success response
	writeJSON(w, http.StatusOK, models.LoginResponse{
		Token: token,
		User:  *user,
	})
}

// Logout handles the POST /api/auth/logout endpoint
func (h *Handler) Logout(w http.ResponseWriter, r *http.Request) {
	// Get token from cookie or header
	token := ""
	if cookie, err := r.Cookie(CookieName); err == nil {
		token = cookie.Value
	}

	// Delete session from database if token exists
	if token != "" {
		_, _ = h.db.Exec("DELETE FROM sessions WHERE token = ?", token)
	}

	// Clear the cookie
	http.SetCookie(w, &http.Cookie{
		Name:     CookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		MaxAge:   -1, // Delete cookie
	})

	writeJSON(w, http.StatusOK, map[string]string{
		"message": "Logged out successfully",
	})
}

// ValidateSession checks if a session token is valid and returns the session
func (h *Handler) ValidateSession(token string) (*models.Session, error) {
	var session models.Session
	var email string

	err := h.db.QueryRow(`
		SELECT s.id, s.user_id, s.token, s.expires_at, s.created_at, u.email
		FROM sessions s
		JOIN users u ON s.user_id = u.id
		WHERE s.token = ? AND s.expires_at > datetime('now')
	`, token).Scan(
		&session.ID,
		&session.UserID,
		&session.Token,
		&session.ExpiresAt,
		&session.CreatedAt,
		&email,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("session not found or expired")
		}
		return nil, fmt.Errorf("database error: %w", err)
	}

	session.Email = email
	return &session, nil
}

// GetUserByID retrieves a user by their ID
func (h *Handler) GetUserByID(userID int64) (*models.User, error) {
	var user models.User
	err := h.db.QueryRow(`
		SELECT id, username, email, full_name, avatar_url, created_at, updated_at
		FROM users WHERE id = ?
	`, userID).Scan(
		&user.ID,
		&user.Username,
		&user.Email,
		&user.FullName,
		&user.AvatarURL,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if err != nil {
		return nil, err
	}

	return &user, nil
}

// ============================================
// Private Methods
// ============================================

// authenticateUser verifies the user credentials
func (h *Handler) authenticateUser(username, email, password string) (*models.User, error) {
	var user models.User
	var passwordHash string

	err := h.db.QueryRow(`
		SELECT id, username, email, password_hash, full_name, avatar_url, created_at, updated_at
		FROM users WHERE username = ? OR email = ?
	`, username, email).Scan(
		&user.ID,
		&user.Username,
		&user.Email,
		&passwordHash,
		&user.FullName,
		&user.AvatarURL,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("user not found: %w", err)
	}

	// Verify password
	// In production, use bcrypt.CompareHashAndPassword
	// For demo, we use a simple comparison
	if !verifyPassword(password, passwordHash) {
		return nil, fmt.Errorf("invalid password")
	}

	return &user, nil
}

// createSession generates a new session token and stores it
func (h *Handler) createSession(userID int64, email string) (string, error) {
	// Generate random token
	token, err := generateToken(32)
	if err != nil {
		return "", fmt.Errorf("failed to generate token: %w", err)
	}

	expiresAt := time.Now().Add(SessionDuration)

	// Store session
	_, err = h.db.Exec(`
		INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)
	`, userID, token, expiresAt)

	if err != nil {
		return "", fmt.Errorf("failed to store session: %w", err)
	}

	// Clean up old sessions for this user (keep last 5)
	_, _ = h.db.Exec(`
		DELETE FROM sessions 
		WHERE user_id = ? AND id NOT IN (
			SELECT id FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 5
		)
	`, userID, userID)

	return token, nil
}

// generateToken creates a cryptographically secure random token
func generateToken(length int) (string, error) {
	bytes := make([]byte, length)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

// verifyPassword compares a password with its hash
// In production, use bcrypt.CompareHashAndPassword
func verifyPassword(password, hash string) bool {
	// Demo mode: accept "forge" as password for all users
	if hash == "$demo$forge" && password == "forge" {
		return true
	}
	// In production, use proper bcrypt comparison
	return false
}

// ============================================
// Helper Functions
// ============================================

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, errorCode, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(models.ErrorResponse{
		Error:   errorCode,
		Message: message,
	})
}
