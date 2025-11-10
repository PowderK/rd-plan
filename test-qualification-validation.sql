-- Test-Daten für Qualifikations-Validierung
-- Füge eine Testperson ohne passende Qualifikationen hinzu

INSERT INTO personnel (name, vorname, teilzeit, fahrzeugfuehrer, fahrzeugfuehrerHLFB, nef, itwMaschinist, itwFahrzeugfuehrer) 
VALUES ('Test', 'Max', 100, 0, 0, 0, 0, 0);

-- ID der Test-Person ermitteln
SELECT id, name, vorname FROM personnel WHERE name = 'Test' AND vorname = 'Max';