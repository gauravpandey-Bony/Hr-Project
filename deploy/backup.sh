#!/usr/bin/env bash
# Har deploy se pehle backup — database, .env, git commit
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NOVA_DIR="$APP_DIR/nova"
BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/hr-project}"
KEEP_BACKUPS="${KEEP_BACKUPS:-30}"
STAMP="$(date +%Y-%m-%d_%H-%M-%S)"
BACKUP_DIR="$BACKUP_ROOT/$STAMP"

mkdir -p "$BACKUP_DIR"

echo "==> Backup: $BACKUP_DIR"

cd "$APP_DIR"
git rev-parse HEAD > "$BACKUP_DIR/git-commit.txt" 2>/dev/null || echo "unknown" > "$BACKUP_DIR/git-commit.txt"
git log -1 --oneline > "$BACKUP_DIR/git-log.txt" 2>/dev/null || true

if [[ -f "$NOVA_DIR/.env" ]]; then
  cp "$NOVA_DIR/.env" "$BACKUP_DIR/.env"
fi

if [[ -f "$NOVA_DIR/prisma/prod.db" ]]; then
  cp "$NOVA_DIR/prisma/prod.db" "$BACKUP_DIR/prod.db"
elif [[ -f "$NOVA_DIR/prisma/dev.db" ]]; then
  cp "$NOVA_DIR/prisma/dev.db" "$BACKUP_DIR/prod.db"
fi

if [[ -d "$NOVA_DIR/.next" ]]; then
  tar -czf "$BACKUP_DIR/next-build.tar.gz" -C "$NOVA_DIR" .next
fi

echo "$STAMP" > "$BACKUP_ROOT/LATEST"

echo "==> Purana backup cleanup (keep last $KEEP_BACKUPS)"
cd "$BACKUP_ROOT"
ls -1dt */ 2>/dev/null | tail -n +$((KEEP_BACKUPS + 1)) | xargs -r rm -rf

echo "==> Backup done: $BACKUP_DIR"
