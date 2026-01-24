package handlers

import (
	"context"
	"net/http"
	"strconv"

	db "sarray-forge/internal/db/sqlc"
	"sarray-forge/internal/middleware"
	"sarray-forge/internal/models"
)

// ============================================
// Notification Handlers
// ============================================

// ListNotifications handles GET /api/notifications
func (h *Handlers) ListNotifications(w http.ResponseWriter, r *http.Request) {
	userID, _, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Not authenticated")
		return
	}

	// Default limit of 50 notifications
	limit := int64(50)
	if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
		if parsed, err := strconv.ParseInt(limitStr, 10, 64); err == nil && parsed > 0 && parsed <= 100 {
			limit = parsed
		}
	}

	queries := db.New(h.db.DB)
	rows, err := queries.ListNotificationsByUser(context.Background(), db.ListNotificationsByUserParams{
		UserID: userID,
		Limit:  limit,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to fetch notifications")
		return
	}

	notifications := make([]models.Notification, len(rows))
	for i, row := range rows {
		var readAt *string
		if row.ReadAt.Valid {
			formatted := row.ReadAt.Time.Format("2006-01-02T15:04:05Z07:00")
			readAt = &formatted
		}

		var commentID *int64
		if row.CommentID.Valid {
			commentID = &row.CommentID.Int64
		}

		notifications[i] = models.Notification{
			ID:               row.ID,
			UserID:           row.UserID,
			ActorID:          row.ActorID,
			NotificationType: models.NotificationType(row.NotificationType),
			EntityType:       row.EntityType,
			EntityID:         row.EntityID,
			CommentID:        commentID,
			Title:            row.Title,
			Message:          row.Message,
			IsRead:           row.IsRead,
			CreatedAt:        row.CreatedAt,
			Actor: &models.User{
				ID:        row.ActorID,
				Username:  row.ActorUsername,
				FullName:  row.ActorFullName,
				AvatarURL: row.ActorAvatar.String,
			},
		}
		// Handle readAt separately since we already have the raw value
		if row.ReadAt.Valid {
			notifications[i].ReadAt = &row.ReadAt.Time
		}
		_ = readAt // avoid unused variable warning
	}

	writeJSON(w, http.StatusOK, notifications)
}

// GetUnreadCount handles GET /api/notifications/count
func (h *Handlers) GetUnreadCount(w http.ResponseWriter, r *http.Request) {
	userID, _, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Not authenticated")
		return
	}

	queries := db.New(h.db.DB)
	count, err := queries.CountUnreadNotifications(context.Background(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to count notifications")
		return
	}

	writeJSON(w, http.StatusOK, models.NotificationCount{Unread: count})
}

// MarkNotificationRead handles POST /api/notifications/{id}/read
func (h *Handlers) MarkNotificationRead(w http.ResponseWriter, r *http.Request) {
	userID, _, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Not authenticated")
		return
	}

	idStr := r.PathValue("id")
	notificationID, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_id", "Invalid notification ID")
		return
	}

	queries := db.New(h.db.DB)
	notification, err := queries.MarkNotificationRead(context.Background(), db.MarkNotificationReadParams{
		ID:     notificationID,
		UserID: userID,
	})
	if err != nil {
		writeError(w, http.StatusNotFound, "not_found", "Notification not found")
		return
	}

	var commentID *int64
	if notification.CommentID.Valid {
		commentID = &notification.CommentID.Int64
	}

	result := models.Notification{
		ID:               notification.ID,
		UserID:           notification.UserID,
		ActorID:          notification.ActorID,
		NotificationType: models.NotificationType(notification.NotificationType),
		EntityType:       notification.EntityType,
		EntityID:         notification.EntityID,
		CommentID:        commentID,
		Title:            notification.Title,
		Message:          notification.Message,
		IsRead:           notification.IsRead,
		CreatedAt:        notification.CreatedAt,
	}
	if notification.ReadAt.Valid {
		result.ReadAt = &notification.ReadAt.Time
	}

	writeJSON(w, http.StatusOK, result)
}

// MarkAllNotificationsRead handles POST /api/notifications/read-all
func (h *Handlers) MarkAllNotificationsRead(w http.ResponseWriter, r *http.Request) {
	userID, _, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Not authenticated")
		return
	}

	queries := db.New(h.db.DB)
	rowsAffected, err := queries.MarkAllNotificationsRead(context.Background(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to mark notifications as read")
		return
	}

	writeJSON(w, http.StatusOK, map[string]int64{"marked": rowsAffected})
}
