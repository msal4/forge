-- ============================================
-- Session Queries
-- ============================================

-- name: GetSessionByToken :one
SELECT s.*, u.username, u.email, u.full_name
FROM sessions s
JOIN users u ON s.user_id = u.id
WHERE s.token = ? AND s.expires_at > datetime('now') AND u.is_active = 1
LIMIT 1;

-- name: CreateSession :one
INSERT INTO sessions (user_id, token, user_agent, ip_address, expires_at)
VALUES (?, ?, ?, ?, ?)
RETURNING *;

-- name: DeleteSession :exec
DELETE FROM sessions WHERE token = ?;

-- name: DeleteUserSessions :exec
DELETE FROM sessions WHERE user_id = ?;

-- name: DeleteExpiredSessions :exec
DELETE FROM sessions WHERE expires_at < datetime('now');

-- name: ListUserSessions :many
SELECT * FROM sessions 
WHERE user_id = ? AND expires_at > datetime('now')
ORDER BY created_at DESC;

-- name: CountUserSessions :one
SELECT COUNT(*) FROM sessions 
WHERE user_id = ? AND expires_at > datetime('now');

-- name: DeleteOldestUserSessions :exec
-- Keep only the N most recent sessions per user
DELETE FROM sessions 
WHERE user_id = ? AND id NOT IN (
    SELECT id FROM sessions 
    WHERE user_id = ? 
    ORDER BY created_at DESC 
    LIMIT ?
);
