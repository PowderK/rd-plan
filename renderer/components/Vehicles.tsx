import React, { useEffect, useState, useCallback, useMemo } from 'react';
import * as XLSX from 'xlsx';
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
  category?: 'regular' | 'reserve';
  initialTab: 'stammdaten' | 'zeitraeume' | 'positionen';
  onSave: (data: { name: string; occupancyMode?: '24h' | 'tag'; category?: 'regular' | 'reserve' }) => Promise<void>;
  onDelete: () => Promise<void>;
  onClose: () => void;
}> = ({ vehicleId, vehicleName, vehicleType, occupancyMode, category: initialCategory, initialTab, onSave, onDelete, onClose }) => {
  const [activeTab, setActiveTab] = useState<'stammdaten' | 'zeitraeume' | 'positionen'>(initialTab);
  const [name, setName] = useState(vehicleName);
  const [nefOccupancyMode, setNefOccupancyMode] = useState<'24h' | 'tag'>(occupancyMode || '24h');
  const [category, setCategory] = useState<'regular' | 'reserve'>(initialCategory === 'reserve' ? 'reserve' : 'regular');
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
        occupancyMode: vehicleType === 'nef' ? nefOccupancyMode : undefined,
        category
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
      onClose();
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
        zIndex: 1000,
        fontFamily: 'Arial, sans-serif'
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          padding: 24,
          borderRadius: 8,
          width: 'min(640px, 96vw)',
          height: 'min(580px, 90vh)',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0, marginBottom: 16, flexShrink: 0, color: '#333' }}>
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
              Aktivitäts-Zeiträume
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
              Schicht-Positionen
            </button>
          </div>

          {activeTab === 'stammdaten' && (
            <div style={{ maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: '14px', color: '#333' }}>
                  Bezeichnung *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    boxSizing: 'border-box',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: '14px', color: '#333' }}>
                  Fahrzeug-Kategorie *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as 'regular' | 'reserve')}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    boxSizing: 'border-box',
                    fontSize: '14px'
                  }}
                >
                  <option value="regular">Regelrettungsfahrzeug (Standard-Einteilung)</option>
                  <option value="reserve">Reservefahrzeug / Spitzenabdeckung (Ganz rechts)</option>
                </select>
                <small style={{ color: '#6b7280', display: 'block', marginTop: 4, fontSize: '12px' }}>
                  Reservefahrzeuge werden in der Schichteinteilung immer ganz rechts einsortiert.
                </small>
              </div>

              {vehicleType === 'nef' && (
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: '14px', color: '#333' }}>
                    Besetzungsmodus *
                  </label>
                  <select
                    value={nefOccupancyMode}
                    onChange={(e) => setNefOccupancyMode(e.target.value === 'tag' ? 'tag' : '24h')}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      boxSizing: 'border-box',
                      fontSize: '14px'
                    }}
                  >
                    <option value="24h">24h besetzt</option>
                    <option value="tag">Tagsüber besetzt</option>
                  </select>
                </div>
              )}
            </div>
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
        </div>

        <div style={{
          borderTop: '1px solid #eee',
          paddingTop: 12,
          paddingBottom: 4,
          background: 'var(--bg)',
          display: 'flex',
          justifyContent: 'space-between',
          flexShrink: 0
        }}>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting || saving || contextSaving}
            style={{
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '4px',
              cursor: deleting || saving || contextSaving ? 'not-allowed' : 'pointer',
              fontWeight: 500,
              fontSize: '14px'
            }}
          >
            {deleting ? 'Löschen ...' : 'Löschen'}
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={deleting || saving || contextSaving}
              style={{
                padding: '10px 20px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                background: 'white',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Schließen
            </button>
            <button
              type="button"
              onClick={activeTab === 'stammdaten' ? handleSave : handleContextSave}
              disabled={
                deleting ||
                saving ||
                contextSaving ||
                (activeTab !== 'stammdaten' && !contextCanSave)
              }
              style={{
                backgroundColor: '#0d6efd',
                color: 'white',
                padding: '10px 20px',
                border: 'none',
                borderRadius: '4px',
                cursor: (deleting || saving || contextSaving || (activeTab !== 'stammdaten' && !contextCanSave)) ? 'not-allowed' : 'pointer',
                fontWeight: 500,
                fontSize: '14px'
              }}
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
  const [rtwVehicles, setRtwVehicles] = useState<{ id: number; name: string; category?: string }[]>([]);
  const [nefVehicles, setNefVehicles] = useState<{ id: number; name: string; occupancy_mode?: '24h' | 'tag'; category?: string }[]>([]);
  const [itwVehicles, setItwVehicles] = useState<{ id: number; name: string; category?: string }[]>([]);
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
    category?: 'regular' | 'reserve';
    initialTab: 'stammdaten' | 'positionen' | 'zeitraeume';
  } | null>(null);

  const [rtwPeriods, setRtwPeriods] = useState<Record<number, any[]>>({});
  const [nefPeriods, setNefPeriods] = useState<Record<number, any[]>>({});
  const [itwPeriods, setItwPeriods] = useState<Record<number, any[]>>({});
  const [specialDays, setSpecialDays] = useState<any[]>([]);

  // Neue Header & Export/Import States
  const [searchQuery, setSearchQuery] = useState('');
  const [formatModal, setFormatModal] = useState<{ action: 'import' | 'export'; category: 'rtw' | 'nef' | 'itw' } | null>(null);
  const [conflictModal, setConflictModal] = useState<{ name: string; category: string; onResolve: (action: 'update' | 'skip', applyToAll: boolean) => void } | null>(null);
  const [conflictApplyToAll, setConflictApplyToAll] = useState<boolean>(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const loadVehiclePeriodsData = useCallback(async () => {
    try {
      const [rtwP, nefP, itwP, spec] = await Promise.all([
        (window as any).api.getAllRtwVehiclePeriods?.() || [],
        (window as any).api.getAllNefVehiclePeriods?.() || [],
        (window as any).api.getAllItwVehiclePeriods?.() || [],
        (window as any).api.getAllVehicleSpecialDays?.() || []
      ]);

      const rMap: Record<number, any[]> = {};
      (rtwP || []).forEach((p: any) => { if (!rMap[p.vehicleId]) rMap[p.vehicleId] = []; rMap[p.vehicleId].push(p); });
      const nMap: Record<number, any[]> = {};
      (nefP || []).forEach((p: any) => { if (!nMap[p.vehicleId]) nMap[p.vehicleId] = []; nMap[p.vehicleId].push(p); });
      const iMap: Record<number, any[]> = {};
      (itwP || []).forEach((p: any) => { if (!iMap[p.vehicleId]) iMap[p.vehicleId] = []; iMap[p.vehicleId].push(p); });

      setRtwPeriods(rMap);
      setNefPeriods(nMap);
      setItwPeriods(iMap);
      setSpecialDays(Array.isArray(spec) ? spec : []);
    } catch {}
  }, []);

  const renderPeriodSummary = (vehicleType: 'rtw' | 'nef' | 'itw', vehicleId: number) => {
    const periodList = (vehicleType === 'rtw' ? rtwPeriods : vehicleType === 'nef' ? nefPeriods : itwPeriods)[vehicleId] || [];
    const specList = (specialDays || []).filter(s => (s.vehicleType || 'rtw') === vehicleType && Number(s.vehicleId) === Number(vehicleId));

    const badges: React.ReactNode[] = [];

    if (periodList.length > 0) {
      periodList.forEach((p, idx) => {
        const start = p.startDate || p.startYM || '';
        const end = p.endDate || p.endYM || 'Unbegrenzt';
        const note = p.note ? ` (${p.note})` : '';
        badges.push(
          <span key={`p_${idx}`} style={{ background: '#e0f2fe', color: '#0369a1', padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            📅 {start} bis {end}{note}
          </span>
        );
      });
    }

    if (specList.length > 0) {
      badges.push(
        <span key="spec" style={{ background: '#fef3c7', color: '#b45309', padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          ⚡ {specList.length} {specList.length === 1 ? 'Sondertag' : 'Sondertage'} (Spitzenabdeckung)
        </span>
      );
    }

    if (badges.length === 0) {
      return <span style={{ color: '#9ca3af', fontSize: '12px', fontStyle: 'italic' }}>Durchgehend aktiv</span>;
    }

    return <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{badges}</div>;
  };

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
      await loadVehiclePeriodsData();
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
      await loadVehiclePeriodsData();
      try { setRtwVehicles(await (window as any).api.getRtwVehicles()); } catch {}
      try { setNefVehicles(await (window as any).api.getNefVehicles()); } catch {}
      try { setItwVehicles(await (window as any).api.getItwVehicles()); } catch {}
    };
    (window as any).api?.onSettingsUpdated?.(onSettingsUpdated);
    return () => (window as any).api?.offSettingsUpdated?.(onSettingsUpdated);
  }, [loadItwEnabled, loadVehiclePeriodsData]);

  // Listen for messages from popups (e.g. add vehicle windows)
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.data === 'settings-updated' || event.data === 'vehicles-updated') {
        await loadVehiclePeriodsData();
        try { setRtwVehicles(await (window as any).api.getRtwVehicles()); } catch {}
        try { setNefVehicles(await (window as any).api.getNefVehicles()); } catch {}
        try { setItwVehicles(await (window as any).api.getItwVehicles()); } catch {}
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [loadVehiclePeriodsData]);

  // Listen for vehicles-updated IPC event
  useEffect(() => {
    const onVehiclesUpdated = async () => {
      await loadVehiclePeriodsData();
      try { setRtwVehicles(await (window as any).api.getRtwVehicles()); } catch {}
      try { setNefVehicles(await (window as any).api.getNefVehicles()); } catch {}
      try { setItwVehicles(await (window as any).api.getItwVehicles()); } catch {}
    };
    (window as any).api?.onVehiclesUpdated?.(onVehiclesUpdated);
    return () => (window as any).api?.offVehiclesUpdated?.(onVehiclesUpdated);
  }, [loadVehiclePeriodsData]);

  // --- Utils ---
  const reloadRtw = useCallback(async () => {
    await loadVehiclePeriodsData();
    try { setRtwVehicles(await (window as any).api.getRtwVehicles()); } catch {}
  }, [loadVehiclePeriodsData]);
  const reloadNef = useCallback(async () => {
    await loadVehiclePeriodsData();
    try { setNefVehicles(await (window as any).api.getNefVehicles()); } catch {}
  }, [loadVehiclePeriodsData]);
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

  // Live-Suche Filter
  const filteredRtwVehicles = useMemo(() => {
    if (!searchQuery.trim()) return rtwVehicles;
    const q = searchQuery.toLowerCase().trim();
    return rtwVehicles.filter(v => (v.name || '').toLowerCase().includes(q));
  }, [rtwVehicles, searchQuery]);

  const filteredNefVehicles = useMemo(() => {
    if (!searchQuery.trim()) return nefVehicles;
    const q = searchQuery.toLowerCase().trim();
    return nefVehicles.filter(v => (v.name || '').toLowerCase().includes(q));
  }, [nefVehicles, searchQuery]);

  const filteredItwVehicles = useMemo(() => {
    if (!searchQuery.trim()) return itwVehicles;
    const q = searchQuery.toLowerCase().trim();
    return itwVehicles.filter(v => (v.name || '').toLowerCase().includes(q));
  }, [itwVehicles, searchQuery]);

  // Export Logic
  const handleCategoryExport = async (tab: 'rtw' | 'nef' | 'itw', format: 'json' | 'excel') => {
    let vehiclesList: any[] = [];
    let periodsMap: Record<number, any[]> = {};
    let label = '';

    if (tab === 'rtw') {
      vehiclesList = rtwVehicles;
      periodsMap = rtwPeriods;
      label = 'RTW';
    } else if (tab === 'nef') {
      vehiclesList = nefVehicles;
      periodsMap = nefPeriods;
      label = 'NEF';
    } else {
      vehiclesList = itwVehicles;
      periodsMap = itwPeriods;
      label = 'ITW';
    }

    if (vehiclesList.length === 0) {
      alert(`Keine Daten für den Export in der Kategorie "${label}" vorhanden.`);
      return;
    }

    if (format === 'json') {
      const fullExportData: any[] = [];
      for (const v of vehiclesList) {
        let positions: any[] = [];
        try {
          positions = await (window as any).api.getVehiclePositions(tab, v.id) || [];
        } catch {}

        fullExportData.push({
          id: v.id,
          name: v.name,
          occupancy_mode: v.occupancy_mode || undefined,
          category: v.category || 'regular',
          periods: (periodsMap[v.id] || []).map(p => ({
            startYM: p.startYM || p.startDate || '',
            endYM: p.endYM || p.endDate || '',
            active: p.active !== false,
            note: p.note || ''
          })),
          positions: positions.map((pos: any) => ({
            shiftType: pos.shiftType,
            roleRequired: pos.roleRequired,
            positionIndex: pos.positionIndex
          }))
        });
      }

      const jsonStr = JSON.stringify(fullExportData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `RD-Plan_${label}_Fahrzeuge_Export_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else {
      // Multi-Sheet Excel Export
      const wb = XLSX.utils.book_new();

      // Sheet 1: Fahrzeuge
      const mainRows = vehiclesList.map(v => ({
        Bezeichnung: v.name,
        Besetzung: v.occupancy_mode ? (v.occupancy_mode === 'tag' ? 'Tag' : '24h besetzt') : undefined,
        Kategorie: v.category === 'reserve' ? 'Reserve' : 'Regelrettung'
      }));
      const ws1 = XLSX.utils.json_to_sheet(mainRows);
      XLSX.utils.book_append_sheet(wb, ws1, `${label}_Fahrzeuge`);

      // Sheet 2: Aktivitaets_Zeitraeume
      const periodRows: any[] = [];
      vehiclesList.forEach(v => {
        (periodsMap[v.id] || []).forEach(p => {
          periodRows.push({
            Fahrzeugbezeichnung: v.name,
            Start_YM: p.startYM || p.startDate || '',
            Ende_YM: p.endYM || p.endDate || '',
            Anmerkung: p.note || '',
            Aktiv: p.active !== false ? 'Ja' : 'Nein'
          });
        });
      });
      const ws2 = XLSX.utils.json_to_sheet(periodRows.length > 0 ? periodRows : [{ Fahrzeugbezeichnung: '', Start_YM: '', Ende_YM: '', Anmerkung: '', Aktiv: '' }]);
      XLSX.utils.book_append_sheet(wb, ws2, 'Aktivitaets_Zeitraeume');

      // Sheet 3: Schicht_Positionen
      const posRows: any[] = [];
      for (const v of vehiclesList) {
        try {
          const positions = await (window as any).api.getVehiclePositions(tab, v.id) || [];
          positions.forEach((pos: any) => {
            posRows.push({
              Fahrzeugbezeichnung: v.name,
              Schicht: pos.shiftType,
              Rolle: pos.roleRequired,
              Position: pos.positionIndex
            });
          });
        } catch {}
      }
      const ws3 = XLSX.utils.json_to_sheet(posRows.length > 0 ? posRows : [{ Fahrzeugbezeichnung: '', Schicht: '', Rolle: '', Position: '' }]);
      XLSX.utils.book_append_sheet(wb, ws3, 'Schicht_Positionen');

      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `RD-Plan_${label}_Fahrzeuge_Export_${new Date().toISOString().slice(0, 10)}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  const askConflictResolution = (name: string, category: string): Promise<{ action: 'update' | 'skip'; applyToAll: boolean }> => {
    setConflictApplyToAll(false);
    return new Promise((resolve) => {
      setConflictModal({
        name,
        category,
        onResolve: (action, applyToAll) => {
          setConflictModal(null);
          resolve({ action, applyToAll });
        }
      });
    });
  };

  const triggerCategoryImport = (format: 'json' | 'excel') => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.accept = format === 'json' ? '.json' : '.xlsx,.xls,.csv';
      fileInputRef.current.click();
    }
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      let importedItems: any[] = [];
      let periodRows: any[] = [];
      let positionRows: any[] = [];

      const fileName = file.name.toLowerCase();

      if (fileName.endsWith('.json')) {
        const text = await file.text();
        const parsed = JSON.parse(text);
        importedItems = Array.isArray(parsed) ? parsed : [parsed];
      } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv')) {
        const arrayBuffer = await file.arrayBuffer();
        const wb = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheetName = wb.SheetNames[0];
        importedItems = XLSX.utils.sheet_to_json(wb.Sheets[firstSheetName]);

        if (wb.SheetNames.includes('Aktivitaets_Zeitraeume')) {
          periodRows = XLSX.utils.sheet_to_json(wb.Sheets['Aktivitaets_Zeitraeume']);
        }
        if (wb.SheetNames.includes('Schicht_Positionen')) {
          positionRows = XLSX.utils.sheet_to_json(wb.Sheets['Schicht_Positionen']);
        }
      } else {
        alert('Bitte eine gültige .json, .xlsx oder .csv Datei auswählen.');
        return;
      }

      if (importedItems.length === 0) {
        alert('Keine gültigen Daten zum Importieren gefunden.');
        return;
      }

      let insertedCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;
      let bulkChoice: 'update' | 'skip' | null = null;

      const currentVehicles = activeTab === 'rtw' ? rtwVehicles : activeTab === 'nef' ? nefVehicles : itwVehicles;
      const tabLabel = activeTab.toUpperCase();

      for (const item of importedItems) {
        const name = item.name || item.Bezeichnung || item.bezeichnung;
        if (!name) continue;

        const existing = currentVehicles.find(v => v.name.trim().toLowerCase() === String(name).trim().toLowerCase());
        let actionToTake: 'add' | 'update' | 'skip' = 'add';

        if (existing) {
          if (bulkChoice) {
            actionToTake = bulkChoice;
          } else {
            const choice = await askConflictResolution(String(name), tabLabel);
            if (choice.applyToAll) bulkChoice = choice.action;
            actionToTake = choice.action;
          }
        }

        if (actionToTake === 'skip') {
          skippedCount++;
          continue;
        }

        const catVal = (item.category === 'reserve' || item.Kategorie === 'Reserve') ? 'reserve' : 'regular';
        const occMode = (item.occupancy_mode === 'tag' || item.Besetzung === 'Tag') ? 'tag' : '24h';

        let targetId: number | null = null;

        if (actionToTake === 'update' && existing) {
          targetId = existing.id;
          if (activeTab === 'rtw') {
            await (window as any).api.updateRtwVehicle({ id: existing.id, name, category: catVal });
          } else if (activeTab === 'nef') {
            await (window as any).api.updateNefVehicle({ id: existing.id, name, category: catVal });
            await (window as any).api.setNefOccupancy?.(existing.id, occMode);
          } else {
            await (window as any).api.updateItwVehicle({ id: existing.id, name, category: catVal });
          }
          updatedCount++;
        } else {
          if (activeTab === 'rtw') {
            const res = await (window as any).api.addRtwVehicle({ name, category: catVal });
            targetId = typeof res === 'number' ? res : (res?.lastInsertRowid || res?.lastID);
          } else if (activeTab === 'nef') {
            const res = await (window as any).api.addNefVehicle({ name, occupancy_mode: occMode, category: catVal });
            targetId = typeof res === 'number' ? res : (res?.lastInsertRowid || res?.lastID);
          } else {
            const res = await (window as any).api.addItwVehicle({ name, category: catVal });
            targetId = typeof res === 'number' ? res : (res?.lastInsertRowid || res?.lastID);
          }
          insertedCount++;
        }

        if (!targetId) {
          const freshList = activeTab === 'rtw' ? await (window as any).api.getRtwVehicles() : activeTab === 'nef' ? await (window as any).api.getNefVehicles() : await (window as any).api.getItwVehicles();
          const found = freshList.find((v: any) => v.name === name);
          if (found) targetId = found.id;
        }

        if (targetId) {
          // Unter-Zeiträume importieren
          const pList = item.periods || periodRows.filter(r =>
            (r.Fahrzeugbezeichnung || r.name) === name
          ).map(r => ({
            startYM: String(r.Start_YM || r.startYM || ''),
            endYM: String(r.Ende_YM || r.endYM || ''),
            note: r.Anmerkung || r.note || '',
            active: r.Aktiv === 'Ja' || r.active === true || r.Aktiv === true
          }));

          if (Array.isArray(pList) && pList.length > 0) {
            try {
              await (window as any).api.setVehiclePeriods?.(activeTab, targetId, pList);
            } catch {}
          }
        }
      }

      await loadVehiclePeriodsData();
      if (activeTab === 'rtw') reloadRtw();
      else if (activeTab === 'nef') reloadNef();
      else reloadItw();

      alert(`Import beendet: ${insertedCount} neu angelegt, ${updatedCount} aktualisiert, ${skippedCount} übersprungen.`);
    } catch (err: any) {
      console.error('Import Fehler:', err);
      alert('Fehler beim Importieren: ' + err.message);
    }
  };

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

  return (
    <div className="page-container">
      {/* Verstecktes Input-Element für Datei-Import */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileImport}
      />

      <div className="sticky-header-container">
        <h2 className="page-header">Fahrzeuge</h2>

        {/* Steuerungselemente Header */}
        <div style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: '12px',
          borderBottom: '1px solid #e2e8f0',
          marginBottom: '12px'
        }}>
          {/* Live-Suche Input */}
          <div style={{ flex: '1', maxWidth: '320px' }}>
            <input
              type="text"
              placeholder={`Suche nach ${activeTab.toUpperCase()}-Fahrzeugen...`}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                outline: 'none'
              }}
            />
          </div>

          {/* Action-Buttons Header */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={activeTab === 'nef' ? addNef : activeTab === 'itw' ? addItw : addRtw}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                background: '#0ea5e9',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Hinzufügen
            </button>
            <button
              onClick={() => setFormatModal({ action: 'import', category: activeTab })}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#334155',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              Import
            </button>
            <button
              onClick={() => setFormatModal({ action: 'export', category: activeTab })}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#334155',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              Export
            </button>
          </div>
        </div>

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
              <th>Aktivitäts-Zeiträume & Sondertage</th>
              <th className={styles.center} style={{ width: 100 }}>Aktionen</th>
            </tr>
          </thead>
          <tbody className={styles.tbody}>
            {filteredRtwVehicles.map(v => {
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
                  <td style={{ fontWeight: 600 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>{v.name}</span>
                      {v.category === 'reserve' ? (
                        <span style={{ background: '#f3e8ff', color: '#6b21a8', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600 }}>Reserve</span>
                      ) : (
                        <span style={{ background: '#f3f4f6', color: '#4b5563', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 500 }}>Regelrettung</span>
                      )}
                    </div>
                  </td>
                  <td>{renderPeriodSummary('rtw', v.id)}</td>
                  <td className={styles.center}>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setVehicleConfigDialog({ vehicleId: v.id, name: v.name, vehicleType: 'rtw', category: (v.category as any) || 'regular', initialTab: 'stammdaten' });
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
                      Bearbeiten
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
              <th>Aktivitäts-Zeiträume & Sondertage</th>
              <th className={styles.center} style={{ width: 100 }}>Aktionen</th>
            </tr>
          </thead>
          <tbody className={styles.tbody}>
            {filteredNefVehicles.map(v => {
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
                  <td style={{ fontWeight: 600 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>{v.name}</span>
                      {v.category === 'reserve' ? (
                        <span style={{ background: '#f3e8ff', color: '#6b21a8', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600 }}>Reserve</span>
                      ) : (
                        <span style={{ background: '#f3f4f6', color: '#4b5563', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 500 }}>Regelrettung</span>
                      )}
                    </div>
                  </td>
                  <td className={styles.center}>
                    {v.occupancy_mode === 'tag' ? 'Tag' : '24h besetzt'}
                  </td>
                  <td>{renderPeriodSummary('nef', v.id)}</td>
                  <td className={styles.center}>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setVehicleConfigDialog({
                          vehicleId: v.id,
                          name: v.name,
                          vehicleType: 'nef',
                          occupancyMode: v.occupancy_mode || '24h',
                          category: (v.category as any) || 'regular',
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
                      Bearbeiten
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      )}

      {/* ITW Tab */}
      {itwEnabled && activeTab === 'itw' && (
      <div>
        <table className={styles.table}>
          <thead>
            <tr className={styles.thead}>
              <th>Bezeichnung</th>
              <th>Aktivitäts-Zeiträume & Sondertage</th>
              <th className={styles.center} style={{ width: 100 }}>Aktionen</th>
            </tr>
          </thead>
          <tbody className={styles.tbody}>
            {filteredItwVehicles.map(v => {
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
                  <td style={{ fontWeight: 600 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>{v.name}</span>
                      {v.category === 'reserve' ? (
                        <span style={{ background: '#f3e8ff', color: '#6b21a8', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600 }}>Reserve</span>
                      ) : (
                        <span style={{ background: '#f3f4f6', color: '#4b5563', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 500 }}>Regelrettung</span>
                      )}
                    </div>
                  </td>
                  <td>{renderPeriodSummary('itw', v.id)}</td>
                  <td className={styles.center}>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setVehicleConfigDialog({ vehicleId: v.id, name: v.name, vehicleType: 'itw', category: (v.category as any) || 'regular', initialTab: 'stammdaten' });
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
                      Bearbeiten
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      )}

      {vehicleConfigDialog && (
        <VehicleConfigDialog
          vehicleId={vehicleConfigDialog.vehicleId}
          vehicleName={vehicleConfigDialog.name}
          vehicleType={vehicleConfigDialog.vehicleType}
          occupancyMode={vehicleConfigDialog.occupancyMode}
          category={vehicleConfigDialog.category}
          initialTab={vehicleConfigDialog.initialTab}
          onSave={async (data) => {
            if (vehicleConfigDialog.vehicleType === 'rtw') {
              await (window as any).api.updateRtwVehicle({ id: vehicleConfigDialog.vehicleId, ...data });
              reloadRtw();
            } else if (vehicleConfigDialog.vehicleType === 'nef') {
              await (window as any).api.updateNefVehicle({ id: vehicleConfigDialog.vehicleId, ...data });
              reloadNef();
            } else {
              await (window as any).api.updateItwVehicle({ id: vehicleConfigDialog.vehicleId, ...data });
              reloadItw();
            }
          }}
          onDelete={() => handleDeleteVehicleFromDialog(vehicleConfigDialog.vehicleId, vehicleConfigDialog.vehicleType)}
          onClose={() => setVehicleConfigDialog(null)}
        />
      )}

      {/* Modal Format-Auswahl (JSON vs Excel) */}
      {formatModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          zIndex: 1100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            padding: '24px',
            width: '360px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
          }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 600, color: '#0f172a' }}>
              Format auswählen ({formatModal.action === 'import' ? 'Import' : 'Export'})
            </h3>
            <p style={{ fontSize: '13px', color: '#475569', marginBottom: '20px' }}>
              In welchem Dateiformat möchten Sie den {formatModal.action === 'import' ? 'Import' : 'Export'} durchführen?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={() => {
                  const { action, category } = formatModal;
                  setFormatModal(null);
                  if (action === 'export') {
                    handleCategoryExport(category, 'json');
                  } else {
                    triggerCategoryImport('json');
                  }
                }}
                style={{
                  padding: '10px 16px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  color: '#0f172a',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                📄 JSON Datei (.json)
              </button>
              <button
                onClick={() => {
                  const { action, category } = formatModal;
                  setFormatModal(null);
                  if (action === 'export') {
                    handleCategoryExport(category, 'excel');
                  } else {
                    triggerCategoryImport('excel');
                  }
                }}
                style={{
                  padding: '10px 16px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  color: '#0f172a',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                📊 Excel Arbeitsmappe (.xlsx)
              </button>
            </div>
            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setFormatModal(null)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#64748b',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal bei Duplikat-Konflikt */}
      {conflictModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          zIndex: 1200,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            padding: '24px',
            width: '420px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.25)'
          }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 600, color: '#0f172a' }}>
              Fahrzeug bereits vorhanden
            </h3>
            <p style={{ fontSize: '13px', color: '#334155', marginBottom: '16px', lineHeight: '1.4' }}>
              Das Fahrzeug <strong>"{conflictModal.name}"</strong> existiert bereits in der Datenbank.
              <br />
              Wie möchten Sie fortfahren?
            </p>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#475569', cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={conflictApplyToAll}
                  onChange={e => setConflictApplyToAll(e.target.checked)}
                />
                Auswahl für alle weiteren Konflikte übernehmen
              </label>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => conflictModal.onResolve('skip', conflictApplyToAll)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                Überspringen
              </button>

              <button
                onClick={() => conflictModal.onResolve('update', conflictApplyToAll)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  background: '#0ea5e9',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Aktualisieren / Überschreiben
              </button>
            </div>
          </div>
        </div>
      )}

      </div>
      {/* Ende Content */}
    </div>
  );
};

export default Vehicles;
