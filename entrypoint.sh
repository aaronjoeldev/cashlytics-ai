#!/bin/sh
set -e

echo "Running database migrations..."

# Run migrations with retry logic
max_retries=5
retry_count=0

while [ $retry_count -lt $max_retries ]; do
    if /migrate/node_modules/.bin/drizzle-kit migrate --config /migrate/drizzle.config.js; then
        echo "Migrations completed successfully."
        break
    else
        retry_count=$((retry_count + 1))
        echo "Migration attempt $retry_count failed, retrying in 3 seconds..."
        sleep 3
    fi
done

# Without the current schema every page fails, so stop here and let the restart policy retry.
if [ $retry_count -eq $max_retries ]; then
    echo "Error: Migrations failed after $max_retries attempts. Not starting the app." >&2
    exit 1
fi

exec node /app/server.js
