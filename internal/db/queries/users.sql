-- ============================================
-- User Queries
-- ============================================

-- name: GetUserByID :one
SELECT * FROM users WHERE id = ? LIMIT 1;

-- name: GetUserByUsername :one
-- Smart login: find user by username (case-insensitive)
SELECT * FROM users WHERE username = ? COLLATE NOCASE LIMIT 1;

-- name: GetUserByEmail :one
SELECT * FROM users WHERE email = ? COLLATE NOCASE LIMIT 1;

-- name: GetUserByUsernameOrEmail :one
-- Used for smart login: accepts either username or full email
SELECT * FROM users 
WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE 
LIMIT 1;

-- name: ListUsers :many
SELECT * FROM users WHERE is_active = 1 ORDER BY username;

-- name: ListAllUsers :many
SELECT * FROM users ORDER BY username;

-- name: CreateUser :one
INSERT INTO users (username, email, password_hash, full_name, avatar_url, is_active)
VALUES (?, ?, ?, ?, ?, ?)
RETURNING *;

-- name: UpdateUser :one
UPDATE users 
SET full_name = ?, avatar_url = ?, updated_at = CURRENT_TIMESTAMP
WHERE id = ?
RETURNING *;

-- name: UpdateUserPassword :exec
UPDATE users 
SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
WHERE id = ?;

-- name: DeactivateUser :exec
UPDATE users SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?;

-- name: ActivateUser :exec
UPDATE users SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?;

-- name: DeleteUser :exec
DELETE FROM users WHERE id = ?;

-- name: CountUsers :one
SELECT COUNT(*) FROM users WHERE is_active = 1;

-- ============================================
-- Telegram Integration
-- ============================================

-- name: GetUserTelegramChatID :one
SELECT telegram_chat_id FROM users WHERE id = ?;

-- name: SetUserTelegramChatID :exec
UPDATE users 
SET telegram_chat_id = ?, updated_at = CURRENT_TIMESTAMP
WHERE id = ?;

-- name: ClearUserTelegramChatID :exec
UPDATE users 
SET telegram_chat_id = NULL, updated_at = CURRENT_TIMESTAMP
WHERE id = ?;

-- ============================================
-- Language Preference
-- ============================================

-- name: GetUserLanguage :one
SELECT language FROM users WHERE id = ?;

-- name: SetUserLanguage :exec
UPDATE users 
SET language = ?, updated_at = CURRENT_TIMESTAMP
WHERE id = ?;
