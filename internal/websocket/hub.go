package websocket

import (
	"encoding/json"
	"log"
	"sync"
)

// Hub maintains the set of active clients and broadcasts messages to them
type Hub struct {
	// Registered clients
	clients map[*Client]bool

	// Inbound messages from clients (for broadcasting)
	broadcast chan []byte

	// Register requests from clients
	register chan *Client

	// Unregister requests from clients
	unregister chan *Client

	// Mutex for thread-safe operations
	mu sync.RWMutex
}

// NewHub creates a new Hub instance
func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		broadcast:  make(chan []byte, 256),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
}

// Run starts the hub's main event loop
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			h.mu.Unlock()
			log.Printf("[WS Hub] Client registered (user: %d). Total: %d", client.userID, len(h.clients))
			// Broadcast presence update
			h.Broadcast(Event{Type: "presence.update", Resource: "users", ID: client.userID})

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
			}
			h.mu.Unlock()
			log.Printf("[WS Hub] Client unregistered (user: %d). Total: %d", client.userID, len(h.clients))
			// Broadcast presence update
			h.Broadcast(Event{Type: "presence.update", Resource: "users", ID: client.userID})

		case message := <-h.broadcast:
			h.mu.RLock()
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					// Client's buffer is full, close the connection
					close(client.send)
					delete(h.clients, client)
				}
			}
			h.mu.RUnlock()
		}
	}
}

// Broadcast sends an event to all connected clients
func (h *Hub) Broadcast(event Event) {
	data, err := json.Marshal(event)
	if err != nil {
		log.Printf("[WS Hub] Error marshaling event: %v", err)
		return
	}

	log.Printf("[WS Hub] Broadcasting: %s for %s#%d", event.Type, event.Resource, event.ID)

	h.broadcast <- data
}

// ClientCount returns the number of connected clients
func (h *Hub) ClientCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients)
}

// ConnectedUserIDs returns unique user IDs of all connected clients
func (h *Hub) ConnectedUserIDs() []int64 {
	h.mu.RLock()
	defer h.mu.RUnlock()

	seen := make(map[int64]bool)
	var userIDs []int64

	for client := range h.clients {
		if !seen[client.userID] {
			seen[client.userID] = true
			userIDs = append(userIDs, client.userID)
		}
	}

	return userIDs
}

// IsUserOnline checks if a specific user has an active WebSocket connection
func (h *Hub) IsUserOnline(userID int64) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()

	for client := range h.clients {
		if client.userID == userID {
			return true
		}
	}

	return false
}

// Register registers a client with the hub
func (h *Hub) Register(client *Client) {
	h.register <- client
}

// SendToUser sends an event to all connections of a specific user
func (h *Hub) SendToUser(userID int64, event Event) {
	data, err := json.Marshal(event)
	if err != nil {
		log.Printf("[WS Hub] Error marshaling event: %v", err)
		return
	}

	log.Printf("[WS Hub] Sending to user %d: %s for %s#%d", userID, event.Type, event.Resource, event.ID)

	h.mu.RLock()
	defer h.mu.RUnlock()

	for client := range h.clients {
		if client.userID == userID {
			select {
			case client.send <- data:
			default:
				// Client's buffer is full, skip
				log.Printf("[WS Hub] User %d client buffer full, skipping", userID)
			}
		}
	}
}

// SendToUsers sends an event to multiple users (used for DM where both parties need the message)
func (h *Hub) SendToUsers(userIDs []int64, event Event) {
	data, err := json.Marshal(event)
	if err != nil {
		log.Printf("[WS Hub] Error marshaling event: %v", err)
		return
	}

	log.Printf("[WS Hub] Sending to users %v: %s", userIDs, event.Type)

	// Build lookup set for efficient checking
	targetUsers := make(map[int64]bool)
	for _, id := range userIDs {
		targetUsers[id] = true
	}

	h.mu.RLock()
	defer h.mu.RUnlock()

	for client := range h.clients {
		if targetUsers[client.userID] {
			select {
			case client.send <- data:
			default:
				log.Printf("[WS Hub] User %d client buffer full, skipping", client.userID)
			}
		}
	}
}
