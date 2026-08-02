const Database = require('better-sqlite3');
const db = new Database('/Users/benni/Documents/RD-Plan_DB/rd-plan.db');

console.log('=== RTW VEHICLES (für 2026 sichtbar?) ===');
const rtwVehicles = db.prepare('SELECT id, name, archived_year FROM rtw_vehicles ORDER BY id').all();
rtwVehicles.forEach(v => {
  const visible = !v.archived_year || v.archived_year > 2026;
  console.log(`  ID ${v.id}: ${v.name} | archived_year: ${v.archived_year} | sichtbar in 2026: ${visible}`);
});

console.log('\n=== RTW VEHICLE PERIODS ===');
const rtwPeriods = db.prepare('SELECT id, vehicleId, startYM, endYM, active FROM rtw_vehicle_periods ORDER BY vehicleId, startYM').all();
console.log('Total:', rtwPeriods.length, 'Perioden');
rtwPeriods.forEach(p => console.log(`  Fahrzeug ${p.vehicleId}: ${p.startYM} → ${p.endYM || '∞'} (aktiv: ${p.active})`));

console.log('\n=== NEF VEHICLES (für 2026 sichtbar?) ===');
const nefVehicles = db.prepare('SELECT id, name, archived_year FROM nef_vehicles ORDER BY id').all();
nefVehicles.forEach(v => {
  const visible = !v.archived_year || v.archived_year > 2026;
  console.log(`  ID ${v.id}: ${v.name} | archived_year: ${v.archived_year} | sichtbar in 2026: ${visible}`);
});

console.log('\n=== NEF VEHICLE PERIODS ===');
const nefPeriods = db.prepare('SELECT id, vehicleId, startYM, endYM, active FROM nef_vehicle_periods ORDER BY vehicleId, startYM').all();
console.log('Total:', nefPeriods.length, 'Perioden');
nefPeriods.forEach(p => console.log(`  Fahrzeug ${p.vehicleId}: ${p.startYM} → ${p.endYM || '∞'} (aktiv: ${p.active})`));

console.log('\n=== ITW VEHICLES ===');
const itwVehicles = db.prepare('SELECT id, name, archived_year FROM itw_vehicles ORDER BY id').all();
itwVehicles.forEach(v => {
  const visible = !v.archived_year || v.archived_year > 2026;
  console.log(`  ID ${v.id}: ${v.name} | archived_year: ${v.archived_year} | sichtbar in 2026: ${visible}`);
});

db.close();
