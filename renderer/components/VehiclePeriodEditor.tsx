import React, { useState } from 'react';
import styles from './PersonnelOverview.module.css';

interface VehiclePeriod {
  id: number;
  vehicleId: number;
  startYM: string;
  endYM: string;
  active: boolean;
}

interface VehiclePeriodListProps {
  vehicleId: number;
  vehicleName: string;
  vehicleType: 'rtw' | 'nef' | 'itw';
  onClose: () => void;
  embedded?: boolean;
  externalSaveControls?: boolean;
  onEmbeddedSaveStateChange?: (canSave: boolean, saveHandler: (() => Promise<void>) | null) => void;
}

export const VehiclePeriodList: React.FC<VehiclePeriodListProps> = ({ 
  vehicleId, 
  vehicleName,
  vehicleType,
  onClose,
  embedded = false,
  externalSaveControls = false,
  onEmbeddedSaveStateChange
}) => {
  const [periods, setPeriods] = useState<VehiclePeriod[]>([]);
  const [editing, setEditing] = useState(false);
  const [originalPeriods, setOriginalPeriods] = useState<VehiclePeriod[] | null>(null);
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | null>(null);

  const loadPeriods = async () => {
    try {
      let data;
      if (vehicleType === 'rtw') {
        data = await (window as any).api.getRtwVehiclePeriods(vehicleId);
      } else if (vehicleType === 'nef') {
        data = await (window as any).api.getNefVehiclePeriods(vehicleId);
      } else {
        data = await (window as any).api.getItwVehiclePeriods(vehicleId);
      }
      setPeriods(data || []);
    } catch (error) {
      // console.error('Failed to load vehicle periods:', error);
    }
  };

  React.useEffect(() => {
    loadPeriods();
  }, [vehicleId, vehicleType]);

  const startEditing = () => {
    setOriginalPeriods(JSON.parse(JSON.stringify(periods)));
    setEditing(true);
  };

  const cancelEditing = () => {
    if (originalPeriods) {
      setPeriods(originalPeriods);
    }
    setEditing(false);
    setOriginalPeriods(null);
    setSelectedPeriodId(null);
  };

  const handleAdd = () => {
    const newPeriod: VehiclePeriod = {
      id: Date.now(),
      vehicleId,
      startYM: '',
      endYM: '',
      active: true
    };

    if (!editing) {
      setOriginalPeriods(JSON.parse(JSON.stringify(periods)));
      setEditing(true);
    }

    setPeriods([...periods, newPeriod]);
    setSelectedPeriodId(newPeriod.id);
  };

  const handleDeleteSelected = async () => {
    if (selectedPeriodId == null) return;

    if (editing) {
      setPeriods(periods.filter(p => p.id !== selectedPeriodId));
      setSelectedPeriodId(null);
      return;
    }

    if (!confirm('Möchten Sie diesen Zeitraum wirklich löschen?')) {
      return;
    }

    try {
      if (vehicleType === 'rtw') {
        await (window as any).api.deleteRtwVehiclePeriod(selectedPeriodId);
      } else if (vehicleType === 'nef') {
        await (window as any).api.deleteNefVehiclePeriod(selectedPeriodId);
      } else {
        await (window as any).api.deleteItwVehiclePeriod(selectedPeriodId);
      }
      setSelectedPeriodId(null);
      await loadPeriods();
    } catch {
      alert('Fehler beim Löschen des Zeitraums.');
    }
  };

  const handleSave = async () => {
    const invalid = periods.find(p => !p.startYM);
    if (invalid) {
      alert('Bitte bei allen Zeiträumen einen Start-Monat angeben.');
      return;
    }

    try {
      for (const period of periods) {
        const original = originalPeriods?.find(p => p.id === period.id);

        if (!original) {
          const payload = {
            vehicleId: period.vehicleId,
            startYM: period.startYM,
            endYM: period.endYM || '',
            active: period.active
          };
          if (vehicleType === 'rtw') {
            await (window as any).api.addRtwVehiclePeriod(payload);
          } else if (vehicleType === 'nef') {
            await (window as any).api.addNefVehiclePeriod(payload);
          } else {
            await (window as any).api.addItwVehiclePeriod(payload);
          }
        } else if (
          original.startYM !== period.startYM ||
          (original.endYM || '') !== (period.endYM || '') ||
          original.active !== period.active
        ) {
          if (vehicleType === 'rtw') {
            await (window as any).api.updateRtwVehiclePeriod(period);
          } else if (vehicleType === 'nef') {
            await (window as any).api.updateNefVehiclePeriod(period);
          } else {
            await (window as any).api.updateItwVehiclePeriod(period);
          }
        }
      }

      if (originalPeriods) {
        for (const original of originalPeriods) {
          if (!periods.find(p => p.id === original.id)) {
            if (vehicleType === 'rtw') {
              await (window as any).api.deleteRtwVehiclePeriod(original.id);
            } else if (vehicleType === 'nef') {
              await (window as any).api.deleteNefVehiclePeriod(original.id);
            } else {
              await (window as any).api.deleteItwVehiclePeriod(original.id);
            }
          }
        }
      }

      setEditing(false);
      setOriginalPeriods(null);
      setSelectedPeriodId(null);
      await loadPeriods();
    } catch {
      alert('Fehler beim Speichern des Zeitraums.');
    }
  };

  React.useEffect(() => {
    if (!externalSaveControls || !onEmbeddedSaveStateChange) return;
    onEmbeddedSaveStateChange(editing, editing ? handleSave : null);
    return () => onEmbeddedSaveStateChange(false, null);
  }, [externalSaveControls, onEmbeddedSaveStateChange, editing, handleSave]);

  const updateStartYM = (id: number, startYM: string) => {
    setPeriods(periods.map(p => p.id === id ? { ...p, startYM } : p));
  };

  const updateEndYM = (id: number, endYM: string) => {
    setPeriods(periods.map(p => p.id === id ? { ...p, endYM } : p));
  };

  const updateUnlimited = (id: number, unlimited: boolean) => {
    setPeriods(periods.map(p => p.id === id ? { ...p, endYM: unlimited ? '' : p.endYM } : p));
  };

  const formatYM = (ym: string) => {
    if (!ym) return '';
    const [year, month] = ym.split('-');
    return `${month}/${year}`;
  };

  const content = (
      <div style={embedded ? {
        background: 'transparent',
        padding: 0,
        borderRadius: 0,
        width: '100%',
        maxHeight: '100%',
        overflow: 'auto'
      } : {
        background: 'white',
        padding: '24px',
        borderRadius: '8px',
        width: '700px',
        maxHeight: '80vh',
        overflow: 'auto'
      }}>
        <h3 style={{ marginTop: 0, marginBottom: '8px', color: '#007bff' }}>
          Einsatzzeiträume: {vehicleName}
        </h3>

        <table style={{ 
          width: '100%', 
          borderCollapse: 'collapse',
          marginBottom: '16px'
        }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #ddd' }}>
              <th style={{ textAlign: 'left', padding: '8px' }}>Start</th>
              <th style={{ textAlign: 'left', padding: '8px' }}>Ende</th>
              <th style={{ textAlign: 'center', padding: '8px' }}>Aktiv</th>
            </tr>
          </thead>
          <tbody>
            {periods.length === 0 && (
              <tr>
                <td colSpan={3} style={{ textAlign: 'center', padding: '24px', color: '#999' }}>
                  Keine Einsatzzeiträume definiert
                </td>
              </tr>
            )}
            {periods.map(period => (
              <tr
                key={period.id}
                onClick={() => setSelectedPeriodId(prev => prev === period.id ? null : period.id)}
                className={[styles.row, selectedPeriodId === period.id ? styles.selected : ''].filter(Boolean).join(' ')}
                style={{ borderBottom: '1px solid #eee', cursor: 'pointer' }}
              >
                <td style={{ padding: '8px' }}>
                  {editing ? (
                    <input
                      type="month"
                      value={period.startYM}
                      onChange={(e) => updateStartYM(period.id, e.target.value)}
                    />
                  ) : (
                    formatYM(period.startYM)
                  )}
                </td>
                <td style={{ padding: '8px' }}>
                  {editing ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input
                          type="checkbox"
                          checked={!period.endYM}
                          onChange={(e) => updateUnlimited(period.id, e.target.checked)}
                        />
                        Unbegrenzt
                      </label>
                      {!!period.endYM && (
                        <input
                          type="month"
                          value={period.endYM}
                          onChange={(e) => updateEndYM(period.id, e.target.value)}
                        />
                      )}
                    </div>
                  ) : (
                    period.endYM ? formatYM(period.endYM) : 'Unbegrenzt'
                  )}
                </td>
                <td style={{ textAlign: 'center', padding: '8px' }}>
                  <span style={{ 
                    display: 'inline-block',
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    background: period.active ? '#28a745' : '#dc3545'
                  }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!editing ? (
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button onClick={handleAdd}>Hinzufügen</button>
            <button onClick={startEditing} disabled={periods.length === 0}>Ändern</button>
            <button onClick={handleDeleteSelected} disabled={selectedPeriodId == null}>Löschen</button>
            {!embedded && (
              <button onClick={onClose} style={{ marginLeft: 'auto' }}>Schließen</button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            {!externalSaveControls && (
              <button
                onClick={handleSave}
                style={{ backgroundColor: '#007acc', color: 'white', padding: '8px 16px', border: 'none', borderRadius: 4, cursor: 'pointer' }}
              >
                Speichern
              </button>
            )}
            <button
              onClick={cancelEditing}
              style={{ padding: '8px 16px', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer' }}
            >
              Abbrechen
            </button>
          </div>
        )}
      </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 999
    }}>
      {content}
    </div>
  );
};
