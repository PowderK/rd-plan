# Issue 024: Konzept zur Schichtnachholung bei Elternzeit (EZ) & Jahresübertrag von Schichtsalden

## 1. Ausgangslage & Problemstellung

In einer Abteilung der Feuer- und Rettungswache besteht der Wunsch, Kolleginnen und Kollegen, die sich in Elternzeit (Dienstart-Kürzel `EZ`) befinden, **nicht aus der rechnerischen Stärke der Abteilung herauszunehmen**, sondern sie weiterhin in die Personal- und Soll-Berechnung einzubeziehen. Die Schichten, die während der Elternzeit rechnerisch anfallen, sollen nach der Rückkehr aus der Elternzeit **nachgeholt werden**.

### Aktueller Zustand im System (Status Quo)
1. **Dienstart `EZ`**: In den Einstellungen ist `auswertung_EZ = 'off'` hinterlegt. Sobald ein Kollege an einem Tag mit `EZ` eingetragen ist, beträgt sein Anwesenheitsgewicht $w = 0$.
2. **Soll-Verteilung (Hamilton/Hare-Niemeyer)**: In Monaten mit Elternzeit wird die Person im Modul `calculation.ts` als inaktiv gewertet (`w == 0`). Die erforderlichen Fahrzeugpositionen des Monats werden zu 100 % auf die verbleibenden, anwesenden Kollegen umgelegt. Diese erhalten dadurch ein höheres Monatssoll.
3. **Jahresabschluss / Nullung**: Die Dienstplanung und Saldenberechnung in RD-Plan arbeitet streng jahresbezogen (`year`). Am 31.12. enden alle Zählungen; am 01.01. starten alle Kollegen wieder bei 0 Schichten.
4. **Kernproblem**:
   - Nimmt ein Kollege z. B. im November/Dezember Elternzeit (oder 2 Partnermonate über den Jahreswechsel), ist ein Nachholen bis zum 31.12. physisch unmöglich.
   - Bei einer Elternzeit von über einem Jahr (12–24 Monate) sammeln sich rechnerisch 35–70 Schichten an, was zu einer unüberwindbaren Schichtschuld führen würde.
   - Ein Nachholen ergibt daher **nur dann Sinn**, wenn:
     a) Ein echtes **Schichtkonto mit Jahresübertrag (Carry-Over)** existiert.
     b) Die Schichtlast während der Elternzeit von Vertretern real gefahren und auf deren Konten gutgeschrieben wird.
     c) Realistische **Deckelungen (Caps)** und **Nachhol-Raten** für Langzeit-Elternzeiten definiert sind.

---

## 2. Fachliches Konzept: Das rollierende Schichtkonto-Modell

### 2.1 Grundprinzip: "Soll läuft weiter – Vertretungsgutschrift – Zeitversetztes Nachholen"

```
Während der Elternzeit (EZ):
┌───────────────────────────┐      ┌─────────────────────────────┐
│  Kollege in Elternzeit    │      │  Vertretende Kollegen       │
│  - Reales Ist: 0 Schichten│      │  - Fahren Zusatzschichten   │
│  - Fiktives Soll: ~3 / Mon│      │  - Ist > Soll               │
│  - Saldo: -3 Schichten/Mon│      │  - Saldo: +3 Schichten/Mon  │
└───────────────────────────┘      └─────────────────────────────┘
                  │                               │
                  └────────► Jahreswechsel ◄──────┘
                    (Saldo wird NICHT genullt,
                     sondern übertragen!)
                                  │
Nach der Rückkehr aus der Elternzeit:
┌───────────────────────────┐      ┌─────────────────────────────┐
│  Rückkehrer               │      │  Entlastete Kollegen        │
│  - Erhält Regelsoll       │      │  - Erhalten Regelsoll       │
│  - Fährt Nachhol-Schichten│      │  - Müssen weniger fahren    │
│  - Saldo baut sich ab ───►│◄─────│  - Bauen Plus-Schichten ab  │
└───────────────────────────┘      └─────────────────────────────┘
```

1. **Einrechnung in die Stärke während EZ**:
   - Die Person wird bei aktiver Option im Monat trotz `EZ` mit einem kalkulatorischen Soll belegt (z. B. auf Basis ihrer Plan-Schichten im 21-Tage-Rhythmus der Abteilung).
   - *Effekt auf die Abteilung*: Das Monats-Soll der anwesenden Kollegen steigt rechnerisch **nicht** künstlich an.
2. **Reale Schichtabdeckung (Ist)**:
   - Da die Fahrzeuge (RTW, NEF, ITW) trotz Elternzeit besetzt werden müssen, fahren die Kollegen vor Ort real mehr Schichten als ihr Soll.
   - Auf dem Schichtkonto der Vertretenden entsteht ein **Guthaben (+Schichten)**.
   - Auf dem Schichtkonto des EZ-Kollegen entsteht ein **Rückstand (-Schichten)**.
3. **Nachholphase**:
   - Nach Beendigung der `EZ` muss der Rückkehrer zusätzliche Schichten übernehmen (z. B. 1–2 Schichten/Monat zusätzlich zum Monatssoll).
   - Die Kollegen mit Schichtguthaben werden im gleichen Maße entlastet, bis alle Konten ausgeglichen sind.

### 2.2 Verteilungsprinzip: Kollektiv-Modell (Mehrheit) vs. 1-zu-1-Tausch

Eine zentrale Frage bei der Ausgestaltung ist, ob Schichten **gezielt von einzelnen Kollegen 1-zu-1** übernommen oder **von der Mehrheit der Abteilung gemeinsam** getragen werden:

| Kriterium | Kollektiv-Modell (Empfohlen) | 1-zu-1 Patenschaft / Tausch |
| :--- | :--- | :--- |
| **Mechanik** | Die Vertretungsschichten verteilen sich flexibel auf alle anwesenden Kollegen der Abteilung. Nach Rückkehr entlastet der Rückkehrer den gesamten Abteilungs-Pool. | Eine feste Person A übernimmt Schichten von Person B und bekommt diese nach Rückkehr von Person B exakt 1-zu-1 zurück. |
| **Dienstplan-Flexibilität** | **Sehr hoch**: Jeder anwesende Kollege übernimmt anteilig minimal mehr (z. B. +0,2 Schichten/Monat). | **Sehr starr**: Erfordert feste Terminabsprachen und schränkt die Einteilung massiv ein. |
| **Qualifikationen** | **Unkritisch**: Passende Qualifikationen (Fahrzeugführer, Maschinist, NotSan, NEF) werden tageweise aus dem Dienstbesetzungs-Pool besetzt. | **Problembehaftet**: Tauschpartner müssen exakt dieselben Qualifikationen besitzen. |
| **Personalbewegungen** | **Robust**: Scheidet ein Kollege aus oder wechselt die Wachabteilung, gleicht der Gesamt-Pool dies aus. | **Hohes Ausfallrisiko**: Verlässt der Tauschpartner die Wache oder erkrankt langwierig, "platzt" der Tausch. |
| **System-Integration** | Passt nahtlos zum Hamilton-Verfahren und dem Anwesenheits-Algorithmus von RD-Plan. | Erfordert separate bilaterale Kontoführung je Personenpaar. |

**Fazit & Empfehlung**:
Im RD-Plan wird das **Kollektiv-Modell (Solidarmodell der Abteilung)** umgesetzt. Individuelle, kurzfristige Diensttäusche zwischen zwei Kollegen für einzelne Tage bleiben davon unberührt und laufen separat über den regulären Diensttausch.

---

## 3. Detail-Herausforderungen & Lösungsansätze

### 3.1 Das Jahreswechsel-Problem (Jahresübertrag / Carry-Over)

#### Problem
Beginnt die Elternzeit im November (z. B. 2 Monate Nov–Dez oder Nov–Jan), beträgt das Defizit am Jahresende z. B. -6 Schichten. Wird das System am 31.12. genullt, verfällt der Anspruch auf Nachholung, und die Vertreter bleiben auf ihren Mehrschichten sitzen.

#### Lösung: Mandanten-/Abteilungsfähiger Schichtsaldo-Übertrag
* Jede Abteilung kann in den Einstellungen festlegen:
  * `Schichtsalden am Jahresende nullen`: **Ja** (Standard) / **Nein (Jahresübertrag aktivieren)**.
* Bei aktiviertem Übertrag wird zum 31.12. für jede Person ein Endsaldo berechnet:
  $$\text{Übertrag ins Folgejahr} = \text{Startsaldo} + \sum \text{Ist-Schichten} - \sum \text{Soll-Schichten}$$
* Beim Wechsel in das neue Planungsjahr (`year + 1`) startet jeder Kollege mit diesem Startsaldo.

---

### 3.2 Elternzeit über mehr als ein Jahr (Langzeit-Elternzeit)

#### Problem
Nimmt eine Person 12, 18 oder 24 Monate Elternzeit:
* Bei ca. 3 Schichten/Monat entstünden nach 18 Monaten **-54 Schichten Rückstand**.
* Bei einem regulären Jahresvolumen von ca. 30–35 Schichten müsste die Person nach Rückkehr über 1,5 Jahre lang die **doppelte Schichtanzahl** fahren. Dies verstößt gegen Arbeitszeitgesetz (ArbZG), Feuerwehr-Dienstvorschriften, Ruhezeiten und Fürsorgepflichten.

#### Lösungsstufen (Konfigurierbare Regelwerke)

Wir empfehlen ein **3-Stufen-Modell**:

| Elternzeit-Dauer | Einstufung | Regelung |
| :--- | :--- | :--- |
| **1 bis 3 Monate** *(Kurzzeit / Partnermonate)* | **Vollständiges Nachholen** | 100 % der ausgefallenen Schichten werden nachgeholt (z. B. 3–9 Schichten). Nachholung gestreckt auf 6–12 Monate. |
| **4 bis 12 Monate** *(Regel-Elternzeit)* | **Gedeckeltes Nachholen (Cap)** | Das Nachholkonto wird auf maximal **X Schichten** (z. B. **12 Schichten**) gedeckelt. Darüber hinausgehende Schichten verfallen neutral (werden als dienstfreie Zeit ohne Schichtschuld gebucht). |
| **> 12 Monate** *(Langzeit / Mehrjährig)* | **Ruhende Stärke ab Monat 13** | Ab dem 13. Monat wird die Person automatisch aus der Stärke genommen ($w = 0$, wie bisherige `EZ`-Logik). Es laufen ab Monat 13 keine weiteren Minusschichten mehr auf. Die Planstelle gilt für diesen Zeitraum als vakant / Springerbedarf. |

> [!IMPORTANT]
> **Optionale Schichtschuld-Deckelung (Max-Cap)**:
> In den Abteilungs-Einstellungen sollte ein Schwellenwert definiert werden können:
> `Maximale Schichtnachholung bei Elternzeit (Deckel)`: z. B. **12 Schichten**.

---

### 3.3 Nachhol-Quote & Dienstplan-Dämpfung (Rückkehrphase)

Wie werden die Nachhol-Schichten nach der Rückkehr verplant?

1. **Automatische Soll-Erhöhung (Soll + Nachhol-Rate)**:
   * Ist das Nachholkonto negativ (z. B. -8), wird dem monatlichen Hamilton-Soll automatisch ein Zuschlag von z. B. **+1 Schicht pro Monat** hinzugefügt, solange das Konto negativ ist.
   * Beispiel: Normales Monatssoll = 3 Schichten $\implies$ Temporäres Monatssoll = 4 Schichten.
   * Dauer des Ausgleichs bei -8 Schichten: 8 Monate.
2. **Manuelle Zuweisung mit Kontrollanzeige (Empfohlen)**:
   * Das berechnete Monatssoll bleibt das reguläre Soll.
   * In der Monatsansicht (`MonthTabs.tsx`) und Werteübersicht (`ValuesPage.tsx`) wird neben dem Jahressaldo ein Badge angezeigt:
     `EZ-Nachholbedarf: 6 Schichten offen`.
   * Der Planer teilt den Kollegen gezielt für Mehrdienste ein. Jede gefahrene Schicht über Monatssoll reduziert den Nachholbedarf automatisch.

---

### 3.4 Teilzeit während der Elternzeit (Elternteilzeit)

Arbeitet ein Kollege während der Elternzeit mit reduzierter Wochenarbeitszeit (z. B. 50 % = Elternteilzeit):
* Das Soll während dieser Monate wird proportional reduziert (z. B. 50 % von 3 Schichten = 1,5 Schichten).
* Fährt der Kollege 1 Schicht, beträgt das Monatsdelta lediglich -0,5 Schichten statt -3 Schichten.
* Dadurch wird vermieden, dass Teilzeitkräfte unverhältnismäßig viele Schichten nachholen müssen.

---

## 4. Technische Umsetzungsarchitektur (Design-Vorschlag)

### 4.1 Datenbank-Erweiterungen (SQLite)

#### Neue Tabelle: `personnel_shift_balance` (Schichtsalden & Überträge)
```sql
CREATE TABLE IF NOT EXISTS personnel_shift_balances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    person_id INTEGER NOT NULL,
    year INTEGER NOT NULL,
    start_balance REAL NOT NULL DEFAULT 0.0,    -- Übertrag aus Vorjahr
    ez_carryover REAL NOT NULL DEFAULT 0.0,     -- Spezifischer EZ-Nachholbedarf
    manual_adjustment REAL NOT NULL DEFAULT 0.0,-- Manuelle Korrektur durch Admin/Planer
    note TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(person_id, year),
    FOREIGN KEY(person_id) REFERENCES personnel(id) ON DELETE CASCADE
);
```

#### Neue Einstellungen (`settings`-Tabelle)
* `feature_ez_nachholen_[department]`: `'true'` / `'false'` (Abteilungsweises Ein-/Ausschalten)
* `ez_max_catchup_shifts_[department]`: z. B. `'12'` (Maximale Schichten, die nachgeholt werden müssen)
* `ez_catchup_rate_monthly_[department]`: z. B. `'1'` (Max. Schichten pro Monat zur Nachholung)
* `feature_year_carryover_[department]`: `'true'` / `'false'` (Jahresübertrag von Schichten aktivieren)

---

### 4.2 Logik-Anpassungen (Kalkulation)

1. **`renderer/utils/calculation.ts`**:
   * Prüfung in `computeWeightedPresence`:
     * Wenn `feature_ez_nachholen == true` und Tag hat `EZ`:
       * Prüfe, ob kumulierte EZ-Monate $\le 12$ sind und Deckel noch nicht erreicht ist.
       * Falls ja: Person erhält kalkulatorisches Anwesenheitsgewicht $w > 0$ (z. B. Regelturnus der Abteilung).
   * In `calculateTargetsWithDetails`:
     * Hamilton verteilt die Schichten unter Einbeziehung des fiktiven EZ-Gewichts.
     * Ausgabe des EZ-Nachholbedarfs in `CalculationResultDetails`.
2. **Jahresabschluss / Jahreswechsel-Routine (`main/database.ts`)**:
   * Beim Anlegen eines neuen Jahres oder Jahresabschluss:
     * Berechne für jeden Mitarbeiter: $Endsaldo = Startsaldo + Ist - Soll$.
     * Schreibe $Endsaldo$ als $Startsaldo$ in `personnel_shift_balances` für das Folgejahr.

---

### 4.3 UI-Erweiterungen

1. **Dienstplan-Header / Sidebar (`MonthTabs.tsx`)**:
   * Anzeige des aktuellen Kontostands:
     `Saldo 2026: +2 (inkl. -4 EZ-Nachholbedarf)`.
2. **Werte-Seite (`ValuesPage.tsx`)**:
   * Eigene Zeile bzw. Spalte in der KPI-Tabelle:
     * `EZ-Monate im Jahr`
     * `Aufgelaufener EZ-Nachholbedarf`
     * `Bereinigter Schichtsaldo (Übertrag Folgejahr)`
3. **Einstellungen (`SettingsMenu.tsx`)**:
   * Neuer Reiter bzw. Bereich unter Abteilungsoptionen:
     * Checkbox: *„Schichten aus Elternzeit (EZ) nachholen“*
     * Eingabefeld: *„Maximale Nachhol-Schichten (Deckelung, Standard: 12)“*
     * Checkbox: *„Schichtsalden ins Folgejahr übertragen (keine Nullung am 31.12.)“*

---

## 5. Chancen, Risiken & Empfehlungen

| Aspekt | Bewertung & Empfehlung |
| :--- | :--- |
| **Gerechtigkeit in der Abteilung** | **Hoch**: Kollegen, die die Vertretung fahren, werden entlastet, sobald der Kollege zurückkehrt. |
| **Planungsaufwand** | **Mittel**: Erfordert transparente Schichtkonten und Nachverfolgbarkeit. |
| **Langzeit-Ausfall (> 1 Jahr)** | **Kritisches Risiko**: Ein ungedeckeltes Nachholen nach 1–2 Jahren Elternzeit ist arbeitsschutzrechtlich unzulässig. **Zwingend Deckel (z. B. max. 10–12 Schichten) vorsehen!** |
| **Abteilungs-Autonomie** | **Sehr wichtig**: Da das Konzept nicht für jede Abteilung passt, muss es als **optionales Feature-Flag pro Abteilung** realisiert werden. |

---

## 6. Nächste Schritte zur Freigabe

1. **Abstimmung mit der anfragenden Abteilung**:
   * Einigung auf maximale Nachhol-Schichten (z. B. 12 Schichten).
   * Festlegung der Nachhol-Geschwindigkeit (z. B. max. 1 zusätzliche Schicht pro Monat).
   * Festlegung des Stichtags für den ersten Jahresübertrag (z. B. Wechsel 2026 auf 2027).
2. **Umsetzungsphasen**:
   * **Phase 1**: Datenmodell für Schichtkonto & Jahresübertrag (`personnel_shift_balances`).
   * **Phase 2**: Erweiterung des Berechnungsalgorithmus in `calculation.ts` (Fiktive Stärke bei `EZ`).
   * **Phase 3**: UI-Anzeigen in Monatsansicht, Werte-Tab und Einstellungen.

