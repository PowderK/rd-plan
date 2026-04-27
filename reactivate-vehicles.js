const Database = require('better-sqlite3');
const db = new Database('/Users/benni/Documents/RD-Plan_DB/rd-plan.db');

console.log('🔧 Reaktiviere Fahrzeuge (archived_year = NULL)...\n');

// RTW
const rtwUpdate = db.prepare('UPDATE rtw_vehicles SET archived_year = NULL WHERE archived_year IS NOT NULL').run();
console.log(`✅ RTW: ${rtwUpdate.changes} Fahrzeuge aktiviert`);

// NEF
const nefUpdate = db.prepare('UPDATE nef_vehicles SET archived_year = NULL WHERE archived_year IS NOT NULL').run();
console.log(`✅ NEF: ${nefUpdate.changes} Fahrzeuge aktiviert`);

// ITW
const itwUpdate = db.prepare('UPDATE itw_vehicles SET archived_year = NULL WHERE archived_year IS NOT NULL').run();
console.log(`✅ ITW: ${itwUpdate.changes} Fahrzeuge aktiviert`);

console.log('\n✅ ALLE FAHRZEUGE REAKTIVIERT!');
console.log('\nVerifizierung:');

const rtwAll = db.prepare('SELECT id, name, archived_year FROM rtw_vehicles ORDER BY id').all();
console.log('RTW nach Update:', rtwAll.map(v => `${v.name} (${v.archived_year === null ? 'aktiv' : 'archiviert'})`).join(', '));

const nefAll = db.prepare('SELECT id, name, archived_year FROM nef_vehicles ORDER BY id').all();
console.log('NEF nach Update:', nefAll.map(v => `${v.name} (${v.archived_year === null ? 'aktiv' : 'archiviert'})`).join(', '));

db.close();
