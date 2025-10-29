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
  };
  skipped: number;
  errors: string[];
}

interface SettingsImportExportProps {
  onImportComplete?: (result: SettingsImportResult) => void;
  onClose?: () => void;
}

const SettingsImportExport: React.FC<SettingsImportExportProps> = ({ onImportComplete, onClose }) => {
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<SettingsImportResult | null>(null);
  const [replaceExisting, setReplaceExisting] = useState(false);

  const handleImportJsonClick = async () => {
    try {
      // Öffne Datei-Dialog für JSON-Dateien
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
      setResult(null);

      // Führe den Import durch
      const importResult = await (window as any).electronAPI.invoke('import-settings-json', filePath, replaceExisting);
      
      setResult(importResult);
      setImporting(false);

      if (onImportComplete) {
        onImportComplete(importResult);
      }

    } catch (error) {
      console.error('Settings Import-Fehler:', error);
      setResult({
        success: false,
        imported: {
          settings: 0,
          shiftTypes: 0,
          holidays: 0,
          itwPatterns: 0,
          deptPatterns: 0,
          rtwVehicles: 0,
          nefVehicles: 0
        },
        skipped: 0,
        errors: [`Import fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`]
      });
      setImporting(false);
    }
  };

  const handleExportJsonClick = async () => {
    try {
      // Öffne Speichern-Dialog für JSON
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

      alert('JSON-Export erfolgreich abgeschlossen!');

    } catch (error) {
      console.error('Settings Export-Fehler:', error);
      setImporting(false);
      alert(`JSON-Export fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleExportExcelClick = async () => {
    try {
      // Öffne Speichern-Dialog für Excel
      const dialogResult = await (window as any).electronAPI.invoke('show-save-dialog', {
        title: 'Einstellungen als Excel exportieren',
        defaultPath: `RD-Plan-Einstellungen-${new Date().toISOString().slice(0, 10)}.xlsx`,
        filters: [
          { name: 'Excel-Dateien', extensions: ['xlsx'] },
          { name: 'Alle Dateien', extensions: ['*'] }
        ]
      });

      if (dialogResult.canceled || !dialogResult.filePath) {
        return;
      }

      setImporting(true);
      await (window as any).electronAPI.invoke('export-settings-excel', dialogResult.filePath);
      setImporting(false);

      alert('Excel-Export erfolgreich abgeschlossen!');

    } catch (error) {
      console.error('Settings Export-Fehler:', error);
      setImporting(false);
      alert(`Excel-Export fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleCreateTemplate = async () => {
    try {
      // Öffne Speichern-Dialog für Template
      const dialogResult = await (window as any).electronAPI.invoke('show-save-dialog', {
        title: 'Einstellungs-Vorlage erstellen',
        defaultPath: 'RD-Plan-Einstellungen-Vorlage.json',
        filters: [
          { name: 'JSON-Dateien', extensions: ['json'] },
          { name: 'Excel-Dateien', extensions: ['xlsx'] },
          { name: 'Alle Dateien', extensions: ['*'] }
        ]
      });

      if (dialogResult.canceled || !dialogResult.filePath) {
        return;
      }

      setImporting(true);
      await (window as any).electronAPI.invoke('create-settings-template', dialogResult.filePath);
      setImporting(false);

      alert('Vorlage erfolgreich erstellt!');

    } catch (error) {
      console.error('Template-Fehler:', error);
      setImporting(false);
      alert(`Vorlage-Erstellung fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const getTotalImported = (result: SettingsImportResult) => {
    return result.imported.settings + 
           result.imported.shiftTypes + 
           result.imported.holidays + 
           result.imported.itwPatterns + 
           result.imported.deptPatterns + 
           result.imported.rtwVehicles + 
           result.imported.nefVehicles;
  };

  return (
    <div className="settings-import-export-container" style={{ padding: '20px', maxWidth: '700px' }}>
      <h2>Einstellungen Import/Export</h2>
      
      <div className="import-section" style={{ marginBottom: '30px' }}>
        <h3>Import aus JSON</h3>
        <p>Importiere alle Einstellungen (Schichtarten, Fahrzeuge, Feiertage, etc.) aus einer JSON-Datei.</p>
        
        <div style={{ marginBottom: '10px' }}>
          <label>
            <input
              type="checkbox"
              checked={replaceExisting}
              onChange={(e) => setReplaceExisting(e.target.checked)}
              disabled={importing}
            />
            <span style={{ marginLeft: '8px' }}>
              Bestehende Einstellungen ersetzen (Vorsicht: Alle aktuellen Einstellungen werden überschrieben!)
            </span>
          </label>
        </div>

        <div style={{ marginBottom: '10px' }}>
          <button
            onClick={handleImportJsonClick}
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
            {importing ? 'Importiere...' : 'JSON-Datei importieren'}
          </button>
        </div>

        {result && (
          <div
            className="import-result"
            style={{
              padding: '10px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              backgroundColor: result.success ? '#d4edda' : '#f8d7da',
              color: result.success ? '#155724' : '#721c24'
            }}
          >
            <h4>Import-Ergebnis:</h4>
            <p>Status: {result.success ? 'Erfolgreich' : 'Fehlerhaft'}</p>
            <p>Gesamt importiert: {getTotalImported(result)}</p>
            <p>Übersprungen: {result.skipped}</p>
            
            <details style={{ marginTop: '10px' }}>
              <summary>Details anzeigen</summary>
              <ul style={{ marginTop: '5px' }}>
                <li>Einstellungen: {result.imported.settings}</li>
                <li>Schichtarten: {result.imported.shiftTypes}</li>
                <li>Feiertage: {result.imported.holidays}</li>
                <li>ITW-Schichtfolgen: {result.imported.itwPatterns}</li>
                <li>Abteilungs-Schichtfolgen: {result.imported.deptPatterns}</li>
                <li>RTW-Fahrzeuge: {result.imported.rtwVehicles}</li>
                <li>NEF-Fahrzeuge: {result.imported.nefVehicles}</li>
              </ul>
            </details>

            {result.errors.length > 0 && (
              <div style={{ marginTop: '10px' }}>
                <p>Fehler:</p>
                <ul>
                  {result.errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="export-section" style={{ marginBottom: '30px' }}>
        <h3>Export</h3>
        <p>Exportiere aktuelle Einstellungen für Backup oder Transfer zu anderen Installationen.</p>
        
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={handleExportJsonClick}
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
            {importing ? 'Exportiere...' : 'Als JSON exportieren'}
          </button>

          <button
            onClick={handleExportExcelClick}
            disabled={importing}
            style={{
              padding: '10px 20px',
              backgroundColor: '#17a2b8',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: importing ? 'not-allowed' : 'pointer'
            }}
          >
            {importing ? 'Exportiere...' : 'Als Excel exportieren'}
          </button>
        </div>
      </div>

      <div className="template-section" style={{ marginBottom: '30px' }}>
        <h3>Vorlage erstellen</h3>
        <p>Erstelle eine Vorlage mit Beispiel-Einstellungen für neue Installationen.</p>
        
        <button
          onClick={handleCreateTemplate}
          disabled={importing}
          style={{
            padding: '10px 20px',
            backgroundColor: '#ffc107',
            color: '#212529',
            border: 'none',
            borderRadius: '4px',
            cursor: importing ? 'not-allowed' : 'pointer'
          }}
        >
          {importing ? 'Erstelle...' : 'Vorlage erstellen'}
        </button>
      </div>

      <div className="info-section" style={{ backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '4px' }}>
        <h4>Exportierte Daten:</h4>
        <p>Die Export-Datei enthält folgende Einstellungen:</p>
        <ul>
          <li><strong>Allgemeine Einstellungen:</strong> Rettungswache, Jahr, Abteilung, etc.</li>
          <li><strong>Schichtarten:</strong> Kürzel, Beschreibungen, Farben</li>
          <li><strong>Feiertage:</strong> Alle gespeicherten Feiertage</li>
          <li><strong>ITW-Schichtfolgen:</strong> Schichtmuster für ITW-Dienste</li>
          <li><strong>Abteilungs-Schichtfolgen:</strong> Schichtmuster für Abteilungen</li>
          <li><strong>Fahrzeuge:</strong> RTW und NEF Konfigurationen</li>
        </ul>
        <p><em>Personal-Daten und Dienstpläne werden NICHT exportiert.</em></p>
      </div>

      {onClose && (
        <div style={{ marginTop: '20px', textAlign: 'right' }}>
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
        </div>
      )}
    </div>
  );
};

export default SettingsImportExport;