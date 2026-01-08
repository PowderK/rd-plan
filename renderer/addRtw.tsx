import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';

const AddRtw: React.FC = () => {
  const [name, setName] = useState('');

  const handleSave = async () => {
    const n = name.trim();
    if (!n) return;
    try {
      await (window as any).api.addRtwVehicle({ name: n });
      if (window.opener) window.opener.postMessage('settings-updated', '*');
      window.close();
    } catch (e) {
      // console.error('Failed to add RTW:', e);
      alert('Fehler beim Anlegen des RTW: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <h2>RTW hinzufügen</h2>
      <div style={{ marginBottom: 12 }}>
        <label>Bezeichnung: <input value={name} onChange={e => setName(e.target.value)} autoFocus /></label>
      </div>
      <button onClick={handleSave}>Speichern</button>
      <button onClick={() => window.close()} style={{ marginLeft: 8 }}>Abbrechen</button>
    </div>
  );
};

const container = document.getElementById('add-rtw-root');
if (container) {
  const root = createRoot(container);
  root.render(<AddRtw />);
}
