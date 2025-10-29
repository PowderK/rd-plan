import React, { useCallback, useEffect, useState } from 'react';

interface Azubi {
  id: number;
  name: string;
  vorname: string;
  lehrjahr: number;
}

const AzubiOverview: React.FC = () => {
  const [azubis, setAzubis] = useState<Azubi[]>([]);

  const loadAzubis = useCallback(async () => {
    const list = await (window as any).api.getAzubiList();
    setAzubis(list);
  }, []);

  useEffect(() => {
    loadAzubis();
    // subscribe to main broadcasts
    const ipcHandler = (_event: any) => loadAzubis();
    (window as any).api.onAzubisUpdated?.(ipcHandler);
    // Nach Rückkehr ins Fenster immer neu laden
    const focusHandler = () => loadAzubis();
    window.addEventListener('focus', focusHandler);
    return () => {
      (window as any).api.offAzubisUpdated?.(ipcHandler);
      window.removeEventListener('focus', focusHandler);
    };
  }, [loadAzubis]);

  const handleAdd = async () => {
    (window as any).api.openAddAzubiWindow();
  };

  const handleEdit = async (azubi: Azubi) => {
    (window as any).api.openEditAzubiWindow(azubi.id);
  };

  const handleDelete = async (id: number) => {
    (window as any).api.openEditAzubiWindow(id);
  };

  return (
    <div style={{ padding: 24 }}>
      <h2>Azubis</h2>
      <button onClick={handleAdd} style={{ marginBottom: 16 }}>Azubi hinzufügen</button>
      <table style={{ borderCollapse: 'collapse', minWidth: 400 }}>
        <thead>
          <tr>
            <th style={{ border: '1px solid #ccc' }}>Nachname</th>
            <th style={{ border: '1px solid #ccc' }}>Vorname</th>
            <th style={{ border: '1px solid #ccc' }}>Lehrjahr</th>
            <th style={{ border: '1px solid #ccc' }}>Aktionen</th>
          </tr>
        </thead>
        <tbody>
          {azubis.map(a => (
            <tr key={a.id}>
              <td style={{ border: '1px solid #ccc' }}>{a.name}</td>
              <td style={{ border: '1px solid #ccc' }}>{a.vorname}</td>
              <td style={{ border: '1px solid #ccc' }}>{a.lehrjahr}</td>
              <td style={{ border: '1px solid #ccc' }}>
                <button onClick={() => handleEdit(a)} style={{ marginRight: 8 }}>Bearbeiten</button>
                <button onClick={() => handleDelete(a.id)}>Löschen</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default AzubiOverview;
