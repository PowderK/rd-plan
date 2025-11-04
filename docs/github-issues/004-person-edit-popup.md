# 004 – Editieren von Kolleg:innen im Popup (analog Erstellen)

Ziel: Bearbeiten einer Person in einem eigenen Popup-Fenster, identisch im Layout/Flow zum "Hinzufügen"-Dialog, für Konsistenz und Fokus.

## User Story
Als Nutzer:in möchte ich eine bestehende Person im selben Popup-Dialog wie beim Erstellen bearbeiten, damit ich Felder übersichtlich und mit identischem Formular-Flow anpassen kann.

## Scope
- Öffnen über "Ändern"-Button oder Doppelklick in der Personalübersicht.
- Formular-Felder analog Add-Dialog: Name (Pflicht), Vorname, Teilzeit, FzF, FzF HLF‑B, NEF, ITW Ma, ITW FzF, Aktiv.
- Pflichtfeld-Validierung mit klaren Hinweisen (z. B. Name erforderlich).
- Speichern/Abbrechen, Broadcast `personnel-updated` bei Erfolg.
- CSP-konform und nur Preload-APIs.

## Akzeptanzkriterien
- Bearbeiten-Popup öffnet mit vorbefüllten Daten; Änderungen werden gespeichert und erscheinen direkt in der Übersicht.
- Validierungsfehler verhindern Speichern und werden im Dialog angezeigt.
- Kein Misch-Flow mehr nötig (kein Inline-Formular erforderlich).

## Technikvorschlag
- Renderer: Vorhandenes `editPerson.html`/TSX verwenden; sicherstellen, dass Fenster via `open-edit-person-window` aufgerufen wird.
- Preload/Main: IPC `get-person`, `update-person` vorhanden; Validierungs-Feedback konsistent anzeigen (optional `show-message-box`).
- Tests: Manuell prüfen, dass CSP-Einschränkungen eingehalten und Events sauber abonniert/abgemeldet werden.
