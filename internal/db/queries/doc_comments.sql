-- ============================================
-- Doc Comment Queries
-- ============================================

-- name: GetDocCommentByID :one
SELECT c.*, u.username as author_username, u.full_name as author_full_name, u.avatar_url as author_avatar
FROM doc_comments c
JOIN users u ON c.author_id = u.id
WHERE c.id = ? LIMIT 1;

-- name: ListCommentsByDoc :many
SELECT c.*, u.username as author_username, u.full_name as author_full_name, u.avatar_url as author_avatar
FROM doc_comments c
JOIN users u ON c.author_id = u.id
WHERE c.doc_id = ?
ORDER BY c.created_at ASC;

-- name: CreateDocComment :one
INSERT INTO doc_comments (doc_id, author_id, content)
VALUES (?, ?, ?)
RETURNING *;

-- name: DeleteDocComment :exec
DELETE FROM doc_comments WHERE id = ?;

-- name: DeleteDocCommentByAuthor :execrows
-- Only allow author to delete their own comment
DELETE FROM doc_comments WHERE id = ? AND author_id = ?;

-- name: CountCommentsByDoc :one
SELECT COUNT(*) FROM doc_comments WHERE doc_id = ?;
