-- ============================================
-- Sarray Forge - Workspace Support
-- Migration: 011_workspaces.sql
-- ============================================

-- Global admin flag
ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT 0;

UPDATE users SET is_admin = 1 WHERE email = 'mohammed@sarray.de';

-- User-workspace membership (projects table = workspaces)
CREATE TABLE IF NOT EXISTS workspace_members (
    user_id INTEGER NOT NULL,
    project_id INTEGER NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, project_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_project_id ON workspace_members(project_id);

-- Backfill NULL project associations into workspace 1 (FORGE)
UPDATE docs SET project_id = 1 WHERE project_id IS NULL;
UPDATE releases SET project_id = 1 WHERE project_id IS NULL;

-- Seed all active users into default workspace
INSERT OR IGNORE INTO workspace_members (user_id, project_id)
SELECT id, 1 FROM users WHERE is_active = 1;

-- Fix FORGE project lead
UPDATE projects
SET lead_id = (SELECT id FROM users WHERE email = 'mohammed@sarray.de'),
    updated_at = CURRENT_TIMESTAMP
WHERE key = 'FORGE';

-- Rebuild docs table: require project_id, unique slug per workspace
PRAGMA foreign_keys = OFF;

CREATE TABLE docs_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    slug TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT DEFAULT '',
    parent_id INTEGER,
    sort_order INTEGER NOT NULL DEFAULT 0,
    author_id INTEGER NOT NULL,
    last_editor_id INTEGER,
    is_published BOOLEAN NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES docs_new(id) ON DELETE SET NULL,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (last_editor_id) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(project_id, slug)
);

INSERT INTO docs_new (
    id, project_id, slug, title, content, parent_id, sort_order,
    author_id, last_editor_id, is_published, created_at, updated_at
)
SELECT
    id, project_id, slug, title, content, parent_id, sort_order,
    author_id, last_editor_id, is_published, created_at, updated_at
FROM docs;

DROP TABLE docs;
ALTER TABLE docs_new RENAME TO docs;

CREATE INDEX idx_docs_slug ON docs(slug);
CREATE INDEX idx_docs_project_id ON docs(project_id);
CREATE INDEX idx_docs_parent_id ON docs(parent_id);
CREATE INDEX idx_docs_author_id ON docs(author_id);

CREATE TRIGGER trg_docs_updated_at
AFTER UPDATE ON docs
BEGIN
    UPDATE docs SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Rebuild releases table: require project_id
CREATE TABLE releases_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    version TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    author_id INTEGER NOT NULL,
    is_draft BOOLEAN NOT NULL DEFAULT 1,
    is_prerelease BOOLEAN NOT NULL DEFAULT 0,
    published_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE RESTRICT,
    UNIQUE(project_id, version)
);

INSERT INTO releases_new (
    id, project_id, version, title, description, author_id,
    is_draft, is_prerelease, published_at, created_at, updated_at
)
SELECT
    id, project_id, version, title, description, author_id,
    is_draft, is_prerelease, published_at, created_at, updated_at
FROM releases;

DROP TABLE releases;
ALTER TABLE releases_new RENAME TO releases;

CREATE INDEX idx_releases_project_id ON releases(project_id);
CREATE INDEX idx_releases_version ON releases(version);
CREATE INDEX idx_releases_published_at ON releases(published_at);

CREATE TRIGGER trg_releases_updated_at
AFTER UPDATE ON releases
BEGIN
    UPDATE releases SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

PRAGMA foreign_keys = ON;
