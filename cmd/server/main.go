package main

import (
	"log"
	"net/http"
	"os"

	"sarray-forge/internal/auth"
	"sarray-forge/internal/config"
	"sarray-forge/internal/db"
	"sarray-forge/internal/handlers"
	"sarray-forge/internal/middleware"
	"sarray-forge/internal/telegram"
	"sarray-forge/internal/websocket"
)

func main() {
	// Load configuration
	cfg := config.Load()

	// Initialize database with migrations
	database, err := db.OpenAndMigrate(cfg.DatabasePath, cfg.MigrationsDir)
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer database.Close()

	// Initialize WebSocket hub
	hub := websocket.NewHub()
	go hub.Run()

	// Initialize Telegram service (optional)
	var tg *telegram.Service
	if cfg.TelegramEnabled() {
		tg = telegram.NewService(cfg.TelegramBotToken, cfg.TelegramBotUsername, cfg.BaseURL, database.DB)
		log.Printf("Telegram notifications enabled (bot: @%s)", cfg.TelegramBotUsername)
		if cfg.BaseURL != "" {
			log.Printf("Telegram notifications will include links to %s", cfg.BaseURL)
		}
	} else {
		log.Printf("Telegram notifications disabled (TELEGRAM_BOT_TOKEN or TELEGRAM_BOT_USERNAME not set)")
	}

	// Create handler dependencies
	h := handlers.New(database, hub)
	h.SetTelegram(tg)

	// Connect telegram to notification service
	if tg != nil {
		h.Notification.SetTelegram(tg)
	}

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
	mux.Handle("PUT /api/users/me/language", requireAuth(http.HandlerFunc(h.UpdateUserLanguage)))
	mux.Handle("GET /api/users", requireAuth(http.HandlerFunc(h.ListUsers)))

	// Global search
	mux.Handle("GET /api/search", requireAuth(http.HandlerFunc(h.GlobalSearch)))

	// WebSocket endpoint for real-time updates
	mux.Handle("GET /api/ws", requireAuth(http.HandlerFunc(h.HandleWebSocket)))

	// Issues (The "Tablet") routes
	mux.Handle("GET /api/issues", requireAuth(http.HandlerFunc(h.ListIssues)))
	mux.Handle("POST /api/issues", requireAuth(http.HandlerFunc(h.CreateIssue)))
	mux.Handle("GET /api/issues/{id}", requireAuth(http.HandlerFunc(h.GetIssue)))
	mux.Handle("PUT /api/issues/{id}", requireAuth(http.HandlerFunc(h.UpdateIssue)))
	mux.Handle("PATCH /api/issues/{id}", requireAuth(http.HandlerFunc(h.PatchIssue)))
	mux.Handle("DELETE /api/issues/{id}", requireAuth(http.HandlerFunc(h.DeleteIssue)))
	mux.Handle("PATCH /api/issues/{id}/status", requireAuth(http.HandlerFunc(h.UpdateIssueStatus)))
	mux.Handle("GET /api/issues/{id}/activity", requireAuth(http.HandlerFunc(h.GetIssueActivity)))
	// Issue comments
	mux.Handle("GET /api/issues/{id}/comments", requireAuth(http.HandlerFunc(h.ListIssueComments)))
	mux.Handle("POST /api/issues/{id}/comments", requireAuth(http.HandlerFunc(h.CreateIssueComment)))
	mux.Handle("DELETE /api/issues/{id}/comments/{commentId}", requireAuth(http.HandlerFunc(h.DeleteIssueComment)))

	// Docs (The "Library") routes
	mux.Handle("GET /api/docs", requireAuth(http.HandlerFunc(h.ListDocs)))
	mux.Handle("POST /api/docs", requireAuth(http.HandlerFunc(h.CreateDoc)))
	mux.Handle("GET /api/docs/{id}", requireAuth(http.HandlerFunc(h.GetDoc)))
	mux.Handle("PUT /api/docs/{id}", requireAuth(http.HandlerFunc(h.UpdateDoc)))
	mux.Handle("DELETE /api/docs/{id}", requireAuth(http.HandlerFunc(h.DeleteDoc)))
	mux.Handle("GET /api/docs/{id}/activity", requireAuth(http.HandlerFunc(h.GetDocActivity)))
	// Doc comments
	mux.Handle("GET /api/docs/{id}/comments", requireAuth(http.HandlerFunc(h.ListDocComments)))
	mux.Handle("POST /api/docs/{id}/comments", requireAuth(http.HandlerFunc(h.CreateDocComment)))
	mux.Handle("DELETE /api/docs/{id}/comments/{commentId}", requireAuth(http.HandlerFunc(h.DeleteDocComment)))

	// Releases (The "Granary") routes
	mux.Handle("GET /api/releases", requireAuth(http.HandlerFunc(h.ListReleases)))
	mux.Handle("POST /api/releases", requireAuth(http.HandlerFunc(h.CreateRelease)))
	mux.Handle("GET /api/releases/{id}", requireAuth(http.HandlerFunc(h.GetRelease)))
	mux.Handle("DELETE /api/releases/{id}", requireAuth(http.HandlerFunc(h.DeleteRelease)))
	mux.Handle("GET /api/releases/{id}/download/{filename}", requireAuth(http.HandlerFunc(h.DownloadReleaseFile)))
	mux.Handle("POST /api/releases/{id}/files", requireAuth(http.HandlerFunc(h.UploadReleaseFile)))
	// Release comments
	mux.Handle("GET /api/releases/{id}/comments", requireAuth(http.HandlerFunc(h.ListReleaseComments)))
	mux.Handle("POST /api/releases/{id}/comments", requireAuth(http.HandlerFunc(h.CreateReleaseComment)))
	mux.Handle("DELETE /api/releases/{id}/comments/{commentId}", requireAuth(http.HandlerFunc(h.DeleteReleaseComment)))

	// Notifications routes
	mux.Handle("GET /api/notifications", requireAuth(http.HandlerFunc(h.ListNotifications)))
	mux.Handle("GET /api/notifications/count", requireAuth(http.HandlerFunc(h.GetUnreadCount)))
	mux.Handle("POST /api/notifications/{id}/read", requireAuth(http.HandlerFunc(h.MarkNotificationRead)))
	mux.Handle("POST /api/notifications/read-all", requireAuth(http.HandlerFunc(h.MarkAllNotificationsRead)))

	// Telegram routes
	mux.HandleFunc("POST /api/telegram/webhook", h.TelegramWebhook) // Public - called by Telegram
	mux.Handle("GET /api/users/me/telegram", requireAuth(http.HandlerFunc(h.GetTelegramStatus)))
	mux.Handle("POST /api/users/me/telegram/link", requireAuth(http.HandlerFunc(h.GenerateTelegramLink)))
	mux.Handle("DELETE /api/users/me/telegram", requireAuth(http.HandlerFunc(h.UnlinkTelegram)))

	// ============================================
	// Static File Serving (React SPA)
	// ============================================
	// Check if static directory exists
	if _, err := os.Stat(cfg.StaticDir); os.IsNotExist(err) {
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
		mux.Handle("/", middleware.SPAHandler(cfg.StaticDir))
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

	// Start server with TLS
	// Check if TLS certs exist
	if _, err := os.Stat(cfg.TLSCert); err == nil {
		log.Printf("Sarray Forge starting on https://localhost:%s", cfg.Port)
		log.Printf("The ancient tablets await your commands...")
		if err := http.ListenAndServeTLS(":"+cfg.Port, cfg.TLSCert, cfg.TLSKey, handler); err != nil {
			log.Fatalf("Server failed: %v", err)
		}
	} else {
		log.Printf("Sarray Forge starting on http://localhost:%s (no TLS certs found)", cfg.Port)
		log.Printf("The ancient tablets await your commands...")
		if err := http.ListenAndServe(":"+cfg.Port, handler); err != nil {
			log.Fatalf("Server failed: %v", err)
		}
	}
}
