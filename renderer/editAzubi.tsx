import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';

const params = new URLSearchParams(window.location.search);
const azubiId = params.get('id');

interface AzubiPeriod {
  id?: number;
  azubi_id: number;
  start_date: string;
  end_date: string;
  description?: string;
}

const EditAzubi: React.FC = () => {
  const [name, setName] = useState('');
  const [vorname, setVorname] = useState('');
  const [lehrjahr, setLehrjahr] = useState(1);
  const [periods, setPeriods] = useState<AzubiPeriod[]>([]);
  const [newPeriod, setNewPeriod] = useState({ start_date: '', end_date: '', description: '' });

  useEffect(() => {
    const loadAzubi = async () => {
      try {
        const azubiId = parseInt(new URLSearchParams(window.location.search).get('id') || '0');
        if (azubiId > 0) {
          const azubi = await (window as any).api.getAzubi(azubiId);
          if (azubi) {
            setName(azubi.name);
            setVorname(azubi.vorname);
            setLehrjahr(azubi.lehrjahr);
            
            // Zeiträume laden
            const azubiPeriods = await (window as any).api.getAzubiPeriods(azubiId);
            setPeriods(azubiPeriods);
          }
        }
      } catch (error) {
        console.error('Fehler beim Laden des Azubis:', error);
      }
    };

    loadAzubi();
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

  const addPeriod = async () => {
    try {
      if (!azubiId) {
        alert('Bitte speichern Sie den Azubi zuerst, bevor Sie Zeiträume hinzufügen.');
        return;
      }
      
      if (!newPeriod.start_date || !newPeriod.end_date) {
        alert('Bitte geben Sie Start- und Enddatum ein.');
        return;
      }

      if (new Date(newPeriod.start_date) >= new Date(newPeriod.end_date)) {
        alert('Das Startdatum muss vor dem Enddatum liegen.');
        return;
      }

      await (window as any).api.addAzubiPeriod({
        azubi_id: Number(azubiId),
        start_date: newPeriod.start_date,
        end_date: newPeriod.end_date,
        description: newPeriod.description || undefined
      });

      // Zeiträume neu laden
      const updatedPeriods = await (window as any).api.getAzubiPeriods(Number(azubiId));
      setPeriods(updatedPeriods);
      setNewPeriod({ start_date: '', end_date: '', description: '' });
    } catch (error) {
      console.error('Fehler beim Hinzufügen des Zeitraums:', error);
      alert('Fehler beim Hinzufügen des Zeitraums!');
    }
  };

  const deletePeriod = async (periodId: number) => {
    try {
      if (!confirm('Zeitraum wirklich löschen?')) {
        return;
      }

      await (window as any).api.deleteAzubiPeriod(periodId);

      // Zeiträume neu laden
      if (azubiId) {
        const updatedPeriods = await (window as any).api.getAzubiPeriods(Number(azubiId));
        setPeriods(updatedPeriods);
      }
    } catch (error) {
      console.error('Fehler beim Löschen des Zeitraums:', error);
      alert('Fehler beim Löschen des Zeitraums!');
    }
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
        <label>Lehrjahr: <input type="number" value={lehrjahr} onChange={e => setLehrjahr(Number(e.target.value))} /></label>
      </div>

      {azubiId && (
        <div style={{ marginTop: 24, border: '1px solid #ccc', padding: 16, borderRadius: 4 }}>
          <h3>Zeiträume auf der Wache</h3>
          
          {/* Aktuelle Zeiträume anzeigen */}
          {periods.length > 0 ? (
            <div style={{ marginBottom: 16 }}>
              {periods.map(period => (
                <div key={period.id} style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  marginBottom: 8, 
                  padding: 8, 
                  backgroundColor: '#f5f5f5', 
                  borderRadius: 4 
                }}>
                  <div style={{ flexGrow: 1 }}>
                    <strong>{new Date(period.start_date).toLocaleDateString('de-DE')} - {new Date(period.end_date).toLocaleDateString('de-DE')}</strong>
                    {period.description && <div style={{ fontSize: '0.9em', color: '#666' }}>{period.description}</div>}
                  </div>
                  <button 
                    onClick={() => deletePeriod(period.id!)} 
                    style={{ marginLeft: 8, backgroundColor: '#ff4444', color: 'white', border: 'none', padding: '4px 8px', borderRadius: 4, cursor: 'pointer' }}
                  >
                    Löschen
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: '#666', fontStyle: 'italic' }}>Keine Zeiträume definiert</p>
          )}

          {/* Neuen Zeitraum hinzufügen */}
          <div style={{ border: '1px solid #ddd', padding: 12, borderRadius: 4, backgroundColor: '#fafafa' }}>
            <h4>Neuen Zeitraum hinzufügen</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr auto', gap: 8, alignItems: 'end' }}>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontSize: '0.9em' }}>Von:</label>
                <input 
                  type="date" 
                  value={newPeriod.start_date} 
                  onChange={e => setNewPeriod({...newPeriod, start_date: e.target.value})}
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontSize: '0.9em' }}>Bis:</label>
                <input 
                  type="date" 
                  value={newPeriod.end_date} 
                  onChange={e => setNewPeriod({...newPeriod, end_date: e.target.value})}
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontSize: '0.9em' }}>Beschreibung (optional):</label>
                <input 
                  type="text" 
                  value={newPeriod.description} 
                  onChange={e => setNewPeriod({...newPeriod, description: e.target.value})}
                  placeholder="z.B. 2. Lehrjahr, Praktikum..."
                  style={{ width: '100%' }}
                />
              </div>
              <button 
                onClick={addPeriod}
                style={{ 
                  backgroundColor: '#007acc', 
                  color: 'white', 
                  border: 'none', 
                  padding: '8px 16px', 
                  borderRadius: 4, 
                  cursor: 'pointer',
                  height: 'fit-content'
                }}
              >
                Hinzufügen
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <button onClick={handleSave}>Speichern</button>
        <button onClick={handleDelete} style={{ marginLeft: 8 }}>Löschen</button>
        <button onClick={() => window.close()} style={{ marginLeft: 8 }}>Abbrechen</button>
      </div>
    </div>
  );
};

const container = document.getElementById('edit-azubi-root');
if (container) {
  const root = createRoot(container);
  root.render(<EditAzubi />);
}
