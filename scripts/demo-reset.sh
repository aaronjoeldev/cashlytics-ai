#!/bin/sh
# ==============================================================
# Cashlytics Demo Reset Script
#
# 1. Waits for PostgreSQL to be ready
# 2. Waits for the app to run its migrations (schema must exist)
# 3. Runs the initial seed
# 4. Resets the database every day at midnight UTC
# ==============================================================
set -e

POSTGRES_HOST="${POSTGRES_HOST:-postgres}"
POSTGRES_USER="${POSTGRES_USER:-cashlytics}"
POSTGRES_DB="${POSTGRES_DB:-cashlytics}"
SEED_FILE="/scripts/seed-demo.sql"

log() {
  echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $1"
}

run_seed() {
  log "Starting demo data reset..."
  psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f "$SEED_FILE"
  log "Demo data reset complete."
}

# --------------------------------------------------------------
# Wait for PostgreSQL to accept connections
# --------------------------------------------------------------
log "Waiting for PostgreSQL at ${POSTGRES_HOST}..."
until psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c '\q' 2>/dev/null; do
  sleep 2
done
log "PostgreSQL is ready."

# --------------------------------------------------------------
# Wait for app migrations to create the schema
# The app container runs drizzle-kit migrate on startup.
# We poll until the 'accounts' table exists.
# --------------------------------------------------------------
log "Waiting for database schema to be initialized..."
until psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c "SELECT 1 FROM accounts LIMIT 1" > /dev/null 2>&1; do
  log "Schema not ready yet, retrying in 5 seconds..."
  sleep 5
done
log "Schema is ready."

# --------------------------------------------------------------
# Initial seed on startup
# --------------------------------------------------------------
run_seed

# --------------------------------------------------------------
# Daily reset loop — resets at midnight UTC every day
# --------------------------------------------------------------
while true; do
  NOW=$(date -u +%s)
  MIDNIGHT=$(( ( (NOW / 86400) + 1 ) * 86400 ))
  SLEEP_SECS=$(( MIDNIGHT - NOW ))
  log "Next reset in ${SLEEP_SECS} seconds (at midnight UTC)"
  sleep "$SLEEP_SECS"
  run_seed
done
