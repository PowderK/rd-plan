# Plan-Freigabe (Monat) mit Passwortschutz

## Motivation / User Story
Als Planverantwortliche:r möchte ich einen Monatsplan „freigeben“ und mit einem Passwort schützen, damit nach der Freigabe keine stillen Änderungen mehr möglich sind.

## Scope
- Umschalter im Kopfbereich (monatsscharf: Jahr+Monat): „Plan freigeben“.
- Aktivieren ⇒ Passwort setzen (≥ 8 Zeichen); Hinweis auf sichere Aufbewahrung.
- Gesperrt: Editieren im UI deaktiviert; Änderungsversuch öffnet Passwortdialog → temporär entsperren (z. B. 15 Minuten) oder Session.
- Admin-Fall: Rücksetzen nur manuell via DB/Datei (bewusst ohne „Passwort vergessen“).

## Akzeptanzkriterien
- Gesperrter Monat zeigt aktiven Schalter; Zellen sind nicht editierbar.
- Schreibversuch ohne Entsperren scheitert serverseitig; mit korrektem Passwort gelingt er für die definierte Dauer.
- Sperrstatus über IPC lesbar.

## Technische Notizen
- Persistenz: Setting pro Monat `plan_lock_{year}_{month} = { locked: bool, hash: string, salt: string, unlockedUntil?: timestamp }`.
- Hashing: `crypto.scrypt`/argon2/bcrypt; Salt pro Eintrag.
- Enforcement im Main-Prozess: Vor schreibenden IPCs Lock prüfen (setDutyRosterEntry/assignSlot/bulkSet…).
- IPC: `get-plan-lock`, `set-plan-lock`, `unlock-plan({year,month,password,ttl})`.
- Renderer: UI-Status lesen, Editierfelder deaktivieren, Passwortdialog bereitstellen.

## Aufwand (grobe Schätzung)
1–2 PT.
