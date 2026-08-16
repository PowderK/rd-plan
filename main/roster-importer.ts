import * as XLSX from 'xlsx';
import fs from 'fs';
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
    department?: string;
}

interface AvailabilityConflict {
    personName: string;
    date: string;
    dutyRosterValue: string;
    einteilungValue: string;
}

type PersonMatch = { id: number; type: 'person' | 'azubi' };

type BlockNameMaps = {
    full: Map<string, PersonMatch>;
    last: Map<string, PersonMatch | 'conflict'>;
    byId: Map<number, PersonMatch>;
};

type RosterSheetLayout = {
    headerRow: number;
    firstDateCol: number;
    nameCol: number;
    personnelStart: number;
    personnelEnd: number;
    azubiStart: number;
    azubiEnd: number;
};

/** Excel-Zeilen (1-basiert) der Standard-Vorplanung */
const ROSTER_EXCEL_PERSONNEL_FIRST = 6;
const ROSTER_EXCEL_PERSONNEL_LAST = 57;
const ROSTER_EXCEL_AZUBI_HEADER = 69; // Überschrift „Lehrjahr“ – kein Azubi-Name
const ROSTER_EXCEL_AZUBI_FIRST = 70;
const ROSTER_EXCEL_AZUBI_LAST = 87;

const excelRowToIndex = (excelRow: number) => excelRow - 1;

type MergeRange = { s: { r: number; c: number }; e: { r: number; c: number } };

const ROSTER_SECTION_LABELS = new Set([
    'lehrjahr', 'name', 'namen', 'vorname', 'nachname',
    'azubi', 'azubis', 'personal', 'stammpersonal', 'mitarbeiter',
    'dienst', 'dienste', 'schicht', 'schichten', 'datum', 'kw'
]);

function getMergeAt(worksheet: XLSX.WorkSheet, row: number, col: number): MergeRange | null {
    const merges = worksheet['!merges'] as MergeRange[] | undefined;
    if (!merges?.length) return null;
    for (const m of merges) {
        if (row >= m.s.r && row <= m.e.r && col >= m.s.c && col <= m.e.c) return m;
    }
    return null;
}

/** Nur die eigene Zelle – keine Werte aus zusammengeführten Kopfzeilen (z. B. B69 „Namen“ → B70). */
function getRosterNameFromCell(worksheet: XLSX.WorkSheet, row: number, col: number): string | null {
    const merge = getMergeAt(worksheet, row, col);
    if (merge && (row !== merge.s.r || col !== merge.s.c)) {
        return null;
    }
    const cell = worksheet[XLSX.utils.encode_cell({ r: row, c: col })];
    if (!cell || cell.v == null) return null;
    const raw = String(cell.v).trim();
    return raw || null;
}

function isRosterSectionLabel(rawName: string): boolean {
    const n = rawName.trim().toLowerCase();
    if (!n) return true;
    if (/^\d+\.?\s*lehrjahr$/i.test(rawName.trim())) return true;
    if (ROSTER_SECTION_LABELS.has(n)) return true;
    return n.startsWith('azubi ');
}

function shouldSkipRosterNameRow(row: number, rawName: string, block: 'person' | 'azubi'): boolean {
    if (isRosterSectionLabel(rawName)) return true;
    // Zeile 69 und darüber im Azubi-Bereich sind Kopfzeilen (Lehrjahr, Namen, …)
    if (block === 'azubi' && row < excelRowToIndex(ROSTER_EXCEL_AZUBI_FIRST)) return true;
    return false;
}

/** Erste Zeile mit echtem Azubi-Namen (ab Zeile 70, ohne Kopfzeile 69). */
function findAzubiDataStartRow(worksheet: XLSX.WorkSheet, layout: RosterSheetLayout): number {
    const defaultStart = excelRowToIndex(ROSTER_EXCEL_AZUBI_FIRST);
    for (let row = excelRowToIndex(ROSTER_EXCEL_AZUBI_HEADER); row <= layout.azubiEnd; row++) {
        const rawName = getRosterNameFromCell(worksheet, row, layout.nameCol);
        if (!rawName) continue;
        if (shouldSkipRosterNameRow(row, rawName, 'azubi')) continue;
        return row;
    }
    return defaultStart;
}

function addPersonNameVariants(maps: BlockNameMaps, p: { id: number; name: string; vorname?: string }, type: 'person' | 'azubi') {
    const name = String(p.name || '').trim();
    const vorname = String(p.vorname || '').trim();
    const variants = new Set<string>();
    if (name && vorname) {
        variants.add(`${name}, ${vorname}`.toLowerCase());
        variants.add(`${vorname} ${name}`.toLowerCase());
        variants.add(`${name} ${vorname}`.toLowerCase());
    }
    if (name) variants.add(name.toLowerCase());
    for (const v of variants) {
        maps.full.set(v, { id: p.id, type });
    }
    const key = normalizeLastName(name);
    if (key) {
        if (maps.last.has(key)) maps.last.set(key, 'conflict');
        else maps.last.set(key, { id: p.id, type });
    }
    maps.byId.set(p.id, { id: p.id, type });
}

function buildBlockNameMaps(personnel: { id: number; name: string; vorname?: string }[], azubis: { id: number; name: string; vorname?: string }[]) {
    const personnelMaps: BlockNameMaps = { full: new Map(), last: new Map(), byId: new Map() };
    const azubiMaps: BlockNameMaps = { full: new Map(), last: new Map(), byId: new Map() };
    for (const p of personnel) addPersonNameVariants(personnelMaps, p, 'person');
    for (const a of azubis) addPersonNameVariants(azubiMaps, a, 'azubi');
    return { personnel: personnelMaps, azubi: azubiMaps };
}

function resolvePersonMatch(
    rawName: string,
    maps: BlockNameMaps,
    mapByLastName: Record<string, number>,
    expectedType: 'person' | 'azubi'
): PersonMatch | null {
    const keyFull = rawName.toLowerCase();
    let info: PersonMatch | null = maps.full.get(keyFull) || null;

    if (!info) {
        const keyLast = normalizeLastName(rawName);
        const mappedId = mapByLastName[keyLast];
        if (mappedId != null && maps.byId.has(mappedId)) {
            info = maps.byId.get(mappedId)!;
        } else {
            const ln = maps.last.get(keyLast);
            if (ln && ln !== 'conflict') info = ln;
            else if (ln === 'conflict') return null;
        }
    }

    if (!info || info.type !== expectedType) return null;
    return info;
}

/** Vorplanung: feste Zeilen – Stammpersonal 6–57, Azubis 70–87; Zeile 69 = Überschrift. */
function getRosterSheetLayout(worksheet: XLSX.WorkSheet, targetYear: number): RosterSheetLayout {
    const base = detectLayout(worksheet, targetYear);
    const layout: RosterSheetLayout = {
        headerRow: base.headerRow,
        firstDateCol: base.firstDateCol,
        nameCol: 1, // Namen immer Spalte B
        personnelStart: excelRowToIndex(ROSTER_EXCEL_PERSONNEL_FIRST),
        personnelEnd: excelRowToIndex(ROSTER_EXCEL_PERSONNEL_LAST),
        azubiStart: excelRowToIndex(ROSTER_EXCEL_AZUBI_FIRST),
        azubiEnd: excelRowToIndex(ROSTER_EXCEL_AZUBI_LAST)
    };
    layout.azubiStart = findAzubiDataStartRow(worksheet, layout);
    console.log(
        `[RosterImporter] Layout: Personal Zeilen ${ROSTER_EXCEL_PERSONNEL_FIRST}–${ROSTER_EXCEL_PERSONNEL_LAST}, ` +
        `Azubis Zeilen ${layout.azubiStart + 1}–${ROSTER_EXCEL_AZUBI_LAST} (Kopf bis Zeile ${ROSTER_EXCEL_AZUBI_HEADER} ignoriert)`
    );
    return layout;
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
        const importDept = entriesToImport[0]?.department;
        const personnel = await this.dbAdapter.getPersonnel(false, undefined, importDept);
        const azubis = await this.dbAdapter.getAzubiList(importDept);
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
            const dutyRoster = await this.dbAdapter.getDutyRoster(year, importDept);
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
        
        const importDept = entriesToImport.find(e => e.personType === 'azubi')?.department;
        const azubis = await this.dbAdapter.getAzubiList(importDept);
        const azubiMap = new Map<number, { id: number; name: string; vorname: string }>();
        for (const a of azubis) {
            azubiMap.set(a.id, a);
        }
        
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
        
        // Sammle Azubi-Einträge mit tatsächlichem Dienst (leere Sync-Zellen ignorieren)
        const azubiImportData = new Map<number, Set<string>>();
        for (const entry of entriesToImport) {
            if (entry.personType === 'azubi' && entry.value?.trim()) {
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
    private collectUnknownAzubiNames(
        worksheet: XLSX.WorkSheet,
        layout: RosterSheetLayout,
        year: number,
        month: number | { start: number, end: number } | undefined,
        azubiMaps: BlockNameMaps,
        mapByLastName: Record<string, number>
    ): string[] {
        const unknownNames = new Set<string>();

        for (let col = layout.firstDateCol; col < layout.firstDateCol + 2000; col++) {
            const dateAddr = XLSX.utils.encode_cell({ r: layout.headerRow, c: col });
            const dateCell = worksheet[dateAddr];
            if (!dateCell || dateCell.v == null) break;

            const dateValue = parseHeaderDate(dateCell.v, year);
            if (!dateValue || dateValue.getFullYear() !== year) continue;
            if (month !== undefined) {
                if (typeof month === 'number') {
                    if (dateValue.getMonth() !== month) continue;
                } else {
                    if (dateValue.getMonth() < month.start || dateValue.getMonth() > month.end) continue;
                }
            }

            for (let row = layout.azubiStart; row <= layout.azubiEnd; row++) {
                const rawName = getRosterNameFromCell(worksheet, row, layout.nameCol);
                if (!rawName || shouldSkipRosterNameRow(row, rawName, 'azubi')) continue;

                const valueAddr = XLSX.utils.encode_cell({ r: row, c: col });
                const valueCell = worksheet[valueAddr];
                const rawValue = valueCell && valueCell.v != null ? String(valueCell.v).trim() : '';
                if (!rawValue) continue;

                const match = resolvePersonMatch(rawName, azubiMaps, mapByLastName, 'azubi');
                if (!match) unknownNames.add(rawName);
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
                const fixed = getRosterSheetLayout(worksheet, year);
                const baseAddr = XLSX.utils.encode_cell({ r: 1, c: 0 });
                const baseCell = worksheet[baseAddr];
                const baseDate = baseCell ? (parseHeaderDate(baseCell.v, year) || (typeof baseCell.v === 'number' ? excelSerialDateToJSDate(baseCell.v) : null)) : null;

                const collect = (startRow: number, endRow: number, block: 'person' | 'azubi') => {
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
                            const rawName = getRosterNameFromCell(worksheet, row, fixed.nameCol);
                            if (!rawName || shouldSkipRosterNameRow(row, rawName, block)) continue;
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
                collect(fixed.personnelStart, fixed.personnelEnd, 'person');
                collect(fixed.azubiStart, fixed.azubiEnd, 'azubi');
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
            department?: string;
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
            if (!filePath || !fs.existsSync(filePath)) {
                console.warn(`[RosterImporter] Datei existiert nicht: "${filePath}"`);
                return {
                    success: false,
                    message: `Die Datei "${filePath || ''}" wurde nicht gefunden. Bitte überprüfen Sie den Dateipfad.`,
                    importedCount: 0
                };
            }
            const workbook = XLSX.readFile(filePath);
            const sheetNames = workbook.SheetNames;
            console.log('[RosterImporter] Excel-Datei geladen. Sheets:', sheetNames);
            const entriesToImport: RosterEntry[] = [];
            const seenPersons = new Set<string>(); // "personId:personType"
            const allUnknownAzubiNames = new Set<string>();

            const importDept = options?.department;
            const personnel = await this.dbAdapter.getPersonnel(false, undefined, importDept);
            let azubis = await this.dbAdapter.getAzubiList(importDept);
            console.log(`[RosterImporter] Datenbank geladen (${importDept || 'alle'}): ${personnel.length} Personal, ${azubis.length} Azubis`);

            if (options?.newAzubis && options.newAzubis.length > 0) {
                console.log('[RosterImporter] Erstelle neue Azubis vor Import:', options.newAzubis);
                for (const newAzubi of options.newAzubis) {
                    await this.dbAdapter.addAzubi({ ...newAzubi, department: importDept });
                }
                azubis = await this.dbAdapter.getAzubiList(importDept);
            }

            let { personnel: personnelMaps, azubi: azubiMaps } = buildBlockNameMaps(personnel, azubis);
            const mapByLastName = options?.mappings || {};

            const useSpecificSheet = sheetNames.includes('Vorplanung');
            const targetSheets = useSpecificSheet ? ['Vorplanung'] : sheetNames;

            for (const sheetName of targetSheets) {
                const worksheet = workbook.Sheets[sheetName];
                if (!worksheet) continue;

                const layout = getRosterSheetLayout(worksheet, year);

                const baseAddr = XLSX.utils.encode_cell({ r: 1, c: 0 }); // A2
                const baseCell = worksheet[baseAddr];
                const baseDate = baseCell ? (parseHeaderDate(baseCell.v, year) || (typeof baseCell.v === 'number' ? excelSerialDateToJSDate(baseCell.v) : null)) : null;

                console.log(`[RosterImporter] Verwende Blatt '${sheetName}'. baseDate(A2)=${baseDate ? baseDate.toDateString() : 'n/a'}`);

                const processBlock = (
                    startRow: number,
                    endRow: number,
                    blockLabel: string,
                    maps: BlockNameMaps,
                    expectedType: 'person' | 'azubi',
                    skipEmpty = false
                ) => {
                    console.log(`[RosterImporter] Verarbeite Block ${blockLabel}: Excel-Zeilen ${startRow + 1}–${endRow + 1}`);
                    for (let col = layout.firstDateCol; col < layout.firstDateCol + 2000; col++) {
                        const dateAddr = XLSX.utils.encode_cell({ r: layout.headerRow, c: col });
                        const dateCell = worksheet[dateAddr];

                        if ((!dateCell || dateCell.v == null) && !baseDate) break;

                        let dateValue: Date | null = dateCell ? parseHeaderDate(dateCell.v, year) : null;
                        if (!dateValue && baseDate) {
                            const offset = col - layout.firstDateCol;
                            const dt = new Date(baseDate);
                            dt.setDate(dt.getDate() + offset);
                            dateValue = dt;
                        }
                        if (!dateValue) continue;
                        if (dateValue.getFullYear() !== year) continue;
                        if (month !== undefined) {
                            if (typeof month === 'number') {
                                if (dateValue.getMonth() !== month) continue;
                            } else {
                                if (dateValue.getMonth() < month.start || dateValue.getMonth() > month.end) continue;
                            }
                        }

                        const dateStr = toISODateString(dateValue);

                        for (let row = startRow; row <= endRow; row++) {
                            const rawName = getRosterNameFromCell(worksheet, row, layout.nameCol);
                            if (!rawName || shouldSkipRosterNameRow(row, rawName, expectedType)) continue;

                            const personInfo = resolvePersonMatch(rawName, maps, mapByLastName, expectedType);
                            if (!personInfo) {
                                if (expectedType === 'azubi') {
                                    const dutyAddr = XLSX.utils.encode_cell({ r: row, c: col });
                                    const dutyCell = worksheet[dutyAddr];
                                    const dutyValue = dutyCell && dutyCell.v != null ? String(dutyCell.v).trim() : '';
                                    if (dutyValue) allUnknownAzubiNames.add(rawName);
                                }
                                continue;
                            }

                            seenPersons.add(`${personInfo.id}:${personInfo.type}`);

                            const dutyAddr = XLSX.utils.encode_cell({ r: row, c: col });
                            const dutyCell = worksheet[dutyAddr];
                            const dutyValue = dutyCell && dutyCell.v != null ? String(dutyCell.v).trim() : '';

                            if (!dutyValue && (month == null || skipEmpty)) continue;

                            entriesToImport.push({
                                personId: personInfo.id,
                                personType: personInfo.type,
                                date: dateStr,
                                value: dutyValue,
                                type: 'text',
                                department: options?.department
                            });
                        }
                    }
                };

                processBlock(layout.personnelStart, layout.personnelEnd, 'Personal', personnelMaps, 'person');
                processBlock(layout.azubiStart, layout.azubiEnd, 'Azubis', azubiMaps, 'azubi', false);

                for (const name of this.collectUnknownAzubiNames(worksheet, layout, year, month, azubiMaps, mapByLastName)) {
                    allUnknownAzubiNames.add(name);
                }
            }

            if (entriesToImport.length > 0 || allUnknownAzubiNames.size > 0) {
                console.log(`[RosterImporter] ${entriesToImport.length} Einträge gesammelt. Prüfe Dienstarten...`);
                
                // Unbekannte Dienstarten automatisch anlegen und Import NICHT abbrechen
                const unknownShiftTypes = await this.collectUnknownShiftTypes(entriesToImport);
                if (unknownShiftTypes.length > 0) {
                    console.log('[RosterImporter] Erstelle unbekannte Dienstarten automatisch:', unknownShiftTypes);
                    const providedMap = new Map((options?.newShiftTypes || []).map(s => [s.code, s]));
                    for (const code of unknownShiftTypes) {
                        const provided = providedMap.get(code);
                        const desc = provided?.description || `Dienstart ${code}`;
                        const color = provided?.color || '#0ea5e9';
                        
                        let auswertung = provided?.auswertung;
                        if (!auswertung) {
                            const upper = code.toUpperCase();
                            if (/TAG|FZF|MA|^T\d*$/i.test(upper)) auswertung = 'tag';
                            else if (/NACHT|^N\d*$/i.test(upper)) auswertung = 'nacht';
                            else if (/24|24H/i.test(upper)) auswertung = '24h';
                            else auswertung = 'off';
                        }
                        
                        try {
                            await this.dbAdapter.addShiftType({ code, description: desc });
                            await this.dbAdapter.setSetting(`color_${code}`, color);
                            await this.dbAdapter.setSetting(`auswertung_${code}`, auswertung);
                        } catch (stErr) {
                            console.warn(`[RosterImporter] Fehler beim Erstellen der Dienstart ${code}:`, stErr);
                        }
                    }
                }

                // Azubi-Zeiträume automatisch anpassen/erstellen
                console.log(`[RosterImporter] Prüfe Azubi-Zeiträume...`);
                const azubisWithoutPeriod = await this.checkAzubiPeriods(entriesToImport, year, month);
                if (azubisWithoutPeriod.length > 0) {
                    console.log('[RosterImporter] Erstelle fehlende Azubi-Zeiträume automatisch:', azubisWithoutPeriod);
                    const providedMap = new Map((options?.azubiPeriodAdjustments || []).map(a => [a.azubiId, a]));
                    for (const item of azubisWithoutPeriod) {
                        const provided = providedMap.get(item.azubiId);
                        const startDate = provided?.startDate || item.importDateRange?.start || `${year}-01-01`;
                        const endDate = provided?.endDate || item.importDateRange?.end || `${year}-12-31`;
                        const description = provided?.description || 'Automatisch durch Import hinzugefügt';
                        const lehrjahr = provided?.lehrjahr || 1;
                        
                        try {
                            await this.dbAdapter.addAzubiPeriod({
                                azubi_id: item.azubiId,
                                start_date: startDate,
                                end_date: endDate,
                                description: description,
                                lehrjahr: lehrjahr
                            });
                        } catch (apErr) {
                            console.warn(`[RosterImporter] Fehler beim Erstellen des Azubi-Zeitraums für ${item.azubiName}:`, apErr);
                        }
                    }
                }

                // Unbekannte Azubis automatisch anlegen (damit keine Einträge verloren gehen)
                if (allUnknownAzubiNames.size > 0) {
                    console.log('[RosterImporter] Erstelle unbekannte Azubis automatisch:', Array.from(allUnknownAzubiNames));
                    const providedNewAzubis = options?.newAzubis || [];
                    for (const rawName of allUnknownAzubiNames) {
                        const prov = providedNewAzubis.find(a => `${a.vorname} ${a.name}`.trim() === rawName || `${a.name}, ${a.vorname}`.trim() === rawName || a.name === rawName);
                        let surname = prov?.name;
                        let firstname = prov?.vorname;
                        let lj = prov?.lehrjahr || 1;
                        
                        if (!surname) {
                            if (rawName.includes(',')) {
                                const parts = rawName.split(',').map(s => s.trim());
                                surname = parts[0];
                                firstname = parts[1] || '';
                            } else {
                                const parts = rawName.trim().split(' ');
                                firstname = parts.slice(0, -1).join(' ') || parts[0];
                                surname = parts.slice(-1)[0] || '';
                            }
                        }
                        
                        try {
                            const newAz = await this.dbAdapter.addAzubi({
                                name: surname,
                                vorname: firstname,
                                lehrjahr: lj,
                                department: importDept
                            });
                            const newId = newAz?.lastInsertRowid || newAz?.lastID || newAz?.id;
                            if (newId) {
                                await this.dbAdapter.addAzubiPeriod({
                                    azubi_id: newId,
                                    start_date: `${year}-01-01`,
                                    end_date: `${year}-12-31`,
                                    description: 'Automatisch durch Import erstellt',
                                    lehrjahr: lj
                                });
                            }
                        } catch (azErr) {
                            console.warn(`[RosterImporter] Fehler beim automatischen Erstellen von Azubi ${rawName}:`, azErr);
                        }
                    }
                }

                console.log(`[RosterImporter] Schreibe ${entriesToImport.length} Einträge in duty_roster.`);
                
                const isYearlyImport = month == null;
                const deleteEmpty = !isYearlyImport;
                const respectManualEdits = !isYearlyImport;
                
                const availabilityConflicts = await this.checkAvailabilityConflicts(entriesToImport);
                
                const result = await this.dbAdapter.bulkImportDutyRosterEntries(entriesToImport, respectManualEdits, deleteEmpty);
                console.log(`[RosterImporter] Import: ${result.imported} importiert, ${result.skipped} übersprungen.`);
                
                if (deleteEmpty && seenPersons.size > 0) {
                    const seenList = Array.from(seenPersons);
                    const deletedOrphans = await this.dbAdapter.deleteOrphanedDutyRosterEntries(year, month, seenList, options?.department);
                    if (deletedOrphans > 0) {
                        console.log(`[RosterImporter] Sync-Cleanup: ${deletedOrphans} verwaiste Einträge wurden entfernt.`);
                    }
                }
                
                const unknownAzubiList = allUnknownAzubiNames.size > 0 ? Array.from(allUnknownAzubiNames).sort() : undefined;

                return {
                    success: true,
                    message: `Dienstplan erfolgreich importiert. ${result.imported} Einträge verarbeitet, ${result.skipped} geschützt/übersprungen.`,
                    importedCount: result.imported,
                    unknownAzubis: unknownAzubiList,
                    availabilityConflicts: availabilityConflicts.length > 0 ? availabilityConflicts : undefined
                };
            } else {
                console.warn('[RosterImporter] Keine Einträge zum Import gefunden.');
            }

            const unknownAzubiList = allUnknownAzubiNames.size > 0 ? Array.from(allUnknownAzubiNames).sort() : undefined;

            return { success: true, message: `Keine Einträge zum Import gefunden.`, importedCount: 0, unknownAzubis: unknownAzubiList };

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