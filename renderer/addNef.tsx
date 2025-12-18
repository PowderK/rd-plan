import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';

const AddNef: React.FC = () => {
  const [name, setName] = useState('');

  const handleSave = async () => {
    const n = name.trim();
    if (!n) return;
    try {
      await (window as any).api.addNefVehicle({ name: n });
      if (window.opener) window.opener.postMessage('settings-updated', '*');
      window.close();
    } catch (e) {
      console.error('Failed to add NEF:', e);
      alert('Fehler beim Anlegen des NEF: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <h2>NEF hinzufügen</h2>
      <div style={{ marginBottom: 12 }}>
        <label>Bezeichnung: <input value={name} onChange={e => setName(e.target.value)} autoFocus /></label>
      </div>
      <button onClick={handleSave}>Speichern</button>
      <button onClick={() => window.close()} style={{ marginLeft: 8 }}>Abbrechen</button>
    </div>
  );
};

const container = document.getElementById('add-nef-root');
if (container) {
  const root = createRoot(container);
  root.render(<AddNef />);
}
