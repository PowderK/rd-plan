"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseManager = void 0;
exports.initializeDatabaseManager = initializeDatabaseManager;
exports.getDatabaseManager = getDatabaseManager;
exports.closeDatabaseManager = closeDatabaseManager;
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
class SQLiteAdapter {
    constructor(db) {
        this.db = db;
    }
    async getPersonnel() {
        const { getPersonnel } = await Promise.resolve().then(() => __importStar(require('./database')));
        return getPersonnel(this.db);
    }
    async addPersonnel(person) {
        const { addPersonnel } = await Promise.resolve().then(() => __importStar(require('./database')));
        return addPersonnel(this.db, person);
    }
    async updatePersonnel(person) {
        const { updatePersonnel } = await Promise.resolve().then(() => __importStar(require('./database')));
        return updatePersonnel(this.db, person);
    }
    async deletePersonnel(id) {
        const { deletePersonnel } = await Promise.resolve().then(() => __importStar(require('./database')));
        return deletePersonnel(this.db, id);
    }
    async updatePersonnelOrder(order) {
        const { updatePersonnelOrder } = await Promise.resolve().then(() => __importStar(require('./database')));
        return updatePersonnelOrder(this.db, order);
    }
    async getDutyRoster(year) {
        const { getDutyRoster } = await Promise.resolve().then(() => __importStar(require('./database')));
        return getDutyRoster(this.db, year);
    }
    async setDutyRosterEntry(entry) {
        const { setDutyRosterEntry } = await Promise.resolve().then(() => __importStar(require('./database')));
        return setDutyRosterEntry(this.db, entry);
    }
    async bulkSetDutyRosterEntries(entries) {
        const { bulkSetDutyRosterEntries } = await Promise.resolve().then(() => __importStar(require('./database')));
        return bulkSetDutyRosterEntries(this.db, entries);
    }
    async getAzubiList() {
        const { getAzubiList } = await Promise.resolve().then(() => __importStar(require('./database')));
        return getAzubiList(this.db);
    }
    async addAzubi(azubi) {
        const { addAzubi } = await Promise.resolve().then(() => __importStar(require('./database')));
        return addAzubi(this.db, azubi);
    }
    async updateAzubi(azubi) {
        const { updateAzubi } = await Promise.resolve().then(() => __importStar(require('./database')));
        return updateAzubi(this.db, azubi);
    }
    async deleteAzubi(id) {
        const { deleteAzubi } = await Promise.resolve().then(() => __importStar(require('./database')));
        return deleteAzubi(this.db, id);
    }
    async getItwDoctors() {
        const { getItwDoctors } = await Promise.resolve().then(() => __importStar(require('./database')));
        return getItwDoctors(this.db);
    }
    async addItwDoctor(doc) {
        const { addItwDoctor } = await Promise.resolve().then(() => __importStar(require('./database')));
        return addItwDoctor(this.db, doc);
    }
    async updateItwDoctor(doc) {
        const { updateItwDoctor } = await Promise.resolve().then(() => __importStar(require('./database')));
        return updateItwDoctor(this.db, doc);
    }
    async deleteItwDoctor(id) {
        const { deleteItwDoctor } = await Promise.resolve().then(() => __importStar(require('./database')));
        return deleteItwDoctor(this.db, id);
    }
    async getRtwVehicles(year) {
        const { getRtwVehicles } = await Promise.resolve().then(() => __importStar(require('./database')));
        return getRtwVehicles(this.db, year);
    }
    async getNefVehicles(year) {
        const { getNefVehicles } = await Promise.resolve().then(() => __importStar(require('./database')));
        return getNefVehicles(this.db, year);
    }
    async getRtwVehicleActivations(year) {
        const { getRtwVehicleActivations } = await Promise.resolve().then(() => __importStar(require('./database')));
        return getRtwVehicleActivations(this.db, year);
    }
    async setRtwVehicleActivation(vehicleId, year, month, enabled) {
        const { setRtwVehicleActivation } = await Promise.resolve().then(() => __importStar(require('./database')));
        return setRtwVehicleActivation(this.db, vehicleId, year, month, enabled);
    }
    async getNefVehicleActivations(year) {
        const { getNefVehicleActivations } = await Promise.resolve().then(() => __importStar(require('./database')));
        return getNefVehicleActivations(this.db, year);
    }
    async setNefVehicleActivation(vehicleId, year, month, enabled) {
        const { setNefVehicleActivation } = await Promise.resolve().then(() => __importStar(require('./database')));
        return setNefVehicleActivation(this.db, vehicleId, year, month, enabled);
    }
    async getHolidaysForYear(year) {
        const { getHolidaysForYear } = await Promise.resolve().then(() => __importStar(require('./database')));
        return getHolidaysForYear(this.db, year);
    }
    async setHolidaysForYear(year, dates) {
        const { setHolidaysForYear } = await Promise.resolve().then(() => __importStar(require('./database')));
        return setHolidaysForYear(this.db, year, dates);
    }
    async getSetting(key) {
        const { getSetting } = await Promise.resolve().then(() => __importStar(require('./database')));
        return getSetting(this.db, key);
    }
    async setSetting(key, value) {
        const { setSetting } = await Promise.resolve().then(() => __importStar(require('./database')));
        return setSetting(this.db, key, value);
    }
    async getShiftTypes() {
        const { getShiftTypes } = await Promise.resolve().then(() => __importStar(require('./database')));
        return getShiftTypes(this.db);
    }
    async addShiftType(type) {
        const { addShiftType } = await Promise.resolve().then(() => __importStar(require('./database')));
        return addShiftType(this.db, type);
    }
    async updateShiftType(type) {
        const { updateShiftType } = await Promise.resolve().then(() => __importStar(require('./database')));
        return updateShiftType(this.db, type);
    }
    async deleteShiftType(id) {
        const { deleteShiftType } = await Promise.resolve().then(() => __importStar(require('./database')));
        return deleteShiftType(this.db, id);
    }
    async clearDutyRosterForYear(year) {
        const { clearDutyRosterForYear } = await Promise.resolve().then(() => __importStar(require('./database')));
        return clearDutyRosterForYear(this.db, year);
    }
    async clearDutyRosterForMonth(year, month) {
        const { clearDutyRosterForMonth } = await Promise.resolve().then(() => __importStar(require('./database')));
        return clearDutyRosterForMonth(this.db, year, month);
    }
    async getItwPatterns() {
        const { getItwPatterns } = await Promise.resolve().then(() => __importStar(require('./database')));
        return getItwPatterns(this.db);
    }
    async setItwPatterns(patterns) {
        const { setItwPatterns } = await Promise.resolve().then(() => __importStar(require('./database')));
        return setItwPatterns(this.db, patterns);
    }
    async getDeptPatterns() {
        const { getDeptPatterns } = await Promise.resolve().then(() => __importStar(require('./database')));
        return getDeptPatterns(this.db);
    }
    async setDeptPatterns(patterns) {
        const { setDeptPatterns } = await Promise.resolve().then(() => __importStar(require('./database')));
        return setDeptPatterns(this.db, patterns);
    }
    async importPersonnelFromExcel(filePath, replaceExisting = false) {
        const { ExcelPersonnelImporter } = await Promise.resolve().then(() => __importStar(require('./excel-importer')));
        const importer = new ExcelPersonnelImporter(this.db);
        const data = importer.parseExcelFile(filePath);
        return await importer.importPersonnelData(data, replaceExisting);
    }
    async exportPersonnelToExcel(filePath) {
        const { ExcelPersonnelImporter } = await Promise.resolve().then(() => __importStar(require('./excel-importer')));
        const importer = new ExcelPersonnelImporter(this.db);
        return await importer.exportToExcel(filePath);
    }
    async createPersonnelTemplate(filePath) {
        const { ExcelPersonnelImporter } = await Promise.resolve().then(() => __importStar(require('./excel-importer')));
        ExcelPersonnelImporter.createTemplate(filePath);
    }
    // Settings Import/Export Methoden
    async importSettingsFromJson(filePath, replaceExisting) {
        const { SettingsImporter } = await Promise.resolve().then(() => __importStar(require('./settings-importer')));
        const importer = new SettingsImporter(this.db);
        return await importer.importSettingsFromJson(filePath, replaceExisting);
    }
    async exportSettingsToJson(filePath) {
        const { SettingsImporter } = await Promise.resolve().then(() => __importStar(require('./settings-importer')));
        const importer = new SettingsImporter(this.db);
        return await importer.exportSettingsToJson(filePath);
    }
    async exportSettingsToExcel(filePath) {
        const { SettingsImporter } = await Promise.resolve().then(() => __importStar(require('./settings-importer')));
        const importer = new SettingsImporter(this.db);
        return await importer.exportSettingsToExcel(filePath);
    }
    async createSettingsTemplate(filePath) {
        const { SettingsImporter } = await Promise.resolve().then(() => __importStar(require('./settings-importer')));
        const importer = new SettingsImporter(this.db);
        return await importer.createSettingsTemplate(filePath);
    }
    async close() {
        // SQLite database is closed automatically
    }
}
class DatabaseManager {
    constructor(config) {
        this.config = config;
    }
    async initialize() {
        console.log('[DatabaseManager] Initializing database with mode:', this.config.mode);
        return this.initializeSQLite();
    }
    async initializeSQLite() {
        console.log('[DatabaseManager] Starting SQLite database');
        let dbPath;
        if (this.config.mode === 'central-sqlite' && this.config.centralPath) {
            // Use central path for multi-user scenarios
            dbPath = this.config.centralPath;
            console.log('[DatabaseManager] Using central SQLite database at:', dbPath);
        }
        else {
            // Use local user data path
            const userDataPath = electron_1.app.getPath('userData');
            dbPath = path_1.default.join(userDataPath, 'rd-plan.db');
            console.log('[DatabaseManager] Using local SQLite database at:', dbPath);
        }
        const db = await this.initializeSQLiteWithPath(dbPath);
        this.adapter = new SQLiteAdapter(db);
        return this.adapter;
    }
    async initializeSQLiteWithPath(dbPath) {
        // Import BetterSqlite3 dynamically to create a custom AsyncDB with specific path
        const BetterSqlite3 = (await Promise.resolve().then(() => __importStar(require('better-sqlite3')))).default;
        const raw = new BetterSqlite3(dbPath);
        const db = {
            exec: async (sql) => { raw.exec(sql); },
            run: async (sql, params = []) => {
                const stmt = raw.prepare(sql);
                return Array.isArray(params) ? stmt.run(...params) : stmt.run(params);
            },
            get: async (sql, params = []) => {
                const stmt = raw.prepare(sql);
                return Array.isArray(params) ? stmt.get(...params) : stmt.get(params);
            },
            all: async (sql, params = []) => {
                const stmt = raw.prepare(sql);
                return Array.isArray(params) ? stmt.all(...params) : stmt.all(params);
            },
            prepare: async (sql) => {
                const stmt = raw.prepare(sql);
                return {
                    run: async (...params) => stmt.run(...params),
                    get: async (...params) => stmt.get(...params),
                    all: async (...params) => stmt.all(...params),
                    finalize: async () => { },
                };
            },
        };
        // Initialize database schema (copied from existing database.ts)
        await this.initializeSQLiteSchema(db);
        return db;
    }
    async initializeSQLiteSchema(db) {
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
    getAdapter() {
        if (!this.adapter) {
            throw new Error('Database not initialized. Call initialize() first.');
        }
        return this.adapter;
    }
    getConfig() {
        return this.config;
    }
    async close() {
        if (this.adapter) {
            await this.adapter.close();
        }
    }
}
exports.DatabaseManager = DatabaseManager;
// Global database manager instance
let globalDatabaseManager = null;
async function initializeDatabaseManager(config) {
    if (globalDatabaseManager) {
        return globalDatabaseManager.getAdapter();
    }
    // Default configuration
    const defaultConfig = {
        mode: process.env.RD_PLAN_DB_MODE === 'central-sqlite' ? 'central-sqlite' : 'sqlite',
        multiUser: process.env.RD_PLAN_MULTI_USER === 'true',
        centralPath: process.env.RD_PLAN_CENTRAL_DB_PATH
    };
    const finalConfig = { ...defaultConfig, ...config };
    // Auto-detect multi-user scenario and central path
    if (!finalConfig.centralPath) {
        const userDataPath = electron_1.app.getPath('userData');
        // Check if we're running in a network/shared environment
        if (userDataPath.includes('network') || userDataPath.includes('shared') || userDataPath.includes('smb')) {
            finalConfig.multiUser = true;
            finalConfig.mode = 'central-sqlite';
            // Try to use a central location in the same network directory
            finalConfig.centralPath = path_1.default.join(path_1.default.dirname(userDataPath), 'rd-plan-shared.db');
            console.log('[DatabaseManager] Auto-detected network environment, using central database:', finalConfig.centralPath);
        }
    }
    // Switch to central SQLite for multi-user scenarios
    if (finalConfig.multiUser && finalConfig.mode === 'sqlite') {
        console.log('[DatabaseManager] Multi-user detected, switching to central SQLite');
        finalConfig.mode = 'central-sqlite';
        if (!finalConfig.centralPath) {
            const documentsPath = electron_1.app.getPath('documents');
            finalConfig.centralPath = path_1.default.join(documentsPath, 'RD-Plan-Shared', 'rd-plan.db');
        }
    }
    globalDatabaseManager = new DatabaseManager(finalConfig);
    return globalDatabaseManager.initialize();
}
function getDatabaseManager() {
    if (!globalDatabaseManager) {
        throw new Error('Database manager not initialized. Call initializeDatabaseManager() first.');
    }
    return globalDatabaseManager;
}
async function closeDatabaseManager() {
    if (globalDatabaseManager) {
        await globalDatabaseManager.close();
        globalDatabaseManager = null;
    }
}
