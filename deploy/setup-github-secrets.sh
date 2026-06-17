#!/usr/bin/env bash
# GitHub Actions secrets set karo — pehle: gh auth login
set -euo pipefail

REPO="gauravpandey-Bony/Hr-Project"
KEY_FILE="${HOME}/.ssh/hr-project-deploy"

if ! command -v gh >/dev/null 2>&1; then
  echo "Install GitHub CLI: brew install gh"
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "Pehle login karo: gh auth login"
  exit 1
fi

if [[ ! -f "$KEY_FILE" ]]; then
  echo "SSH key missing: $KEY_FILE"
  exit 1
fi

gh secret set SSH_HOST --repo "$REPO" --body "103.197.77.33"
gh secret set SSH_PORT --repo "$REPO" --body "56767"
gh secret set SSH_USER --repo "$REPO" --body "root"
gh secret set SSH_PRIVATE_KEY --repo "$REPO" --body "$(cat "$KEY_FILE")"
gh secret set APP_DIR --repo "$REPO" --body "/var/www/hr-project"
gh secret set BACKUP_ROOT --repo "$REPO" --body "/var/backups/hr-project"
gh secret set KEEP_BACKUPS --repo "$REPO" --body "30"

echo "GitHub secrets set ho gaye for $REPO"
gh secret list --repo "$REPO"
