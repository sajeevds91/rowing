#!/usr/bin/env bash
# Pull the latest code and restart. Run on the server: sudo /opt/transco/transco-dashboard/deploy/update.sh
set -euo pipefail
cd /opt/transco
sudo -u transco git pull --ff-only
cd transco-dashboard
sudo -u transco npm ci --omit=dev
systemctl restart transco
sleep 2
systemctl --no-pager --lines=5 status transco
