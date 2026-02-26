# Updates und Versionen (für Anwender)

Diese Seite erklärt, wie Updates sicher und nachvollziehbar durchgeführt werden.

## 1) Grundregel vor jedem Update

1. RD-Plan schließen.
2. Vollständiges Backup erstellen (siehe [Build](Build.md)).
3. Erst dann neue Version einspielen.

## 2) Standard-Updateablauf

1. Aktuelle Version aus den offiziellen Releases herunterladen.
2. Alte EXE durch neue EXE ersetzen (oder parallel mit klarer Versionsbezeichnung ablegen).
3. Anwendung starten.
4. Kurzprüfung durchführen:
	- Login funktioniert
	- aktueller Monat im Dienstplan sichtbar
	- Personal/Fahrzeuge/Werte erreichbar

![Screenshot-Platzhalter: Update-Datei](screenshots/release-01-update-file.png)
*Platzhalter: Alte und neue Version im Zielordner.*

## 3) Empfohlener Kurztest nach Update

- Eine Teständerung im Dienstplan durchführen
- Eine Personensuche öffnen
- Einen Einstellungsbereich öffnen
- Speichern/Neuladen testen

## 4) Rollback bei Problemen

Wenn nach einem Update gravierende Probleme auftreten:

1. Neue Version schließen.
2. Vorherige Version wieder starten.
3. Bei Bedarf Daten aus dem Backup zurückspielen.
4. Fehler strukturiert melden (siehe [FAQ](FAQ.md)).

## 5) Versionsdokumentation im Team

Empfehlung für den Betrieb:

- Datum des Updates notieren
- eingesetzte Version notieren
- besondere Auffälligkeiten notieren

So bleibt nachvollziehbar, ab wann Änderungen im Verhalten aufgetreten sind.
