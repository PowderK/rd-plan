# RD-Plan

RD-Plan ist eine Electron-Anwendung zur Planung von Rettungswagenschichten. Die Anwendung ermöglicht es Benutzern, Schichten zu verwalten, Personal zu organisieren und die Planung für verschiedene Monate zu visualisieren.

## Funktionen

- Monats-Tabs zur Navigation und Einteilung pro Monat
- Einteilung mit rechter Sidebar (Kontrollkasten) unterhalb des Headers via Portal
- Kontrollkasten je Ansicht (RTW/NEF und ITW) mit konsistenten Kennzahlen:
	- Soll | Ist (Monat, Hamilton-Verteilung)
	- NEF- und ITW-Anteile (Monat)
	- Jahres-Rest (Ziel − gefahren)
	- Tag/Nacht-Balken mit Ziffern direkt im Segment (globale Jahreswerte)
	- Restschichten-Balken (80 px) mit intelligenter Ampel-Färbung
- Filter der Tage nach Abteilung: In der RTW/NEF-Ansicht werden nur Tage der eingestellten Abteilung angezeigt
- Einstellungsmenü, Fahrzeug- und Musterverwaltung (RTW/NEF/ITW), Feiertage
- Electron + React + TypeScript + Vite

## Projektstruktur

```
rd-plan
├── src
│   ├── main
│   │   ├── main.ts          # Einstiegspunkt der Electron-Anwendung
│   │   └── database.ts      # Logik zur Verwaltung der SQLite-Datenbank
│   ├── renderer
│   │   ├── components
│   │   │   ├── Header.tsx   # Komponente für Header
│   │   │   ├── Footer.tsx   # Komponente für Footer
│   │   │   ├── Body.tsx     # Hauptinhalt der App
│   │   │   ├── ShiftAssignment.tsx # Komponente für Schichtzuweisung
│   │   │   ├── (entfernt) PersonnelList.tsx   # Platzhalter-Komponente entfernt
│   │   │   ├── MonthTabs.tsx # Komponente für Monatstabs
│   │   │   └── SettingsMenu.tsx # Komponente für Einstellungsmenü
│   │   ├── App.tsx          # Hauptbestandteil der Benutzeroberfläche
│   │   └── types
│   │       └── index.ts     # Typdefinitionen und Schnittstellen
│   └── preload.ts           # Sicherer Zugriff auf die Hauptprozess-API
├── public
│   └── index.html           # Haupt-HTML-Datei
├── package.json             # Konfigurationsdatei für npm
├── tsconfig.json            # TypeScript-Konfigurationsdatei
└── README.md                # Dokumentation für das Projekt
```

## Installation / Verteilung

Die Anwendung ist als portable Windows‑Executable verfügbar und benötigt in der Regel keine Installation auf Zielrechnern. Aktuell stellt die CI ausschließlich ein Windows‑Portable‑Artefakt (EXE) bereit.

- Plattformen: Portable builds werden derzeit nur für Windows erzeugt.
- Installation: Nicht erforderlich — lade die EXE aus den Releases und führe sie aus.

Hinweis für Administratoren: Wenn du die Anwendung paketieren oder für andere Plattformen bereitstellen möchtest, findest du die Build‑Konfiguration in `.github/workflows/build-windows.yml`.

## Entwicklungsstatus

Diese Anwendung befindet sich noch in aktiver Entwicklung. Sie ist eine Vorabversion und derzeit nicht für den produktiven Echtbetrieb empfohlen. Bitte setze die App in kritischen betrieblichen Umgebungen nur mit Vorsicht ein und teste sie vorher ausgiebig.

## Verwendung

Starte die portable EXE direkt (Windows):

```bash
./RD-Plan 1.0.0.exe
```

Für Entwicklung oder lokale Ausführung (Developer):

```bash
npm install
npm run build
npm run start
```

## Einteilung & Kontrollkasten

- Rechte Sidebar (Kontrollkasten) wird mittels React-Portal unterhalb des Headers gerendert und bleibt sticky.
- Tag/Nacht-Anzeige als geteilter Balken (links Nacht blau, rechts Tag orange) mit Ziffern in den Segmenten (Einblendung ab ~18 px Segmentbreite).
- Restschichten-Balken (80 px breit) zeigt die verbleibenden Anwesenheitsschichten im restlichen Jahr abzüglich bereits eingeteilter Schichten. Ampel-Färbung:
	- Rot, wenn verbleibende Anwesenheit < verbleibendes Jahres-Soll
	- Gelb, wenn der positive Puffer ≤ 20% des verbleibenden Solls ist
	- Grün, wenn der Puffer > 20% des verbleibenden Solls ist
- In der RTW/NEF-Ansicht werden nur die Tage angezeigt, die zur aktuell eingestellten Abteilung gehören.

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

## Entwicklungsstatus

Die Anwendung befindet sich in aktiver Entwicklung. Der Funktionsumfang wird laufend erweitert (z. B. jüngst: vereinheitlichte Jahres‑Soll‑Berechnung, globale Tag/Nacht‑Werte, Restbalken mit Ampellogik, Abteilungs‑Filterung der Tage).
Wichtiger Hinweis: Nutzung im Produktivbetrieb nur nach eigener Prüfung. Für kritische Umgebungen sind zusätzliche Tests/Sicherheitsprüfungen erforderlich.

## Lizenz

Dieses Projekt ist lizenziert unter der GNU Affero General Public License v3.0 (AGPLv3).

Siehe die Datei `LICENSE` im Repository für den vollständigen Lizenztext.

SPDX-Identifier: AGPL-3.0-or-later
