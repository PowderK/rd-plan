# Run / Start

Lokales Starten der App (Electron):

```bash
npm run start
```

Was zu beachten ist:

- Beim ersten Start kann `better-sqlite3` aufgrund eines ABI‑Mismatches fehlschlagen. Lösung: rebuild (siehe Build.md) oder verwende die im Repo getestete Electron‑Version.
- Logs: Die App schreibt Logs in die Konsole des Terminal, z. B. `[DatabaseManager] SQLite schema initialized`.

Dev Mode

```bash
npm run dev
```

Im Dev‑Mode wird Electron mit `--dev` gestartet (öffentlicht DevTools). Beachte, dass HMR/Dev-Server `unsafe-eval` verwenden kann. Unsere CSP‑Policy ist in Produktion strikt (kein `unsafe-eval`).
