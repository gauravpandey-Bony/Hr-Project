#!/usr/bin/env bash
# Ubuntu server par EK BAAR chalao (root ya sudo user se)
# Usage: sudo bash deploy/setup-server.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/hr-project}"
DEPLOY_USER="${DEPLOY_USER:-deploy}"
REPO_URL="${REPO_URL:-https://github.com/gauravpandey-Bony/Hr-Project.git}"
NODE_MAJOR="${NODE_MAJOR:-20}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash deploy/setup-server.sh"
  exit 1
fi

echo "==> System packages"
apt-get update
apt-get install -y curl git nginx ufw

echo "==> Node.js $NODE_MAJOR"
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
fi

echo "==> PM2"
npm install -g pm2

echo "==> Deploy user: $DEPLOY_USER"
if ! id "$DEPLOY_USER" &>/dev/null; then
  useradd -m -s /bin/bash "$DEPLOY_USER"
fi

mkdir -p "$APP_DIR"
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR"

if [[ ! -d "$APP_DIR/.git" ]]; then
  echo "==> Cloning repository"
  sudo -u "$DEPLOY_USER" git clone "$REPO_URL" "$APP_DIR"
else
  echo "==> Repository already exists at $APP_DIR"
fi

echo "==> Production .env"
NOVA_ENV="$APP_DIR/nova/.env"
if [[ ! -f "$NOVA_ENV" ]]; then
  cp "$APP_DIR/deploy/.env.production.example" "$NOVA_ENV"
  chown "$DEPLOY_USER:$DEPLOY_USER" "$NOVA_ENV"
  echo "EDIT REQUIRED: $NOVA_ENV"
fi

echo "==> SSH key for GitHub Actions (server par deploy user)"
DEPLOY_HOME="$(eval echo "~$DEPLOY_USER")"
AUTH_KEYS="$DEPLOY_HOME/.ssh/authorized_keys"
mkdir -p "$DEPLOY_HOME/.ssh"
chmod 700 "$DEPLOY_HOME/.ssh"
touch "$AUTH_KEYS"
chmod 600 "$AUTH_KEYS"
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$DEPLOY_HOME/.ssh"
echo "GitHub Actions ka PUBLIC key yahan add karo: $AUTH_KEYS"

echo "==> PM2 startup on boot"
sudo -u "$DEPLOY_USER" bash -lc "cd '$APP_DIR/nova' && npm ci && npm run build"
sudo -u "$DEPLOY_USER" pm2 start "$APP_DIR/deploy/ecosystem.config.cjs"
sudo -u "$DEPLOY_USER" pm2 save
env PATH="$PATH:/usr/bin" pm2 startup systemd -u "$DEPLOY_USER" --hp "$DEPLOY_HOME"

echo "==> Firewall"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

echo ""
echo "Setup done."
echo "1) Edit $NOVA_ENV"
echo "2) Copy deploy/nginx-hr-project.conf.example to /etc/nginx/sites-available/ and enable"
echo "3) Add GitHub Secrets: SSH_HOST, SSH_USER, SSH_PRIVATE_KEY"
echo "4) Push to main branch — auto deploy hoga"
