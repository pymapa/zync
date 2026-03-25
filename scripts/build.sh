#!/usr/bin/env bash
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== Building frontend ==="
cd "$REPO_ROOT/client"
npm ci --ignore-scripts
npm run build
# Output: client/dist/

echo "=== Building backend ==="
cd "$REPO_ROOT/server"
npm ci --ignore-scripts
npm run build
# Output: server/dist/

echo "=== Assembling deploy package ==="
cd "$REPO_ROOT"
rm -rf deploy
mkdir -p deploy/public

# Backend: compiled code + package files
cp -r server/dist          deploy/
cp    server/package.json  deploy/
cp    server/package-lock.json deploy/

# Frontend: static build → served by nginx
cp -r client/dist/*        deploy/public/

echo "=== Done: deploy/ is ready ==="
