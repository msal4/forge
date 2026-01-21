-- ============================================
-- Release Queries (The Granary)
-- ============================================

-- name: GetReleaseByID :one
SELECT 
    r.*,
    p.key as project_key,
    p.name as project_name,
    a.username as author_username,
    a.full_name as author_full_name
FROM releases r
LEFT JOIN projects p ON r.project_id = p.id
JOIN users a ON r.author_id = a.id
WHERE r.id = ? LIMIT 1;

-- name: GetReleaseByVersion :one
SELECT 
    r.*,
    p.key as project_key,
    p.name as project_name,
    a.username as author_username,
    a.full_name as author_full_name
FROM releases r
LEFT JOIN projects p ON r.project_id = p.id
JOIN users a ON r.author_id = a.id
WHERE r.project_id = ? AND r.version = ?
LIMIT 1;

-- name: GetLatestRelease :one
SELECT 
    r.*,
    p.key as project_key,
    a.username as author_username
FROM releases r
LEFT JOIN projects p ON r.project_id = p.id
JOIN users a ON r.author_id = a.id
WHERE r.project_id = ? AND r.is_draft = 0
ORDER BY r.published_at DESC
LIMIT 1;

-- name: ListReleases :many
SELECT 
    r.*,
    p.key as project_key,
    p.name as project_name,
    a.username as author_username
FROM releases r
LEFT JOIN projects p ON r.project_id = p.id
JOIN users a ON r.author_id = a.id
WHERE r.is_draft = 0
ORDER BY r.published_at DESC;

-- name: ListReleasesByProject :many
SELECT 
    r.*,
    a.username as author_username
FROM releases r
JOIN users a ON r.author_id = a.id
WHERE r.project_id = ? AND r.is_draft = 0
ORDER BY r.published_at DESC;

-- name: ListAllReleases :many
-- Include drafts (for admin/author)
SELECT 
    r.*,
    p.key as project_key,
    a.username as author_username
FROM releases r
LEFT JOIN projects p ON r.project_id = p.id
JOIN users a ON r.author_id = a.id
ORDER BY r.is_draft DESC, r.created_at DESC;

-- name: ListDraftReleases :many
SELECT 
    r.*,
    p.key as project_key,
    a.username as author_username
FROM releases r
LEFT JOIN projects p ON r.project_id = p.id
JOIN users a ON r.author_id = a.id
WHERE r.is_draft = 1
ORDER BY r.created_at DESC;

-- name: CreateRelease :one
INSERT INTO releases (project_id, version, title, description, author_id, is_draft, is_prerelease)
VALUES (?, ?, ?, ?, ?, ?, ?)
RETURNING *;

-- name: UpdateRelease :one
UPDATE releases SET
    version = COALESCE(?, version),
    title = COALESCE(?, title),
    description = COALESCE(?, description),
    is_prerelease = COALESCE(?, is_prerelease),
    updated_at = CURRENT_TIMESTAMP
WHERE id = ?
RETURNING *;

-- name: PublishRelease :one
UPDATE releases SET
    is_draft = 0,
    published_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
WHERE id = ?
RETURNING *;

-- name: UnpublishRelease :exec
UPDATE releases SET
    is_draft = 1,
    published_at = NULL,
    updated_at = CURRENT_TIMESTAMP
WHERE id = ?;

-- name: DeleteRelease :exec
DELETE FROM releases WHERE id = ?;

-- name: CountReleases :one
SELECT COUNT(*) FROM releases WHERE is_draft = 0;

-- name: CountReleasesByProject :one
SELECT COUNT(*) FROM releases WHERE project_id = ? AND is_draft = 0;

-- ============================================
-- Release File Queries
-- ============================================

-- name: GetReleaseFileByID :one
SELECT * FROM release_files WHERE id = ? LIMIT 1;

-- name: GetReleaseFileByName :one
SELECT * FROM release_files WHERE release_id = ? AND filename = ? LIMIT 1;

-- name: ListReleaseFiles :many
SELECT * FROM release_files WHERE release_id = ? ORDER BY filename;

-- name: CreateReleaseFile :one
INSERT INTO release_files (release_id, filename, original_filename, file_path, file_size, mime_type, sha256_hash)
VALUES (?, ?, ?, ?, ?, ?, ?)
RETURNING *;

-- name: UpdateReleaseFileDownloadCount :exec
UPDATE release_files SET download_count = download_count + 1 WHERE id = ?;

-- name: DeleteReleaseFile :exec
DELETE FROM release_files WHERE id = ?;

-- name: DeleteReleaseFiles :exec
DELETE FROM release_files WHERE release_id = ?;

-- name: GetTotalDownloads :one
SELECT COALESCE(SUM(download_count), 0) FROM release_files WHERE release_id = ?;
