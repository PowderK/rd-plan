#!/usr/bin/env node
/**
 * Debugging Script für Fahrzeug-Problem in Februar 2026
 */

const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

// Suche Datenbank in wahrscheinlichen Locationen
const possiblePaths = [
  path.join(process.cwd(), 'data.db'),
  path.join(process.cwd(), 'rdplan.db'),
  path.join(os.homedir(), '.config/RD-Plan/data.db'),
  path.join(os.homedir(), 'RD-Plan/data.db'),
  path.join(os.homedir(), 'Library/Application Support/RD-Plan/data.db')
];

let dbPath = null;
for (const p of possiblePaths) {
  try {
    const fs = require('fs');
    if (fs.existsSync(p)) {
      dbPath = p;
      break;
    }
  } catch {}
}

if (!dbPath) {
  console.error('❌ Datenbank nicht gefunden in:');
  possiblePaths.forEach(p => console.error('  -', p));
  process.exit(1);
}

console.log('📄 Öffne Datenbank:', dbPath, '\n');

try {
  const db = new Database(dbPath);
  
  // Checke alle Tabellen
  console.log('=== VERFÜGBARE TABELLEN ===');
  const tables = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' 
    ORDER BY name
  `).all();
  
  if (!tables.length) {
    console.log('❌  DATENBANK IST LEER - keine Tabellen vorhanden!');
    db.close();
    process.exit(1);
  }
  
  console.log(`✓ ${tables.length} Tabellen gefunden:`);
  tables.forEach(t => {
    const count = db.prepare(`SELECT COUNT(*) as cnt FROM ${t.name}`).get()?.cnt || 0;
    console.log(`  - ${t.name} (${count} Einträge)`);
  });
  
  const hasRtwVehicles = tables.some(t => t.name === 'rtw_vehicles');
  if (!hasRtwVehicles) {
    console.log('\n❌ KRITISCHER FEHLER: rtw_vehicles Tabelle existiert nicht!');
    console.log('   Datenbank ist nicht korrekt initialisiert.');
    db.close();
    process.exit(1);
  }
  
  if (!rtwVehicles.length) {
    console.log('⚠️  KEINE RTW-Fahrzeuge in Datenbank!');
  } else {
    console.log(`✓ ${rtwVehicles.length} RTW-Fahrzeuge gefunden:`);
    rtwVehicles.forEach(v => {
      console.log(`  ID ${v.id}: ${v.name} | archived_year: ${v.archived_year} | visible_2026: ${v.visible_2026}`);
    });
  }
  
  // Test 2: RTW Vehicle Periods
  console.log('\n=== RTW VEHICLE PERIODS ===');
  const rtwPeriods = db.prepare(`
    SELECT id, vehicleId, startYM, endYM, active
    FROM rtw_vehicle_periods
    ORDER BY vehicleId, startYM
  `).all();
  
  if (!rtwPeriods.length) {
    console.log('⚠️  KEINE RTW-Fahrzeugperioden definiert!');
  } else {
    console.log(`✓ ${rtwPeriods.length} RTW-Fahrzeugperioden gefunden:`);
    rtwPeriods.forEach(p => {
      console.log(`  Fahrzeug ${p.vehicleId}: ${p.startYM} → ${p.endYM || '∞'} (aktiv: ${p.active})`);
    });
  }
  
  // Test 3: Simuliere getRtwVehicleActivations(2026)
  console.log('\n=== SIMULATED getRtwVehicleActivations(2026) ===');
  const year = 2026;
  const visibleVehicles = rtwVehicles.filter(v => v.visible_2026);
  
  if (!visibleVehicles.length) {
    console.log('❌ PROBLEM: getRtwVehicles(2026) würde KEINE Fahrzeuge zurückgeben!');
    console.log('   Grund: Sie sind alle mit archived_year <= 2026');
  } else {
    console.log(`✓ ${visibleVehicles.length} Fahrzeuge würden für 2026 sichtbar sein`);
    
    const activations = [];
    for (const v of visibleVehicles) {
      const periods = db.prepare('SELECT * FROM rtw_vehicle_periods WHERE vehicleId = ?').all(v.id);
      
      for (let m = 1; m <= 12; m++) {
        const ym = `${year}-${String(m).padStart(2, '0')}`;
        let isActive = periods.length === 0; // Keine Perioden = aktiv
        
        if (periods.length > 0) {
          isActive = periods.some(p =>
            (p.active === 1 || p.active === true) &&
            p.startYM <= ym &&
            (p.endYM === null || p.endYM === '' || p.endYM >= ym)
          );
        }
        
        activations.push({ vehicleId: v.id, month: m, enabled: isActive ? 1 : 0 });
      }
    }
    
    console.log(`  Insges: ${activations.length} Aktivierungs-Einträge`);
    console.log(`  Februar (Monat 2): ${activations.filter(a => a.month === 2 && a.enabled).length} aktiviert`);
    
    const febActivations = activations.filter(a => a.month === 2);
    febActivations.forEach(a => {
      console.log(`    Fahrzeug ${a.vehicleId}: ${a.enabled === 1 ? '✓ AKTIV' : '❌ INAKTIV'}`);
    });
  }
  
  // Test 4: NEF Fahrzeuge
  console.log('\n=== NEF VEHICLES ===');
  const nefVehicles = db.prepare(`
    SELECT id, name, sort, archived_year, occupancy_mode
    FROM nef_vehicles 
    ORDER BY id
  `).all();
  
  if (!nefVehicles.length) {
    console.log('⚠️  KEINE NEF-Fahrzeuge in Datenbank!');
  } else {
    console.log(`✓${nefVehicles.length} NEF-Fahrzeuge gefunden`);
  }
  
  // Test 5: ITW Fahrzeuge
  console.log('\n=== ITW VEHICLES ===');
  const itwVehicles = db.prepare(`
    SELECT id, name, sort, archived_year
    FROM itw_vehicles 
    ORDER BY id
  `).all();
  
  if (!itwVehicles.length) {
    console.log('⚠️  KEINE ITW-Fahrzeuge in Datenbank!');
  } else {
    console.log(`✓ ${itwVehicles.length} ITW-Fahrzeuge gefunden`);
  }
  
  console.log('\n=== ZUSAMMENFASSUNG ===');
  const allVehicles = rtwVehicles.length + nefVehicles.length + itwVehicles.length;
  const visible2026 = rtwVehicles.filter(v => v.visible_2026).length + nefVehicles.length + itwVehicles.length;
  
  console.log(`Gesamt-Fahrzeuge: ${allVehicles}`);
  console.log(`Sichtbar in 2026: ${visible2026}`);
  
  if (visible2026 === 0) {
    console.log('\n❌ PROBLEM GEFUNDEN: KEINE Fahrzeuge sind in 2026 sichtbar!');
    console.log('   Grund: archived_year ist auf 2026 oder früher gesetzt.');
    console.log('   Lösung: Fahrzeuge neu erstellen ODER archived_year auf NULL setzen');
  }
  
  db.close();
} catch (error) {
  console.error('❌ Fehler:', error.message);
  process.exit(1);
}
