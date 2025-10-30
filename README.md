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

## Lizenz

Lizenz: (wird aktualisiert)

Hinweis: Du hast angegeben, dass eine neue Lizenz verwendet werden soll — bitte nenne mir die gewünschte Lizenz (z. B. MIT, Apache-2.0, GPL-3.0) und ich passe die `README.md` und ggf. die `LICENSE`-Datei entsprechend an.