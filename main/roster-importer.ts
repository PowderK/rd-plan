import * as XLSX from 'xlsx';
import { DatabaseAdapter } from './database-manager';

// Excel date serial numbers are days since 1900-01-01, but Excel incorrectly thinks 1900 was a leap year.
// JavaScript's dates are based on milliseconds since 1970-01-01.
function excelSerialDateToJSDate(serial: number): Date {
    // Prefer using XLSX's own date parser which handles the 1900 leap-year bug correctly
    const anyXLSX: any = XLSX as any;
    if (anyXLSX && anyXLSX.SSF && typeof anyXLSX.SSF.parse_date_code === 'function') {
        const o = anyXLSX.SSF.parse_date_code(serial);
        if (o) {
            return new Date(Date.UTC(o.y, (o.m || 1) - 1, o.d || 1, o.H || 0, o.M || 0, o.S || 0, Math.round((o.u || 0) * 1000)));
        }
    }

    // Fallback: approximate conversion via Unix epoch with manual 1900 bug handling
    const utc_days = Math.floor(serial - 25569);
    const date = new Date(Date.UTC(1970, 0, 1) + utc_days * 86400 * 1000);
    if (serial >= 60) {
        // Excel has a fictitious 1900-02-29 as day 60; shift back one day
        date.setUTCDate(date.getUTCDate() - 1);
    }
    return date;
}

function toISODateString(date: Date): string {
    return date.toISOString().split('T')[0];
}

// Normalize german umlauts and common variants for robust last-name matching
function normalizeLastName(name: string): string {
    return name
        .toLowerCase()
        .trim()
        .replace(/ä/g, 'ae')
        .replace(/ö/g, 'oe')
        .replace(/ü/g, 'ue')
        .replace(/ß/g, 'ss')
        .replace(/\./g, '') // remove dots like "Schmidt, A."
        .replace(/\s+/g, ' ');
}

// Try to parse header cell values that may be Excel date serials or strings like "01.10" or "01.10.2025"
function parseHeaderDate(value: any, defaultYear: number): Date | null {
    if (value == null) return null;
    if (typeof value === 'number' && !isNaN(value)) {
        return excelSerialDateToJSDate(value);
    }
    if (typeof value === 'string') {
        const raw = value.trim();
        // Allow formats: DD.MM or DD.MM.YYYY or DD.MM.YY
        const m = raw.match(/^([0-3]?\d)\.([0-1]?\d)(?:\.(\d{2,4}))?$/);
        if (m) {
            const d = parseInt(m[1], 10);
            const mo = parseInt(m[2], 10);
            let y = defaultYear;
            if (m[3]) {
                const yy = parseInt(m[3], 10);
                y = yy < 100 ? (2000 + yy) : yy; // assume 20xx for two-digit years
            }
            const dt = new Date(y, mo - 1, d);
            return isNaN(dt.getTime()) ? null : dt;
        }
        // If the string is a full date Excel formatted like '01.10.2025 00:00:00'
        const m2 = raw.match(/^([0-3]?\d)\.([0-1]?\d)\.(\d{4})(?:\s.*)?$/);
        if (m2) {
            const d = parseInt(m2[1], 10);
            const mo = parseInt(m2[2], 10);
            const y = parseInt(m2[3], 10);
            const dt = new Date(y, mo - 1, d);
            return isNaN(dt.getTime()) ? null : dt;
        }
    }
    return null;
}

interface RosterEntry {
    personId: number;
    personType: 'person' | 'azubi';
    date: string;
    value: string;
    type: string; // 'text' for duty roster entries
}

interface AvailabilityConflict {
    personName: string;
    date: string;
    dutyRosterValue: string;
    einteilungValue: string;
}

export class RosterImporter {
    constructor(private dbAdapter: DatabaseAdapter) {}

    // Prüft Verfügbarkeit: Sammelt Konflikte zwischen Dienstplan (duty roster) und Einteilung (fahrzeugzuweisung)
    // Konflikt = Person hat Fahrzeugzuweisung (type), aber neue Schichtart bedeutet nicht verfügbar (auswertung = 'off')
    private async checkAvailabilityConflicts(
        entriesToImport: RosterEntry[]
    ): Promise<AvailabilityConflict[]> {
        const conflicts: AvailabilityConflict[] = [];
        
        // Hole alle Personen für Namensauflösung
        const personnel = await this.dbAdapter.getPersonnel();
        const azubis = await this.dbAdapter.getAzubiList();
        const personMap = new Map<string, string>();
        
        for (const p of personnel) {
            personMap.set(`person_${p.id}`, `${p.name}, ${p.vorname}`);
        }
        for (const a of azubis) {
            personMap.set(`azubi_${a.id}`, `${a.name}, ${a.vorname}`);
        }
        
        // Hole Auswertungs-Einstellungen für alle Schichtarten
        const shiftTypes = await this.dbAdapter.getShiftTypes();
        const auswertungMap = new Map<string, string>();
        for (const st of shiftTypes) {
            const auswertung = await this.dbAdapter.getSetting(`auswertung_${st.code}`);
            // 'off' = nicht verfügbar (Urlaub, Krank, Frei, etc.)
            // 'tag', 'nacht', '24h', 'itw' = verfügbar (Arbeitsschichten)
            auswertungMap.set(st.code, auswertung || 'off');
        }
        
        // Lade Fahrzeuge und deren Positionen für lesbare Bezeichnungen
        const rtwVehicles = await this.dbAdapter.getRtwVehicles();
        const nefVehicles = await this.dbAdapter.getNefVehicles();
        const itwVehicles = await this.dbAdapter.getItwVehicles();
        
        const vehiclePositionsMap = new Map<string, string>(); // slotId -> lesbare Bezeichnung
        
        // RTW Positionen
        for (let rIdx = 0; rIdx < rtwVehicles.length; rIdx++) {
            const v = rtwVehicles[rIdx];
            const positions = await this.dbAdapter.getVehiclePositions('rtw', v.id);
            positions.sort((a: any, b: any) => a.sort - b.sort);
            
            for (let pIdx = 0; pIdx < positions.length; pIdx++) {
                const pos = positions[pIdx];
                const posName = pos.positionName.replace(/\s+\d+$/, ''); // Zahl am Ende entfernen
                
                // Tag-Schicht
                const tagSlotId = `rtw${rIdx + 1}_tag_${pIdx + 1}`;
                vehiclePositionsMap.set(tagSlotId, `${v.name || `RTW ${rIdx + 1}`} ${posName} Tag`);
                
                // Nacht-Schicht
                const nachtSlotId = `rtw${rIdx + 1}_nacht_${pIdx + 1}`;
                vehiclePositionsMap.set(nachtSlotId, `${v.name || `RTW ${rIdx + 1}`} ${posName} Nacht`);
            }
        }
        
        // NEF Positionen
        for (let nIdx = 0; nIdx < nefVehicles.length; nIdx++) {
            const v = nefVehicles[nIdx];
            const positions = await this.dbAdapter.getVehiclePositions('nef', v.id);
            positions.sort((a: any, b: any) => a.sort - b.sort);
            
            if (positions.length > 0) {
                const pos = positions[0];
                const posName = pos.positionName.replace(/\s+\d+$/, '');
                const slotId = `nef${nIdx + 1}_assist`;
                vehiclePositionsMap.set(slotId, `${v.name || `NEF ${nIdx + 1}`} ${posName}`);
            }
        }
        
        // ITW Positionen
        for (let iIdx = 0; iIdx < itwVehicles.length; iIdx++) {
            const v = itwVehicles[iIdx];
            const positions = await this.dbAdapter.getVehiclePositions('itw', v.id);
            positions.sort((a: any, b: any) => a.sort - b.sort);
            
            for (let pIdx = 0; pIdx < positions.length; pIdx++) {
                const pos = positions[pIdx];
                const posName = pos.positionName.replace(/\s+\d+$/, '');
                const slotId = `itw${iIdx + 1}_${pIdx + 1}`;
                vehiclePositionsMap.set(slotId, `${v.name || `ITW ${iIdx + 1}`} ${posName}`);
            }
        }
        
        // Extrahiere alle betroffenen Jahre aus den zu importierenden Einträgen
        const years = new Set<number>();
        for (const entry of entriesToImport) {
            const year = parseInt(entry.date.split('-')[0], 10);
            if (!isNaN(year)) years.add(year);
        }
        
        // Hole bestehende Fahrzeugzuweisungen (duty_roster entries mit type = 'rtw%', 'nef%', 'itw%')
        const vehicleAssignments = new Map<string, string>(); // key: "personType_personId_date" -> vehicle assignment (type)
        for (const year of years) {
            const dutyRoster = await this.dbAdapter.getDutyRoster(year);
            for (const entry of dutyRoster) {
                // Nur Einträge mit Fahrzeugzuweisung berücksichtigen
                if (entry.type && (entry.type.startsWith('rtw') || entry.type.startsWith('nef') || entry.type.startsWith('itw'))) {
                    const key = `${entry.personType}_${entry.personId}_${entry.date}`;
                    vehicleAssignments.set(key, entry.type);
                }
            }
        }
        
        // Prüfe Import-Einträge: Gibt es eine Fahrzeugzuweisung UND ist die neue Schichtart nicht verfügbar?
        for (const entry of entriesToImport) {
            const key = `${entry.personType}_${entry.personId}_${entry.date}`;
            const vehicleAssignment = vehicleAssignments.get(key);
            
            // Konflikt: Person hat Fahrzeugzuweisung ABER neue Schichtart bedeutet nicht verfügbar
            if (vehicleAssignment) {
                const auswertung = auswertungMap.get(entry.value.trim());
                
                // Wenn auswertung = 'off' oder nicht definiert → Person nicht verfügbar
                if (!auswertung || auswertung === 'off') {
                    const personName = personMap.get(`${entry.personType}_${entry.personId}`) || `ID ${entry.personId}`;
                    
                    // Konvertiere Slot-ID zu lesbarer Bezeichnung
                    const readableAssignment = vehiclePositionsMap.get(vehicleAssignment) || vehicleAssignment;
                    
                    conflicts.push({
                        personName,
                        date: entry.date,
                        dutyRosterValue: entry.value.trim(), // Neue Schichtart aus Import (z.B. "K" für Krank)
                        einteilungValue: readableAssignment // Lesbare Fahrzeugzuweisung (z.B. "RTW 5 Fahrzeugführer Tag")
                    });
                }
            }
        }
        
        console.log(`[RosterImporter] Verfügbarkeitsprüfung: ${conflicts.length} Konflikte gefunden (Fahrzeugzuweisung vs. nicht verfügbare Schichtart)`);
        return conflicts;
    }

    // Prüft, ob Azubis im Import einen gültigen Zeitraum haben
    private async checkAzubiPeriods(
        entriesToImport: RosterEntry[],
        year: number,
        month?: number | { start: number, end: number }
    ): Promise<Array<{ azubiId: number; azubiName: string; importDateRange: { start: string; end: string } }>> {
        const azubisWithoutPeriod: Array<{ azubiId: number; azubiName: string; importDateRange: { start: string; end: string } }> = [];
        
        // Hole alle Azubis
        const azubis = await this.dbAdapter.getAzubiList();
        const azubiMap = new Map<number, { id: number; name: string; vorname: string }>();
        for (const a of azubis) {
            azubiMap.set(a.id, a);
        }
        
        // Hole alle Azubi-Zeiträume
        const allPeriods = await this.dbAdapter.getAllAzubiPeriods();
        const periodsByAzubi = new Map<number, Array<{ start_date: string; end_date: string }>>();
        for (const period of allPeriods) {
            if (!periodsByAzubi.has(period.azubi_id)) {
                periodsByAzubi.set(period.azubi_id, []);
            }
            periodsByAzubi.get(period.azubi_id)!.push({
                start_date: period.start_date,
                end_date: period.end_date
            });
        }
        
        // Sammle Azubi-Einträge und deren Datumsbereich
        const azubiImportData = new Map<number, Set<string>>();
        for (const entry of entriesToImport) {
            if (entry.personType === 'azubi') {
                if (!azubiImportData.has(entry.personId)) {
                    azubiImportData.set(entry.personId, new Set());
                }
                azubiImportData.get(entry.personId)!.add(entry.date);
            }
        }
        
        // Prüfe jeden Azubi im Import
        for (const [azubiId, dates] of azubiImportData.entries()) {
            const azubi = azubiMap.get(azubiId);
            if (!azubi) continue;
            
            const sortedDates = Array.from(dates).sort();
            const importStart = sortedDates[0];
            const importEnd = sortedDates[sortedDates.length - 1];
            
            // Prüfe, ob es einen überlappenden Zeitraum gibt
            const periods = periodsByAzubi.get(azubiId) || [];
            const hasValidPeriod = periods.some(period => {
                // Zeitraum überlappt wenn: period.start <= importEnd && period.end >= importStart
                return period.start_date <= importEnd && period.end_date >= importStart;
            });
            
            if (!hasValidPeriod) {
                azubisWithoutPeriod.push({
                    azubiId,
                    azubiName: `${azubi.name}, ${azubi.vorname}`,
                    importDateRange: { start: importStart, end: importEnd }
                });
            }
        }
        
        console.log(`[RosterImporter] Azubi-Zeitraum-Prüfung: ${azubisWithoutPeriod.length} Azubis ohne gültigen Zeitraum gefunden`);
        return azubisWithoutPeriod;
    }

    // Sammelt unbekannte Dienstarten aus allen Dienst-Einträgen
    private async collectUnknownShiftTypes(
        entriesToImport: Array<{ value: string; type: string }>
    ): Promise<string[]> {
        // Hole bekannte Dienstarten
        const existingShiftTypes = await this.dbAdapter.getShiftTypes();
        const existingCodes = new Set(existingShiftTypes.map((st: any) => st.code));
        
        // Sammle alle eindeutigen Dienstarten aus den Import-Einträgen
        const foundShiftTypes = new Set<string>();
        for (const entry of entriesToImport) {
            const value = entry.value?.trim();
            if (value && value.length > 0) {
                foundShiftTypes.add(value);
            }
        }
        
        // Finde unbekannte Dienstarten
        const unknownShiftTypes = Array.from(foundShiftTypes).filter(code => !existingCodes.has(code));
        
        console.log('[RosterImporter] Gefundene Dienstarten:', Array.from(foundShiftTypes));
        console.log('[RosterImporter] Bekannte Dienstarten:', Array.from(existingCodes));
        console.log('[RosterImporter] Unbekannte Dienstarten:', unknownShiftTypes);
        
        return unknownShiftTypes;
    }

    // Sammelt unbekannte Namen aus dem Azubi-Block für Monatsimport
    private async collectUnknownAzubiNames(
        worksheet: XLSX.WorkSheet, 
        fixed: any, 
        year: number, 
        month: number | { start: number, end: number } | undefined,
        fullNameMap: Map<string, {id: number, type: 'person' | 'azubi'}>,
        lastNameMap: Map<string, {id: number, type: 'person' | 'azubi'} | 'conflict'>,
        mapByLastName: Record<string, number>,
        idMap: Map<number, {id: number, type: 'person' | 'azubi'}>
    ): Promise<string[]> {
        const unknownNames = new Set<string>();
        
        for (let col = fixed.firstDateCol; col < fixed.firstDateCol + 2000; col++) {
            const dateAddr = XLSX.utils.encode_cell({ r: fixed.headerRow, c: col });
            const dateCell = worksheet[dateAddr];
            if (!dateCell || dateCell.v == null) break;
            
            const dateValue = parseHeaderDate(dateCell.v, year);
            if (!dateValue || dateValue.getFullYear() !== year) continue;
            // Only filter by month if month is specified
            if (month !== undefined) {
                if (typeof month === 'number') {
                    if (dateValue.getMonth() !== month) continue;
                } else {
                    if (dateValue.getMonth() < month.start || dateValue.getMonth() > month.end) continue;
                }
            }
            
            for (let row = fixed.azubiStart; row <= fixed.azubiEnd; row++) {
                const nameAddr = XLSX.utils.encode_cell({ r: row, c: fixed.nameCol });
                const nameCell = worksheet[nameAddr];
                if (!nameCell || nameCell.v == null) continue;
                
                const rawName = String(nameCell.v).trim();
                if (!rawName) continue;
                
                // Prüfe, ob dieser Azubi überhaupt Diensteinträge für die gefilterten Daten hat
                const valueAddr = XLSX.utils.encode_cell({ r: row, c: col });
                const valueCell = worksheet[valueAddr];
                const rawValue = valueCell && valueCell.v != null ? String(valueCell.v).trim() : '';
                
                // Nur berücksichtigen, wenn tatsächlich ein Diensteintrag vorhanden ist
                if (!rawValue) continue;
                
                // Check if this name is already known
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
                
                // If name is unknown, add to collection
                if (!personInfo) {
                    unknownNames.add(rawName);
                }
            }
        }
        
        return Array.from(unknownNames).sort();
    }

    // Parse-only preview: returns unmatched names and simple stats without writing to DB
    public async previewDutyRoster(filePath: string, year: number, month?: number | { start: number, end: number }): Promise<{ success: boolean; total: number; matched: number; unmatchedNames: string[]; overwrites: number; message?: string; }> {
        try {
            const workbook = XLSX.readFile(filePath);
            const sheetNames = workbook.SheetNames;
            const entries: Array<{ personId: number; date: string; rawName: string } | { personId: null; date: string; rawName: string }> = [];

            const personnel = await this.dbAdapter.getPersonnel();
            const azubis = await this.dbAdapter.getAzubiList();
            const fullNameMap = new Map<string, {id: number, type: 'person' | 'azubi'}>();
            const lastNameMap = new Map<string, {id: number, type: 'person' | 'azubi'} | 'conflict'>();
            for (const p of personnel) {
                fullNameMap.set(`${p.name}, ${p.vorname}`.toLowerCase(), { id: p.id, type: 'person' });
                const key = normalizeLastName(String(p.name || ''));
                if (!key) continue;
                if (lastNameMap.has(key)) lastNameMap.set(key, 'conflict'); else lastNameMap.set(key, { id: p.id, type: 'person' });
            }
            for (const a of azubis) {
                fullNameMap.set(`${a.name}, ${a.vorname}`.toLowerCase(), { id: a.id, type: 'azubi' });
                const key = normalizeLastName(String(a.name || ''));
                if (!key) continue;
                if (lastNameMap.has(key)) lastNameMap.set(key, 'conflict'); else lastNameMap.set(key, { id: a.id, type: 'azubi' });
            }

            const useSpecificSheet = sheetNames.includes('Vorplanung');
            const targetSheets = useSpecificSheet ? ['Vorplanung'] : sheetNames;

            for (const sheetName of targetSheets) {
                const worksheet = workbook.Sheets[sheetName];
                if (!worksheet) continue;
                // Namen in Spalte B (nameCol: 1), Dienstarten ab Spalte D (firstDateCol: 3)
                // Personal: Zeilen 6-57 (Excel) = 5-56 (0-based)
                // Azubis: Zeilen 70-87 (Excel) = 69-86 (0-based)
                const fixed = { headerRow: 3, firstDateCol: 3, nameCol: 1, personnelStart: 5, personnelEnd: 56, azubiStart: 69, azubiEnd: 86 };
                const baseAddr = XLSX.utils.encode_cell({ r: 1, c: 0 });
                const baseCell = worksheet[baseAddr];
                const baseDate = baseCell ? (parseHeaderDate(baseCell.v, year) || (typeof baseCell.v === 'number' ? excelSerialDateToJSDate(baseCell.v) : null)) : null;

                const collect = (startRow: number, endRow: number) => {
                    for (let col = fixed.firstDateCol; col < fixed.firstDateCol + 2000; col++) {
                        const dateAddr = XLSX.utils.encode_cell({ r: fixed.headerRow, c: col });
                        const dateCell = worksheet[dateAddr];
                        if ((!dateCell || dateCell.v == null) && !baseDate) break;
                        let dateValue: Date | null = dateCell ? parseHeaderDate(dateCell.v, year) : null;
                        if (!dateValue && baseDate) { const dt = new Date(baseDate); dt.setDate(dt.getDate() + (col - fixed.firstDateCol)); dateValue = dt; }
                        if (!dateValue) continue;
                        if (dateValue.getFullYear() !== year) continue;
                        if (month !== undefined) { if (typeof month === "number") { if (dateValue.getMonth() !== month) continue; } else { if (dateValue.getMonth() < month.start || dateValue.getMonth() > month.end) continue; } }
                        const dateStr = toISODateString(dateValue);
                        for (let row = startRow; row <= endRow; row++) {
                            const nameAddr = XLSX.utils.encode_cell({ r: row, c: fixed.nameCol });
                            const nameCell = worksheet[nameAddr];
                            if (!nameCell || nameCell.v == null) continue;
                            const rawName = String(nameCell.v).trim();
                            if (!rawName) continue;
                            const keyFull = rawName.toLowerCase();
                            let personInfo = fullNameMap.get(keyFull) || null;
                            if (!personInfo) {
                                const keyLast = normalizeLastName(rawName);
                                const ln = lastNameMap.get(keyLast);
                                if (ln && ln !== 'conflict') personInfo = ln; else personInfo = null;
                            }
                            if (personInfo) entries.push({ personId: personInfo.id, date: dateStr, rawName });
                            else entries.push({ personId: null, date: dateStr, rawName });
                        }
                    }
                };
                collect(fixed.personnelStart, fixed.personnelEnd);
                collect(fixed.azubiStart, fixed.azubiEnd);
            }

            const unmatchedSet = new Set<string>();
            for (const e of entries) { if (e.personId == null) unmatchedSet.add(normalizeLastName(e.rawName)); }

            // Overwrites: count existing roster entries for same personId+date
            const existing = await this.dbAdapter.getDutyRoster(year);
            const existSet = new Set<string>((existing || []).map((r: any) => `${r.personId}|${String(r.date).slice(0,10)}`));
            let overwrites = 0;
            for (const e of entries) { if (e.personId != null && existSet.has(`${e.personId}|${e.date}`)) overwrites++; }

            const total = entries.length;
            const matched = entries.filter(e => e.personId != null).length;
            return { success: true, total, matched, unmatchedNames: Array.from(unmatchedSet).sort(), overwrites };
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            return { success: false, total: 0, matched: 0, unmatchedNames: [], overwrites: 0, message: msg };
        }
    }
    public async importDutyRoster(
        filePath: string, 
        year: number, 
        month?: number | { start: number, end: number }, 
        options?: { 
            mappings?: Record<string, number>; 
            newAzubis?: Array<{name: string, vorname: string, lehrjahr: number}>; 
            newShiftTypes?: Array<{code: string, description: string, color: string, auswertung: string}>;
            azubiPeriodAdjustments?: Array<{azubiId: number, startDate: string, endDate: string, description?: string, lehrjahr: number}>;
        }
    ): Promise<{
        success: boolean, 
        message: string, 
        importedCount: number, 
        unknownAzubis?: string[], 
        unknownShiftTypes?: string[], 
        availabilityConflicts?: AvailabilityConflict[],
        azubisWithoutPeriod?: Array<{ azubiId: number; azubiName: string; importDateRange: { start: string; end: string } }>
    }> {
        try {
            const workbook = XLSX.readFile(filePath);
            const sheetNames = workbook.SheetNames;
            console.log('[RosterImporter] Excel-Datei geladen. Sheets:', sheetNames);
            const entriesToImport: RosterEntry[] = [];
            const seenPersons = new Set<string>(); // "personId:personType"

            // Build name maps once
            const personnel = await this.dbAdapter.getPersonnel();
            const azubis = await this.dbAdapter.getAzubiList();
            console.log(`[RosterImporter] Datenbank geladen: ${personnel.length} Personal, ${azubis.length} Azubis`);
            const fullNameMap = new Map<string, {id: number, type: 'person' | 'azubi'}>();
            const lastNameMap = new Map<string, {id: number, type: 'person' | 'azubi'} | 'conflict'>();
            const idMap = new Map<number, {id: number, type: 'person' | 'azubi'}>();
            for (const p of personnel) {
                fullNameMap.set(`${p.name}, ${p.vorname}`.toLowerCase(), { id: p.id, type: 'person' });
                const key = normalizeLastName(String(p.name || ''));
                if (!key) continue;
                if (lastNameMap.has(key)) lastNameMap.set(key, 'conflict'); else lastNameMap.set(key, { id: p.id, type: 'person' });
                idMap.set(p.id, { id: p.id, type: 'person' });
            }
            for (const a of azubis) {
                // Add multiple name formats for azubis
                const fullName = `${a.name}, ${a.vorname}`.toLowerCase();
                const nameOnly = a.name.toLowerCase();
                
                fullNameMap.set(fullName, { id: a.id, type: 'azubi' });
                // Also add name-only format for azubis without vorname
                if (!a.vorname || a.vorname.trim() === '') {
                    fullNameMap.set(nameOnly, { id: a.id, type: 'azubi' });
                }
                
                const key = normalizeLastName(String(a.name || ''));
                if (!key) continue;
                if (lastNameMap.has(key)) lastNameMap.set(key, 'conflict'); else lastNameMap.set(key, { id: a.id, type: 'azubi' });
                idMap.set(a.id, { id: a.id, type: 'azubi' });
            }
            const mapByLastName = options?.mappings || {};

            const useSpecificSheet = sheetNames.includes('Vorplanung');
            const targetSheets = useSpecificSheet ? ['Vorplanung'] : sheetNames;

            for (const sheetName of targetSheets) {
                const worksheet = workbook.Sheets[sheetName];
                if (!worksheet) continue;

                // Preferred fixed layout for your sheet
                // Namen in Spalte B, Dienstarten ab Spalte D
                const fixed = {
                    headerRow: 3,           // Zeile 4 (Excel) = Index 3 (0-based) - Datums-Header
                    firstDateCol: 3,        // Spalte D (Excel) = Index 3 (0-based) - Erste Dienstart-Spalte
                    nameCol: 1,             // Spalte B (Excel) = Index 1 (0-based) - Namen-Spalte
                    personnelStart: 5,      // Zeile 6 (Excel) = Index 5 (0-based)
                    personnelEnd: 56,       // Zeile 57 (Excel) = Index 56 (0-based)
                    azubiStart: 69,         // Zeile 70 (Excel) = Index 69 (0-based) - B70 START
                    azubiEnd: 86            // Zeile 87 (Excel) = Index 86 (0-based) - B87 END
                };

                // Determine base date from A2 for formula fallback
                const baseAddr = XLSX.utils.encode_cell({ r: 1, c: 0 }); // A2
                const baseCell = worksheet[baseAddr];
                const baseDate = baseCell ? (parseHeaderDate(baseCell.v, year) || (typeof baseCell.v === 'number' ? excelSerialDateToJSDate(baseCell.v) : null)) : null;

                console.log(`[RosterImporter] Verwende Blatt '${sheetName}'. Fixes Layout aktiv. baseDate(A2)=${baseDate ? baseDate.toDateString() : 'n/a'}`);

                // Debug: Log first few header cells
                for (let c = fixed.firstDateCol; c < fixed.firstDateCol + 7; c++) {
                    const addr = XLSX.utils.encode_cell({ r: fixed.headerRow, c });
                    const cell: any = worksheet[addr];
                    const parsed = cell ? parseHeaderDate(cell.v, year) : null;
                    console.log(`[RosterImporter][Header] ${addr} t=${cell?.t} v=${cell?.v} f=${cell?.f} w=${cell?.w} -> ${parsed ? parsed.toDateString() : 'n/a'}`);
                }

                const processBlock = (startRow: number, endRow: number, blockLabel: string, skipEmpty = false) => {
                    console.log(`[RosterImporter] Verarbeite Block ${blockLabel}: Zeilen ${startRow + 1}-${endRow + 1} (1-based)`);
                    for (let col = fixed.firstDateCol; col < fixed.firstDateCol + 2000; col++) {
                        const dateAddr = XLSX.utils.encode_cell({ r: fixed.headerRow, c: col });
                        const dateCell = worksheet[dateAddr];

                        // Stop if header cell is completely empty and no base fallback
                        if ((!dateCell || dateCell.v == null) && !baseDate) break;

                        let dateValue: Date | null = dateCell ? parseHeaderDate(dateCell.v, year) : null;
                        if (!dateValue && baseDate) {
                            // Fallback: A2 + offset days
                            const offset = col - fixed.firstDateCol;
                            const dt = new Date(baseDate);
                            dt.setDate(dt.getDate() + offset);
                            dateValue = dt;
                        }
                        if (!dateValue) continue;
                        if (dateValue.getFullYear() !== year) continue;
                        if (month !== undefined) { if (typeof month === "number") { if (dateValue.getMonth() !== month) continue; } else { if (dateValue.getMonth() < month.start || dateValue.getMonth() > month.end) continue; } }

                        const dateStr = toISODateString(dateValue);

                        for (let row = startRow; row <= endRow; row++) {
                            const nameAddr = XLSX.utils.encode_cell({ r: row, c: fixed.nameCol });
                            const nameCell = worksheet[nameAddr];
                            if (!nameCell || nameCell.v == null) continue;
                            const rawName = String(nameCell.v).trim();
                            if (!rawName) continue;

                            // Lookup order: full name -> last name -> mapping override
                            const keyFull = rawName.toLowerCase();
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
                            
                            if (!personInfo) continue;
                            seenPersons.add(`${personInfo.id}:${personInfo.type}`);

                            const dutyAddr = XLSX.utils.encode_cell({ r: row, c: col });
                            const dutyCell = worksheet[dutyAddr];
                            const dutyValue = dutyCell && dutyCell.v != null ? String(dutyCell.v).trim() : '';
                            
                            // Leere Zellen überspringen wenn:
                            //  - Jahresimport (month === null/undefined): immer überspringen
                            //  - skipEmpty=true (Azubi-Block): immer überspringen (keine Sync-Löschung für Azubis)
                            if (!dutyValue && (month == null || skipEmpty)) continue;

                            entriesToImport.push({
                                personId: personInfo.id,
                                personType: personInfo.type,
                                date: dateStr,
                                value: dutyValue,
                                type: 'text'
                            });
                        }
                    }
                };

                // Debug: show sample names in personnel and azubi blocks
                for (const [probeRow, label] of [[fixed.personnelStart, 'Personal'], [fixed.azubiStart, 'Azubi']] as const) {
                    for (let i = 0; i < 5; i++) {
                        const r = probeRow + i;
                        const addr = XLSX.utils.encode_cell({ r, c: fixed.nameCol });
                        const cell = worksheet[addr];
                        if (!cell) continue;
                        const raw = String(cell.v ?? '').trim();
                        const full = fullNameMap.get(raw.toLowerCase());
                        const ln = lastNameMap.get(raw.toLowerCase());
                        console.log(`[RosterImporter][Probe ${label}] ${addr}='${raw}' -> full=${!!full} ln=${ln && ln !== 'conflict' ? 'hit' : (ln === 'conflict' ? 'conflict' : 'miss')}`);
                    }
                }

                // Process personnel block always
                processBlock(fixed.personnelStart, fixed.personnelEnd, 'Personal');
                
                // Process azubi block for both month and year imports
                // Collect unknown azubi names first
                const unknownAzubiNames = await this.collectUnknownAzubiNames(worksheet, fixed, year, month, fullNameMap, lastNameMap, mapByLastName, idMap);
                
                if (unknownAzubiNames.length > 0) {
                    // If new azubis are provided in options, create them first
                    if (options?.newAzubis && options.newAzubis.length > 0) {
                        console.log('[RosterImporter] Erstelle neue Azubis:', options.newAzubis);
                        for (const newAzubi of options.newAzubis) {
                            await this.dbAdapter.addAzubi(newAzubi);
                        }
                        // Reload azubi list and rebuild ALL maps completely
                        const updatedAzubis = await this.dbAdapter.getAzubiList();
                        // Clear existing azubi entries from maps
                        fullNameMap.clear();
                        lastNameMap.clear();
                        idMap.clear();
                        
                        // Rebuild maps with personnel
                        for (const p of personnel) {
                            fullNameMap.set(`${p.name}, ${p.vorname}`.toLowerCase(), { id: p.id, type: 'person' });
                            const key = normalizeLastName(String(p.name || ''));
                            if (key) {
                                if (lastNameMap.has(key)) lastNameMap.set(key, 'conflict'); 
                                else lastNameMap.set(key, { id: p.id, type: 'person' });
                            }
                            idMap.set(p.id, { id: p.id, type: 'person' });
                        }
                        
                        // Rebuild maps with updated azubis
                        for (const a of updatedAzubis) {
                            // Add multiple name formats for azubis
                            const fullName = `${a.name}, ${a.vorname}`.toLowerCase();
                            const nameOnly = a.name.toLowerCase();
                            
                            fullNameMap.set(fullName, { id: a.id, type: 'azubi' });
                            // Also add name-only format for azubis without vorname
                            if (!a.vorname || a.vorname.trim() === '') {
                                fullNameMap.set(nameOnly, { id: a.id, type: 'azubi' });
                            }
                            
                            const key = normalizeLastName(String(a.name || ''));
                            if (key) {
                                if (lastNameMap.has(key)) lastNameMap.set(key, 'conflict'); 
                                else lastNameMap.set(key, { id: a.id, type: 'azubi' });
                            }
                            idMap.set(a.id, { id: a.id, type: 'azubi' });
                            
                            console.log(`[RosterImporter] Azubi in Maps: fullName='${fullName}', nameOnly='${nameOnly}', key='${key}'`);
                        }
                        console.log('[RosterImporter] Maps nach Azubi-Erstellung aktualisiert. Neue Azubi-Anzahl:', updatedAzubis.length);
                    } else {
                        // Return unknown names for user dialog
                        console.log('[RosterImporter] Gefundene unbekannte Azubi-Namen für Dialog:', unknownAzubiNames);
                        return { 
                            success: true, 
                            message: `Unbekannte Azubi-Namen gefunden: ${unknownAzubiNames.join(', ')}`, 
                            importedCount: 0,
                            unknownAzubis: unknownAzubiNames 
                        };
                    }
                }
                
                // Now process the azubi block (for both month and year imports)
                // skipEmpty=false: leere Zellen werden beim Monatsimport als Löschung (Sync) interpretiert, genau wie beim Personal.
                processBlock(fixed.azubiStart, fixed.azubiEnd, 'Azubis', false);
            }

            if (entriesToImport.length > 0) {
                console.log(`[RosterImporter] ${entriesToImport.length} Einträge gesammelt. Prüfe Dienstarten...`);
                // Check for unknown shift types
                const unknownShiftTypes = await this.collectUnknownShiftTypes(entriesToImport);
                
                if (unknownShiftTypes.length > 0) {
                    // If new shift types are provided in options, create them first
                    if (options?.newShiftTypes && options.newShiftTypes.length > 0) {
                        console.log('[RosterImporter] Erstelle neue Dienstarten:', options.newShiftTypes);
                        for (const newShiftType of options.newShiftTypes) {
                            await this.dbAdapter.addShiftType({ code: newShiftType.code, description: newShiftType.description });
                            // Set color and auswertung in settings
                            await this.dbAdapter.setSetting(`color_${newShiftType.code}`, newShiftType.color);
                            await this.dbAdapter.setSetting(`auswertung_${newShiftType.code}`, newShiftType.auswertung);
                        }
                    } else {
                        // Return unknown shift types for user dialog
                        console.log('[RosterImporter] Gefundene unbekannte Dienstarten für Dialog:', unknownShiftTypes);
                        return { 
                            success: true, 
                            message: `Unbekannte Dienstarten gefunden: ${unknownShiftTypes.join(', ')}`, 
                            importedCount: 0,
                            unknownShiftTypes: unknownShiftTypes 
                        };
                    }
                }

                // Prüfe Azubi-Zeiträume
                console.log(`[RosterImporter] Prüfe Azubi-Zeiträume...`);
                const azubisWithoutPeriod = await this.checkAzubiPeriods(entriesToImport, year, month);
                
                if (azubisWithoutPeriod.length > 0) {
                    // Wenn Azubis ohne gültigen Zeitraum gefunden wurden, Dialog anzeigen
                    if (options?.azubiPeriodAdjustments) {
                        // User hat bereits entschieden, Zeiträume anzupassen
                        console.log('[RosterImporter] Passe Azubi-Zeiträume an:', options.azubiPeriodAdjustments);
                        for (const adjustment of options.azubiPeriodAdjustments) {
                            await this.dbAdapter.addAzubiPeriod({
                                azubi_id: adjustment.azubiId,
                                start_date: adjustment.startDate,
                                end_date: adjustment.endDate,
                                description: adjustment.description || 'Automatisch durch Import hinzugefügt',
                                lehrjahr: adjustment.lehrjahr
                            });
                        }
                    } else {
                        // Zeige Dialog mit Azubis ohne gültigen Zeitraum
                        console.log('[RosterImporter] Gefundene Azubis ohne gültigen Zeitraum:', azubisWithoutPeriod);
                        return {
                            success: true,
                            message: `Azubis ohne gültigen Zeitraum gefunden: ${azubisWithoutPeriod.map(a => a.azubiName).join(', ')}`,
                            importedCount: 0,
                            azubisWithoutPeriod: azubisWithoutPeriod
                        };
                    }
                }

                console.log(`[RosterImporter] Schreibe ${entriesToImport.length} Einträge in duty_roster.`);
                
                // IMMER manuelle Bearbeitungen respektieren (sowohl bei Monats- als auch bei Jahresimport)
                // Nur Excel-Einträge überschreiben, die nicht manuell geändert wurden
                // Jahresimport (month undefined oder null) -> deleteEmpty = false (bestehende Einträge behalten)
                // Monatsimport (month defined) -> deleteEmpty = true (Sync, leere Felder löschen)
                const isYearlyImport = month == null;
                const deleteEmpty = !isYearlyImport;
                const respectManualEdits = !isYearlyImport; // Jahresimport überschreibt auch manuelle Änderungen
                
                // Prüfe Verfügbarkeitskonflikte VOR dem Import
                const availabilityConflicts = await this.checkAvailabilityConflicts(entriesToImport);
                
                const result = await this.dbAdapter.bulkImportDutyRosterEntries(entriesToImport, respectManualEdits, deleteEmpty);
                console.log(`[RosterImporter] Import: ${result.imported} importiert, ${result.skipped} übersprungen (manuell bearbeitet oder existierend)`);
                
                // WICHTIG: Wenn deleteEmpty=true (Sync-Modus), lösche alle Einträge für Personen, 
                // die im Import-Block NICHT vorkommen, aber in der DB existieren (Orphaned Entries).
                if (deleteEmpty && seenPersons.size > 0) {
                    const seenList = Array.from(seenPersons);
                    const deletedOrphans = await this.dbAdapter.deleteOrphanedDutyRosterEntries(year, month, seenList);
                    if (deletedOrphans > 0) {
                        console.log(`[RosterImporter] Sync-Cleanup: ${deletedOrphans} verwaiste Einträge von nicht mehr im Excel gelisteten Personen wurden entfernt.`);
                    }
                }
                
                // Rückgabe mit Konflikten
                return { 
                    success: true, 
                    message: `Dienstplan erfolgreich importiert. ${result.imported} Einträge verarbeitet, ${result.skipped} geschützt/übersprungen.`, 
                    importedCount: result.imported,
                    availabilityConflicts: availabilityConflicts.length > 0 ? availabilityConflicts : undefined
                };
            } else {
                console.warn('[RosterImporter] Keine Einträge zum Import gefunden.');
            }

            return { success: true, message: `Keine Einträge zum Import gefunden.`, importedCount: 0 };

        } catch (error) {
            console.error('Fehler beim Importieren des Dienstplans:', error);
            const errorMessage = error instanceof Error ? error.message : 'Ein unbekannter Fehler ist aufgetreten.';
            return { success: false, message: `Fehler beim Import: ${errorMessage}`, importedCount: 0 };
        }
    }

}

// Generic row processor where the name column is configurable
function processRowGeneric(
    worksheet: XLSX.WorkSheet,
    row: number,
    col: number,
    nameCol: number,
    dateStr: string,
    nameToPersonMap: Map<string, {id: number, type: 'person' | 'azubi'}>,
    entriesToImport: RosterEntry[]
) {
    const nameCellAddress = XLSX.utils.encode_cell({ r: row, c: nameCol });
    const nameCell = worksheet[nameCellAddress];
    if (!nameCell || nameCell.v == null) return;

    const rawName = String(nameCell.v).trim();
    if (!rawName) return;

    // Use 'Nachname, Vorname' form for lookup if present; else try as-is
    const normalized = rawName.toLowerCase();
    const personInfo = nameToPersonMap.get(normalized);
    if (!personInfo) {
        return; // no match yet; future: fuzzy/alias mapping
    }

    const dutyCellAddress = XLSX.utils.encode_cell({ r: row, c: col });
    const dutyCell = worksheet[dutyCellAddress];
    const dutyValue = dutyCell && dutyCell.v != null ? String(dutyCell.v).trim() : '';
    if (!dutyValue) return;

    entriesToImport.push({
        personId: personInfo.id,
        personType: personInfo.type,
        date: dateStr,
        value: dutyValue,
        type: 'text'
    });
}

// Detect layout: header row (dates), first date column, name column, data row range
function detectLayout(worksheet: XLSX.WorkSheet, targetYear: number): { headerRow: number; firstDateCol: number; nameCol: number; firstDataRow: number; lastDataRow: number } {
    const maxRows = 2000;
    const maxCols = 2000;

    // Heuristic 1: find a row within first 10 rows that has 3+ consecutive parseable dates
    let headerRow = -1;
    let firstDateCol = -1;
    for (let r = 0; r < 10; r++) {
        let consec = 0;
        let startCol = -1;
        for (let c = 0; c < 20; c++) {
            const cell = worksheet[XLSX.utils.encode_cell({ r, c })];
            const dt = cell ? parseHeaderDate(cell.v, targetYear) : null;
            if (dt) {
                consec++;
                if (startCol === -1) startCol = c;
                if (consec >= 3) {
                    headerRow = r;
                    firstDateCol = startCol;
                    break;
                }
            } else {
                consec = 0;
                startCol = -1;
            }
        }
        if (headerRow !== -1) break;
    }

    // Fallback to legacy: row 4 (index 3), from col D (3)
    if (headerRow === -1) {
        headerRow = 3;
        firstDateCol = 3;
    }

    // Name column heuristic: prefer column A (0) if it contains text below header, else B (1)
    let nameCol = 0;
    const probeRow = headerRow + 1;
    const aCell = worksheet[XLSX.utils.encode_cell({ r: probeRow, c: 0 })];
    const bCell = worksheet[XLSX.utils.encode_cell({ r: probeRow, c: 1 })];
    const aText = aCell && typeof aCell.v === 'string' && aCell.v.trim() ? true : false;
    const bText = bCell && typeof bCell.v === 'string' && bCell.v.trim() ? true : false;
    if (!aText && bText) nameCol = 1;

    // Determine data rows: from first non-empty under header until first block of 3 empty rows
    let firstDataRow = -1;
    for (let r = headerRow + 1; r < headerRow + 200; r++) {
        const nameCell = worksheet[XLSX.utils.encode_cell({ r, c: nameCol })];
        if (nameCell && nameCell.v != null && String(nameCell.v).trim() !== '') {
            firstDataRow = r;
            break;
        }
    }
    if (firstDataRow === -1) {
        // Fallback legacy blocks
        firstDataRow = 5; // row 6
    }

    let lastDataRow = firstDataRow;
    let emptyStreak = 0;
    for (let r = firstDataRow; r < maxRows; r++) {
        const nameCell = worksheet[XLSX.utils.encode_cell({ r, c: nameCol })];
        const hasName = nameCell && nameCell.v != null && String(nameCell.v).trim() !== '';
        if (hasName) {
            lastDataRow = r;
            emptyStreak = 0;
        } else {
            emptyStreak++;
            if (emptyStreak >= 3) break; // stop after a gap
        }
    }

    return { headerRow, firstDateCol, nameCol, firstDataRow, lastDataRow };
}