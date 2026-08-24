import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

interface AzubiPeriod {
  start_date: string;
  end_date: string;
  description?: string;
  lehrjahr: number;
}

const AddAzubi: React.FC = () => {
  useEffect(() => {
    try { console.log('[AddAzubi] mounted. api keys:', Object.keys((window as any).api || {})); } catch {}
    (async () => {
      try {
        const d = await (window as any).api.getSetting('department');
        if (d && String(d).trim()) setDepartment(String(d).trim());
      } catch { /* ignore */ }
    })();
  }, []);
  
  const [name, setName] = useState('');
  const [vorname, setVorname] = useState('');
  const [lehrjahr, setLehrjahr] = useState(1);
  const [department, setDepartment] = useState('1. Abteilung');
  const [periods, setPeriods] = useState<AzubiPeriod[]>([]);
  const [newPeriod, setNewPeriod] = useState<AzubiPeriod>({ start_date: '', end_date: '', description: '', lehrjahr: 1 });
  const [showAddPeriod, setShowAddPeriod] = useState(false);
  const [attemptedSave, setAttemptedSave] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleAddPeriod = () => {
    if (!newPeriod.start_date || !newPeriod.end_date) {
      alert('Bitte Start- und Enddatum eingeben.');
      return;
    }
    if (new Date(newPeriod.start_date) >= new Date(newPeriod.end_date)) {
      alert('Startdatum muss vor Enddatum liegen.');
      return;
    }
    
    // Einfache Überschneidungsprüfung
    const start = new Date(newPeriod.start_date);
    const end = new Date(newPeriod.end_date);
    for (const p of periods) {
      const pStart = new Date(p.start_date);
      const pEnd = new Date(p.end_date);
      if (start <= pEnd && end >= pStart) {
        alert('Zeitraum überschneidet sich mit einem existierenden Zeitraum.');
        return;
      }
    }

    setPeriods([...periods, { ...newPeriod, description: newPeriod.description || `${newPeriod.lehrjahr}. Lehrjahr` }].sort((a, b) => a.start_date.localeCompare(b.start_date)));
    setNewPeriod({ start_date: '', end_date: '', description: '', lehrjahr: 1 });
    setShowAddPeriod(false);
  };

  const removePeriod = (index: number) => {
    setPeriods(periods.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    try {
      // console.log('[AddAzubi] save clicked');
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
      
      await api.addAzubi({ name, vorname, lehrjahr, department, periods });
      // console.log('[AddAzubi] saved successfully');
      
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
    <div style={{ padding: '24px', fontFamily: 'Arial, sans-serif', maxWidth: '600px', margin: '0 auto' }}>
      <h2 style={{ marginTop: 0, marginBottom: '24px', color: '#333' }}>Azubi hinzufügen</h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
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
        </div>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500 }}>
          Aktuelles Lehrjahr *
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
      </div>

      <div style={{ marginBottom: '24px', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '16px' }}>Zeiträume auf der Wache</h3>
          <button 
            onClick={() => setShowAddPeriod(true)}
            style={{ background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontSize: '13px' }}
          >
            + Zeitraum
          </button>
        </div>

        {periods.length === 0 ? (
          <div style={{ color: '#666', fontStyle: 'italic', fontSize: '13px', textAlign: 'center', padding: '12px' }}>
            Keine Zeiträume definiert.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {periods.map((p, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8f9fa', padding: '8px 12px', borderRadius: '4px', border: '1px solid #eee' }}>
                <div>
                  <div style={{ fontWeight: 500, fontSize: '14px' }}>
                    {new Date(p.start_date).toLocaleDateString('de-DE')} - {new Date(p.end_date).toLocaleDateString('de-DE')}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    {p.lehrjahr}. Lehrjahr {p.description ? `(${p.description})` : ''}
                  </div>
                </div>
                <button 
                  onClick={() => removePeriod(idx)}
                  style={{ background: 'none', border: 'none', color: '#dc3545', cursor: 'pointer', fontSize: '18px', padding: '0 4px' }}
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        )}

        {showAddPeriod && (
          <div style={{ marginTop: '16px', background: '#fff', border: '1px solid #ddd', padding: '12px', borderRadius: '4px' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '14px' }}>Neuer Zeitraum</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>Von</label>
                <input type="date" value={newPeriod.start_date} onChange={e => setNewPeriod({...newPeriod, start_date: e.target.value})} style={{ width: '100%', padding: '6px', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>Bis</label>
                <input type="date" value={newPeriod.end_date} onChange={e => setNewPeriod({...newPeriod, end_date: e.target.value})} style={{ width: '100%', padding: '6px', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>Lehrjahr</label>
                <select value={newPeriod.lehrjahr} onChange={e => setNewPeriod({...newPeriod, lehrjahr: Number(e.target.value)})} style={{ width: '100%', padding: '6px', boxSizing: 'border-box' }}>
                  <option value={1}>1.</option>
                  <option value={2}>2.</option>
                  <option value={3}>3.</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>Beschreibung (opt.)</label>
                <input type="text" value={newPeriod.description || ''} onChange={e => setNewPeriod({...newPeriod, description: e.target.value})} placeholder="z.B. Block 1" style={{ width: '100%', padding: '6px', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button onClick={() => setShowAddPeriod(false)} style={{ padding: '6px 12px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Abbrechen</button>
              <button onClick={handleAddPeriod} style={{ padding: '6px 12px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Hinzufügen</button>
            </div>
          </div>
        )}
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
