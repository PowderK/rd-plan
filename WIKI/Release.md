# Release & Artefakte

Der CI‑Workflow erzeugt Windows‑Artefakte (`.exe`) mit `electron-builder`.

- Artefakte werden per `actions/upload-artifact` hochgeladen (jetzt auch bei `workflow_dispatch`).
- Beispiel: Ein Prä‑Release wurde automatisch erstellt: `ci-fe94f92` (enthält `RD-Plan.1.0.0.exe`).

Download eines Artefakts lokal (bereits demonstriert):

```bash
gh run download 18937232129 --name rd-plan-windows-main --dir ./artifacts --repo PowderK/rd-plan
```

Release per CLI (erstellt und Asset hochgeladen):

```bash
gh release create ci-<shortsha> ./artifacts/RD-Plan\ 1.0.0.exe --title "CI build <shortsha>" --notes "Automated CI release" --prerelease --repo PowderK/rd-plan
```

Checksumme (Beispiel):

```bash
shasum -a 256 "./artifacts/RD-Plan 1.0.0.exe"
```
