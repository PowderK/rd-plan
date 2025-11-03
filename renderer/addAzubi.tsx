import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

const AddAzubi: React.FC = () => {
  useEffect(() => {
    try { console.log('[AddAzubi] mounted. api keys:', Object.keys((window as any).api || {})); } catch {}
  }, []);
  const [name, setName] = useState('');
  const [vorname, setVorname] = useState('');
  const [lehrjahr, setLehrjahr] = useState(1);

  const [saving, setSaving] = useState(false);
  const handleSave = async () => {
    try {
      console.log('[AddAzubi] save clicked');
      if (!name.trim() || !vorname.trim() || ![1,2,3].includes(lehrjahr)) {
        alert('Bitte Name, Vorname und gültiges Lehrjahr (1-3) angeben.');
        return;
      }
      setSaving(true);
      const api = (window as any).api;
      if (!api?.addAzubi) {
        alert('Aktion nicht verfügbar (Preload-Bridge fehlt).');
        return;
      }
      await api.addAzubi({ name, vorname, lehrjahr });
      console.log('[AddAzubi] saved successfully');
      try { if (window.opener) window.opener.postMessage('azubis-updated', '*'); } catch {}
      window.close();
    } catch (e: any) {
      alert('Speichern fehlgeschlagen: ' + (e?.message || String(e)));
    } finally {
      setSaving(false);
    }
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
  <button onClick={handleSave} disabled={saving}>Speichern</button>
      <button onClick={() => window.close()} style={{ marginLeft: 8 }}>Abbrechen</button>
    </div>
  );
};

const container = document.getElementById('add-azubi-root');
if (container) {
  const root = createRoot(container);
  root.render(<AddAzubi />);
}
