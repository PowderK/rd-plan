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

export class RosterImporter {
    constructor(private dbAdapter: DatabaseAdapter) {}

    // Parse-only preview: returns unmatched names and simple stats without writing to DB
    public async previewDutyRoster(filePath: string, year: number, month?: number): Promise<{ success: boolean; total: number; matched: number; unmatchedNames: string[]; overwrites: number; message?: string; }> {
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
                        if (month !== undefined && dateValue.getMonth() !== month) continue;
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
    public async importDutyRoster(filePath: string, year: number, month?: number, options?: { mappings?: Record<string, number> }): Promise<{success: boolean, message: string, importedCount: number}> {
        try {
            const workbook = XLSX.readFile(filePath);
            const sheetNames = workbook.SheetNames;
            const entriesToImport: RosterEntry[] = [];

            // Build name maps once
            const personnel = await this.dbAdapter.getPersonnel();
            const azubis = await this.dbAdapter.getAzubiList();
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
                fullNameMap.set(`${a.name}, ${a.vorname}`.toLowerCase(), { id: a.id, type: 'azubi' });
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
                const fixed = {
                    headerRow: 3,           // Zeile 4 (0-based)
                    firstDateCol: 3,        // Spalte D (0-based)
                    nameCol: 1,             // Spalte B (0-based)
                    personnelStart: 5,      // Zeile 6 (0-based)
                    personnelEnd: 56,       // Zeile 57 (0-based)
                    azubiStart: 69,         // Zeile 70 (0-based)
                    azubiEnd: 86            // Zeile 87 (0-based)
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

                const processBlock = (startRow: number, endRow: number, blockLabel: string) => {
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
                        if (month !== undefined && dateValue.getMonth() !== month) continue;

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

                            const dutyAddr = XLSX.utils.encode_cell({ r: row, c: col });
                            const dutyCell = worksheet[dutyAddr];
                            const dutyValue = dutyCell && dutyCell.v != null ? String(dutyCell.v).trim() : '';
                            if (!dutyValue) continue;

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

                // Process personnel and azubi blocks
                processBlock(fixed.personnelStart, fixed.personnelEnd, 'Personal');
                processBlock(fixed.azubiStart, fixed.azubiEnd, 'Azubis');
            }

            if (entriesToImport.length > 0) {
                console.log(`[RosterImporter] Schreibe ${entriesToImport.length} Einträge in duty_roster.`);
                await this.dbAdapter.bulkSetDutyRosterEntries(entriesToImport);
            } else {
                console.warn('[RosterImporter] Keine Einträge zum Import gefunden.');
            }

            return { success: true, message: `Dienstplan erfolgreich importiert. ${entriesToImport.length} Einträge verarbeitet.`, importedCount: entriesToImport.length };

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