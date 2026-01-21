package middleware

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"sarray-forge/internal/auth"
)

// ============================================
// RequireAuth Middleware
// Standard http.Handler wrapper for auth protection
// ============================================

// RequireAuth creates an authentication middleware using the provided auth handler.
// It validates the session token and adds user info to the request context.
// Usage:
//
//	mux.Handle("/api/protected", middleware.RequireAuth(authHandler)(myHandler))
func RequireAuth(authHandler *auth.Handler) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Extract token from Authorization header or cookie
			token := extractToken(r)
			if token == "" {
				writeAuthError(w, http.StatusUnauthorized, "unauthorized", "Authentication required")
				return
			}

			// Validate the session token
			session, err := authHandler.ValidateSession(token)
			if err != nil {
				writeAuthError(w, http.StatusUnauthorized, "session_invalid", "Invalid or expired session")
				return
			}

			// Get full user info
			user, err := authHandler.GetUserByID(session.UserID)
			if err != nil {
				writeAuthError(w, http.StatusUnauthorized, "user_not_found", "User not found")
				return
			}

			// Add user info to context
			ctx := r.Context()
			ctx = context.WithValue(ctx, UserIDKey, session.UserID)
			ctx = context.WithValue(ctx, UserEmailKey, session.Email)
			ctx = context.WithValue(ctx, UsernameKey, user.Username)
			ctx = context.WithValue(ctx, SessionKey, session)

			// Continue with the request
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// Auth is an alias for RequireAuth for backward compatibility
var Auth = RequireAuth

// ============================================
// RequireAuthFunc - For use with http.HandlerFunc
// ============================================

// RequireAuthFunc is a convenience wrapper for single handler functions.
// Usage:
//
//	mux.HandleFunc("/api/protected", middleware.RequireAuthFunc(authHandler, myHandlerFunc))
func RequireAuthFunc(authHandler *auth.Handler, handler http.HandlerFunc) http.HandlerFunc {
	return RequireAuth(authHandler)(handler).ServeHTTP
}

// ============================================
// Context Helpers
// ============================================

// GetUserFromContext extracts user information from the request context
func GetUserFromContext(ctx context.Context) (userID int64, email string, ok bool) {
	userID, idOk := ctx.Value(UserIDKey).(int64)
	email, emailOk := ctx.Value(UserEmailKey).(string)
	return userID, email, idOk && emailOk
}

// GetUserID extracts just the user ID from context
func GetUserID(ctx context.Context) (int64, bool) {
	userID, ok := ctx.Value(UserIDKey).(int64)
	return userID, ok
}

// GetUsername extracts the username from context
func GetUsername(ctx context.Context) (string, bool) {
	username, ok := ctx.Value(UsernameKey).(string)
	return username, ok
}

// GetUserEmail extracts the email from context
func GetUserEmail(ctx context.Context) (string, bool) {
	email, ok := ctx.Value(UserEmailKey).(string)
	return email, ok
}

// MustGetUserID extracts user ID or panics - use only when auth middleware is guaranteed
func MustGetUserID(ctx context.Context) int64 {
	userID, ok := ctx.Value(UserIDKey).(int64)
	if !ok {
		panic("MustGetUserID called without auth middleware")
	}
	return userID
}

// ============================================
// Token Extraction
// ============================================

// extractToken gets the authentication token from the request
// Priority: Authorization header > Cookie
func extractToken(r *http.Request) string {
	// Check Authorization header first (Bearer token)
	authHeader := r.Header.Get("Authorization")
	if authHeader != "" {
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) == 2 && strings.EqualFold(parts[0], "bearer") {
			return strings.TrimSpace(parts[1])
		}
	}

	// Check for session cookie
	if cookie, err := r.Cookie(auth.CookieName); err == nil && cookie.Value != "" {
		return cookie.Value
	}

	return ""
}

// ============================================
// Helper Functions
// ============================================

func writeAuthError(w http.ResponseWriter, status int, code, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]string{
		"error":   code,
		"message": message,
	})
}
