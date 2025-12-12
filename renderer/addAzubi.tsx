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
      
      try { 
        if (window.opener) window.opener.postMessage('azubis-updated', '*'); 
      } catch {}
      
      window.close();
    } catch (e: any) {
      alert('Speichern fehlgeschlagen: ' + (e?.message || String(e)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: '24px', fontFamily: 'Arial, sans-serif' }}>
      <h2 style={{ marginTop: 0, marginBottom: '24px', color: '#333' }}>Azubi hinzufügen</h2>
      
      <div style={{ marginBottom: '16px' }}>
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
          <div style={{ color: '#b00020', fontSize: '12px', marginTop: '4px' }}>
            Pflichtfeld: Bitte Name eingeben.
          </div>
        )}
      </div>

      <div style={{ marginBottom: '16px' }}>
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
          <div style={{ color: '#b00020', fontSize: '12px', marginTop: '4px' }}>
            Pflichtfeld: Bitte Vorname eingeben.
          </div>
        )}
      </div>

      <div style={{ marginBottom: '24px' }}>
        <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500 }}>
          Lehrjahr *
        </label>
        <select
          value={lehrjahr}
          onChange={e => setLehrjahr(Number(e.target.value))}
          style={{
            width: '100%',
            padding: '10px',
            border: attemptedSave && ![1,2,3].includes(lehrjahr) ? '2px solid #b00020' : '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '14px',
            boxSizing: 'border-box',
            backgroundColor: 'white'
          }}
        >
          <option value={1}>1. Lehrjahr</option>
          <option value={2}>2. Lehrjahr</option>
          <option value={3}>3. Lehrjahr</option>
        </select>
        {attemptedSave && ![1,2,3].includes(lehrjahr) && (
          <div style={{ color: '#b00020', fontSize: '12px', marginTop: '4px' }}>
            Pflichtfeld: Lehrjahr muss 1–3 sein.
          </div>
        )}
      </div>

      <div style={{
        background: '#f8f9fa',
        padding: '12px',
        borderRadius: '4px',
        marginBottom: '24px',
        fontSize: '13px',
        color: '#666'
      }}>
        <strong>Hinweis:</strong> Qualifikationen können nach dem Erstellen über "Bearbeiten" hinzugefügt werden.
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
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

const container = document.getElementById('add-azubi-root');
if (container) {
  const root = createRoot(container);
  root.render(<AddAzubi />);
}
