package handlers

import (
	"encoding/json"
	"fmt"
	"image"
	"image/jpeg"
	"image/png"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"sarray-forge/internal/middleware"
	"sarray-forge/internal/models"

	"golang.org/x/image/draw"
)

// AvatarDir is where avatar files are stored
var AvatarDir = "./data/uploads/avatars"

// MaxAvatarSize is the maximum avatar upload size (2MB)
const MaxAvatarSize = 2 << 20

// AvatarDimension is the size avatars are resized to
const AvatarDimension = 256

func init() {
	if dir := os.Getenv("AVATARS_DIR"); dir != "" {
		AvatarDir = dir
	}
}

// ============================================
// Profile Update Handlers
// ============================================

// UpdateProfileRequest is the request body for updating profile
type UpdateProfileRequest struct {
	FullName string `json:"fullName"`
}

// UpdateProfile handles PUT /api/users/me/profile
func (h *Handlers) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	userID, _, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Not authenticated")
		return
	}

	var req UpdateProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", "Invalid request body")
		return
	}

	// Validate full name
	if req.FullName == "" {
		writeError(w, http.StatusBadRequest, "missing_name", "Full name is required")
		return
	}
	if len(req.FullName) > 100 {
		writeError(w, http.StatusBadRequest, "name_too_long", "Full name must be 100 characters or less")
		return
	}

	_, err := h.db.Exec(`
		UPDATE users SET full_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
	`, req.FullName, userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to update profile")
		return
	}

	// Return updated user
	var user models.User
	err = h.db.QueryRow(`
		SELECT id, username, email, full_name, avatar_url, language, created_at, updated_at
		FROM users WHERE id = ?
	`, userID).Scan(
		&user.ID, &user.Username, &user.Email, &user.FullName,
		&user.AvatarURL, &user.Language, &user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to fetch updated user")
		return
	}

	writeJSON(w, http.StatusOK, user)
}

// ============================================
// Avatar Upload/Delete Handlers
// ============================================

// UploadAvatar handles POST /api/users/me/avatar
func (h *Handlers) UploadAvatar(w http.ResponseWriter, r *http.Request) {
	userID, _, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Not authenticated")
		return
	}

	// Limit upload size
	r.Body = http.MaxBytesReader(w, r.Body, MaxAvatarSize)

	// Parse multipart form
	if err := r.ParseMultipartForm(MaxAvatarSize); err != nil {
		writeError(w, http.StatusBadRequest, "file_too_large", "File too large (max 2MB)")
		return
	}

	file, header, err := r.FormFile("avatar")
	if err != nil {
		writeError(w, http.StatusBadRequest, "missing_file", "No file provided")
		return
	}
	defer file.Close()

	// Validate content type
	contentType := header.Header.Get("Content-Type")
	if contentType != "image/jpeg" && contentType != "image/png" && contentType != "image/webp" {
		writeError(w, http.StatusBadRequest, "invalid_type", "Only JPEG, PNG, and WebP images are allowed")
		return
	}

	// Decode image
	var img image.Image
	switch contentType {
	case "image/jpeg":
		img, err = jpeg.Decode(file)
	case "image/png":
		img, err = png.Decode(file)
	case "image/webp":
		// Go doesn't have native webp decode in stdlib, try as PNG fallback
		// In practice, users will upload JPEG/PNG most often
		writeError(w, http.StatusBadRequest, "invalid_type", "WebP upload not supported, please use JPEG or PNG")
		return
	}
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_image", "Could not decode image")
		return
	}

	// Resize to square
	resized := resizeToSquare(img, AvatarDimension)

	// Ensure avatar directory exists
	if err := os.MkdirAll(AvatarDir, 0755); err != nil {
		writeError(w, http.StatusInternalServerError, "storage_error", "Failed to create storage directory")
		return
	}

	// Save as JPEG (good compression, universal support)
	filename := fmt.Sprintf("%d.jpg", userID)
	filePath := filepath.Join(AvatarDir, filename)

	dst, err := os.Create(filePath)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "storage_error", "Failed to save avatar")
		return
	}
	defer dst.Close()

	if err := jpeg.Encode(dst, resized, &jpeg.Options{Quality: 85}); err != nil {
		os.Remove(filePath)
		writeError(w, http.StatusInternalServerError, "storage_error", "Failed to encode avatar")
		return
	}

	// Update database with avatar URL (add cache-busting timestamp)
	avatarURL := fmt.Sprintf("/uploads/avatars/%s?v=%d", filename, time.Now().Unix())
	_, err = h.db.Exec(`
		UPDATE users SET avatar_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
	`, avatarURL, userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to update avatar URL")
		return
	}

	// Return updated user
	var user models.User
	err = h.db.QueryRow(`
		SELECT id, username, email, full_name, avatar_url, language, created_at, updated_at
		FROM users WHERE id = ?
	`, userID).Scan(
		&user.ID, &user.Username, &user.Email, &user.FullName,
		&user.AvatarURL, &user.Language, &user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to fetch updated user")
		return
	}

	writeJSON(w, http.StatusOK, user)
}

// DeleteAvatar handles DELETE /api/users/me/avatar
func (h *Handlers) DeleteAvatar(w http.ResponseWriter, r *http.Request) {
	userID, _, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Not authenticated")
		return
	}

	// Delete file from disk
	filename := fmt.Sprintf("%d.jpg", userID)
	filePath := filepath.Join(AvatarDir, filename)
	os.Remove(filePath) // Ignore error if file doesn't exist

	// Clear avatar URL in database
	_, err := h.db.Exec(`
		UPDATE users SET avatar_url = '', updated_at = CURRENT_TIMESTAMP WHERE id = ?
	`, userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to clear avatar")
		return
	}

	// Return updated user
	var user models.User
	err = h.db.QueryRow(`
		SELECT id, username, email, full_name, avatar_url, language, created_at, updated_at
		FROM users WHERE id = ?
	`, userID).Scan(
		&user.ID, &user.Username, &user.Email, &user.FullName,
		&user.AvatarURL, &user.Language, &user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to fetch updated user")
		return
	}

	writeJSON(w, http.StatusOK, user)
}

// ============================================
// User Profile View Handlers
// ============================================

// UserProfileStats contains aggregated counts for a user
type UserProfileStats struct {
	IssuesAssigned int64 `json:"issuesAssigned"`
	IssuesReported int64 `json:"issuesReported"`
	DocsAuthored   int64 `json:"docsAuthored"`
	Releases       int64 `json:"releases"`
	Comments       int64 `json:"comments"`
}

// UserProfile is the full profile response
type UserProfile struct {
	models.User
	Stats UserProfileStats `json:"stats"`
}

// getUserIDByUsername is a helper to get user ID from username
func (h *Handlers) getUserIDByUsername(username string) (int64, error) {
	var userID int64
	err := h.db.QueryRow("SELECT id FROM users WHERE username = ?", username).Scan(&userID)
	return userID, err
}

// GetUserProfileByUsername handles GET /api/profile/{username}
func (h *Handlers) GetUserProfileByUsername(w http.ResponseWriter, r *http.Request) {
	username := r.PathValue("username")
	if username == "" {
		writeError(w, http.StatusBadRequest, "missing_username", "Username is required")
		return
	}

	// Fetch user by username
	var user models.User
	err := h.db.QueryRow(`
		SELECT id, username, email, full_name, avatar_url, language, created_at, updated_at
		FROM users WHERE username = ?
	`, username).Scan(
		&user.ID, &user.Username, &user.Email, &user.FullName,
		&user.AvatarURL, &user.Language, &user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil {
		writeError(w, http.StatusNotFound, "not_found", "User not found")
		return
	}

	// Fetch stats
	var stats UserProfileStats
	h.db.QueryRow("SELECT COUNT(*) FROM issues WHERE assignee_id = ?", user.ID).Scan(&stats.IssuesAssigned)
	h.db.QueryRow("SELECT COUNT(*) FROM issues WHERE reporter_id = ?", user.ID).Scan(&stats.IssuesReported)
	h.db.QueryRow("SELECT COUNT(*) FROM docs WHERE author_id = ?", user.ID).Scan(&stats.DocsAuthored)
	h.db.QueryRow("SELECT COUNT(*) FROM releases WHERE author_id = ?", user.ID).Scan(&stats.Releases)

	// Count comments across all three tables
	var issueComments, docComments, releaseComments int64
	h.db.QueryRow("SELECT COUNT(*) FROM issue_comments WHERE author_id = ?", user.ID).Scan(&issueComments)
	h.db.QueryRow("SELECT COUNT(*) FROM doc_comments WHERE author_id = ?", user.ID).Scan(&docComments)
	h.db.QueryRow("SELECT COUNT(*) FROM release_comments WHERE author_id = ?", user.ID).Scan(&releaseComments)
	stats.Comments = issueComments + docComments + releaseComments

	profile := UserProfile{
		User:  user,
		Stats: stats,
	}

	writeJSON(w, http.StatusOK, profile)
}

// GetUserIssuesByUsername handles GET /api/profile/{username}/issues
func (h *Handlers) GetUserIssuesByUsername(w http.ResponseWriter, r *http.Request) {
	username := r.PathValue("username")
	userID, err := h.getUserIDByUsername(username)
	if err != nil {
		writeError(w, http.StatusNotFound, "not_found", "User not found")
		return
	}
	h.getUserIssuesInternal(w, r, userID)
}

// GetUserDocsByUsername handles GET /api/profile/{username}/docs
func (h *Handlers) GetUserDocsByUsername(w http.ResponseWriter, r *http.Request) {
	username := r.PathValue("username")
	userID, err := h.getUserIDByUsername(username)
	if err != nil {
		writeError(w, http.StatusNotFound, "not_found", "User not found")
		return
	}
	h.getUserDocsInternal(w, userID)
}

// GetUserReleasesByUsername handles GET /api/profile/{username}/releases
func (h *Handlers) GetUserReleasesByUsername(w http.ResponseWriter, r *http.Request) {
	username := r.PathValue("username")
	userID, err := h.getUserIDByUsername(username)
	if err != nil {
		writeError(w, http.StatusNotFound, "not_found", "User not found")
		return
	}
	h.getUserReleasesInternal(w, userID)
}

// GetUserCommentsByUsername handles GET /api/profile/{username}/comments
func (h *Handlers) GetUserCommentsByUsername(w http.ResponseWriter, r *http.Request) {
	username := r.PathValue("username")
	userID, err := h.getUserIDByUsername(username)
	if err != nil {
		writeError(w, http.StatusNotFound, "not_found", "User not found")
		return
	}
	h.getUserCommentsInternal(w, userID)
}

// GetUserActivityByUsername handles GET /api/profile/{username}/activity
func (h *Handlers) GetUserActivityByUsername(w http.ResponseWriter, r *http.Request) {
	username := r.PathValue("username")
	userID, err := h.getUserIDByUsername(username)
	if err != nil {
		writeError(w, http.StatusNotFound, "not_found", "User not found")
		return
	}
	h.getUserActivityInternal(w, r, userID)
}

// GetUserProfile handles GET /api/users/{id}
func (h *Handlers) GetUserProfile(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	userID, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_id", "Invalid user ID")
		return
	}

	// Fetch user
	var user models.User
	err = h.db.QueryRow(`
		SELECT id, username, email, full_name, avatar_url, language, created_at, updated_at
		FROM users WHERE id = ?
	`, userID).Scan(
		&user.ID, &user.Username, &user.Email, &user.FullName,
		&user.AvatarURL, &user.Language, &user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil {
		writeError(w, http.StatusNotFound, "not_found", "User not found")
		return
	}

	// Fetch stats
	var stats UserProfileStats
	h.db.QueryRow("SELECT COUNT(*) FROM issues WHERE assignee_id = ?", userID).Scan(&stats.IssuesAssigned)
	h.db.QueryRow("SELECT COUNT(*) FROM issues WHERE reporter_id = ?", userID).Scan(&stats.IssuesReported)
	h.db.QueryRow("SELECT COUNT(*) FROM docs WHERE author_id = ?", userID).Scan(&stats.DocsAuthored)
	h.db.QueryRow("SELECT COUNT(*) FROM releases WHERE author_id = ?", userID).Scan(&stats.Releases)

	// Count comments across all three tables
	var issueComments, docComments, releaseComments int64
	h.db.QueryRow("SELECT COUNT(*) FROM issue_comments WHERE author_id = ?", userID).Scan(&issueComments)
	h.db.QueryRow("SELECT COUNT(*) FROM doc_comments WHERE author_id = ?", userID).Scan(&docComments)
	h.db.QueryRow("SELECT COUNT(*) FROM release_comments WHERE author_id = ?", userID).Scan(&releaseComments)
	stats.Comments = issueComments + docComments + releaseComments

	profile := UserProfile{
		User:  user,
		Stats: stats,
	}

	writeJSON(w, http.StatusOK, profile)
}

// GetUserIssues handles GET /api/users/{id}/issues
func (h *Handlers) GetUserIssues(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	userID, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_id", "Invalid user ID")
		return
	}
	h.getUserIssuesInternal(w, r, userID)
}

// getUserIssuesInternal is the shared implementation for fetching user issues
func (h *Handlers) getUserIssuesInternal(w http.ResponseWriter, r *http.Request, userID int64) {
	// Get role filter (assigned, reported, or all)
	role := r.URL.Query().Get("role")

	query := `
		SELECT i.id, i.title, i.description, i.status, i.priority,
		       i.assignee_id, i.reporter_id, i.labels, i.due_date,
		       i.created_at, i.updated_at,
		       COALESCE(a.username, ''), COALESCE(a.full_name, ''), COALESCE(a.avatar_url, ''),
		       r.username, r.full_name, COALESCE(r.avatar_url, '')
		FROM issues i
		LEFT JOIN users a ON i.assignee_id = a.id
		JOIN users r ON i.reporter_id = r.id
		WHERE `

	var args []interface{}
	switch role {
	case "assigned":
		query += "i.assignee_id = ?"
		args = append(args, userID)
	case "reported":
		query += "i.reporter_id = ?"
		args = append(args, userID)
	default:
		query += "(i.assignee_id = ? OR i.reporter_id = ?)"
		args = append(args, userID, userID)
	}

	query += " ORDER BY i.updated_at DESC LIMIT 50"

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
		var assigneeUsername, assigneeFullName, assigneeAvatarURL string
		var reporterUsername, reporterFullName, reporterAvatarURL string
		var labelsJSON string
		var dueDate *string

		if err := rows.Scan(
			&issue.ID, &issue.Title, &issue.Description, &issue.Status, &issue.Priority,
			&assigneeID, &issue.ReporterID, &labelsJSON, &dueDate,
			&issue.CreatedAt, &issue.UpdatedAt,
			&assigneeUsername, &assigneeFullName, &assigneeAvatarURL,
			&reporterUsername, &reporterFullName, &reporterAvatarURL,
		); err != nil {
			continue
		}

		json.Unmarshal([]byte(labelsJSON), &issue.Labels)
		if issue.Labels == nil {
			issue.Labels = []string{}
		}

		if assigneeID != nil {
			issue.AssigneeID = assigneeID
			issue.Assignee = &models.User{
				ID:        *assigneeID,
				Username:  assigneeUsername,
				FullName:  assigneeFullName,
				AvatarURL: assigneeAvatarURL,
			}
		}

		issue.Reporter = &models.User{
			ID:        issue.ReporterID,
			Username:  reporterUsername,
			FullName:  reporterFullName,
			AvatarURL: reporterAvatarURL,
		}

		issues = append(issues, issue)
	}

	if issues == nil {
		issues = []models.Issue{}
	}

	writeJSON(w, http.StatusOK, issues)
}

// GetUserDocs handles GET /api/users/{id}/docs
func (h *Handlers) GetUserDocs(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	userID, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_id", "Invalid user ID")
		return
	}
	h.getUserDocsInternal(w, userID)
}

// getUserDocsInternal is the shared implementation for fetching user docs
func (h *Handlers) getUserDocsInternal(w http.ResponseWriter, userID int64) {
	rows, err := h.db.Query(`
		SELECT d.id, d.title, d.content, d.parent_id, d.author_id, d.slug, d.created_at, d.updated_at,
		       u.username, u.full_name, COALESCE(u.avatar_url, '')
		FROM docs d
		JOIN users u ON d.author_id = u.id
		WHERE d.author_id = ?
		ORDER BY d.updated_at DESC
		LIMIT 50
	`, userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to fetch docs")
		return
	}
	defer rows.Close()

	var docs []models.Doc
	for rows.Next() {
		var doc models.Doc
		var authorUsername, authorFullName, authorAvatarURL string

		if err := rows.Scan(
			&doc.ID, &doc.Title, &doc.Content, &doc.ParentID, &doc.AuthorID,
			&doc.Slug, &doc.CreatedAt, &doc.UpdatedAt,
			&authorUsername, &authorFullName, &authorAvatarURL,
		); err != nil {
			continue
		}

		doc.Author = &models.User{
			ID:        doc.AuthorID,
			Username:  authorUsername,
			FullName:  authorFullName,
			AvatarURL: authorAvatarURL,
		}

		docs = append(docs, doc)
	}

	if docs == nil {
		docs = []models.Doc{}
	}

	writeJSON(w, http.StatusOK, docs)
}

// GetUserReleases handles GET /api/users/{id}/releases
func (h *Handlers) GetUserReleases(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	userID, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_id", "Invalid user ID")
		return
	}
	h.getUserReleasesInternal(w, userID)
}

// getUserReleasesInternal is the shared implementation for fetching user releases
func (h *Handlers) getUserReleasesInternal(w http.ResponseWriter, userID int64) {
	rows, err := h.db.Query(`
		SELECT r.id, r.version, r.title, r.description, r.author_id,
		       r.published_at, r.created_at, r.updated_at,
		       u.username, u.full_name, COALESCE(u.avatar_url, '')
		FROM releases r
		JOIN users u ON r.author_id = u.id
		WHERE r.author_id = ?
		ORDER BY r.created_at DESC
		LIMIT 50
	`, userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to fetch releases")
		return
	}
	defer rows.Close()

	var releases []models.Release
	for rows.Next() {
		var release models.Release
		var authorUsername, authorFullName, authorAvatarURL string

		if err := rows.Scan(
			&release.ID, &release.Version, &release.Title, &release.Description,
			&release.AuthorID, &release.PublishedAt, &release.CreatedAt, &release.UpdatedAt,
			&authorUsername, &authorFullName, &authorAvatarURL,
		); err != nil {
			continue
		}

		release.Author = &models.User{
			ID:        release.AuthorID,
			Username:  authorUsername,
			FullName:  authorFullName,
			AvatarURL: authorAvatarURL,
		}

		// Fetch files for this release
		release.Files = h.getReleaseFiles(release.ID)

		releases = append(releases, release)
	}

	if releases == nil {
		releases = []models.Release{}
	}

	writeJSON(w, http.StatusOK, releases)
}

// UserComment is a comment with context about where it came from
type UserComment struct {
	ID          int64     `json:"id"`
	Content     string    `json:"content"`
	EntityType  string    `json:"entityType"` // "issue", "doc", "release"
	EntityID    int64     `json:"entityId"`
	EntityTitle string    `json:"entityTitle"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

// GetUserComments handles GET /api/users/{id}/comments
func (h *Handlers) GetUserComments(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	userID, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_id", "Invalid user ID")
		return
	}
	h.getUserCommentsInternal(w, userID)
}

// getUserCommentsInternal is the shared implementation for fetching user comments
func (h *Handlers) getUserCommentsInternal(w http.ResponseWriter, userID int64) {
	var comments []UserComment

	// Fetch issue comments
	issueRows, err := h.db.Query(`
		SELECT c.id, c.content, c.issue_id, i.title, c.created_at, c.updated_at
		FROM issue_comments c
		JOIN issues i ON c.issue_id = i.id
		WHERE c.author_id = ?
		ORDER BY c.created_at DESC
		LIMIT 20
	`, userID)
	if err == nil {
		for issueRows.Next() {
			var c UserComment
			if err := issueRows.Scan(&c.ID, &c.Content, &c.EntityID, &c.EntityTitle, &c.CreatedAt, &c.UpdatedAt); err == nil {
				c.EntityType = "issue"
				comments = append(comments, c)
			}
		}
		issueRows.Close()
	}

	// Fetch doc comments
	docRows, err := h.db.Query(`
		SELECT c.id, c.content, c.doc_id, d.title, c.created_at, c.updated_at
		FROM doc_comments c
		JOIN docs d ON c.doc_id = d.id
		WHERE c.author_id = ?
		ORDER BY c.created_at DESC
		LIMIT 20
	`, userID)
	if err == nil {
		for docRows.Next() {
			var c UserComment
			if err := docRows.Scan(&c.ID, &c.Content, &c.EntityID, &c.EntityTitle, &c.CreatedAt, &c.UpdatedAt); err == nil {
				c.EntityType = "doc"
				comments = append(comments, c)
			}
		}
		docRows.Close()
	}

	// Fetch release comments
	releaseRows, err := h.db.Query(`
		SELECT c.id, c.content, c.release_id, r.title, c.created_at, c.updated_at
		FROM release_comments c
		JOIN releases r ON c.release_id = r.id
		WHERE c.author_id = ?
		ORDER BY c.created_at DESC
		LIMIT 20
	`, userID)
	if err == nil {
		for releaseRows.Next() {
			var c UserComment
			if err := releaseRows.Scan(&c.ID, &c.Content, &c.EntityID, &c.EntityTitle, &c.CreatedAt, &c.UpdatedAt); err == nil {
				c.EntityType = "release"
				comments = append(comments, c)
			}
		}
		releaseRows.Close()
	}

	if comments == nil {
		comments = []UserComment{}
	}

	// Sort by created_at descending (since we merged 3 queries)
	// Simple bubble sort since we have at most 60 items
	for i := 0; i < len(comments)-1; i++ {
		for j := i + 1; j < len(comments); j++ {
			if comments[j].CreatedAt.After(comments[i].CreatedAt) {
				comments[i], comments[j] = comments[j], comments[i]
			}
		}
	}

	// Limit to 50
	if len(comments) > 50 {
		comments = comments[:50]
	}

	writeJSON(w, http.StatusOK, comments)
}

// GetUserActivity handles GET /api/users/{id}/activity
func (h *Handlers) GetUserActivity(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	userID, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_id", "Invalid user ID")
		return
	}
	h.getUserActivityInternal(w, r, userID)
}

// getUserActivityInternal is the shared implementation for fetching user activity
func (h *Handlers) getUserActivityInternal(w http.ResponseWriter, r *http.Request, userID int64) {
	// Parse pagination
	limit := 20
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

	rows, err := h.db.Query(`
		SELECT a.id, a.action, a.entity_type, a.entity_id, a.metadata, a.created_at,
		       u.id, u.username, u.full_name, COALESCE(u.avatar_url, ''),
		       COALESCE(
		         CASE a.entity_type
		           WHEN 'issue' THEN (SELECT title FROM issues WHERE id = a.entity_id)
		           WHEN 'doc' THEN (SELECT title FROM docs WHERE id = a.entity_id)
		           WHEN 'release' THEN (SELECT title FROM releases WHERE id = a.entity_id)
		         END,
		         ''
		       ) as entity_title
		FROM activity_log a
		LEFT JOIN users u ON a.user_id = u.id
		WHERE a.user_id = ?
		ORDER BY a.created_at DESC
		LIMIT ? OFFSET ?
	`, userID, limit+1, offset)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to fetch activity")
		return
	}
	defer rows.Close()

	var activities []models.ActivityLog
	for rows.Next() {
		var activity models.ActivityLog
		var metadataJSON string
		var actorID *int64
		var actorUsername, actorFullName, actorAvatarURL string
		var entityTitle string

		if err := rows.Scan(
			&activity.ID, &activity.Action, &activity.EntityType, &activity.EntityID,
			&metadataJSON, &activity.CreatedAt,
			&actorID, &actorUsername, &actorFullName, &actorAvatarURL,
			&entityTitle,
		); err != nil {
			continue
		}

		json.Unmarshal([]byte(metadataJSON), &activity.Changes)
		activity.EntityTitle = entityTitle

		if actorID != nil {
			activity.User = &models.User{
				ID:        *actorID,
				Username:  actorUsername,
				FullName:  actorFullName,
				AvatarURL: actorAvatarURL,
			}
		}

		activities = append(activities, activity)
	}

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

// ============================================
// Image Processing Helpers
// ============================================

// resizeToSquare resizes an image to a square of the given size
func resizeToSquare(src image.Image, size int) image.Image {
	bounds := src.Bounds()
	srcW := bounds.Dx()
	srcH := bounds.Dy()

	// Determine crop region (center crop to square)
	var cropRect image.Rectangle
	if srcW > srcH {
		// Wider than tall - crop sides
		offset := (srcW - srcH) / 2
		cropRect = image.Rect(offset, 0, offset+srcH, srcH)
	} else {
		// Taller than wide - crop top/bottom
		offset := (srcH - srcW) / 2
		cropRect = image.Rect(0, offset, srcW, offset+srcW)
	}

	// Create cropped image
	cropped := image.NewRGBA(image.Rect(0, 0, cropRect.Dx(), cropRect.Dy()))
	draw.Draw(cropped, cropped.Bounds(), src, cropRect.Min, draw.Src)

	// Resize to target size
	dst := image.NewRGBA(image.Rect(0, 0, size, size))
	draw.CatmullRom.Scale(dst, dst.Bounds(), cropped, cropped.Bounds(), draw.Over, nil)

	return dst
}
