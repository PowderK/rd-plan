# Issue 009: Dienstart "Wandern" (EXT) berücksichtigen

## Status
- [ ] Dienstart "EXT" im System definiert
- [ ] Berechnungslogik: Präsenz-Gewichtung angepasst
- [ ] UI: Anzeige im Dienstplan

## Beschreibung
Um die Arbeit in verschiedenen Abteilungen (die teilweise nicht das gleiche System nutzen) abzubilden, wird eine neue Dienstart "EXT" (Wandern) eingeführt.

### Kernpunkte:
1.  **Definitionslogik**: Die Dienstart "EXT" wird wie eine Abwesenheit (Urlaub/Krank/Kantine) gewertet, zählt aber intern als "geleistete Schicht" für die persönliche Bilanz.
2.  **Präsenz-Gewichtung**: 
    - Wenn "EXT" eingetragen ist, sinkt für diesen Monat das **Präsenz-Gewicht** des Mitarbeiters in seiner Stammabteilung.
    - Das Hamilton-Verfahren teilt ihm dadurch automatisch weniger Schichten in der Stammabteilung zu.
3.  **Vorteil**: Der Mitarbeiter wird in der Stammabteilung entlastet, weil er extern tätig war, ohne dass die Stammabteilung ihre Gesamtzahl an zu besetzenden Positionen künstlich erhöhen muss.

## Technische Details
- Aufnahme des Codes `EXT` in die Liste der gewichteten Abwesenheiten.
- Anpassung in `computeWeightedPresence` in `renderer/utils/calculation.ts`.
