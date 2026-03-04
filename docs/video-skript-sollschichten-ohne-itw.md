# Videoskript: SOLL-IST-Berechnung verständlich erklärt

## Intro mit Erläuterungen (0:00–0:35)
In diesem Video zeige ich die komplette SOLL-IST-Berechnung Schritt für Schritt.
Wir schauen uns an, wie alle Werte entstehen, wie sie zusammenhängen und wie am Ende der finale Monatswert pro Person berechnet wird.
Wichtig: Wir rechnen über Schichten und Positionen, nicht über Stunden.

## 0) Überblick über alle Werte (0:35–1:20)
Wir unterscheiden zwei Ebenen:

- **Gesamtwerte**: gelten für den ganzen Monat und den gesamten Pool.
- **Persönliche Werte**: gelten für genau eine ausgewählte Person.

Die zentralen Werte im Ablauf sind:
1) Positionsbedarf des Monats,
2) Entlastungen (Azubi, Ü50, LPAL),
3) Anzahl der aktiv berücksichtigten Personen,
4) Gewichtung gesamt und persönlich,
5) exakter Anteil,
6) Anteil plus Bonus ergibt Finalwert.

## 1) Positionen im Monat: RTW 4, NEF 2, ITW 1 (1:20–2:20)
Für jeden Abteilungstag zählen wir die besetzten Positionen:

RTW 4 + NEF 2 + ITW 1 = 7 Positionen pro Tag.

Beispiel mit 30 Abteilungstagen:
30 × 7 = 210 Positionen gesamt.

Diese 210 sind der Rohbedarf, bevor Entlastungen abgezogen werden.

## 2) Entlastungen durch Azubis, Ü50 und LPAL (2:20–3:10)
Jetzt werden die Entlastungen vom Rohbedarf abgezogen.

Beispiel:
- Rohbedarf: 210
- Azubi-Entlastung: 12
- Ü50 + LPAL-Entlastung: 18

Zu verteilen bleiben:
210 − 12 − 18 = 180 SOLL-Positionen.

## 3) Anzahl Personen für diesen Monat (3:10–3:45)
Als Nächstes zählt das System, wie viele Personen in diesem Monat im regulären Verteilpool aktiv sind.

Beispiel:
Es sind 15 Personen aktiv.

Die Anzahl allein verteilt noch nichts gleichmäßig, sie definiert nur den aktuellen Pool.
Die faire Verteilung passiert über die Gewichtung.

## 4) Gewichtung: gesamt und persönlich (3:45–5:00)
Jede Person erhält eine **persönliche Gewichtung** aus ihrer relevanten Monatspräsenz.
Die **Gesamtgewichtung** ist die Summe aller persönlichen Gewichtungen.

Beispiel:
- Gesamtgewichtung aller 15 Personen: 240
- Persönliche Gewichtung von Person A: 18

Dann gilt:
Anteil von Person A = 18 von 240 der zu verteilenden 180 Positionen.

## 5) Anteil exakt (mit Beispielrechnung) (5:00–6:00)
Exakter Anteil wird vor Rundung berechnet:

Exakter Anteil = (persönliche Gewichtung / Gesamtgewichtung) × zu verteilende Positionen

Für Person A:
(18 / 240) × 180 = 13,5

Das ist der exakte rechnerische Monatsanteil vor Ganzzahlverteilung.
Die finale Ganzzahlverteilung bleibt summengenau über das bekannte Rundungsverfahren.

## 6) Anteil + Bonus = Final (6:00–6:55)
Nach dem exakten Anteil wird ein Monats-Bonus oder -Malus addiert.

Formel:
Final = Anteil + Bonus

Beispiel für Person A:
- Exakter Anteil: 13,5
- Bonus aus Monatsregel: +2
- Finalwert vor Endrundung: 15,5

So wird transparent, dass der Finalwert immer aus einem fairen Basisanteil plus klar dokumentierter Korrektur besteht.

## 7) Sonderfall: 75%-Regelung (6:55–8:05)
Bei der 75%-Regelung wird nicht erst am Ende gekürzt,
sondern bereits die persönliche Gewichtung reduziert.

Formel im Sonderfall:
Gewichtung 75% = round(relevante Präsenz × 0,75)

Beispiel:
- Relevante Präsenz: 20
- Normale Gewichtung: 20
- 75%-Gewichtung: round(20 × 0,75) = 15

Mit dieser reduzierten Gewichtung geht die Person in die normale Anteil-Berechnung.
Dadurch sinkt ihr exakter Anteil automatisch und nachvollziehbar.

## Abschluss (8:05–8:35)
Kurz zusammengefasst:
1) Positionen bestimmen (RTW 4, NEF 2, ITW 1),
2) Entlastungen durch Azubi/Ü50/LPAL abziehen,
3) aktive Personen im Monat zählen,
4) gesamt/persönlich gewichten,
5) exakten Anteil berechnen,
6) Anteil plus Bonus zum Finalwert führen,
7) Sonderfall 75% direkt in der Gewichtung abbilden.

So ist jeder Monatswert rechnerisch klar herleitbar.

---

## Benötigte Screenshots (genau 2)
- **Screenshot 1 – Wertetabelle (Gesamtansicht)**: Monatswerte und Gesamtzahlen als Hauptreferenz für Positionen, Entlastungen, Personenanzahl und Gesamtgewichtung.
- **Screenshot 2 – Detailansicht eines Kollegen**: Persönliche Werte für Gewichtung, Anteil exakt, Bonus und Finalwert inklusive Verweis auf den 75%-Sonderfall.

## Produktionshinweise
- Es werden ausschließlich diese zwei Screenshots verwendet; keine weiteren Ansichten ergänzen.
- Fokus nur über statische Ausschnitte und Hervorhebungen innerhalb der zwei Screenshots.
- Zahlen und Formeln als kurze On-Screen-Texte ergänzen, damit die Rechnung klar nachvollziehbar bleibt.
- Alle Kapitel bauen auf Screenshot 1 und Screenshot 2 auf, ohne zusätzliche Visual-Assets.
