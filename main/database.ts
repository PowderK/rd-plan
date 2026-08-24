import BetterSqlite3 from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { CacheManager } from './cache-manager';
import os from 'os';
import { execSync } from 'child_process';

/**
 * Prüft, ob ein Pfad auf einem Netzlaufwerk liegt
 */
async function checkIfNetworkDrive(dirPath: string): Promise<boolean> {
    try {
        const platform = os.platform();

        if (platform === 'win32') {
            // Windows: Prüfe mit 'net use' oder UNC-Pfad
            const drive = path.parse(dirPath).root;

            // UNC-Pfad erkennen (\\server\share)
            if (dirPath.startsWith('\\\\') || dirPath.startsWith('//')) {
                return true;
            }

            // Prüfe ob gemapptes Netzlaufwerk
            try {
                const output = execSync('net use', { encoding: 'utf-8' });
                const isNetworkDrive = output.includes(drive);
                return isNetworkDrive;
            } catch (e) {
                // Fehler ignorieren
            }
        } else if (platform === 'darwin') {
            // macOS: Prüfe ob in /Volumes (außer Macintosh HD)
            const isVolume = dirPath.startsWith('/Volumes/') && !dirPath.startsWith('/Volumes/Macintosh HD');
            return isVolume;
        } else if (platform === 'linux') {
            // Linux: Prüfe /proc/mounts für CIFS/NFS
            try {
                const mounts = fs.readFileSync('/proc/mounts', 'utf-8');
                const isNetwork = mounts.split('\n').some(line => {
                    const [, mountPoint, fsType] = line.split(' ');
                    return dirPath.startsWith(mountPoint) &&
                        (fsType === 'cifs' || fsType === 'nfs' || fsType === 'nfs4');
                });
                return isNetwork;
            } catch (e) {
                // Fehler ignorieren
            }
        }

        return false;
    } catch (e) {
        return false;
    }
}

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

    // Performance-Optimierung: Prüfe, ob DB auf Netzlaufwerk liegt
    const isNetworkDrive = await checkIfNetworkDrive(dbDir);
    let effectiveDbFile = dbFile;
    let cacheManager: CacheManager | null = null;

    if (isNetworkDrive) {
        cacheManager = new CacheManager(dbDir, { maxAgeMinutes: 1 }); // 1 Minute Cache für DB

        // Verwende lokale Cache-Kopie der Datenbank für schnelleren Zugriff
        const localDbDir = path.join(app.getPath('temp'), 'rd-plan-db');
        try {
            fs.mkdirSync(localDbDir, { recursive: true });
            effectiveDbFile = path.join(localDbDir, 'rd-plan.db');

            // Kopiere DB aus Netzwerk in lokalen Cache (falls nicht vorhanden oder veraltet)
            const needsCopy = !fs.existsSync(effectiveDbFile) ||
                (fs.statSync(dbFile).mtimeMs > fs.statSync(effectiveDbFile).mtimeMs);

            if (needsCopy) {
                fs.copyFileSync(dbFile, effectiveDbFile);
                // Auch WAL-Datei kopieren, falls vorhanden
                const walFile = dbFile + '-wal';
                const localWalFile = effectiveDbFile + '-wal';
                if (fs.existsSync(walFile)) {
                    fs.copyFileSync(walFile, localWalFile);
                }
            }

            // Periodisch zurück ins Netzwerk synchronisieren (alle 30 Sekunden)
            setInterval(() => {
                try {
                    fs.copyFileSync(effectiveDbFile, dbFile);
                    // Auch WAL-Datei synchronisieren
                    const localWalFile = effectiveDbFile + '-wal';
                    const walFile = dbFile + '-wal';
                    if (fs.existsSync(localWalFile)) {
                        fs.copyFileSync(localWalFile, walFile);
                    }
                } catch (e) {
                    // Fehler ignorieren
                }
            }, 30000); // 30 Sekunden
        } catch (e) {
            effectiveDbFile = dbFile; // Fallback auf Netzwerk-DB
        }
    }

    const raw = new BetterSqlite3(effectiveDbFile);

    // Performance-Optimierung: WAL-Modus aktivieren
    try {
        raw.pragma('journal_mode = WAL');
        raw.pragma('synchronous = NORMAL'); // Weniger I/O, aber sicher genug
        raw.pragma('cache_size = -64000'); // 64MB Cache
        raw.pragma('temp_store = MEMORY'); // Temp-Tabellen im RAM
    } catch (e) {
        // Fehler ignorieren
    }

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
            active INTEGER NOT NULL DEFAULT 1,
            department TEXT NOT NULL DEFAULT 'Rettungsdienst'
        )
    `);

    // Migration: add 'department' column to personnel if missing
    const personnelCols = await db.all("PRAGMA table_info('personnel')");
    if (!personnelCols.some((c: any) => c.name === 'department')) {
        await db.exec("ALTER TABLE personnel ADD COLUMN department TEXT NOT NULL DEFAULT 'Rettungsdienst'");
    }

    if (!personnelCols.some((c: any) => c.name === 'nef')) {
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
            await db.exec("ALTER TABLE personnel ADD COLUMN itwMaschinist INTEGER DEFAULT 0");
            await db.exec("UPDATE personnel SET itwMaschinist = 0 WHERE itwMaschinist IS NULL");
        }
        if (!colsAfter.some((c: any) => c.name === 'itwFahrzeugfuehrer')) {
            await db.exec("ALTER TABLE personnel ADD COLUMN itwFahrzeugfuehrer INTEGER DEFAULT 0");
            await db.exec("UPDATE personnel SET itwFahrzeugfuehrer = 0 WHERE itwFahrzeugfuehrer IS NULL");
        }
        // Migration: add 'active' column if missing (default 1)
        if (!colsAfter.some((c: any) => c.name === 'active')) {
            await db.exec("ALTER TABLE personnel ADD COLUMN active INTEGER DEFAULT 1");
            await db.exec("UPDATE personnel SET active = 1 WHERE active IS NULL");
        }

        // Migration: add contact fields if missing - REMOVED
        /*
        const contactFields = ['street', 'postalCode', 'city', 'phone', 'mobile', 'email'];
        for (const field of contactFields) {
            if (!colsAfter.some((c: any) => c.name === field)) {
                await db.exec(`ALTER TABLE personnel ADD COLUMN ${field} TEXT DEFAULT ''`);
                await db.exec(`UPDATE personnel SET ${field} = '' WHERE ${field} IS NULL`);
            }
        }
        */

        // Migration: add 'personnelNumber' if missing
        if (!colsAfter.some((c: any) => c.name === 'personnelNumber')) {
            await db.exec("ALTER TABLE personnel ADD COLUMN personnelNumber TEXT DEFAULT NULL");
        }

        // Migration: add 'roleId' if missing
        if (!colsAfter.some((c: any) => c.name === 'roleId')) {
            await db.exec("ALTER TABLE personnel ADD COLUMN roleId INTEGER DEFAULT NULL");
        }

        // Migration: add 'old_rtw_shifts' if missing
        if (!colsAfter.some((c: any) => c.name === 'old_rtw_shifts')) {
            await db.exec("ALTER TABLE personnel ADD COLUMN old_rtw_shifts INTEGER DEFAULT 0");
            await db.exec("UPDATE personnel SET old_rtw_shifts = 0 WHERE old_rtw_shifts IS NULL");
        }
    } catch (e) {
    }

    // --- Roles Tabelle für Rechteverwaltung (Migration für existierende DBs) ---
    try {
        console.log('[Database] Checking for roles table...');
        const rolesTableExists = await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='roles'");
        console.log('[Database] Roles table exists:', !!rolesTableExists);
        if (!rolesTableExists) {
            console.log('[Database] Creating roles table...');
            await db.exec(`
                CREATE TABLE roles (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL UNIQUE,
                    description TEXT,
                    canEditPersonnel INTEGER DEFAULT 0,
                    canEditVehicles INTEGER DEFAULT 0,
                    canEditSettings INTEGER DEFAULT 0,
                    canEditRoster INTEGER DEFAULT 0,
                    canEditDienstplan INTEGER DEFAULT 0,
                    canViewReports INTEGER DEFAULT 0,
                    canExportData INTEGER DEFAULT 0,
                    canManageUsers INTEGER DEFAULT 0,
                    canEditGlobalComments INTEGER DEFAULT 0,
                    canEditPersonalComments INTEGER DEFAULT 0,
                    canViewRoster INTEGER DEFAULT 0,
                    canViewDienstplan INTEGER DEFAULT 0,
                    canViewDienstplanAll INTEGER DEFAULT 0,
                    canViewItw INTEGER DEFAULT 0,
                    canEditItw INTEGER DEFAULT 0,
                    sort INTEGER DEFAULT 0
                )
            `);
            console.log('[Database] Migration: roles table created successfully');
        }
    } catch (e) {
        console.error('[Database] Error creating roles table:', e);
    }

    // --- Settings Tabelle ---
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

    // Schichtübernahmen-Tabelle (Issue #21)
    await db.exec(`
        CREATE TABLE IF NOT EXISTS shift_transfers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            from_person_id INTEGER NOT NULL,
            to_person_id INTEGER NOT NULL,
            shift_count REAL NOT NULL,
            position_type TEXT NOT NULL,
            month TEXT NOT NULL,
            reason TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(from_person_id) REFERENCES personnel(id) ON DELETE CASCADE,
            FOREIGN KEY(to_person_id) REFERENCES personnel(id) ON DELETE CASCADE
        )
    `);

    await db.exec(`CREATE INDEX IF NOT EXISTS idx_shift_transfers_from ON shift_transfers(from_person_id)`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_shift_transfers_to ON shift_transfers(to_person_id)`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_shift_transfers_month ON shift_transfers(month)`);

    // Migration: add 'month' column to shift_transfers if missing (Issue #21 cleanup)
    const stCols = await db.all("PRAGMA table_info('shift_transfers')");
    if (!stCols.some((c: any) => c.name === 'month')) {
        await db.exec("ALTER TABLE shift_transfers ADD COLUMN month TEXT DEFAULT ''");
        // Migrate data from 'valid_from' (take YYYY-MM)
        if (stCols.some((c: any) => c.name === 'valid_from')) {
            await db.exec("UPDATE shift_transfers SET month = SUBSTR(valid_from, 1, 7) WHERE month = '' OR month IS NULL");
        }
    }

    // Default-Wert für Shift Transfers Feature (standardmäßig aus)
    try {
        const row = await db.get("SELECT value FROM settings WHERE key = 'feature_shift_transfers'");
        if (!row) {
            await db.run("INSERT INTO settings (key, value) VALUES ('feature_shift_transfers', 'false')");
        }
    } catch (e) {
        // Ignore error
    }

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
        } catch (e) {
            await db.run('ROLLBACK');
        }
    }
    // Fülle die nächsten 20 Jahre (inkl. aktuelles Jahr) für Niedersachsen, ohne vorhandene Einträge zu überschreiben
    try {
        const nowYear = new Date().getFullYear();
        for (let y = 0; y < 20; y++) {
            await insertNIHolidaysIfMissing(db, nowYear + y);
        }
    } catch (e) {
    }

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
            const norm21 = (parts.slice(0, 21).concat(Array(21).fill(''))).slice(0, 21).map((v: string) => (v === 'IW' ? 'IW' : ''));
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
    }

    // Seed dept_patterns mit bisherigem 21er Standardmuster, falls leer
    try {
        const countDept: any = await db.get('SELECT COUNT(1) as cnt FROM dept_patterns');
        if (!countDept || countDept.cnt === 0) {
            const def = ['3', '2', '1', '3', '1', '3', '2', '1', '3', '2', '1', '2', '1', '3', '2', '1', '3', '2', '3', '2', '1'];
            const norm = def.slice(0, 21).concat(Array(21).fill('')).slice(0, 21).map(v => (v === '1' || v === '2' || v === '3') ? v : '');
            await db.run('INSERT OR REPLACE INTO dept_patterns (start_date, pattern) VALUES (?, ?)', ['1970-01-01', norm.join(',')]);
        }
    } catch (e) {
    }

    // ITW Pattern Sequenzen (department-spezifisch)
    await db.exec(`
        CREATE TABLE IF NOT EXISTS itw_patterns (
            start_date TEXT,
            department TEXT NOT NULL DEFAULT '1. Abteilung',
            pattern TEXT NOT NULL,
            PRIMARY KEY (start_date, department)
        )
    `);

    // Migration: add 'department' column to itw_patterns if missing
    try {
        console.log("[Migration] Checking itw_patterns schema...");
        const tableInfo: any = await db.all("PRAGMA table_info('itw_patterns')");
        const hasDept = tableInfo.some((c: any) => c.name === 'department');
        
        if (tableInfo.length > 0 && !hasDept) {
            console.log("[Migration] Column 'department' missing in itw_patterns. Performing full migration...");
            // We need to recreate the table because the PK changes
            await db.exec("ALTER TABLE itw_patterns RENAME TO itw_patterns_old");
            await db.exec(`
                CREATE TABLE itw_patterns (
                    start_date TEXT,
                    department TEXT NOT NULL DEFAULT '1. Abteilung',
                    pattern TEXT NOT NULL,
                    PRIMARY KEY (start_date, department)
                )
            `);
            // Copy data, assuming all old data belongs to '1. Abteilung'
            await db.exec("INSERT INTO itw_patterns (start_date, pattern) SELECT start_date, pattern FROM itw_patterns_old");
            await db.exec("DROP TABLE itw_patterns_old");
            console.log("[Migration] itw_patterns migration finished.");
        } else if (tableInfo.length === 0) {
            console.log("[Migration] itw_patterns table does not exist. Creating...");
            await db.exec(`
                CREATE TABLE itw_patterns (
                    start_date TEXT,
                    department TEXT NOT NULL DEFAULT '1. Abteilung',
                    pattern TEXT NOT NULL,
                    PRIMARY KEY (start_date, department)
                )
            `);
        }
    } catch (e) {
        console.error("[Migration] CRITICAL: itw_patterns migration failed:", e);
    }

    // ITW Phase Assignments
    await db.exec(`
        CREATE TABLE IF NOT EXISTS itw_phase_assignments (
            start_date TEXT NOT NULL,
            person_id INTEGER NOT NULL,
            role TEXT NOT NULL DEFAULT 'doctor',
            PRIMARY KEY (start_date, person_id)
        )
    `);

    // ITW Duty Roster
    await db.exec(`
        CREATE TABLE IF NOT EXISTS itw_duty_roster (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            personId INTEGER NOT NULL,
            personType TEXT NOT NULL DEFAULT 'person',
            date TEXT NOT NULL,
            value TEXT NOT NULL,
            type TEXT NOT NULL,
            manual_edit INTEGER DEFAULT 0,
            UNIQUE(personId, personType, date)
        )
    `);

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

    // Performance-Indizes für duty_roster (wichtig für Netzwerklaufwerke)
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_duty_roster_date_person ON duty_roster (date, personId, personType)`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_duty_roster_type ON duty_roster (type) WHERE type != ''`);

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
        await db.exec("ALTER TABLE azubis ADD COLUMN sort INTEGER DEFAULT 0");
        await db.exec("UPDATE azubis SET sort = 0 WHERE sort IS NULL");
    }
    if (!azubiCols.some((c: any) => c.name === 'department')) {
        await db.exec("ALTER TABLE azubis ADD COLUMN department TEXT NOT NULL DEFAULT '1. Abteilung'");
    }
    if (!azubiCols.some((c: any) => c.name === 'active')) {
        await db.exec("ALTER TABLE azubis ADD COLUMN active INTEGER DEFAULT 1");
        await db.exec("UPDATE azubis SET active = 1 WHERE active IS NULL");
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
        }
    }

    await fixDutyRosterUniqueConstraint(db);

    // --- Migration: manual_edit Spalte für duty_roster hinzufügen ---
    const dutyRosterCols = await db.all("PRAGMA table_info('duty_roster')");
    if (!dutyRosterCols.some((c: any) => c.name === 'manual_edit')) {
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

    // Migration: add 'sort', 'anrede', 'title' columns to itw_doctors if missing
    const itwCols = await db.all("PRAGMA table_info('itw_doctors')");
    if (!itwCols.some((c: any) => c.name === 'sort')) {
        await db.exec("ALTER TABLE itw_doctors ADD COLUMN sort INTEGER DEFAULT 0");
        await db.exec("UPDATE itw_doctors SET sort = 0 WHERE sort IS NULL");
    }
    if (!itwCols.some((c: any) => c.name === 'anrede')) {
        await db.exec("ALTER TABLE itw_doctors ADD COLUMN anrede TEXT DEFAULT ''");
    }
    if (!itwCols.some((c: any) => c.name === 'title')) {
        await db.exec("ALTER TABLE itw_doctors ADD COLUMN title TEXT DEFAULT ''");
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
        await db.exec("ALTER TABLE rtw_vehicles ADD COLUMN archived_year INTEGER");
    }

    const nefCols = await db.all("PRAGMA table_info('nef_vehicles')");
    if (!nefCols.some((c: any) => c.name === 'archived_year')) {
        await db.exec("ALTER TABLE nef_vehicles ADD COLUMN archived_year INTEGER");
    }
    if (!nefCols.some((c: any) => c.name === 'occupancy_mode')) {
        await db.exec("ALTER TABLE nef_vehicles ADD COLUMN occupancy_mode TEXT DEFAULT '24h'");
        try { await db.exec("UPDATE nef_vehicles SET occupancy_mode = '24h' WHERE occupancy_mode IS NULL"); } catch { }
    }

    const itwVehCols = await db.all("PRAGMA table_info('itw_vehicles')");
    if (!itwVehCols.some((c: any) => c.name === 'archived_year')) {
        await db.exec("ALTER TABLE itw_vehicles ADD COLUMN archived_year INTEGER");
    }

    // Migration: add 'lehrjahr' column to azubi_periods if missing
    const azubiPeriodsCols = await db.all("PRAGMA table_info('azubi_periods')");
    if (!azubiPeriodsCols.some((c: any) => c.name === 'lehrjahr')) {
        await db.exec("ALTER TABLE azubi_periods ADD COLUMN lehrjahr INTEGER DEFAULT 1");
    }

    // Migration: add 'excludeFromStats' column to qualification_types if missing
    const qualTypeCols = await db.all("PRAGMA table_info('qualification_types')");
    if (!qualTypeCols.some((c: any) => c.name === 'excludeFromStats')) {
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

    // --- Sondertage & Spitzenabdeckung (Fahrzeuge) ---
    await db.exec(`
        CREATE TABLE IF NOT EXISTS vehicle_special_days (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vehicleType TEXT NOT NULL,
            vehicleId INTEGER NOT NULL,
            date TEXT NOT NULL,
            reason TEXT,
            shiftMode TEXT DEFAULT '24h',
            action TEXT DEFAULT 'add',
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(vehicleType, vehicleId, date)
        )
    `);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_vehicle_special_days_lookup ON vehicle_special_days (vehicleType, vehicleId, date)`);

    // Ensure note column in vehicle period tables
    for (const table of ['rtw_vehicle_periods', 'nef_vehicle_periods', 'itw_vehicle_periods']) {
        const cols = await db.all(`PRAGMA table_info('${table}')`);
        if (!cols.some((c: any) => c.name === 'note')) {
            try { await db.exec(`ALTER TABLE ${table} ADD COLUMN note TEXT`); } catch { }
        }
    }

    // --- Jahresspezifische Vorplanungsdateien ---
    const yearPlanningsExists = await db.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='year_plannings'"
    );
    if (!yearPlanningsExists) {
        await db.exec(`
            CREATE TABLE year_plannings (
                year INTEGER PRIMARY KEY,
                filePath TEXT NOT NULL
            )
        `);
    }

    // --- Kommentar-Tabellen (Issue #22) ---
    await db.exec(`
        CREATE TABLE IF NOT EXISTS roster_comments_personal (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            person_id INTEGER NOT NULL,
            date TEXT NOT NULL,
            comment TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            created_by TEXT,
            updated_at TEXT,
            FOREIGN KEY(person_id) REFERENCES personnel(id) ON DELETE CASCADE,
            UNIQUE(person_id, date)
        )
    `);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_roster_comments_personal_date ON roster_comments_personal(date)`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_roster_comments_personal_person ON roster_comments_personal(person_id)`);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS roster_comments_global (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            comment TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            created_by TEXT,
            updated_at TEXT,
            UNIQUE(date)
        )
    `);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_roster_comments_global_date ON roster_comments_global(date)`);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS guests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            date TEXT NOT NULL,
            end_date TEXT,
            remark TEXT
        )
    `);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_guests_date ON guests(date)`);
    try {
        await db.exec(`ALTER TABLE guests ADD COLUMN end_date TEXT`);
    } catch (e) {
        // column already exists
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

export const getPersonnel = async (db: AsyncDB, includeInactive: boolean = false, date?: string, department?: string) => {
    if (includeInactive && (!department || department === 'all')) {
        return await db.all('SELECT * FROM personnel ORDER BY sort ASC, id ASC');
    }

    // If no date is provided, use legacy behavior (active flag only)
    if (!date) {
        const list = await db.all('SELECT * FROM personnel ORDER BY sort ASC, id ASC');
        const currentDate = new Date().toISOString().slice(0, 10);
        const result = [];
        for (const p of list) {
            // Check department
            if (department && department !== 'all') {
                const hasDeptPeriods = await db.get(
                    'SELECT 1 FROM personnel_department_periods WHERE person_id = ? LIMIT 1',
                    [p.id]
                );
                if (hasDeptPeriods) {
                    const period = await db.get(
                        `SELECT department FROM personnel_department_periods 
                         WHERE person_id = ? AND start_date <= ? AND (end_date IS NULL OR end_date >= ?) 
                         ORDER BY start_date DESC LIMIT 1`,
                        [p.id, currentDate, currentDate]
                    );
                    if (!period || normalizeDepartment(period.department) !== normalizeDepartment(department)) continue;
                } else {
                    if (normalizeDepartment(p.department || '1. Abteilung') !== normalizeDepartment(department)) continue;
                }
            }
            
            // Check active (unless including inactive)
            if (!includeInactive && COALESCE(p.active, 1) === 0) continue;
            
            result.push(p);
        }
        return result;
    }

    function COALESCE(val: any, def: any) {
        return (val === null || val === undefined) ? def : val;
    }

    // Safety check for date
    if (!date || typeof date !== 'string') {
        // Fallback to current year if no date provided
        date = new Date().getFullYear().toString();
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
        // 1. Check active status
        // Check if this person has ANY periods
        const hasPeriods = await db.get('SELECT 1 FROM personnel_active_periods WHERE personId = ? LIMIT 1', [p.id]);

        let isActive = false;
        if (!hasPeriods) {
            isActive = (p.active !== 0 && p.active !== false);
        } else {
            const isActiveInPeriod = await db.get(
                `SELECT 1 FROM personnel_active_periods 
                 WHERE personId = ? AND active = 1 
                 AND startYM <= ? AND (endYM IS NULL OR endYM >= ?) LIMIT 1`,
                [p.id, startLimit, endLimit]
            );
            isActive = !!isActiveInPeriod;
        }

        if (!isActive && !includeInactive) continue;

        // 2. Check department if provided
        if (department && department !== 'all') {
            let deptStartLimit: string;
            let deptEndLimit: string;

            if (date.length === 4) {
                // Year mode: Active in department at any point in the year
                deptStartLimit = `${date}-12-31`;
                deptEndLimit = `${date}-01-01`;
            } else {
                // Month mode (YYYY-MM or YYYY-MM-DD)
                const parts = date.split('-');
                const y = parseInt(parts[0]);
                const m = parseInt(parts[1]);
                const ym = `${y}-${String(m).padStart(2, '0')}`;
                const lastDay = new Date(y, m, 0).getDate();
                deptStartLimit = `${ym}-${String(lastDay).padStart(2, '0')}`;
                deptEndLimit = `${ym}-01`;
            }

            const hasDeptPeriods = await db.get(
                'SELECT 1 FROM personnel_department_periods WHERE person_id = ? LIMIT 1',
                [p.id]
            );

            if (hasDeptPeriods) {
                const period = await db.get(
                    `SELECT department FROM personnel_department_periods 
                     WHERE person_id = ? AND start_date <= ? AND (end_date IS NULL OR end_date >= ?) 
                     ORDER BY start_date DESC LIMIT 1`,
                    [p.id, deptStartLimit, deptEndLimit]
                );
                if (!period || normalizeDepartment(period.department) !== normalizeDepartment(department)) {
                    continue;
                }
            } else {
                if (normalizeDepartment(p.department || '1. Abteilung') !== normalizeDepartment(department)) {
                    continue;
                }
            }
        }

        result.push(p);
    }
    return result;
};

export const addPersonnel = async (db: AsyncDB, person: any) => {
    // Contact fields removed
    const { name, vorname, active, teilzeit, fahrzeugfuehrer, fahrzeugfuehrerHLFB, nef, itwMaschinist, itwFahrzeugfuehrer, sort, personnelNumber, roleId, oldRtwShifts, department } = person;

    return await db.run(
        'INSERT INTO personnel (name, vorname, active, teilzeit, fahrzeugfuehrer, fahrzeugfuehrerHLFB, nef, itwMaschinist, itwFahrzeugfuehrer, sort, personnelNumber, roleId, old_rtw_shifts, department) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [name, vorname, active !== false ? 1 : 0, teilzeit || 0, fahrzeugfuehrer ? 1 : 0, fahrzeugfuehrerHLFB ? 1 : 0, nef ? 1 : 0, itwMaschinist ? 1 : 0, itwFahrzeugfuehrer ? 1 : 0, sort || 0, personnelNumber || null, roleId || null, oldRtwShifts || 0, department || '1. Abteilung']
    );
};

export const updatePersonnel = async (db: AsyncDB, person: any) => {
    // Contact fields removed
    const { id, name, vorname, active, teilzeit, fahrzeugfuehrer, fahrzeugfuehrerHLFB, nef, itwMaschinist, itwFahrzeugfuehrer, personnelNumber, roleId, oldRtwShifts, department } = person;

    await db.run(
        'UPDATE personnel SET name = ?, vorname = ?, active = ?, teilzeit = ?, fahrzeugfuehrer = ?, fahrzeugfuehrerHLFB = ?, nef = ?, itwMaschinist = ?, itwFahrzeugfuehrer = ?, personnelNumber = ?, roleId = ?, old_rtw_shifts = ?, department = ? WHERE id = ?',
        [name, vorname, active !== false ? 1 : 0, teilzeit || 0, fahrzeugfuehrer ? 1 : 0, fahrzeugfuehrerHLFB ? 1 : 0, nef ? 1 : 0, itwMaschinist ? 1 : 0, itwFahrzeugfuehrer ? 1 : 0, personnelNumber || null, roleId || null, oldRtwShifts || 0, department || '1. Abteilung', id]
    );
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

export const normalizeDepartment = (deptStr: string | null | undefined): string => {
    const dept = String(deptStr || '').trim();
    if (!dept || dept === 'all') return '1. Abteilung';
    if (/^\d+$/.test(dept)) return `${dept}. Abteilung`;
    return dept;
};

export const getDutyRoster = async (db: AsyncDB, year: number, department?: string) => {
    const start = `${year}-01-01`;
    const end = `${year}-12-31`;
    let query = 'SELECT * FROM duty_roster WHERE date BETWEEN ? AND ?';
    const params: any[] = [start, end];
    if (department && department !== 'all') {
        query += ' AND department = ?';
        params.push(normalizeDepartment(department));
    }
    return await db.all(query, params);
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
    } catch (e) {
        await db.run('ROLLBACK');
        throw e;
    }
};

export const addHoliday = async (db: AsyncDB, date: string, name: string = '') => {
    await db.run(`
        INSERT INTO holidays (date, name) VALUES (?, ?)
        ON CONFLICT(date) DO UPDATE SET name = excluded.name
    `, [date, name]);
};

// --- Department Patterns CRUD ---
export const getDeptPatterns = async (db: AsyncDB) => {
    const rows = await db.all('SELECT start_date as startDate, pattern FROM dept_patterns ORDER BY start_date ASC');
    return rows.map((r: any) => ({ startDate: String(r.startDate), pattern: String(r.pattern) }));
};

export const setDeptPatterns = async (db: AsyncDB, patterns: { startDate: string, pattern: string }[]) => {
    await db.run('BEGIN');
    try {
        await db.run('DELETE FROM dept_patterns');
        let ins = 0;
        for (const p of (patterns || [])) {
            if (!p || !p.startDate || !p.pattern) continue;
            const sd = String(p.startDate).trim();
            if (!/\d{4}-\d{2}-\d{2}/.test(sd)) continue;
            const parts = String(p.pattern || '').split(',').map(s => s.trim());
            const norm = (parts.slice(0, 21).concat(Array(21).fill('')).slice(0, 21)).map(v => (v === '1' || v === '2' || v === '3') ? v : '');
            await db.run('INSERT INTO dept_patterns (start_date, pattern) VALUES (?, ?)', [sd, norm.join(',')]);
            ins++;
        }
        await db.run('COMMIT');
    } catch (e) {
        await db.run('ROLLBACK');
        throw e;
    }
};

export const deleteHoliday = async (db: AsyncDB, date: string) => {
    await db.run('DELETE FROM holidays WHERE date = ?', [date]);
};

export const getAuditLogs = async (db: AsyncDB, filters?: { year?: number; month?: number }) => {
    let query = 'SELECT * FROM audit_logs ORDER BY timestamp DESC';
    const params: any[] = [];
    if (filters && filters.year) {
        query = 'SELECT * FROM audit_logs WHERE substr(timestamp, 1, 4) = ? ORDER BY timestamp DESC LIMIT 5000';
        params.push(String(filters.year));
    } else {
        query += ' LIMIT 5000';
    }
    return await db.all(query, params);
};

export const cleanupAuditLogs = async (db: AsyncDB) => {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    await db.run('DELETE FROM audit_logs WHERE timestamp < ?', [oneYearAgo.toISOString()]);
};

export const getPersonName = async (db: AsyncDB, pid: number, ptype: string) => {
    if (ptype === 'guest') {
        const row = await db.get('SELECT name FROM guests WHERE id = ?', [pid]);
        return row ? row.name : `Gast ID: ${pid}`;
    }
    const row = await db.get(
        (ptype === 'person' || !ptype) ? 'SELECT name, vorname FROM personnel WHERE id = ?' : 'SELECT name, vorname FROM azubis WHERE id = ?',
        [pid]
    );
    return row ? `${row.vorname} ${row.name}` : `ID: ${pid}`;
};

export const addAuditLog = async (db: AsyncDB, log: { user_id: number, user_name: string, action_type: string, entity_type: string, entity_ref: string, old_value: string, new_value: string, details?: string }) => {
    await db.run(
        `INSERT INTO audit_logs (timestamp, user_id, user_name, action_type, entity_type, entity_ref, old_value, new_value, details) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [new Date().toISOString(), log.user_id, log.user_name, log.action_type, log.entity_type, log.entity_ref, log.old_value, log.new_value, log.details || null]
    );
};

export const setDutyRosterEntry = async (db: AsyncDB, entry: { personId: number, personType: string, date: string, value: string, type: string, department?: string, auditUser?: { id: number, name: string } }): Promise<{ success: boolean; warning?: string; vehicleAssignment?: string }> => {
    if (!entry.personId || !entry.date) {
        return { success: false };
    }

    // Prüfe, ob die Person bereits eine Fahrzeugzuweisung oder einen Eintrag hat
    const dept = normalizeDepartment(entry.department);
    const existingEntry = await db.get(
        'SELECT type, value FROM duty_roster WHERE personId = ? AND personType = ? AND date = ? AND department = ?',
        [entry.personId, entry.personType || 'person', entry.date, dept]
    );

    let warning: string | undefined;
    let vehicleAssignment: string | undefined;
    const oldValue = existingEntry?.value || '';

    // Wenn neue Schichtart gesetzt wird UND Person hat Fahrzeugzuweisung
    if (entry.value && entry.value.trim() !== '' && existingEntry && existingEntry.type &&
        (existingEntry.type.startsWith('rtw') || existingEntry.type.startsWith('nef') || existingEntry.type.startsWith('itw'))) {

        // Prüfe, ob die neue Schichtart als "nicht verfügbar" konfiguriert ist
        const auswertungSetting = await db.get(
            'SELECT value FROM settings WHERE key = ?',
            [`auswertung_${entry.value.trim()}`]
        );

        const auswertung = auswertungSetting?.value || 'off';

        // Wenn auswertung = 'off' → Person nicht verfügbar
        if (auswertung === 'off') {
            vehicleAssignment = existingEntry.type;
            warning = `⚠️ Warnung: Die Person ist auf einem Fahrzeug eingeteilt (${existingEntry.type}), hat aber jetzt eine nicht verfügbare Schichtart. Bitte Fahrzeugzuweisung im Reiter "Einteilung" prüfen.`;
        }
    }

    // Speichere die Änderung OHNE das type-Feld zu löschen (Fahrzeugzuweisung bleibt erhalten)
    await db.run(`
        INSERT INTO duty_roster (personId, personType, date, value, type, manual_edit, department) VALUES (?, ?, ?, ?, ?, 1, ?)
        ON CONFLICT(personId, personType, date, department) DO UPDATE SET value = excluded.value, manual_edit = 1
    `, [entry.personId, entry.personType || 'person', entry.date, entry.value ?? '', existingEntry?.type || entry.type || 'text', dept]);

    if (entry.auditUser && oldValue !== (entry.value || '')) {
        const pName = await getPersonName(db, entry.personId, entry.personType);
        await addAuditLog(db, {
            user_id: entry.auditUser.id,
            user_name: entry.auditUser.name,
            action_type: 'update',
            entity_type: 'duty_roster',
            entity_ref: `${pName} (${entry.date})`,
            old_value: oldValue,
            new_value: entry.value || '',
            details: `Schicht geändert von "${oldValue}" zu "${entry.value || ''}"`
        });
    }

    return { success: true, warning, vehicleAssignment };
};

// Bulk Import für viele Einträge in einer Transaktion (ein Broadcast später im Main)
export const bulkSetDutyRosterEntries = async (db: AsyncDB, entries: { personId: number, personType: string, date: string, value: string, type: string, auditUser?: { id: number, name: string } }[]) => {
    if (!Array.isArray(entries) || entries.length === 0) return 0;
    await db.run('BEGIN');
    let ok = 0;
    let audited = 0;
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
            }
        }
        await stmt.finalize();

        // Let's attach a single audit log for bulk operations if we have an auditUser
        const sampleAudit = entries.find(x => x.auditUser);
        if (sampleAudit && sampleAudit.auditUser) {
            await addAuditLog(db, {
                user_id: sampleAudit.auditUser.id,
                user_name: sampleAudit.auditUser.name,
                action_type: 'BULK_UPDATE_ROSTER',
                entity_type: 'duty_roster',
                entity_ref: 'Bulk',
                old_value: '',
                new_value: `${ok} entries updated`,
                details: 'Massenaktualisierung angewendet'
            });
        }

        await db.run('COMMIT');
        return ok;
    } catch (e) {
        await db.run('ROLLBACK');
        throw e;
    }
};

// Bulk Import für Importe, die manuelle Bearbeitungen respektieren
export const bulkImportDutyRosterEntries = async (db: AsyncDB, entries: { personId: number, personType: string, date: string, value: string, type: string, department?: string }[], respectManualEdits: boolean = true, deleteEmpty: boolean = true) => {
    if (!Array.isArray(entries) || entries.length === 0) return { imported: 0, skipped: 0 };
    await db.run('BEGIN');
    let imported = 0;
    let skipped = 0;
    try {
        for (const e of entries) {
            if (!e || !e.personId || !e.date) continue;
            const dept = normalizeDepartment(e.department);

            let isManual = false;
            if (respectManualEdits) {
                // Prüfe ob Eintrag bereits existiert und manuell bearbeitet wurde
                const existing = await db.get(`
                    SELECT manual_edit FROM duty_roster 
                    WHERE personId = ? AND personType = ? AND date = ? AND department = ?
                `, [e.personId, e.personType || 'person', e.date, dept]);

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
                        WHERE personId = ? AND personType = ? AND date = ? AND department = ?
                    `, [e.personId, e.personType || 'person', e.date, dept]);
                    imported++;
                }
                // Wenn deleteEmpty=false, ignorieren wir leere Excel-Zellen -> DB-Eintrag bleibt erhalten
                continue;
            }

            try {
                await db.run(`
                    INSERT INTO duty_roster (personId, personType, date, value, type, manual_edit, department) VALUES (?, ?, ?, ?, ?, 0, ?)
                    ON CONFLICT(personId, personType, date, department) DO UPDATE SET 
                        value = excluded.value,
                        type = CASE 
                            WHEN duty_roster.type LIKE 'rtw%' OR duty_roster.type LIKE 'nef%' OR duty_roster.type LIKE 'itw%' THEN duty_roster.type
                            ELSE excluded.type 
                        END,
                        manual_edit = 0
                `, [e.personId, e.personType || 'person', e.date, e.value, e.type ?? 'text', dept]);
                imported++;
            } catch (ie) {
            }
        }
        await db.run('COMMIT');
        return { imported, skipped };
    } catch (e) {
        await db.run('ROLLBACK');
        throw e;
    }
};

/**
 * Löscht Einträge für Personen, die nicht im aktuellen Import enthalten sind (Sync-Modus)
 */
export const deleteOrphanedDutyRosterEntries = async (
    db: AsyncDB,
    year: number,
    monthRange: { start: number; end: number } | number | undefined,
    seenPersonIds: string[],
    department?: string
) => {
    if (!seenPersonIds || seenPersonIds.length === 0) return 0;

    let dateCondition = "";
    let params: any[] = [];

    if (monthRange === undefined) {
        // Ganzes Jahr
        dateCondition = "date LIKE ?";
        params.push(`${year}-%`);
    } else if (typeof monthRange === 'number') {
        // Einzelner Monat
        const mon = String(monthRange + 1).padStart(2, '0');
        dateCondition = "date LIKE ?";
        params.push(`${year}-${mon}-%`);
    } else {
        // Monat-Bereich
        const startMon = String(monthRange.start + 1).padStart(2, '0');
        const endMonthNum = monthRange.end + 1;
        const endMon = String(endMonthNum).padStart(2, '0');
        const lastDay = new Date(year, endMonthNum, 0).getDate();
        dateCondition = "date >= ? AND date <= ?";
        params.push(`${year}-${startMon}-01`, `${year}-${endMon}-${lastDay}`);
    }

    // Platzhalter für die IN-Klausel erstellen
    const placeholders = seenPersonIds.map(() => "?").join(",");
    
    let deptCondition = '';
    if (department && department !== 'all') {
        deptCondition = ' AND department = ?';
        params.push(normalizeDepartment(department));
    }

    const sql = `
        DELETE FROM duty_roster 
        WHERE ${dateCondition}
        AND manual_edit = 0
        AND (personType = 'person' OR personType = 'azubi')
        ${deptCondition}
        AND (personId || ':' || personType) NOT IN (${placeholders})
    `;

    try {
        const result = await db.run(sql, [...params, ...seenPersonIds]);
        console.log(`[Database] Orphaned entries cleanup: ${result?.changes || 0} entries deleted.`);
        return result?.changes || 0;
    } catch (e) {
        console.error('[Database] Error in deleteOrphanedDutyRosterEntries:', e);
        return 0;
    }
};

/**
 * Ordnet Azubis Abteilungen zu und dupliziert bei Bedarf pro Abteilung
 * (wenn Diensteinträge in mehreren Abteilungen dieselbe Azubi-ID nutzen).
 * Läuft einmalig (Flag migration_azubi_department_scope_v1).
 */
export const migrateAzubisDepartmentScope = async (db: AsyncDB): Promise<{ updated: number; duplicated: number; skipped: boolean }> => {
    const flag = await db.get("SELECT value FROM settings WHERE key = 'migration_azubi_department_scope_v1'");
    if (flag?.value === '1') {
        return { updated: 0, duplicated: 0, skipped: true };
    }

    const azubiCols = await db.all("PRAGMA table_info('azubis')");
    if (!azubiCols.some((c: any) => c.name === 'department')) {
        return { updated: 0, duplicated: 0, skipped: true };
    }

    let defaultDept = '1. Abteilung';
    try {
        const s = await db.get("SELECT value FROM settings WHERE key = 'department'");
        if (s?.value) defaultDept = normalizeDepartment(String(s.value));
    } catch { /* ignore */ }

    const dutyCols = await db.all("PRAGMA table_info('duty_roster')");
    const dutyHasDept = dutyCols.some((c: any) => c.name === 'department');

    let updated = 0;
    let duplicated = 0;

    if (dutyHasDept) {
        const usageRows = await db.all(`
            SELECT personId AS azubi_id, department, COUNT(*) AS cnt
            FROM duty_roster
            WHERE personType = 'azubi'
            GROUP BY personId, department
        `) as Array<{ azubi_id: number; department: string; cnt: number }>;

        const byAzubi = new Map<number, Array<{ dept: string; cnt: number }>>();
        for (const row of usageRows) {
            const id = Number(row.azubi_id);
            const dept = normalizeDepartment(row.department);
            if (!byAzubi.has(id)) byAzubi.set(id, []);
            byAzubi.get(id)!.push({ dept, cnt: Number(row.cnt) || 0 });
        }

        for (const [azubiId, deptUsages] of byAzubi) {
            const azubi = await db.get('SELECT * FROM azubis WHERE id = ?', [azubiId]) as any;
            if (!azubi) continue;

            if (deptUsages.length === 1) {
                const dept = deptUsages[0].dept;
                if (normalizeDepartment(azubi.department) !== dept) {
                    await db.run('UPDATE azubis SET department = ? WHERE id = ?', [dept, azubiId]);
                    updated++;
                }
                continue;
            }

            deptUsages.sort((a, b) => b.cnt - a.cnt);
            const primaryDept = deptUsages[0].dept;
            if (normalizeDepartment(azubi.department) !== primaryDept) {
                await db.run('UPDATE azubis SET department = ? WHERE id = ?', [primaryDept, azubiId]);
                updated++;
            }

            for (let i = 1; i < deptUsages.length; i++) {
                const dept = deptUsages[i].dept;
                const existing = await db.get(
                    `SELECT id FROM azubis WHERE LOWER(name) = LOWER(?) AND LOWER(vorname) = LOWER(?) AND department = ?`,
                    [azubi.name, azubi.vorname, dept]
                ) as { id: number } | undefined;

                let targetId: number;
                if (existing?.id) {
                    targetId = existing.id;
                } else {
                    const sortRow: any = await db.get('SELECT MAX(sort) AS m FROM azubis WHERE department = ?', [dept]);
                    const nextSort = (sortRow?.m != null ? Number(sortRow.m) : -1) + 1;
                    const ins = await db.run(
                        'INSERT INTO azubis (name, vorname, lehrjahr, sort, department) VALUES (?, ?, ?, ?, ?)',
                        [azubi.name, azubi.vorname, azubi.lehrjahr, nextSort, dept]
                    );
                    targetId = ins.lastInsertRowid as number;
                    duplicated++;

                    const periods = await db.all('SELECT * FROM azubi_periods WHERE azubi_id = ?', [azubiId]);
                    for (const p of periods as any[]) {
                        await db.run(
                            'INSERT INTO azubi_periods (azubi_id, start_date, end_date, description, lehrjahr) VALUES (?, ?, ?, ?, ?)',
                            [targetId, p.start_date, p.end_date, p.description || '', p.lehrjahr || 1]
                        );
                    }
                }

                await db.run(
                    `UPDATE duty_roster SET personId = ?
                     WHERE personType = 'azubi' AND personId = ? AND department = ?`,
                    [targetId, azubiId, dept]
                );
            }
        }
    }

    const orphans = await db.all(`
        SELECT a.id FROM azubis a
        WHERE NOT EXISTS (
            SELECT 1 FROM duty_roster d WHERE d.personType = 'azubi' AND d.personId = a.id
        )
    `) as Array<{ id: number }>;

    for (const { id } of orphans) {
        const row = await db.get('SELECT department FROM azubis WHERE id = ?', [id]) as { department?: string } | undefined;
        const dept = String(row?.department || '').trim();
        if (!dept) {
            await db.run('UPDATE azubis SET department = ? WHERE id = ?', [defaultDept, id]);
            updated++;
        }
    }

    await db.run(
        `INSERT INTO settings (key, value) VALUES ('migration_azubi_department_scope_v1', '1')
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    );

    console.log(`[Database] Azubi-Abteilungs-Migration: ${updated} aktualisiert, ${duplicated} dupliziert`);
    return { updated, duplicated, skipped: false };
};

const DEFAULT_DEPARTMENTS = ['1. Abteilung', '2. Abteilung', '3. Abteilung'];

/**
 * Kopiert globale Freigabe-Keys (roster_released_{year}_{month}) auf alle bekannten Abteilungen.
 * Läuft einmalig (Flag migration_roster_released_per_department_v1).
 */
export const migrateRosterReleasedPerDepartment = async (
    db: AsyncDB
): Promise<{ migrated: number; skipped: boolean }> => {
    const {
        isLegacyRosterReleasedKey,
        parseLegacyRosterReleasedKey,
        rosterReleasedSettingKey,
    } = await import('./roster-release-keys');

    const flag = await db.get("SELECT value FROM settings WHERE key = 'migration_roster_released_per_department_v1'");
    if (flag?.value === '1') {
        return { migrated: 0, skipped: true };
    }

    const deptRows = await getUniqueDepartments(db);
    const departments = deptRows.length > 0 ? deptRows : [...DEFAULT_DEPARTMENTS];

    const legacyRows = await db.all(
        "SELECT key, value FROM settings WHERE key LIKE 'roster_released_%'"
    ) as Array<{ key: string; value: string }>;

    let migrated = 0;
    for (const row of legacyRows) {
        if (!isLegacyRosterReleasedKey(row.key)) continue;
        const parsed = parseLegacyRosterReleasedKey(row.key);
        if (!parsed) continue;

        for (const dept of departments) {
            const newKey = rosterReleasedSettingKey(parsed.year, parsed.monthIndex, dept);
            const existing = await db.get('SELECT value FROM settings WHERE key = ?', [newKey]);
            if (!existing) {
                await db.run(
                    `INSERT INTO settings (key, value) VALUES (?, ?)
                     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
                    [newKey, row.value]
                );
                migrated++;
            }
        }
        await db.run('DELETE FROM settings WHERE key = ?', [row.key]);
    }

    await db.run(
        `INSERT INTO settings (key, value) VALUES ('migration_roster_released_per_department_v1', '1')
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    );

    if (migrated > 0) {
        console.log(`[Database] Freigabe pro Abteilung: ${migrated} Einstellungen aus Legacy-Keys übernommen`);
    }
    return { migrated, skipped: false };
};

export const getAzubiList = async (db: AsyncDB, department?: string, includeInactive: boolean = false) => {
    let query = 'SELECT * FROM azubis';
    const params: any[] = [];
    const conditions: string[] = [];

    if (!includeInactive) {
        conditions.push('(active = 1 OR active IS NULL)');
    }
    if (department && department !== 'all') {
        conditions.push('department = ?');
        params.push(normalizeDepartment(department));
    }
    if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY sort ASC, id ASC';
    const azubis = await db.all(query, params);
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

export const setAzubiActive = async (db: AsyncDB, id: number, active: boolean) => {
    await db.run('UPDATE azubis SET active = ? WHERE id = ?', [active ? 1 : 0, id]);
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

export const addAzubi = async (db: AsyncDB, azubi: { name: string, vorname: string, lehrjahr: number, department?: string, periods?: any[] }) => {
    const dept = normalizeDepartment(azubi.department);
    let azubiId: number;
    // determine next sort index (pro Abteilung)
    try {
        const row: any = await db.get('SELECT MAX(sort) as m FROM azubis WHERE department = ?', [dept]);
        const next = (row && typeof row.m === 'number') ? row.m + 1 : 0;
        const result = await db.run(
            'INSERT INTO azubis (name, vorname, lehrjahr, sort, department) VALUES (?, ?, ?, ?, ?)',
            [azubi.name, azubi.vorname, azubi.lehrjahr, next, dept]
        );
        azubiId = result.lastInsertRowid as number;
    } catch (e) {
        const result = await db.run(
            'INSERT INTO azubis (name, vorname, lehrjahr, department) VALUES (?, ?, ?, ?)',
            [azubi.name, azubi.vorname, azubi.lehrjahr, dept]
        );
        azubiId = result.lastInsertRowid as number;
    }

    if (azubi.periods && Array.isArray(azubi.periods)) {
        for (const p of azubi.periods) {
            await db.run('INSERT INTO azubi_periods (azubi_id, start_date, end_date, description, lehrjahr) VALUES (?, ?, ?, ?, ?)',
                [azubiId, p.start_date, p.end_date, p.description || '', p.lehrjahr || 1]);
        }
    }
    return azubiId;
};

export const updateAzubi = async (db: AsyncDB, azubi: { id: number, name: string, vorname: string, lehrjahr: number, department?: string }) => {
    if (azubi.department != null) {
        await db.run(
            'UPDATE azubis SET name = ?, vorname = ?, lehrjahr = ?, department = ? WHERE id = ?',
            [azubi.name, azubi.vorname, azubi.lehrjahr, normalizeDepartment(azubi.department), azubi.id]
        );
    } else {
        await db.run('UPDATE azubis SET name = ?, vorname = ?, lehrjahr = ? WHERE id = ?', [azubi.name, azubi.vorname, azubi.lehrjahr, azubi.id]);
    }
};

export const deleteAzubi = async (db: AsyncDB, id: number) => {
    await db.run('DELETE FROM azubis WHERE id = ?', [id]);
};

// --- Azubi Periods Functions ---
export const getAzubiPeriods = async (db: AsyncDB, azubiId: number) => {
    return await db.all('SELECT * FROM azubi_periods WHERE azubi_id = ? ORDER BY start_date ASC', [azubiId]);
};

export const consolidateAzubiPeriods = async (db: AsyncDB, azubiId: number) => {
    try {
        const periods = await db.all('SELECT * FROM azubi_periods WHERE azubi_id = ? ORDER BY lehrjahr ASC, start_date ASC', [azubiId]) as any[];
        if (!periods || periods.length < 2) return;

        const ONE_DAY_MS = 24 * 60 * 60 * 1000 + 1000;

        let current = periods[0];

        for (let i = 1; i < periods.length; i++) {
            const next = periods[i];

            const sameLehrjahr = (current.lehrjahr || 1) === (next.lehrjahr || 1);

            if (sameLehrjahr) {
                const dEndCur = new Date(current.end_date + 'T00:00:00Z').getTime();
                const dStartNext = new Date(next.start_date + 'T00:00:00Z').getTime();

                // Check if contiguous or overlapping
                if (dStartNext <= dEndCur + ONE_DAY_MS) {
                    if (next.end_date > current.end_date) {
                        current.end_date = next.end_date;
                    }
                    if (next.start_date < current.start_date) {
                        current.start_date = next.start_date;
                    }
                    await db.run('UPDATE azubi_periods SET start_date = ?, end_date = ? WHERE id = ?', [current.start_date, current.end_date, current.id]);
                    await db.run('DELETE FROM azubi_periods WHERE id = ?', [next.id]);
                    continue;
                }
            }

            current = next;
        }
    } catch (err) {
        console.warn('[Database] Fehler bei consolidateAzubiPeriods:', err);
    }
};

export const consolidateAllAzubiPeriods = async (db: AsyncDB) => {
    try {
        const azubis = await db.all('SELECT id FROM azubis') as Array<{ id: number }>;
        for (const a of azubis) {
            await consolidateAzubiPeriods(db, a.id);
        }
    } catch (err) {
        console.warn('[Database] Fehler bei consolidateAllAzubiPeriods:', err);
    }
};

export const getAllAzubiPeriods = async (db: AsyncDB) => {
    await consolidateAllAzubiPeriods(db);
    return await db.all('SELECT * FROM azubi_periods ORDER BY azubi_id, start_date ASC');
};

export const addAzubiPeriod = async (db: AsyncDB, period: { azubi_id: number, start_date: string, end_date: string, description?: string, lehrjahr?: number }) => {
    const lehrjahr = period.lehrjahr || 1;
    const existing = await db.all('SELECT * FROM azubi_periods WHERE azubi_id = ? AND lehrjahr = ?', [period.azubi_id, lehrjahr]) as any[];
    
    const ONE_DAY_MS = 24 * 60 * 60 * 1000 + 1000;
    const dNewStart = new Date(period.start_date + 'T00:00:00Z').getTime();
    const dNewEnd = new Date(period.end_date + 'T00:00:00Z').getTime();

    const matching = (existing || []).filter(p => {
        const dStart = new Date(p.start_date + 'T00:00:00Z').getTime();
        const dEnd = new Date(p.end_date + 'T00:00:00Z').getTime();
        return (dNewStart <= dEnd + ONE_DAY_MS && dNewEnd >= dStart - ONE_DAY_MS);
    });

    if (matching.length > 0) {
        const target = matching[0];
        let minStart = period.start_date;
        let maxEnd = period.end_date;

        for (const p of matching) {
            if (p.start_date < minStart) minStart = p.start_date;
            if (p.end_date > maxEnd) maxEnd = p.end_date;
        }

        await db.run('UPDATE azubi_periods SET start_date = ?, end_date = ? WHERE id = ?', [minStart, maxEnd, target.id]);

        for (let i = 1; i < matching.length; i++) {
            await db.run('DELETE FROM azubi_periods WHERE id = ?', [matching[i].id]);
        }
    } else {
        await db.run('INSERT INTO azubi_periods (azubi_id, start_date, end_date, description, lehrjahr) VALUES (?, ?, ?, ?, ?)',
            [period.azubi_id, period.start_date, period.end_date, period.description || '', lehrjahr]);
    }

    await consolidateAzubiPeriods(db, period.azubi_id);
};

export const updateAzubiPeriod = async (db: AsyncDB, period: { id: number, azubi_id: number, start_date: string, end_date: string, description?: string, lehrjahr?: number }) => {
    await db.run('UPDATE azubi_periods SET azubi_id = ?, start_date = ?, end_date = ?, description = ?, lehrjahr = ? WHERE id = ?',
        [period.azubi_id, period.start_date, period.end_date, period.description || '', period.lehrjahr || 1, period.id]);
    await consolidateAzubiPeriods(db, period.azubi_id);
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
    await db.run('INSERT OR IGNORE INTO qualification_periods (personId, qualType, startYM, endYM, active) VALUES (?, ?, ?, ?, ?)',
        [period.personId, period.qualType, period.startYM, period.endYM || null, period.active ? 1 : 0]);
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
    await db.run('INSERT INTO personnel_active_periods (personId, startYM, endYM, description, active) VALUES (?, ?, ?, ?, ?)',
        [period.personId, period.startYM, period.endYM || null, period.description || '', period.active ? 1 : 0]);
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

export const addItwDoctor = async (db: AsyncDB, doc: { name: string, vorname: string, anrede?: string, title?: string }) => {
    const anrede = doc.anrede || '';
    const title = doc.title || '';
    try {
        const row: any = await db.get('SELECT MAX(sort) as m FROM itw_doctors');
        const next = (row && typeof row.m === 'number') ? row.m + 1 : 0;
        await db.run('INSERT INTO itw_doctors (name, vorname, anrede, title, sort) VALUES (?, ?, ?, ?, ?)', [doc.name, doc.vorname, anrede, title, next]);
    } catch (e) {
        await db.run('INSERT INTO itw_doctors (name, vorname, anrede, title) VALUES (?, ?, ?, ?)', [doc.name, doc.vorname, anrede, title]);
    }
};

export const updateItwDoctor = async (db: AsyncDB, doc: { id: number, name: string, vorname: string, anrede?: string, title?: string }) => {
    const anrede = doc.anrede || '';
    const title = doc.title || '';
    await db.run('UPDATE itw_doctors SET name = ?, vorname = ?, anrede = ?, title = ? WHERE id = ?', [doc.name, doc.vorname, anrede, title, doc.id]);
};

export const deleteItwDoctor = async (db: AsyncDB, id: number) => {
    await db.run('DELETE FROM itw_doctors WHERE id = ?', [id]);
};

export const updateItwDoctorOrder = async (db: AsyncDB, order: number[]) => {
    for (let i = 0; i < order.length; i++) {
        await db.run('UPDATE itw_doctors SET sort = ? WHERE id = ?', [i, order[i]]);
    }
};

export const ensureVehicleCategoryColumns = async (db: AsyncDB) => {
    for (const table of ['rtw_vehicles', 'nef_vehicles', 'itw_vehicles']) {
        try {
            const cols = await db.all(`PRAGMA table_info('${table}')`);
            if (cols.length > 0 && !cols.some((c: any) => c.name === 'category')) {
                await db.exec(`ALTER TABLE ${table} ADD COLUMN category TEXT NOT NULL DEFAULT 'regular'`);
            }
        } catch { }
    }
};

// --- RTW Vehicles CRUD ---
export const getRtwVehicles = async (db: AsyncDB, year?: number) => {
    await ensureVehicleCategoryColumns(db);
    if (typeof year === 'number') {
        return await db.all("SELECT id, name, sort, archived_year, COALESCE(category, 'regular') as category FROM rtw_vehicles WHERE archived_year IS NULL OR archived_year >= ? ORDER BY CASE WHEN COALESCE(category, 'regular') = 'reserve' THEN 1 ELSE 0 END ASC, sort ASC, id ASC", [year]);
    }
    return await db.all("SELECT id, name, sort, archived_year, COALESCE(category, 'regular') as category FROM rtw_vehicles WHERE archived_year IS NULL ORDER BY CASE WHEN COALESCE(category, 'regular') = 'reserve' THEN 1 ELSE 0 END ASC, sort ASC, id ASC");
};
export const addRtwVehicle = async (db: AsyncDB, v: { name: string, category?: string, periods?: any[] }) => {
    await ensureVehicleCategoryColumns(db);
    let vehicleId: number | undefined;
    const cat = v.category === 'reserve' ? 'reserve' : 'regular';
    try {
        const row: any = await db.get('SELECT MAX(sort) as m FROM rtw_vehicles');
        const next = (row && typeof row.m === 'number') ? row.m + 1 : 0;
        const result = await db.run('INSERT INTO rtw_vehicles (name, sort, category) VALUES (?, ?, ?)', [v.name, next, cat]);
        vehicleId = Number(result.lastInsertRowid);
    } catch (e) {
        const result = await db.run('INSERT INTO rtw_vehicles (name, category) VALUES (?, ?)', [v.name, cat]);
        vehicleId = Number(result.lastInsertRowid);
    }

    if (!vehicleId || isNaN(vehicleId)) {
        throw new Error(`Failed to create RTW vehicle: no vehicleId returned (got: ${vehicleId})`);
    }

    // Initialisiere Standard-Positionen
    await initializeDefaultVehiclePositions(db, 'rtw', vehicleId);

    // Nur Zeiträume anlegen, wenn diese explizit übergeben wurden
    if (v.periods && Array.isArray(v.periods)) {
        for (const p of v.periods) {
            await db.run('INSERT INTO rtw_vehicle_periods (vehicleId, startYM, endYM, active, note) VALUES (?, ?, ?, ?, ?)',
                [vehicleId, p.startYM || p.startDate, p.endYM || p.endDate || null, p.active !== false ? 1 : 0, p.note || '']);
        }
    }

    return vehicleId;
};
export const updateRtwVehicle = async (db: AsyncDB, v: { id: number, name: string, category?: string }) => {
    await ensureVehicleCategoryColumns(db);
    const cat = v.category === 'reserve' ? 'reserve' : 'regular';
    await db.run('UPDATE rtw_vehicles SET name = ?, category = ? WHERE id = ?', [v.name, cat, v.id]);
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
    await ensureVehicleCategoryColumns(db);
    if (typeof year === 'number') {
        return await db.all("SELECT id, name, sort, archived_year, COALESCE(occupancy_mode, '24h') as occupancy_mode, COALESCE(category, 'regular') as category FROM nef_vehicles WHERE archived_year IS NULL OR archived_year >= ? ORDER BY CASE WHEN COALESCE(category, 'regular') = 'reserve' THEN 1 ELSE 0 END ASC, sort ASC, id ASC", [year]);
    }
    return await db.all("SELECT id, name, sort, archived_year, COALESCE(occupancy_mode, '24h') as occupancy_mode, COALESCE(category, 'regular') as category FROM nef_vehicles WHERE archived_year IS NULL ORDER BY CASE WHEN COALESCE(category, 'regular') = 'reserve' THEN 1 ELSE 0 END ASC, sort ASC, id ASC");
};

// --- ITW Vehicles CRUD ---
export const getItwVehicles = async (db: AsyncDB, year?: number) => {
    await ensureVehicleCategoryColumns(db);
    if (typeof year === 'number') {
        return await db.all("SELECT id, name, sort, archived_year, COALESCE(category, 'regular') as category FROM itw_vehicles WHERE archived_year IS NULL OR archived_year >= ? ORDER BY CASE WHEN COALESCE(category, 'regular') = 'reserve' THEN 1 ELSE 0 END ASC, sort ASC, id ASC", [year]);
    }
    return await db.all("SELECT id, name, sort, archived_year, COALESCE(category, 'regular') as category FROM itw_vehicles WHERE archived_year IS NULL ORDER BY CASE WHEN COALESCE(category, 'regular') = 'reserve' THEN 1 ELSE 0 END ASC, sort ASC, id ASC");
};
export const addItwVehicle = async (db: AsyncDB, v: { name: string, category?: string, periods?: any[] }) => {
    await ensureVehicleCategoryColumns(db);
    let vehicleId: number | undefined;
    const cat = v.category === 'reserve' ? 'reserve' : 'regular';
    try {
        const row: any = await db.get('SELECT MAX(sort) as m FROM itw_vehicles');
        const next = (row && typeof row.m === 'number') ? row.m + 1 : 0;
        const result = await db.run('INSERT INTO itw_vehicles (name, sort, category) VALUES (?, ?, ?)', [v.name, next, cat]);
        vehicleId = Number(result.lastInsertRowid);
    } catch (e) {
        const result = await db.run('INSERT INTO itw_vehicles (name, category) VALUES (?, ?)', [v.name, cat]);
        vehicleId = Number(result.lastInsertRowid);
    }

    if (!vehicleId || isNaN(vehicleId)) {
        throw new Error('Failed to create ITW vehicle: no vehicleId returned');
    }

    // Initialisiere Standard-Positionen
    await initializeDefaultVehiclePositions(db, 'itw', vehicleId);

    // Nur Zeiträume anlegen, wenn diese explizit übergeben wurden
    if (v.periods && Array.isArray(v.periods)) {
        for (const p of v.periods) {
            await db.run('INSERT INTO itw_vehicle_periods (vehicleId, startYM, endYM, active, note) VALUES (?, ?, ?, ?, ?)',
                [vehicleId, p.startYM || p.startDate, p.endYM || p.endDate || null, p.active !== false ? 1 : 0, p.note || '']);
        }
    }

    return vehicleId;
};
export const updateItwVehicle = async (db: AsyncDB, v: { id: number, name: string, category?: string }) => {
    await ensureVehicleCategoryColumns(db);
    const cat = v.category === 'reserve' ? 'reserve' : 'regular';
    await db.run('UPDATE itw_vehicles SET name = ?, category = ? WHERE id = ?', [v.name, cat, v.id]);
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

export const addNefVehicle = async (db: AsyncDB, v: { name: string, occupancyMode?: '24h' | 'tag', category?: string, periods?: any[] }) => {
    await ensureVehicleCategoryColumns(db);
    let vehicleId: number | undefined;
    const cat = v.category === 'reserve' ? 'reserve' : 'regular';
    try {
        const row: any = await db.get('SELECT MAX(sort) as m FROM nef_vehicles');
        const next = (row && typeof row.m === 'number') ? row.m + 1 : 0;
        const result = await db.run('INSERT INTO nef_vehicles (name, sort, occupancy_mode, category) VALUES (?, ?, ?, ?)',
            [v.name, next, v.occupancyMode === 'tag' ? 'tag' : '24h', cat]);
        vehicleId = result.lastInsertRowid as number;
    } catch (e) {
        const result = await db.run('INSERT INTO nef_vehicles (name, occupancy_mode, category) VALUES (?, ?, ?)',
            [v.name, v.occupancyMode === 'tag' ? 'tag' : '24h', cat]);
        vehicleId = result.lastInsertRowid as number;
    }

    if (!vehicleId) {
        throw new Error('Failed to create NEF vehicle: no vehicleId returned');
    }

    // Initialisiere Standard-Positionen
    await initializeDefaultVehiclePositions(db, 'nef', vehicleId);

    // Nur Zeiträume anlegen, wenn diese explizit übergeben wurden
    if (v.periods && Array.isArray(v.periods)) {
        for (const p of v.periods) {
            await db.run('INSERT INTO nef_vehicle_periods (vehicleId, startYM, endYM, active, note) VALUES (?, ?, ?, ?, ?)',
                [vehicleId, p.startYM || p.startDate, p.endYM || p.endDate || null, p.active !== false ? 1 : 0, p.note || '']);
        }
    }

    return vehicleId;
};
export const updateNefVehicle = async (db: AsyncDB, v: { id: number, name: string, occupancyMode?: '24h' | 'tag', category?: string }) => {
    await ensureVehicleCategoryColumns(db);
    const cat = v.category === 'reserve' ? 'reserve' : 'regular';
    if (v.occupancyMode) {
        await db.run('UPDATE nef_vehicles SET name = ?, occupancy_mode = ?, category = ? WHERE id = ?', [v.name, v.occupancyMode, cat, v.id]);
    } else {
        await db.run('UPDATE nef_vehicles SET name = ?, category = ? WHERE id = ?', [v.name, cat, v.id]);
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
    // Vehicles without active periods are INACTIVE by default (e.g. reserve vehicles or unassigned)
    const vehicles = await getRtwVehicles(db, year);
    const results: { vehicleId: number, month: number, enabled: number }[] = [];

    for (const v of vehicles) {
        const periods = await db.all('SELECT * FROM rtw_vehicle_periods WHERE vehicleId = ?', [v.id]);
        
        for (let m = 1; m <= 12; m++) {
            const ym = `${year}-${String(m).padStart(2, '0')}`;
            
            // If no periods exist, vehicle is inactive by default (must have valid period)
            let isActive = false;
            
            if (periods.length > 0) {
                isActive = periods.some((p: any) =>
                    (p.active === 1 || p.active === true) &&
                    p.startYM <= ym &&
                    (p.endYM === null || p.endYM === '' || p.endYM >= ym)
                );
            }
            
            results.push({ vehicleId: v.id, month: m, enabled: isActive ? 1 : 0 });
        }
    }
    return results;
};

export const setRtwVehicleActivation = async (db: AsyncDB, vehicleId: number, year: number, month: number, enabled: boolean) => {
    // Deprecated: No-op or log warning. The new system uses periods.
};

export const getNefVehicleActivations = async (db: AsyncDB, year: number) => {
    // Compatibility: Generate activation list from periods
    const vehicles = await getNefVehicles(db, year);
    const results: { vehicleId: number, month: number, enabled: number }[] = [];

    for (const v of vehicles) {
        const periods = await db.all('SELECT * FROM nef_vehicle_periods WHERE vehicleId = ?', [v.id]);
        
        for (let m = 1; m <= 12; m++) {
            const ym = `${year}-${String(m).padStart(2, '0')}`;
            
            // If no periods exist, vehicle is inactive by default (must have valid period)
            let isActive = false;
            
            if (periods.length > 0) {
                isActive = periods.some((p: any) =>
                    (p.active === 1 || p.active === true) &&
                    p.startYM <= ym &&
                    (p.endYM === null || p.endYM === '' || p.endYM >= ym)
                );
            }
            
            results.push({ vehicleId: v.id, month: m, enabled: isActive ? 1 : 0 });
        }
    }
    return results;
};

export const setNefVehicleActivation = async (db: AsyncDB, vehicleId: number, year: number, month: number, enabled: boolean) => {
    // Deprecated: No-op or log warning. The new system uses periods.
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
    const endYM = period.endYM && period.endYM.trim() !== '' ? period.endYM : null;
    const active = period.active === false ? 0 : 1;
    await db.run('INSERT INTO rtw_vehicle_periods (vehicleId, startYM, endYM, active) VALUES (?, ?, ?, ?)',
        [period.vehicleId, period.startYM, endYM, active]);
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
    const endYM = period.endYM && period.endYM.trim() !== '' ? period.endYM : null;
    const active = period.active === false ? 0 : 1;
    await db.run('INSERT INTO itw_vehicle_periods (vehicleId, startYM, endYM, active) VALUES (?, ?, ?, ?)',
        [period.vehicleId, period.startYM, endYM, active]);
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

// --- Special Days & Peak Coverage (Spitzenabdeckung / Sonderlagen) ---
export const ensureVehicleTables = async (db: AsyncDB) => {
    try {
        await db.exec(`
            CREATE TABLE IF NOT EXISTS vehicle_special_days (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                vehicleType TEXT NOT NULL,
                vehicleId INTEGER NOT NULL,
                date TEXT NOT NULL,
                reason TEXT,
                shiftMode TEXT DEFAULT '24h',
                action TEXT DEFAULT 'add',
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(vehicleType, vehicleId, date)
            )
        `);
        await db.exec(`CREATE INDEX IF NOT EXISTS idx_vehicle_special_days_lookup ON vehicle_special_days (vehicleType, vehicleId, date)`);

        for (const table of ['rtw_vehicle_periods', 'nef_vehicle_periods', 'itw_vehicle_periods']) {
            try {
                await db.exec(`
                    CREATE TABLE IF NOT EXISTS ${table} (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        vehicleId INTEGER NOT NULL,
                        startYM TEXT NOT NULL,
                        endYM TEXT,
                        active INTEGER DEFAULT 1,
                        note TEXT
                    )
                `);
                const cols = await db.all(`PRAGMA table_info('${table}')`);
                if (cols.length > 0 && !cols.some((c: any) => c.name === 'note')) {
                    await db.exec(`ALTER TABLE ${table} ADD COLUMN note TEXT`);
                }
            } catch { }
        }
    } catch (e) {
        console.warn('[DB] ensureVehicleTables error:', e);
    }
};

export const getVehicleSpecialDays = async (db: AsyncDB, vehicleType: string, vehicleId: number) => {
    await ensureVehicleTables(db);
    const vt = (vehicleType || 'rtw').toLowerCase();
    return await db.all(
        'SELECT * FROM vehicle_special_days WHERE vehicleType = ? AND vehicleId = ? ORDER BY date ASC',
        [vt, vehicleId]
    );
};

export const getAllVehicleSpecialDays = async (db: AsyncDB, year?: number) => {
    await ensureVehicleTables(db);
    if (year) {
        return await db.all('SELECT * FROM vehicle_special_days WHERE date LIKE ? ORDER BY date ASC', [`${year}-%`]);
    }
    return await db.all('SELECT * FROM vehicle_special_days ORDER BY date ASC');
};

export const setVehicleSpecialDays = async (
    db: AsyncDB,
    vehicleType: string,
    vehicleId: number,
    specialDays: Array<{ date: string, reason?: string, shiftMode?: string, action?: string }>
) => {
    await ensureVehicleTables(db);
    const vt = (vehicleType || 'rtw').toLowerCase();
    await db.run('DELETE FROM vehicle_special_days WHERE vehicleType = ? AND vehicleId = ?', [vt, vehicleId]);
    for (const s of (specialDays || [])) {
        const date = (s.date || '').trim();
        if (!date) continue;
        const reason = (s.reason || '').trim() || null;
        const shiftMode = s.shiftMode || '24h';
        const action = s.action || 'add';
        await db.run(
            'INSERT OR REPLACE INTO vehicle_special_days (vehicleType, vehicleId, date, reason, shiftMode, action) VALUES (?, ?, ?, ?, ?, ?)',
            [vt, vehicleId, date, reason, shiftMode, action]
        );
    }
};

export const setVehiclePeriodsGeneric = async (
    db: AsyncDB,
    vehicleType: string,
    vehicleId: number,
    periods: Array<{ startYM?: string, startDate?: string, endYM?: string, endDate?: string, active?: boolean | number, note?: string }>
) => {
    await ensureVehicleTables(db);
    const vt = (vehicleType || 'rtw').toLowerCase();
    const table = vt === 'nef' ? 'nef_vehicle_periods' : vt === 'itw' ? 'itw_vehicle_periods' : 'rtw_vehicle_periods';
    await db.run(`DELETE FROM ${table} WHERE vehicleId = ?`, [vehicleId]);
    for (const p of (periods || [])) {
        const start = (p.startDate || p.startYM || '').trim();
        if (!start) continue;
        const end = (p.endDate || p.endYM || '').trim() || null;
        const active = (p.active === false || p.active === 0) ? 0 : 1;
        const note = (p.note || '').trim() || null;
        await db.run(
            `INSERT INTO ${table} (vehicleId, startYM, endYM, active, note) VALUES (?, ?, ?, ?, ?)`,
            [vehicleId, start, end, active, note]
        );
    }
};

export const getUniqueDepartments = async (db: AsyncDB) => {
    const rows = await db.all(`
        SELECT DISTINCT department FROM (
            SELECT department FROM personnel
            UNION
            SELECT department FROM personnel_department_periods
            UNION
            SELECT department FROM azubis
        ) WHERE department IS NOT NULL AND department != ''
    `);
    return rows.map((r: any) => r.department);
};

export const addNefVehiclePeriod = async (db: AsyncDB, period: {
    vehicleId: number,
    startYM: string,
    endYM?: string,
    active?: boolean
}) => {
    const endYM = period.endYM && period.endYM.trim() !== '' ? period.endYM : null;
    const active = period.active === false ? 0 : 1;
    await db.run('INSERT INTO nef_vehicle_periods (vehicleId, startYM, endYM, active) VALUES (?, ?, ?, ?)',
        [period.vehicleId, period.startYM, endYM, active]);
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
export const clearSlotAssignments = async (db: AsyncDB, auditUser?: any) => {
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
    }

    if (auditUser) {
        await addAuditLog(db, {
            user_id: auditUser.id || 0,
            user_name: auditUser.name || 'System',
            action_type: 'delete',
            entity_type: 'duty_roster_assignment',
            entity_ref: 'ALL',
            old_value: 'all',
            new_value: '',
            details: 'Alle Slot-Zuweisungen gelöscht'
        });
    }
};

// --- Assign only the slot (type) without overwriting the duty code (value) ---
export const assignSlot = async (db: AsyncDB, entry: { personId: number, personType: string, date: string, slotType: string }, auditUser?: any) => {

    const pName = await getPersonName(db, entry.personId, entry.personType);

    // Wenn slotType leer ist, leere nur das type-Feld (NICHT den ganzen Eintrag löschen - value bleibt erhalten!)
    if (!entry.slotType || entry.slotType === '') {
        if (auditUser) {
            const row = await db.get('SELECT id, type FROM duty_roster WHERE personId = ? AND personType = ? AND date = ?', [entry.personId, entry.personType, entry.date]);
            if (row && row.type !== '') {
                await addAuditLog(db, {
                    user_id: auditUser.id || 0,
                    user_name: auditUser.name || 'System',
                    action_type: 'update',
                    entity_type: 'duty_roster_assignment',
                    entity_ref: `${row.type} (${entry.date})`,
                    old_value: pName,
                    new_value: ''
                });
            }
        }
        await db.run('UPDATE duty_roster SET type = \'\'WHERE personId = ? AND personType = ? AND date = ?', [entry.personId, entry.personType, entry.date]);
        return;
    }

    // Wenn ein neuer Slot zugewiesen wird:
    // 1. War jemand anderes vorher in diesem Slot?
    let otherName = '';
    const others = await db.all(`SELECT id, type, personId, personType FROM duty_roster WHERE date = ? AND type = ? AND (personId != ? OR personType != ?)`, [entry.date, entry.slotType, entry.personId, entry.personType]);
    if (others.length > 0) {
        otherName = await getPersonName(db, others[0].personId, others[0].personType);
    }

    // WICHTIG: Erst alle anderen Personen aus diesem Slot entfernen (verhindert Doppelbelegung)
    await db.run(`UPDATE duty_roster SET type = CASE 
        WHEN type = ? AND (personId != ? OR personType != ?) THEN ''
        ELSE type 
        END 
        WHERE date = ? AND type = ?`,
        [entry.slotType, entry.personId, entry.personType, entry.date, entry.slotType]
    );

    // 2. War diese Person vorher in einem anderen Slot?
    const existingRow = await db.get('SELECT id, type FROM duty_roster WHERE personId = ? AND personType = ? AND date = ?', [entry.personId, entry.personType, entry.date]);

    if (existingRow) {
        if (auditUser && existingRow.type !== entry.slotType) {
            // Log that they left their old slot
            if (existingRow.type !== '') {
                await addAuditLog(db, {
                    user_id: auditUser.id || 0,
                    user_name: auditUser.name || 'System',
                    action_type: 'update',
                    entity_type: 'duty_roster_assignment',
                    entity_ref: `${existingRow.type} (${entry.date})`,
                    old_value: pName,
                    new_value: ''
                });
            }
            // Log that they took the new slot
            await addAuditLog(db, {
                user_id: auditUser.id || 0,
                user_name: auditUser.name || 'System',
                action_type: 'update',
                entity_type: 'duty_roster_assignment',
                entity_ref: `${entry.slotType} (${entry.date})`,
                old_value: otherName,
                new_value: pName
            });
        }
        // Update existing entry
        await db.run('UPDATE duty_roster SET type = ? WHERE personId = ? AND personType = ? AND date = ?', [entry.slotType, entry.personId, entry.personType, entry.date]);
    } else {
        if (auditUser) {
            // Log that they took the new slot
            await addAuditLog(db, {
                user_id: auditUser.id || 0,
                user_name: auditUser.name || 'System',
                action_type: 'create',
                entity_type: 'duty_roster_assignment',
                entity_ref: `${entry.slotType} (${entry.date})`,
                old_value: otherName,
                new_value: pName
            });
        }
        // Insert new entry mit manual_edit = 0
        await db.run('INSERT INTO duty_roster (personId, personType, date, value, type, manual_edit) VALUES (?, ?, ?, ?, ?, 0)', [entry.personId, entry.personType, entry.date, '', entry.slotType]);
    }
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

// --- Shift Transfers (Issue #21) ---
export const getShiftTransfers = async (db: AsyncDB, year?: number, month?: number) => {
    let sql = `
        SELECT st.*, 
               fp.name as from_name, fp.vorname as from_vorname,
               tp.name as to_name, tp.vorname as to_vorname
        FROM shift_transfers st
        LEFT JOIN personnel fp ON st.from_person_id = fp.id
        LEFT JOIN personnel tp ON st.to_person_id = tp.id
    `;
    const params: any[] = [];
    const conditions: string[] = [];

    if (year !== undefined) {
        if (month !== undefined) {
            // Exact month match
            const monthStr = `${year}-${String(month).padStart(2, '0')}`;
            conditions.push(`st.month = ?`);
            params.push(monthStr);
        } else {
            // All months in year
            conditions.push(`st.month LIKE ?`);
            params.push(`${year}-%`);
        }
    }

    if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY st.month DESC, st.created_at DESC';

    return db.all(sql, params);
};

export const addShiftTransfer = async (db: AsyncDB, transfer: any) => {
    const { from_person_id, to_person_id, shift_count, position_type, month, reason } = transfer;
    const result = await db.run(`
        INSERT INTO shift_transfers (from_person_id, to_person_id, shift_count, position_type, month, reason)
        VALUES (?, ?, ?, ?, ?, ?)
    `, [from_person_id, to_person_id, shift_count, position_type, month, reason]);
    return result.lastInsertRowid;
};

export const updateShiftTransfer = async (db: AsyncDB, id: number, transfer: any) => {
    const { from_person_id, to_person_id, shift_count, position_type, month, reason } = transfer;
    await db.run(`
        UPDATE shift_transfers
        SET from_person_id = ?, to_person_id = ?, shift_count = ?, position_type = ?, month = ?, reason = ?
        WHERE id = ?
    `, [from_person_id, to_person_id, shift_count, position_type, month, reason, id]);
};

export const deleteShiftTransfer = async (db: AsyncDB, id: number) => {
    await db.run('DELETE FROM shift_transfers WHERE id = ?', [id]);
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

    console.log(`[getRequiredQualificationsForVehiclePosition] vehicleType=${vehicleType}, vehicleId=${vehicleId}, positionIndex=${positionIndex}`);
    console.log(`[getRequiredQualificationsForVehiclePosition] Gefundene Positionen:`, positions);

    if (positionIndex >= 0 && positionIndex < positions.length) {
        const position = positions[positionIndex];
        console.log(`[getRequiredQualificationsForVehiclePosition] Position[${positionIndex}]:`, position);
        if (position.qualificationName) {
            return [position.qualificationName];
        }
    } else {
        console.log(`[getRequiredQualificationsForVehiclePosition] positionIndex ${positionIndex} außerhalb des gültigen Bereichs (0-${positions.length - 1})`);
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

    console.log(`[getRequiredQualificationsForCellType] cellType=${cellType}`);

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
            console.log(`[getRequiredQualificationsForCellType] Keine ITW-Fahrzeuge gefunden`);
            return { qualifications: [] };
        }
        vehicleNumber = itwVehicles[0].id;
    } else {
        // RTW/NEF format: "rtw1_tag_1" or "nef1_nacht_1"
        const match = cellType.match(/^(rtw|nef)(\d+)_(?:tag|nacht)_(\d+)$/);
        if (!match) {
            console.log(`[getRequiredQualificationsForCellType] cellType passt nicht zum Format`);
            return { qualifications: [] };
        }

        vehicleType = match[1];
        const vehicleIndex = parseInt(match[2]) - 1;
        positionIndex = parseInt(match[3]) - 1;

        console.log(`[getRequiredQualificationsForCellType] Parsed: vehicleType=${vehicleType}, vehicleIndex=${vehicleIndex}, positionIndex=${positionIndex}`);

        // Get the vehicle ID by index
        const tableName = vehicleType === 'rtw' ? 'rtw_vehicles' : 'nef_vehicles';
        const vehicles = await db.all(`SELECT id FROM ${tableName} WHERE archived_year IS NULL ORDER BY sort ASC`);

        console.log(`[getRequiredQualificationsForCellType] Gefundene Fahrzeuge:`, vehicles);

        if (vehicleIndex >= vehicles.length) {
            console.log(`[getRequiredQualificationsForCellType] vehicleIndex ${vehicleIndex} >= vehicles.length ${vehicles.length}`);
            return { qualifications: [] };
        }
        vehicleNumber = vehicles[vehicleIndex].id;
    }

    console.log(`[getRequiredQualificationsForCellType] Rufe getRequiredQualificationsForVehiclePosition auf: vehicleType=${vehicleType}, vehicleNumber=${vehicleNumber}, positionIndex=${positionIndex}`);

    // Get required qualifications from vehicle positions
    const qualifications = await getRequiredQualificationsForVehiclePosition(db, vehicleType, vehicleNumber, positionIndex);

    console.log(`[getRequiredQualificationsForCellType] Qualifikationen:`, qualifications);

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

        console.log(`[validateQualificationForShift] cellType=${cellType}, dynamisch gefundene Qualifikationen:`, requiredQuals);

        // Fallback zu hart codierten Anforderungen wenn keine Positionen konfiguriert
        if (requiredQuals.length === 0 && CELL_TYPE_QUALIFICATION_REQUIREMENTS[cellType]) {
            requiredQuals = CELL_TYPE_QUALIFICATION_REQUIREMENTS[cellType].qualifications;
            console.log(`[validateQualificationForShift] Fallback zu hart codierten Anforderungen:`, requiredQuals);
        }
    } else {
        // Fallback zu alten hart codierten Anforderungen basierend auf shiftValue
        requiredQuals = SHIFT_QUALIFICATION_REQUIREMENTS[shiftValue] || [];
        console.log(`[validateQualificationForShift] shiftValue=${shiftValue}, Anforderungen:`, requiredQuals);
    }

    console.log(`[validateQualificationForShift] Finale requiredQuals:`, requiredQuals);

    if (!requiredQuals || requiredQuals.length === 0) {
        // Keine speziellen Qualifikationen erforderlich
        console.log(`[validateQualificationForShift] Keine Qualifikationen erforderlich -> isValid=true`);
        return result;
    }

    // Lade alle aktiven Qualifikationsperioden der Person für den Monat
    const qualPeriods = await db.all(`
        SELECT * FROM qualification_periods 
        WHERE personId = ? AND active = 1
        AND (startYM <= ? AND (endYM IS NULL OR endYM >= ?))
    `, [personId, yearMonth, yearMonth]);

    console.log(`[validateQualificationForShift] personId=${personId}, yearMonth=${yearMonth}`);
    console.log(`[validateQualificationForShift] Gefundene Qualifikationsperioden:`, qualPeriods);

    // Prüfe jede erforderliche Qualifikation
    for (const requiredQual of requiredQuals) {
        const hasQualification = qualPeriods.some(period => period.qualType === requiredQual);

        console.log(`[validateQualificationForShift] Prüfe Qualifikation "${requiredQual}": ${hasQualification ? 'VORHANDEN' : 'FEHLT'}`);

        if (!hasQualification) {
            result.isValid = false;
            result.missingQualifications.push(requiredQual);
        }
    }

    console.log(`[validateQualificationForShift] Finales Ergebnis:`, result);

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
            { name: 'Rettungsdienst', description: 'Berechtigung zur Teilnahme am Rettungsdienst', category: 'Grundqualifikation', sort: 0, excludeFromStats: false },
            { name: 'RTW Fahrzeugführer', description: 'Fahrzeugführer Rettungswagen', category: 'Fahrzeugführung', sort: 1, excludeFromStats: false },
            { name: 'HLF-B Fahrzeugführer', description: 'Hilfeleistungslöschfahrzeug B', category: 'Fahrzeugführung', sort: 2, excludeFromStats: false },
            { name: 'NEF Assistent', description: 'Notarzteinsatzfahrzeug Assistent', category: 'Notfall', sort: 3, excludeFromStats: false },
            { name: 'ITW Maschinist', description: 'Maschinist Intensivtransportwagen', category: 'Transport', sort: 4, excludeFromStats: false },
            { name: 'ITW Fahrzeugführer', description: 'Fahrzeugführer Intensivtransportwagen', category: 'Fahrzeugführung', sort: 5, excludeFromStats: false },
            { name: 'Ü50', description: 'Über 50 Jahre', category: 'Sonstiges', sort: 6, excludeFromStats: false },
            { name: 'Leitender PAL', description: 'Leitender Praxisanleiter', category: 'Leitung', sort: 7, excludeFromStats: false }
        ];

        for (const qual of defaultQualifications) {
            // Prüfe ob excludeFromStats Spalte existiert
            const cols = await db.all("PRAGMA table_info('qualification_types')");
            const hasExcludeFromStats = cols.some((c: any) => c.name === 'excludeFromStats');

            if (hasExcludeFromStats) {
                await db.run(
                    'INSERT OR IGNORE INTO qualification_types (name, description, category, active, sort, excludeFromStats) VALUES (?, ?, ?, 1, ?, ?)',
                    [qual.name, qual.description, qual.category, qual.sort, qual.excludeFromStats ? 1 : 0]
                );
            } else {
                await db.run(
                    'INSERT OR IGNORE INTO qualification_types (name, description, category, active, sort) VALUES (?, ?, ?, 1, ?)',
                    [qual.name, qual.description, qual.category, qual.sort]
                );
            }
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
            'INSERT OR IGNORE INTO qualification_types (name, description, category, active, sort, excludeFromStats) VALUES (?, ?, ?, ?, ?, ?)',
            [qualType.name.trim(), qualType.description || null, qualType.category || null, qualType.active ? 1 : 0, qualType.sort, qualType.excludeFromStats ? 1 : 0]
        );
    } else {
        // Fallback ohne excludeFromStats (für alte Datenbanken)
        await db.run(
            'INSERT OR IGNORE INTO qualification_types (name, description, category, active, sort) VALUES (?, ?, ?, ?, ?)',
            [qualType.name.trim(), qualType.description || null, qualType.category || null, qualType.active ? 1 : 0, qualType.sort]
        );
    }
};

export const updateQualificationType = async (db: AsyncDB, qualType: QualificationType): Promise<void> => {

    // Validierung: Name ist erforderlich
    if (!qualType.name || qualType.name.trim() === '') {
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

    const yearMonth = date.substring(0, 7); // '2025-11-15' -> '2025-11'
    const results: any[] = [];

    // GRUNDVORAUSSETZUNG: Qualifikation "Rettungsdienst" ist für ALLE Einteilungen erforderlich
    // Hole nur Personen die die Qualifikation "Rettungsdienst" im gegebenen Monat haben
    const personsWithRettungsdienst = await db.all(`
        SELECT DISTINCT 
            p.id, p.name, p.vorname,
            GROUP_CONCAT(qp.qualType) as qualifications,
            0 as isAzubi
        FROM personnel p
        INNER JOIN qualification_periods qp ON p.id = qp.personId
            AND qp.active = 1
            AND qp.qualType = 'Rettungsdienst'
            AND qp.startYM <= ?
            AND (qp.endYM IS NULL OR qp.endYM >= ?)
        WHERE p.active = 1
        GROUP BY p.id, p.name, p.vorname
        ORDER BY p.name, p.vorname
    `, [yearMonth, yearMonth]);

    // Wenn keine positionsspezifischen Qualifikationen erforderlich, return alle mit Rettungsdienst
    if (requiredQuals.length === 0 && !cellRequirements) {
        // Hole alle Qualifikationen für jede Person
        for (const person of personsWithRettungsdienst) {
            const allQuals = await db.all(`
                SELECT qualType FROM qualification_periods 
                WHERE personId = ? AND active = 1 
                AND startYM <= ? AND (endYM IS NULL OR endYM >= ?)
            `, [person.id, yearMonth, yearMonth]);
            person.qualifications = allQuals.map((q: any) => q.qualType);
        }
        return personsWithRettungsdienst;
    }

    // Hole qualifizierte Personen (die bereits Rettungsdienst haben)
    if (requiredQuals.length > 0) {
        // Prüfe für jede Person, ob sie die erforderlichen Qualifikationen hat
        for (const person of personsWithRettungsdienst) {
            const personQuals = await db.all(`
                SELECT qualType FROM qualification_periods 
                WHERE personId = ? AND active = 1 
                AND startYM <= ? AND (endYM IS NULL OR endYM >= ?)
            `, [person.id, yearMonth, yearMonth]);

            const qualNames = personQuals.map((q: any) => q.qualType);

            // Prüfe ob Person mindestens eine der erforderlichen Qualifikationen hat
            if (requiredQuals.some(req => qualNames.includes(req))) {
                results.push({
                    ...person,
                    qualifications: qualNames
                });
            }
        }
    }

    // Füge qualifizierte Azubis hinzu (falls erlaubt)
    // WICHTIG: Azubis benötigen NICHT die Qualifikation "Rettungsdienst"
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
                { positionName: 'Fahrzeugführer', qualificationTypeId: findQualId('RTW Fahrzeugführer'), sort: 0 },
                { positionName: 'Maschinist', qualificationTypeId: null, sort: 1 }
            ];
            break;
        case 'nef':
            positions = [
                { positionName: 'Assistent', qualificationTypeId: findQualId('NEF Assistent'), sort: 0 }
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
    return await db.all('SELECT year, filePath, department FROM year_plannings ORDER BY year ASC, department ASC');
};

const normalizePlanningDepartment = (deptStr: string | null | undefined): string => normalizeDepartment(deptStr);

export const getYearPlanningForYear = async (db: AsyncDB, year: number, department?: string) => {
    // Defensive: Stelle sicher, dass die Tabelle existiert
    await ensureYearPlanningsTable(db);
    if (department) {
        const norm = normalizePlanningDepartment(department);
        const exact = await db.get(
            'SELECT year, filePath, department FROM year_plannings WHERE year = ? AND department = ?',
            [year, norm]
        );
        if (exact) return exact;
        // Legacy: nur Ziffer „2“ statt „2. Abteilung“
        const num = norm.match(/^(\d+)\./)?.[1];
        if (num) {
            return await db.get(
                'SELECT year, filePath, department FROM year_plannings WHERE year = ? AND department = ?',
                [year, num]
            );
        }
        return undefined;
    }
    return await db.get('SELECT year, filePath, department FROM year_plannings WHERE year = ?', [year]);
};

export const saveYearPlannings = async (db: AsyncDB, plannings: { year: number; filePath: string; department?: string }[]) => {
    // Defensive: Stelle sicher, dass die Tabelle existiert
    await ensureYearPlanningsTable(db);

    // Lösche alle bestehenden Einträge
    await db.run('DELETE FROM year_plannings');

    // Füge neue Einträge hinzu
    for (const planning of plannings) {
        if (planning.year && planning.filePath) {
            await db.run(
                'INSERT INTO year_plannings (year, filePath, department) VALUES (?, ?, ?)',
                [planning.year, planning.filePath, planning.department || '1. Abteilung']
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
        await db.exec(`
            CREATE TABLE year_plannings (
                year INTEGER,
                department TEXT DEFAULT '1. Abteilung',
                filePath TEXT NOT NULL,
                PRIMARY KEY (year, department)
            )
        `);
    } else {
        // Prüfe ob Spalte department existiert
        const columns = await db.all("PRAGMA table_info(year_plannings)");
        const hasDept = columns.some((c: any) => c.name === 'department');
        if (!hasDept) {
            // Migration: Neue Tabelle erstellen, Daten kopieren
            await db.exec(`
                CREATE TABLE year_plannings_new (
                    year INTEGER,
                    department TEXT DEFAULT '1. Abteilung',
                    filePath TEXT NOT NULL,
                    PRIMARY KEY (year, department)
                )
            `);
            await db.exec(`
                INSERT INTO year_plannings_new (year, filePath)
                SELECT year, filePath FROM year_plannings
            `);
            await db.exec("DROP TABLE year_plannings");
            await db.exec("ALTER TABLE year_plannings_new RENAME TO year_plannings");
        }
    }
};

// ---- Roster Comments (Issue #22) ----

export const addPersonalComment = async (db: AsyncDB, personId: number, date: string, comment: string, createdBy: string) => {
    await db.run(
        `INSERT INTO roster_comments_personal (person_id, date, comment, created_by, updated_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(person_id, date) DO UPDATE SET comment = excluded.comment, updated_at = CURRENT_TIMESTAMP, created_by = excluded.created_by`,
        [personId, date, comment, createdBy]
    );
};

export const deletePersonalComment = async (db: AsyncDB, personId: number, date: string) => {
    await db.run('DELETE FROM roster_comments_personal WHERE person_id = ? AND date = ?', [personId, date]);
};

export const getPersonalCommentsForMonth = async (db: AsyncDB, year: number, month: number): Promise<any[]> => {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    return db.all(
        `SELECT rcp.*, p.name, p.vorname FROM roster_comments_personal rcp
         LEFT JOIN personnel p ON p.id = rcp.person_id
         WHERE rcp.date LIKE ? ORDER BY rcp.date`,
        [`${prefix}-%`]
    );
};

export const addGlobalComment = async (db: AsyncDB, date: string, comment: string, createdBy: string) => {
    await db.run(
        `INSERT INTO roster_comments_global (date, comment, created_by, updated_at)
         VALUES (?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(date) DO UPDATE SET comment = excluded.comment, updated_at = CURRENT_TIMESTAMP, created_by = excluded.created_by`,
        [date, comment, createdBy]
    );
};

export const deleteGlobalComment = async (db: AsyncDB, date: string) => {
    await db.run('DELETE FROM roster_comments_global WHERE date = ?', [date]);
};

export const getGlobalCommentsForMonth = async (db: AsyncDB, year: number, month: number): Promise<any[]> => {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    return db.all(
        'SELECT * FROM roster_comments_global WHERE date LIKE ? ORDER BY date',
        [`${prefix}-%`]
    );
};

// --- ITW Planning Functions ---
export const getItwPatterns = async (db: AsyncDB, department?: string) => {
    let query = 'SELECT start_date as startDate, pattern, department FROM itw_patterns';
    const params = [];
    if (department && department !== 'all') {
        query += ' WHERE department = ?';
        params.push(normalizeDepartment(department));
    }
    query += ' ORDER BY start_date ASC';
    const rows = await db.all(query, params);
    return rows.map((r: any) => ({ 
        startDate: String(r.startDate), 
        pattern: String(r.pattern),
        department: normalizeDepartment(r.department || '1. Abteilung')
    }));
};

export const setItwPatterns = async (db: AsyncDB, patterns: { startDate: string, pattern: string, department?: string }[]) => {
    await db.run('BEGIN');
    try {
        await db.run('DELETE FROM itw_patterns');
        for (const p of (patterns || [])) {
            if (!p || !p.startDate || !p.pattern) continue;
            const sd = String(p.startDate).trim();
            if (!/\d{4}-\d{2}-\d{2}/.test(sd)) continue;
            const parts = String(p.pattern || '').split(',').map(s => s.trim());
            const norm = (parts.slice(0, 21).concat(Array(21).fill(''))).slice(0, 21).map(v => (v === '1' || v === '2' || v === '3' || v === 'IW') ? v : '');
            await db.run('INSERT INTO itw_patterns (start_date, department, pattern) VALUES (?, ?, ?)', [sd, normalizeDepartment(p.department || '1. Abteilung'), norm.join(',')]);
        }
        await db.run('COMMIT');
    } catch (e) {
        await db.run('ROLLBACK');
        throw e;
    }
};

export const generateItwPlanningsForYear = async (db: AsyncDB, year: number, holidayDates: string[] = []) => {
    // 1. Get all ITW patterns and phase assignments
    const patterns = await getItwPatterns(db); // Alle abteilungen laden
    const assignments = await getItwPhaseAssignments(db);
    const holidaySet = new Set(holidayDates);

    // 2. Clear existing automated ITW entries for the year (manual_edit = 0)
    await db.run(
        "DELETE FROM itw_duty_roster WHERE substr(date, 1, 4) = ? AND manual_edit = 0",
        [String(year)]
    );

    if (patterns.length === 0 || assignments.length === 0) return;

    const dayMs = 24 * 3600 * 1000;

    // 3. Process each assignment
    for (const assignment of assignments) {
        const personId = assignment.person_id;
        
        // Find department of person
        const person = await db.get('SELECT department FROM personnel WHERE id = ?', [personId]);
        const dept = normalizeDepartment(person?.department || '1. Abteilung');
        
        // Filter patterns for this department
        const deptPatterns = patterns.filter(p => normalizeDepartment(p.department) === dept);
        if (deptPatterns.length === 0) continue;
        
        const sortedPatterns = [...deptPatterns].sort((a, b) => a.startDate.localeCompare(b.startDate));
        
        const getPatternForDate = (dateStr: string) => {
            let active = sortedPatterns[0];
            for (const p of sortedPatterns) {
                if (p.startDate <= dateStr) active = p;
                else break;
            }
            return active;
        };

        const normalizePattern = (pStr: string) => {
            return String(pStr).split(',').map(s => s.trim() === 'IW' ? 'IW' : '');
        };

        const aStartStr = assignment.start_date;
        const aStart = new Date(aStartStr + 'T00:00:00Z').getTime();
        const aEnd = aStart + (21 * dayMs);
        
        const yearStart = new Date(`${year}-01-01T00:00:00Z`).getTime();
        const yearEnd = new Date(`${year}-12-31T23:59:59Z`).getTime();
        
        if (aEnd < yearStart || aStart > yearEnd) continue;

        for (let i = 0; i < 21; i++) {
            const currentTime = aStart + (i * dayMs);
            const dateStr = new Date(currentTime).toISOString().slice(0, 10);
            
            if (dateStr.startsWith(String(year))) {
                if (holidaySet.has(dateStr)) continue;

                const activeSeq = getPatternForDate(dateStr);
                const pattern = normalizePattern(activeSeq.pattern);
                if (pattern.length === 0) continue;
                
                const baseTime = new Date(activeSeq.startDate + 'T00:00:00Z').getTime();
                const diffMs = currentTime - baseTime;
                const diffDays = Math.round(diffMs / dayMs);
                
                if (diffDays >= 0) {
                    const patternIndex = ((diffDays % pattern.length) + pattern.length) % pattern.length;
                    if (pattern[patternIndex] === 'IW') {
                        await db.run(
                            `INSERT OR IGNORE INTO itw_duty_roster (personId, personType, date, value, type, manual_edit)
                             VALUES (?, 'person', ?, '1', 'IW', 0)`,
                            [personId, dateStr]
                        );
                    }
                }
            }
        }
    }
};

export const getItwPhaseAssignments = async (db: AsyncDB, startDate?: string) => {
    let query = 'SELECT * FROM itw_phase_assignments';
    const params: any[] = [];
    if (startDate) {
        query += ' WHERE start_date = ?';
        params.push(startDate);
    }
    query += ' ORDER BY start_date, person_id';
    return db.all(query, params);
};

export const addItwPhaseAssignment = async (db: AsyncDB, startDate: string, personId: number, role: string) => {
    await db.run(
        'INSERT OR REPLACE INTO itw_phase_assignments (start_date, person_id, role) VALUES (?, ?, ?)',
        [startDate, personId, role]
    );
};

export const removeItwPhaseAssignment = async (db: AsyncDB, startDate: string, personId: number) => {
    await db.run(
        'DELETE FROM itw_phase_assignments WHERE start_date = ? AND person_id = ?',
        [startDate, personId]
    );
};

export const getItwDutyRoster = async (db: AsyncDB, year: number) => {
    const yearStr = String(year);
    return db.all(
        'SELECT * FROM itw_duty_roster WHERE substr(date, 1, 4) = ? ORDER BY date, personId',
        [yearStr]
    );
};

export const setItwDutyRosterEntry = async (db: AsyncDB, entry: { personId: number; personType?: string; date: string; value: string; type: string; manual_edit?: number }) => {
    const personType = entry.personType || 'person';
    if (!entry.value && !entry.type) {
        await db.run(
            `DELETE FROM itw_duty_roster WHERE personId = ? AND personType = ? AND date = ?`,
            [entry.personId, personType, entry.date]
        );
    } else {
        await db.run(
            `INSERT OR REPLACE INTO itw_duty_roster (personId, personType, date, value, type, manual_edit)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [entry.personId, personType, entry.date, entry.value, entry.type, entry.manual_edit || 0]
        );
    }
};

// --- Guests Management ---
export const getGuestsForDate = async (db: AsyncDB, date: string) => {
    return await db.all('SELECT * FROM guests WHERE date = ? OR (end_date IS NOT NULL AND end_date != \'\' AND date <= ? AND ? <= end_date) ORDER BY id ASC', [date, date, date]);
};

export const addGuest = async (db: AsyncDB, guest: { name: string, date: string, end_date?: string, endDate?: string, remark?: string }) => {
    const end = guest.end_date || guest.endDate || null;
    return await db.run(
        'INSERT INTO guests (name, date, end_date, remark) VALUES (?, ?, ?, ?)',
        [guest.name, guest.date, end, guest.remark || '']
    );
};

export const getAllGuests = async (db: AsyncDB) => {
    return await db.all('SELECT * FROM guests ORDER BY date DESC, id DESC');
};

export const deleteGuest = async (db: AsyncDB, id: number) => {
    await db.run('DELETE FROM guests WHERE id = ?', [id]);
};

