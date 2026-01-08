import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

const AddItw: React.FC = () => {
  useEffect(() => {
    try { console.log('[AddItw] mounted. api keys:', Object.keys((window as any).api || {})); } catch {}
  }, []);
  const [name, setName] = useState('');
  const [vorname, setVorname] = useState('');
  const [attemptedSave, setAttemptedSave] = useState(false);

  const [saving, setSaving] = useState(false);
  const handleSave = async () => {
    try {
      // console.log('[AddItw] save clicked');
      setAttemptedSave(true);
      if (!name.trim() || !vorname.trim()) {
        alert('Bitte alle Pflichtfelder ausfüllen: Name und Vorname.');
        return;
      }
      setSaving(true);
      const api = (window as any).api;
      if (!api?.addItwDoctor) {
        alert('Aktion nicht verfügbar (Preload-Bridge fehlt).');
        return;
      }
      await api.addItwDoctor({ name, vorname });
      // console.log('[AddItw] saved successfully');
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
