#!/usr/bin/env bash
# Server par EK BAAR — auto-deploy cron + backup folder + latest code
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/hr-project}"
BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/hr-project}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash deploy/setup-auto-deploy.sh"
  exit 1
fi

mkdir -p "$BACKUP_ROOT"
chmod +x "$APP_DIR/deploy/"*.sh

cd "$APP_DIR"
git fetch origin main
git checkout main
git pull origin main

CRON_LINE="*/2 * * * * APP_DIR=$APP_DIR BACKUP_ROOT=$BACKUP_ROOT $APP_DIR/deploy/auto-sync.sh"
( crontab -l 2>/dev/null | grep -v "deploy/auto-sync.sh" || true; echo "$CRON_LINE" ) | crontab -

touch /var/log/hr-project-auto-deploy.log
chmod 644 /var/log/hr-project-auto-deploy.log

echo "Auto-deploy cron installed (every 2 minutes)"
echo "Logs: /var/log/hr-project-auto-deploy.log"
echo "Backups: $BACKUP_ROOT"
crontab -l | grep auto-sync
