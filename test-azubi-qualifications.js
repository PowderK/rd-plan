// Test-Skript für erweiterte Azubi-Qualifikationen
console.log('Testing Azubi qualification system...');

// Diese Tests würden in der Electron-Konsole ausgeführt werden:
const tests = [
  {
    description: "RTW Fahrzeugführer Tag (nur qualifizierte Personen)",
    cellType: 'rtw1_tag_1',
    date: '2025-11-15',
    expected: ['Benjamin Kreitz'] // nur Personen mit Fahrzeugführer-Qualifikation
  },
  {
    description: "RTW Maschinist Tag (qualifizierte Personen + Azubis ab 2. Lj.)", 
    cellType: 'rtw1_tag_2',
    date: '2025-11-15',
    expected: ['Benjamin Kreitz', 'Wegner 2 (2. Lj.)'] // Benjamin + 2./3. Lehrjahr Azubis
  },
  {
    description: "RTW Maschinist Nacht (qualifizierte Personen + Azubis ab 2. Lj.)",
    cellType: 'rtw1_nacht_2', 
    date: '2025-11-15',
    expected: ['Benjamin Kreitz', 'Wegner 2 (2. Lj.)'] // Benjamin + 2./3. Lehrjahr Azubis
  },
  {
    description: "NEF Position (nur qualifizierte Personen)",
    cellType: 'nef1_tag_1',
    date: '2025-11-15', 
    expected: ['Benjamin Kreitz', 'Sven Sporleder'] // beide haben NEF-Qualifikation
  }
];

console.log('Expected test results:');
tests.forEach((test, i) => {
  console.log(`Test ${i+1}: ${test.description}`);
  console.log(`Cell Type: ${test.cellType}`);
  console.log(`Expected: ${test.expected.join(', ')}`);
  console.log('---');
});

console.log('\nTo run these tests in Electron Developer Tools:');
console.log('1. Start the app with npm start');
console.log('2. Open Developer Tools (Ctrl/Cmd + Shift + I)');  
console.log('3. Run the following commands in the console:');
console.log('');

tests.forEach((test, i) => {
  console.log(`// Test ${i+1}: ${test.description}`);
  console.log(`window.api.getQualifiedPersonsForPosition("", "${test.date}", "${test.cellType}").then(console.log)`);
  console.log('');
});

console.log('Expected Azubi behavior:');
console.log('- 1. Lehrjahr: Nur in normalen Azubi-Feldern, NICHT in Maschinist-Positionen');
console.log('- 2.+3. Lehrjahr: In Azubi-Feldern UND Maschinist-Positionen (rtw*_tag_2, rtw*_nacht_2)');
console.log('- Qualifizierte Personen: In allen entsprechenden Positionen basierend auf ihren Qualifikationen');