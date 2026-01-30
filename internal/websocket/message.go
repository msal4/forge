package websocket

// Event represents a WebSocket event message
type Event struct {
	Type     string      `json:"type"`     // e.g., "issue_created", "doc_updated"
	Resource string      `json:"resource"` // "issue", "doc", "release"
	ID       int64       `json:"id"`       // ID of the affected resource
	Data     interface{} `json:"data,omitempty"`
	UserID   int64       `json:"userId"` // Who triggered the change
}

// Event types
const (
	// Issues
	EventIssueCreated = "issue_created"
	EventIssueUpdated = "issue_updated"
	EventIssueDeleted = "issue_deleted"

	// Docs
	EventDocCreated = "doc_created"
	EventDocUpdated = "doc_updated"
	EventDocDeleted = "doc_deleted"

	// Releases
	EventReleaseCreated = "release_created"
	EventReleaseUpdated = "release_updated"
	EventReleaseDeleted = "release_deleted"

	// Comments
	EventCommentCreated = "comment_created"
	EventCommentDeleted = "comment_deleted"

	// Reactions
	EventReactionAdded   = "reaction_added"
	EventReactionRemoved = "reaction_removed"

	// Notifications
	EventNotificationCreated = "notification_created"

	// Telegram
	EventTelegramLinked = "telegram_linked"

	// Chat
	EventChatMessage = "chat_message"
	EventChatError   = "chat_error"
)

// Resource types
const (
	ResourceIssue        = "issue"
	ResourceDoc          = "doc"
	ResourceRelease      = "release"
	ResourceComment      = "comment"
	ResourceReaction     = "reaction"
	ResourceNotification = "notification"
	ResourceChat         = "chat"
)

// ChatMessage represents an ephemeral chat message
type ChatMessage struct {
	ID        string   `json:"id"`        // UUID generated client-side
	Room      string   `json:"room"`      // "team" or "dm:{lowerID}:{higherID}"
	From      ChatUser `json:"from"`      // Sender info
	Content   string   `json:"content"`   // Message text
	Timestamp int64    `json:"timestamp"` // Unix timestamp in milliseconds
}

// ChatUser represents a user in chat context
type ChatUser struct {
	ID       int64  `json:"id"`
	Username string `json:"username"`
	FullName string `json:"fullName"`
}

// IncomingChatMessage is the message format sent from clients
type IncomingChatMessage struct {
	Type    string `json:"type"`    // "chat_message"
	ID      string `json:"id"`      // UUID from client
	Room    string `json:"room"`    // Target room
	Content string `json:"content"` // Message content
}
