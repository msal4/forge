-- ============================================
-- Sarray Forge - User Language Preference
-- Migration: 007_user_language.sql
-- ============================================

-- Add language preference to users table
-- Used for localized notifications (e.g., Telegram)
-- Defaults to 'en' (English)
ALTER TABLE users ADD COLUMN language TEXT NOT NULL DEFAULT 'en';
