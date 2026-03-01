# NotebookLM Prompt (vorausgefüllt) – SOLL/IST-Berechnung

```text
Rolle:
Du bist Redaktions- und Produktionsassistenz für ein Erklärvideo zur RD-Plan-App.
Deine Aufgabe ist die Erstellung eines vollständigen Video-Skripts auf Basis der bereitgestellten Quelle zur SOLL/IST-Berechnung.

Ziel:
Erzeuge ein verständliches, fachlich präzises Video mit persönlichem, seriösem Ton.

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
  - Intro
  - 1) Normale Erzeugung der SOLL-Schichten
  - 1.1) Sonderfall HLF-B FzF (75%)
  - Beispiel Verteilung
  - 1.2) Warum Hamilton und nicht normale Rundung?
  - 2) Einfluss von Azubis, Ü50 und LPAL
  - 3) Gezielte Schichtübernahme
  - Abschluss

Assetregeln (verbindlich):
- Nutze ausschließlich die folgenden PNG-Dateien.
- Dateinamen müssen exakt so verwendet werden:
  - S1.png, S2.png, S3.png, S4.png, S5.png, S6.png, S7.png, S8.png
  - A1.png, A2.png, A3.png, A4.png, A5.png, A6.png, A7.png
- Keine neuen Dateinamen erfinden.
- Wenn ein Asset fehlt, markiere nur: [BENÖTIGT: Dateiname].

Inhaltsquelle (verbindlich):
- Nutze ausschließlich die bereitgestellte RD-Plan-Quelle zur SOLL-Schichten-Berechnung (ohne ITW).
- Keine Funktionen oder Aussagen ergänzen, die nicht in der Quelle enthalten sind.

Vorgegebene Szenen- und Asset-Struktur (verbindlich übernehmen):
1) Intro (0:00–0:20)
   - Visual: Monatsübersicht als Einstieg
   - Assets: S1.png
   - Animation: kurzer Fade-in auf relevanten Bereich

2) 1) Normale Erzeugung der SOLL-Schichten (0:20–2:00)
   - Visual: Bedarfsermittlung und Grundformel
   - Assets: S1.png, S2.png, A1.png, A2.png
   - Animation: Formel und Rechenweg schrittweise einblenden
   - Pflichtinhalt: Klar sagen, dass mit Schichten/Positionen gerechnet wird, nicht mit Stunden

3) 1.1) Sonderfall HLF-B FzF (75%) (2:00–3:00)
   - Visual: Vorher/Nachher Gewichtung
   - Assets: S4.png, A3.png
   - Animation: 20 → ×0,75 → 15 als Zahlen-Transition

4) Beispiel Verteilung (3:00–4:00)
   - Visual: Verteilungstabelle A/B/C
   - Assets: S5.png
   - Animation: schrittweise Hervorhebung der Endwerte

5) 1.2) Warum Hamilton und nicht normale Rundung? (4:00–4:45)
   - Visual: Rundungsproblem und Restvergabe
   - Assets: S5.png, A4.png
   - Animation: erst Abrundung, dann Restschichten nacheinander vergeben

6) 2) Einfluss von Azubis, Ü50 und LPAL (4:45–6:15)
   - Visual: Abzug vom Gesamtpool
   - Assets: S6.png, A5.png
   - Animation: Count-down von Gesamtbedarf auf Restpool

7) 3) Gezielte Schichtübernahme (6:15–7:45)
   - Visual: Übernahme + Gegenreduktion
   - Assets: S7.png, A6.png
   - Animation: +4 bei übernehmender Person, proportionale Anpassung im Restpool

8) Abschluss (7:45–8:15)
   - Visual: Endkontrolle und Zusammenfassung
   - Assets: S8.png, A7.png
   - Animation: 5-Schritte-Recap nacheinander einblenden

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
6) Visual (Screenshot/Animation)
7) Asset-Datei
8) Animation/Bewegung
9) On-Screen-Text (kurz, optional)

BLOCK 3 – QUALITÄTSPRÜFUNG
Checkliste mit genau diesen Punkten:
- Sprache klar und ohne Floskeln
- Ton persönlich-seriös
- Jeder Abschnitt hat korrekten Header
- Asset-Namen exakt gemäß Vorgabe
- Aussage „Schichten/Positionen statt Stunden“ enthalten
- Keine erfundenen Inhalte

Zusatzregeln:
- Verwende nur einfache Animationen: Zoom, Highlight, Fade, Cursor-Klick.
- Kein visuelles Overdesign.
- Keine Emojis.
- Deutsche Sprache, professionelle Rechtschreibung.

Arbeite jetzt die drei Blöcke vollständig aus.
```