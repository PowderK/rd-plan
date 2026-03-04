# 007 – Wochenende konfigurierbar (Fr/Sa/So je Tag/Nacht per Checkbox)

Ziel: Nutzer:innen sollen individuell festlegen können, welche Zeiträume als „Wochenende“ gewertet werden.

## User Story
Als Planer:in möchte ich in den Einstellungen per Checkbox auswählen, welche Kombinationen aus Freitag, Samstag und Sonntag (jeweils Tag/Nacht) als Wochenende zählen, damit die Berechnung an lokale Dienst- und Tarifregeln angepasst werden kann.

## Scope
- In den Einstellungen wird ein neuer Abschnitt `Wochenende-Definition` ergänzt.
- Es gibt exakt 6 Checkboxen:
  - Freitag Tag
  - Freitag Nacht
  - Samstag Tag
  - Samstag Nacht
  - Sonntag Tag
  - Sonntag Nacht
- Die Auswahl wird persistent gespeichert (pro Standort/Installation wie bestehende Einstellungen).
- Die Wochenende-Logik in Berechnung, Anzeige und relevanten Prüfungen nutzt ausschließlich diese Konfiguration.
- Fallback bei fehlender Konfiguration: bisheriges Standardverhalten bleibt erhalten.

## Akzeptanzkriterien
- Nutzer:innen können alle 6 Checkboxen unabhängig voneinander setzen oder entfernen.
- Nach Speichern und Neustart bleibt die Auswahl unverändert erhalten.
- Aktivierte Checkboxen werden systemweit als Wochenende behandelt; deaktivierte nicht.
- Änderungen wirken auf alle Funktionen, die aktuell die Wochenende-Logik verwenden (z. B. Soll-/Ist-Berechnung, Zuschlags- bzw. Wochenendmarker, Prüfungen).
- Bei leerer/ungültiger Konfiguration greift deterministisch ein definierter Standard (kompatibel zum bisherigen Verhalten).

## Technikvorschlag
- Settings-Modell um ein Objekt erweitern, z. B.:
  - `weekendDefinition.friday.day`
  - `weekendDefinition.friday.night`
  - `weekendDefinition.saturday.day`
  - `weekendDefinition.saturday.night`
  - `weekendDefinition.sunday.day`
  - `weekendDefinition.sunday.night`
- UI: Neue Checkbox-Gruppe in den Einstellungen mit klarer Beschriftung `Tag`/`Nacht` je Wochentag.
- Migration: Beim Laden alter Settings fehlende Felder automatisch mit Defaultwerten auffüllen.
- Zentralisierung: Eine gemeinsame Hilfsfunktion `isWeekendShift(...)` verwendet nur die neue Konfiguration, damit keine verstreute Sonderlogik entsteht.
