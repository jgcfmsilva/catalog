#!/bin/sh
# Keeps dependencies in sync on every container start, rebuilds the UI, then serves it.
set -e
cd /app
echo "[entrypoint] npm install"
npm install --no-audit --no-fund
echo "[entrypoint] npm update"
npm update --no-audit --no-fund || echo "[entrypoint] npm update failed, continuing with installed versions"
echo "[entrypoint] building UI"
npm run build
exec "$@"
