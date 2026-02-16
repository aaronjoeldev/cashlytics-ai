#!/bin/bash
# PostgreSQL starten für Cashlytics

echo "=== Starte PostgreSQL ==="

# Prüfen ob PostgreSQL installiert ist
if ! command -v pg_ctlcluster &> /dev/null; then
    echo "❌ PostgreSQL ist nicht installiert!"
    echo "Führe zuerst aus: sudo apt install -y postgresql postgresql-contrib"
    exit 1
fi

# Prüfen ob PostgreSQL bereits läuft
if pg_isready -q 2>/dev/null; then
    echo "✅ PostgreSQL läuft bereits"
    exit 0
fi

# PostgreSQL starten
echo "📦 Starte PostgreSQL..."
sudo pg_ctlcluster 16 main start 2>/dev/null

# Warten
sleep 2

# Prüfen ob erfolgreich
if pg_isready -q 2>/dev/null; then
    echo "✅ PostgreSQL gestartet"
else
    echo "❌ PostgreSQL konnte nicht gestartet werden"
    echo "Versuche: sudo pg_ctlcluster 16 main start"
    exit 1
fi