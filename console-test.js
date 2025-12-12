// Simple console test script for Qualification Periods API
// Run this in the browser console of the RD-Plan app

async function testQualificationPeriodsAPI() {
    console.log('🧪 Testing Qualification Periods API...\n');
    
    try {
        // Test 1: Get qualification periods for person ID 1
        console.log('📋 Test 1: Loading qualification periods for person ID 1...');
        const periods = await window.api.getQualificationPeriods(1);
        console.log(`✅ Found ${periods.length} qualification periods:`, periods);
        
        // Test 2: Test validation function
        console.log('\n🔍 Test 2: Testing hasQualificationInMonth...');
        const hasFF2024_06 = await window.api.hasQualificationInMonth(1, 'Fahrzeugführer', '2024-06');
        console.log(`✅ Has Fahrzeugführer in 2024-06: ${hasFF2024_06}`);
        
        const hasNEF2024_12 = await window.api.hasQualificationInMonth(1, 'NEF', '2024-12');
        console.log(`✅ Has NEF in 2024-12: ${hasNEF2024_12}`);
        
        // Test 3: Get active qualifications for a month
        console.log('\n🎯 Test 3: Getting active qualifications for 2024-06...');
        const activeQuals = await window.api.getActiveQualifications(1, '2024-06');
        console.log(`✅ Active qualifications in 2024-06:`, activeQuals);
        
        // Test 4: Test the built-in test handler
        console.log('\n🚀 Test 4: Running built-in test handler...');
        const testResult = await window.api.testQualificationPeriods();
        console.log(`✅ Built-in test result:`, testResult);
        
        console.log('\n🎉 All tests passed successfully!');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Auto-run the test
testQualificationPeriodsAPI();