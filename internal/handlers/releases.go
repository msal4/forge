package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"sarray-forge/internal/middleware"
	"sarray-forge/internal/models"
)

const (
	// ReleasesDir is where release files are stored
	ReleasesDir = "./data/releases"
	// MaxUploadSize is the maximum file upload size (100MB)
	MaxUploadSize = 100 << 20
)

// ============================================
// Release Handlers (The Granary)
// ============================================

// ListReleases handles GET /api/releases
func (h *Handlers) ListReleases(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.Query(`
		SELECT r.id, r.version, r.title, r.description, r.author_id,
		       r.published_at, r.created_at, r.updated_at,
		       u.username, u.full_name
		FROM releases r
		JOIN users u ON r.author_id = u.id
		ORDER BY r.created_at DESC
	`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to fetch releases")
		return
	}
	defer rows.Close()

	var releases []models.Release
	for rows.Next() {
		var release models.Release
		var authorUsername, authorFullName string

		if err := rows.Scan(
			&release.ID, &release.Version, &release.Title, &release.Description,
			&release.AuthorID, &release.PublishedAt, &release.CreatedAt, &release.UpdatedAt,
			&authorUsername, &authorFullName,
		); err != nil {
			continue
		}

		release.Author = &models.User{
			ID:       release.AuthorID,
			Username: authorUsername,
			FullName: authorFullName,
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

// CreateRelease handles POST /api/releases
func (h *Handlers) CreateRelease(w http.ResponseWriter, r *http.Request) {
	userID, _, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Not authenticated")
		return
	}

	var req models.CreateReleaseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", "Invalid request body")
		return
	}

	if req.Version == "" {
		writeError(w, http.StatusBadRequest, "missing_version", "Version is required")
		return
	}
	if req.Title == "" {
		writeError(w, http.StatusBadRequest, "missing_title", "Title is required")
		return
	}

	// Check if version already exists
	var count int
	h.db.QueryRow("SELECT COUNT(*) FROM releases WHERE version = ?", req.Version).Scan(&count)
	if count > 0 {
		writeError(w, http.StatusConflict, "duplicate_version", "Version already exists")
		return
	}

	result, err := h.db.Exec(`
		INSERT INTO releases (version, title, description, author_id)
		VALUES (?, ?, ?, ?)
	`, req.Version, req.Title, req.Description, userID)

	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to create release")
		return
	}

	releaseID, _ := result.LastInsertId()

	// Create release directory
	releaseDir := filepath.Join(ReleasesDir, fmt.Sprintf("v%d", releaseID))
	os.MkdirAll(releaseDir, 0755)

	h.getReleaseByID(w, releaseID)
}

// GetRelease handles GET /api/releases/{id}
func (h *Handlers) GetRelease(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_id", "Invalid release ID")
		return
	}

	h.getReleaseByID(w, id)
}

// DeleteRelease handles DELETE /api/releases/{id}
func (h *Handlers) DeleteRelease(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_id", "Invalid release ID")
		return
	}

	// Delete release files from disk
	releaseDir := filepath.Join(ReleasesDir, fmt.Sprintf("v%d", id))
	os.RemoveAll(releaseDir)

	// Delete from database (cascade will delete release_files entries)
	result, err := h.db.Exec("DELETE FROM releases WHERE id = ?", id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to delete release")
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		writeError(w, http.StatusNotFound, "not_found", "Release not found")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "Release deleted"})
}

// UploadReleaseFile handles POST /api/releases/{id}/files
func (h *Handlers) UploadReleaseFile(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	releaseID, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_id", "Invalid release ID")
		return
	}

	// Check release exists
	var exists int
	h.db.QueryRow("SELECT 1 FROM releases WHERE id = ?", releaseID).Scan(&exists)
	if exists == 0 {
		writeError(w, http.StatusNotFound, "not_found", "Release not found")
		return
	}

	// Limit upload size
	r.Body = http.MaxBytesReader(w, r.Body, MaxUploadSize)

	// Parse multipart form
	if err := r.ParseMultipartForm(MaxUploadSize); err != nil {
		writeError(w, http.StatusBadRequest, "file_too_large", "File too large (max 100MB)")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "missing_file", "No file provided")
		return
	}
	defer file.Close()

	// Sanitize filename
	filename := sanitizeFilename(header.Filename)
	if filename == "" {
		writeError(w, http.StatusBadRequest, "invalid_filename", "Invalid filename")
		return
	}

	// Create release directory if not exists
	releaseDir := filepath.Join(ReleasesDir, fmt.Sprintf("v%d", releaseID))
	if err := os.MkdirAll(releaseDir, 0755); err != nil {
		writeError(w, http.StatusInternalServerError, "storage_error", "Failed to create storage directory")
		return
	}

	// Save file
	filePath := filepath.Join(releaseDir, filename)
	dst, err := os.Create(filePath)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "storage_error", "Failed to save file")
		return
	}
	defer dst.Close()

	size, err := io.Copy(dst, file)
	if err != nil {
		os.Remove(filePath)
		writeError(w, http.StatusInternalServerError, "storage_error", "Failed to save file")
		return
	}

	// Detect MIME type
	mimeType := header.Header.Get("Content-Type")
	if mimeType == "" || mimeType == "application/octet-stream" {
		ext := filepath.Ext(filename)
		mimeType = mime.TypeByExtension(ext)
		if mimeType == "" {
			mimeType = "application/octet-stream"
		}
	}

	// Save to database
	result, err := h.db.Exec(`
		INSERT INTO release_files (release_id, filename, size, mime_type, path)
		VALUES (?, ?, ?, ?, ?)
	`, releaseID, filename, size, mimeType, filePath)

	if err != nil {
		os.Remove(filePath)
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to record file")
		return
	}

	fileID, _ := result.LastInsertId()

	writeJSON(w, http.StatusCreated, models.ReleaseFile{
		ID:        fileID,
		ReleaseID: releaseID,
		Filename:  filename,
		Size:      size,
		MimeType:  mimeType,
	})
}

// DownloadReleaseFile handles GET /api/releases/{id}/download/{filename}
func (h *Handlers) DownloadReleaseFile(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	releaseID, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_id", "Invalid release ID")
		return
	}

	filename := r.PathValue("filename")
	if filename == "" {
		writeError(w, http.StatusBadRequest, "missing_filename", "Filename is required")
		return
	}

	// Get file path from database
	var filePath, mimeType string
	err = h.db.QueryRow(`
		SELECT path, mime_type FROM release_files 
		WHERE release_id = ? AND filename = ?
	`, releaseID, filename).Scan(&filePath, &mimeType)

	if err != nil {
		writeError(w, http.StatusNotFound, "not_found", "File not found")
		return
	}

	// Check file exists on disk
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		writeError(w, http.StatusNotFound, "not_found", "File not found on disk")
		return
	}

	// Set headers for download
	w.Header().Set("Content-Type", mimeType)
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))

	http.ServeFile(w, r, filePath)
}

// Helper functions

func (h *Handlers) getReleaseByID(w http.ResponseWriter, id int64) {
	var release models.Release
	var authorUsername, authorFullName string

	err := h.db.QueryRow(`
		SELECT r.id, r.version, r.title, r.description, r.author_id,
		       r.published_at, r.created_at, r.updated_at,
		       u.username, u.full_name
		FROM releases r
		JOIN users u ON r.author_id = u.id
		WHERE r.id = ?
	`, id).Scan(
		&release.ID, &release.Version, &release.Title, &release.Description,
		&release.AuthorID, &release.PublishedAt, &release.CreatedAt, &release.UpdatedAt,
		&authorUsername, &authorFullName,
	)

	if err != nil {
		writeError(w, http.StatusNotFound, "not_found", "Release not found")
		return
	}

	release.Author = &models.User{
		ID:       release.AuthorID,
		Username: authorUsername,
		FullName: authorFullName,
	}

	release.Files = h.getReleaseFiles(id)

	writeJSON(w, http.StatusOK, release)
}

func (h *Handlers) getReleaseFiles(releaseID int64) []models.ReleaseFile {
	rows, err := h.db.Query(`
		SELECT id, release_id, filename, size, mime_type, created_at
		FROM release_files WHERE release_id = ?
	`, releaseID)
	if err != nil {
		return []models.ReleaseFile{}
	}
	defer rows.Close()

	var files []models.ReleaseFile
	for rows.Next() {
		var file models.ReleaseFile
		if err := rows.Scan(
			&file.ID, &file.ReleaseID, &file.Filename, &file.Size, &file.MimeType, &file.CreatedAt,
		); err != nil {
			continue
		}
		files = append(files, file)
	}

	if files == nil {
		files = []models.ReleaseFile{}
	}

	return files
}

func sanitizeFilename(filename string) string {
	// Get just the filename, not the path
	filename = filepath.Base(filename)

	// Replace dangerous characters
	replacer := strings.NewReplacer(
		"..", "",
		"/", "",
		"\\", "",
		"\x00", "",
	)
	filename = replacer.Replace(filename)

	// Limit length
	if len(filename) > 255 {
		ext := filepath.Ext(filename)
		name := filename[:255-len(ext)]
		filename = name + ext
	}

	return filename
}
