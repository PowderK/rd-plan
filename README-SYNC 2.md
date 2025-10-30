# RD-Plan Sync Scripts

Dieses Verzeichnis enthält Scripts zur Synchronisation zwischen dem Entwicklungsverzeichnis (`rd-plan`) und dem Beta-/Produktionsverzeichnis (`rd-plan-beta`).

## 📁 Verzeichnisstruktur

```
RD-Plan/
├── rd-plan/                 # Entwicklungsverzeichnis
├── rd-plan-beta/           # Beta/Produktionsverzeichnis (GitHub)
├── sync-to-beta.sh         # Vollständiges Sync-Script
├── quick-sync.sh           # Schnelles Sync-Script
├── Makefile               # Make-Commands
└── README-SYNC.md         # Diese Datei
```

## 🚀 Scripts

### 1. sync-to-beta.sh (Vollständiger Sync)

Das Haupt-Sync-Script für komplette Releases:

```bash
./sync-to-beta.sh
```

**Features:**
- ✅ Backup-Erstellung vor Sync
- ✅ Build der Entwicklungsversion
- ✅ Synchronisation aller relevanten Dateien
- ✅ Automatische CHANGELOG-Aktualisierung
- ✅ Git-Commit mit Release-Message
- ✅ Automatische Tagging
- ✅ Push zu GitHub
- ✅ Benutzerbestätigung vor kritischen Operationen

**Verwendung:**
- Für offizielle Releases
- Bei größeren Änderungen
- Wenn CHANGELOG aktualisiert werden soll

### 2. quick-sync.sh (Schneller Sync)

Für schnelle Entwicklungszyklen ohne Benutzerinteraktion:

```bash
./quick-sync.sh
```

**Features:**
- ⚡ Keine Benutzerbestätigung
- ⚡ Automatischer Build + Sync
- ⚡ Direkter Git-Commit und Push
- ⚡ Minimal für CI/CD geeignet

**Verwendung:**
- Für schnelle Updates
- Entwicklungszyklen
- Automatisierte Builds

### 3. Makefile (Einfache Commands)

Vereinfacht die häufigsten Operationen:

```bash
# Übersicht aller Commands
make help

# Entwicklung
make install    # Dependencies installieren
make build      # Development build
make dev        # Anwendung starten

# Synchronisation
make sync       # Vollständiger Sync (sync-to-beta.sh)
make quick-sync # Schneller Sync (quick-sync.sh)
make release    # Build + vollständiger Sync

# Wartung
make clean      # Aufräumen (node_modules, dist)
```

## 🔧 Setup

### 1. Executable machen

```bash
chmod +x sync-to-beta.sh
chmod +x quick-sync.sh
```

### 2. Git-Repository prüfen

Das Beta-Verzeichnis sollte mit GitHub verbunden sein:

```bash
cd rd-plan-beta
git remote -v
# Sollte zeigen: origin https://github.com/powderk/rd-plan.git
```

### 3. Dependencies installieren

```bash
make install
# oder
cd rd-plan && npm install
```

## 📋 Sync-Inhalte

Folgende Dateien/Verzeichnisse werden synchronisiert:

### ✅ Immer synchronisiert:
- `src/` - Quellcode
- `public/` - Öffentliche Assets
- `dist/` - Build-Output
- `package.json` & `package-lock.json`
- `tsconfig.json` & `tsconfig.renderer.json`
- `vite.config.ts`
- `scripts/` - Build-Scripts
- `.gitignore`

### ❌ Nie synchronisiert:
- `node_modules/` (zu groß)
- `.git/` (separates Repository)
- `*.log` (temporäre Dateien)
- `.DS_Store` (macOS-Dateien)
- Datenbank-Dateien (`.db`)

## 🎯 Workflows

### Entwicklungs-Workflow
```bash
# 1. Entwicklung im rd-plan Verzeichnis
cd rd-plan
# ... Code-Änderungen ...

# 2. Testen
make dev

# 3. Schneller Sync für Tests
make quick-sync
```

### Release-Workflow
```bash
# 1. Finale Tests
make build
make dev

# 2. Vollständiger Release
make sync
# oder
./sync-to-beta.sh
```

### Hotfix-Workflow
```bash
# 1. Schnelle Änderung
cd rd-plan
# ... Fix ...

# 2. Sofortiger Sync
make quick-sync
```

## 🛡️ Backup & Sicherheit

### Automatische Backups
Das vollständige Sync-Script erstellt automatisch Backups:
```
backups/
└── YYYYMMDD_HHMMSS/
    └── beta-before-sync/
```

### Git-Safety
- Prüfung auf ungespeicherte Änderungen
- Bestätigung vor kritischen Operationen
- Rollback-Möglichkeit durch Git-History

## 🐛 Troubleshooting

### Script läuft nicht
```bash
# Executable-Rechte setzen
chmod +x sync-to-beta.sh quick-sync.sh

# Pfade prüfen
ls -la rd-plan/
ls -la rd-plan-beta/
```

### Git-Probleme
```bash
# Remote prüfen
cd rd-plan-beta
git remote -v

# Status prüfen
git status

# Forcierte Push (VORSICHT!)
git push origin main --force
```

### Build-Fehler
```bash
# Dependencies neu installieren
make clean
make install

# Node-Version prüfen
node --version
npm --version
```

## 📝 Customization

### Anpassung der Sync-Inhalte
In `sync-to-beta.sh` die `SYNC_ITEMS` Array bearbeiten:

```bash
SYNC_ITEMS=(
    "src/"
    "public/"
    "package.json"
    # ... weitere Dateien hinzufügen
)
```

### CHANGELOG-Template
In `sync-to-beta.sh` die `update_changelog()` Funktion anpassen.

### Git-Commit-Messages
In beiden Scripts die Commit-Message-Generierung anpassen.

## 📞 Support

Bei Problemen:
1. Logs in der Konsole prüfen
2. Git-Status in beiden Verzeichnissen prüfen  
3. Backup aus `backups/` wiederherstellen falls nötig

---

**Autor:** Benjamin Kreitz  
**Projekt:** RD-Plan  
**Letzte Aktualisierung:** $(date '+%Y-%m-%d')