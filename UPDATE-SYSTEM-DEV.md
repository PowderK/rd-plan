# Update-System: Schnellübersicht für Entwickler

## Was wurde implementiert?

### 1. **UpdateManager** (`main/update-manager.ts`)
- Zentrale Klasse für Update-Verwaltung
- Migrations-Registry mit allen DB-Schema-Änderungen
- Automatische Version-Verwaltung
- Backup/Restore/Rollback-Logik

### 2. **Automatischer Update-Prozess** (in `main/main.ts`)
Bei jedem App-Start:
```typescript
app.whenReady().then(async () => {
    // ...Config-Check...
    
    // Automatisches Update mit Backup
    const updateMgr = getUpdateManager();
    if (await updateMgr.needsUpdate()) {
        const result = await performUpdate();
        // Bei Fehler: Automatischer Rollback
    }
    
    await createWindow();
});
```

### 3. **IPC-Handler für manuelle Verwaltung**
```typescript
// In main.ts hinzugefügt:
ipcMain.handle('get-current-version', ...)
ipcMain.handle('create-manual-backup', ...)
ipcMain.handle('check-for-updates', ...)
ipcMain.handle('perform-manual-update', ...)
```

### 4. **Preload API-Erweiterung**
```typescript
// In preload.ts:
window.api.getCurrentVersion()
window.api.createManualBackup(label)
window.api.checkForUpdates()
window.api.performManualUpdate()
```

---

## Wie funktioniert es?

### Version-Tracking

**version-info.json** (im userData-Verzeichnis):
```json
{
  "version": "0.1",
  "build": 377,
  "dbSchemaVersion": 3
}
```

**build-info.json** (im App-Root):
```json
{
  "version": "0.1",
  "build": 377
}
```

### Migrations-System

Jede Datenbank-Änderung = eine Migration:

```typescript
this.migrations.push({
  version: 3,
  description: 'Create qualification_types table',
  up: async (db) => {
    // Schema-Änderung durchführen
    await db.exec(`CREATE TABLE IF NOT EXISTS ...`);
  },
  down: async (db) => {
    // Optional: Rollback-Logik
  }
});
```

**Aktuell registriert:**
1. Initial Schema (v1)
2. Lehrjahr in azubi_periods (v2)
3. qualification_types Tabelle (v3)

### Backup-Hierarchie

```
backups/
└── YYYY/
    └── YYYY-MM/ oder YYYY-ALL/
        └── YYYYMMDDHHMMSS-label/
            ├── rd-plan.db
            └── label.txt
```

---

## Workflow für neue Versionen

### Szenario: Neue Funktion mit DB-Änderung

**Schritt 1: Migration hinzufügen**
```typescript
// In update-manager.ts → registerMigrations()
this.migrations.push({
  version: 4,
  description: 'Add vacation_requests table',
  up: async (db: AsyncDB) => {
    const tables = await db.all(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='vacation_requests'"
    );
    if (tables.length === 0) {
      await db.exec(`
        CREATE TABLE vacation_requests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          person_id INTEGER NOT NULL,
          start_date TEXT NOT NULL,
          end_date TEXT NOT NULL,
          status TEXT DEFAULT 'pending',
          FOREIGN KEY (person_id) REFERENCES personnel (id)
        )
      `);
    }
  }
});
```

**Schritt 2: Build-Nummer erhöhen**
```bash
npm run bump-build
# Oder manuell build-info.json bearbeiten
```

**Schritt 3: Build & Test**
```bash
npm run build
npm start
```

**Was passiert beim Start:**
```
[UpdateManager] Current: { version: "0.1", build: 377, dbSchemaVersion: 3 }
[UpdateManager] Target: { version: "0.1", build: 378, dbSchemaVersion: 4 }
[UpdateManager] Backup created: backups/2024/2024-ALL/20241119170000-pre-update-v0.1-b378
[UpdateManager] Running 1 migrations...
[UpdateManager] Applying migration 4: Add vacation_requests table
Update erfolgreich auf Version 0.1 Build 378
```

---

## UI-Integration (für Settings-Menü)

### Version anzeigen

```typescript
// In Settings oder About-Dialog
const versionResult = await window.api.getCurrentVersion();
if (versionResult.success) {
  const { version, build, dbSchemaVersion } = versionResult.versionInfo;
  console.log(`Version: ${version} Build ${build} (DB Schema: ${dbSchemaVersion})`);
}
```

### Manuelles Backup vor Import

```typescript
// Vor großem Dienstplan-Import
async function importDutyPlan() {
  // 1. Backup erstellen
  const backupResult = await window.api.createManualBackup('vor-dienstplan-import-dez-2024');
  
  if (backupResult.success) {
    console.log('Backup erstellt:', backupResult.backupPath);
    
    // 2. Import durchführen
    const importResult = await window.api.importDutyRoster(...);
    
    // 3. Bei Fehler: Backup anzeigen
    if (!importResult.success) {
      alert(`Import fehlgeschlagen. Backup verfügbar unter:\n${backupResult.backupPath}`);
    }
  }
}
```

### Update-Check anzeigen

```typescript
async function checkForUpdates() {
  const result = await window.api.checkForUpdates();
  
  if (result.needsUpdate) {
    console.log('Update verfügbar:');
    console.log('Aktuell:', result.currentVersion);
    console.log('Neu:', result.appVersion);
    
    // Optional: Manuelles Update auslösen
    if (confirm('Update jetzt installieren?')) {
      const updateResult = await window.api.performManualUpdate();
      if (updateResult.success) {
        alert('Update erfolgreich! App wird neu gestartet.');
        // App startet automatisch neu
      }
    }
  } else {
    console.log('Keine Updates verfügbar');
  }
}
```

---

## Testing

### Lokaler Test

**Terminal 1: Build watch**
```bash
npm run build:main -- --watch
```

**Terminal 2: App starten**
```bash
npm start
```

**Logs beobachten:**
```
[UpdateManager] Starting update process
[UpdateManager] Current: {...}
[UpdateManager] Target: {...}
[DatabaseManager] Backup created: ...
[UpdateManager] Running X migrations...
Update erfolgreich
```

### Beta-Test Szenario

1. **Erstinstallation (Build 377)**
   - Keine version-info.json → Wird mit Build 377 erstellt
   - DB Schema v3

2. **Update auf Build 378**
   - version-info.json existiert: Build 377, Schema v3
   - Update erkannt
   - Backup erstellt
   - Migration 4 ausgeführt
   - version-info.json → Build 378, Schema v4

3. **Fehler-Simulation**
   - Migration wirft Fehler
   - Automatischer Rollback
   - Backup wiederhergestellt
   - Fehlermeldung angezeigt
   - App läuft mit Build 377

---

## Wichtige Hinweise

### ✅ Best Practices für Migrationen

**DO:**
- Immer `IF NOT EXISTS` / `IF EXISTS` verwenden
- Spalten-Existenz vor `ALTER TABLE` prüfen
- Idempotente Migrationen schreiben (mehrfach ausführbar)
- Logging für Debugging

**DON'T:**
- Daten löschen ohne Sicherheit
- Schema-Breaking-Changes ohne Migration
- Fehler einfach schlucken

### 🔒 Sicherheit

- Backups werden **vor** jeder Migration erstellt
- Bei **jedem** Fehler: Automatischer Rollback
- Version-Info wird erst nach erfolgreicher Migration gespeichert
- Alte Backups bleiben erhalten (manuell löschen wenn nötig)

### 📦 Deployment

**Neue Version bereitstellen:**
1. Alle Migrationen in `update-manager.ts` registrieren
2. `npm run bump-build` (erhöht Build-Nummer)
3. `npm run build`
4. `npm run dist` (erstellt Installer/Portable)
5. Neue Version verteilen

**Was beim User passiert:**
- App-Start erkennt Update
- Automatisches Backup
- Automatische Migration
- Bei Erfolg: Weiter wie gewohnt
- Bei Fehler: Rollback + Fehlermeldung

---

## Debugging

### Version-Info prüfen

```bash
# macOS/Linux
cat ~/Library/Application\ Support/rd-plan/version-info.json

# Windows
type %APPDATA%\rd-plan\version-info.json
```

### Backups finden

```bash
# Im App-Verzeichnis oder:
ls -lah ~/Library/Application\ Support/rd-plan/backups/
```

### Logs aktivieren

Alle Update-Schritte loggen automatisch mit `[UpdateManager]` Prefix.

---

## Zusammenfassung

**Implementiert:**
- ✅ Automatisches Update-System beim App-Start
- ✅ Versioniertes Migrations-System
- ✅ Automatische Backups vor Updates
- ✅ Automatischer Rollback bei Fehlern
- ✅ Manuelle Backup-Erstellung
- ✅ IPC-API für UI-Integration
- ✅ Hierarchische Backup-Verwaltung
- ✅ Vollständige Dokumentation

**Garantiert:**
- Keine Datenverluste bei Updates
- Transparente Versions-Verwaltung
- Sicheres Rollback-Verfahren
- Beta-Test ready

**Nächste Schritte:**
1. UI für Version-Anzeige in Settings (optional)
2. Beta-Test mit echten Daten
3. Feedback sammeln
4. Ggf. Backup-Verwaltungs-UI (optional)

Das System ist **produktionsbereit** für den Beta-Test! 🚀
