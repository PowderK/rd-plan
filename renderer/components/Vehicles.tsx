import React, { useEffect, useState, useCallback } from 'react';
import styles from './PersonnelOverview.module.css';
import { VehiclePeriodList } from './VehiclePeriodEditor';
import { VehiclePositionEditor } from './VehiclePositionEditor';

const Vehicles: React.FC = () => {
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [activeTab, setActiveTab] = useState<'rtw' | 'nef' | 'itw'>('rtw');
  const [rtwVehicles, setRtwVehicles] = useState<{ id: number; name: string }[]>([]);
  const [nefVehicles, setNefVehicles] = useState<{ id: number; name: string; occupancy_mode?: '24h' | 'tag' }[]>([]);
  const [itwVehicles, setItwVehicles] = useState<{ id: number; name: string }[]>([]);
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
  // Edit/Select/Drag State ITW
  const [editingItw, setEditingItw] = useState(false);
  const [selectedItwId, setSelectedItwId] = useState<number | null>(null);
  const [originalItw, setOriginalItw] = useState<{ id:number; name:string }[] | null>(null);
  const [draggedItwId, setDraggedItwId] = useState<number | null>(null);
  // Gemeinsame Drag-Over-Vorschau
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const [dragPosition, setDragPosition] = useState<'above'|'below'|null>(null);
  const [dragContext, setDragContext] = useState<'rtw'|'nef'|'itw'|null>(null);
  // Period Editor State
  const [showRtwPeriodEditor, setShowRtwPeriodEditor] = useState<{ vehicleId: number; name: string } | null>(null);
  const [showNefPeriodEditor, setShowNefPeriodEditor] = useState<{ vehicleId: number; name: string } | null>(null);
  const [showItwPeriodEditor, setShowItwPeriodEditor] = useState<{ vehicleId: number; name: string } | null>(null);
  // Position Editor State
  const [showRtwPositionEditor, setShowRtwPositionEditor] = useState<{ vehicleId: number; name: string } | null>(null);
  const [showNefPositionEditor, setShowNefPositionEditor] = useState<{ vehicleId: number; name: string } | null>(null);
  const [showItwPositionEditor, setShowItwPositionEditor] = useState<{ vehicleId: number; name: string } | null>(null);

  // Jahr aus globalen Einstellungen übernehmen (beim Start und wenn Settings geändert werden)
  useEffect(() => {
    (async () => {
      try {
        const y = await (window as any).api.getSetting('year');
        setYear(Number(y || new Date().getFullYear()));
      } catch {}
      try { setRtwVehicles(await (window as any).api.getRtwVehicles()); } catch {}
      try { setNefVehicles(await (window as any).api.getNefVehicles()); } catch {}
      try { setItwVehicles(await (window as any).api.getItwVehicles()); } catch {}
    })();
    const onSettingsUpdated = async () => {
      try {
        const y = await (window as any).api.getSetting('year');
        setYear(Number(y || new Date().getFullYear()));
      } catch {}
      // Fahrzeuge ggf. neu laden (falls geändert)
      try { setRtwVehicles(await (window as any).api.getRtwVehicles()); } catch {}
      try { setNefVehicles(await (window as any).api.getNefVehicles()); } catch {}
      try { setItwVehicles(await (window as any).api.getItwVehicles()); } catch {}
    };
    (window as any).api?.onSettingsUpdated?.(onSettingsUpdated);
    return () => (window as any).api?.offSettingsUpdated?.(onSettingsUpdated);
  }, []);

  // Listen for messages from popups (e.g. add vehicle windows)
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.data === 'settings-updated' || event.data === 'vehicles-updated') {
        try { setRtwVehicles(await (window as any).api.getRtwVehicles()); } catch {}
        try { setNefVehicles(await (window as any).api.getNefVehicles()); } catch {}
        try { setItwVehicles(await (window as any).api.getItwVehicles()); } catch {}
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Listen for vehicles-updated IPC event
  useEffect(() => {
    const onVehiclesUpdated = async () => {
      try { setRtwVehicles(await (window as any).api.getRtwVehicles()); } catch {}
      try { setNefVehicles(await (window as any).api.getNefVehicles()); } catch {}
      try { setItwVehicles(await (window as any).api.getItwVehicles()); } catch {}
    };
    (window as any).api?.onVehiclesUpdated?.(onVehiclesUpdated);
    return () => (window as any).api?.offVehiclesUpdated?.(onVehiclesUpdated);
  }, []);

  // --- Utils ---
  const reloadRtw = useCallback(async () => {
    try { setRtwVehicles(await (window as any).api.getRtwVehicles()); } catch {}
  }, []);
  const reloadNef = useCallback(async () => {
    try { setNefVehicles(await (window as any).api.getNefVehicles()); } catch {}
  }, []);
  const reloadItw = useCallback(async () => {
    try { setItwVehicles(await (window as any).api.getItwVehicles()); } catch {}
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
    const vehicle = rtwVehicles.find(v => v.id === selectedRtwId);
    if (!vehicle) return;
    
    if (!confirm(`Möchten Sie das RTW-Fahrzeug "${vehicle.name}" wirklich löschen?\n\nAlle zugehörigen Zeiträume und Positionen werden ebenfalls gelöscht.`)) {
      return;
    }
    
    try {
      await (window as any).api.deleteRtwVehicle(selectedRtwId);
      setSelectedRtwId(null);
      reloadRtw();
    } catch (error) {
      alert(`Fehler beim Löschen: ${error}`);
    }
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
    const vehicle = nefVehicles.find(v => v.id === selectedNefId);
    if (!vehicle) return;
    
    if (!confirm(`Möchten Sie das NEF-Fahrzeug "${vehicle.name}" wirklich löschen?\n\nAlle zugehörigen Zeiträume und Positionen werden ebenfalls gelöscht.`)) {
      return;
    }
    
    try {
      await (window as any).api.deleteNefVehicle(selectedNefId);
      setSelectedNefId(null);
      reloadNef();
    } catch (error) {
      alert(`Fehler beim Löschen: ${error}`);
    }
  };
  const updateNefName = (id:number, name:string) => setNefVehicles(prev => prev.map(v => v.id === id ? { ...v, name } : v));
  const updateNefOccupancy = async (id:number, mode: '24h'|'tag') => {
    setNefVehicles(prev => prev.map(v => v.id === id ? { ...v, occupancy_mode: mode } : v));
    try { await (window as any).api.setNefOccupancy?.(id, mode); } catch {}
  };

  // --- ITW Edit/Select/Save ---
  const startEditingItw = () => { setOriginalItw(JSON.parse(JSON.stringify(itwVehicles))); setEditingItw(true); };
  const cancelEditingItw = () => { if (originalItw) setItwVehicles(originalItw); setEditingItw(false); };
  const saveEditingItw = async () => {
    try {
      for (const v of itwVehicles) {
        const orig = originalItw?.find(o => o.id === v.id);
        if (!orig || orig.name !== v.name) {
          await (window as any).api.updateItwVehicle({ id: v.id, name: v.name });
        }
      }
      setEditingItw(false);
      setOriginalItw(null);
      reloadItw();
    } catch (e) { console.warn('[Vehicles] saveEditingItw', e); }
  };
  const onItwRowClick = (id:number) => setSelectedItwId(prev => prev === id ? null : id);
  const handleDeleteSelectedItw = async () => {
    if (selectedItwId == null) return;
    const vehicle = itwVehicles.find(v => v.id === selectedItwId);
    if (!vehicle) return;
    
    if (!confirm(`Möchten Sie das ITW-Fahrzeug "${vehicle.name}" wirklich löschen?\n\nAlle zugehörigen Zeiträume und Positionen werden ebenfalls gelöscht.`)) {
      return;
    }
    
    try {
      await (window as any).api.deleteItwVehicle(selectedItwId);
      setSelectedItwId(null);
      reloadItw();
    } catch (error) {
      alert(`Fehler beim Löschen: ${error}`);
    }
  };
  const updateItwName = (id:number, name:string) => setItwVehicles(prev => prev.map(v => v.id === id ? { ...v, name } : v));

  // --- Drag & Drop ---
  const onDragOver = (e: React.DragEvent<HTMLTableRowElement>, overId: number, ctx:'rtw'|'nef'|'itw') => {
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
  const onItwDragStart = (id:number) => setDraggedItwId(id);
  const onItwDrop = async (id:number) => {
    if (draggedItwId == null || draggedItwId === id) return;
    const oldIndex = itwVehicles.findIndex(v => v.id === draggedItwId);
    let newIndex = itwVehicles.findIndex(v => v.id === id);
    if (dragPosition === 'below') newIndex += 1;
    const updated = [...itwVehicles];
    const [removed] = updated.splice(oldIndex, 1);
    if (oldIndex < newIndex) newIndex -= 1;
    updated.splice(Math.max(0, Math.min(updated.length, newIndex)), 0, removed);
    setItwVehicles(updated);
    setDraggedItwId(null); setDragOverId(null); setDragPosition(null); setDragContext(null);
    await (window as any).api.updateItwVehicleOrder(updated.map(v => v.id));
    reloadItw();
  };

  // --- Hinzufügen ---
  const addRtw = () => { (window as any).api.openAddRtwWindow(); };
  const addNef = () => { (window as any).api.openAddNefWindow(); };
  const addItw = () => { (window as any).api.openAddItwVehicleWindow(); };

  return (
    <div style={{ 
      paddingRight: 24,
      paddingLeft: 24,
      paddingTop: 0,
      paddingBottom: 24
    }}>
      {/* Überschrift - ROT */}
      <h2 style={{ 
        marginTop: 0, 
        marginBottom: 0,
        position: 'sticky',
        top: 0,
        background: 'var(--bg)',
        zIndex: 101,
        paddingTop: 8,
        paddingBottom: 8
      }}>Fahrzeuge</h2>

      {/* Tab Navigation - GRÜN */}
      <div style={{ 
        display: 'flex', 
        gap: 4, 
        marginTop: 0, 
        borderBottom: '2px solid #dee2e6',
        marginBottom: 0,
        position: 'sticky',
        top: 52,
        background: 'var(--bg)',
        zIndex: 100,
        paddingTop: 0,
        paddingBottom: 0
      }}>
        <button
          onClick={() => setActiveTab('rtw')}
          style={{
            padding: '8px 16px',
            border: 'none',
            borderBottom: activeTab === 'rtw' ? '3px solid #dc3545' : '3px solid transparent',
            background: activeTab === 'rtw' ? '#f8f9fa' : 'transparent',
            fontWeight: activeTab === 'rtw' ? 600 : 400,
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          RTW
        </button>
        <button
          onClick={() => setActiveTab('nef')}
          style={{
            padding: '8px 16px',
            border: 'none',
            borderBottom: activeTab === 'nef' ? '3px solid #dc3545' : '3px solid transparent',
            background: activeTab === 'nef' ? '#f8f9fa' : 'transparent',
            fontWeight: activeTab === 'nef' ? 600 : 400,
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          NEF
        </button>
        <button
          onClick={() => setActiveTab('itw')}
          style={{
            padding: '8px 16px',
            border: 'none',
            borderBottom: activeTab === 'itw' ? '3px solid #ffc107' : '3px solid transparent',
            background: activeTab === 'itw' ? '#f8f9fa' : 'transparent',
            fontWeight: activeTab === 'itw' ? 600 : 400,
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          ITW
        </button>
      </div>

      {/* Content - GRAU */}
      <div style={{ paddingTop: 16 }}>

      {/* RTW Tab */}
      {activeTab === 'rtw' && (
      <div>
        <h3>RTW Fahrzeuge</h3>
        <table className={styles.table}>
          <thead>
            <tr className={styles.thead}>
              <th>Bezeichnung</th>
              <th className={styles.center} style={{ width: 150 }}>Positionen</th>
              <th className={styles.center} style={{ width: 150 }}>Einsatzzeiträume</th>
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
                  <td className={styles.center}>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowRtwPositionEditor({ vehicleId: v.id, name: v.name });
                      }}
                      style={{
                        background: '#28a745',
                        color: 'white',
                        border: 'none',
                        padding: '4px 12px',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      Positionen
                    </button>
                  </td>
                  <td className={styles.center}>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowRtwPeriodEditor({ vehicleId: v.id, name: v.name });
                      }}
                      style={{
                        background: '#007bff',
                        color: 'white',
                        border: 'none',
                        padding: '4px 12px',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      Zeiträume
                    </button>
                  </td>
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
            <button 
              onClick={handleDeleteSelectedRtw} 
              disabled={selectedRtwId == null}
              style={{
                background: selectedRtwId != null ? '#dc3545' : '#6c757d',
                color: 'white',
                cursor: selectedRtwId != null ? 'pointer' : 'not-allowed'
              }}
            >
              Löschen
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={saveEditingRtw}>Speichern</button>
            <button onClick={cancelEditingRtw}>Abbrechen</button>
          </div>
        )}
      </div>
      )}

      {/* NEF Tab */}
      {activeTab === 'nef' && (
      <div style={{ marginTop: 16 }}>
        <h3>NEF Fahrzeuge</h3>
        <table className={styles.table}>
          <thead>
            <tr className={styles.thead}>
              <th>Bezeichnung</th>
              <th>Besetzung</th>
              <th className={styles.center} style={{ width: 150 }}>Positionen</th>
              <th className={styles.center} style={{ width: 150 }}>Einsatzzeiträume</th>
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
                  <td className={styles.center}>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowNefPositionEditor({ vehicleId: v.id, name: v.name });
                      }}
                      style={{
                        background: '#28a745',
                        color: 'white',
                        border: 'none',
                        padding: '4px 12px',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      Positionen
                    </button>
                  </td>
                  <td className={styles.center}>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowNefPeriodEditor({ vehicleId: v.id, name: v.name });
                      }}
                      style={{
                        background: '#007bff',
                        color: 'white',
                        border: 'none',
                        padding: '4px 12px',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      Zeiträume
                    </button>
                  </td>
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
            <button 
              onClick={handleDeleteSelectedNef} 
              disabled={selectedNefId == null}
              style={{
                background: selectedNefId != null ? '#dc3545' : '#6c757d',
                color: 'white',
                cursor: selectedNefId != null ? 'pointer' : 'not-allowed'
              }}
            >
              Löschen
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={saveEditingNef}>Speichern</button>
            <button onClick={cancelEditingNef}>Abbrechen</button>
          </div>
        )}
      </div>
      )}

      {/* ITW Tab */}
      {activeTab === 'itw' && (
      <div style={{ marginTop: 16 }}>
        <h3>ITW Fahrzeuge</h3>
        <table className={styles.table}>
          <thead>
            <tr className={styles.thead}>
              <th>Bezeichnung</th>
              <th className={styles.center} style={{ width: 150 }}>Positionen</th>
              <th className={styles.center} style={{ width: 150 }}>Einsatzzeiträume</th>
              <th className={styles.center} style={{ width: 60 }}>#</th>
            </tr>
          </thead>
          <tbody className={styles.tbody}>
            {itwVehicles.map(v => {
              const isOver = dragContext === 'itw' && dragOverId === v.id;
              const rowClass = [styles.row, selectedItwId === v.id ? styles.selected : '', isOver && dragPosition === 'above' ? styles.dropAbove : '', isOver && dragPosition === 'below' ? styles.dropBelow : ''].filter(Boolean).join(' ');
              return (
                <tr key={v.id}
                    draggable={!editingItw}
                    onDragStart={() => !editingItw && onItwDragStart(v.id)}
                    onDragOver={(e) => !editingItw && onDragOver(e, v.id, 'itw')}
                    onDragLeave={() => !editingItw && onDragLeave()}
                    onDrop={() => !editingItw && onItwDrop(v.id)}
                    onClick={() => onItwRowClick(v.id)}
                    className={rowClass}
                    style={{ cursor: editingItw ? 'default' : 'move' }}>
                  <td>{editingItw ? <input value={v.name} onChange={e => updateItwName(v.id, e.target.value)} /> : v.name}</td>
                  <td className={styles.center}>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowItwPositionEditor({ vehicleId: v.id, name: v.name });
                      }}
                      style={{
                        background: '#28a745',
                        color: 'white',
                        border: 'none',
                        padding: '4px 12px',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      Positionen
                    </button>
                  </td>
                  <td className={styles.center}>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowItwPeriodEditor({ vehicleId: v.id, name: v.name });
                      }}
                      style={{
                        background: '#007bff',
                        color: 'white',
                        border: 'none',
                        padding: '4px 12px',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      Zeiträume
                    </button>
                  </td>
                  <td className={styles.center}>{selectedItwId === v.id ? '✓' : ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!editingItw ? (
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={addItw}>Hinzufügen</button>
            <button onClick={startEditingItw} disabled={itwVehicles.length === 0}>Ändern</button>
            <button 
              onClick={handleDeleteSelectedItw} 
              disabled={selectedItwId == null}
              style={{
                background: selectedItwId != null ? '#dc3545' : '#6c757d',
                color: 'white',
                cursor: selectedItwId != null ? 'pointer' : 'not-allowed'
              }}
            >
              Löschen
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={saveEditingItw}>Speichern</button>
            <button onClick={cancelEditingItw}>Abbrechen</button>
          </div>
        )}
      </div>
      )}

      {/* Schließen-Button entfernt: Seite läuft im Hauptfenster */}

      {/* RTW Period Editor */}
      {showRtwPeriodEditor && (
        <VehiclePeriodList
          vehicleId={showRtwPeriodEditor.vehicleId}
          vehicleName={showRtwPeriodEditor.name}
          vehicleType="rtw"
          onClose={() => setShowRtwPeriodEditor(null)}
        />
      )}

      {/* NEF Period Editor */}
      {showNefPeriodEditor && (
        <VehiclePeriodList
          vehicleId={showNefPeriodEditor.vehicleId}
          vehicleName={showNefPeriodEditor.name}
          vehicleType="nef"
          onClose={() => setShowNefPeriodEditor(null)}
        />
      )}

      {/* ITW Period Editor */}
      {showItwPeriodEditor && (
        <VehiclePeriodList
          vehicleId={showItwPeriodEditor.vehicleId}
          vehicleName={showItwPeriodEditor.name}
          vehicleType="itw"
          onClose={() => setShowItwPeriodEditor(null)}
        />
      )}

      {/* RTW Position Editor */}
      {showRtwPositionEditor && (
        <VehiclePositionEditor
          vehicleId={showRtwPositionEditor.vehicleId}
          vehicleName={showRtwPositionEditor.name}
          vehicleType="rtw"
          onClose={() => setShowRtwPositionEditor(null)}
        />
      )}

      {/* NEF Position Editor */}
      {showNefPositionEditor && (
        <VehiclePositionEditor
          vehicleId={showNefPositionEditor.vehicleId}
          vehicleName={showNefPositionEditor.name}
          vehicleType="nef"
          onClose={() => setShowNefPositionEditor(null)}
        />
      )}

      {/* ITW Position Editor */}
      {showItwPositionEditor && (
        <VehiclePositionEditor
          vehicleId={showItwPositionEditor.vehicleId}
          vehicleName={showItwPositionEditor.name}
          vehicleType="itw"
          onClose={() => setShowItwPositionEditor(null)}
        />
      )}
      </div>
      {/* Ende Content */}
    </div>
  );
};

export default Vehicles;
