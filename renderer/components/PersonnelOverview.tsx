import React, { useState, useEffect, useCallback } from 'react';
import styles from './PersonnelOverview.module.css';
import ExcelImport from './ExcelImport';

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
}

interface Azubi { id: number; name: string; vorname: string; lehrjahr: number }
interface ItwDoctor { id: number; name: string; vorname: string }

const PersonnelOverview: React.FC = () => {
  const [personnel, setPersonnel] = useState<Person[]>([]);
  const [azubis, setAzubis] = useState<Azubi[]>([]);
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

  const loadPersonnel = useCallback(async () => {
    setLoading(true);
    const list = await (window as any).api.getPersonnelList();
    setPersonnel(list);
    setLoading(false);
  }, []);

  const loadAzubis = useCallback(async () => {
    const list = await (window as any).api.getAzubiList();
    setAzubis(list);
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
            <th style={{ width: 60 }} className={styles.center}>#</th>
          </tr>
        </thead>
        <tbody className={styles.tbody}>
          {personnel.map(person => {
            const selected = person.id === selectedPersonId;
            const isOver = dragContext === 'person' && dragOverId === person.id;
            const rowClass = [styles.row, selected ? styles.selected : '', isOver && dragPosition === 'above' ? styles.dropAbove : '', isOver && dragPosition === 'below' ? styles.dropBelow : ''].filter(Boolean).join(' ');
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
                style={{ cursor: editing ? 'default' : 'move' }}
              >
                <td>{editing ? <input value={person.name} onChange={e => updateField(person.id, 'name', e.target.value)} /> : person.name}</td>
                <td>{editing ? <input value={person.vorname} onChange={e => updateField(person.id, 'vorname', e.target.value)} /> : person.vorname}</td>
                <td>{editing ? <input type="number" className={styles.narrow} value={person.teilzeit} onChange={e => updateField(person.id, 'teilzeit', Number(e.target.value))} /> : person.teilzeit}</td>
                <td className={styles.checkboxCell}><input type="checkbox" disabled={!editing} checked={!!person.fahrzeugfuehrer} onChange={e => editing && updateField(person.id, 'fahrzeugfuehrer', e.target.checked)} /></td>
                <td className={styles.checkboxCell}><input type="checkbox" disabled={!editing} checked={!!person.fahrzeugfuehrerHLFB} onChange={e => editing && updateField(person.id, 'fahrzeugfuehrerHLFB', e.target.checked)} /></td>
                <td className={styles.checkboxCell}><input type="checkbox" disabled={!editing} checked={!!person.nef} onChange={e => editing && updateField(person.id, 'nef', e.target.checked)} /></td>
                <td className={styles.checkboxCell}><input type="checkbox" disabled={!editing} checked={!!person.itwMaschinist} onChange={e => editing && updateField(person.id, 'itwMaschinist', e.target.checked)} /></td>
                <td className={styles.checkboxCell}><input type="checkbox" disabled={!editing} checked={!!person.itwFahrzeugfuehrer} onChange={e => editing && updateField(person.id, 'itwFahrzeugfuehrer', e.target.checked)} /></td>
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
              <th className={styles.center} style={{ width: 60 }}>#</th>
            </tr>
          </thead>
          <tbody className={styles.tbody}>
            {azubis.map(a => {
              const isOver = dragContext === 'azubi' && dragOverId === a.id;
              const rowClass = [styles.row, selectedAzubiId === a.id ? styles.selected : '', isOver && dragPosition === 'above' ? styles.dropAbove : '', isOver && dragPosition === 'below' ? styles.dropBelow : ''].filter(Boolean).join(' ');
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
      {/* Globale Bottom-Buttons entfernt, da Aktionen nun unter jeder Tabelle stehen */}
    </div>
  );
};

export default PersonnelOverview;
