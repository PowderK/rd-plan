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
  
  getItwDoctors(): Promise<any[]>;
  addItwDoctor(doc: any): Promise<void>;
  updateItwDoctor(doc: any): Promise<void>;
  deleteItwDoctor(id: number): Promise<void>;
  
  getRtwVehicles(year?: number): Promise<any[]>;
  getNefVehicles(year?: number): Promise<any[]>;
  getRtwVehicleActivations(year: number): Promise<any[]>;
  setRtwVehicleActivation(vehicleId: number, year: number, month: number, enabled: boolean): Promise<void>;
  getNefVehicleActivations(year: number): Promise<any[]>;
  setNefVehicleActivation(vehicleId: number, year: number, month: number, enabled: boolean): Promise<void>;
  
  getHolidaysForYear(year: number): Promise<any[]>;
  setHolidaysForYear(year: number, dates: any[]): Promise<void>;
  
  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;
  
  getShiftTypes(): Promise<any[]>;
  addShiftType(type: any): Promise<void>;
  updateShiftType(type: any): Promise<void>;
  deleteShiftType(id: number): Promise<void>;
  
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
  
  async getRtwVehicles(year?: number) {
    const { getRtwVehicles } = await import('./database');
    return getRtwVehicles(this.db, year);
  }
  
  async getNefVehicles(year?: number) {
    const { getNefVehicles } = await import('./database');
    return getNefVehicles(this.db, year);
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
  
  async getHolidaysForYear(year: number) {
    const { getHolidaysForYear } = await import('./database');
    return getHolidaysForYear(this.db, year);
  }
  
  async setHolidaysForYear(year: number, dates: any[]) {
    const { setHolidaysForYear } = await import('./database');
    return setHolidaysForYear(this.db, year, dates);
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
      // Use local user data path
      const userDataPath = app.getPath('userData');
      dbPath = path.join(userDataPath, 'rd-plan.db');
      console.log('[DatabaseManager] Using local SQLite database at:', dbPath);
    }
    
    const db = await this.initializeSQLiteWithPath(dbPath);
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