package websocket

import (
	"encoding/json"
	"log"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const (
	// Time allowed to write a message to the peer
	writeWait = 10 * time.Second

	// Time allowed to read the next pong message from the peer
	pongWait = 60 * time.Second

	// Send pings to peer with this period (must be less than pongWait)
	pingPeriod = (pongWait * 9) / 10

	// Maximum message size allowed from peer
	maxMessageSize = 4096 // Increased for chat messages

	// Rate limiting: max messages per window
	rateLimitMessages = 10
	rateLimitWindow   = 10 * time.Second

	// Max chat message content length
	maxChatContentLength = 2000
)

// ChatNotifyFunc is called when a chat message should be sent to an offline user
type ChatNotifyFunc func(recipientUserID int64, senderName, message string)

// Client represents a single WebSocket connection
type Client struct {
	hub *Hub

	// The WebSocket connection
	conn *websocket.Conn

	// Buffered channel of outbound messages
	send chan []byte

	// User ID of the connected user
	userID int64

	// User info for chat messages
	username string
	fullName string

	// Rate limiting
	rateMu            sync.Mutex
	messageTimestamps []time.Time

	// Callback to notify offline users (e.g., via Telegram)
	notifyOfflineUser ChatNotifyFunc
}

// NewClient creates a new client instance
func NewClient(hub *Hub, conn *websocket.Conn, userID int64, username, fullName string) *Client {
	return &Client{
		hub:               hub,
		conn:              conn,
		send:              make(chan []byte, 256),
		userID:            userID,
		username:          username,
		fullName:          fullName,
		messageTimestamps: make([]time.Time, 0, rateLimitMessages),
	}
}

// SetNotifyOfflineUser sets the callback for notifying offline users
func (c *Client) SetNotifyOfflineUser(fn ChatNotifyFunc) {
	c.notifyOfflineUser = fn
}

// ReadPump pumps messages from the WebSocket connection to the hub
// This goroutine runs until the connection is closed
func (c *Client) ReadPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("[WS Client] Unexpected close error: %v", err)
			}
			break
		}

		// Process incoming messages (currently only chat)
		c.handleMessage(message)
	}
}

// handleMessage processes incoming WebSocket messages
func (c *Client) handleMessage(message []byte) {
	// Parse the message to determine type
	var incoming IncomingChatMessage
	if err := json.Unmarshal(message, &incoming); err != nil {
		log.Printf("[WS Client] Failed to parse message: %v", err)
		return
	}

	switch incoming.Type {
	case EventChatMessage:
		c.handleChatMessage(incoming)
	default:
		log.Printf("[WS Client] Unknown message type: %s", incoming.Type)
	}
}

// handleChatMessage processes and routes chat messages
func (c *Client) handleChatMessage(msg IncomingChatMessage) {
	// Rate limit check
	if !c.checkRateLimit() {
		c.sendError("rate_limit", "Too many messages. Please slow down.")
		return
	}

	// Validate content
	content := strings.TrimSpace(msg.Content)
	if content == "" {
		c.sendError("invalid_content", "Message cannot be empty")
		return
	}
	if len(content) > maxChatContentLength {
		c.sendError("invalid_content", "Message too long")
		return
	}

	// Validate room format
	if msg.Room != "team" && !strings.HasPrefix(msg.Room, "dm:") {
		c.sendError("invalid_room", "Invalid room format")
		return
	}

	// Build enriched chat message
	chatMsg := ChatMessage{
		ID:   msg.ID,
		Room: msg.Room,
		From: ChatUser{
			ID:       c.userID,
			Username: c.username,
			FullName: c.fullName,
		},
		Content:   content,
		Timestamp: time.Now().UnixMilli(),
	}

	// Create event
	event := Event{
		Type:     EventChatMessage,
		Resource: ResourceChat,
		Data:     chatMsg,
		UserID:   c.userID,
	}

	// Route the message
	if msg.Room == "team" {
		// Broadcast to everyone
		c.hub.Broadcast(event)
	} else {
		// DM: send to both participants
		userIDs := c.parseDMRoom(msg.Room)
		if userIDs == nil {
			c.sendError("invalid_room", "Invalid DM room format")
			return
		}
		c.hub.SendToUsers(userIDs, event)

		// Check if recipient is offline and send notification
		if c.notifyOfflineUser != nil {
			for _, recipientID := range userIDs {
				// Don't notify the sender
				if recipientID == c.userID {
					continue
				}
				// Check if recipient is offline
				if !c.hub.IsUserOnline(recipientID) {
					senderName := c.fullName
					if senderName == "" {
						senderName = c.username
					}
					// Send notification asynchronously
					go c.notifyOfflineUser(recipientID, senderName, content)
				}
			}
		}
	}
}

// checkRateLimit returns true if the message is allowed
func (c *Client) checkRateLimit() bool {
	c.rateMu.Lock()
	defer c.rateMu.Unlock()

	now := time.Now()
	windowStart := now.Add(-rateLimitWindow)

	// Remove old timestamps outside the window
	validTimestamps := make([]time.Time, 0, rateLimitMessages)
	for _, ts := range c.messageTimestamps {
		if ts.After(windowStart) {
			validTimestamps = append(validTimestamps, ts)
		}
	}
	c.messageTimestamps = validTimestamps

	// Check if under limit
	if len(c.messageTimestamps) >= rateLimitMessages {
		return false
	}

	// Add current timestamp
	c.messageTimestamps = append(c.messageTimestamps, now)
	return true
}

// parseDMRoom extracts user IDs from a DM room string (format: "dm:{id1}:{id2}")
func (c *Client) parseDMRoom(room string) []int64 {
	parts := strings.Split(room, ":")
	if len(parts) != 3 || parts[0] != "dm" {
		return nil
	}

	id1, err1 := strconv.ParseInt(parts[1], 10, 64)
	id2, err2 := strconv.ParseInt(parts[2], 10, 64)
	if err1 != nil || err2 != nil {
		return nil
	}

	// Verify sender is one of the participants
	if c.userID != id1 && c.userID != id2 {
		return nil
	}

	return []int64{id1, id2}
}

// sendError sends an error event to this client
func (c *Client) sendError(code, message string) {
	event := Event{
		Type:     EventChatError,
		Resource: ResourceChat,
		Data: map[string]string{
			"code":    code,
			"message": message,
		},
	}
	data, _ := json.Marshal(event)
	select {
	case c.send <- data:
	default:
		// Buffer full, skip
	}
}

// WritePump pumps messages from the hub to the WebSocket connection
// This goroutine runs until the connection is closed
func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				// Hub closed the channel
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			// Coalesce queued messages into single websocket message
			n := len(c.send)
			for i := 0; i < n; i++ {
				w.Write([]byte{'\n'})
				w.Write(<-c.send)
			}

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
