import React, { useState, useEffect, useCallback } from 'react';
import { VehiclePeriod, VehicleSpecialDay } from '../utils/vehiclePeriods';

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
  const [specialDays, setSpecialDays] = useState<VehicleSpecialDay[]>([]);

  const loadData = async () => {
    try {
      let periodData;
      if (vehicleType === 'rtw') {
        periodData = await (window as any).api.getRtwVehiclePeriods(vehicleId);
      } else if (vehicleType === 'nef') {
        periodData = await (window as any).api.getNefVehiclePeriods(vehicleId);
      } else {
        periodData = await (window as any).api.getItwVehiclePeriods(vehicleId);
      }

      const loadedPeriods: VehiclePeriod[] = (periodData || []).map((p: any) => ({
        id: p.id,
        vehicleId: p.vehicleId,
        startDate: p.startDate || p.startYM || '',
        endDate: p.endDate || p.endYM || '',
        active: p.active !== 0 && p.active !== false,
        note: p.note || ''
      }));
      setPeriods(loadedPeriods);

      const specData = await (window as any).api.getVehicleSpecialDays?.(vehicleType, vehicleId);
      const loadedSpec: VehicleSpecialDay[] = (specData || []).map((s: any) => ({
        id: s.id,
        vehicleType: s.vehicleType || vehicleType,
        vehicleId: s.vehicleId || vehicleId,
        date: s.date || '',
        reason: s.reason || '',
        shiftMode: s.shiftMode || s.shift_mode || '24h',
        action: s.action || 'add'
      }));
      setSpecialDays(loadedSpec);
    } catch (error) {
      // Failed loading
    }
  };

  useEffect(() => {
    loadData();
  }, [vehicleId, vehicleType]);

  // --- Handlers: Grund-Zeiträume ---
  const handleAddPeriod = () => {
    const today = new Date().toISOString().slice(0, 10);
    const newPeriod: VehiclePeriod = {
      id: Date.now(),
      vehicleId,
      startDate: today,
      endDate: '',
      active: true,
      note: ''
    };
    setPeriods([...periods, newPeriod]);
  };

  const handleRemovePeriod = (id?: number) => {
    if (!confirm('Möchten Sie diesen Zeitraum wirklich löschen?')) return;
    setPeriods(periods.filter(p => p.id !== id));
  };

  const updatePeriod = (id: number | undefined, field: keyof VehiclePeriod, value: any) => {
    setPeriods(periods.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  // --- Handlers: Sondertage & Spitzenabdeckung ---
  const handleAddSpecialDay = () => {
    const today = new Date().toISOString().slice(0, 10);
    const newSpec: VehicleSpecialDay = {
      id: Date.now(),
      vehicleType,
      vehicleId,
      date: today,
      reason: 'Spitzenabdeckung',
      shiftMode: '24h',
      action: 'add'
    };
    setSpecialDays([...specialDays, newSpec]);
  };

  const handleRemoveSpecialDay = (id?: number) => {
    if (!confirm('Möchten Sie diesen Sondertag wirklich löschen?')) return;
    setSpecialDays(specialDays.filter(s => s.id !== id));
  };

  const updateSpecialDay = (id: number | undefined, field: keyof VehicleSpecialDay, value: any) => {
    setSpecialDays(specialDays.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const handleSave = useCallback(async () => {
    try {
      await (window as any).api.setVehiclePeriods?.(vehicleType, vehicleId, periods);
      await (window as any).api.setVehicleSpecialDays?.(vehicleType, vehicleId, specialDays);
      await loadData();
    } catch {
      alert('Fehler beim Speichern der Fahrzeug-Zeiträume.');
    }
  }, [periods, specialDays, vehicleId, vehicleType]);

  useEffect(() => {
    if (!externalSaveControls || !onEmbeddedSaveStateChange) return;
    onEmbeddedSaveStateChange(true, handleSave);
    return () => onEmbeddedSaveStateChange(false, null);
  }, [externalSaveControls, onEmbeddedSaveStateChange, handleSave]);

  const content = (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ABSCHNITT 1: REGULÄRE GRUND-ZEITRÄUME */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: 8 }}>
          <h4 style={{ margin: 0, fontSize: '15px', color: '#1e293b', fontWeight: 600 }}>
            1. Reguläre Grund-Zeiträume (Standard-Aktivität)
          </h4>
          <button
            type="button"
            onClick={handleAddPeriod}
            style={{
              background: '#28a745',
              color: 'white',
              border: 'none',
              padding: '5px 12px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 500,
              whiteSpace: 'nowrap'
            }}
          >
            + Zeitraum hinzufügen
          </button>
        </div>

        {periods.length > 0 ? (
          <div style={{ border: '1px solid #ddd', borderRadius: '4px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #ddd' }}>
                  <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, width: '140px' }}>Gültig ab</th>
                  <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, width: '200px' }}>Gültig bis</th>
                  <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600 }}>Bemerkung</th>
                  <th style={{ textAlign: 'center', padding: '8px 10px', fontWeight: 600, width: '70px' }}>Aktion</th>
                </tr>
              </thead>
              <tbody>
                {periods.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '6px 10px' }}>
                      <input
                        type="date"
                        value={p.startDate || p.startYM || ''}
                        onChange={(e) => updatePeriod(p.id, 'startDate', e.target.value)}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '4px 6px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px' }}
                      />
                    </td>
                    <td style={{ padding: '6px 10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          <input
                            type="checkbox"
                            checked={!p.endDate && !p.endYM}
                            onChange={(e) => updatePeriod(p.id, 'endDate', e.target.checked ? '' : p.endDate || p.startDate)}
                          />
                          Unbegrenzt
                        </label>
                        {(!!p.endDate || !!p.endYM) && (
                          <input
                            type="date"
                            value={p.endDate || p.endYM || ''}
                            onChange={(e) => updatePeriod(p.id, 'endDate', e.target.value)}
                            style={{ padding: '4px 6px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px' }}
                          />
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '6px 10px' }}>
                      <input
                        type="text"
                        placeholder="z.B. Sommer-RTW"
                        value={p.note || ''}
                        onChange={(e) => updatePeriod(p.id, 'note', e.target.value)}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '4px 6px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px' }}
                      />
                    </td>
                    <td style={{ textAlign: 'center', padding: '6px 10px' }}>
                      <button
                        type="button"
                        onClick={() => handleRemovePeriod(p.id)}
                        style={{
                          background: '#dc3545',
                          color: 'white',
                          border: 'none',
                          padding: '3px 8px',
                          borderRadius: '3px',
                          fontSize: '11px',
                          cursor: 'pointer'
                        }}
                      >
                        Löschen
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: '12px', background: '#fff5f5', border: '1px dashed #fecaca', borderRadius: '4px', textAlign: 'center', color: '#991b1b', fontSize: '13px', fontWeight: 500 }}>
            Keine Grund-Zeiträume definiert (Fahrzeug ist inaktiv).
          </div>
        )}
      </div>

      {/* ABSCHNITT 2: SPITZENABDECKUNG & SONDERLAGEN (EINZEL-TAGE) */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: 8 }}>
          <h4 style={{ margin: 0, fontSize: '15px', color: '#b45309', fontWeight: 600 }}>
            2. Taggenaue Sonderlagen & Spitzenabdeckung (Einzel-Tage)
          </h4>
          <button
            type="button"
            onClick={handleAddSpecialDay}
            style={{
              background: '#d97706',
              color: 'white',
              border: 'none',
              padding: '5px 12px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 500,
              whiteSpace: 'nowrap'
            }}
          >
            + Sondertag hinzufügen
          </button>
        </div>

        {specialDays.length > 0 ? (
          <div style={{ border: '1px solid #ddd', borderRadius: '4px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#fffbe6', borderBottom: '2px solid #ffe58f' }}>
                  <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, width: '130px' }}>Datum</th>
                  <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600 }}>Anlass / Sonderlage</th>
                  <th style={{ textAlign: 'center', padding: '8px 10px', fontWeight: 600, width: '120px' }}>Schicht-Modus</th>
                  <th style={{ textAlign: 'center', padding: '8px 10px', fontWeight: 600, width: '140px' }}>Aktivierung</th>
                  <th style={{ textAlign: 'center', padding: '8px 10px', fontWeight: 600, width: '70px' }}>Aktion</th>
                </tr>
              </thead>
              <tbody>
                {specialDays.map(s => (
                  <tr key={s.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '6px 10px' }}>
                      <input
                        type="date"
                        value={s.date || ''}
                        onChange={(e) => updateSpecialDay(s.id, 'date', e.target.value)}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '4px 6px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px' }}
                      />
                    </td>
                    <td style={{ padding: '6px 10px' }}>
                      <input
                        type="text"
                        placeholder="z.B. Spitzenabdeckung"
                        value={s.reason || ''}
                        onChange={(e) => updateSpecialDay(s.id, 'reason', e.target.value)}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '4px 6px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px' }}
                      />
                    </td>
                    <td style={{ textAlign: 'center', padding: '6px 10px' }}>
                      <select
                        value={s.shiftMode || '24h'}
                        onChange={(e) => updateSpecialDay(s.id, 'shiftMode', e.target.value)}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '4px 6px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px' }}
                      >
                        <option value="24h">24h (Ganztags)</option>
                        <option value="tag">Nur Tag</option>
                        <option value="nacht">Nur Nacht</option>
                      </select>
                    </td>
                    <td style={{ textAlign: 'center', padding: '6px 10px' }}>
                      <select
                        value={s.action || 'add'}
                        onChange={(e) => updateSpecialDay(s.id, 'action', e.target.value)}
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          padding: '4px 6px',
                          border: '1px solid #ccc',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: 500,
                          color: s.action === 'remove' ? '#c5221f' : '#137333'
                        }}
                      >
                        <option value="add">Zusätzlich aktiv</option>
                        <option value="remove">Inaktiv</option>
                      </select>
                    </td>
                    <td style={{ textAlign: 'center', padding: '6px 10px' }}>
                      <button
                        type="button"
                        onClick={() => handleRemoveSpecialDay(s.id)}
                        style={{
                          background: '#dc3545',
                          color: 'white',
                          border: 'none',
                          padding: '3px 8px',
                          borderRadius: '3px',
                          fontSize: '11px',
                          cursor: 'pointer'
                        }}
                      >
                        Löschen
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: '12px', background: '#fffbe6', border: '1px dashed #ffe58f', borderRadius: '4px', textAlign: 'center', color: '#b45309', fontSize: '13px' }}>
            Keine taggenauen Sonderlagen eingetragen. Klicken Sie auf „+ Sondertag hinzufügen“, um Tage für Spitzenabdeckung zu erfassen.
          </div>
        )}
      </div>
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
      <div style={{ background: 'white', padding: 24, borderRadius: 8, width: 960, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' }}>
        {content}
        <div style={{ marginTop: 20, textAlign: 'right' }}>
          <button type="button" onClick={onClose} style={{ padding: '8px 16px', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer' }}>
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
};
