# Überprüfung: Monatsimport-Validierungen

## Status: 6. Januar 2026

### ✅ FUNKTIONIERENDE Validierungen:

#### 1. Azubi-Zeiträume Validierung
**Datei:** `main/roster-importer.ts` (Zeilen 175-236)
**Funktion:** `checkAzubiPeriods()`

**Status:** ✅ FUNKTIONIERT

**Was wird geprüft:**
- Alle Azubis, die im Import vorkommen
- Ob für den Import-Zeitraum (Start- bis Enddatum) ein überlappender Zeitraum existiert
- Zeitraum überlappt wenn: `period.start_date <= importEnd && period.end_date >= importStart`

**Ausgabe:**
```typescript
azubisWithoutPeriod: Array<{
    azubiId: number;
    azubiName: string;
    importDateRange: { start: string; end: string };
}>
```

**Verwendung im Import:**
- Zeile 683: `const azubisWithoutPeriod = await this.checkAzubiPeriods(entriesToImport, year, month);`
- Zeile 685-708: Wenn Azubis ohne Zeitraum gefunden werden:
  - Option 1: User kann Zeiträume anpassen (via `options.azubiPeriodAdjustments`)
  - Option 2: Import wird abgebrochen mit Fehlermeldung

**Test:**
✓ Prüfung erfolgt vor dem Import
✓ User bekommt Dialog mit Liste der betroffenen Azubis
✓ User kann Zeiträume anlegen oder Import abbrechen


#### 2. Verfügbarkeitskonflikte
**Datei:** `main/roster-importer.ts` (Zeilen 95-172)
**Funktion:** `checkAvailabilityConflicts()`

**Status:** ✅ FUNKTIONIERT

**Was wird geprüft:**
- Alle Personen, die eine Fahrzeugzuweisung haben (RTW, NEF, ITW)
- Ob die neue Schichtart aus dem Import "nicht verfügbar" bedeutet (auswertung='off')
- Konflikt = Person auf Fahrzeug eingeteilt ABER neue Schichtart ist K (Krank), U (Urlaub), F (Frei), etc.

**Ausgabe:**
```typescript
availabilityConflicts: Array<{
    personName: string;
    date: string;
    dutyRosterValue: string;      // z.B. "K" für Krank
    einteilungValue: string;       // z.B. "rtw1_tag_1"
}>
```

**Verwendung im Import:**
- Zeile 722: `const availabilityConflicts = await this.checkAvailabilityConflicts(entriesToImport);`
- Zeile 730: Konflikte werden im Result zurückgegeben

**Test:**
✓ Prüfung erfolgt vor dem Import
✓ Konflikte werden in Result zurückgegeben
⚠️ User bekommt KEINE automatische Warnung (Frontend muss Konflikte anzeigen)


### ⚠️ FEHLENDE Validierung:

#### 3. Gelöschte/Inaktive Personen
**Status:** ❌ NICHT IMPLEMENTIERT

**Problem:**
Wenn eine Person im Excel vorkommt, aber in der Datenbank gelöscht oder inaktiv ist:
- Person wird beim Namens-Matching nicht gefunden (`personInfo` bleibt `null`)
- Zeile wird stillschweigend übersprungen (`continue` in Zeile 545)
- **User bekommt KEINE Warnung**, dass Personen fehlen

**Code-Stelle:**
`main/roster-importer.ts`, Zeilen 524-545:
```typescript
let personInfo = fullNameMap.get(keyFull) || null;

if (!personInfo) {
    const keyLast = normalizeLastName(rawName);
    // mapping override first
    const mappedId = mapByLastName[keyLast];
    if (mappedId && idMap.has(mappedId)) {
        personInfo = idMap.get(mappedId)!;
    } else {
        const ln = lastNameMap.get(keyLast);
        if (ln && ln !== 'conflict') personInfo = ln;
        else if (ln === 'conflict') {
            console.warn(`[RosterImporter] Mehrdeutiger Nachname '${rawName}' – übersprungen.`);
            continue;
        }
    }
}

if (!personInfo) continue;  // ← HIER: Stille Übersprung ohne Warnung!
```

**Beispiel-Szenario:**
1. Excel-Vorplanung enthält "Müller, Hans" mit Einteilungen
2. "Müller, Hans" wurde in der App gelöscht oder ist inaktiv
3. Beim Monatsimport wird die Zeile einfach ignoriert
4. User denkt, Müller ist eingeteilt, aber in der App fehlt er komplett
5. **KEINE WARNUNG** an den User


---

## ✅ BEHOBENE PROBLEME (Build 764):

### Frontend-Warnung für Verfügbarkeitskonflikte
**Status:** ✅ IMPLEMENTIERT (6. Januar 2026)

**Problem:**
Die Verfügbarkeitskonflikte wurden im Backend erkannt, aber das Frontend zeigte keine Warnung an.

**Lösung:**
Anpassungen in `renderer/components/DutyRoster.tsx`:

1. **Hauptimport-Handler (`handleImport`)** - Zeile ~604:
   - Prüft `result.availabilityConflicts` nach dem Import
   - Zeigt Alert mit Details zu allen Konflikten
   - Format: "Person am Datum: Schichtart (nicht verfügbar), aber eingeteilt auf Fahrzeug"

2. **Azubi-Retry-Handler (`handleCreateNewAzubis`)** - Zeile ~519:
   - Prüft Konflikte nach Azubi-Anlage und erneutem Import
   - Zeigt kombinierte Erfolgsmeldung + Konfliktwarnung

3. **ShiftType-Retry-Handler (`handleCreateNewShiftTypes`)** - Zeile ~543:
   - Prüft Konflikte nach Dienstarten-Anlage und erneutem Import
   - Zwei Stellen: Mit und ohne nachfolgende Azubi-Prüfung

**Code-Beispiel:**
```typescript
// Check for availability conflicts
let message = `Import erfolgreich: ${result.importedCount} Einträge wurden verarbeitet.`;

if (result.availabilityConflicts && result.availabilityConflicts.length > 0) {
  const conflictList = result.availabilityConflicts.map((c: any) => 
    `${c.personName} am ${c.date}: Schichtart "${c.dutyRosterValue}" (nicht verfügbar), aber eingeteilt auf "${c.einteilungValue}"`
  ).join('\n');
  
  message += `\n\n⚠️ WARNUNG: ${result.availabilityConflicts.length} Verfügbarkeitskonflikt(e) gefunden:\n\n${conflictList}\n\nBitte prüfen Sie die Einteilungen!`;
}

alert(message);
```

**Test:**
- Import mit Person, die auf Fahrzeug eingeteilt ist, aber als "Krank" oder "Urlaub" markiert wird
- Erwartung: Alert-Dialog mit Warnung nach Import


---

### ⚠️ WEITERHIN FEHLENDE Validierung:

#### 3. Gelöschte/Inaktive Personen
**Status:** ❌ NICHT IMPLEMENTIERT

**Problem:**
Wenn eine Person im Excel vorkommt, aber in der Datenbank gelöscht oder inaktiv ist:
- Person wird beim Namens-Matching nicht gefunden (`personInfo` bleibt `null`)
- Zeile wird stillschweigend übersprungen (`continue` in Zeile 545)
- **User bekommt KEINE Warnung**, dass Personen fehlen

**Code-Stelle:**
`main/roster-importer.ts`, Zeilen 524-545:
```typescript
let personInfo = fullNameMap.get(keyFull) || null;

if (!personInfo) {
    const keyLast = normalizeLastName(rawName);
    // mapping override first
    const mappedId = mapByLastName[keyLast];
    if (mappedId && idMap.has(mappedId)) {
        personInfo = idMap.get(mappedId)!;
    } else {
        const ln = lastNameMap.get(keyLast);
        if (ln && ln !== 'conflict') personInfo = ln;
        else if (ln === 'conflict') {
            console.warn(`[RosterImporter] Mehrdeutiger Nachname '${rawName}' – übersprungen.`);
            continue;
        }
    }
}

if (!personInfo) continue;  // ← HIER: Stille Übersprung ohne Warnung!
```

**Beispiel-Szenario:**
1. Excel-Vorplanung enthält "Müller, Hans" mit Einteilungen
2. "Müller, Hans" wurde in der App gelöscht oder ist inaktiv
3. Beim Monatsimport wird die Zeile einfach ignoriert
4. User denkt, Müller ist eingeteilt, aber in der App fehlt er komplett
5. **KEINE WARNUNG** an den User


### 🔧 EMPFOHLENE LÖSUNG:

**Neue Validierungsfunktion hinzufügen:**

```typescript
// In RosterImporter-Klasse
private async checkMissingPersons(
    worksheet: XLSX.WorkSheet,
    fixed: any,
    fullNameMap: Map<string, {id: number, type: 'person' | 'azubi'}>,
    lastNameMap: Map<string, {id: number, type: 'person' | 'azubi'} | 'conflict'>,
    mapByLastName: Record<string, number>,
    idMap: Map<number, {id: number, type: 'person' | 'azubi'}>
): Promise<Array<{ name: string; reason: string }>> {
    const missingPersons: Array<{ name: string; reason: string }> = [];
    const checkedNames = new Set<string>();
    
    // Durchsuche Personal-Block
    for (let row = fixed.personnelStart; row <= fixed.personnelEnd; row++) {
        const nameAddr = XLSX.utils.encode_cell({ r: row, c: fixed.nameCol });
        const nameCell = worksheet[nameAddr];
        if (!nameCell || nameCell.v == null) continue;
        
        const rawName = String(nameCell.v).trim();
        if (!rawName || checkedNames.has(rawName)) continue;
        checkedNames.add(rawName);
        
        // Prüfe ob Person existiert
        const keyFull = rawName.toLowerCase();
        let personInfo = fullNameMap.get(keyFull) || null;
        
        if (!personInfo) {
            const keyLast = normalizeLastName(rawName);
            const mappedId = mapByLastName[keyLast];
            if (mappedId && idMap.has(mappedId)) {
                personInfo = idMap.get(mappedId)!;
            } else {
                const ln = lastNameMap.get(keyLast);
                if (ln && ln !== 'conflict') {
                    personInfo = ln;
                } else if (ln === 'conflict') {
                    missingPersons.push({ 
                        name: rawName, 
                        reason: 'Mehrdeutiger Nachname - mehrere Personen gefunden' 
                    });
                    continue;
                }
            }
        }
        
        if (!personInfo) {
            missingPersons.push({ 
                name: rawName, 
                reason: 'Person nicht in Datenbank gefunden (gelöscht oder nie angelegt?)' 
            });
        }
    }
    
    // Durchsuche Azubi-Block
    for (let row = fixed.azubiStart; row <= fixed.azubiEnd; row++) {
        const nameAddr = XLSX.utils.encode_cell({ r: row, c: fixed.nameCol });
        const nameCell = worksheet[nameAddr];
        if (!nameCell || nameCell.v == null) continue;
        
        const rawName = String(nameCell.v).trim();
        if (!rawName || checkedNames.has(rawName)) continue;
        checkedNames.add(rawName);
        
        // Analog zu Personal-Block
        const keyFull = rawName.toLowerCase();
        let personInfo = fullNameMap.get(keyFull) || null;
        
        if (!personInfo) {
            const keyLast = normalizeLastName(rawName);
            const mappedId = mapByLastName[keyLast];
            if (mappedId && idMap.has(mappedId)) {
                personInfo = idMap.get(mappedId)!;
            } else {
                const ln = lastNameMap.get(keyLast);
                if (ln && ln !== 'conflict') personInfo = ln;
            }
        }
        
        if (!personInfo) {
            missingPersons.push({ 
                name: rawName, 
                reason: 'Azubi nicht in Datenbank gefunden' 
            });
        }
    }
    
    console.log(`[RosterImporter] Fehlende Personen: ${missingPersons.length}`);
    return missingPersons;
}
```

**Integration in importDutyRoster():**

Nach Zeile 705 (nach Azubi-Zeiträume-Prüfung):
```typescript
// Prüfe auf fehlende Personen im Excel
console.log(`[RosterImporter] Prüfe auf fehlende Personen...`);
const missingPersons = await this.checkMissingPersons(
    worksheet, 
    fixed, 
    fullNameMap, 
    lastNameMap, 
    mapByLastName, 
    idMap
);

if (missingPersons.length > 0) {
    console.log('[RosterImporter] Gefundene fehlende Personen:', missingPersons);
    // Option 1: Warnung anzeigen, aber Import fortsetzen
    // Option 2: Import abbrechen wenn kritische Personen fehlen
    
    // Für jetzt: Warnung im Result zurückgeben
    return {
        success: true,
        message: `Achtung: ${missingPersons.length} Person(en) aus Excel nicht in Datenbank gefunden`,
        importedCount: 0,
        missingPersons: missingPersons
    };
}
```

**Return-Type erweitern:**
```typescript
async importDutyRoster(
    filePath: string, 
    year: number, 
    month?: number, 
    options?: { /* ... */ }
): Promise<{
    success: boolean, 
    message: string, 
    importedCount: number, 
    unknownAzubis?: string[], 
    unknownShiftTypes?: string[], 
    availabilityConflicts?: AvailabilityConflict[],
    azubisWithoutPeriod?: Array<{ azubiId: number; azubiName: string; importDateRange: { start: string; end: string } }>,
    missingPersons?: Array<{ name: string; reason: string }>  // ← NEU
}>
```


### 📝 ZUSAMMENFASSUNG:

| Validierung | Status | Warnung an User | Aktion | Build |
|------------|--------|-----------------|--------|-------|
| Azubi-Zeiträume | ✅ Funktioniert | ✅ Ja, Dialog | Import stoppen oder Zeiträume anlegen | - |
| Verfügbarkeitskonflikte | ✅ Funktioniert | ✅ Ja, Alert nach Import | Manuelle Prüfung erforderlich | 764 |
| Gelöschte Personen | ❌ Fehlt | ❌ Nein | **IMPLEMENTIERUNG EMPFOHLEN** | - |


### 🎯 NÄCHSTE SCHRITTE:

1. ~~**Kritisch:** Frontend-Warnung für Verfügbarkeitskonflikte~~ ✅ Erledigt (Build 764)
2. **Kritisch:** Validierung für fehlende Personen implementieren
3. Frontend-Dialog für `missingPersons` erstellen
4. Tests schreiben für alle drei Validierungen


### 📋 TEST-CHECKLISTE:

**Zum Testen der Validierungen:**

1. **Azubi ohne Zeitraum:**
   - [ ] Azubi anlegen (z.B. "Test Azubi")
   - [ ] KEINEN Zeitraum anlegen
   - [ ] Monatsimport mit diesem Azubi durchführen
   - [ ] Erwartung: Dialog "Azubi ohne gültigen Zeitraum"

2. **Verfügbarkeitskonflikt:**
   - [x] Person auf RTW1 einteilen (Einteilungsseite)
   - [x] Monatsimport: Person als "K" (Krank) markieren
   - [x] Erwartung: Warnung "Person nicht verfügbar, aber eingeteilt" ✅ (Build 764)

3. **Gelöschte Person:**
   - [ ] Person aus Datenbank löschen
   - [ ] Monatsimport mit Excel, das diese Person enthält
   - [ ] Erwartung (aktuell): Stille Übersprung ❌
   - [ ] Erwartung (nach Fix): Warnung "Person nicht gefunden" ✅


---

**Erstellt:** 6. Januar 2026
**Autor:** GitHub Copilot
**Basis:** Codeanalyse von `main/roster-importer.ts`
