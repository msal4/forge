# Sarray Forge - Agent Instructions

## Project Overview

**Sarray Forge** is an internal ALM (Application Lifecycle Management) tool for a 4-person team at `@sarray.de`. It combines Jira-like issue tracking, Confluence-like documentation, and GitHub Releases-like file management.

### Core Modules
- **The Tablet** - Kanban-style issue tracking (`/issues`)
- **The Library** - Markdown documentation with hierarchy (`/docs`)
- **The Granary** - Release management with file uploads (`/releases`)

## Tech Stack

### Backend
- **Go 1.22+** using only `net/http` standard library (NO frameworks like Gin, Echo, etc.)
- **SQLite** with `mattn/go-sqlite3` driver
- **sqlc** for type-safe SQL query generation
- Pure SQL queries with parameterized statements (NO ORMs)

### Frontend
- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **Lucide React** for icons
- **Bun** as package manager and bundler (via Vite)

### Project Structure
```
sarray-forge/
├── cmd/server/main.go              # Entry point, route registration
├── internal/
│   ├── handlers/handlers.go        # HTTP handlers for all endpoints
│   ├── models/models.go            # Go structs and DTOs
│   ├── middleware/                  # Auth middleware
│   └── db/
│       ├── db.go                   # Database connection
│       ├── queries/*.sql           # sqlc query definitions
│       └── sqlc/                   # Generated sqlc code
├── migrations/
│   ├── 001_initial_schema.sql      # Database schema
│   └── 002_seed_data.sql           # Seed data (users, sample issues)
├── web/
│   ├── src/
│   │   ├── api/                    # API client functions
│   │   ├── components/             # React components
│   │   ├── pages/                  # Page components
│   │   ├── hooks/                  # Custom hooks (keyboard shortcuts, etc.)
│   │   └── App.tsx                 # Main app with routing
│   ├── index.html
│   ├── tailwind.config.js          # Custom theme colors
│   └── package.json
├── data/                           # Runtime data (SQLite DB, uploads)
└── Makefile                        # Build and dev commands
```

## Design System - "Modern Mesopotamian"

### Color Palette (defined in tailwind.config.js)
- **Lapis** (`lapis-*`) - Deep blue, primary color for text and accents
- **Clay** (`clay-*`) - Terracotta, used for high priority and accents
- **Parchment** (`parchment-*`) - Off-white backgrounds
- **Gold** (`gold-*`) - Accent color for medium priority and highlights

### Typography
- `font-inscription` - Serif font for headers (evokes stone tablet feel)
- Default sans-serif for body text

### Cuneiform Decorations
Use sparingly for thematic elements:
- `𒀭` - To Inscribe (todo)
- `𒁹` - Carving (in progress)
- `𒂗` - Baked (done)
- `𒋰` - General tablet symbol

### UI Patterns
- Keyboard-first navigation (hotkeys on buttons, command palette with Ctrl+K)
- Subtle shadows using `shadow-tablet` custom shadow
- Rounded corners with `rounded-tablet` or `rounded-lg`
- Consistent spacing with Tailwind defaults

## Development Commands

```bash
# Backend
cd sarray-forge
make db-reset          # Reset database with fresh schema + seed data
go run ./cmd/server    # Start backend on :8080

# Frontend (separate terminal)
cd sarray-forge/web
bun install            # Install dependencies
bun run dev            # Start Vite dev server on :3000
bun run build          # Production build to dist/

# Full build
make build             # Build both backend and frontend
```

## API Conventions

### Authentication
- Session-based auth with cookies
- Login: `POST /api/auth/login` with `{ username, password }`
- Smart login: username `zahra` auto-expands to `zahra@sarray.de`
- Default credentials: `zahra` / `admin` or `salman` / `admin`

### REST Endpoints
All endpoints prefixed with `/api/`:
- Issues: `GET/POST /issues`, `GET/PUT/PATCH/DELETE /issues/{id}`
- Docs: `GET/POST /docs`, `GET/PUT/DELETE /docs/{id}`
- Releases: `GET/POST /releases`, file upload/download endpoints
- Users: `GET /users`, `GET /users/me`

### Request/Response
- JSON bodies with camelCase field names
- Go structs use `json:"camelCase"` tags
- Dates sent as ISO 8601 strings, parsed as `time.Time` in Go

## Key Implementation Details

### Issue Modal (IssueModal.tsx)
- Unified modal for view/edit/create modes
- Seamless switching between modes without closing
- URL persistence: `?issue=123` keeps issue open on refresh
- Consistent heights for all fields to prevent layout jumping

### Kanban Board (IssuesPage.tsx)
- Drag-and-drop between columns
- Optimistic updates with rollback on error
- Status values: `to_inscribe`, `carving`, `baked`

### Keyboard Shortcuts (useKeyboard.ts)
- Global shortcuts registered via custom hook
- `c` - Create new item
- `e` - Edit (in view mode)
- `Ctrl+Enter` - Save
- `Escape` - Close modal
- `g i` / `g d` / `g r` - Navigate to Issues/Docs/Releases

## Common Issues & Solutions

### "Invalid request body" on issue creation
- Check that `project_id` is included in INSERT (required, use `1` for default)
- Dates must be ISO 8601 format for Go `time.Time` parsing

### 500 errors on API calls
- Check Go server logs for actual error
- Common: missing required DB columns, foreign key violations

### Input focus styles showing unwanted borders
- Use `outline-none ring-0 border-none` plus `focus:` variants
- May need inline `style={{ boxShadow: 'none' }}` for stubborn cases

### Modal layout jumping between modes
- Wrap elements in fixed-height containers (`h-10`, `min-h-[120px]`)
- Keep edit/view elements structurally similar

## Code Style Guidelines

### Go
- No external HTTP frameworks - use `net/http` only
- Handlers receive `*Handlers` struct with DB dependency
- Use `writeJSON()` and `writeError()` helpers for responses
- SQL queries inline in handlers or via sqlc

### React/TypeScript
- Functional components with hooks
- State colocated in page components, passed down as props
- API calls in `src/api/` modules
- Tailwind classes directly in JSX (no CSS modules)

### CSS/Tailwind
- Prefer Tailwind utilities over custom CSS
- Use theme colors (`lapis-*`, `parchment-*`, etc.)
- Multi-line class strings for readability
- Transitions on interactive elements (`transition-colors`, `transition-all`)

## Current State (as of last session)

### Completed Features
- Authentication with session cookies
- Full CRUD for Issues with Kanban board
- Unified issue modal with view/edit/create modes
- URL persistence for open issues
- Drag-and-drop status changes
- Keyboard shortcuts throughout
- Docs module with Markdown editor
- Releases module with file upload

### Recent Commits
```
fb28418 feat(kanban): enhance board with Mesopotamian aesthetic
fba06d2 feat(issues): unified view/edit modal with seamless mode switching
```

### Known Polish Items
- Command palette (Ctrl+K) needs implementation
- Activity log/audit trail not exposed in UI
- No notifications system yet
- Mobile responsiveness could be improved
