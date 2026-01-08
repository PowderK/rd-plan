/**
 * Test-Skript für Monatsimport-Validierungen
 * 
 * Prüft:
 * 1. Azubi-Zeiträume Validierung
 * 2. Gelöschte/inaktive Personen Erkennung
 * 3. Verfügbarkeitskonflikte (Person eingeteilt, aber nicht verfügbar)
 */

const path = require('path');
const fs = require('fs');

async function testMonatsimportValidation() {
    console.log('=== Test: Monatsimport-Validierungen ===\n');

    // Simuliere Database Adapter
    const mockDb = {
        async getPersonnel() {
            return [
                { id: 1, name: 'Müller', vorname: 'Hans', active: true },
                { id: 2, name: 'Schmidt', vorname: 'Anna', active: true },
                { id: 3, name: 'Meyer', vorname: 'Tom', active: false }, // INAKTIV
            ];
        },
        
        async getAzubiList() {
            return [
                { id: 1, name: 'Weber', vorname: 'Lisa', lehrjahr: 1 },
                { id: 2, name: 'Fischer', vorname: 'Max', lehrjahr: 2 },
            ];
        },
        
        async getAllAzubiPeriods() {
            return [
                { 
                    azubi_id: 1, 
                    start_date: '2026-01-01', 
                    end_date: '2026-03-31',
                    description: '1. Lehrjahr',
                    lehrjahr: 1
                },
                // Azubi 2 (Fischer) hat KEINEN Zeitraum für 2026!
            ];
        },
        
        async getDutyRoster(year) {
            if (year === 2026) {
                return [
                    {
                        personId: 1,
                        personType: 'person',
                        date: '2026-01-15',
                        value: 'T',
                        type: 'rtw1_tag_1' // Müller ist auf RTW1 eingeteilt
                    },
                    {
                        personId: 3,
                        personType: 'person',
                        date: '2026-01-20',
                        value: 'T',
                        type: 'nef1_tag_1' // Meyer (INAKTIV) ist noch eingeteilt!
                    }
                ];
            }
            return [];
        },
        
        async getShiftTypes() {
            return [
                { code: 'T', description: 'Tagdienst' },
                { code: 'K', description: 'Krank' },
                { code: 'U', description: 'Urlaub' },
            ];
        },
        
        async getSetting(key) {
            const settings = {
                'auswertung_T': 'tag',      // Tagdienst = verfügbar
                'auswertung_K': 'off',      // Krank = nicht verfügbar
                'auswertung_U': 'off',      // Urlaub = nicht verfügbar
            };
            return settings[key] || 'off';
        }
    };

    // Importiere RosterImporter
    const { RosterImporter } = require('./main/roster-importer.ts');
    
    console.log('\n1. Test: Azubi ohne Zeitraum\n' + '='.repeat(50));
    
    // Simuliere Import-Daten: Fischer (Azubi 2) soll im Juni eingeteilt werden
    const testEntries1 = [
        {
            personId: 2,
            personType: 'azubi',
            date: '2026-06-15',
            value: 'T',
            type: 'text'
        }
    ];
    
    const importer = new RosterImporter(mockDb);
    
    // Zugriff auf private Methode via Reflection (nur für Test!)
    const checkAzubiPeriods = importer.checkAzubiPeriods.bind(importer);
    
    try {
        const azubisWithoutPeriod = await checkAzubiPeriods(testEntries1, 2026, 5); // Juni = Monat 5
        
        if (azubisWithoutPeriod.length > 0) {
            console.log('✓ Validierung erkannt:');
            azubisWithoutPeriod.forEach(a => {
                console.log(`  - ${a.azubiName}: ${a.importDateRange.start} bis ${a.importDateRange.end}`);
            });
        } else {
            console.log('✗ FEHLER: Azubi ohne Zeitraum wurde NICHT erkannt!');
        }
    } catch (e) {
        console.log('✗ FEHLER beim Test:', e.message);
    }
    
    console.log('\n2. Test: Verfügbarkeitskonflikt\n' + '='.repeat(50));
    
    // Simuliere Import: Müller wird als "Krank" markiert, ist aber auf RTW1 eingeteilt
    const testEntries2 = [
        {
            personId: 1,
            personType: 'person',
            date: '2026-01-15',
            value: 'K', // Krank = nicht verfügbar
            type: 'text'
        }
    ];
    
    const checkAvailabilityConflicts = importer.checkAvailabilityConflicts.bind(importer);
    
    try {
        const conflicts = await checkAvailabilityConflicts(testEntries2);
        
        if (conflicts.length > 0) {
            console.log('✓ Verfügbarkeitskonflikt erkannt:');
            conflicts.forEach(c => {
                console.log(`  - ${c.personName} am ${c.date}:`);
                console.log(`    Neue Schichtart: ${c.dutyRosterValue} (nicht verfügbar)`);
                console.log(`    Aber eingeteilt auf: ${c.einteilungValue}`);
            });
        } else {
            console.log('✗ FEHLER: Verfügbarkeitskonflikt wurde NICHT erkannt!');
        }
    } catch (e) {
        console.log('✗ FEHLER beim Test:', e.message);
    }
    
    console.log('\n3. Test: Gelöschte Person im Import\n' + '='.repeat(50));
    console.log('INFO: Dieser Test prüft, ob gelöschte Personen korrekt übersprungen werden.');
    console.log('PROBLEM: Es gibt aktuell KEINE explizite Warnung für übersprungene Personen!');
    console.log('');
    console.log('Erwartetes Verhalten:');
    console.log('  - Person "Meyer" (ID 3, inaktiv) wird beim Namens-Matching gefunden');
    console.log('  - Eintrag wird in entriesToImport aufgenommen');
    console.log('  - ABER: Es gibt keine Validierung, die prüft ob Person aktiv ist');
    console.log('');
    console.log('Empfehlung:');
    console.log('  - Neue Validierungsfunktion: checkDeletedOrInactivePersons()');
    console.log('  - Warnung an Benutzer: "Person XYZ ist nicht mehr verfügbar"');
    
    console.log('\n=== Test abgeschlossen ===\n');
}

// Führe Test aus
testMonatsimportValidation().catch(console.error);
