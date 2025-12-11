# RD-Plan

<div align="center">
  <img src="media/Timeline 1_01_00_05_29.png" alt="RD-Plan Logo" width="400"/>
</div>

RD-Plan ist eine Electron-Anwendung zur Planung von Rettungswagenschichten. Die Anwendung ermöglicht es Benutzern, Schichten zu verwalten, Personal zu organisieren und die Planung für verschiedene Monate zu visualisieren.

## Funktionen

### Kernfunktionen
- **Monats-Tabs** zur Navigation und Einteilung pro Monat
- **Dienstplan-Verwaltung** mit rechter Sidebar (Kontrollkasten) unterhalb des Headers via Portal
- **Personal-, Azubi- und ITW-Verwaltung** mit drag-and-drop Sortierung
- **Excel Import/Export** für Dienstplandaten mit intelligenter Konfliktlösung
- **Einstellungsmenü** mit umfangreichen Konfigurationsmöglichkeiten

### Azubi-Zeiträume-Management (v2.0+)
- **Zeitraum-basierte Sichtbarkeit**: Azubis werden nur in ihren aktiven Zeiträumen im Dienstplan angezeigt
- **Integrierte Verwaltung** im Personal-Tab mit Modal-Dialog
- **Flexible Zeiträume**: Start-/Enddatum mit optionaler Beschreibung (z.B. "2. Lehrjahr")
- **Automatische Filterung**: Dienstplan zeigt nur aktive Azubis basierend auf dem aktuellen Monat
- **Rückwärtskompatibilität**: Azubis ohne definierte Zeiträume bleiben immer sichtbar

### Erweiterte Import-Funktionen
- **Schutz manueller Bearbeitungen**: Bereits geänderte Einträge werden durch blaue Markierung geschützt
- **Automatische Erkennung**: Neue Azubis und Dienstarten werden automatisch erkannt
- **Dialog-basierte Erstellung**: Unbekannte Azubis und Dienstarten können per Dialog direkt während des Imports angelegt werden
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
- **Abteilungsfilter**: In der RTW/NEF-Ansicht werden nur Tage der eingestellten Abteilung angezeigt
- **Fahrzeug- und Musterverwaltung** (RTW/NEF/ITW) mit monatlicher Aktivierung
- **Feiertagsverwaltung** mit automatischer Berechnung für Niedersachsen

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
│   ├── editAzubi.tsx        # Azubi-Editor mit Zeiträume-Management
│   ├── addAzubi.tsx         # Azubi-Hinzufügen-Dialog
│   └── (weitere UI-Komponenten)
├── preload.ts               # Sichere Electron-IPC-Bridge
├── package.json             # Abhängigkeiten und Scripts
├── tsconfig.json            # TypeScript-Konfiguration
├── vite.config.ts           # Vite-Build-Konfiguration
└── .github/workflows/       # CI/CD für automatische Builds
```

### Kernkomponenten
- **database-manager.ts**: Abstraktionsschicht für verschiedene DB-Modi (lokal/zentral)
- **roster-importer.ts**: Intelligente Excel-Import-Engine mit Konfliktbehandlung
- **PersonnelOverview.tsx**: Zentrale Personal-Verwaltung mit integrierter Zeiträume-Funktion
- **DutyRoster.tsx**: Hauptdienstplan mit Azubi-Filterung und Import-Dialogen

## Installation / Verteilung

Die Anwendung ist als portable Windows‑Executable verfügbar und benötigt in der Regel keine Installation auf Zielrechnern. Aktuell stellt die CI ausschließlich ein Windows‑Portable‑Artefakt (EXE) bereit.

- Plattformen: Portable builds werden derzeit nur für Windows erzeugt.
- Installation: Nicht erforderlich — lade die EXE aus den Releases und führe sie aus.

Hinweis für Administratoren: Wenn du die Anwendung paketieren oder für andere Plattformen bereitstellen möchtest, findest du die Build‑Konfiguration in `.github/workflows/build-windows.yml`.

## Entwicklungsstatus

**Version 2.0.0 (Build 441)** - Aktive Entwicklung

Die Anwendung befindet sich in fortgeschrittener Entwicklung mit einem umfangreichen Feature-Set. Die aktuelle Version 2.0.0 führt das **Azubi-Zeiträume-Management-System** ein und bietet erweiterte Import-Funktionen mit Datenschutz.

**Produktionstauglichkeit**: Die Anwendung wird bereits in mehreren Rettungswachen erfolgreich eingesetzt. Für kritische Umgebungen wird empfohlen, die Funktionen vorab zu testen und regelmäßige Datensicherungen durchzuführen.

**Neue Features in v2.0.0 (Build 441)**:
- ✅ Vollständiges Azubi-Zeiträume-Management
- ✅ Schutz manueller Bearbeitungen beim Import
- ✅ Automatische Erkennung neuer Azubis und Dienstarten mit Dialog-Unterstützung
- ✅ Dialog-basierte Anlage unbekannter Entitäten (Azubis & Dienstarten) während Import
- ✅ Erweiterte Benutzeroberfläche im Personal-Tab
- ✅ Jahresimport mit vollständiger Azubi- und Dienstarten-Erkennung
- ✅ Intelligente Namensauflösung mit Konfliktbehandlung

## Verwendung

### Produktive Nutzung
Starte die portable EXE direkt (Windows):

```bash
./RD-Plan-2.0.0.exe
```

### Erste Schritte
1. **Personal-Verwaltung**: Gehe zum Personal-Tab, um Stammpersonal, Azubis und ITW-Ärzte zu verwalten
2. **Azubi-Zeiträume**: Wähle einen Azubi aus und klicke "Zeiträume verwalten" um Aktivitätszeiträume zu definieren
3. **Dienstplan**: Nutze die Monats-Tabs zur Navigation und Einteilung der Schichten
4. **Import**: Verwende "Excel Import/Export" für Datenübernahme aus bestehenden Systemen
5. **Einstellungen**: Konfiguriere Fahrzeuge, Dienstarten und weitere Parameter

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

## Roadmap & Changelog

### Version 2.0.0 Build 441 (11. Dezember 2025) - Aktuell
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
