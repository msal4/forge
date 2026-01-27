package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	db "sarray-forge/internal/db/sqlc"
	"sarray-forge/internal/middleware"
	"sarray-forge/internal/models"
	"sarray-forge/internal/notifications"
	"sarray-forge/internal/websocket"
)

// Allowed emojis for reactions (GitHub-style)
var allowedEmojis = map[string]bool{
	"👍":  true,
	"👎":  true,
	"😄":  true,
	"🎉":  true,
	"😕":  true,
	"❤️": true,
	"🚀":  true,
	"👀":  true,
}

// validateEmoji checks if the emoji is allowed
func validateEmoji(emoji string) bool {
	return allowedEmojis[emoji]
}

// ============================================
// Issue Reaction Handlers
// ============================================

// ListIssueReactions handles GET /api/issues/{id}/reactions
func (h *Handlers) ListIssueReactions(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	issueID, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_id", "Invalid issue ID")
		return
	}

	queries := db.New(h.db.DB)
	rows, err := queries.ListReactionsByIssue(context.Background(), sql.NullInt64{Int64: issueID, Valid: true})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to fetch reactions")
		return
	}

	reactions := make([]models.Reaction, len(rows))
	for i, row := range rows {
		issueIDVal := row.IssueID.Int64
		reactions[i] = models.Reaction{
			ID:        row.ID,
			UserID:    row.UserID,
			Emoji:     row.Emoji,
			IssueID:   &issueIDVal,
			CreatedAt: row.CreatedAt,
			User: &models.User{
				ID:        row.UserID,
				Username:  row.Username,
				FullName:  row.FullName,
				AvatarURL: row.AvatarUrl.String,
			},
		}
	}

	writeJSON(w, http.StatusOK, reactions)
}

// ToggleIssueReaction handles POST /api/issues/{id}/reactions
func (h *Handlers) ToggleIssueReaction(w http.ResponseWriter, r *http.Request) {
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

	var req models.ToggleReactionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", "Invalid request body")
		return
	}

	if !validateEmoji(req.Emoji) {
		writeError(w, http.StatusBadRequest, "invalid_emoji", "Invalid emoji. Allowed: 👍 👎 😄 🎉 😕 ❤️ 🚀 👀")
		return
	}

	queries := db.New(h.db.DB)
	issueIDNull := sql.NullInt64{Int64: issueID, Valid: true}

	// Check if reaction already exists
	_, err = queries.GetReactionOnIssue(context.Background(), db.GetReactionOnIssueParams{
		UserID:  userID,
		Emoji:   req.Emoji,
		IssueID: issueIDNull,
	})

	if err == sql.ErrNoRows {
		// Add reaction
		reaction, err := queries.CreateReactionOnIssue(context.Background(), db.CreateReactionOnIssueParams{
			UserID:  userID,
			Emoji:   req.Emoji,
			IssueID: issueIDNull,
		})
		if err != nil {
			writeError(w, http.StatusInternalServerError, "db_error", "Failed to add reaction")
			return
		}

		// Broadcast WebSocket event
		h.hub.Broadcast(websocket.Event{
			Type:     websocket.EventReactionAdded,
			Resource: websocket.ResourceReaction,
			ID:       reaction.ID,
			Data:     map[string]interface{}{"issueId": issueID, "emoji": req.Emoji},
			UserID:   userID,
		})

		// Create notification for issue owner (if not self)
		// Use background context since this runs in a goroutine after the HTTP response completes
		go h.notifyReaction(context.Background(), userID, "issue", issueID, req.Emoji)

		issueIDVal := reaction.IssueID.Int64
		writeJSON(w, http.StatusCreated, models.ToggleReactionResponse{
			Added: true,
			Reaction: &models.Reaction{
				ID:        reaction.ID,
				UserID:    reaction.UserID,
				Emoji:     reaction.Emoji,
				IssueID:   &issueIDVal,
				CreatedAt: reaction.CreatedAt,
			},
		})
	} else if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to check reaction")
		return
	} else {
		// Remove reaction
		_, err = queries.DeleteReactionFromIssue(context.Background(), db.DeleteReactionFromIssueParams{
			UserID:  userID,
			Emoji:   req.Emoji,
			IssueID: issueIDNull,
		})
		if err != nil {
			writeError(w, http.StatusInternalServerError, "db_error", "Failed to remove reaction")
			return
		}

		// Broadcast WebSocket event
		h.hub.Broadcast(websocket.Event{
			Type:     websocket.EventReactionRemoved,
			Resource: websocket.ResourceReaction,
			ID:       0,
			Data:     map[string]interface{}{"issueId": issueID, "emoji": req.Emoji},
			UserID:   userID,
		})

		writeJSON(w, http.StatusOK, models.ToggleReactionResponse{
			Added:    false,
			Reaction: nil,
		})
	}
}

// ============================================
// Doc Reaction Handlers
// ============================================

// ListDocReactions handles GET /api/docs/{id}/reactions
func (h *Handlers) ListDocReactions(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	docID, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_id", "Invalid doc ID")
		return
	}

	queries := db.New(h.db.DB)
	rows, err := queries.ListReactionsByDoc(context.Background(), sql.NullInt64{Int64: docID, Valid: true})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to fetch reactions")
		return
	}

	reactions := make([]models.Reaction, len(rows))
	for i, row := range rows {
		docIDVal := row.DocID.Int64
		reactions[i] = models.Reaction{
			ID:        row.ID,
			UserID:    row.UserID,
			Emoji:     row.Emoji,
			DocID:     &docIDVal,
			CreatedAt: row.CreatedAt,
			User: &models.User{
				ID:        row.UserID,
				Username:  row.Username,
				FullName:  row.FullName,
				AvatarURL: row.AvatarUrl.String,
			},
		}
	}

	writeJSON(w, http.StatusOK, reactions)
}

// ToggleDocReaction handles POST /api/docs/{id}/reactions
func (h *Handlers) ToggleDocReaction(w http.ResponseWriter, r *http.Request) {
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

	var req models.ToggleReactionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", "Invalid request body")
		return
	}

	if !validateEmoji(req.Emoji) {
		writeError(w, http.StatusBadRequest, "invalid_emoji", "Invalid emoji. Allowed: 👍 👎 😄 🎉 😕 ❤️ 🚀 👀")
		return
	}

	queries := db.New(h.db.DB)
	docIDNull := sql.NullInt64{Int64: docID, Valid: true}

	// Check if reaction already exists
	_, err = queries.GetReactionOnDoc(context.Background(), db.GetReactionOnDocParams{
		UserID: userID,
		Emoji:  req.Emoji,
		DocID:  docIDNull,
	})

	if err == sql.ErrNoRows {
		// Add reaction
		reaction, err := queries.CreateReactionOnDoc(context.Background(), db.CreateReactionOnDocParams{
			UserID: userID,
			Emoji:  req.Emoji,
			DocID:  docIDNull,
		})
		if err != nil {
			writeError(w, http.StatusInternalServerError, "db_error", "Failed to add reaction")
			return
		}

		// Broadcast WebSocket event
		h.hub.Broadcast(websocket.Event{
			Type:     websocket.EventReactionAdded,
			Resource: websocket.ResourceReaction,
			ID:       reaction.ID,
			Data:     map[string]interface{}{"docId": docID, "emoji": req.Emoji},
			UserID:   userID,
		})

		// Create notification for doc owner
		// Use background context since this runs in a goroutine after the HTTP response completes
		go h.notifyReaction(context.Background(), userID, "doc", docID, req.Emoji)

		docIDVal := reaction.DocID.Int64
		writeJSON(w, http.StatusCreated, models.ToggleReactionResponse{
			Added: true,
			Reaction: &models.Reaction{
				ID:        reaction.ID,
				UserID:    reaction.UserID,
				Emoji:     reaction.Emoji,
				DocID:     &docIDVal,
				CreatedAt: reaction.CreatedAt,
			},
		})
	} else if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to check reaction")
		return
	} else {
		// Remove reaction
		_, err = queries.DeleteReactionFromDoc(context.Background(), db.DeleteReactionFromDocParams{
			UserID: userID,
			Emoji:  req.Emoji,
			DocID:  docIDNull,
		})
		if err != nil {
			writeError(w, http.StatusInternalServerError, "db_error", "Failed to remove reaction")
			return
		}

		// Broadcast WebSocket event
		h.hub.Broadcast(websocket.Event{
			Type:     websocket.EventReactionRemoved,
			Resource: websocket.ResourceReaction,
			ID:       0,
			Data:     map[string]interface{}{"docId": docID, "emoji": req.Emoji},
			UserID:   userID,
		})

		writeJSON(w, http.StatusOK, models.ToggleReactionResponse{
			Added:    false,
			Reaction: nil,
		})
	}
}

// ============================================
// Release Reaction Handlers
// ============================================

// ListReleaseReactions handles GET /api/releases/{id}/reactions
func (h *Handlers) ListReleaseReactions(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	releaseID, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_id", "Invalid release ID")
		return
	}

	queries := db.New(h.db.DB)
	rows, err := queries.ListReactionsByRelease(context.Background(), sql.NullInt64{Int64: releaseID, Valid: true})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to fetch reactions")
		return
	}

	reactions := make([]models.Reaction, len(rows))
	for i, row := range rows {
		releaseIDVal := row.ReleaseID.Int64
		reactions[i] = models.Reaction{
			ID:        row.ID,
			UserID:    row.UserID,
			Emoji:     row.Emoji,
			ReleaseID: &releaseIDVal,
			CreatedAt: row.CreatedAt,
			User: &models.User{
				ID:        row.UserID,
				Username:  row.Username,
				FullName:  row.FullName,
				AvatarURL: row.AvatarUrl.String,
			},
		}
	}

	writeJSON(w, http.StatusOK, reactions)
}

// ToggleReleaseReaction handles POST /api/releases/{id}/reactions
func (h *Handlers) ToggleReleaseReaction(w http.ResponseWriter, r *http.Request) {
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

	var req models.ToggleReactionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", "Invalid request body")
		return
	}

	if !validateEmoji(req.Emoji) {
		writeError(w, http.StatusBadRequest, "invalid_emoji", "Invalid emoji. Allowed: 👍 👎 😄 🎉 😕 ❤️ 🚀 👀")
		return
	}

	queries := db.New(h.db.DB)
	releaseIDNull := sql.NullInt64{Int64: releaseID, Valid: true}

	// Check if reaction already exists
	_, err = queries.GetReactionOnRelease(context.Background(), db.GetReactionOnReleaseParams{
		UserID:    userID,
		Emoji:     req.Emoji,
		ReleaseID: releaseIDNull,
	})

	if err == sql.ErrNoRows {
		// Add reaction
		reaction, err := queries.CreateReactionOnRelease(context.Background(), db.CreateReactionOnReleaseParams{
			UserID:    userID,
			Emoji:     req.Emoji,
			ReleaseID: releaseIDNull,
		})
		if err != nil {
			writeError(w, http.StatusInternalServerError, "db_error", "Failed to add reaction")
			return
		}

		// Broadcast WebSocket event
		h.hub.Broadcast(websocket.Event{
			Type:     websocket.EventReactionAdded,
			Resource: websocket.ResourceReaction,
			ID:       reaction.ID,
			Data:     map[string]interface{}{"releaseId": releaseID, "emoji": req.Emoji},
			UserID:   userID,
		})

		// Create notification for release owner
		// Use background context since this runs in a goroutine after the HTTP response completes
		go h.notifyReaction(context.Background(), userID, "release", releaseID, req.Emoji)

		releaseIDVal := reaction.ReleaseID.Int64
		writeJSON(w, http.StatusCreated, models.ToggleReactionResponse{
			Added: true,
			Reaction: &models.Reaction{
				ID:        reaction.ID,
				UserID:    reaction.UserID,
				Emoji:     reaction.Emoji,
				ReleaseID: &releaseIDVal,
				CreatedAt: reaction.CreatedAt,
			},
		})
	} else if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to check reaction")
		return
	} else {
		// Remove reaction
		_, err = queries.DeleteReactionFromRelease(context.Background(), db.DeleteReactionFromReleaseParams{
			UserID:    userID,
			Emoji:     req.Emoji,
			ReleaseID: releaseIDNull,
		})
		if err != nil {
			writeError(w, http.StatusInternalServerError, "db_error", "Failed to remove reaction")
			return
		}

		// Broadcast WebSocket event
		h.hub.Broadcast(websocket.Event{
			Type:     websocket.EventReactionRemoved,
			Resource: websocket.ResourceReaction,
			ID:       0,
			Data:     map[string]interface{}{"releaseId": releaseID, "emoji": req.Emoji},
			UserID:   userID,
		})

		writeJSON(w, http.StatusOK, models.ToggleReactionResponse{
			Added:    false,
			Reaction: nil,
		})
	}
}

// ============================================
// Issue Comment Reaction Handlers
// ============================================

// ListIssueCommentReactions handles GET /api/issues/{issueId}/comments/{commentId}/reactions
func (h *Handlers) ListIssueCommentReactions(w http.ResponseWriter, r *http.Request) {
	commentIDStr := r.PathValue("commentId")
	commentID, err := strconv.ParseInt(commentIDStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_id", "Invalid comment ID")
		return
	}

	queries := db.New(h.db.DB)
	rows, err := queries.ListReactionsByIssueComment(context.Background(), sql.NullInt64{Int64: commentID, Valid: true})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to fetch reactions")
		return
	}

	reactions := make([]models.Reaction, len(rows))
	for i, row := range rows {
		commentIDVal := row.IssueCommentID.Int64
		reactions[i] = models.Reaction{
			ID:             row.ID,
			UserID:         row.UserID,
			Emoji:          row.Emoji,
			IssueCommentID: &commentIDVal,
			CreatedAt:      row.CreatedAt,
			User: &models.User{
				ID:        row.UserID,
				Username:  row.Username,
				FullName:  row.FullName,
				AvatarURL: row.AvatarUrl.String,
			},
		}
	}

	writeJSON(w, http.StatusOK, reactions)
}

// ToggleIssueCommentReaction handles POST /api/issues/{issueId}/comments/{commentId}/reactions
func (h *Handlers) ToggleIssueCommentReaction(w http.ResponseWriter, r *http.Request) {
	userID, _, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Not authenticated")
		return
	}

	issueIDStr := r.PathValue("id")
	issueID, err := strconv.ParseInt(issueIDStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_id", "Invalid issue ID")
		return
	}

	commentIDStr := r.PathValue("commentId")
	commentID, err := strconv.ParseInt(commentIDStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_id", "Invalid comment ID")
		return
	}

	var req models.ToggleReactionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", "Invalid request body")
		return
	}

	if !validateEmoji(req.Emoji) {
		writeError(w, http.StatusBadRequest, "invalid_emoji", "Invalid emoji. Allowed: 👍 👎 😄 🎉 😕 ❤️ 🚀 👀")
		return
	}

	queries := db.New(h.db.DB)
	commentIDNull := sql.NullInt64{Int64: commentID, Valid: true}

	// Check if reaction already exists
	_, err = queries.GetReactionOnIssueComment(context.Background(), db.GetReactionOnIssueCommentParams{
		UserID:         userID,
		Emoji:          req.Emoji,
		IssueCommentID: commentIDNull,
	})

	if err == sql.ErrNoRows {
		// Add reaction
		reaction, err := queries.CreateReactionOnIssueComment(context.Background(), db.CreateReactionOnIssueCommentParams{
			UserID:         userID,
			Emoji:          req.Emoji,
			IssueCommentID: commentIDNull,
		})
		if err != nil {
			writeError(w, http.StatusInternalServerError, "db_error", "Failed to add reaction")
			return
		}

		// Broadcast WebSocket event
		h.hub.Broadcast(websocket.Event{
			Type:     websocket.EventReactionAdded,
			Resource: websocket.ResourceReaction,
			ID:       reaction.ID,
			Data:     map[string]interface{}{"issueId": issueID, "issueCommentId": commentID, "emoji": req.Emoji},
			UserID:   userID,
		})

		// Create notification for comment owner
		// Use background context since this runs in a goroutine after the HTTP response completes
		go h.notifyCommentReaction(context.Background(), userID, "issue", commentID, req.Emoji)

		commentIDVal := reaction.IssueCommentID.Int64
		writeJSON(w, http.StatusCreated, models.ToggleReactionResponse{
			Added: true,
			Reaction: &models.Reaction{
				ID:             reaction.ID,
				UserID:         reaction.UserID,
				Emoji:          reaction.Emoji,
				IssueCommentID: &commentIDVal,
				CreatedAt:      reaction.CreatedAt,
			},
		})
	} else if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to check reaction")
		return
	} else {
		// Remove reaction
		_, err = queries.DeleteReactionFromIssueComment(context.Background(), db.DeleteReactionFromIssueCommentParams{
			UserID:         userID,
			Emoji:          req.Emoji,
			IssueCommentID: commentIDNull,
		})
		if err != nil {
			writeError(w, http.StatusInternalServerError, "db_error", "Failed to remove reaction")
			return
		}

		// Broadcast WebSocket event
		h.hub.Broadcast(websocket.Event{
			Type:     websocket.EventReactionRemoved,
			Resource: websocket.ResourceReaction,
			ID:       0,
			Data:     map[string]interface{}{"issueId": issueID, "issueCommentId": commentID, "emoji": req.Emoji},
			UserID:   userID,
		})

		writeJSON(w, http.StatusOK, models.ToggleReactionResponse{
			Added:    false,
			Reaction: nil,
		})
	}
}

// ============================================
// Doc Comment Reaction Handlers
// ============================================

// ListDocCommentReactions handles GET /api/docs/{docId}/comments/{commentId}/reactions
func (h *Handlers) ListDocCommentReactions(w http.ResponseWriter, r *http.Request) {
	commentIDStr := r.PathValue("commentId")
	commentID, err := strconv.ParseInt(commentIDStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_id", "Invalid comment ID")
		return
	}

	queries := db.New(h.db.DB)
	rows, err := queries.ListReactionsByDocComment(context.Background(), sql.NullInt64{Int64: commentID, Valid: true})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to fetch reactions")
		return
	}

	reactions := make([]models.Reaction, len(rows))
	for i, row := range rows {
		commentIDVal := row.DocCommentID.Int64
		reactions[i] = models.Reaction{
			ID:           row.ID,
			UserID:       row.UserID,
			Emoji:        row.Emoji,
			DocCommentID: &commentIDVal,
			CreatedAt:    row.CreatedAt,
			User: &models.User{
				ID:        row.UserID,
				Username:  row.Username,
				FullName:  row.FullName,
				AvatarURL: row.AvatarUrl.String,
			},
		}
	}

	writeJSON(w, http.StatusOK, reactions)
}

// ToggleDocCommentReaction handles POST /api/docs/{docId}/comments/{commentId}/reactions
func (h *Handlers) ToggleDocCommentReaction(w http.ResponseWriter, r *http.Request) {
	userID, _, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Not authenticated")
		return
	}

	docIDStr := r.PathValue("id")
	docID, err := strconv.ParseInt(docIDStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_id", "Invalid doc ID")
		return
	}

	commentIDStr := r.PathValue("commentId")
	commentID, err := strconv.ParseInt(commentIDStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_id", "Invalid comment ID")
		return
	}

	var req models.ToggleReactionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", "Invalid request body")
		return
	}

	if !validateEmoji(req.Emoji) {
		writeError(w, http.StatusBadRequest, "invalid_emoji", "Invalid emoji. Allowed: 👍 👎 😄 🎉 😕 ❤️ 🚀 👀")
		return
	}

	queries := db.New(h.db.DB)
	commentIDNull := sql.NullInt64{Int64: commentID, Valid: true}

	// Check if reaction already exists
	_, err = queries.GetReactionOnDocComment(context.Background(), db.GetReactionOnDocCommentParams{
		UserID:       userID,
		Emoji:        req.Emoji,
		DocCommentID: commentIDNull,
	})

	if err == sql.ErrNoRows {
		// Add reaction
		reaction, err := queries.CreateReactionOnDocComment(context.Background(), db.CreateReactionOnDocCommentParams{
			UserID:       userID,
			Emoji:        req.Emoji,
			DocCommentID: commentIDNull,
		})
		if err != nil {
			writeError(w, http.StatusInternalServerError, "db_error", "Failed to add reaction")
			return
		}

		// Broadcast WebSocket event
		h.hub.Broadcast(websocket.Event{
			Type:     websocket.EventReactionAdded,
			Resource: websocket.ResourceReaction,
			ID:       reaction.ID,
			Data:     map[string]interface{}{"docId": docID, "docCommentId": commentID, "emoji": req.Emoji},
			UserID:   userID,
		})

		// Create notification for comment owner
		// Use background context since this runs in a goroutine after the HTTP response completes
		go h.notifyCommentReaction(context.Background(), userID, "doc", commentID, req.Emoji)

		commentIDVal := reaction.DocCommentID.Int64
		writeJSON(w, http.StatusCreated, models.ToggleReactionResponse{
			Added: true,
			Reaction: &models.Reaction{
				ID:           reaction.ID,
				UserID:       reaction.UserID,
				Emoji:        reaction.Emoji,
				DocCommentID: &commentIDVal,
				CreatedAt:    reaction.CreatedAt,
			},
		})
	} else if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to check reaction")
		return
	} else {
		// Remove reaction
		_, err = queries.DeleteReactionFromDocComment(context.Background(), db.DeleteReactionFromDocCommentParams{
			UserID:       userID,
			Emoji:        req.Emoji,
			DocCommentID: commentIDNull,
		})
		if err != nil {
			writeError(w, http.StatusInternalServerError, "db_error", "Failed to remove reaction")
			return
		}

		// Broadcast WebSocket event
		h.hub.Broadcast(websocket.Event{
			Type:     websocket.EventReactionRemoved,
			Resource: websocket.ResourceReaction,
			ID:       0,
			Data:     map[string]interface{}{"docId": docID, "docCommentId": commentID, "emoji": req.Emoji},
			UserID:   userID,
		})

		writeJSON(w, http.StatusOK, models.ToggleReactionResponse{
			Added:    false,
			Reaction: nil,
		})
	}
}

// ============================================
// Release Comment Reaction Handlers
// ============================================

// ListReleaseCommentReactions handles GET /api/releases/{releaseId}/comments/{commentId}/reactions
func (h *Handlers) ListReleaseCommentReactions(w http.ResponseWriter, r *http.Request) {
	commentIDStr := r.PathValue("commentId")
	commentID, err := strconv.ParseInt(commentIDStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_id", "Invalid comment ID")
		return
	}

	queries := db.New(h.db.DB)
	rows, err := queries.ListReactionsByReleaseComment(context.Background(), sql.NullInt64{Int64: commentID, Valid: true})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to fetch reactions")
		return
	}

	reactions := make([]models.Reaction, len(rows))
	for i, row := range rows {
		commentIDVal := row.ReleaseCommentID.Int64
		reactions[i] = models.Reaction{
			ID:               row.ID,
			UserID:           row.UserID,
			Emoji:            row.Emoji,
			ReleaseCommentID: &commentIDVal,
			CreatedAt:        row.CreatedAt,
			User: &models.User{
				ID:        row.UserID,
				Username:  row.Username,
				FullName:  row.FullName,
				AvatarURL: row.AvatarUrl.String,
			},
		}
	}

	writeJSON(w, http.StatusOK, reactions)
}

// ToggleReleaseCommentReaction handles POST /api/releases/{releaseId}/comments/{commentId}/reactions
func (h *Handlers) ToggleReleaseCommentReaction(w http.ResponseWriter, r *http.Request) {
	userID, _, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Not authenticated")
		return
	}

	releaseIDStr := r.PathValue("id")
	releaseID, err := strconv.ParseInt(releaseIDStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_id", "Invalid release ID")
		return
	}

	commentIDStr := r.PathValue("commentId")
	commentID, err := strconv.ParseInt(commentIDStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_id", "Invalid comment ID")
		return
	}

	var req models.ToggleReactionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", "Invalid request body")
		return
	}

	if !validateEmoji(req.Emoji) {
		writeError(w, http.StatusBadRequest, "invalid_emoji", "Invalid emoji. Allowed: 👍 👎 😄 🎉 😕 ❤️ 🚀 👀")
		return
	}

	queries := db.New(h.db.DB)
	commentIDNull := sql.NullInt64{Int64: commentID, Valid: true}

	// Check if reaction already exists
	_, err = queries.GetReactionOnReleaseComment(context.Background(), db.GetReactionOnReleaseCommentParams{
		UserID:           userID,
		Emoji:            req.Emoji,
		ReleaseCommentID: commentIDNull,
	})

	if err == sql.ErrNoRows {
		// Add reaction
		reaction, err := queries.CreateReactionOnReleaseComment(context.Background(), db.CreateReactionOnReleaseCommentParams{
			UserID:           userID,
			Emoji:            req.Emoji,
			ReleaseCommentID: commentIDNull,
		})
		if err != nil {
			writeError(w, http.StatusInternalServerError, "db_error", "Failed to add reaction")
			return
		}

		// Broadcast WebSocket event
		h.hub.Broadcast(websocket.Event{
			Type:     websocket.EventReactionAdded,
			Resource: websocket.ResourceReaction,
			ID:       reaction.ID,
			Data:     map[string]interface{}{"releaseId": releaseID, "releaseCommentId": commentID, "emoji": req.Emoji},
			UserID:   userID,
		})

		// Create notification for comment owner
		// Use background context since this runs in a goroutine after the HTTP response completes
		go h.notifyCommentReaction(context.Background(), userID, "release", commentID, req.Emoji)

		commentIDVal := reaction.ReleaseCommentID.Int64
		writeJSON(w, http.StatusCreated, models.ToggleReactionResponse{
			Added: true,
			Reaction: &models.Reaction{
				ID:               reaction.ID,
				UserID:           reaction.UserID,
				Emoji:            reaction.Emoji,
				ReleaseCommentID: &commentIDVal,
				CreatedAt:        reaction.CreatedAt,
			},
		})
	} else if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to check reaction")
		return
	} else {
		// Remove reaction
		_, err = queries.DeleteReactionFromReleaseComment(context.Background(), db.DeleteReactionFromReleaseCommentParams{
			UserID:           userID,
			Emoji:            req.Emoji,
			ReleaseCommentID: commentIDNull,
		})
		if err != nil {
			writeError(w, http.StatusInternalServerError, "db_error", "Failed to remove reaction")
			return
		}

		// Broadcast WebSocket event
		h.hub.Broadcast(websocket.Event{
			Type:     websocket.EventReactionRemoved,
			Resource: websocket.ResourceReaction,
			ID:       0,
			Data:     map[string]interface{}{"releaseId": releaseID, "releaseCommentId": commentID, "emoji": req.Emoji},
			UserID:   userID,
		})

		writeJSON(w, http.StatusOK, models.ToggleReactionResponse{
			Added:    false,
			Reaction: nil,
		})
	}
}

// ============================================
// Notification Helpers
// ============================================

// notifyReaction creates a notification for a reaction on an entity (issue/doc/release)
func (h *Handlers) notifyReaction(ctx context.Context, actorID int64, entityType string, entityID int64, emoji string) {
	queries := db.New(h.db.DB)

	var ownerID int64
	var entityTitle string

	switch entityType {
	case "issue":
		issue, err := queries.GetIssueOwnerAndAssignee(ctx, entityID)
		if err != nil {
			return
		}
		ownerID = issue.ReporterID
		entityTitle = issue.Title

	case "doc":
		doc, err := queries.GetDocOwner(ctx, entityID)
		if err != nil {
			return
		}
		ownerID = doc.AuthorID
		entityTitle = doc.Title

	case "release":
		release, err := queries.GetReleaseOwner(ctx, entityID)
		if err != nil {
			return
		}
		ownerID = release.AuthorID
		entityTitle = release.Title

	default:
		return
	}

	// Get actor name
	var actorName string
	h.db.QueryRow("SELECT COALESCE(full_name, username) FROM users WHERE id = ?", actorID).Scan(&actorName)

	// Create notification
	h.Notification.Create(ctx, notifications.CreateParams{
		UserID:           ownerID,
		ActorID:          actorID,
		ActorName:        actorName,
		NotificationType: models.NotificationTypeReaction,
		EntityType:       entityType,
		EntityID:         entityID,
		Title:            entityTitle,
		Message:          fmt.Sprintf("%s reacted with %s", actorName, emoji),
	})
}

// notifyCommentReaction creates a notification for a reaction on a comment
func (h *Handlers) notifyCommentReaction(ctx context.Context, actorID int64, commentType string, commentID int64, emoji string) {
	var ownerID int64
	var entityType string
	var entityID int64
	var entityTitle string

	switch commentType {
	case "issue":
		var issueID int64
		err := h.db.QueryRow(`
			SELECT c.author_id, c.issue_id, i.title 
			FROM issue_comments c 
			JOIN issues i ON c.issue_id = i.id 
			WHERE c.id = ?
		`, commentID).Scan(&ownerID, &issueID, &entityTitle)
		if err != nil {
			return
		}
		entityType = "issue"
		entityID = issueID

	case "doc":
		var docID int64
		err := h.db.QueryRow(`
			SELECT c.author_id, c.doc_id, d.title 
			FROM doc_comments c 
			JOIN docs d ON c.doc_id = d.id 
			WHERE c.id = ?
		`, commentID).Scan(&ownerID, &docID, &entityTitle)
		if err != nil {
			return
		}
		entityType = "doc"
		entityID = docID

	case "release":
		var releaseID int64
		err := h.db.QueryRow(`
			SELECT c.author_id, c.release_id, r.title 
			FROM release_comments c 
			JOIN releases r ON c.release_id = r.id 
			WHERE c.id = ?
		`, commentID).Scan(&ownerID, &releaseID, &entityTitle)
		if err != nil {
			return
		}
		entityType = "release"
		entityID = releaseID
	}

	// Get actor name
	var actorName string
	h.db.QueryRow("SELECT COALESCE(full_name, username) FROM users WHERE id = ?", actorID).Scan(&actorName)

	// Create notification
	h.Notification.Create(ctx, notifications.CreateParams{
		UserID:           ownerID,
		ActorID:          actorID,
		ActorName:        actorName,
		NotificationType: models.NotificationTypeReaction,
		EntityType:       entityType,
		EntityID:         entityID,
		CommentID:        &commentID,
		Title:            entityTitle,
		Message:          fmt.Sprintf("%s reacted with %s to your comment", actorName, emoji),
	})
}
