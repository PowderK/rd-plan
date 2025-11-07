import React, { useState, useEffect, useCallback } from 'react';
import styles from './PersonnelOverview.module.css';
import ExcelImport from './ExcelImport';

// Zeiträume Manager Komponente
const AzubiPeriodsManager: React.FC<{ azubi: Azubi; onClose: () => void }> = ({ azubi, onClose }) => {
  const [periods, setPeriods] = useState<AzubiPeriod[]>([]);
  const [newPeriod, setNewPeriod] = useState({ start_date: '', end_date: '', description: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadPeriods = async () => {
      try {
        const azubiPeriods = await (window as any).api.getAzubiPeriods(azubi.id);
        setPeriods(azubiPeriods);
      } catch (error) {
        console.error('Fehler beim Laden der Zeiträume:', error);
      }
    };
    loadPeriods();
  }, [azubi.id]);

  const addPeriod = async () => {
    try {
      if (!newPeriod.start_date || !newPeriod.end_date) {
        alert('Bitte geben Sie Start- und Enddatum ein.');
        return;
      }

      if (new Date(newPeriod.start_date) >= new Date(newPeriod.end_date)) {
        alert('Das Startdatum muss vor dem Enddatum liegen.');
        return;
      }

      setLoading(true);
      await (window as any).api.addAzubiPeriod({
        azubi_id: azubi.id,
        start_date: newPeriod.start_date,
        end_date: newPeriod.end_date,
        description: newPeriod.description || undefined
      });

      // Zeiträume neu laden
      const updatedPeriods = await (window as any).api.getAzubiPeriods(azubi.id);
      setPeriods(updatedPeriods);
      setNewPeriod({ start_date: '', end_date: '', description: '' });
    } catch (error) {
      console.error('Fehler beim Hinzufügen des Zeitraums:', error);
      alert('Fehler beim Hinzufügen des Zeitraums!');
    } finally {
      setLoading(false);
    }
  };

  const deletePeriod = async (periodId: number) => {
    try {
      if (!confirm('Zeitraum wirklich löschen?')) {
        return;
      }

      setLoading(true);
      await (window as any).api.deleteAzubiPeriod(periodId);

      // Zeiträume neu laden
      const updatedPeriods = await (window as any).api.getAzubiPeriods(azubi.id);
      setPeriods(updatedPeriods);
    } catch (error) {
      console.error('Fehler beim Löschen des Zeitraums:', error);
      alert('Fehler beim Löschen des Zeitraums!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      position: 'fixed', 
      top: 0, 
      left: 0, 
      right: 0, 
      bottom: 0, 
      backgroundColor: 'rgba(0,0,0,0.5)', 
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '24px',
        maxWidth: '600px',
        width: '90%',
        maxHeight: '80vh',
        overflow: 'auto',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
      }}>
        <h2>Zeiträume für {azubi.vorname} {azubi.name}</h2>
        
        {/* Aktuelle Zeiträume anzeigen */}
        {periods.length > 0 ? (
          <div style={{ marginBottom: 24 }}>
            <h3>Aktuelle Zeiträume:</h3>
            {periods.map(period => (
              <div key={period.id} style={{ 
                display: 'flex', 
                alignItems: 'center', 
                marginBottom: 12, 
                padding: 12, 
                backgroundColor: '#f5f5f5', 
                borderRadius: 4 
              }}>
                <div style={{ flexGrow: 1 }}>
                  <strong>{new Date(period.start_date).toLocaleDateString('de-DE')} - {new Date(period.end_date).toLocaleDateString('de-DE')}</strong>
                  {period.description && <div style={{ fontSize: '0.9em', color: '#666' }}>{period.description}</div>}
                </div>
                <button 
                  onClick={() => deletePeriod(period.id)} 
                  disabled={loading}
                  style={{ 
                    marginLeft: 12, 
                    backgroundColor: '#ff4444', 
                    color: 'white', 
                    border: 'none', 
                    padding: '6px 12px', 
                    borderRadius: 4, 
                    cursor: loading ? 'not-allowed' : 'pointer'
                  }}
                >
                  Löschen
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: '#666', fontStyle: 'italic', marginBottom: 24 }}>Keine Zeiträume definiert</p>
        )}

        {/* Neuen Zeitraum hinzufügen */}
        <div style={{ border: '1px solid #ddd', padding: 16, borderRadius: 4, backgroundColor: '#fafafa' }}>
          <h3>Neuen Zeitraum hinzufügen:</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: '0.9em', fontWeight: 'bold' }}>Von:</label>
              <input 
                type="date" 
                value={newPeriod.start_date} 
                onChange={e => setNewPeriod({...newPeriod, start_date: e.target.value})}
                style={{ width: '100%', padding: '8px' }}
                disabled={loading}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: '0.9em', fontWeight: 'bold' }}>Bis:</label>
              <input 
                type="date" 
                value={newPeriod.end_date} 
                onChange={e => setNewPeriod({...newPeriod, end_date: e.target.value})}
                style={{ width: '100%', padding: '8px' }}
                disabled={loading}
              />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', marginBottom: 4, fontSize: '0.9em', fontWeight: 'bold' }}>Beschreibung (optional):</label>
            <input 
              type="text" 
              value={newPeriod.description} 
              onChange={e => setNewPeriod({...newPeriod, description: e.target.value})}
              placeholder="z.B. 2. Lehrjahr, Praktikum..."
              style={{ width: '100%', padding: '8px' }}
              disabled={loading}
            />
          </div>
          <button 
            onClick={addPeriod}
            disabled={loading}
            style={{ 
              backgroundColor: '#007acc', 
              color: 'white', 
              border: 'none', 
              padding: '10px 20px', 
              borderRadius: 4, 
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Wird hinzugefügt...' : 'Hinzufügen'}
          </button>
        </div>

        <div style={{ marginTop: 24, textAlign: 'right' }}>
          <button 
            onClick={onClose}
            style={{ 
              backgroundColor: '#6c757d', 
              color: 'white', 
              border: 'none', 
              padding: '10px 20px', 
              borderRadius: 4, 
              cursor: 'pointer'
            }}
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
};

interface Person {
  id: number;
  name: string;
  vorname: string;
  teilzeit: number;
  fahrzeugfuehrer: boolean;
  fahrzeugfuehrerHLFB: boolean;
  nef?: boolean; // durchreichen (nicht inline editierbar hier)
  itwMaschinist?: boolean;
  itwFahrzeugfuehrer?: boolean;
  sort?: number;
  active?: number | boolean;
}

interface Azubi { id: number; name: string; vorname: string; lehrjahr: number }
interface ItwDoctor { id: number; name: string; vorname: string }
interface AzubiPeriod {
  id: number;
  azubi_id: number;
  start_date: string;
  end_date: string;
  description?: string;
}

const PersonnelOverview: React.FC = () => {
  const [personnel, setPersonnel] = useState<Person[]>([]);
  const [azubis, setAzubis] = useState<Azubi[]>([]);
  const [azubiPeriods, setAzubiPeriods] = useState<Record<number, AzubiPeriod[]>>({});
  const [showPeriodManager, setShowPeriodManager] = useState(false);
  const [selectedAzubiForPeriods, setSelectedAzubiForPeriods] = useState<Azubi | null>(null);
  const [itws, setItws] = useState<ItwDoctor[]>([]);
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [draggedAzubiId, setDraggedAzubiId] = useState<number | null>(null);
  const [draggedItwId, setDraggedItwId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const [dragPosition, setDragPosition] = useState<'above' | 'below' | null>(null);
  const [dragContext, setDragContext] = useState<'person'|'azubi'|'itw'|null>(null);
  const [editing, setEditing] = useState(false);
  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(null);
  const [originalPersonnel, setOriginalPersonnel] = useState<Person[] | null>(null);
  // Azubi/ITW: gleiche Optik/Verhalten/Bearbeitung
  const [editingAzubis, setEditingAzubis] = useState(false);
  const [selectedAzubiId, setSelectedAzubiId] = useState<number | null>(null);
  const [originalAzubis, setOriginalAzubis] = useState<Azubi[] | null>(null);
  const [editingItw, setEditingItw] = useState(false);
  const [selectedItwId, setSelectedItwId] = useState<number | null>(null);
  const [originalItws, setOriginalItws] = useState<ItwDoctor[] | null>(null);
  const [showExcelImport, setShowExcelImport] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  const loadPersonnel = useCallback(async () => {
    setLoading(true);
    const list = await (window as any).api.getPersonnelList(showInactive);
    setPersonnel(list);
    setLoading(false);
  }, [showInactive]);

  const loadAzubis = useCallback(async () => {
    const list = await (window as any).api.getAzubiList();
    setAzubis(list);
    // Lade Zeiträume für alle Azubis
    const allPeriods = await (window as any).api.getAllAzubiPeriods();
    const periodsByAzubi: Record<number, AzubiPeriod[]> = {};
    allPeriods.forEach((period: AzubiPeriod) => {
      if (!periodsByAzubi[period.azubi_id]) {
        periodsByAzubi[period.azubi_id] = [];
      }
      periodsByAzubi[period.azubi_id].push(period);
    });
    setAzubiPeriods(periodsByAzubi);
  }, []);

  const loadItws = useCallback(async () => {
    const list = await (window as any).api.getItwDoctors();
    setItws(list);
  }, []);

  useEffect(() => {
    loadPersonnel();
    loadAzubis();
    loadItws();
    const handler = (_event: any) => {
      console.log('[Renderer] personnel-updated Event empfangen');
      loadPersonnel();
      loadAzubis();
      loadItws();
    };
    (window as any).api.onPersonnelUpdated?.(handler);
    // subscribe to azubi broadcasts from main
    const azubiHandler = (_event: any) => {
      console.log('[Renderer] azubis-updated Event empfangen');
      loadAzubis();
    };
    (window as any).api.onAzubisUpdated?.(azubiHandler);
    const itwHandler = (_event: any) => {
      console.log('[Renderer] itw-updated Event empfangen');
      loadItws();
    };
    (window as any).api.onItwUpdated?.(itwHandler);
    // postMessage-Listener für Popups
    const messageHandler = (event: MessageEvent) => {
      if (event.data === 'personnel-updated') {
        console.log('[Renderer] personnel-updated via postMessage empfangen');
        loadPersonnel();
      } else if (event.data === 'azubis-updated') {
        console.log('[Renderer] azubis-updated via postMessage empfangen');
        loadAzubis();
      } else if (event.data === 'itw-updated') {
        console.log('[Renderer] itw-updated via postMessage empfangen');
        loadItws();
      }
    };
    window.addEventListener('message', messageHandler);
    return () => {
      (window as any).api.offPersonnelUpdated?.(handler);
      (window as any).api.offAzubisUpdated?.(azubiHandler);
      (window as any).api.offItwUpdated?.(itwHandler);
      window.removeEventListener('message', messageHandler);
    };
  }, [loadPersonnel, loadAzubis]);

  const onDragStart = (id: number) => setDraggedId(id);
  const onDragOver = (e: React.DragEvent<HTMLTableRowElement>, overId: number, ctx: 'person'|'azubi'|'itw') => {
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const pos = offsetY < rect.height / 2 ? 'above' : 'below';
    setDragOverId(overId);
    setDragPosition(pos);
    setDragContext(ctx);
  };
  const onDragLeave = () => {
    setDragOverId(null);
    setDragPosition(null);
    setDragContext(null);
  };
  const onDrop = async (id: number) => {
    if (draggedId === null || draggedId === id) return;
    const oldIndex = personnel.findIndex(p => p.id === draggedId);
    let newIndex = personnel.findIndex(p => p.id === id);
    if (dragPosition === 'below') newIndex += 1;
    const updated = [...personnel];
    const [removed] = updated.splice(oldIndex, 1);
    if (oldIndex < newIndex) newIndex -= 1; // nach Entfernen rutscht Ziel nach oben
    updated.splice(Math.max(0, Math.min(updated.length, newIndex)), 0, removed);
    setPersonnel(updated);
    setDraggedId(null);
    setDragOverId(null);
    setDragPosition(null);
    // Reihenfolge in DB speichern
    await (window as any).api.updatePersonnelOrder(updated.map(p => p.id));
    loadPersonnel();
  };

  // --- Inline Edit Handling (nur Personal) ---
  const startEditing = () => {
    setOriginalPersonnel(JSON.parse(JSON.stringify(personnel)));
    setEditing(true);
  };
  const cancelEditing = () => {
    if (originalPersonnel) setPersonnel(originalPersonnel);
    setEditing(false);
  };
  const saveEditing = async () => {
    try {
      for (const p of personnel) {
        const orig = originalPersonnel?.find(o => o.id === p.id);
        if (!orig || JSON.stringify(orig) !== JSON.stringify(p)) {
          // Nur speichern, wenn geändert
          await (window as any).api.updatePerson({
            id: p.id,
            name: p.name,
            vorname: p.vorname,
            teilzeit: p.teilzeit,
            fahrzeugfuehrer: p.fahrzeugfuehrer,
            fahrzeugfuehrerHLFB: p.fahrzeugfuehrerHLFB,
            nef: p.nef || false,
            itwMaschinist: p.itwMaschinist || false,
            itwFahrzeugfuehrer: p.itwFahrzeugfuehrer || false,
            sort: p.sort ?? 0,
          });
          // Aktiv-Status separat behandeln, sofern geändert
          const prevActive = (orig?.active ?? 1) ? true : false;
          const nextActive = (p.active ?? 1) ? true : false;
          if (prevActive !== nextActive) {
            await (window as any).api.setPersonActive(p.id, nextActive);
          }
        }
      }
      setEditing(false);
      setOriginalPersonnel(null);
      loadPersonnel();
    } catch (e) {
      console.warn('[PersonnelOverview] saveEditing Fehler', e);
    }
  };
  const updateField = (id: number, field: keyof Person, value: any) => {
    setPersonnel(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };
  const handleRowClick = (id: number) => {
    setSelectedPersonId(id === selectedPersonId ? null : id);
  };
  const handleDeleteSelected = () => {
    if (selectedPersonId == null) return;
    (window as any).api.openConfirmDeleteWindow(selectedPersonId);
  };

  const onAzubiDragStart = (id: number) => setDraggedAzubiId(id);
  const onAzubiDrop = async (id: number) => {
    if (draggedAzubiId === null || draggedAzubiId === id) return;
    const oldIndex = azubis.findIndex(a => a.id === draggedAzubiId);
    let newIndex = azubis.findIndex(a => a.id === id);
    if (dragPosition === 'below') newIndex += 1;
    const updated = [...azubis];
    const [removed] = updated.splice(oldIndex, 1);
    if (oldIndex < newIndex) newIndex -= 1;
    updated.splice(Math.max(0, Math.min(updated.length, newIndex)), 0, removed);
    setAzubis(updated);
    setDraggedAzubiId(null);
    setDragOverId(null);
    setDragPosition(null);
    // Reihenfolge in DB speichern
    await (window as any).api.updateAzubiOrder(updated.map(a => a.id));
    loadAzubis();
  };

  const onItwDragStart = (id: number) => setDraggedItwId(id);
  const onItwDrop = async (id: number) => {
    if (draggedItwId === null || draggedItwId === id) return;
    const oldIndex = itws.findIndex(a => a.id === draggedItwId);
    let newIndex = itws.findIndex(a => a.id === id);
    if (dragPosition === 'below') newIndex += 1;
    const updated = [...itws];
    const [removed] = updated.splice(oldIndex, 1);
    if (oldIndex < newIndex) newIndex -= 1;
    updated.splice(Math.max(0, Math.min(updated.length, newIndex)), 0, removed);
    setItws(updated);
    setDraggedItwId(null);
    setDragOverId(null);
    setDragPosition(null);
    // Reihenfolge in DB speichern
    await (window as any).api.updateItwDoctorOrder(updated.map(a => a.id));
    loadItws();
  };

  // Azubi Inline-Edit Handling
  const startEditingAzubis = () => { setOriginalAzubis(JSON.parse(JSON.stringify(azubis))); setEditingAzubis(true); };
  const cancelEditingAzubis = () => { if (originalAzubis) setAzubis(originalAzubis); setEditingAzubis(false); };
  const saveEditingAzubis = async () => {
    try {
      for (const a of azubis) {
        const orig = originalAzubis?.find(o => o.id === a.id);
        if (!orig || JSON.stringify(orig) !== JSON.stringify(a)) {
          await (window as any).api.updateAzubi({ id: a.id, name: a.name, vorname: a.vorname, lehrjahr: a.lehrjahr });
        }
      }
      setEditingAzubis(false);
      setOriginalAzubis(null);
      loadAzubis();
    } catch (e) { console.warn('[PersonnelOverview] saveEditingAzubis Fehler', e); }
  };
  const updateAzubiField = (id: number, field: keyof Azubi, value: any) => {
    setAzubis(prev => prev.map(a => a.id === id ? { ...a, [field]: value } as Azubi : a));
  };
  const handleAzubiRowClick = (id: number) => setSelectedAzubiId(id === selectedAzubiId ? null : id);
  const handleDeleteSelectedAzubi = () => { if (selectedAzubiId == null) return; (window as any).api.openConfirmDeleteWindow(selectedAzubiId, 'azubi'); };

  // ITW Inline-Edit Handling
  const startEditingItw = () => { setOriginalItws(JSON.parse(JSON.stringify(itws))); setEditingItw(true); };
  const cancelEditingItw = () => { if (originalItws) setItws(originalItws); setEditingItw(false); };
  const saveEditingItw = async () => {
    try {
      for (const d of itws) {
        const orig = originalItws?.find(o => o.id === d.id);
        if (!orig || JSON.stringify(orig) !== JSON.stringify(d)) {
          await (window as any).api.updateItwDoctor({ id: d.id, name: d.name, vorname: d.vorname });
        }
      }
      setEditingItw(false);
      setOriginalItws(null);
      loadItws();
    } catch (e) { console.warn('[PersonnelOverview] saveEditingItw Fehler', e); }
  };
  const updateItwField = (id: number, field: keyof ItwDoctor, value: any) => {
    setItws(prev => prev.map(a => a.id === id ? { ...a, [field]: value } as ItwDoctor : a));
  };
  const handleItwRowClick = (id: number) => setSelectedItwId(id === selectedItwId ? null : id);
  const handleDeleteSelectedItw = () => { if (selectedItwId == null) return; (window as any).api.openConfirmDeleteWindow(selectedItwId, 'itw'); };

  const handleExcelImportComplete = (result: any) => {
    console.log('Excel-Import abgeschlossen:', result);
    loadPersonnel(); // Daten neu laden nach Import
    if (result.success) {
      alert(`Import erfolgreich! ${result.imported} Personen importiert, ${result.skipped} übersprungen.`);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      {showExcelImport && (
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          backgroundColor: 'rgba(0,0,0,0.5)', 
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
          }}>
            <ExcelImport 
              onImportComplete={handleExcelImportComplete}
              onClose={() => setShowExcelImport(false)}
            />
          </div>
        </div>
      )}
  {/* Überschrift entfernt */}
      {loading ? <div>Lade Daten...</div> : (
      <>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} /> Inaktive anzeigen
        </label>
      </div>
      {/* Stammpersonal: Buttons unter der Tabelle */}
      <table className={styles.table}>
        <thead>
          <tr className={styles.thead}>
            <th>Name</th>
            <th>Vorname</th>
            <th className={styles.narrow}>Teilzeit (%)</th>
            <th className={styles.checkboxCell}>FzF</th>
            <th className={styles.checkboxCell}>FzF HLF-B</th>
            <th className={styles.checkboxCell}>NEF</th>
            <th className={styles.checkboxCell}>ITW Ma.</th>
            <th className={styles.checkboxCell}>ITW FzF</th>
            <th className={styles.checkboxCell}>Aktiv</th>
            <th style={{ width: 60 }} className={styles.center}>#</th>
          </tr>
        </thead>
        <tbody className={styles.tbody}>
          {personnel.map(person => {
            const selected = person.id === selectedPersonId;
            const isOver = dragContext === 'person' && dragOverId === person.id;
            const rowClass = [styles.row, selected ? styles.selected : '', isOver && dragPosition === 'above' ? styles.dropAbove : '', isOver && dragPosition === 'below' ? styles.dropBelow : ''].filter(Boolean).join(' ');
            const inactive = !(person.active ?? 1);
            return (
              <tr
                key={person.id}
                draggable={!editing}
                onDragStart={() => !editing && onDragStart(person.id)}
                onDragOver={(e) => !editing && onDragOver(e, person.id, 'person')}
                onDragLeave={() => !editing && onDragLeave()}
                onDrop={() => !editing && onDrop(person.id)}
                onClick={() => handleRowClick(person.id)}
                className={rowClass}
                style={{ cursor: editing ? 'default' : 'move', opacity: inactive ? 0.6 : 1 }}
              >
                <td>{editing ? <input value={person.name} onChange={e => updateField(person.id, 'name', e.target.value)} /> : person.name}</td>
                <td>{editing ? <input value={person.vorname} onChange={e => updateField(person.id, 'vorname', e.target.value)} /> : person.vorname}</td>
                <td>{editing ? <input type="number" className={styles.narrow} value={person.teilzeit} onChange={e => updateField(person.id, 'teilzeit', Number(e.target.value))} /> : person.teilzeit}</td>
                <td className={styles.checkboxCell}><input type="checkbox" disabled={!editing} checked={!!person.fahrzeugfuehrer} onChange={e => editing && updateField(person.id, 'fahrzeugfuehrer', e.target.checked)} /></td>
                <td className={styles.checkboxCell}><input type="checkbox" disabled={!editing} checked={!!person.fahrzeugfuehrerHLFB} onChange={e => editing && updateField(person.id, 'fahrzeugfuehrerHLFB', e.target.checked)} /></td>
                <td className={styles.checkboxCell}><input type="checkbox" disabled={!editing} checked={!!person.nef} onChange={e => editing && updateField(person.id, 'nef', e.target.checked)} /></td>
                <td className={styles.checkboxCell}><input type="checkbox" disabled={!editing} checked={!!person.itwMaschinist} onChange={e => editing && updateField(person.id, 'itwMaschinist', e.target.checked)} /></td>
                <td className={styles.checkboxCell}><input type="checkbox" disabled={!editing} checked={!!person.itwFahrzeugfuehrer} onChange={e => editing && updateField(person.id, 'itwFahrzeugfuehrer', e.target.checked)} /></td>
                <td className={styles.checkboxCell}><input type="checkbox" disabled={!editing} checked={(person.active ?? 1) ? true : false} onChange={e => editing && updateField(person.id, 'active', e.target.checked)} /></td>
                <td className={styles.center}>{selected ? '✓' : ''}</td>
              </tr>
            );
          })}
        </tbody>
  </table>
  {/* Aktionen unter der Stammpersonal-Tabelle */}
  {!editing ? (
    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
      <button onClick={() => (window as any).api.openAddPersonWindow()}>Hinzufügen</button>
      <button onClick={startEditing} disabled={personnel.length === 0}>Ändern</button>
      <button onClick={handleDeleteSelected} disabled={selectedPersonId == null}>Löschen</button>
      <button onClick={() => setShowExcelImport(true)} style={{ marginLeft: 16, backgroundColor: '#28a745', color: 'white' }}>Excel Import/Export</button>
    </div>
  ) : (
    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
      <button onClick={saveEditing}>Speichern</button>
      <button onClick={cancelEditing}>Abbrechen</button>
    </div>
  )}
  </>
      )}
      <div style={{ marginTop: 32 }}>
        <h3>Azubis</h3>
        {/* Azubis: Buttons unter der Tabelle */}
        <table className={styles.table}>
          <thead>
            <tr className={styles.thead}>
              <th>Name</th>
              <th>Vorname</th>
              <th className={styles.narrow}>Lehrjahr</th>
              <th>Zeiträume</th>
              <th className={styles.center} style={{ width: 60 }}>#</th>
            </tr>
          </thead>
          <tbody className={styles.tbody}>
            {azubis.map(a => {
              const isOver = dragContext === 'azubi' && dragOverId === a.id;
              const rowClass = [styles.row, selectedAzubiId === a.id ? styles.selected : '', isOver && dragPosition === 'above' ? styles.dropAbove : '', isOver && dragPosition === 'below' ? styles.dropBelow : ''].filter(Boolean).join(' ');
              const periods = azubiPeriods[a.id] || [];
              const periodsText = periods.length > 0 
                ? periods.map(p => `${new Date(p.start_date).toLocaleDateString('de-DE')} - ${new Date(p.end_date).toLocaleDateString('de-DE')}`).join(', ')
                : 'Keine Zeiträume definiert';
              
              return (
                <tr key={a.id}
                    draggable={!editingAzubis}
                    onDragStart={() => !editingAzubis && onAzubiDragStart(a.id)}
                    onDragOver={(e) => !editingAzubis && onDragOver(e, a.id, 'azubi')}
                    onDragLeave={() => !editingAzubis && onDragLeave()}
                    onDrop={() => !editingAzubis && onAzubiDrop(a.id)}
                    onClick={() => handleAzubiRowClick(a.id)}
                    className={rowClass}
                    style={{ cursor: editingAzubis ? 'default' : 'move' }}>
                  <td>{editingAzubis ? <input value={a.name} onChange={e => updateAzubiField(a.id, 'name', e.target.value)} /> : a.name}</td>
                  <td>{editingAzubis ? <input value={a.vorname} onChange={e => updateAzubiField(a.id, 'vorname', e.target.value)} /> : a.vorname}</td>
                  <td>{editingAzubis ? <input type="number" className={styles.narrow} value={a.lehrjahr} onChange={e => updateAzubiField(a.id, 'lehrjahr', Number(e.target.value))} /> : a.lehrjahr}</td>
                  <td style={{ fontSize: '0.9em', color: periods.length > 0 ? '#333' : '#999', maxWidth: '200px', wordWrap: 'break-word' }}>
                    {periodsText}
                  </td>
                  <td className={styles.center}>{selectedAzubiId === a.id ? '✓' : ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!editingAzubis ? (
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={() => (window as any).api.openAddAzubiWindow()}>Hinzufügen</button>
            <button onClick={startEditingAzubis} disabled={azubis.length === 0}>Ändern</button>
            <button onClick={handleDeleteSelectedAzubi} disabled={selectedAzubiId == null}>Löschen</button>
            <button 
              onClick={() => {
                const selectedAzubi = azubis.find(a => a.id === selectedAzubiId);
                if (selectedAzubi) {
                  setSelectedAzubiForPeriods(selectedAzubi);
                  setShowPeriodManager(true);
                }
              }} 
              disabled={selectedAzubiId == null}
              style={{ marginLeft: 16, backgroundColor: '#007acc', color: 'white' }}
            >
              Zeiträume verwalten
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={saveEditingAzubis}>Speichern</button>
            <button onClick={cancelEditingAzubis}>Abbrechen</button>
          </div>
        )}
      </div>
      <div style={{ marginTop: 32 }}>
        <h3>ITW Ärzte</h3>
        {/* ITW Ärzte: Buttons unter der Tabelle */}
        <table className={styles.table}>
          <thead>
            <tr className={styles.thead}>
              <th>Name</th>
              <th>Vorname</th>
              <th className={styles.center} style={{ width: 60 }}>#</th>
            </tr>
          </thead>
          <tbody className={styles.tbody}>
            {itws.map(a => {
              const isOver = dragContext === 'itw' && dragOverId === a.id;
              const rowClass = [styles.row, selectedItwId === a.id ? styles.selected : '', isOver && dragPosition === 'above' ? styles.dropAbove : '', isOver && dragPosition === 'below' ? styles.dropBelow : ''].filter(Boolean).join(' ');
              return (
                <tr key={a.id}
                    draggable={!editingItw}
                    onDragStart={() => !editingItw && onItwDragStart(a.id)}
                    onDragOver={(e) => !editingItw && onDragOver(e, a.id, 'itw')}
                    onDragLeave={() => !editingItw && onDragLeave()}
                    onDrop={() => !editingItw && onItwDrop(a.id)}
                    onClick={() => handleItwRowClick(a.id)}
                    className={rowClass}
                    style={{ cursor: editingItw ? 'default' : 'move' }}>
                  <td>{editingItw ? <input value={a.name} onChange={e => updateItwField(a.id, 'name', e.target.value)} /> : a.name}</td>
                  <td>{editingItw ? <input value={a.vorname} onChange={e => updateItwField(a.id, 'vorname', e.target.value)} /> : a.vorname}</td>
                  <td className={styles.center}>{selectedItwId === a.id ? '✓' : ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!editingItw ? (
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={() => (window as any).api.openAddItwWindow()}>Hinzufügen</button>
            <button onClick={startEditingItw} disabled={itws.length === 0}>Ändern</button>
            <button onClick={handleDeleteSelectedItw} disabled={selectedItwId == null}>Löschen</button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={saveEditingItw}>Speichern</button>
            <button onClick={cancelEditingItw}>Abbrechen</button>
          </div>
        )}
      </div>
      
      {/* Zeiträume Manager Dialog */}
      {showPeriodManager && selectedAzubiForPeriods && (
        <AzubiPeriodsManager 
          azubi={selectedAzubiForPeriods}
          onClose={() => {
            setShowPeriodManager(false);
            setSelectedAzubiForPeriods(null);
            loadAzubis(); // Daten neu laden nach Änderungen
          }}
        />
      )}
      
      {/* Globale Bottom-Buttons entfernt, da Aktionen nun unter jeder Tabelle stehen */}
    </div>
  );
};

export default PersonnelOverview;
