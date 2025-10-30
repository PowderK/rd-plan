# Troubleshooting — häufige Probleme

1) better-sqlite3: NODE_MODULE_VERSION mismatch

Symptom: Beim Start oder Import einer nativen Bibliothek erscheint eine Fehlermeldung wie:

```
was compiled against a different Node.js version using NODE_MODULE_VERSION 127. This version of Node.js requires NODE_MODULE_VERSION 119.
```

Lösungsschritte:
- Versuche `npx electron-rebuild -f -w better-sqlite3`.
- Wenn electron-rebuild an `node-abi` scheitert (neue Electron-Version), downgrade Electron auf die getestete Version and rebuild, z. B. `npm install --save-dev electron@28.3.3 --save-exact` und dann `npx electron-rebuild`.
- Alternativ kannst du `npm_config_runtime=electron npm_config_target=<electron-version> npm rebuild better-sqlite3 --build-from-source` verwenden (benötigt node‑gyp, Python, Compiler).

2) TypeScript: Cannot find type definition file for 'node'

Lösung: `npm install --save-dev @types/node`

3) Electron Security Warning (Insecure Content-Security-Policy)

Symptom: Renderer warnt über fehlende CSP oder `unsafe-eval`.

Lösung: Das Projekt stellt jetzt eine CSP bereit:
- Meta‑Tag in `renderer/index.html` sowie Header Injection im `main` Prozess, siehe Commit `csp‑fix`.

4) CI/Build: Keine Artefakte gespeichert

Ursache: Workflow lud Artefakte bisher nur für Tags hoch. Wir haben das Workflow so angepasst, dass `workflow_dispatch` Runs ebenfalls Artefakte hochladen.

5) GitHub Wiki nicht erreichbar

Wenn `git clone https://github.com/<owner>/<repo>.wiki.git` fehlschlägt, kann das an fehlender Wiki‑Erstellung oder Berechtigungen liegen. Workaround: Wiki‑Inhalte als Markdown im Repo (z. B. `WIKI/` oder `docs/`) ablegen und per PR in `main` mergen. Dann können die Seiten manuell ins Wiki übertragen.
