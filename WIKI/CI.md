# CI / GitHub Actions

Im Repository existiert ein Windows‑Build Workflow unter `.github/workflows/build-windows.yml`.

Wichtige Punkte:

- Workflow Name: `build-windows`
- Trigger: `workflow_dispatch` (manuell) und Push Tags `v*`.
- Ziel: Erzeugt Windows portable EXE mit `electron-builder`.
- Besonderheiten:
  - Rebuild von `better-sqlite3` gegen Electron v28.3.3 im CI (node‑gyp + native toolchain erforderlich).
  - Die Workflow‑Datei wurde angepasst, damit auch manuelle `workflow_dispatch` Runs Artefakte hochladen.

Triggern eines Builds (manuell):

```bash
gh workflow run build-windows.yml --ref main --repo PowderK/rd-plan
```

Artefakte herunterladen (lokal):

```bash
gh run download <run-id> --name rd-plan-windows-main --dir ./artifacts --repo PowderK/rd-plan
```

Release-Erstellung: In diesem Projekt wurde das Artefakt des CI‑Runs automatisch als Prä‑Release unter dem Tag `ci-<shortsha>` erstellt.
