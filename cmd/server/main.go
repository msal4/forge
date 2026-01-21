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
	mux.HandleFunc("GET /api/health", handlers.HealthCheck)

	// ============================================
	// Protected API Routes
	// ============================================
	// We'll create a sub-mux for protected routes
	protectedMux := http.NewServeMux()

	// User routes
	protectedMux.HandleFunc("GET /api/users/me", h.GetCurrentUser)
	protectedMux.HandleFunc("GET /api/users", h.ListUsers)

	// Issues (The "Tablet") routes
	protectedMux.HandleFunc("GET /api/issues", h.ListIssues)
	protectedMux.HandleFunc("POST /api/issues", h.CreateIssue)
	protectedMux.HandleFunc("GET /api/issues/{id}", h.GetIssue)
	protectedMux.HandleFunc("PUT /api/issues/{id}", h.UpdateIssue)
	protectedMux.HandleFunc("DELETE /api/issues/{id}", h.DeleteIssue)
	protectedMux.HandleFunc("PATCH /api/issues/{id}/status", h.UpdateIssueStatus)

	// Docs (The "Library") routes
	protectedMux.HandleFunc("GET /api/docs", h.ListDocs)
	protectedMux.HandleFunc("POST /api/docs", h.CreateDoc)
	protectedMux.HandleFunc("GET /api/docs/{id}", h.GetDoc)
	protectedMux.HandleFunc("PUT /api/docs/{id}", h.UpdateDoc)
	protectedMux.HandleFunc("DELETE /api/docs/{id}", h.DeleteDoc)

	// Releases (The "Granary") routes
	protectedMux.HandleFunc("GET /api/releases", h.ListReleases)
	protectedMux.HandleFunc("POST /api/releases", h.CreateRelease)
	protectedMux.HandleFunc("GET /api/releases/{id}", h.GetRelease)
	protectedMux.HandleFunc("DELETE /api/releases/{id}", h.DeleteRelease)
	protectedMux.HandleFunc("GET /api/releases/{id}/download/{filename}", h.DownloadReleaseFile)
	protectedMux.HandleFunc("POST /api/releases/{id}/files", h.UploadReleaseFile)

	// Mount protected routes with auth middleware
	mux.Handle("/api/", middleware.Auth(authHandler)(protectedMux))

	// ============================================
	// Static File Serving (React SPA)
	// ============================================
	// In development, serve from web/dist directory
	// In production, this would be embedded or served from a CDN
	staticDir := os.Getenv("STATIC_DIR")
	if staticDir == "" {
		staticDir = "./web/dist"
	}

	// Check if static directory exists, otherwise serve a simple HTML page
	if _, err := os.Stat(staticDir); os.IsNotExist(err) {
		// Serve a placeholder during development before frontend is built
		mux.HandleFunc("GET /", func(w http.ResponseWriter, r *http.Request) {
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
	// ============================================
	handler := middleware.Chain(
		mux,
		middleware.Logger,
		middleware.CORS,
		middleware.Recovery,
		middleware.RequestID,
	)

	// Start server
	log.Printf("Sarray Forge starting on http://localhost:%s", port)
	log.Printf("The ancient tablets await your commands...")
	if err := http.ListenAndServe(":"+port, handler); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
