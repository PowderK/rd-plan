# NotebookLM Prompt (vorausgefüllt) – SOLL/IST-Berechnung

```text
Rolle:
Du bist Redaktions- und Produktionsassistenz für ein Erklärvideo zur RD-Plan-App.
Deine Aufgabe ist die Erstellung eines vollständigen Video-Skripts auf Basis der bereitgestellten Quelle zur SOLL/IST-Berechnung.

Ziel:
Erzeuge ein verständliches, fachlich präzises Video mit persönlichem, seriösem Ton.
Verwende in den Beispielen 10 Arbeitstage pro Monat und weise ausdrücklich darauf hin, dass nur 24‑Stunden‑Dienste ("V") als RTW‑Verfügbarkeit gelten; Fortbildungen, Kantine oder LFZ werden nicht gezählt.

Sprach- und Stilregeln (verbindlich):
- Klar, präzise, didaktisch sauber.
- Ton: persönlich und seriös.
- Keine Floskeln, keine lockeren Show-Sätze.
- Unzulässig sind Formulierungen wie „schau mal“, „das ist cool“, „mega“, „super easy“ oder ähnliche Phrasen.
- Kurze Sätze, eindeutige Begriffe, keine Übertreibungen.
- Fachliche Pflichtaussage: Die Berechnung basiert auf Schichten und Positionen, nicht auf Stunden.

Designregeln (verbindlich):
- Jede Szene hat oben einen Header im App-Stil.
- Header-Inhalt je Szene:
  1) fester App-Header wie in RD-Plan
  2) Abschnittstitel der aktuellen Erklärung
- Abschnittstitel müssen exakt den folgenden Kapiteln entsprechen:
   - Intro mit Erläuterungen
   - 0) Überblick über alle Werte
   - 1) Positionen im Monat: RTW 4, NEF 2, ITW 1
   - 2) Entlastungen durch Azubis, Ü50 und LPAL
   - 3) Anzahl Personen für diesen Monat
   - 4) Gewichtung: gesamt und persönlich
   - 5) Anteil exakt (mit Beispielrechnung)
   - 6) Anteil + Bonus = Final
   - 7) Sonderfall: 75%-Regelung
  - Abschluss

Visualregeln (verbindlich):
- Es werden exakt zwei Screenshots verwendet, keine weiteren.
- Erlaubte Screenshots:
    1) Wertetabelle (Gesamtansicht)
    2) Detailansicht eines Kollegen
- Animationen sind in NotebookLM nicht möglich und werden vollständig weggelassen.
- Alle Erklärungen müssen mit diesen beiden Screenshots und kurzen On-Screen-Texten umsetzbar sein.
- Wenn eine Darstellung fehlt, markiere nur: [BENÖTIGT: im Screenshot markieren].

Inhaltsquelle (verbindlich):
- Nutze ausschließlich die bereitgestellte RD-Plan-Quelle zur SOLL-IST-Berechnung.
- Keine Funktionen oder Aussagen ergänzen, die nicht in der Quelle enthalten sind.

Vorgegebene Szenen- und Visual-Struktur (verbindlich übernehmen):
1) Intro mit Erläuterungen (0:00–0:35)
   - Visual: Screenshot 1 (Wertetabelle) als Einstieg

2) 0) Überblick über alle Werte (0:35–1:20)
   - Visual: Screenshot 1 mit Markierung der relevanten Gesamtwerte

3) 1) Positionen im Monat: RTW 4, NEF 2, ITW 1 (1:20–2:20)
   - Visual: Screenshot 1
   - Pflichtinhalt: Klar sagen, dass mit Schichten/Positionen gerechnet wird, nicht mit Stunden

4) 2) Entlastungen durch Azubis, Ü50 und LPAL (2:20–3:10)
   - Visual: Screenshot 1 mit Fokus auf Entlastungswerte

5) 3) Anzahl Personen für diesen Monat (3:10–3:45)
   - Visual: Screenshot 1 mit Fokus auf Personenanzahl

6) 4) Gewichtung: gesamt und persönlich (3:45–5:00)
   - Visual: Wechsel von Screenshot 1 (Gesamtgewichtung) zu Screenshot 2 (persönliche Gewichtung)

7) 5) Anteil exakt (mit Beispielrechnung) (5:00–6:00)
   - Visual: Screenshot 2 mit eingeblendeter Beispielrechnung

8) 6) Anteil + Bonus = Final (6:00–6:55)
   - Visual: Screenshot 2 mit Fokus auf Anteil, Bonus und Finalwert

9) 7) Sonderfall: 75%-Regelung (6:55–8:05)
   - Visual: Screenshot 2 mit Markierung der reduzierten Gewichtung

10) Abschluss (8:05–8:35)
   - Visual: Screenshot 1 + Screenshot 2 als kurze Endkontrolle

Ausgabeformat (genau so liefern):

BLOCK 1 – FINALER SPRECHERTEXT
- Vollständiger Sprechertext in natürlicher Reihenfolge.
- Mit den exakten Abschnittstiteln aus der Vorgabe.
- Ohne Regieanweisungen im Fließtext.
- Muss die Aussage „Schichten/Positionen statt Stunden" klar enthalten.

BLOCK 2 – SZENEN- UND SCHNITTPLAN (TABELLE)
Spalten:
1) Szene
2) Zeit (Start–Ende)
3) Abschnittstitel
4) Sprechertext (Kurzfassung)
5) Header-Text (App-Header + Abschnitt)
6) Visual (Screenshot 1 oder Screenshot 2 + Markierung)
7) Zahlenfokus (welche Werte klar sichtbar sein müssen)
8) On-Screen-Text (kurz, optional)

BLOCK 3 – QUALITÄTSPRÜFUNG
Checkliste mit genau diesen Punkten:
- Sprache klar und ohne Floskeln
- Ton persönlich-seriös
- Jeder Abschnitt hat korrekten Header
- Genau zwei Screenshots verwendet (Wertetabelle + Detailansicht Kollege)
- Keine Animationen verwendet
- Zahlen in jeder Szene deutlich lesbar markiert
- Aussage „Schichten/Positionen statt Stunden“ enthalten
- Keine erfundenen Inhalte

Zusatzregeln:
- Keine Animationen beschreiben oder voraussetzen.
- Erlaubt sind nur statische Hervorhebungen innerhalb der zwei Screenshots.
- Kein visuelles Overdesign.
- Keine Emojis.
- Deutsche Sprache, professionelle Rechtschreibung.

Arbeite jetzt die drei Blöcke vollständig aus.
```