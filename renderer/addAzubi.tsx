import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';

const AddAzubi: React.FC = () => {
  const [name, setName] = useState('');
  const [vorname, setVorname] = useState('');
  const [lehrjahr, setLehrjahr] = useState(1);

  const handleSave = async () => {
    if (!name.trim() || !vorname.trim() || ![1,2,3].includes(lehrjahr)) return;
    await (window as any).api.addAzubi({ name, vorname, lehrjahr });
    if (window.opener) window.opener.postMessage('azubis-updated', '*');
    window.close();
  };

  return (
    <div style={{ padding: 24 }}>
      <h2>Azubi hinzufügen</h2>
      <div style={{ marginBottom: 12 }}>
        <label>Name: <input value={name} onChange={e => setName(e.target.value)} /></label>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label>Vorname: <input value={vorname} onChange={e => setVorname(e.target.value)} /></label>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label>Lehrjahr: 
          <select value={lehrjahr} onChange={e => setLehrjahr(Number(e.target.value))}>
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
          </select>
        </label>
      </div>
      <button onClick={handleSave}>Speichern</button>
      <button onClick={() => window.close()} style={{ marginLeft: 8 }}>Abbrechen</button>
    </div>
  );
};

const container = document.getElementById('add-azubi-root');
if (container) {
  const root = createRoot(container);
  root.render(<AddAzubi />);
}
