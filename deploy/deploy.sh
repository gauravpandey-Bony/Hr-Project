#!/usr/bin/env bash
# Server par run hota hai — git pull, build, PM2 restart
#
# DATA SAFETY (critical):
# - Never wipe / deactivate plant employees or KPIs on deploy.
# - Never run db:purge-junk here.
# - Never use prisma --accept-data-loss here.
# - SEED_RESET_DATA and ALLOW_DATA_PURGE must stay unset unless an operator
#   explicitly runs a one-off command on the server.
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

# Hard-block accidental wipe flags on deploy
unset SEED_RESET_DATA || true
unset ALLOW_DATA_PURGE || true
export SEED_RESET_DATA=""
export ALLOW_DATA_PURGE=""

echo "==> Installing dependencies"
npm ci

echo "==> Sync database schema (safe — no --accept-data-loss)"
npx prisma db push

echo "==> Seed users/org only (does NOT wipe plant KPIs/employees)"
SEED_RESET_DATA= ALLOW_DATA_PURGE= npm run db:seed || true

STAFF_FILE="${STAFF_DETAILS_FILE:-$NOVA_DIR/data/staff-details.xlsx}"
if [[ -f "$STAFF_FILE" ]]; then
  echo "==> Import staff details (upsert plant assignment — no wipe)"
  ALLOW_DATA_PURGE= npx tsx scripts/import-staff-details.ts "$STAFF_FILE" || true
else
  echo "WARN: Staff details file not found at $STAFF_FILE — skip employee plant assignment"
fi

echo "==> Reconcile plant-scoped department master rows (no deactivate)"
ALLOW_DATA_PURGE= npm run db:reconcile-departments || true

echo "==> Import KRA workbooks (upsert only — purge gated off)"
ALLOW_DATA_PURGE= npm run import:kra-data || true

echo "==> Building application"
rm -rf .next
# Use generate + next build; avoid package.json build's accept-data-loss path
npx prisma generate
npx next build

echo "==> Restarting PM2 process"
cd "$APP_DIR"
if pm2 describe nova-hr >/dev/null 2>&1; then
  pm2 restart deploy/ecosystem.config.cjs --update-env
else
  pm2 start deploy/ecosystem.config.cjs
fi

pm2 save

echo "==> Deploy complete (plant data was NOT wiped)"
pm2 status nova-hr
