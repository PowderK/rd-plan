const Database = require('better-sqlite3');
const db = new Database('/Users/benni/Documents/RD-Plan_DB/rd-plan.db');

console.log('=== DEBUGGING: Aktivierungen für 2026 ===\n');

// Simuliere getRtwVehicleActivations(2026)
const year = 2026;
const rtwVehicles = db.prepare('SELECT * FROM rtw_vehicles WHERE archived_year IS NULL OR archived_year > ? ORDER BY sort ASC, id ASC').all(year);

console.log(`RTW Fahrzeuge für ${year}: ${rtwVehicles.length}`);
rtwVehicles.forEach(v => console.log(`  - ID ${v.id}: ${v.name}`));

console.log('\n=== Aktivierungs-Berechnung ===');
const activations = [];

for (const v of rtwVehicles) {
  const periods = db.prepare('SELECT * FROM rtw_vehicle_periods WHERE vehicleId = ?').all(v.id);
  console.log(`\nFahrzeug ${v.id} (${v.name}):`);
  console.log(`  Perioden: ${periods.length}`);
  
  if (periods.length > 0) {
    periods.forEach(p => console.log(`    - ${p.startYM} → ${p.endYM || '∞'} (aktiv: ${p.active})`));
  } else {
    console.log(`    (keine Perioden definiert = aktiv für alle Monate)`);
  }
  
  // Berechne Februar (Monat 2)
  const ym = `${year}-02`;
  let isActive = periods.length === 0;
  
  if (periods.length > 0) {
    isActive = periods.some(p =>
      (p.active === 1 || p.active === true) &&
      p.startYM <= ym &&
      (p.endYM === null || p.endYM === '' || p.endYM >= ym)
    );
  }
  
  console.log(`  → Februar 2026: ${isActive ? '✅ AKTIV' : '❌ INAKTIV'}`);
  activations.push({ vehicleId: v.id, month: 2, enabled: isActive ? 1 : 0 });
}

console.log('\n=== Aktivierungs-Array für Februar ===');
console.log(activations.filter(a => a.month === 2));

// Prüfe auch NEF
console.log('\n\n=== NEF FAHRZEUGE ===\n');

const nefVehicles = db.prepare('SELECT id, name, sort, archived_year, COALESCE(occupancy_mode, \'24h\') as occupancy_mode FROM nef_vehicles WHERE archived_year IS NULL OR archived_year > ? ORDER BY sort ASC, id ASC').all(year);

console.log(`NEF Fahrzeuge für ${year}: ${nefVehicles.length}`);
nefVehicles.forEach(v => console.log(`  - ID ${v.id}: ${v.name}`));

console.log('\n=== NEF Aktivierungs-Berechnung ===');
const nefActivations = [];

for (const v of nefVehicles) {
  const periods = db.prepare('SELECT * FROM nef_vehicle_periods WHERE vehicleId = ?').all(v.id);
  console.log(`\nFahrzeug ${v.id} (${v.name}):`);
  console.log(`  Perioden: ${periods.length}`);
  
  if (periods.length > 0) {
    periods.forEach(p => console.log(`    - ${p.startYM} → ${p.endYM || '∞'} (aktiv: ${p.active})`));
  }
  
  const ym = `${year}-02`;
  let isActive = periods.length === 0;
  
  if (periods.length > 0) {
    isActive = periods.some(p =>
      (p.active === 1 || p.active === true) &&
      p.startYM <= ym &&
      (p.endYM === null || p.endYM === '' || p.endYM >= ym)
    );
  }
  
  console.log(`  → Februar 2026: ${isActive ? '✅ AKTIV' : '❌ INAKTIV'}`);
  nefActivations.push({ vehicleId: v.id, month: 2, enabled: isActive ? 1 : 0 });
}

console.log('\n=== Aktivierungs-Array NEF für Februar ===');
console.log(nefActivations.filter(a => a.month === 2));

// Prüfe Vehicle Positions
console.log('\n\n=== VEHICLE POSITIONS ===\n');

const rtwPositions = db.prepare('SELECT * FROM vehicle_positions WHERE vehicleType = ? ORDER BY vehicleId, sort').all('rtw');
console.log(`RTW Positionen: ${rtwPositions.length}`);
rtwPositions.forEach(p => console.log(`  - Fahrzeug ${p.vehicleId}: ${p.positionName}`));

const nefPositions = db.prepare('SELECT * FROM vehicle_positions WHERE vehicleType = ? ORDER BY vehicleId, sort').all('nef');
console.log(`\nNEF Positionen: ${nefPositions.length}`);
nefPositions.forEach(p => console.log(`  - Fahrzeug ${p.vehicleId}: ${p.positionName}`));

db.close();
