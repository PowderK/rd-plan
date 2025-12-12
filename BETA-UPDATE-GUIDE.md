# RD-Plan Beta-Test: Update-Verfahren & Datensicherheit

## Übersicht

RD-Plan verfügt über ein vollautomatisches Update-System, das **alle Benutzerdaten bei jedem Update sichert** und im Fehlerfall automatisch wiederherstellt.

---

## 🔒 Datensicherheit

### Automatische Backups

**Bei jedem App-Start wird automatisch geprüft:**
1. Liegt ein Update vor?
2. Falls ja: Wird **VOR** dem Update ein vollständiges Backup erstellt
3. Alle Datenbank-Migrationen werden ausgeführt
4. Bei Fehler: Automatischer Rollback zum Backup

### Backup-Speicherorte

Backups werden hierarchisch organisiert:

```
<App-Verzeichnis>/backups/
├── 2024/
│   ├── 2024-11/          # Monats-Backups
│   │   └── 20241119143025-preimport-2024-11/
│   │       ├── rd-plan.db
│   │       └── label.txt
│   └── 2024-ALL/         # Jahres-Backups
│       └── 20241119120000-preimport-2024/
└── 2025/
    └── 2025-01/
```

**Struktur:**
- `YYYY/` - Jahr-Ordner
- `YYYY-MM/` oder `YYYY-ALL/` - Monats- oder Gesamt-Backup
- `YYYYMMDDHHMMSS-label/` - Zeitstempel + Label
- `rd-plan.db` - Die Datenbank-Datei
- `label.txt` - Beschreibung des Backups

---

## 📋 Update-Prozess beim App-Start

### 1. Automatischer Ablauf

```
App-Start
    ↓
Versions-Prüfung
    ↓
[Update erforderlich?]
    ├─ Nein → Normale Initialisierung
    └─ Ja  → Update-Prozess:
             ├─ 1. Backup erstellen
             ├─ 2. Datenbank-Migrationen durchführen
             ├─ 3. Version aktualisieren
             └─ 4. Bei Fehler: Rollback zum Backup
```

### 2. Was passiert bei einem Update?

**Schritt 1: Backup**
- Automatische Kopie der kompletten Datenbank
- Gespeichert mit Zeitstempel und Version
- Beispiel: `backups/2024/2024-ALL/20241119143025-pre-update-v0.2-b5/rd-plan.db`

**Schritt 2: Migration**
- Ausführung aller neuen Datenbank-Änderungen
- Beispiele:
  - Neue Tabellen-Spalten hinzufügen
  - Neue Tabellen erstellen
  - Datenstrukturen anpassen
- **Keine Daten gehen verloren!**

**Schritt 3: Versionsaktualisierung**
- Speicherung der neuen App- und DB-Schema-Version
- Datei: `<userData>/version-info.json`

**Schritt 4: Fehlerbehandlung**
- Bei **jedem** Fehler: Automatischer Rollback
- Wiederherstellung des Backups
- Fehlermeldung wird angezeigt
- App startet mit vorheriger Version

---

## 🧪 Beta-Test Szenarien

### Szenario 1: Normales Update (Erfolgsfall)

**Ausgangssituation:**
- Version 0.1 Build 1 installiert
- 50 Mitarbeiter eingegeben
- 20 Azubis mit Zeiträumen
- Dienstplan für 2024 komplett

**Update auf Version 0.2 Build 5:**
```
1. App-Start
2. Update erkannt
3. Backup: backups/2024/2024-ALL/20241119143025-pre-update-v0.2-b5/
4. Migration: Neue qualification_types Tabelle erstellt
5. Version gespeichert: v0.2 Build 5
6. ✅ Erfolg: Alle Daten vorhanden
```

**Ergebnis:**
- ✅ Alle 50 Mitarbeiter vorhanden
- ✅ Alle 20 Azubis mit Zeiträumen intakt
- ✅ Kompletter Dienstplan 2024 erhalten
- ✅ Neue Features verfügbar

---

### Szenario 2: Update mit Fehler (Rollback)

**Ausgangssituation:**
- Version 0.1 Build 1 installiert
- Datenbank mit Produktivdaten

**Update schlägt fehl:**
```
1. App-Start
2. Update erkannt
3. Backup erstellt ✅
4. Migration startet
5. ❌ FEHLER bei Migration
6. Automatischer Rollback
7. Backup wiederhergestellt
8. Fehlermeldung angezeigt
```

**Ergebnis:**
- ✅ Alle Daten wiederhergestellt
- ✅ App läuft mit alter Version
- ⚠️ Fehlermeldung enthält Details
- ℹ️ Backup bleibt erhalten

---

### Szenario 3: Manuelles Backup vor Daten-Import

**Situation:**
- Vor Import eines großen Excel-Dienstplans
- Sicherheit gewünscht

**Vorgehen:**
```typescript
// Im Code (z.B. Settings-Menü):
const result = await window.api.createManualBackup('vor-import-dezember-2024');

// Backup wird erstellt:
backups/2024/2024-12/20241119150000-vor-import-dezember-2024/rd-plan.db
```

**Wiederherstellung wenn nötig:**
```typescript
const backups = await window.api.listBackups();
// Zeige Liste der Backups
// User wählt: backups/2024/2024-12/20241119150000-vor-import-dezember-2024
await window.api.restoreBackup(selectedBackup.path);
// App startet neu mit wiederhergestellten Daten
```

---

## 🔧 Migrations-System

### Aktuell registrierte Migrationen

**Migration 1: Initial Schema**
- Alle Basis-Tabellen
- `personnel`, `azubis`, `duty_roster`, etc.

**Migration 2: Lehrjahr in Azubi-Zeiträumen**
- Spalte `lehrjahr` zu `azubi_periods` hinzugefügt
- Berechnung: Automatisch aus Zeiträumen

**Migration 3: Qualifikationstypen-Verwaltung**
- Neue Tabelle `qualification_types`
- Verwaltung von Qualifikationen (Fahrzeugführer, NEF, etc.)

### Wie Migrationen funktionieren

**Version-Tracking:**
```json
// version-info.json
{
  "version": "0.2",
  "build": 5,
  "dbSchemaVersion": 3
}
```

**Migrations-Ausführung:**
- Nur neue Migrationen werden ausgeführt
- Beispiel: DB hat Schema v2, App hat v3
  - ✅ Migration 3 wird ausgeführt
  - ⏭️ Migrationen 1+2 übersprungen

---

## 📊 Version-Informationen abrufen

### API-Aufrufe für Settings-Menü

```typescript
// Aktuelle Version abrufen
const result = await window.api.getCurrentVersion();
console.log(result.versionInfo);
// {
//   version: "0.2",
//   build: 5,
//   dbSchemaVersion: 3
// }

// Auf Updates prüfen
const updateCheck = await window.api.checkForUpdates();
console.log(updateCheck);
// {
//   success: true,
//   needsUpdate: false,
//   currentVersion: { version: "0.2", build: 5, dbSchemaVersion: 3 },
//   appVersion: { version: "0.2", build: 5 }
// }

// Manuelles Update durchführen (z.B. nach Neuinstallation)
const updateResult = await window.api.performManualUpdate();
console.log(updateResult);
// {
//   success: true,
//   message: "Update erfolgreich auf Version 0.2 Build 5",
//   backupPath: "backups/2024/2024-ALL/20241119143025-pre-update-v0.2-b5"
// }
```

---

## 🛠️ Entwickler: Neue Migration hinzufügen

### Schritt 1: Migration registrieren

In `main/update-manager.ts` → `registerMigrations()`:

```typescript
this.migrations.push({
  version: 4,  // Nächste freie Versionsnummer
  description: 'Add vacation tracking table',
  up: async (db: AsyncDB) => {
    // Prüfen ob Tabelle bereits existiert
    const tables = await db.all(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='vacation_requests'"
    );
    
    if (tables.length === 0) {
      console.log('[UpdateManager] Migration 4: Creating vacation_requests table');
      await db.exec(`
        CREATE TABLE vacation_requests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          person_id INTEGER NOT NULL,
          start_date TEXT NOT NULL,
          end_date TEXT NOT NULL,
          status TEXT DEFAULT 'pending',
          FOREIGN KEY (person_id) REFERENCES personnel (id) ON DELETE CASCADE
        )
      `);
    }
  },
  down: async (db: AsyncDB) => {
    // Optional: Rollback-Logik
    await db.exec("DROP TABLE IF EXISTS vacation_requests");
  }
});
```

### Schritt 2: Build-Version erhöhen

```bash
npm run bump-build
```

Oder manuell in `build-info.json`:
```json
{
  "version": "0.2",
  "build": 6
}
```

### Schritt 3: Testen

```bash
npm run build
npm start
```

**Logs prüfen:**
```
[UpdateManager] Starting update process
[UpdateManager] Current: { version: "0.2", build: 5, dbSchemaVersion: 3 }
[UpdateManager] Target: { version: "0.2", build: 6, dbSchemaVersion: 4 }
[UpdateManager] Backup created: backups/2024/2024-ALL/20241119160000-pre-update-v0.2-b6
[UpdateManager] Running 1 migrations...
[UpdateManager] Applying migration 4: Add vacation tracking table
[UpdateManager] Migration 4: Creating vacation_requests table
Update erfolgreich auf Version 0.2 Build 6
```

---

## 📝 Beta-Tester Checkliste

### Vor dem Test

- [ ] Aktuelle Version notieren
- [ ] Anzahl Mitarbeiter, Azubis, Dienstplan-Einträge dokumentieren
- [ ] Screenshots von wichtigen Daten machen

### Während des Tests

- [ ] App starten und Update-Logs beobachten
- [ ] Nach Update: Alle Daten überprüfen
  - [ ] Mitarbeiter vollständig?
  - [ ] Azubis mit Zeiträumen?
  - [ ] Dienstplan intakt?
  - [ ] Qualifikationen vorhanden?
- [ ] Neue Features testen
- [ ] Backup-Verzeichnis prüfen (wurde Backup erstellt?)

### Nach dem Test

- [ ] Versions-Info prüfen: Einstellungen → Version
- [ ] Feedback geben:
  - Update-Prozess reibungslos?
  - Daten vollständig?
  - Performance OK?
  - Fehler aufgetreten?

---

## ⚠️ Wichtige Hinweise

### Backup-Speicherplatz

- Ein Backup = Größe der Datenbank
- Durchschnittlich: 5-50 MB pro Backup
- Bei 100 Mitarbeitern + 2 Jahre Dienstplan: ~20 MB
- Empfehlung: Alte Backups >6 Monate manuell löschen

### Backup-Verwaltung

**Backups auflisten:**
```typescript
const backups = await window.api.listBackups(50); // Letzte 50
backups.list.forEach(b => {
  console.log(`${b.timestamp} - ${b.label} - ${b.path}`);
});
```

**Backup-Inhalt prüfen:**
```typescript
const summary = await window.api.getBackupSummary(
  backupPath,
  2024,  // Jahr (optional)
  11     // Monat 0-11 (optional)
);
console.log(summary.counts);
// { personnel: 50, azubis: 20, dutyRoster: 1825 }
```

### Migration-Sicherheit

✅ **Sichere Operationen:**
- `ALTER TABLE ... ADD COLUMN`
- `CREATE TABLE IF NOT EXISTS`
- `INSERT OR IGNORE`

❌ **Vorsicht bei:**
- `DROP TABLE` (ohne IF EXISTS)
- `DELETE FROM` (ohne WHERE)
- Daten-Transformationen ohne Backup

---

## 🆘 Notfall-Wiederherstellung

### Backup manuell wiederherstellen

**Wenn die App nicht startet:**

1. **Backup-Ordner finden:**
   - Windows: `C:\Users\<User>\AppData\Local\rd-plan\backups\`
   - Oder neben der App: `<App-Verzeichnis>/backups/`

2. **Letztes Backup identifizieren:**
   - Neuester Zeitstempel im Ordnernamen
   - `label.txt` für Details lesen

3. **Datenbank ersetzen:**
   - Aktuelles `rd-plan.db` umbenennen: `rd-plan.db.broken`
   - Backup kopieren: `backups/.../rd-plan.db` → `DB/rd-plan.db`

4. **App neu starten**

### Support-Informationen sammeln

Bei Problemen folgende Infos bereitstellen:

```typescript
const diagnostics = await window.api.getDiagnostics();
console.log(JSON.stringify(diagnostics, null, 2));
```

**Enthält:**
- Datenbankpfad
- App-Version
- Plattform
- Backup-Versuche
- Fehler-Details

---

## 📞 Kontakt & Support

**Bei Problemen während des Beta-Tests:**
- GitHub Issues: https://github.com/powderk/rd-plan/issues
- E-Mail: [Beta-Test Support Email]

**Bitte angeben:**
1. Version (vor und nach Update)
2. Fehler-Screenshots
3. Diagnostics-Output
4. Wann trat der Fehler auf?

---

## ✅ Zusammenfassung

**Das Update-System garantiert:**
- ✅ Automatische Backups vor jedem Update
- ✅ Automatischer Rollback bei Fehlern
- ✅ Keine Datenverluste
- ✅ Chronologische Backup-Verwaltung
- ✅ Manuelle Backup-Erstellung möglich
- ✅ Vollständige Wiederherstellung

**Beta-Tester können sicher sein:**
- Alle Daten werden bei Updates geschützt
- Bei Problemen: Automatische Wiederherstellung
- Manuelles Backup vor risikoreichen Aktionen möglich
- Transparente Versions-Verwaltung

**Viel Erfolg beim Beta-Test! 🚀**
