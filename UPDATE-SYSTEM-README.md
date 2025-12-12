# Update-System Übersicht

## ✅ Implementiert

Das Update-System für RD-Plan garantiert **vollständige Datensicherheit** bei allen Updates.

### Automatischer Update-Prozess

Bei jedem App-Start:
1. ✅ **Versions-Prüfung**: Vergleich von installierter vs. aktueller Version
2. ✅ **Automatisches Backup**: Vor jedem Update wird die komplette Datenbank gesichert
3. ✅ **Schema-Migration**: Alle neuen Datenbank-Änderungen werden durchgeführt
4. ✅ **Rollback-Sicherheit**: Bei Fehler automatische Wiederherstellung des Backups

### Dateien

```
main/
├── update-manager.ts       # Update-Logik & Migrations-Registry
├── main.ts                 # Auto-Update beim App-Start + IPC-Handler
└── database-manager.ts     # Backup/Restore-Funktionen (bereits vorhanden)

preload.ts                  # API für Renderer-Prozess

BETA-UPDATE-GUIDE.md        # Dokumentation für Beta-Tester
UPDATE-SYSTEM-DEV.md        # Dokumentation für Entwickler
```

### Versionierung

**version-info.json** (persistiert im userData):
```json
{
  "version": "0.1",      // App-Version (aus package.json)
  "build": 377,          // Build-Nummer (aus build-info.json)
  "dbSchemaVersion": 3   // DB-Schema Version (aus Migrationen)
}
```

### Migrations-System

Aktuell registrierte Migrationen:
1. **v1**: Initial Schema (alle Basis-Tabellen)
2. **v2**: Lehrjahr-Spalte in `azubi_periods`
3. **v3**: `qualification_types` Tabelle

Neue Migrationen in `update-manager.ts → registerMigrations()` hinzufügen.

### Backup-Struktur

```
backups/
└── 2024/
    ├── 2024-11/
    │   └── 20241119143025-pre-update-v0.1-b377/
    │       ├── rd-plan.db
    │       └── label.txt
    └── 2024-ALL/
        └── 20241119120000-preimport-2024/
            └── rd-plan.db
```

- Hierarchisch nach Jahr/Monat
- Zeitstempel + Label im Ordnernamen
- Vollständige DB-Kopie + Metadaten

### API für Renderer

```typescript
// Version abrufen
const { versionInfo } = await window.api.getCurrentVersion();

// Manuelles Backup erstellen
const { backupPath } = await window.api.createManualBackup('vor-kritischer-operation');

// Update-Check
const { needsUpdate, currentVersion, appVersion } = await window.api.checkForUpdates();

// Manuelles Update
const { success, message, backupPath } = await window.api.performManualUpdate();
```

## 🎯 Beta-Test Ready

Das System ist vollständig implementiert und getestet für:
- ✅ Automatische Updates ohne Datenverlust
- ✅ Manuelle Backups vor riskanten Operationen
- ✅ Vollständiges Rollback bei Fehlern
- ✅ Transparente Versions-Verwaltung

## 📚 Dokumentation

- **Beta-Tester**: Siehe `BETA-UPDATE-GUIDE.md`
- **Entwickler**: Siehe `UPDATE-SYSTEM-DEV.md`

## 🚀 Workflow

### Neue Version erstellen

```bash
# 1. Migration hinzufügen (falls DB-Änderung)
#    → update-manager.ts editieren

# 2. Build-Nummer erhöhen
npm run bump-build

# 3. Kompilieren
npm run build

# 4. Testen
npm start  # Logs beobachten

# 5. Release erstellen
npm run dist
```

### Was beim User passiert

```
App-Start
  ↓
Versions-Check
  ↓
[Update?] ─No→ Normale Initialisierung
    │
   Yes
    ↓
Backup erstellen ✅
    ↓
Migrationen ausführen
    ↓
[Erfolg?] ─Yes→ Version speichern → Fertig ✅
    │
   No
    ↓
Rollback aus Backup
    ↓
Fehlermeldung anzeigen
    ↓
App startet mit alter Version ✅
```

## ⚠️ Wichtig

- Backups werden **IMMER** vor Updates erstellt
- Rollback ist **IMMER** möglich
- Migrationen müssen **idempotent** sein (mehrfach ausführbar)
- Version wird erst **NACH** erfolgreicher Migration gespeichert

---

**Status**: ✅ Produktionsbereit für Beta-Test
**Letzte Aktualisierung**: 19. November 2024
**Build**: 377
**DB Schema Version**: 3
