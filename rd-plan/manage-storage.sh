#!/bin/bash

# GitHub Storage Management Script
# Verwaltet GitHub Actions Artifacts und reduziert Storage-Verbrauch

set -e

# Farben für Output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 GitHub Storage Management${NC}"
echo "================================"

# Repository Info
REPO_OWNER=$(git config --get remote.origin.url 2>/dev/null | sed -n 's#.*/\([^/]*\)/\([^/]*\)\.git#\1#p' || echo "unknown")
REPO_NAME=$(git config --get remote.origin.url 2>/dev/null | sed -n 's#.*/\([^/]*\)/\([^/]*\)\.git#\2#p' || echo "unknown")

if [ "$REPO_OWNER" = "unknown" ] || [ "$REPO_NAME" = "unknown" ]; then
    # Fallback: Versuche aus Parent-Verzeichnis zu lesen
    PARENT_DIR=$(dirname $(pwd))
    cd "$PARENT_DIR"
    REPO_OWNER=$(git config --get remote.origin.url 2>/dev/null | sed -n 's#.*/\([^/]*\)/\([^/]*\)\.git#\1#p' || echo "local")
    REPO_NAME=$(git config --get remote.origin.url 2>/dev/null | sed -n 's#.*/\([^/]*\)/\([^/]*\)\.git#\2#p' || echo "repo")
    cd - > /dev/null
fi

echo -e "${BLUE}Repository:${NC} $REPO_OWNER/$REPO_NAME"
echo

# GitHub CLI prüfen
if ! command -v gh &> /dev/null; then
    echo -e "${RED}❌ GitHub CLI (gh) ist nicht installiert${NC}"
    echo "Installation: brew install gh"
    exit 1
fi

# GitHub Auth prüfen
if ! gh auth status &> /dev/null; then
    echo -e "${YELLOW}⚠️  GitHub Auth erforderlich${NC}"
    echo "Führe aus: gh auth login"
    exit 1
fi

echo -e "${GREEN}✅ GitHub CLI ist bereit${NC}"
echo

# Storage Usage anzeigen
echo -e "${BLUE}📊 Aktuelle Storage-Nutzung:${NC}"
gh api repos/$REPO_OWNER/$REPO_NAME/actions/cache/usage 2>/dev/null || echo "Cache-Nutzung nicht verfügbar"
echo

# Alle Artifacts auflisten
echo -e "${BLUE}📦 Aktuelle Artifacts:${NC}"
ARTIFACTS=$(gh api repos/$REPO_OWNER/$REPO_NAME/actions/artifacts --jq '.artifacts[] | "\(.id) \(.name) \(.created_at) \(.size_in_bytes)"')

if [ -z "$ARTIFACTS" ]; then
    echo -e "${GREEN}✅ Keine Artifacts gefunden${NC}"
    exit 0
fi

echo "ID | Name | Erstellt | Größe"
echo "---|------|----------|-------"

TOTAL_SIZE=0
ARTIFACT_COUNT=0

while IFS= read -r line; do
    if [ -n "$line" ]; then
        ARTIFACT_ID=$(echo $line | cut -d' ' -f1)
        ARTIFACT_NAME=$(echo $line | cut -d' ' -f2)
        CREATED_AT=$(echo $line | cut -d' ' -f3)
        SIZE_BYTES=$(echo $line | cut -d' ' -f4)
        
        # Größe in MB umrechnen
        SIZE_MB=$((SIZE_BYTES / 1024 / 1024))
        
        echo "$ARTIFACT_ID | $ARTIFACT_NAME | $CREATED_AT | ${SIZE_MB}MB"
        
        TOTAL_SIZE=$((TOTAL_SIZE + SIZE_BYTES))
        ARTIFACT_COUNT=$((ARTIFACT_COUNT + 1))
    fi
done <<< "$ARTIFACTS"

TOTAL_SIZE_MB=$((TOTAL_SIZE / 1024 / 1024))
echo
echo -e "${BLUE}Gesamt:${NC} $ARTIFACT_COUNT Artifacts, ${TOTAL_SIZE_MB}MB"

# Storage-Limit Warnung
if [ $TOTAL_SIZE_MB -gt 1500 ]; then
    echo -e "${RED}⚠️  Warnung: Storage-Nutzung über 1.5GB!${NC}"
elif [ $TOTAL_SIZE_MB -gt 1000 ]; then
    echo -e "${YELLOW}⚠️  Achtung: Storage-Nutzung über 1GB${NC}"
fi

echo

# Cleanup-Optionen anbieten
echo -e "${BLUE}🧹 Cleanup-Optionen:${NC}"
echo "1) Alle Artifacts älter als 7 Tage löschen"
echo "2) Alle Artifacts älter als 30 Tage löschen"
echo "3) Alle Artifacts löschen (Vorsicht!)"
echo "4) Bestimmte Artifacts manuell löschen"
echo "5) Keine Aktion"
echo

read -p "Wähle eine Option (1-5): " CHOICE

case $CHOICE in
    1)
        echo -e "${YELLOW}🗑️  Lösche Artifacts älter als 7 Tage...${NC}"
        CUTOFF_DATE=$(date -d '7 days ago' +%Y-%m-%d 2>/dev/null || date -v-7d +%Y-%m-%d)
        gh api repos/$REPO_OWNER/$REPO_NAME/actions/artifacts --jq ".artifacts[] | select(.created_at < \"$CUTOFF_DATE\") | .id" | while read -r id; do
            if [ -n "$id" ]; then
                gh api --method DELETE repos/$REPO_OWNER/$REPO_NAME/actions/artifacts/$id
                echo "Gelöscht: Artifact ID $id"
            fi
        done
        ;;
    2)
        echo -e "${YELLOW}🗑️  Lösche Artifacts älter als 30 Tage...${NC}"
        CUTOFF_DATE=$(date -d '30 days ago' +%Y-%m-%d 2>/dev/null || date -v-30d +%Y-%m-%d)
        gh api repos/$REPO_OWNER/$REPO_NAME/actions/artifacts --jq ".artifacts[] | select(.created_at < \"$CUTOFF_DATE\") | .id" | while read -r id; do
            if [ -n "$id" ]; then
                gh api --method DELETE repos/$REPO_OWNER/$REPO_NAME/actions/artifacts/$id
                echo "Gelöscht: Artifact ID $id"
            fi
        done
        ;;
    3)
        echo -e "${RED}⚠️  WARNUNG: Alle Artifacts werden gelöscht!${NC}"
        read -p "Bist du sicher? (yes/no): " CONFIRM
        if [ "$CONFIRM" = "yes" ]; then
            gh api repos/$REPO_OWNER/$REPO_NAME/actions/artifacts --jq ".artifacts[].id" | while read -r id; do
                if [ -n "$id" ]; then
                    gh api --method DELETE repos/$REPO_OWNER/$REPO_NAME/actions/artifacts/$id
                    echo "Gelöscht: Artifact ID $id"
                fi
            done
        else
            echo "Abgebrochen."
        fi
        ;;
    4)
        echo -e "${BLUE}Manuelle Artifact-Auswahl:${NC}"
        echo "Gib die Artifact-IDs ein (durch Leerzeichen getrennt):"
        read -p "IDs: " ARTIFACT_IDS
        for id in $ARTIFACT_IDS; do
            if [ -n "$id" ]; then
                gh api --method DELETE repos/$REPO_OWNER/$REPO_NAME/actions/artifacts/$id
                echo "Gelöscht: Artifact ID $id"
            fi
        done
        ;;
    5)
        echo -e "${GREEN}✅ Keine Aktion ausgewählt${NC}"
        ;;
    *)
        echo -e "${RED}❌ Ungültige Auswahl${NC}"
        exit 1
        ;;
esac

echo
echo -e "${GREEN}✅ Storage-Management abgeschlossen${NC}"
echo
echo -e "${BLUE}💡 Tipps zur Storage-Reduzierung:${NC}"
echo "• Artifacts automatisch nach 5-7 Tagen löschen lassen"
echo "• Nur bei Releases Artifacts erstellen"
echo "• Cleanup-Workflow regelmäßig ausführen"
echo "• Große Dateien von Artifacts ausschließen"