-- ============================================
-- Issue Comment Queries
-- ============================================

-- name: GetCommentByID :one
SELECT c.*, u.username as author_username, u.full_name as author_full_name
FROM issue_comments c
JOIN users u ON c.author_id = u.id
WHERE c.id = ? LIMIT 1;

-- name: ListCommentsByIssue :many
SELECT c.*, u.username as author_username, u.full_name as author_full_name, u.avatar_url as author_avatar
FROM issue_comments c
JOIN users u ON c.author_id = u.id
WHERE c.issue_id = ?
ORDER BY c.created_at ASC;

-- name: CreateComment :one
INSERT INTO issue_comments (issue_id, author_id, content)
VALUES (?, ?, ?)
RETURNING *;

-- name: UpdateComment :one
UPDATE issue_comments 
SET content = ?, updated_at = CURRENT_TIMESTAMP
WHERE id = ? AND author_id = ?
RETURNING *;

-- name: DeleteComment :exec
DELETE FROM issue_comments WHERE id = ?;

-- name: DeleteCommentByAuthor :exec
-- Only allow author to delete their own comment
DELETE FROM issue_comments WHERE id = ? AND author_id = ?;

-- name: CountCommentsByIssue :one
SELECT COUNT(*) FROM issue_comments WHERE issue_id = ?;
