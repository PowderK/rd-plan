# RD-Plan

<div align="center">
  <img src="media/Timeline 1_01_00_05_29.png" alt="RD-Plan Logo" width="400"/>
</div>

RD-Plan ist eine Electron-Anwendung zur Planung von Rettungswagenschichten. Die Anwendung ermöglicht es Benutzern, Schichten zu verwalten, Personal zu organisieren und die Planung für verschiedene Monate zu visualisieren.

## Aktuelle Version
**v1.5.3** - Kategorienbasierter Multi-Sheet Import/Export, Duplikat-Konfliktbehandlung, globale UI-Steuerungsleisten über Tabs und dynamische ITW-Ärzte-Statusanzeige.

## Funktionen

### Automatische Azubi-Einteilung (v1.3.0+)
- **One-Click Verteilung**: Weist auf Knopfdruck alle ungeplanten Azubis des Monats auf freie Slots (RTW 2 für Maschinisten, RTW 3 für normale Azubis) zu.
- **Smarte Abteilungserkennung**: Berücksichtigt automatisch nur die Tage, an denen die aktivierte Abteilung tatsächlich Dienst hat.
- **Interaktiver Konfliktdialog**: Gibt es in einer Schicht mehr Azubis als reguläre RTW-Plätze, öffnet sich ein Lösungsdialog, der smarte Fallbacks (wie NEF oder alternative RTW-Plätze) anbietet.
- **Performance**: Führt komplexe Einteilungen als synchronisierten Batch-Update durch, um die Benutzeroberfläche flüssig zu halten und Ruckler zu vermeiden.

### Kernfunktionen
- **Authentifizierung & Rechteverwaltung** mit rollenbasierter Zugriffskontrolle
- **Multi-User Support** mit personalisierten Login und Permission-Management
- **Monats-Tabs** zur Navigation und Einteilung pro Monat
- **Dienstplan-Verwaltung** mit rechter Sidebar (Kontrollkasten) unterhalb des Headers via Portal
- **Personal-Verwaltung** mit Tab-Navigation für Stammpersonal, Azubis und Ärzte
- **Drag-and-Drop-Sortierung** für alle Personalkategorien
- **Qualifikationsverwaltung** direkt beim Erstellen von Personen
- **Excel Import/Export** für Dienstplandaten mit intelligenter Konfliktlösung
- **Einstellungsmenü** mit umfangreichen Konfigurationsmöglichkeiten
- **Schichtübernahme-Feature** zur gezielten Verteilung von Zusatzschichten mit automatischer SOLL-Anpassung
- **Erweitertes Kommentar-System** für persönliche und globale Notizen im Dienstplan (Beta)

### Azubi-Zeiträume-Management (v1.0+)
- **Zeitraum-basierte Sichtbarkeit**: Azubis werden nur in ihren aktiven Zeiträumen im Dienstplan angezeigt
- **Integrierte Verwaltung** im Personal-Tab mit Modal-Dialog
- **Flexible Zeiträume**: Start-/Enddatum mit optionaler Beschreibung (z.B. "2. Lehrjahr")
- **Automatische Filterung**: Dienstplan zeigt nur aktive Azubis basierend auf dem aktuellen Monat
- **Rückwärtskompatibilität**: Azubis ohne definierte Zeiträume bleiben immer sichtbar

### Authentifizierung & Rechteverwaltung (v1.0+)
- **Login-System**: Personalisierter Zugang über Personalnummer
- **Rollenbasierte Berechtigungen**: Granulare Zugriffsrechte (none/read/write) für verschiedene Bereiche:
  - Einteilung (Dienstplan-Bearbeitung)
  - Dienstplan-Ansicht
  - Werte & Fahrzeuge
  - Personal-Verwaltung
  - Einstellungen
- **AuthContext & Session-Management**: React Context für konsistente Authentifizierung über alle Komponenten
- **Dev-Mode**: Automatischer Admin-Login für Entwicklung und Testing
- **Permission Guards**: Automatische UI-Anpassung basierend auf Benutzerrechten
- **Sichere IPC-Kommunikation**: Electron preload mit authentifizierten API-Calls

### Erweiterte Import-Funktionen
- **Schutz manueller Bearbeitungen**: Bereits geänderte Einträge werden durch blaue Markierung geschützt
- **Automatische Erkennung**: Neue Azubis und Dienstarten werden automatisch erkannt
- **Dialog-basierte Erstellung**: Unbekannte Azubis und Dienstarten können per Dialog direkt während des Imports angelegt werden
- **Jahresspezifische Vorplanung**: Import-Pfad wird über gesamten Import-Flow (inkl. Retry-Dialoge) korrekt beibehalten
  - **Azubi-Dialog**: Konfiguration von Name, Vorname und Lehrjahr
  - **Dienstarten-Dialog**: Festlegung von Beschreibung, Farbe und Auswertungstyp
- **Intelligente Namensauflösung**: Flexible Zuordnung von Excel-Namen zu bestehenden Personen/Azubis
- **Jahres- vs. Monatsimport**: Beide Modi unterstützen vollständige Dialog-Workflows für unbekannte Entitäten
- **Automatischer Retry**: Nach Erstellung neuer Entitäten wird der Import automatisch fortgesetzt

### Kontrollkasten & Statistiken
- **Konsistente Kennzahlen** je Ansicht (RTW/NEF und ITW):
	- Soll | Ist (Monat, Hamilton-Verteilung)
	- NEF- und ITW-Anteile (Monat)
	- Jahres-Rest (Ziel − gefahren)
	- Tag/Nacht-Balken mit Ziffern direkt im Segment (globale Jahreswerte)
	- Restschichten-Balken (80 px) mit intelligenter Ampel-Färbung
- **Person-Highlighting**: Klick auf Namen im Kontrollkasten hebt Person in der Einteilung hervor
	- Dezente Farbcodierung: Rot für Tag-Schichten, Blau für Nacht-Schichten
	- Toggle-Funktion: Erneuter Klick entfernt Hervorhebung
- **Verfügbarkeits-Highlighting**: Durch einen einfachen Klick auf eine Datumskopfzeile (z.B. den 5.) im Hauptdienstplan markiert der Kontrollkasten sofort alle Kollegen in Grün, die an diesem Tag zwar Dienst haben, aber noch auf keinen konkreten Wagen zugewiesen sind.
- **Cross-Tab-Hervorhebung**: Tabs zeigen automatisch an, wenn hervorgehobene Person Einteilungen im anderen Bereich hat
	- RTW/NEF-Tab: Dezente rote Hinterlegung bei ITW-Einteilungen
	- ITW-Tab: Dezente gelbe Hinterlegung bei RTW/NEF-Einteilungen
	- Verbessert Navigation zwischen verschiedenen Dienstbereichen
- **Abteilungsfilter**: In der RTW/NEF-Ansicht werden nur Tage der eingestellten Abteilung angezeigt
- **Fahrzeug- und Musterverwaltung** (RTW/NEF/ITW) mit monatlicher Aktivierung und strikter Validierung von Einsatzzeiträumen
- **Feiertagsverwaltung** mit automatischer Berechnung für Niedersachsen
- **Wertetabelle & Soll/Ist-Berechnung**: Einheitliche Hamilton-Verteilung, transparente Berechnungsschritte und detailgetreue Erfassung aller Netto-Schichten
- **Datenbank- & Berechnungs-Validierung**: Integriertes Validierungs-Skript (`npm run validate`) zur automatisierten Konsistenzprüfung direkt gegen die Datenbank

### Technische Basis
- Electron + React + TypeScript + Vite
- SQLite-Datenbank mit automatischen Migrationen
- Responsive Design mit CSS Modules

## Projektstruktur

```
rd-plan/
├── main/
│   ├── main.ts              # Electron-Hauptprozess
│   ├── database.ts          # SQLite-Datenbankoperationen
│   ├── database-manager.ts  # Datenbank-Abstraktionsschicht
│   ├── auth-service.ts      # Authentifizierungs- & Rechteverwaltung
│   └── roster-importer.ts   # Excel-Import-Engine mit Konfliktlösung
├── renderer/
│   ├── components/
│   │   ├── Header.tsx       # Anwendungs-Header
│   │   ├── MonthTabs.tsx    # Monatsnavigation mit Dienstplan
│   │   ├── DutyRoster.tsx   # Hauptdienstplan-Komponente
│   │   ├── PersonnelOverview.tsx # Personal-Verwaltung mit Azubi-Zeiträumen
│   │   ├── SettingsMenu.tsx # Umfassendes Einstellungsmenü
│   │   ├── ValuesPage.tsx   # Fahrzeug- und Musterverwaltung
│   │   └── EinteilungPage.tsx # Kontrollkasten-Logik
│   ├── contexts/
│   │   └── AuthContext.tsx  # React Context für Authentifizierung
│   ├── login.tsx            # Login-Seite mit Personalnummer-Authentifizierung
│   ├── editAzubi.tsx        # Azubi-Editor mit Zeiträume-Management
│   ├── addAzubi.tsx         # Azubi-Hinzufügen-Dialog
│   └── (weitere UI-Komponenten)
├── preload.ts               # Sichere Electron-IPC-Bridge mit Auth-APIs
├── package.json             # Abhängigkeiten und Scripts
├── tsconfig.json            # TypeScript-Konfiguration
├── vite.config.ts           # Vite-Build-Konfiguration
└── .github/workflows/       # CI/CD für automatische Builds
```

### Kernkomponenten
- **auth-service.ts**: Authentifizierungs-Service mit Session-Management und Permission-Checks
- **AuthContext.tsx**: React Context Provider für applikationsweite Authentifizierung
- **database-manager.ts**: Abstraktionsschicht für verschiedene DB-Modi (lokal/zentral)
- **roster-importer.ts**: Intelligente Excel-Import-Engine mit Konfliktbehandlung
- **PersonnelOverview.tsx**: Zentrale Personal-Verwaltung mit integrierter Zeiträume-Funktion
- **DutyRoster.tsx**: Hauptdienstplan mit Azubi-Filterung und Import-Dialogen
- **login.tsx**: Benutzerfreundliche Login-Oberfläche mit Personalnummer-Eingabe

## Installation / Verteilung

Die Anwendung ist als portable Windows‑Executable verfügbar und benötigt in der Regel keine Installation auf Zielrechnern. Aktuell stellt die CI ausschließlich ein Windows‑Portable‑Artefakt (EXE) bereit.

- Plattformen: Portable builds werden derzeit nur für Windows erzeugt.
- Installation: Nicht erforderlich — lade die EXE aus den Releases und führe sie aus.

Hinweis für Administratoren: Wenn du die Anwendung paketieren oder für andere Plattformen bereitstellen möchtest, findest du die Build‑Konfiguration in `.github/workflows/build-windows.yml`.

## Entwicklungsstatus

**Version 1.3.0** - Aktive Entwicklung (Stable Release Candidate)

Die Anwendung befindet sich in fortgeschrittener Entwicklung mit einem umfangreichen Feature-Set. Die aktuelle Version **1.3.0** führt die völlig automatisierte Azubi-Planung und weitere Erleichterungen für Disponenten ein.

**Produktionstauglichkeit**: Die Anwendung wird bereits in mehreren Rettungswachen erfolgreich eingesetzt. Für kritische Umgebungen wird empfohlen, die Funktionen vorab zu testen und regelmäßige Datensicherungen durchzuführen.

**Neue Features in v1.3.0**:
- ✅ **Automatische Azubi-Einteilung**: Bulk-Zuweisung nach Lehrjahren (Platz 2 / 3) inkl. Ausweichplätzen auf einem Knopfdruck.
- ✅ **Interaktiver Ausweich-Dialog**: Manuelle Konfliktbehebung, wenn ein Diensttag staufällig wird.
- ✅ **Datumsklick-Verfügbarkeit**: Klicken einer Spalte zeigt im Kontrollkasten direkt verfügbare und noch unverplante Ressourcen in Hellgrün an.

**Neue Features in v1.0.8 RC**:
- ✅ **Kommentar-Dialoge im Dienstplan**: Hinzufügen/Bearbeiten/Löschen ohne Browser-`prompt()`, robust in Electron-Umgebungen
- ✅ **Kommentar-Badge in der Einteilung**: Roter iOS-ähnlicher Zählerpunkt mit Anzahl der Kommentare pro Tag (`99+`)
- ✅ **Vereinfachter Jahresimport (Einstellungen)**: Fokus auf Jahr + Importbutton, Backup-Erstellung automatisch vor Import
- ✅ **Aufgeräumte Import-Aktionen in Settings**: Entfernte nicht mehr benötigte Schnellaktionen (Import/Export, Vorschau, Backup-Wiederherstellung)
- ✅ **Import/Export-Integrität Personal**: Qualifikations- und Aktivitätszeiträume bleiben beim Roundtrip erhalten
- ✅ **Robustes Azubi-Periodenhandling**: Kein `NULL end_date` nach Import
- ✅ **Schichtübernahme (Shift Transfer)**: Gezielte Übertragung von SOLL-Schichten zwischen Kollegen
- ✅ **Monats-basierte Logik**: Einfache Verwaltung pro Monat (YYYY-MM)
- ✅ **Performance-Optimierung**: Gecachte Berechnungen via `useMemo` für maximale Responsivität
- ✅ **Automatisierte Migration**: Nahtloses Datenbank-Upgrade bei Versionswechsel
- ✅ **Persistenz-Garantie**: Korrektes Speichern und Laden der Feature-Einstellungen
- ✅ **Ganzzahlige Soll-Verteilung**: Implementierung des Hamilton-Verfahrens für faire Schichtverteilung
- ✅ **Authentifizierungs-System**: Login mit Personalnummer und rollenbasierter Zugriffskontrolle
- ✅ Tab-Navigation in der Personal-Verwaltung (Stammpersonal/Azubis/Ärzte)
- ✅ Qualifikationsmanagement beim Erstellen von Personen
- ✅ Modernisierte Add-Dialoge mit Validierung
- ✅ Vollständiges Azubi-Zeiträume-Management
- ✅ Schutz manueller Bearbeitungen beim Import
- ✅ Automatische Erkennung neuer Azubis und Dienstarten mit Dialog-Unterstützung
- ✅ Dialog-basierte Anlage unbekannter Entitäten (Azubis & Dienstarten) während Import
- ✅ Erweiterte Benutzeroberfläche mit konsistentem Design
- ✅ Jahresimport mit vollständiger Azubi- und Dienstarten-Erkennung
- ✅ Intelligente Namensauflösung mit Konfliktbehandlung
- ✅ Person-Highlighting mit Tag/Nacht-Farbcodierung
- ✅ Cross-Tab-Hervorhebung für verbesserte Navigation zwischen RTW/NEF und ITW


**In Vorbereitung**:
- 🔄 **Makros**: Wiederkehrende Dienstplan-Einträge automatisieren (Issue #23)

## Verwendung

### Produktive Nutzung
Starte die portable EXE direkt (Windows):

```bash
./RD-Plan-1.0.8-RC.exe
```

### Erste Schritte
1. **Login**: Melde dich mit deiner Personalnummer an (im Dev-Mode automatisch eingeloggt)
2. **Personal-Verwaltung**: Gehe zum Personal-Tab, um Stammpersonal, Azubis und ITW-Ärzte zu verwalten
3. **Azubi-Zeiträume**: Wähle einen Azubi aus und klicke "Zeiträume verwalten" um Aktivitätszeiträume zu definieren
4. **Dienstplan**: Nutze die Monats-Tabs zur Navigation und Einteilung der Schichten
5. **Import**: Verwende "Excel Import/Export" für Datenübernahme aus bestehenden Systemen
6. **Einstellungen**: Konfiguriere Fahrzeuge, Dienstarten, Rollen & Berechtigungen und weitere Parameter

### Entwicklung
Für Entwicklung oder lokale Ausführung:

```bash
npm install
npm run build
npm run start
```

### Datenbank
Die SQLite-Datenbank wird automatisch erstellt unter:
- Windows: `%USERPROFILE%\Documents\RD-Plan_DB\rd-plan.db`
- Portable: Im `DB/` Verzeichnis neben der EXE (falls schreibbar)

## Azubi-Zeiträume-Management

Das **Zeiträume-System** ermöglicht es, Azubis nur in bestimmten Zeitperioden im Dienstplan anzuzeigen. Dies ist besonders nützlich für:

- **Lehrjahr-Wechsel**: Azubis automatisch ein-/ausblenden basierend auf Ausbildungszeiträumen
- **Praktika**: Temporäre Anwesenheit von Praktikanten verwalten
- **Rotationen**: Azubis die zwischen verschiedenen Abteilungen wechseln
- **Urlaub/Krankheit**: Längere Abwesenheiten berücksichtigen

### Funktionsweise
1. **Zeiträume definieren**: Im Personal-Tab einen Azubi auswählen und "Zeiträume verwalten" klicken
2. **Start-/Enddatum**: Zeitraum mit optionaler Beschreibung hinzufügen
3. **Automatische Filterung**: Azubi erscheint nur in den definierten Zeiträumen im Dienstplan
4. **Mehrere Zeiträume**: Pro Azubi können mehrere, auch überlappende Zeiträume definiert werden

**Beispiel**: Ein Azubi im 2. Lehrjahr vom 01.09.2024 bis 31.08.2025 wird nur in diesem Zeitraum im Dienstplan angezeigt.

## Excel Import mit Datenschutz

Das **erweiterte Import-System** bietet umfassenden Schutz vor Datenverlust und nahtlose Integration neuer Daten:

### Schutz manueller Bearbeitungen
- **Blaue Markierungen**: Manuell geänderte Dienstplan-Einträge werden visuell gekennzeichnet
- **Import-Schutz**: Geschützte Einträge werden beim Import automatisch übersprungen
- **Selektiver Import**: Nur unveränderte Felder werden überschrieben

### Intelligente Erkennung & Dialog-Workflows
- **Neue Azubis**: Unbekannte Namen werden erkannt und können per interaktivem Dialog als neue Azubis angelegt werden
  - Automatische Aufteilung von "Nachname, Vorname"
  - Konfiguration von Lehrjahr (1-4)
  - Sofortiges Retry nach Erstellung
- **Neue Dienstarten**: Automatische Erkennung und Dialog-basierte Erstellung unbekannter Shift-Typen
  - Festlegung von Beschreibung, Farbe und Auswertung
  - Unterstützt: Tagdienst, Nachtdienst, 24h-Dienst, ITW-Dienst, oder "Nicht zählen"
- **Flexible Namensauflösung**: Tolerante Zuordnung von Excel-Namen zu bestehenden Personen
- **Batch-Erstellung**: Mehrere neue Entitäten können in einem Durchgang konfiguriert werden

### Import-Modi
- **Jahresimport**: Vollständiger Import mit Dialog-Unterstützung für Azubis und Dienstarten
- **Monatsimport**: Inklusive Azubi-Synchronisation mit Zeiträume-Berücksichtigung
- **Konfliktlösung**: Interaktive Dialoge bei Unklarheiten oder neuen Entitäten
- **Intelligenter Retry**: Import wird automatisch mit neu erstellten Entitäten fortgesetzt

## Einteilung & Kontrollkasten

- **Rechte Sidebar** (Kontrollkasten) wird mittels React-Portal unterhalb des Headers gerendert und bleibt sticky
- **Tag/Nacht-Anzeige** als geteilter Balken (links Nacht blau, rechts Tag orange) mit Ziffern in den Segmenten
- **Restschichten-Balken** (80 px breit) zeigt verbleibende Anwesenheitsschichten mit Ampel-Färbung:
	- 🔴 Rot: Verbleibende Anwesenheit < verbleibendes Jahres-Soll
	- 🟡 Gelb: Positiver Puffer ≤ 20% des verbleibenden Solls
	- 🟢 Grün: Puffer > 20% des verbleibenden Solls
- **Abteilungsfilter**: In RTW/NEF-Ansicht nur Tage der eingestellten Abteilung anzeigen
- **Schutz manueller Bearbeitungen**: Blaue Markierung für händisch geänderte Einträge

## Planungslogik (Schichtverteilung)

- Monats-Soll pro Person via Hamilton-Verteilung auf Basis gewichteter Präsenz:
	- Präsenz eines Monats: Anzahl Tage mit Auswertung != 'off'
	- HLF‑B wird mit Faktor 0,75 gewichtet (round(0,75 × Präsenz))
	- Hamilton (größtes Rest-Verfahren) verteilt die Monats-Positionen proportional zur gewichteten Präsenz
- Jahresziel (Gesamt-Soll): Summe der monatlichen Soll-Ziele über alle 12 Monate
- Gefahrene Jahreslast: Summe aller gewerteten Einsätze über das Jahr
	- RTW (FzF/Masch, pos 1/2): +1
	- ITW (pos 1/2): +1
	- NEF Assistenz: +2
- Jahres-Rest im Kontrollkasten: Jahresziel − gefahrene Jahreslast (zusätzlich farblich hinterlegt je nach Puffer)
- Tag/Nacht-Werte sind global über das Jahr gerechnet (nicht monatlich), damit sie in beiden Ansichten konsistent sind.

## Schichtübernahme (Shift Transfer)

Die Schichtübernahme ermöglicht es, SOLL-Schichten gezielt zwischen Mitarbeitern zu übertragen. Dies ist besonders nützlich für langfristige Absprachen oder die Verteilung von Zusatzkontingenten.

### Funktionsweise
1. **Zielgerichtet**: Ein Transfer hat immer einen Geber und einen Empfänger.
2. **Monats-basiert**: Die Übernahme gilt für einen spezifischen Monat (z.B. Februar 2026).
3. **SOLL-Anpassung**: Die Schichten werden dem SOLL des Empfängers für den gewählten Monat gutgeschrieben.
4. **Transparenz**: Im Kontrollkasten wird das angepasste SOLL hervorgehoben (z.B. `130 (120 + 10 übernommen)`).

### Technische Implementierung
- **Datenbank**: Tabelle `shift_transfers` speichert Transfers mit einem `YYYY-MM` Identifikator.
- **Berechnung**: Die `calculateSollWithTransfers` Logik integriert die Transfers nahtlos in die Hamilton-Verteilung der Grund-Soll-Werte.
- **Integrität**: Kaskadierendes Löschen stellt sicher, dass Transfers beim Löschen von Personen automatisch entfernt werden.
- **Migration**: Das System erkennt ältere Datumsformate und konvertiert diese automatisch in die neue monatsbasierte Struktur.

## Roadmap & Changelog

### Version 1.0.5 RC (Februar 2026) - Aktuell
- ✅ **Schichtübernahme-Feature**: Gezielte Verteilung von Zusatzschichten mit monatsbasierter Logik
- ✅ **Ganzzahlige Soll-Verteilung**: Hamilton-Verfahren zur gerechten Umverteilung von Restschichten
- ✅ **Persistenz-Fix**: Dauerhaftes Speichern der Feature-Einstellungen
- ✅ **Authentifizierungs-System**: Login-Seite mit Personalnummer-basierter Authentifizierung
- ✅ **AuthService**: Backend-Service für Session-Management und Permission-Checks
- ✅ **AuthContext**: React Context Provider für applikationsweite Authentifizierung
- ✅ **Rollenbasierte Berechtigungen**: Granulare Zugriffsrechte (none/read/write) für:
  - Einteilung (Dienstplan-Bearbeitung)
  - Dienstplan-Ansicht
  - Werte & Fahrzeuge
  - Personal-Verwaltung
  - Einstellungen
- ✅ **Permission Guards**: Automatische UI-Anpassung und Zugriffsbeschränkungen
- ✅ **Dev-Mode Support**: Automatischer Admin-Login für Entwicklung
- ✅ **Sichere IPC**: Erweiterte Electron preload APIs für Auth-Kommunikation
- ✅ **UI-Verbesserungen**: Login-Seite, Benutzer-Anzeige in Header, Logout-Funktion

### Version 1.5.3 (August 2026) - Aktuell
- ✅ **Kategorienbasierter Multi-Sheet Import/Export**: Vollständiger JSON & Excel (`.xlsx`) Import/Export für Personal und Fahrzeuge inklusive aller Unterzeiträume und Schicht-Positionen.
- ✅ **Bereinigte Datenstruktur**: Entfernung obsolet gewordener Qualifikations-Booleans und Dienstfähigkeits-Zeiträume; Fokus auf echte Qualifikationszeiträume und Abteilungszugehörigkeiten.
- ✅ **Duplikat-Konfliktbehandlung**: Interaktiver Dialog bei vorhandenen Einträgen beim Import mit Checkbox *"Auswahl für alle übernehmen"*.
- ✅ **Globale UI-Vereinheitlichung der Steuerungselemente**: Platzierung von Live-Suche, Hinzufügen-, Import-, Export- und Speichern-Schaltflächen in der fixierten Header-Leiste über den Tabs (Personal & Fahrzeuge).
- ✅ **ITW-Modul Redesign & Dynamischer Status**: Anpassung des ITW-Tab-Designs an den globalen Standard sowie dynamische Farbindikation (Grün bei vollständiger Einteilung, Rot bei fehlenden Ärzten inkl. visueller Tabellen-Hervorhebung).
- ✅ **Rollen- & Login-Fixes**: Behebung des SQLite-ID Speichers in Rollen und automatischer Redirect beim Login auf den jeweils berechtigten Funktionsbereich.

### Version 1.2.0 (März 2026)
- ✅ **Optimierte horizontale Navigation**: Migration der horizontalen Scrollbalken in ein fixiertes Footer-System (Dienstplan & Einteilung)
- ✅ **Zwei-Schichten-Footer-Architektur**: Ergonomische Platzierung der Scrollleiste mit Abstand zum Bildschirmrand für bessere Bedienbarkeit
- ✅ **Globale Layout-Synchronisation**: Dynamische Ausrichtung aller fixierten UI-Elemente an der Sidebar via CSS-Variablen
- ✅ **Strukturelle Trennlinien-Refinement**: Vereinheitlichung und präzise Ausrichtung aller horizontalen und vertikalen Teiler (Menu, Kontrollkasten, Fahrzeuge)
- ✅ **Layout-Stabilisierung**: Behebung von Sichtbarkeitslücken beim Scrollen und Fixierung des Seitenmenüs über die volle Fensterhöhe
- ✅ **Bereinigung Header/Footer**: Entfernung redundanter Trennlinien im Kontrollkasten und dynamisches Ausblenden des globalen Footers

### Version 1.0.8 RC (Februar 2026)
- ✅ **Kommentar-Dialog statt Browser-Prompt**: Stabiler Workflow für globale und individuelle Kommentare im Dienstplan
- ✅ **Kommentaranzeige in Einteilung**: Roter Badge mit Kommentaranzahl pro Tag (iOS-ähnlich)
- ✅ **Jahresimport vereinfacht**: In den Einstellungen nur noch Jahrsauswahl + Import, Backup wird immer erstellt
- ✅ **Settings-UI aufgeräumt**: Nicht mehr benötigte Import/Export-/Vorschau-/Restore-Schnellaktionen entfernt
- ✅ **Personal-Roundtrip stabilisiert**: `qualification_periods` und `personnel_active_periods` bleiben vollständig erhalten
- ✅ **Import-Mapping gehärtet**: Kollisionsfreie Header für Personal-Aktivitätsfelder inkl. Rückwärtskompatibilität

### Version 1.0.0 Build 494 (Dezember 2025)
- ✅ **Tab-Navigation Personal**: Übersichtliche Aufteilung in Stammpersonal, Azubis und Ärzte
- ✅ **Qualifikationsmanagement**: Direkte Verwaltung von Qualifikationen beim Erstellen von Personen
- ✅ **Modernisierte Add-Dialoge**: Konsistentes Design mit Validierung für addPerson und addAzubi
- ✅ **UI-Verbesserungen**: Blaue Tab-Akzente und smooth Transitions
- ✅ **Icon-Integration**: Vollständige macOS (.icns) und Windows (.ico) Icon-Unterstützung
- ✅ **CI/CD-Fixes**: Robuste GitHub Actions Workflows für macOS und Windows

### Version 2.0.0 Build 441 (11. Dezember 2025)
- ✅ **Azubi-Dialog für Jahresimport**: Unbekannte Azubis können nun auch beim Jahresimport per Dialog angelegt werden
- ✅ **Dienstarten-Dialog für Jahresimport**: Automatische Erkennung und Erstellung neuer Shift-Typen
- ✅ **Verbesserte Import-Engine**: `collectUnknownAzubiNames` unterstützt optionale Monatsfilterung
- ✅ **UI-Verbesserungen**: Konsistente Dialog-Workflows für Monats- und Jahresimport
- ✅ **Code-Konsolidierung**: Vereinheitlichte Verarbeitung des Azubi-Blocks

### Version 2.0.0 Build 435-439 (November 2025)
- ✅ **Azubi-Zeiträume-Management**: Vollständiges System zur Verwaltung von Azubi-Aktivitätszeiträumen
- ✅ **Erweiterte Import-Funktionen**: Schutz manueller Bearbeitungen, automatische Erkennung neuer Entitäten
- ✅ **Verbesserte UI**: Integrierte Zeiträume-Verwaltung im Personal-Tab
- ✅ **Datenschutz**: Blaue Markierungen für manuell bearbeitete Dienstplan-Einträge
- ✅ **Teilzeit-Support**: Excel-Export/-Import mit Teilzeit-Prozentangaben

### Geplante Features
- ✅ **Kommentar-System** (Issue #22): Persönliche und globale Kommentare für Dienstplan-Tage
  - Kontextmenü-Integration im Dienstplan-Grid
  - Dialog-basierte Erfassung/Bearbeitung
  - Visuelle Indikatoren inklusive Badge in der Einteilung
- ✅ **Schichtübernahme-Feature** (Issue #21): Gezielte Verteilung von Zusatzschichten
  - Übertragung von Schichten zwischen Kollegen pro Monat
  - Automatische SOLL-Anpassung für Übernehmer
  - Persistente Speicherung mit kaskadierender Integrität
  - UI-Integration im Kontrollkasten und Einstellungsbereich
- 🔄 **Multi-User Support**: Zentrale Datenbankunterstützung für Teamarbeit
- 🔄 **Makros**: Wiederkehrende Dienstplan-Einträge automatisieren
- 🔄 **Erweiterte Berichte**: PDF-Export und Statistiken
- 🔄 **Mobile Ansicht**: Responsive Design für Tablets

### Stabilität & Support
Die Anwendung wird kontinuierlich weiterentwickelt mit Fokus auf Stabilität und Benutzerfreundlichkeit. Regelmäßige Updates und Bugfixes werden über GitHub Releases bereitgestellt.

## Lizenz

Dieses Projekt ist lizenziert unter der GNU Affero General Public License v3.0 (AGPLv3).

Siehe die Datei `LICENSE` im Repository für den vollständigen Lizenztext.

SPDX-Identifier: AGPL-3.0-or-later
