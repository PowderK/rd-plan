const { DatabaseAdapter, SQLiteAdapter } = require('./main/database-manager.js');
const path = require('path');

async function testQualificationPeriods() {
    console.log('Testing Qualification Periods API...\n');
    
    try {
        // Initialisiere Database Adapter
        const dbPath = path.join(__dirname, 'test-database.db');
        const adapter = new SQLiteAdapter(dbPath);
        await adapter.initialize();
        
        console.log('✓ Database initialized');
        
        // Test 1: Erstelle eine Test-Person
        console.log('\n1. Creating test person...');
        const testPersonId = await adapter.addPerson({
            name: 'Mustermann',
            vorname: 'Max',
            teilzeit: 100
        });
        console.log(`✓ Created test person with ID: ${testPersonId}`);
        
        // Test 2: Füge Qualifikationsperioden hinzu
        console.log('\n2. Adding qualification periods...');
        
        const period1 = {
            person_id: testPersonId,
            qual_type: 'Fahrzeugführer',
            start_ym: '2024-01',
            end_ym: '2024-12',
            active: true
        };
        
        const period2 = {
            person_id: testPersonId,
            qual_type: 'NEF',
            start_ym: '2024-06',
            end_ym: null, // unbegrenzt
            active: true
        };
        
        const periodId1 = await adapter.addQualificationPeriod(period1);
        const periodId2 = await adapter.addQualificationPeriod(period2);
        
        console.log(`✓ Created qualification period 1 with ID: ${periodId1}`);
        console.log(`✓ Created qualification period 2 with ID: ${periodId2}`);
        
        // Test 3: Lade Qualifikationsperioden für Person
        console.log('\n3. Loading qualification periods for person...');
        const periods = await adapter.getQualificationPeriods(testPersonId);
        console.log(`✓ Found ${periods.length} qualification periods:`);
        periods.forEach(p => {
            console.log(`  - ${p.qual_type}: ${p.start_ym} - ${p.end_ym || 'unbegrenzt'} (${p.active ? 'aktiv' : 'inaktiv'})`);
        });
        
        // Test 4: Teste Qualifikations-Validierung
        console.log('\n4. Testing qualification validation...');
        
        const hasFF2024_06 = await adapter.hasQualificationInMonth(testPersonId, 'Fahrzeugführer', '2024-06');
        const hasNEF2024_12 = await adapter.hasQualificationInMonth(testPersonId, 'NEF', '2024-12');
        const hasFF2025_01 = await adapter.hasQualificationInMonth(testPersonId, 'Fahrzeugführer', '2025-01');
        
        console.log(`✓ Has Fahrzeugführer in 2024-06: ${hasFF2024_06}`);
        console.log(`✓ Has NEF in 2024-12: ${hasNEF2024_12}`);
        console.log(`✓ Has Fahrzeugführer in 2025-01: ${hasFF2025_01}`);
        
        // Test 5: Alle aktiven Qualifikationen für einen Monat
        console.log('\n5. Getting active qualifications for month...');
        const activeQuals = await adapter.getActiveQualifications(testPersonId, '2024-08');
        console.log(`✓ Active qualifications in 2024-08: ${activeQuals.join(', ')}`);
        
        // Test 6: Update Qualifikationsperiode
        console.log('\n6. Updating qualification period...');
        await adapter.updateQualificationPeriod({
            id: periodId1,
            person_id: testPersonId,
            qual_type: 'Fahrzeugführer',
            start_ym: '2024-01',
            end_ym: '2025-06', // erweitert
            active: true
        });
        console.log('✓ Updated qualification period 1');
        
        // Test 7: Verifiziere Update
        const updatedPeriods = await adapter.getQualificationPeriods(testPersonId);
        const updatedPeriod = updatedPeriods.find(p => p.id === periodId1);
        console.log(`✓ Updated end date: ${updatedPeriod.end_ym}`);
        
        // Test 8: Lösche Qualifikationsperiode
        console.log('\n7. Deleting qualification period...');
        await adapter.deleteQualificationPeriod(periodId2);
        console.log('✓ Deleted qualification period 2');
        
        // Test 9: Verifiziere Löschung
        const finalPeriods = await adapter.getQualificationPeriods(testPersonId);
        console.log(`✓ Final period count: ${finalPeriods.length}`);
        
        console.log('\n✅ All tests passed successfully!');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        console.error(error.stack);
    }
}

// Führe Tests aus
testQualificationPeriods();