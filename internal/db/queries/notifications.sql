-- ============================================
-- Notification Queries
-- ============================================

-- name: ListNotificationsByUser :many
-- Get all notifications for a user, ordered by most recent first
-- Includes actor information for display
SELECT 
    n.*,
    u.username as actor_username,
    u.full_name as actor_full_name,
    u.avatar_url as actor_avatar
FROM notifications n
JOIN users u ON n.actor_id = u.id
WHERE n.user_id = ?
ORDER BY n.created_at DESC
LIMIT ?;

-- name: CountUnreadNotifications :one
-- Get count of unread notifications for badge display
SELECT COUNT(*) FROM notifications 
WHERE user_id = ? AND is_read = 0;

-- name: GetNotificationByID :one
SELECT 
    n.*,
    u.username as actor_username,
    u.full_name as actor_full_name,
    u.avatar_url as actor_avatar
FROM notifications n
JOIN users u ON n.actor_id = u.id
WHERE n.id = ? AND n.user_id = ?
LIMIT 1;

-- name: CreateNotification :one
INSERT INTO notifications (
    user_id, actor_id, notification_type, entity_type, entity_id,
    comment_id, title, message, message_key, message_params
)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
RETURNING *;

-- name: MarkNotificationRead :one
UPDATE notifications 
SET is_read = 1, read_at = CURRENT_TIMESTAMP
WHERE id = ? AND user_id = ?
RETURNING *;

-- name: MarkAllNotificationsRead :execrows
UPDATE notifications 
SET is_read = 1, read_at = CURRENT_TIMESTAMP
WHERE user_id = ? AND is_read = 0;

-- name: DeleteNotification :exec
DELETE FROM notifications WHERE id = ? AND user_id = ?;

-- name: GetUserIDByUsername :one
-- For @mention lookup - find user by username
SELECT id FROM users 
WHERE username = ? COLLATE NOCASE
LIMIT 1;

-- name: GetIssueOwnerAndAssignee :one
-- Get reporter and assignee for an issue (for notification recipients)
SELECT 
    i.reporter_id,
    i.assignee_id,
    i.title,
    p.key as project_key,
    i.issue_number
FROM issues i
JOIN projects p ON i.project_id = p.id
WHERE i.id = ?
LIMIT 1;

-- name: GetDocOwner :one
-- Get author for a doc (for notification recipients)
SELECT 
    d.author_id,
    d.title
FROM docs d
WHERE d.id = ?
LIMIT 1;

-- name: GetReleaseOwner :one
-- Get author for a release (for notification recipients)
SELECT 
    r.author_id,
    r.title,
    r.version
FROM releases r
WHERE r.id = ?
LIMIT 1;
