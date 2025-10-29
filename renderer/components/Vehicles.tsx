import React, { useEffect, useState, useCallback } from 'react';
import styles from './PersonnelOverview.module.css';

const Vehicles: React.FC = () => {
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [rtwVehicles, setRtwVehicles] = useState<{ id: number; name: string }[]>([]);
  const [nefVehicles, setNefVehicles] = useState<{ id: number; name: string; occupancy_mode?: '24h' | 'tag' }[]>([]);
  const [itwEnabled, setItwEnabled] = useState<boolean>(false);
  const [rtwActivations, setRtwActivations] = useState<Record<number, boolean[]>>({});
  const [nefActivations, setNefActivations] = useState<Record<number, boolean[]>>({});
  // Edit/Select/Drag State RTW
  const [editingRtw, setEditingRtw] = useState(false);
  const [selectedRtwId, setSelectedRtwId] = useState<number | null>(null);
  const [originalRtw, setOriginalRtw] = useState<{ id:number; name:string }[] | null>(null);
  const [draggedRtwId, setDraggedRtwId] = useState<number | null>(null);
  // Edit/Select/Drag State NEF
  const [editingNef, setEditingNef] = useState(false);
  const [selectedNefId, setSelectedNefId] = useState<number | null>(null);
  const [originalNef, setOriginalNef] = useState<{ id:number; name:string }[] | null>(null);
  const [draggedNefId, setDraggedNefId] = useState<number | null>(null);
  // Gemeinsame Drag-Over-Vorschau
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const [dragPosition, setDragPosition] = useState<'above'|'below'|null>(null);
  const [dragContext, setDragContext] = useState<'rtw'|'nef'|null>(null);

  // Jahr aus globalen Einstellungen übernehmen (beim Start und wenn Settings geändert werden)
  useEffect(() => {
    (async () => {
      try {
        const y = await (window as any).api.getSetting('year');
        setYear(Number(y || new Date().getFullYear()));
      } catch {}
      try {
        const itwVal = await (window as any).api.getSetting('itw');
        setItwEnabled(String(itwVal) === 'true');
      } catch {}
      try { setRtwVehicles(await (window as any).api.getRtwVehicles()); } catch {}
      try { setNefVehicles(await (window as any).api.getNefVehicles()); } catch {}
    })();
    const onSettingsUpdated = async () => {
      try {
        const y = await (window as any).api.getSetting('year');
        setYear(Number(y || new Date().getFullYear()));
      } catch {}
      try {
        const itwVal = await (window as any).api.getSetting('itw');
        setItwEnabled(String(itwVal) === 'true');
      } catch {}
      // Fahrzeuge ggf. neu laden (falls geändert)
      try { setRtwVehicles(await (window as any).api.getRtwVehicles()); } catch {}
      try { setNefVehicles(await (window as any).api.getNefVehicles()); } catch {}
    };
    (window as any).api?.onSettingsUpdated?.(onSettingsUpdated);
    return () => (window as any).api?.offSettingsUpdated?.(onSettingsUpdated);
  }, []);

  // Aktivierungen laden, wenn das Jahr gewechselt wurde
  useEffect(() => {
    (async () => {
      try {
        const acts = await (window as any).api.getRtwVehicleActivations(year);
        const map: Record<number, boolean[]> = {};
        (acts || []).forEach((r: any) => {
          map[r.vehicleId] = map[r.vehicleId] || Array(12).fill(true);
          map[r.vehicleId][Number(r.month)-1] = !!r.enabled;
        });
        setRtwActivations(map);
      } catch {}
      try {
        const acts = await (window as any).api.getNefVehicleActivations(year);
        const map: Record<number, boolean[]> = {};
        (acts || []).forEach((r: any) => {
          map[r.vehicleId] = map[r.vehicleId] || Array(12).fill(true);
          map[r.vehicleId][Number(r.month)-1] = !!r.enabled;
        });
        setNefActivations(map);
      } catch {}
    })();
  }, [year]);

  // --- Utils ---
  const reloadRtw = useCallback(async () => {
    try { setRtwVehicles(await (window as any).api.getRtwVehicles()); } catch {}
  }, []);
  const reloadNef = useCallback(async () => {
    try { setNefVehicles(await (window as any).api.getNefVehicles()); } catch {}
  }, []);

  // --- RTW Edit/Select/Save ---
  const startEditingRtw = () => { setOriginalRtw(JSON.parse(JSON.stringify(rtwVehicles))); setEditingRtw(true); };
  const cancelEditingRtw = () => { if (originalRtw) setRtwVehicles(originalRtw); setEditingRtw(false); };
  const saveEditingRtw = async () => {
    try {
      for (const v of rtwVehicles) {
        const orig = originalRtw?.find(o => o.id === v.id);
        if (!orig || orig.name !== v.name) {
          await (window as any).api.updateRtwVehicle({ id: v.id, name: v.name });
        }
      }
      setEditingRtw(false);
      setOriginalRtw(null);
      reloadRtw();
    } catch (e) { console.warn('[Vehicles] saveEditingRtw', e); }
  };
  const onRtwRowClick = (id:number) => setSelectedRtwId(prev => prev === id ? null : id);
  const handleDeleteSelectedRtw = async () => {
    if (selectedRtwId == null) return;
    await (window as any).api.deleteRtwVehicle(selectedRtwId);
    setSelectedRtwId(null);
    reloadRtw();
  };
  const updateRtwName = (id:number, name:string) => setRtwVehicles(prev => prev.map(v => v.id === id ? { ...v, name } : v));

  // --- NEF Edit/Select/Save ---
  const startEditingNef = () => { setOriginalNef(JSON.parse(JSON.stringify(nefVehicles))); setEditingNef(true); };
  const cancelEditingNef = () => { if (originalNef) setNefVehicles(originalNef); setEditingNef(false); };
  const saveEditingNef = async () => {
    try {
      for (const v of nefVehicles) {
        const orig = originalNef?.find(o => o.id === v.id);
        if (!orig || orig.name !== v.name) {
          await (window as any).api.updateNefVehicle({ id: v.id, name: v.name });
        }
      }
      setEditingNef(false);
      setOriginalNef(null);
      reloadNef();
    } catch (e) { console.warn('[Vehicles] saveEditingNef', e); }
  };
  const onNefRowClick = (id:number) => setSelectedNefId(prev => prev === id ? null : id);
  const handleDeleteSelectedNef = async () => {
    if (selectedNefId == null) return;
    await (window as any).api.deleteNefVehicle(selectedNefId);
    setSelectedNefId(null);
    reloadNef();
  };
  const updateNefName = (id:number, name:string) => setNefVehicles(prev => prev.map(v => v.id === id ? { ...v, name } : v));
  const updateNefOccupancy = async (id:number, mode: '24h'|'tag') => {
    setNefVehicles(prev => prev.map(v => v.id === id ? { ...v, occupancy_mode: mode } : v));
    try { await (window as any).api.setNefOccupancy?.(id, mode); } catch {}
  };

  // --- Drag & Drop ---
  const onDragOver = (e: React.DragEvent<HTMLTableRowElement>, overId: number, ctx:'rtw'|'nef') => {
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const pos = (e.clientY - rect.top) < rect.height / 2 ? 'above' : 'below';
    setDragOverId(overId); setDragPosition(pos); setDragContext(ctx);
  };
  const onDragLeave = () => { setDragOverId(null); setDragPosition(null); setDragContext(null); };
  const onRtwDragStart = (id:number) => setDraggedRtwId(id);
  const onRtwDrop = async (id:number) => {
    if (draggedRtwId == null || draggedRtwId === id) return;
    const oldIndex = rtwVehicles.findIndex(v => v.id === draggedRtwId);
    let newIndex = rtwVehicles.findIndex(v => v.id === id);
    if (dragPosition === 'below') newIndex += 1;
    const updated = [...rtwVehicles];
    const [removed] = updated.splice(oldIndex, 1);
    if (oldIndex < newIndex) newIndex -= 1;
    updated.splice(Math.max(0, Math.min(updated.length, newIndex)), 0, removed);
    setRtwVehicles(updated);
    setDraggedRtwId(null); setDragOverId(null); setDragPosition(null); setDragContext(null);
    await (window as any).api.updateRtwVehicleOrder(updated.map(v => v.id));
    reloadRtw();
  };
  const onNefDragStart = (id:number) => setDraggedNefId(id);
  const onNefDrop = async (id:number) => {
    if (draggedNefId == null || draggedNefId === id) return;
    const oldIndex = nefVehicles.findIndex(v => v.id === draggedNefId);
    let newIndex = nefVehicles.findIndex(v => v.id === id);
    if (dragPosition === 'below') newIndex += 1;
    const updated = [...nefVehicles];
    const [removed] = updated.splice(oldIndex, 1);
    if (oldIndex < newIndex) newIndex -= 1;
    updated.splice(Math.max(0, Math.min(updated.length, newIndex)), 0, removed);
    setNefVehicles(updated);
    setDraggedNefId(null); setDragOverId(null); setDragPosition(null); setDragContext(null);
    await (window as any).api.updateNefVehicleOrder(updated.map(v => v.id));
    reloadNef();
  };

  // --- Hinzufügen ---
  const addRtw = () => { (window as any).api.openAddRtwWindow(); };
  const addNef = () => { (window as any).api.openAddNefWindow(); };

  return (
    <div style={{ padding: 16 }}>
      <h2>Fahrzeuge</h2>
      {/* ITW-Option wandert in den Bereich Fahrzeugeinstellungen */}
      <div style={{ marginTop: 8, display: 'flex', gap: 16, alignItems: 'center' }}>
        <label>
          ITW:
          <input
            type="checkbox"
            checked={itwEnabled}
            onChange={async (e) => {
              const v = e.target.checked;
              setItwEnabled(v);
              try { await (window as any).api.setSetting('itw', String(v)); } catch {}
            }}
            style={{ marginLeft: 8 }}
          />
        </label>
      </div>

      <div style={{ marginTop: 16 }}>
        <h3>RTW Fahrzeuge</h3>
        <table className={styles.table}>
          <thead>
            <tr className={styles.thead}>
              <th>Bezeichnung</th>
              <th>Besetzung</th>
              {Array.from({ length: 12 }).map((_, i) => <th key={i} className={styles.narrow}>{i+1}</th>)}
              <th className={styles.center} style={{ width: 60 }}>#</th>
            </tr>
          </thead>
          <tbody className={styles.tbody}>
            {rtwVehicles.map(v => {
              const isOver = dragContext === 'rtw' && dragOverId === v.id;
              const rowClass = [styles.row, selectedRtwId === v.id ? styles.selected : '', isOver && dragPosition === 'above' ? styles.dropAbove : '', isOver && dragPosition === 'below' ? styles.dropBelow : ''].filter(Boolean).join(' ');
              return (
                <tr key={v.id}
                    draggable={!editingRtw}
                    onDragStart={() => !editingRtw && onRtwDragStart(v.id)}
                    onDragOver={(e) => !editingRtw && onDragOver(e, v.id, 'rtw')}
                    onDragLeave={() => !editingRtw && onDragLeave()}
                    onDrop={() => !editingRtw && onRtwDrop(v.id)}
                    onClick={() => onRtwRowClick(v.id)}
                    className={rowClass}
                    style={{ cursor: editingRtw ? 'default' : 'move' }}>
                  <td>{editingRtw ? <input value={v.name} onChange={e => updateRtwName(v.id, e.target.value)} /> : v.name}</td>
                  {Array.from({ length: 12 }).map((_, i) => (
                    <td key={i} className={styles.center}>
                      <input type="checkbox" disabled={!editingRtw} checked={(rtwActivations[v.id] ?? Array(12).fill(true))[i]}
                        onChange={async e => {
                          const enabled = e.target.checked;
                          setRtwActivations(prev => ({ ...prev, [v.id]: (() => { const arr = (prev[v.id] || Array(12).fill(true)).slice(); arr[i] = enabled; return arr; })() }));
                          await (window as any).api.setRtwVehicleActivation(v.id, year, i+1, enabled);
                        }} />
                    </td>
                  ))}
                  <td className={styles.center}>{selectedRtwId === v.id ? '✓' : ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!editingRtw ? (
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={addRtw}>Hinzufügen</button>
            <button onClick={startEditingRtw} disabled={rtwVehicles.length === 0}>Ändern</button>
            <button onClick={handleDeleteSelectedRtw} disabled={selectedRtwId == null}>Löschen</button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={saveEditingRtw}>Speichern</button>
            <button onClick={cancelEditingRtw}>Abbrechen</button>
          </div>
        )}
      </div>

      <div style={{ marginTop: 16 }}>
        <h3>NEF Fahrzeuge</h3>
        <table className={styles.table}>
          <thead>
            <tr className={styles.thead}>
              <th>Bezeichnung</th>
              {Array.from({ length: 12 }).map((_, i) => <th key={i} className={styles.narrow}>{i+1}</th>)}
              <th className={styles.center} style={{ width: 60 }}>#</th>
            </tr>
          </thead>
          <tbody className={styles.tbody}>
            {nefVehicles.map(v => {
              const isOver = dragContext === 'nef' && dragOverId === v.id;
              const rowClass = [styles.row, selectedNefId === v.id ? styles.selected : '', isOver && dragPosition === 'above' ? styles.dropAbove : '', isOver && dragPosition === 'below' ? styles.dropBelow : ''].filter(Boolean).join(' ');
              return (
                <tr key={v.id}
                    draggable={!editingNef}
                    onDragStart={() => !editingNef && onNefDragStart(v.id)}
                    onDragOver={(e) => !editingNef && onDragOver(e, v.id, 'nef')}
                    onDragLeave={() => !editingNef && onDragLeave()}
                    onDrop={() => !editingNef && onNefDrop(v.id)}
                    onClick={() => onNefRowClick(v.id)}
                    className={rowClass}
                    style={{ cursor: editingNef ? 'default' : 'move' }}>
                  <td>{editingNef ? <input value={v.name} onChange={e => updateNefName(v.id, e.target.value)} /> : v.name}</td>
                  <td className={styles.center}>
                    <select disabled={!editingNef} value={v.occupancy_mode || '24h'} onChange={e => updateNefOccupancy(v.id, (e.target.value === 'tag' ? 'tag' : '24h'))}>
                      <option value="24h">24h besetzt</option>
                      <option value="tag">Tagsüber besetzt</option>
                    </select>
                  </td>
                  {Array.from({ length: 12 }).map((_, i) => (
                    <td key={i} className={styles.center}>
                      <input type="checkbox" disabled={!editingNef} checked={(nefActivations[v.id] ?? Array(12).fill(true))[i]}
                        onChange={async e => {
                          const enabled = e.target.checked;
                          setNefActivations(prev => ({ ...prev, [v.id]: (() => { const arr = (prev[v.id] || Array(12).fill(true)).slice(); arr[i] = enabled; return arr; })() }));
                          await (window as any).api.setNefVehicleActivation(v.id, year, i+1, enabled);
                        }} />
                    </td>
                  ))}
                  <td className={styles.center}>{selectedNefId === v.id ? '✓' : ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!editingNef ? (
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={addNef}>Hinzufügen</button>
            <button onClick={startEditingNef} disabled={nefVehicles.length === 0}>Ändern</button>
            <button onClick={handleDeleteSelectedNef} disabled={selectedNefId == null}>Löschen</button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={saveEditingNef}>Speichern</button>
            <button onClick={cancelEditingNef}>Abbrechen</button>
          </div>
        )}
      </div>
      {/* Schließen-Button entfernt: Seite läuft im Hauptfenster */}
    </div>
  );
};

export default Vehicles;
