# Issue 026: Sperrschichten für HLF-B Fahrzeugführer mit Jahreskontingent & Selbsteintragung

## 1. Ausgangslage & Zielstellung

Kolleginnen und Kollegen mit der Qualifikation **Fahrzeugführer HLF-B** (Hilfeleistungslöschfahrzeug B) nehmen im Wachalltag regelmäßig feuerwehrtechnische Sonder- und Führungsaufgaben wahr (z. B. Ausbildungsdienste, Werkstatt- und Gerätewartung, Atemschutzwerkstatt, Brandschutzprüfungen oder organisatorische Aufgaben).

An diesen Tagen haben die Kollegen regulär 24h-Dienst auf der Wache (`V`), sollen aber **nicht für den Rettungsdienst (RTW, NEF, ITW) eingeteilt werden**, um ihre Sonderaufgaben ungestört wahrnehmen zu können.

### Ziel
Einführung einer **Sperrschicht-Funktion**, mit der sich HLF-B-Fahrzeugführer an Tagen mit Wachdienst (`V`) selbst für den Rettungsdienst sperren können, begrenzt durch ein im Admin-Bereich festgelegtes **jährliches Maximalkontingent**.

---

## 2. Fachliche Anforderungen & Rahmenbedingungen

### 2.1 Berechtigter Personenkreis
* Ausschließlich Kolleginnen und Kollegen, die im betreffenden Zeitraum die aktive Qualifikation **„Fahrzeugführer HLF-B“** besitzen (geprüft über `qualification_periods` bzw. Qualifikationstyp HLF-B).
* Für alle anderen Kollegen ohne HLF-B-Qualifikation ist die Funktion deaktiviert bzw. unsichtbar.

### 2.2 Voraussetzung für die Sperrung
* Eine Sperrschicht kann **ausschließlich an Tagen eingetragen werden, an denen die Person bereits ein `V` (24h-Dienst auf der Wache) im Dienstplan hat**.
* An freien Tagen (`**`), Urlaubstagen (`U`), Krankheitstagen (`K`) etc. kann keine Sperrschicht gesetzt werden.

### 2.3 Jahreskontingent (Admin-Vorgabe)
* Im Admin-Bereich (`Einstellungen -> Allgemein / Qualifikationen`) wird eine Obergrenze definiert:
  * Einstellungs-Schlüssel: `hlfb_max_sperrschichten_per_year` (z. B. **4** oder **6** Sperrschichten pro Jahr).
* **Validierung**:
  * Sobald ein HLF-B-Fahrzeugführer sein Jahreskontingent erreicht hat, wird das Eintragen weiterer Sperrschichten für das laufende Kalenderjahr blockiert.
  * Fehlermeldung: *„Das jährliche Kontingent von maximal X Sperrschichten für [Jahr] ist bereits ausgeschöpft.“*
* **Transparenter Zähler**:
  * Sowohl für den Kollegen selbst als auch für den Wachabteilungsleiter/Planer wird der aktuelle Verbrauch angezeigt (z. B. `HLF-B Sperrschichten: 3 / 4 genutzt`).

### 2.4 Selbsteintragung im Dienstplan
* HLF-B-Fahrzeugführer können sich ihre Sperrschichten **eigenständig im Dienstplan eintragen**, selbst wenn sie nur über die reguläre Rolle „User“ verfügen.
* **Ablauf**:
  1. Der Kollege klickt im Dienstplan auf seine Zelle an einem Tag mit `V`.
  2. Im Menü / Kontextdialog erscheint die Option: **„🔒 Als HLF-B Sperrschicht markieren“** (inkl. Anzeige des Restkontingents).
  3. Nach Bestätigung wird die Zelle optisch gekennzeichnet (z. B. `V` mit einem dezenten Sperrschild-Symbol 🔒 oder farblicher Markierung).
  4. Die Sperre kann vom Kollegen (oder Planer) an diesem Tag auch wieder aufgehoben werden, wodurch das Kontingent wieder freigegeben wird.

---

## 3. Auswirkungen auf die Dienstplanung & Algorithmen

1. **Einteilung (`MonthTabs.tsx`)**:
   * Bei der Besetzung von **RTW, NEF und ITW** ist der Kollege an gesperrten Tagen nicht auswählbar.
   * In den Auswahl-Dropdowns erscheint er ausgegraut oder mit Warnsymbol:  
     `[Gesperrt: HLF-B Sperrschicht (Sonderaufgabe)]`.
2. **„Wer ist dran?“-Nachrücker-Suche (Issue 025)**:
   * Kolleginnen und Kollegen mit aktiver HLF-B-Sperrschicht werden in **Stufe 1 (Muss-Filter)** sofort herausgefiltert. Sie werden bei RTW-Ausfällen nicht als Nachrücker vorgeschlagen.
3. **Anwesenheits- & Soll-Berechnung (`calculation.ts`)**:
   * Da der Kollege den 24h-Dienst (`V`) auf der Wache leistet, bleibt seine Grundanwesenheit auf der Wache unberührt.
   * Für die Rettungsdienst-Fahrzeugpositionen an diesem Tag steht er jedoch nicht zur Verfügung.

---

## 4. Technisches Datenmodell & Architektur

### 4.1 Datenbank (SQLite)
Zur sauberen Trennung vom Dienstplanwert `V` wird eine dedizierte Tabelle eingeführt:

```sql
CREATE TABLE IF NOT EXISTS hlfb_blocked_shifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    person_id INTEGER NOT NULL,
    date TEXT NOT NULL,                  -- Format YYYY-MM-DD
    created_by TEXT,                     -- Benutzer/Rolle
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(person_id, date),
    FOREIGN KEY(person_id) REFERENCES personnel(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_hlfb_blocked_date ON hlfb_blocked_shifts(date);
CREATE INDEX IF NOT EXISTS idx_hlfb_blocked_person_year ON hlfb_blocked_shifts(person_id, substr(date, 1, 4));
```

* **Vorteil**: Der Eintrag in `duty_roster` bleibt unverändert (`value = 'V'`), sodass keine Seiteneffekte auf bestehende Anwesenheitsberechnungen entstehen.

### 4.2 Neue Einstellungen (`settings`-Tabelle)
* `hlfb_max_sperrschichten_per_year`: Integer (Standardwert: `4`)
* `hlfb_sperrschichten_enabled`: `'true'` / `'false'` (Globales Feature-Flag)

### 4.3 API & Berechtigungs-Endpunkte
* `getHlfbBlockedShifts(year: number, personId?: number)`: Liefert alle Sperrschichten des Jahres.
* `toggleHlfbBlockedShift(personId: number, date: string)`:
  * Prüft:
    1. Besitzt die Person die Qualifikation `Fahrzeugführer HLF-B`?
    2. Ist am Datum `value === 'V'` im `duty_roster` vorhanden?
    3. Ist das Jahreskontingent noch nicht erschöpft?
  * Setzt bzw. entfernt den Sperreintrag.
  * Schreibt einen Eintrag ins Audit-Log (`[Audit] HLF-B Sperrschicht für Kollege X am YYYY-MM-DD eingetragen/entfernt`).

---

## 5. UI/UX-Gestaltung

1. **Dienstplan-Zelle (`DutyRoster.tsx`)**:
   * Ein Tag mit HLF-B-Sperre zeigt z. B. ein kleines Schloss-Icon: `V 🔒`.
   * Tooltip beim Überfahren:  
     *„HLF-B Sperrschicht: Kollege ist für Sonderaufgaben eingeteilt und für Rettungsdienst-Fahrzeuge gesperrt.“*
2. **Kontingent-Übersicht**:
   * Im Kontrollkasten / Sidebar der Monatsansicht und im Profil des Mitarbeiters:
     `HLF-B Sperrschichten 2026: 2 von 4 verbraucht (2 verbleibend)`.
3. **Adminbereich (`SettingsMenu.tsx`)**:
   * Eingabefeld unter dem Bereich Feuerwehr / HLF-B:
     *„Maximale HLF-B Sperrschichten pro Kalenderjahr: [ 4 ]“*.

---

## 6. Vorteile

* **Verlässlichkeit für Sonderaufgaben**: HLF-B-Führungskräfte können Werkstatt-, Ausbildungs- oder Verwaltungstage planen, ohne spontan auf den RTW gezogen zu werden.
* **Schutz vor Übernutzung**: Das fixe Jahreskontingent stellt sicher, dass Sperrschichten maßvoll und gerecht genutzt werden.
* **Entlastung der Planer**: Kollegen tragen ihre Sperrtage selbst ein – der Planer sieht in der Einteilung sofort, wer verfügbar ist und wer nicht.
