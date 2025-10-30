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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsImporter = void 0;
const XLSX = __importStar(require("xlsx"));
const fs_1 = require("fs");
class SettingsImporter {
    constructor(db) {
        this.db = db;
    }
    /**
     * Exportiert alle Einstellungen in eine JSON-Datei
     */
    async exportSettingsToJson(filePath) {
        try {
            // Sammle alle Einstellungsdaten
            const settings = await this.db.all('SELECT key, value FROM settings ORDER BY key');
            const shiftTypes = await this.db.all('SELECT id, code, description FROM shift_types ORDER BY code');
            const holidays = await this.db.all('SELECT date, name FROM holidays ORDER BY date');
            const itwPatterns = await this.db.all('SELECT start_date, pattern FROM itw_patterns ORDER BY start_date');
            const deptPatterns = await this.db.all('SELECT start_date, pattern FROM dept_patterns ORDER BY start_date');
            const rtwVehicles = await this.db.all('SELECT id, name, sort, archived_year FROM rtw_vehicles ORDER BY sort');
            const nefVehicles = await this.db.all('SELECT id, name, sort, archived_year, occupancy_mode FROM nef_vehicles ORDER BY sort');
            const exportData = {
                metadata: {
                    version: '1.0',
                    exportDate: new Date().toISOString(),
                    appVersion: '1.0.0'
                },
                settings: settings || [],
                shiftTypes: shiftTypes || [],
                holidays: holidays || [],
                itwPatterns: itwPatterns || [],
                deptPatterns: deptPatterns || [],
                rtwVehicles: rtwVehicles || [],
                nefVehicles: nefVehicles || []
            };
            // Als JSON speichern
            (0, fs_1.writeFileSync)(filePath, JSON.stringify(exportData, null, 2), 'utf8');
            console.log('[SettingsImporter] Settings exported to JSON:', filePath);
        }
        catch (error) {
            console.error('[SettingsImporter] Export to JSON failed:', error);
            throw new Error(`Settings-Export fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Exportiert alle Einstellungen in eine Excel-Datei
     */
    async exportSettingsToExcel(filePath) {
        try {
            // Sammle alle Einstellungsdaten
            const settings = await this.db.all('SELECT key, value FROM settings ORDER BY key');
            const shiftTypes = await this.db.all('SELECT id, code, description FROM shift_types ORDER BY code');
            const holidays = await this.db.all('SELECT date, name FROM holidays ORDER BY date');
            const itwPatterns = await this.db.all('SELECT start_date, pattern FROM itw_patterns ORDER BY start_date');
            const deptPatterns = await this.db.all('SELECT start_date, pattern FROM dept_patterns ORDER BY start_date');
            const rtwVehicles = await this.db.all('SELECT id, name, sort, archived_year FROM rtw_vehicles ORDER BY sort');
            const nefVehicles = await this.db.all('SELECT id, name, sort, archived_year, occupancy_mode FROM nef_vehicles ORDER BY sort');
            // Erstelle Workbook
            const wb = XLSX.utils.book_new();
            // Metadata-Sheet
            const metadataData = [
                ['Version', '1.0'],
                ['Export-Datum', new Date().toISOString()],
                ['App-Version', '1.0.0']
            ];
            const metadataWs = XLSX.utils.aoa_to_sheet(metadataData);
            XLSX.utils.book_append_sheet(wb, metadataWs, 'Metadata');
            // Settings-Sheet
            if (settings && settings.length > 0) {
                const settingsData = [
                    ['Schlüssel', 'Wert'],
                    ...settings.map(s => [s.key, s.value])
                ];
                const settingsWs = XLSX.utils.aoa_to_sheet(settingsData);
                XLSX.utils.book_append_sheet(wb, settingsWs, 'Einstellungen');
            }
            // ShiftTypes-Sheet
            if (shiftTypes && shiftTypes.length > 0) {
                const shiftTypesData = [
                    ['ID', 'Kürzel', 'Beschreibung'],
                    ...shiftTypes.map(st => [st.id, st.code, st.description])
                ];
                const shiftTypesWs = XLSX.utils.aoa_to_sheet(shiftTypesData);
                XLSX.utils.book_append_sheet(wb, shiftTypesWs, 'Dienstarten');
            }
            // Holidays-Sheet
            if (holidays && holidays.length > 0) {
                const holidaysData = [
                    ['Datum', 'Name'],
                    ...holidays.map(h => [h.date, h.name])
                ];
                const holidaysWs = XLSX.utils.aoa_to_sheet(holidaysData);
                XLSX.utils.book_append_sheet(wb, holidaysWs, 'Feiertage');
            }
            // ITW-Patterns-Sheet
            if (itwPatterns && itwPatterns.length > 0) {
                const itwData = [
                    ['Gültig ab', 'Muster (21 Tage)'],
                    ...itwPatterns.map(p => [p.start_date, p.pattern])
                ];
                const itwWs = XLSX.utils.aoa_to_sheet(itwData);
                XLSX.utils.book_append_sheet(wb, itwWs, 'ITW-Schichtfolgen');
            }
            // Department-Patterns-Sheet
            if (deptPatterns && deptPatterns.length > 0) {
                const deptData = [
                    ['Gültig ab', 'Muster (21 Tage)'],
                    ...deptPatterns.map(p => [p.start_date, p.pattern])
                ];
                const deptWs = XLSX.utils.aoa_to_sheet(deptData);
                XLSX.utils.book_append_sheet(wb, deptWs, 'Abteilungs-Schichtfolgen');
            }
            // RTW-Vehicles-Sheet
            if (rtwVehicles && rtwVehicles.length > 0) {
                const rtwData = [
                    ['ID', 'Name', 'Sortierung', 'Archiviert (Jahr)'],
                    ...rtwVehicles.map(v => [v.id, v.name, v.sort, v.archived_year || ''])
                ];
                const rtwWs = XLSX.utils.aoa_to_sheet(rtwData);
                XLSX.utils.book_append_sheet(wb, rtwWs, 'RTW-Fahrzeuge');
            }
            // NEF-Vehicles-Sheet
            if (nefVehicles && nefVehicles.length > 0) {
                const nefData = [
                    ['ID', 'Name', 'Sortierung', 'Archiviert (Jahr)', 'Besetzungsmodus'],
                    ...nefVehicles.map(v => [v.id, v.name, v.sort, v.archived_year || '', v.occupancy_mode])
                ];
                const nefWs = XLSX.utils.aoa_to_sheet(nefData);
                XLSX.utils.book_append_sheet(wb, nefWs, 'NEF-Fahrzeuge');
            }
            // Speichere Excel-Datei
            XLSX.writeFile(wb, filePath);
            console.log('[SettingsImporter] Settings exported to Excel:', filePath);
        }
        catch (error) {
            console.error('[SettingsImporter] Export to Excel failed:', error);
            throw new Error(`Settings-Export fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Importiert Einstellungen aus einer JSON-Datei
     */
    async importSettingsFromJson(filePath, replaceExisting = false) {
        const result = {
            success: false,
            imported: {
                settings: 0,
                shiftTypes: 0,
                holidays: 0,
                itwPatterns: 0,
                deptPatterns: 0,
                rtwVehicles: 0,
                nefVehicles: 0
            },
            skipped: 0,
            errors: []
        };
        try {
            // Datei lesen und parsen
            const fileContent = (0, fs_1.readFileSync)(filePath, 'utf8');
            const data = JSON.parse(fileContent);
            // Validierung
            if (!data.metadata || !data.metadata.version) {
                result.errors.push('Ungültiges Dateiformat: Fehlende Metadaten');
                return result;
            }
            await this.db.run('BEGIN');
            try {
                // Settings importieren
                if (data.settings && Array.isArray(data.settings)) {
                    if (replaceExisting) {
                        await this.db.run('DELETE FROM settings');
                    }
                    for (const setting of data.settings) {
                        if (setting.key && setting.value !== undefined) {
                            await this.db.run(`
                INSERT INTO settings (key, value) VALUES (?, ?)
                ON CONFLICT(key) DO ${replaceExisting ? 'UPDATE SET value = excluded.value' : 'NOTHING'}
              `, [setting.key, setting.value]);
                            result.imported.settings++;
                        }
                    }
                }
                // ShiftTypes importieren
                if (data.shiftTypes && Array.isArray(data.shiftTypes)) {
                    if (replaceExisting) {
                        await this.db.run('DELETE FROM shift_types');
                    }
                    for (const shiftType of data.shiftTypes) {
                        if (shiftType.code && shiftType.description !== undefined) {
                            if (replaceExisting) {
                                await this.db.run(`
                  INSERT INTO shift_types (code, description) VALUES (?, ?)
                `, [shiftType.code, shiftType.description]);
                            }
                            else {
                                // Nur hinzufügen wenn noch nicht vorhanden
                                const existing = await this.db.get('SELECT id FROM shift_types WHERE code = ?', [shiftType.code]);
                                if (!existing) {
                                    await this.db.run(`
                    INSERT INTO shift_types (code, description) VALUES (?, ?)
                  `, [shiftType.code, shiftType.description]);
                                    result.imported.shiftTypes++;
                                }
                                else {
                                    result.skipped++;
                                }
                            }
                            if (replaceExisting)
                                result.imported.shiftTypes++;
                        }
                    }
                }
                // Holidays importieren
                if (data.holidays && Array.isArray(data.holidays)) {
                    if (replaceExisting) {
                        await this.db.run('DELETE FROM holidays');
                    }
                    for (const holiday of data.holidays) {
                        if (holiday.date && /^\d{4}-\d{2}-\d{2}$/.test(holiday.date)) {
                            await this.db.run(`
                INSERT INTO holidays (date, name) VALUES (?, ?)
                ON CONFLICT(date) DO ${replaceExisting ? 'UPDATE SET name = excluded.name' : 'NOTHING'}
              `, [holiday.date, holiday.name || '']);
                            result.imported.holidays++;
                        }
                    }
                }
                // ITW-Patterns importieren
                if (data.itwPatterns && Array.isArray(data.itwPatterns)) {
                    if (replaceExisting) {
                        await this.db.run('DELETE FROM itw_patterns');
                    }
                    for (const pattern of data.itwPatterns) {
                        if (pattern.start_date && pattern.pattern) {
                            await this.db.run(`
                INSERT INTO itw_patterns (start_date, pattern) VALUES (?, ?)
                ON CONFLICT(start_date) DO ${replaceExisting ? 'UPDATE SET pattern = excluded.pattern' : 'NOTHING'}
              `, [pattern.start_date, pattern.pattern]);
                            result.imported.itwPatterns++;
                        }
                    }
                }
                // Department-Patterns importieren
                if (data.deptPatterns && Array.isArray(data.deptPatterns)) {
                    if (replaceExisting) {
                        await this.db.run('DELETE FROM dept_patterns');
                    }
                    for (const pattern of data.deptPatterns) {
                        if (pattern.start_date && pattern.pattern) {
                            await this.db.run(`
                INSERT INTO dept_patterns (start_date, pattern) VALUES (?, ?)
                ON CONFLICT(start_date) DO ${replaceExisting ? 'UPDATE SET pattern = excluded.pattern' : 'NOTHING'}
              `, [pattern.start_date, pattern.pattern]);
                            result.imported.deptPatterns++;
                        }
                    }
                }
                // RTW-Vehicles importieren
                if (data.rtwVehicles && Array.isArray(data.rtwVehicles)) {
                    if (replaceExisting) {
                        await this.db.run('DELETE FROM rtw_vehicles');
                    }
                    for (const vehicle of data.rtwVehicles) {
                        if (vehicle.name) {
                            if (replaceExisting) {
                                await this.db.run(`
                  INSERT INTO rtw_vehicles (name, sort, archived_year) VALUES (?, ?, ?)
                `, [vehicle.name, vehicle.sort || 0, vehicle.archived_year || null]);
                                result.imported.rtwVehicles++;
                            }
                            else {
                                const existing = await this.db.get('SELECT id FROM rtw_vehicles WHERE name = ?', [vehicle.name]);
                                if (!existing) {
                                    await this.db.run(`
                    INSERT INTO rtw_vehicles (name, sort, archived_year) VALUES (?, ?, ?)
                  `, [vehicle.name, vehicle.sort || 0, vehicle.archived_year || null]);
                                    result.imported.rtwVehicles++;
                                }
                                else {
                                    result.skipped++;
                                }
                            }
                        }
                    }
                }
                // NEF-Vehicles importieren
                if (data.nefVehicles && Array.isArray(data.nefVehicles)) {
                    if (replaceExisting) {
                        await this.db.run('DELETE FROM nef_vehicles');
                    }
                    for (const vehicle of data.nefVehicles) {
                        if (vehicle.name) {
                            if (replaceExisting) {
                                await this.db.run(`
                  INSERT INTO nef_vehicles (name, sort, archived_year, occupancy_mode) VALUES (?, ?, ?, ?)
                `, [vehicle.name, vehicle.sort || 0, vehicle.archived_year || null, vehicle.occupancy_mode || '24h']);
                                result.imported.nefVehicles++;
                            }
                            else {
                                const existing = await this.db.get('SELECT id FROM nef_vehicles WHERE name = ?', [vehicle.name]);
                                if (!existing) {
                                    await this.db.run(`
                    INSERT INTO nef_vehicles (name, sort, archived_year, occupancy_mode) VALUES (?, ?, ?, ?)
                  `, [vehicle.name, vehicle.sort || 0, vehicle.archived_year || null, vehicle.occupancy_mode || '24h']);
                                    result.imported.nefVehicles++;
                                }
                                else {
                                    result.skipped++;
                                }
                            }
                        }
                    }
                }
                await this.db.run('COMMIT');
                result.success = true;
                console.log('[SettingsImporter] Settings imported successfully:', result);
            }
            catch (error) {
                await this.db.run('ROLLBACK');
                throw error;
            }
        }
        catch (error) {
            console.error('[SettingsImporter] Import failed:', error);
            result.errors.push(`Import fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`);
        }
        return result;
    }
    /**
     * Erstellt eine leere Vorlage für Settings-Import
     */
    async createSettingsTemplate(filePath) {
        try {
            const templateData = {
                metadata: {
                    version: '1.0',
                    exportDate: new Date().toISOString(),
                    appVersion: '1.0.0'
                },
                settings: [
                    { key: 'rescueStation', value: '1' },
                    { key: 'year', value: '2025' },
                    { key: 'department', value: '1' }
                ],
                shiftTypes: [
                    { id: 1, code: 'FD', description: 'Frühdienst' },
                    { id: 2, code: 'SD', description: 'Spätdienst' },
                    { id: 3, code: 'ND', description: 'Nachtdienst' }
                ],
                holidays: [
                    { date: '2025-01-01', name: 'Neujahr' },
                    { date: '2025-12-25', name: 'Weihnachten' }
                ],
                itwPatterns: [
                    { start_date: '2025-01-01', pattern: 'IW,,,,IW,,,,IW,,,,IW,,,,IW,,,,I' }
                ],
                deptPatterns: [
                    { start_date: '2025-01-01', pattern: '1,2,3,1,2,3,1,2,3,1,2,3,1,2,3,1,2,3,1,2,3' }
                ],
                rtwVehicles: [
                    { id: 1, name: 'RTW 1', sort: 0, archived_year: undefined }
                ],
                nefVehicles: [
                    { id: 1, name: 'NEF 1', sort: 0, archived_year: undefined, occupancy_mode: '24h' }
                ]
            };
            if (filePath.endsWith('.json')) {
                (0, fs_1.writeFileSync)(filePath, JSON.stringify(templateData, null, 2), 'utf8');
            }
            else {
                // Excel-Template
                const wb = XLSX.utils.book_new();
                // Anleitung-Sheet
                const instructionData = [
                    ['RD-Plan Settings Import Vorlage'],
                    [''],
                    ['Diese Datei dient als Vorlage für den Import von Einstellungen.'],
                    ['Füllen Sie die entsprechenden Sheets aus und importieren Sie die Datei.'],
                    [''],
                    ['Hinweise:'],
                    ['- Die ID-Spalten in Fahrzeugen können ignoriert werden (werden automatisch vergeben)'],
                    ['- Datums-Format: YYYY-MM-DD'],
                    ['- Muster-Format: Komma-getrennte Werte'],
                    ['- NEF Besetzungsmodus: "24h" oder "tag"']
                ];
                const instructionWs = XLSX.utils.aoa_to_sheet(instructionData);
                XLSX.utils.book_append_sheet(wb, instructionWs, 'Anleitung');
                // Template-Sheets basierend auf den Daten erstellen...
                // (gleiche Logik wie beim Export, aber mit Beispieldaten)
                XLSX.writeFile(wb, filePath);
            }
            console.log('[SettingsImporter] Template created:', filePath);
        }
        catch (error) {
            console.error('[SettingsImporter] Template creation failed:', error);
            throw new Error(`Template-Erstellung fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}
exports.SettingsImporter = SettingsImporter;
