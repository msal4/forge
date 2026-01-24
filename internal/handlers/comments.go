package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"

	"sarray-forge/internal/db/sqlc"
	"sarray-forge/internal/middleware"
	"sarray-forge/internal/models"
	"sarray-forge/internal/websocket"
)

// ============================================
// Issue Comment Handlers
// ============================================

// ListIssueComments handles GET /api/issues/{id}/comments
func (h *Handlers) ListIssueComments(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	issueID, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_id", "Invalid issue ID")
		return
	}

	queries := db.New(h.db.DB)
	rows, err := queries.ListCommentsByIssue(context.Background(), issueID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to fetch comments")
		return
	}

	comments := make([]models.Comment, len(rows))
	for i, row := range rows {
		issueID := row.IssueID
		comments[i] = models.Comment{
			ID:        row.ID,
			IssueID:   &issueID,
			AuthorID:  row.AuthorID,
			Content:   row.Content,
			CreatedAt: row.CreatedAt,
			UpdatedAt: row.UpdatedAt,
			Author: &models.User{
				ID:        row.AuthorID,
				Username:  row.AuthorUsername,
				FullName:  row.AuthorFullName,
				AvatarURL: row.AuthorAvatar.String,
			},
		}
	}

	writeJSON(w, http.StatusOK, comments)
}

// CreateIssueComment handles POST /api/issues/{id}/comments
func (h *Handlers) CreateIssueComment(w http.ResponseWriter, r *http.Request) {
	userID, _, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Not authenticated")
		return
	}

	idStr := r.PathValue("id")
	issueID, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_id", "Invalid issue ID")
		return
	}

	var req models.CreateCommentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", "Invalid request body")
		return
	}

	if req.Content == "" {
		writeError(w, http.StatusBadRequest, "missing_content", "Content is required")
		return
	}

	queries := db.New(h.db.DB)
	row, err := queries.CreateComment(context.Background(), db.CreateCommentParams{
		IssueID:  issueID,
		AuthorID: userID,
		Content:  req.Content,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to create comment")
		return
	}

	// Fetch the comment with author info
	commentRow, err := queries.GetCommentByID(context.Background(), row.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to fetch created comment")
		return
	}

	comment := models.Comment{
		ID:        commentRow.ID,
		IssueID:   &issueID,
		AuthorID:  commentRow.AuthorID,
		Content:   commentRow.Content,
		CreatedAt: commentRow.CreatedAt,
		UpdatedAt: commentRow.UpdatedAt,
		Author: &models.User{
			ID:        commentRow.AuthorID,
			Username:  commentRow.AuthorUsername,
			FullName:  commentRow.AuthorFullName,
			AvatarURL: commentRow.AuthorAvatar.String,
		},
	}

	// Create notifications for mentions, owner, and assignee
	actorName := commentRow.AuthorFullName
	if actorName == "" {
		actorName = commentRow.AuthorUsername
	}
	h.Notification.CreateForComment(r.Context(), userID, actorName, "issue", issueID, comment.ID, req.Content)

	// Broadcast WebSocket event
	h.hub.Broadcast(websocket.Event{
		Type:     websocket.EventCommentCreated,
		Resource: websocket.ResourceComment,
		ID:       comment.ID,
		Data:     map[string]int64{"issueId": issueID},
		UserID:   userID,
	})

	writeJSON(w, http.StatusCreated, comment)
}

// DeleteIssueComment handles DELETE /api/issues/{issueId}/comments/{id}
func (h *Handlers) DeleteIssueComment(w http.ResponseWriter, r *http.Request) {
	userID, _, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Not authenticated")
		return
	}

	idStr := r.PathValue("commentId")
	commentID, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_id", "Invalid comment ID")
		return
	}

	issueIDStr := r.PathValue("id")
	issueID, err := strconv.ParseInt(issueIDStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_id", "Invalid issue ID")
		return
	}

	queries := db.New(h.db.DB)
	rowsAffected, err := queries.DeleteCommentByAuthor(context.Background(), db.DeleteCommentByAuthorParams{
		ID:       commentID,
		AuthorID: userID,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to delete comment")
		return
	}

	if rowsAffected == 0 {
		writeError(w, http.StatusForbidden, "forbidden", "Cannot delete this comment")
		return
	}

	// Broadcast WebSocket event
	h.hub.Broadcast(websocket.Event{
		Type:     websocket.EventCommentDeleted,
		Resource: websocket.ResourceComment,
		ID:       commentID,
		Data:     map[string]int64{"issueId": issueID},
		UserID:   userID,
	})

	writeJSON(w, http.StatusOK, map[string]string{"message": "Comment deleted"})
}

// ============================================
// Doc Comment Handlers
// ============================================

// ListDocComments handles GET /api/docs/{id}/comments
func (h *Handlers) ListDocComments(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	docID, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_id", "Invalid doc ID")
		return
	}

	queries := db.New(h.db.DB)
	rows, err := queries.ListCommentsByDoc(context.Background(), docID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to fetch comments")
		return
	}

	comments := make([]models.Comment, len(rows))
	for i, row := range rows {
		docID := row.DocID
		comments[i] = models.Comment{
			ID:        row.ID,
			DocID:     &docID,
			AuthorID:  row.AuthorID,
			Content:   row.Content,
			CreatedAt: row.CreatedAt,
			UpdatedAt: row.UpdatedAt,
			Author: &models.User{
				ID:        row.AuthorID,
				Username:  row.AuthorUsername,
				FullName:  row.AuthorFullName,
				AvatarURL: row.AuthorAvatar.String,
			},
		}
	}

	writeJSON(w, http.StatusOK, comments)
}

// CreateDocComment handles POST /api/docs/{id}/comments
func (h *Handlers) CreateDocComment(w http.ResponseWriter, r *http.Request) {
	userID, _, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Not authenticated")
		return
	}

	idStr := r.PathValue("id")
	docID, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_id", "Invalid doc ID")
		return
	}

	var req models.CreateCommentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", "Invalid request body")
		return
	}

	if req.Content == "" {
		writeError(w, http.StatusBadRequest, "missing_content", "Content is required")
		return
	}

	queries := db.New(h.db.DB)
	row, err := queries.CreateDocComment(context.Background(), db.CreateDocCommentParams{
		DocID:    docID,
		AuthorID: userID,
		Content:  req.Content,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to create comment")
		return
	}

	// Fetch the comment with author info
	commentRow, err := queries.GetDocCommentByID(context.Background(), row.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to fetch created comment")
		return
	}

	comment := models.Comment{
		ID:        commentRow.ID,
		DocID:     &docID,
		AuthorID:  commentRow.AuthorID,
		Content:   commentRow.Content,
		CreatedAt: commentRow.CreatedAt,
		UpdatedAt: commentRow.UpdatedAt,
		Author: &models.User{
			ID:        commentRow.AuthorID,
			Username:  commentRow.AuthorUsername,
			FullName:  commentRow.AuthorFullName,
			AvatarURL: commentRow.AuthorAvatar.String,
		},
	}

	// Create notifications for mentions and owner
	actorName := commentRow.AuthorFullName
	if actorName == "" {
		actorName = commentRow.AuthorUsername
	}
	h.Notification.CreateForComment(r.Context(), userID, actorName, "doc", docID, comment.ID, req.Content)

	// Broadcast WebSocket event
	h.hub.Broadcast(websocket.Event{
		Type:     websocket.EventCommentCreated,
		Resource: websocket.ResourceComment,
		ID:       comment.ID,
		Data:     map[string]int64{"docId": docID},
		UserID:   userID,
	})

	writeJSON(w, http.StatusCreated, comment)
}

// DeleteDocComment handles DELETE /api/docs/{docId}/comments/{id}
func (h *Handlers) DeleteDocComment(w http.ResponseWriter, r *http.Request) {
	userID, _, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Not authenticated")
		return
	}

	idStr := r.PathValue("commentId")
	commentID, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_id", "Invalid comment ID")
		return
	}

	docIDStr := r.PathValue("id")
	docID, err := strconv.ParseInt(docIDStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_id", "Invalid doc ID")
		return
	}

	queries := db.New(h.db.DB)
	rowsAffected, err := queries.DeleteDocCommentByAuthor(context.Background(), db.DeleteDocCommentByAuthorParams{
		ID:       commentID,
		AuthorID: userID,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to delete comment")
		return
	}

	if rowsAffected == 0 {
		writeError(w, http.StatusForbidden, "forbidden", "Cannot delete this comment")
		return
	}

	// Broadcast WebSocket event
	h.hub.Broadcast(websocket.Event{
		Type:     websocket.EventCommentDeleted,
		Resource: websocket.ResourceComment,
		ID:       commentID,
		Data:     map[string]int64{"docId": docID},
		UserID:   userID,
	})

	writeJSON(w, http.StatusOK, map[string]string{"message": "Comment deleted"})
}

// ============================================
// Release Comment Handlers
// ============================================

// ListReleaseComments handles GET /api/releases/{id}/comments
func (h *Handlers) ListReleaseComments(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	releaseID, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_id", "Invalid release ID")
		return
	}

	queries := db.New(h.db.DB)
	rows, err := queries.ListCommentsByRelease(context.Background(), releaseID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to fetch comments")
		return
	}

	comments := make([]models.Comment, len(rows))
	for i, row := range rows {
		releaseID := row.ReleaseID
		comments[i] = models.Comment{
			ID:        row.ID,
			ReleaseID: &releaseID,
			AuthorID:  row.AuthorID,
			Content:   row.Content,
			CreatedAt: row.CreatedAt,
			UpdatedAt: row.UpdatedAt,
			Author: &models.User{
				ID:        row.AuthorID,
				Username:  row.AuthorUsername,
				FullName:  row.AuthorFullName,
				AvatarURL: row.AuthorAvatar.String,
			},
		}
	}

	writeJSON(w, http.StatusOK, comments)
}

// CreateReleaseComment handles POST /api/releases/{id}/comments
func (h *Handlers) CreateReleaseComment(w http.ResponseWriter, r *http.Request) {
	userID, _, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Not authenticated")
		return
	}

	idStr := r.PathValue("id")
	releaseID, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_id", "Invalid release ID")
		return
	}

	var req models.CreateCommentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", "Invalid request body")
		return
	}

	if req.Content == "" {
		writeError(w, http.StatusBadRequest, "missing_content", "Content is required")
		return
	}

	queries := db.New(h.db.DB)
	row, err := queries.CreateReleaseComment(context.Background(), db.CreateReleaseCommentParams{
		ReleaseID: releaseID,
		AuthorID:  userID,
		Content:   req.Content,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to create comment")
		return
	}

	// Fetch the comment with author info
	commentRow, err := queries.GetReleaseCommentByID(context.Background(), row.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to fetch created comment")
		return
	}

	comment := models.Comment{
		ID:        commentRow.ID,
		ReleaseID: &releaseID,
		AuthorID:  commentRow.AuthorID,
		Content:   commentRow.Content,
		CreatedAt: commentRow.CreatedAt,
		UpdatedAt: commentRow.UpdatedAt,
		Author: &models.User{
			ID:        commentRow.AuthorID,
			Username:  commentRow.AuthorUsername,
			FullName:  commentRow.AuthorFullName,
			AvatarURL: commentRow.AuthorAvatar.String,
		},
	}

	// Create notifications for mentions and owner
	actorName := commentRow.AuthorFullName
	if actorName == "" {
		actorName = commentRow.AuthorUsername
	}
	h.Notification.CreateForComment(r.Context(), userID, actorName, "release", releaseID, comment.ID, req.Content)

	// Broadcast WebSocket event
	h.hub.Broadcast(websocket.Event{
		Type:     websocket.EventCommentCreated,
		Resource: websocket.ResourceComment,
		ID:       comment.ID,
		Data:     map[string]int64{"releaseId": releaseID},
		UserID:   userID,
	})

	writeJSON(w, http.StatusCreated, comment)
}

// DeleteReleaseComment handles DELETE /api/releases/{releaseId}/comments/{id}
func (h *Handlers) DeleteReleaseComment(w http.ResponseWriter, r *http.Request) {
	userID, _, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Not authenticated")
		return
	}

	idStr := r.PathValue("commentId")
	commentID, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_id", "Invalid comment ID")
		return
	}

	releaseIDStr := r.PathValue("id")
	releaseID, err := strconv.ParseInt(releaseIDStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_id", "Invalid release ID")
		return
	}

	queries := db.New(h.db.DB)
	rowsAffected, err := queries.DeleteReleaseCommentByAuthor(context.Background(), db.DeleteReleaseCommentByAuthorParams{
		ID:       commentID,
		AuthorID: userID,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to delete comment")
		return
	}

	if rowsAffected == 0 {
		writeError(w, http.StatusForbidden, "forbidden", "Cannot delete this comment")
		return
	}

	// Broadcast WebSocket event
	h.hub.Broadcast(websocket.Event{
		Type:     websocket.EventCommentDeleted,
		Resource: websocket.ResourceComment,
		ID:       commentID,
		Data:     map[string]int64{"releaseId": releaseID},
		UserID:   userID,
	})

	writeJSON(w, http.StatusOK, map[string]string{"message": "Comment deleted"})
}
