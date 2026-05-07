#!/bin/sh
set -e
cd /app

# node_modules va en volumen nombrado. Reinstalamos si:
# - es primera vez, o
# - cambió package-lock.json desde la última instalación.
LOCKFILE_HASH_FILE="node_modules/.package-lock.sha1"
CURRENT_LOCKFILE_HASH="$(sha1sum package-lock.json | awk '{ print $1 }')"
STORED_LOCKFILE_HASH=""
if [ -f "$LOCKFILE_HASH_FILE" ]; then
  STORED_LOCKFILE_HASH="$(cat "$LOCKFILE_HASH_FILE")"
fi

if [ ! -d node_modules ] || [ "$CURRENT_LOCKFILE_HASH" != "$STORED_LOCKFILE_HASH" ]; then
  echo "[backend dev] npm ci…"
  npm ci
  echo "$CURRENT_LOCKFILE_HASH" > "$LOCKFILE_HASH_FILE"
fi

echo "[backend dev] Migraciones…"
npm run migrate

exec npm run dev
