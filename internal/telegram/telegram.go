package telegram

import (
	"bytes"
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	db "sarray-forge/internal/db/sqlc"
	"sarray-forge/internal/i18n"
)

const (
	telegramAPIBase = "https://api.telegram.org/bot"
	linkTokenExpiry = 10 * time.Minute
)

// Service handles Telegram Bot API interactions
type Service struct {
	botToken    string
	botUsername string
	baseURL     string // Base URL for generating entity links
	client      *http.Client
	database    *sql.DB
}

// NewService creates a new Telegram service
// Returns nil if bot token is not configured
func NewService(botToken, botUsername, baseURL string, database *sql.DB) *Service {
	if botToken == "" || botUsername == "" {
		return nil
	}

	return &Service{
		botToken:    botToken,
		botUsername: botUsername,
		baseURL:     strings.TrimSuffix(baseURL, "/"),
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
		database: database,
	}
}

// IsConfigured returns true if the service is properly configured
func (s *Service) IsConfigured() bool {
	return s != nil && s.botToken != ""
}

// SendMessage sends a text message to a Telegram chat
func (s *Service) SendMessage(chatID string, text string) error {
	if !s.IsConfigured() {
		return nil
	}

	payload := map[string]interface{}{
		"chat_id":    chatID,
		"text":       text,
		"parse_mode": "Markdown",
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal message: %w", err)
	}

	url := fmt.Sprintf("%s%s/sendMessage", telegramAPIBase, s.botToken)
	resp, err := s.client.Post(url, "application/json", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("failed to send message: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		var result map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&result)
		return fmt.Errorf("telegram API error: %v", result)
	}

	return nil
}

// GenerateLinkToken creates a new link token for a user
// Returns the full deep link URL
func (s *Service) GenerateLinkToken(ctx context.Context, userID int64) (string, error) {
	if !s.IsConfigured() {
		return "", fmt.Errorf("telegram not configured")
	}

	queries := db.New(s.database)

	// Generate random token
	tokenBytes := make([]byte, 16)
	if _, err := rand.Read(tokenBytes); err != nil {
		return "", fmt.Errorf("failed to generate token: %w", err)
	}
	token := hex.EncodeToString(tokenBytes)

	// Delete any existing token for this user
	_ = queries.DeleteTelegramLinkToken(ctx, userID)

	// Create new token
	expiresAt := time.Now().Add(linkTokenExpiry)
	err := queries.CreateTelegramLinkToken(ctx, db.CreateTelegramLinkTokenParams{
		UserID:    userID,
		Token:     token,
		ExpiresAt: expiresAt,
	})
	if err != nil {
		return "", fmt.Errorf("failed to save link token: %w", err)
	}

	// Build deep link URL
	// Format: https://t.me/BotUsername?start=TOKEN
	deepLink := fmt.Sprintf("https://t.me/%s?start=%s", s.botUsername, token)
	return deepLink, nil
}

// HandleStartCommand processes /start commands from the webhook
// Returns the user ID if successfully linked, or 0 if not
func (s *Service) HandleStartCommand(ctx context.Context, chatID int64, token string) (int64, error) {
	if !s.IsConfigured() {
		return 0, fmt.Errorf("telegram not configured")
	}

	queries := db.New(s.database)

	// Look up the token
	linkToken, err := queries.GetTelegramLinkToken(ctx, token)
	if err != nil {
		if err == sql.ErrNoRows {
			return 0, fmt.Errorf("invalid or expired token")
		}
		return 0, fmt.Errorf("failed to lookup token: %w", err)
	}

	// Check if token is expired
	if time.Now().After(linkToken.ExpiresAt) {
		// Clean up expired token
		_ = queries.DeleteTelegramLinkToken(ctx, linkToken.UserID)
		return 0, fmt.Errorf("token expired")
	}

	// Link the user's Telegram account
	chatIDStr := fmt.Sprintf("%d", chatID)
	err = queries.SetUserTelegramChatID(ctx, db.SetUserTelegramChatIDParams{
		TelegramChatID: sql.NullString{String: chatIDStr, Valid: true},
		ID:             linkToken.UserID,
	})
	if err != nil {
		return 0, fmt.Errorf("failed to link account: %w", err)
	}

	// Delete the used token
	_ = queries.DeleteTelegramLinkToken(ctx, linkToken.UserID)

	// Get user info for the confirmation message
	user, err := queries.GetUserByID(ctx, linkToken.UserID)
	if err != nil {
		return linkToken.UserID, nil // Still return success even if we can't get user info
	}

	// Send confirmation message
	message := fmt.Sprintf("Linked successfully! You'll now receive Sarray Forge notifications here, %s.", user.FullName)
	if err := s.SendMessage(chatIDStr, message); err != nil {
		log.Printf("Failed to send confirmation message: %v", err)
	}

	return linkToken.UserID, nil
}

// SendNotification sends a notification to a user via Telegram
// Does nothing if user hasn't linked their Telegram
func (s *Service) SendNotification(ctx context.Context, userID int64, notificationID int64, entityType string, entityID int64, title, message string) {
	if !s.IsConfigured() {
		log.Printf("[Telegram] Service not configured, skipping notification")
		return
	}

	queries := db.New(s.database)

	// Get user's Telegram chat ID
	chatID, err := queries.GetUserTelegramChatID(ctx, userID)
	if err != nil {
		log.Printf("[Telegram] Failed to get chat ID for user %d: %v", userID, err)
		return
	}
	if !chatID.Valid || chatID.String == "" {
		log.Printf("[Telegram] User %d has no linked Telegram", userID)
		return
	}

	// Get user's language preference
	lang := "en" // default
	if userLang, err := queries.GetUserLanguage(ctx, userID); err == nil && userLang != "" {
		lang = userLang
	}

	// Get localized "Open" link text
	openLinkText := i18n.GetTelegramString(lang, "open_link")

	// Format the notification message with link
	var text string
	if s.baseURL != "" && entityType != "" && entityID > 0 {
		// Build entity URL based on type, include notification ID to mark as read
		entityURL := s.buildEntityURL(entityType, entityID, notificationID)
		text = fmt.Sprintf("*%s*\n%s\n\n[%s](%s)", escapeMarkdown(title), escapeMarkdown(message), openLinkText, entityURL)
	} else {
		text = fmt.Sprintf("*%s*\n%s", escapeMarkdown(title), escapeMarkdown(message))
	}

	log.Printf("[Telegram] Sending notification to user %d (chat %s, lang %s)", userID, chatID.String, lang)
	if err := s.SendMessage(chatID.String, text); err != nil {
		log.Printf("[Telegram] Failed to send notification to user %d: %v", userID, err)
	} else {
		log.Printf("[Telegram] Successfully sent notification to user %d", userID)
	}
}

// buildEntityURL constructs a URL for the given entity type and ID
// Includes notif query param so the frontend can mark it as read
func (s *Service) buildEntityURL(entityType string, entityID int64, notificationID int64) string {
	var path string
	switch entityType {
	case "issue":
		path = fmt.Sprintf("/issues/%d", entityID)
	case "doc":
		path = fmt.Sprintf("/docs/%d", entityID)
	case "release":
		path = fmt.Sprintf("/releases/%d", entityID)
	default:
		return s.baseURL
	}
	return fmt.Sprintf("%s%s?notif=%d", s.baseURL, path, notificationID)
}

// escapeMarkdown escapes special characters for Telegram Markdown
func escapeMarkdown(text string) string {
	// Telegram Markdown v1 special characters: _ * ` [
	replacer := strings.NewReplacer(
		"_", "\\_",
		"*", "\\*",
		"`", "\\`",
		"[", "\\[",
	)
	return replacer.Replace(text)
}

// Update represents a Telegram webhook update
type Update struct {
	UpdateID int64    `json:"update_id"`
	Message  *Message `json:"message,omitempty"`
}

// Message represents a Telegram message
type Message struct {
	MessageID int64  `json:"message_id"`
	Chat      Chat   `json:"chat"`
	Text      string `json:"text,omitempty"`
	From      *User  `json:"from,omitempty"`
}

// Chat represents a Telegram chat
type Chat struct {
	ID int64 `json:"id"`
}

// User represents a Telegram user
type User struct {
	ID        int64  `json:"id"`
	FirstName string `json:"first_name"`
	Username  string `json:"username,omitempty"`
}
