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
│   └── 002_initial_users.sql       # Initial users (salman, maytham, zahra, mujtaba)
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
- Default credentials: Any user (`salman`, `maytham`, `zahra`, `mujtaba`) with password `admin`

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
- URL persistence via path params: `/issues/123` keeps issue open on refresh
- Consistent heights for all fields to prevent layout jumping
- Markdown rendering with `remark-gfm` for GFM tables and checkboxes

### Kanban Board (IssuesPage.tsx)
- Drag-and-drop between columns
- Optimistic updates with rollback on error
- Status values: `to_inscribe`, `carving`, `baked`
- Issue description preview strips markdown for clean display

### Releases Page (ReleasesPage.tsx)
- Split layout: scrollable list (left) + sticky details panel (right)
- Selected release auto-scrolls to top with `scroll-mt-2` for ring visibility
- Delete action moved to details panel (not on cards)
- Markdown rendering for release descriptions

### Keyboard Shortcuts (useKeyboard.ts)
- Global shortcuts registered via custom hook
- `c` - Create new item
- `e` - Edit (in view mode)
- `f` - Focus filter search (on Kanban board)
- `Ctrl+Enter` - Save
- `Escape` - Close modal / clear filter
- `g i` / `g d` / `g r` - Navigate to Issues/Docs/Releases

### FilterBar (FilterBar.tsx)
- Client-side filtering with `useIssueFilters` hook
- Search by title/description (case-insensitive)
- Filter by assignee (single select dropdown)
- Filter by labels (multi-select, AND logic)
- Active filters shown as "Clay Tokens" with remove buttons
- Results count shows "Showing X of Y" when filtering

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
- URL persistence via path params (`/issues/123`, `/docs/456`, `/releases/789`)
- Drag-and-drop status changes
- Keyboard shortcuts throughout
- Command palette (Ctrl+K) with global search
- Docs module with Markdown editor
- Releases module with file upload and sticky details panel
- Markdown rendering with GFM support (tables, checkboxes)
- Arabic language support tested with seed data
- **FilterBar** for Kanban board (search, assignee, labels filtering)
- **Enhanced HomePage** with stats, recent issues, latest release, recent docs

### Recent Commits
```
b1c9164 feat: add filtering to Kanban board and enhance home page dashboard
14432c9 docs: update AGENTS.md with latest changes and technical notes
148dd84 fix: add scroll-mt-2 to release card for proper scroll margin
e37348c feat: improve markdown, navigation, and releases UX
```

### Known Polish Items
- Activity log/audit trail not exposed in UI
- No notifications system yet
- Mobile responsiveness could be improved

### Important Technical Notes

#### SQLite Connection Handling
- `MaxOpenConns` set to 10 (not 1) to allow concurrent reads
- Always close `*sql.Rows` immediately after use, not with `defer`, when multiple queries run sequentially
- WAL mode enabled for better concurrency

#### URL Navigation
- Use path params (`/issues/:id`) NOT query params (`?issue=id`) for proper browser back/forward
- Pages use `useParams()` and `useNavigate()` from react-router-dom

#### Modal Placement
- Modals must be outside `space-y-*` containers to avoid margin on overlay
- Use React fragments to separate page content from modals

#### Scrollable Lists with Selection
- Use `scroll-mt-*` on cards for proper scroll margin when using `scrollIntoView`
- Add padding with negative margin (`p-1 -m-1`) to prevent ring/shadow clipping

#### Scrollbar Stability
- `scrollbar-gutter: stable` applied globally on `html` element
- Prevents content jumping when scrollbar appears/disappears between pages

#### Issue Modal Create Mode
- Create mode opens modal without URL change (stays on `/issues`)
- The useEffect that syncs URL to modal state must check `modalMode !== 'create'` before closing
- `handleCloseModal` handles create mode separately (just closes state, no navigation)
- Backdrop click calls `onClose`, modal content has `onClick={e => e.stopPropagation()}`
