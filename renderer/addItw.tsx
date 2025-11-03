import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

const AddItw: React.FC = () => {
  useEffect(() => {
    try { console.log('[AddItw] mounted. api keys:', Object.keys((window as any).api || {})); } catch {}
  }, []);
  const [name, setName] = useState('');
  const [vorname, setVorname] = useState('');

  const [saving, setSaving] = useState(false);
  const handleSave = async () => {
    try {
      console.log('[AddItw] save clicked');
      if (!name.trim() || !vorname.trim()) {
        alert('Bitte Name und Vorname angeben.');
        return;
      }
      setSaving(true);
      const api = (window as any).api;
      if (!api?.addItwDoctor) {
        alert('Aktion nicht verfügbar (Preload-Bridge fehlt).');
        return;
      }
      await api.addItwDoctor({ name, vorname });
      console.log('[AddItw] saved successfully');
      try { if (window.opener) window.opener.postMessage('itw-updated', '*'); } catch {}
      window.close();
    } catch (e: any) {
      alert('Speichern fehlgeschlagen: ' + (e?.message || String(e)));
    } finally {
      setSaving(false);
    }
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
  <button onClick={handleSave} disabled={saving}>Speichern</button>
      <button onClick={() => window.close()} style={{ marginLeft: 8 }}>Abbrechen</button>
    </div>
  );
};

const container = document.getElementById('add-itw-root');
if (container) {
  const root = createRoot(container);
  root.render(<AddItw />);
}
