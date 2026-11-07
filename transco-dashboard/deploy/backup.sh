#!/usr/bin/env bash
# Daily database backup, keeps 30 days. Run from cron as the transco user:
#   15 2 * * * /opt/transco/transco-dashboard/deploy/backup.sh
set -euo pipefail
APP=/opt/transco/transco-dashboard
DEST=${BACKUP_DIR:-/var/backups/transco}
mkdir -p "$DEST"
# .backup makes a consistent copy even while the app is running.
sqlite3 "$APP/data/transco.db" ".backup '$DEST/transco-$(date +%F).db'"
cp "$APP/.env" "$DEST/env-$(date +%F)" && chmod 600 "$DEST/env-$(date +%F)"
find "$DEST" -type f -mtime +30 -delete
