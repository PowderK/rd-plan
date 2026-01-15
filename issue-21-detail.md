## Detaillierte Beschreibung

### Das Problem

Wenn ein Kollege durch nicht-berechnete Tätigkeiten (z.B. Kantinendienst, Lehrgang) weniger im regulären Dienst verfügbar ist, hat er automatisch ein reduziertes SOLL für RTW/NEF-Schichten. Die "freigewordenen" Schichten werden aktuell auf **alle Kollegen gleichmäßig verteilt**.

**Problem:** Kollege A übernimmt faktisch die RTW-Schichten von Kollege B, aber sein SOLL berücksichtigt das nicht. Alle anderen Kollegen profitieren auch, obwohl sie nichts übernehmen.

### Konkretes Beispiel (Status Quo)

```
Monat mit 20 Arbeitstagen, 100 RTW-Schichten, 10 Kollegen

Kollege A: 20 Tage verfügbar → SOLL: 10 RTW
Kollege B: 15 Tage verfügbar (5 Tage Kantine) → SOLL: 7,5 RTW
Kollege C-J: je 20 Tage verfügbar → SOLL: je 10,28 RTW

Die 2,5 "freigewordenen" Schichten werden auf ALLE 10 Kollegen verteilt
→ Jeder bekommt +0,25 Schichten im SOLL
```

### Lösung mit Schichtübernahme-Feature

```
Schichtübernahme erfassen: 2,5 Schichten von Kollege B → Kollege A

Ergebnis:
Kollege A: SOLL: 10 + 2,5 = 12,5 RTW (übernimmt gezielt)
Kollege B: SOLL: 7,5 RTW (bereits durch Kantine reduziert, KEINE weitere Änderung)
Kollege C-J: SOLL: je 10 - (2,5/8) = 9,69 RTW (Schichten werden abgezogen)

Wichtig: Die 2,5 Schichten werden von den 8 verbleibenden Kollegen (C-J) abgezogen,
damit die Gesamtsumme stimmt (100 Schichten). Ohne diese Verrechnung würden
112,5 Schichten verteilt werden (zu viel)!
```

## Anforderungen

### Datenmodell

Neue Tabelle: `shift_transfers`

```sql
CREATE TABLE shift_transfers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_person_id INTEGER NOT NULL,
  to_person_id INTEGER NOT NULL,
  shift_count REAL NOT NULL,
  position_type TEXT NOT NULL,
  valid_from TEXT NOT NULL,
  valid_until TEXT,
  reason TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(from_person_id) REFERENCES personnel(id) ON DELETE CASCADE,
  FOREIGN KEY(to_person_id) REFERENCES personnel(id) ON DELETE CASCADE
);
```

### Berechnungslogik - MIT VERRECHNUNG AUF ALLE

**Wichtig:** Die übernommenen Schichten müssen bei den anderen Kollegen abgezogen werden, damit die Gesamtsumme stimmt!

```javascript
function calculateSollWithTransfers(person, month, year, baseSoll, allPersonnel) {
  let adjustedSoll = baseSoll;
  const transfers = getShiftTransfersForMonth(month, year);
  
  // Zähle wie viele Personen NICHT an Transfers beteiligt sind
  const involvedPersonIds = new Set();
  let totalTransferredShifts = 0;
  
  for (const transfer of transfers) {
    involvedPersonIds.add(transfer.from_person_id);
    involvedPersonIds.add(transfer.to_person_id);
    totalTransferredShifts += transfer.shift_count;
  }
  
  const nonInvolvedCount = allPersonnel.filter(p => !involvedPersonIds.has(p.id)).length;
  
  for (const transfer of transfers) {
    if (transfer.to_person_id === person.id) {
      // Empfänger: Schichten hinzufügen
      adjustedSoll += transfer.shift_count;
    } else if (!involvedPersonIds.has(person.id) && nonInvolvedCount > 0) {
      // Nicht-beteiligte: Anteilig abziehen
      adjustedSoll -= totalTransferredShifts / nonInvolvedCount;
    }
  }
  
  return adjustedSoll;
}
```

**Beispiel-Berechnung:**
- 2,5 Schichten werden von B an A übertragen
- 8 nicht-beteiligte Kollegen (C-J)
- Jeder bekommt -2,5/8 = -0,3125 Schichten vom SOLL abgezogen

## UI-Komponenten

### 1. Dialog: Schichtübernahme erfassen
- Von Person (Dropdown)
- An Person (Dropdown)
- Anzahl Schichten (Number)
- Positions-Typ (Dropdown: RTW/NEF/KTW)
- Gültig von/bis (Datepicker)
- Grund/Notiz (Textarea)

### 2. Übersicht: Aktive Schichtübernahmen
- Tabellarische Darstellung
- Filter nach Jahr, Monat, Person
- Bearbeiten/Löschen-Funktionen
- Export-Funktion

### 3. Kontrollkasten-Integration
- Tooltip bei angepasstem SOLL
- Optional: Spalte "Übernahme" mit +/- Anzahl

## Betroffene Komponenten

- main/database.ts - Neue Tabelle
- main/database-manager.ts - CRUD-Operationen
- main/main.ts - IPC-Handler
- renderer/utils/calculation.ts - Soll-Berechnung
- renderer/components/MonthTabs.tsx - Kontrollkasten
- Neue Komponente: ShiftTransferManager.tsx
- Neue Komponente: ShiftTransferDialog.tsx

## Vorteile

- Gerechte Verteilung
- Transparenz über Übernahmen
- Flexible Handhabung
- Keine Auswirkung auf andere Kollegen
- Dokumentation des Grundes
