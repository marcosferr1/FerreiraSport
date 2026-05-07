#!/bin/sh
set -e
cd /app

if [ ! -d node_modules/vite ]; then
  echo "[frontend dev] npm ci…"
  npm ci
fi

exec npm run dev -- --host 0.0.0.0 --port 5173
