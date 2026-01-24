-- ============================================
-- Release Comment Queries
-- ============================================

-- name: GetReleaseCommentByID :one
SELECT c.*, u.username as author_username, u.full_name as author_full_name, u.avatar_url as author_avatar
FROM release_comments c
JOIN users u ON c.author_id = u.id
WHERE c.id = ? LIMIT 1;

-- name: ListCommentsByRelease :many
SELECT c.*, u.username as author_username, u.full_name as author_full_name, u.avatar_url as author_avatar
FROM release_comments c
JOIN users u ON c.author_id = u.id
WHERE c.release_id = ?
ORDER BY c.created_at ASC;

-- name: CreateReleaseComment :one
INSERT INTO release_comments (release_id, author_id, content)
VALUES (?, ?, ?)
RETURNING *;

-- name: DeleteReleaseComment :exec
DELETE FROM release_comments WHERE id = ?;

-- name: DeleteReleaseCommentByAuthor :execrows
-- Only allow author to delete their own comment
DELETE FROM release_comments WHERE id = ? AND author_id = ?;

-- name: CountCommentsByRelease :one
SELECT COUNT(*) FROM release_comments WHERE release_id = ?;
