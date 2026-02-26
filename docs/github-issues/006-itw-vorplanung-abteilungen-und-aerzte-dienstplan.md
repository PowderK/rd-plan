# 006 – ITW-Vorplanung als eigener Menüpunkt inkl. ITW-Dienstplan

Ziel: Die gesamte ITW-Vorplanung soll künftig vollständig im RD-Plan erfolgen, getrennt von der regulären Schichtberechnung.

## User Story
Als Planer:in möchte ich einen eigenen Menüpunkt „ITW“, in dem ITW-Phasen (jeweils 3 Wochen) übersichtlich geplant werden können, damit alle Abteilungen ihre Einteilungen zentral und qualifikationsbasiert vornehmen können.

## Scope
- Neuer Hauptmenüpunkt `ITW`.
- Unter `ITW` werden alle ITW-Phasen (Dauer je Phase: 3 Wochen) aufgelistet.
- Jede Phase zeigt eine Tabelle mit einer Spalte pro Abteilung.
- Personen können sich pro Phase in ihrer Abteilung eintragen.
- Personalverwaltung wird erweitert: Feld `Abteilung` pro Person (Pflichtfeld).
- Verfügbare Personen für ITW kommen aus `Personal` und werden nach Abteilung geführt/gefiltert.

### Rollen- und Qualifikationslogik (pro Phase)
- Pro Phase werden benötigt:
  - 2x Fahrzeugführer
  - 1x Maschinist
- Eintragung ist nur möglich, wenn die Person die benötigte Qualifikation besitzt.
- Qualifikationen werden aus den vorhandenen Qualifikationsdaten der Person ausgelesen.
- Abteilungsfremde Kolleg:innen werden in der Planung zusätzlich separat aufgelistet.

### Klare Trennung zur regulären Planung
- ITW-Vorplanung dient ausschließlich der Planung und wird **nicht** in die Schichtberechnung übernommen.
- Personal aus anderen Abteilungen darf die reguläre Abteilungsberechnung nicht beeinflussen.
- Es muss eine harte fachliche Trennung zwischen ITW-Vorplanung und regulärem Dienst-/Schichtplan geben.

### Zusätzlicher Tab: ITW-Dienstplan
- Im Bereich `ITW` gibt es zusätzlich einen Tab `ITW-Dienstplan`.
- Der Tab ist strukturell identisch zum Abteilungs-Dienstplan.
- Ärzt:innen werden im ITW-Dienstplan geführt; an Wochenenden und Feiertagen besteht **keine** Pflicht zur ärztlichen Einteilung.
- Abteilungsfremde Kolleg:innen werden im ITW-Dienstplan separat ausgewiesen.
- Es gibt einen Button `Import`, mit dem Kolleg:innen aus der ITW-Vorplanung automatisch per Makro in den ITW-Dienstplan übernommen werden.
- Der ITW-Dienstplan dient als Datenquelle für die Einteilung: ITW-Besatzung aus anderen Abteilungen und Ärzt:innen wird in der Einteilung in einem grauen Farbton dargestellt, um die Besetzung zu vervollständigen.
- Kolleg:innen aus anderen Abteilungen und Ärzt:innen haben keinen Einfluss auf die Berechnung.
- Der/die Kolleg:in aus der eigenen Abteilung wird weiterhin über den regulären Dienstplan geführt, inklusive Berechnung.

## Akzeptanzkriterien
- Menüpunkt `ITW` ist sichtbar und aufrufbar.
- ITW-Phasen werden in 3‑Wochen-Blöcken angezeigt.
- Pro Phase existiert je Abteilung eine eigene Spalte zur Eintragung.
- Ohne passende Qualifikation ist keine Eintragung in die Rolle Fahrzeugführer/Maschinist möglich.
- Über-/Unterbesetzungen werden als harte Sperre behandelt.
- Pro Tag werden genau 1 Maschinist, 1 Fahrzeugführer und 1 Arzt benötigt (unter Berücksichtigung der Wochenend-/Feiertagsregel für Ärzt:innen).
- ITW-Eintragungen fließen nicht in die reguläre Schicht-/Dienstberechnung ein.
- Personal anderer Abteilungen beeinflusst die reguläre Berechnung nicht.
- Tab `ITW-Dienstplan` ist vorhanden und nutzbar.
- Abteilungsfremde Kolleg:innen sind im ITW-Dienstplan separat sichtbar.
- Ein `Import`-Button übernimmt Kolleg:innen aus der Vorplanung automatisiert in den ITW-Dienstplan (Makro-basierter Import).
- In der Einteilung werden ITW-Besatzungsmitglieder aus anderen Abteilungen sowie Ärzt:innen in grauem Farbton angezeigt.
- Kolleg:innen aus anderen Abteilungen und Ärzt:innen beeinflussen die Berechnung nicht.
- Kolleg:innen aus der eigenen Abteilung werden ausschließlich über den regulären Dienstplan geführt und berechnet.
- Für Wochenend- und Feiertagstermine im ITW-Dienstplan ist keine Arzteinplanung erforderlich.

## Technikvorschlag
- Datenmodell:
  - Person um Feld `department` erweitern.
  - Neue ITW-Planungsentitäten für `phase`, `assignment`, `role` (Fahrzeugführer/Maschinist) und optional `department`-Snapshot.
  - ITW-Dienstplan-Modell inkl. Kennzeichnung für Ärzt:innen sowie abteilungsfremde Kolleg:innen.
- UI/Navigation:
  - Neuer Menüeintrag + neue ITW-Ansicht mit Tabs: `Abteilungsplanung`, `ITW-Dienstplan`.
  - `Import`-Button für Makro-basierten Transfer von Vorplanung in den ITW-Dienstplan.
- Validierung:
  - Vor Eintragung Qualifikation prüfen.
  - Rollenanzahl als harte Sperre validieren (pro Tag: 1 FzF, 1 Maschinist, 1 Arzt).
  - Wochenend-/Feiertagslogik für Ärzt:innen im ITW-Dienstplan berücksichtigen.
  - Klare Kennzeichnung (grauer Farbton) für ITW-Besatzung aus anderen Abteilungen und Ärzt:innen in der Einteilungsansicht.
- Berechnungsgrenzen:
  - ITW-Daten explizit aus allen regulären Schichtberechnungen ausschließen.
  - Abteilungsfremde Kolleg:innen und Ärzt:innen dürfen keine Berechnungswirkung erzeugen.
  - Nur die eigene Abteilung bleibt im regulären Dienstplan als berechnungsrelevante Quelle bestehen.

## Final entschieden
- ITW-Phasen (je 3 Wochen) werden in den Einstellungen hinterlegt und dort verwaltet.
- Abteilungsübergreifende ITW-Planung ist zulässig und bereits umgesetzt (nur ITW-intern, ohne Einfluss auf die reguläre Berechnung).
- Über-/Unterbesetzungen werden als harte Sperre umgesetzt.
