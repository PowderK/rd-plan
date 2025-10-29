import { Database, open } from 'sqlite';
import sqlite3 from 'sqlite3';
import path from 'path';
import { app } from 'electron';

export const initializeDatabase = async () => {
    // Use Electron's userData folder to store the DB so the path is stable
    const userDataPath = app.getPath ? app.getPath('userData') : process.cwd();
    const dbFile = path.join(userDataPath, 'rd-plan.db');
    console.log('[DB] initializeDatabase using DB file:', dbFile);
    const db = await open({
        filename: dbFile,
        driver: sqlite3.Database
    });

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
    async function fixDutyRosterUniqueConstraint(db: Database) {
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

    return db;
};

export const getShifts = async (db: Database) => {
    return await db.all('SELECT * FROM shifts');
};

export const addShift = async (db: Database, shift: any) => {
    const { date, shiftType, personnel } = shift;
    await db.run('INSERT INTO shifts (date, shiftType, personnel) VALUES (?, ?, ?)', [date, shiftType, personnel]);
};

export const updateShift = async (db: Database, shift: any) => {
    const { id, date, shiftType, personnel } = shift;
    await db.run('UPDATE shifts SET date = ?, shiftType = ?, personnel = ? WHERE id = ?', [date, shiftType, personnel, id]);
};

export const deleteShift = async (db: Database, id: number) => {
    await db.run('DELETE FROM shifts WHERE id = ?', [id]);
};

export const getPersonnel = async (db: Database) => {
    return await db.all('SELECT * FROM personnel ORDER BY sort ASC, id ASC');
};

export const addPersonnel = async (db: Database, person: any) => {
    const { name, vorname, teilzeit, fahrzeugfuehrer, fahrzeugfuehrerHLFB, nef, itwMaschinist, itwFahrzeugfuehrer, sort } = person;
    await db.run('INSERT INTO personnel (name, vorname, teilzeit, fahrzeugfuehrer, fahrzeugfuehrerHLFB, nef, itwMaschinist, itwFahrzeugfuehrer, sort) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [name, vorname, teilzeit, fahrzeugfuehrer ? 1 : 0, fahrzeugfuehrerHLFB ? 1 : 0, nef ? 1 : 0, itwMaschinist ? 1 : 0, itwFahrzeugfuehrer ? 1 : 0, sort ?? 0]);
};

export const updatePersonnel = async (db: Database, person: any) => {
    const { id, name, vorname, teilzeit, fahrzeugfuehrer, fahrzeugfuehrerHLFB, nef, itwMaschinist, itwFahrzeugfuehrer, sort } = person;
    await db.run('UPDATE personnel SET name = ?, vorname = ?, teilzeit = ?, fahrzeugfuehrer = ?, fahrzeugfuehrerHLFB = ?, nef = ?, itwMaschinist = ?, itwFahrzeugfuehrer = ?, sort = ? WHERE id = ?', [name, vorname, teilzeit, fahrzeugfuehrer ? 1 : 0, fahrzeugfuehrerHLFB ? 1 : 0, nef ? 1 : 0, itwMaschinist ? 1 : 0, itwFahrzeugfuehrer ? 1 : 0, sort ?? 0, id]);
};

export const deletePersonnel = async (db: Database, id: number) => {
    await db.run('DELETE FROM personnel WHERE id = ?', [id]);
};

export const updatePersonnelOrder = async (db: Database, order: number[]) => {
    for (let i = 0; i < order.length; i++) {
        await db.run('UPDATE personnel SET sort = ? WHERE id = ?', [i, order[i]]);
    }
};

export const getSetting = async (db: Database, key: string) => {
    const row = await db.get('SELECT value FROM settings WHERE key = ?', [key]);
    return row ? row.value : null;
};

export const setSetting = async (db: Database, key: string, value: string) => {
    await db.run(`
        INSERT INTO settings (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `, [key, value]);
};

export const getShiftTypes = async (db: Database) => {
    return await db.all('SELECT * FROM shift_types ORDER BY code ASC');
};

export const addShiftType = async (db: Database, type: { code: string, description: string }) => {
    await db.run('INSERT INTO shift_types (code, description) VALUES (?, ?)', [type.code, type.description]);
};

export const updateShiftType = async (db: Database, type: { id: number, code: string, description: string }) => {
    await db.run('UPDATE shift_types SET code = ?, description = ? WHERE id = ?', [type.code, type.description, type.id]);
};

export const deleteShiftType = async (db: Database, id: number) => {
    await db.run('DELETE FROM shift_types WHERE id = ?', [id]);
};

export const getDutyRoster = async (db: Database, year: number) => {
    const start = `${year}-01-01`;
    const end = `${year}-12-31`;
    console.log(`[DB] getDutyRoster year=${year} start=${start} end=${end}`);
    const rows = await db.all('SELECT * FROM duty_roster WHERE date BETWEEN ? AND ?', [start, end]);
    console.log('[DB] getDutyRoster returned rows=', Array.isArray(rows) ? rows.length : typeof rows);
    return rows;
};

export const setDutyRosterEntry = async (db: Database, entry: { personId: number, personType: string, date: string, value: string, type: string }) => {
    await db.run(`
        INSERT INTO duty_roster (personId, personType, date, value, type) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(personId, personType, date) DO UPDATE SET value = excluded.value, type = excluded.type
    `, [entry.personId, entry.personType, entry.date, entry.value, entry.type]);
    console.log(`[DB] [${new Date().toISOString()}] setDutyRosterEntry successful`, entry);
    try {
        const saved = await db.get('SELECT * FROM duty_roster WHERE personId = ? AND personType = ? AND date = ?', [entry.personId, entry.personType, entry.date]);
        console.log('[DB] Verified duty_roster row after upsert:', saved);
    } catch (e) {
        console.error('[DB] Fehler beim Verifizieren des duty_roster Eintrags', e);
    }
};

export const getAzubiList = async (db: Database) => {
    return await db.all('SELECT * FROM azubis ORDER BY sort ASC, id ASC');
};

export const getAzubi = async (db: Database, id: number) => {
    return await db.get('SELECT * FROM azubis WHERE id = ?', [id]);
};

export const addAzubi = async (db: Database, azubi: { name: string, vorname: string, lehrjahr: number }) => {
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

export const updateAzubi = async (db: Database, azubi: { id: number, name: string, vorname: string, lehrjahr: number }) => {
    await db.run('UPDATE azubis SET name = ?, vorname = ?, lehrjahr = ? WHERE id = ?', [azubi.name, azubi.vorname, azubi.lehrjahr, azubi.id]);
};

export const deleteAzubi = async (db: Database, id: number) => {
    await db.run('DELETE FROM azubis WHERE id = ?', [id]);
};

export const updateAzubiOrder = async (db: Database, order: number[]) => {
    for (let i = 0; i < order.length; i++) {
        await db.run('UPDATE azubis SET sort = ? WHERE id = ?', [i, order[i]]);
    }
};

// --- ITW Doctors CRUD ---
export const getItwDoctors = async (db: Database) => {
    return await db.all('SELECT * FROM itw_doctors ORDER BY sort ASC, id ASC');
};

export const addItwDoctor = async (db: Database, doc: { name: string, vorname: string }) => {
    try {
        const row: any = await db.get('SELECT MAX(sort) as m FROM itw_doctors');
        const next = (row && typeof row.m === 'number') ? row.m + 1 : 0;
        await db.run('INSERT INTO itw_doctors (name, vorname, sort) VALUES (?, ?, ?)', [doc.name, doc.vorname, next]);
    } catch (e) {
        await db.run('INSERT INTO itw_doctors (name, vorname) VALUES (?, ?)', [doc.name, doc.vorname]);
    }
};

export const updateItwDoctor = async (db: Database, doc: { id: number, name: string, vorname: string }) => {
    await db.run('UPDATE itw_doctors SET name = ?, vorname = ? WHERE id = ?', [doc.name, doc.vorname, doc.id]);
};

export const deleteItwDoctor = async (db: Database, id: number) => {
    await db.run('DELETE FROM itw_doctors WHERE id = ?', [id]);
};

export const updateItwDoctorOrder = async (db: Database, order: number[]) => {
    for (let i = 0; i < order.length; i++) {
        await db.run('UPDATE itw_doctors SET sort = ? WHERE id = ?', [i, order[i]]);
    }
};

// --- Utility: Clear previous slot assignments while keeping duty codes ---
export const clearSlotAssignments = async (db: Database) => {
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
export const assignSlot = async (db: Database, entry: { personId: number, personType: string, date: string, slotType: string }) => {
    // Prüfe, ob Zeile existiert
    const row = await db.get('SELECT id FROM duty_roster WHERE personId = ? AND personType = ? AND date = ?', [entry.personId, entry.personType, entry.date]);
    if (row) {
        await db.run('UPDATE duty_roster SET type = ? WHERE personId = ? AND personType = ? AND date = ?', [entry.slotType, entry.personId, entry.personType, entry.date]);
    } else {
        await db.run('INSERT INTO duty_roster (personId, personType, date, value, type) VALUES (?, ?, ?, ?, ?)', [entry.personId, entry.personType, entry.date, '', entry.slotType]);
    }
    console.log('[DB] assignSlot ok', entry);
};