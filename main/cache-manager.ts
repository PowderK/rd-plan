import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

/**
 * Cache-Manager für Performance-Optimierung bei Netzlaufwerken
 * 
 * Strategie:
 * - Daten werden lokal im Temp-Verzeichnis gecacht
 * - Bei Lesezugriff: Cache prüfen, falls gültig -> Cache verwenden
 * - Bei Schreibzugriff: Sofort im Cache speichern, asynchron ins Netzwerk
 */

export interface CacheOptions {
  maxAgeMinutes?: number;  // Wie lange ist der Cache gültig (Standard: 5 Min)
  enableCache?: boolean;   // Cache aktivieren/deaktivieren (Standard: true)
}

export class CacheManager {
  private cacheDir: string;
  private networkPath: string;
  private defaultMaxAge: number = 5; // Minuten
  private enabled: boolean = true;
  private pendingWrites: Map<string, NodeJS.Timeout> = new Map();
  
  constructor(networkPath: string, options?: CacheOptions) {
    this.networkPath = networkPath;
    
    // Cache im Temp-Verzeichnis des Benutzers
    const tempDir = app.getPath('temp');
    const pathHash = this.getPathHash(networkPath);
    this.cacheDir = path.join(tempDir, 'rd-plan-cache', pathHash);
    
    // Cache-Verzeichnis erstellen
    try {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    } catch (e) {
      // Fehler ignorieren
    }
    
    if (options) {
      if (options.maxAgeMinutes !== undefined) {
        this.defaultMaxAge = options.maxAgeMinutes;
      }
      if (options.enableCache !== undefined) {
        this.enabled = options.enableCache;
      }
    }
  }
  
  /**
   * Erstellt einen Hash des Netzwerkpfads für eindeutige Cache-Verzeichnisse
   */
  private getPathHash(filePath: string): string {
    return crypto.createHash('md5').update(filePath).digest('hex').substring(0, 8);
  }
  
  /**
   * Gibt den Cache-Pfad für eine Datei zurück
   */
  private getCachePath(filename: string): string {
    return path.join(this.cacheDir, filename);
  }
  
  /**
   * Prüft, ob der Cache für eine Datei noch gültig ist
   */
  private isCacheValid(cachePath: string, maxAgeMinutes?: number): boolean {
    if (!this.enabled) return false;
    
    try {
      if (!fs.existsSync(cachePath)) {
        return false;
      }
      
      const stats = fs.statSync(cachePath);
      const fileAge = Date.now() - stats.mtimeMs;
      const maxAge = (maxAgeMinutes || this.defaultMaxAge) * 60 * 1000;
      
      return fileAge < maxAge;
    } catch (e) {
      return false;
    }
  }
  
  /**
   * Liest eine Datei mit Cache-Mechanismus
   * 1. Prüft, ob Cache vorhanden und gültig
   * 2. Falls ja: Cache verwenden (schnell)
   * 3. Falls nein: Aus Netzwerk laden (langsam) und Cache aktualisieren
   */
  async readFile(filename: string, options?: { maxAgeMinutes?: number }): Promise<Buffer | null> {
    const cachePath = this.getCachePath(filename);
    const networkPath = path.join(this.networkPath, filename);
    
    // Versuche aus Cache zu laden
    if (this.isCacheValid(cachePath, options?.maxAgeMinutes)) {
      try {
        const data = fs.readFileSync(cachePath);
        return data;
      } catch (e) {
        // Cache-Fehler ignorieren
      }
    }
    
    // Aus Netzwerk laden
    try {
      const data = fs.readFileSync(networkPath);
      
      // In Cache speichern (für nächstes Mal)
      try {
        fs.writeFileSync(cachePath, data);
      } catch (e) {
        // Cache-Fehler ignorieren
      }
      
      return data;
    } catch (e) {
      // Fallback: Versuche alten Cache zu verwenden (auch wenn abgelaufen)
      if (fs.existsSync(cachePath)) {
        try {
          return fs.readFileSync(cachePath);
        } catch {}
      }
      
      return null;
    }
  }
  
  /**
   * Schreibt eine Datei mit Cache-Mechanismus
   * 1. Sofort im Cache speichern (schnell, UI blockiert nicht)
   * 2. Asynchron ins Netzwerk schreiben (langsam, im Hintergrund)
   * 3. Mehrere Schreibvorgänge werden gebündelt (Debouncing)
   */
  async writeFile(filename: string, data: Buffer | string, options?: { debounceMs?: number }): Promise<void> {
    const cachePath = this.getCachePath(filename);
    const networkPath = path.join(this.networkPath, filename);
    const debounceMs = options?.debounceMs || 2000;
    
    // 1. Sofort im Cache speichern
    try {
      fs.writeFileSync(cachePath, data);
    } catch (e) {
      // Cache-Fehler ignorieren
    }
    
    // 2. Netzwerk-Schreiben verzögern (Debouncing)
    const existingTimeout = this.pendingWrites.get(filename);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }
    
    const timeout = setTimeout(() => {
      this.pendingWrites.delete(filename);
      this.writeToNetwork(filename, networkPath, data);
    }, debounceMs);
    
    this.pendingWrites.set(filename, timeout);
  }
  
  /**
   * Schreibt eine Datei direkt ins Netzwerk (im Hintergrund)
   */
  private writeToNetwork(filename: string, networkPath: string, data: Buffer | string): void {
    // Im Hintergrund schreiben (blockiert UI nicht)
    setImmediate(() => {
      try {
        // Stelle sicher, dass das Verzeichnis existiert
        const dir = path.dirname(networkPath);
        fs.mkdirSync(dir, { recursive: true });
        
        // Schreibe ins Netzwerk
        fs.writeFileSync(networkPath, data);
      } catch (e) {
        // Netzwerk-Fehler ignorieren
      }
    });
  }
  
  /**
   * Erzwingt sofortiges Schreiben aller ausstehenden Änderungen ins Netzwerk
   */
  async flush(): Promise<void> {
    // Alle Timeouts abbrechen und sofort schreiben
    const promises: Promise<void>[] = [];
    
    this.pendingWrites.forEach((timeout, filename) => {
      clearTimeout(timeout);
      
      const cachePath = this.getCachePath(filename);
      const networkPath = path.join(this.networkPath, filename);
      
      if (fs.existsSync(cachePath)) {
        const promise = new Promise<void>((resolve) => {
          try {
            const data = fs.readFileSync(cachePath);
            fs.writeFileSync(networkPath, data);
          } catch (e) {
            // Fehler ignorieren
          }
          resolve();
        });
        promises.push(promise);
      }
    });
    
    this.pendingWrites.clear();
    await Promise.all(promises);
  }
  
  /**
   * Löscht den Cache für eine bestimmte Datei
   */
  invalidateCache(filename: string): void {
    const cachePath = this.getCachePath(filename);
    try {
      if (fs.existsSync(cachePath)) {
        fs.unlinkSync(cachePath);
      }
    } catch (e) {
      // Fehler ignorieren
    }
  }
  
  /**
   * Löscht den gesamten Cache
   */
  clearCache(): void {
    try {
      if (fs.existsSync(this.cacheDir)) {
        fs.rmSync(this.cacheDir, { recursive: true, force: true });
        fs.mkdirSync(this.cacheDir, { recursive: true });
      }
    } catch (e) {
      // Fehler ignorieren
    }
  }
  
  /**
   * Prüft, ob eine Datei im Cache existiert
   */
  hasCachedVersion(filename: string): boolean {
    const cachePath = this.getCachePath(filename);
    return fs.existsSync(cachePath);
  }
  
  /**
   * Gibt Cache-Statistiken zurück
   */
  getStats(): { cacheDir: string; cachedFiles: number; pendingWrites: number } {
    let cachedFiles = 0;
    try {
      if (fs.existsSync(this.cacheDir)) {
        cachedFiles = fs.readdirSync(this.cacheDir).length;
      }
    } catch {}
    
    return {
      cacheDir: this.cacheDir,
      cachedFiles,
      pendingWrites: this.pendingWrites.size
    };
  }
}
