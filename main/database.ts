import BetterSqlite3 from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
 
type AsyncStatement = {
    run: (...params: any[]) => Promise<any>;
    get: <T = any>(...params: any[]) => Promise<T | undefined>;
    all: <T = any>(...params: any[]) => Promise<T[]>;
    finalize: () => Promise<void>;
};

export type AsyncDB = {
    exec: (sql: string) => Promise<void>;
    run: (sql: string, params?: any[]) => Promise<any>;
    get: <T = any>(sql: string, params?: any[]) => Promise<T | undefined>;
    all: <T = any>(sql: string, params?: any[]) => Promise<T[]>;
    prepare: (sql: string) => Promise<AsyncStatement>;
};

export const initializeDatabase = async (): Promise<AsyncDB> => {
    // Store the database in the application root under a `DB/` subfolder.
    // Use the executable path to find the app root (works for portable builds).
    const exePath = app.getPath ? app.getPath('exe') : process.execPath;
    const appRoot = path.dirname(exePath);
    const dbDir = path.join(appRoot, 'DB');
    try { fs.mkdirSync(dbDir, { recursive: true }); } catch (e) { /* ignore */ }
    const dbFile = path.join(dbDir, 'rd-plan.db');
    console.log('[DB] initializeDatabase using DB file:', dbFile);
    const raw = new BetterSqlite3(dbFile);
    const db: AsyncDB = {
        exec: async (sql: string) => { raw.exec(sql); },
        run: async (sql: string, params: any[] = []) => {
            const stmt = raw.prepare(sql);
            return Array.isArray(params) ? stmt.run(...params) : stmt.run(params);
        },
        get: async <T = any>(sql: string, params: any[] = []) => {
            const stmt = raw.prepare(sql);
            return Array.isArray(params) ? (stmt.get(...params) as T | undefined) : (stmt.get(params) as T | undefined);
        },
        all: async <T = any>(sql: string, params: any[] = []) => {
            const stmt = raw.prepare(sql);
            return Array.isArray(params) ? (stmt.all(...params) as T[]) : (stmt.all(params) as T[]);
        },
        prepare: async (sql: string): Promise<AsyncStatement> => {
            const stmt = raw.prepare(sql);
            return {
                run: async (...params: any[]) => stmt.run(...params),
                get: async <T = any>(...params: any[]) => stmt.get(...params) as T | undefined,
                all: async <T = any>(...params: any[]) => stmt.all(...params) as T[],
                finalize: async () => { /* no-op for better-sqlite3 */ },
            };
        },
    };

    await db.exec(`
        CREATE TABLE IF NOT EXISTS shifts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            shiftType TEXT NOT NULL,
            personnel TEXT NOT NULL
        )
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS personnel (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            vorname TEXT NOT NULL,
            teilzeit INTEGER NOT NULL,
            fahrzeugfuehrer INTEGER NOT NULL,
            fahrzeugfuehrerHLFB INTEGER NOT NULL,
            nef INTEGER NOT NULL DEFAULT 0,
            itwMaschinist INTEGER NOT NULL DEFAULT 0,
            itwFahrzeugfuehrer INTEGER NOT NULL DEFAULT 0,
            sort INTEGER NOT NULL DEFAULT 0
        )
    `);

    // Migration: add 'nef' column to personnel if missing
    const personnelCols = await db.all("PRAGMA table_info('personnel')");
    if (!personnelCols.some((c: any) => c.name === 'nef')) {
        console.log('[DB] Adding missing column "nef" to personnel table');
        // Use a permissive ALTER that will set default 0 for existing rows. Some older sqlite builds
        // may not accept NOT NULL on ADD COLUMN, so add without NOT NULL then ensure no NULLs remain.
        await db.exec("ALTER TABLE personnel ADD COLUMN nef INTEGER DEFAULT 0");
        await db.exec("UPDATE personnel SET nef = 0 WHERE nef IS NULL");
    }

    // Robustness: if column exists but contains NULL values, coerce them to 0
    try {
        const colsAfter = await db.all("PRAGMA table_info('personnel')");
        if (colsAfter.some((c: any) => c.name === 'nef')) {
            await db.exec("UPDATE personnel SET nef = 0 WHERE nef IS NULL");
        }
        // Migration: add ITW flags if missing
        if (!colsAfter.some((c: any) => c.name === 'itwMaschinist')) {
            console.log('[DB] Adding missing column "itwMaschinist" to personnel table');
            await db.exec("ALTER TABLE personnel ADD COLUMN itwMaschinist INTEGER DEFAULT 0");
            await db.exec("UPDATE personnel SET itwMaschinist = 0 WHERE itwMaschinist IS NULL");
        }
        if (!colsAfter.some((c: any) => c.name === 'itwFahrzeugfuehrer')) {
            console.log('[DB] Adding missing column "itwFahrzeugfuehrer" to personnel table');
            await db.exec("ALTER TABLE personnel ADD COLUMN itwFahrzeugfuehrer INTEGER DEFAULT 0");
            await db.exec("UPDATE personnel SET itwFahrzeugfuehrer = 0 WHERE itwFahrzeugfuehrer IS NULL");
        }
    } catch (e) {
        console.warn('[DB] Warning while ensuring nef defaults:', e);
    }

    await db.exec(`
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
    `);

    // Feiertage-Tabelle: speichert Datum (ISO) und optionalen Namen
    await db.exec(`
        CREATE TABLE IF NOT EXISTS holidays (
            date TEXT PRIMARY KEY,
            name TEXT NOT NULL DEFAULT ''
        )
    `);

    // Hilfsfunktionen: Ostersonntag berechnen (Gregorianischer Algorithmus)
    function calcEasterSunday(year: number): Date {
        const a = year % 19;
        const b = Math.floor(year / 100);
        const c = year % 100;
        const d = Math.floor(b / 4);
        const e = b % 4;
        const f = Math.floor((b + 8) / 25);
        const g = Math.floor((b - f + 1) / 3);
        const h = (19 * a + b - d - g + 15) % 30;
        const i = Math.floor(c / 4);
        const k = c % 4;
        const l = (32 + 2 * e + 2 * i - h - k) % 7;
        const m = Math.floor((a + 11 * h + 22 * l) / 451);
        const month = Math.floor((h + l - 7 * m + 114) / 31); // 3=March, 4=April
        const day = ((h + l - 7 * m + 114) % 31) + 1;
        // Date in UTC, um ISO-Strings stabil zu bilden
        return new Date(Date.UTC(year, month - 1, day));
    }
    function addDaysUTC(d: Date, days: number): Date {
        const nd = new Date(d.getTime());
        nd.setUTCDate(nd.getUTCDate() + days);
        return nd;
    }
    function toISODate(d: Date): string {
        return d.toISOString().slice(0, 10);
    }
    function getNiedersachsenHolidays(year: number): { date: string, name: string }[] {
        const easter = calcEasterSunday(year);
        const karfreitag = addDaysUTC(easter, -2);
        const ostermontag = addDaysUTC(easter, 1);
        const himmelfahrt = addDaysUTC(easter, 39);
        const pfingstmontag = addDaysUTC(easter, 50);
        return [
            { date: `${year}-01-01`, name: 'Neujahr' },
            { date: toISODate(karfreitag), name: 'Karfreitag' },
            { date: toISODate(ostermontag), name: 'Ostermontag' },
            { date: `${year}-05-01`, name: 'Tag der Arbeit' },
            { date: toISODate(himmelfahrt), name: 'Christi Himmelfahrt' },
            { date: toISODate(pfingstmontag), name: 'Pfingstmontag' },
            { date: `${year}-10-03`, name: 'Tag der Deutschen Einheit' },
            { date: `${year}-10-31`, name: 'Reformationstag' },
            { date: `${year}-12-25`, name: '1. Weihnachtstag' },
            { date: `${year}-12-26`, name: '2. Weihnachtstag' },
        ];
    }
    async function insertNIHolidaysIfMissing(db: AsyncDB, year: number) {
        const list = getNiedersachsenHolidays(year);
        await db.run('BEGIN');
        try {
            for (const h of list) {
                // Bestehende Einträge nicht überschreiben
                await db.run('INSERT OR IGNORE INTO holidays (date, name) VALUES (?, ?)', [h.date, h.name]);
            }
            await db.run('COMMIT');
            console.log('[DB] Holidays NI seeded (missing only) for year', year);
        } catch (e) {
            await db.run('ROLLBACK');
            console.warn('[DB] insertNIHolidaysIfMissing failed', { year, e });
        }
    }
    // Fülle die nächsten 20 Jahre (inkl. aktuelles Jahr) für Niedersachsen, ohne vorhandene Einträge zu überschreiben
    try {
        const nowYear = new Date().getFullYear();
        for (let y = 0; y < 20; y++) {
            await insertNIHolidaysIfMissing(db, nowYear + y);
        }
    } catch (e) {
        console.warn('[DB] Auto-seed NI holidays failed', e);
    }

    // ITW-Schichtfolgen mit Gültig-ab (mehrere Sequenzen möglich)
    await db.exec(`
        CREATE TABLE IF NOT EXISTS itw_patterns (
            start_date TEXT PRIMARY KEY,
            pattern TEXT NOT NULL
        )
    `);

    // Reguläre Abteilungs-Schichtfolgen (1/2/3) mit Gültig-ab (mehrere Sequenzen möglich)
    await db.exec(`
        CREATE TABLE IF NOT EXISTS dept_patterns (
            start_date TEXT PRIMARY KEY,
            pattern TEXT NOT NULL
        )
    `);

    // Migration: ITW-Muster von 22 auf 21 Tage vereinheitlichen
    try {
        const row21: any = await db.get("SELECT value FROM settings WHERE key = 'itw_pattern21'");
        const row22: any = await db.get("SELECT value FROM settings WHERE key = 'itw_pattern22'");
        if (row22 && typeof row22.value === 'string') {
            const parts = row22.value.split(',').map((s: string) => s.trim());
            // auf 21 kürzen und nur '' oder 'IW' zulassen
            const norm21 = (parts.slice(0, 21).concat(Array(21).fill(''))).slice(0,21).map((v: string) => (v === 'IW' ? 'IW' : ''));
            if (!row21 || typeof row21.value !== 'string' || row21.value !== norm21.join(',')) {
                await db.run(
                    `INSERT INTO settings (key, value) VALUES ('itw_pattern21', ?)
                     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
                    [norm21.join(',')]
                );
            }
            // alten Schlüssel entfernen, um Verwirrung zu vermeiden
            await db.run("DELETE FROM settings WHERE key = 'itw_pattern22'");
        }
    } catch (e) {
        console.warn('[DB] ITW pattern migration warning:', e);
    }

    // Migration: falls itw_patterns leer ist, aus itw_pattern21 seeden
    try {
        const count: any = await db.get('SELECT COUNT(1) as cnt FROM itw_patterns');
        if (!count || count.cnt === 0) {
            const row21: any = await db.get("SELECT value FROM settings WHERE key = 'itw_pattern21'");
            if (row21 && typeof row21.value === 'string') {
                const norm21 = (row21.value.split(',').map((s: string) => s.trim()).slice(0,21).concat(Array(21).fill('')).slice(0,21)).map((v: string) => (v === 'IW' ? 'IW' : '')).join(',');
                // Standard-Startdatum weit in der Vergangenheit, damit es immer greift, bis ein neuer Eintrag angelegt wird
                await db.run('INSERT OR REPLACE INTO itw_patterns (start_date, pattern) VALUES (?, ?)', ['1970-01-01', norm21]);
                console.log('[DB] Seeded itw_patterns from itw_pattern21');
            }
        }
    } catch (e) {
        console.warn('[DB] itw_patterns seeding warning:', e);
    }

    // Seed dept_patterns mit bisherigem 21er Standardmuster, falls leer
    try {
        const countDept: any = await db.get('SELECT COUNT(1) as cnt FROM dept_patterns');
        if (!countDept || countDept.cnt === 0) {
            const def = ['3','2','1','3','1','3','2','1','3','2','1','2','1','3','2','1','3','2','3','2','1'];
            const norm = def.slice(0,21).concat(Array(21).fill('')).slice(0,21).map(v => (v === '1' || v === '2' || v === '3') ? v : '');
            await db.run('INSERT OR REPLACE INTO dept_patterns (start_date, pattern) VALUES (?, ?)', ['1970-01-01', norm.join(',')]);
            console.log('[DB] Seeded dept_patterns with default sequence');
        }
    } catch (e) {
        console.warn('[DB] dept_patterns seeding warning:', e);
    }

    await db.exec(`
        CREATE TABLE IF NOT EXISTS shift_types (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT NOT NULL UNIQUE,
            description TEXT NOT NULL
        )
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS duty_roster (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            personId INTEGER NOT NULL,
            personType TEXT NOT NULL DEFAULT 'person',
            date TEXT NOT NULL,
            value TEXT NOT NULL,
            type TEXT NOT NULL,
            UNIQUE(personId, personType, date)
        )
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS azubis (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            vorname TEXT NOT NULL,
            lehrjahr INTEGER NOT NULL
            , sort INTEGER NOT NULL DEFAULT 0
        )
    `);

    // Migration: add 'sort' column to azubis if missing
    const azubiCols = await db.all("PRAGMA table_info('azubis')");
    if (!azubiCols.some((c: any) => c.name === 'sort')) {
        console.log('[DB] Adding missing column "sort" to azubis table');
        await db.exec("ALTER TABLE azubis ADD COLUMN sort INTEGER DEFAULT 0");
        await db.exec("UPDATE azubis SET sort = 0 WHERE sort IS NULL");
    }

    // Migration: Falls Spalte personType fehlt, hinzufügen
    const columns = await db.all("PRAGMA table_info('duty_roster')");
    if (!columns.some((col: any) => col.name === 'personType')) {
        await db.exec("ALTER TABLE duty_roster ADD COLUMN personType TEXT NOT NULL DEFAULT 'person'");
    }

    // --- Migration für personType + UNIQUE(personId, personType, date) ---
    const pragma = await db.all("PRAGMA table_info('duty_roster')");
    const hasPersonType = pragma.some((col: any) => col.name === 'personType');
    let needsMigration = false;
    if (!hasPersonType) {
        needsMigration = true;
    } else {
        // Prüfe, ob UNIQUE-Constraint korrekt ist
        const idx = await db.all("PRAGMA index_list('duty_roster')");
        if (!idx.some((i: any) => i.unique && i.name && i.name.includes('personId') && i.name.includes('personType') && i.name.includes('date'))) {
            needsMigration = true;
        }
    }
    if (needsMigration) {
        await db.exec(`
            CREATE TABLE IF NOT EXISTS duty_roster_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                personId INTEGER NOT NULL,
                personType TEXT NOT NULL DEFAULT 'person',
                date TEXT NOT NULL,
                value TEXT NOT NULL,
                type TEXT NOT NULL,
                UNIQUE(personId, personType, date)
            );
        `);
        // Kopiere alte Daten, setze personType='person' für bestehende Einträge
        if (!hasPersonType) {
            await db.exec(`
                INSERT INTO duty_roster_new (personId, personType, date, value, type)
                SELECT personId, 'person', date, value, type FROM duty_roster;
            `);
        } else {
            await db.exec(`
                INSERT INTO duty_roster_new (personId, personType, date, value, type)
                SELECT personId, personType, date, value, type FROM duty_roster;
            `);
        }
        await db.exec('DROP TABLE duty_roster;');
        await db.exec('ALTER TABLE duty_roster_new RENAME TO duty_roster;');
    }

    // --- Migration für korrekten UNIQUE-Constraint (personId, personType, date) ---
    async function fixDutyRosterUniqueConstraint(db: AsyncDB) {
        // Prüfe, ob der Constraint falsch ist
        const idx = await db.all("PRAGMA index_list('duty_roster')");
        const hasWrongUnique = idx.some((i: any) => i.unique && i.name && i.name.includes('personId') && !i.name.includes('personType'));
        if (hasWrongUnique) {
            console.log('[DB] Führe Migration für korrekten UNIQUE-Constraint in duty_roster aus!');
            await db.exec(`
                CREATE TABLE IF NOT EXISTS duty_roster_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    personId INTEGER NOT NULL,
                    personType TEXT NOT NULL DEFAULT 'person',
                    date TEXT NOT NULL,
                    value TEXT NOT NULL,
                    type TEXT NOT NULL,
                    UNIQUE(personId, personType, date)
                );
            `);
            // Kopiere alle Daten, setze personType auf 'person' falls leer
            await db.exec(`
                INSERT INTO duty_roster_new (personId, personType, date, value, type)
                SELECT personId, COALESCE(personType, 'person'), date, value, type FROM duty_roster;
            `);
            await db.exec('DROP TABLE duty_roster;');
            await db.exec('ALTER TABLE duty_roster_new RENAME TO duty_roster;');
            console.log('[DB] Migration abgeschlossen: duty_roster hat jetzt UNIQUE(personId, personType, date)');
        }
    }

    await fixDutyRosterUniqueConstraint(db);

    // --- ITW Ärzte Tabelle ---
    await db.exec(`
        CREATE TABLE IF NOT EXISTS itw_doctors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            vorname TEXT NOT NULL,
            sort INTEGER NOT NULL DEFAULT 0
        )
    `);

    // Migration: add 'sort' column to itw_doctors if missing
    const itwCols = await db.all("PRAGMA table_info('itw_doctors')");
    if (!itwCols.some((c: any) => c.name === 'sort')) {
        console.log('[DB] Adding missing column "sort" to itw_doctors table');
        await db.exec("ALTER TABLE itw_doctors ADD COLUMN sort INTEGER DEFAULT 0");
        await db.exec("UPDATE itw_doctors SET sort = 0 WHERE sort IS NULL");
    }

    // --- RTW / NEF Fahrzeuge Tabellen ---
    await db.exec(`
        CREATE TABLE IF NOT EXISTS rtw_vehicles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            sort INTEGER NOT NULL DEFAULT 0,
            archived_year INTEGER
        )
    `);
    await db.exec(`
        CREATE TABLE IF NOT EXISTS nef_vehicles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            sort INTEGER NOT NULL DEFAULT 0,
            archived_year INTEGER,
            occupancy_mode TEXT NOT NULL DEFAULT '24h'
        )
    `);
    // Migration: add archived_year columns if missing
    const rtwCols = await db.all("PRAGMA table_info('rtw_vehicles')");
    if (!rtwCols.some((c: any) => c.name === 'archived_year')) {
        console.log('[DB] Adding archived_year to rtw_vehicles');
        await db.exec("ALTER TABLE rtw_vehicles ADD COLUMN archived_year INTEGER");
    }
    const nefCols = await db.all("PRAGMA table_info('nef_vehicles')");
    if (!nefCols.some((c: any) => c.name === 'archived_year')) {
        console.log('[DB] Adding archived_year to nef_vehicles');
        await db.exec("ALTER TABLE nef_vehicles ADD COLUMN archived_year INTEGER");
    }
    if (!nefCols.some((c: any) => c.name === 'occupancy_mode')) {
        console.log('[DB] Adding occupancy_mode to nef_vehicles');
        await db.exec("ALTER TABLE nef_vehicles ADD COLUMN occupancy_mode TEXT DEFAULT '24h'");
        try { await db.exec("UPDATE nef_vehicles SET occupancy_mode = '24h' WHERE occupancy_mode IS NULL"); } catch {}
    }
    if (!nefCols.some((c: any) => c.name === 'occupancy_mode')) {
        console.log('[DB] Adding occupancy_mode to nef_vehicles');
        await db.exec("ALTER TABLE nef_vehicles ADD COLUMN occupancy_mode TEXT DEFAULT '24h'");
        await db.exec("UPDATE nef_vehicles SET occupancy_mode = '24h' WHERE occupancy_mode IS NULL OR occupancy_mode = ''");
    }
    // Aktivierungen pro Monat/Jahr (default: aktiv)
    await db.exec(`
        CREATE TABLE IF NOT EXISTS rtw_vehicle_months (
            vehicleId INTEGER NOT NULL,
            year INTEGER NOT NULL,
            month INTEGER NOT NULL,
            enabled INTEGER NOT NULL DEFAULT 1,
            PRIMARY KEY(vehicleId, year, month)
        )
    `);
    await db.exec(`
        CREATE TABLE IF NOT EXISTS nef_vehicle_months (
            vehicleId INTEGER NOT NULL,
            year INTEGER NOT NULL,
            month INTEGER NOT NULL,
            enabled INTEGER NOT NULL DEFAULT 1,
            PRIMARY KEY(vehicleId, year, month)
        )
    `);

    return db;
};

export const getShifts = async (db: AsyncDB) => {
    return await db.all('SELECT * FROM shifts');
};

export const addShift = async (db: AsyncDB, shift: any) => {
    const { date, shiftType, personnel } = shift;
    await db.run('INSERT INTO shifts (date, shiftType, personnel) VALUES (?, ?, ?)', [date, shiftType, personnel]);
};

export const updateShift = async (db: AsyncDB, shift: any) => {
    const { id, date, shiftType, personnel } = shift;
    await db.run('UPDATE shifts SET date = ?, shiftType = ?, personnel = ? WHERE id = ?', [date, shiftType, personnel, id]);
};

export const deleteShift = async (db: AsyncDB, id: number) => {
    await db.run('DELETE FROM shifts WHERE id = ?', [id]);
};

export const getPersonnel = async (db: AsyncDB) => {
    return await db.all('SELECT * FROM personnel ORDER BY sort ASC, id ASC');
};

export const addPersonnel = async (db: AsyncDB, person: any) => {
    const { name, vorname, teilzeit, fahrzeugfuehrer, fahrzeugfuehrerHLFB, nef, itwMaschinist, itwFahrzeugfuehrer, sort } = person;
    await db.run('INSERT INTO personnel (name, vorname, teilzeit, fahrzeugfuehrer, fahrzeugfuehrerHLFB, nef, itwMaschinist, itwFahrzeugfuehrer, sort) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [name, vorname, teilzeit, fahrzeugfuehrer ? 1 : 0, fahrzeugfuehrerHLFB ? 1 : 0, nef ? 1 : 0, itwMaschinist ? 1 : 0, itwFahrzeugfuehrer ? 1 : 0, sort ?? 0]);
};

export const updatePersonnel = async (db: AsyncDB, person: any) => {
    const { id, name, vorname, teilzeit, fahrzeugfuehrer, fahrzeugfuehrerHLFB, nef, itwMaschinist, itwFahrzeugfuehrer, sort } = person;
    await db.run('UPDATE personnel SET name = ?, vorname = ?, teilzeit = ?, fahrzeugfuehrer = ?, fahrzeugfuehrerHLFB = ?, nef = ?, itwMaschinist = ?, itwFahrzeugfuehrer = ?, sort = ? WHERE id = ?', [name, vorname, teilzeit, fahrzeugfuehrer ? 1 : 0, fahrzeugfuehrerHLFB ? 1 : 0, nef ? 1 : 0, itwMaschinist ? 1 : 0, itwFahrzeugfuehrer ? 1 : 0, sort ?? 0, id]);
};

export const deletePersonnel = async (db: AsyncDB, id: number) => {
    await db.run('DELETE FROM personnel WHERE id = ?', [id]);
};

export const updatePersonnelOrder = async (db: AsyncDB, order: number[]) => {
    for (let i = 0; i < order.length; i++) {
        await db.run('UPDATE personnel SET sort = ? WHERE id = ?', [i, order[i]]);
    }
};

export const getSetting = async (db: AsyncDB, key: string) => {
    const row = await db.get('SELECT value FROM settings WHERE key = ?', [key]);
    return row ? row.value : null;
};

export const setSetting = async (db: AsyncDB, key: string, value: string) => {
    await db.run(`
        INSERT INTO settings (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `, [key, value]);
};

export const getShiftTypes = async (db: AsyncDB) => {
    return await db.all('SELECT * FROM shift_types ORDER BY code ASC');
};

export const addShiftType = async (db: AsyncDB, type: { code: string, description: string }) => {
    await db.run('INSERT INTO shift_types (code, description) VALUES (?, ?)', [type.code, type.description]);
};

export const updateShiftType = async (db: AsyncDB, type: { id: number, code: string, description: string }) => {
    await db.run('UPDATE shift_types SET code = ?, description = ? WHERE id = ?', [type.code, type.description, type.id]);
};

export const deleteShiftType = async (db: AsyncDB, id: number) => {
    await db.run('DELETE FROM shift_types WHERE id = ?', [id]);
};

export const getDutyRoster = async (db: AsyncDB, year: number) => {
    const start = `${year}-01-01`;
    const end = `${year}-12-31`;
    console.log(`[DB] getDutyRoster year=${year} start=${start} end=${end}`);
    const rows = await db.all('SELECT * FROM duty_roster WHERE date BETWEEN ? AND ?', [start, end]);
    console.log('[DB] getDutyRoster returned rows=', Array.isArray(rows) ? rows.length : typeof rows);
    return rows;
};

// --- Holidays CRUD ---
export const getHolidaysForYear = async (db: AsyncDB, year: number) => {
    const start = `${year}-01-01`;
    const end = `${year}-12-31`;
    return await db.all('SELECT date, name FROM holidays WHERE date BETWEEN ? AND ? ORDER BY date ASC', [start, end]);
};

export const setHolidaysForYear = async (db: AsyncDB, year: number, dates: { date: string, name?: string }[]) => {
    const start = `${year}-01-01`;
    const end = `${year}-12-31`;
    console.log('[DB] setHolidaysForYear start', { year, count: (dates || []).length });
    // Vorab filtern: nur gültige Datensätze für das Zieljahr
    const inYear = (dates || []).map(raw => {
        if (!raw || !raw.date) return null;
        const date = String(raw.date).trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
        if (date < start || date > end) return null;
        const name = String(raw.name ?? '').trim();
        return { date, name } as { date: string; name: string };
    }).filter((x): x is { date: string; name: string } => !!x);

    // Sicherheitsnetz: Wenn keine inYear-Daten vorhanden, breche ab, um bestehende Einträge nicht versehentlich zu löschen
    if (inYear.length === 0) {
        console.warn('[DB] setHolidaysForYear: no valid in-year dates provided, skipping update to avoid wiping existing holidays', { year });
        return; // No-Op
    }

    await db.run('BEGIN');
    try {
        await db.run('DELETE FROM holidays WHERE date BETWEEN ? AND ?', [start, end]);
        let ins = 0;
        for (const h of inYear) {
            await db.run(`
                INSERT INTO holidays (date, name) VALUES (?, ?)
                ON CONFLICT(date) DO UPDATE SET name = excluded.name
            `, [h.date, h.name]);
            ins++;
        }
        await db.run('COMMIT');
        console.log('[DB] setHolidaysForYear committed', { inserted: ins });
    } catch (e) {
        await db.run('ROLLBACK');
        console.error('[DB] setHolidaysForYear error, rolled back', e);
        throw e;
    }
};

export const addHoliday = async (db: AsyncDB, date: string, name: string = '') => {
    await db.run(`
        INSERT INTO holidays (date, name) VALUES (?, ?)
        ON CONFLICT(date) DO UPDATE SET name = excluded.name
    `, [date, name]);
};

// --- ITW Patterns CRUD ---
export const getItwPatterns = async (db: AsyncDB) => {
    const rows = await db.all('SELECT start_date as startDate, pattern FROM itw_patterns ORDER BY start_date ASC');
    return rows.map((r: any) => ({ startDate: String(r.startDate), pattern: String(r.pattern) }));
};

export const setItwPatterns = async (db: AsyncDB, patterns: { startDate: string, pattern: string }[]) => {
    console.log('[DB] setItwPatterns', { count: (patterns || []).length });
    await db.run('BEGIN');
    try {
        await db.run('DELETE FROM itw_patterns');
        let ins = 0;
        for (const p of (patterns || [])) {
            if (!p || !p.startDate || !p.pattern) continue;
            const sd = String(p.startDate).trim();
            if (!/^\d{4}-\d{2}-\d{2}$/.test(sd)) continue;
            // validate 21 Felder, jeweils '' oder 'IW'
            const parts = String(p.pattern).split(',').map(s => s.trim());
            const norm = (parts.slice(0,21).concat(Array(21).fill('')).slice(0,21)).map(v => (v === 'IW' ? 'IW' : ''));
            await db.run('INSERT INTO itw_patterns (start_date, pattern) VALUES (?, ?)', [sd, norm.join(',')]);
            ins++;
        }
        await db.run('COMMIT');
        console.log('[DB] setItwPatterns committed', { inserted: ins });
    } catch (e) {
        await db.run('ROLLBACK');
        console.error('[DB] setItwPatterns error, rolled back', e);
        throw e;
    }
};

// --- Department Patterns CRUD ---
export const getDeptPatterns = async (db: AsyncDB) => {
    const rows = await db.all('SELECT start_date as startDate, pattern FROM dept_patterns ORDER BY start_date ASC');
    return rows.map((r: any) => ({ startDate: String(r.startDate), pattern: String(r.pattern) }));
};

export const setDeptPatterns = async (db: AsyncDB, patterns: { startDate: string, pattern: string }[]) => {
    console.log('[DB] setDeptPatterns', { count: (patterns || []).length });
    await db.run('BEGIN');
    try {
        await db.run('DELETE FROM dept_patterns');
        let ins = 0;
        for (const p of (patterns || [])) {
            if (!p || !p.startDate) continue;
            const sd = String(p.startDate).trim();
            if (!/\d{4}-\d{2}-\d{2}/.test(sd)) continue;
            const parts = String(p.pattern || '').split(',').map(s => s.trim());
            const norm = (parts.slice(0,21).concat(Array(21).fill('')).slice(0,21)).map(v => (v === '1' || v === '2' || v === '3') ? v : '');
            await db.run('INSERT INTO dept_patterns (start_date, pattern) VALUES (?, ?)', [sd, norm.join(',')]);
            ins++;
        }
        await db.run('COMMIT');
        console.log('[DB] setDeptPatterns committed', { inserted: ins });
    } catch (e) {
        await db.run('ROLLBACK');
        console.error('[DB] setDeptPatterns error, rolled back', e);
        throw e;
    }
};

export const deleteHoliday = async (db: AsyncDB, date: string) => {
    await db.run('DELETE FROM holidays WHERE date = ?', [date]);
};

export const setDutyRosterEntry = async (db: AsyncDB, entry: { personId: number, personType: string, date: string, value: string, type: string }) => {
    if (!entry.personId || !entry.date) {
        console.warn('[DB] setDutyRosterEntry skipped invalid entry:', entry);
        return;
    }
    await db.run(`
        INSERT INTO duty_roster (personId, personType, date, value, type) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(personId, personType, date) DO UPDATE SET value = excluded.value, type = excluded.type
    `, [entry.personId, entry.personType || 'person', entry.date, entry.value ?? '', entry.type ?? 'text']);
};

// Bulk Import für viele Einträge in einer Transaktion (ein Broadcast später im Main)
export const bulkSetDutyRosterEntries = async (db: AsyncDB, entries: { personId: number, personType: string, date: string, value: string, type: string }[]) => {
    if (!Array.isArray(entries) || entries.length === 0) return 0;
    await db.run('BEGIN');
    let ok = 0;
    try {
        const stmt = await db.prepare(`
            INSERT INTO duty_roster (personId, personType, date, value, type) VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(personId, personType, date) DO UPDATE SET value = excluded.value, type = excluded.type
        `);
        for (const e of entries) {
            if (!e || !e.personId || !e.date) continue;
            try {
                await stmt.run(e.personId, e.personType || 'person', e.date, e.value ?? '', e.type ?? 'text');
                ok++;
            } catch (ie) {
                console.warn('[DB] bulkSetDutyRosterEntries skip entry error', ie);
            }
        }
        await stmt.finalize();
        await db.run('COMMIT');
        console.log('[DB] bulkSetDutyRosterEntries committed', { total: entries.length, ok });
        return ok;
    } catch (e) {
        await db.run('ROLLBACK');
        console.error('[DB] bulkSetDutyRosterEntries rollback', e);
        throw e;
    }
};

export const getAzubiList = async (db: AsyncDB) => {
    return await db.all('SELECT * FROM azubis ORDER BY sort ASC, id ASC');
};

export const getAzubi = async (db: AsyncDB, id: number) => {
    return await db.get('SELECT * FROM azubis WHERE id = ?', [id]);
};

export const addAzubi = async (db: AsyncDB, azubi: { name: string, vorname: string, lehrjahr: number }) => {
    console.log('[DB] addAzubi', azubi);
    // determine next sort index
    try {
        const row: any = await db.get('SELECT MAX(sort) as m FROM azubis');
        const next = (row && typeof row.m === 'number') ? row.m + 1 : 0;
        await db.run('INSERT INTO azubis (name, vorname, lehrjahr, sort) VALUES (?, ?, ?, ?)', [azubi.name, azubi.vorname, azubi.lehrjahr, next]);
    } catch (e) {
        // fallback if something goes wrong
        await db.run('INSERT INTO azubis (name, vorname, lehrjahr) VALUES (?, ?, ?)', [azubi.name, azubi.vorname, azubi.lehrjahr]);
    }
    console.log('[DB] addAzubi erfolgreich');
};

export const updateAzubi = async (db: AsyncDB, azubi: { id: number, name: string, vorname: string, lehrjahr: number }) => {
    await db.run('UPDATE azubis SET name = ?, vorname = ?, lehrjahr = ? WHERE id = ?', [azubi.name, azubi.vorname, azubi.lehrjahr, azubi.id]);
};

export const deleteAzubi = async (db: AsyncDB, id: number) => {
    await db.run('DELETE FROM azubis WHERE id = ?', [id]);
};

export const updateAzubiOrder = async (db: AsyncDB, order: number[]) => {
    for (let i = 0; i < order.length; i++) {
        await db.run('UPDATE azubis SET sort = ? WHERE id = ?', [i, order[i]]);
    }
};

// --- ITW Doctors CRUD ---
export const getItwDoctors = async (db: AsyncDB) => {
    return await db.all('SELECT * FROM itw_doctors ORDER BY sort ASC, id ASC');
};

export const addItwDoctor = async (db: AsyncDB, doc: { name: string, vorname: string }) => {
    try {
        const row: any = await db.get('SELECT MAX(sort) as m FROM itw_doctors');
        const next = (row && typeof row.m === 'number') ? row.m + 1 : 0;
        await db.run('INSERT INTO itw_doctors (name, vorname, sort) VALUES (?, ?, ?)', [doc.name, doc.vorname, next]);
    } catch (e) {
        await db.run('INSERT INTO itw_doctors (name, vorname) VALUES (?, ?)', [doc.name, doc.vorname]);
    }
};

export const updateItwDoctor = async (db: AsyncDB, doc: { id: number, name: string, vorname: string }) => {
    await db.run('UPDATE itw_doctors SET name = ?, vorname = ? WHERE id = ?', [doc.name, doc.vorname, doc.id]);
};

export const deleteItwDoctor = async (db: AsyncDB, id: number) => {
    await db.run('DELETE FROM itw_doctors WHERE id = ?', [id]);
};

export const updateItwDoctorOrder = async (db: AsyncDB, order: number[]) => {
    for (let i = 0; i < order.length; i++) {
        await db.run('UPDATE itw_doctors SET sort = ? WHERE id = ?', [i, order[i]]);
    }
};

// --- RTW Vehicles CRUD ---
export const getRtwVehicles = async (db: AsyncDB, year?: number) => {
    if (typeof year === 'number') {
        return await db.all('SELECT * FROM rtw_vehicles WHERE archived_year IS NULL OR archived_year > ? ORDER BY sort ASC, id ASC', [year]);
    }
    return await db.all('SELECT * FROM rtw_vehicles WHERE archived_year IS NULL ORDER BY sort ASC, id ASC');
};
export const addRtwVehicle = async (db: AsyncDB, v: { name: string }) => {
    try {
        const row: any = await db.get('SELECT MAX(sort) as m FROM rtw_vehicles');
        const next = (row && typeof row.m === 'number') ? row.m + 1 : 0;
        await db.run('INSERT INTO rtw_vehicles (name, sort) VALUES (?, ?)', [v.name, next]);
    } catch (e) {
        await db.run('INSERT INTO rtw_vehicles (name) VALUES (?)', [v.name]);
    }
};
export const updateRtwVehicle = async (db: AsyncDB, v: { id: number, name: string }) => {
    await db.run('UPDATE rtw_vehicles SET name = ? WHERE id = ?', [v.name, v.id]);
};
export const deleteRtwVehicle = async (db: AsyncDB, id: number, currentYear?: number) => {
    // Soft Delete: mark archived_year = currentYear (oder aktuelles Jahr wenn nicht gegeben)
    const y = currentYear || new Date().getFullYear();
    await db.run('UPDATE rtw_vehicles SET archived_year = ? WHERE id = ?', [y, id]);
};
export const updateRtwVehicleOrder = async (db: AsyncDB, order: number[]) => {
    for (let i = 0; i < order.length; i++) {
        await db.run('UPDATE rtw_vehicles SET sort = ? WHERE id = ?', [i, order[i]]);
    }
};

// --- NEF Vehicles CRUD ---
export const getNefVehicles = async (db: AsyncDB, year?: number) => {
    if (typeof year === 'number') {
        return await db.all('SELECT id, name, sort, archived_year, COALESCE(occupancy_mode, \'24h\') as occupancy_mode FROM nef_vehicles WHERE archived_year IS NULL OR archived_year > ? ORDER BY sort ASC, id ASC', [year]);
    }
    return await db.all('SELECT id, name, sort, archived_year, COALESCE(occupancy_mode, \'24h\') as occupancy_mode FROM nef_vehicles WHERE archived_year IS NULL ORDER BY sort ASC, id ASC');
};
export const addNefVehicle = async (db: AsyncDB, v: { name: string, occupancyMode?: '24h' | 'tag' }) => {
    try {
        const row: any = await db.get('SELECT MAX(sort) as m FROM nef_vehicles');
        const next = (row && typeof row.m === 'number') ? row.m + 1 : 0;
        await db.run('INSERT INTO nef_vehicles (name, sort, occupancy_mode) VALUES (?, ?, ?)', [v.name, next, v.occupancyMode === 'tag' ? 'tag' : '24h']);
    } catch (e) {
        await db.run('INSERT INTO nef_vehicles (name, occupancy_mode) VALUES (?, ?)', [v.name, v.occupancyMode === 'tag' ? 'tag' : '24h']);
    }
};
export const updateNefVehicle = async (db: AsyncDB, v: { id: number, name: string, occupancyMode?: '24h' | 'tag' }) => {
    if (v.occupancyMode) {
        await db.run('UPDATE nef_vehicles SET name = ?, occupancy_mode = ? WHERE id = ?', [v.name, v.occupancyMode, v.id]);
    } else {
        await db.run('UPDATE nef_vehicles SET name = ? WHERE id = ?', [v.name, v.id]);
    }
};
export const setNefOccupancyMode = async (db: AsyncDB, id: number, mode: '24h' | 'tag') => {
    const m = mode === 'tag' ? 'tag' : '24h';
    await db.run('UPDATE nef_vehicles SET occupancy_mode = ? WHERE id = ?', [m, id]);
};
export const deleteNefVehicle = async (db: AsyncDB, id: number, currentYear?: number) => {
    const y = currentYear || new Date().getFullYear();
    await db.run('UPDATE nef_vehicles SET archived_year = ? WHERE id = ?', [y, id]);
};
export const updateNefVehicleOrder = async (db: AsyncDB, order: number[]) => {
    for (let i = 0; i < order.length; i++) {
        await db.run('UPDATE nef_vehicles SET sort = ? WHERE id = ?', [i, order[i]]);
    }
};

// --- Vehicle monthly activation helpers ---
export const getRtwVehicleActivations = async (db: AsyncDB, year: number) => {
    const rows = await db.all('SELECT vehicleId, month, enabled FROM rtw_vehicle_months WHERE year = ?', [year]);
    return rows;
};
export const setRtwVehicleActivation = async (db: AsyncDB, vehicleId: number, year: number, month: number, enabled: boolean) => {
    await db.run(`
        INSERT INTO rtw_vehicle_months (vehicleId, year, month, enabled) VALUES (?, ?, ?, ?)
        ON CONFLICT(vehicleId, year, month) DO UPDATE SET enabled = excluded.enabled
    `, [vehicleId, year, month, enabled ? 1 : 0]);
};
export const getNefVehicleActivations = async (db: AsyncDB, year: number) => {
    const rows = await db.all('SELECT vehicleId, month, enabled FROM nef_vehicle_months WHERE year = ?', [year]);
    return rows;
};
export const setNefVehicleActivation = async (db: AsyncDB, vehicleId: number, year: number, month: number, enabled: boolean) => {
    await db.run(`
        INSERT INTO nef_vehicle_months (vehicleId, year, month, enabled) VALUES (?, ?, ?, ?)
        ON CONFLICT(vehicleId, year, month) DO UPDATE SET enabled = excluded.enabled
    `, [vehicleId, year, month, enabled ? 1 : 0]);
};

// --- Utility: Clear previous slot assignments while keeping duty codes ---
export const clearSlotAssignments = async (db: AsyncDB) => {
    // 1) Entferne Slot-Zuweisungen (type) für alle bekannten Slot-Präfixe
    await db.run("UPDATE duty_roster SET type = '' WHERE type LIKE 'rtw%' OR type LIKE 'nef%' OR type LIKE 'itw%'");
    // 2) 'V' nur dann leeren, wenn 'V' NICHT als gültiger Shift-Type existiert
    try {
        const vType = await db.get("SELECT 1 AS ok FROM shift_types WHERE code = 'V' LIMIT 1");
        if (!vType) {
            await db.run("UPDATE duty_roster SET value = '' WHERE value = 'V'");
        }
    } catch (e) {
        // Falls Abfrage fehlschlägt, vorsichtig sein: lieber 'V' nicht löschen
        console.warn('[DB] clearSlotAssignments: Konnte shift_types nicht prüfen, lasse value=\'V\' unangetastet');
    }
};

// --- Assign only the slot (type) without overwriting the duty code (value) ---
export const assignSlot = async (db: AsyncDB, entry: { personId: number, personType: string, date: string, slotType: string }) => {
    // Prüfe, ob Zeile existiert
    const row = await db.get('SELECT id FROM duty_roster WHERE personId = ? AND personType = ? AND date = ?', [entry.personId, entry.personType, entry.date]);
    if (row) {
        await db.run('UPDATE duty_roster SET type = ? WHERE personId = ? AND personType = ? AND date = ?', [entry.slotType, entry.personId, entry.personType, entry.date]);
    } else {
        await db.run('INSERT INTO duty_roster (personId, personType, date, value, type) VALUES (?, ?, ?, ?, ?)', [entry.personId, entry.personType, entry.date, '', entry.slotType]);
    }
    console.log('[DB] assignSlot ok', entry);
};

// --- Clear duty_roster by period ---
export const clearDutyRosterForYear = async (db: AsyncDB, year: number) => {
    const start = `${year}-01-01`;
    const end = `${year}-12-31`;
    await db.run('DELETE FROM duty_roster WHERE date >= ? AND date <= ?', [start, end]);
};

export const clearDutyRosterForMonth = async (db: AsyncDB, year: number, month: number) => {
    // month is 0-based from renderer; convert to 1-based for ISO
    const m = month + 1;
    const mm = String(m).padStart(2, '0');
    // last day of month
    const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const start = `${year}-${mm}-01`;
    const end = `${year}-${mm}-${String(last).padStart(2, '0')}`;
    await db.run('DELETE FROM duty_roster WHERE date >= ? AND date <= ?', [start, end]);
};