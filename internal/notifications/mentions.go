package notifications

import (
	"context"
	"database/sql"
	"fmt"
	"regexp"

	db "sarray-forge/internal/db/sqlc"
	"sarray-forge/internal/models"
	"sarray-forge/internal/websocket"
)

// mentionRegex matches @username patterns
// Supports alphanumeric usernames with underscores
var mentionRegex = regexp.MustCompile(`@(\w+)`)

// ExtractMentions parses @username mentions from content
// Returns a slice of unique usernames (lowercase)
func ExtractMentions(content string) []string {
	matches := mentionRegex.FindAllStringSubmatch(content, -1)
	seen := make(map[string]bool)
	var usernames []string

	for _, match := range matches {
		if len(match) > 1 {
			username := match[1]
			if !seen[username] {
				seen[username] = true
				usernames = append(usernames, username)
			}
		}
	}

	return usernames
}

// Service handles notification creation
type Service struct {
	db  *sql.DB
	hub *websocket.Hub
}

// NewService creates a new notification service
func NewService(database *sql.DB, hub *websocket.Hub) *Service {
	return &Service{
		db:  database,
		hub: hub,
	}
}

// CreateParams holds the parameters for creating a notification
type CreateParams struct {
	UserID           int64
	ActorID          int64
	NotificationType models.NotificationType
	EntityType       string
	EntityID         int64
	CommentID        *int64
	Title            string
	Message          string
}

// Create creates a notification and broadcasts it via WebSocket
func (s *Service) Create(ctx context.Context, params CreateParams) error {
	// Don't notify yourself
	if params.UserID == params.ActorID {
		return nil
	}

	queries := db.New(s.db)

	// Create the notification
	var commentID sql.NullInt64
	if params.CommentID != nil {
		commentID = sql.NullInt64{Int64: *params.CommentID, Valid: true}
	}

	notification, err := queries.CreateNotification(ctx, db.CreateNotificationParams{
		UserID:           params.UserID,
		ActorID:          params.ActorID,
		NotificationType: string(params.NotificationType),
		EntityType:       params.EntityType,
		EntityID:         params.EntityID,
		CommentID:        commentID,
		Title:            params.Title,
		Message:          params.Message,
	})
	if err != nil {
		return fmt.Errorf("failed to create notification: %w", err)
	}

	// Broadcast via WebSocket to the specific user
	s.hub.SendToUser(params.UserID, websocket.Event{
		Type:     websocket.EventNotificationCreated,
		Resource: websocket.ResourceNotification,
		ID:       notification.ID,
		UserID:   params.ActorID,
	})

	return nil
}

// CreateForComment creates notifications for a new comment
// Handles mentions, comment on owned entity, and comment on assigned issue
func (s *Service) CreateForComment(
	ctx context.Context,
	actorID int64,
	actorName string,
	entityType string,
	entityID int64,
	commentID int64,
	content string,
) error {
	queries := db.New(s.db)

	// Track who we've already notified to avoid duplicates
	notified := make(map[int64]bool)
	notified[actorID] = true // Don't notify the actor

	var entityTitle string
	var ownerID int64
	var assigneeID *int64

	// Get entity info based on type
	switch entityType {
	case "issue":
		issue, err := queries.GetIssueOwnerAndAssignee(ctx, entityID)
		if err != nil {
			return fmt.Errorf("failed to get issue info: %w", err)
		}
		entityTitle = issue.Title
		ownerID = issue.ReporterID
		if issue.AssigneeID.Valid {
			assigneeID = &issue.AssigneeID.Int64
		}

	case "doc":
		doc, err := queries.GetDocOwner(ctx, entityID)
		if err != nil {
			return fmt.Errorf("failed to get doc info: %w", err)
		}
		entityTitle = doc.Title
		ownerID = doc.AuthorID

	case "release":
		release, err := queries.GetReleaseOwner(ctx, entityID)
		if err != nil {
			return fmt.Errorf("failed to get release info: %w", err)
		}
		entityTitle = release.Title
		ownerID = release.AuthorID
	}

	// 1. Handle @mentions
	mentions := ExtractMentions(content)
	for _, username := range mentions {
		userID, err := queries.GetUserIDByUsername(ctx, username)
		if err != nil {
			continue // User not found, skip
		}

		if notified[userID] {
			continue
		}
		notified[userID] = true

		err = s.Create(ctx, CreateParams{
			UserID:           userID,
			ActorID:          actorID,
			NotificationType: models.NotificationTypeMention,
			EntityType:       entityType,
			EntityID:         entityID,
			CommentID:        &commentID,
			Title:            entityTitle,
			Message:          fmt.Sprintf("%s mentioned you", actorName),
		})
		if err != nil {
			// Log but continue
			continue
		}
	}

	// 2. Notify entity owner (reporter for issues, author for docs/releases)
	if !notified[ownerID] {
		notified[ownerID] = true
		entityTypeLabel := entityType
		if entityType == "issue" {
			entityTypeLabel = "issue"
		}

		_ = s.Create(ctx, CreateParams{
			UserID:           ownerID,
			ActorID:          actorID,
			NotificationType: models.NotificationTypeCommentOnOwned,
			EntityType:       entityType,
			EntityID:         entityID,
			CommentID:        &commentID,
			Title:            entityTitle,
			Message:          fmt.Sprintf("%s commented on your %s", actorName, entityTypeLabel),
		})
	}

	// 3. Notify assignee (issues only)
	if assigneeID != nil && !notified[*assigneeID] {
		notified[*assigneeID] = true

		_ = s.Create(ctx, CreateParams{
			UserID:           *assigneeID,
			ActorID:          actorID,
			NotificationType: models.NotificationTypeCommentOnAssigned,
			EntityType:       entityType,
			EntityID:         entityID,
			CommentID:        &commentID,
			Title:            entityTitle,
			Message:          fmt.Sprintf("%s commented on %s", actorName, entityTitle),
		})
	}

	return nil
}

// CreateForAssignment creates a notification when an issue is assigned
func (s *Service) CreateForAssignment(
	ctx context.Context,
	actorID int64,
	actorName string,
	issueID int64,
	newAssigneeID int64,
) error {
	queries := db.New(s.db)

	// Get issue info
	issue, err := queries.GetIssueOwnerAndAssignee(ctx, issueID)
	if err != nil {
		return fmt.Errorf("failed to get issue info: %w", err)
	}

	return s.Create(ctx, CreateParams{
		UserID:           newAssigneeID,
		ActorID:          actorID,
		NotificationType: models.NotificationTypeAssigned,
		EntityType:       "issue",
		EntityID:         issueID,
		Title:            issue.Title,
		Message:          fmt.Sprintf("%s assigned you", actorName),
	})
}

// CreateForContentMentions creates notifications for @mentions in entity content
// (issue description, doc content, release description)
// It compares old and new content to only notify for new mentions
func (s *Service) CreateForContentMentions(
	ctx context.Context,
	actorID int64,
	actorName string,
	entityType string,
	entityID int64,
	entityTitle string,
	oldContent string,
	newContent string,
) error {
	queries := db.New(s.db)

	// Extract mentions from old and new content
	oldMentions := make(map[string]bool)
	for _, username := range ExtractMentions(oldContent) {
		oldMentions[username] = true
	}

	newMentions := ExtractMentions(newContent)

	// Only notify for NEW mentions (not in old content)
	for _, username := range newMentions {
		if oldMentions[username] {
			continue // Already mentioned before
		}

		userID, err := queries.GetUserIDByUsername(ctx, username)
		if err != nil {
			continue // User not found, skip
		}

		// Don't notify yourself
		if userID == actorID {
			continue
		}

		err = s.Create(ctx, CreateParams{
			UserID:           userID,
			ActorID:          actorID,
			NotificationType: models.NotificationTypeMention,
			EntityType:       entityType,
			EntityID:         entityID,
			Title:            entityTitle,
			Message:          fmt.Sprintf("%s mentioned you in %s", actorName, entityType),
		})
		if err != nil {
			// Log but continue
			continue
		}
	}

	return nil
}
