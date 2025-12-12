// Test-Skript für getQualifiedPersonsForPosition API
console.log('Testing getQualifiedPersonsForPosition API...');

// Diese Tests würden in der Electron-Konsole ausgeführt werden:
const tests = [
  {
    position: 'FzF', // Fahrzeugführer
    date: '2025-11-15',
    expected: ['Benjamin Kreitz'] // hat Fahrzeugführer-Qualifikation
  },
  {
    position: 'NEF',
    date: '2025-11-15', 
    expected: ['Benjamin Kreitz', 'Sven Sporleder'] // beide haben NEF
  },
  {
    position: 'ITW-M', // ITW Maschinist
    date: '2025-11-15',
    expected: [] // Sven hat ITW Maschinist nur bis 2024-08
  },
  {
    position: 'ITW-M', // ITW Maschinist
    date: '2024-05-15', // in der Zeit als Sven die Qualifikation hatte
    expected: ['Sven Sporleder']
  },
  {
    position: 'Unknown', // Position ohne Qualifikationsanforderung
    date: '2025-11-15',
    expected: 'alle aktiven Personen' // sollte alle zurückgeben
  }
];

console.log('Expected test results:');
tests.forEach((test, i) => {
  console.log(`Test ${i+1}: Position "${test.position}" am ${test.date}`);
  console.log(`Expected: ${Array.isArray(test.expected) ? test.expected.join(', ') : test.expected}`);
  console.log('---');
});

console.log('\nTo run these tests in Electron:');
console.log('1. Start the app with npm start');
console.log('2. Open Developer Tools (Ctrl/Cmd + Shift + I)');
console.log('3. Run the following commands in the console:');
console.log('');
console.log('// Test Fahrzeugführer (should return Benjamin)');
console.log('window.api.getQualifiedPersonsForPosition("FzF", "2025-11-15").then(console.log)');
console.log('');
console.log('// Test NEF (should return Benjamin and Sven)');  
console.log('window.api.getQualifiedPersonsForPosition("NEF", "2025-11-15").then(console.log)');
console.log('');
console.log('// Test ITW-M current (should return empty)');
console.log('window.api.getQualifiedPersonsForPosition("ITW-M", "2025-11-15").then(console.log)');
console.log('');
console.log('// Test ITW-M past (should return Sven)');
console.log('window.api.getQualifiedPersonsForPosition("ITW-M", "2024-05-15").then(console.log)');
console.log('');
console.log('// Test unknown position (should return all active persons)');  
console.log('window.api.getQualifiedPersonsForPosition("Unknown", "2025-11-15").then(console.log)');