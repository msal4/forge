-- ============================================
-- Telegram Link Token Queries
-- ============================================

-- name: CreateTelegramLinkToken :exec
INSERT INTO telegram_link_tokens (user_id, token, expires_at)
VALUES (?, ?, ?)
ON CONFLICT(user_id) DO UPDATE SET token = excluded.token, expires_at = excluded.expires_at;

-- name: GetTelegramLinkToken :one
SELECT * FROM telegram_link_tokens WHERE token = ? LIMIT 1;

-- name: DeleteTelegramLinkToken :exec
DELETE FROM telegram_link_tokens WHERE user_id = ?;

-- name: DeleteExpiredTelegramLinkTokens :exec
DELETE FROM telegram_link_tokens WHERE expires_at < CURRENT_TIMESTAMP;
