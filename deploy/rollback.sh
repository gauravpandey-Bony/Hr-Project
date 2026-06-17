#!/usr/bin/env bash
# Latest backup se restore — emergency rollback
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NOVA_DIR="$APP_DIR/nova"
BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/hr-project}"

if [[ -f "$BACKUP_ROOT/LATEST" ]]; then
  BACKUP_DIR="$BACKUP_ROOT/$(cat "$BACKUP_ROOT/LATEST")"
else
  BACKUP_DIR="$(ls -1dt "$BACKUP_ROOT"/*/ 2>/dev/null | head -1)"
fi

if [[ -z "$BACKUP_DIR" || ! -d "$BACKUP_DIR" ]]; then
  echo "ERROR: No backup found in $BACKUP_ROOT"
  exit 1
fi

echo "==> Restoring from $BACKUP_DIR"

if [[ -f "$BACKUP_DIR/.env" ]]; then
  cp "$BACKUP_DIR/.env" "$NOVA_DIR/.env"
fi

if [[ -f "$BACKUP_DIR/prod.db" ]]; then
  cp "$BACKUP_DIR/prod.db" "$NOVA_DIR/prisma/prod.db"
fi

if [[ -f "$BACKUP_DIR/next-build.tar.gz" ]]; then
  rm -rf "$NOVA_DIR/.next"
  tar -xzf "$BACKUP_DIR/next-build.tar.gz" -C "$NOVA_DIR"
fi

COMMIT="$(cat "$BACKUP_DIR/git-commit.txt" 2>/dev/null || true)"
if [[ -n "$COMMIT" && "$COMMIT" != "unknown" ]]; then
  cd "$APP_DIR"
  git fetch origin main
  git checkout "$COMMIT"
fi

cd "$APP_DIR"
pm2 restart deploy/ecosystem.config.cjs --update-env || pm2 start deploy/ecosystem.config.cjs
pm2 save

echo "==> Rollback complete from $BACKUP_DIR"
