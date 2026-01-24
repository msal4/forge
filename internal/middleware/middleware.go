package middleware

import (
	"bufio"
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"runtime/debug"
	"time"
)

// ContextKey is a custom type for context keys to avoid collisions
type ContextKey string

const (
	RequestIDKey ContextKey = "requestID"
	UserIDKey    ContextKey = "userID"
	UserEmailKey ContextKey = "userEmail"
	UsernameKey  ContextKey = "username"
	SessionKey   ContextKey = "session"
)

// Middleware represents a function that wraps an http.Handler
type Middleware func(http.Handler) http.Handler

// Chain applies middlewares in reverse order so the first middleware
// in the list is the outermost (first to execute)
func Chain(h http.Handler, middlewares ...Middleware) http.Handler {
	for i := len(middlewares) - 1; i >= 0; i-- {
		h = middlewares[i](h)
	}
	return h
}

// Logger logs incoming HTTP requests with timing information
func Logger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()

		// Wrap response writer to capture status code
		wrapped := &responseWriter{ResponseWriter: w, statusCode: http.StatusOK}

		next.ServeHTTP(wrapped, r)

		duration := time.Since(start)
		reqID := r.Context().Value(RequestIDKey)

		log.Printf("[%s] %s %s %d %v",
			reqID,
			r.Method,
			r.URL.Path,
			wrapped.statusCode,
			duration,
		)
	})
}

// responseWriter wraps http.ResponseWriter to capture the status code
type responseWriter struct {
	http.ResponseWriter
	statusCode int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

// Hijack implements http.Hijacker - required for WebSocket upgrades
func (rw *responseWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	if h, ok := rw.ResponseWriter.(http.Hijacker); ok {
		return h.Hijack()
	}
	return nil, nil, fmt.Errorf("hijacking not supported")
}

// Flush implements http.Flusher
func (rw *responseWriter) Flush() {
	if f, ok := rw.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

// CORS adds Cross-Origin Resource Sharing headers
func CORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")

		// Allow specific origins in development (for WebSocket from different port)
		// In production, you'd want to restrict this to your actual domain
		if origin != "" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Credentials", "true")
		} else {
			w.Header().Set("Access-Control-Allow-Origin", "*")
		}

		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Request-ID")
		w.Header().Set("Access-Control-Max-Age", "86400")

		// Handle preflight requests
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// Recovery recovers from panics and returns a 500 error
func Recovery(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if err := recover(); err != nil {
				log.Printf("PANIC recovered: %v\n%s", err, debug.Stack())
				http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			}
		}()
		next.ServeHTTP(w, r)
	})
}

// RequestID adds a unique request ID to each request context
func RequestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Check if request ID already exists in header
		reqID := r.Header.Get("X-Request-ID")
		if reqID == "" {
			reqID = generateRequestID()
		}

		// Add to response header
		w.Header().Set("X-Request-ID", reqID)

		// Add to context
		ctx := context.WithValue(r.Context(), RequestIDKey, reqID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// generateRequestID creates a short unique ID for requests
func generateRequestID() string {
	bytes := make([]byte, 4)
	rand.Read(bytes)
	return hex.EncodeToString(bytes)
}

// SPAHandler wraps a file server to serve index.html for SPA routes
func SPAHandler(staticDir string) http.Handler {
	fs := http.FileServer(http.Dir(staticDir))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// If this is an API route, let it 404 (shouldn't reach here normally)
		if len(r.URL.Path) >= 4 && r.URL.Path[:4] == "/api" {
			http.NotFound(w, r)
			return
		}

		// Check if the requested file exists
		path := staticDir + r.URL.Path
		if r.URL.Path == "/" {
			fs.ServeHTTP(w, r)
			return
		}

		// Try to stat the file
		if _, err := os.Stat(path); os.IsNotExist(err) {
			// File doesn't exist - serve index.html for SPA routing
			r.URL.Path = "/"
		}

		fs.ServeHTTP(w, r)
	})
}
