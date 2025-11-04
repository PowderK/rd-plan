# Feature-Issues (Roadmap)

Dieses Dokument beschreibt drei neue Funktionswünsche mit klaren Akzeptanzkriterien und einem technischen Umsetzungsvorschlag.

---

## 1) Makros für wiederkehrende Einträge (z. B. „Kantine“ für 3 Wochen)

Ziel: Wiederkehrende Ereignisse für einzelne Kolleg:innen komfortabel im Dienstplan eintragen.

- User Story
  - Als Planer:in möchte ich wiederkehrende Einträge (z. B. täglich „Kantine“ für 3 Wochen) als Makro speichern und per Klick anwenden können, damit ich periodische Einträge schneller anlege.

- Scope
  - Makro definieren: Name, Person (optional leer ⇒ personenneutral), Zeitraum (Start/Ende), Muster (z. B. täglicher Code, nur Werktage, bestimmtes Slot-Ziel wie rtwX_tag_2 etc.).
  - Makro speichern/laden: Liste von Makros anzeigen, duplizieren, löschen.
  - Anwenden mit Vorschau: Zeigt alle betroffenen Tage/Einträge, Konfliktstrategie wählbar: Überschreiben, Überspringen, Nur leere Zellen füllen.
  - Rückgängig (Undo) unmittelbar nach Anwenden.

- Akzeptanzkriterien
  - Ein Makro „Kantine – 3 Wochen“ lässt sich erstellen, speichert persistent und kann auf eine Person und einen Zeitraum angewendet werden.
  - Vor dem Anwenden wird eine Vorschau angezeigt (Anzahl Tage, Liste der Ziel-Daten). 
  - Nach Anwenden sind die Einträge im Grid sichtbar. 
  - Undo stellt den Zustand vor Anwendung wieder her.

- Technikvorschlag
  - Datenhaltung: neue Tabelle `macros(id, name, payload_json, created_at, updated_at)`; `payload_json` enthält Struktur: `{ personId?: number, pattern: { rule: 'daily'|'weekdays'|..., code?: string, slotType?: string }, range: { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' }, filters?: {...} }`.
  - Renderer: UI in DutyRoster (oder Einteilung) – Dialog „Makro anlegen“ + „Makro anwenden“. 
  - Main/IPC: `get-macros`, `add-macro`, `update-macro`, `delete-macro`, `apply-macro({macroId, targetPersonId?, rangeOverride? , strategy})`.
  - Anwendung: Server-seitig Einträge generieren und via `bulkSetDutyRosterEntries` schreiben. Konflikte anhand bestehender Zellen (type/value) entscheiden.
  - Undo: temporär Snapshot der betroffenen Zellen (in Memory + optional temp-Table) und `bulkSetDutyRosterEntries` zum rollback.

---

## 2) Klick auf Namen im Kontrollkasten → Hervorhebung in der Einteilung

Ziel: Schnell erkennen, an welchen Tagen im Monat eine Person eingeteilt wurde.

- User Story
  - Als Nutzer:in möchte ich durch Klick auf den Namen im Kontrollfeld alle Tage des Monats farblich markiert bekommen, an denen diese Person eingeteilt ist, um schneller freie/volle Tage zu sehen.

- Scope
  - Toggle-Verhalten: Erster Klick aktiviert die Hervorhebung für die Person, zweiter Klick deaktiviert. 
  - Anzeige in beiden Ansichten (RTW/NEF und ITW):
    - RTW/NEF: alle Slots (FzF/Ma/Azubi) eines Tages, die der Person zugewiesen sind, werden hervorgehoben; Tag selbst bekommt dezente Markierung.
    - ITW: alle Rollen (1–4), analog markieren.
  - Optional: Filter „Nur markierte anzeigen“ reduziert die Liste auf die ausgewählte Person.

- Akzeptanzkriterien
  - Klick auf Namen im Kontrollkasten markiert sofort die entsprechenden Tage im linken Einteilungsbereich (deutliche, aber dezente Hintergrundfarbe/Umrandung).
  - Wechsel zwischen Monaten setzt Markierung zurück.
  - Funktioniert mit Personal und Azubis, und in ITW-Ansicht.

- Technikvorschlag
  - State: `selectedPersonKey` in `MonthTabs` (z. B. `p_42`/`a_7`).
  - Erkennung: Pro Tag prüfen, ob ein Slot `type` auf diese Person verweist; für Dropdown-Codes zusätzlich `getAssignedValueFor(date, slotId)` auswerten.
  - Styling: CSS-Klasse z. B. `.highlightCell` und `.highlightDay` (leichtes Blau), HLF‑B bleibt zusätzlich blau bei Name.

---

## 3) Plan-Freigabe (Sperre) mit Passwortschutz

Ziel: Nach Fertigstellung eines Plans wird er freigegeben und ist nur mit Passwort änderbar.

- User Story
  - Als Planverantwortliche:r möchte ich einen Monatsplan „freigeben“ und mit einem Passwort schützen, damit nach der Freigabe keine stillen Änderungen mehr möglich sind.

- Scope
  - UI-Schalter im Kopfbereich: „Plan freigeben“ (monatsscharf: Jahr+Monat).
  - Beim Aktivieren: Passwort setzen (mind. 8 Zeichen), Hinweis auf sichere Aufbewahrung. 
  - Gesperrter Plan: Alle Editierfunktionen (RTW/NEF/ITW/Dropdowns/Makros) inaktiv; beim Änderungsversuch Passwort-Dialog → temporär entsperren (z. B. 15 Minuten) oder für Session.
  - Admin-Fall: Möglichkeit zum Zurücksetzen des Passworts (nur manuell über Datenbank/Datei; bewusst ohne „vergessen“-Flow).

- Akzeptanzkriterien
  - Gesperrter Monat zeigt Umschalter als „aktiv“; Zellen sind nicht bearbeitbar.
  - Änderungsversuch öffnet Passwortdialog; korrektes Passwort entsperrt wie konfiguriert; falsches Passwort verhindert Änderung.
  - Sperre ist server-seitig durchgesetzt: direkte IPC-Aufrufe (setDutyRosterEntry/assignSlot/bulkSet…) scheitern mit Fehler, solange gesperrt und nicht entsperrt.

- Technikvorschlag
  - Persistenz: Settings-Schlüssel pro Monat `plan_lock_{year}_{month} = { locked: bool, hash: string, salt: string, unlockedUntil?: timestamp }`.
  - Hash: PBKDF2/argon2/bcrypt (Node: `crypto.scrypt`/`argon2`), Salt pro Eintrag.
  - Enforcement im Main-Prozess: Vor schreibenden Roster-Operationen Lock prüfen, ggf. Error werfen. IPCs: `get-plan-lock`, `set-plan-lock`, `unlock-plan({year,month,password,ttl})`.
  - Renderer: UI-Status lesen, Editierkomponenten deaktivieren, Passwortdialog bei Bedarf.

---

## Aufwandsschätzung (grobe Richtwerte)
- Makros: 1.5–3 PT (inkl. UI, DB, Vorschau, Undo)
- Hervorhebung per Namensklick: 0.5–1 PT
- Plan-Freigabe mit Passwortschutz: 1–2 PT (inkl. Hashing, IPC, UI, Disable/Enforcement)

> PT = Personentage; tatsächlicher Aufwand hängt von Details (z. B. Konfliktlogik bei Makros, Mehrbenutzerbetrieb) ab.
