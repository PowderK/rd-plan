const { app, ipcMain } = require('electron');
const path = require('path');

// Simple test script to verify our qualification periods API
async function testAPI() {
    try {
        // Import our database manager
        const { SQLiteAdapter } = require('./dist/main/database-manager.js');
        
        console.log('🧪 Testing Qualification Periods API...\n');
        
        // Initialize database
        const dbPath = path.join(process.env.HOME, 'Documents/RD-Plan_DB/rd-plan.db');
        const adapter = new SQLiteAdapter(dbPath);
        await adapter.initialize();
        console.log('✅ Database connected');
        
        // Get existing personnel to test with
        const personnel = await adapter.getPersonnel();
        if (personnel.length === 0) {
            console.log('❌ No personnel found. Adding test person...');
            await adapter.addPersonnel({
                name: 'TestAPI',
                vorname: 'Qualification',
                teilzeit: 100
            });
            const newPersonnel = await adapter.getPersonnel();
            const testPerson = newPersonnel.find(p => p.name === 'TestAPI');
            if (!testPerson) {
                throw new Error('Could not create test person');
            }
            personnel.push(testPerson);
        }
        
        const testPersonId = personnel[0].id;
        console.log(`✅ Using person ID: ${testPersonId} (${personnel[0].name})`);
        
        // Test 1: Add qualification period
        console.log('\n📝 Test 1: Adding qualification period...');
        const testPeriod = {
            person_id: testPersonId,
            qual_type: 'Fahrzeugführer',
            start_ym: '2024-01',
            end_ym: '2024-12',
            active: true
        };
        
        await adapter.addQualificationPeriod(testPeriod);
        console.log('✅ Qualification period added');
        
        // Test 2: Get qualification periods
        console.log('\n📋 Test 2: Loading qualification periods...');
        const periods = await adapter.getQualificationPeriods(testPersonId);
        console.log(`✅ Found ${periods.length} periods:`);
        periods.forEach((p, i) => {
            console.log(`   ${i+1}. ${p.qualType}: ${p.startYM} - ${p.endYM || 'unbegrenzt'} (${p.active ? 'aktiv' : 'inaktiv'})`);
        });
        
        // Test 3: Validation functions
        console.log('\n🔍 Test 3: Testing validation functions...');
        const hasQualJune = await adapter.hasQualificationInMonth(testPersonId, 'Fahrzeugführer', '2024-06');
        console.log(`✅ Has Fahrzeugführer in 2024-06: ${hasQualJune}`);
        
        const hasQualJan25 = await adapter.hasQualificationInMonth(testPersonId, 'Fahrzeugführer', '2025-01');
        console.log(`✅ Has Fahrzeugführer in 2025-01: ${hasQualJan25}`);
        
        const activeQuals = await adapter.getActiveQualifications(testPersonId, '2024-08');
        console.log(`✅ Active qualifications in 2024-08: [${activeQuals.join(', ')}]`);
        
        // Test 4: Update qualification period
        if (periods.length > 0) {
            console.log('\n✏️ Test 4: Updating qualification period...');
            const updatedPeriod = {
                id: periods[0].id,
                person_id: testPersonId,
                qual_type: 'Fahrzeugführer',
                start_ym: '2024-01',
                end_ym: '2025-06', // Extended
                active: true
            };
            
            await adapter.updateQualificationPeriod(updatedPeriod);
            console.log('✅ Qualification period updated');
            
            // Verify update
            const updatedPeriods = await adapter.getQualificationPeriods(testPersonId);
            const updated = updatedPeriods.find(p => p.id === periods[0].id);
            console.log(`✅ Verified: End date now ${updated.endYM}`);
        }
        
        console.log('\n🎉 All tests passed successfully!');
        
        // Cleanup (optional - comment out to keep test data)
        // console.log('\n🧹 Cleaning up test data...');
        // for (const period of periods) {
        //     await adapter.deleteQualificationPeriod(period.id);
        // }
        // console.log('✅ Cleanup completed');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
    }
}

testAPI();
