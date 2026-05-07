#!/bin/sh
set -e
cd /app

# node_modules va en volumen nombrado: primera vez vacío → instalar
if [ ! -d node_modules/sequelize ]; then
  echo "[backend dev] npm ci…"
  npm ci
fi

echo "[backend dev] Migraciones…"
npm run migrate

exec npm run dev
