-- ============================================
-- Sarray Forge - Seed Data
-- Migration: 002_seed_data.sql
-- ============================================

-- ============================================
-- SEED USERS
-- Password 'admin' hashed with bcrypt (cost 10)
-- Generated via: htpasswd -nbBC 10 "" admin | tr -d ':\n' | sed 's/$2y/$2a/'
-- Or in Go: bcrypt.GenerateFromPassword([]byte("admin"), 10)
-- ============================================

-- bcrypt hash of 'admin' (cost 10)
-- Generated with: go run -e 'golang.org/x/crypto/bcrypt.GenerateFromPassword([]byte("admin"), 10)'

INSERT INTO users (username, email, password_hash, full_name, is_active) VALUES
    (
        'zahra',
        'zahra@sarray.de',
        '$2a$10$PySSJxw1iG6Yk0CvoIORh.66//qS9Pnaw9iVN6MrD7sImieSKlVg2',
        'Zahra Sarray',
        1
    ),
    (
        'salman',
        'salman@sarray.de',
        '$2a$10$PySSJxw1iG6Yk0CvoIORh.66//qS9Pnaw9iVN6MrD7sImieSKlVg2',
        'Salman Sarray',
        1
    )
ON CONFLICT(username) DO NOTHING;

-- ============================================
-- SEED DEFAULT PROJECT
-- ============================================

INSERT INTO projects (key, name, description, lead_id) VALUES
    (
        'FORGE',
        'Sarray Forge',
        'The internal ALM tool development project',
        (SELECT id FROM users WHERE username = 'zahra')
    )
ON CONFLICT(key) DO NOTHING;

-- ============================================
-- SEED SAMPLE ISSUES
-- ============================================

-- Get project and user IDs for seeding
INSERT INTO issues (project_id, issue_number, title, description, status, priority, issue_type, reporter_id, assignee_id, rank, labels) 
SELECT 
    p.id,
    1,
    'Set up project infrastructure',
    '## Tasks
- [x] Initialize Go backend with standard library
- [x] Set up SQLite database
- [x] Create React frontend with Bun
- [ ] Implement authentication
- [ ] Deploy initial version',
    'carving',
    'high',
    'epic',
    u1.id,
    u1.id,
    'a',
    '["infrastructure", "setup"]'
FROM projects p, users u1
WHERE p.key = 'FORGE' AND u1.username = 'zahra'
ON CONFLICT DO NOTHING;

INSERT INTO issues (project_id, issue_number, title, description, status, priority, issue_type, reporter_id, assignee_id, rank, labels)
SELECT 
    p.id,
    2,
    'Implement smart login with @sarray.de',
    'Users should be able to login with just their username (e.g., "zahra") and the system automatically appends @sarray.de domain.',
    'baked',
    'high',
    'feature',
    u1.id,
    u2.id,
    'a',
    '["auth", "ux"]'
FROM projects p, users u1, users u2
WHERE p.key = 'FORGE' AND u1.username = 'zahra' AND u2.username = 'salman'
ON CONFLICT DO NOTHING;

INSERT INTO issues (project_id, issue_number, title, description, status, priority, issue_type, reporter_id, rank, labels)
SELECT 
    p.id,
    3,
    'Add keyboard shortcuts system',
    '## Requirements
- Global command palette (Cmd+K)
- Navigation shortcuts (g+i, g+d, g+r)
- Action shortcuts with visual hints
- Hotkey badges on buttons',
    'to_inscribe',
    'medium',
    'feature',
    u1.id,
    'a',
    '["ux", "keyboard"]'
FROM projects p, users u1
WHERE p.key = 'FORGE' AND u1.username = 'salman'
ON CONFLICT DO NOTHING;

INSERT INTO issues (project_id, issue_number, title, description, status, priority, issue_type, reporter_id, rank, labels)
SELECT 
    p.id,
    4,
    'Design Mesopotamian visual theme',
    'Create the "Modern Mesopotamian" theme with:
- Lapis Lazuli (deep blue) for primary elements
- Clay (terracotta) for accents
- Parchment (off-white) for backgrounds
- Serif fonts for headers (inscription feel)',
    'to_inscribe',
    'medium',
    'task',
    u1.id,
    'b',
    '["design", "ui"]'
FROM projects p, users u1
WHERE p.key = 'FORGE' AND u1.username = 'zahra'
ON CONFLICT DO NOTHING;

-- ============================================
-- SEED SAMPLE DOCS
-- ============================================

INSERT INTO docs (project_id, slug, title, content, author_id, sort_order)
SELECT 
    p.id,
    'getting-started',
    'Getting Started',
    '# Getting Started with Sarray Forge

Welcome to the ancient workshop! This guide will help you begin your journey.

## Quick Start

1. **Login** with your username (e.g., `zahra` - we add `@sarray.de` automatically)
2. **Navigate** using keyboard shortcuts or the command palette (`Ctrl+K`)
3. **Create** issues, docs, or releases with the `C` key

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+K` | Open command palette |
| `g i` | Go to Issues (The Tablet) |
| `g d` | Go to Docs (The Library) |
| `g r` | Go to Releases (The Granary) |
| `c` | Create new item |
| `?` | Show all shortcuts |

## Architecture

```mermaid
graph TD
    A[React Frontend] -->|REST API| B[Go Backend]
    B -->|SQLite| C[(Database)]
    B -->|File Storage| D[./data/releases]
```

Happy forging!',
    u1.id,
    0
FROM projects p, users u1
WHERE p.key = 'FORGE' AND u1.username = 'zahra'
ON CONFLICT(slug) DO NOTHING;

INSERT INTO docs (project_id, slug, title, content, author_id, sort_order)
SELECT 
    p.id,
    'api-reference',
    'API Reference',
    '# API Reference

All API endpoints are prefixed with `/api`.

## Authentication

### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "zahra",
  "password": "admin"
}
```

**Response:**
```json
{
  "token": "abc123...",
  "user": {
    "id": 1,
    "username": "zahra",
    "email": "zahra@sarray.de"
  }
}
```

## Issues

### List Issues
```http
GET /api/issues?status=to_inscribe&project_id=1
Authorization: Bearer <token>
```

### Create Issue
```http
POST /api/issues
Authorization: Bearer <token>
Content-Type: application/json

{
  "project_id": 1,
  "title": "New tablet inscription",
  "description": "Details here...",
  "priority": "high"
}
```

## Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 404 | Not Found |
| 500 | Server Error |',
    u1.id,
    1
FROM projects p, users u1
WHERE p.key = 'FORGE' AND u1.username = 'salman'
ON CONFLICT(slug) DO NOTHING;

-- ============================================
-- SEED SAMPLE RELEASE
-- ============================================

INSERT INTO releases (project_id, version, title, description, author_id, is_draft, published_at)
SELECT 
    p.id,
    '0.1.0',
    'Initial Alpha Release',
    '# Sarray Forge v0.1.0

The first release of the ancient workshop!

## Features

- Basic authentication with smart login
- Issue tracking (The Tablet) with Kanban board
- Documentation (The Library) with Markdown support
- Release management (The Granary)
- Keyboard-first navigation
- Modern Mesopotamian theme

## Breaking Changes

None - this is the first release!

## Contributors

- @zahra - Project lead & backend
- @salman - Frontend & design',
    u1.id,
    0,
    CURRENT_TIMESTAMP
FROM projects p, users u1
WHERE p.key = 'FORGE' AND u1.username = 'zahra'
ON CONFLICT DO NOTHING;
