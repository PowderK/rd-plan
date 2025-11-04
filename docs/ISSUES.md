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

---

## 4) Editieren von Kolleg:innen im Popup (analog „Erstellen“)

Ziel: Das Bearbeiten einer Person soll in einem eigenen Popup-Fenster erfolgen – identisches Layout/Flow wie beim „Hinzufügen“ – um Konsistenz und Fokus zu verbessern.

- User Story
  - Als Nutzer:in möchte ich eine bestehende Person im selben Popup-Dialog wie beim Erstellen bearbeiten, damit ich Felder übersichtlich und mit identischem Formular-Flow anpassen kann.

- Scope
  - Öffnen über „Ändern“-Aktion oder Doppelklick in der Personalübersicht.
  - Formular entspricht dem Add-Dialog (Name, Vorname, Teilzeit, FzF, FzF HLF‑B, NEF, ITW Ma/FzF, Aktiv), inkl. Pflichtfeld-Validierung.
  - Speichern/Abbrechen-Buttons, Broadcast „personnel-updated“ beim Erfolg.
  - CSP- und Preload-APIs wie im Add-Dialog verwenden.

- Akzeptanzkriterien
  - Bearbeiten-Dialog öffnet mit vorbefüllten Daten; Änderungen werden gespeichert und sind direkt sichtbar.
  - Pflichtfelder (z. B. Name) werden validiert; Nutzer:in erhält klare Hinweise.
  - Kein Inline-Formularmix mehr nötig – Popup ist der zentrale Flow.

- Technikvorschlag
  - Renderer: Neues `editPerson.html`/TSX existiert bereits; Button/Handler in der Übersicht sicherstellen (Fenster per `open-edit-person-window`).
  - Preload/Main: IPC `get-person`, `update-person` vorhanden; ggf. Validierung verbessern und Fehler dialogisch anzeigen.

---

## 5) Qualifikations-Zeiträume pro Person (monatliche Auflösung, Aktiv/Inaktiv je Zeitraum)

Ziel: Qualifikationen (z. B. „FzF RTW“) zeitlich befristet und monatsgenau pflegen, inkl. automatischer Aktiv/Inaktiv-Steuerung je Zeitraum.

- User Story
  - Als Planer:in möchte ich für Kolleg:innen Qualifikationen mit Start-/End-Monat pflegen (z. B. FzF RTW ab 2025‑02 bis 2026‑01) und der Plan soll die Einteilung entsprechend erlauben oder verhindern.

- Scope
  - Neue Entität „QualificationPeriod“ pro Person: Typ (z. B. FzF RTW, NEF, ITW‑Ma/FzF), Gültig von/bis (Monatsauflösung), Status (aktiv/inaktiv innerhalb des Zeitraums optional).
  - UI: Verwaltung in Personen-Popup (Tab „Qualifikationen“), Liste + „Hinzufügen“, „Bearbeiten“, „Löschen“.
  - Logik: Einteilungs-/Kontrolllogik berücksichtigt nur aktuell gültige Qualifikationen; bei fehlender Qualifikation Warnung oder Block (konfigurierbar).
  - Optional: Historienansicht und CSV/Excel‑Export.

- Akzeptanzkriterien
  - Für einen Monat ohne FzF‑RTW‑Quali darf die Person nicht als FzF RTW zugeordnet werden (oder es erscheint eine deutliche Warnung, je nach Einstellung).
  - Aktiv/Inaktiv-Schalter pro Zeitraum wirkt sich sofort auf Einteilung/Kontrolle aus.
  - Werte/Reporting berücksichtigen den gültigen Qualistand.

- Technikvorschlag
  - DB: Neue Tabelle `qualification_periods(id, personId, qualType TEXT, startYM TEXT, endYM TEXT, active INTEGER DEFAULT 1)`, Index auf (personId, qualType, startYM, endYM).
  - IPC: CRUD-Handler (`get-qualification-periods(personId)`, `add/update/delete-qualification-period`).
  - Renderer: Tab im Personen-Dialog, Validierung (start<=end, Monatsformat YYYY‑MM), Anzeige der Wirksamkeit zum aktuellen Planmonat.
  - Enforcement: In `MonthTabs` und Zuweisungslogik vor Zuordnung Quali prüfen; Setting zur „Warnen vs. Verhindern“‑Strategie.
