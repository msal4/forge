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

	// Notifications
	EventNotificationCreated = "notification_created"
)

// Resource types
const (
	ResourceIssue        = "issue"
	ResourceDoc          = "doc"
	ResourceRelease      = "release"
	ResourceComment      = "comment"
	ResourceNotification = "notification"
)
