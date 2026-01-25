package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"

	"sarray-forge/internal/middleware"
	"sarray-forge/internal/telegram"
	"sarray-forge/internal/websocket"
)

// TelegramWebhook handles POST /api/telegram/webhook
// This is called by Telegram when users interact with the bot
func (h *Handlers) TelegramWebhook(w http.ResponseWriter, r *http.Request) {
	if h.telegram == nil {
		writeError(w, http.StatusServiceUnavailable, "telegram_disabled", "Telegram integration is not configured")
		return
	}

	var update telegram.Update
	if err := json.NewDecoder(r.Body).Decode(&update); err != nil {
		log.Printf("[Telegram] Failed to decode webhook: %v", err)
		// Return 200 OK anyway to prevent Telegram from retrying
		w.WriteHeader(http.StatusOK)
		return
	}

	// Handle /start command with token
	if update.Message != nil && strings.HasPrefix(update.Message.Text, "/start") {
		parts := strings.Fields(update.Message.Text)
		if len(parts) >= 2 {
			token := parts[1]
			chatID := update.Message.Chat.ID

			userID, err := h.telegram.HandleStartCommand(r.Context(), chatID, token)
			if err != nil {
				log.Printf("[Telegram] Failed to handle /start: %v", err)
				// Send error message to user
				h.telegram.SendMessage(
					formatChatID(chatID),
					"Failed to link account. The link may have expired. Please try again from Sarray Forge settings.",
				)
			} else {
				log.Printf("[Telegram] Successfully linked user %d to chat %d", userID, chatID)
				// Broadcast update via WebSocket so frontend can update
				h.broadcastTelegramLinked(userID)
			}
		} else {
			// /start without token - just greet
			h.telegram.SendMessage(
				formatChatID(update.Message.Chat.ID),
				"Welcome to Sarray Forge! To receive notifications, please link your account from Settings > Telegram in Sarray Forge.",
			)
		}
	}

	// Always return 200 OK
	w.WriteHeader(http.StatusOK)
}

// GenerateTelegramLink handles POST /api/users/me/telegram/link
// Generates a deep link URL for the user to link their Telegram
func (h *Handlers) GenerateTelegramLink(w http.ResponseWriter, r *http.Request) {
	if h.telegram == nil {
		writeError(w, http.StatusServiceUnavailable, "telegram_disabled", "Telegram integration is not configured")
		return
	}

	userID, _, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Not authenticated")
		return
	}

	linkURL, err := h.telegram.GenerateLinkToken(r.Context(), userID)
	if err != nil {
		log.Printf("[Telegram] Failed to generate link token for user %d: %v", userID, err)
		writeError(w, http.StatusInternalServerError, "link_failed", "Failed to generate Telegram link")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"linkUrl": linkURL,
	})
}

// UnlinkTelegram handles DELETE /api/users/me/telegram
// Removes the user's Telegram chat ID
func (h *Handlers) UnlinkTelegram(w http.ResponseWriter, r *http.Request) {
	userID, _, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Not authenticated")
		return
	}

	_, err := h.db.Exec(`
		UPDATE users SET telegram_chat_id = NULL, updated_at = CURRENT_TIMESTAMP
		WHERE id = ?
	`, userID)
	if err != nil {
		log.Printf("[Telegram] Failed to unlink telegram for user %d: %v", userID, err)
		writeError(w, http.StatusInternalServerError, "unlink_failed", "Failed to unlink Telegram")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"status": "unlinked",
	})
}

// GetTelegramStatus handles GET /api/users/me/telegram
// Returns whether the user has Telegram linked
func (h *Handlers) GetTelegramStatus(w http.ResponseWriter, r *http.Request) {
	userID, _, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Not authenticated")
		return
	}

	var chatID *string
	err := h.db.QueryRow(`
		SELECT telegram_chat_id FROM users WHERE id = ?
	`, userID).Scan(&chatID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to get Telegram status")
		return
	}

	linked := chatID != nil && *chatID != ""
	response := map[string]interface{}{
		"linked":  linked,
		"enabled": h.telegram != nil,
	}
	if linked {
		// Mask the chat ID for privacy (show last 4 digits)
		masked := "***" + (*chatID)[max(0, len(*chatID)-4):]
		response["chatId"] = masked
	}

	writeJSON(w, http.StatusOK, response)
}

// broadcastTelegramLinked sends a WebSocket event when a user links Telegram
func (h *Handlers) broadcastTelegramLinked(userID int64) {
	// Broadcast to the specific user so their Settings page can update
	h.hub.SendToUser(userID, websocket.Event{
		Type:   websocket.EventTelegramLinked,
		UserID: userID,
	})
}

// formatChatID converts int64 chat ID to string
func formatChatID(chatID int64) string {
	return fmt.Sprintf("%d", chatID)
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
