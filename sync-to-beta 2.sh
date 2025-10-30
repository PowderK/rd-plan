#!/bin/bash

# RD-Plan Sync Script - Synchronisiert Entwicklungsverzeichnis mit Beta und pusht zu GitHub
# Autor: Benjamin Kreitz
# Datum: $(date '+%Y-%m-%d')

set -e  # Exit bei Fehlern

# Farben für Output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Verzeichnisse
BASE_DIR="/Users/benni/Documents/RD-Plan"
DEV_DIR="$BASE_DIR/rd-plan"
BETA_DIR="$BASE_DIR/rd-plan-beta"
BACKUP_DIR="$BASE_DIR/backups/$(date '+%Y%m%d_%H%M%S')"

# Funktionen
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

# Prüfe ob Verzeichnisse existieren
check_directories() {
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
}

# Erstelle Backup
create_backup() {
    log_info "Erstelle Backup..."
    mkdir -p "$BACKUP_DIR"
    
    # Backup der Beta-Version vor Sync
    cp -r "$BETA_DIR" "$BACKUP_DIR/beta-before-sync"
    
    log_success "Backup erstellt in: $BACKUP_DIR"
}

# Build Development Version
build_development() {
    log_info "Baue Entwicklungsversion..."
    
    cd "$DEV_DIR"
    
    # Prüfe auf ungespeicherte Änderungen
    if git diff-index --quiet HEAD --; then
        log_info "Keine ungespeicherten Änderungen im Dev-Branch"
    else
        log_warning "Ungespeicherte Änderungen gefunden - committe diese zuerst!"
        git status
        read -p "Fortfahren? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_error "Abbruch durch Benutzer"
            exit 1
        fi
    fi
    
    # Installiere Dependencies falls nötig
    if [ ! -d "node_modules" ]; then
        log_info "Installiere Dependencies..."
        npm install
    fi
    
    # Build
    log_info "Starte Build-Prozess..."
    npm run build
    
    log_success "Entwicklungsversion erfolgreich gebaut"
}

# Synchronisiere Dateien
sync_files() {
    log_info "Synchronisiere Dateien von Dev zu Beta..."
    
    # Liste der zu synchronisierenden Dateien/Verzeichnisse
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
            
            # Lösche Ziel falls es existiert
            if [ -e "$BETA_DIR/$item" ]; then
                rm -rf "$BETA_DIR/$item"
            fi
            
            # Kopiere von Dev zu Beta
            cp -r "$item" "$BETA_DIR/"
        else
            log_warning "Item nicht gefunden: $item"
        fi
    done
    
    log_success "Dateien synchronisiert"
}

# Aktualisiere CHANGELOG
update_changelog() {
    log_info "Aktualisiere CHANGELOG..."
    
    cd "$BETA_DIR"
    
    # Prüfe ob CHANGELOG existiert
    if [ ! -f "CHANGELOG.md" ]; then
        log_info "Erstelle neues CHANGELOG.md"
        cat > CHANGELOG.md << EOF
# RD-Plan Changelog

Alle wichtigen Änderungen an diesem Projekt werden in dieser Datei dokumentiert.

Das Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.0.0/),
und dieses Projekt folgt [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Hinzugefügt
- Automatisches Sync-Script für Dev-to-Beta Deployment

EOF
    fi
    
    # Hole Build-Nummer aus package.json falls vorhanden
    BUILD_NUMBER=""
    if [ -f "package.json" ]; then
        BUILD_NUMBER=$(node -p "require('./package.json').build || ''" 2>/dev/null)
    fi
    
    # Erstelle Changelog-Eintrag
    DATE=$(date '+%Y-%m-%d')
    VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "1.0.0")
    
    # Temporäre Datei für neuen Changelog-Eintrag
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
}

# Git Operations
perform_git_operations() {
    log_info "Führe Git-Operationen durch..."
    
    cd "$BETA_DIR"
    
    # Prüfe ob Git-Repository initialisiert ist
    if [ ! -d ".git" ]; then
        log_info "Initialisiere Git-Repository..."
        git init
        git remote add origin https://github.com/powderk/rd-plan.git
    fi
    
    # Prüfe Git-Status
    log_info "Git Status:"
    git status
    
    # Stage alle Änderungen
    git add .
    
    # Erstelle Commit-Message
    VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "1.0.0")
    BUILD_NUMBER=$(node -p "require('./package.json').build || ''" 2>/dev/null)
    DATE=$(date '+%Y-%m-%d %H:%M')
    
    COMMIT_MSG="Release ${VERSION}${BUILD_NUMBER:+" Build ${BUILD_NUMBER}"} - ${DATE}

- Excel Import/Export für Personal-Daten
- Settings Import/Export (JSON/Excel)
- Template-Generierung
- Verbesserte Database-Architektur
- Automatische Sync vom Entwicklungsverzeichnis"
    
    # Commit
    log_info "Erstelle Commit..."
    git commit -m "$COMMIT_MSG"
    
    # Tag erstellen
    TAG_NAME="v${VERSION}${BUILD_NUMBER:+"-build${BUILD_NUMBER}"}"
    log_info "Erstelle Tag: $TAG_NAME"
    git tag -a "$TAG_NAME" -m "Release $TAG_NAME"
    
    # Push zu GitHub
    log_info "Pushe zu GitHub..."
    
    # Prüfe aktuelle Branch
    CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
    log_info "Aktueller Branch: $CURRENT_BRANCH"
    
    # Push Branch und Tags
    git push origin "$CURRENT_BRANCH"
    git push origin --tags
    
    log_success "Git-Operationen abgeschlossen"
    log_success "Release $TAG_NAME erfolgreich auf GitHub veröffentlicht"
}

# Cleanup-Funktion
cleanup() {
    log_info "Cleanup..."
    
    # Entferne temporäre Dateien falls vorhanden
    # (Derzeit keine speziellen Cleanup-Aktionen nötig)
    
    log_success "Cleanup abgeschlossen"
}

# Hauptfunktion
main() {
    echo "================================================"
    echo "         RD-Plan Development-to-Beta Sync"
    echo "================================================"
    echo ""
    
    log_info "Starte Sync-Prozess..."
    log_info "Dev-Verzeichnis: $DEV_DIR"
    log_info "Beta-Verzeichnis: $BETA_DIR"
    echo ""
    
    # Bestätigung vom Benutzer
    read -p "Fortfahren mit dem Sync? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_error "Abbruch durch Benutzer"
        exit 1
    fi
    
    echo ""
    
    # Führe Schritte aus
    check_directories
    create_backup
    build_development
    sync_files
    update_changelog
    perform_git_operations
    cleanup
    
    echo ""
    echo "================================================"
    log_success "Sync-Prozess erfolgreich abgeschlossen!"
    echo "================================================"
    
    # Zusammenfassung
    echo ""
    log_info "Zusammenfassung:"
    echo "  • Backup erstellt: $BACKUP_DIR"
    echo "  • Dateien synchronisiert: Dev → Beta"
    echo "  • CHANGELOG aktualisiert"
    echo "  • Commit und Tag erstellt"
    echo "  • Auf GitHub gepusht"
    echo ""
    
    cd "$BETA_DIR"
    VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "1.0.0")
    BUILD_NUMBER=$(node -p "require('./package.json').build || ''" 2>/dev/null)
    
    log_success "Release ${VERSION}${BUILD_NUMBER:+" Build ${BUILD_NUMBER}"} ist verfügbar!"
}

# Trap für Cleanup bei Fehlern
trap cleanup EXIT

# Führe Hauptfunktion aus
main "$@"