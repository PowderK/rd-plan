# 005 – Qualifikations-Zeiträume pro Person (monatliche Auflösung, Aktiv/Inaktiv je Zeitraum)

Ziel: Qualifikationen (z. B. „FzF RTW“) zeitlich befristet und monatsgenau pflegen, inkl. automatischer Aktiv/Inaktiv-Steuerung je Zeitraum.

## User Story
Als Planer:in möchte ich Qualifikationen für Kolleg:innen mit Start-/End-Monat pflegen (z. B. FzF RTW ab 2025‑02 bis 2026‑01), damit Einteilungen nur bei gültiger Qualifikation möglich sind.

## Scope
- Neue Entität pro Person: `QualificationPeriod` mit Feldern: Qualifikations-Typ (FzF RTW, NEF, ITW Ma/FzF …), Start (YYYY‑MM), Ende (YYYY‑MM, optional), Aktiv (0/1).
- Verwaltung in Personen-Popup (Tab „Qualifikationen“): Liste, Hinzufügen, Bearbeiten, Löschen.
- Einteilungs-/Kontrolllogik berücksichtigt nur aktuell gültige Qualifikationen. Bei fehlender Qualifikation Warnung oder Block (einstellbar).
- Optional: Historienansicht + Export.

## Akzeptanzkriterien
- In einem Monat ohne gültige FzF‑RTW‑Quali kann eine Person nicht als FzF RTW zugeordnet werden (oder nur mit deutlicher Warnung, je nach Einstellung).
- Aktiv/Inaktiv-Schalter pro Zeitraum wirkt sich sofort auf Einteilung und Kontrolle aus.
- Werte/Reports berücksichtigen gültige Qualifikationsstände.

## Technikvorschlag
- DB: Tabelle `qualification_periods(id, personId, qualType TEXT, startYM TEXT, endYM TEXT, active INTEGER DEFAULT 1)`, Indexe auf (personId, qualType, startYM, endYM).
- IPC: `get-qualification-periods(personId)`, `add-qualification-period`, `update-qualification-period`, `delete-qualification-period`.
- Renderer: Tab im Personen-Dialog mit Monats-Pickern (YYYY‑MM), Validierung (start <= end), UI-Markierung für aktuell gültig.
- Enforcement: In `MonthTabs` (und ggf. weiteren Stellen) vor Zuweisung Quali prüfen; Setting „warnen vs. verhindern“.
