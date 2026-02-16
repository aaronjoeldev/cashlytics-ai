#!/bin/bash
# Cashlytics Services Starten

echo "=== Cashlytics Services ==="

# Prüfen ob Docker läuft
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker läuft nicht. Bitte Docker starten:"
    echo "   sudo systemctl start docker"
    exit 1
fi

# PostgreSQL Container starten
echo "📦 Starte PostgreSQL Container..."
docker compose up -d

# Warten bis PostgreSQL bereit ist
echo "⏳ Warte auf PostgreSQL..."
until docker exec cashlytics-postgres pg_isready -U cashlytics -d cashlytics; do
    sleep 1
done

echo "✅ PostgreSQL ist bereit!"

# Next.js Dev Server starten
echo "🚀 Starte Next.js Dev Server..."
npm run dev