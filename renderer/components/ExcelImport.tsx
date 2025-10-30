import React, { useState } from 'react';

interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: string[];
}

interface ExcelImportProps {
  onImportComplete?: (result: ImportResult) => void;
  onClose?: () => void;
}

const ExcelImport: React.FC<ExcelImportProps> = ({ onImportComplete, onClose }) => {
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [replaceExisting, setReplaceExisting] = useState(false);

  const handleImportClick = async () => {
    try {
      // Öffne Datei-Dialog für Excel-Dateien
      const dialogResult = await (window as any).electronAPI.invoke('show-open-dialog', {
        title: 'Excel-Datei für Personal-Import auswählen',
        filters: [
          { name: 'Excel-Dateien', extensions: ['xlsx', 'xls', 'csv'] },
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
      const importResult = await (window as any).electronAPI.invoke('import-personnel-excel', filePath, replaceExisting);
      
      setResult(importResult);
      setImporting(false);

      if (onImportComplete) {
        onImportComplete(importResult);
      }

    } catch (error) {
      console.error('Import-Fehler:', error);
      setResult({
        success: false,
        imported: 0,
        skipped: 0,
        errors: [`Import fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`]
      });
      setImporting(false);
    }
  };

  const handleExportClick = async () => {
    try {
      // Öffne Speichern-Dialog
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

      alert('Export erfolgreich abgeschlossen!');

    } catch (error) {
      console.error('Export-Fehler:', error);
      setImporting(false);
      alert(`Export fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleCreateTemplate = async () => {
    try {
      // Öffne Speichern-Dialog für Template
      const dialogResult = await (window as any).electronAPI.invoke('show-save-dialog', {
        title: 'Excel-Vorlage erstellen',
        defaultPath: 'Personal-Import-Vorlage.xlsx',
        filters: [
          { name: 'Excel-Dateien', extensions: ['xlsx'] },
          { name: 'Alle Dateien', extensions: ['*'] }
        ]
      });

      if (dialogResult.canceled || !dialogResult.filePath) {
        return;
      }

      setImporting(true);
      await (window as any).electronAPI.invoke('create-personnel-template', dialogResult.filePath);
      setImporting(false);

      alert('Vorlage erfolgreich erstellt!');

    } catch (error) {
      console.error('Template-Fehler:', error);
      setImporting(false);
      alert(`Vorlage-Erstellung fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  return (
    <div className="excel-import-container" style={{ padding: '20px', maxWidth: '600px' }}>
      <h2>Personal-Daten Excel Import/Export</h2>
      
      <div className="import-section" style={{ marginBottom: '30px' }}>
        <h3>Import aus Excel</h3>
        <p>Importiere Personal-Daten aus einer Excel-Datei.</p>
        
        <div style={{ marginBottom: '10px' }}>
          <label>
            <input
              type="checkbox"
              checked={replaceExisting}
              onChange={(e) => setReplaceExisting(e.target.checked)}
              disabled={importing}
            />
            <span style={{ marginLeft: '8px' }}>
              Bestehende Personal-Daten ersetzen (Vorsicht: Alle aktuellen Daten werden gelöscht!)
            </span>
          </label>
        </div>

        <div style={{ marginBottom: '10px' }}>
          <button
            onClick={handleImportClick}
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
            {importing ? 'Importiere...' : 'Excel-Datei importieren'}
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
            <p>Importiert: {result.imported}</p>
            <p>Übersprungen: {result.skipped}</p>
            {result.errors.length > 0 && (
              <div>
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
        <h3>Export nach Excel</h3>
        <p>Exportiere aktuelle Personal-Daten als Excel-Datei.</p>
        
        <button
          onClick={handleExportClick}
          disabled={importing}
          style={{
            padding: '10px 20px',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: importing ? 'not-allowed' : 'pointer',
            marginRight: '10px'
          }}
        >
          {importing ? 'Exportiere...' : 'Als Excel exportieren'}
        </button>
      </div>

      <div className="template-section" style={{ marginBottom: '30px' }}>
        <h3>Excel-Vorlage</h3>
        <p>Erstelle eine Excel-Vorlage für den Import mit der richtigen Spaltenstruktur.</p>
        
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

      <div className="help-section" style={{ backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '4px' }}>
        <h4>Excel-Format:</h4>
        <p>Die Excel-Datei sollte folgende Spalten enthalten:</p>
        <ul>
          <li><strong>Spalte A:</strong> Name (Nachname)</li>
          <li><strong>Spalte B:</strong> Vorname</li>
          <li><strong>Spalte C:</strong> Teilzeit (ja/nein, 1/0, true/false)</li>
          <li><strong>Spalte D:</strong> Fahrzeugführer (ja/nein, 1/0, true/false)</li>
          <li><strong>Spalte E:</strong> Fahrzeugführer HLFB (ja/nein, 1/0, true/false)</li>
          <li><strong>Spalte F:</strong> NEF (ja/nein, 1/0, true/false)</li>
          <li><strong>Spalte G:</strong> ITW Maschinist (ja/nein, 1/0, true/false)</li>
          <li><strong>Spalte H:</strong> ITW Fahrzeugführer (ja/nein, 1/0, true/false)</li>
        </ul>
        <p><em>Die erste Zeile wird als Header übersprungen.</em></p>
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

export default ExcelImport;