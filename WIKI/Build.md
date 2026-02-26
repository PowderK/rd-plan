# Datenablage, Backup und Wiederherstellung

Diese Seite beschreibt, wie Endnutzer:innen ihre RD-Plan-Daten sicher verwalten.

## 1) Wo liegen die Daten?

RD-Plan speichert Daten lokal pro Benutzerprofil.

- Einstellungen
- Planungsdaten
- Import-/Export-bezogene Daten

Je nach Installation kann der genaue Speicherort leicht abweichen.

## 2) Wann sollte ein Backup erstellt werden?

Empfehlung:

- vor einem großen Import
- vor Versionswechseln/Updates
- vor strukturellen Änderungen (z. B. neue Planungslogik)
- mindestens regelmäßig (z. B. wöchentlich)

## 3) Backup-Standardprozess

1. RD-Plan schließen.
2. Datenordner auf ein Sicherungslaufwerk kopieren.
3. Backup mit Datum benennen (z. B. `RD-Plan-Backup-2026-02-26`).
4. Kurz prüfen, ob Dateien vollständig kopiert wurden.

![Screenshot-Platzhalter: Backup-Ordner](screenshots/data-01-backup-folder.png)
*Platzhalter: Datenordner + Zielordner mit Datumsbackup.*

## 4) Wiederherstellung (Restore)

1. RD-Plan vollständig schließen.
2. Aktuellen Datenordner sichern (Sicherheitskopie vom Ist-Zustand).
3. Inhalte aus einem funktionierenden Backup zurückkopieren.
4. RD-Plan starten und stichprobenartig prüfen.

## 5) Prüfliste nach Restore

- Sind Personaldaten vorhanden?
- Sind aktuelle Monate im Dienstplan sichtbar?
- Stimmen Fahrzeuge/Werte mit dem erwarteten Stand?
- Lassen sich Einträge normal speichern?

## 6) Backup-Strategie für Teams

- Ein gemeinsamer, klar benannter Speicherort
- Verbindliche Backup-Routine (z. B. Wochenabschluss)
- Aufbewahrungsregel (z. B. Tagesbackups 14 Tage, Monatsbackups 12 Monate)

## 7) Typische Fehler vermeiden

- Kein Backup während die App noch geöffnet ist.
- Keine Sicherung auf nur ein einziges Laufwerk.
- Nach Importen nicht ohne Plausibilitätsprüfung weiterarbeiten.
