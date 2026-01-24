#!/bin/bash
# ==============================================
# Sarray Forge - Deployment Script
# Run this from your LOCAL machine to deploy
# Usage: ./deploy/deploy.sh
# ==============================================

set -e

# Load configuration from .env if present
if [[ -f deploy/.env ]]; then
    source deploy/.env
fi

# Configuration (override these in .env or environment)
DEPLOY_HOST="${DEPLOY_HOST:-direct.forge.sarray.de}"
DEPLOY_USER="${DEPLOY_USER:-root}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/sarray-forge}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${GREEN}[+]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[x]${NC} $1"; exit 1; }
info() { echo -e "${BLUE}[i]${NC} $1"; }

# ==============================================
# Pre-flight checks
# ==============================================
info "Deployment target: ${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}"
echo ""

# Check we're in the project root
if [[ ! -f "go.mod" ]] || [[ ! -d "web" ]]; then
    error "Run this script from the project root directory"
fi

# Check required tools
command -v go >/dev/null 2>&1 || error "Go is not installed"
command -v bun >/dev/null 2>&1 || error "Bun is not installed"
command -v rsync >/dev/null 2>&1 || error "rsync is not installed"
command -v ssh >/dev/null 2>&1 || error "ssh is not installed"

# ==============================================
# 1. Build Backend
# ==============================================
log "Building Go backend..."
mkdir -p bin

# CGO is required for SQLite
CGO_ENABLED=1 go build -ldflags="-s -w" -o bin/sarray-forge ./cmd/server

if [[ ! -f "bin/sarray-forge" ]]; then
    error "Backend build failed"
fi
log "Backend built: bin/sarray-forge ($(du -h bin/sarray-forge | cut -f1))"

# ==============================================
# 2. Build Frontend
# ==============================================
log "Building React frontend..."
cd web
bun install --frozen-lockfile 2>/dev/null || bun install
bun run build
cd ..

if [[ ! -f "web/dist/index.html" ]]; then
    error "Frontend build failed"
fi
log "Frontend built: web/dist/"

# ==============================================
# 3. Deploy to server
# ==============================================
log "Deploying to ${DEPLOY_HOST}..."

# Create temporary directory for deployment package
DEPLOY_TMP=$(mktemp -d)
trap "rm -rf $DEPLOY_TMP" EXIT

# Copy files to temp directory
mkdir -p "$DEPLOY_TMP"/{bin,web,migrations,deploy}
cp bin/sarray-forge "$DEPLOY_TMP/bin/"
cp -r web/dist "$DEPLOY_TMP/web/"
cp -r migrations "$DEPLOY_TMP/"
cp -r deploy "$DEPLOY_TMP/"

# Sync to server
rsync -avz --delete \
    --exclude 'data/' \
    --exclude 'backups/' \
    "$DEPLOY_TMP/" \
    "${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}/"

log "Files uploaded successfully"

# ==============================================
# 4. Post-deployment tasks on server
# ==============================================
log "Running post-deployment tasks..."

ssh "${DEPLOY_USER}@${DEPLOY_HOST}" << 'ENDSSH'
set -e

# Set correct ownership
chown -R forge:forge /opt/sarray-forge

# Make scripts executable
chmod +x /opt/sarray-forge/bin/sarray-forge
chmod +x /opt/sarray-forge/deploy/*.sh 2>/dev/null || true

# Copy service file if changed
if ! diff -q /opt/sarray-forge/deploy/sarray-forge.service /etc/systemd/system/sarray-forge.service >/dev/null 2>&1; then
    cp /opt/sarray-forge/deploy/sarray-forge.service /etc/systemd/system/
    systemctl daemon-reload
    echo "Service file updated"
fi

# Copy Caddyfile if changed
if ! diff -q /opt/sarray-forge/deploy/Caddyfile /etc/caddy/Caddyfile >/dev/null 2>&1; then
    cp /opt/sarray-forge/deploy/Caddyfile /etc/caddy/Caddyfile
    systemctl reload caddy
    echo "Caddyfile updated"
fi

# Restart the application
systemctl restart sarray-forge

# Wait a moment and check status
sleep 2
if systemctl is-active --quiet sarray-forge; then
    echo "sarray-forge is running"
else
    echo "WARNING: sarray-forge may have failed to start"
    journalctl -u sarray-forge -n 20 --no-pager
fi
ENDSSH

# ==============================================
# Done!
# ==============================================
echo ""
echo "=============================================="
echo -e "${GREEN}Deployment complete!${NC}"
echo "=============================================="
echo ""
echo "Application deployed to: https://${DEPLOY_HOST}"
echo ""
echo "Useful commands (run on server):"
echo "  systemctl status sarray-forge   # Check status"
echo "  journalctl -u sarray-forge -f   # View logs"
echo ""
