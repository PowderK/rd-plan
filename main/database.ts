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
            sort INTEGER NOT NULL DEFAULT 0,
            active INTEGER NOT NULL DEFAULT 1
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
        // Migration: add 'active' column if missing (default 1)
        if (!colsAfter.some((c: any) => c.name === 'active')) {
            console.log('[DB] Adding missing column "active" to personnel table');
            await db.exec("ALTER TABLE personnel ADD COLUMN active INTEGER DEFAULT 1");
            await db.exec("UPDATE personnel SET active = 1 WHERE active IS NULL");
        }
        
        // Migration: add contact fields if missing
        const contactFields = ['street', 'postalCode', 'city', 'phone', 'mobile', 'email'];
        for (const field of contactFields) {
            if (!colsAfter.some((c: any) => c.name === field)) {
                console.log(`[DB] Adding missing column "${field}" to personnel table`);
                await db.exec(`ALTER TABLE personnel ADD COLUMN ${field} TEXT DEFAULT ''`);
                await db.exec(`UPDATE personnel SET ${field} = '' WHERE ${field} IS NULL`);
            }
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

    // Initialize qualification types table
    await initializeQualificationTypesTable(db);

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

    // --- Azubi Periods Tabelle ---
    await db.exec(`
        CREATE TABLE IF NOT EXISTS azubi_periods (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            azubi_id INTEGER NOT NULL,
            start_date TEXT NOT NULL,
            end_date TEXT NOT NULL,
            description TEXT,
            FOREIGN KEY (azubi_id) REFERENCES azubis (id) ON DELETE CASCADE
        )
    `);

    // --- Qualification Periods Tabelle ---
    await db.exec(`
        CREATE TABLE IF NOT EXISTS qualification_periods (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            personId INTEGER NOT NULL,
            qualType TEXT NOT NULL,
            startYM TEXT NOT NULL,
            endYM TEXT,
            active INTEGER DEFAULT 1,
            FOREIGN KEY (personId) REFERENCES personnel (id) ON DELETE CASCADE
        )
    `);

    // Indexe für bessere Performance bei Qualifikationsabfragen
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_qualification_periods_person ON qualification_periods (personId)`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_qualification_periods_type ON qualification_periods (qualType)`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_qualification_periods_period ON qualification_periods (startYM, endYM)`);

    // --- Personnel Active Periods Tabelle ---
    await db.exec(`
        CREATE TABLE IF NOT EXISTS personnel_active_periods (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            personId INTEGER NOT NULL,
            startYM TEXT NOT NULL,
            endYM TEXT,
            description TEXT,
            active INTEGER DEFAULT 1,
            FOREIGN KEY (personId) REFERENCES personnel (id) ON DELETE CASCADE
        )
    `);

    // Indexe für bessere Performance
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_personnel_active_periods_person ON personnel_active_periods (personId)`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_personnel_active_periods_period ON personnel_active_periods (startYM, endYM)`);

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

    // --- Migration: manual_edit Spalte für duty_roster hinzufügen ---
    const dutyRosterCols = await db.all("PRAGMA table_info('duty_roster')");
    if (!dutyRosterCols.some((c: any) => c.name === 'manual_edit')) {
        console.log('[DB] Adding missing column "manual_edit" to duty_roster table');
        await db.exec("ALTER TABLE duty_roster ADD COLUMN manual_edit INTEGER DEFAULT 0");
        await db.exec("UPDATE duty_roster SET manual_edit = 0 WHERE manual_edit IS NULL");
    }

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

    // --- RTW / NEF / ITW Fahrzeuge Tabellen ---
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
    await db.exec(`
        CREATE TABLE IF NOT EXISTS itw_vehicles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            sort INTEGER NOT NULL DEFAULT 0,
            archived_year INTEGER
        )
    `);

    // --- Fahrzeug-Positionen Tabellen (Verknüpfung Fahrzeug -> Position -> Qualifikation) ---
    await db.exec(`
        CREATE TABLE IF NOT EXISTS vehicle_positions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vehicleType TEXT NOT NULL,
            vehicleId INTEGER NOT NULL,
            positionName TEXT NOT NULL,
            qualificationTypeId INTEGER,
            sort INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (qualificationTypeId) REFERENCES qualification_types(id) ON DELETE SET NULL,
            UNIQUE(vehicleType, vehicleId, positionName)
        )
    `);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_vehicle_positions_vehicle ON vehicle_positions (vehicleType, vehicleId)`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_vehicle_positions_qual ON vehicle_positions (qualificationTypeId)`);

    // Migration: Check for missing columns in vehicle tables
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

    const itwVehCols = await db.all("PRAGMA table_info('itw_vehicles')");
    if (!itwVehCols.some((c: any) => c.name === 'archived_year')) {
        console.log('[DB] Adding archived_year to itw_vehicles');
        await db.exec("ALTER TABLE itw_vehicles ADD COLUMN archived_year INTEGER");
    }

    // Migration: add 'lehrjahr' column to azubi_periods if missing
    const azubiPeriodsCols = await db.all("PRAGMA table_info('azubi_periods')");
    if (!azubiPeriodsCols.some((c: any) => c.name === 'lehrjahr')) {
        console.log('[DB] Adding lehrjahr to azubi_periods');
        await db.exec("ALTER TABLE azubi_periods ADD COLUMN lehrjahr INTEGER DEFAULT 1");
    }
    
    // Migration: add 'excludeFromStats' column to qualification_types if missing
    const qualTypeCols = await db.all("PRAGMA table_info('qualification_types')");
    if (!qualTypeCols.some((c: any) => c.name === 'excludeFromStats')) {
        console.log('[DB] Adding excludeFromStats to qualification_types');
        await db.exec("ALTER TABLE qualification_types ADD COLUMN excludeFromStats INTEGER DEFAULT 0");
    }
    
    // Aktivierungen pro Monat/Jahr (default: aktiv) - DEPRECATED, wird durch vehicle_periods ersetzt
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

    // --- Migration: Fahrzeug-Zeiträume Tabellen (analog zu qualification_periods) ---
    // Prüfe ob rtw_vehicle_periods existiert
    const rtwPeriodsExists = await db.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='rtw_vehicle_periods'"
    );
    if (!rtwPeriodsExists) {
        console.log('[DB] Creating rtw_vehicle_periods table');
        await db.exec(`
            CREATE TABLE rtw_vehicle_periods (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                vehicleId INTEGER NOT NULL,
                startYM TEXT NOT NULL,
                endYM TEXT,
                active INTEGER DEFAULT 1,
                FOREIGN KEY (vehicleId) REFERENCES rtw_vehicles (id) ON DELETE CASCADE
            )
        `);
        await db.exec(`CREATE INDEX idx_rtw_vehicle_periods_vehicle ON rtw_vehicle_periods (vehicleId)`);
    }
    
    // Prüfe ob nef_vehicle_periods existiert
    const nefPeriodsExists = await db.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='nef_vehicle_periods'"
    );
    if (!nefPeriodsExists) {
        console.log('[DB] Creating nef_vehicle_periods table');
        await db.exec(`
            CREATE TABLE nef_vehicle_periods (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                vehicleId INTEGER NOT NULL,
                startYM TEXT NOT NULL,
                endYM TEXT,
                active INTEGER DEFAULT 1,
                FOREIGN KEY (vehicleId) REFERENCES nef_vehicles (id) ON DELETE CASCADE
            )
        `);
        await db.exec(`CREATE INDEX idx_nef_vehicle_periods_vehicle ON nef_vehicle_periods (vehicleId)`);
    }

    // Prüfe ob itw_vehicle_periods existiert
    const itwPeriodsExists = await db.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='itw_vehicle_periods'"
    );
    if (!itwPeriodsExists) {
        console.log('[DB] Creating itw_vehicle_periods table');
        await db.exec(`
            CREATE TABLE itw_vehicle_periods (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                vehicleId INTEGER NOT NULL,
                startYM TEXT NOT NULL,
                endYM TEXT,
                active INTEGER DEFAULT 1,
                FOREIGN KEY (vehicleId) REFERENCES itw_vehicles (id) ON DELETE CASCADE
            )
        `);
        await db.exec(`CREATE INDEX idx_itw_vehicle_periods_vehicle ON itw_vehicle_periods (vehicleId)`);
    }

    // --- Jahresspezifische Vorplanungsdateien ---
    const yearPlanningsExists = await db.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='year_plannings'"
    );
    if (!yearPlanningsExists) {
        console.log('[DB] Creating year_plannings table');
        await db.exec(`
            CREATE TABLE year_plannings (
                year INTEGER PRIMARY KEY,
                filePath TEXT NOT NULL
            )
        `);
    }

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

export const getPersonnel = async (db: AsyncDB, includeInactive: boolean = false, date?: string) => {
    if (includeInactive) {
        return await db.all('SELECT * FROM personnel ORDER BY sort ASC, id ASC');
    }
    
    // If no date is provided, use legacy behavior (active flag only)
    if (!date) {
        return await db.all('SELECT * FROM personnel WHERE COALESCE(active,1)=1 ORDER BY sort ASC, id ASC');
    }

    // If date is provided, we need to check periods.
    // We fetch ALL personnel first, because someone might be active=0 but have a valid period.
    const allPersonnel = await db.all('SELECT * FROM personnel ORDER BY sort ASC, id ASC');

    let startLimit: string;
    let endLimit: string;

    if (date.length === 4) {
        // Year mode: Active at any point in the year
        // Period starts before or in Dec of that year AND ends after or in Jan of that year
        startLimit = `${date}-12`;
        endLimit = `${date}-01`;
    } else {
        // Month/Date mode
        const ym = date.substring(0, 7);
        startLimit = ym;
        endLimit = ym;
    }

    const result = [];
    
    for (const p of allPersonnel) {
        // Check if this person has ANY periods
        const hasPeriods = await db.get('SELECT 1 FROM personnel_active_periods WHERE personId = ? LIMIT 1', [p.id]);
        
        if (!hasPeriods) {
            // No periods -> fallback to active flag
            // Treat null as 1 (active by default)
            if (p.active !== 0 && p.active !== false) {
                result.push(p);
            }
        } else {
            // Has periods -> check if active in the target range
            // Ignore the global 'active' flag here!
            const isActiveInPeriod = await db.get(
                `SELECT 1 FROM personnel_active_periods 
                 WHERE personId = ? AND active = 1 
                 AND startYM <= ? AND (endYM IS NULL OR endYM >= ?) LIMIT 1`,
                [p.id, startLimit, endLimit]
            );
            if (isActiveInPeriod) {
                result.push(p);
            }
        }
    }
    return result;
};

export const addPersonnel = async (db: AsyncDB, person: any) => {
    const { name, vorname, teilzeit, fahrzeugfuehrer, fahrzeugfuehrerHLFB, nef, itwMaschinist, itwFahrzeugfuehrer, sort, active } = person;
    return await db.run('INSERT INTO personnel (name, vorname, teilzeit, fahrzeugfuehrer, fahrzeugfuehrerHLFB, nef, itwMaschinist, itwFahrzeugfuehrer, sort, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [name, vorname, teilzeit, fahrzeugfuehrer ? 1 : 0, fahrzeugfuehrerHLFB ? 1 : 0, nef ? 1 : 0, itwMaschinist ? 1 : 0, itwFahrzeugfuehrer ? 1 : 0, sort ?? 0, (active === 0 || active === false) ? 0 : 1]);
};

export const updatePersonnel = async (db: AsyncDB, person: any) => {
    const { id, name, vorname, teilzeit, fahrzeugfuehrer, fahrzeugfuehrerHLFB, nef, itwMaschinist, itwFahrzeugfuehrer, sort } = person;
    await db.run('UPDATE personnel SET name = ?, vorname = ?, teilzeit = ?, fahrzeugfuehrer = ?, fahrzeugfuehrerHLFB = ?, nef = ?, itwMaschinist = ?, itwFahrzeugfuehrer = ?, sort = ? WHERE id = ?', [name, vorname, teilzeit, fahrzeugfuehrer ? 1 : 0, fahrzeugfuehrerHLFB ? 1 : 0, nef ? 1 : 0, itwMaschinist ? 1 : 0, itwFahrzeugfuehrer ? 1 : 0, sort ?? 0, id]);
};

export const deletePersonnel = async (db: AsyncDB, id: number) => {
    await db.run('DELETE FROM personnel WHERE id = ?', [id]);
};

export const setPersonnelActive = async (db: AsyncDB, id: number, active: boolean) => {
    await db.run('UPDATE personnel SET active = ? WHERE id = ?', [active ? 1 : 0, id]);
};

export const getPersonById = async (db: AsyncDB, id: number) => {
    return await db.get('SELECT * FROM personnel WHERE id = ?', [id]);
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
        INSERT INTO duty_roster (personId, personType, date, value, type, manual_edit) VALUES (?, ?, ?, ?, ?, 1)
        ON CONFLICT(personId, personType, date) DO UPDATE SET value = excluded.value, type = excluded.type, manual_edit = 1
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

// Bulk Import für Importe, die manuelle Bearbeitungen respektieren
export const bulkImportDutyRosterEntries = async (db: AsyncDB, entries: { personId: number, personType: string, date: string, value: string, type: string }[], respectManualEdits: boolean = true, deleteEmpty: boolean = true) => {
    if (!Array.isArray(entries) || entries.length === 0) return { imported: 0, skipped: 0 };
    await db.run('BEGIN');
    let imported = 0;
    let skipped = 0;
    try {
        for (const e of entries) {
            if (!e || !e.personId || !e.date) continue;
            
            let isManual = false;
            if (respectManualEdits) {
                // Prüfe ob Eintrag bereits existiert und manuell bearbeitet wurde
                const existing = await db.get(`
                    SELECT manual_edit FROM duty_roster 
                    WHERE personId = ? AND personType = ? AND date = ?
                `, [e.personId, e.personType || 'person', e.date]);
                
                if (existing && existing.manual_edit === 1) {
                    isManual = true;
                }
            }
            
            if (isManual) {
                skipped++;
                continue; // Überspringe manuell bearbeitete Einträge
            }

            // Wenn der Wert leer ist:
            // - Bei deleteEmpty=true (Monatsimport): Lösche den Eintrag (Sync)
            // - Bei deleteEmpty=false (Jahresimport): Tue nichts (behalte bestehenden Eintrag)
            if (!e.value) {
                if (deleteEmpty) {
                    await db.run(`
                        DELETE FROM duty_roster 
                        WHERE personId = ? AND personType = ? AND date = ?
                    `, [e.personId, e.personType || 'person', e.date]);
                    imported++;
                }
                // Wenn deleteEmpty=false, ignorieren wir leere Excel-Zellen -> DB-Eintrag bleibt erhalten
                continue;
            }
            
            try {
                await db.run(`
                    INSERT INTO duty_roster (personId, personType, date, value, type, manual_edit) VALUES (?, ?, ?, ?, ?, 0)
                    ON CONFLICT(personId, personType, date) DO UPDATE SET 
                        value = excluded.value,
                        type = CASE 
                            WHEN duty_roster.type LIKE 'rtw%' OR duty_roster.type LIKE 'nef%' OR duty_roster.type LIKE 'itw%' THEN duty_roster.type
                            ELSE excluded.type 
                        END,
                        manual_edit = 0
                `, [e.personId, e.personType || 'person', e.date, e.value, e.type ?? 'text']);
                imported++;
            } catch (ie) {
                console.warn('[DB] bulkImportDutyRosterEntries skip entry error', ie);
            }
        }
        await db.run('COMMIT');
        console.log('[DB] bulkImportDutyRosterEntries committed', { total: entries.length, imported, skipped, deleteEmpty });
        return { imported, skipped };
    } catch (e) {
        await db.run('ROLLBACK');
        console.error('[DB] bulkImportDutyRosterEntries rollback', e);
        throw e;
    }
};

export const getAzubiList = async (db: AsyncDB) => {
    const azubis = await db.all('SELECT * FROM azubis ORDER BY sort ASC, id ASC');
    const currentDate = new Date();
    
    // Für jeden Azubi das aktuelle Lehrjahr aus den Zeiträumen berechnen
    for (const azubi of azubis) {
        const periods = await db.all('SELECT * FROM azubi_periods WHERE azubi_id = ? ORDER BY start_date ASC', [azubi.id]);
        
        // Finde den aktuellen Zeitraum
        const currentPeriod = periods.find((period: any) => {
            const startDate = new Date(period.start_date);
            const endDate = new Date(period.end_date);
            return currentDate >= startDate && currentDate <= endDate;
        });
        
        if (currentPeriod && currentPeriod.lehrjahr) {
            azubi.lehrjahr = currentPeriod.lehrjahr;
        } else {
            // Fallback: nimm das neueste/höchste Lehrjahr aus den Zeiträumen
            const latestPeriod = periods.sort((a: any, b: any) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime())[0];
            if (latestPeriod && latestPeriod.lehrjahr) {
                azubi.lehrjahr = latestPeriod.lehrjahr;
            }
            // Ansonsten bleibt das Lehrjahr aus der azubis-Tabelle bestehen
        }
    }
    
    return azubis;
};

export const getAzubi = async (db: AsyncDB, id: number) => {
    const azubi = await db.get('SELECT * FROM azubis WHERE id = ?', [id]);
    if (!azubi) return null;
    
    const currentDate = new Date();
    const periods = await db.all('SELECT * FROM azubi_periods WHERE azubi_id = ? ORDER BY start_date ASC', [id]);
    
    // Finde den aktuellen Zeitraum
    const currentPeriod = periods.find((period: any) => {
        const startDate = new Date(period.start_date);
        const endDate = new Date(period.end_date);
        return currentDate >= startDate && currentDate <= endDate;
    });
    
    if (currentPeriod && currentPeriod.lehrjahr) {
        azubi.lehrjahr = currentPeriod.lehrjahr;
    } else {
        // Fallback: nimm das neueste/höchste Lehrjahr aus den Zeiträumen
        const latestPeriod = periods.sort((a: any, b: any) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime())[0];
        if (latestPeriod && latestPeriod.lehrjahr) {
            azubi.lehrjahr = latestPeriod.lehrjahr;
        }
    }
    
    return azubi;
};

export const addAzubi = async (db: AsyncDB, azubi: { name: string, vorname: string, lehrjahr: number, periods?: any[] }) => {
    console.log('[DB] addAzubi', azubi);
    let azubiId: number;
    // determine next sort index
    try {
        const row: any = await db.get('SELECT MAX(sort) as m FROM azubis');
        const next = (row && typeof row.m === 'number') ? row.m + 1 : 0;
        const result = await db.run('INSERT INTO azubis (name, vorname, lehrjahr, sort) VALUES (?, ?, ?, ?)', [azubi.name, azubi.vorname, azubi.lehrjahr, next]);
        azubiId = result.lastInsertRowid as number;
    } catch (e) {
        // fallback if something goes wrong
        const result = await db.run('INSERT INTO azubis (name, vorname, lehrjahr) VALUES (?, ?, ?)', [azubi.name, azubi.vorname, azubi.lehrjahr]);
        azubiId = result.lastInsertRowid as number;
    }

    if (azubi.periods && Array.isArray(azubi.periods)) {
        for (const p of azubi.periods) {
            await db.run('INSERT INTO azubi_periods (azubi_id, start_date, end_date, description, lehrjahr) VALUES (?, ?, ?, ?, ?)', 
                [azubiId, p.start_date, p.end_date, p.description || '', p.lehrjahr || 1]);
        }
    }
    console.log('[DB] addAzubi erfolgreich, ID:', azubiId);
    return azubiId;
};

export const updateAzubi = async (db: AsyncDB, azubi: { id: number, name: string, vorname: string, lehrjahr: number }) => {
    await db.run('UPDATE azubis SET name = ?, vorname = ?, lehrjahr = ? WHERE id = ?', [azubi.name, azubi.vorname, azubi.lehrjahr, azubi.id]);
};

export const deleteAzubi = async (db: AsyncDB, id: number) => {
    await db.run('DELETE FROM azubis WHERE id = ?', [id]);
};

// --- Azubi Periods Functions ---
export const getAzubiPeriods = async (db: AsyncDB, azubiId: number) => {
    return await db.all('SELECT * FROM azubi_periods WHERE azubi_id = ? ORDER BY start_date ASC', [azubiId]);
};

export const getAllAzubiPeriods = async (db: AsyncDB) => {
    return await db.all('SELECT * FROM azubi_periods ORDER BY azubi_id, start_date ASC');
};

export const addAzubiPeriod = async (db: AsyncDB, period: { azubi_id: number, start_date: string, end_date: string, description?: string, lehrjahr?: number }) => {
    console.log('[DB] addAzubiPeriod', period);
    await db.run('INSERT INTO azubi_periods (azubi_id, start_date, end_date, description, lehrjahr) VALUES (?, ?, ?, ?, ?)', 
        [period.azubi_id, period.start_date, period.end_date, period.description || '', period.lehrjahr || 1]);
    console.log('[DB] addAzubiPeriod erfolgreich');
};

export const updateAzubiPeriod = async (db: AsyncDB, period: { id: number, azubi_id: number, start_date: string, end_date: string, description?: string, lehrjahr?: number }) => {
    await db.run('UPDATE azubi_periods SET azubi_id = ?, start_date = ?, end_date = ?, description = ?, lehrjahr = ? WHERE id = ?', 
        [period.azubi_id, period.start_date, period.end_date, period.description || '', period.lehrjahr || 1, period.id]);
};

export const deleteAzubiPeriod = async (db: AsyncDB, id: number) => {
    await db.run('DELETE FROM azubi_periods WHERE id = ?', [id]);
};

export const updateAzubiOrder = async (db: AsyncDB, order: number[]) => {
    for (let i = 0; i < order.length; i++) {
        await db.run('UPDATE azubis SET sort = ? WHERE id = ?', [i, order[i]]);
    }
};

// --- Qualification Periods Functions ---
export const getQualificationPeriods = async (db: AsyncDB, personId: number) => {
    return await db.all('SELECT * FROM qualification_periods WHERE personId = ? ORDER BY qualType, startYM ASC', [personId]);
};

export const getAllQualificationPeriods = async (db: AsyncDB) => {
    return await db.all('SELECT * FROM qualification_periods ORDER BY personId, qualType, startYM ASC');
};

export const addQualificationPeriod = async (db: AsyncDB, period: { 
    personId: number, 
    qualType: string, 
    startYM: string, 
    endYM?: string, 
    active?: boolean 
}) => {
    console.log('[DB] addQualificationPeriod', period);
    await db.run('INSERT INTO qualification_periods (personId, qualType, startYM, endYM, active) VALUES (?, ?, ?, ?, ?)', 
        [period.personId, period.qualType, period.startYM, period.endYM || null, period.active ? 1 : 0]);
    console.log('[DB] addQualificationPeriod erfolgreich');
};

export const updateQualificationPeriod = async (db: AsyncDB, period: { 
    id: number, 
    personId: number, 
    qualType: string, 
    startYM: string, 
    endYM?: string, 
    active?: boolean 
}) => {
    await db.run('UPDATE qualification_periods SET personId = ?, qualType = ?, startYM = ?, endYM = ?, active = ? WHERE id = ?', 
        [period.personId, period.qualType, period.startYM, period.endYM || null, period.active ? 1 : 0, period.id]);
};

export const deleteQualificationPeriod = async (db: AsyncDB, id: number) => {
    await db.run('DELETE FROM qualification_periods WHERE id = ?', [id]);
};

// --- Personnel Active Periods Functions ---
export const getPersonnelActivePeriods = async (db: AsyncDB, personId: number) => {
    return await db.all('SELECT * FROM personnel_active_periods WHERE personId = ? ORDER BY startYM ASC', [personId]);
};

export const getAllPersonnelActivePeriods = async (db: AsyncDB) => {
    return await db.all('SELECT * FROM personnel_active_periods ORDER BY personId, startYM ASC');
};

export const addPersonnelActivePeriod = async (db: AsyncDB, period: { 
    personId: number, 
    startYM: string, 
    endYM?: string, 
    description?: string,
    active?: boolean 
}) => {
    console.log('[DB] addPersonnelActivePeriod', period);
    await db.run('INSERT INTO personnel_active_periods (personId, startYM, endYM, description, active) VALUES (?, ?, ?, ?, ?)', 
        [period.personId, period.startYM, period.endYM || null, period.description || '', period.active ? 1 : 0]);
    console.log('[DB] addPersonnelActivePeriod erfolgreich');
};

export const updatePersonnelActivePeriod = async (db: AsyncDB, period: { 
    id: number, 
    personId: number, 
    startYM: string, 
    endYM?: string, 
    description?: string,
    active?: boolean 
}) => {
    await db.run('UPDATE personnel_active_periods SET personId = ?, startYM = ?, endYM = ?, description = ?, active = ? WHERE id = ?', 
        [period.personId, period.startYM, period.endYM || null, period.description || '', period.active ? 1 : 0, period.id]);
};

export const deletePersonnelActivePeriod = async (db: AsyncDB, id: number) => {
    await db.run('DELETE FROM personnel_active_periods WHERE id = ?', [id]);
};

// Helper function to check if a person is active in a given month based on periods
export const isPersonnelActiveInMonth = async (db: AsyncDB, personId: number, yearMonth: string): Promise<boolean> => {
    // First check if there are any periods defined for this person
    const periods = await db.all('SELECT * FROM personnel_active_periods WHERE personId = ?', [personId]);
    
    // If no periods are defined, fallback to the main 'active' flag in personnel table (legacy behavior)
    if (periods.length === 0) {
        const person = await db.get('SELECT active FROM personnel WHERE id = ?', [personId]);
        return person && (person.active === 1 || person.active === true);
    }

    // If periods exist, check if any active period covers the month
    const result = await db.get(
        `SELECT COUNT(*) as count FROM personnel_active_periods 
         WHERE personId = ? AND active = 1 
         AND startYM <= ? AND (endYM IS NULL OR endYM >= ?)`,
        [personId, yearMonth, yearMonth]
    );
    return result && result.count > 0;
};

// Helper function to check if a person has a specific qualification in a given month
export const hasQualificationInMonth = async (db: AsyncDB, personId: number, qualType: string, yearMonth: string): Promise<boolean> => {
    const result = await db.get(
        `SELECT COUNT(*) as count FROM qualification_periods 
         WHERE personId = ? AND qualType = ? AND active = 1 
         AND startYM <= ? AND (endYM IS NULL OR endYM >= ?)`,
        [personId, qualType, yearMonth, yearMonth]
    );
    return result && result.count > 0;
};

// Get all active qualifications for a person in a specific month
export const getActiveQualifications = async (db: AsyncDB, personId: number, yearMonth: string) => {
    return await db.all(
        `SELECT * FROM qualification_periods 
         WHERE personId = ? AND active = 1 
         AND startYM <= ? AND (endYM IS NULL OR endYM >= ?)
         ORDER BY qualType`,
        [personId, yearMonth, yearMonth]
    );
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
    let vehicleId: number;
    try {
        const row: any = await db.get('SELECT MAX(sort) as m FROM rtw_vehicles');
        const next = (row && typeof row.m === 'number') ? row.m + 1 : 0;
        const result = await db.run('INSERT INTO rtw_vehicles (name, sort) VALUES (?, ?)', [v.name, next]);
        vehicleId = result.lastID;
    } catch (e) {
        const result = await db.run('INSERT INTO rtw_vehicles (name) VALUES (?)', [v.name]);
        vehicleId = result.lastID;
    }
    // Initialisiere Standard-Positionen
    await initializeDefaultVehiclePositions(db, 'rtw', vehicleId);
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

// --- ITW Vehicles CRUD ---
export const getItwVehicles = async (db: AsyncDB, year?: number) => {
    if (typeof year === 'number') {
        return await db.all('SELECT * FROM itw_vehicles WHERE archived_year IS NULL OR archived_year > ? ORDER BY sort ASC, id ASC', [year]);
    }
    return await db.all('SELECT * FROM itw_vehicles WHERE archived_year IS NULL ORDER BY sort ASC, id ASC');
};
export const addItwVehicle = async (db: AsyncDB, v: { name: string }) => {
    let vehicleId: number;
    try {
        const row: any = await db.get('SELECT MAX(sort) as m FROM itw_vehicles');
        const next = (row && typeof row.m === 'number') ? row.m + 1 : 0;
        const result = await db.run('INSERT INTO itw_vehicles (name, sort) VALUES (?, ?)', [v.name, next]);
        vehicleId = result.lastID;
    } catch (e) {
        const result = await db.run('INSERT INTO itw_vehicles (name) VALUES (?)', [v.name]);
        vehicleId = result.lastID;
    }
    // Initialisiere Standard-Positionen
    await initializeDefaultVehiclePositions(db, 'itw', vehicleId);
};
export const updateItwVehicle = async (db: AsyncDB, v: { id: number, name: string }) => {
    await db.run('UPDATE itw_vehicles SET name = ? WHERE id = ?', [v.name, v.id]);
};
export const deleteItwVehicle = async (db: AsyncDB, id: number, currentYear?: number) => {
    const y = currentYear || new Date().getFullYear();
    await db.run('UPDATE itw_vehicles SET archived_year = ? WHERE id = ?', [y, id]);
};
export const updateItwVehicleOrder = async (db: AsyncDB, order: number[]) => {
    for (let i = 0; i < order.length; i++) {
        await db.run('UPDATE itw_vehicles SET sort = ? WHERE id = ?', [i, order[i]]);
    }
};

export const addNefVehicle = async (db: AsyncDB, v: { name: string, occupancyMode?: '24h' | 'tag' }) => {
    let vehicleId: number;
    try {
        const row: any = await db.get('SELECT MAX(sort) as m FROM nef_vehicles');
        const next = (row && typeof row.m === 'number') ? row.m + 1 : 0;
        const result = await db.run('INSERT INTO nef_vehicles (name, sort, occupancy_mode) VALUES (?, ?, ?)', 
            [v.name, next, v.occupancyMode === 'tag' ? 'tag' : '24h']);
        vehicleId = result.lastID;
    } catch (e) {
        const result = await db.run('INSERT INTO nef_vehicles (name, occupancy_mode) VALUES (?, ?)', 
            [v.name, v.occupancyMode === 'tag' ? 'tag' : '24h']);
        vehicleId = result.lastID;
    }
    // Initialisiere Standard-Positionen
    await initializeDefaultVehiclePositions(db, 'nef', vehicleId);
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

// --- Vehicle monthly activation helpers (DEPRECATED - use vehicle periods instead) ---
export const getRtwVehicleActivations = async (db: AsyncDB, year: number) => {
    // Compatibility: Generate activation list from periods
    // We need to fetch vehicles to know which ones exist, but we can also just fetch all periods
    // and group by vehicle. However, to handle "no periods = active", we need the list of vehicles.
    const vehicles = await getRtwVehicles(db, year);
    const results: { vehicleId: number, month: number, enabled: number }[] = [];
    
    for (const v of vehicles) {
        const periods = await db.all('SELECT * FROM rtw_vehicle_periods WHERE vehicleId = ?', [v.id]);
        if (periods.length === 0) continue; // No periods = always active (default)

        for (let m = 1; m <= 12; m++) {
            const ym = `${year}-${String(m).padStart(2, '0')}`;
            const isActive = periods.some((p: any) => 
                (p.active === 1 || p.active === true) && 
                p.startYM <= ym && 
                (p.endYM === null || p.endYM === '' || p.endYM >= ym)
            );
            results.push({ vehicleId: v.id, month: m, enabled: isActive ? 1 : 0 });
        }
    }
    return results;
};

export const setRtwVehicleActivation = async (db: AsyncDB, vehicleId: number, year: number, month: number, enabled: boolean) => {
    // Deprecated: No-op or log warning. The new system uses periods.
    console.warn('[DB] setRtwVehicleActivation is deprecated. Use addRtwVehiclePeriod instead.');
};

export const getNefVehicleActivations = async (db: AsyncDB, year: number) => {
    // Compatibility: Generate activation list from periods
    const vehicles = await getNefVehicles(db, year);
    const results: { vehicleId: number, month: number, enabled: number }[] = [];
    
    for (const v of vehicles) {
        const periods = await db.all('SELECT * FROM nef_vehicle_periods WHERE vehicleId = ?', [v.id]);
        if (periods.length === 0) continue; // No periods = always active (default)

        for (let m = 1; m <= 12; m++) {
            const ym = `${year}-${String(m).padStart(2, '0')}`;
            const isActive = periods.some((p: any) => 
                (p.active === 1 || p.active === true) && 
                p.startYM <= ym && 
                (p.endYM === null || p.endYM === '' || p.endYM >= ym)
            );
            results.push({ vehicleId: v.id, month: m, enabled: isActive ? 1 : 0 });
        }
    }
    return results;
};

export const setNefVehicleActivation = async (db: AsyncDB, vehicleId: number, year: number, month: number, enabled: boolean) => {
    // Deprecated: No-op or log warning. The new system uses periods.
    console.warn('[DB] setNefVehicleActivation is deprecated. Use addNefVehiclePeriod instead.');
};

// --- RTW Vehicle Periods Functions ---
export const getRtwVehiclePeriods = async (db: AsyncDB, vehicleId: number) => {
    return await db.all('SELECT * FROM rtw_vehicle_periods WHERE vehicleId = ? ORDER BY startYM ASC', [vehicleId]);
};

export const getAllRtwVehiclePeriods = async (db: AsyncDB) => {
    return await db.all('SELECT * FROM rtw_vehicle_periods ORDER BY vehicleId, startYM ASC');
};

export const addRtwVehiclePeriod = async (db: AsyncDB, period: { 
    vehicleId: number, 
    startYM: string, 
    endYM?: string, 
    active?: boolean 
}) => {
    console.log('[DB] addRtwVehiclePeriod', period);
    const endYM = period.endYM && period.endYM.trim() !== '' ? period.endYM : null;
    const active = period.active === false ? 0 : 1;
    await db.run('INSERT INTO rtw_vehicle_periods (vehicleId, startYM, endYM, active) VALUES (?, ?, ?, ?)', 
        [period.vehicleId, period.startYM, endYM, active]);
    console.log('[DB] addRtwVehiclePeriod erfolgreich');
};

// --- ITW Vehicle Periods Functions ---
export const getItwVehiclePeriods = async (db: AsyncDB, vehicleId: number) => {
    return await db.all('SELECT * FROM itw_vehicle_periods WHERE vehicleId = ? ORDER BY startYM ASC', [vehicleId]);
};

export const getAllItwVehiclePeriods = async (db: AsyncDB) => {
    return await db.all('SELECT * FROM itw_vehicle_periods ORDER BY vehicleId, startYM ASC');
};

export const addItwVehiclePeriod = async (db: AsyncDB, period: { 
    vehicleId: number, 
    startYM: string, 
    endYM?: string, 
    active?: boolean 
}) => {
    console.log('[DB] addItwVehiclePeriod', period);
    const endYM = period.endYM && period.endYM.trim() !== '' ? period.endYM : null;
    const active = period.active === false ? 0 : 1;
    await db.run('INSERT INTO itw_vehicle_periods (vehicleId, startYM, endYM, active) VALUES (?, ?, ?, ?)', 
        [period.vehicleId, period.startYM, endYM, active]);
    console.log('[DB] addItwVehiclePeriod erfolgreich');
};

export const updateItwVehiclePeriod = async (db: AsyncDB, period: { 
    id: number, 
    vehicleId: number, 
    startYM: string, 
    endYM?: string, 
    active?: boolean 
}) => {
    const endYM = period.endYM && period.endYM.trim() !== '' ? period.endYM : null;
    const active = period.active === false ? 0 : 1;
    await db.run('UPDATE itw_vehicle_periods SET vehicleId = ?, startYM = ?, endYM = ?, active = ? WHERE id = ?', 
        [period.vehicleId, period.startYM, endYM, active, period.id]);
};

export const deleteItwVehiclePeriod = async (db: AsyncDB, id: number) => {
    await db.run('DELETE FROM itw_vehicle_periods WHERE id = ?', [id]);
};

export const updateRtwVehiclePeriod = async (db: AsyncDB, period: { 
    id: number, 
    vehicleId: number, 
    startYM: string, 
    endYM?: string, 
    active?: boolean 
}) => {
    const endYM = period.endYM && period.endYM.trim() !== '' ? period.endYM : null;
    const active = period.active === false ? 0 : 1;
    await db.run('UPDATE rtw_vehicle_periods SET vehicleId = ?, startYM = ?, endYM = ?, active = ? WHERE id = ?', 
        [period.vehicleId, period.startYM, endYM, active, period.id]);
};

export const deleteRtwVehiclePeriod = async (db: AsyncDB, id: number) => {
    await db.run('DELETE FROM rtw_vehicle_periods WHERE id = ?', [id]);
};

// --- NEF Vehicle Periods Functions ---
export const getNefVehiclePeriods = async (db: AsyncDB, vehicleId: number) => {
    return await db.all('SELECT * FROM nef_vehicle_periods WHERE vehicleId = ? ORDER BY startYM ASC', [vehicleId]);
};

export const getAllNefVehiclePeriods = async (db: AsyncDB) => {
    return await db.all('SELECT * FROM nef_vehicle_periods ORDER BY vehicleId, startYM ASC');
};

export const addNefVehiclePeriod = async (db: AsyncDB, period: { 
    vehicleId: number, 
    startYM: string, 
    endYM?: string, 
    active?: boolean 
}) => {
    console.log('[DB] addNefVehiclePeriod', period);
    const endYM = period.endYM && period.endYM.trim() !== '' ? period.endYM : null;
    const active = period.active === false ? 0 : 1;
    await db.run('INSERT INTO nef_vehicle_periods (vehicleId, startYM, endYM, active) VALUES (?, ?, ?, ?)', 
        [period.vehicleId, period.startYM, endYM, active]);
    console.log('[DB] addNefVehiclePeriod erfolgreich');
};

export const updateNefVehiclePeriod = async (db: AsyncDB, period: { 
    id: number, 
    vehicleId: number, 
    startYM: string, 
    endYM?: string, 
    active?: boolean 
}) => {
    const endYM = period.endYM && period.endYM.trim() !== '' ? period.endYM : null;
    const active = period.active === false ? 0 : 1;
    await db.run('UPDATE nef_vehicle_periods SET vehicleId = ?, startYM = ?, endYM = ?, active = ? WHERE id = ?', 
        [period.vehicleId, period.startYM, endYM, active, period.id]);
};

export const deleteNefVehiclePeriod = async (db: AsyncDB, id: number) => {
    await db.run('DELETE FROM nef_vehicle_periods WHERE id = ?', [id]);
};

// Helper: Check if RTW vehicle is active in a given month
export const isRtwVehicleActiveInMonth = async (db: AsyncDB, vehicleId: number, yearMonth: string): Promise<boolean> => {
    const result = await db.get(
        `SELECT COUNT(*) as count FROM rtw_vehicle_periods 
         WHERE vehicleId = ? AND active = 1 
         AND startYM <= ? AND (endYM IS NULL OR endYM >= ?)`,
        [vehicleId, yearMonth, yearMonth]
    );
    return result && result.count > 0;
};

// Helper: Check if NEF vehicle is active in a given month
export const isNefVehicleActiveInMonth = async (db: AsyncDB, vehicleId: number, yearMonth: string): Promise<boolean> => {
    const result = await db.get(
        `SELECT COUNT(*) as count FROM nef_vehicle_periods 
         WHERE vehicleId = ? AND active = 1 
         AND startYM <= ? AND (endYM IS NULL OR endYM >= ?)`,
        [vehicleId, yearMonth, yearMonth]
    );
    return result && result.count > 0;
};

// Get all active RTW vehicle periods for a specific month
export const getActiveRtwVehiclesInMonth = async (db: AsyncDB, yearMonth: string) => {
    return await db.all(
        `SELECT rvp.*, rv.name 
         FROM rtw_vehicle_periods rvp
         JOIN rtw_vehicles rv ON rvp.vehicleId = rv.id
         WHERE rvp.active = 1 
         AND rvp.startYM <= ? AND (rvp.endYM IS NULL OR rvp.endYM >= ?)
         ORDER BY rv.sort`,
        [yearMonth, yearMonth]
    );
};

// Get all active NEF vehicle periods for a specific month
export const getActiveNefVehiclesInMonth = async (db: AsyncDB, yearMonth: string) => {
    return await db.all(
        `SELECT nvp.*, nv.name, nv.occupancy_mode 
         FROM nef_vehicle_periods nvp
         JOIN nef_vehicles nv ON nvp.vehicleId = nv.id
         WHERE nvp.active = 1 
         AND nvp.startYM <= ? AND (nvp.endYM IS NULL OR nvp.endYM >= ?)
         ORDER BY nv.sort`,
        [yearMonth, yearMonth]
    );
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
    console.log('[DB] assignSlot START:', entry);
    
    // Wenn slotType leer ist, leere nur das type-Feld (NICHT den ganzen Eintrag löschen - value bleibt erhalten!)
    if (!entry.slotType || entry.slotType === '') {
        await db.run('UPDATE duty_roster SET type = \'\'WHERE personId = ? AND personType = ? AND date = ?', [entry.personId, entry.personType, entry.date]);
        console.log('[DB] assignSlot cleared slot assignment (keeping value)', entry);
        return;
    }

    // WICHTIG: Erst alle anderen Personen aus diesem Slot entfernen (verhindert Doppelbelegung)
    await db.run(`UPDATE duty_roster SET type = CASE 
        WHEN type = ? AND (personId != ? OR personType != ?) THEN ''
        ELSE type 
        END 
        WHERE date = ? AND type = ?`, 
        [entry.slotType, entry.personId, entry.personType, entry.date, entry.slotType]
    );
    console.log('[DB] assignSlot cleared conflicting assignments for slot', entry.slotType, 'on', entry.date);

    // Prüfe, ob die Person bereits an diesem Tag irgendwo eingeteilt ist
    const existingRow = await db.get('SELECT type FROM duty_roster WHERE personId = ? AND personType = ? AND date = ?', [entry.personId, entry.personType, entry.date]);
    
    if (existingRow) {
        // Update existing entry, aber setze manual_edit NICHT auf 1 (damit keine blaue Markierung im Dienstplan erscheint)
        // Die Zuweisung soll unabhängig vom Dienstplan-Wert sein.
        await db.run('UPDATE duty_roster SET type = ? WHERE personId = ? AND personType = ? AND date = ?', [entry.slotType, entry.personId, entry.personType, entry.date]);
        console.log('[DB] assignSlot updated existing entry from', existingRow.type, 'to', entry.slotType, entry);
    } else {
        // Insert new entry mit manual_edit = 0
        await db.run('INSERT INTO duty_roster (personId, personType, date, value, type, manual_edit) VALUES (?, ?, ?, ?, ?, 0)', [entry.personId, entry.personType, entry.date, '', entry.slotType]);
        console.log('[DB] assignSlot created new entry', entry);
    }
    
    console.log('[DB] assignSlot COMPLETED:', entry);
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

// --- Qualification Validation for Duty Roster ---
export interface QualificationValidationResult {
    isValid: boolean;
    missingQualifications: string[];
    warnings: string[];
}

// Helper: Get required qualifications for a vehicle position dynamically
export const getRequiredQualificationsForVehiclePosition = async (
    db: AsyncDB,
    vehicleType: string,
    vehicleId: number,
    positionIndex: number
): Promise<string[]> => {
    const positions = await db.all(
        `SELECT vp.*, qt.name as qualificationName
         FROM vehicle_positions vp
         LEFT JOIN qualification_types qt ON vp.qualificationTypeId = qt.id
         WHERE vp.vehicleType = ? AND vp.vehicleId = ?
         ORDER BY vp.sort ASC`,
        [vehicleType, vehicleId]
    );
    
    if (positionIndex >= 0 && positionIndex < positions.length) {
        const position = positions[positionIndex];
        if (position.qualificationName) {
            return [position.qualificationName];
        }
    }
    
    return [];
};

// Helper: Get required qualifications based on cell type (for vehicle-based duty roster)
export const getRequiredQualificationsForCellType = async (
    db: AsyncDB,
    cellType: string
): Promise<{ qualifications: string[], azubiLehrjahr?: number }> => {
    // Parse cellType format: "rtw1_tag_1" or "nef1_nacht_1" or "itw_row_1"
    // Format: <vehicleType><vehicleNumber>_<shift>_<position> or itw_row_<position>
    
    let vehicleType: string;
    let vehicleNumber: number;
    let positionIndex: number;
    
    if (cellType.startsWith('itw_row_')) {
        // ITW format: "itw_row_1"
        vehicleType = 'itw';
        positionIndex = parseInt(cellType.split('_')[2]) - 1;
        
        // Get first ITW vehicle (in future, we might support multiple ITW vehicles)
        const itwVehicles = await db.all('SELECT id FROM itw_vehicles WHERE archived_year IS NULL ORDER BY sort ASC LIMIT 1');
        if (itwVehicles.length === 0) {
            return { qualifications: [] };
        }
        vehicleNumber = itwVehicles[0].id;
    } else {
        // RTW/NEF format: "rtw1_tag_1" or "nef1_nacht_1"
        const match = cellType.match(/^(rtw|nef)(\d+)_(?:tag|nacht)_(\d+)$/);
        if (!match) {
            return { qualifications: [] };
        }
        
        vehicleType = match[1];
        const vehicleIndex = parseInt(match[2]) - 1;
        positionIndex = parseInt(match[3]) - 1;
        
        // Get the vehicle ID by index
        const tableName = vehicleType === 'rtw' ? 'rtw_vehicles' : 'nef_vehicles';
        const vehicles = await db.all(`SELECT id FROM ${tableName} WHERE archived_year IS NULL ORDER BY sort ASC`);
        if (vehicleIndex >= vehicles.length) {
            return { qualifications: [] };
        }
        vehicleNumber = vehicles[vehicleIndex].id;
    }
    
    // Get required qualifications from vehicle positions
    const qualifications = await getRequiredQualificationsForVehiclePosition(db, vehicleType, vehicleNumber, positionIndex);
    
    // Check if Azubis are allowed (Maschinist positions typically allow Azubis from 2nd year)
    // This can be extended in the future to be configurable per position
    const azubiLehrjahr = positionIndex === 1 ? 2 : undefined; // Second position (Maschinist) allows Azubis
    
    return { qualifications, azubiLehrjahr };
};

// Mapping von Positionen/Werten zu erforderlichen Qualifikationen
const SHIFT_QUALIFICATION_REQUIREMENTS: Record<string, string[]> = {
    // RTW-Positionen (Fahrzeugführer)
    'FzF': ['Fahrzeugführer'], // Fahrzeugführer Position
    'F': ['Fahrzeugführer'], // Fahrzeugführer (kurz)
    
    // NEF-Positionen
    'NEF': ['NEF'], // NEF-Dienst
    'NEF-F': ['NEF'], // NEF Fahrzeugführer
    
    // ITW-Positionen  
    'ITW-M': ['ITW Maschinist'], // ITW Maschinist
    'ITW-F': ['ITW Fahrzeugführer'], // ITW Fahrzeugführer
    
    // Weitere spezielle Positionen
    'AS': ['Atemschutz'], // Atemschutz
    'HR': ['Höhenrettung'], // Höhenrettung  
    'TH': ['Technische Hilfeleistung'], // Technische Hilfeleistung
    
    // Hinweis: RTT/RTN sind Dienstarten, keine Positionen - benötigen keine Qualifikationsprüfung
};

// Mapping von Zelltypen zu erforderlichen Qualifikationen (für spezielle Fahrzeugzeilen)
const CELL_TYPE_QUALIFICATION_REQUIREMENTS: Record<string, { 
    qualifications: string[], 
    azubiLehrjahr?: number // Mindest-Lehrjahr für Azubis 
}> = {
    // RTW Fahrzeugführer (nur qualifizierte Personen)
    'rtw1_tag_1': { qualifications: ['Fahrzeugführer'] },
    'rtw1_nacht_1': { qualifications: ['Fahrzeugführer'] },
    
    // RTW Maschinist (qualifizierte Personen + Azubis ab 2. Lehrjahr)
    'rtw1_tag_2': { qualifications: ['Fahrzeugführer'], azubiLehrjahr: 2 },
    'rtw1_nacht_2': { qualifications: ['Fahrzeugführer'], azubiLehrjahr: 2 },
    
    // NEF Positionen (nur qualifizierte Personen)
    'nef1_tag_1': { qualifications: ['NEF'] },
    'nef1_nacht_1': { qualifications: ['NEF'] },
    
    // ITW Positionen
    'itw_row_1': { qualifications: ['ITW Fahrzeugführer'] },
    'itw_row_2': { qualifications: ['ITW Maschinist'] },
};

export const validateQualificationForShift = async (
    db: AsyncDB, 
    personId: number, 
    shiftValue: string, 
    date: string,
    cellType?: string
): Promise<QualificationValidationResult> => {
    const result: QualificationValidationResult = {
        isValid: true,
        missingQualifications: [],
        warnings: []
    };

    // Extrahiere Jahr und Monat aus Datum für Periodenprüfung
    const dateObj = new Date(date);
    const yearMonth = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
    
    // Check if person is active in this month
    const isActive = await isPersonnelActiveInMonth(db, personId, yearMonth);
    if (!isActive) {
        result.isValid = false;
        result.missingQualifications.push('Person ist in diesem Zeitraum nicht aktiv');
        return result;
    }
    
    // Ermittle erforderliche Qualifikationen - dynamisch aus vehicle_positions wenn cellType vorhanden
    let requiredQuals: string[] = [];
    
    if (cellType) {
        // Dynamische Anforderungen aus vehicle_positions
        const cellReqs = await getRequiredQualificationsForCellType(db, cellType);
        requiredQuals = cellReqs.qualifications;
        
        // Fallback zu hart codierten Anforderungen wenn keine Positionen konfiguriert
        if (requiredQuals.length === 0 && CELL_TYPE_QUALIFICATION_REQUIREMENTS[cellType]) {
            requiredQuals = CELL_TYPE_QUALIFICATION_REQUIREMENTS[cellType].qualifications;
        }
    } else {
        // Fallback zu alten hart codierten Anforderungen basierend auf shiftValue
        requiredQuals = SHIFT_QUALIFICATION_REQUIREMENTS[shiftValue] || [];
    }
    if (!requiredQuals || requiredQuals.length === 0) {
        // Keine speziellen Qualifikationen erforderlich
        return result;
    }

    // Lade alle aktiven Qualifikationsperioden der Person für den Monat
    const qualPeriods = await db.all(`
        SELECT * FROM qualification_periods 
        WHERE personId = ? AND active = 1
        AND (startYM <= ? AND (endYM IS NULL OR endYM >= ?))
    `, [personId, yearMonth, yearMonth]);

    // Prüfe jede erforderliche Qualifikation
    for (const requiredQual of requiredQuals) {
        const hasQualification = qualPeriods.some(period => period.qualType === requiredQual);
        
        if (!hasQualification) {
            result.isValid = false;
            result.missingQualifications.push(requiredQual);
        }
    }

    // Zusätzliche Warnungen für abgelaufene Qualifikationen
    for (const period of qualPeriods) {
        if (period.endYM && period.endYM < yearMonth) {
            result.warnings.push(`${period.qualType} ist seit ${period.endYM} abgelaufen`);
        }
    }

    return result;
};

// --- Qualification Types Management ---
export interface QualificationType {
    id: number;
    name: string;
    description?: string;
    category?: string;
    active: boolean;
    sort: number;
    excludeFromStats?: boolean; // Wenn true: Keine Soll/Ist-Berechnung, nur Positions-Besetzung (wie Azubis)
}

// Tabelle für Qualifikationstypen (falls noch nicht existiert)
export const initializeQualificationTypesTable = async (db: AsyncDB) => {
    await db.exec(`
        CREATE TABLE IF NOT EXISTS qualification_types (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            description TEXT,
            category TEXT,
            active INTEGER DEFAULT 1,
            sort INTEGER DEFAULT 0,
            excludeFromStats INTEGER DEFAULT 0
        )
    `);

    // Standard-Qualifikationstypen einfügen falls Tabelle leer
    const count = await db.get('SELECT COUNT(*) as count FROM qualification_types');
    if (count.count === 0) {
        const defaultQualifications = [
            { name: 'Fahrzeugführer', description: 'Grundausbildung Fahrzeugführer', category: 'Fahrzeugführung', sort: 1 },
            { name: 'Fahrzeugführer HLF-B', description: 'Hilfeleistungslöschfahrzeug B', category: 'Fahrzeugführung', sort: 2 },
            { name: 'NEF', description: 'Notarzteinsatzfahrzeug', category: 'Notfall', sort: 3 },
            { name: 'ITW Maschinist', description: 'Intensivtransportwagen Maschinist', category: 'Transport', sort: 4 },
            { name: 'ITW Fahrzeugführer', description: 'Intensivtransportwagen Fahrzeugführer', category: 'Transport', sort: 5 },
            { name: 'Atemschutz', description: 'Atemschutzgeräteträger', category: 'Sicherheit', sort: 6 },
            { name: 'Höhenrettung', description: 'Höhenrettung und Abseilmaßnahmen', category: 'Rettung', sort: 7 },
            { name: 'Technische Hilfeleistung', description: 'Technische Hilfeleistung bei Unfällen', category: 'Technik', sort: 8 }
        ];

        for (const qual of defaultQualifications) {
            await db.run(
                'INSERT INTO qualification_types (name, description, category, active, sort) VALUES (?, ?, ?, 1, ?)',
                [qual.name, qual.description, qual.category, qual.sort]
            );
        }
    }
};

export const getQualificationTypes = async (db: AsyncDB, activeOnly: boolean = false): Promise<QualificationType[]> => {
    const whereClause = activeOnly ? 'WHERE active = 1' : '';
    return await db.all(`SELECT * FROM qualification_types ${whereClause} ORDER BY sort ASC, name ASC`);
};

export const addQualificationType = async (db: AsyncDB, qualType: Omit<QualificationType, 'id'>): Promise<void> => {
    // Validierung: Name ist erforderlich
    if (!qualType.name || qualType.name.trim() === '') {
        throw new Error('Der Name der Qualifikation ist erforderlich');
    }
    
    // Prüfe ob excludeFromStats Spalte existiert
    const cols = await db.all("PRAGMA table_info('qualification_types')");
    const hasExcludeFromStats = cols.some((c: any) => c.name === 'excludeFromStats');
    
    if (hasExcludeFromStats) {
        await db.run(
            'INSERT INTO qualification_types (name, description, category, active, sort, excludeFromStats) VALUES (?, ?, ?, ?, ?, ?)',
            [qualType.name.trim(), qualType.description || null, qualType.category || null, qualType.active ? 1 : 0, qualType.sort, qualType.excludeFromStats ? 1 : 0]
        );
    } else {
        // Fallback ohne excludeFromStats (für alte Datenbanken)
        await db.run(
            'INSERT INTO qualification_types (name, description, category, active, sort) VALUES (?, ?, ?, ?, ?)',
            [qualType.name.trim(), qualType.description || null, qualType.category || null, qualType.active ? 1 : 0, qualType.sort]
        );
    }
};

export const updateQualificationType = async (db: AsyncDB, qualType: QualificationType): Promise<void> => {
    console.log('[DB] updateQualificationType received:', JSON.stringify(qualType, null, 2));
    
    // Validierung: Name ist erforderlich
    if (!qualType.name || qualType.name.trim() === '') {
        console.log('[DB] updateQualificationType: Name validation failed. name=', qualType.name);
        throw new Error('Der Name der Qualifikation ist erforderlich');
    }
    
    // Prüfe ob excludeFromStats Spalte existiert
    const cols = await db.all("PRAGMA table_info('qualification_types')");
    const hasExcludeFromStats = cols.some((c: any) => c.name === 'excludeFromStats');
    
    if (hasExcludeFromStats) {
        await db.run(
            'UPDATE qualification_types SET name = ?, description = ?, category = ?, active = ?, sort = ?, excludeFromStats = ? WHERE id = ?',
            [qualType.name.trim(), qualType.description || null, qualType.category || null, qualType.active ? 1 : 0, qualType.sort, qualType.excludeFromStats ? 1 : 0, qualType.id]
        );
    } else {
        // Fallback ohne excludeFromStats (für alte Datenbanken)
        await db.run(
            'UPDATE qualification_types SET name = ?, description = ?, category = ?, active = ?, sort = ? WHERE id = ?',
            [qualType.name.trim(), qualType.description || null, qualType.category || null, qualType.active ? 1 : 0, qualType.sort, qualType.id]
        );
    }
};

export const deleteQualificationType = async (db: AsyncDB, id: number): Promise<void> => {
    // Prüfe ob Qualifikationstyp in Verwendung ist
    const usageCount = await db.get('SELECT COUNT(*) as count FROM qualification_periods WHERE qualType = (SELECT name FROM qualification_types WHERE id = ?)', [id]);
    
    if (usageCount.count > 0) {
        throw new Error(`Qualifikationstyp kann nicht gelöscht werden. Er wird in ${usageCount.count} Qualifikationsperioden verwendet.`);
    }
    
    await db.run('DELETE FROM qualification_types WHERE id = ?', [id]);
};

export const getQualifiedPersonsForPosition = async (
    db: AsyncDB,
    position: string,
    date: string,
    cellType?: string
): Promise<{ id: number; name: string; vorname: string; qualifications: string[]; isAzubi?: boolean; lehrjahr?: number }[]> => {
    // Prüfe zuerst Zelltyp-basierte Anforderungen (dynamisch aus vehicle_positions)
    let cellRequirements: { qualifications: string[], azubiLehrjahr?: number } | null = null;
    
    if (cellType) {
        // Try to get requirements dynamically from vehicle positions
        cellRequirements = await getRequiredQualificationsForCellType(db, cellType);
        
        // Fallback to hardcoded requirements if no dynamic requirements found
        if (cellRequirements.qualifications.length === 0) {
            cellRequirements = CELL_TYPE_QUALIFICATION_REQUIREMENTS[cellType] || null;
        }
    }
    
    const requiredQuals = cellRequirements?.qualifications || SHIFT_QUALIFICATION_REQUIREMENTS[position] || [];
    
    if (requiredQuals.length === 0 && !cellRequirements) {
        // Keine Qualifikation erforderlich - alle aktiven Personen zurückgeben
        const allPersons = await db.all(`
            SELECT id, name, vorname, 0 as isAzubi
            FROM personnel 
            WHERE active = 1
            ORDER BY name, vorname
        `);
        return allPersons.map((p: any) => ({ ...p, qualifications: [] }));
    }
    
    const yearMonth = date.substring(0, 7); // '2025-11-15' -> '2025-11'
    const results: any[] = [];
    
    // Hole qualifizierte Personen
    if (requiredQuals.length > 0) {
        const personsWithQuals = await db.all(`
            SELECT DISTINCT 
                p.id, p.name, p.vorname,
                GROUP_CONCAT(qp.qualType) as qualifications,
                0 as isAzubi
            FROM personnel p
            LEFT JOIN qualification_periods qp ON p.id = qp.personId
                AND qp.active = 1
                AND qp.startYM <= ?
                AND (qp.endYM IS NULL OR qp.endYM >= ?)
            WHERE p.active = 1
            GROUP BY p.id, p.name, p.vorname
            ORDER BY p.name, p.vorname
        `, [yearMonth, yearMonth]);
        
        // Filtere nur Personen, die mindestens eine der erforderlichen Qualifikationen haben
        const qualified = personsWithQuals.filter((person: any) => {
            const personQuals = person.qualifications ? person.qualifications.split(',') : [];
            return requiredQuals.some(req => personQuals.includes(req));
        }).map((person: any) => ({
            ...person,
            qualifications: person.qualifications ? person.qualifications.split(',') : []
        }));
        
        results.push(...qualified);
    }
    
    // Füge qualifizierte Azubis hinzu (falls erlaubt)
    if (cellRequirements?.azubiLehrjahr) {
        const qualifiedAzubis = await db.all(`
            SELECT id, name, vorname, lehrjahr, 1 as isAzubi
            FROM azubis
            WHERE lehrjahr >= ?
            ORDER BY name, vorname
        `, [cellRequirements.azubiLehrjahr]);
        
        results.push(...qualifiedAzubis.map((azubi: any) => ({
            ...azubi,
            qualifications: [`Azubi ${azubi.lehrjahr}. Lj.`]
        })));
    }
    
    return results;
};

// --- Vehicle Position Management ---
export interface VehiclePosition {
    id: number;
    vehicleType: 'rtw' | 'nef' | 'itw';
    vehicleId: number;
    positionName: string;
    qualificationTypeId: number | null;
    sort: number;
}

// Holt alle Positionen für ein bestimmtes Fahrzeug
export const getVehiclePositions = async (db: AsyncDB, vehicleType: string, vehicleId: number): Promise<VehiclePosition[]> => {
    return await db.all(
        'SELECT * FROM vehicle_positions WHERE vehicleType = ? AND vehicleId = ? ORDER BY sort ASC, id ASC',
        [vehicleType, vehicleId]
    );
};

// Holt alle Positionen mit Qualifikations-Details
export const getVehiclePositionsWithQualifications = async (db: AsyncDB, vehicleType: string, vehicleId: number) => {
    return await db.all(`
        SELECT 
            vp.*,
            qt.name as qualificationName,
            qt.description as qualificationDescription,
            qt.category as qualificationCategory
        FROM vehicle_positions vp
        LEFT JOIN qualification_types qt ON vp.qualificationTypeId = qt.id
        WHERE vp.vehicleType = ? AND vp.vehicleId = ?
        ORDER BY vp.sort ASC, vp.id ASC
    `, [vehicleType, vehicleId]);
};

// Fügt eine neue Position zu einem Fahrzeug hinzu
export const addVehiclePosition = async (db: AsyncDB, position: Omit<VehiclePosition, 'id'>): Promise<void> => {
    await db.run(
        `INSERT INTO vehicle_positions (vehicleType, vehicleId, positionName, qualificationTypeId, sort) 
         VALUES (?, ?, ?, ?, ?)`,
        [position.vehicleType, position.vehicleId, position.positionName, position.qualificationTypeId, position.sort]
    );
};

// Aktualisiert eine Fahrzeugposition
export const updateVehiclePosition = async (db: AsyncDB, position: VehiclePosition): Promise<void> => {
    await db.run(
        `UPDATE vehicle_positions 
         SET positionName = ?, qualificationTypeId = ?, sort = ? 
         WHERE id = ?`,
        [position.positionName, position.qualificationTypeId, position.sort, position.id]
    );
};

// Löscht eine Fahrzeugposition
export const deleteVehiclePosition = async (db: AsyncDB, id: number): Promise<void> => {
    await db.run('DELETE FROM vehicle_positions WHERE id = ?', [id]);
};

// Aktualisiert die Sortierung mehrerer Positionen
export const updateVehiclePositionOrder = async (db: AsyncDB, order: number[]): Promise<void> => {
    for (let i = 0; i < order.length; i++) {
        await db.run('UPDATE vehicle_positions SET sort = ? WHERE id = ?', [i, order[i]]);
    }
};

// Initialisiert Standard-Positionen für ein neu erstelltes Fahrzeug
export const initializeDefaultVehiclePositions = async (
    db: AsyncDB, 
    vehicleType: 'rtw' | 'nef' | 'itw', 
    vehicleId: number
): Promise<void> => {
    // Prüfe ob bereits Positionen existieren
    const existing = await db.get(
        'SELECT COUNT(*) as count FROM vehicle_positions WHERE vehicleType = ? AND vehicleId = ?',
        [vehicleType, vehicleId]
    );
    
    if (existing.count > 0) {
        return; // Bereits Positionen vorhanden
    }

    // Hole die Qualifikationstypen aus der Datenbank
    const qualTypes = await getQualificationTypes(db, true);
    const findQualId = (name: string) => {
        const found = qualTypes.find(q => q.name === name);
        return found ? found.id : null;
    };

    let positions: Array<{ positionName: string; qualificationTypeId: number | null; sort: number }> = [];

    switch (vehicleType) {
        case 'rtw':
            positions = [
                { positionName: 'Fahrzeugführer', qualificationTypeId: findQualId('Fahrzeugführer'), sort: 0 },
                { positionName: 'Maschinist', qualificationTypeId: null, sort: 1 }
            ];
            break;
        case 'nef':
            positions = [
                { positionName: 'Assistent', qualificationTypeId: findQualId('NEF'), sort: 0 }
            ];
            break;
        case 'itw':
            positions = [
                { positionName: 'Fahrzeugführer', qualificationTypeId: findQualId('ITW Fahrzeugführer'), sort: 0 },
                { positionName: 'Maschinist', qualificationTypeId: findQualId('ITW Maschinist'), sort: 1 }
            ];
            break;
    }

    for (const pos of positions) {
        await db.run(
            `INSERT INTO vehicle_positions (vehicleType, vehicleId, positionName, qualificationTypeId, sort) 
             VALUES (?, ?, ?, ?, ?)`,
            [vehicleType, vehicleId, pos.positionName, pos.qualificationTypeId, pos.sort]
        );
    }
};

// --- Jahresspezifische Vorplanungsdateien ---
export const getYearPlannings = async (db: AsyncDB) => {
    // Defensive: Stelle sicher, dass die Tabelle existiert
    await ensureYearPlanningsTable(db);
    return await db.all('SELECT year, filePath FROM year_plannings ORDER BY year ASC');
};

export const getYearPlanningForYear = async (db: AsyncDB, year: number) => {
    // Defensive: Stelle sicher, dass die Tabelle existiert
    await ensureYearPlanningsTable(db);
    return await db.get('SELECT year, filePath FROM year_plannings WHERE year = ?', [year]);
};

export const saveYearPlannings = async (db: AsyncDB, plannings: { year: number; filePath: string }[]) => {
    // Defensive: Stelle sicher, dass die Tabelle existiert
    await ensureYearPlanningsTable(db);
    
    // Lösche alle bestehenden Einträge
    await db.run('DELETE FROM year_plannings');
    
    // Füge neue Einträge hinzu
    for (const planning of plannings) {
        if (planning.year && planning.filePath) {
            await db.run(
                'INSERT INTO year_plannings (year, filePath) VALUES (?, ?)',
                [planning.year, planning.filePath]
            );
        }
    }
};

export const deleteYearPlanning = async (db: AsyncDB, year: number) => {
    // Defensive: Stelle sicher, dass die Tabelle existiert
    await ensureYearPlanningsTable(db);
    await db.run('DELETE FROM year_plannings WHERE year = ?', [year]);
};

// Hilfsfunktion: Stelle sicher, dass year_plannings Tabelle existiert
const ensureYearPlanningsTable = async (db: AsyncDB) => {
    const exists = await db.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='year_plannings'"
    );
    if (!exists) {
        console.log('[DB] Creating missing year_plannings table');
        await db.exec(`
            CREATE TABLE year_plannings (
                year INTEGER PRIMARY KEY,
                filePath TEXT NOT NULL
            )
        `);
    }
};