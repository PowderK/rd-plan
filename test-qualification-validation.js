const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Importiere die Validierungsfunktion (simuliert)
// Da wir die echte Funktion nicht direkt importieren können, simulieren wir sie hier

const dbPath = path.join(process.env.HOME, 'Documents/RD-Plan_DB/rd-plan.db');

const testValidation = async () => {
  const db = new sqlite3.Database(dbPath);
  
  // Test-Szenarios
  const tests = [
    {
      description: 'Benjamin Kreitz (ID 2) RTT Dienst im November 2025',
      personId: 2,
      shiftValue: 'RTT',
      date: '2025-11-15'
    },
    {
      description: 'Sven Sporleder (ID 19) RTT Dienst im November 2025', 
      personId: 19,
      shiftValue: 'RTT',
      date: '2025-11-15'
    },
    {
      description: 'Person ohne Qualifikation RTT Dienst',
      personId: 3, // Tim Dalchow
      shiftValue: 'RTT', 
      date: '2025-11-15'
    }
  ];

  for (const test of tests) {
    console.log(`\n--- Test: ${test.description} ---`);
    
    // Hole aktuelle Qualifikationen für die Person im gegebenen Monat
    const qualQuery = `
      SELECT qp.qualType, qp.startYM, qp.endYM, qp.active
      FROM qualification_periods qp
      WHERE qp.personId = ? AND qp.active = 1
        AND qp.startYM <= ?
        AND (qp.endYM IS NULL OR qp.endYM >= ?)
    `;
    
    const yearMonth = test.date.substring(0, 7); // '2025-11'
    
    db.all(qualQuery, [test.personId, yearMonth, yearMonth], (err, qualifications) => {
      if (err) {
        console.error('Fehler beim Abrufen der Qualifikationen:', err);
        return;
      }
      
      console.log('Aktuelle Qualifikationen:', qualifications.map(q => q.qualType));
      
      // Prüfe erforderliche Qualifikationen für RTT
      const requiredForRTT = ['Fahrzeugführer'];
      const hasRequired = requiredForRTT.some(req => 
        qualifications.some(qual => qual.qualType === req)
      );
      
      if (hasRequired) {
        console.log('✅ Qualifikation vorhanden - Zuteilung erlaubt');
      } else {
        console.log('❌ Fehlende Qualifikation - Warnung sollte angezeigt werden');
        console.log('Erforderlich:', requiredForRTT);
        console.log('Vorhanden:', qualifications.map(q => q.qualType));
      }
    });
  }
  
  // Schließe DB nach kurzer Verzögerung
  setTimeout(() => {
    db.close();
  }, 1000);
};

testValidation();