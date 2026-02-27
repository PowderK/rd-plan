import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const AddItwVehicle: React.FC = () => {
  const [name, setName] = useState('');

  const handleSave = async () => {
    const n = name.trim();
    if (!n) return;
    try {
      await (window as any).api.addItwVehicle({ name: n });
      if (window.opener) window.opener.postMessage('settings-updated', '*');
      window.close();
    } catch (e) {
      // console.error('Failed to add ITW Vehicle:', e);
      alert('Fehler beim Anlegen des ITW: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  return (
    <div style={{ padding: 24, height: '100vh', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
      <h2 style={{ marginTop: 0 }}>ITW hinzufügen</h2>
      <div style={{ flex: 1, minHeight: 0 }}>
        <div style={{ maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label>Bezeichnung</label>
          <input value={name} onChange={e => setName(e.target.value)} autoFocus />
        </div>
      </div>
      <div
        style={{
          borderTop: '1px solid #eee',
          paddingTop: 12,
          paddingBottom: 12,
          background: 'var(--bg)',
          display: 'flex',
          gap: 8,
          justifyContent: 'flex-end',
          flexShrink: 0
        }}
      >
        <button onClick={handleSave} style={{ backgroundColor: '#007bff', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Speichern</button>
        <button onClick={() => window.close()} style={{ padding: '8px 16px', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer' }}>Abbrechen</button>
      </div>
    </div>
  );
};

const container = document.getElementById('add-itw-vehicle-root');
if (container) {
  const root = createRoot(container);
  root.render(<AddItwVehicle />);
}
