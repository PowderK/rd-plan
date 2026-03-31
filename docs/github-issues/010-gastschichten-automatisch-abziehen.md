# Issue 010: Gastschichten automatisch vom Sollbedarf abziehen

## Status
- [ ] Automatisierte Gasterkennung implementiert
- [ ] Abzugslogik im Hamilton-Verfahren integriert
- [ ] Validierung der Entlastung der Kernmannschaft

## Beschreibung
Wenn Kollegen aus anderen Abteilungen (Gäste) aushelfen, sollen diese Schichten die Kernmannschaft der aktuellen Abteilung entlasten.

### Kernpunkte:
1.  **Automatische Identifikation**: Das System erkennt eine eingeteilte Person als "Gast", wenn ihr Präsenz-Gewicht für die aktuelle Abteilung im betreffenden Monat 0 beträgt.
2.  **Soll-Reduzierung**: 
    - Jede durch einen Gast besetzte RTW-Position wird **vor** der Hamilton-Verteilung vom Gesamtbedarf der Abteilung abgezogen.
    - Dies funktioniert analog zur Logik von Azubis oder Ü50-Mitarbeitern (die ebenfalls Positionen "wegnehmen" und so die anderen entlasten).
3.  **Kein manueller Aufwand**: Es ist kein zusätzliches Häkchen "Tagesgast" nötig; die Zuordnung erfolgt rein über die Stammdaten/Gewichtung der aktuellen Abteilung.

## Technische Details
- Anpassung der `calculateTargets` Logik in `renderer/utils/calculation.ts`.
- Prüfung der Gewichtung während der Iteration über den Dienstplan.
