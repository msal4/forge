-- ============================================
-- Sarray Forge - Add mention_everyone notification type
-- Migration: 010_mention_everyone_notification_type.sql
-- ============================================

-- SQLite doesn't support ALTER TABLE to modify CHECK constraints
-- We need to recreate the table with the new constraint

-- Step 1: Create new table with updated constraint (adding 'mention_everyone')
CREATE TABLE IF NOT EXISTS notifications_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    actor_id INTEGER NOT NULL,
    notification_type TEXT NOT NULL
        CHECK(notification_type IN ('mention', 'assigned', 'comment_on_owned', 'comment_on_assigned', 'entity_updated', 'entity_deleted', 'reaction', 'mention_everyone')),
    entity_type TEXT NOT NULL
        CHECK(entity_type IN ('issue', 'doc', 'release')),
    entity_id INTEGER NOT NULL,
    comment_id INTEGER,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT 0,
    read_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Step 2: Copy data from old table
INSERT INTO notifications_new (id, user_id, actor_id, notification_type, entity_type, entity_id, comment_id, title, message, is_read, read_at, created_at)
SELECT id, user_id, actor_id, notification_type, entity_type, entity_id, comment_id, title, message, is_read, read_at, created_at
FROM notifications;

-- Step 3: Drop old table
DROP TABLE notifications;

-- Step 4: Rename new table to original name
ALTER TABLE notifications_new RENAME TO notifications;

-- Step 5: Recreate indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_entity ON notifications(entity_type, entity_id);
