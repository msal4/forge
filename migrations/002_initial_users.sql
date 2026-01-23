-- ============================================
-- Sarray Forge - Initial Users
-- Migration: 002_initial_users.sql
-- ============================================

-- ============================================
-- INITIAL USERS
-- Password 'admin' hashed with bcrypt (cost 10)
-- All users get default password which should be changed on first login
-- ============================================

-- bcrypt hash of 'admin' (cost 10)
-- $2a$10$PySSJxw1iG6Yk0CvoIORh.66//qS9Pnaw9iVN6MrD7sImieSKlVg2

INSERT INTO users (username, email, password_hash, full_name, is_active) VALUES
    (
        'salman',
        'salman@sarray.de',
        '$2a$10$PySSJxw1iG6Yk0CvoIORh.66//qS9Pnaw9iVN6MrD7sImieSKlVg2',
        'Salman Sarray',
        1
    ),
    (
        'maytham',
        'maytham@sarray.de',
        '$2a$10$PySSJxw1iG6Yk0CvoIORh.66//qS9Pnaw9iVN6MrD7sImieSKlVg2',
        'Maytham Sarray',
        1
    ),
    (
        'zahra',
        'zahra@sarray.de',
        '$2a$10$PySSJxw1iG6Yk0CvoIORh.66//qS9Pnaw9iVN6MrD7sImieSKlVg2',
        'Zahra Sarray',
        1
    ),
    (
        'mujtaba',
        'mujtaba@sarray.de',
        '$2a$10$PySSJxw1iG6Yk0CvoIORh.66//qS9Pnaw9iVN6MrD7sImieSKlVg2',
        'Mujtaba Sarray',
        1
    )
ON CONFLICT(username) DO NOTHING;

-- ============================================
-- DEFAULT PROJECT
-- Required for issues to work
-- ============================================

INSERT INTO projects (key, name, description, lead_id) VALUES
    (
        'FORGE',
        'Sarray Forge',
        'Internal ALM tool for the Sarray team',
        (SELECT id FROM users WHERE username = 'salman')
    )
ON CONFLICT(key) DO NOTHING;
