import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';

const params = new URLSearchParams(window.location.search);
const azubiId = params.get('id');

const EditAzubi: React.FC = () => {
  const [name, setName] = useState('');
  const [vorname, setVorname] = useState('');
  const [lehrjahr, setLehrjahr] = useState(1);

  useEffect(() => {
    if (!azubiId) return;
    (window as any).api.getAzubiList().then((list: any[]) => {
      const azubi = list.find(a => String(a.id) === azubiId);
      if (azubi) {
        setName(azubi.name);
        setVorname(azubi.vorname);
        setLehrjahr(azubi.lehrjahr);
      }
    });
  }, []);

  const handleSave = async () => {
    if (!azubiId) return;
    await (window as any).api.updateAzubi({ id: Number(azubiId), name, vorname, lehrjahr });
    if (window.opener) window.opener.postMessage('azubis-updated', '*');
    window.close();
  };

  const handleDelete = async () => {
    if (!azubiId) return;
    if (!window.confirm('Azubi wirklich löschen?')) return;
    await (window as any).api.deleteAzubi(Number(azubiId));
    if (window.opener) window.opener.postMessage('azubis-updated', '*');
    window.close();
  };

  return (
    <div style={{ padding: 24 }}>
      <h2>Azubi bearbeiten</h2>
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
      <button onClick={handleDelete} style={{ marginLeft: 8, color: 'red' }}>Löschen</button>
      <button onClick={() => window.close()} style={{ marginLeft: 8 }}>Abbrechen</button>
    </div>
  );
};

const container = document.getElementById('edit-azubi-root');
if (container) {
  const root = createRoot(container);
  root.render(<EditAzubi />);
}
