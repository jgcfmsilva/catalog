#!/bin/sh
# Keeps dependencies in sync on every container start, then runs the service.
set -e
cd /app
echo "[entrypoint] npm install"
npm install --no-audit --no-fund
echo "[entrypoint] npm update"
npm update --no-audit --no-fund || echo "[entrypoint] npm update failed, continuing with installed versions"
exec "$@"
