-- ============================================
-- Sarray Forge - Telegram Notifications
-- Migration: 006_telegram.sql
-- ============================================

-- Add Telegram chat ID to users table
-- When set, user receives notifications via Telegram
ALTER TABLE users ADD COLUMN telegram_chat_id TEXT DEFAULT NULL;

-- ============================================
-- TELEGRAM LINK TOKENS TABLE
-- Temporary tokens for linking Telegram accounts via deep link
-- Flow: User clicks link -> opens Telegram -> sends /start <token> -> bot validates and links
-- ============================================
CREATE TABLE IF NOT EXISTS telegram_link_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- User requesting to link their Telegram
    user_id INTEGER NOT NULL UNIQUE,
    
    -- Random token (included in deep link)
    token TEXT NOT NULL UNIQUE,
    
    -- Tokens expire after 10 minutes
    expires_at DATETIME NOT NULL,
    
    -- Timestamp
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_telegram_link_tokens_token ON telegram_link_tokens(token);
CREATE INDEX idx_telegram_link_tokens_expires ON telegram_link_tokens(expires_at);
