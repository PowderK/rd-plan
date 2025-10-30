#!/bin/bash

# RD-Plan Quick Sync Script - Schnelle Synchronisation ohne Bestätigung
# Für automatisierte Builds und CI/CD

set -e

# Verzeichnisse
BASE_DIR="/Users/benni/Documents/RD-Plan"
DEV_DIR="$BASE_DIR/rd-plan"
BETA_DIR="$BASE_DIR/rd-plan-beta"

echo "🚀 RD-Plan Quick Sync gestartet..."

# In Dev-Verzeichnis wechseln und builden
cd "$DEV_DIR"
echo "📦 Baue Entwicklungsversion..."
npm run build

# Synchronisiere wichtige Dateien
echo "🔄 Synchronisiere Dateien..."
rsync -av --delete \
    --exclude='.git' \
    --exclude='node_modules' \
    --exclude='*.log' \
    --exclude='.DS_Store' \
    "$DEV_DIR/" "$BETA_DIR/"

# Wechsle zu Beta und committe
cd "$BETA_DIR"

# Git add und commit
git add .

# Erstelle automatische Commit-Message
BUILD_NUMBER=$(node -p "require('./package.json').build || ''" 2>/dev/null)
COMMIT_MSG="Auto-sync from dev - Build ${BUILD_NUMBER:-'unknown'} - $(date '+%Y-%m-%d %H:%M')"

git commit -m "$COMMIT_MSG" || echo "Keine Änderungen zu committen"

# Push
git push origin main || git push origin master

echo "✅ Quick Sync abgeschlossen!"
echo "📝 Commit: $COMMIT_MSG"