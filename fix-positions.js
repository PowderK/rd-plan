const Database = require('better-sqlite3');
const db = new Database('/Users/benni/Documents/RD-Plan_DB/rd-plan.db');

console.log('🔧 Initialisiere fehlende Vehicle Positions...\n');

// Hilfsfunktion für Position-Initialisierung
const initializePositions = (vehicleType, vehicleId) => {
  let positions = [];
  
  if (vehicleType === 'rtw') {
    positions = [
      { positionName: 'Fahrzeugführer', sort: 0 },
      { positionName: 'Maschinist', sort: 1 },
      { positionName: 'Maschinist (Ersatz)', sort: 2 },
      { positionName: 'Assistent', sort: 3 }
    ];
  } else if (vehicleType === 'nef') {
    positions = [
      { positionName: 'Assistent', sort: 0 }
    ];
  } else if (vehicleType === 'itw') {
    positions = [
      { positionName: 'Arzt', sort: 0 },
      { positionName: 'Rettungsassistent', sort: 1 }
    ];
  }

  for (const pos of positions) {
    db.prepare(
      `INSERT INTO vehicle_positions (vehicleType, vehicleId, positionName, qualificationTypeId, sort) 
       VALUES (?, ?, ?, ?, ?)`
    ).run(vehicleType, vehicleId, pos.positionName, null, pos.sort);
  }
};

// RTW Fahrzeuge
console.log('=== RTW Fahrzeuge ===');
const rtwVehicles = db.prepare('SELECT id FROM rtw_vehicles').all();

for (const v of rtwVehicles) {
  const count = db.prepare(
    'SELECT COUNT(*) as cnt FROM vehicle_positions WHERE vehicleType = ? AND vehicleId = ?'
  ).get('rtw', v.id);
  
  if (count.cnt === 0) {
    console.log(`✓ RTW ${v.id}: Initialisiere 4 Positionen`);
    initializePositions('rtw', v.id);
  }
}

// NEF Fahrzeuge
console.log('\n=== NEF Fahrzeuge ===');
const nefVehicles = db.prepare('SELECT id FROM nef_vehicles').all();

for (const v of nefVehicles) {
  const count = db.prepare(
    'SELECT COUNT(*) as cnt FROM vehicle_positions WHERE vehicleType = ? AND vehicleId = ?'
  ).get('nef', v.id);
  
  if (count.cnt === 0) {
    console.log(`✓ NEF ${v.id}: Initialisiere 1 Position`);
    initializePositions('nef', v.id);
  }
}

// ITW Fahrzeuge
console.log('\n=== ITW Fahrzeuge ===');
const itwVehicles = db.prepare('SELECT id FROM itw_vehicles').all();

for (const v of itwVehicles) {
  const count = db.prepare(
    'SELECT COUNT(*) as cnt FROM vehicle_positions WHERE vehicleType = ? AND vehicleId = ?'
  ).get('itw', v.id);
  
  if (count.cnt === 0) {
    console.log(`✓ ITW ${v.id}: Initialisiere 2 Positionen`);
    initializePositions('itw', v.id);
  }
}

// Verifikation
console.log('\n✅ VERIFIKATION:\n');
const rtwPos = db.prepare('SELECT vehicleId, COUNT(*) as cnt FROM vehicle_positions WHERE vehicleType = ? GROUP BY vehicleId').all('rtw');
console.log('RTW Positionen pro Fahrzeug:');
rtwPos.forEach(p => console.log(`  Fahrzeug ${p.vehicleId}: ${p.cnt} Positionen`));

const nefPos = db.prepare('SELECT vehicleId, COUNT(*) as cnt FROM vehicle_positions WHERE vehicleType = ? GROUP BY vehicleId').all('nef');
console.log('\nNEF Positionen pro Fahrzeug:');
nefPos.forEach(p => console.log(`  Fahrzeug ${p.vehicleId}: ${p.cnt} Positionen`));

const itwPos = db.prepare('SELECT vehicleId, COUNT(*) as cnt FROM vehicle_positions WHERE vehicleType = ? GROUP BY vehicleId').all('itw');
console.log('\nITW Positionen pro Fahrzeug:');
if (itwPos.length > 0) {
  itwPos.forEach(p => console.log(`  Fahrzeug ${p.vehicleId}: ${p.cnt} Positionen`));
} else {
  console.log('  (keine Positionen)');
}

db.close();
console.log('\n✅ ALLE FAHRZEUGE HABEN JETZT POSITIONEN!');
