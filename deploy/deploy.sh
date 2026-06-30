#!/usr/bin/env bash
# Server par run hota hai — git pull, build, PM2 restart
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NOVA_DIR="$APP_DIR/nova"
BRANCH="${DEPLOY_BRANCH:-main}"

echo "==> Deploying from $APP_DIR (branch: $BRANCH)"

cd "$APP_DIR"

if [[ -x "$APP_DIR/deploy/backup.sh" ]]; then
  bash "$APP_DIR/deploy/backup.sh"
else
  echo "WARN: deploy/backup.sh missing — skipping backup"
fi

git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull origin "$BRANCH"

cd "$NOVA_DIR"

if [[ ! -f .env ]]; then
  echo "ERROR: $NOVA_DIR/.env missing. Copy deploy/.env.production.example and edit values."
  exit 1
fi

echo "==> Installing dependencies"
npm ci

echo "==> Sync database schema"
npx prisma db push --accept-data-loss

echo "==> Seed database (idempotent)"
npm run db:seed || true

echo "==> Purge logistics KPI junk from database"
npm run db:purge-junk || true

echo "==> Import KRA workbooks (37P + Fluid 58)"
npm run import:kra-data || true

STAFF_FILE="${STAFF_DETAILS_FILE:-$NOVA_DIR/data/staff-details.xlsx}"
if [[ -f "$STAFF_FILE" ]]; then
  echo "==> Import staff details (plant-wise employee assignment)"
  npx tsx scripts/import-staff-details.ts "$STAFF_FILE" || true
else
  echo "WARN: Staff details file not found at $STAFF_FILE — skip employee plant assignment"
fi

echo "==> Building application"
npm run build

echo "==> Restarting PM2 process"
cd "$APP_DIR"
if pm2 describe nova-hr >/dev/null 2>&1; then
  pm2 restart deploy/ecosystem.config.cjs --update-env
else
  pm2 start deploy/ecosystem.config.cjs
fi

pm2 save

echo "==> Deploy complete"
pm2 status nova-hr
