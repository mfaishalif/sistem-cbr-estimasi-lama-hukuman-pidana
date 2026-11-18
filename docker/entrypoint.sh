#!/bin/sh
set -eu

# Migrations are idempotent. Applying them at startup keeps a fresh volume
# usable without a separate manual step; the CLI remains available for
# explicit migrations and inspection.
if [ -n "${DATABASE_PATH:-}" ]; then
  echo "Applying SQLite migrations at ${DATABASE_PATH}"
  node /app/tools/cli/dist/index.js migrate --database "${DATABASE_PATH}"
fi

exec "$@"
