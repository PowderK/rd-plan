import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { AsyncDB } from './database';
import { getDatabaseManager } from './database-manager';

interface VersionInfo {
  version: string;
  build: number;
  dbSchemaVersion: number;
}

interface Migration {
  version: number;
  description: string;
  up: (db: AsyncDB) => Promise<void>;
  down?: (db: AsyncDB) => Promise<void>;
}

/**
 * Update Manager
 * - Verwaltet App-Versionen und DB-Schema-Versionen
 * - Führt automatische Backups vor Updates durch
 * - Migriert die Datenbank bei Schema-Änderungen
 * - Ermöglicht Rollback bei Fehlern
 */
export class UpdateManager {
  private versionFilePath: string;
  private migrations: Migration[] = [];
  
  constructor() {
    // Version info stored in userData for persistence across updates
    this.versionFilePath = path.join(app.getPath('userData'), 'version-info.json');
    this.registerMigrations();
  }
  
  /**
   * Registriert alle Datenbank-Migrationen in chronologischer Reihenfolge
   */
  private registerMigrations() {
    // Migration 1: Initial Schema (bereits vorhanden)
    this.migrations.push({
      version: 1,
      description: 'Initial schema with all base tables',
      up: async (db: AsyncDB) => {
        // Bereits in database-manager.ts implementiert
        console.log('[UpdateManager] Migration 1: Initial schema already exists');
      }
    });
    
    // Migration 2: Lehrjahr in azubi_periods
    this.migrations.push({
      version: 2,
      description: 'Add lehrjahr column to azubi_periods',
      up: async (db: AsyncDB) => {
        const cols = await db.all("PRAGMA table_info('azubi_periods')");
        if (!cols.some((c: any) => c.name === 'lehrjahr')) {
          console.log('[UpdateManager] Migration 2: Adding lehrjahr to azubi_periods');
          await db.exec("ALTER TABLE azubi_periods ADD COLUMN lehrjahr INTEGER DEFAULT 1");
        }
      },
      down: async (db: AsyncDB) => {
        // SQLite doesn't support DROP COLUMN easily, would need table recreation
        console.log('[UpdateManager] Migration 2 rollback: Column removal not supported');
      }
    });
    
    // Migration 3: qualification_types Tabelle
    this.migrations.push({
      version: 3,
      description: 'Create qualification_types table',
      up: async (db: AsyncDB) => {
        // Check if table exists
        const tables = await db.all(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='qualification_types'"
        );
        if (tables.length === 0) {
          console.log('[UpdateManager] Migration 3: Creating qualification_types table');
          await db.exec(`
            CREATE TABLE qualification_types (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL UNIQUE,
              active INTEGER DEFAULT 1
            )
          `);
        }
      }
    });
    
    // Migration 4: vehicle_positions Tabelle
    this.migrations.push({
      version: 4,
      description: 'Create vehicle_positions table for flexible position-qualification mapping',
      up: async (db: AsyncDB) => {
        const tables = await db.all(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='vehicle_positions'"
        );
        if (tables.length === 0) {
          console.log('[UpdateManager] Migration 4: Creating vehicle_positions table');
          await db.exec(`
            CREATE TABLE vehicle_positions (
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
          
          // Initialisiere Standard-Positionen für bestehende Fahrzeuge
          console.log('[UpdateManager] Migration 4: Initializing default positions for existing vehicles');
          const { initializeDefaultVehiclePositions, getQualificationTypes } = await import('./database');
          
          // RTW Fahrzeuge
          const rtwVehicles = await db.all('SELECT id FROM rtw_vehicles WHERE archived_year IS NULL');
          for (const v of rtwVehicles) {
            await initializeDefaultVehiclePositions(db, 'rtw', v.id);
          }
          
          // NEF Fahrzeuge
          const nefVehicles = await db.all('SELECT id FROM nef_vehicles WHERE archived_year IS NULL');
          for (const v of nefVehicles) {
            await initializeDefaultVehiclePositions(db, 'nef', v.id);
          }
          
          // ITW Fahrzeuge
          const itwVehicles = await db.all('SELECT id FROM itw_vehicles WHERE archived_year IS NULL');
          for (const v of itwVehicles) {
            await initializeDefaultVehiclePositions(db, 'itw', v.id);
          }
          
          console.log('[UpdateManager] Migration 4: Default positions initialized');
        }
      }
    });
    
    // Zukünftige Migrationen hier hinzufügen
    // this.migrations.push({
    //   version: 5,
    //   description: 'Add new feature X',
    //   up: async (db: AsyncDB) => { ... }
    // });
  }
  
  /**
   * Liest die aktuelle Version aus version-info.json
   */
  async getCurrentVersion(): Promise<VersionInfo> {
    try {
      if (fs.existsSync(this.versionFilePath)) {
        const data = fs.readFileSync(this.versionFilePath, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('[UpdateManager] Error reading version file:', error);
    }
    
    // Default für erste Installation
    return {
      version: '0.0.0',
      build: 0,
      dbSchemaVersion: 0
    };
  }
  
  /**
   * Liest die App-Version aus build-info.json
   */
  async getAppVersion(): Promise<{ version: string; build: number }> {
    try {
      // build-info.json liegt im App-Root
      const buildInfoPath = path.join(__dirname, '../../build-info.json');
      if (fs.existsSync(buildInfoPath)) {
        const data = fs.readFileSync(buildInfoPath, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('[UpdateManager] Error reading build info:', error);
    }
    
    return { version: '0.0.0', build: 0 };
  }
  
  /**
   * Speichert die aktuelle Version
   */
  private async saveVersion(versionInfo: VersionInfo): Promise<void> {
    try {
      fs.writeFileSync(
        this.versionFilePath,
        JSON.stringify(versionInfo, null, 2),
        'utf-8'
      );
      console.log('[UpdateManager] Version saved:', versionInfo);
    } catch (error) {
      console.error('[UpdateManager] Error saving version:', error);
      throw error;
    }
  }
  
  /**
   * Prüft ob ein Update notwendig ist
   */
  async needsUpdate(): Promise<boolean> {
    const current = await getCurrentVersion();
    const app = await this.getAppVersion();
    
    return (
      app.version !== current.version ||
      app.build > current.build ||
      this.getLatestSchemaVersion() > current.dbSchemaVersion
    );
  }
  
  /**
   * Gibt die höchste registrierte Schema-Version zurück
   */
  private getLatestSchemaVersion(): number {
    return this.migrations.length > 0
      ? Math.max(...this.migrations.map(m => m.version))
      : 0;
  }
  
  /**
   * Führt das Update-Verfahren durch:
   * 1. Backup erstellen
   * 2. Migrationen ausführen
   * 3. Version aktualisieren
   * 4. Bei Fehler: Rollback
   */
  async performUpdate(): Promise<{ success: boolean; message: string; backupPath?: string }> {
    const currentVersion = await getCurrentVersion();
    const appVersion = await this.getAppVersion();
    const latestSchemaVersion = this.getLatestSchemaVersion();
    
    console.log('[UpdateManager] Starting update process');
    console.log('[UpdateManager] Current:', currentVersion);
    console.log('[UpdateManager] Target:', { ...appVersion, dbSchemaVersion: latestSchemaVersion });
    
    let backupPath: string | undefined;
    
    try {
      // 1. Backup erstellen
      const dbManager = getDatabaseManager();
      backupPath = await dbManager.createBackup({
        label: `pre-update-v${appVersion.version}-b${appVersion.build}`
      });
      console.log('[UpdateManager] Backup created:', backupPath);
      
      // 2. Migrationen ausführen
      const db = await this.getDatabaseConnection();
      const migrationsToRun = this.migrations.filter(
        m => m.version > currentVersion.dbSchemaVersion
      );
      
      if (migrationsToRun.length > 0) {
        console.log(`[UpdateManager] Running ${migrationsToRun.length} migrations...`);
        
        for (const migration of migrationsToRun) {
          console.log(`[UpdateManager] Applying migration ${migration.version}: ${migration.description}`);
          await migration.up(db);
        }
      } else {
        console.log('[UpdateManager] No database migrations needed');
      }
      
      // 3. Version aktualisieren
      const newVersion: VersionInfo = {
        version: appVersion.version,
        build: appVersion.build,
        dbSchemaVersion: latestSchemaVersion
      };
      
      await this.saveVersion(newVersion);
      
      return {
        success: true,
        message: `Update erfolgreich auf Version ${appVersion.version} Build ${appVersion.build}`,
        backupPath
      };
      
    } catch (error: any) {
      console.error('[UpdateManager] Update failed:', error);
      
      // Rollback: Backup wiederherstellen
      if (backupPath) {
        try {
          console.log('[UpdateManager] Attempting rollback from backup:', backupPath);
          const dbManager = getDatabaseManager();
          await dbManager.restoreBackup(backupPath);
          console.log('[UpdateManager] Rollback successful');
        } catch (rollbackError) {
          console.error('[UpdateManager] Rollback failed:', rollbackError);
          return {
            success: false,
            message: `Update fehlgeschlagen UND Rollback fehlgeschlagen! Bitte manuell Backup wiederherstellen: ${backupPath}`,
            backupPath
          };
        }
      }
      
      return {
        success: false,
        message: `Update fehlgeschlagen: ${error.message}. Datenbank wurde auf vorherige Version zurückgesetzt.`,
        backupPath
      };
    }
  }
  
  /**
   * Gibt die Datenbankverbindung zurück
   */
  private async getDatabaseConnection(): Promise<AsyncDB> {
    // Wir verwenden die database-manager Methode um die DB-Verbindung zu erhalten
    // Die Migrationen werden direkt über den DatabaseManager ausgeführt
    const dbManager = getDatabaseManager();
    
    // Erstelle temporäre AsyncDB für Migrationen
    const BetterSqlite3 = (await import('better-sqlite3')).default;
    const dbPath = (dbManager as any).currentDbPath;
    
    if (!dbPath) {
      throw new Error('Database path not available');
    }
    
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
          finalize: async () => { /* no-op */ },
        };
      },
    };
    
    return db;
  }
  
  /**
   * Erstellt ein manuelles Backup (z.B. vor Beta-Test)
   */
  async createManualBackup(label: string): Promise<string> {
    const dbManager = getDatabaseManager();
    return await dbManager.createBackup({ label });
  }
  
  /**
   * Listet alle verfügbaren Backups auf
   */
  async listBackups(limit = 20): Promise<any[]> {
    const dbManager = getDatabaseManager();
    return await dbManager.listBackups(limit);
  }
  
  /**
   * Stellt ein Backup wieder her
   */
  async restoreBackup(backupPath: string): Promise<void> {
    const dbManager = getDatabaseManager();
    await dbManager.restoreBackup(backupPath);
    console.log('[UpdateManager] Backup restored from:', backupPath);
  }
}

// Singleton Instance
let updateManager: UpdateManager | null = null;

export function getUpdateManager(): UpdateManager {
  if (!updateManager) {
    updateManager = new UpdateManager();
  }
  return updateManager;
}

export async function getCurrentVersion(): Promise<VersionInfo> {
  return getUpdateManager().getCurrentVersion();
}

export async function performUpdate(): Promise<{ success: boolean; message: string; backupPath?: string }> {
  return getUpdateManager().performUpdate();
}
