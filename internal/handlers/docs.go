package handlers

import (
	"encoding/json"
	"net/http"
	"regexp"
	"strconv"
	"strings"

	"sarray-forge/internal/middleware"
	"sarray-forge/internal/models"
)

// ============================================
// Doc Handlers (The Library)
// ============================================

// ListDocs handles GET /api/docs
func (h *Handlers) ListDocs(w http.ResponseWriter, r *http.Request) {
	parentID := r.URL.Query().Get("parent_id")

	query := `
		SELECT d.id, d.title, d.content, d.slug, d.parent_id, d.author_id,
		       d.created_at, d.updated_at, u.username, u.full_name
		FROM docs d
		JOIN users u ON d.author_id = u.id
		WHERE 1=1
	`
	args := []interface{}{}

	if parentID != "" {
		if parentID == "null" || parentID == "root" {
			query += " AND d.parent_id IS NULL"
		} else {
			query += " AND d.parent_id = ?"
			args = append(args, parentID)
		}
	}

	query += " ORDER BY d.title ASC"

	rows, err := h.db.Query(query, args...)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to fetch docs")
		return
	}
	defer rows.Close()

	var docs []models.Doc
	for rows.Next() {
		var doc models.Doc
		var authorUsername, authorFullName string

		if err := rows.Scan(
			&doc.ID, &doc.Title, &doc.Content, &doc.Slug, &doc.ParentID, &doc.AuthorID,
			&doc.CreatedAt, &doc.UpdatedAt, &authorUsername, &authorFullName,
		); err != nil {
			continue
		}

		doc.Author = &models.User{
			ID:       doc.AuthorID,
			Username: authorUsername,
			FullName: authorFullName,
		}

		docs = append(docs, doc)
	}

	if docs == nil {
		docs = []models.Doc{}
	}

	writeJSON(w, http.StatusOK, docs)
}

// CreateDoc handles POST /api/docs
func (h *Handlers) CreateDoc(w http.ResponseWriter, r *http.Request) {
	userID, _, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Not authenticated")
		return
	}

	var req models.CreateDocRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", "Invalid request body")
		return
	}

	if req.Title == "" {
		writeError(w, http.StatusBadRequest, "missing_title", "Title is required")
		return
	}

	// Generate slug from title
	slug := generateSlug(req.Title)

	// Ensure unique slug
	slug = h.ensureUniqueSlug(slug)

	result, err := h.db.Exec(`
		INSERT INTO docs (title, content, slug, parent_id, author_id)
		VALUES (?, ?, ?, ?, ?)
	`, req.Title, req.Content, slug, req.ParentID, userID)

	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to create doc")
		return
	}

	docID, _ := result.LastInsertId()
	h.getDocByID(w, docID)
}

// GetDoc handles GET /api/docs/{id}
func (h *Handlers) GetDoc(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")

	// Try to parse as ID first
	if id, err := strconv.ParseInt(idStr, 10, 64); err == nil {
		h.getDocByID(w, id)
		return
	}

	// Otherwise treat as slug
	h.getDocBySlug(w, idStr)
}

// UpdateDoc handles PUT /api/docs/{id}
func (h *Handlers) UpdateDoc(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_id", "Invalid doc ID")
		return
	}

	var req models.UpdateDocRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", "Invalid request body")
		return
	}

	updates := []string{}
	args := []interface{}{}

	if req.Title != nil {
		updates = append(updates, "title = ?")
		args = append(args, *req.Title)
		// Update slug when title changes
		slug := generateSlug(*req.Title)
		slug = h.ensureUniqueSlugExcluding(slug, id)
		updates = append(updates, "slug = ?")
		args = append(args, slug)
	}
	if req.Content != nil {
		updates = append(updates, "content = ?")
		args = append(args, *req.Content)
	}
	if req.ParentID != nil {
		updates = append(updates, "parent_id = ?")
		args = append(args, *req.ParentID)
	}

	if len(updates) == 0 {
		writeError(w, http.StatusBadRequest, "no_updates", "No fields to update")
		return
	}

	updates = append(updates, "updated_at = datetime('now')")
	args = append(args, id)

	query := "UPDATE docs SET " + joinStrings(updates, ", ") + " WHERE id = ?"
	_, err = h.db.Exec(query, args...)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to update doc")
		return
	}

	h.getDocByID(w, id)
}

// DeleteDoc handles DELETE /api/docs/{id}
func (h *Handlers) DeleteDoc(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_id", "Invalid doc ID")
		return
	}

	result, err := h.db.Exec("DELETE FROM docs WHERE id = ?", id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "Failed to delete doc")
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		writeError(w, http.StatusNotFound, "not_found", "Doc not found")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "Doc deleted"})
}

// Helper functions

func (h *Handlers) getDocByID(w http.ResponseWriter, id int64) {
	var doc models.Doc
	var authorUsername, authorFullName string

	err := h.db.QueryRow(`
		SELECT d.id, d.title, d.content, d.slug, d.parent_id, d.author_id,
		       d.created_at, d.updated_at, u.username, u.full_name
		FROM docs d
		JOIN users u ON d.author_id = u.id
		WHERE d.id = ?
	`, id).Scan(
		&doc.ID, &doc.Title, &doc.Content, &doc.Slug, &doc.ParentID, &doc.AuthorID,
		&doc.CreatedAt, &doc.UpdatedAt, &authorUsername, &authorFullName,
	)

	if err != nil {
		writeError(w, http.StatusNotFound, "not_found", "Doc not found")
		return
	}

	doc.Author = &models.User{
		ID:       doc.AuthorID,
		Username: authorUsername,
		FullName: authorFullName,
	}

	writeJSON(w, http.StatusOK, doc)
}

func (h *Handlers) getDocBySlug(w http.ResponseWriter, slug string) {
	var doc models.Doc
	var authorUsername, authorFullName string

	err := h.db.QueryRow(`
		SELECT d.id, d.title, d.content, d.slug, d.parent_id, d.author_id,
		       d.created_at, d.updated_at, u.username, u.full_name
		FROM docs d
		JOIN users u ON d.author_id = u.id
		WHERE d.slug = ?
	`, slug).Scan(
		&doc.ID, &doc.Title, &doc.Content, &doc.Slug, &doc.ParentID, &doc.AuthorID,
		&doc.CreatedAt, &doc.UpdatedAt, &authorUsername, &authorFullName,
	)

	if err != nil {
		writeError(w, http.StatusNotFound, "not_found", "Doc not found")
		return
	}

	doc.Author = &models.User{
		ID:       doc.AuthorID,
		Username: authorUsername,
		FullName: authorFullName,
	}

	writeJSON(w, http.StatusOK, doc)
}

func generateSlug(title string) string {
	// Convert to lowercase
	slug := strings.ToLower(title)
	// Replace spaces with hyphens
	slug = strings.ReplaceAll(slug, " ", "-")
	// Remove special characters
	reg := regexp.MustCompile(`[^a-z0-9-]`)
	slug = reg.ReplaceAllString(slug, "")
	// Remove multiple consecutive hyphens
	reg = regexp.MustCompile(`-+`)
	slug = reg.ReplaceAllString(slug, "-")
	// Trim hyphens from ends
	slug = strings.Trim(slug, "-")
	return slug
}

func (h *Handlers) ensureUniqueSlug(slug string) string {
	baseSlug := slug
	counter := 1

	for {
		var count int
		h.db.QueryRow("SELECT COUNT(*) FROM docs WHERE slug = ?", slug).Scan(&count)
		if count == 0 {
			return slug
		}
		counter++
		slug = baseSlug + "-" + strconv.Itoa(counter)
	}
}

func (h *Handlers) ensureUniqueSlugExcluding(slug string, excludeID int64) string {
	baseSlug := slug
	counter := 1

	for {
		var count int
		h.db.QueryRow("SELECT COUNT(*) FROM docs WHERE slug = ? AND id != ?", slug, excludeID).Scan(&count)
		if count == 0 {
			return slug
		}
		counter++
		slug = baseSlug + "-" + strconv.Itoa(counter)
	}
}
