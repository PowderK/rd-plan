# Bugfix: Startup-Probleme auf Windows

## Status
- **Splashscreen:** Wiederhergestellt (Robust, Version injected)
- **Logging:** Implementiert (`%APPDATA%\RD-Plan\rd-plan-debug.log`)
- **Native Abhängigkeiten:** Fixiert (Cross-Compilation für Windows)

## Problem 1: Splashscreen (Behoben & Wiederhergestellt)
Der Splashscreen sorgte ursprünglich für eine Dauerschleife.
**Lösung:**
1. Initial entfernt, um den Fehler zu isolieren.
2. Wiederhergestellt mit verbesserter Logik:
   - Timeout-basiertes Schließen (Fallback)
   - Version-Injection aus `version.json`
   - `closeSplashAndShowMain` Funktion verhindert Race-Conditions.

## Problem 2: Native Abhängigkeiten (Behoben)
Die Anwendung stürzte ab mit Fehler `...tmp.node ist keine zulässige Win32-Anwendung`.
**Ursache:** Es wurde die Mac-Version der Datenbank-Engine (`better-sqlite3`) in das Windows-Paket gepackt.
**Lösung:** 
- `scripts.install:win` in `package.json` hinzugefügt, um Windows-Binaries zu laden.
- `asarUnpack` konfiguriert, um `node_modules` nicht zu packen.

## Anleitung zum Testen
1. **Build erstellen:**
   ```bash
   npm run build && npm run dist
   ```
   *Achten Sie im Output darauf, dass `better-sqlite3` für `platform=win32 arch=x64` heruntergeladen/gebaut wird.*

2. **Testen auf Windows:**
   - Kopieren Sie den Ordner `release` auf den Windows-Rechner.
   - Starten Sie `start-with-console.bat`.
   - Das Konsolenfenster sollte nun starten und die Datenbank erfolgreich laden.

## Problem 3: Mac startet nicht mehr nach Build (Behoben)
Nach dem Erstellen der Windows-Version (`npm run dist`) startete die App auf dem Mac nicht mehr (`npm start` Crash).
**Ursache:** `npm run install:win` ersetzte die lokalen Mac-Abhängigkeiten durch Windows-Abhängigkeiten.
**Lösung:**
- `scripts.dist` wurde erweitert: Führt nach dem Build automatisch `npm run install:current` aus, um die Mac-Abhängigkeiten wiederherzustellen.
- Einmalig `npm run postinstall` ausführen, um den Fehler zu beheben.

## Fehlersuche
Falls es immer noch abstürzt, prüfen Sie das Logfile:
`%APPDATA%\RD-Plan\rd-plan-debug.log`
