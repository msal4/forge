-- ============================================
-- Issue Queries (The Tablet)
-- ============================================

-- name: GetIssueByID :one
SELECT 
    i.*,
    p.key as project_key,
    p.name as project_name,
    r.username as reporter_username,
    r.full_name as reporter_full_name,
    a.username as assignee_username,
    a.full_name as assignee_full_name
FROM issues i
JOIN projects p ON i.project_id = p.id
JOIN users r ON i.reporter_id = r.id
LEFT JOIN users a ON i.assignee_id = a.id
WHERE i.id = ? LIMIT 1;

-- name: GetIssueByProjectAndNumber :one
SELECT 
    i.*,
    p.key as project_key,
    p.name as project_name,
    r.username as reporter_username,
    r.full_name as reporter_full_name,
    a.username as assignee_username,
    a.full_name as assignee_full_name
FROM issues i
JOIN projects p ON i.project_id = p.id
JOIN users r ON i.reporter_id = r.id
LEFT JOIN users a ON i.assignee_id = a.id
WHERE p.key = ? COLLATE NOCASE AND i.issue_number = ?
LIMIT 1;

-- name: ListIssuesByProject :many
SELECT 
    i.*,
    p.key as project_key,
    r.username as reporter_username,
    r.full_name as reporter_full_name,
    a.username as assignee_username,
    a.full_name as assignee_full_name
FROM issues i
JOIN projects p ON i.project_id = p.id
JOIN users r ON i.reporter_id = r.id
LEFT JOIN users a ON i.assignee_id = a.id
WHERE i.project_id = ?
ORDER BY i.status, i.rank, i.created_at DESC;

-- name: ListIssuesByStatus :many
-- For Kanban board: get all issues in a status column, ordered by rank
SELECT 
    i.*,
    p.key as project_key,
    r.username as reporter_username,
    a.username as assignee_username
FROM issues i
JOIN projects p ON i.project_id = p.id
JOIN users r ON i.reporter_id = r.id
LEFT JOIN users a ON i.assignee_id = a.id
WHERE i.project_id = ? AND i.status = ?
ORDER BY i.rank, i.created_at DESC;

-- name: ListIssuesByAssignee :many
SELECT 
    i.*,
    p.key as project_key,
    p.name as project_name,
    r.username as reporter_username
FROM issues i
JOIN projects p ON i.project_id = p.id
JOIN users r ON i.reporter_id = r.id
WHERE i.assignee_id = ?
ORDER BY i.status, i.priority DESC, i.created_at DESC;

-- name: ListRecentIssues :many
SELECT 
    i.*,
    p.key as project_key,
    r.username as reporter_username,
    a.username as assignee_username
FROM issues i
JOIN projects p ON i.project_id = p.id
JOIN users r ON i.reporter_id = r.id
LEFT JOIN users a ON i.assignee_id = a.id
ORDER BY i.updated_at DESC
LIMIT ?;

-- name: CreateIssue :one
INSERT INTO issues (
    project_id, issue_number, title, description, status, priority, 
    issue_type, rank, reporter_id, assignee_id, parent_id, labels, 
    story_points, due_date
)
VALUES (?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
RETURNING *;

-- name: UpdateIssue :one
UPDATE issues SET
    title = COALESCE(?, title),
    description = COALESCE(?, description),
    priority = COALESCE(?, priority),
    issue_type = COALESCE(?, issue_type),
    assignee_id = ?,
    labels = COALESCE(?, labels),
    story_points = ?,
    due_date = ?,
    updated_at = CURRENT_TIMESTAMP
WHERE id = ?
RETURNING *;

-- name: UpdateIssueStatus :one
-- Update status and rank (for Kanban drag-and-drop)
UPDATE issues SET
    status = ?,
    rank = ?,
    resolved_at = CASE WHEN ? = 'baked' THEN CURRENT_TIMESTAMP ELSE NULL END,
    updated_at = CURRENT_TIMESTAMP
WHERE id = ?
RETURNING *;

-- name: UpdateIssueRank :exec
-- Just update rank within same column
UPDATE issues SET rank = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;

-- name: DeleteIssue :exec
DELETE FROM issues WHERE id = ?;

-- name: CountIssuesByProject :one
SELECT COUNT(*) FROM issues WHERE project_id = ?;

-- name: CountIssuesByStatus :one
SELECT COUNT(*) FROM issues WHERE project_id = ? AND status = ?;

-- name: GetNextIssueNumber :one
SELECT COALESCE(MAX(issue_number), 0) + 1 FROM issues WHERE project_id = ?;

-- name: GetMaxRankInStatus :one
-- Get the highest rank in a status column for inserting at the end
SELECT COALESCE(MAX(rank), '') FROM issues WHERE project_id = ? AND status = ?;

-- name: SearchIssues :many
SELECT 
    i.*,
    p.key as project_key,
    r.username as reporter_username,
    a.username as assignee_username
FROM issues i
JOIN projects p ON i.project_id = p.id
JOIN users r ON i.reporter_id = r.id
LEFT JOIN users a ON i.assignee_id = a.id
WHERE i.title LIKE '%' || ? || '%' OR i.description LIKE '%' || ? || '%'
ORDER BY i.updated_at DESC
LIMIT ?;
