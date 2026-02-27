import React, { useEffect, useState, useCallback } from 'react';
import styles from './PersonnelOverview.module.css';
import { VehiclePeriodList } from './VehiclePeriodEditor';
import { VehiclePositionEditor } from './VehiclePositionEditor';

interface VehiclesProps {
  setFooterActions?: (actions: React.ReactNode) => void;
}

const VehicleConfigDialog: React.FC<{
  vehicleId: number;
  vehicleName: string;
  vehicleType: 'rtw' | 'nef' | 'itw';
  occupancyMode?: '24h' | 'tag';
  initialTab: 'stammdaten' | 'positionen' | 'zeitraeume';
  onSave: (data: { name: string; occupancyMode?: '24h' | 'tag' }) => Promise<void>;
  onDelete: () => Promise<void>;
  onClose: () => void;
}> = ({ vehicleId, vehicleName, vehicleType, occupancyMode, initialTab, onSave, onDelete, onClose }) => {
  const [activeTab, setActiveTab] = useState<'stammdaten' | 'positionen' | 'zeitraeume'>(initialTab);
  const [name, setName] = useState(vehicleName);
  const [nefOccupancyMode, setNefOccupancyMode] = useState<'24h' | 'tag'>(occupancyMode || '24h');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [contextSaving, setContextSaving] = useState(false);
  const [contextCanSave, setContextCanSave] = useState(false);
  const [contextSaveHandler, setContextSaveHandler] = useState<(() => Promise<void>) | null>(null);

  useEffect(() => {
    setName(vehicleName);
    setNefOccupancyMode(occupancyMode || '24h');
  }, [vehicleName, occupancyMode]);

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Bitte eine Bezeichnung eingeben.');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        occupancyMode: vehicleType === 'nef' ? nefOccupancyMode : undefined
      });
      onClose();
    } catch (error) {
      alert(`Fehler beim Speichern: ${error}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const label = vehicleType.toUpperCase();
    if (!confirm(`Möchten Sie das ${label}-Fahrzeug "${name}" wirklich löschen?\n\nAlle zugehörigen Zeiträume und Positionen werden ebenfalls gelöscht.`)) {
      return;
    }

    setDeleting(true);
    try {
      await onDelete();
      onClose();
    } catch (error) {
      alert(`Fehler beim Löschen: ${error}`);
    } finally {
      setDeleting(false);
    }
  };

  const handleContextSave = async () => {
    if (!contextCanSave || !contextSaveHandler) return;
    setContextSaving(true);
    try {
      await contextSaveHandler();
    } catch (error) {
      alert(`Fehler beim Speichern: ${error}`);
    } finally {
      setContextSaving(false);
    }
  };

  useEffect(() => {
    setContextCanSave(false);
    setContextSaveHandler(null);
  }, [activeTab]);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          padding: 24,
          borderRadius: 8,
          width: 'min(620px, 96vw)',
          height: 'min(520px, 90vh)',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0, marginBottom: 12, flexShrink: 0 }}>
          Fahrzeug verwalten: {vehicleName} ({vehicleType.toUpperCase()})
        </h2>

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
              onClick={() => setActiveTab('positionen')}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderBottom: activeTab === 'positionen' ? '3px solid #0d6efd' : '3px solid transparent',
                background: activeTab === 'positionen' ? '#f8f9fa' : 'transparent',
                fontWeight: activeTab === 'positionen' ? 600 : 400,
                cursor: 'pointer'
              }}
            >
              Positionen
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
            <div style={{ display: 'grid', gap: 12 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span>Bezeichnung</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>

              {vehicleType === 'nef' && (
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span>Besetzung</span>
                  <select
                    value={nefOccupancyMode}
                    onChange={(e) => setNefOccupancyMode(e.target.value === 'tag' ? 'tag' : '24h')}
                  >
                    <option value="24h">24h besetzt</option>
                    <option value="tag">Tag</option>
                  </select>
                </label>
              )}
            </div>
          )}

          {activeTab === 'positionen' && (
            <VehiclePositionEditor
              vehicleId={vehicleId}
              vehicleName={vehicleName}
              vehicleType={vehicleType}
              embedded
              externalSaveControls
              onEmbeddedSaveStateChange={(canSave, saveHandler) => {
                setContextCanSave(canSave);
                setContextSaveHandler(() => saveHandler);
              }}
              onClose={() => {}}
            />
          )}

          {activeTab === 'zeitraeume' && (
            <VehiclePeriodList
              vehicleId={vehicleId}
              vehicleName={vehicleName}
              vehicleType={vehicleType}
              embedded
              externalSaveControls
              onEmbeddedSaveStateChange={(canSave, saveHandler) => {
                setContextCanSave(canSave);
                setContextSaveHandler(() => saveHandler);
              }}
              onClose={() => {}}
            />
          )}
        </div>

        <div style={{
          borderTop: '1px solid #eee',
          paddingTop: 12,
          paddingBottom: 12,
          background: 'var(--bg)',
          display: 'flex',
          justifyContent: 'space-between',
          flexShrink: 0
        }}>
          <button
            onClick={handleDelete}
            disabled={deleting || saving || contextSaving}
            style={{
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              padding: '8px 12px',
              borderRadius: '4px',
              cursor: deleting || saving || contextSaving ? 'not-allowed' : 'pointer'
            }}
          >
            {deleting ? 'Löschen ...' : 'Löschen'}
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} disabled={deleting || saving || contextSaving}>Schließen</button>
            <button
              onClick={activeTab === 'stammdaten' ? handleSave : handleContextSave}
              disabled={
                deleting ||
                saving ||
                contextSaving ||
                (activeTab !== 'stammdaten' && !contextCanSave)
              }
            >
              {saving || contextSaving ? 'Speichern ...' : 'Speichern'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const Vehicles: React.FC<VehiclesProps> = ({ setFooterActions }) => {
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [activeTab, setActiveTab] = useState<'rtw' | 'nef' | 'itw'>('rtw');
  const [itwEnabled, setItwEnabled] = useState<boolean>(false);
  const [rtwVehicles, setRtwVehicles] = useState<{ id: number; name: string }[]>([]);
  const [nefVehicles, setNefVehicles] = useState<{ id: number; name: string; occupancy_mode?: '24h' | 'tag' }[]>([]);
  const [itwVehicles, setItwVehicles] = useState<{ id: number; name: string }[]>([]);
  // Drag State RTW
  const [draggedRtwId, setDraggedRtwId] = useState<number | null>(null);
  // Drag State NEF
  const [draggedNefId, setDraggedNefId] = useState<number | null>(null);
  // Drag State ITW
  const [draggedItwId, setDraggedItwId] = useState<number | null>(null);
  // Gemeinsame Drag-Over-Vorschau
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const [dragPosition, setDragPosition] = useState<'above'|'below'|null>(null);
  const [dragContext, setDragContext] = useState<'rtw'|'nef'|'itw'|null>(null);
  const [vehicleConfigDialog, setVehicleConfigDialog] = useState<{
    vehicleId: number;
    name: string;
    vehicleType: 'rtw' | 'nef' | 'itw';
    occupancyMode?: '24h' | 'tag';
    initialTab: 'stammdaten' | 'positionen' | 'zeitraeume';
  } | null>(null);

  const loadItwEnabled = useCallback(async () => {
    try {
      const itwVal = await (window as any).api.getSetting('itw');
      const enabled = itwVal === 'true' || itwVal === '1';
      setItwEnabled(enabled);
      if (!enabled) {
        setActiveTab(prev => prev === 'itw' ? 'rtw' : prev);
      }
    } catch {}
  }, []);

  // Jahr aus globalen Einstellungen übernehmen (beim Start und wenn Settings geändert werden)
  useEffect(() => {
    (async () => {
      try {
        const y = await (window as any).api.getSetting('year');
        setYear(Number(y || new Date().getFullYear()));
      } catch {}
      await loadItwEnabled();
      try { setRtwVehicles(await (window as any).api.getRtwVehicles()); } catch {}
      try { setNefVehicles(await (window as any).api.getNefVehicles()); } catch {}
      try { setItwVehicles(await (window as any).api.getItwVehicles()); } catch {}
    })();
    const onSettingsUpdated = async () => {
      try {
        const y = await (window as any).api.getSetting('year');
        setYear(Number(y || new Date().getFullYear()));
      } catch {}
      await loadItwEnabled();
      // Fahrzeuge ggf. neu laden (falls geändert)
      try { setRtwVehicles(await (window as any).api.getRtwVehicles()); } catch {}
      try { setNefVehicles(await (window as any).api.getNefVehicles()); } catch {}
      try { setItwVehicles(await (window as any).api.getItwVehicles()); } catch {}
    };
    (window as any).api?.onSettingsUpdated?.(onSettingsUpdated);
    return () => (window as any).api?.offSettingsUpdated?.(onSettingsUpdated);
  }, [loadItwEnabled]);

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

  const handleSaveVehicleFromDialog = useCallback(async (
    vehicleId: number,
    vehicleType: 'rtw' | 'nef' | 'itw',
    data: { name: string; occupancyMode?: '24h' | 'tag' }
  ) => {
    if (vehicleType === 'rtw') {
      await (window as any).api.updateRtwVehicle({ id: vehicleId, name: data.name });
      await reloadRtw();
      return;
    }

    if (vehicleType === 'nef') {
      await (window as any).api.updateNefVehicle({ id: vehicleId, name: data.name });
      if (data.occupancyMode) {
        await (window as any).api.setNefOccupancy?.(vehicleId, data.occupancyMode);
      }
      await reloadNef();
      return;
    }

    await (window as any).api.updateItwVehicle({ id: vehicleId, name: data.name });
    await reloadItw();
  }, [reloadRtw, reloadNef, reloadItw]);

  const handleDeleteVehicleFromDialog = useCallback(async (vehicleId: number, vehicleType: 'rtw' | 'nef' | 'itw') => {
    if (vehicleType === 'rtw') {
      await (window as any).api.deleteRtwVehicle(vehicleId);
      await reloadRtw();
      return;
    }

    if (vehicleType === 'nef') {
      await (window as any).api.deleteNefVehicle(vehicleId);
      await reloadNef();
      return;
    }

    await (window as any).api.deleteItwVehicle(vehicleId);
    await reloadItw();
  }, [reloadRtw, reloadNef, reloadItw]);

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

  const handleFooterAdd = useCallback(() => {
    if (activeTab === 'nef') {
      addNef();
      return;
    }
    if (activeTab === 'itw') {
      addItw();
      return;
    }
    addRtw();
  }, [activeTab]);

  useEffect(() => {
    if (!setFooterActions) return;
    setFooterActions(
      <button onClick={handleFooterAdd}>
        Hinzufügen
      </button>
    );
    return () => setFooterActions(null);
  }, [setFooterActions, handleFooterAdd]);

  return (
    <div className="page-container">
      <div className="sticky-header-container">
        <h2 className="page-header">Fahrzeuge</h2>
        {/* Tab Navigation - GRÜN */}
        <div className="tab-navigation" style={{ paddingTop: 0, paddingBottom: 0 }}>
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
        {itwEnabled && (
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
        )}
        </div>
      </div>

      {/* Content - GRAU */}
      <div style={{ paddingTop: 16 }}>

      {/* RTW Tab */}
      {activeTab === 'rtw' && (
      <div>
        <table className={styles.table}>
          <thead>
            <tr className={styles.thead}>
              <th>Bezeichnung</th>
              <th className={styles.center} style={{ width: 100 }}>Aktionen</th>
            </tr>
          </thead>
          <tbody className={styles.tbody}>
            {rtwVehicles.map(v => {
              const isOver = dragContext === 'rtw' && dragOverId === v.id;
              const rowClass = [styles.row, isOver && dragPosition === 'above' ? styles.dropAbove : '', isOver && dragPosition === 'below' ? styles.dropBelow : ''].filter(Boolean).join(' ');
              return (
                <tr key={v.id}
                    draggable={true}
                    onDragStart={() => onRtwDragStart(v.id)}
                    onDragOver={(e) => onDragOver(e, v.id, 'rtw')}
                    onDragLeave={() => onDragLeave()}
                    onDrop={() => onRtwDrop(v.id)}
                    className={rowClass}
                    style={{ cursor: 'move' }}>
                  <td>{v.name}</td>
                  <td className={styles.center}>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setVehicleConfigDialog({ vehicleId: v.id, name: v.name, vehicleType: 'rtw', initialTab: 'stammdaten' });
                      }}
                      style={{
                        background: '#007bff',
                        color: 'white',
                        border: 'none',
                        padding: '4px 8px',
                        borderRadius: '3px',
                        cursor: 'pointer',
                        fontSize: '11px'
                      }}
                      title="Fahrzeug bearbeiten"
                    >
                      ✏️
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!setFooterActions && (
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={addRtw}>Hinzufügen</button>
          </div>
        )}
      </div>
      )}

      {/* NEF Tab */}
      {activeTab === 'nef' && (
      <div>
        <table className={styles.table}>
          <thead>
            <tr className={styles.thead}>
              <th>Bezeichnung</th>
              <th>Besetzung</th>
              <th className={styles.center} style={{ width: 100 }}>Aktionen</th>
            </tr>
          </thead>
          <tbody className={styles.tbody}>
            {nefVehicles.map(v => {
              const isOver = dragContext === 'nef' && dragOverId === v.id;
              const rowClass = [styles.row, isOver && dragPosition === 'above' ? styles.dropAbove : '', isOver && dragPosition === 'below' ? styles.dropBelow : ''].filter(Boolean).join(' ');
              return (
                <tr key={v.id}
                    draggable={true}
                    onDragStart={() => onNefDragStart(v.id)}
                    onDragOver={(e) => onDragOver(e, v.id, 'nef')}
                    onDragLeave={() => onDragLeave()}
                    onDrop={() => onNefDrop(v.id)}
                    className={rowClass}
                    style={{ cursor: 'move' }}>
                  <td>{v.name}</td>
                  <td className={styles.center}>
                    {v.occupancy_mode === 'tag' ? 'Tag' : '24h besetzt'}
                  </td>
                  <td className={styles.center}>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setVehicleConfigDialog({
                          vehicleId: v.id,
                          name: v.name,
                          vehicleType: 'nef',
                          occupancyMode: v.occupancy_mode || '24h',
                          initialTab: 'stammdaten'
                        });
                      }}
                      style={{
                        background: '#007bff',
                        color: 'white',
                        border: 'none',
                        padding: '4px 8px',
                        borderRadius: '3px',
                        cursor: 'pointer',
                        fontSize: '11px'
                      }}
                      title="Fahrzeug bearbeiten"
                    >
                      ✏️
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!setFooterActions && (
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={addNef}>Hinzufügen</button>
          </div>
        )}
      </div>
      )}

      {/* ITW Tab */}
      {itwEnabled && activeTab === 'itw' && (
      <div>
        <table className={styles.table}>
          <thead>
            <tr className={styles.thead}>
              <th>Bezeichnung</th>
              <th className={styles.center} style={{ width: 100 }}>Aktionen</th>
            </tr>
          </thead>
          <tbody className={styles.tbody}>
            {itwVehicles.map(v => {
              const isOver = dragContext === 'itw' && dragOverId === v.id;
              const rowClass = [styles.row, isOver && dragPosition === 'above' ? styles.dropAbove : '', isOver && dragPosition === 'below' ? styles.dropBelow : ''].filter(Boolean).join(' ');
              return (
                <tr key={v.id}
                    draggable={true}
                    onDragStart={() => onItwDragStart(v.id)}
                    onDragOver={(e) => onDragOver(e, v.id, 'itw')}
                    onDragLeave={() => onDragLeave()}
                    onDrop={() => onItwDrop(v.id)}
                    className={rowClass}
                    style={{ cursor: 'move' }}>
                  <td>{v.name}</td>
                  <td className={styles.center}>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setVehicleConfigDialog({ vehicleId: v.id, name: v.name, vehicleType: 'itw', initialTab: 'stammdaten' });
                      }}
                      style={{
                        background: '#007bff',
                        color: 'white',
                        border: 'none',
                        padding: '4px 8px',
                        borderRadius: '3px',
                        cursor: 'pointer',
                        fontSize: '11px'
                      }}
                      title="Fahrzeug bearbeiten"
                    >
                      ✏️
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!setFooterActions && (
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={addItw}>Hinzufügen</button>
          </div>
        )}
      </div>
      )}

      {/* Schließen-Button entfernt: Seite läuft im Hauptfenster */}

      {vehicleConfigDialog && (
        <VehicleConfigDialog
          vehicleId={vehicleConfigDialog.vehicleId}
          vehicleName={vehicleConfigDialog.name}
          vehicleType={vehicleConfigDialog.vehicleType}
          occupancyMode={vehicleConfigDialog.occupancyMode}
          initialTab={vehicleConfigDialog.initialTab}
          onSave={(data) => handleSaveVehicleFromDialog(vehicleConfigDialog.vehicleId, vehicleConfigDialog.vehicleType, data)}
          onDelete={() => handleDeleteVehicleFromDialog(vehicleConfigDialog.vehicleId, vehicleConfigDialog.vehicleType)}
          onClose={() => setVehicleConfigDialog(null)}
        />
      )}
      </div>
      {/* Ende Content */}
    </div>
  );
};

export default Vehicles;
