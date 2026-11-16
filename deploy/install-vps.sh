#!/usr/bin/env bash
set -euo pipefail

if [[ "$(id -u)" != 0 ]]; then echo 'Run as root with sudo.' >&2; exit 1; fi
RELEASE="${1:-/tmp/samopalka-release.zip}"
if [[ ! -f "$RELEASE" ]]; then echo "Release not found: $RELEASE" >&2; exit 1; fi
if [[ -d /opt/samopalka ]] && [[ -n "$(ls -A /opt/samopalka 2>/dev/null)" ]]; then
  echo '/opt/samopalka already contains files; refusing to overwrite an existing installation.' >&2
  exit 1
fi
. /etc/os-release
if [[ "$ID" != 'debian' || "$VERSION_ID" != '12' ]]; then
  echo 'This installer targets Debian 12 only.' >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl gnupg unzip nginx
# Official NodeSource signing key and APT repository for Node.js 22.
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor --yes -o /usr/share/keyrings/nodesource.gpg
chmod 644 /usr/share/keyrings/nodesource.gpg
cat > /etc/apt/sources.list.d/nodesource.sources <<'EOF'
Types: deb
URIs: https://deb.nodesource.com/node_22.x
Suites: nodistro
Components: main
Architectures: amd64
Signed-By: /usr/share/keyrings/nodesource.gpg
EOF
apt-get update
apt-get install -y nodejs
node --version
npm --version

if ! id -u samopalka >/dev/null 2>&1; then
  useradd --system --user-group --home-dir /opt/samopalka --shell /usr/sbin/nologin samopalka
fi
mkdir -p /opt/samopalka
unzip -q "$RELEASE" -d /opt/samopalka
cd /opt/samopalka
npm ci --omit=dev --no-audit --no-fund
chown -R samopalka:samopalka /opt/samopalka

install -m 644 /opt/samopalka/deploy/samopalka.service /etc/systemd/system/samopalka.service
install -m 644 /opt/samopalka/deploy/samopalka.nginx.conf /etc/nginx/sites-available/samopalka
rm -f /etc/nginx/sites-enabled/default
ln -sfn /etc/nginx/sites-available/samopalka /etc/nginx/sites-enabled/samopalka
nginx -t
systemctl daemon-reload
systemctl enable --now samopalka.service
systemctl enable --now nginx.service
systemctl restart nginx.service

echo '--- GAME HEALTH ---'
curl -fsS http://127.0.0.1:3000/api/health || true
echo
echo '--- SERVICES ---'
systemctl --no-pager --full status samopalka.service | head -n 16 || true
echo '--- AMNEZIA CHECK ---'
docker ps --filter name=amnezia-awg2
echo 'Done. Open http://<VPS_PUBLIC_IP>/ (HTTPS can be configured later).'
