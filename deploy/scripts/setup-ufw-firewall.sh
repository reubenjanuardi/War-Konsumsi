#!/usr/bin/env bash
# ==============================================================================
# WAR KONSUMSI — UFW FIREWALL CONFIGURATION SCRIPT
# ==============================================================================
# Run as root or with sudo on Ubuntu/Debian VPS:
#   sudo bash deploy/scripts/setup-ufw-firewall.sh
# ==============================================================================

set -euo pipefail

echo "==> Configuring UFW Firewall for War Konsumsi..."

# 1. Ensure UFW is installed
if ! command -v ufw &> /dev/null; then
    echo "UFW not found. Installing..."
    apt-get update -y && apt-get install -y ufw
fi

# 2. Reset / set default policies
echo "==> Setting default policies: DENY incoming, ALLOW outgoing"
ufw default deny incoming
ufw default allow outgoing

# 3. Allow essential ingress ports
echo "==> Allowing SSH (Port 22)..."
ufw allow 22/tcp comment 'SSH Remote Management'

echo "==> Allowing HTTP (Port 80 for Nginx)..."
ufw allow 80/tcp comment 'Nginx HTTP Ingress'

echo "==> Allowing HTTPS (Port 443 for Nginx SSL)..."
ufw allow 443/tcp comment 'Nginx HTTPS Ingress'

# 4. Explicitly block internal services from external access
echo "==> Explicitly blocking internal ports (PostgreSQL 5432, API 4000, Web 3000)..."
ufw deny 5432/tcp comment 'Block External PostgreSQL'
ufw deny 4000/tcp comment 'Block External NestJS Backend'
ufw deny 3000/tcp comment 'Block External Next.js Frontend'

# 5. Enable UFW
echo "==> Enabling UFW..."
ufw --force enable

# 6. Status display
echo "==> Current UFW Status:"
ufw status verbose

echo "==> UFW firewall configuration complete!"
