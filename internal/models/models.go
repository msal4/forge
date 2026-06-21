package models

import "time"

// User represents a team member in Sarray Forge
type User struct {
	ID        int64     `json:"id"`
	Username  string    `json:"username"`
	Email     string    `json:"email"`
	FullName  string    `json:"fullName"`
	AvatarURL string    `json:"avatarUrl,omitempty"`
	Language  string    `json:"language"`
	IsAdmin   bool      `json:"isAdmin"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// Workspace represents an isolated project space (backed by projects table)
type Workspace struct {
	ID          int64     `json:"id"`
	Key         string    `json:"key"`
	Name        string    `json:"name"`
	Description string    `json:"description,omitempty"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

// Session represents an authenticated user session
type Session struct {
	ID        int64     `json:"id"`
	UserID    int64     `json:"userId"`
	Email     string    `json:"email"`
	Token     string    `json:"token"`
	ExpiresAt time.Time `json:"expiresAt"`
	CreatedAt time.Time `json:"createdAt"`
}

// IssueStatus represents the Kanban column status
type IssueStatus string

const (
	StatusToInscribe IssueStatus = "to_inscribe" // Todo
	StatusCarving    IssueStatus = "carving"     // In Progress
	StatusBaked      IssueStatus = "baked"       // Done
)

// IssuePriority represents issue priority levels
type IssuePriority string

const (
	PriorityLow      IssuePriority = "low"
	PriorityMedium   IssuePriority = "medium"
	PriorityHigh     IssuePriority = "high"
	PriorityCritical IssuePriority = "critical"
)

// Issue represents a task/ticket in the Tablet (Kanban board)
type Issue struct {
	ID          int64         `json:"id"`
	ProjectID   int64         `json:"projectId"`
	IssueNumber int64         `json:"issueNumber"`
	ProjectKey  string        `json:"projectKey,omitempty"`
	Title       string        `json:"title"`
	Description string        `json:"description"`
	Status      IssueStatus   `json:"status"`
	Priority    IssuePriority `json:"priority"`
	AssigneeID  *int64        `json:"assigneeId,omitempty"`
	Assignee    *User         `json:"assignee,omitempty"`
	ReporterID  int64         `json:"reporterId"`
	Reporter    *User         `json:"reporter,omitempty"`
	Labels      []string      `json:"labels"`
	DueDate     *time.Time    `json:"dueDate,omitempty"`
	CreatedAt   time.Time     `json:"createdAt"`
	UpdatedAt   time.Time     `json:"updatedAt"`
}

// Doc represents a document in the Library
type Doc struct {
	ID        int64     `json:"id"`
	ProjectID int64     `json:"projectId"`
	Title     string    `json:"title"`
	Content   string    `json:"content"` // Markdown content
	ParentID  *int64    `json:"parentId,omitempty"`
	AuthorID  int64     `json:"authorId"`
	Author    *User     `json:"author,omitempty"`
	Slug      string    `json:"slug"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// Release represents a release in the Granary
type Release struct {
	ID          int64         `json:"id"`
	ProjectID   int64         `json:"projectId"`
	Version     string        `json:"version"`
	Title       string        `json:"title"`
	Description string        `json:"description"` // Markdown changelog
	AuthorID    int64         `json:"authorId"`
	Author      *User         `json:"author,omitempty"`
	Files       []ReleaseFile `json:"files"`
	PublishedAt *time.Time    `json:"publishedAt,omitempty"`
	CreatedAt   time.Time     `json:"createdAt"`
	UpdatedAt   time.Time     `json:"updatedAt"`
}

// ReleaseFile represents a file attached to a release
type ReleaseFile struct {
	ID        int64     `json:"id"`
	ReleaseID int64     `json:"releaseId"`
	Filename  string    `json:"filename"`
	Size      int64     `json:"size"`
	MimeType  string    `json:"mimeType"`
	Path      string    `json:"-"` // Internal path, not exposed in JSON
	CreatedAt time.Time `json:"createdAt"`
}

// Comment represents a comment on an issue, doc, or release
type Comment struct {
	ID        int64     `json:"id"`
	IssueID   *int64    `json:"issueId,omitempty"`
	DocID     *int64    `json:"docId,omitempty"`
	ReleaseID *int64    `json:"releaseId,omitempty"`
	AuthorID  int64     `json:"authorId"`
	Author    *User     `json:"author,omitempty"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// NotificationType represents the type of notification
type NotificationType string

const (
	NotificationTypeMention           NotificationType = "mention"
	NotificationTypeAssigned          NotificationType = "assigned"
	NotificationTypeCommentOnOwned    NotificationType = "comment_on_owned"
	NotificationTypeCommentOnAssigned NotificationType = "comment_on_assigned"
	NotificationTypeEntityUpdated     NotificationType = "entity_updated" // Someone updated your issue/doc/release
	NotificationTypeEntityDeleted     NotificationType = "entity_deleted" // Someone deleted your issue/doc/release
	NotificationTypeReaction          NotificationType = "reaction"       // Someone reacted to your content
	NotificationTypeMentionEveryone  NotificationType = "mention_everyone" // @everyone broadcast mention
)

// Notification represents an in-app notification
type Notification struct {
	ID               int64            `json:"id"`
	UserID           int64            `json:"userId"`
	ActorID          int64            `json:"actorId"`
	Actor            *User            `json:"actor,omitempty"`
	NotificationType NotificationType `json:"notificationType"`
	EntityType       string           `json:"entityType"` // "issue", "doc", "release"
	EntityID         int64            `json:"entityId"`
	CommentID        *int64           `json:"commentId,omitempty"`
	Title            string           `json:"title"`
	Message          string           `json:"message"`
	IsRead           bool             `json:"isRead"`
	ReadAt           *time.Time       `json:"readAt,omitempty"`
	CreatedAt        time.Time        `json:"createdAt"`
}

// NotificationCount represents the count of unread notifications
type NotificationCount struct {
	Unread int64 `json:"unread"`
}

// ============================================
// Request/Response DTOs
// ============================================

// LoginRequest is the request body for login
type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// ChangePasswordRequest is the request body for changing password
type ChangePasswordRequest struct {
	NewPassword string `json:"newPassword"`
}

// LoginResponse is the response body for successful login
type LoginResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}

// CreateIssueRequest is the request body for creating an issue
type CreateIssueRequest struct {
	Title       string        `json:"title"`
	Description string        `json:"description"`
	Priority    IssuePriority `json:"priority"`
	AssigneeID  *int64        `json:"assigneeId,omitempty"`
	Labels      []string      `json:"labels"`
	DueDate     *time.Time    `json:"dueDate,omitempty"`
}

// UpdateIssueRequest is the request body for updating an issue
type UpdateIssueRequest struct {
	Title       *string        `json:"title,omitempty"`
	Description *string        `json:"description,omitempty"`
	Status      *IssueStatus   `json:"status,omitempty"`
	Priority    *IssuePriority `json:"priority,omitempty"`
	AssigneeID  *int64         `json:"assigneeId,omitempty"`
	Labels      []string       `json:"labels,omitempty"`
	DueDate     *time.Time     `json:"dueDate,omitempty"`
}

// UpdateIssueStatusRequest is the request body for updating issue status
type UpdateIssueStatusRequest struct {
	Status IssueStatus `json:"status"`
}

// CreateDocRequest is the request body for creating a doc
type CreateDocRequest struct {
	Title    string `json:"title"`
	Content  string `json:"content"`
	ParentID *int64 `json:"parentId,omitempty"`
}

// UpdateDocRequest is the request body for updating a doc
type UpdateDocRequest struct {
	Title    *string `json:"title,omitempty"`
	Content  *string `json:"content,omitempty"`
	ParentID *int64  `json:"parentId,omitempty"`
}

// CreateReleaseRequest is the request body for creating a release
type CreateReleaseRequest struct {
	Version     string `json:"version"`
	Title       string `json:"title"`
	Description string `json:"description"`
}

// CreateWorkspaceRequest is the request body for creating a workspace
type CreateWorkspaceRequest struct {
	Key         string `json:"key"`
	Name        string `json:"name"`
	Description string `json:"description"`
}

// SetWorkspaceMembersRequest is the request body for updating workspace members
type SetWorkspaceMembersRequest struct {
	UserIDs []int64 `json:"userIds"`
}

// CreateCommentRequest is the request body for creating a comment
type CreateCommentRequest struct {
	Content string `json:"content"`
}

// ErrorResponse is a standard error response
type ErrorResponse struct {
	Error   string `json:"error"`
	Message string `json:"message"`
}

// ActivityLog represents a modification history entry
type ActivityLog struct {
	ID          int64                  `json:"id"`
	Action      string                 `json:"action"`
	EntityType  string                 `json:"entityType"`
	EntityID    int64                  `json:"entityId"`
	EntityTitle string                 `json:"entityTitle,omitempty"`
	User        *User                  `json:"user,omitempty"`
	Changes     map[string]interface{} `json:"changes,omitempty"`
	CreatedAt   time.Time              `json:"createdAt"`
}

// ActivityLogResponse is the response for activity log endpoints
type ActivityLogResponse struct {
	Activities []ActivityLog `json:"activities"`
	HasMore    bool          `json:"hasMore"`
}

// ListResponse is a generic paginated list response
type ListResponse[T any] struct {
	Items      []T   `json:"items"`
	Total      int64 `json:"total"`
	Page       int   `json:"page"`
	PageSize   int   `json:"pageSize"`
	TotalPages int   `json:"totalPages"`
}

// SearchResult represents a single item in global search results
type SearchResult struct {
	Type   string      `json:"type"` // "issue" or "doc"
	ID     int64       `json:"id"`
	Title  string      `json:"title"`
	Status IssueStatus `json:"status,omitempty"` // Only for issues
}

// SearchResponse is the response body for global search
type SearchResponse struct {
	Results []SearchResult `json:"results"`
}

// ============================================
// Reactions
// ============================================

// Reaction represents an emoji reaction to content
type Reaction struct {
	ID               int64     `json:"id"`
	UserID           int64     `json:"userId"`
	User             *User     `json:"user,omitempty"`
	Emoji            string    `json:"emoji"`
	IssueID          *int64    `json:"issueId,omitempty"`
	DocID            *int64    `json:"docId,omitempty"`
	ReleaseID        *int64    `json:"releaseId,omitempty"`
	IssueCommentID   *int64    `json:"issueCommentId,omitempty"`
	DocCommentID     *int64    `json:"docCommentId,omitempty"`
	ReleaseCommentID *int64    `json:"releaseCommentId,omitempty"`
	CreatedAt        time.Time `json:"createdAt"`
}

// ReactionSummary for displaying aggregated reactions
type ReactionSummary struct {
	Emoji   string  `json:"emoji"`
	Count   int     `json:"count"`
	UserIDs []int64 `json:"userIds"` // Who reacted with this emoji
	Reacted bool    `json:"reacted"` // Did current user react?
}

// ToggleReactionRequest for adding/removing reactions
type ToggleReactionRequest struct {
	Emoji string `json:"emoji"`
}

// ToggleReactionResponse for toggle reaction endpoint
type ToggleReactionResponse struct {
	Added    bool      `json:"added"`    // true if added, false if removed
	Reaction *Reaction `json:"reaction"` // The reaction (only if added)
}
