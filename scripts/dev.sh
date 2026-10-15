#!/bin/sh
# Local development: PostgreSQL from docker-compose.yml, migrations, then `npm run dev`.
set -e
cd "$(dirname "$0")/.."

if ! docker info >/dev/null 2>&1; then
  echo "Docker is not running. Start Docker and try again." >&2
  exit 1
fi

# Only the database; the app container would take port 3000
docker compose up -d postgres
until docker exec cashlytics-postgres pg_isready -U cashlytics -d cashlytics >/dev/null 2>&1; do
  sleep 1
done

npm run db:migrate
npm run dev
