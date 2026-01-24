package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"

	"sarray-forge/internal/db"
	"sarray-forge/internal/middleware"
	"sarray-forge/internal/models"
	"sarray-forge/internal/websocket"

	gorillaws "github.com/gorilla/websocket"
)

// Handlers holds all HTTP handler dependencies
type Handlers struct {
	db  *db.DB
	hub *websocket.Hub
}

// New creates a new Handlers instance
func New(database *db.DB, hub *websocket.Hub) *Handlers {
	return &Handlers{db: database, hub: hub}
}

// WebSocket upgrader
var upgrader = gorillaws.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		// Allow all origins in development - in production, you'd want to restrict this
		return true
	},
}

// HandleWebSocket handles WebSocket connections at GET /api/ws
func (h *Handlers) HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	// Get user from context (set by auth middleware)
	userID, _, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	log.Printf("[WS] Upgrade request from user %d, Proto: %s, Headers: Connection=%s, Upgrade=%s",
		userID, r.Proto, r.Header.Get("Connection"), r.Header.Get("Upgrade"))

	// Upgrade HTTP connection to WebSocket
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("[WS] Upgrade failed: %v", err)
		return
	}
	log.Printf("[WS] Connection upgraded successfully for user %d", userID)

	// Create new client
	client := websocket.NewClient(h.hub, conn, userID)

	// Register client with hub
	h.hub.Register(client)

	// Start client goroutines
	go client.WritePump()
	go client.ReadPump()
}

// ============================================
// Health Check
// ============================================

// HealthCheck handles GET /api/health
func HealthCheck(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status":  "healthy",
		"service": "sarray-forge",
		"version": "0.1.0",
	})
}

// ============================================
// User Handlers
// ============================================

// GetCurrentUser handles GET /api/users/me
func (h *Handlers) GetCurrentUser(w http.ResponseWriter, r *http.Request) {
	userID, _, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Not authenticated")
		return
	}

	var user models.User
	err := h.db.QueryRow(`
		SELECT id, username, email, full_name, avatar_url, created_at, updated_at
		FROM users WHERE id = ?
	`, userID).Scan(
		&user.ID, &user.Username, &user.Email, &user.FullName,
		&user.AvatarURL, &user.CreatedAt, &user.UpdatedAt,
	)

	if err != nil {
		writeError(w, http.StatusNotFound, "not_found", "User not found")
		return
	}

	writeJSON(w, http.StatusOK, user)
}

// ListUsers handles GET /api/users
func (h *Handlers) ListUsers(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.Query(`
		SELECT id, username, email, full_name, avatar_url, created_at, updated_at
		FROM users ORDER BY username
	`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to fetch users")
		return
	}
	defer rows.Close()

	var users []models.User
	for rows.Next() {
		var user models.User
		if err := rows.Scan(
			&user.ID, &user.Username, &user.Email, &user.FullName,
			&user.AvatarURL, &user.CreatedAt, &user.UpdatedAt,
		); err != nil {
			continue
		}
		users = append(users, user)
	}

	writeJSON(w, http.StatusOK, users)
}

// ============================================
// Issue Handlers (The Tablet)
// ============================================

// ListIssues handles GET /api/issues
func (h *Handlers) ListIssues(w http.ResponseWriter, r *http.Request) {
	// Parse query parameters for filtering
	status := r.URL.Query().Get("status")
	assigneeID := r.URL.Query().Get("assignee_id")

	query := `
		SELECT i.id, i.title, i.description, i.status, i.priority,
		       i.assignee_id, i.reporter_id, i.labels, i.due_date,
		       i.created_at, i.updated_at,
		       COALESCE(a.username, ''), COALESCE(a.full_name, ''),
		       r.username, r.full_name
		FROM issues i
		LEFT JOIN users a ON i.assignee_id = a.id
		JOIN users r ON i.reporter_id = r.id
		WHERE 1=1
	`
	args := []interface{}{}

	if status != "" {
		query += " AND i.status = ?"
		args = append(args, status)
	}
	if assigneeID != "" {
		query += " AND i.assignee_id = ?"
		args = append(args, assigneeID)
	}

	query += " ORDER BY i.created_at DESC"

	rows, err := h.db.Query(query, args...)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to fetch issues")
		return
	}
	defer rows.Close()

	var issues []models.Issue
	for rows.Next() {
		var issue models.Issue
		var assigneeID *int64
		var assigneeUsername, assigneeFullName string
		var reporterUsername, reporterFullName string
		var labelsJSON string
		var dueDate *string

		if err := rows.Scan(
			&issue.ID, &issue.Title, &issue.Description, &issue.Status, &issue.Priority,
			&assigneeID, &issue.ReporterID, &labelsJSON, &dueDate,
			&issue.CreatedAt, &issue.UpdatedAt,
			&assigneeUsername, &assigneeFullName,
			&reporterUsername, &reporterFullName,
		); err != nil {
			continue
		}

		// Parse labels JSON
		json.Unmarshal([]byte(labelsJSON), &issue.Labels)
		if issue.Labels == nil {
			issue.Labels = []string{}
		}

		// Set assignee if present
		if assigneeID != nil {
			issue.AssigneeID = assigneeID
			issue.Assignee = &models.User{
				ID:       *assigneeID,
				Username: assigneeUsername,
				FullName: assigneeFullName,
			}
		}

		// Set reporter
		issue.Reporter = &models.User{
			ID:       issue.ReporterID,
			Username: reporterUsername,
			FullName: reporterFullName,
		}

		issues = append(issues, issue)
	}

	if issues == nil {
		issues = []models.Issue{}
	}

	writeJSON(w, http.StatusOK, issues)
}

// CreateIssue handles POST /api/issues
func (h *Handlers) CreateIssue(w http.ResponseWriter, r *http.Request) {
	userID, _, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Not authenticated")
		return
	}

	var req models.CreateIssueRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", "Invalid request body")
		return
	}

	if req.Title == "" {
		writeError(w, http.StatusBadRequest, "missing_title", "Title is required")
		return
	}

	// Default priority
	if req.Priority == "" {
		req.Priority = models.PriorityMedium
	}

	// Convert labels to JSON
	labelsJSON, _ := json.Marshal(req.Labels)
	if req.Labels == nil {
		labelsJSON = []byte("[]")
	}

	// Use project_id = 1 (default project) and issue_number = 0 (trigger will auto-assign)
	result, err := h.db.Exec(`
		INSERT INTO issues (project_id, issue_number, title, description, priority, assignee_id, reporter_id, labels, due_date)
		VALUES (1, 0, ?, ?, ?, ?, ?, ?, ?)
	`, req.Title, req.Description, req.Priority, req.AssigneeID, userID, string(labelsJSON), req.DueDate)

	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to create issue")
		return
	}

	issueID, _ := result.LastInsertId()

	// Log activity
	h.logActivity(userID, "issue.created", "issue", issueID, map[string]interface{}{})

	// Broadcast WebSocket event
	h.hub.Broadcast(websocket.Event{
		Type:     websocket.EventIssueCreated,
		Resource: websocket.ResourceIssue,
		ID:       issueID,
		UserID:   userID,
	})

	// Fetch the created issue
	h.getIssueByID(w, issueID)
}

// GetIssue handles GET /api/issues/{id}
func (h *Handlers) GetIssue(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_id", "Invalid issue ID")
		return
	}

	h.getIssueByID(w, id)
}

// UpdateIssue handles PUT /api/issues/{id}
func (h *Handlers) UpdateIssue(w http.ResponseWriter, r *http.Request) {
	userID, _, _ := middleware.GetUserFromContext(r.Context())

	idStr := r.PathValue("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_id", "Invalid issue ID")
		return
	}

	var req models.UpdateIssueRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", "Invalid request body")
		return
	}

	// Fetch old values for change tracking (including assignee name)
	var oldTitle, oldDescription, oldStatus, oldPriority, oldLabelsJSON string
	var oldAssigneeID *int64
	var oldAssigneeName *string
	var oldDueDate *string
	err = h.db.QueryRow(`
		SELECT i.title, i.description, i.status, i.priority, i.assignee_id, i.labels, i.due_date,
		       COALESCE(u.full_name, u.username)
		FROM issues i
		LEFT JOIN users u ON i.assignee_id = u.id
		WHERE i.id = ?
	`, id).Scan(&oldTitle, &oldDescription, &oldStatus, &oldPriority, &oldAssigneeID, &oldLabelsJSON, &oldDueDate, &oldAssigneeName)
	if err != nil {
		writeError(w, http.StatusNotFound, "not_found", "Issue not found")
		return
	}
	var oldLabels []string
	json.Unmarshal([]byte(oldLabelsJSON), &oldLabels)

	// Build dynamic update query
	updates := []string{}
	args := []interface{}{}

	// Track new values for change comparison
	newTitle := oldTitle
	newDescription := oldDescription
	newStatus := oldStatus
	newPriority := oldPriority
	newAssigneeID := oldAssigneeID
	newAssigneeName := oldAssigneeName
	newLabels := oldLabels
	newDueDate := oldDueDate

	if req.Title != nil {
		updates = append(updates, "title = ?")
		args = append(args, *req.Title)
		newTitle = *req.Title
	}
	if req.Description != nil {
		updates = append(updates, "description = ?")
		args = append(args, *req.Description)
		newDescription = *req.Description
	}
	if req.Status != nil {
		updates = append(updates, "status = ?")
		args = append(args, *req.Status)
		newStatus = string(*req.Status)
	}
	if req.Priority != nil {
		updates = append(updates, "priority = ?")
		args = append(args, *req.Priority)
		newPriority = string(*req.Priority)
	}
	if req.AssigneeID != nil {
		updates = append(updates, "assignee_id = ?")
		args = append(args, *req.AssigneeID)
		newAssigneeID = req.AssigneeID
		// Fetch new assignee name
		if *req.AssigneeID != 0 {
			var name string
			h.db.QueryRow("SELECT COALESCE(full_name, username) FROM users WHERE id = ?", *req.AssigneeID).Scan(&name)
			newAssigneeName = &name
		} else {
			newAssigneeName = nil
		}
	}
	if req.Labels != nil {
		labelsJSON, _ := json.Marshal(req.Labels)
		updates = append(updates, "labels = ?")
		args = append(args, string(labelsJSON))
		newLabels = req.Labels
	}
	if req.DueDate != nil {
		updates = append(updates, "due_date = ?")
		args = append(args, *req.DueDate)
		dueDateStr := req.DueDate.Format("2006-01-02T15:04:05Z07:00")
		newDueDate = &dueDateStr
	}

	if len(updates) == 0 {
		writeError(w, http.StatusBadRequest, "no_updates", "No fields to update")
		return
	}

	updates = append(updates, "updated_at = datetime('now')")
	args = append(args, id)

	query := "UPDATE issues SET " + joinStrings(updates, ", ") + " WHERE id = ?"
	_, err = h.db.Exec(query, args...)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to update issue")
		return
	}

	// Log activity with changes
	oldAssignee := AssigneeInfo{ID: oldAssigneeID, Name: safeStringPtr(oldAssigneeName)}
	newAssignee := AssigneeInfo{ID: newAssigneeID, Name: safeStringPtr(newAssigneeName)}
	changes := buildIssueChanges(
		oldTitle, newTitle,
		oldDescription, newDescription,
		oldStatus, newStatus,
		oldPriority, newPriority,
		oldAssignee, newAssignee,
		oldLabels, newLabels,
		oldDueDate, newDueDate,
	)
	if len(changes) > 0 {
		h.logActivity(userID, "issue.updated", "issue", id, changes)
	}

	// Broadcast WebSocket event
	h.hub.Broadcast(websocket.Event{
		Type:     websocket.EventIssueUpdated,
		Resource: websocket.ResourceIssue,
		ID:       id,
		UserID:   userID,
	})

	h.getIssueByID(w, id)
}

// DeleteIssue handles DELETE /api/issues/{id}
func (h *Handlers) DeleteIssue(w http.ResponseWriter, r *http.Request) {
	userID, _, _ := middleware.GetUserFromContext(r.Context())

	idStr := r.PathValue("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_id", "Invalid issue ID")
		return
	}

	// Fetch issue title before deletion for activity log
	var title string
	h.db.QueryRow("SELECT title FROM issues WHERE id = ?", id).Scan(&title)

	result, err := h.db.Exec("DELETE FROM issues WHERE id = ?", id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to delete issue")
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		writeError(w, http.StatusNotFound, "not_found", "Issue not found")
		return
	}

	// Log activity
	h.logActivity(userID, "issue.deleted", "issue", id, map[string]interface{}{
		"title": title,
	})

	// Broadcast WebSocket event
	h.hub.Broadcast(websocket.Event{
		Type:     websocket.EventIssueDeleted,
		Resource: websocket.ResourceIssue,
		ID:       id,
		UserID:   userID,
	})

	writeJSON(w, http.StatusOK, map[string]string{"message": "Issue deleted"})
}

// UpdateIssueStatus handles PATCH /api/issues/{id}/status
func (h *Handlers) UpdateIssueStatus(w http.ResponseWriter, r *http.Request) {
	userID, _, _ := middleware.GetUserFromContext(r.Context())

	idStr := r.PathValue("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_id", "Invalid issue ID")
		return
	}

	var req models.UpdateIssueStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", "Invalid request body")
		return
	}

	// Validate status
	switch req.Status {
	case models.StatusToInscribe, models.StatusCarving, models.StatusBaked:
		// Valid status
	default:
		writeError(w, http.StatusBadRequest, "invalid_status", "Status must be: to_inscribe, carving, or baked")
		return
	}

	// Fetch old status for change tracking
	var oldStatus string
	err = h.db.QueryRow("SELECT status FROM issues WHERE id = ?", id).Scan(&oldStatus)
	if err != nil {
		writeError(w, http.StatusNotFound, "not_found", "Issue not found")
		return
	}

	result, err := h.db.Exec(`
		UPDATE issues SET status = ?, updated_at = datetime('now') WHERE id = ?
	`, req.Status, id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to update status")
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		writeError(w, http.StatusNotFound, "not_found", "Issue not found")
		return
	}

	// Log activity if status actually changed
	newStatus := string(req.Status)
	if oldStatus != newStatus {
		h.logActivity(userID, "issue.status_changed", "issue", id, map[string]interface{}{
			"status": map[string]interface{}{
				"old": oldStatus,
				"new": newStatus,
			},
		})
	}

	// Broadcast WebSocket event
	h.hub.Broadcast(websocket.Event{
		Type:     websocket.EventIssueUpdated,
		Resource: websocket.ResourceIssue,
		ID:       id,
		UserID:   userID,
	})

	h.getIssueByID(w, id)
}

// PatchIssue handles PATCH /api/issues/{id} - partial update (for Kanban column moves)
func (h *Handlers) PatchIssue(w http.ResponseWriter, r *http.Request) {
	userID, _, _ := middleware.GetUserFromContext(r.Context())

	idStr := r.PathValue("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_id", "Invalid issue ID")
		return
	}

	var req models.UpdateIssueRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", "Invalid request body")
		return
	}

	// Fetch old values for change tracking (including assignee name)
	var oldTitle, oldDescription, oldStatus, oldPriority, oldLabelsJSON string
	var oldAssigneeID *int64
	var oldAssigneeName *string
	var oldDueDate *string
	err = h.db.QueryRow(`
		SELECT i.title, i.description, i.status, i.priority, i.assignee_id, i.labels, i.due_date,
		       COALESCE(u.full_name, u.username)
		FROM issues i
		LEFT JOIN users u ON i.assignee_id = u.id
		WHERE i.id = ?
	`, id).Scan(&oldTitle, &oldDescription, &oldStatus, &oldPriority, &oldAssigneeID, &oldLabelsJSON, &oldDueDate, &oldAssigneeName)
	if err != nil {
		writeError(w, http.StatusNotFound, "not_found", "Issue not found")
		return
	}
	var oldLabels []string
	json.Unmarshal([]byte(oldLabelsJSON), &oldLabels)

	// Build dynamic update query
	updates := []string{}
	args := []interface{}{}

	// Track new values for change comparison
	newTitle := oldTitle
	newDescription := oldDescription
	newStatus := oldStatus
	newPriority := oldPriority
	newAssigneeID := oldAssigneeID
	newAssigneeName := oldAssigneeName
	newLabels := oldLabels
	newDueDate := oldDueDate

	if req.Title != nil {
		updates = append(updates, "title = ?")
		args = append(args, *req.Title)
		newTitle = *req.Title
	}
	if req.Description != nil {
		updates = append(updates, "description = ?")
		args = append(args, *req.Description)
		newDescription = *req.Description
	}
	if req.Status != nil {
		// Validate status
		switch *req.Status {
		case models.StatusToInscribe, models.StatusCarving, models.StatusBaked:
			updates = append(updates, "status = ?")
			args = append(args, *req.Status)
			newStatus = string(*req.Status)
		default:
			writeError(w, http.StatusBadRequest, "invalid_status", "Status must be: to_inscribe, carving, or baked")
			return
		}
	}
	if req.Priority != nil {
		updates = append(updates, "priority = ?")
		args = append(args, *req.Priority)
		newPriority = string(*req.Priority)
	}
	if req.AssigneeID != nil {
		updates = append(updates, "assignee_id = ?")
		args = append(args, *req.AssigneeID)
		newAssigneeID = req.AssigneeID
		// Fetch new assignee name
		if *req.AssigneeID != 0 {
			var name string
			h.db.QueryRow("SELECT COALESCE(full_name, username) FROM users WHERE id = ?", *req.AssigneeID).Scan(&name)
			newAssigneeName = &name
		} else {
			newAssigneeName = nil
		}
	}
	if req.Labels != nil {
		labelsJSON, _ := json.Marshal(req.Labels)
		updates = append(updates, "labels = ?")
		args = append(args, string(labelsJSON))
		newLabels = req.Labels
	}
	if req.DueDate != nil {
		updates = append(updates, "due_date = ?")
		args = append(args, *req.DueDate)
		dueDateStr := req.DueDate.Format("2006-01-02T15:04:05Z07:00")
		newDueDate = &dueDateStr
	}

	if len(updates) == 0 {
		writeError(w, http.StatusBadRequest, "no_updates", "No fields to update")
		return
	}

	updates = append(updates, "updated_at = datetime('now')")
	args = append(args, id)

	query := "UPDATE issues SET " + joinStrings(updates, ", ") + " WHERE id = ?"
	result, err := h.db.Exec(query, args...)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to update issue")
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		writeError(w, http.StatusNotFound, "not_found", "Issue not found")
		return
	}

	// Log activity with changes
	oldAssignee := AssigneeInfo{ID: oldAssigneeID, Name: safeStringPtr(oldAssigneeName)}
	newAssignee := AssigneeInfo{ID: newAssigneeID, Name: safeStringPtr(newAssigneeName)}
	changes := buildIssueChanges(
		oldTitle, newTitle,
		oldDescription, newDescription,
		oldStatus, newStatus,
		oldPriority, newPriority,
		oldAssignee, newAssignee,
		oldLabels, newLabels,
		oldDueDate, newDueDate,
	)
	if len(changes) > 0 {
		h.logActivity(userID, "issue.updated", "issue", id, changes)
	}

	// Broadcast WebSocket event
	h.hub.Broadcast(websocket.Event{
		Type:     websocket.EventIssueUpdated,
		Resource: websocket.ResourceIssue,
		ID:       id,
		UserID:   userID,
	})

	h.getIssueByID(w, id)
}

// getIssueByID is a helper to fetch and return an issue
func (h *Handlers) getIssueByID(w http.ResponseWriter, id int64) {
	var issue models.Issue
	var assigneeID *int64
	var labelsJSON string
	var assigneeUsername, assigneeFullName string
	var reporterUsername, reporterFullName string

	err := h.db.QueryRow(`
		SELECT i.id, i.title, i.description, i.status, i.priority, 
		       i.assignee_id, i.reporter_id, i.labels, i.due_date, 
		       i.created_at, i.updated_at,
		       COALESCE(a.username, ''), COALESCE(a.full_name, ''),
		       r.username, r.full_name
		FROM issues i
		LEFT JOIN users a ON i.assignee_id = a.id
		JOIN users r ON i.reporter_id = r.id
		WHERE i.id = ?
	`, id).Scan(
		&issue.ID, &issue.Title, &issue.Description, &issue.Status, &issue.Priority,
		&assigneeID, &issue.ReporterID, &labelsJSON, &issue.DueDate,
		&issue.CreatedAt, &issue.UpdatedAt,
		&assigneeUsername, &assigneeFullName,
		&reporterUsername, &reporterFullName,
	)

	if err != nil {
		writeError(w, http.StatusNotFound, "not_found", "Issue not found")
		return
	}

	// Parse labels JSON
	json.Unmarshal([]byte(labelsJSON), &issue.Labels)
	if issue.Labels == nil {
		issue.Labels = []string{}
	}

	// Set assignee if present
	if assigneeID != nil {
		issue.AssigneeID = assigneeID
		issue.Assignee = &models.User{
			ID:       *assigneeID,
			Username: assigneeUsername,
			FullName: assigneeFullName,
		}
	}

	// Set reporter
	issue.Reporter = &models.User{
		ID:       issue.ReporterID,
		Username: reporterUsername,
		FullName: reporterFullName,
	}

	writeJSON(w, http.StatusOK, issue)
}

// ============================================
// Helper Functions
// ============================================

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, errorCode, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(models.ErrorResponse{
		Error:   errorCode,
		Message: message,
	})
}

func joinStrings(strs []string, sep string) string {
	if len(strs) == 0 {
		return ""
	}
	result := strs[0]
	for i := 1; i < len(strs); i++ {
		result += sep + strs[i]
	}
	return result
}

// ============================================
// Global Search Handler
// ============================================

// GlobalSearch handles GET /api/search?q=searchterm
func (h *Handlers) GlobalSearch(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("q")
	if query == "" {
		writeJSON(w, http.StatusOK, models.SearchResponse{Results: []models.SearchResult{}})
		return
	}

	// Prepare LIKE pattern
	pattern := "%" + query + "%"
	var results []models.SearchResult

	// Search issues by title
	issueRows, err := h.db.Query(`
		SELECT id, title, status
		FROM issues
		WHERE title LIKE ?
		ORDER BY updated_at DESC
		LIMIT 10
	`, pattern)
	if err == nil {
		for issueRows.Next() {
			var result models.SearchResult
			if err := issueRows.Scan(&result.ID, &result.Title, &result.Status); err == nil {
				result.Type = "issue"
				results = append(results, result)
			}
		}
		issueRows.Close() // Close immediately before next query
	}

	// Search docs by title and content
	docRows, err := h.db.Query(`
		SELECT id, title
		FROM docs
		WHERE title LIKE ? OR content LIKE ?
		ORDER BY updated_at DESC
		LIMIT 10
	`, pattern, pattern)
	if err == nil {
		for docRows.Next() {
			var result models.SearchResult
			if err := docRows.Scan(&result.ID, &result.Title); err == nil {
				result.Type = "doc"
				results = append(results, result)
			}
		}
		docRows.Close() // Close immediately after use
	}

	// Ensure results is never nil
	if results == nil {
		results = []models.SearchResult{}
	}

	writeJSON(w, http.StatusOK, models.SearchResponse{Results: results})
}
