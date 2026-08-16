import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';

const AddItw: React.FC = () => {
  const [anrede, setAnrede] = useState('');
  const [title, setTitle] = useState('');
  const [name, setName] = useState('');
  const [vorname, setVorname] = useState('');
  const [attemptedSave, setAttemptedSave] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    try {
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
      await api.addItwDoctor({ name: name.trim(), vorname: vorname.trim(), anrede: anrede.trim(), title: title.trim() });
      try { if (window.opener) window.opener.postMessage('itw-updated', '*'); } catch {}
      window.close();
    } catch (e: any) {
      alert('Speichern fehlgeschlagen: ' + (e?.message || String(e)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: '24px', fontFamily: 'Arial, sans-serif', maxWidth: '500px', margin: '0 auto' }}>
      <h2 style={{ marginTop: 0, marginBottom: '24px', color: '#333' }}>ITW Arzt hinzufügen</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500 }}>
            Anrede
          </label>
          <select
            value={anrede}
            onChange={e => setAnrede(e.target.value)}
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '14px',
              boxSizing: 'border-box',
              backgroundColor: '#fff'
            }}
          >
            <option value="">-- Keine --</option>
            <option value="Herr">Herr</option>
            <option value="Frau">Frau</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500 }}>
            Titel
          </label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="z. B. Dr. oder Prof."
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '14px',
              boxSizing: 'border-box'
            }}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500 }}>
            Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Nachname"
            style={{
              width: '100%',
              padding: '10px',
              border: attemptedSave && !name.trim() ? '2px solid #b00020' : '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '14px',
              boxSizing: 'border-box'
            }}
          />
          {attemptedSave && !name.trim() && (
            <div style={{ color: '#b00020', fontSize: '12px', marginTop: '4px' }}>Bitte Name eingeben.</div>
          )}
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500 }}>
            Vorname *
          </label>
          <input
            type="text"
            value={vorname}
            onChange={e => setVorname(e.target.value)}
            placeholder="Vorname"
            style={{
              width: '100%',
              padding: '10px',
              border: attemptedSave && !vorname.trim() ? '2px solid #b00020' : '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '14px',
              boxSizing: 'border-box'
            }}
          />
          {attemptedSave && !vorname.trim() && (
            <div style={{ color: '#b00020', fontSize: '12px', marginTop: '4px' }}>Bitte Vorname eingeben.</div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            flex: 1,
            background: saving ? '#6c757d' : '#007bff',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '4px',
            cursor: saving ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: 500
          }}
        >
          {saving ? 'Speichere...' : 'Speichern'}
        </button>
        <button
          onClick={() => window.close()}
          disabled={saving}
          style={{
            flex: 1,
            background: '#6c757d',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '4px',
            cursor: saving ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: 500
          }}
        >
          Abbrechen
        </button>
      </div>
    </div>
  );
};

const container = document.getElementById('add-itw-root');
if (container) {
  const root = createRoot(container);
  root.render(<AddItw />);
}
