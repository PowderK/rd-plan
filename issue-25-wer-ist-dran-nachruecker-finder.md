# Issue 025: Intelligente Nachrücker-Suche bei RTW-Ausfall („Wer ist dran?“-Button)

## 1. Ausgangslage & Zielstellung

Im Rettungsdienst- und Wachalltag kommt es regelmäßig zu kurzfristigen Personalausfällen auf den Einsatzfahrzeugen (insbesondere RTW), z. B. durch akute Krankmeldungen oder unvorhergesehene Abwesenheiten.

### Festgelegte Rahmenbedingungen
1. **Ausschließlich Wachpräsenz**: Es werden **keine Kollegen aus dem Frei angerufen**. Es kommen ausschließlich Kolleginnen und Kollegen in Betracht, die am Schichttag **bereits ein `V` (24h-Dienst auf der Wache)** im Dienstplan haben und intern auf den RTW umgesetzt werden können.
2. **Ganzheitliches Punktesystem statt starrem Einzelkriterium**:  
   Die Auswahl darf nicht ausschließlich am Schichtdefizit hängen. Ein Kollege mit Schichtschuld wird z. B. bei einer Nachtschicht abgewertet, wenn er bereits ein starkes Nacht-Übergewicht hat oder an seinem letzten Wachdienst bereits eine RTW-Nacht gefahren ist.
3. **Direkte 1-Klick-Zuweisung mit voller Transparenz**:  
   Keine Bestätigungs-Popups. Die verfügbaren Kollegen werden nach Gesamt-Score (0–100 Punkte) gereiht, inklusive aller Boni und Abzüge direkt in der Zeile.

---

## 2. Filter- & Ausschluss-Stufe (Muss-Kriterien)

Ein Kollege wird **sofort ausgeschlossen**, wenn:
1. **Kein `V` am Tag**: Die Person hat an diesem Tag keinen 24h-Wachdienst (`V`).
2. **Fehlende Qualifikation**:
   * Bei Besetzung als **Fahrzeugführer**: Ausschluss aller Personen ohne `Fahrzeugführer RTW` (Notfallsanitäter, Qualifikations-ID 22).
   * Bei Besetzung als **Maschinist**: Ausschluss aller Personen ohne entsprechende Maschinisten-Qualifikation/Fahrerlaubnis.
3. **Bereits auf einem Einsatzfahrzeug gebunden**:
   * Die Person ist am selben Tag bereits auf einem anderen Slot eingeteilt (z. B. `nef1_assist`, `itw_row_1` oder zweiter RTW).
4. **Gesetzliche Ruhezeiten (11h ArbZG)**:
   * Bei Ausfall einer **Tagschicht** (07:00–19:00 Uhr): Kollege darf in der Vornacht **keine Nachtschicht** (19:00–07:00 Uhr) gefahren sein.
   * Bei Ausfall einer **Nachtschicht** (19:00–07:00 Uhr): Kollege darf am Folgetag **keine Tagschicht** (07:00–19:00 Uhr) antreten.

---

## 3. Das ausgewogene Punktesystem (0 bis 100 Punkte)

Alle qualifizierten Wach-Kollegen mit `V` werden anhand von **5 Kriterien mit Boni und Abzügen** bewertet:

| Kriterium / Dimension | Gewichtung | Logik (Boni & Abzüge) |
| :--- | :---: | :--- |
| **1. Schichtsaldo / Nachholbedarf** | **Max. 25 Pkt.** | • Pro Minusschicht / EZ-Nachholbedarf: **+5 Punkte**<br>• Pro Plus-Schicht über Soll: **-5 Punkte (Abzug)** |
| **2. Tag/Nacht-Balance zur Schicht** | **Max. 25 Pkt.** | • Bei Nacht-Ausfall: Kollege hat mehr Tag- als Nachtdienste $\rightarrow$ **+15 bis +25 Punkte**.<br>• Bei Nacht-Ausfall: Kollege hat bereits starkes Nacht-Übergewicht $\rightarrow$ **-15 Punkte (Abzug!)**.<br>*(Umgekehrt bei Tagschicht)* |
| **3. Vorschicht-Belastung (Kettenvermeidung)** | **Max. 20 Pkt.** | • Kollege hatte an seinem vorangegangenen Wachdienst denselben Schichttyp (z. B. Nachtschicht) $\rightarrow$ **-15 Punkte (Abzug)** zur Vermeidung von Nacht-auf-Nacht-Ketten!<br>• Vorheriger Dienst war Tagdienst oder kein RTW $\rightarrow$ **+15 bis +20 Punkte**. |
| **4. RTW-Abstinenz (Rotation)** | **Max. 15 Pkt.** | • Letzter RTW-Einsatz liegt > 30 Tage zurück: **+15 Punkte**<br>• Letzter RTW-Einsatz liegt 15–30 Tage zurück: **+10 Punkte**<br>• Vor weniger als 7 Tagen auf RTW gewesen: **0 Punkte** |
| **5. Wochenend-Gerechtigkeit** | **Max. 15 Pkt.** | *(Gilt nur an Samstagen, Sonntagen und Feiertagen)*<br>• Unterdurchschnittlich viele WE-Schichten im Jahr: **+15 Punkte**<br>• Bereits überdurchschnittlich viele WE-Schichten: **-10 Punkte** |

---

## 4. UI/UX: Dialog & Entscheidungsnachvollziehbarkeit

Beim Klick auf `[🔍 Wer ist dran?]` öffnet sich das Modal:

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│  🔍 WER IST DRAN? – RTW 1 NACHTSCHICHT (19:00 – 07:00 Uhr)                                   │
│  Datum: Freitag, 20.11.2026 | Position: Fahrzeugführer (NotSan)                             │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│  Kandidaten-Ranking nach Gesamt-Score:                                                       │
│                                                                                             │
│  [1] Kollege 14                     Score: 82 Punkte               [ Sofort zuweisen ]      │
│      ✓ Tag/Nacht-Balance: +25 Pkt. (11 Tag / 5 Nacht -> benötigt dringend Nachtdienste)     │
│      ✓ Vorschicht: +15 Pkt. (Hatte am letzten Dienst Tagdienst, keine Nacht-Kette)          │
│      ✓ RTW-Abstinenz: +15 Pkt. (Zuletzt RTW vor 34 Tagen)                                   │
│      ✓ Schichtkonto: +10 Pkt. (Saldo: -1 Schicht)                                           │
│      ✓ Wochenende: +17 Pkt. (Bisher erst 2 Wochenendschichten)                              │
│                                                                                             │
│  [2] Kollege 03                     Score: 68 Punkte               [ Sofort zuweisen ]      │
│      ✓ Schichtkonto: +10 Pkt. (Saldo: -1 Schicht)                                           │
│      ✓ Tag/Nacht-Balance: +15 Pkt. (Ausgeglichen: 8 Tag / 8 Nacht)                          │
│      ✓ Vorschicht: +15 Pkt. (Kein RTW am letzten Dienst)                                    │
│                                                                                             │
│  [3] Kollege 08                     Score: 41 Punkte               [ Sofort zuweisen ]      │
│      ✓ Schichtkonto: +25 Pkt. (Größtes Defizit: Saldo -3 Schichten / EZ-Rückkehrer)        │
│      ⚠ Tag/Nacht-Balance: -15 Pkt. (Bereits starkes Nacht-Übergewicht: 4 Tag / 12 Nacht!)   │
│      ⚠ Vorschicht: -15 Pkt. (Hatte am letzten Wachdienst bereits RTW-Nacht!)                │
│                                                                                             │
│  ─────────────────────────────────────────────────────────────────────────────────────────  │
│  Ausgefilterte Wach-Kollegen (mit 'V', aber nicht einsetzbar ▾)                             │
│  • Kollege 02: Fehlt Qualifikation 'Fahrzeugführer RTW'                                     │
│  • Kollege 05: Bereits auf NEF 5 eingeteilt                                                 │
│  • Kollege 11: Ruhezeitkonflikt (hatte Vornacht Nachtschicht bis 07:00 Uhr)                 │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Technische Architektur

1. **`renderer/utils/replacementFinder.ts`**:
   * Filtert auf `roster[pId][date].value === 'V'` und Qualifikation.
   * Ermittelt für jeden Kandidaten die 5 Dimensionen (inkl. Abfrage der vorangegangenen Wachschicht der Person).
   * Berechnet den Gesamt-Score und baut lesbare Begründungs-Strings mit Kennzeichnung von Boni (✓) und Abzügen (⚠).
2. **`renderer/components/WhoIsNextModal.tsx`**:
   * Schnelles Dialogfenster mit direkter Zuweisung per Mausklick.
3. **`renderer/components/MonthTabs.tsx` & `DutyRoster.tsx`**:
   * Einbindung des Trigger-Icons in RTW-Zellen.
