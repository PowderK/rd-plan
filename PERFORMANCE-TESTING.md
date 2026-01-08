# Performance-Tests für RD-Plan

Dieses Verzeichnis enthält Tools zur reproduzierbaren Performance-Messung.

## Schnellstart

### 1. Performance-Test durchführen

```bash
npm run perf
```

Dies:
- Erstellt die App neu (`npm run build`)
- Generiert Test-Daten (falls nicht vorhanden)
- Misst die Performance kritischer Operationen
- Speichert Report als `performance-report-<timestamp>.json`

### 2. Performance-Tests vergleichen

```bash
npm run perf:compare performance-report-123.json performance-report-456.json
```

Optional mit HTML-Output:

```bash
npm run perf:compare performance-report-123.json performance-report-456.json --html
```

## Test-Konfiguration

In `test-performance.js` kannst du die Test-Parameter anpassen:

```javascript
const CONFIG = {
    RUNS_PER_TEST: 5,      // Anzahl Wiederholungen pro Test
    WARMUP_RUNS: 1,        // Warmup-Durchläufe
    PERSONNEL_COUNT: 50,   // Anzahl Test-Personen
    MONTHS_TO_FILL: 12,    // Monate mit Daten
    DAYS_PER_MONTH: 30     // Tage pro Monat
};
```

## Test-Datenbank

Performance-Tests nutzen eine separate Test-Datenbank unter `test-performance-db/`.
Diese wird nicht ins Repository eingecheckt (.gitignore).

Bei erstem Lauf werden automatisch Test-Daten generiert:
- 50 Personen mit verschiedenen Qualifikationen
- ~18.000 Dienstplan-Einträge (12 Monate)
- 5 Azubis
- 3 RTW-Fahrzeuge
- 2 NEF-Fahrzeuge

## Gemessene Operationen

### Lese-Operationen
- `getPersonnel()` - Alle aktiven Mitarbeiter
- `getPersonnel(includeInactive)` - Inkl. inaktive Mitarbeiter
- `getDutyRoster(year)` - Kompletter Dienstplan für ein Jahr
- `getAzubiList()` - Azubi-Liste
- `getRtwVehicles()` - RTW-Fahrzeuge
- `getNefVehicles()` - NEF-Fahrzeuge
- `getItwVehicles()` - ITW-Fahrzeuge
- `getQualificationsList()` - Qualifikationen

### Schreib-Operationen
- `addPersonnel()` - Neuen Mitarbeiter anlegen
- `updatePersonnel()` - Mitarbeiter aktualisieren
- `assignSlot()` - Schicht zuweisen
- `clearSlot()` - Schicht leeren
- `deletePersonnel()` - Mitarbeiter löschen

## Reproduzierbarkeit

Für reproduzierbare Tests:

1. **Gleiche Hardware/VM verwenden**
2. **Keine anderen Programme während Test laufen lassen**
3. **Mehrere Durchläufe** (Standard: 5x)
4. **Warmup-Phase** (Standard: 1x) vor Messung
5. **Test-Datenbank beibehalten** für konsistente Vergleiche

## Report-Format

Performance-Reports werden als JSON gespeichert:

```json
{
  "timestamp": "2026-01-06T14:23:46.000Z",
  "dbType": "sqlite",
  "config": { ... },
  "system": {
    "platform": "darwin",
    "arch": "arm64",
    "nodeVersion": "v18.0.0",
    "cpus": 8
  },
  "results": [
    {
      "name": "getPersonnel()",
      "avg": 12.45,
      "min": 11.23,
      "max": 14.67,
      "median": 12.34,
      "times": [11.23, 12.34, 12.45, 12.56, 14.67]
    }
  ],
  "total": 245.67
}
```

## Vergleichs-Output

```
📊 Performance-Vergleich
═══════════════════════════════════════════════════════════════════════════════
Baseline: performance-report-1.json
  Datum: 6.1.2026, 14:23:46
  DB-Typ: sqlite
  System: darwin (arm64)

Vergleich: performance-report-2.json
  Datum: 6.1.2026, 15:45:32
  DB-Typ: sqlite
  System: darwin (arm64)
═══════════════════════════════════════════════════════════════════════════════

Operation                           Baseline     Vergleich    Differenz  Status
───────────────────────────────────────────────────────────────────────────────
getPersonnel()                      12.45ms      10.23ms       -17.8%  🟢
getDutyRoster(year)                156.78ms     145.34ms       -7.3%  🟡
...
═══════════════════════════════════════════════════════════════════════════════
Gesamt                             245.67ms     228.45ms       -7.0%  🟡
═══════════════════════════════════════════════════════════════════════════════

📊 Legende:
  🟢🟢 = >20% schneller  |  🟢 = >10% schneller  |  🟡 = ±10%
  🔴 = >10% langsamer    |  🔴🔴 = >20% langsamer

🏆 Top 3 Verbesserungen:
  1. getPersonnel(): -17.8% (12.45ms → 10.23ms)
  ...
```

## Beispiel-Workflow

### Baseline erstellen (vor Optimierung)

```bash
# Build und Test
npm run perf

# Report umbenennen für bessere Übersicht
mv performance-report-123456.json performance-report-baseline.json
```

### Nach Optimierung testen

```bash
# Optimierungen im Code durchführen
# ...

# Neuen Test durchführen
npm run perf

# Reports vergleichen
npm run perf:compare performance-report-baseline.json performance-report-789012.json --html
```

### Kontinuierliche Überwachung

Führe Performance-Tests regelmäßig durch und speichere Reports:

```bash
# Versionierte Reports
npm run perf
mv performance-report-*.json reports/v1.0.0-performance.json

# Nach Release v1.0.1
npm run perf
mv performance-report-*.json reports/v1.0.1-performance.json

# Vergleich
npm run perf:compare reports/v1.0.0-performance.json reports/v1.0.1-performance.json
```

## Troubleshooting

### Test-Daten neu generieren

```bash
# Test-Datenbank löschen
rm -rf test-performance-db/

# Nächster Lauf generiert neue Test-Daten
npm run perf
```

### Speicherplatz

Die Test-Datenbank benötigt ca. 20-30 MB.
Reports sind jeweils ca. 5-10 KB.

### Performance-Probleme

Falls Tests sehr langsam sind:
1. Reduziere `CONFIG.PERSONNEL_COUNT` oder `CONFIG.MONTHS_TO_FILL`
2. Reduziere `CONFIG.RUNS_PER_TEST` auf 3
3. Prüfe, ob Antivirus/Backup-Software läuft
