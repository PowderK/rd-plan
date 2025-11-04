# Kontrollkasten: Klick auf Namen → Hervorhebung in der Einteilung

## Motivation / User Story
Als Nutzer:in möchte ich durch Klick auf den Namen im Kontrollfeld alle Tage des Monats farblich markiert bekommen, an denen diese Person eingeteilt ist (RTW/NEF/ITW), um schneller freie/volle Tage zu sehen.

## Scope
- Toggle-Verhalten: Erster Klick aktiviert Hervorhebung, zweiter deaktiviert; Monatswechsel setzt zurück.
- RTW/NEF: Slots (FzF/Ma/Azubi) der Person hervorheben; Tag dezent markieren.
- ITW: Rollen 1–4 analog.
- Optional: „Nur markierte anzeigen“ reduziert Liste auf diese Person.

## Akzeptanzkriterien
- Klick markiert sofort alle relevanten Zellen/Tage im linken Einteilungsbereich.
- Funktioniert für Personal und Azubis sowie in ITW-Ansicht.
- HLF‑B Namensfarbe (blau) bleibt bestehen; Markierung ergänzt sich.

## Technische Notizen
- State: `selectedPersonKey` in `MonthTabs` (z. B. `p_42`/`a_7`).
- Erkennung pro Tag: Slots `type` bzw. `getAssignedValueFor(date, slotId)` prüfen.
- Styling: CSS-Klassen `.highlightCell` und `.highlightDay` (dezentes Blau), ARIA-Rollen für Accessibility.

## Aufwand (grobe Schätzung)
0.5–1 PT.
