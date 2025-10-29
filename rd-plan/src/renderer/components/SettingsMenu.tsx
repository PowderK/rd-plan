import React, { useState, useEffect } from 'react';

interface SettingsMenuProps {
    onClose: () => void;
}

const SettingsMenu: React.FC<SettingsMenuProps> = ({ onClose }) => {
    const [rescueStation, setRescueStation] = useState('');
    const [year, setYear] = useState(new Date().getFullYear());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [shiftTypes, setShiftTypes] = useState<{ id: number, code: string, description: string }[]>([]);
    const [newType, setNewType] = useState({ code: '', description: '' });
    const [editType, setEditType] = useState<{ id: number, code: string, description: string } | null>(null);
    const [shiftTypesLoading, setShiftTypesLoading] = useState(true);
    const [numRTW, setNumRTW] = useState<number>(1);
    const [nef, setNef] = useState<boolean>(false);
    const [itw, setItw] = useState<boolean>(false);
    const [department, setDepartment] = useState<number>(1);
  const [auswertungByType, setAuswertungByType] = useState<Record<string, 'off'|'tag'|'nacht'|'24h'>>({});
  const [customDropdownValues, setCustomDropdownValues] = useState<string>('');

    useEffect(() => {
        (async () => {
            const value = await (window as any).api.getSetting('rescueStation');
            if (value) setRescueStation(value);
            const y = await (window as any).api.getSetting('year');
            if (y) setYear(Number(y));
            const types = await (window as any).api.getShiftTypes();
            setShiftTypes(types);
            const nRTW = await (window as any).api.getSetting('numRTW');
            if (nRTW) setNumRTW(Number(nRTW));
            const nefVal = await (window as any).api.getSetting('nef');
            if (nefVal) setNef(nefVal === 'true');
            const itwVal = await (window as any).api.getSetting('itw');
            if (itwVal) setItw(itwVal === 'true');
      // load per-shift-type auswertung settings
      const map: Record<string, 'off'|'tag'|'nacht'|'24h'> = {};
      for (const t of types) {
        try {
          const v = await (window as any).api.getSetting(`auswertung_${t.code}`);
          map[t.code] = (v || 'off') as any;
        } catch (e) {
          map[t.code] = 'off';
        }
      }
      setAuswertungByType(map);
            const dep = await (window as any).api.getSetting('department');
            if (dep) setDepartment(Number(dep));
      const custom = await (window as any).api.getSetting('customDropdownValues');
      if (custom) setCustomDropdownValues(String(custom));
            setShiftTypesLoading(false);
            setLoading(false);
        })();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        await (window as any).api.setSetting('rescueStation', rescueStation);
        await (window as any).api.setSetting('year', String(year));
        await (window as any).api.setSetting('numRTW', String(numRTW));
        await (window as any).api.setSetting('nef', String(nef));
        await (window as any).api.setSetting('itw', String(itw));
        await (window as any).api.setSetting('department', String(department));
      await (window as any).api.setSetting('customDropdownValues', String(customDropdownValues || ''));
      // save per-shift-type auswertung settings
      for (const code of Object.keys(auswertungByType)) {
        await (window as any).api.setSetting(`auswertung_${code}`, auswertungByType[code]);
      }
        setSaving(false);
        onClose();
    };

  const handleAddType = async () => {
        if (!newType.code.trim() || !newType.description.trim()) return;
        await (window as any).api.addShiftType(newType);
    // set default auswertung for the new type
    setAuswertungByType(prev => ({ ...prev, [newType.code]: 'off' }));
    try { await (window as any).api.setSetting(`auswertung_${newType.code}`, 'off'); } catch (e) { /* ignore */ }
    setNewType({ code: '', description: '' });
    setShiftTypes(await (window as any).api.getShiftTypes());
    };
  const handleEditType = (type: any) => setEditType({ ...type, origCode: type.code });
    const handleUpdateType = async () => {
    if (!editType || !editType.code.trim() || !editType.description.trim()) return;
    const origCode = (editType as any).origCode || editType.code;
    await (window as any).api.updateShiftType(editType);
    // if code changed, move auswertung setting
    const newCode = editType.code;
    const prevMap = { ...(auswertungByType || {}) };
    if (origCode !== newCode) {
      const val = prevMap[origCode] || 'off';
      prevMap[newCode] = val;
      prevMap[origCode] = 'off';
      setAuswertungByType(prevMap);
      try { await (window as any).api.setSetting(`auswertung_${newCode}`, val); } catch (e) {}
      try { await (window as any).api.setSetting(`auswertung_${origCode}`, 'off'); } catch (e) {}
    }
    // persist current auswertung for newCode
    try { await (window as any).api.setSetting(`auswertung_${newCode}`, prevMap[newCode] || 'off'); } catch (e) {}
    setEditType(null);
    setShiftTypes(await (window as any).api.getShiftTypes());
    };
    const handleDeleteType = async (id: number) => {
        await (window as any).api.deleteShiftType(id);
        setShiftTypes(await (window as any).api.getShiftTypes());
    };

    if (loading) return <div className="settings-menu"><p>Lade Einstellungen ...</p></div>;

    return (
        <div className="settings-menu">
            <h2>Einstellungen</h2>
            <label>
                Rettungswache:
                <input
                    type="text"
                    value={rescueStation}
                    onChange={e => setRescueStation(e.target.value)}
                    style={{ marginLeft: 8 }}
                />
            </label>
            <label>
                Jahr:
                <input
                    type="number"
                    value={year}
                    min={2020}
                    max={2100}
                    onChange={e => setYear(Number(e.target.value))}
                    style={{ marginLeft: 8, width: 80 }}
                />
            </label>
            <label>
                Anzahl RTWs:
                <input
                    type="number"
                    min={1}
                    max={10}
                    value={numRTW}
                    onChange={e => setNumRTW(Number(e.target.value))}
                    style={{ marginLeft: 8, width: 60 }}
                />
            </label>
            <label style={{ marginLeft: 16 }}>
                NEF:
                <input
                    type="checkbox"
                    checked={nef}
                    onChange={e => setNef(e.target.checked)}
                    style={{ marginLeft: 8 }}
                />
            </label>
            <label style={{ marginLeft: 16 }}>
                ITW:
                <input
                    type="checkbox"
                    checked={itw}
                    onChange={e => setItw(e.target.checked)}
                    style={{ marginLeft: 8 }}
                />
            </label>
            <label style={{ marginLeft: 16 }}>
                Abteilung:
                <select value={department} onChange={e => setDepartment(Number(e.target.value))} style={{ marginLeft: 8 }}>
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                    <option value={3}>3</option>
                </select>
            </label>
            <div style={{ marginTop: 16 }}>
                <button onClick={handleSave} disabled={saving}>
                    {saving ? 'Speichern ...' : 'Speichern'}
                </button>
                <button onClick={onClose} style={{ marginLeft: 8 }}>Abbrechen</button>
            </div>
      {/* per-shift-type auswertung selector will be rendered as a column in the Dienstarten table below */}
            <div style={{ marginTop: 24, borderTop: '1px solid #eee', paddingTop: 12 }}>
                <h3>Dienstarten</h3>
                {shiftTypesLoading ? <div>Lade Dienstarten ...</div> : (
                  <>
                    {editType && (
                      <div style={{ marginBottom: 8 }}>
                        <button onClick={handleUpdateType} style={{ marginRight: 8 }}>Speichern</button>
                        <button onClick={() => setEditType(null)} style={{ marginRight: 8 }}>Abbrechen</button>
                        <button onClick={() => { if (editType) handleDeleteType(editType.id); }} style={{ color: 'red' }}>Löschen</button>
                      </div>
                    )}
                    <table style={{ width: '100%', marginBottom: 8 }}>
                    <thead>
                      <tr>
                        <th style={{ width: 60 }}>Kürzel</th>
                        <th>Beschreibung</th>
                        <th style={{ width: 220 }}>Auswertung</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {shiftTypes.map(type => (
                        <tr key={type.id}>
                          {editType && editType.id === type.id ? (
                            <>
                              <td>
                                <input
                                  value={editType.code}
                                  onChange={e => setEditType({ ...editType, code: e.target.value })}
                                  maxLength={4}
                                  style={{ width: 50 }}
                                />
                              </td>
                              <td>
                                <input
                                  value={editType.description}
                                  onChange={e => setEditType({ ...editType, description: e.target.value })}
                                />
                              </td>
                              <td>
                                <select
                                  value={auswertungByType[(editType as any).origCode || editType.code] || auswertungByType[type.code] || 'off'}
                                  onChange={e => {
                                    const key = (editType as any).origCode || editType.code || type.code;
                                    const val = e.target.value as any;
                                    setAuswertungByType(prev => ({ ...prev, [key]: val }));
                                  }}
                                >
                                  <option value="off">Aus</option>
                                  <option value="tag">Tag</option>
                                  <option value="nacht">Nacht</option>
                                  <option value="24h">24h</option>
                                </select>
                              </td>
                                <td />
                            </>
                          ) : (
                            <>
                              <td>{type.code}</td>
                              <td>{type.description}</td>
                              <td>
                                {(() => {
                                  const v = auswertungByType[type.code] || 'off';
                                  switch (v) {
                                    case 'tag': return 'Tag';
                                    case 'nacht': return 'Nacht';
                                    case '24h': return '24h';
                                    default: return 'Aus';
                                  }
                                })()}
                              </td>
                              <td>
                                <button onClick={() => handleEditType(type)} style={{ marginRight: 8 }}>Bearbeiten</button>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                      <tr>
                        <td>
                          <input
                            value={editType ? '' : newType.code}
                            onChange={e => {
                              const v = e.target.value;
                              setNewType({ ...newType, code: v });
                              // ensure there is an auswertung entry for the typed code
                              setAuswertungByType(prev => prev[v] ? prev : ({ ...prev, [v]: 'off' }));
                            }}
                            maxLength={4}
                            style={{ width: 50 }}
                            disabled={!!editType}
                          />
                        </td>
                        <td>
                          <input
                            value={editType ? '' : newType.description}
                            onChange={e => setNewType({ ...newType, description: e.target.value })}
                            disabled={!!editType}
                          />
                        </td>
                        <td>
                          {/* Auswertung select for add/edit row */}
                          <select
                            value={editType ? 'off' : (auswertungByType[newType.code] || 'off')}
                            onChange={e => {
                              const val = e.target.value as any;
                              setAuswertungByType(prev => ({ ...prev, [newType.code]: val }));
                            }}
                            disabled={!!editType}
                          >
                            <option value="off">Aus</option>
                            <option value="tag">Tag</option>
                            <option value="nacht">Nacht</option>
                            <option value="24h">24h</option>
                          </select>
                        </td>
                        <td>
                          {!editType && (
                            <button onClick={handleAddType}>Hinzufügen</button>
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                    </>
                )}
        <div style={{ marginTop: 12 }}>
          <h4>Eigene Dropdown-Werte</h4>
          <p>Trage hier zeilenweise die Werte ein, die im Dropdown verfügbar sein sollen (z. B. Kürzel oder Namen). Leerzeilen werden ignoriert.</p>
          <textarea value={customDropdownValues} onChange={e => setCustomDropdownValues(e.target.value)} style={{ width: '100%', height: 120 }} />
        </div>
            </div>
          </div>
    );
};

export default SettingsMenu;