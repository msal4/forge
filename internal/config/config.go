package config

import (
	"os"
)

// Config holds all application configuration
type Config struct {
	// Server settings
	Port          string
	StaticDir     string
	DatabasePath  string
	MigrationsDir string
	BaseURL       string // Public URL for generating links (e.g., https://forge.sarray.de)

	// TLS settings
	TLSCert string
	TLSKey  string

	// Telegram settings
	TelegramBotToken       string
	TelegramBotUsername    string
	TelegramWebhookSecret  string
}

// Load reads configuration from environment variables with defaults
func Load() *Config {
	return &Config{
		// Server
		Port:          getEnv("PORT", "8080"),
		StaticDir:     getEnv("STATIC_DIR", "./web/dist"),
		DatabasePath:  getEnv("DATABASE_PATH", "./data/sarray-forge.db"),
		MigrationsDir: getEnv("MIGRATIONS_DIR", "./migrations"),
		BaseURL:       os.Getenv("BASE_URL"), // e.g., https://forge.sarray.de

		// TLS
		TLSCert: getEnv("TLS_CERT", "./certs/cert.pem"),
		TLSKey:  getEnv("TLS_KEY", "./certs/key.pem"),

		// Telegram
		TelegramBotToken:      os.Getenv("TELEGRAM_BOT_TOKEN"),
		TelegramBotUsername:   os.Getenv("TELEGRAM_BOT_USERNAME"),
		TelegramWebhookSecret: os.Getenv("TELEGRAM_WEBHOOK_SECRET"),
	}
}

// TelegramEnabled returns true if Telegram is configured
func (c *Config) TelegramEnabled() bool {
	return c.TelegramBotToken != "" && c.TelegramBotUsername != ""
}

// getEnv returns the environment variable value or a default
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
