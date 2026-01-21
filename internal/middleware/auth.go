package middleware

import (
	"context"
	"net/http"
	"strings"

	"sarray-forge/internal/auth"
)

// Auth creates an authentication middleware using the provided auth handler
// This is a standard http.Handler wrapper for auth protection
func Auth(authHandler *auth.Handler) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Extract token from Authorization header or cookie
			token := extractToken(r)
			if token == "" {
				http.Error(w, `{"error": "unauthorized", "message": "Authentication required"}`, http.StatusUnauthorized)
				return
			}

			// Validate the session token
			session, err := authHandler.ValidateSession(token)
			if err != nil {
				http.Error(w, `{"error": "unauthorized", "message": "Invalid or expired session"}`, http.StatusUnauthorized)
				return
			}

			// Add user info to context
			ctx := r.Context()
			ctx = context.WithValue(ctx, UserIDKey, session.UserID)
			ctx = context.WithValue(ctx, UserEmailKey, session.Email)

			// Continue with the request
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// extractToken gets the authentication token from the request
// It checks both the Authorization header and a cookie
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
	cookie, err := r.Cookie("sarray_session")
	if err == nil && cookie.Value != "" {
		return cookie.Value
	}

	return ""
}

// GetUserFromContext extracts user information from the request context
func GetUserFromContext(ctx context.Context) (userID int64, email string, ok bool) {
	userID, idOk := ctx.Value(UserIDKey).(int64)
	email, emailOk := ctx.Value(UserEmailKey).(string)
	return userID, email, idOk && emailOk
}
