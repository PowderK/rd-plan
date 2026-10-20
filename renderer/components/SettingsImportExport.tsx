import React, { useState, useEffect } from 'react';

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
  departmentName?: string;
}

const SettingsImportExport: React.FC<SettingsImportExportProps> = ({ onImportComplete, onClose, departmentName }) => {
  const [importing, setImporting] = useState(false);
  const [settingsResult, setSettingsResult] = useState<SettingsImportResult | null>(null);
  const [personnelResult, setPersonnelResult] = useState<PersonnelImportResult | null>(null);
  const [replaceExistingSettings, setReplaceExistingSettings] = useState(false);
  const [replaceExistingPersonnel, setReplaceExistingPersonnel] = useState(false);
  // Backup import UI state
  const [backupList, setBackupList] = useState<any[]>([]);
  const [selectedBackup, setSelectedBackup] = useState<string | null>(null);
  const [backupPreview, setBackupPreview] = useState<any | null>(null);
  const [optPersonnel, setOptPersonnel] = useState(true);
  const [optAzubis, setOptAzubis] = useState(true);
  const [optAssignments, setOptAssignments] = useState(true);
  const [optIndividualSettings, setOptIndividualSettings] = useState(true);
  const [optQualifications, setOptQualifications] = useState(true);
  const [optDutyRoster, setOptDutyRoster] = useState(true);
  const [replaceExistingBackup, setReplaceExistingBackup] = useState(false);
  const [backupImportResult, setBackupImportResult] = useState<any | null>(null);

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

      const importResult = await (window as any).electronAPI.invoke('import-personnel-excel', filePath, replaceExistingPersonnel, departmentName);

      setPersonnelResult(importResult);
      setImporting(false);

      if (importResult && importResult.success !== false) {
        try { (window as any).api?.notifyAllUpdated?.(); } catch {}
        window.dispatchEvent(new CustomEvent('personnel-updated'));
        window.dispatchEvent(new CustomEvent('duty-roster-updated'));
        window.dispatchEvent(new CustomEvent('settings-updated'));
      }

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

      if (importResult && importResult.success !== false) {
        try { (window as any).api?.notifyAllUpdated?.(); } catch {}
        window.dispatchEvent(new CustomEvent('settings-updated'));
        window.dispatchEvent(new CustomEvent('personnel-updated'));
        window.dispatchEvent(new CustomEvent('vehicles-updated'));
        window.dispatchEvent(new CustomEvent('duty-roster-updated'));
      }

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

        {/* Import von vorheriger DB (Backup) */}
        <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px dashed #eee' }}>
          <h4>Import aus älterer Datenbank (Backup)</h4>
          <p style={{ color: '#555', marginTop: 6 }}>Wähle ein Backup und importiere selektiv Personal, Einteilungen, individuelle Einstellungen oder den Dienstplan.</p>

          <div style={{ marginBottom: 10 }}>
            <button
              onClick={async () => {
                try {
                  const dialogResult = await (window as any).electronAPI.invoke('show-open-dialog', {
                    title: 'Alte rd-plan Datenbank auswählen (rd-plan.db)',
                    properties: ['openFile'],
                    filters: [
                      { name: 'SQLite Datenbank', extensions: ['db', 'sqlite', 'sqlite3'] },
                      { name: 'Alle Dateien', extensions: ['*'] }
                    ]
                  });
                  if (dialogResult.canceled || !dialogResult.filePaths?.length) return;
                  const filePath = dialogResult.filePaths[0];
                  setSelectedBackup(filePath);
                  // Preview: existing getBackupSummary expects a directory containing rd-plan.db
                  const parts = filePath.replace(/\\/g, '/').split('/');
                  const dir = parts.slice(0, -1).join('/');
                  try {
                    const counts = await (window as any).api.getBackupSummary?.(dir);
                    setBackupPreview(counts?.counts || counts || null);
                    // clear backupList since user picks file directly
                    setBackupList([]);
                  } catch (err) {
                    setBackupPreview(null);
                  }
                } catch (err) {
                  alert('Fehler beim Auswählen der Datei: ' + (err instanceof Error ? err.message : String(err)));
                }
              }}
              style={{ padding: '8px 14px', marginRight: 8 }}
            >
              Alte DB auswählen...
            </button>

            <label style={{ marginLeft: 12 }}>
              <input type="checkbox" checked={replaceExistingBackup} onChange={e => setReplaceExistingBackup(e.target.checked)} />
              <span style={{ marginLeft: 8 }}>Bestehende Daten ersetzen (falls möglich)</span>
            </label>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <div style={{ minWidth: 260 }}>
              <label><strong>Verfügbare Backups</strong></label>
              <div style={{ maxHeight: 200, overflow: 'auto', border: '1px solid #ccc', padding: 8, borderRadius: 4, marginTop: 6 }}>
                {backupList.length === 0 && <div style={{ color: '#666' }}>Keine Backups geladen. Klicke auf „Backups laden“.</div>}
                {backupList.map((b: any, idx: number) => (
                  <div key={idx} style={{ padding: '6px', cursor: 'pointer', backgroundColor: selectedBackup === b.dir ? '#eef' : 'transparent' }} onClick={async () => {
                    setSelectedBackup(b.dir);
                    try {
                      const counts = await (window as any).api.getBackupSummary?.(b.dir);
                      setBackupPreview(counts?.counts || counts || null);
                    } catch (err) {
                      setBackupPreview(null);
                    }
                  }}>
                    <div style={{ fontSize: 13 }}>{b.dir}</div>
                    <div style={{ fontSize: 12, color: '#666' }}>{b.label || ''}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ flex: 1 }}>
              <label><strong>Vorschau / Optionen</strong></label>
              <div style={{ marginTop: 6, padding: 10, border: '1px solid #ccc', borderRadius: 4 }}>
                {backupPreview ? (
                  <div>
                    <div>Personal: {backupPreview.personnel}</div>
                    <div>Azubis: {backupPreview.azubis}</div>
                    <div>Dienstplan-Einträge: {backupPreview.dutyRoster}</div>
                    <div>Qualifikationen: {backupPreview.qualifications ?? 0}</div>
                  </div>
                ) : (
                  <div style={{ color: '#666' }}>Wähle ein Backup aus, um eine Vorschau zu sehen.</div>
                )}

                <div style={{ marginTop: 10 }}>
                  <label style={{ display: 'block' }}><input type="checkbox" checked={optPersonnel} onChange={e => setOptPersonnel(e.target.checked)} /> <span style={{ marginLeft: 8 }}>Personal importieren</span></label>
                  <label style={{ display: 'block' }}><input type="checkbox" checked={optAzubis} onChange={e => setOptAzubis(e.target.checked)} /> <span style={{ marginLeft: 8 }}>Azubis importieren (mit Abteilungszuordnung)</span></label>
                  <label style={{ display: 'block' }}><input type="checkbox" checked={optAssignments} onChange={e => setOptAssignments(e.target.checked)} /> <span style={{ marginLeft: 8 }}>Einteilungen / Abteilungsperioden importieren</span></label>
                  <label style={{ display: 'block' }}><input type="checkbox" checked={optQualifications} onChange={e => setOptQualifications(e.target.checked)} /> <span style={{ marginLeft: 8 }}>Qualifikationen importieren</span></label>
                  <label style={{ display: 'block' }}><input type="checkbox" checked={optIndividualSettings} onChange={e => setOptIndividualSettings(e.target.checked)} /> <span style={{ marginLeft: 8 }}>Individuelle Einstellungen importieren</span></label>
                  <label style={{ display: 'block' }}><input type="checkbox" checked={optDutyRoster} onChange={e => setOptDutyRoster(e.target.checked)} /> <span style={{ marginLeft: 8 }}>Dienstplan importieren</span></label>
                </div>

                <div style={{ marginTop: 12 }}>
                  <button
                    onClick={async () => {
                      if (!selectedBackup) { alert('Bitte ein Backup auswählen'); return; }
                      // If user asked to replace existing, confirm
                      if (replaceExistingBackup) {
                        const confirm = await (window as any).electronAPI.invoke('show-message-box', {
                          type: 'warning',
                          buttons: ['Abbrechen', 'Fortfahren'],
                          defaultId: 1,
                          cancelId: 0,
                          title: 'Bestehende Daten ersetzen?',
                          message: 'Du hast ausgewählt, bestehende Daten zu ersetzen. Dies kann Daten unwiderruflich überschreiben. Fortfahren?'
                        });
                        if (!confirm || confirm.response !== 1) return;
                      }

                      try {
                        const res = await (window as any).api.importBackup?.(selectedBackup, { personnel: optPersonnel, azubis: optAzubis, assignments: optAssignments, qualifications: optQualifications, individualSettings: optIndividualSettings, dutyRoster: optDutyRoster, replaceExisting: replaceExistingBackup });
                        const resultObj = res?.result || res;
                        setBackupImportResult(resultObj);
                        setImporting(false);
                        try { (window as any).api?.notifyAllUpdated?.(); } catch {}
                        window.dispatchEvent(new CustomEvent('personnel-updated'));
                        window.dispatchEvent(new CustomEvent('vehicles-updated'));
                        window.dispatchEvent(new CustomEvent('duty-roster-updated'));
                        window.dispatchEvent(new CustomEvent('settings-updated'));
                        window.dispatchEvent(new CustomEvent('azubis-updated'));
                      } catch (err) {
                        setBackupImportResult({ success: false, imported: {}, errors: [err instanceof Error ? err.message : String(err)] });
                        setImporting(false);
                      }
                    }}
                    disabled={importing || !selectedBackup}
                    style={{ padding: '10px 16px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: 4, cursor: importing ? 'not-allowed' : 'pointer' }}
                  >
                    {importing ? 'Import läuft…' : 'Import starten'}
                  </button>
                </div>

                {backupImportResult && (
                  <div style={{ marginTop: 12, padding: 8, borderRadius: 4, backgroundColor: backupImportResult.success ? '#d4edda' : '#f8d7da', color: backupImportResult.success ? '#155724' : '#721c24' }}>
                    <div><strong>Import Ergebnis</strong></div>
                    <div style={{ marginTop: 6 }}>
                      <div>Personal importiert: {backupImportResult.imported?.personnel ?? backupImportResult.imported?.personnelCount ?? 0}</div>
                      <div>Azubis importiert: {backupImportResult.imported?.azubis ?? 0}</div>
                      <div>Azubi-Zeiträume importiert: {backupImportResult.imported?.azubiPeriods ?? 0}</div>
                      <div>Einteilungen importiert: {backupImportResult.imported?.assignments ?? 0}</div>
                      <div>Qualifikationen importiert: {backupImportResult.imported?.qualifications ?? 0}</div>
                      <div>Individuelle Einstellungen importiert: {backupImportResult.imported?.settings ?? 0}</div>
                      <div>Dienstplan-Einträge importiert: {backupImportResult.imported?.dutyRoster ?? 0}</div>
                    </div>
                    {backupImportResult.errors && backupImportResult.errors.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <strong>Fehler:</strong>
                        <ul style={{ marginTop: 6 }}>
                          {backupImportResult.errors.map((err: any, i: number) => <li key={i}>{String(err)}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsImportExport;
