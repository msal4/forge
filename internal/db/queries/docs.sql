-- ============================================
-- Doc Queries (The Library)
-- ============================================

-- name: GetDocByID :one
SELECT 
    d.*,
    p.key as project_key,
    p.name as project_name,
    a.username as author_username,
    a.full_name as author_full_name,
    e.username as editor_username
FROM docs d
LEFT JOIN projects p ON d.project_id = p.id
JOIN users a ON d.author_id = a.id
LEFT JOIN users e ON d.last_editor_id = e.id
WHERE d.id = ? LIMIT 1;

-- name: GetDocBySlug :one
SELECT 
    d.*,
    p.key as project_key,
    p.name as project_name,
    a.username as author_username,
    a.full_name as author_full_name,
    e.username as editor_username
FROM docs d
LEFT JOIN projects p ON d.project_id = p.id
JOIN users a ON d.author_id = a.id
LEFT JOIN users e ON d.last_editor_id = e.id
WHERE d.slug = ? LIMIT 1;

-- name: ListDocs :many
-- List all root-level docs (no parent)
SELECT 
    d.*,
    p.key as project_key,
    a.username as author_username
FROM docs d
LEFT JOIN projects p ON d.project_id = p.id
JOIN users a ON d.author_id = a.id
WHERE d.parent_id IS NULL AND d.is_published = 1
ORDER BY d.sort_order, d.title;

-- name: ListDocsByProject :many
SELECT 
    d.*,
    a.username as author_username
FROM docs d
JOIN users a ON d.author_id = a.id
WHERE d.project_id = ? AND d.is_published = 1
ORDER BY d.sort_order, d.title;

-- name: ListDocsByParent :many
-- Get children of a doc (for tree navigation)
SELECT 
    d.*,
    a.username as author_username
FROM docs d
JOIN users a ON d.author_id = a.id
WHERE d.parent_id = ? AND d.is_published = 1
ORDER BY d.sort_order, d.title;

-- name: ListAllDocs :many
-- Include unpublished (for admin)
SELECT 
    d.*,
    p.key as project_key,
    a.username as author_username
FROM docs d
LEFT JOIN projects p ON d.project_id = p.id
JOIN users a ON d.author_id = a.id
ORDER BY d.project_id, d.parent_id, d.sort_order, d.title;

-- name: CreateDoc :one
INSERT INTO docs (project_id, slug, title, content, parent_id, sort_order, author_id, is_published)
VALUES (?, ?, ?, ?, ?, ?, ?, ?)
RETURNING *;

-- name: UpdateDoc :one
UPDATE docs SET
    title = COALESCE(?, title),
    content = COALESCE(?, content),
    parent_id = ?,
    sort_order = COALESCE(?, sort_order),
    last_editor_id = ?,
    is_published = COALESCE(?, is_published),
    updated_at = CURRENT_TIMESTAMP
WHERE id = ?
RETURNING *;

-- name: UpdateDocSlug :exec
UPDATE docs SET slug = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;

-- name: DeleteDoc :exec
DELETE FROM docs WHERE id = ?;

-- name: CountDocs :one
SELECT COUNT(*) FROM docs WHERE is_published = 1;

-- name: CountDocsByProject :one
SELECT COUNT(*) FROM docs WHERE project_id = ? AND is_published = 1;

-- name: SearchDocs :many
SELECT 
    d.*,
    p.key as project_key,
    a.username as author_username
FROM docs d
LEFT JOIN projects p ON d.project_id = p.id
JOIN users a ON d.author_id = a.id
WHERE (d.title LIKE '%' || ? || '%' OR d.content LIKE '%' || ? || '%')
  AND d.is_published = 1
ORDER BY d.updated_at DESC
LIMIT ?;

-- name: GetDocTree :many
-- Recursive CTE to get full doc tree (SQLite 3.8.3+)
WITH RECURSIVE doc_tree AS (
    SELECT id, parent_id, title, slug, sort_order, 0 as depth
    FROM docs
    WHERE parent_id IS NULL AND is_published = 1
    
    UNION ALL
    
    SELECT d.id, d.parent_id, d.title, d.slug, d.sort_order, dt.depth + 1
    FROM docs d
    JOIN doc_tree dt ON d.parent_id = dt.id
    WHERE d.is_published = 1
)
SELECT * FROM doc_tree ORDER BY depth, sort_order, title;
