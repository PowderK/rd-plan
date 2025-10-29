import React, { useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

interface Itw {
  id: number;
  name: string;
  vorname: string;
}

const ItwOverview: React.FC = () => {
  const [docs, setDocs] = useState<Itw[]>([]);

  const load = useCallback(async () => {
    const list = await (window as any).api.getItwDoctors();
    setDocs(list);
  }, []);

  useEffect(() => {
    load();
    const ipcHandler = (_: any) => load();
    (window as any).api.onItwUpdated?.(ipcHandler);
    const focusHandler = () => load();
    window.addEventListener('focus', focusHandler);
    return () => {
      (window as any).api.offItwUpdated?.(ipcHandler);
      window.removeEventListener('focus', focusHandler);
    };
  }, [load]);

  return (
    <div style={{ padding: 24 }}>
      <h2>ITW Ärzte</h2>
      <button onClick={() => (window as any).api.openAddItwWindow()} style={{ marginBottom: 12 }}>ITW Arzt hinzufügen</button>
      <table style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Vorname</th>
            <th>Aktionen</th>
          </tr>
        </thead>
        <tbody>
          {docs.map(d => (
            <tr key={d.id}>
              <td>{d.name}</td>
              <td>{d.vorname}</td>
              <td>
                <button onClick={() => (window as any).api.openEditItwWindow(d.id)} style={{ marginRight: 8 }}>Ändern</button>
                <button onClick={() => (window as any).api.openConfirmDeleteWindow(d.id, 'itw')}>Löschen</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const container = document.getElementById('itw-root');
if (container) {
  const root = createRoot(container);
  root.render(<ItwOverview />);
}
