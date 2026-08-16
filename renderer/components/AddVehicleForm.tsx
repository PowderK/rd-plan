import React, { useState, useEffect } from 'react';
import { VehiclePeriod, VehicleSpecialDay } from '../utils/vehiclePeriods';

interface QualificationType {
  id: number;
  name: string;
  description: string;
  category: string;
  active: boolean;
}

interface VehiclePositionItem {
  id?: number;
  positionName: string;
  qualificationTypeId: number | null;
  sort: number;
}

interface AddVehicleFormProps {
  vehicleType: 'rtw' | 'nef' | 'itw';
  title: string;
}

export const AddVehicleForm: React.FC<AddVehicleFormProps> = ({ vehicleType, title }) => {
  const [activeTab, setActiveTab] = useState<'stammdaten' | 'zeitraeume' | 'positionen'>('stammdaten');
  const [name, setName] = useState('');
  const [occupancyMode, setOccupancyMode] = useState<'24h' | 'tag'>('24h');
  const [category, setCategory] = useState<'regular' | 'reserve'>('regular');
  const [qualificationTypes, setQualificationTypes] = useState<QualificationType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Zeiträume State
  const today = new Date().toISOString().slice(0, 10);
  const [periods, setPeriods] = useState<VehiclePeriod[]>([]);
  // Sondertage State (Spitzenabdeckung / Sonderlagen)
  const [specialDays, setSpecialDays] = useState<VehicleSpecialDay[]>([]);

  // Positionen State
  const [positions, setPositions] = useState<VehiclePositionItem[]>([]);

  useEffect(() => {
    const loadQuals = async () => {
      try {
        const quals = await (window as any).api.getQualificationTypes();
        const activeQuals = (quals || []).filter((q: QualificationType) => q.active);
        setQualificationTypes(activeQuals);

        const findQualId = (qName: string) => {
          const found = activeQuals.find((q: QualificationType) => q.name === qName);
          return found ? found.id : null;
        };

        if (vehicleType === 'rtw') {
          setPositions([
            { positionName: 'Fahrzeugführer', qualificationTypeId: findQualId('RTW Fahrzeugführer') || findQualId('Fahrzeugführer'), sort: 0 },
            { positionName: 'Maschinist', qualificationTypeId: null, sort: 1 }
          ]);
        } else if (vehicleType === 'nef') {
          setPositions([
            { positionName: 'Assistent', qualificationTypeId: findQualId('NEF Assistent') || findQualId('NEF'), sort: 0 }
          ]);
        } else if (vehicleType === 'itw') {
          setPositions([
            { positionName: 'Fahrzeugführer', qualificationTypeId: findQualId('ITW Fahrzeugführer'), sort: 0 },
            { positionName: 'Maschinist', qualificationTypeId: findQualId('ITW Maschinist'), sort: 1 }
          ]);
        }
      } catch (e) {
        // console.warn('[AddVehicleForm] Failed to load qualification types:', e);
      } finally {
        setLoading(false);
      }
    };

    loadQuals();
  }, [vehicleType]);

  // --- Handlers: Grund-Zeiträume ---
  const handleAddPeriod = () => {
    setPeriods([...periods, { startDate: today, endDate: '', active: true, note: '' }]);
  };

  const updatePeriod = (index: number, field: keyof VehiclePeriod, value: any) => {
    setPeriods(periods.map((p, i) => i === index ? { ...p, [field]: value } : p));
  };

  const handleRemovePeriod = (index: number) => {
    if (!confirm('Möchten Sie diesen Zeitraum wirklich löschen?')) return;
    setPeriods(periods.filter((_, i) => i !== index));
  };

  // --- Handlers: Sondertage & Spitzenabdeckung ---
  const handleAddSpecialDay = () => {
    setSpecialDays([...specialDays, { date: today, reason: 'Spitzenabdeckung', shiftMode: '24h', action: 'add' }]);
  };

  const updateSpecialDay = (index: number, field: keyof VehicleSpecialDay, value: any) => {
    setSpecialDays(specialDays.map((s, i) => i === index ? { ...s, [field]: value } : s));
  };

  const handleRemoveSpecialDay = (index: number) => {
    if (!confirm('Möchten Sie diesen Sondertag wirklich löschen?')) return;
    setSpecialDays(specialDays.filter((_, i) => i !== index));
  };

  // --- Handlers: Positionen ---
  const handleAddPosition = () => {
    setPositions([
      ...positions,
      { positionName: 'Neue Position', qualificationTypeId: null, sort: positions.length }
    ]);
  };

  const updatePositionName = (index: number, positionName: string) => {
    setPositions(positions.map((p, i) => i === index ? { ...p, positionName } : p));
  };

  const updatePositionQual = (index: number, qualificationTypeId: number | null) => {
    setPositions(positions.map((p, i) => i === index ? { ...p, qualificationTypeId } : p));
  };

  const handleRemovePosition = (index: number) => {
    setPositions(positions.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    const n = name.trim();
    if (!n) {
      alert('Bitte geben Sie eine Fahrzeugbezeichnung ein.');
      setActiveTab('stammdaten');
      return;
    }

    setSaving(true);
    try {
      let vehicleId: number | undefined;
      if (vehicleType === 'rtw') {
        vehicleId = await (window as any).api.addRtwVehicle({ name: n, category });
      } else if (vehicleType === 'nef') {
        vehicleId = await (window as any).api.addNefVehicle({ name: n, occupancyMode, category });
      } else {
        vehicleId = await (window as any).api.addItwVehicle({ name: n, category });
      }

      if (!vehicleId) {
        throw new Error('Fahrzeug-ID konnte nicht ermittelt werden.');
      }

      // 1. Speichere Aktivitätszeiträume & Sondertage
      if (periods.length > 0) {
        await (window as any).api.setVehiclePeriods?.(vehicleType, vehicleId, periods);
      }
      if (specialDays.length > 0) {
        await (window as any).api.setVehicleSpecialDays?.(vehicleType, vehicleId, specialDays);
      }

      // 2. Speichere Schicht-Positionen
      const existingPositions = await (window as any).api.getVehiclePositions(vehicleType, vehicleId);
      for (const ep of existingPositions || []) {
        await (window as any).api.deleteVehiclePosition(ep.id);
      }
      for (let i = 0; i < positions.length; i++) {
        const pos = positions[i];
        await (window as any).api.addVehiclePosition({
          vehicleType,
          vehicleId,
          positionName: pos.positionName,
          qualificationTypeId: pos.qualificationTypeId,
          sort: i
        });
      }

      if (window.opener) window.opener.postMessage('settings-updated', '*');
      window.close();
    } catch (e) {
      alert('Fehler beim Speichern des Fahrzeugs: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: 24, height: '100vh', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', fontFamily: 'Arial, sans-serif' }}>
      <h2 style={{ marginTop: 0, marginBottom: 16, color: '#333' }}>{title}</h2>

      {/* Tabs */}
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

      {/* Tab Content */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 4 }}>
        {/* Tab 1: Stammdaten */}
        {activeTab === 'stammdaten' && (
          <div style={{ maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: '14px', color: '#333' }}>
                Bezeichnung *
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="z.B. RTW 1"
                autoFocus
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
                onChange={e => setCategory(e.target.value as 'regular' | 'reserve')}
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
                  value={occupancyMode}
                  onChange={e => setOccupancyMode(e.target.value as '24h' | 'tag')}
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

        {/* Tab 2: Aktivitäts-Zeiträume */}
        {activeTab === 'zeitraeume' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* ABSCHNITT 1: REGEL-ZEITRÄUME */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h4 style={{ margin: 0, fontSize: '15px', color: '#1e40af', fontWeight: 600 }}>
                  1. Regelmäßige Aktivitäts-Zeiträume
                </h4>
                <button
                  type="button"
                  onClick={handleAddPeriod}
                  style={{
                    background: '#28a745',
                    color: 'white',
                    border: 'none',
                    padding: '5px 10px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  + Zeitraum
                </button>
              </div>

              {periods.length > 0 ? (
                <div style={{ border: '1px solid #ddd', borderRadius: '4px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #ddd' }}>
                        <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600 }}>Gültig ab</th>
                        <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600 }}>Gültig bis</th>
                        <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600 }}>Bemerkung</th>
                        <th style={{ textAlign: 'center', padding: '8px 10px', fontWeight: 600, width: '60px' }}>Aktion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {periods.map((p, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '6px 10px' }}>
                            <input
                              type="date"
                              value={p.startDate || p.startYM || ''}
                              onChange={e => updatePeriod(idx, 'startDate', e.target.value)}
                              style={{ padding: '4px 6px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px' }}
                            />
                          </td>
                          <td style={{ padding: '6px 10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '12px', cursor: 'pointer' }}>
                                <input
                                  type="checkbox"
                                  checked={!p.endDate && !p.endYM}
                                  onChange={e => updatePeriod(idx, 'endDate', e.target.checked ? '' : p.endDate || p.startDate)}
                                />
                                Unbegrenzt
                              </label>
                              {(!!p.endDate || !!p.endYM) && (
                                <input
                                  type="date"
                                  value={p.endDate || p.endYM || ''}
                                  onChange={e => updatePeriod(idx, 'endDate', e.target.value)}
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
                              onChange={e => updatePeriod(idx, 'note', e.target.value)}
                              style={{ width: '90%', padding: '4px 6px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px' }}
                            />
                          </td>
                          <td style={{ textAlign: 'center', padding: '6px 10px' }}>
                            <button
                              type="button"
                              onClick={() => handleRemovePeriod(idx)}
                              style={{ background: '#dc3545', color: 'white', border: 'none', padding: '3px 8px', borderRadius: '3px', fontSize: '11px', cursor: 'pointer' }}
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
                <div style={{ padding: '12px', background: '#f8f9fa', border: '1px dashed #ddd', borderRadius: '4px', textAlign: 'center', color: '#6c757d', fontSize: '13px' }}>
                  Keine Grund-Zeiträume definiert.
                </div>
              )}
            </div>

            {/* ABSCHNITT 2: SONDERTAGE & SPITZENABDECKUNG */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
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
                    padding: '5px 10px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  + Sondertag
                </button>
              </div>

              {specialDays.length > 0 ? (
                <div style={{ border: '1px solid #ddd', borderRadius: '4px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: '#fffbe6', borderBottom: '2px solid #ffe58f' }}>
                        <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, width: '140px' }}>Datum</th>
                        <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600 }}>Anlass / Sonderlage</th>
                        <th style={{ textAlign: 'center', padding: '8px 10px', fontWeight: 600, width: '100px' }}>Schicht-Modus</th>
                        <th style={{ textAlign: 'center', padding: '8px 10px', fontWeight: 600, width: '120px' }}>Aktivierung</th>
                        <th style={{ textAlign: 'center', padding: '8px 10px', fontWeight: 600, width: '60px' }}>Aktion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {specialDays.map((s, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '6px 10px' }}>
                            <input
                              type="date"
                              value={s.date || ''}
                              onChange={e => updateSpecialDay(idx, 'date', e.target.value)}
                              style={{ padding: '4px 6px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px' }}
                            />
                          </td>
                          <td style={{ padding: '6px 10px' }}>
                            <input
                              type="text"
                              placeholder="z.B. Spitzenabdeckung"
                              value={s.reason || ''}
                              onChange={e => updateSpecialDay(idx, 'reason', e.target.value)}
                              style={{ width: '90%', padding: '4px 6px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px' }}
                            />
                          </td>
                          <td style={{ textAlign: 'center', padding: '6px 10px' }}>
                            <select
                              value={s.shiftMode || '24h'}
                              onChange={e => updateSpecialDay(idx, 'shiftMode', e.target.value as any)}
                              style={{ padding: '4px 6px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px' }}
                            >
                              <option value="24h">24h (Ganztags)</option>
                              <option value="tag">Nur Tag</option>
                              <option value="nacht">Nur Nacht</option>
                            </select>
                          </td>
                          <td style={{ textAlign: 'center', padding: '6px 10px' }}>
                            <select
                              value={s.action || 'add'}
                              onChange={e => updateSpecialDay(idx, 'action', e.target.value as any)}
                              style={{
                                padding: '4px 6px',
                                border: '1px solid #ccc',
                                borderRadius: '4px',
                                fontSize: '12px',
                                fontWeight: 500,
                                color: s.action === 'remove' ? '#c5221f' : '#137333'
                              }}
                            >
                              <option value="add">Zusätzlich Aktiv</option>
                              <option value="remove">Außerordentlich Inaktiv</option>
                            </select>
                          </td>
                          <td style={{ textAlign: 'center', padding: '6px 10px' }}>
                            <button
                              type="button"
                              onClick={() => handleRemoveSpecialDay(idx)}
                              style={{ background: '#dc3545', color: 'white', border: 'none', padding: '3px 8px', borderRadius: '3px', fontSize: '11px', cursor: 'pointer' }}
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
                  Keine Sondertage definiert.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Schicht-Positionen */}
        {activeTab === 'positionen' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#333', fontWeight: 600 }}>
                Schicht-Positionen
              </h3>
              <button
                type="button"
                onClick={handleAddPosition}
                style={{
                  background: '#28a745',
                  color: 'white',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                + Position
              </button>
            </div>

            {positions.length > 0 ? (
              <div style={{ border: '1px solid #ddd', borderRadius: '4px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #ddd' }}>
                      <th style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 600 }}>Position</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 600 }}>Mindest-Qualifikation</th>
                      <th style={{ textAlign: 'center', padding: '10px 12px', fontWeight: 600, width: '80px' }}>Aktion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {positions.map((pos, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '8px 12px' }}>
                          <input
                            type="text"
                            value={pos.positionName}
                            onChange={e => updatePositionName(idx, e.target.value)}
                            style={{ width: '90%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '13px' }}
                          />
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <select
                            value={pos.qualificationTypeId ?? ''}
                            onChange={e => updatePositionQual(idx, e.target.value ? Number(e.target.value) : null)}
                            style={{ width: '90%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '13px' }}
                          >
                            <option value="">Keine Einschränkung (Alle)</option>
                            {qualificationTypes.map(q => (
                              <option key={q.id} value={q.id}>{q.name}</option>
                            ))}
                          </select>
                        </td>
                        <td style={{ textAlign: 'center', padding: '8px 12px' }}>
                          <button
                            type="button"
                            onClick={() => handleRemovePosition(idx)}
                            style={{ background: '#dc3545', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '3px', fontSize: '12px', cursor: 'pointer' }}
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
              <div style={{ padding: '16px', background: '#f8f9fa', border: '1px dashed #ddd', borderRadius: '4px', textAlign: 'center', color: '#6c757d', fontSize: '14px' }}>
                Keine Schicht-Positionen definiert. Klicken Sie auf „+ Position“, um eine hinzuzufügen.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        gap: 12,
        marginTop: 16,
        paddingTop: 12,
        borderTop: '1px solid #dee2e6'
      }}>
        <button
          type="button"
          onClick={() => window.close()}
          disabled={saving}
          style={{
            padding: '8px 16px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            background: 'white',
            cursor: 'pointer'
          }}
        >
          Abbrechen
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '8px 16px',
            border: 'none',
            borderRadius: '4px',
            background: '#28a745',
            color: 'white',
            fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer'
          }}
        >
          {saving ? 'Speichert...' : 'Speichern'}
        </button>
      </div>
    </div>
  );
};
