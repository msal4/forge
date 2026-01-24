#!/bin/bash
# ==============================================
# Sarray Forge - Database Backup Script
# This runs on the SERVER via cron
# Scheduled: Daily at 3 AM (see setup-server.sh)
# ==============================================

set -e

# Configuration
APP_DIR="/opt/sarray-forge"
DB_PATH="${APP_DIR}/data/sarray-forge.db"
BACKUP_DIR="${APP_DIR}/backups"
RELEASES_DIR="${APP_DIR}/data/releases"

# Retention: keep backups for this many days
RETENTION_DAYS=7

# Timestamp for backup filename
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DATE_ONLY=$(date +%Y-%m-%d)

# ==============================================
# Pre-flight checks
# ==============================================
if [[ ! -f "$DB_PATH" ]]; then
    echo "[$(date)] ERROR: Database not found at $DB_PATH"
    exit 1
fi

if [[ ! -d "$BACKUP_DIR" ]]; then
    mkdir -p "$BACKUP_DIR"
fi

# ==============================================
# Backup SQLite database
# Uses .backup command for a safe hot backup
# ==============================================
BACKUP_FILE="${BACKUP_DIR}/sarray-forge_${TIMESTAMP}.db"

echo "[$(date)] Starting database backup..."

# SQLite's .backup command is safe to run while the database is in use
sqlite3 "$DB_PATH" ".backup '$BACKUP_FILE'"

if [[ -f "$BACKUP_FILE" ]]; then
    # Compress the backup
    gzip "$BACKUP_FILE"
    BACKUP_FILE="${BACKUP_FILE}.gz"
    
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "[$(date)] Database backup created: $BACKUP_FILE ($SIZE)"
else
    echo "[$(date)] ERROR: Backup failed"
    exit 1
fi

# ==============================================
# Backup releases directory (weekly, on Sundays)
# ==============================================
if [[ $(date +%u) -eq 7 ]]; then
    if [[ -d "$RELEASES_DIR" ]]; then
        RELEASES_BACKUP="${BACKUP_DIR}/releases_${TIMESTAMP}.tar.gz"
        tar -czf "$RELEASES_BACKUP" -C "$APP_DIR/data" releases/
        SIZE=$(du -h "$RELEASES_BACKUP" | cut -f1)
        echo "[$(date)] Releases backup created: $RELEASES_BACKUP ($SIZE)"
    fi
fi

# ==============================================
# Cleanup old backups
# ==============================================
echo "[$(date)] Cleaning up backups older than ${RETENTION_DAYS} days..."

# Remove old database backups
find "$BACKUP_DIR" -name "sarray-forge_*.db.gz" -mtime +$RETENTION_DAYS -delete

# Remove old releases backups (keep 4 weeks = 28 days)
find "$BACKUP_DIR" -name "releases_*.tar.gz" -mtime +28 -delete

# Count remaining backups
DB_COUNT=$(find "$BACKUP_DIR" -name "sarray-forge_*.db.gz" | wc -l)
REL_COUNT=$(find "$BACKUP_DIR" -name "releases_*.tar.gz" | wc -l)

echo "[$(date)] Backup complete. Retained: $DB_COUNT database backups, $REL_COUNT releases backups"

# ==============================================
# Optional: Sync to remote storage
# Uncomment and configure if you want off-site backups
# ==============================================
# REMOTE_BACKUP="user@backup-server:/backups/sarray-forge/"
# rsync -az "$BACKUP_DIR/" "$REMOTE_BACKUP"
# echo "[$(date)] Synced to remote: $REMOTE_BACKUP"
