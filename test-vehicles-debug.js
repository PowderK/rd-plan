const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

// Finde die RD-Plan Datenbank
const dbPath = path.join(os.homedir(), '.config', 'RD-Plan', 'data.db');
console.log('Opening database:', dbPath);

try {
    const db = new Database(dbPath);
    console.log('Database opened successfully\n');
    
    // Überprüfe RTW-Fahrzeuge
    console.log('=== RTW Vehicles ===');
    const rtwVehicles = db.prepare('SELECT id, name, sort, archived_year FROM rtw_vehicles ORDER BY id').all();
    console.table(rtwVehicles);
    
    // Überprüfe RTW-Perioden
    console.log('\n=== RTW Vehicle Periods ===');
    const rtwPeriods = db.prepare('SELECT id, vehicleId, startYM, endYM, active FROM rtw_vehicle_periods ORDER BY vehicleId, startYM').all();
    console.table(rtwPeriods);
    
    // Überprüfe NEF-Fahrzeuge
    console.log('\n=== NEF Vehicles ===');
    const nefVehicles = db.prepare('SELECT id, name, sort, archived_year FROM nef_vehicles ORDER BY id').all();
    console.table(nefVehicles);
    
    // Überprüfe NEF-Perioden
    console.log('\n=== NEF Vehicle Periods ===');
    const nefPeriods = db.prepare('SELECT id, vehicleId, startYM, endYM, active FROM nef_vehicle_periods ORDER BY vehicleId, startYM').all();
    console.table(nefPeriods);
    
    // Überprüfe ITW-Fahrzeuge
    console.log('\n=== ITW Vehicles ===');
    const itwVehicles = db.prepare('SELECT id, name, sort, archived_year FROM itw_vehicles ORDER BY id').all();
    console.table(itwVehicles);
    
    // Überprüfe ITW-Perioden
    console.log('\n=== ITW Vehicle Periods ===');
    const itwPeriods = db.prepare('SELECT id, vehicleId, startYM, endYM, active FROM itw_vehicle_periods ORDER BY vehicleId, startYM').all();
    console.table(itwPeriods);
    
    // Filter Fahrzeuge für 2026 (wie die App macht)
    console.log('\n=== RTW Vehicles for year 2026 (filtered) ===');
    const filtered2026 = db.prepare('SELECT * FROM rtw_vehicles WHERE archived_year IS NULL OR archived_year > 2026 ORDER BY sort ASC, id ASC').all();
    console.log('Result:', filtered2026);
    console.log('Count:', filtered2026.length);
    
    db.close();
} catch (error) {
    console.error('Error:', error);
    process.exit(1);
}
