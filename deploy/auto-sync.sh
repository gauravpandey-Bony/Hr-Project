#!/usr/bin/env bash
# Har 2 minute GitHub check — naya commit ho to deploy.sh chalao
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/hr-project}"
BRANCH="${DEPLOY_BRANCH:-main}"
LOCK_FILE="/tmp/hr-project-deploy.lock"
LOG_FILE="/var/log/hr-project-auto-deploy.log"

exec >>"$LOG_FILE" 2>&1

if [[ -f "$LOCK_FILE" ]]; then
  pid="$(cat "$LOCK_FILE" 2>/dev/null || true)"
  if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
    echo "$(date -Is) skip: deploy already running (pid $pid)"
    exit 0
  fi
fi

echo $$ >"$LOCK_FILE"
trap 'rm -f "$LOCK_FILE"' EXIT

cd "$APP_DIR"
git fetch origin "$BRANCH" --quiet

LOCAL="$(git rev-parse HEAD)"
REMOTE="$(git rev-parse "origin/$BRANCH")"

if [[ "$LOCAL" == "$REMOTE" ]]; then
  echo "$(date -Is) up to date ($LOCAL)"
  exit 0
fi

echo "$(date -Is) new commit $REMOTE (was $LOCAL) — deploying"
bash "$APP_DIR/deploy/deploy.sh"
