# Sarray Forge

Internal ALM (Application Lifecycle Management) tool for the @sarray.de team. Combines issue tracking, documentation, and release management in a single application.

## Modules

- **The Tablet** (`/issues`) - Kanban-style issue tracking
- **The Library** (`/docs`) - Markdown documentation with hierarchy
- **The Granary** (`/releases`) - Release management with file uploads

## Requirements

### Required

- **Go 1.22+** - Backend server
- **Bun** - Frontend package manager and bundler
- **GCC/CGO** - Required for SQLite compilation (`CGO_ENABLED=1`)
- **SQLite3** - Database (embedded, no separate server needed)

### Optional

- **sqlc** - For regenerating database query code (install via `go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest`)
- **TLS certificates** - For HTTPS (falls back to HTTP if not present)

## Quick Start

```bash
# Install dependencies
make deps

# Start development servers (backend + frontend with hot reload)
make dev
```

This starts:
- Backend API at `http://localhost:8080`
- Frontend dev server at `http://localhost:3000`

### Default Login

| Username | Email              | Password |
|----------|--------------------|----------|
| salman   | salman@sarray.de   | admin    |
| maytham  | maytham@sarray.de  | admin    |
| zahra    | zahra@sarray.de    | admin    |
| mujtaba  | mujtaba@sarray.de  | admin    |

You can log in with just the username (e.g., `zahra`) - it auto-expands to the full email.

## Development

### Run Backend Only

```bash
go run ./cmd/server
# or
make run
```

### Run Frontend Only

```bash
cd web
bun install
bun run dev
```

### Build for Production

```bash
make build
```

This creates:
- `bin/sarray-forge` - Backend binary
- `web/dist/` - Frontend static files

### Build Optimized Release Binary

```bash
make release
```

Creates a smaller, optimized binary with stripped debug symbols.

## Configuration

All configuration is via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | Server port |
| `DATABASE_PATH` | `./data/sarray-forge.db` | SQLite database file path |
| `MIGRATIONS_DIR` | `./migrations` | SQL migration files directory |
| `STATIC_DIR` | `./web/dist` | Frontend static files directory |
| `TLS_CERT` | `./certs/cert.pem` | TLS certificate file |
| `TLS_KEY` | `./certs/key.pem` | TLS private key file |

### Example

```bash
PORT=3000 DATABASE_PATH=/var/lib/forge/data.db ./bin/sarray-forge
```

## TLS/HTTPS

The server automatically uses HTTPS if TLS certificates are found. To enable:

```bash
# Create certs directory
mkdir -p certs

# Generate self-signed certificate (for development)
openssl req -x509 -newkey rsa:4096 -keyout certs/key.pem -out certs/cert.pem -days 365 -nodes -subj "/CN=localhost"

# Or specify custom paths
TLS_CERT=/path/to/cert.pem TLS_KEY=/path/to/key.pem ./bin/sarray-forge
```

If no certificates are found, the server falls back to HTTP.

## Database

SQLite database is created automatically on first run with all migrations applied.

### Commands

```bash
make db-reset    # Delete database (recreated on next server start)
make db-shell    # Open SQLite interactive shell
make db-schema   # Show database schema
make db-dump     # Export database to data/backup.sql
```

### Regenerate Query Code

If you modify SQL queries in `internal/db/queries/`:

```bash
make sqlc
```

## Deployment

### Option 1: Single Binary (Recommended)

```bash
# Build everything
make release

# Copy to server
scp bin/sarray-forge user@server:/opt/forge/
scp -r migrations/ user@server:/opt/forge/

# Run on server
cd /opt/forge
./sarray-forge
```

The frontend is served from `./web/dist` by default. Either:
- Build frontend locally and copy `web/dist/` to the server
- Or set `STATIC_DIR` to point to your frontend build location

### Option 2: Systemd Service

Create `/etc/systemd/system/sarray-forge.service`:

```ini
[Unit]
Description=Sarray Forge ALM
After=network.target

[Service]
Type=simple
User=forge
WorkingDirectory=/opt/forge
ExecStart=/opt/forge/sarray-forge
Restart=always
RestartSec=5

Environment=PORT=8080
Environment=DATABASE_PATH=/opt/forge/data/sarray-forge.db
Environment=STATIC_DIR=/opt/forge/web/dist

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable sarray-forge
sudo systemctl start sarray-forge
```

### Option 3: Docker

```dockerfile
FROM golang:1.22-alpine AS builder
RUN apk add --no-cache gcc musl-dev
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=1 go build -ldflags="-s -w" -o sarray-forge ./cmd/server

FROM node:20-alpine AS frontend
RUN npm install -g bun
WORKDIR /app
COPY web/package.json web/bun.lockb ./
RUN bun install
COPY web/ .
RUN bun run build

FROM alpine:latest
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY --from=builder /app/sarray-forge .
COPY --from=frontend /app/dist ./web/dist
COPY migrations ./migrations
EXPOSE 8080
CMD ["./sarray-forge"]
```

```bash
docker build -t sarray-forge .
docker run -p 8080:8080 -v forge-data:/app/data sarray-forge
```

## Make Commands Reference

| Command | Description |
|---------|-------------|
| `make deps` | Install all dependencies (Go, sqlc, Bun) |
| `make dev` | Run backend + frontend with hot reload |
| `make run` | Run backend only |
| `make build` | Build frontend and backend |
| `make release` | Build optimized production binary |
| `make test` | Run Go tests |
| `make clean` | Remove build artifacts |
| `make sqlc` | Regenerate database query code |
| `make db-reset` | Delete database |
| `make db-shell` | Open SQLite shell |
| `make db-schema` | Show database schema |
| `make db-dump` | Export database to SQL |
| `make help` | Show all available commands |

## Tech Stack

- **Backend**: Go 1.22+ with `net/http` (no frameworks)
- **Database**: SQLite with sqlc for type-safe queries
- **Frontend**: React 18, TypeScript, Tailwind CSS, Vite
- **Package Manager**: Bun

## Project Structure

```
sarray-forge/
├── cmd/server/main.go          # Entry point
├── internal/
│   ├── handlers/               # HTTP handlers
│   ├── models/                 # Go structs/DTOs
│   ├── middleware/             # Auth, CORS, logging
│   ├── auth/                   # Authentication
│   └── db/                     # Database layer
├── migrations/                 # SQL migrations
├── web/                        # React frontend
│   ├── src/
│   │   ├── api/               # API client
│   │   ├── components/        # React components
│   │   ├── pages/             # Page components
│   │   └── hooks/             # Custom hooks
│   └── dist/                  # Built frontend (generated)
├── data/                       # Runtime data (database, uploads)
├── certs/                      # TLS certificates (optional)
└── Makefile
```
