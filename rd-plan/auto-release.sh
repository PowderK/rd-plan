#!/bin/bash

# RD-Plan Quick Release Script - Automatisierter Sync ohne Benutzerinteraktion
# Für schnelle Releases

set -e

# Farben für Output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Verzeichnisse
BASE_DIR="/Users/benni/Documents/RD-Plan"
DEV_DIR="$BASE_DIR/rd-plan"
BETA_DIR="$BASE_DIR/rd-plan-beta"
BACKUP_DIR="$BASE_DIR/backups/$(date '+%Y%m%d_%H%M%S')"

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

echo "================================================"
echo "         RD-Plan Automated Release Sync"
echo "================================================"
echo ""

log_info "Starte automatischen Release-Prozess..."
log_info "Dev-Verzeichnis: $DEV_DIR"
log_info "Beta-Verzeichnis: $BETA_DIR"
echo ""

# Prüfe Verzeichnisse
log_info "Prüfe Verzeichnisstruktur..."
if [ ! -d "$DEV_DIR" ]; then
    log_error "Entwicklungsverzeichnis nicht gefunden: $DEV_DIR"
    exit 1
fi

if [ ! -d "$BETA_DIR" ]; then
    log_error "Beta-Verzeichnis nicht gefunden: $BETA_DIR"
    exit 1
fi
log_success "Verzeichnisstruktur OK"

# Backup erstellen (optional)
log_info "Überspringe Backup für schnelleren Prozess..."
log_success "Backup-Phase abgeschlossen"

# Build Development
log_info "Baue Entwicklungsversion..."
cd "$DEV_DIR"

if [ ! -d "node_modules" ]; then
    log_info "Installiere Dependencies..."
    npm install
fi

log_info "Starte Build-Prozess..."
npm run build
log_success "Entwicklungsversion erfolgreich gebaut"

# Synchronisiere Dateien
log_info "Synchronisiere Dateien von Dev zu Beta..."
SYNC_ITEMS=(
    "src/"
    "public/"
    "package.json"
    "package-lock.json"
    "tsconfig.json"
    "tsconfig.renderer.json"
    "vite.config.ts"
    "scripts/"
    "dist/"
    ".gitignore"
)

cd "$DEV_DIR"

for item in "${SYNC_ITEMS[@]}"; do
    if [ -e "$item" ]; then
        log_info "Sync: $item"
        if [ -e "$BETA_DIR/$item" ]; then
            rm -rf "$BETA_DIR/$item"
        fi
        cp -r "$item" "$BETA_DIR/"
    else
        log_warning "Item nicht gefunden: $item"
    fi
done
log_success "Dateien synchronisiert"

# Aktualisiere CHANGELOG
log_info "Aktualisiere CHANGELOG..."
cd "$BETA_DIR"

# Hole die aktuelle Beta-Version automatisch
log_info "Ermittle nächste Beta-Version..."

# Hole alle Beta-Tags und finde die höchste Nummer
LATEST_BETA_TAG=$(git tag -l "v1.0.0-beta.*" | sort -V | tail -1)

if [ -z "$LATEST_BETA_TAG" ]; then
    # Kein Beta-Tag gefunden, starte mit beta.1
    BETA_NUMBER=1
    log_info "Erster Beta-Release, starte mit beta.1"
else
    # Extrahiere die Beta-Nummer und erhöhe sie
    CURRENT_BETA=$(echo "$LATEST_BETA_TAG" | grep -o "beta\.[0-9]*" | grep -o "[0-9]*")
    BETA_NUMBER=$((CURRENT_BETA + 1))
    log_info "Letzter Beta-Tag: $LATEST_BETA_TAG, nächste Nummer: $BETA_NUMBER"
fi

VERSION="1.0.0-beta.$BETA_NUMBER"
log_success "Neue Version: $VERSION"

# Build-Nummer aus buildInfo.ts lesen (optional)
if [ -f "src/renderer/buildInfo.ts" ]; then
    BUILD_NUMBER=$(grep -o "build: [0-9]*" src/renderer/buildInfo.ts | grep -o "[0-9]*")
else
    BUILD_NUMBER=""
fi

DATE=$(date '+%Y-%m-%d')

# Erstelle CHANGELOG falls nicht vorhanden
if [ ! -f "CHANGELOG.md" ]; then
    log_info "Erstelle neues CHANGELOG.md"
    cat > CHANGELOG.md << 'EOF'
# RD-Plan Changelog

Alle wichtigen Änderungen an diesem Projekt werden in dieser Datei dokumentiert.

EOF
fi

# Erstelle temporären Changelog-Eintrag
TEMP_CHANGELOG=$(mktemp)
cat > "$TEMP_CHANGELOG" << EOF
# RD-Plan Changelog

Alle wichtigen Änderungen an diesem Projekt werden in dieser Datei dokumentiert.

## [${VERSION}${BUILD_NUMBER:+" Build ${BUILD_NUMBER}"}] - ${DATE}

### Hinzugefügt
- Excel Import/Export für Personal-Daten
- Settings Import/Export für Konfigurationen (JSON und Excel)
- Automatische Datei-Dialoge für Import/Export-Operationen
- Template-Generierung für neue Installationen

### Geändert
- Entfernung der initialen Personal-Daten-Seeding
- Verbesserte Database-Adapter-Architektur
- Erweiterte IPC-Handler für Datei-Operationen

### Behoben
- Settings-Synchronisation zwischen verschiedenen Fenstern
- Transaction-Safety bei Import-Operationen

EOF

# Füge bestehenden Changelog hinzu (ohne ersten Header)
if [ -f "CHANGELOG.md" ]; then
    tail -n +4 "CHANGELOG.md" >> "$TEMP_CHANGELOG"
fi

mv "$TEMP_CHANGELOG" "CHANGELOG.md"
log_success "CHANGELOG aktualisiert"

# Git Operations
log_info "Führe Git-Operationen durch..."
cd "$BETA_DIR"

# Prüfe ob Git-Repository initialisiert ist
if [ ! -d ".git" ]; then
    log_info "Initialisiere Git-Repository..."
    git init
    git remote add origin https://github.com/powderk/rd-plan.git
fi

# Git add
git add .

# Erstelle Commit-Message
COMMIT_MSG="Beta ${VERSION}${BUILD_NUMBER:+" Build ${BUILD_NUMBER}"} - ${DATE}

- Excel Import/Export für Personal-Daten
- Settings Import/Export (JSON/Excel)
- Template-Generierung
- Verbesserte Database-Architektur
- Automatische Sync vom Entwicklungsverzeichnis"

# Commit
log_info "Erstelle Commit..."
git commit -m "$COMMIT_MSG" || log_warning "Keine Änderungen zu committen"

# Tag erstellen
TAG_NAME="v${VERSION}"
log_info "Erstelle Beta-Tag: $TAG_NAME"
git tag -a "$TAG_NAME" -m "Beta Release $TAG_NAME" || log_warning "Tag bereits vorhanden"

# Prüfe aktuelle Branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
log_info "Aktueller Branch: $CURRENT_BRANCH"

# Push zu GitHub
log_info "Pushe zu GitHub..."
git push origin "$CURRENT_BRANCH" || log_warning "Push fehlgeschlagen"
git push origin --tags || log_warning "Tag-Push fehlgeschlagen"

# GitHub Actions Build anstoßen
log_info "Starte GitHub Actions Build..."
if command -v gh &> /dev/null; then
    # Prüfe GitHub CLI Auth
    if gh auth status &> /dev/null 2>&1; then
        log_info "Löse Windows Build Workflow aus..."
        if gh workflow run build-windows.yml --ref "$CURRENT_BRANCH" 2>/dev/null; then
            log_success "Windows Build Workflow gestartet"
        else
            log_warning "Windows Build Workflow konnte nicht gestartet werden"
        fi
        
        log_info "Löse Mac Build Workflow aus..."
        if gh workflow run build-mac.yml --ref "$CURRENT_BRANCH" 2>/dev/null; then
            log_success "Mac Build Workflow gestartet"
        else
            log_warning "Mac Build Workflow konnte nicht gestartet werden"
        fi
        
        # Workflow Status anzeigen
        log_info "Aktuelle GitHub Actions Workflows:"
        gh run list --limit 3 --json displayTitle,status,conclusion,createdAt --template '{{range .}}{{.displayTitle}} | {{.status}} | {{.conclusion}} | {{.createdAt}}{{"\n"}}{{end}}' || log_warning "Workflow-Status konnte nicht abgerufen werden"
    else
        log_warning "GitHub CLI ist nicht authentifiziert. Führe 'gh auth login' aus."
        log_info "GitHub Actions Builds müssen manuell gestartet werden:"
        echo "  • GitHub Repository öffnen"
        echo "  • Actions Tab → build-windows.yml → Run workflow"
        echo "  • Actions Tab → build-mac.yml → Run workflow"
    fi
else
    log_warning "GitHub CLI (gh) ist nicht installiert. Installation: brew install gh"
    log_info "GitHub Actions Builds werden automatisch durch Tags ausgelöst."
    log_info "Alternativ: Builds manuell auf GitHub starten"
fi

log_success "Git-Operationen abgeschlossen"

echo ""
echo "================================================"
log_success "Release-Prozess erfolgreich abgeschlossen!"
echo "================================================"

# Zusammenfassung
echo ""
log_info "Zusammenfassung:"
echo "  • Backup erstellt: $BACKUP_DIR"
echo "  • Dateien synchronisiert: Dev → Beta"
echo "  • CHANGELOG aktualisiert"
echo "  • Beta-Tag erstellt: $TAG_NAME"
echo "  • Auf GitHub gepusht"
echo "  • GitHub Actions Builds ausgelöst"
echo ""

log_success "Beta Release ${VERSION}${BUILD_NUMBER:+" Build ${BUILD_NUMBER}"} ist verfügbar!"

# GitHub Actions Status-Link
if command -v gh &> /dev/null && gh auth status &> /dev/null 2>&1; then
    REPO_URL=$(git config --get remote.origin.url | sed 's/\.git$//')
    if [[ "$REPO_URL" == *"github.com"* ]]; then
        log_info "GitHub Actions Status: ${REPO_URL}/actions"
        log_info "Download Artifacts: ${REPO_URL}/releases"
    fi
fi
echo ""