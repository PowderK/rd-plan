# RD-Plan Beta-Kopie

Dies ist eine isolierte Beta-Kopie des Projekts, getrennt von der Entwicklung.

- Ordner: `rd-plan-beta`
- Ausgeschlossen: `.git`, `node_modules`, `dist`
- Bauen:
  - `npm ci`
  - `npm run build`
- Starten (Development Runtime):
  - `npm run start`

Hinweise:
- Das Build-Skript in dieser Kopie führt kein `bump-build` aus (kein Git erforderlich).
- Für einen signierten macOS-Release verwende bitte die Original-Repo-Umgebung und `npm run dist`.
