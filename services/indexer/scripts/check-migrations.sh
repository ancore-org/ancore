#!/usr/bin/env bash
# Run all SQL migrations against a local Postgres instance and optionally compare
# the resulting schema to a golden dump for drift detection.
#
# Usage:
#   DATABASE_URL=postgres://user:pass@localhost:5432/ancore_test \
#     bash services/indexer/scripts/check-migrations.sh
#
# Options (env vars):
#   DATABASE_URL      Connection string (required)
#   SCHEMA_DUMP_FILE  Path to golden schema dump to diff against (optional)
#   SKIP_DOWN         Set to 1 to skip the down-migration smoke check

set -euo pipefail

MIGRATIONS_DIR="$(cd "$(dirname "$0")/../migrations" && pwd)"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL is not set." >&2
  exit 1
fi

echo "==> Running migrations from $MIGRATIONS_DIR"

for file in "$MIGRATIONS_DIR"/*.sql; do
  echo "    Applying $(basename "$file") ..."
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$file"
done

echo "==> All migrations applied successfully"

# Optional schema drift check
if [[ -n "${SCHEMA_DUMP_FILE:-}" ]]; then
  echo "==> Comparing schema to golden dump: $SCHEMA_DUMP_FILE"
  ACTUAL=$(pg_dump "$DATABASE_URL" --schema-only --no-owner --no-acl 2>/dev/null)
  GOLDEN=$(cat "$SCHEMA_DUMP_FILE")
  if diff <(echo "$ACTUAL") <(echo "$GOLDEN") > /dev/null 2>&1; then
    echo "    Schema matches golden dump — no drift detected"
  else
    echo "ERROR: Schema drift detected. Diff:" >&2
    diff <(echo "$ACTUAL") <(echo "$GOLDEN") >&2
    exit 1
  fi
fi

# Down-migration smoke: drop all application tables and reapply to verify
# migrations are idempotent and the schema is fully reproducible.
if [[ "${SKIP_DOWN:-0}" != "1" ]]; then
  echo "==> Down-migration smoke: dropping application tables"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "
    DROP TABLE IF EXISTS account_activity CASCADE;
    DROP TABLE IF EXISTS ingest_checkpoints CASCADE;
  "
  echo "==> Re-applying migrations after teardown"
  for file in "$MIGRATIONS_DIR"/*.sql; do
    echo "    Applying $(basename "$file") ..."
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$file"
  done
  echo "==> Down/up smoke passed"
fi

echo "==> Migration check complete"
