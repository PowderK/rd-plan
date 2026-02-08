import * as XLSX from 'xlsx';
import { AsyncDB } from './database';

export interface PersonnelImportData {
  name: string;
  vorname: string;
  active?: boolean;
  teilzeit?: number;
  role?: string;
  personnelNumber?: string;
  // Alte Qualifikationen für Backward-Kompatibilität
  fahrzeugfuehrer?: boolean;
  fahrzeugfuehrerHLFB?: boolean;
  nef?: boolean;
  itwMaschinist?: boolean;
  itwFahrzeugfuehrer?: boolean;
  // Neue Qualifikations-Zeiträume für Export-Format
  qualifications?: Array<{ qualType: string; startYM: string; endYM: string | null }>;
  // Neue Aktivitäts-Zeiträume
  activePeriods?: Array<{ startYM: string; endYM: string | null; description?: string }>;
}

export interface AzubiImportData {
  name: string;
  vorname: string;
  lehrjahr: number;
  periods?: Array<{ start_date: string; end_date: string | null; description?: string }>;
}

export interface ImportResult {
  success: boolean;
  imported: number;
  updated: number;
  skipped: number;
  errors: string[];
  data: PersonnelImportData[];
  azubis?: AzubiImportData[];
}

export class ExcelPersonnelImporter {
  private db: AsyncDB;

  constructor(db: AsyncDB) {
    this.db = db;
  }

  /**
   * Parst eine Excel-Datei und extrahiert Personal-Daten UND Azubi-Daten
   * Unterstützt zwei Formate:
   * 1. Neues Export-Format: Personal-Sheet + Azubis-Sheet mit Zeiträumen
   * 2. Legacy-Format: Nur Personal-Sheet
   */
  parseExcelFile(filePath: string): { personnel: PersonnelImportData[]; azubis: AzubiImportData[] } {
    try {
      const workbook = XLSX.readFile(filePath);
      console.log('[ExcelImporter] Workbook-Sheets:', workbook.SheetNames);

      // Verarbeite Personal-Sheet
      const personnelSheetName = workbook.SheetNames[0];
      const personnelSheet = workbook.Sheets[personnelSheetName];

      // Lese Header-Zeile, um Format zu erkennen
      const headerRow = XLSX.utils.sheet_to_json<any[]>(personnelSheet, { header: 1, range: 0 })[0] as any[];
      console.log('[ExcelImporter] Personal Header gefunden:', headerRow);

      // Prüfe, ob es das neue Export-Format ist (enthält "_Von" oder "_Bis" Spalten)
      const isNewFormat = headerRow.some((h: any) =>
        typeof h === 'string' && (h.includes('_Von') || h.includes('_Bis'))
      );

      console.log('[ExcelImporter] Format-Erkennung:', isNewFormat ? 'Neues Export-Format' : 'Legacy-Format');

      let personnel: PersonnelImportData[];
      if (isNewFormat) {
        // Neues Format: Lese mit Header-Namen und extrahiere Qualifikationen
        const data = XLSX.utils.sheet_to_json(personnelSheet);
        console.log(`[ExcelImporter] Gelesene Personal-Zeilen (Neues Format):`, data.length);
        if (data.length > 0) console.log(`[ExcelImporter] Erste Zeile:`, data[0]);
        personnel = data.map((row: any) => this.parseNewFormatRow(row, headerRow)).filter(p => p !== null) as PersonnelImportData[];
        console.log(`[ExcelImporter] Geparste Personen:`, personnel.length);
      } else {
        // Legacy-Format: Feste Spalten-Reihenfolge
        const data = XLSX.utils.sheet_to_json(personnelSheet, {
          header: ['name', 'vorname', 'active', 'teilzeit', 'fahrzeugfuehrer', 'fahrzeugfuehrerHLFB', 'nef', 'itwMaschinist', 'itwFahrzeugfuehrer'],
          range: 1
        });
        personnel = data.map((row: any) => this.parsePersonnelRow(row)).filter(p => p !== null) as PersonnelImportData[];
      }

      // Verarbeite Azubis-Sheet (falls vorhanden)
      let azubis: AzubiImportData[] = [];
      if (workbook.SheetNames.includes('Azubis')) {
        console.log('[ExcelImporter] ✓ Azubis-Sheet gefunden, verarbeite...');
        const azubiSheet = workbook.Sheets['Azubis'];
        azubis = this.parseAzubiSheet(azubiSheet);
        console.log(`[ExcelImporter] ✓ ${azubis.length} Azubis geparst (mit ${azubis.reduce((sum, a) => sum + (a.periods?.length || 0), 0)} Zeiträumen)`);
      } else {
        console.log('[ExcelImporter] ✗ Kein Azubis-Sheet gefunden in Sheets:', workbook.SheetNames);
      }

      return { personnel, azubis };
    } catch (error) {
      console.error('[ExcelImporter] Fehler beim Lesen der Excel-Datei:', error);
      throw new Error(`Excel-Datei konnte nicht gelesen werden: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Parst das Azubi-Sheet und gruppiert Zeiträume pro Azubi
   */
  private parseAzubiSheet(sheet: XLSX.WorkSheet): AzubiImportData[] {
    const data = XLSX.utils.sheet_to_json(sheet);
    console.log(`[ExcelImporter] Azubi-Sheet: ${data.length} Zeilen gelesen`);

    if (data.length > 0) {
      console.log(`[ExcelImporter] Erste Azubi-Zeile:`, data[0]);
      console.log(`[ExcelImporter] Azubi-Headers:`, Object.keys(data[0] as any));
    }

    // Gruppiere nach Name/Vorname
    const azubiMap = new Map<string, AzubiImportData>();

    for (const row of data as any[]) {
      if (!row['Name'] || typeof row['Name'] !== 'string' || row['Name'].trim() === '') {
        console.log(`[ExcelImporter] ✗ Überspringe Azubi-Zeile ohne Namen:`, row);
        continue;
      }

      const name = String(row['Name']).trim();
      const vorname = row['Vorname'] ? String(row['Vorname']).trim() : '';
      const key = `${name}|${vorname}`;

      // Hole oder erstelle Azubi-Eintrag
      if (!azubiMap.has(key)) {
        // Versuche Lehrjahr zu parsen, default 1
        let lehrjahr = 1;
        if (row['Lehrjahr']) {
          const parsed = parseInt(String(row['Lehrjahr']), 10);
          if (!isNaN(parsed)) {
            lehrjahr = parsed;
          }
        }

        azubiMap.set(key, {
          name,
          vorname,
          lehrjahr,
          periods: []
        });

        console.log(`[ExcelImporter] ✓ Neuer Azubi: ${name}, ${vorname} (Lehrjahr: ${lehrjahr})`);
      } else {
        // Update Lehrjahr falls in dieser Zeile vorhanden und im existierenden Eintrag nur Default (1) oder abweichend
        const azubi = azubiMap.get(key)!;
        if (row['Lehrjahr']) {
          const parsed = parseInt(String(row['Lehrjahr']), 10);
          if (!isNaN(parsed) && parsed !== azubi.lehrjahr) {
            console.log(`[ExcelImporter] Update Lehrjahr für ${name}: ${azubi.lehrjahr} -> ${parsed}`);
            azubi.lehrjahr = parsed;
          }
        }
      }

      const azubi = azubiMap.get(key)!;

      // Füge Zeitraum hinzu (falls vorhanden)
      if (row['Von'] && row['Von'].toString().trim() !== '') {
        const start_date = String(row['Von']).trim();
        const end_date = row['Bis'] && row['Bis'].toString().trim() !== '' ? String(row['Bis']).trim() : null;
        const description = row['Beschreibung'] && row['Beschreibung'].toString().trim() !== '' ? String(row['Beschreibung']).trim() : '';

        azubi.periods!.push({
          start_date,
          end_date: end_date as any,
          description
        });

        console.log(`[ExcelImporter] ✓ Zeitraum für ${name}: ${start_date} - ${end_date || 'offen'} ${description ? `(${description})` : ''}`);
      } else {
        console.log(`[ExcelImporter] ⚠ Azubi ${name}, ${vorname}: Zeile ohne Von-Datum (wird ignoriert für Zeiträume)`);
      }
    }

    const result = Array.from(azubiMap.values());
    console.log(`[ExcelImporter] Azubi-Parsing abgeschlossen: ${result.length} eindeutige Azubis`);
    return result;
  }

  /**
   * Parst eine Zeile im neuen Export-Format
   * Format: Name, Vorname, Aktiv, [Qualifikation_Von, Qualifikation_Bis]+
   */
  private parseNewFormatRow(row: any, headerRow: any[]): PersonnelImportData | null {
    // Validierung: Name ist erforderlich
    if (!row['Name'] || typeof row['Name'] !== 'string' || row['Name'].trim() === '') {
      console.log(`[ExcelImporter] Skipping row - no valid Name field. Row keys:`, Object.keys(row));
      return null;
    }

    const name = String(row['Name']).trim();
    const vorname = row['Vorname'] ? String(row['Vorname']).trim() : '';
    const teilzeit = row['Teilzeit'] ? parseInt(String(row['Teilzeit']), 10) : 0;
    const personnelNumber = row['Personalnummer'] ? String(row['Personalnummer']).trim() : undefined;
    const role = row['Rolle'] ? String(row['Rolle']).trim() : undefined;

    console.log(`[ExcelImporter] Person: "${name}" "${vorname}" | Raw Name=${row['Name']}, Vorname=${row['Vorname']}, Teilzeit=${teilzeit}, Rolle=${role}`);

    // Extrahiere Qualifikationen aus den _Von/_Bis Spalten
    const qualifications: Array<{ qualType: string; startYM: string; endYM: string }> = [];

    // Finde alle Qualifikations-Spalten
    const qualTypes = new Set<string>();
    for (const header of headerRow) {
      if (typeof header === 'string' && header.includes('_Von')) {
        if (header === 'Aktiv_Von' || header.startsWith('Aktiv_')) {
          continue;
        }
        const qualType = header.replace('_Von', '');
        qualTypes.add(qualType);
      }
    }

    console.log(`[ExcelImporter] Found qualification types:`, Array.from(qualTypes));

    // Extrahiere Zeiträume für jede Qualifikation
    for (const qualType of qualTypes) {
      const startYM = row[`${qualType}_Von`];
      const endYM = row[`${qualType}_Bis`];

      // Nur hinzufügen, wenn mindestens startYM vorhanden ist
      if (startYM && startYM.toString().trim() !== '') {
        const startYMStr = String(startYM).trim();
        const endYMStr = endYM && endYM.toString().trim() !== '' ? String(endYM).trim() : null;

        qualifications.push({
          qualType,
          startYM: startYMStr,
          endYM: endYMStr as any
        });

        console.log(`[ExcelImporter] Added qualification: ${qualType}, ${startYMStr} - ${endYMStr}`);
      }
    }

    // Extrahiere Aktivitäts-Zeiträume (Aktiv_Von, Aktiv_Bis, Aktiv_Beschreibung)
    const activePeriods: Array<{ startYM: string; endYM: string; description?: string }> = [];
    const activeStart = row['Aktiv_Von'];
    const activeEnd = row['Aktiv_Bis'];
    const activeDesc = row['Aktiv_Beschreibung'];

    if (activeStart && activeStart.toString().trim() !== '') {
      const startYMStr = String(activeStart).trim();
      const endYMStr = activeEnd && activeEnd.toString().trim() !== '' ? String(activeEnd).trim() : null;
      const descStr = activeDesc ? String(activeDesc).trim() : '';

      activePeriods.push({
        startYM: startYMStr,
        endYM: endYMStr as any,
        description: descStr
      });
      console.log(`[ExcelImporter] Added active period: ${startYMStr} - ${endYMStr}`);
    }

    return {
      name,
      vorname,
      active: row['Aktiv'] !== undefined ? this.parseBooleanValue(row['Aktiv']) : true,
      teilzeit,
      personnelNumber,
      role,
      qualifications: qualifications.length > 0 ? qualifications : undefined,
      activePeriods: activePeriods.length > 0 ? activePeriods : undefined
    };
  }

  /**
   * Parst eine einzelne Zeile und konvertiert die Daten
   */
  private parsePersonnelRow(row: any): PersonnelImportData | null {
    // Validierung: Name ist erforderlich
    if (!row.name || typeof row.name !== 'string' || row.name.trim() === '') {
      return null;
    }

    const name = String(row.name).trim();
    const vorname = row.vorname ? String(row.vorname).trim() : '';

    return {
      name,
      vorname,
      active: row.active !== undefined ? this.parseBooleanValue(row.active) : true,
      // Legacy-Format: teilzeit als Zahl, falls vorhanden
      teilzeit: row.teilzeit !== undefined ? (typeof row.teilzeit === 'number' ? row.teilzeit : 0) : undefined,
      fahrzeugfuehrer: row.fahrzeugfuehrer !== undefined ? this.parseBooleanValue(row.fahrzeugfuehrer) : undefined,
      fahrzeugfuehrerHLFB: row.fahrzeugfuehrerHLFB !== undefined ? this.parseBooleanValue(row.fahrzeugfuehrerHLFB) : undefined,
      nef: row.nef !== undefined ? this.parseBooleanValue(row.nef) : undefined,
      itwMaschinist: row.itwMaschinist !== undefined ? this.parseBooleanValue(row.itwMaschinist) : undefined,
      itwFahrzeugfuehrer: row.itwFahrzeugfuehrer !== undefined ? this.parseBooleanValue(row.itwFahrzeugfuehrer) : undefined
    };
  }

  /**
   * Konvertiert verschiedene Eingabeformate zu Boolean
   */
  private parseBooleanValue(value: any): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string') {
      const lower = value.toLowerCase().trim();
      return lower === 'ja' || lower === 'yes' || lower === 'true' || lower === '1' || lower === 'x';
    }
    return false;
  }

  /**
   * Migriert Legacy-Qualifikationen zu neuen Qualifikations-Zeiträumen
   */
  private async migrateLegacyQualifications(personId: number, person: PersonnelImportData): Promise<void> {
    const currentYearMonth = new Date().toISOString().slice(0, 7); // YYYY-MM Format

    const legacyMapping = [
      { legacy: person.fahrzeugfuehrer, qualType: 'Fahrzeugführer' },
      { legacy: person.fahrzeugfuehrerHLFB, qualType: 'Fahrzeugführer HLF-B' },
      { legacy: person.nef, qualType: 'NEF Fahrer' },
      { legacy: person.itwMaschinist, qualType: 'ITW Maschinist' },
      { legacy: person.itwFahrzeugfuehrer, qualType: 'ITW Fahrzeugführer' }
    ];

    for (const mapping of legacyMapping) {
      if (mapping.legacy === true) {
        try {
          // Erstelle unbefristete Qualifikation ab aktuellem Monat
          await this.db.run(
            'INSERT INTO qualification_periods (personId, qualType, startYM, endYM, active) VALUES (?, ?, ?, ?, ?)',
            [personId, mapping.qualType, currentYearMonth, '', 1]
          );
        } catch (error) {
          console.warn(`[ExcelImporter] Konnte Legacy-Qualifikation ${mapping.qualType} für Person ${personId} nicht migrieren:`, error);
        }
      }
    }
  }

  /**
   * Importiert Personal-Daten UND Azubi-Daten in die Datenbank
   */
  async importPersonnelData(personnelData: PersonnelImportData[], azubiData: AzubiImportData[], replaceExisting = false): Promise<ImportResult> {
    const result: ImportResult = {
      success: true,
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: [],
      data: personnelData,
      azubis: azubiData
    };

    try {
      await this.db.run('BEGIN TRANSACTION');

      // Wenn replaceExisting = true, lösche alle bestehenden Personal-Daten und Azubis
      if (replaceExisting) {
        await this.db.run('DELETE FROM qualification_periods');
        await this.db.run('DELETE FROM personnel_active_periods');
        await this.db.run('DELETE FROM personnel');
        await this.db.run('DELETE FROM azubi_periods');
        await this.db.run('DELETE FROM azubis');
        console.log('[ExcelImporter] Bestehende Personal-Daten, Qualifikationen und Azubis gelöscht');
      }

      // Lade Rollen für Lookup
      let roleMap = new Map<string, number>();
      try {
        const rolesJson = await this.db.get('SELECT value FROM settings WHERE key = ?', ['roles']);
        if (rolesJson && rolesJson.value) {
          const roles = JSON.parse(rolesJson.value);
          console.log('[ExcelImporter] Raw roles from DB:', roles);
          if (Array.isArray(roles)) {
            roles.forEach((r: any) => {
              if (r.name && r.id) {
                const key = r.name.toLowerCase().trim();
                roleMap.set(key, r.id);
                console.log(`[ExcelImporter] Mapped role '${r.name}' (key: '${key}') -> ID ${r.id}`);
              }
            });
          }
        }
      } catch (e) { console.warn('[ExcelImporter] Failed to load roles for import', e); }

      // --- PERSONAL IMPORTIEREN ---
      for (const person of personnelData) {
        try {
          // Prüfe auf Duplikate
          const existing = await this.db.get(
            'SELECT id FROM personnel WHERE name = ? AND vorname = ?',
            [person.name, person.vorname]
          );

          if (existing && !replaceExisting) {
            console.log(`[ExcelImporter] Updating existing person ID ${existing.id}: ${person.name}, ${person.vorname}`);
            const personId = existing.id;

            // Update Base Data
            // Only update fields that are present in the import data (undefined check)
            // Note: Contact fields (street, etc.) are removed.

            // Determine updates for optional fields
            const newRoleId = person.role ? roleMap.get(person.role.toLowerCase().trim()) : undefined;

            let sql = 'UPDATE personnel SET active = ?, teilzeit = ?';
            const params: any[] = [person.active !== false ? 1 : 0, person.teilzeit || 0];

            if (person.personnelNumber !== undefined) {
              sql += ', personnelNumber = ?';
              params.push(person.personnelNumber);
              console.log(`[ExcelImporter] Updating personnelNumber for ${person.name}: ${person.personnelNumber}`);
            }
            if (newRoleId !== undefined) {
              sql += ', roleId = ?';
              params.push(newRoleId);
              console.log(`[ExcelImporter] Updating roleId for ${person.name}: ${newRoleId}`);
            }

            sql += ' WHERE id = ?';
            params.push(personId);

            // Log the assembled query for debugging
            // console.log(`[ExcelImporter] Running SQL: ${sql}`, params);

            await this.db.run(sql, params);

            // Update Qualifications
            if (person.qualifications && person.qualifications.length > 0) {
              for (const qual of person.qualifications) {
                try {
                  // Check if exact qualification type exists for this person
                  const existingQual = await this.db.get(
                    'SELECT id FROM qualification_periods WHERE personId = ? AND qualType = ?',
                    [personId, qual.qualType]
                  );

                  if (existingQual) {
                    // Update existing qualification
                    await this.db.run(
                      'UPDATE qualification_periods SET startYM = ?, endYM = ?, active = 1 WHERE id = ?',
                      [qual.startYM, qual.endYM, existingQual.id]
                    );
                    console.log(`[ExcelImporter] Updated qualification ${qual.qualType} for ${personId}`);
                  } else {
                    // Insert new qualification
                    await this.db.run(
                      'INSERT INTO qualification_periods (personId, qualType, startYM, endYM, active) VALUES (?, ?, ?, ?, ?)',
                      [personId, qual.qualType, qual.startYM, qual.endYM, 1]
                    );
                    console.log(`[ExcelImporter] Added new qualification ${qual.qualType} for ${personId}`);
                  }
                } catch (e) {
                  console.error(`[ExcelImporter] Error updating qualification ${qual.qualType} for ${personId}`, e);
                }
              }
            }

            // Update Active Periods
            if (person.activePeriods && person.activePeriods.length > 0) {
              for (const period of person.activePeriods) {
                try {
                  // Check for duplicate period (same start/end) to avoid double insertion
                  const existingPeriod = await this.db.get(
                    'SELECT id FROM personnel_active_periods WHERE personId = ? AND startYM = ? AND (endYM = ? OR (endYM IS NULL AND ? IS NULL))',
                    [personId, period.startYM, period.endYM, period.endYM]
                  );

                  if (existingPeriod) {
                    // Update description if changed
                    await this.db.run(
                      'UPDATE personnel_active_periods SET description = ? WHERE id = ?',
                      [period.description || '', existingPeriod.id]
                    );
                  } else {
                    await this.db.run(
                      'INSERT INTO personnel_active_periods (personId, startYM, endYM, description, active) VALUES (?, ?, ?, ?, ?)',
                      [personId, period.startYM, period.endYM, period.description || '', 1]
                    );
                    console.log(`[ExcelImporter] Added active period for ${personId}: ${period.startYM}`);
                  }
                } catch (e) {
                  console.error(`[ExcelImporter] Error updating active periods for ${personId}`, e);
                }
              }
            }

            result.updated++;
            // Continue -> Skip insertion part
            continue;
          }

          // Bestimme die nächste Sort-Position
          const maxSortResult = await this.db.get('SELECT MAX(sort) as maxSort FROM personnel');
          const nextSort = (maxSortResult?.maxSort || 0) + 1;

          // Füge Person hinzu - verwende nur vorhandene Felder
          let insertResult;
          const roleId = person.role ? roleMap.get(person.role.toLowerCase().trim()) : null;

          // Universal INSERT (New Format)
          insertResult = await this.db.run(
            'INSERT INTO personnel (name, vorname, active, sort, teilzeit, personnelNumber, roleId, fahrzeugfuehrer, fahrzeugfuehrerHLFB, nef, itwMaschinist, itwFahrzeugfuehrer) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
              person.name,
              person.vorname,
              person.active !== false ? 1 : 0,
              nextSort,
              person.teilzeit || 0,
              person.personnelNumber || '',
              roleId,
              0, // fahrzeugfuehrer default
              0, // fahrzeugfuehrerHLFB default
              0, // nef default
              0, // itwMaschinist default
              0  // itwFahrzeugfuehrer default
            ]
          );

          // Hole die ID der eingefügten Person
          let personId: number;
          if (insertResult.lastID) {
            personId = insertResult.lastID as number;
          } else {
            // Fallback: Hole die ID über Name/Vorname
            const inserted = await this.db.get(
              'SELECT id FROM personnel WHERE name = ? AND vorname = ? ORDER BY id DESC LIMIT 1',
              [person.name, person.vorname]
            );
            personId = inserted?.id;
          }

          console.log(`[ExcelImporter] Inserted person ID ${personId}: ${person.name}, ${person.vorname}`);
          console.log(`[ExcelImporter] Person has qualifications:`, person.qualifications);

          // Wenn Qualifikationen aus dem neuen Export-Format vorhanden sind, importiere diese
          if (person.qualifications && person.qualifications.length > 0) {
            console.log(`[ExcelImporter] Importing ${person.qualifications.length} qualifications for ${person.name}`);
            for (const qual of person.qualifications) {
              try {
                await this.db.run(
                  'INSERT INTO qualification_periods (personId, qualType, startYM, endYM, active) VALUES (?, ?, ?, ?, ?)',
                  [personId, qual.qualType, qual.startYM, qual.endYM, 1]
                );
              } catch (error) {
                console.error(`[ExcelImporter] ✗ Konnte Qualifikation ${qual.qualType} für Person ${personId} nicht importieren:`, error);
              }
            }
          } else {
            // Migriere Legacy-Qualifikationen zu neuen Qualifikations-Zeiträumen (falls vorhanden)
            await this.migrateLegacyQualifications(personId, person);
          }

          // Importiere Aktivitäts-Zeiträume
          if (person.activePeriods && person.activePeriods.length > 0) {
            console.log(`[ExcelImporter] Importing ${person.activePeriods.length} active periods for ${person.name}`);
            for (const period of person.activePeriods) {
              try {
                await this.db.run(
                  'INSERT INTO personnel_active_periods (personId, startYM, endYM, description, active) VALUES (?, ?, ?, ?, ?)',
                  [personId, period.startYM, period.endYM, period.description || '', 1]
                );
              } catch (error) {
                console.error(`[ExcelImporter] ✗ Konnte Aktivitäts-Zeitraum für Person ${personId} nicht importieren:`, error);
              }
            }
          }

          result.imported++;
        } catch (error) {
          const errorMsg = `Fehler bei ${person.name}, ${person.vorname}: ${error instanceof Error ? error.message : String(error)}`;
          result.errors.push(errorMsg);
          console.error(`[ExcelImporter] ${errorMsg}`);
        }
      }

      // --- AZUBIS IMPORTIEREN ---
      console.log(`[ExcelImporter] Importiere ${azubiData.length} Azubis...`);
      for (const azubi of azubiData) {
        try {
          // Prüfe auf Duplikate
          const existing = await this.db.get(
            'SELECT id FROM azubis WHERE name = ? AND vorname = ?',
            [azubi.name, azubi.vorname]
          );

          if (existing && !replaceExisting) {
            console.log(`[ExcelImporter] Azubi ${azubi.name}, ${azubi.vorname} existiert bereits, überspringe`);
            result.skipped++;
            continue;
          }

          // Bestimme die nächste Sort-Position
          const maxSortResult = await this.db.get('SELECT MAX(sort) as maxSort FROM azubis');
          const nextSort = (maxSortResult?.maxSort || 0) + 1;

          // Füge Azubi hinzu (OHNE active - die Tabelle hat diese Spalte nicht!)
          const insertResult = await this.db.run(
            'INSERT INTO azubis (name, vorname, lehrjahr, sort) VALUES (?, ?, ?, ?)',
            [
              azubi.name,
              azubi.vorname,
              azubi.lehrjahr,
              nextSort
            ]
          );

          // Hole die ID des eingefügten Azubis
          let azubiId: number;
          if (insertResult.lastID) {
            azubiId = insertResult.lastID as number;
          } else {
            // Fallback: Hole die ID über Name/Vorname
            const inserted = await this.db.get(
              'SELECT id FROM azubis WHERE name = ? AND vorname = ? ORDER BY id DESC LIMIT 1',
              [azubi.name, azubi.vorname]
            );
            azubiId = inserted?.id;
          }

          console.log(`[ExcelImporter] Inserted azubi ID ${azubiId}: ${azubi.name}, ${azubi.vorname} (Lehrjahr: ${azubi.lehrjahr})`);

          // Importiere Zeiträume für diesen Azubi
          if (azubi.periods && azubi.periods.length > 0) {
            console.log(`[ExcelImporter] Importing ${azubi.periods.length} periods for azubi ${azubi.name}`);
            for (const period of azubi.periods) {
              try {
                await this.db.run(
                  'INSERT INTO azubi_periods (azubi_id, start_date, end_date, description, lehrjahr) VALUES (?, ?, ?, ?, ?)',
                  [azubiId, period.start_date, period.end_date || null, period.description || '', azubi.lehrjahr]
                );
                console.log(`[ExcelImporter] ✓ Zeitraum importiert: ${period.start_date} - ${period.end_date || 'offen'} (Lehrjahr: ${azubi.lehrjahr})`);
              } catch (error) {
                console.error(`[ExcelImporter] ✗ Konnte Zeitraum für Azubi ${azubiId} nicht importieren:`, error);
              }
            }
          }

          result.imported++;
        } catch (error) {
          const errorMsg = `Fehler bei Azubi ${azubi.name}, ${azubi.vorname}: ${error instanceof Error ? error.message : String(error)}`;
          result.errors.push(errorMsg);
          console.error(`[ExcelImporter] ${errorMsg}`);
        }
      }

      await this.db.run('COMMIT');
      console.log(`[ExcelImporter] Import abgeschlossen: ${result.imported} importiert, ${result.skipped} übersprungen, ${result.errors.length} Fehler`);
      if (result.errors.length > 0) {
        console.error('[ExcelImporter] Fehler-Details:', result.errors);
      }

    } catch (error) {
      await this.db.run('ROLLBACK');
      result.success = false;
      result.errors.push(`Transaktionsfehler: ${error instanceof Error ? error.message : String(error)}`);
      console.error('[ExcelImporter] Import-Fehler:', error);
    }

    return result;
  }

  /**
   * Erstellt eine Excel-Vorlage für den Personal-Import
   */
  static createTemplate(filePath: string): void {
    const templateData = [
      // Header mit neuen Feldern + Legacy-Kompatibilität
      ['Name', 'Vorname', 'Aktiv', 'Teilzeit*', 'Fahrzeugführer*', 'Fahrzeugführer HLFB*', 'NEF*', 'ITW Maschinist*', 'ITW Fahrzeugführer*', 'Aktiv_Von', 'Aktiv_Bis', 'Aktiv_Beschreibung'],
      // Beispieldaten
      ['Mustermann', 'Max', 'ja', 'nein', 'ja', 'nein', 'ja', 'nein', 'nein', '2025-01', '', 'Festanstellung'],
      ['Musterfrau', 'Maria', 'ja', 'ja', 'ja', 'ja', 'nein', 'ja', 'ja', '2025-03', '2025-08', 'Befristet'],
      ['Beispiel', 'Ben', '1', '0', '1', '0', '1', '0', '1', '', '', ''],
      // Hinweiszeile
      ['', '', '', '', '', '', '', '', '', 'Format: YYYY-MM', 'Format: YYYY-MM', '']
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(templateData);

    // Setze Spaltenbreiten
    worksheet['!cols'] = [
      { width: 15 }, // Name
      { width: 15 }, // Vorname
      { width: 10 }, // Teilzeit
      { width: 15 }, // Fahrzeugführer
      { width: 18 }, // Fahrzeugführer HLFB
      { width: 8 },  // NEF
      { width: 15 }, // ITW Maschinist
      { width: 18 }, // ITW Fahrzeugführer
      { width: 12 }, // Aktiv_Von
      { width: 12 }, // Aktiv_Bis
      { width: 20 }  // Aktiv_Beschreibung
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Personal');

    XLSX.writeFile(workbook, filePath);
    console.log(`[ExcelImporter] Vorlage erstellt: ${filePath}`);
  }

  /**
   * Exportiert aktuelle Personal-Daten als Excel
   */
  async exportToExcel(filePath: string): Promise<void> {
    try {
      const personnel = await this.db.all('SELECT * FROM personnel ORDER BY sort ASC, name ASC');

      // Lade alle verfügbaren Qualifikationstypen
      const qualTypes = await this.db.all('SELECT name FROM qualification_types WHERE active = 1 ORDER BY sort, name');
      console.log('[ExcelImporter] Available qualification types:', qualTypes.map(q => q.name));


      // Lade Rollen für Export
      let roles: any[] = [];
      try {
        const rolesJson = await this.db.get('SELECT value FROM settings WHERE key = ?', ['roles']);
        if (rolesJson && rolesJson.value) {
          roles = JSON.parse(rolesJson.value);
        }
      } catch (e) { }

      // Erstelle Header mit separaten Spalten für jede Qualifikation
      const headers = ['Name', 'Vorname', 'Aktiv', 'Teilzeit', 'Personalnummer', 'Rolle', 'Aktiv_Von', 'Aktiv_Bis', 'Aktiv_Beschreibung'];
      const qualHeaders: string[] = [];

      for (const qualType of qualTypes) {
        qualHeaders.push(`${qualType.name}_Von`);
        qualHeaders.push(`${qualType.name}_Bis`);
      }

      headers.push(...qualHeaders);
      const exportData = [headers];

      for (const person of personnel) {
        // Lade alle Qualifikationen für diese Person (nicht nur aktuelle)
        console.log(`[ExcelImporter] Loading qualifications for person ${person.id} (${person.name})`);

        const allQuals = await this.db.all(
          'SELECT qualType, startYM, endYM FROM qualification_periods WHERE personId = ? AND active = 1',
          [person.id]
        );

        // Lade Aktivitäts-Zeiträume
        const activePeriods = await this.db.all(
          'SELECT startYM, endYM, description FROM personnel_active_periods WHERE personId = ? AND active = 1 ORDER BY startYM DESC LIMIT 1',
          [person.id]
        );
        const activePeriod = activePeriods.length > 0 ? activePeriods[0] : null;

        console.log(`[ExcelImporter] All qualifications for person ${person.id}:`, allQuals);

        const roleName = person.roleId ? (roles.find(r => r.id === person.roleId)?.name || '') : '';

        // Erstelle Zeile mit Grunddaten
        const row = [
          person.name,
          person.vorname || '',
          person.active ? 'ja' : 'nein',
          person.teilzeit || 0,
          person.personnelNumber || '',
          roleName,
          activePeriod ? activePeriod.startYM : '',
          activePeriod ? (activePeriod.endYM || '') : '',
          activePeriod ? (activePeriod.description || '') : ''
        ];

        // Füge für jede Qualifikation die Zeiträume hinzu
        for (const qualType of qualTypes) {
          const qual = allQuals.find(q => q.qualType === qualType.name);
          if (qual) {
            row.push(qual.startYM || ''); // Von-Datum
            row.push(qual.endYM || ''); // Bis-Datum (leer = unbegrenzt)
          } else {
            row.push(''); // Kein Von-Datum
            row.push(''); // Kein Bis-Datum
          }
        }

        exportData.push(row);
      }

      const worksheet = XLSX.utils.aoa_to_sheet(exportData);

      // Setze Spaltenbreiten dynamisch
      const colWidths = [
        { width: 20 }, // Name
        { width: 20 }, // Vorname
        { width: 10 }, // Aktiv
        { width: 10 }, // Teilzeit
        { width: 15 }, // Personalnummer
        { width: 20 }, // Rolle
        { width: 12 }, // Aktiv_Von
        { width: 12 }, // Aktiv_Bis
        { width: 20 }  // Aktiv_Beschreibung
      ];

      // Füge Spaltenbreiten für jede Qualifikation hinzu (Von/Bis Spalten)
      for (const qualType of qualTypes) {
        colWidths.push({ width: 15 }); // Von-Spalte
        colWidths.push({ width: 15 }); // Bis-Spalte
      }

      worksheet['!cols'] = colWidths;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Personal');

      // --- Azubis Export ---
      console.log('[ExcelImporter] Exporting Azubis...');
      const azubis = await this.db.all('SELECT * FROM azubis ORDER BY sort ASC, name ASC');

      // Header OHNE "Aktiv" (Spalte existiert nicht in azubis-Tabelle)
      const azubiHeaders = ['Name', 'Vorname', 'Lehrjahr', 'Von', 'Bis', 'Beschreibung'];
      const azubiExportData = [azubiHeaders];

      for (const azubi of azubis) {
        // Lade Zeiträume für diesen Azubi
        const periods = await this.db.all(
          'SELECT start_date, end_date, description FROM azubi_periods WHERE azubi_id = ? ORDER BY start_date ASC',
          [azubi.id]
        );

        if (periods.length > 0) {
          // Für jeden Zeitraum eine Zeile erstellen
          for (const period of periods) {
            azubiExportData.push([
              azubi.name,
              azubi.vorname || '',
              azubi.lehrjahr,
              period.start_date,
              period.end_date || '', // null = unbegrenzt -> leerer String in Excel
              period.description || ''
            ]);
          }
        } else {
          // Wenn keine Zeiträume, nur Basisdaten (leere Zeitraum-Felder)
          azubiExportData.push([
            azubi.name,
            azubi.vorname || '',
            azubi.lehrjahr,
            '',
            '',
            ''
          ]);
        }
      }

      const azubiWorksheet = XLSX.utils.aoa_to_sheet(azubiExportData);
      azubiWorksheet['!cols'] = [
        { width: 20 }, // Name
        { width: 20 }, // Vorname
        { width: 10 }, // Lehrjahr
        { width: 12 }, // Von
        { width: 12 }, // Bis
        { width: 25 }  // Beschreibung
      ];

      XLSX.utils.book_append_sheet(workbook, azubiWorksheet, 'Azubis');

      // --- ITW-Ärzte Export ---
      console.log('[ExcelImporter] Exporting ITW Doctors...');
      const itwDoctors = await this.db.all('SELECT * FROM itw_doctors ORDER BY sort ASC, name ASC');

      const itwHeaders = ['Name', 'Vorname', 'Aktiv'];
      const itwExportData = [itwHeaders];

      for (const doctor of itwDoctors) {
        itwExportData.push([
          doctor.name,
          doctor.vorname || '',
          doctor.active ? 'ja' : 'nein'
        ]);
      }

      const itwWorksheet = XLSX.utils.aoa_to_sheet(itwExportData);
      itwWorksheet['!cols'] = [
        { width: 20 }, // Name
        { width: 20 }, // Vorname
        { width: 10 }  // Aktiv
      ];

      XLSX.utils.book_append_sheet(workbook, itwWorksheet, 'ITW-Ärzte');

      XLSX.writeFile(workbook, filePath);
      console.log(`[ExcelImporter] Export mit 3 Tabellenblättern erstellt: ${filePath}`);
    } catch (error) {
      console.error('[ExcelImporter] Export-Fehler:', error);
      throw new Error(`Excel-Export fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}