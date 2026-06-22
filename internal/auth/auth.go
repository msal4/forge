package auth

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"

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

	// BcryptCost is the cost factor for bcrypt hashing
	BcryptCost = 10
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
	// Only accept POST
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method_not_allowed", "Only POST is allowed")
		return
	}

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
	// Normalize input: "zahra" -> "zahra@sarray.de"
	// ============================================
	username := normalizeUsername(req.Username)

	// Validate domain if email was provided
	if strings.Contains(req.Username, "@") {
		parts := strings.Split(strings.ToLower(req.Username), "@")
		if len(parts) == 2 && parts[1] != Domain {
			writeError(w, http.StatusUnauthorized, "invalid_domain",
				fmt.Sprintf("Only @%s accounts are allowed", Domain))
			return
		}
	}

	// Construct the full email
	email := fmt.Sprintf("%s@%s", username, Domain)

	log.Printf("Login attempt: username=%s, email=%s", username, email)

	// ============================================
	// Authenticate User
	// ============================================
	user, err := h.authenticateUser(username, email, req.Password)
	if err != nil {
		log.Printf("Login failed for %s: %v", username, err)
		writeError(w, http.StatusUnauthorized, "auth_failed", "Invalid username or password")
		return
	}

	// Create session token
	token, err := h.createSession(user.ID, r.UserAgent(), getClientIP(r))
	if err != nil {
		log.Printf("Session creation failed for %s: %v", username, err)
		writeError(w, http.StatusInternalServerError, "session_error", "Failed to create session")
		return
	}

	// Set session cookie
	http.SetCookie(w, &http.Cookie{
		Name:     CookieName,
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		Secure:   r.TLS != nil,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   int(SessionDuration.Seconds()),
	})

	log.Printf("Login successful: %s (user_id=%d)", user.Email, user.ID)

	// Return success response
	writeJSON(w, http.StatusOK, models.LoginResponse{
		Token: token,
		User:  *user,
	})
}

// Logout handles the POST /api/auth/logout endpoint
func (h *Handler) Logout(w http.ResponseWriter, r *http.Request) {
	// Get token from cookie or header
	token := extractToken(r)

	// Delete session from database if token exists (skip API keys)
	if token != "" && !IsAPIToken(token) {
		_, _ = h.db.Exec("DELETE FROM sessions WHERE token = ?", token)
	}

	// Clear the cookie
	http.SetCookie(w, &http.Cookie{
		Name:     CookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		MaxAge:   -1,
	})

	writeJSON(w, http.StatusOK, map[string]string{
		"message": "Logged out successfully",
	})
}

// GetCurrentUser handles GET /api/auth/me - returns the authenticated user
func (h *Handler) GetCurrentUser(w http.ResponseWriter, r *http.Request) {
	token := extractToken(r)
	if token == "" {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Not authenticated")
		return
	}

	userID, err := h.ResolveUserIDFromToken(token)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Invalid or expired credentials")
		return
	}

	user, err := h.GetUserByID(userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "user_error", "Failed to get user")
		return
	}

	writeJSON(w, http.StatusOK, user)
}

// ValidateSession checks if a session token is valid and returns the session
func (h *Handler) ValidateSession(token string) (*models.Session, error) {
	var session models.Session
	var email string
	var isActive bool

	err := h.db.QueryRow(`
		SELECT s.id, s.user_id, s.token, s.expires_at, s.created_at, u.email, u.is_active
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
		&isActive,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("session not found or expired")
		}
		return nil, fmt.Errorf("database error: %w", err)
	}

	// Check if user is still active
	if !isActive {
		return nil, fmt.Errorf("user account is deactivated")
	}

	session.Email = email
	return &session, nil
}

// ValidateSessionAndGetUserID validates a session token and returns the user ID
// This is used by WebSocket handler for token-based auth
func (h *Handler) ValidateSessionAndGetUserID(token string) (int64, error) {
	session, err := h.ValidateSession(token)
	if err != nil {
		return 0, err
	}
	return session.UserID, nil
}

// GetUserByID retrieves a user by their ID
func (h *Handler) GetUserByID(userID int64) (*models.User, error) {
	var user models.User
	err := h.db.QueryRow(`
		SELECT id, username, email, full_name, avatar_url, language, is_admin, created_at, updated_at
		FROM users WHERE id = ? AND is_active = 1
	`, userID).Scan(
		&user.ID,
		&user.Username,
		&user.Email,
		&user.FullName,
		&user.AvatarURL,
		&user.Language,
		&user.IsAdmin,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if err != nil {
		return nil, err
	}

	return &user, nil
}

// HashPassword creates a bcrypt hash of a password
func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), BcryptCost)
	return string(bytes), err
}

// ChangePassword handles POST /api/auth/change-password
func (h *Handler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	// Only accept POST
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method_not_allowed", "Only POST is allowed")
		return
	}

	// Get token and validate session
	token := extractToken(r)
	if token == "" {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Not authenticated")
		return
	}

	session, err := h.ValidateSession(token)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Invalid or expired session")
		return
	}

	// Parse request body
	var req models.ChangePasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "Invalid JSON body")
		return
	}

	// Validate required fields
	if req.NewPassword == "" {
		writeError(w, http.StatusBadRequest, "missing_new_password", "New password is required")
		return
	}
	if len(req.NewPassword) < 4 {
		writeError(w, http.StatusBadRequest, "password_too_short", "Password must be at least 4 characters")
		return
	}

	// Hash new password
	newHash, err := HashPassword(req.NewPassword)
	if err != nil {
		log.Printf("Failed to hash new password: %v", err)
		writeError(w, http.StatusInternalServerError, "hash_error", "Failed to update password")
		return
	}

	// Update password in database
	_, err = h.db.Exec(`UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, newHash, session.UserID)
	if err != nil {
		log.Printf("Failed to update password for user %d: %v", session.UserID, err)
		writeError(w, http.StatusInternalServerError, "database_error", "Failed to update password")
		return
	}

	log.Printf("Password changed successfully for user_id=%d", session.UserID)

	writeJSON(w, http.StatusOK, map[string]string{
		"message": "Password changed successfully",
	})
}

// ============================================
// Private Methods
// ============================================

// normalizeUsername extracts and normalizes the username
func normalizeUsername(input string) string {
	// Trim whitespace and convert to lowercase
	input = strings.TrimSpace(strings.ToLower(input))

	// If it's an email, extract just the username part
	if strings.Contains(input, "@") {
		parts := strings.Split(input, "@")
		return parts[0]
	}

	return input
}

// authenticateUser verifies the user credentials
func (h *Handler) authenticateUser(username, email, password string) (*models.User, error) {
	var user models.User
	var passwordHash string
	var isActive bool

	err := h.db.QueryRow(`
		SELECT id, username, email, password_hash, full_name, avatar_url, language, is_admin, is_active, created_at, updated_at
		FROM users 
		WHERE (username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE)
	`, username, email).Scan(
		&user.ID,
		&user.Username,
		&user.Email,
		&passwordHash,
		&user.FullName,
		&user.AvatarURL,
		&user.Language,
		&user.IsAdmin,
		&isActive,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("user not found")
		}
		return nil, fmt.Errorf("database error: %w", err)
	}

	// Check if user is active
	if !isActive {
		return nil, fmt.Errorf("account is deactivated")
	}

	// Verify password using bcrypt
	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(password)); err != nil {
		return nil, fmt.Errorf("invalid password")
	}

	return &user, nil
}

// createSession generates a new session token and stores it
func (h *Handler) createSession(userID int64, userAgent, ipAddress string) (string, error) {
	// Generate random token
	token, err := generateToken(32)
	if err != nil {
		return "", fmt.Errorf("failed to generate token: %w", err)
	}

	expiresAt := time.Now().Add(SessionDuration)

	// Store session with metadata
	_, err = h.db.Exec(`
		INSERT INTO sessions (user_id, token, user_agent, ip_address, expires_at) 
		VALUES (?, ?, ?, ?, ?)
	`, userID, token, userAgent, ipAddress, expiresAt)

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

// extractToken gets the authentication token from the request
func extractToken(r *http.Request) string {
	// Check Authorization header first (Bearer token)
	authHeader := r.Header.Get("Authorization")
	if authHeader != "" {
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) == 2 && strings.ToLower(parts[0]) == "bearer" {
			return parts[1]
		}
	}

	// Check for session cookie
	if cookie, err := r.Cookie(CookieName); err == nil && cookie.Value != "" {
		return cookie.Value
	}

	return ""
}

// getClientIP extracts the client IP address from the request
func getClientIP(r *http.Request) string {
	// Check X-Forwarded-For header (for reverse proxies)
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		return strings.TrimSpace(parts[0])
	}

	// Check X-Real-IP header
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return xri
	}

	// Fall back to RemoteAddr
	ip := r.RemoteAddr
	if colonIdx := strings.LastIndex(ip, ":"); colonIdx != -1 {
		ip = ip[:colonIdx]
	}
	return ip
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
