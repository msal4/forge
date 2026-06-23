package telegram

import (
	"bytes"
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	db "sarray-forge/internal/db/sqlc"
	"sarray-forge/internal/i18n"
	"sarray-forge/internal/notifications"
)

const (
	telegramAPIBase = "https://api.telegram.org/bot"
	linkTokenExpiry = 10 * time.Minute
)

// Service handles Telegram Bot API interactions
type Service struct {
	botToken      string
	botUsername   string
	baseURL       string // Base URL for generating entity links
	webhookSecret string
	client        *http.Client
	database      *sql.DB
}

// NewService creates a new Telegram service
// Returns nil if bot token is not configured
func NewService(botToken, botUsername, baseURL, webhookSecret string, database *sql.DB) *Service {
	if botToken == "" || botUsername == "" {
		return nil
	}

	return &Service{
		botToken:      botToken,
		botUsername:   botUsername,
		baseURL:       strings.TrimSuffix(baseURL, "/"),
		webhookSecret: webhookSecret,
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

// WebhookURL returns the public webhook endpoint for Telegram updates.
func (s *Service) WebhookURL() string {
	return s.baseURL + "/api/telegram/webhook"
}

// ValidateWebhookSecret checks the Telegram secret token header when configured.
func (s *Service) ValidateWebhookSecret(header string) bool {
	if s.webhookSecret == "" {
		return true
	}
	return header == s.webhookSecret
}

// RegisterWebhook tells Telegram to deliver bot updates to this server.
func (s *Service) RegisterWebhook(ctx context.Context) error {
	if !s.IsConfigured() {
		return fmt.Errorf("telegram not configured")
	}
	if s.baseURL == "" {
		return fmt.Errorf("BASE_URL is required to register Telegram webhook")
	}

	payload := map[string]interface{}{
		"url":             s.WebhookURL(),
		"allowed_updates": []string{"message"},
	}
	if s.webhookSecret != "" {
		payload["secret_token"] = s.webhookSecret
	}

	var result map[string]interface{}
	if err := s.callAPI(ctx, "setWebhook", payload, &result); err != nil {
		return err
	}
	if ok, _ := result["ok"].(bool); !ok {
		return fmt.Errorf("setWebhook failed: %v", result)
	}
	return nil
}

// LogWebhookInfo logs the current Telegram webhook configuration.
func (s *Service) LogWebhookInfo(ctx context.Context) {
	if !s.IsConfigured() {
		return
	}

	var result struct {
		OK     bool `json:"ok"`
		Result struct {
			URL                string `json:"url"`
			PendingUpdateCount int    `json:"pending_update_count"`
			LastErrorMessage   string `json:"last_error_message"`
		} `json:"result"`
	}
	if err := s.callAPI(ctx, "getWebhookInfo", nil, &result); err != nil {
		log.Printf("[Telegram] Failed to get webhook info: %v", err)
		return
	}
	if !result.OK {
		log.Printf("[Telegram] getWebhookInfo returned not ok")
		return
	}

	info := result.Result
	if info.URL == "" {
		log.Printf("[Telegram] Webhook is not registered with Telegram")
		return
	}

	log.Printf("[Telegram] Webhook URL: %s (pending updates: %d)", info.URL, info.PendingUpdateCount)
	if info.LastErrorMessage != "" {
		log.Printf("[Telegram] Webhook last error: %s", info.LastErrorMessage)
	}
}

func (s *Service) callAPI(ctx context.Context, method string, payload map[string]interface{}, result interface{}) error {
	var body io.Reader
	if payload != nil {
		encoded, err := json.Marshal(payload)
		if err != nil {
			return fmt.Errorf("failed to marshal payload: %w", err)
		}
		body = bytes.NewReader(encoded)
	}

	url := fmt.Sprintf("%s%s/%s", telegramAPIBase, s.botToken, method)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, body)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("telegram API request failed: %w", err)
	}
	defer resp.Body.Close()

	if err := json.NewDecoder(resp.Body).Decode(result); err != nil {
		return fmt.Errorf("failed to decode telegram response: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("telegram API HTTP %d", resp.StatusCode)
	}
	return nil
}

// ParseStartToken extracts the link token from a /start command message.
func ParseStartToken(text string) string {
	text = strings.TrimSpace(text)
	if !strings.HasPrefix(text, "/start") {
		return ""
	}
	parts := strings.Fields(text)
	if len(parts) < 2 {
		return ""
	}
	return parts[1]
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
func (s *Service) SendNotification(ctx context.Context, params notifications.TelegramNotificationParams) {
	if !s.IsConfigured() {
		log.Printf("[Telegram] Service not configured, skipping notification")
		return
	}

	queries := db.New(s.database)

	// Get user's Telegram chat ID
	chatID, err := queries.GetUserTelegramChatID(ctx, params.UserID)
	if err != nil {
		log.Printf("[Telegram] Failed to get chat ID for user %d: %v", params.UserID, err)
		return
	}
	if !chatID.Valid || chatID.String == "" {
		log.Printf("[Telegram] User %d has no linked Telegram", params.UserID)
		return
	}

	// Get user's language preference
	lang := "en" // default
	if userLang, err := queries.GetUserLanguage(ctx, params.UserID); err == nil && userLang != "" {
		lang = userLang
	}

	// Build localized notification message
	var message string
	if params.NotificationType == "reaction" && params.Emoji != "" {
		message = i18n.GetNotificationMessageWithEmoji(lang, params.NotificationType, params.ActorName, params.EntityType, params.Emoji)
	} else {
		message = i18n.GetNotificationMessage(lang, params.NotificationType, params.ActorName, params.EntityType)
	}

	// Get localized "Open" link text
	openLinkText := i18n.GetTelegramString(lang, "open_link")

	// Format the notification message with link
	var text string
	if s.baseURL != "" && params.EntityType != "" && params.EntityID > 0 {
		// Build entity URL based on type, include notification ID to mark as read
		entityURL := s.buildEntityURL(params.EntityType, params.EntityID, params.NotificationID)
		text = fmt.Sprintf("*%s*\n%s\n\n[%s](%s)", escapeMarkdown(params.Title), escapeMarkdown(message), openLinkText, entityURL)
	} else {
		text = fmt.Sprintf("*%s*\n%s", escapeMarkdown(params.Title), escapeMarkdown(message))
	}

	log.Printf("[Telegram] Sending notification to user %d (chat %s, lang %s)", params.UserID, chatID.String, lang)
	if err := s.SendMessage(chatID.String, text); err != nil {
		log.Printf("[Telegram] Failed to send notification to user %d: %v", params.UserID, err)
	} else {
		log.Printf("[Telegram] Successfully sent notification to user %d", params.UserID)
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
