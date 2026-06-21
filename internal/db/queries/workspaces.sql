-- ============================================
-- Workspace Queries (projects table)
-- ============================================

-- name: GetWorkspaceByID :one
SELECT id, key, name, description, lead_id, is_archived, created_at, updated_at
FROM projects
WHERE id = ? LIMIT 1;

-- name: GetWorkspaceByKey :one
SELECT id, key, name, description, lead_id, is_archived, created_at, updated_at
FROM projects
WHERE key = ? COLLATE NOCASE LIMIT 1;

-- name: ListWorkspacesForUser :many
SELECT p.id, p.key, p.name, p.description, p.lead_id, p.is_archived, p.created_at, p.updated_at
FROM projects p
WHERE p.is_archived = 0
  AND (
    EXISTS (SELECT 1 FROM users u WHERE u.id = ? AND u.is_admin = 1)
    OR EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.project_id = p.id AND wm.user_id = ?)
  )
ORDER BY p.name;

-- name: ListAllWorkspaces :many
SELECT id, key, name, description, lead_id, is_archived, created_at, updated_at
FROM projects
WHERE is_archived = 0
ORDER BY name;

-- name: CreateWorkspace :one
INSERT INTO projects (key, name, description, lead_id)
VALUES (?, ?, ?, ?)
RETURNING id, key, name, description, lead_id, is_archived, created_at, updated_at;

-- name: UserHasWorkspaceAccess :one
SELECT EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = ? AND u.is_admin = 1
) OR EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.user_id = ? AND wm.project_id = ?
) AS has_access;

-- name: IsUserAdmin :one
SELECT is_admin FROM users WHERE id = ? LIMIT 1;

-- name: ListWorkspaceMembers :many
SELECT u.id, u.username, u.email, u.full_name, u.avatar_url, u.language, u.is_admin, u.created_at, u.updated_at
FROM workspace_members wm
JOIN users u ON wm.user_id = u.id
WHERE wm.project_id = ?
ORDER BY u.username;

-- name: AddWorkspaceMember :exec
INSERT OR IGNORE INTO workspace_members (user_id, project_id)
VALUES (?, ?);

-- name: RemoveWorkspaceMember :exec
DELETE FROM workspace_members
WHERE project_id = ? AND user_id = ?;

-- name: RemoveAllWorkspaceMembers :exec
DELETE FROM workspace_members WHERE project_id = ?;

-- name: GetIssueProjectID :one
SELECT project_id FROM issues WHERE id = ? LIMIT 1;

-- name: GetDocProjectID :one
SELECT project_id FROM docs WHERE id = ? LIMIT 1;

-- name: GetReleaseProjectID :one
SELECT project_id FROM releases WHERE id = ? LIMIT 1;
