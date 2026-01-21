-- ============================================
-- Activity Log Queries
-- ============================================

-- name: CreateActivity :one
INSERT INTO activity_log (user_id, action, entity_type, entity_id, metadata)
VALUES (?, ?, ?, ?, ?)
RETURNING *;

-- name: ListRecentActivity :many
SELECT 
    a.*,
    u.username,
    u.full_name,
    u.avatar_url
FROM activity_log a
LEFT JOIN users u ON a.user_id = u.id
ORDER BY a.created_at DESC
LIMIT ?;

-- name: ListActivityByUser :many
SELECT 
    a.*,
    u.username,
    u.full_name
FROM activity_log a
LEFT JOIN users u ON a.user_id = u.id
WHERE a.user_id = ?
ORDER BY a.created_at DESC
LIMIT ?;

-- name: ListActivityByEntity :many
SELECT 
    a.*,
    u.username,
    u.full_name
FROM activity_log a
LEFT JOIN users u ON a.user_id = u.id
WHERE a.entity_type = ? AND a.entity_id = ?
ORDER BY a.created_at DESC
LIMIT ?;

-- name: DeleteOldActivity :exec
-- Clean up activity logs older than N days
DELETE FROM activity_log 
WHERE created_at < datetime('now', '-' || ? || ' days');

-- name: CountActivityByUser :one
SELECT COUNT(*) FROM activity_log WHERE user_id = ?;
