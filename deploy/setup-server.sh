#!/bin/bash
# ==============================================
# Sarray Forge - Server Setup Script
# Run this ONCE on a fresh Ubuntu 24.04 LTS VPS
# Usage: sudo bash setup-server.sh
# ==============================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() { echo -e "${GREEN}[+]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[x]${NC} $1"; exit 1; }

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   error "This script must be run as root (use sudo)"
fi

log "Starting Sarray Forge server setup..."

# ==============================================
# 1. Install required packages
# ==============================================
log "Installing required packages..."
apt update && apt upgrade -y
apt install -y caddy sqlite3

# ==============================================
# 2. Create forge user (if not exists)
# ==============================================
if id "forge" &>/dev/null; then
    warn "User 'forge' already exists"
else
    log "Creating 'forge' system user..."
    useradd --system --shell /usr/bin/nologin --home-dir /opt/sarray-forge forge
fi

# ==============================================
# 3. Create directory structure
# ==============================================
log "Creating directory structure..."
mkdir -p /opt/sarray-forge/{bin,web/dist,migrations,data/releases,backups}

# ==============================================
# 4. Set permissions
# ==============================================
log "Setting permissions..."
chown -R forge:forge /opt/sarray-forge
chmod 750 /opt/sarray-forge
chmod 770 /opt/sarray-forge/data
chmod 770 /opt/sarray-forge/backups

# ==============================================
# 5. Install systemd service
# ==============================================
log "Installing systemd service..."
cp /opt/sarray-forge/deploy/sarray-forge.service /etc/systemd/system/ 2>/dev/null || \
    warn "Service file not found - copy it manually after deployment"

systemctl daemon-reload

# ==============================================
# 6. Configure Caddy
# ==============================================
log "Configuring Caddy..."

# Create Caddy log directory
mkdir -p /var/log/caddy
chown caddy:caddy /var/log/caddy

# Backup existing Caddyfile if present
if [[ -f /etc/caddy/Caddyfile ]]; then
    cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.backup
    warn "Existing Caddyfile backed up to /etc/caddy/Caddyfile.backup"
fi

# Copy Caddyfile (if available)
if [[ -f /opt/sarray-forge/deploy/Caddyfile ]]; then
    cp /opt/sarray-forge/deploy/Caddyfile /etc/caddy/Caddyfile
    log "Caddyfile installed"
else
    warn "Caddyfile not found - copy it manually after deployment"
fi

# ==============================================
# 7. Setup backup cron job
# ==============================================
log "Setting up backup cron job..."
CRON_JOB="0 3 * * * /opt/sarray-forge/deploy/backup.sh >> /var/log/sarray-forge-backup.log 2>&1"

# Add cron job if not already present
(crontab -u forge -l 2>/dev/null | grep -v "backup.sh"; echo "$CRON_JOB") | crontab -u forge -

# ==============================================
# 8. Enable services
# ==============================================
log "Enabling services..."
systemctl enable caddy
systemctl enable sarray-forge 2>/dev/null || warn "sarray-forge service not yet installed"

# ==============================================
# 9. Start Caddy (but not sarray-forge yet)
# ==============================================
log "Starting Caddy..."
systemctl start caddy || warn "Caddy failed to start - check config"

# ==============================================
# 10. Firewall setup (ufw comes with Ubuntu)
# ==============================================
log "Configuring firewall..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# ==============================================
# Summary
# ==============================================
echo ""
echo "=============================================="
echo -e "${GREEN}Server setup complete!${NC}"
echo "=============================================="
echo ""
echo "Directory structure created at /opt/sarray-forge/"
echo ""
echo "Next steps:"
echo "  1. Run deploy.sh from your local machine to upload the application"
echo "  2. Ensure DNS A record for forge.sarray.de points to this server's IP"
echo "  3. Configure Cloudflare SSL mode to 'Full'"
echo ""
echo "Useful commands:"
echo "  systemctl status sarray-forge   # Check app status"
echo "  systemctl restart sarray-forge  # Restart app"
echo "  journalctl -u sarray-forge -f   # View logs"
echo "  systemctl status caddy          # Check Caddy status"
echo ""
