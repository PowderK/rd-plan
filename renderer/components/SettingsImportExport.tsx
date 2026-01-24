import React, { useState } from 'react';

interface SettingsImportResult {
  success: boolean;
  imported: {
    settings: number;
    shiftTypes: number;
    holidays: number;
    itwPatterns: number;
    deptPatterns: number;
    rtwVehicles: number;
    nefVehicles: number;
    itwVehicles: number;
    itwDoctors: number;
    roles: number;
    qualificationTypes: number;
  };
  skipped: number;
  errors: string[];
}

interface PersonnelImportResult {
  success: boolean;
  imported: number;
  updated: number;
  skipped: number;
  errors: string[];
}

interface SettingsImportExportProps {
  onImportComplete?: (result: SettingsImportResult | PersonnelImportResult) => void;
  onClose?: () => void;
}

const SettingsImportExport: React.FC<SettingsImportExportProps> = ({ onImportComplete, onClose }) => {
  const [importing, setImporting] = useState(false);
  const [settingsResult, setSettingsResult] = useState<SettingsImportResult | null>(null);
  const [personnelResult, setPersonnelResult] = useState<PersonnelImportResult | null>(null);
  const [replaceExistingSettings, setReplaceExistingSettings] = useState(false);
  const [replaceExistingPersonnel, setReplaceExistingPersonnel] = useState(false);

  // Personal Excel Import
  const handleImportPersonnelClick = async () => {
    try {
      const dialogResult = await (window as any).electronAPI.invoke('show-open-dialog', {
        title: 'Excel-Datei für Personal-Import auswählen',
        filters: [
          { name: 'Excel-Dateien', extensions: ['xlsx', 'xls'] },
          { name: 'Alle Dateien', extensions: ['*'] }
        ],
        properties: ['openFile']
      });

      if (dialogResult.canceled || !dialogResult.filePaths?.length) {
        return;
      }

      const filePath = dialogResult.filePaths[0];
      setImporting(true);
      setPersonnelResult(null);

      const importResult = await (window as any).electronAPI.invoke('import-personnel-excel', filePath, replaceExistingPersonnel);

      setPersonnelResult(importResult);
      setImporting(false);

      if (onImportComplete) {
        onImportComplete(importResult);
      }

    } catch (error) {
      setPersonnelResult({
        success: false,
        imported: 0,
        updated: 0,
        skipped: 0,
        errors: [`Import fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`]
      });
      setImporting(false);
    }
  };

  // Personal Excel Export
  const handleExportPersonnelClick = async () => {
    try {
      const dialogResult = await (window as any).electronAPI.invoke('show-save-dialog', {
        title: 'Personal-Daten als Excel exportieren',
        defaultPath: `Personal-Export-${new Date().toISOString().slice(0, 10)}.xlsx`,
        filters: [
          { name: 'Excel-Dateien', extensions: ['xlsx'] },
          { name: 'Alle Dateien', extensions: ['*'] }
        ]
      });

      if (dialogResult.canceled || !dialogResult.filePath) {
        return;
      }

      setImporting(true);
      await (window as any).electronAPI.invoke('export-personnel-excel', dialogResult.filePath);
      setImporting(false);

      alert('Personal-Export erfolgreich!');

    } catch (error) {
      setImporting(false);
      alert(`Personal-Export fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // Einstellungen JSON Import
  const handleImportSettingsClick = async () => {
    try {
      const dialogResult = await (window as any).electronAPI.invoke('show-open-dialog', {
        title: 'JSON-Datei für Einstellungs-Import auswählen',
        filters: [
          { name: 'JSON-Dateien', extensions: ['json'] },
          { name: 'Alle Dateien', extensions: ['*'] }
        ],
        properties: ['openFile']
      });

      if (dialogResult.canceled || !dialogResult.filePaths?.length) {
        return;
      }

      const filePath = dialogResult.filePaths[0];
      setImporting(true);
      setSettingsResult(null);

      const importResult = await (window as any).electronAPI.invoke('import-settings-json', filePath, replaceExistingSettings);

      setSettingsResult(importResult);
      setImporting(false);

      if (onImportComplete) {
        onImportComplete(importResult);
      }

    } catch (error) {
      setSettingsResult({
        success: false,
        imported: {
          settings: 0,
          shiftTypes: 0,
          holidays: 0,
          itwPatterns: 0,
          deptPatterns: 0,
          rtwVehicles: 0,
          nefVehicles: 0,
          itwVehicles: 0,
          itwDoctors: 0,
          roles: 0,
          qualificationTypes: 0
        },
        skipped: 0,
        errors: [`Import fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`]
      });
      setImporting(false);
    }
  };

  // Einstellungen JSON Export
  const handleExportSettingsClick = async () => {
    try {
      const dialogResult = await (window as any).electronAPI.invoke('show-save-dialog', {
        title: 'Einstellungen als JSON exportieren',
        defaultPath: `RD-Plan-Einstellungen-${new Date().toISOString().slice(0, 10)}.json`,
        filters: [
          { name: 'JSON-Dateien', extensions: ['json'] },
          { name: 'Alle Dateien', extensions: ['*'] }
        ]
      });

      if (dialogResult.canceled || !dialogResult.filePath) {
        return;
      }

      setImporting(true);
      await (window as any).electronAPI.invoke('export-settings-json', dialogResult.filePath);
      setImporting(false);

      alert('Einstellungen-Export erfolgreich!');

    } catch (error) {
      setImporting(false);
      alert(`Einstellungen-Export fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const getTotalImported = (result: SettingsImportResult) => {
    return result.imported.settings +
      result.imported.shiftTypes +
      result.imported.holidays +
      result.imported.itwPatterns +
      result.imported.deptPatterns +
      result.imported.rtwVehicles +
      result.imported.nefVehicles +
      result.imported.itwVehicles +
      result.imported.itwDoctors +
      result.imported.roles +
      result.imported.qualificationTypes;
  };

  return (
    <div className="settings-import-export-container" style={{ padding: '20px', maxWidth: '700px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0 }}>Import/Export</h2>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Schließen
          </button>
        )}
      </div>

      {/* Personal Excel Import/Export */}
      <div style={{ marginBottom: '40px', padding: '16px', border: '1px solid #ddd', borderRadius: '8px' }}>
        <h3>Personal (Excel)</h3>

        <div style={{ marginBottom: '20px' }}>
          <h4>Import</h4>
          <div style={{ marginBottom: '10px' }}>
            <label>
              <input
                type="checkbox"
                checked={replaceExistingPersonnel}
                onChange={(e) => setReplaceExistingPersonnel(e.target.checked)}
                disabled={importing}
              />
              <span style={{ marginLeft: '8px' }}>
                Bestehende Daten ersetzen
              </span>
            </label>
          </div>
          <button
            onClick={handleImportPersonnelClick}
            disabled={importing}
            style={{
              padding: '10px 20px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: importing ? 'not-allowed' : 'pointer',
              marginRight: '10px'
            }}
          >
            Excel importieren
          </button>
        </div>

        {personnelResult && (
          <div
            style={{
              padding: '10px',
              marginBottom: '15px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              backgroundColor: personnelResult.success ? '#d4edda' : '#f8d7da',
              color: personnelResult.success ? '#155724' : '#721c24'
            }}
          >
            <strong>Import-Ergebnis:</strong><br />
            Status: {personnelResult.success ? 'Erfolgreich' : 'Fehlerhaft'}<br />
            Importiert: {personnelResult.imported}, Aktualisiert: {personnelResult.updated || 0}, Übersprungen: {personnelResult.skipped}
            {personnelResult.errors.length > 0 && (
              <>
                <br /><strong>Fehler:</strong>
                <ul style={{ marginTop: '5px', marginBottom: 0 }}>
                  {personnelResult.errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}

        <div>
          <h4>Export</h4>
          <button
            onClick={handleExportPersonnelClick}
            disabled={importing}
            style={{
              padding: '10px 20px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: importing ? 'not-allowed' : 'pointer'
            }}
          >
            Excel exportieren
          </button>
        </div>
      </div>

      {/* Einstellungen JSON Import/Export */}
      <div style={{ padding: '16px', border: '1px solid #ddd', borderRadius: '8px' }}>
        <h3>Einstellungen (JSON)</h3>

        <div style={{ marginBottom: '20px' }}>
          <h4>Import</h4>
          <div style={{ marginBottom: '10px' }}>
            <label>
              <input
                type="checkbox"
                checked={replaceExistingSettings}
                onChange={(e) => setReplaceExistingSettings(e.target.checked)}
                disabled={importing}
              />
              <span style={{ marginLeft: '8px' }}>
                Bestehende Einstellungen ersetzen
              </span>
            </label>
          </div>
          <button
            onClick={handleImportSettingsClick}
            disabled={importing}
            style={{
              padding: '10px 20px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: importing ? 'not-allowed' : 'pointer'
            }}
          >
            JSON importieren
          </button>
        </div>

        {settingsResult && (
          <div
            style={{
              padding: '10px',
              marginBottom: '15px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              backgroundColor: settingsResult.success ? '#d4edda' : '#f8d7da',
              color: settingsResult.success ? '#155724' : '#721c24'
            }}
          >
            <strong>Import-Ergebnis:</strong><br />
            Status: {settingsResult.success ? 'Erfolgreich' : 'Fehlerhaft'}<br />
            Importiert: {getTotalImported(settingsResult)}, Übersprungen: {settingsResult.skipped}
            {settingsResult.errors.length > 0 && (
              <>
                <br /><strong>Fehler:</strong>
                <ul style={{ marginTop: '5px', marginBottom: 0 }}>
                  {settingsResult.errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}

        <div>
          <h4>Export</h4>
          <button
            onClick={handleExportSettingsClick}
            disabled={importing}
            style={{
              padding: '10px 20px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: importing ? 'not-allowed' : 'pointer'
            }}
          >
            JSON exportieren
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsImportExport;
