# Makros für wiederkehrende Einträge (z. B. "Kantine" für 3 Wochen)

## Motivation / User Story
Als Planer:in möchte ich wiederkehrende Einträge (z. B. täglich "Kantine" für 3 Wochen) als Makro speichern und per Klick anwenden können, damit ich periodische Einträge schneller anlege.

## Scope
- Makro definieren: Name, Person (optional leer ⇒ personenneutral), Zeitraum (Start/Ende), Muster (z. B. täglich, nur Werktage), Ziel (Code oder SlotType wie `rtwX_tag_2`).
- Makros speichern/laden: Liste anzeigen, duplizieren, löschen.
- Anwenden mit Vorschau: betroffene Tage auflisten; Konfliktstrategie: Überschreiben / Überspringen / Nur leere füllen.
- Undo direkt nach Anwendung.

## Akzeptanzkriterien
- Ein Makro „Kantine – 3 Wochen“ lässt sich erstellen, persistent speichern und auf eine Person + Zeitraum anwenden.
- Vor dem Anwenden erscheint eine Vorschau mit Anzahl/Datums-Liste.
- Nach Anwenden sind Einträge im Grid sichtbar.
- Undo stellt den Zustand vor Anwendung wieder her.

## Technische Notizen
- DB: Tabelle `macros(id, name, payload_json, created_at, updated_at)`; `payload_json` enthält `{ personId?: number, pattern: { rule: 'daily'|'weekdays'|..., code?: string, slotType?: string }, range: { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' } }`.
- IPC: `get-macros`, `add-macro`, `update-macro`, `delete-macro`, `apply-macro({macroId, targetPersonId?, rangeOverride?, strategy})`.
- Anwendung auf Serverseite: Generiere Einträge und schreibe via Bulk-API. Konflikte gemäß Strategy behandeln.
- Undo: Snapshot der betroffenen Zellen und Re-Bulk.

## Aufwand (grobe Schätzung)
1.5–3 PT, abhängig von Konfliktlogik/Undo-Tiefe.
