#!/bin/sh
# Adds main.mock-ai.uz to the host nginx and issues its certificate.
# Run as root on the server, next to host-nginx.conf: sudo sh add-staff-host.sh
set -eu
here=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
live=/etc/nginx/sites-available/mock-ai
backup=/etc/nginx/mock-ai.before-main.$(date +%Y%m%d%H%M%S)
cp "$live" "$backup"
restore() { cp "$backup" "$live"; nginx -t && systemctl reload nginx; echo "FAILED: restored $backup" >&2; exit 1; }

# 1. Answer the certificate challenge for the new name on port 80.
if ! grep -q 'panel.mock-ai.uz main.mock-ai.uz ' "$live"; then
  sed -i 's/server_name mock-ai.uz www.mock-ai.uz panel.mock-ai.uz mock.web/server_name mock-ai.uz www.mock-ai.uz panel.mock-ai.uz main.mock-ai.uz mock.web/' "$live"
fi
grep -q 'panel.mock-ai.uz main.mock-ai.uz ' "$live" || restore
nginx -t || restore
systemctl reload nginx

# 2. Issue the certificate (renews through the same webroot).
mkdir -p /var/www/html
certbot certonly --webroot -w /var/www/html -d main.mock-ai.uz --non-interactive --agree-tos --keep-until-expiring || restore

# 3. Install the full config with the HTTPS block.
cp "$here/host-nginx.conf" "$live"
nginx -t || restore
systemctl reload nginx
echo "DONE: https://main.mock-ai.uz is served. Backup of the old config: $backup"
