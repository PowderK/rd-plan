/**
 * Reproduzierbare Performance-Tests für RD-Plan
 * 
 * Verwendung:
 *   node test-performance.js
 * 
 * Generiert Test-Daten falls nicht vorhanden und misst die Performance
 * kritischer Operationen. Ergebnisse werden in JSON-Datei gespeichert.
 */

const { performance } = require('perf_hooks');
const path = require('path');
const fs = require('fs');

// Test-Konfiguration
const CONFIG = {
    RUNS_PER_TEST: 5,      // Jeder Test wird 5x ausgeführt
    WARMUP_RUNS: 1,        // 1 Warmup-Lauf vor Messung
    PERSONNEL_COUNT: 50,   // Anzahl Test-Personen
    MONTHS_TO_FILL: 12,    // Monate mit Daten
    DAYS_PER_MONTH: 30     // Tage pro Monat (vereinfacht)
};

class PerformanceTester {
    constructor(adapter, dbType = 'sqlite') {
        this.adapter = adapter;
        this.dbType = dbType;
        this.results = [];
    }
    
    async measureOperation(name, operation, runs = CONFIG.RUNS_PER_TEST) {
        const times = [];
        
        console.log(`  ⏱️  ${name}...`);
        
        // Warmup
        for (let i = 0; i < CONFIG.WARMUP_RUNS; i++) {
            await operation();
        }
        
        // Eigentliche Messungen
        for (let i = 0; i < runs; i++) {
            const start = performance.now();
            await operation();
            const end = performance.now();
            times.push(end - start);
        }
        
        const avg = times.reduce((a, b) => a + b, 0) / times.length;
        const min = Math.min(...times);
        const max = Math.max(...times);
        const median = this.calculateMedian(times);
        
        const result = { name, avg, min, max, median, times };
        this.results.push(result);
        
        console.log(`     ✅ ${avg.toFixed(2)}ms (min: ${min.toFixed(2)}ms, max: ${max.toFixed(2)}ms, median: ${median.toFixed(2)}ms)`);
        return result;
    }
    
    calculateMedian(values) {
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0 
            ? (sorted[mid - 1] + sorted[mid]) / 2 
            : sorted[mid];
    }
    
    generateReport() {
        console.log('\n📊 Performance-Report:');
        console.log('═══════════════════════════════════════════════════════════════');
        
        const total = this.results.reduce((sum, r) => sum + r.avg, 0);
        
        this.results.forEach(r => {
            const percent = ((r.avg / total) * 100).toFixed(1);
            const bar = '█'.repeat(Math.round(r.avg / total * 40));
            console.log(`${r.name.padEnd(35)} ${r.avg.toFixed(2).padStart(8)}ms ${bar}`);
        });
        
        console.log('═══════════════════════════════════════════════════════════════');
        console.log(`Gesamt: ${total.toFixed(2)}ms`);
        
        return {
            timestamp: new Date().toISOString(),
            dbType: this.dbType,
            config: CONFIG,
            system: {
                platform: process.platform,
                arch: process.arch,
                nodeVersion: process.version,
                cpus: require('os').cpus().length
            },
            results: this.results,
            total
        };
    }
}

/**
 * Generiert reproduzierbare Test-Daten für Performance-Tests
 */
async function generateTestData(adapter) {
    console.log('\n📊 Generiere Test-Daten...');
    console.log(`   Personen: ${CONFIG.PERSONNEL_COUNT}`);
    console.log(`   Zeitraum: ${CONFIG.MONTHS_TO_FILL} Monate`);
    
    const startTime = performance.now();
    
    // 1. Personal anlegen
    console.log('   1/3: Erstelle Personal...');
    const personnelIds = [];
    for (let i = 1; i <= CONFIG.PERSONNEL_COUNT; i++) {
        const id = await adapter.addPersonnel({
            name: `TestPerson${i}`,
            vorname: `Test${i}`,
            teilzeit: 100,
            fahrzeugfuehrer: i % 3 === 0 ? 1 : 0,
            fahrzeugfuehrerHLFB: i % 5 === 0 ? 1 : 0,
            nef: i % 10 === 0 ? 1 : 0,
            itwMaschinist: i % 4 === 0 ? 1 : 0,
            itwFahrzeugfuehrer: i % 7 === 0 ? 1 : 0
        });
        personnelIds.push(id);
        
        if (i % 10 === 0) {
            process.stdout.write(`      ${i}/${CONFIG.PERSONNEL_COUNT} Personen erstellt...\r`);
        }
    }
    console.log(`      ${CONFIG.PERSONNEL_COUNT}/${CONFIG.PERSONNEL_COUNT} Personen erstellt ✅`);
    
    // 2. Dienstplan füllen
    console.log('   2/3: Fülle Dienstplan...');
    let entryCount = 0;
    const year = new Date().getFullYear();
    const slotTypes = ['rtw1_tag_1', 'rtw1_tag_2', 'rtw1_nacht_1', 'rtw1_nacht_2', 
                       'rtw2_tag_1', 'rtw2_nacht_1', 'nef_tag_1', 'nef_nacht_1'];
    
    for (let month = 0; month < CONFIG.MONTHS_TO_FILL; month++) {
        for (let day = 1; day <= CONFIG.DAYS_PER_MONTH; day++) {
            const date = new Date(year, month, day).toISOString().slice(0, 10);
            
            for (const pid of personnelIds) {
                // 40% Chance auf Eintrag
                if (Math.random() < 0.4) {
                    const slotType = slotTypes[Math.floor(Math.random() * slotTypes.length)];
                    
                    try {
                        await adapter.assignSlot({
                            personId: pid,
                            personType: 'person',
                            date,
                            slotType
                        });
                        entryCount++;
                    } catch (e) {
                        // Slot bereits belegt - ignorieren
                    }
                }
            }
        }
        
        console.log(`      Monat ${month + 1}/${CONFIG.MONTHS_TO_FILL} abgeschlossen (${entryCount} Einträge)`);
    }
    
    // 3. Azubis und Fahrzeuge
    console.log('   3/3: Erstelle Azubis und Fahrzeuge...');
    
    // 5 Azubis
    for (let i = 1; i <= 5; i++) {
        await adapter.addAzubi({
            name: `TestAzubi${i}`,
            vorname: `Azubi${i}`,
            ausbildungsbeginn: `${year}-01-01`
        });
    }
    
    // 3 RTW-Fahrzeuge
    for (let i = 1; i <= 3; i++) {
        await adapter.addRtwVehicle({
            name: `Test-RTW-${i}`,
            kennzeichen: `TEST-RW${i}`
        });
    }
    
    // 2 NEF-Fahrzeuge
    for (let i = 1; i <= 2; i++) {
        await adapter.addNefVehicle({
            name: `Test-NEF-${i}`,
            kennzeichen: `TEST-NE${i}`
        });
    }
    
    const duration = ((performance.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✅ Test-Daten generiert in ${duration}s:`);
    console.log(`   • ${CONFIG.PERSONNEL_COUNT} Personen`);
    console.log(`   • ${entryCount} Dienstplan-Einträge`);
    console.log(`   • 5 Azubis`);
    console.log(`   • 3 RTW-Fahrzeuge`);
    console.log(`   • 2 NEF-Fahrzeuge`);
    
    return { personnelIds, entryCount };
}

async function runPerformanceTests() {
    console.log('🚀 RD-Plan Performance-Tests');
    console.log('════════════════════════════════════════════════════════════════\n');
    
    // 1. Datenbank direkt mit better-sqlite3 initialisieren
    console.log('📦 Initialisiere Test-Datenbank...');
    const Database = require('better-sqlite3');
    
    // Test-Datenbank verwenden
    const testDbDir = path.join(__dirname, 'test-performance-db');
    if (!fs.existsSync(testDbDir)) {
        fs.mkdirSync(testDbDir, { recursive: true });
    }
    
    const testDbPath = path.join(testDbDir, 'rd-plan.db');
    console.log(`   Datenbank: ${testDbPath}`);
    
    // 2. Datenbank öffnen und Schema erstellen
    console.log('   Initialisiere Datenbank...');
    const rawDb = new Database(testDbPath);
    
    // Performance-Optimierungen
    rawDb.pragma('journal_mode = WAL');
    rawDb.pragma('synchronous = NORMAL');
    rawDb.pragma('cache_size = -64000');
    rawDb.pragma('temp_store = MEMORY');
    
    // Schema erstellen (falls nicht vorhanden)
    rawDb.exec(`
        CREATE TABLE IF NOT EXISTS personnel (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            vorname TEXT NOT NULL,
            teilzeit INTEGER NOT NULL DEFAULT 100,
            fahrzeugfuehrer INTEGER NOT NULL DEFAULT 0,
            fahrzeugfuehrerHLFB INTEGER NOT NULL DEFAULT 0,
            nef INTEGER NOT NULL DEFAULT 0,
            itwMaschinist INTEGER NOT NULL DEFAULT 0,
            itwFahrzeugfuehrer INTEGER NOT NULL DEFAULT 0,
            sort INTEGER NOT NULL DEFAULT 0,
            active INTEGER NOT NULL DEFAULT 1
        );
        
        CREATE TABLE IF NOT EXISTS duty_roster (
            date TEXT NOT NULL,
            slotType TEXT NOT NULL,
            personId INTEGER,
            personType TEXT,
            PRIMARY KEY (date, slotType)
        );
        
        CREATE TABLE IF NOT EXISTS azubi (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            vorname TEXT NOT NULL,
            ausbildungsbeginn TEXT,
            sort INTEGER NOT NULL DEFAULT 0
        );
        
        CREATE TABLE IF NOT EXISTS rtw_vehicles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            kennzeichen TEXT
        );
        
        CREATE TABLE IF NOT EXISTS nef_vehicles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            kennzeichen TEXT
        );
        
        CREATE TABLE IF NOT EXISTS itw_vehicles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            kennzeichen TEXT
        );
        
        CREATE TABLE IF NOT EXISTS qualifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL
        );
    `);
    
    // Async-Wrapper für better-sqlite3
    const db = {
        async run(sql, params = []) {
            const stmt = rawDb.prepare(sql);
            return stmt.run(...params);
        },
        async get(sql, params = []) {
            const stmt = rawDb.prepare(sql);
            return stmt.get(...params);
        },
        async all(sql, params = []) {
            const stmt = rawDb.prepare(sql);
            return stmt.all(...params);
        }
    };
    
    // Erstelle einen einfachen Adapter für die Tests
    const adapter = {
        async getPersonnel(includeInactive) {
            const sql = includeInactive 
                ? 'SELECT * FROM personnel ORDER BY sort, id'
                : 'SELECT * FROM personnel WHERE active = 1 ORDER BY sort, id';
            return await db.all(sql);
        },
        
        async addPersonnel(person) {
            const result = await db.run(
                `INSERT INTO personnel (name, vorname, teilzeit, fahrzeugfuehrer, fahrzeugfuehrerHLFB, nef, itwMaschinist, itwFahrzeugfuehrer, sort, active)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 999, 1)`,
                [person.name, person.vorname, person.teilzeit || 100, 
                 person.fahrzeugfuehrer || 0, person.fahrzeugfuehrerHLFB || 0, person.nef || 0,
                 person.itwMaschinist || 0, person.itwFahrzeugfuehrer || 0]
            );
            return result.lastID;
        },
        
        async updatePersonnel(id, person) {
            await db.run(
                `UPDATE personnel 
                 SET name = ?, vorname = ?, teilzeit = ?, fahrzeugfuehrer = ?, fahrzeugfuehrerHLFB = ?, nef = ?
                 WHERE id = ?`,
                [person.name, person.vorname, person.teilzeit, person.fahrzeugfuehrer, person.fahrzeugfuehrerHLFB, person.nef, id]
            );
        },
        
        async deletePersonnel(id) {
            await db.run('DELETE FROM personnel WHERE id = ?', [id]);
        },
        
        async getDutyRoster(year) {
            return await db.all(
                `SELECT * FROM duty_roster WHERE date LIKE ? ORDER BY date`,
                [`${year}-%`]
            );
        },
        
        async assignSlot(entry) {
            await db.run(
                `INSERT OR REPLACE INTO duty_roster (date, slotType, personId, personType)
                 VALUES (?, ?, ?, ?)`,
                [entry.date, entry.slotType, entry.personId, entry.personType]
            );
        },
        
        async clearSlot(date, slotType) {
            await db.run(
                `DELETE FROM duty_roster WHERE date = ? AND slotType = ?`,
                [date, slotType]
            );
        },
        
        async getAzubiList() {
            return await db.all('SELECT * FROM azubi ORDER BY sort, id');
        },
        
        async addAzubi(azubi) {
            const result = await db.run(
                `INSERT INTO azubi (name, vorname, ausbildungsbeginn, sort)
                 VALUES (?, ?, ?, 999)`,
                [azubi.name, azubi.vorname, azubi.ausbildungsbeginn]
            );
            return result.lastID;
        },
        
        async getRtwVehicles() {
            return await db.all('SELECT * FROM rtw_vehicles ORDER BY name');
        },
        
        async addRtwVehicle(vehicle) {
            const result = await db.run(
                `INSERT INTO rtw_vehicles (name, kennzeichen) VALUES (?, ?)`,
                [vehicle.name, vehicle.kennzeichen]
            );
            return result.lastID;
        },
        
        async getNefVehicles() {
            return await db.all('SELECT * FROM nef_vehicles ORDER BY name');
        },
        
        async addNefVehicle(vehicle) {
            const result = await db.run(
                `INSERT INTO nef_vehicles (name, kennzeichen) VALUES (?, ?)`,
                [vehicle.name, vehicle.kennzeichen]
            );
            return result.lastID;
        },
        
        async getItwVehicles() {
            return await db.all('SELECT * FROM itw_vehicles ORDER BY name');
        },
        
        async getQualificationsList() {
            return await db.all('SELECT * FROM qualifications ORDER BY name');
        }
    };
    
    console.log('   ✅ Datenbank bereit\n');
    
    // 3. Test-Daten prüfen/generieren
    const personnel = await adapter.getPersonnel();
    if (personnel.length < CONFIG.PERSONNEL_COUNT) {
        console.log('⚠️  Zu wenig Test-Daten vorhanden - generiere neue...');
        await generateTestData(adapter);
    } else {
        console.log(`📊 Nutze existierende Test-Daten: ${personnel.length} Personen\n`);
    }
    
    // 4. Performance-Tests durchführen
    const tester = new PerformanceTester(adapter, 'sqlite');
    const year = new Date().getFullYear();
    
    console.log('📏 Starte Performance-Messungen...\n');
    
    // Lese-Operationen
    console.log('📖 Lese-Operationen:');
    await tester.measureOperation('getPersonnel()', async () => {
        await adapter.getPersonnel();
    });
    
    await tester.measureOperation('getPersonnel(includeInactive)', async () => {
        await adapter.getPersonnel(true);
    });
    
    await tester.measureOperation('getDutyRoster(year)', async () => {
        await adapter.getDutyRoster(year);
    });
    
    await tester.measureOperation('getAzubiList()', async () => {
        await adapter.getAzubiList();
    });
    
    await tester.measureOperation('getRtwVehicles()', async () => {
        await adapter.getRtwVehicles();
    });
    
    await tester.measureOperation('getNefVehicles()', async () => {
        await adapter.getNefVehicles();
    });
    
    await tester.measureOperation('getItwVehicles()', async () => {
        await adapter.getItwVehicles();
    });
    
    await tester.measureOperation('getQualificationsList()', async () => {
        await adapter.getQualificationsList();
    });
    
    // Schreib-Operationen (mit Cleanup)
    console.log('\n📝 Schreib-Operationen:');
    let testPersonId;
    await tester.measureOperation('addPersonnel()', async () => {
        testPersonId = await adapter.addPersonnel({
            name: 'PerfTest',
            vorname: 'Temp',
            teilzeit: 100,
            fahrzeugfuehrer: 0,
            fahrzeugfuehrerHLFB: 0,
            nef: 0
        });
    });
    
    await tester.measureOperation('updatePersonnel()', async () => {
        await adapter.updatePersonnel(testPersonId, {
            name: 'PerfTest',
            vorname: 'Updated',
            teilzeit: 80,
            fahrzeugfuehrer: 1,
            fahrzeugfuehrerHLFB: 0,
            nef: 0
        });
    });
    
    const testDate = new Date().toISOString().slice(0, 10);
    await tester.measureOperation('assignSlot()', async () => {
        await adapter.assignSlot({
            personId: testPersonId,
            personType: 'person',
            date: testDate,
            slotType: 'rtw1_tag_1'
        });
    });
    
    await tester.measureOperation('clearSlot()', async () => {
        await adapter.clearSlot(testDate, 'rtw1_tag_1');
    });
    
    await tester.measureOperation('deletePersonnel()', async () => {
        await adapter.deletePersonnel(testPersonId);
    });
    
    // 5. Report generieren und speichern
    const report = tester.generateReport();
    
    const timestamp = Date.now();
    const reportPath = path.join(__dirname, `performance-report-${timestamp}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`\n💾 Report gespeichert: ${path.basename(reportPath)}`);
    console.log(`\n✅ Performance-Tests abgeschlossen!`);
    
    return report;
}

// Script ausführen
if (require.main === module) {
    runPerformanceTests()
        .then(() => {
            process.exit(0);
        })
        .catch(err => {
            console.error('\n❌ Fehler:', err);
            console.error(err.stack);
            process.exit(1);
        });
}

module.exports = { runPerformanceTests, generateTestData, PerformanceTester };
