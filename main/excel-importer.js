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
exports.ExcelPersonnelImporter = void 0;
const XLSX = __importStar(require("xlsx"));
class ExcelPersonnelImporter {
    constructor(db) {
        this.db = db;
    }
    /**
     * Parst eine Excel-Datei und extrahiert Personal-Daten
     * Erwartetes Format:
     * Spalte A: Name (Nachname)
     * Spalte B: Vorname
     * Spalte C: Teilzeit (0/1, ja/nein, true/false)
     * Spalte D: Fahrzeugführer (0/1, ja/nein, true/false)
     * Spalte E: Fahrzeugführer HLFB (0/1, ja/nein, true/false)
     * Spalte F: NEF (0/1, ja/nein, true/false)
     * Spalte G: ITW Maschinist (0/1, ja/nein, true/false)
     * Spalte H: ITW Fahrzeugführer (0/1, ja/nein, true/false)
     */
    parseExcelFile(filePath) {
        try {
            const workbook = XLSX.readFile(filePath);
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            // Konvertiere zu JSON Array
            const data = XLSX.utils.sheet_to_json(sheet, {
                header: ['name', 'vorname', 'teilzeit', 'fahrzeugfuehrer', 'fahrzeugfuehrerHLFB', 'nef', 'itwMaschinist', 'itwFahrzeugfuehrer'],
                range: 1 // Überspringt erste Zeile (Header)
            });
            return data.map((row) => this.parsePersonnelRow(row)).filter(p => p !== null);
        }
        catch (error) {
            console.error('[ExcelImporter] Fehler beim Lesen der Excel-Datei:', error);
            throw new Error(`Excel-Datei konnte nicht gelesen werden: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Parst eine einzelne Zeile und konvertiert die Daten
     */
    parsePersonnelRow(row) {
        // Validierung: Name ist erforderlich
        if (!row.name || typeof row.name !== 'string' || row.name.trim() === '') {
            return null;
        }
        const name = String(row.name).trim();
        const vorname = row.vorname ? String(row.vorname).trim() : '';
        return {
            name,
            vorname,
            teilzeit: this.parseBooleanValue(row.teilzeit),
            fahrzeugfuehrer: this.parseBooleanValue(row.fahrzeugfuehrer),
            fahrzeugfuehrerHLFB: this.parseBooleanValue(row.fahrzeugfuehrerHLFB),
            nef: this.parseBooleanValue(row.nef),
            itwMaschinist: this.parseBooleanValue(row.itwMaschinist),
            itwFahrzeugfuehrer: this.parseBooleanValue(row.itwFahrzeugfuehrer)
        };
    }
    /**
     * Konvertiert verschiedene Eingabeformate zu Boolean
     */
    parseBooleanValue(value) {
        if (typeof value === 'boolean')
            return value;
        if (typeof value === 'number')
            return value === 1;
        if (typeof value === 'string') {
            const lower = value.toLowerCase().trim();
            return lower === 'ja' || lower === 'yes' || lower === 'true' || lower === '1' || lower === 'x';
        }
        return false;
    }
    /**
     * Importiert Personal-Daten in die Datenbank
     */
    async importPersonnelData(personnelData, replaceExisting = false) {
        const result = {
            success: true,
            imported: 0,
            skipped: 0,
            errors: [],
            data: personnelData
        };
        try {
            await this.db.run('BEGIN TRANSACTION');
            // Wenn replaceExisting = true, lösche alle bestehenden Personal-Daten
            if (replaceExisting) {
                await this.db.run('DELETE FROM personnel');
                console.log('[ExcelImporter] Bestehende Personal-Daten gelöscht');
            }
            for (const person of personnelData) {
                try {
                    // Prüfe auf Duplikate
                    const existing = await this.db.get('SELECT id FROM personnel WHERE name = ? AND vorname = ?', [person.name, person.vorname]);
                    if (existing && !replaceExisting) {
                        result.skipped++;
                        continue;
                    }
                    // Bestimme die nächste Sort-Position
                    const maxSortResult = await this.db.get('SELECT MAX(sort) as maxSort FROM personnel');
                    const nextSort = (maxSortResult?.maxSort || 0) + 1;
                    // Füge Person hinzu
                    await this.db.run('INSERT INTO personnel (name, vorname, teilzeit, fahrzeugfuehrer, fahrzeugfuehrerHLFB, nef, itwMaschinist, itwFahrzeugfuehrer, sort) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [
                        person.name,
                        person.vorname,
                        person.teilzeit ? 1 : 0,
                        person.fahrzeugfuehrer ? 1 : 0,
                        person.fahrzeugfuehrerHLFB ? 1 : 0,
                        person.nef ? 1 : 0,
                        person.itwMaschinist ? 1 : 0,
                        person.itwFahrzeugfuehrer ? 1 : 0,
                        nextSort
                    ]);
                    result.imported++;
                }
                catch (error) {
                    result.errors.push(`Fehler bei ${person.name}, ${person.vorname}: ${error instanceof Error ? error.message : String(error)}`);
                }
            }
            await this.db.run('COMMIT');
            console.log(`[ExcelImporter] Import abgeschlossen: ${result.imported} importiert, ${result.skipped} übersprungen, ${result.errors.length} Fehler`);
        }
        catch (error) {
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
    static createTemplate(filePath) {
        const templateData = [
            ['Name', 'Vorname', 'Teilzeit', 'Fahrzeugführer', 'Fahrzeugführer HLFB', 'NEF', 'ITW Maschinist', 'ITW Fahrzeugführer'],
            ['Mustermann', 'Max', 'nein', 'ja', 'nein', 'ja', 'nein', 'nein'],
            ['Musterfrau', 'Maria', 'ja', 'ja', 'ja', 'nein', 'ja', 'ja'],
            ['Beispiel', 'Ben', '0', '1', '0', '1', '0', '1']
        ];
        const worksheet = XLSX.utils.aoa_to_sheet(templateData);
        // Setze Spaltenbreiten
        worksheet['!cols'] = [
            { width: 15 }, // Name
            { width: 15 }, // Vorname
            { width: 10 }, // Teilzeit
            { width: 15 }, // Fahrzeugführer
            { width: 18 }, // Fahrzeugführer HLFB
            { width: 8 }, // NEF
            { width: 15 }, // ITW Maschinist
            { width: 18 } // ITW Fahrzeugführer
        ];
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Personal');
        XLSX.writeFile(workbook, filePath);
        console.log(`[ExcelImporter] Vorlage erstellt: ${filePath}`);
    }
    /**
     * Exportiert aktuelle Personal-Daten als Excel
     */
    async exportToExcel(filePath) {
        try {
            const personnel = await this.db.all('SELECT * FROM personnel ORDER BY sort ASC, name ASC');
            const exportData = [
                ['Name', 'Vorname', 'Teilzeit', 'Fahrzeugführer', 'Fahrzeugführer HLFB', 'NEF', 'ITW Maschinist', 'ITW Fahrzeugführer']
            ];
            for (const person of personnel) {
                exportData.push([
                    person.name,
                    person.vorname || '',
                    person.teilzeit ? 'ja' : 'nein',
                    person.fahrzeugfuehrer ? 'ja' : 'nein',
                    person.fahrzeugfuehrerHLFB ? 'ja' : 'nein',
                    person.nef ? 'ja' : 'nein',
                    person.itwMaschinist ? 'ja' : 'nein',
                    person.itwFahrzeugfuehrer ? 'ja' : 'nein'
                ]);
            }
            const worksheet = XLSX.utils.aoa_to_sheet(exportData);
            // Setze Spaltenbreiten
            worksheet['!cols'] = [
                { width: 15 }, { width: 15 }, { width: 10 }, { width: 15 },
                { width: 18 }, { width: 8 }, { width: 15 }, { width: 18 }
            ];
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Personal');
            XLSX.writeFile(workbook, filePath);
            console.log(`[ExcelImporter] Export erstellt: ${filePath}`);
        }
        catch (error) {
            console.error('[ExcelImporter] Export-Fehler:', error);
            throw new Error(`Excel-Export fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}
exports.ExcelPersonnelImporter = ExcelPersonnelImporter;
