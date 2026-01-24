-- ============================================
-- DOC COMMENTS TABLE
-- Discussion threads on documentation pages
-- ============================================
CREATE TABLE IF NOT EXISTS doc_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    doc_id INTEGER NOT NULL,
    author_id INTEGER NOT NULL,
    
    -- Markdown content
    content TEXT NOT NULL,
    
    -- Timestamps
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (doc_id) REFERENCES docs(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX idx_doc_comments_doc_id ON doc_comments(doc_id);

-- Trigger to update updated_at on doc_comments
CREATE TRIGGER IF NOT EXISTS update_doc_comments_timestamp 
AFTER UPDATE ON doc_comments
FOR EACH ROW
BEGIN
    UPDATE doc_comments SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

-- ============================================
-- RELEASE COMMENTS TABLE
-- Discussion threads on releases
-- ============================================
CREATE TABLE IF NOT EXISTS release_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    release_id INTEGER NOT NULL,
    author_id INTEGER NOT NULL,
    
    -- Markdown content
    content TEXT NOT NULL,
    
    -- Timestamps
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (release_id) REFERENCES releases(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX idx_release_comments_release_id ON release_comments(release_id);

-- Trigger to update updated_at on release_comments
CREATE TRIGGER IF NOT EXISTS update_release_comments_timestamp 
AFTER UPDATE ON release_comments
FOR EACH ROW
BEGIN
    UPDATE release_comments SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;
