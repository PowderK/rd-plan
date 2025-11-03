import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

const AddAzubi: React.FC = () => {
  useEffect(() => {
    try { console.log('[AddAzubi] mounted. api keys:', Object.keys((window as any).api || {})); } catch {}
  }, []);
  const [name, setName] = useState('');
  const [vorname, setVorname] = useState('');
  const [lehrjahr, setLehrjahr] = useState(1);
  const [attemptedSave, setAttemptedSave] = useState(false);

  const [saving, setSaving] = useState(false);
  const handleSave = async () => {
    try {
      console.log('[AddAzubi] save clicked');
      setAttemptedSave(true);
      if (!name.trim() || !vorname.trim() || ![1,2,3].includes(lehrjahr)) {
        alert('Bitte alle Pflichtfelder ausfüllen: Name, Vorname und Lehrjahr (1-3).');
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
        <label>Name*:&nbsp;
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            style={{ borderColor: attemptedSave && !name.trim() ? '#b00020' : undefined }}
          />
        </label>
        {attemptedSave && !name.trim() && (
          <div style={{ color: '#b00020', fontSize: 12 }}>Pflichtfeld: Bitte Name eingeben.</div>
        )}
      </div>
      <div style={{ marginBottom: 12 }}>
        <label>Vorname*:&nbsp;
          <input
            value={vorname}
            onChange={e => setVorname(e.target.value)}
            style={{ borderColor: attemptedSave && !vorname.trim() ? '#b00020' : undefined }}
          />
        </label>
        {attemptedSave && !vorname.trim() && (
          <div style={{ color: '#b00020', fontSize: 12 }}>Pflichtfeld: Bitte Vorname eingeben.</div>
        )}
      </div>
      <div style={{ marginBottom: 12 }}>
        <label>Lehrjahr*:&nbsp;
          <select
            value={lehrjahr}
            onChange={e => setLehrjahr(Number(e.target.value))}
            style={{ borderColor: attemptedSave && ![1,2,3].includes(lehrjahr) ? '#b00020' : undefined }}
          >
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
          </select>
        </label>
        {attemptedSave && ![1,2,3].includes(lehrjahr) && (
          <div style={{ color: '#b00020', fontSize: 12 }}>Pflichtfeld: Lehrjahr muss 1–3 sein.</div>
        )}
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
