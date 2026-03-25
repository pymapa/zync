#!/usr/bin/env bash
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

INSTANCE_IP="${1:-}"
if [ -z "$INSTANCE_IP" ]; then
  echo "Usage: deploy.sh <host-ip>"
  exit 1
fi

echo "Deploying to $INSTANCE_IP"

# --- 1. Build ---
bash scripts/build.sh

# --- 2. Upload ---
rsync -avz --delete deploy/ "deploy@${INSTANCE_IP}:/app/"

# --- 3. Install production dependencies on remote ---
ssh "deploy@${INSTANCE_IP}" "cd /app && npm ci --omit=dev"

# --- 4. Run database migrations ---
ssh "deploy@${INSTANCE_IP}" "cd /app && node dist/scripts/migrate.js"

# --- 5. Restart service ---
ssh "deploy@${INSTANCE_IP}" "sudo systemctl restart zync"

# --- 6. Verify ---
sleep 3
echo "--- Health check ---"
curl -s "http://${INSTANCE_IP}/api/health" && echo

echo "=== Deployment complete ==="
