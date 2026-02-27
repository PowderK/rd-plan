# Videoskript: SOLL-Schichten berechnen (ohne ITW)

## Intro (0:00–0:20)
In diesem Video zeige ich, wie die SOLL-Schichten berechnet werden: normale Berechnung, Einfluss von Azubis/Ü50/LPAL und gezielte Schichtübernahme.

## 1) Normale Erzeugung der SOLL-Schichten (0:20–2:00)
Zuerst wird der Monatsbedarf an Positionen berechnet:

Abteilungstage × (RTW-Positionen + NEF-Positionen)

Beispiel: 10 Abteilungstage, 2 RTW, 1 NEF (24h) → 100 Positionen.

Wichtig:
Für die faire Verteilung werden nur die 24h-Anwesenheiten (V-Schichten) als relevante Präsenz berücksichtigt.
Wenn ein Kollege z. B. in die LFZ geht, krank ist oder auf Lehrgang ist,
reduziert sich dadurch seine verfügbare RTW-Präsenz automatisch – und damit auch sein Anteil an den SOLL-Schichten.

Diese 100 werden dann fair auf die Kolleg:innen verteilt – über gewichtete Präsenz und Hamilton-Rundung.

## 1.1) Sonderfall HLF-B FzF (75%) (2:00–3:00)
HLF-B-Fahrzeugführer müssen nur 75% RTW fahren.
Deshalb wird ihr Anteil bereits vor der finalen Verteilung reduziert.

Wichtig ist das „wo“ in der Logik:
Die Reduktion passiert nicht erst am fertigen SOLL,
sondern schon in der Stufe der gewichteten Präsenz.

Formel pro Monat:
Gewichtete Präsenz = round(Präsenz × 0,75)

Beispiel:
Ein Kollege hat 20 relevante Präsenzschichten im Monat.
Ohne HLF-B wäre sein Gewicht 20.
Mit HLF-B wird daraus round(20 × 0,75) = 15.

Dieses reduzierte Gewicht geht anschließend in die Hamilton-Verteilung ein,
dadurch erhält der Kollege automatisch weniger SOLL-Schichten.

Wann die Reduktion gilt:
Monatsscharf genau in den Monaten, in denen die HLF-B-Qualifikation aktiv ist.

## Beispiel Verteilung (3:00–4:00)
Gewichte: A=12, B=8, C=5 (Summe 25).
Exakte Anteile: A 48, B 32, C 20 bei 100 Positionen.
Mit Hamilton wird sauber auf ganze Schichten gerundet, sodass die Gesamtsumme exakt bleibt.

## 1.2) Warum Hamilton und nicht normale Rundung? (4:00–4:45)
Hier ein wichtiger Punkt:
Wir können keine halben Schichten verteilen, aber die Gesamtsumme muss trotzdem exakt stimmen.

Bei normaler mathematischer Rundung kann die Summe falsch werden.

Beispiel:
Exakte Anteile: 10,4 / 10,4 / 10,4
Normale Rundung ergibt: 10 / 10 / 10 = 30
Benötigt wären aber 31,2 beziehungsweise in der Praxis eine feste Zielsumme von 31.

Deshalb nutzen wir das Hamilton-Verfahren:
1) Zuerst bekommt jede Person den ganzzahligen Anteil (Abrunden).
2) Die verbleibenden Restschichten werden nacheinander an die größten Nachkommarestwerte vergeben.

Vorteil:
Die Zielsumme bleibt exakt erhalten und die Verteilung bleibt fair und nachvollziehbar.

## 2) Einfluss von Azubis, Ü50 und LPAL (4:45–6:15)
Vor der Verteilung werden Entlastungen abgezogen.

Beispiel: 100 Positionen gesamt,
Azubi-Maschinist-Einsätze: 6,
Ü50/LPAL-Einsätze: 10,
verbleiben 84 SOLL-Schichten für den regulären Pool.

Das heißt: Azubi, Ü50 und LPAL senken das zu verteilende SOLL der übrigen Kolleg:innen.

## 3) Gezielte Schichtübernahme (6:15–7:45)
Jetzt zur Übernahme: Eine Person erhält gezielt zusätzliche SOLL-Schichten in einem Monat.

Praxisbeispiel:
Kollege A übernimmt eine Kantinenphase
Dafür übernimmt Kollege B im Gegenzug 4 RTW-Schichten. (Dies kann individuell festgelegt werden)

Rechnerisch bedeutet das:
Die 4 Schichten werden Kollege B direkt auf sein SOLL angerechnet.
Anschließend wird die Gegenreduktion proportional auf den restlichen Pool verteilt.

Wichtig:
Der Kollege, der die Schichten abgibt (hier Kollege A), wird bei dieser Neuverteilung nicht mehr berücksichtigt,
weil sich sein SOLL durch die Einteilung in die Kantine bereits automatisch reduziert.

Danach erfolgt wieder die Hamilton-Rundung, damit die Monatssumme exakt gleich bleibt (im Beispiel weiterhin 84).

## Abschluss (7:45–8:15)
Kurz zusammengefasst:
1) Monatsbedarf berechnen,
2) HLF-B (75%) bereits in der Präsenz-Gewichtung reduzieren,
3) fair per Hamilton verteilen,
4) Azubi/Ü50/LPAL abziehen,
5) Übernahmen gezielt einrechnen.

So bleibt die Planung transparent und nachvollziehbar.
