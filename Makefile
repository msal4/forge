# ============================================
# Sarray Forge - Build & Development Commands
# ============================================

.PHONY: all build run dev clean test frontend backend help db-init db-reset db-shell sqlc

# Default target
all: build

# Build everything
build: frontend backend
	@echo "Build complete!"

# Build Go backend
backend:
	@echo "Building backend..."
	go build -o bin/sarray-forge ./cmd/server

# Build React frontend
frontend:
	@echo "Building frontend..."
	cd web && bun install && bun run build

# Run backend in development mode
run:
	@echo "Starting Sarray Forge..."
	go run ./cmd/server

# Development mode - run both backend and frontend with hot reload
dev:
	@echo "Starting development servers..."
	@echo "Backend: http://localhost:8080"
	@echo "Frontend: http://localhost:3000"
	@make -j2 dev-backend dev-frontend

dev-backend:
	go run ./cmd/server

dev-frontend:
	cd web && bun run dev

# Install dependencies
deps:
	go mod download
	go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest
	cd web && bun install

# Run tests
test:
	go test -v ./...

# Clean build artifacts
clean:
	rm -rf bin/
	rm -rf web/dist/

# ============================================
# Database Commands
# ============================================

# Reset database (delete and let Go server recreate with migrations)
db-reset:
	@echo "Resetting database..."
	rm -f data/sarray-forge.db data/sarray-forge.db-wal data/sarray-forge.db-shm
	@echo "Database deleted. Run 'make run' or 'go run ./cmd/server' to recreate."
	@echo "Users: salman, maytham, zahra, mujtaba @sarray.de (password: admin)"

# Open SQLite shell
db-shell:
	sqlite3 data/sarray-forge.db

# Show database tables
db-tables:
	sqlite3 data/sarray-forge.db ".tables"

# Show database schema
db-schema:
	sqlite3 data/sarray-forge.db ".schema"

# Dump database to SQL
db-dump:
	sqlite3 data/sarray-forge.db ".dump" > data/backup.sql
	@echo "Database dumped to data/backup.sql"

# ============================================
# SQLC Code Generation
# ============================================

# Generate Go code from SQL queries
sqlc:
	@echo "Generating sqlc code..."
	sqlc generate
	@echo "Generated code in internal/db/sqlc/"

# Verify sqlc queries
sqlc-verify:
	sqlc compile

# ============================================
# Release
# ============================================

# Generate single binary with embedded frontend
release: frontend
	@echo "Building release binary..."
	CGO_ENABLED=1 go build -ldflags="-s -w" -o bin/sarray-forge ./cmd/server
	@echo "Release binary: bin/sarray-forge"

# ============================================
# Help
# ============================================

help:
	@echo "Sarray Forge - Build Commands"
	@echo ""
	@echo "Development:"
	@echo "  make deps      - Install all dependencies (Go, sqlc, Bun)"
	@echo "  make run       - Run the backend server"
	@echo "  make dev       - Run backend + frontend with hot reload"
	@echo "  make build     - Build both frontend and backend"
	@echo "  make test      - Run tests"
	@echo "  make clean     - Remove build artifacts"
	@echo ""
	@echo "Database:"
	@echo "  make db-init   - Initialize database with migrations and seed data"
	@echo "  make db-reset  - Delete and recreate database"
	@echo "  make db-shell  - Open SQLite interactive shell"
	@echo "  make db-schema - Show database schema"
	@echo "  make db-dump   - Dump database to SQL file"
	@echo ""
	@echo "Code Generation:"
	@echo "  make sqlc      - Generate Go code from SQL queries"
	@echo ""
	@echo "Release:"
	@echo "  make release   - Build optimized single binary"
