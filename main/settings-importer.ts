import * as XLSX from 'xlsx';
import { writeFileSync, readFileSync } from 'fs';
import { AsyncDB } from './database';

export interface SettingsExportData {
  metadata: {
    version: string;
    exportDate: string;
    appVersion: string;
  };
  settings: Array<{ key: string; value: string }>;
  shiftTypes: Array<{ id: number; code: string; description: string }>;
  holidays: Array<{ date: string; name: string }>;
  itwPatterns: Array<{ start_date: string; pattern: string }>;
  deptPatterns: Array<{ start_date: string; pattern: string }>;
  rtwVehicles: Array<{ id: number; name: string; sort: number; archived_year?: number }>;
  nefVehicles: Array<{ id: number; name: string; sort: number; archived_year?: number; occupancy_mode: string }>;
  itwVehicles: Array<{ id: number; name: string; sort: number; archived_year?: number }>;
  qualificationTypes: Array<{ id: number; name: string; description?: string; category: string; active: boolean; sort: number }>;
  vehiclePositions: Array<{ id: number; vehicleType: string; vehicleId: number; positionName: string; qualificationTypeId: number | null; sort: number }>;
  rtwVehiclePeriods: Array<{ id: number; vehicleId: number; startYM: string; endYM: string | null; active: boolean }>;
  nefVehiclePeriods: Array<{ id: number; vehicleId: number; startYM: string; endYM: string | null; active: boolean }>;
  itwVehiclePeriods: Array<{ id: number; vehicleId: number; startYM: string; endYM: string | null; active: boolean }>;
}

export interface SettingsImportResult {
  success: boolean;
  imported: {
    settings: number;
    shiftTypes: number;
    holidays: number;
    itwPatterns: number;
    deptPatterns: number;
    rtwVehicles: number;
    nefVehicles: number;
    itwVehicles: number;
    qualificationTypes: number;
    vehiclePositions: number;
    rtwVehiclePeriods: number;
    nefVehiclePeriods: number;
    itwVehiclePeriods: number;
  };
  skipped: number;
  errors: string[];
}

export class SettingsImporter {
  
  constructor(private db: AsyncDB) {}

  /**
   * Exportiert alle Einstellungen in eine JSON-Datei
   */
  async exportSettingsToJson(filePath: string): Promise<void> {
    try {
      // Sammle alle Einstellungsdaten
      const settings = await this.db.all('SELECT key, value FROM settings ORDER BY key');
      const shiftTypes = await this.db.all('SELECT id, code, description FROM shift_types ORDER BY code');
      const holidays = await this.db.all('SELECT date, name FROM holidays ORDER BY date');
      const itwPatterns = await this.db.all('SELECT start_date, pattern FROM itw_patterns ORDER BY start_date');
      const deptPatterns = await this.db.all('SELECT start_date, pattern FROM dept_patterns ORDER BY start_date');
      const rtwVehicles = await this.db.all('SELECT id, name, sort, archived_year FROM rtw_vehicles ORDER BY sort');
      const nefVehicles = await this.db.all('SELECT id, name, sort, archived_year, occupancy_mode FROM nef_vehicles ORDER by sort');
      const itwVehicles = await this.db.all('SELECT id, name, sort, archived_year FROM itw_vehicles ORDER BY sort');
      const qualificationTypes = await this.db.all('SELECT id, name, description, category, active, sort FROM qualification_types ORDER BY sort, name');
      const vehiclePositions = await this.db.all('SELECT id, vehicleType, vehicleId, positionName, qualificationTypeId, sort FROM vehicle_positions ORDER BY vehicleType, vehicleId, sort');
      const rtwVehiclePeriods = await this.db.all('SELECT id, vehicleId, startYM, endYM, active FROM rtw_vehicle_periods ORDER BY vehicleId, startYM');
      const nefVehiclePeriods = await this.db.all('SELECT id, vehicleId, startYM, endYM, active FROM nef_vehicle_periods ORDER BY vehicleId, startYM');
      const itwVehiclePeriods = await this.db.all('SELECT id, vehicleId, startYM, endYM, active FROM itw_vehicle_periods ORDER BY vehicleId, startYM');

      const exportData: SettingsExportData = {
        metadata: {
          version: '1.1',
          exportDate: new Date().toISOString(),
          appVersion: '1.0.0'
        },
        settings: settings || [],
        shiftTypes: shiftTypes || [],
        holidays: holidays || [],
        itwPatterns: itwPatterns || [],
        deptPatterns: deptPatterns || [],
        rtwVehicles: rtwVehicles || [],
        nefVehicles: nefVehicles || [],
        itwVehicles: itwVehicles || [],
        qualificationTypes: qualificationTypes || [],
        vehiclePositions: vehiclePositions || [],
        rtwVehiclePeriods: rtwVehiclePeriods || [],
        nefVehiclePeriods: nefVehiclePeriods || [],
        itwVehiclePeriods: itwVehiclePeriods || []
      };

      // Als JSON speichern
      writeFileSync(filePath, JSON.stringify(exportData, null, 2), 'utf8');
      console.log('[SettingsImporter] Settings exported to JSON:', filePath);
    } catch (error) {
      console.error('[SettingsImporter] Export to JSON failed:', error);
      throw new Error(`Settings-Export fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Exportiert alle Einstellungen in eine Excel-Datei
   */
  async exportSettingsToExcel(filePath: string): Promise<void> {
    try {
      // Sammle alle Einstellungsdaten
      const settings = await this.db.all('SELECT key, value FROM settings ORDER BY key');
      const shiftTypes = await this.db.all('SELECT id, code, description FROM shift_types ORDER BY code');
      const holidays = await this.db.all('SELECT date, name FROM holidays ORDER BY date');
      const itwPatterns = await this.db.all('SELECT start_date, pattern FROM itw_patterns ORDER BY start_date');
      const deptPatterns = await this.db.all('SELECT start_date, pattern FROM dept_patterns ORDER BY start_date');
      const rtwVehicles = await this.db.all('SELECT id, name, sort, archived_year FROM rtw_vehicles ORDER BY sort');
      const nefVehicles = await this.db.all('SELECT id, name, sort, archived_year, occupancy_mode FROM nef_vehicles ORDER BY sort');
      const itwVehicles = await this.db.all('SELECT id, name, sort, archived_year FROM itw_vehicles ORDER BY sort');
      const qualificationTypes = await this.db.all('SELECT id, name, description, category, active, sort FROM qualification_types ORDER BY sort, name');
      const vehiclePositions = await this.db.all('SELECT id, vehicleType, vehicleId, positionName, qualificationTypeId, sort FROM vehicle_positions ORDER BY vehicleType, vehicleId, sort');
      const rtwVehiclePeriods = await this.db.all('SELECT id, vehicleId, startYM, endYM, active FROM rtw_vehicle_periods ORDER BY vehicleId, startYM');
      const nefVehiclePeriods = await this.db.all('SELECT id, vehicleId, startYM, endYM, active FROM nef_vehicle_periods ORDER BY vehicleId, startYM');
      const itwVehiclePeriods = await this.db.all('SELECT id, vehicleId, startYM, endYM, active FROM itw_vehicle_periods ORDER BY vehicleId, startYM');

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

      // ITW-Vehicles-Sheet
      if (itwVehicles && itwVehicles.length > 0) {
        const itwData = [
          ['ID', 'Name', 'Sortierung'],
          ...itwVehicles.map(v => [v.id, v.name, v.sort])
        ];
        const itwWs = XLSX.utils.aoa_to_sheet(itwData);
        XLSX.utils.book_append_sheet(wb, itwWs, 'ITW-Fahrzeuge');
      }

      // QualificationTypes-Sheet
      if (qualificationTypes && qualificationTypes.length > 0) {
        const qualData = [
          ['ID', 'Name', 'Beschreibung', 'Kategorie', 'Aktiv', 'Sortierung'],
          ...qualificationTypes.map(qt => [qt.id, qt.name, qt.description || '', qt.category, qt.active ? 'Ja' : 'Nein', qt.sort])
        ];
        const qualWs = XLSX.utils.aoa_to_sheet(qualData);
        XLSX.utils.book_append_sheet(wb, qualWs, 'Qualifikationstypen');
      }

      // VehiclePositions-Sheet
      if (vehiclePositions && vehiclePositions.length > 0) {
        const vpData = [
          ['ID', 'FahrzeugTyp', 'FahrzeugID', 'Position', 'QualifikationID', 'Sortierung'],
          ...vehiclePositions.map(vp => [vp.id, vp.vehicleType, vp.vehicleId, vp.positionName, vp.qualificationTypeId || '', vp.sort])
        ];
        const vpWs = XLSX.utils.aoa_to_sheet(vpData);
        XLSX.utils.book_append_sheet(wb, vpWs, 'Fahrzeug-Positionen');
      }

      // RTW-VehiclePeriods-Sheet
      if (rtwVehiclePeriods && rtwVehiclePeriods.length > 0) {
        const rtwPData = [
          ['ID', 'FahrzeugID', 'StartYM', 'EndYM', 'Aktiv'],
          ...rtwVehiclePeriods.map(p => [p.id, p.vehicleId, p.startYM, p.endYM || '', p.active ? 'Ja' : 'Nein'])
        ];
        const rtwPWs = XLSX.utils.aoa_to_sheet(rtwPData);
        XLSX.utils.book_append_sheet(wb, rtwPWs, 'RTW-Zeiträume');
      }

      // NEF-VehiclePeriods-Sheet
      if (nefVehiclePeriods && nefVehiclePeriods.length > 0) {
        const nefPData = [
          ['ID', 'FahrzeugID', 'StartYM', 'EndYM', 'Aktiv'],
          ...nefVehiclePeriods.map(p => [p.id, p.vehicleId, p.startYM, p.endYM || '', p.active ? 'Ja' : 'Nein'])
        ];
        const nefPWs = XLSX.utils.aoa_to_sheet(nefPData);
        XLSX.utils.book_append_sheet(wb, nefPWs, 'NEF-Zeiträume');
      }

      // ITW-VehiclePeriods-Sheet
      if (itwVehiclePeriods && itwVehiclePeriods.length > 0) {
        const itwPData = [
          ['ID', 'FahrzeugID', 'StartYM', 'EndYM', 'Aktiv'],
          ...itwVehiclePeriods.map(p => [p.id, p.vehicleId, p.startYM, p.endYM || '', p.active ? 'Ja' : 'Nein'])
        ];
        const itwPWs = XLSX.utils.aoa_to_sheet(itwPData);
        XLSX.utils.book_append_sheet(wb, itwPWs, 'ITW-Zeiträume');
      }

      // Speichere Excel-Datei
      XLSX.writeFile(wb, filePath);
      console.log('[SettingsImporter] Settings exported to Excel:', filePath);
    } catch (error) {
      console.error('[SettingsImporter] Export to Excel failed:', error);
      throw new Error(`Settings-Export fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Importiert Einstellungen aus einer JSON-Datei
   */
  async importSettingsFromJson(filePath: string, replaceExisting: boolean = false): Promise<SettingsImportResult> {
    const result: SettingsImportResult = {
      success: false,
      imported: {
        settings: 0,
        shiftTypes: 0,
        holidays: 0,
        itwPatterns: 0,
        deptPatterns: 0,
        rtwVehicles: 0,
        nefVehicles: 0,
        itwVehicles: 0,
        qualificationTypes: 0,
        vehiclePositions: 0,
        rtwVehiclePeriods: 0,
        nefVehiclePeriods: 0,
        itwVehiclePeriods: 0
      },
      skipped: 0,
      errors: []
    };

    try {
      // Datei lesen und parsen
      const fileContent = readFileSync(filePath, 'utf8');
      const data: SettingsExportData = JSON.parse(fileContent);

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
              } else {
                // Nur hinzufügen wenn noch nicht vorhanden
                const existing = await this.db.get('SELECT id FROM shift_types WHERE code = ?', [shiftType.code]);
                if (!existing) {
                  await this.db.run(`
                    INSERT INTO shift_types (code, description) VALUES (?, ?)
                  `, [shiftType.code, shiftType.description]);
                  result.imported.shiftTypes++;
                } else {
                  result.skipped++;
                }
              }
              if (replaceExisting) result.imported.shiftTypes++;
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
              } else {
                const existing = await this.db.get('SELECT id FROM rtw_vehicles WHERE name = ?', [vehicle.name]);
                if (!existing) {
                  await this.db.run(`
                    INSERT INTO rtw_vehicles (name, sort, archived_year) VALUES (?, ?, ?)
                  `, [vehicle.name, vehicle.sort || 0, vehicle.archived_year || null]);
                  result.imported.rtwVehicles++;
                } else {
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
              } else {
                const existing = await this.db.get('SELECT id FROM nef_vehicles WHERE name = ?', [vehicle.name]);
                if (!existing) {
                  await this.db.run(`
                    INSERT INTO nef_vehicles (name, sort, archived_year, occupancy_mode) VALUES (?, ?, ?, ?)
                  `, [vehicle.name, vehicle.sort || 0, vehicle.archived_year || null, vehicle.occupancy_mode || '24h']);
                  result.imported.nefVehicles++;
                } else {
                  result.skipped++;
                }
              }
            }
          }
        }

        // ITW-Vehicles importieren
        if (data.itwVehicles && Array.isArray(data.itwVehicles)) {
          if (replaceExisting) {
            await this.db.run('DELETE FROM itw_vehicles');
          }
          
          for (const vehicle of data.itwVehicles) {
            if (vehicle.name) {
              if (replaceExisting) {
                await this.db.run(`
                  INSERT INTO itw_vehicles (name, sort) VALUES (?, ?)
                `, [vehicle.name, vehicle.sort || 0]);
                result.imported.itwVehicles++;
              } else {
                const existing = await this.db.get('SELECT id FROM itw_vehicles WHERE name = ?', [vehicle.name]);
                if (!existing) {
                  await this.db.run(`
                    INSERT INTO itw_vehicles (name, sort) VALUES (?, ?)
                  `, [vehicle.name, vehicle.sort || 0]);
                  result.imported.itwVehicles++;
                } else {
                  result.skipped++;
                }
              }
            }
          }
        }

        // Qualification Types importieren
        if (data.qualificationTypes && Array.isArray(data.qualificationTypes)) {
          console.log(`[SettingsImporter] Importiere ${data.qualificationTypes.length} Qualifikationstypen...`);
          if (replaceExisting) {
            await this.db.run('DELETE FROM qualification_types');
            console.log('[SettingsImporter] Bestehende Qualifikationstypen gelöscht');
          }
          
          for (const qualType of data.qualificationTypes) {
            if (qualType.name && qualType.category) {
              if (replaceExisting) {
                await this.db.run(`
                  INSERT INTO qualification_types (name, description, category, active, sort) VALUES (?, ?, ?, ?, ?)
                `, [qualType.name, qualType.description || '', qualType.category, qualType.active !== false, qualType.sort || 0]);
                result.imported.qualificationTypes++;
                console.log(`[SettingsImporter] ✓ Qualifikation importiert: ${qualType.name} (${qualType.category})`);
              } else {
                const existing = await this.db.get('SELECT id FROM qualification_types WHERE name = ? AND category = ?', [qualType.name, qualType.category]);
                if (!existing) {
                  await this.db.run(`
                    INSERT INTO qualification_types (name, description, category, active, sort) VALUES (?, ?, ?, ?, ?)
                  `, [qualType.name, qualType.description || '', qualType.category, qualType.active !== false, qualType.sort || 0]);
                  result.imported.qualificationTypes++;
                  console.log(`[SettingsImporter] ✓ Qualifikation importiert: ${qualType.name} (${qualType.category})`);
                } else {
                  result.skipped++;
                  console.log(`[SettingsImporter] ⊘ Qualifikation übersprungen (existiert): ${qualType.name}`);
                }
              }
            } else {
              console.log(`[SettingsImporter] ✗ Qualifikation ungültig (fehlt name oder category):`, qualType);
            }
          }
          console.log(`[SettingsImporter] Qualifikationstypen-Import abgeschlossen: ${result.imported.qualificationTypes} importiert`);
        } else {
          console.log('[SettingsImporter] Keine Qualifikationstypen in Import-Datei gefunden');
        }

        // VehiclePositions importieren
        if (data.vehiclePositions && Array.isArray(data.vehiclePositions)) {
          if (replaceExisting) {
            await this.db.run('DELETE FROM vehicle_positions');
          }
          
          for (const vp of data.vehiclePositions) {
            if (vp.vehicleType && vp.vehicleId && vp.positionName) {
              if (replaceExisting) {
                await this.db.run(`
                  INSERT INTO vehicle_positions (vehicleType, vehicleId, positionName, qualificationTypeId, sort) VALUES (?, ?, ?, ?, ?)
                `, [vp.vehicleType, vp.vehicleId, vp.positionName, vp.qualificationTypeId || null, vp.sort || 0]);
                result.imported.vehiclePositions++;
              } else {
                const existing = await this.db.get('SELECT id FROM vehicle_positions WHERE vehicleType = ? AND vehicleId = ? AND positionName = ?', [vp.vehicleType, vp.vehicleId, vp.positionName]);
                if (!existing) {
                  await this.db.run(`
                    INSERT INTO vehicle_positions (vehicleType, vehicleId, positionName, qualificationTypeId, sort) VALUES (?, ?, ?, ?, ?)
                  `, [vp.vehicleType, vp.vehicleId, vp.positionName, vp.qualificationTypeId || null, vp.sort || 0]);
                  result.imported.vehiclePositions++;
                } else {
                  result.skipped++;
                }
              }
            }
          }
        }

        // RTW-VehiclePeriods importieren
        if (data.rtwVehiclePeriods && Array.isArray(data.rtwVehiclePeriods)) {
          if (replaceExisting) {
            await this.db.run('DELETE FROM rtw_vehicle_periods');
          }
          
          for (const p of data.rtwVehiclePeriods) {
            if (p.vehicleId && p.startYM) {
              if (replaceExisting) {
                await this.db.run(`
                  INSERT INTO rtw_vehicle_periods (vehicleId, startYM, endYM, active) VALUES (?, ?, ?, ?)
                `, [p.vehicleId, p.startYM, p.endYM || null, p.active !== false]);
                result.imported.rtwVehiclePeriods++;
              } else {
                // Check for duplicate period? Maybe just insert if not exact match?
                // For simplicity, check if same vehicle and startYM exists
                const existing = await this.db.get('SELECT id FROM rtw_vehicle_periods WHERE vehicleId = ? AND startYM = ?', [p.vehicleId, p.startYM]);
                if (!existing) {
                  await this.db.run(`
                    INSERT INTO rtw_vehicle_periods (vehicleId, startYM, endYM, active) VALUES (?, ?, ?, ?)
                  `, [p.vehicleId, p.startYM, p.endYM || null, p.active !== false]);
                  result.imported.rtwVehiclePeriods++;
                } else {
                  result.skipped++;
                }
              }
            }
          }
        }

        // NEF-VehiclePeriods importieren
        if (data.nefVehiclePeriods && Array.isArray(data.nefVehiclePeriods)) {
          if (replaceExisting) {
            await this.db.run('DELETE FROM nef_vehicle_periods');
          }
          
          for (const p of data.nefVehiclePeriods) {
            if (p.vehicleId && p.startYM) {
              if (replaceExisting) {
                await this.db.run(`
                  INSERT INTO nef_vehicle_periods (vehicleId, startYM, endYM, active) VALUES (?, ?, ?, ?)
                `, [p.vehicleId, p.startYM, p.endYM || null, p.active !== false]);
                result.imported.nefVehiclePeriods++;
              } else {
                const existing = await this.db.get('SELECT id FROM nef_vehicle_periods WHERE vehicleId = ? AND startYM = ?', [p.vehicleId, p.startYM]);
                if (!existing) {
                  await this.db.run(`
                    INSERT INTO nef_vehicle_periods (vehicleId, startYM, endYM, active) VALUES (?, ?, ?, ?)
                  `, [p.vehicleId, p.startYM, p.endYM || null, p.active !== false]);
                  result.imported.nefVehiclePeriods++;
                } else {
                  result.skipped++;
                }
              }
            }
          }
        }

        // ITW-VehiclePeriods importieren
        if (data.itwVehiclePeriods && Array.isArray(data.itwVehiclePeriods)) {
          if (replaceExisting) {
            await this.db.run('DELETE FROM itw_vehicle_periods');
          }
          
          for (const p of data.itwVehiclePeriods) {
            if (p.vehicleId && p.startYM) {
              if (replaceExisting) {
                await this.db.run(`
                  INSERT INTO itw_vehicle_periods (vehicleId, startYM, endYM, active) VALUES (?, ?, ?, ?)
                `, [p.vehicleId, p.startYM, p.endYM || null, p.active !== false]);
                result.imported.itwVehiclePeriods++;
              } else {
                const existing = await this.db.get('SELECT id FROM itw_vehicle_periods WHERE vehicleId = ? AND startYM = ?', [p.vehicleId, p.startYM]);
                if (!existing) {
                  await this.db.run(`
                    INSERT INTO itw_vehicle_periods (vehicleId, startYM, endYM, active) VALUES (?, ?, ?, ?)
                  `, [p.vehicleId, p.startYM, p.endYM || null, p.active !== false]);
                  result.imported.itwVehiclePeriods++;
                } else {
                  result.skipped++;
                }
              }
            }
          }
        }

        await this.db.run('COMMIT');
        result.success = true;
        console.log('[SettingsImporter] Settings imported successfully:', result);

      } catch (error) {
        await this.db.run('ROLLBACK');
        throw error;
      }

    } catch (error) {
      console.error('[SettingsImporter] Import failed:', error);
      result.errors.push(`Import fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`);
    }

    return result;
  }

  /**
   * Erstellt eine leere Vorlage für Settings-Import
   */
  async createSettingsTemplate(filePath: string): Promise<void> {
    try {
      const templateData: SettingsExportData = {
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
        ],
        itwVehicles: [
          { id: 1, name: 'ITW 1', sort: 0 }
        ],
        qualificationTypes: [
          { id: 1, name: 'Rettungssanitäter', description: 'Rettungssanitäter Ausbildung', category: 'Medizin', active: true, sort: 1 },
          { id: 2, name: 'Rettungsassistent', description: 'Rettungsassistent Ausbildung', category: 'Medizin', active: true, sort: 2 },
          { id: 3, name: 'Notfallsanitäter', description: 'Notfallsanitäter Ausbildung', category: 'Medizin', active: true, sort: 3 },
          { id: 4, name: 'Gruppenführer', description: 'Gruppenführer Ausbildung', category: 'Führung', active: true, sort: 1 }
        ],
        vehiclePositions: [
          { id: 1, vehicleType: 'rtw', vehicleId: 1, positionName: 'Fahrer', qualificationTypeId: 1, sort: 1 },
          { id: 2, vehicleType: 'rtw', vehicleId: 1, positionName: 'Beifahrer', qualificationTypeId: 3, sort: 2 }
        ],
        rtwVehiclePeriods: [
          { id: 1, vehicleId: 1, startYM: '2025-01', endYM: null, active: true }
        ],
        nefVehiclePeriods: [
          { id: 1, vehicleId: 1, startYM: '2025-01', endYM: null, active: true }
        ],
        itwVehiclePeriods: [
          { id: 1, vehicleId: 1, startYM: '2025-01', endYM: null, active: true }
        ]
      };

      if (filePath.endsWith('.json')) {
        writeFileSync(filePath, JSON.stringify(templateData, null, 2), 'utf8');
      } else {
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
    } catch (error) {
      console.error('[SettingsImporter] Template creation failed:', error);
      throw new Error(`Template-Erstellung fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}