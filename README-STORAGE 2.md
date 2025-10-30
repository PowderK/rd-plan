# GitHub Storage Management

## Problem
GitHub Actions hat ein Storage-Limit für Artifacts:
- **Free Accounts**: 500MB Storage
- **Pro Accounts**: 1GB Storage
- **Team/Enterprise**: Mehr Storage verfügbar

## Fehlermeldung
```
Error: Failed to CreateArtifact: Artifact storage quota has been hit. 
Unable to upload any new artifacts. 
Usage is recalculated every 6-12 hours.
```

## Lösungsansätze

### 1. CI/CD Workflow optimiert
- **Artifacts nur bei Releases**: Builds werden nur bei Git-Tags als Artifacts gespeichert
- **Kurze Retention**: Artifacts werden nach 5-30 Tagen automatisch gelöscht
- **Kleinere Artifacts**: Nur notwendige Dateien werden hochgeladen

### 2. Automatische Bereinigung
```bash
# Storage-Status prüfen
make storage-check

# Alte Artifacts bereinigen
make storage-cleanup
```

### 3. Cleanup-Workflow
- Automatische Bereinigung alte Artifacts (täglich um 2:00 UTC)
- Configurable in `.github/workflows/cleanup.yml`

## Verfügbare Scripts

### `rd-plan/manage-storage.sh`
Interaktives Tool zur Storage-Verwaltung:
```bash
cd rd-plan
./manage-storage.sh
```

**Features:**
- Storage-Nutzung anzeigen
- Artifacts auflisten mit Größe und Alter
- Bereinigungsoptionen:
  - Artifacts älter als 7 Tage
  - Artifacts älter als 30 Tage
  - Alle Artifacts
  - Manuelle Auswahl

### `rd-plan/demo-storage.sh`
Demo-Version für lokale Repositories:
```bash
cd rd-plan
./demo-storage.sh
```

### GitHub CLI Commands
```bash
# Alle Artifacts anzeigen
gh api repos/owner/repo/actions/artifacts

# Artifact löschen
gh api --method DELETE repos/owner/repo/actions/artifacts/ARTIFACT_ID

# Storage-Nutzung
gh api repos/owner/repo/actions/cache/usage
```

## Optimierte Workflows

### Standard CI/CD (`ci-cd.yml`)
- Tests für alle Commits
- Artifacts nur bei Tags/Releases
- Automatische Bereinigung nach 5-30 Tagen

### Minimal Pipeline (`minimal-ci.yml`)
- Extrem Storage-effizient
- Keine Artifacts für normale Commits
- Nur Release-Artifacts mit langer Retention

### Cleanup Pipeline (`cleanup.yml`)
- Täglich um 2:00 UTC
- Löscht Artifacts älter als 7 Tage
- Reduziert Storage-Verbrauch automatisch

## Best Practices

### 1. Selective Artifact Creation
```yaml
- name: Upload Artifacts
  uses: actions/upload-artifact@v4
  if: startsWith(github.ref, 'refs/tags/')  # Nur bei Tags
  with:
    retention-days: 30  # Kurze Retention
```

### 2. Kleinere Artifacts
```yaml
path: |
  dist/
  package.json
  README.md
# Keine node_modules, .git, etc.
```

### 3. Artifact Naming
```yaml
name: build-files-${{ github.run_number }}  # Eindeutige Namen
```

### 4. Conditional Workflows
```yaml
if: github.ref == 'refs/heads/main'  # Nur für bestimmte Branches
```

## Monitoring

### Storage Usage Tracking
```bash
# Aktuelle Nutzung
gh api repos/$OWNER/$REPO/actions/cache/usage

# Artifact-Liste
gh api repos/$OWNER/$REPO/actions/artifacts --jq '.artifacts[] | "\(.name) \(.size_in_bytes) \(.created_at)"'
```

### Alerts einrichten
1. GitHub Repository → Settings → Actions → General
2. Storage Notifications aktivieren
3. Email-Benachrichtigungen bei 80% Usage

## Troubleshooting

### "Storage quota exceeded"
1. Führe `make storage-cleanup` aus
2. Warte 6-12 Stunden auf Neuberechnung
3. Prüfe mit `make storage-check`

### Zu viele alte Artifacts
1. Aktiviere Cleanup-Workflow
2. Reduziere Retention-Days in CI/CD
3. Lösche manuell mit `manage-storage.sh`

### Große Artifacts
1. Überprüfe Artifact-Inhalte
2. Excludiere große Dateien (.git, node_modules, logs)
3. Komprimiere vor Upload

## Konfiguration

### Retention anpassen
```yaml
retention-days: 5  # Standard für Development
retention-days: 30 # Für Releases
retention-days: 90 # Für Production
```

### Cleanup-Zeitplan ändern
```yaml
schedule:
  - cron: '0 2 * * *'  # Täglich 2:00 UTC
  - cron: '0 2 * * 0'  # Wöchentlich Sonntag 2:00 UTC
```

## Migration zu Storage-effizienter Pipeline

1. **Backup aktueller Workflows**
2. **Implementiere `minimal-ci.yml`**
3. **Aktiviere Cleanup-Workflow**
4. **Teste mit `make storage-check`**
5. **Überwache Storage-Nutzung**

Diese Konfiguration reduziert den Storage-Verbrauch um bis zu 90% und verhindert zukünftige Quota-Probleme.