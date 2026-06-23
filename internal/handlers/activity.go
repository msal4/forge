package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"sarray-forge/internal/models"
)

// userDisplayNameSelect returns SQL for a user's display name, preferring non-empty full_name over username.
func userDisplayNameSelect(tableAlias string) string {
	prefix := ""
	if tableAlias != "" {
		prefix = tableAlias + "."
	}
	return fmt.Sprintf(
		"COALESCE(NULLIF(TRIM(%sfull_name), ''), NULLIF(TRIM(%susername), ''))",
		prefix, prefix,
	)
}

// formatUserDisplayName picks the best display name from full_name and username.
func formatUserDisplayName(fullName, username string) string {
	if strings.TrimSpace(fullName) != "" {
		return strings.TrimSpace(fullName)
	}
	return strings.TrimSpace(username)
}

// lookupUserDisplayName fetches the display name for a user ID.
func (h *Handlers) lookupUserDisplayName(userID int64) string {
	return h.lookupUserDisplayNameCached(userID, nil)
}

// lookupUserDisplayNameCached fetches a display name, using an optional per-request cache.
func (h *Handlers) lookupUserDisplayNameCached(userID int64, cache map[int64]string) string {
	if cache != nil {
		if name, ok := cache[userID]; ok {
			return name
		}
	}

	var fullName, username string
	if err := h.db.QueryRow(
		"SELECT full_name, username FROM users WHERE id = ?",
		userID,
	).Scan(&fullName, &username); err != nil {
		if cache != nil {
			cache[userID] = ""
		}
		return ""
	}

	name := formatUserDisplayName(fullName, username)
	if cache != nil {
		cache[userID] = name
	}
	return name
}

// enrichActivityChanges fills in missing assignee display names from stored user IDs.
func (h *Handlers) enrichActivityChanges(changes map[string]interface{}, cache map[int64]string) {
	if changes == nil {
		return
	}

	if raw, ok := changes["assignee"]; ok {
		if assignee, ok := raw.(map[string]interface{}); ok {
			enrichAssigneeNames(h, assignee, cache)
		}
	}

	if raw, ok := changes["assigneeId"]; ok {
		if assignee, ok := raw.(map[string]interface{}); ok {
			legacy := map[string]interface{}{
				"oldId":   assignee["old"],
				"newId":   assignee["new"],
				"oldName": assignee["old"],
				"newName": assignee["new"],
			}
			enrichAssigneeNames(h, legacy, cache)
			if oldName, ok := legacy["oldName"].(string); ok && strings.TrimSpace(oldName) != "" {
				assignee["old"] = oldName
			}
			if newName, ok := legacy["newName"].(string); ok && strings.TrimSpace(newName) != "" {
				assignee["new"] = newName
			}
		}
	}
}

func enrichAssigneeNames(h *Handlers, assignee map[string]interface{}, cache map[int64]string) {
	if name, ok := assignee["oldName"].(string); !ok || strings.TrimSpace(name) == "" {
		if id := activityUserID(assignee["oldId"]); id != nil {
			assignee["oldName"] = h.lookupUserDisplayNameCached(*id, cache)
		}
	}
	if name, ok := assignee["newName"].(string); !ok || strings.TrimSpace(name) == "" {
		if id := activityUserID(assignee["newId"]); id != nil {
			assignee["newName"] = h.lookupUserDisplayNameCached(*id, cache)
		}
	}
}

func activityUserID(value interface{}) *int64 {
	if value == nil {
		return nil
	}

	switch v := value.(type) {
	case float64:
		id := int64(v)
		if id == 0 {
			return nil
		}
		return &id
	case int64:
		if v == 0 {
			return nil
		}
		return &v
	case int:
		id := int64(v)
		if id == 0 {
			return nil
		}
		return &id
	case json.Number:
		if parsed, err := v.Int64(); err == nil && parsed != 0 {
			return &parsed
		}
	}

	return nil
}

// ============================================
// Activity Log Handlers
// ============================================

// logActivity creates an activity log entry for tracking modifications
func (h *Handlers) logActivity(userID int64, action, entityType string, entityID int64, metadata map[string]interface{}) {
	metadataJSON, _ := json.Marshal(metadata)
	_, err := h.db.Exec(`
		INSERT INTO activity_log (user_id, action, entity_type, entity_id, metadata)
		VALUES (?, ?, ?, ?, ?)
	`, userID, action, entityType, entityID, string(metadataJSON))
	if err != nil {
		// Log error but don't fail the main operation
		// Activity logging is non-critical
	}
}

// GetIssueActivity handles GET /api/issues/{id}/activity
func (h *Handlers) GetIssueActivity(w http.ResponseWriter, r *http.Request) {
	h.getEntityActivity(w, r, "issue")
}

// GetDocActivity handles GET /api/docs/{id}/activity
func (h *Handlers) GetDocActivity(w http.ResponseWriter, r *http.Request) {
	h.getEntityActivity(w, r, "doc")
}

// getEntityActivity is a helper to fetch activity logs for any entity type
func (h *Handlers) getEntityActivity(w http.ResponseWriter, r *http.Request, entityType string) {
	idStr := r.PathValue("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_id", "Invalid ID")
		return
	}

	// Parse limit and offset from query params
	limit := 10
	offset := 0
	if l := r.URL.Query().Get("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 100 {
			limit = parsed
		}
	}
	if o := r.URL.Query().Get("offset"); o != "" {
		if parsed, err := strconv.Atoi(o); err == nil && parsed >= 0 {
			offset = parsed
		}
	}

	// Fetch one extra to determine if there are more
	rows, err := h.db.Query(`
		SELECT a.id, a.action, a.entity_type, a.entity_id, a.metadata, a.created_at,
		       u.id, u.username, u.full_name
		FROM activity_log a
		LEFT JOIN users u ON a.user_id = u.id
		WHERE a.entity_type = ? AND a.entity_id = ?
		ORDER BY a.created_at DESC
		LIMIT ? OFFSET ?
	`, entityType, id, limit+1, offset)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to fetch activity")
		return
	}
	defer rows.Close()

	var activities []models.ActivityLog
	nameCache := make(map[int64]string)
	for rows.Next() {
		var activity models.ActivityLog
		var metadataJSON string
		var userID *int64
		var username, fullName *string

		if err := rows.Scan(
			&activity.ID, &activity.Action, &activity.EntityType, &activity.EntityID,
			&metadataJSON, &activity.CreatedAt,
			&userID, &username, &fullName,
		); err != nil {
			continue
		}

		// Parse metadata JSON into changes
		if metadataJSON != "" && metadataJSON != "{}" {
			json.Unmarshal([]byte(metadataJSON), &activity.Changes)
		}
		h.enrichActivityChanges(activity.Changes, nameCache)

		// Set user if present
		if userID != nil {
			activity.User = &models.User{
				ID:       *userID,
				Username: safeString(username),
				FullName: formatUserDisplayName(safeString(fullName), safeString(username)),
			}
		}

		activities = append(activities, activity)
	}

	// Determine if there are more results
	hasMore := len(activities) > limit
	if hasMore {
		activities = activities[:limit]
	}

	if activities == nil {
		activities = []models.ActivityLog{}
	}

	writeJSON(w, http.StatusOK, models.ActivityLogResponse{
		Activities: activities,
		HasMore:    hasMore,
	})
}

// Helper to safely dereference string pointers
func safeString(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

// Helper to safely dereference string pointers with default empty string
func safeStringPtr(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

// ============================================
// Change Tracking Helpers
// ============================================

// TextDiff represents a diff for text content
type TextDiff struct {
	Old          string `json:"old,omitempty"`
	New          string `json:"new,omitempty"`
	AddedChars   int    `json:"addedChars,omitempty"`
	RemovedChars int    `json:"removedChars,omitempty"`
}

// AssigneeInfo holds assignee details for activity logging
type AssigneeInfo struct {
	ID   *int64
	Name string
}

// buildIssueChanges compares old and new issue values and returns a changes map
func buildIssueChanges(
	oldTitle, newTitle string,
	oldDescription, newDescription string,
	oldStatus, newStatus string,
	oldPriority, newPriority string,
	oldAssignee, newAssignee AssigneeInfo,
	oldLabels, newLabels []string,
	oldDueDate, newDueDate *string,
) map[string]interface{} {
	changes := make(map[string]interface{})

	if oldTitle != newTitle {
		changes["title"] = map[string]interface{}{
			"old": oldTitle,
			"new": newTitle,
		}
	}

	if oldDescription != newDescription {
		changes["description"] = TextDiff{
			Old:          oldDescription,
			New:          newDescription,
			AddedChars:   countAddedChars(oldDescription, newDescription),
			RemovedChars: countRemovedChars(oldDescription, newDescription),
		}
	}

	if oldStatus != newStatus {
		changes["status"] = map[string]interface{}{
			"old": oldStatus,
			"new": newStatus,
		}
	}

	if oldPriority != newPriority {
		changes["priority"] = map[string]interface{}{
			"old": oldPriority,
			"new": newPriority,
		}
	}

	if !equalInt64Ptr(oldAssignee.ID, newAssignee.ID) {
		changes["assignee"] = map[string]interface{}{
			"oldId":   oldAssignee.ID,
			"oldName": oldAssignee.Name,
			"newId":   newAssignee.ID,
			"newName": newAssignee.Name,
		}
	}

	if !equalStringSlice(oldLabels, newLabels) {
		changes["labels"] = map[string]interface{}{
			"old": oldLabels,
			"new": newLabels,
		}
	}

	if !equalStringPtr(oldDueDate, newDueDate) {
		changes["dueDate"] = map[string]interface{}{
			"old": oldDueDate,
			"new": newDueDate,
		}
	}

	return changes
}

// buildDocChanges compares old and new doc values and returns a changes map
func buildDocChanges(
	oldTitle, newTitle string,
	oldContent, newContent string,
	oldParentID, newParentID *int64,
) map[string]interface{} {
	changes := make(map[string]interface{})

	if oldTitle != newTitle {
		changes["title"] = map[string]interface{}{
			"old": oldTitle,
			"new": newTitle,
		}
	}

	if oldContent != newContent {
		changes["content"] = TextDiff{
			Old:          oldContent,
			New:          newContent,
			AddedChars:   countAddedChars(oldContent, newContent),
			RemovedChars: countRemovedChars(oldContent, newContent),
		}
	}

	if !equalInt64Ptr(oldParentID, newParentID) {
		changes["parentId"] = map[string]interface{}{
			"old": oldParentID,
			"new": newParentID,
		}
	}

	return changes
}

// Helper functions for comparison

func equalInt64Ptr(a, b *int64) bool {
	if a == nil && b == nil {
		return true
	}
	if a == nil || b == nil {
		return false
	}
	return *a == *b
}

func equalStringPtr(a, b *string) bool {
	if a == nil && b == nil {
		return true
	}
	if a == nil || b == nil {
		return false
	}
	return *a == *b
}

func equalStringSlice(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

// Simple character count diff - counts added/removed based on length difference
// For a more accurate diff, we'd use a proper diff algorithm
func countAddedChars(old, new string) int {
	oldLines := strings.Split(old, "\n")
	newLines := strings.Split(new, "\n")

	added := 0
	for _, line := range newLines {
		found := false
		for _, oldLine := range oldLines {
			if line == oldLine {
				found = true
				break
			}
		}
		if !found {
			added += len(line)
		}
	}
	return added
}

func countRemovedChars(old, new string) int {
	oldLines := strings.Split(old, "\n")
	newLines := strings.Split(new, "\n")

	removed := 0
	for _, line := range oldLines {
		found := false
		for _, newLine := range newLines {
			if line == newLine {
				found = true
				break
			}
		}
		if !found {
			removed += len(line)
		}
	}
	return removed
}
