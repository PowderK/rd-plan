// Test der getQualificationPeriods API
const { app, BrowserWindow, ipcMain } = require('electron');
const Database = require('./main/database');

async function testGetQualificationPeriods() {
  console.log('Testing getQualificationPeriods API...');
  
  try {
    const db = new Database();
    await db.init();
    
    const personId = 2; // Benjamin Kreitz
    console.log(`Loading qualification periods for person ID: ${personId}`);
    
    const periods = await db.getQualificationPeriods(personId);
    console.log('Retrieved qualification periods:', JSON.stringify(periods, null, 2));
    
    console.log('Test completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

testGetQualificationPeriods();