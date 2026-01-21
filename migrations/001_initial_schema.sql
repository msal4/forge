-- ============================================
-- Sarray Forge - Initial Database Schema
-- Migration: 001_initial_schema.sql
-- ============================================

-- Enable foreign keys (SQLite requires this per-connection)
PRAGMA foreign_keys = ON;

-- ============================================
-- USERS TABLE
-- Smart login: username alone resolves to username@sarray.de
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Username is the primary identifier (e.g., 'zahra')
    -- Smart login: 'zahra' -> 'zahra@sarray.de'
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    
    -- Full email stored for clarity, but derived from username + domain
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    
    -- Password hash (bcrypt)
    password_hash TEXT NOT NULL,
    
    -- Profile information
    full_name TEXT NOT NULL DEFAULT '',
    avatar_url TEXT DEFAULT '',
    
    -- Account status
    is_active BOOLEAN NOT NULL DEFAULT 1,
    
    -- Timestamps
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);

-- ============================================
-- SESSIONS TABLE
-- Authentication tokens for logged-in users
-- ============================================
CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    
    -- Secure random token
    token TEXT NOT NULL UNIQUE,
    
    -- Session metadata
    user_agent TEXT DEFAULT '',
    ip_address TEXT DEFAULT '',
    
    -- Expiration
    expires_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

-- ============================================
-- PROJECTS TABLE
-- Organizational unit for issues and docs
-- ============================================
CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Project identifier (e.g., 'FORGE', 'API')
    key TEXT NOT NULL UNIQUE COLLATE NOCASE,
    
    -- Display name
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    
    -- Project lead
    lead_id INTEGER,
    
    -- Project status
    is_archived BOOLEAN NOT NULL DEFAULT 0,
    
    -- Timestamps
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (lead_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_projects_key ON projects(key);

-- ============================================
-- ISSUES TABLE (The Tablet)
-- Kanban-style issue tracking with rank for ordering
-- ============================================
CREATE TABLE IF NOT EXISTS issues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Project association
    project_id INTEGER NOT NULL,
    
    -- Issue number within project (auto-incremented per project)
    issue_number INTEGER NOT NULL,
    
    -- Content
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    
    -- Kanban status: 'to_inscribe' (Todo), 'carving' (In Progress), 'baked' (Done)
    status TEXT NOT NULL DEFAULT 'to_inscribe' 
        CHECK(status IN ('to_inscribe', 'carving', 'baked')),
    
    -- Priority levels
    priority TEXT NOT NULL DEFAULT 'medium'
        CHECK(priority IN ('low', 'medium', 'high', 'critical')),
    
    -- Issue type
    issue_type TEXT NOT NULL DEFAULT 'task'
        CHECK(issue_type IN ('task', 'bug', 'feature', 'epic')),
    
    -- Lexicographic rank for ordering within status column
    -- Uses fractional indexing (e.g., 'aaa', 'aab', 'aac' or 'a|b', 'a|c')
    rank TEXT NOT NULL DEFAULT '',
    
    -- Assignments
    reporter_id INTEGER NOT NULL,
    assignee_id INTEGER,
    
    -- Optional parent for sub-tasks
    parent_id INTEGER,
    
    -- Labels stored as JSON array
    labels TEXT DEFAULT '[]',
    
    -- Story points for estimation
    story_points INTEGER,
    
    -- Due date
    due_date DATE,
    
    -- Resolution
    resolved_at DATETIME,
    
    -- Timestamps
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (parent_id) REFERENCES issues(id) ON DELETE SET NULL,
    
    -- Ensure unique issue numbers within a project
    UNIQUE(project_id, issue_number)
);

CREATE INDEX idx_issues_project_id ON issues(project_id);
CREATE INDEX idx_issues_status ON issues(status);
CREATE INDEX idx_issues_assignee_id ON issues(assignee_id);
CREATE INDEX idx_issues_reporter_id ON issues(reporter_id);
CREATE INDEX idx_issues_parent_id ON issues(parent_id);
CREATE INDEX idx_issues_rank ON issues(status, rank);
CREATE INDEX idx_issues_project_number ON issues(project_id, issue_number);

-- ============================================
-- ISSUE COMMENTS TABLE
-- Discussion threads on issues
-- ============================================
CREATE TABLE IF NOT EXISTS issue_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    issue_id INTEGER NOT NULL,
    author_id INTEGER NOT NULL,
    
    -- Markdown content
    content TEXT NOT NULL,
    
    -- Timestamps
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX idx_issue_comments_issue_id ON issue_comments(issue_id);

-- ============================================
-- DOCS TABLE (The Library)
-- Hierarchical documentation with Markdown content
-- ============================================
CREATE TABLE IF NOT EXISTS docs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Optional project association (NULL = global doc)
    project_id INTEGER,
    
    -- URL-friendly slug
    slug TEXT NOT NULL UNIQUE,
    
    -- Content
    title TEXT NOT NULL,
    content TEXT DEFAULT '',  -- Markdown with Mermaid support
    
    -- Hierarchy (self-referential for nested docs)
    parent_id INTEGER,
    
    -- Ordering within parent
    sort_order INTEGER NOT NULL DEFAULT 0,
    
    -- Authorship
    author_id INTEGER NOT NULL,
    last_editor_id INTEGER,
    
    -- Publishing status
    is_published BOOLEAN NOT NULL DEFAULT 1,
    
    -- Timestamps
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
    FOREIGN KEY (parent_id) REFERENCES docs(id) ON DELETE SET NULL,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (last_editor_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_docs_slug ON docs(slug);
CREATE INDEX idx_docs_project_id ON docs(project_id);
CREATE INDEX idx_docs_parent_id ON docs(parent_id);
CREATE INDEX idx_docs_author_id ON docs(author_id);

-- ============================================
-- RELEASES TABLE (The Granary)
-- Version releases with file attachments
-- ============================================
CREATE TABLE IF NOT EXISTS releases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Optional project association
    project_id INTEGER,
    
    -- Semantic version (e.g., '1.0.0', 'v2.3.1')
    version TEXT NOT NULL,
    
    -- Release info
    title TEXT NOT NULL,
    description TEXT DEFAULT '',  -- Markdown changelog
    
    -- Release author
    author_id INTEGER NOT NULL,
    
    -- Release status
    is_draft BOOLEAN NOT NULL DEFAULT 1,
    is_prerelease BOOLEAN NOT NULL DEFAULT 0,
    
    -- Publication timestamp
    published_at DATETIME,
    
    -- Timestamps
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE RESTRICT,
    
    -- Unique version per project (NULL project = global)
    UNIQUE(project_id, version)
);

CREATE INDEX idx_releases_project_id ON releases(project_id);
CREATE INDEX idx_releases_version ON releases(version);
CREATE INDEX idx_releases_published_at ON releases(published_at);

-- ============================================
-- RELEASE FILES TABLE
-- Files attached to releases
-- ============================================
CREATE TABLE IF NOT EXISTS release_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    release_id INTEGER NOT NULL,
    
    -- File metadata
    filename TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    file_path TEXT NOT NULL,  -- Relative path in ./data/releases/
    file_size INTEGER NOT NULL DEFAULT 0,
    mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
    
    -- Checksum for integrity
    sha256_hash TEXT,
    
    -- Download tracking
    download_count INTEGER NOT NULL DEFAULT 0,
    
    -- Timestamps
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (release_id) REFERENCES releases(id) ON DELETE CASCADE
);

CREATE INDEX idx_release_files_release_id ON release_files(release_id);

-- ============================================
-- ACTIVITY LOG TABLE
-- Audit trail for important actions
-- ============================================
CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Actor
    user_id INTEGER,
    
    -- Action details
    action TEXT NOT NULL,  -- e.g., 'issue.created', 'doc.updated'
    entity_type TEXT NOT NULL,  -- e.g., 'issue', 'doc', 'release'
    entity_id INTEGER NOT NULL,
    
    -- Additional context as JSON
    metadata TEXT DEFAULT '{}',
    
    -- Timestamp
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_activity_log_user_id ON activity_log(user_id);
CREATE INDEX idx_activity_log_entity ON activity_log(entity_type, entity_id);
CREATE INDEX idx_activity_log_created_at ON activity_log(created_at);

-- ============================================
-- TRIGGERS
-- Auto-update timestamps and issue numbers
-- ============================================

-- Auto-update updated_at on users
CREATE TRIGGER trg_users_updated_at
AFTER UPDATE ON users
BEGIN
    UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Auto-update updated_at on projects
CREATE TRIGGER trg_projects_updated_at
AFTER UPDATE ON projects
BEGIN
    UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Auto-update updated_at on issues
CREATE TRIGGER trg_issues_updated_at
AFTER UPDATE ON issues
BEGIN
    UPDATE issues SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Auto-assign issue_number within project
CREATE TRIGGER trg_issues_auto_number
AFTER INSERT ON issues
WHEN NEW.issue_number = 0 OR NEW.issue_number IS NULL
BEGIN
    UPDATE issues 
    SET issue_number = (
        SELECT COALESCE(MAX(issue_number), 0) + 1 
        FROM issues 
        WHERE project_id = NEW.project_id
    )
    WHERE id = NEW.id;
END;

-- Auto-update updated_at on issue_comments
CREATE TRIGGER trg_issue_comments_updated_at
AFTER UPDATE ON issue_comments
BEGIN
    UPDATE issue_comments SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Auto-update updated_at on docs
CREATE TRIGGER trg_docs_updated_at
AFTER UPDATE ON docs
BEGIN
    UPDATE docs SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Auto-update updated_at on releases
CREATE TRIGGER trg_releases_updated_at
AFTER UPDATE ON releases
BEGIN
    UPDATE releases SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
