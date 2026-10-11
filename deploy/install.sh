#!/usr/bin/env bash
set -euo pipefail
cd /opt/bitstudy-website
getent passwd bitstudy >/dev/null || useradd --system --home-dir /var/lib/bitstudy --shell /usr/sbin/nologin bitstudy
install -d -m 755 -o bitstudy -g bitstudy /var/lib/bitstudy
install -d -m 755 /var/www/bitstudy
cp -r site/. /var/www/bitstudy/
chmod -R a+rX /var/www/bitstudy
install -m 644 deploy/bitstudy-release-sync.service deploy/bitstudy-release-sync.timer /etc/systemd/system/
systemctl daemon-reload
# Verify a usable package before publishing the new virtual host.
systemctl start bitstudy-release-sync.service
install -m 644 deploy/bitstudy.nginx.conf /etc/nginx/sites-available/bitstudy
ln -sfn /etc/nginx/sites-available/bitstudy /etc/nginx/sites-enabled/bitstudy
nginx -t
systemctl reload nginx
systemctl enable --now bitstudy-release-sync.timer
systemctl list-timers bitstudy-release-sync.timer --no-pager
