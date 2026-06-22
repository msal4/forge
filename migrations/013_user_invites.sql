-- ============================================
-- Sarray Forge - User Invites
-- Migration: 013_user_invites.sql
-- ============================================

CREATE TABLE IF NOT EXISTS user_invites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT NOT NULL UNIQUE,
    username TEXT NOT NULL COLLATE NOCASE,
    email TEXT NOT NULL COLLATE NOCASE,
    full_name TEXT NOT NULL DEFAULT '',
    workspace_ids TEXT NOT NULL DEFAULT '[]',
    created_by INTEGER NOT NULL REFERENCES users(id),
    expires_at DATETIME NOT NULL,
    used_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_invites_token ON user_invites(token);
CREATE INDEX IF NOT EXISTS idx_user_invites_expires ON user_invites(expires_at);
