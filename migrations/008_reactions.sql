-- ============================================
-- REACTIONS TABLE
-- Emoji reactions on issues, docs, releases, and comments
-- Uses polymorphic references (one FK per entity type)
-- ============================================

CREATE TABLE IF NOT EXISTS reactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    emoji TEXT NOT NULL,  -- Emoji character: '👍', '👎', '😄', '🎉', '😕', '❤️', '🚀', '👀'
    
    -- Polymorphic references (only one will be non-null per row)
    issue_id INTEGER,
    doc_id INTEGER,
    release_id INTEGER,
    issue_comment_id INTEGER,
    doc_comment_id INTEGER,
    release_comment_id INTEGER,
    
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign keys
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE,
    FOREIGN KEY (doc_id) REFERENCES docs(id) ON DELETE CASCADE,
    FOREIGN KEY (release_id) REFERENCES releases(id) ON DELETE CASCADE,
    FOREIGN KEY (issue_comment_id) REFERENCES issue_comments(id) ON DELETE CASCADE,
    FOREIGN KEY (doc_comment_id) REFERENCES doc_comments(id) ON DELETE CASCADE,
    FOREIGN KEY (release_comment_id) REFERENCES release_comments(id) ON DELETE CASCADE
);

-- Unique constraints: one reaction type per user per entity
CREATE UNIQUE INDEX idx_reactions_user_issue ON reactions(user_id, emoji, issue_id) WHERE issue_id IS NOT NULL;
CREATE UNIQUE INDEX idx_reactions_user_doc ON reactions(user_id, emoji, doc_id) WHERE doc_id IS NOT NULL;
CREATE UNIQUE INDEX idx_reactions_user_release ON reactions(user_id, emoji, release_id) WHERE release_id IS NOT NULL;
CREATE UNIQUE INDEX idx_reactions_user_issue_comment ON reactions(user_id, emoji, issue_comment_id) WHERE issue_comment_id IS NOT NULL;
CREATE UNIQUE INDEX idx_reactions_user_doc_comment ON reactions(user_id, emoji, doc_comment_id) WHERE doc_comment_id IS NOT NULL;
CREATE UNIQUE INDEX idx_reactions_user_release_comment ON reactions(user_id, emoji, release_comment_id) WHERE release_comment_id IS NOT NULL;

-- Indexes for efficient lookups by entity
CREATE INDEX idx_reactions_issue ON reactions(issue_id) WHERE issue_id IS NOT NULL;
CREATE INDEX idx_reactions_doc ON reactions(doc_id) WHERE doc_id IS NOT NULL;
CREATE INDEX idx_reactions_release ON reactions(release_id) WHERE release_id IS NOT NULL;
CREATE INDEX idx_reactions_issue_comment ON reactions(issue_comment_id) WHERE issue_comment_id IS NOT NULL;
CREATE INDEX idx_reactions_doc_comment ON reactions(doc_comment_id) WHERE doc_comment_id IS NOT NULL;
CREATE INDEX idx_reactions_release_comment ON reactions(release_comment_id) WHERE release_comment_id IS NOT NULL;
