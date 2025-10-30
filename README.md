# RD-Plan

RD-Plan ist eine Electron-Anwendung zur Planung von Rettungswagenschichten. Die Anwendung ermöglicht es Benutzern, Schichten zu verwalten, Personal zu organisieren und die Planung für verschiedene Monate zu visualisieren.

## Funktionen

- Anzeige des aktuellen Monats und der Rettungswache
- Zweigeteilte Ansicht für die Einteilung und das Personal
- Monatliche Tabs zur Navigation zwischen den Schichten
- Einstellungsmenü zur Anpassung der Anwendung
- SQLite-Datenbank zur Speicherung von Schicht- und Personaldaten

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

## Planungslogik (Schichtverteilung)

Die Schichtverteilung in RD-Plan versucht, Schichten gleichmäßig auf das verfügbare Personal zu verteilen. Wichtige Punkte:

- Nur Schichten fließen in die Berechnung ein, bei denen die jeweilige Person tatsächlich für den Rettungsdienst verfügbar ist. Abwesenheiten oder eingeschränkte Verfügbarkeit (z. B. Kantinenzeiten, Fortbildungen, Urlaub) werden nicht als zu verteilende Schichten gezählt.
- Die Berechnung betrachtet für jede Person nur die Schichten, die als "verfügbar für Rettungsdienst" markiert sind. Dadurch lässt sich die Verteilung korrekt auf Teams anwenden, in denen Kolleginnen und Kollegen zusätzliche Aufgaben haben (z. B. gleichzeitig Dienst im Löschzug bei Freiwilligen Feuerwehren oder 24‑h‑Dienste).
- Ziel ist eine faire, gleichmäßige Lastverteilung unter Berücksichtigung von Verfügbarkeiten — nicht die Planung von Fortbildungen, Pausen oder sonstigen außerbetrieblichen Aktivitäten.

Hinweis: Die konkrete Markierung "verfügbar / nicht verfügbar" für einzelne Schichten hängt von der UI-Eingabe ab (z. B. Abwesenheitskennzeichnung). Wenn du spezielle Regeln (z. B. Gewichtung bestimmter Dienste) benötigst, können wir die Logik erweitern.

## Entwicklungsstatus

Die Anwendung befindet sich noch in aktiver Entwicklung. Der Funktionsumfang ist noch nicht vollständig getestet, und es können sich APIs, die Datenbankstruktur oder das Verhalten zwischen Versionen ändern.

Wichtiger Hinweis: Diese Software ist derzeit nicht für den produktiven / Realbetrieb vorgesehen. Verwende sie in produktiven Umgebungen nur mit Vorsicht und nach eigener Prüfung. Für Einsätze in kritischen Umgebungen sind zusätzliche Tests, Sicherheitsprüfungen und organisatorische Maßnahmen erforderlich.

## Lizenz

Dieses Projekt ist lizenziert unter der GNU Affero General Public License v3.0 (AGPLv3).

Siehe die Datei `LICENSE` im Repository für den vollständigen Lizenztext.

SPDX-Identifier: AGPL-3.0-or-later