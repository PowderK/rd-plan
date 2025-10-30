# RD‑Plan — Benutzeranleitung (Nutzung)

Diese Seite beschreibt, wie die Anwendung genutzt wird — für Anwender/Administratoren. Sie erklärt die wichtigsten Arbeitsabläufe, Beschreibungen der einzelnen Bereiche und häufige Aktionen.

## Allgemeines

- Ziel: Offline-fähige Dienst‑/Schichtplanung (Rettungswagen, NEF, Personalverwaltung).
- Datenbank: Lokale SQLite‑Datenbank im User‑Directory (macOS: `~/Library/Application Support/rd-plan/rd-plan.db`).
- Hauptbereiche der App (links/Navigation): Einteilung (Duty Roster), Personal, Fahrzeuge, Einstellungen, Werte, Auszubildende (Azubis), ITW.

## 1) Einteilung (Dienstplan)

Zweck: Monats‑/Jahresübersicht mit Einträgen pro Schicht/Tag.

Hauptaktionen:
- Jahr wählen: Wähle das Jahr, das du bearbeiten möchtest.
- Eintrag setzen: Klicke auf eine Zelle (Tag/Schicht) und wähle oder trage die zugewiesene Person ein.
- Bulk‑Import: Du kannst mehrere Einträge auf einmal importieren (Hintergrund: Funktion `bulk-set-duty-roster-entries`).
- Löschen: Es gibt Optionen zum Löschen aller Einträge eines Monats oder Jahres (`clear-duty-roster-month`, `clear-duty-roster-year`).

Tipps:
- Nutze die Such- und Filterfunktionen (sofern sichtbar) um Personen oder Dienste schnell zu finden.
- Nach großen Änderungen: prüfe die Übersicht, bevor du exportierst oder druckst.

![Platzhalter: Einteilungs-Übersicht](screenshots/duty-roster.png)
*Platzhalter: Ersetze `screenshots/duty-roster.png` durch einen Bildschirmfoto der Jahres-/Monatsübersicht.*

## 2) Personalverwaltung

Zweck: Personen anlegen, bearbeiten, löschen und Reihenfolge verwalten.

Hauptaktionen:
- Person anlegen: Öffne die Maske "Person hinzufügen" (Plus/Add) und fülle Pflichtfelder (Name, Rolle, ggf. Telefon/Notizen).
- Person bearbeiten: Wähle eine Person aus und klicke auf "Bearbeiten". Änderungen speichern.
- Person löschen: Markiere die Person und wähle "Löschen"; bestätigt wird in einem Dialog.
- Reihenfolge ändern: Ziehe Personen oder nutze die Reihenfolge‑Funktion, um die Standardreihenfolge in Auswahllisten zu steuern (API: `update-personnel-order`).

![Platzhalter: Personalverwaltung](screenshots/personnel-list.png)
*Platzhalter: Ersetze `screenshots/personnel-list.png` durch einen Screenshot der Personalübersicht / Bearbeitungsmaske.*

Import/Export:
- Excel‑Import: `Import personnel from Excel` — wähle eine Excel‑Datei und entscheide, ob vorhandene Daten ersetzt werden.
- Excel‑Export: Erzeuge eine Export‑Datei für externe Verarbeitung/Archiv.
- Vor dem Import: prüfe das Template (kann über `create-personnel-template` erzeugt werden).

## 3) Fahrzeuginventar (RTW / NEF)

Zweck: Verwalten, welche Fahrzeuge in welchem Jahr/Monat aktiv sind.

Hauptaktionen:
- Fahrzeuglisten ansehen: Wähle RTW oder NEF.
- Aktivierung setzen: Pro Fahrzeug kannst du für jeden Monat die Aktivierung an- oder ausschalten (z. B. für saisonale Nutzung oder Wartungen).
- Vehicle activation API: `set-rtw-vehicle-activation` / `set-nef-vehicle-activation`.

![Platzhalter: Fahrzeuginventar](screenshots/vehicles.png)
*Platzhalter: Ersetze `screenshots/vehicles.png` durch einen Screenshot der Fahrzeugübersicht.*

## 4) Azubis (Auszubildende) & ITW

- Azubis: Ähnlich wie Personal verwalten, mit eigenen Listen und speziellen Feldern (Ausbildungsjahr, Einsatzbeschränkungen).
- ITW Doctor: Verwalte Liste der ITW‑Ärzte und deren Zuweisungen.

## 5) Werte / Schichten / Vorlagen

- Werte: Enthält Referenzdaten wie Abkürzungen, Farbcodierungen, Schicht‑Definitionen.
- Schichten (Shift Types): In den Einstellungen oder Werte‑Bereich kannst du Schichtarten anlegen/ändern (z. B. Früh/Mittel/Spät/Nacht) — Änderungen werden in der Auswahl für die Einteilung wirksam.

## 6) Einstellungen & Exporte

- Einstellungen: App‑weite Einstellungen lassen sich über den Settings‑Dialog festlegen (z. B. Standardjahr, UI‑Optionen).
- Settings Import/Export: Du kannst Einstellungen als JSON/Excel importieren oder exportieren (nützlich für Migration oder Backup).
- Backups: Nutze die Exportfunktionen oder sichere den `~/Library/Application Support/rd-plan/` Ordner manuell.

![Platzhalter: Einstellungen](screenshots/settings.png)
*Platzhalter: Ersetze `screenshots/settings.png` durch einen Screenshot des Settings‑Dialogs.*

## 7) Excel‑Import & Export (Einsatzfälle)

- Import: Nutze die `import-personnel-excel` Funktion, um Mitarbeiterlisten einzulesen. Meistens erwartet die App ein bestimmtes Template — erstelle eine Vorlage mit `create-personnel-template`.
- Export: Exportiere Personal- oder Einstellungsdaten für externe Bearbeitung oder Archivierung.

## 8) Troubleshooting (kurze Hinweise für Nutzer)

- App startet nicht / Datenbankfehler: Kontaktiere den Administrator; gängiges Problem ist ein inkompatibles natives Addon (`better-sqlite3`) nach einem Electron‑Upgrade. Als Nutzer: lade die App neu oder nutze eine offizielle Distribution.
- Fehlende Einträge in der Einteilung: Prüfe Filtersicht/Jahrsauswahl; nutze die Bulk‑Import‑Funktion falls nötig.
- CSP‑Meldung (Sicherheit): Normal in Dev; in Releases ist CSP gesetzt.

## 9) Release‑Artefakte & Updates

- Releases sind im GitHub‑Release Bereich verfügbar. CI‑Builds erzeugen Windows‑Exe und ladet diese als Asset hoch. Der Support‑Admin kann diese nutzen, um die App auf Zielrechnern zu verteilen.

## 10) Reporting von Problemen

- Fehler/Feature‑Requests: Öffne ein Issue im GitHub‑Repo unter: https://github.com/PowderK/rd-plan/issues
- Wichtige Angaben: App‑Version/Build‑Nummer, Betriebssystem, Schritte zur Reproduktion, Screenshots und Logauszüge.

---

Wenn du möchtest, erweitere ich diese Bedienungsanleitung mit Screenshots (z. B. der Einteilungsoberfläche), Beispiel‑Workflows (z. B. "Dienstplan für neues Jahr anlegen" Schritt‑für‑Schritt) oder Kurzvideos. Soll ich konkrete Beispiel‑Workflows hinzufügen? 
