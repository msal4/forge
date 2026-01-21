-- ============================================
-- Project Queries
-- ============================================

-- name: GetProjectByID :one
SELECT p.*, u.username as lead_username, u.full_name as lead_full_name
FROM projects p
LEFT JOIN users u ON p.lead_id = u.id
WHERE p.id = ? LIMIT 1;

-- name: GetProjectByKey :one
SELECT p.*, u.username as lead_username, u.full_name as lead_full_name
FROM projects p
LEFT JOIN users u ON p.lead_id = u.id
WHERE p.key = ? COLLATE NOCASE LIMIT 1;

-- name: ListProjects :many
SELECT p.*, u.username as lead_username, u.full_name as lead_full_name
FROM projects p
LEFT JOIN users u ON p.lead_id = u.id
WHERE p.is_archived = 0
ORDER BY p.name;

-- name: ListAllProjects :many
SELECT p.*, u.username as lead_username, u.full_name as lead_full_name
FROM projects p
LEFT JOIN users u ON p.lead_id = u.id
ORDER BY p.is_archived, p.name;

-- name: CreateProject :one
INSERT INTO projects (key, name, description, lead_id)
VALUES (?, ?, ?, ?)
RETURNING *;

-- name: UpdateProject :one
UPDATE projects 
SET name = ?, description = ?, lead_id = ?, updated_at = CURRENT_TIMESTAMP
WHERE id = ?
RETURNING *;

-- name: ArchiveProject :exec
UPDATE projects SET is_archived = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?;

-- name: UnarchiveProject :exec
UPDATE projects SET is_archived = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?;

-- name: DeleteProject :exec
DELETE FROM projects WHERE id = ?;

-- name: CountProjects :one
SELECT COUNT(*) FROM projects WHERE is_archived = 0;
