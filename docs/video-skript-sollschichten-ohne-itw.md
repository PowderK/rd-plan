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
Für jeden Abteilungstag zählen wir die besetzten Positionen. Dabei leiten sich die Zahlen direkt aus der Fahrzeugzahl und den Besetzungsvorschriften ab – **nur 24‑Stunden‑Dienste (V) zählen als verfügbare Präsenz für RTW**. Fortbildungen, Kantine, LFZ‑Einsätze oder andere Abwesenheiten werden nicht berücksichtigt; solche Tage reduzieren das Gewicht automatisch, weil sie nicht mehr als "V" markiert sind.

- Ein RTW wird immer mit zwei Personen besetzt. Jede Schicht – Tag und Nacht – benötigt je eine Besetzung. Das ergibt für einen einzelnen RTW 2 × 2 = 4 Positionen pro Tag.
- Ein NEF erfordert eine Ein-Mann-Besetzung, auch hier gelten Tag + Nacht, daher 2 Positionen pro NEF.
- Ein ITW wird nur tagsüber gefahren und hat eine Position.

In einer Standardkonfiguration mit 4 RTW, 2 NEF und 1 ITW summieren sich die täglichen Positionen auf:

RTW 4 × (2 Mann × 2 Schichten) + NEF 2 × (1 Mann × 2 Schichten) + ITW 1 = 16 + 4 + 1 = 21 Positionen pro Tag.

Für die Beispielrechnung nehmen wir nun **10 Arbeitstage pro Monat** und vereinfachen die Fahrzeuganzahl auf 4 RTW, 2 NEF, 1 ITW = 7 Positionen pro Tag:

10 × 7 = 70 Positionen gesamt.

Diese 70 sind der Rohbedarf, bevor Entlastungen abgezogen werden; in der realen Planung ergibt sich der Wert direkt aus der tatsächlich verfügbaren Anzahl von an Diensttagen liegenden Fahrzeugen.

## 2) Entlastungen durch Azubis, Ü50 und LPAL (2:20–3:10)
Jetzt werden die Entlastungen vom Rohbedarf abgezogen.

Beispiel mit den kleineren Zahlen:
- Rohbedarf: 70
- Azubi-Entlastung: 4
- Ü50 + LPAL-Entlastung: 6

Zu verteilen bleiben:
70 − 4 − 6 = 60 SOLL-Positionen.

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
Anteil von Person A = 18 von 240 der zu verteilenden 60 Positionen.

## 5) Anteil exakt (mit Beispielrechnung) (5:00–6:00)
Exakter Anteil wird vor Rundung berechnet:

Exakter Anteil = (persönliche Gewichtung / Gesamtgewichtung) × zu verteilende Positionen

Für Person A:
(18 / 240) × 60 = 4,5

Das ist der exakte rechnerische Monatsanteil vor Ganzzahlverteilung.

### Hamilton-Verfahren zur finalen Berechnung
Für die Umwandlung in ganze Schichten verwenden wir das Hamilton-Verfahren, weil es die Gesamtsumme exakt erhält:

1. Jede Person erhält zunächst den ganzzahligen Teil ihres exakten Anteils (Abrunden).
2. Die verbleibenden Schichten – also die Differenz zwischen der Zielgesamtsumme und der Summe der abgerundeten Werte – werden nacheinander an diejenigen Personen vergeben, deren Nachkommabetrag am größten ist.

Beispielfortsetzung:
- Exakte Werte: A 13,5; B 10,2; C 6,3 → Abrundung: A 13; B 10; C 6 = 29 Schichten vergeben.
- Ziel: 31 Schichten (Rest 2) → Nachkommabeträge: A 0,5; B 0,2; C 0,3 → Restschichten an A und C vergeben.
- Finalwerte: A 14; B 10; C 7 = 31.

Dieses Verfahren stellt sicher, dass keine Schichten verloren gehen und die Verteilung fair bleibt.

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
