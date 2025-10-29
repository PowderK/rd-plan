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
│   │   │   ├── PersonnelList.tsx   # Komponente für Personalübersicht
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

## Installation

1. Klone das Repository:
   ```
   git clone <repository-url>
   ```
2. Navigiere in das Projektverzeichnis:
   ```
   cd rd-plan
   ```
3. Installiere die Abhängigkeiten:
   ```
   npm install
   ```

## Verwendung

Um die Anwendung zu starten, führe den folgenden Befehl aus:
```
npm start
```

## Lizenz

Dieses Projekt ist unter der MIT-Lizenz lizenziert.