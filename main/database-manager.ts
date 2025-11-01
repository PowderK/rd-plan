import { app } from 'electron';
import path from 'path';
import { AsyncDB, initializeDatabase as initSQLiteDatabase } from './database';

export type DatabaseMode = 'sqlite' | 'central-sqlite';

export interface DatabaseConfig {
  mode: DatabaseMode;
  multiUser?: boolean;
  centralPath?: string;
}

export interface DatabaseAdapter {
  getPersonnel(): Promise<any[]>;
  addPersonnel(person: any): Promise<void>;
  updatePersonnel(person: any): Promise<void>;
  deletePersonnel(id: number): Promise<void>;
  updatePersonnelOrder(order: number[]): Promise<void>;
  
  getDutyRoster(year: number): Promise<any[]>;
  setDutyRosterEntry(entry: any): Promise<void>;
  bulkSetDutyRosterEntries(entries: any[]): Promise<number>;
  
  getAzubiList(): Promise<any[]>;
  addAzubi(azubi: any): Promise<void>;
  updateAzubi(azubi: any): Promise<void>;
  deleteAzubi(id: number): Promise<void>;
  updateAzubiOrder(order: number[]): Promise<void>;
  
  getItwDoctors(): Promise<any[]>;
  addItwDoctor(doc: any): Promise<void>;
  updateItwDoctor(doc: any): Promise<void>;
  deleteItwDoctor(id: number): Promise<void>;
  updateItwDoctorOrder(order: number[]): Promise<void>;
  
  getRtwVehicles(year?: number): Promise<any[]>;
  addRtwVehicle(v: { name: string }): Promise<void>;
  updateRtwVehicle(v: { id: number, name: string }): Promise<void>;
  deleteRtwVehicle(id: number, currentYear?: number): Promise<void>;
  updateRtwVehicleOrder(order: number[]): Promise<void>;
  getNefVehicles(year?: number): Promise<any[]>;
  addNefVehicle(v: { name: string, occupancyMode?: '24h' | 'tag' }): Promise<void>;
  updateNefVehicle(v: { id: number, name: string, occupancyMode?: '24h' | 'tag' }): Promise<void>;
  deleteNefVehicle(id: number, currentYear?: number): Promise<void>;
  updateNefVehicleOrder(order: number[]): Promise<void>;
  getRtwVehicleActivations(year: number): Promise<any[]>;
  setRtwVehicleActivation(vehicleId: number, year: number, month: number, enabled: boolean): Promise<void>;
  getNefVehicleActivations(year: number): Promise<any[]>;
  setNefVehicleActivation(vehicleId: number, year: number, month: number, enabled: boolean): Promise<void>;
  setNefOccupancyMode(id: number, mode: '24h' | 'tag'): Promise<void>;
  
  getHolidaysForYear(year: number): Promise<any[]>;
  setHolidaysForYear(year: number, dates: any[]): Promise<void>;
  addHoliday(date: string, name?: string): Promise<void>;
  deleteHoliday(date: string): Promise<void>;
  
  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;
  
  getShiftTypes(): Promise<any[]>;
  addShiftType(type: any): Promise<void>;
  updateShiftType(type: any): Promise<void>;
  deleteShiftType(id: number): Promise<void>;
  
  // Roster Import
  importDutyRoster(filePath: string, year: number, month?: number, options?: { mappings?: Record<string, number> }): Promise<{success: boolean, message: string, importedCount: number}>;

  // Excel Import/Export für Personal
  importPersonnelFromExcel(filePath: string, replaceExisting: boolean): Promise<any>;
  exportPersonnelToExcel(filePath: string): Promise<void>;
  createPersonnelTemplate(filePath: string): Promise<void>;
  
  // Settings Import/Export
  importSettingsFromJson(filePath: string, replaceExisting: boolean): Promise<any>;
  exportSettingsToJson(filePath: string): Promise<void>;
  exportSettingsToExcel(filePath: string): Promise<void>;
  createSettingsTemplate(filePath: string): Promise<void>;
  
  clearDutyRosterForYear(year: number): Promise<void>;
  clearDutyRosterForMonth(year: number, month: number): Promise<void>;
  clearSlotAssignments(): Promise<void>;
  assignSlot(entry: { personId: number, personType: string, date: string, slotType: string }): Promise<void>;
  
  getItwPatterns(): Promise<any[]>;
  setItwPatterns(patterns: any[]): Promise<void>;
  getDeptPatterns(): Promise<any[]>;
  setDeptPatterns(patterns: any[]): Promise<void>;
  
  // Excel Import/Export
  importPersonnelFromExcel(filePath: string, replaceExisting?: boolean): Promise<any>;
  exportPersonnelToExcel(filePath: string): Promise<void>;
  createPersonnelTemplate(filePath: string): Promise<void>;
  
  close(): Promise<void>;
}

class SQLiteAdapter implements DatabaseAdapter {
  constructor(private db: AsyncDB) {}
  
  async getPersonnel() {
    const { getPersonnel } = await import('./database');
    return getPersonnel(this.db);
  }
  
  async addPersonnel(person: any) {
    const { addPersonnel } = await import('./database');
    return addPersonnel(this.db, person);
  }
  
  async updatePersonnel(person: any) {
    const { updatePersonnel } = await import('./database');
    return updatePersonnel(this.db, person);
  }
  
  async deletePersonnel(id: number) {
    const { deletePersonnel } = await import('./database');
    return deletePersonnel(this.db, id);
  }
  
  async updatePersonnelOrder(order: number[]) {
    const { updatePersonnelOrder } = await import('./database');
    return updatePersonnelOrder(this.db, order);
  }
  
  async getDutyRoster(year: number) {
    const { getDutyRoster } = await import('./database');
    return getDutyRoster(this.db, year);
  }
  
  async setDutyRosterEntry(entry: any) {
    const { setDutyRosterEntry } = await import('./database');
    return setDutyRosterEntry(this.db, entry);
  }
  
  async bulkSetDutyRosterEntries(entries: any[]) {
    const { bulkSetDutyRosterEntries } = await import('./database');
    return bulkSetDutyRosterEntries(this.db, entries);
  }
  
  async getAzubiList() {
    const { getAzubiList } = await import('./database');
    return getAzubiList(this.db);
  }
  
  async addAzubi(azubi: any) {
    const { addAzubi } = await import('./database');
    return addAzubi(this.db, azubi);
  }
  
  async updateAzubi(azubi: any) {
    const { updateAzubi } = await import('./database');
    return updateAzubi(this.db, azubi);
  }
  
  async deleteAzubi(id: number) {
    const { deleteAzubi } = await import('./database');
    return deleteAzubi(this.db, id);
  }
  
  async updateAzubiOrder(order: number[]) {
    const { updateAzubiOrder } = await import('./database');
    return updateAzubiOrder(this.db, order);
  }
  
  async getItwDoctors() {
    const { getItwDoctors } = await import('./database');
    return getItwDoctors(this.db);
  }
  
  async addItwDoctor(doc: any) {
    const { addItwDoctor } = await import('./database');
    return addItwDoctor(this.db, doc);
  }
  
  async updateItwDoctor(doc: any) {
    const { updateItwDoctor } = await import('./database');
    return updateItwDoctor(this.db, doc);
  }
  
  async deleteItwDoctor(id: number) {
    const { deleteItwDoctor } = await import('./database');
    return deleteItwDoctor(this.db, id);
  }
  
  async updateItwDoctorOrder(order: number[]) {
    const { updateItwDoctorOrder } = await import('./database');
    return updateItwDoctorOrder(this.db, order);
  }
  
  async getRtwVehicles(year?: number) {
    const { getRtwVehicles } = await import('./database');
    return getRtwVehicles(this.db, year);
  }
  
  async addRtwVehicle(v: { name: string }) {
    const { addRtwVehicle } = await import('./database');
    return addRtwVehicle(this.db, v);
  }
  
  async updateRtwVehicle(v: { id: number, name: string }) {
    const { updateRtwVehicle } = await import('./database');
    return updateRtwVehicle(this.db, v);
  }
  
  async deleteRtwVehicle(id: number, currentYear?: number) {
    const { deleteRtwVehicle } = await import('./database');
    return deleteRtwVehicle(this.db, id, currentYear);
  }
  
  async updateRtwVehicleOrder(order: number[]) {
    const { updateRtwVehicleOrder } = await import('./database');
    return updateRtwVehicleOrder(this.db, order);
  }
  
  async getNefVehicles(year?: number) {
    const { getNefVehicles } = await import('./database');
    return getNefVehicles(this.db, year);
  }
  
  async addNefVehicle(v: { name: string, occupancyMode?: '24h' | 'tag' }) {
    const { addNefVehicle } = await import('./database');
    return addNefVehicle(this.db, v);
  }
  
  async updateNefVehicle(v: { id: number, name: string, occupancyMode?: '24h' | 'tag' }) {
    const { updateNefVehicle } = await import('./database');
    return updateNefVehicle(this.db, v);
  }
  
  async deleteNefVehicle(id: number, currentYear?: number) {
    const { deleteNefVehicle } = await import('./database');
    return deleteNefVehicle(this.db, id, currentYear);
  }
  
  async updateNefVehicleOrder(order: number[]) {
    const { updateNefVehicleOrder } = await import('./database');
    return updateNefVehicleOrder(this.db, order);
  }
  
  async getRtwVehicleActivations(year: number) {
    const { getRtwVehicleActivations } = await import('./database');
    return getRtwVehicleActivations(this.db, year);
  }
  
  async setRtwVehicleActivation(vehicleId: number, year: number, month: number, enabled: boolean) {
    const { setRtwVehicleActivation } = await import('./database');
    return setRtwVehicleActivation(this.db, vehicleId, year, month, enabled);
  }
  
  async getNefVehicleActivations(year: number) {
    const { getNefVehicleActivations } = await import('./database');
    return getNefVehicleActivations(this.db, year);
  }
  
  async setNefVehicleActivation(vehicleId: number, year: number, month: number, enabled: boolean) {
    const { setNefVehicleActivation } = await import('./database');
    return setNefVehicleActivation(this.db, vehicleId, year, month, enabled);
  }
  
  async setNefOccupancyMode(id: number, mode: '24h'|'tag') {
    const { setNefOccupancyMode } = await import('./database');
    return setNefOccupancyMode(this.db, id, mode);
  }
  
  async getHolidaysForYear(year: number) {
    const { getHolidaysForYear } = await import('./database');
    return getHolidaysForYear(this.db, year);
  }
  
  async setHolidaysForYear(year: number, dates: any[]) {
    const { setHolidaysForYear } = await import('./database');
    return setHolidaysForYear(this.db, year, dates);
  }
  
  async addHoliday(date: string, name?: string) {
    const { addHoliday } = await import('./database');
    return addHoliday(this.db, date, name ?? '');
  }
  
  async deleteHoliday(date: string) {
    const { deleteHoliday } = await import('./database');
    return deleteHoliday(this.db, date);
  }
  
  async getSetting(key: string) {
    const { getSetting } = await import('./database');
    return getSetting(this.db, key);
  }
  
  async setSetting(key: string, value: string) {
    const { setSetting } = await import('./database');
    return setSetting(this.db, key, value);
  }
  
  async getShiftTypes() {
    const { getShiftTypes } = await import('./database');
    return getShiftTypes(this.db);
  }
  
  async addShiftType(type: any) {
    const { addShiftType } = await import('./database');
    return addShiftType(this.db, type);
  }
  
  async updateShiftType(type: any) {
    const { updateShiftType } = await import('./database');
    return updateShiftType(this.db, type);
  }
  
  async deleteShiftType(id: number) {
    const { deleteShiftType } = await import('./database');
    return deleteShiftType(this.db, id);
  }
  
  async clearDutyRosterForYear(year: number) {
    const { clearDutyRosterForYear } = await import('./database');
    return clearDutyRosterForYear(this.db, year);
  }
  
  async clearDutyRosterForMonth(year: number, month: number) {
    const { clearDutyRosterForMonth } = await import('./database');
    return clearDutyRosterForMonth(this.db, year, month);
  }
  
  async clearSlotAssignments() {
    const { clearSlotAssignments } = await import('./database');
    return clearSlotAssignments(this.db);
  }
  
  async assignSlot(entry: { personId: number, personType: string, date: string, slotType: string }) {
    const { assignSlot } = await import('./database');
    return assignSlot(this.db, entry);
  }
  
  async getItwPatterns() {
    const { getItwPatterns } = await import('./database');
    return getItwPatterns(this.db);
  }
  
  async setItwPatterns(patterns: any[]) {
    const { setItwPatterns } = await import('./database');
    return setItwPatterns(this.db, patterns);
  }
  
  async getDeptPatterns() {
    const { getDeptPatterns } = await import('./database');
    return getDeptPatterns(this.db);
  }
  
  async setDeptPatterns(patterns: any[]) {
    const { setDeptPatterns } = await import('./database');
    return setDeptPatterns(this.db, patterns);
  }
  
  async importPersonnelFromExcel(filePath: string, replaceExisting = false) {
    const { ExcelPersonnelImporter } = await import('./excel-importer');
    const importer = new ExcelPersonnelImporter(this.db);
    const data = importer.parseExcelFile(filePath);
    return await importer.importPersonnelData(data, replaceExisting);
  }
  
  async exportPersonnelToExcel(filePath: string) {
    const { ExcelPersonnelImporter } = await import('./excel-importer');
    const importer = new ExcelPersonnelImporter(this.db);
    return await importer.exportToExcel(filePath);
  }
  
  async createPersonnelTemplate(filePath: string) {
    const { ExcelPersonnelImporter } = await import('./excel-importer');
    ExcelPersonnelImporter.createTemplate(filePath);
  }

  async importDutyRoster(filePath: string, year: number, month?: number, options?: { mappings?: Record<string, number> }): Promise<{success: boolean, message: string, importedCount: number}> {
    const { RosterImporter } = await import('./roster-importer');
    const importer = new RosterImporter(this);
    return importer.importDutyRoster(filePath, year, month, options);
  }
  
  // Settings Import/Export Methoden
  async importSettingsFromJson(filePath: string, replaceExisting: boolean) {
    const { SettingsImporter } = await import('./settings-importer');
    const importer = new SettingsImporter(this.db);
    return await importer.importSettingsFromJson(filePath, replaceExisting);
  }
  
  async exportSettingsToJson(filePath: string) {
    const { SettingsImporter } = await import('./settings-importer');
    const importer = new SettingsImporter(this.db);
    return await importer.exportSettingsToJson(filePath);
  }
  
  async exportSettingsToExcel(filePath: string) {
    const { SettingsImporter } = await import('./settings-importer');
    const importer = new SettingsImporter(this.db);
    return await importer.exportSettingsToExcel(filePath);
  }
  
  async createSettingsTemplate(filePath: string) {
    const { SettingsImporter } = await import('./settings-importer');
    const importer = new SettingsImporter(this.db);
    return await importer.createSettingsTemplate(filePath);
  }
  
  async close() {
    // SQLite database is closed automatically
  }
}

export class DatabaseManager {
  private adapter?: DatabaseAdapter;
  private config: DatabaseConfig;
  private currentDbPath?: string;
  
  constructor(config: DatabaseConfig) {
    this.config = config;
  }
  
  async initialize(): Promise<DatabaseAdapter> {
    console.log('[DatabaseManager] Initializing database with mode:', this.config.mode);
    return this.initializeSQLite();
  }
  
  private async initializeSQLite(): Promise<DatabaseAdapter> {
    console.log('[DatabaseManager] Starting SQLite database');
    
  let dbPath: string;
    
    if (this.config.mode === 'central-sqlite' && this.config.centralPath) {
      // Use central path for multi-user scenarios
      dbPath = this.config.centralPath;
      console.log('[DatabaseManager] Using central SQLite database at:', dbPath);
    } else {
      // Use DB folder in the application root (portable builds or installed app)
      // Determine app root from the executable path and place DB in <appRoot>/DB/rd-plan.db
      try {
        const exePath = app.getPath ? app.getPath('exe') : process.execPath;
        const appRoot = path.dirname(exePath);
        const dbDir = path.join(appRoot, 'DB');
        // Ensure directory exists
        try { require('fs').mkdirSync(dbDir, { recursive: true }); } catch (e) { /* ignore */ }
        dbPath = path.join(dbDir, 'rd-plan.db');
        console.log('[DatabaseManager] Using local SQLite database at (app root DB):', dbPath);
      } catch (e) {
        // Fallback to userData if any error occurs
        const userDataPath = app.getPath('userData');
        dbPath = path.join(userDataPath, 'rd-plan.db');
        console.log('[DatabaseManager] Fallback: Using local SQLite database at userData:', dbPath);
      }
    }
    
    const db = await this.initializeSQLiteWithPath(dbPath);
    this.currentDbPath = dbPath;
    this.adapter = new SQLiteAdapter(db);
    return this.adapter;
  }
  
  private async initializeSQLiteWithPath(dbPath: string): Promise<AsyncDB> {
    // Import BetterSqlite3 dynamically to create a custom AsyncDB with specific path
    const BetterSqlite3 = (await import('better-sqlite3')).default;
    const raw = new BetterSqlite3(dbPath);
    
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
        prepare: async (sql: string) => {
            const stmt = raw.prepare(sql);
            return {
                run: async (...params: any[]) => stmt.run(...params),
                get: async <T = any>(...params: any[]) => stmt.get(...params) as T | undefined,
                all: async <T = any>(...params: any[]) => stmt.all(...params) as T[],
                finalize: async () => { /* no-op for better-sqlite3 */ },
            };
        },
    };

    // Initialize database schema (copied from existing database.ts)
    await this.initializeSQLiteSchema(db);
    
    return db;
  }
  
  private async initializeSQLiteSchema(db: AsyncDB) {
    await db.exec(`
        CREATE TABLE IF NOT EXISTS shifts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            shiftType TEXT NOT NULL,
            personnel TEXT NOT NULL
        );
        
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
        );
        
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        
        CREATE TABLE IF NOT EXISTS holidays (
            date TEXT PRIMARY KEY,
            name TEXT NOT NULL DEFAULT ''
        );
        
        CREATE TABLE IF NOT EXISTS itw_patterns (
            start_date TEXT PRIMARY KEY,
            pattern TEXT NOT NULL
        );
        
        CREATE TABLE IF NOT EXISTS dept_patterns (
            start_date TEXT PRIMARY KEY,
            pattern TEXT NOT NULL
        );
        
        CREATE TABLE IF NOT EXISTS shift_types (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT NOT NULL UNIQUE,
            description TEXT NOT NULL
        );
        
        CREATE TABLE IF NOT EXISTS duty_roster (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            personId INTEGER NOT NULL,
            personType TEXT NOT NULL DEFAULT 'person',
            date TEXT NOT NULL,
            value TEXT NOT NULL,
            type TEXT NOT NULL,
            UNIQUE(personId, personType, date)
        );
        
        CREATE TABLE IF NOT EXISTS azubis (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            vorname TEXT NOT NULL,
            lehrjahr INTEGER NOT NULL,
            sort INTEGER NOT NULL DEFAULT 0
        );
        
        CREATE TABLE IF NOT EXISTS itw_doctors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            vorname TEXT NOT NULL,
            sort INTEGER NOT NULL DEFAULT 0
        );
        
        CREATE TABLE IF NOT EXISTS rtw_vehicles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            sort INTEGER NOT NULL DEFAULT 0,
            archived_year INTEGER
        );
        
        CREATE TABLE IF NOT EXISTS nef_vehicles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            sort INTEGER NOT NULL DEFAULT 0,
            archived_year INTEGER,
            occupancy_mode TEXT NOT NULL DEFAULT '24h'
        );
        
        CREATE TABLE IF NOT EXISTS rtw_vehicle_months (
            vehicleId INTEGER NOT NULL,
            year INTEGER NOT NULL,
            month INTEGER NOT NULL,
            enabled INTEGER NOT NULL DEFAULT 1,
            PRIMARY KEY(vehicleId, year, month)
        );
        
        CREATE TABLE IF NOT EXISTS nef_vehicle_months (
            vehicleId INTEGER NOT NULL,
            year INTEGER NOT NULL,
            month INTEGER NOT NULL,
            enabled INTEGER NOT NULL DEFAULT 1,
            PRIMARY KEY(vehicleId, year, month)
        );
    `);
    
    console.log('[DatabaseManager] SQLite schema initialized');
  }
  
  getAdapter(): DatabaseAdapter {
    if (!this.adapter) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.adapter;
  }
  
  getConfig(): DatabaseConfig {
    return this.config;
  }
  
  async close() {
    if (this.adapter) {
      await this.adapter.close();
    }
  }

  /**
   * Creates a timestamped backup of the current SQLite database next to the DB location.
   * Returns the directory path containing the backup.
   */
  async createBackup(opts?: { year?: number; month?: number; label?: string }): Promise<string> {
    if (!this.currentDbPath) throw new Error('Database path unknown');
    const fs = await import('fs');
    const dir = path.dirname(this.currentDbPath);
    // If DB is in <appRoot>/DB, put backups in <appRoot>/backups/<ts>; otherwise dir/backups/<ts>
    const parent = path.basename(dir).toLowerCase() === 'db' ? path.join(dir, '..') : dir;
    const now = new Date();
    const y = opts?.year ?? now.getFullYear();
    const yStr = String(y);
    // Unterscheide: Monatsbackup vs. Jahresbackup (ALL)
    let folderYM: string;
    if (opts?.month != null) {
      const m1 = (opts.month) + 1; // month index is 0-based in callers, store as 1-12
      const mStr = String(m1).padStart(2, '0');
      folderYM = `${yStr}-${mStr}`;
    } else {
      folderYM = `${yStr}-ALL`;
    }
    const ts = now.toISOString().replace(/[-:T]/g, '').slice(0, 15); // YYYYMMDDHHMMSS
    // Create short auto label if not provided
    const autoLabel = opts?.month != null ? `preimport-${folderYM}` : `preimport-${yStr}`;
    const rawLabel = (opts?.label || autoLabel).toLowerCase();
    const label = rawLabel.replace(/[^a-z0-9-_]/g, '').slice(0, 40);
    // Structure: backups/<YYYY>/<YYYY-MM|YYYY-ALL>/<YYYYMMDDHHMMSS>-<label>
    const backupDir = path.join(parent, 'backups', yStr, folderYM, `${ts}-${label}`);
    try { fs.mkdirSync(backupDir, { recursive: true }); } catch {}
    const target = path.join(backupDir, 'rd-plan.db');
    fs.copyFileSync(this.currentDbPath, target);
    console.log('[DatabaseManager] Backup erstellt:', target);
    try { fs.writeFileSync(path.join(backupDir, 'label.txt'), label, 'utf-8'); } catch {}
    return backupDir;
  }

  private getBackupRoot(): string {
    if (!this.currentDbPath) throw new Error('Database path unknown');
    const dir = path.dirname(this.currentDbPath);
    const parent = path.basename(dir).toLowerCase() === 'db' ? path.join(dir, '..') : dir;
    return path.join(parent, 'backups');
  }

  async listBackups(limit = 50): Promise<Array<{ path: string; year: string; ym: string; timestamp: string; label: string }>> {
    const fs = await import('fs');
    const root = this.getBackupRoot();
    const items: Array<{ path: string; year: string; ym: string; timestamp: string; label: string }> = [];
    if (!fs.existsSync(root)) return items;
    for (const y of (fs.readdirSync(root) || []).sort().reverse()) {
      const yDir = path.join(root, y);
      if (!fs.lstatSync(yDir).isDirectory()) continue;
      for (const ym of (fs.readdirSync(yDir) || []).sort().reverse()) {
        const ymDir = path.join(yDir, ym);
        if (!fs.lstatSync(ymDir).isDirectory()) continue;
        for (const tsLab of (fs.readdirSync(ymDir) || []).sort().reverse()) {
          const dir = path.join(ymDir, tsLab);
          if (!fs.lstatSync(dir).isDirectory()) continue;
          const dbp = path.join(dir, 'rd-plan.db');
          if (!fs.existsSync(dbp)) continue;
          const m = tsLab.match(/^(\d{8,14})(?:[-_](.+))?$/);
          const timestamp = m ? m[1] : tsLab;
          const label = (m && m[2]) ? m[2] : (fs.existsSync(path.join(dir, 'label.txt')) ? (fs.readFileSync(path.join(dir, 'label.txt'), 'utf-8') || '').trim() : '');
          items.push({ path: dir, year: y, ym, timestamp, label });
          if (items.length >= limit) return items;
        }
      }
    }
    return items;
  }

  async getBackupSummary(backupDir: string, year?: number, month?: number): Promise<{ personnel: number; azubis: number; dutyRoster: number }> {
    const BetterSqlite3 = (await import('better-sqlite3')).default;
    const dbPath = path.join(backupDir, 'rd-plan.db');
    const raw = new BetterSqlite3(dbPath, { readonly: true });
    const getCount = (sql: string, params: any[] = []) => {
      try { const row = raw.prepare(sql).get(...params) as any; return Number(row?.cnt || 0); } catch { return 0; }
    };
    const personnel = getCount('SELECT COUNT(*) as cnt FROM personnel');
    const azubis = getCount('SELECT COUNT(*) as cnt FROM azubis');
    let dutyRoster = 0;
    if (typeof year === 'number' && typeof month === 'number') {
      const y = String(year);
      const mm = String(month + 1).padStart(2, '0');
      dutyRoster = getCount("SELECT COUNT(*) as cnt FROM duty_roster WHERE substr(date,1,4)=? AND substr(date,6,2)=?", [y, mm]);
    } else if (typeof year === 'number') {
      const y = String(year);
      dutyRoster = getCount("SELECT COUNT(*) as cnt FROM duty_roster WHERE substr(date,1,4)=?", [y]);
    } else {
      dutyRoster = getCount('SELECT COUNT(*) as cnt FROM duty_roster');
    }
    try { raw.close(); } catch {}
    return { personnel, azubis, dutyRoster };
  }

  async restoreBackup(backupDir: string): Promise<void> {
    if (!this.currentDbPath) throw new Error('Database path unknown');
    const fs = await import('fs');
    const src = path.join(backupDir, 'rd-plan.db');
    if (!fs.existsSync(src)) throw new Error('Backup file not found');
    // Copy backup over current DB; note: active connection will still point to same file
    fs.copyFileSync(src, this.currentDbPath);
    console.log('[DatabaseManager] Backup wiederhergestellt von:', src);
  }
}

// Global database manager instance
let globalDatabaseManager: DatabaseManager | null = null;

export async function initializeDatabaseManager(config?: DatabaseConfig): Promise<DatabaseAdapter> {
  if (globalDatabaseManager) {
    return globalDatabaseManager.getAdapter();
  }
  
  // Default configuration
  const defaultConfig: DatabaseConfig = {
    mode: process.env.RD_PLAN_DB_MODE === 'central-sqlite' ? 'central-sqlite' : 'sqlite',
    multiUser: process.env.RD_PLAN_MULTI_USER === 'true',
    centralPath: process.env.RD_PLAN_CENTRAL_DB_PATH
  };
  
  const finalConfig = { ...defaultConfig, ...config };
  
  // Auto-detect multi-user scenario and central path
  if (!finalConfig.centralPath) {
    const userDataPath = app.getPath('userData');
    
    // Check if we're running in a network/shared environment
    if (userDataPath.includes('network') || userDataPath.includes('shared') || userDataPath.includes('smb')) {
      finalConfig.multiUser = true;
      finalConfig.mode = 'central-sqlite';
      // Try to use a central location in the same network directory
      finalConfig.centralPath = path.join(path.dirname(userDataPath), 'rd-plan-shared.db');
      console.log('[DatabaseManager] Auto-detected network environment, using central database:', finalConfig.centralPath);
    }
  }
  
  // Switch to central SQLite for multi-user scenarios
  if (finalConfig.multiUser && finalConfig.mode === 'sqlite') {
    console.log('[DatabaseManager] Multi-user detected, switching to central SQLite');
    finalConfig.mode = 'central-sqlite';
    if (!finalConfig.centralPath) {
      const documentsPath = app.getPath('documents');
      finalConfig.centralPath = path.join(documentsPath, 'RD-Plan-Shared', 'rd-plan.db');
    }
  }
  
  globalDatabaseManager = new DatabaseManager(finalConfig);
  return globalDatabaseManager.initialize();
}

export function getDatabaseManager(): DatabaseManager {
  if (!globalDatabaseManager) {
    throw new Error('Database manager not initialized. Call initializeDatabaseManager() first.');
  }
  return globalDatabaseManager;
}

export async function closeDatabaseManager() {
  if (globalDatabaseManager) {
    await globalDatabaseManager.close();
    globalDatabaseManager = null;
  }
}

export async function createDatabaseBackup(opts?: { year?: number; month?: number }): Promise<string> {
  const mgr = getDatabaseManager();
  return mgr.createBackup(opts);
}

export async function listDatabaseBackups(limit?: number) {
  const mgr = getDatabaseManager();
  return mgr.listBackups(limit);
}

export async function getSummaryForBackup(backupDir: string, year?: number, month?: number) {
  const mgr = getDatabaseManager();
  return mgr.getBackupSummary(backupDir, year, month);
}

export async function restoreDatabaseFromBackup(backupDir: string) {
  const mgr = getDatabaseManager();
  return mgr.restoreBackup(backupDir);
}

// Preview duty roster import without writing
export async function previewDutyRosterImport(filePath: string, year: number, month?: number) {
  const mgr = getDatabaseManager();
  const { RosterImporter } = await import('./roster-importer');
  const importer = new RosterImporter(mgr.getAdapter());
  return importer.previewDutyRoster(filePath, year, month);
}