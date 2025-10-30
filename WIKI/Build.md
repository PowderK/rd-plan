# Build (lokal)

Schritte um das Projekt lokal zu bauen:

1. Dependencies installieren

```bash
npm install
```

2. TypeScript + Renderer bauen

```bash
npm run build
```

Das Skript führt aus: `rm -rf dist && npm run bump-build && npm run build:main && npm run build:renderer`.

Hinweis: Wenn TypeScript einen Fehler wegen fehlenden Node‑Typen wirft (TS2688), installiere die Typen:

```bash
npm install --save-dev @types/node
```

Native Addons (better-sqlite3)

- Native Module wie `better-sqlite3` müssen für die Electron‑ABI kompiliert werden. Falls du einen ABI‑Mismatch siehst (`NODE_MODULE_VERSION` mismatch), nutze:

```bash
npx electron-rebuild -f -w better-sqlite3
```

oder baue manuell gegen die Electron‑Header / downgrades auf eine kompatible Electron‑Version (z. B. `electron@28.3.3`) wie im Projektverlauf geschehen.

3. Artefakte

Die gebauten Renderer/Assets landen in `dist/renderer`. Packaging (Windows exe) erfolgt via `npm run dist` in der CI (electron-builder).
