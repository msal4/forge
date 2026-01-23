package main

import (
	"log"
	"net/http"
	"os"

	"sarray-forge/internal/auth"
	"sarray-forge/internal/db"
	"sarray-forge/internal/handlers"
	"sarray-forge/internal/middleware"
)

func main() {
	// Initialize configuration
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// Initialize database with migrations
	migrationsDir := os.Getenv("MIGRATIONS_DIR")
	if migrationsDir == "" {
		migrationsDir = "./migrations"
	}

	database, err := db.OpenAndMigrate("./data/sarray-forge.db", migrationsDir)
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer database.Close()

	// Create handler dependencies
	h := handlers.New(database)
	authHandler := auth.NewHandler(database)

	// Create the main router using Go 1.22 http.NewServeMux
	mux := http.NewServeMux()

	// ============================================
	// Public Routes (No Auth Required)
	// ============================================
	mux.HandleFunc("POST /api/auth/login", authHandler.Login)
	mux.HandleFunc("POST /api/auth/logout", authHandler.Logout)
	mux.HandleFunc("GET /api/auth/me", authHandler.GetCurrentUser)
	mux.HandleFunc("POST /api/auth/change-password", authHandler.ChangePassword)
	mux.HandleFunc("GET /api/health", handlers.HealthCheck)

	// ============================================
	// Protected API Routes (With Auth Middleware)
	// ============================================
	requireAuth := middleware.RequireAuth(authHandler)

	// User routes
	mux.Handle("GET /api/users/me", requireAuth(http.HandlerFunc(h.GetCurrentUser)))
	mux.Handle("GET /api/users", requireAuth(http.HandlerFunc(h.ListUsers)))

	// Global search
	mux.Handle("GET /api/search", requireAuth(http.HandlerFunc(h.GlobalSearch)))

	// Issues (The "Tablet") routes
	mux.Handle("GET /api/issues", requireAuth(http.HandlerFunc(h.ListIssues)))
	mux.Handle("POST /api/issues", requireAuth(http.HandlerFunc(h.CreateIssue)))
	mux.Handle("GET /api/issues/{id}", requireAuth(http.HandlerFunc(h.GetIssue)))
	mux.Handle("PUT /api/issues/{id}", requireAuth(http.HandlerFunc(h.UpdateIssue)))
	mux.Handle("PATCH /api/issues/{id}", requireAuth(http.HandlerFunc(h.PatchIssue)))
	mux.Handle("DELETE /api/issues/{id}", requireAuth(http.HandlerFunc(h.DeleteIssue)))
	mux.Handle("PATCH /api/issues/{id}/status", requireAuth(http.HandlerFunc(h.UpdateIssueStatus)))

	// Docs (The "Library") routes
	mux.Handle("GET /api/docs", requireAuth(http.HandlerFunc(h.ListDocs)))
	mux.Handle("POST /api/docs", requireAuth(http.HandlerFunc(h.CreateDoc)))
	mux.Handle("GET /api/docs/{id}", requireAuth(http.HandlerFunc(h.GetDoc)))
	mux.Handle("PUT /api/docs/{id}", requireAuth(http.HandlerFunc(h.UpdateDoc)))
	mux.Handle("DELETE /api/docs/{id}", requireAuth(http.HandlerFunc(h.DeleteDoc)))

	// Releases (The "Granary") routes
	mux.Handle("GET /api/releases", requireAuth(http.HandlerFunc(h.ListReleases)))
	mux.Handle("POST /api/releases", requireAuth(http.HandlerFunc(h.CreateRelease)))
	mux.Handle("GET /api/releases/{id}", requireAuth(http.HandlerFunc(h.GetRelease)))
	mux.Handle("DELETE /api/releases/{id}", requireAuth(http.HandlerFunc(h.DeleteRelease)))
	mux.Handle("GET /api/releases/{id}/download/{filename}", requireAuth(http.HandlerFunc(h.DownloadReleaseFile)))
	mux.Handle("POST /api/releases/{id}/files", requireAuth(http.HandlerFunc(h.UploadReleaseFile)))

	// ============================================
	// Static File Serving (React SPA)
	// ============================================
	staticDir := os.Getenv("STATIC_DIR")
	if staticDir == "" {
		staticDir = "./web/dist"
	}

	// Check if static directory exists
	if _, err := os.Stat(staticDir); os.IsNotExist(err) {
		// Serve a placeholder during development
		mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "text/html")
			w.Write([]byte(`<!DOCTYPE html>
<html>
<head><title>Sarray Forge</title></head>
<body style="font-family: serif; background: #f5f0e6; color: #1a365d; padding: 2rem;">
<h1>Sarray Forge</h1>
<p>Frontend not built yet. Run <code>cd web && bun install && bun run build</code></p>
<p>API is running at <a href="/api/health">/api/health</a></p>
</body>
</html>`))
		})
	} else {
		// Serve static files with SPA routing
		fileServer := http.FileServer(http.Dir(staticDir))
		mux.Handle("/", middleware.SPAHandler(fileServer))
	}

	// ============================================
	// Apply Global Middleware Stack
	// Order: RequestID -> Recovery -> CORS -> Logger -> Handler
	// (Chain applies in reverse, so list outermost first)
	// ============================================
	handler := middleware.Chain(
		mux,
		middleware.RequestID,
		middleware.Recovery,
		middleware.CORS,
		middleware.Logger,
	)

	// Start server
	log.Printf("Sarray Forge starting on http://localhost:%s", port)
	log.Printf("The ancient tablets await your commands...")
	if err := http.ListenAndServe(":"+port, handler); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
