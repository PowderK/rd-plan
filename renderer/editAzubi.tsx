import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const params = new URLSearchParams(window.location.search);
const azubiId = params.get('id');



interface AzubiPeriod {
  id?: number;
  azubi_id: number;
  start_date: string;
  end_date: string;
  description?: string;
  lehrjahr?: number;
}

const EditAzubi: React.FC = () => {
  const [name, setName] = useState('');
  const [vorname, setVorname] = useState('');
  const [active, setActive] = useState(true);
  const [activeTab, setActiveTab] = useState<'stammdaten' | 'zeitraeume'>('stammdaten');
  const [azubiPeriods, setAzubiPeriods] = useState<AzubiPeriod[]>([]);
  const [newPeriod, setNewPeriod] = useState({ start_date: '', end_date: '', description: '', lehrjahr: 1 });
  const [editingPeriod, setEditingPeriod] = useState<AzubiPeriod | null>(null);

  useEffect(() => {
    const loadAzubi = async () => {
      try {
        const azubiId = parseInt(new URLSearchParams(window.location.search).get('id') || '0');
        if (azubiId > 0) {
          const azubi = await (window as any).api.getAzubi(azubiId);
          if (azubi) {
            setName(azubi.name);
            setVorname(azubi.vorname);
            setActive(azubi.active !== 0 && azubi.active !== false);
            
            // Azubi-Zeiträume laden
            const azubiPeriods = await (window as any).api.getAzubiPeriods(azubiId);
            setAzubiPeriods(azubiPeriods);
          }
        }
      } catch (error) {
        // console.error('Fehler beim Laden des Azubis:', error);
      }
    };

    loadAzubi();
  }, []);

  const handleSave = async () => {
    if (!azubiId) return;
    
    // Ermittle das aktuelle Lehrjahr aus dem neuesten Zeitraum
    const currentDate = new Date();
    const currentPeriod = azubiPeriods
      .filter(p => new Date(p.start_date) <= currentDate && new Date(p.end_date) >= currentDate)
      .sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime())[0];
    
    const currentLehrjahr = currentPeriod?.lehrjahr || 1;
    
    // Azubi-Basisdaten aktualisieren
    await (window as any).api.updateAzubi({ id: Number(azubiId), name, vorname, lehrjahr: currentLehrjahr, active });
    
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



  const addAzubiPeriod = async () => {
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

      // Validierung: Zeiträume dürfen sich nicht überschneiden
      const newStartDate = new Date(newPeriod.start_date);
      const newEndDate = new Date(newPeriod.end_date);
      
      for (const period of azubiPeriods) {
        const existingStartDate = new Date(period.start_date);
        const existingEndDate = new Date(period.end_date);
        
        // Prüfung auf Überschneidung
        if ((newStartDate <= existingEndDate && newEndDate >= existingStartDate)) {
          alert(`Zeitraum überschneidet sich mit bestehendem Zeitraum (${existingStartDate.toLocaleDateString('de-DE')} - ${existingEndDate.toLocaleDateString('de-DE')})`);
          return;
        }
      }

      // Validierung: Neue Zeiträume müssen chronologisch nach den bestehenden kommen
      const sortedPeriods = [...azubiPeriods].sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
      
      if (sortedPeriods.length > 0) {
        const lastPeriod = sortedPeriods[sortedPeriods.length - 1];
        const lastEndDate = new Date(lastPeriod.end_date);
        
        if (newStartDate <= lastEndDate) {
          alert(`Neuer Zeitraum muss nach dem letzten bestehenden Zeitraum (endet am ${lastEndDate.toLocaleDateString('de-DE')}) beginnen.`);
          return;
        }
        
        // Validierung: Lehrjahr darf nicht reduziert werden
        const lastLehrjahr = lastPeriod.lehrjahr || 1;
        if (newPeriod.lehrjahr < lastLehrjahr) {
          alert(`Das Lehrjahr darf nicht von ${lastLehrjahr} auf ${newPeriod.lehrjahr} reduziert werden. Es muss gleich bleiben oder erhöht werden.`);
          return;
        }
      }

      const description = newPeriod.description || `${newPeriod.lehrjahr}. Lehrjahr`;
      
      await (window as any).api.addAzubiPeriod({
        azubi_id: Number(azubiId),
        start_date: newPeriod.start_date,
        end_date: newPeriod.end_date,
        description: description,
        lehrjahr: newPeriod.lehrjahr
      });

      // Zeiträume neu laden
      const updatedPeriods = await (window as any).api.getAzubiPeriods(Number(azubiId));
      setAzubiPeriods(updatedPeriods);
      setNewPeriod({ start_date: '', end_date: '', description: '', lehrjahr: 1 });
    } catch (error) {
      // console.error('Fehler beim Hinzufügen des Zeitraums:', error);
      alert('Fehler beim Hinzufügen des Zeitraums!');
    }
  };

  const editAzubiPeriod = (period: AzubiPeriod) => {
    setEditingPeriod({ ...period });
  };

  const saveEditedPeriod = async () => {
    try {
      if (!editingPeriod || !azubiId) return;
      
      if (!editingPeriod.start_date || !editingPeriod.end_date) {
        alert('Bitte geben Sie Start- und Enddatum ein.');
        return;
      }

      if (new Date(editingPeriod.start_date) >= new Date(editingPeriod.end_date)) {
        alert('Das Startdatum muss vor dem Enddatum liegen.');
        return;
      }

      // Validierung: Zeiträume dürfen sich nicht überschneiden (außer mit sich selbst)
      const newStartDate = new Date(editingPeriod.start_date);
      const newEndDate = new Date(editingPeriod.end_date);
      
      for (const period of azubiPeriods) {
        if (period.id === editingPeriod.id) continue; // Sich selbst ausschließen
        
        const existingStartDate = new Date(period.start_date);
        const existingEndDate = new Date(period.end_date);
        
        // Prüfung auf Überschneidung
        if ((newStartDate <= existingEndDate && newEndDate >= existingStartDate)) {
          alert(`Zeitraum überschneidet sich mit bestehendem Zeitraum (${existingStartDate.toLocaleDateString('de-DE')} - ${existingEndDate.toLocaleDateString('de-DE')})`);
          return;
        }
      }

      // Validierung: Chronologische Reihenfolge und Lehrjahr-Progression
      const sortedPeriods = [...azubiPeriods.filter(p => p.id !== editingPeriod.id)].sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
      
      // Prüfe Position des bearbeiteten Zeitraums in der Chronologie
      let shouldCheckProgression = false;
      for (let i = 0; i < sortedPeriods.length; i++) {
        const currentPeriod = sortedPeriods[i];
        const currentEndDate = new Date(currentPeriod.end_date);
        
        if (newStartDate > currentEndDate) {
          // Der bearbeitete Zeitraum kommt nach diesem Zeitraum
          const currentLehrjahr = currentPeriod.lehrjahr || 1;
          if (editingPeriod.lehrjahr! < currentLehrjahr) {
            alert(`Das Lehrjahr darf nicht von ${currentLehrjahr} auf ${editingPeriod.lehrjahr} reduziert werden.`);
            return;
          }
          shouldCheckProgression = true;
        } else if (shouldCheckProgression) {
          // Es gibt einen späteren Zeitraum - prüfe ob Lehrjahr nicht reduziert wird
          const laterLehrjahr = currentPeriod.lehrjahr || 1;
          if (editingPeriod.lehrjahr! > laterLehrjahr) {
            alert(`Das Lehrjahr darf nicht auf ${editingPeriod.lehrjahr} erhöht werden, da ein späterer Zeitraum Lehrjahr ${laterLehrjahr} hat.`);
            return;
          }
        }
      }

      await (window as any).api.updateAzubiPeriod(editingPeriod.id, {
        azubi_id: Number(azubiId),
        start_date: editingPeriod.start_date,
        end_date: editingPeriod.end_date,
        description: editingPeriod.description,
        lehrjahr: editingPeriod.lehrjahr
      });

      // Zeiträume neu laden
      const updatedPeriods = await (window as any).api.getAzubiPeriods(Number(azubiId));
      setAzubiPeriods(updatedPeriods);
      setEditingPeriod(null);
    } catch (error) {
      // console.error('Fehler beim Bearbeiten des Zeitraums:', error);
      alert('Fehler beim Bearbeiten des Zeitraums!');
    }
  };

  const cancelEditPeriod = () => {
    setEditingPeriod(null);
  };

  const deleteAzubiPeriod = async (periodId: number) => {
    try {
      if (!confirm('Zeitraum wirklich löschen?')) {
        return;
      }

      await (window as any).api.deleteAzubiPeriod(periodId);

      // Zeiträume neu laden
      if (azubiId) {
        const updatedPeriods = await (window as any).api.getAzubiPeriods(Number(azubiId));
        setAzubiPeriods(updatedPeriods);
      }
    } catch (error) {
      // console.error('Fehler beim Löschen des Zeitraums:', error);
      alert('Fehler beim Löschen des Zeitraums!');
    }
  };

  return (
    <div style={{ padding: 24, height: '100vh', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
      <h2>Azubi bearbeiten</h2>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 4 }}>
        <div style={{
          display: 'flex',
          gap: 4,
          borderBottom: '2px solid #dee2e6',
          marginBottom: 16,
          position: 'sticky',
          top: 0,
          background: 'var(--bg)',
          zIndex: 20,
          paddingTop: 4,
          paddingBottom: 4
        }}>
          <button
            type="button"
            onClick={() => setActiveTab('stammdaten')}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderBottom: activeTab === 'stammdaten' ? '3px solid #0d6efd' : '3px solid transparent',
              background: activeTab === 'stammdaten' ? '#f8f9fa' : 'transparent',
              fontWeight: activeTab === 'stammdaten' ? 600 : 400,
              cursor: 'pointer'
            }}
          >
            Stammdaten
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('zeitraeume')}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderBottom: activeTab === 'zeitraeume' ? '3px solid #0d6efd' : '3px solid transparent',
              background: activeTab === 'zeitraeume' ? '#f8f9fa' : 'transparent',
              fontWeight: activeTab === 'zeitraeume' ? 600 : 400,
              cursor: 'pointer'
            }}
          >
            Zeiträume
          </button>
        </div>

      {activeTab === 'stammdaten' && (
        <>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(280px, 1fr) minmax(280px, 1fr)',
        gap: 12,
        marginBottom: 16
      }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span>Name</span>
          <input value={name} onChange={e => setName(e.target.value)} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span>Vorname</span>
          <input value={vorname} onChange={e => setVorname(e.target.value)} />
        </label>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={active}
            onChange={e => setActive(e.target.checked)}
            style={{ width: 18, height: 18, cursor: 'pointer' }}
          />
          <span style={{ fontWeight: 600 }}>Aktiv</span>
          <span style={{ fontSize: '12px', color: '#666' }}>
            ({active ? 'Azubi ist aktiv' : 'Azubi ist inaktiv'})
          </span>
        </label>
      </div>

      <div style={{ marginTop: 8 }}>
        <button
          onClick={handleDelete}
          style={{ backgroundColor: '#dc3545', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          Löschen
        </button>
      </div>
        </>
      )}

      {activeTab === 'zeitraeume' && azubiId && (
        <div style={{ marginTop: 24, border: '1px solid #28a745', padding: 16, borderRadius: 4 }}>
          <h3>Zeiträume auf der Wache</h3>
          <p style={{ margin: '0 0 16px 0', fontSize: '0.9em', color: '#666' }}>
            Hier definieren Sie die konkreten Zeiträume, in denen der Azubi auf der Wache eingeteilt ist.
          </p>
          
          {/* Aktuelle Zeiträume anzeigen */}
          {azubiPeriods.length > 0 ? (
            <div style={{ marginBottom: 16 }}>
              {azubiPeriods.map(period => (
                <div key={period.id} style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  marginBottom: 8, 
                  padding: 8, 
                  backgroundColor: '#f8fff8', 
                  borderRadius: 4,
                  border: '1px solid #28a745'
                }}>
                  <div style={{ flexGrow: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <strong>{new Date(period.start_date).toLocaleDateString('de-DE')} - {new Date(period.end_date).toLocaleDateString('de-DE')}</strong>
                      <span style={{ 
                        backgroundColor: '#28a745', 
                        color: 'white', 
                        padding: '2px 6px', 
                        borderRadius: 4, 
                        fontSize: '0.8em',
                        fontWeight: 'bold'
                      }}>
                        {period.lehrjahr || 1}. Lehrjahr
                      </span>
                    </div>
                    {period.description && <div style={{ fontSize: '0.9em', color: '#666', marginTop: 4 }}>{period.description}</div>}
                  </div>
                  <button 
                    onClick={() => editAzubiPeriod(period)} 
                    style={{ marginLeft: 8, backgroundColor: '#007bff', color: 'white', border: 'none', padding: '4px 8px', borderRadius: 4, cursor: 'pointer' }}
                  >
                    Bearbeiten
                  </button>
                  <button 
                    onClick={() => deleteAzubiPeriod(period.id!)} 
                    style={{ marginLeft: 4, backgroundColor: '#ff4444', color: 'white', border: 'none', padding: '4px 8px', borderRadius: 4, cursor: 'pointer' }}
                  >
                    Löschen
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: '#666', fontStyle: 'italic', marginBottom: 16 }}>Keine Zeiträume definiert</p>
          )}

          {/* Zeitraum bearbeiten */}
          {editingPeriod && (
            <div style={{ border: '2px solid #007bff', padding: 12, borderRadius: 4, backgroundColor: '#f8f9ff', marginBottom: 16 }}>
              <h4>Zeitraum bearbeiten</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto 2fr auto', gap: 8, alignItems: 'end' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 4, fontSize: '0.9em' }}>Von:</label>
                  <input 
                    type="date" 
                    value={editingPeriod.start_date} 
                    onChange={e => setEditingPeriod({...editingPeriod, start_date: e.target.value})}
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 4, fontSize: '0.9em' }}>Bis:</label>
                  <input 
                    type="date" 
                    value={editingPeriod.end_date} 
                    onChange={e => setEditingPeriod({...editingPeriod, end_date: e.target.value})}
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 4, fontSize: '0.9em' }}>Lehrjahr:</label>
                  <select 
                    value={editingPeriod.lehrjahr || 1} 
                    onChange={e => setEditingPeriod({...editingPeriod, lehrjahr: Number(e.target.value)})}
                    style={{ width: '100%', padding: 4 }}
                  >
                    <option value={1}>1. Lehrjahr</option>
                    <option value={2}>2. Lehrjahr</option>
                    <option value={3}>3. Lehrjahr</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 4, fontSize: '0.9em' }}>Beschreibung (optional):</label>
                  <input 
                    type="text" 
                    value={editingPeriod.description || ''} 
                    onChange={e => setEditingPeriod({...editingPeriod, description: e.target.value})}
                    placeholder="z.B. Praktikum, Schulblock..."
                    style={{ width: '100%' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <button 
                    onClick={saveEditedPeriod}
                    style={{ 
                      backgroundColor: '#007bff', 
                      color: 'white', 
                      border: 'none', 
                      padding: '8px 16px', 
                      borderRadius: 4, 
                      cursor: 'pointer',
                      height: 'fit-content'
                    }}
                  >
                    Speichern
                  </button>
                  <button 
                    onClick={cancelEditPeriod}
                    style={{ 
                      backgroundColor: '#6c757d', 
                      color: 'white', 
                      border: 'none', 
                      padding: '4px 8px', 
                      borderRadius: 4, 
                      cursor: 'pointer',
                      height: 'fit-content',
                      fontSize: '0.85em'
                    }}
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Neuen Zeitraum hinzufügen */}
          {!editingPeriod && (
            <div style={{ border: '1px solid #ddd', padding: 12, borderRadius: 4, backgroundColor: '#fafafa' }}>
              <h4>Neuen Zeitraum hinzufügen</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto 2fr', gap: 8, alignItems: 'end' }}>
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
                  <label style={{ display: 'block', marginBottom: 4, fontSize: '0.9em' }}>Lehrjahr:</label>
                  <select 
                    value={newPeriod.lehrjahr} 
                    onChange={e => setNewPeriod({...newPeriod, lehrjahr: Number(e.target.value)})}
                    style={{ width: '100%', padding: 4 }}
                  >
                    <option value={1}>1. Lehrjahr</option>
                    <option value={2}>2. Lehrjahr</option>
                    <option value={3}>3. Lehrjahr</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 4, fontSize: '0.9em' }}>Beschreibung (optional):</label>
                  <input 
                    type="text" 
                    value={newPeriod.description} 
                    onChange={e => setNewPeriod({...newPeriod, description: e.target.value})}
                    placeholder="z.B. Praktikum, Schulblock..."
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
              <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
                <button 
                  onClick={addAzubiPeriod}
                  style={{ 
                    backgroundColor: '#28a745', 
                    color: 'white', 
                    border: 'none', 
                    padding: '8px 16px', 
                    borderRadius: 4, 
                    cursor: 'pointer'
                  }}
                >
                  Hinzufügen
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      </div>

      <div
        style={{
          borderTop: '1px solid #eee',
          paddingTop: 12,
          paddingBottom: 12,
          background: 'var(--bg)',
          display: 'flex',
          gap: 8,
          justifyContent: 'flex-end',
          flexShrink: 0
        }}
      >
        <button onClick={handleSave} style={{ backgroundColor: '#007acc', color: 'white', padding: '8px 16px', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Speichern</button>
        <button onClick={() => window.close()} style={{ padding: '8px 16px', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer' }}>Abbrechen</button>
      </div>
    </div>
  );
};

const container = document.getElementById('edit-azubi-root');
if (container) {
  const root = createRoot(container);
  root.render(<EditAzubi />);
}
