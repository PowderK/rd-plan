import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';

const AddItw: React.FC = () => {
  const [name, setName] = useState('');
  const [vorname, setVorname] = useState('');

  const handleSave = async () => {
    if (!name.trim() || !vorname.trim()) return;
    await (window as any).api.addItwDoctor({ name, vorname });
    if (window.opener) window.opener.postMessage('itw-updated', '*');
    window.close();
  };

  return (
    <div style={{ padding: 24 }}>
      <h2>ITW Arzt hinzufügen</h2>
      <div style={{ marginBottom: 12 }}>
        <label>Name: <input value={name} onChange={e => setName(e.target.value)} /></label>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label>Vorname: <input value={vorname} onChange={e => setVorname(e.target.value)} /></label>
      </div>
      <button onClick={handleSave}>Speichern</button>
      <button onClick={() => window.close()} style={{ marginLeft: 8 }}>Abbrechen</button>
    </div>
  );
};

const container = document.getElementById('add-itw-root');
if (container) {
  const root = createRoot(container);
  root.render(<AddItw />);
}
