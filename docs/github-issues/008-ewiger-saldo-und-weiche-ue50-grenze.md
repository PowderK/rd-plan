# Issue 008: Ewiger Saldo und weiche Ü50-Grenze

## Status
- [ ] Konzept erstellt
- [ ] Backend: Historische Saldenberechnung implementiert
- [ ] Frontend: Anzeige des Gesamt-Saldos im Kontrollkasten
- [ ] Logik: Ü50-Soll-Stopp bei gleichzeitigem Erhalt des Alt-Saldos

## Beschreibung
Aktuell werden die Schicht-Salden (Soll vs. Ist) jedes Jahr auf 0 gesetzt. Dies soll auf ein dynamisches System umgestellt werden, das den Saldo über die gesamte Dienstzeit eines Mitarbeiters trackt.

### Kernpunkte:
1.  **Dynamische Kumulierung**: Der "Rest" eines Mitarbeiters im Kontrollkasten berechnet sich aus dem kumulierten Soll minus dem kumulierten Ist über alle in der Datenbank vorhandenen Jahre.
2.  **Weiche Ü50-Grenze**: 
    - Mit Erreichen des 50. Lebensjahres wird das monatliche **Soll** (Zuteilung neuer Schichten) auf 0 gesetzt.
    - Vorhandene **Plus-Stunden** (positiver Saldo) können genutzt werden, um im Jahr des 50. Geburtstags früher vom RTW/NEF "abzugehen".
    - Vorhandene **Minus-Stunden** (negativer Saldo) müssen auch nach dem 50. Lebensjahr noch abgearbeitet werden (Altlasten-Abbau), bevor die Person nur noch NEF fährt oder ganz vom RTW entbunden wird.
3.  **Abgangs-Steuerung**: Wenn Mitarbeiter die Abteilung verlassen, werden sie inaktiv gesetzt. Da kein neues Soll mehr generiert wird, können die Einteiler sie gezielt so einplanen, dass sie mit einem Saldo von exakt 0 aus der Abteilung ausscheiden.

## Technische Details
- Anpassung der `calculateTargets` Funktion in `renderer/utils/calculation.ts`.
- Erweiterung der Datenbankabfragen in `main/database.ts` für historische Daten.
- UI-Anpassung im `Kontrollkasten.tsx` zur Darstellung des Gesamtsaldos.
