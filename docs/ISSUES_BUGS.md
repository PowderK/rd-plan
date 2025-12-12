# Bugliste (Stand: 02.12.2025)

## 1. Qualifikationen nicht mit Datenbankeinträgen verbunden
- **BEHOBEN - Neues System implementiert**
- Die Qualifikationen werden jetzt über `qualification_periods` verwaltet.
- **Gleiches System für Fahrzeuge:** RTW und NEF Fahrzeuge nutzen jetzt `rtw_vehicle_periods` und `nef_vehicle_periods` statt Checkboxen.
- **Zeitraum-basiert:** Start-Monat (YYYY-MM) und optionales Ende (unbegrenzt oder begrenzt).
- **Status:** ✅ BEHOBEN
- **Dateien:**
  - `/Users/benni/RD-Plan/main/database.ts` (Zeile 520-545: Neue Tabellen + Funktionen)
  - `/Users/benni/RD-Plan/main/main.ts` (Zeile 583-639: IPC-Handler)
  - `/Users/benni/RD-Plan/preload.ts` (Zeile 126-144: API-Funktionen)
  - `/Users/benni/RD-Plan/renderer/components/Vehicles.tsx` (Checkboxen entfernt, Zeitraum-Editor integriert)
  - `/Users/benni/RD-Plan/renderer/components/VehiclePeriodEditor.tsx` (Neue Komponente)
  - `/Users/benni/RD-Plan/main/database-manager.ts` (Zeile 80-96, 421-480: Adapter-Funktionen)

## 2. Vorplanung Azubis: Verschobene Einträge / Nicht importiert bei Jahresimport
- **Ursache:** Bei Jahresimporten wurde der Azubi-Block (Zeilen 70-87) komplett übersprungen.
- Folge: Azubi-Daten aus Excel-Vorplanung wurden nicht synchronisiert.
- **Status:** ✅ BEHOBEN (roster-importer.ts, Zeile 479-483)
- **Fix:** Azubi-Block wird jetzt auch bei Jahresimporten verarbeitet.

## 3. Einteilung wird nach Synchronisation gelöscht
- **Ursache:** 
  1. Bei Jahresimporten wurden alle Einträge überschrieben, ohne manuelle Änderungen zu respektieren.
  2. Die `ON CONFLICT`-Klausel in `bulkImportDutyRosterEntries` setzte `manual_edit` zurück auf 0, selbst wenn es vorher 1 war.
  3. **Hauptproblem:** Die Funktion `assignSlot` (für Einteilungen in RTW/NEF/ITW) setzte `manual_edit` nicht auf 1.
  4. Dadurch wurden Einträge aus der Einteilung beim Import als "nicht manuell" behandelt und überschrieben.
- **Status:** ✅ BEHOBEN (database.ts, Zeile 795-800, 1144-1151 + roster-importer.ts, Zeile 514-520)
- **Fix:** 
  1. Auch bei Jahresimporten wird jetzt `bulkImportDutyRosterEntries` verwendet.
  2. `ON CONFLICT DO UPDATE` prüft jetzt `manual_edit` und behält Wert/Typ bei, wenn `manual_edit = 1`.
  3. **`assignSlot` setzt jetzt immer `manual_edit = 1`** bei INSERT und UPDATE, damit Einteilungen geschützt sind.
