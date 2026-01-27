-- ============================================
-- Reactions Queries
-- ============================================

-- ============================================
-- Issue Reactions
-- ============================================

-- name: ListReactionsByIssue :many
SELECT r.*, u.username, u.full_name, u.avatar_url
FROM reactions r
JOIN users u ON r.user_id = u.id
WHERE r.issue_id = ?
ORDER BY r.created_at ASC;

-- name: GetReactionOnIssue :one
SELECT * FROM reactions
WHERE user_id = ? AND emoji = ? AND issue_id = ?
LIMIT 1;

-- name: CreateReactionOnIssue :one
INSERT INTO reactions (user_id, emoji, issue_id)
VALUES (?, ?, ?)
RETURNING *;

-- name: DeleteReactionFromIssue :execrows
DELETE FROM reactions 
WHERE user_id = ? AND emoji = ? AND issue_id = ?;

-- name: GetIssueReactionCounts :many
SELECT emoji, COUNT(*) as count
FROM reactions
WHERE issue_id = ?
GROUP BY emoji
ORDER BY count DESC;

-- ============================================
-- Doc Reactions
-- ============================================

-- name: ListReactionsByDoc :many
SELECT r.*, u.username, u.full_name, u.avatar_url
FROM reactions r
JOIN users u ON r.user_id = u.id
WHERE r.doc_id = ?
ORDER BY r.created_at ASC;

-- name: GetReactionOnDoc :one
SELECT * FROM reactions
WHERE user_id = ? AND emoji = ? AND doc_id = ?
LIMIT 1;

-- name: CreateReactionOnDoc :one
INSERT INTO reactions (user_id, emoji, doc_id)
VALUES (?, ?, ?)
RETURNING *;

-- name: DeleteReactionFromDoc :execrows
DELETE FROM reactions 
WHERE user_id = ? AND emoji = ? AND doc_id = ?;

-- ============================================
-- Release Reactions
-- ============================================

-- name: ListReactionsByRelease :many
SELECT r.*, u.username, u.full_name, u.avatar_url
FROM reactions r
JOIN users u ON r.user_id = u.id
WHERE r.release_id = ?
ORDER BY r.created_at ASC;

-- name: GetReactionOnRelease :one
SELECT * FROM reactions
WHERE user_id = ? AND emoji = ? AND release_id = ?
LIMIT 1;

-- name: CreateReactionOnRelease :one
INSERT INTO reactions (user_id, emoji, release_id)
VALUES (?, ?, ?)
RETURNING *;

-- name: DeleteReactionFromRelease :execrows
DELETE FROM reactions 
WHERE user_id = ? AND emoji = ? AND release_id = ?;

-- ============================================
-- Issue Comment Reactions
-- ============================================

-- name: ListReactionsByIssueComment :many
SELECT r.*, u.username, u.full_name, u.avatar_url
FROM reactions r
JOIN users u ON r.user_id = u.id
WHERE r.issue_comment_id = ?
ORDER BY r.created_at ASC;

-- name: GetReactionOnIssueComment :one
SELECT * FROM reactions
WHERE user_id = ? AND emoji = ? AND issue_comment_id = ?
LIMIT 1;

-- name: CreateReactionOnIssueComment :one
INSERT INTO reactions (user_id, emoji, issue_comment_id)
VALUES (?, ?, ?)
RETURNING *;

-- name: DeleteReactionFromIssueComment :execrows
DELETE FROM reactions 
WHERE user_id = ? AND emoji = ? AND issue_comment_id = ?;

-- ============================================
-- Doc Comment Reactions
-- ============================================

-- name: ListReactionsByDocComment :many
SELECT r.*, u.username, u.full_name, u.avatar_url
FROM reactions r
JOIN users u ON r.user_id = u.id
WHERE r.doc_comment_id = ?
ORDER BY r.created_at ASC;

-- name: GetReactionOnDocComment :one
SELECT * FROM reactions
WHERE user_id = ? AND emoji = ? AND doc_comment_id = ?
LIMIT 1;

-- name: CreateReactionOnDocComment :one
INSERT INTO reactions (user_id, emoji, doc_comment_id)
VALUES (?, ?, ?)
RETURNING *;

-- name: DeleteReactionFromDocComment :execrows
DELETE FROM reactions 
WHERE user_id = ? AND emoji = ? AND doc_comment_id = ?;

-- ============================================
-- Release Comment Reactions
-- ============================================

-- name: ListReactionsByReleaseComment :many
SELECT r.*, u.username, u.full_name, u.avatar_url
FROM reactions r
JOIN users u ON r.user_id = u.id
WHERE r.release_comment_id = ?
ORDER BY r.created_at ASC;

-- name: GetReactionOnReleaseComment :one
SELECT * FROM reactions
WHERE user_id = ? AND emoji = ? AND release_comment_id = ?
LIMIT 1;

-- name: CreateReactionOnReleaseComment :one
INSERT INTO reactions (user_id, emoji, release_comment_id)
VALUES (?, ?, ?)
RETURNING *;

-- name: DeleteReactionFromReleaseComment :execrows
DELETE FROM reactions 
WHERE user_id = ? AND emoji = ? AND release_comment_id = ?;
