#!/usr/bin/env bash
# One-time: enable HTTPS so Maya voice / microphone work in Chrome (secure context).
set -euo pipefail

CERT_DIR="/etc/ssl/hr-project"
KEY="$CERT_DIR/hr-project.key"
CRT="$CERT_DIR/hr-project.crt"
NGINX_SITE="/etc/nginx/sites-available/hr-project"
SERVER_IP="${SERVER_IP:-103.197.77.33}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash deploy/setup-https.sh"
  exit 1
fi

mkdir -p "$CERT_DIR"
if [[ ! -f "$KEY" ]]; then
  openssl req -x509 -nodes -days 825 -newkey rsa:2048 \
    -keyout "$KEY" \
    -out "$CRT" \
    -subj "/CN=${SERVER_IP}/O=Bony Polymers/C=IN"
  chmod 600 "$KEY"
  echo "Created self-signed certificate for ${SERVER_IP}"
fi

cat >"$NGINX_SITE" <<EOF
# HR Project — HTTP redirects to HTTPS (mic / Maya voice needs secure context)

server {
    listen 80;
    server_name ${SERVER_IP};
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ${SERVER_IP};

    ssl_certificate ${CRT};
    ssl_certificate_key ${KEY};
    ssl_protocols TLSv1.2 TLSv1.3;

    client_max_body_size 25M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 300s;
    }
}
EOF

ln -sf "$NGINX_SITE" /etc/nginx/sites-enabled/hr-project
nginx -t
systemctl reload nginx

NOVA_ENV="/var/www/hr-project/nova/.env"
if [[ -f "$NOVA_ENV" ]]; then
  if grep -q '^NEXT_PUBLIC_APP_URL=' "$NOVA_ENV"; then
    sed -i "s|^NEXT_PUBLIC_APP_URL=.*|NEXT_PUBLIC_APP_URL=\"https://${SERVER_IP}\"|" "$NOVA_ENV"
  else
    echo "NEXT_PUBLIC_APP_URL=\"https://${SERVER_IP}\"" >>"$NOVA_ENV"
  fi
fi

echo "HTTPS enabled: https://${SERVER_IP}"
echo "Browser will show a certificate warning once — click Advanced → Proceed."
