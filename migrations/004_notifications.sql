-- ============================================
-- Sarray Forge - Notifications System
-- Migration: 004_notifications.sql
-- ============================================

-- ============================================
-- NOTIFICATIONS TABLE
-- In-app notifications for mentions, assignments, and comments
-- Designed for future extensibility (email, Telegram)
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Recipient of the notification
    user_id INTEGER NOT NULL,
    
    -- Who triggered the notification
    actor_id INTEGER NOT NULL,
    
    -- Type of notification
    -- 'mention' - @username in a comment
    -- 'assigned' - Issue assigned to user
    -- 'comment_on_owned' - Comment on entity user created
    -- 'comment_on_assigned' - Comment on issue user is assigned to
    -- 'entity_updated' - Someone updated your issue/doc/release
    -- 'entity_deleted' - Someone deleted your issue/doc/release
    notification_type TEXT NOT NULL
        CHECK(notification_type IN ('mention', 'assigned', 'comment_on_owned', 'comment_on_assigned', 'entity_updated', 'entity_deleted')),
    
    -- What entity this notification relates to
    entity_type TEXT NOT NULL  -- 'issue', 'doc', 'release'
        CHECK(entity_type IN ('issue', 'doc', 'release')),
    entity_id INTEGER NOT NULL,
    
    -- Optional: specific comment that triggered the notification
    comment_id INTEGER,
    
    -- Display information
    title TEXT NOT NULL,    -- Entity title for display (e.g., "FORGE-42: Fix login bug")
    message TEXT NOT NULL,  -- Human-readable message (e.g., "Zahra mentioned you")
    
    -- Read status
    is_read BOOLEAN NOT NULL DEFAULT 0,
    read_at DATETIME,
    
    -- Timestamps
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for fetching user's notifications
CREATE INDEX idx_notifications_user_id ON notifications(user_id);

-- Index for counting unread notifications efficiently
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read);

-- Index for ordering by date
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- Index for looking up by entity (for potential cleanup or grouping)
CREATE INDEX idx_notifications_entity ON notifications(entity_type, entity_id);
