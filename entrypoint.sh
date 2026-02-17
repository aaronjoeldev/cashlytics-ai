#!/bin/sh
set -e

echo "Running database migrations..."
/migrate/node_modules/.bin/drizzle-kit migrate --config /migrate/drizzle.config.js
echo "Migrations completed."

exec node /app/server.js
