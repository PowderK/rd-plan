import React, { useEffect, useState } from 'react';
import styles from './MonthTabs.module.css';

interface MonthTabsProps {
    currentMonth: number;
    onMonthChange: (month: number) => void;
    personnel: { id: number; name: string; vorname: string; fahrzeugfuehrer?: boolean; nef?: boolean }[];
    azubis: { id: number; name: string; vorname: string; lehrjahr: number }[];
    roster: Record<string, Record<string, { value: string; type: string }>>;
    year: number;
    shiftPattern: string[];
    onRosterChanged?: () => void;
    onEntryAssigned?: (key: string, date: string, value: string, type: string) => void;
}

const months = [
    'Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'
];

const MonthTabs: React.FC<MonthTabsProps> = ({ currentMonth, onMonthChange, personnel, azubis, roster, year, shiftPattern, onRosterChanged, onEntryAssigned }) => {
    const [department, setDepartment] = useState<number>(1);
    const [localRoster, setLocalRoster] = useState(roster || {} as Record<string, Record<string, { value: string; type: string }>>);
    const [numRTW, setNumRTW] = useState<number>(1);
    const [nefEnabled, setNefEnabled] = useState<boolean>(false);
    const [itwEnabled, setItwEnabled] = useState<boolean>(false);
    const [customDropdownValues, setCustomDropdownValues] = useState<string[]>([]);
    const [shiftTypes, setShiftTypes] = useState<{ id: number, code: string, description: string }[]>([]);
    const [auswertungByType, setAuswertungByType] = useState<Record<string, 'off'|'tag'|'nacht'|'24h'>>({});
    const [days, setDays] = useState<{ date: string; weekday: string; day: number; dayOfYear: number }[]>([]);

    useEffect(() => {
        const loadSettingsAndShiftTypes = async () => {
            const dep = await (window as any).api.getSetting('department');
            if (dep) setDepartment(Number(dep));
            const n = await (window as any).api.getSetting('numRTW');
            if (n) setNumRTW(Number(n));
            const nefVal = await (window as any).api.getSetting('nef');
            setNefEnabled(nefVal === 'true' || nefVal === '1');
            const itwVal = await (window as any).api.getSetting('itw');
            setItwEnabled(itwVal === 'true' || itwVal === '1');
            const custom = await (window as any).api.getSetting('customDropdownValues');
            if (custom) setCustomDropdownValues(String(custom).split('\n').map(s => s.trim()).filter(Boolean));
            // load shift types and per-type auswertung settings
            try {
                const types = await (window as any).api.getShiftTypes();
                if (types && Array.isArray(types)) {
                    setShiftTypes(types);
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
                }
            } catch (e) { /* ignore */ }
        };

        loadSettingsAndShiftTypes();
        // Reload when settings change (e.g. new shift type added or auswertung_* updated)
        const onSettingsUpdated = async () => {
            try {
                console.log('[MonthTabs] settings-updated received, reloading shiftTypes and auswertung settings');
                await loadSettingsAndShiftTypes();
            } catch (e) { console.warn('[MonthTabs] error reloading settings', e); }
        };
        (window as any).api?.onSettingsUpdated?.(onSettingsUpdated);
        window.addEventListener('message', (e: any) => { if (e && e.data === 'settings-updated') onSettingsUpdated(); });
        return () => {
            (window as any).api?.offSettingsUpdated?.(onSettingsUpdated);
            window.removeEventListener('message', (e: any) => { if (e && e.data === 'settings-updated') onSettingsUpdated(); });
        };
    }, []);

    useEffect(() => setLocalRoster(roster || {}), [roster]);

    useEffect(() => {
        const daysInMonth = new Date(year, currentMonth + 1, 0).getDate();
        const daysArr: { date: string; weekday: string; day: number; dayOfYear: number }[] = [];
        // compute dayOfYear base by summing days of previous months
        let dayOfYearBase = 0;
        for (let m = 0; m < currentMonth; ++m) {
            dayOfYearBase += new Date(year, m + 1, 0).getDate();
        }
        for (let d = 1; d <= daysInMonth; ++d) {
            const idx = dayOfYearBase + (d - 1);
            const local = new Date(year, currentMonth, d);
            // Only include days that match the shiftPattern for this department (if provided)
            const schicht = shiftPattern && shiftPattern.length ? shiftPattern[(idx % shiftPattern.length)] : undefined;
            if (schicht === undefined || String(department) === schicht) {
                const iso = new Date(Date.UTC(year, currentMonth, d)).toISOString().slice(0, 10);
                const weekday = local.toLocaleDateString('de-DE', { weekday: 'short' });
                daysArr.push({ date: iso, weekday, day: d, dayOfYear: idx });
            }
        }
        setDays(daysArr);
    }, [currentMonth, year, department, shiftPattern]);

    const handleAssign = async (date: string, dayIdx: number, value: string, slotId?: string) => {
        if (!value) return;
        // Freitext ist in MonthTabs deaktiviert (nur im Dienstplan erlaubt)
        const [t, idStr] = value.split(':');
        const pid = Number(idStr);
        const ptype = t === 'a' ? 'azubi' : 'person';
        try {
            const type = slotId ? slotId : 'dropdown';
            console.log('[MonthTabs] handleAssign', { personId: pid, personType: ptype, date, slotType: type, dayIdx });
            // Nur Slot (type) setzen, Dienstcode (value) unverändert lassen
            await (window as any).api.assignSlot({ personId: pid, personType: ptype, date, slotType: type });
            // Update localRoster immediately so UI shows selection without waiting for full reload
            const key = ptype === 'person' ? `p_${pid}` : `a_${pid}`;
            setLocalRoster(prev => ({
                ...prev,
                [key]: { ...(prev[key] || {}), [date]: { ...(prev[key]?.[date] || {}), type } }
            }));
            // Notify parent immediately so App can also update its roster state
            if (onEntryAssigned) onEntryAssigned(key, date, (localRoster[key]?.[date]?.value || ''), type);
            // Small debug snapshot
            console.log('[MonthTabs][Debug] localRoster updated', { key, date, value: 'V', type });
            if (onRosterChanged) onRosterChanged();
            // Hinweis: Doppelbelegung ist implizit verhindert, da pro Person/Datum nur ein type gespeichert wird
        } catch (err) {
            console.error('Fehler beim Speichern', err);
        }
    };

    return (
        <div>
            <div style={{ padding: 8 }}><strong>Neue Dropdowns aktiv</strong></div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                {months.map((m, i) => <button key={i} onClick={() => onMonthChange(i)} style={{ fontWeight: currentMonth === i ? 'bold' : 'normal' }}>{m}</button>)}
            </div>

            <div>
                {days.map(d => {
                    // Helper: ermittle Dienstcode bevorzugt aus localRoster (falls vorhanden) sonst aus roster;
                    // nur Dienst, wenn der Code in den konfigurierten Shift-Types existiert ('' zählt nicht).
                    const getDutyCodeFor = (key: string): string => {
                        const base = (roster && (roster as any)[key]) || {};
                        const local = (localRoster && (localRoster as any)[key]) || {};
                        const l = local[d.date] as any;
                        const b = base[d.date] as any;
                        const lv = l && typeof l.value !== 'undefined' ? String(l.value).trim() : '';
                        const bv = b && typeof b.value !== 'undefined' ? String(b.value).trim() : '';
                        // 'V' nicht pauschal ignorieren: wenn 'V' (oder ein anderer Code) in shift_types existiert,
                        // soll er gemäß der Einstellung (z. B. 24h) ausgewertet werden.
                        const pick = lv ? lv : (bv ? bv : '');
                        if (!pick) return '';
                        // Nur Dienst haben, wenn der Code in den vorhandenen Shift-Types existiert
                        const codes = (shiftTypes || []).map(t => t.code);
                        return codes.includes(pick) ? pick : '';
                    };
                    const allowedByAuswertung = (code: string, when: 'tag'|'nacht'|'any'): boolean => {
                        if (!code) return false;
                        const mode = (auswertungByType[code] || 'off') as 'off'|'tag'|'nacht'|'24h';
                        if (mode === 'off') return false;
                        if (when === 'any') return true; // NEF hat nur eine Zeile
                        if (mode === '24h') return true;
                        if (mode === 'tag' && when === 'tag') return true;
                        if (mode === 'nacht' && when === 'nacht') return true;
                        return false;
                    };

                    // helper to find currently assigned person for a slot
                    const getAssignedValue = (slotId: string) => {
                        try {
                            // search merged roster (roster prop has precedence but localRoster overrides)
                            const mergedKeys = Array.from(new Set([...(Object.keys(localRoster || {})), ...(Object.keys(roster || {}))]));
                            for (const key of mergedKeys) {
                                const entry = (localRoster && localRoster[key] && localRoster[key][d.date]) || (roster && roster[key] && roster[key][d.date]);
                                if (!entry) continue;
                                const t = String(entry.type || '');
                                // Nur explizit gespeicherte Slot-Zuweisungen zählen: exakter Typ-Match
                                if (t === slotId) {
                                    if (key.startsWith('p_')) return `p:${key.slice(2)}`;
                                    if (key.startsWith('a_')) return `a:${key.slice(2)}`;
                                    return `p:${key}`;
                                }
                            }
                        } catch (e) { /* ignore */ }
                        return '';
                    };

                    const findPersonLabelByValue = (val: string) => {
                        if (!val) return '';
                        try {
                            const [t, idStr] = val.split(':');
                            const id = Number(idStr);
                            if (t === 'p') {
                                const p = personnel.find(x => x.id === id);
            // Doppelbelegung: nicht notwendig zu bereinigen – type pro Person/Datum wird mit neuer Auswahl überschrieben
                                return p ? `${p.name}${p.vorname ? `, ${p.vorname}` : ''}` : `Person ${id}`;
                            }
                            if (t === 'a') {
                                const a = azubis.find(x => x.id === id);
                                return a ? `${a.name}${a.vorname ? `, ${a.vorname}` : ''} (Azubi)` : `Azubi ${id}`;
                            }
                        } catch (e) { /* ignore */ }
                        return val;
                    };

                    const selectStyle: React.CSSProperties = { minWidth: 160, height: 30, padding: '4px 6px' };
                    // Entfernt die aktuell zugewiesene Person für einen Slot per Tastatur (Backspace/Entf)
                    const clearAssignedForSlot = async (slotId: string) => {
                        const currentVal = getAssignedValue(slotId);
                        if (!currentVal) return;
                        try {
                            const [t, idStr] = currentVal.split(':');
                            const pid = Number(idStr);
                            const ptype = t === 'a' ? 'azubi' : 'person';
                            await (window as any).api.assignSlot({ personId: pid, personType: ptype, date: d.date, slotType: '' });
                            const key = ptype === 'person' ? `p_${pid}` : `a_${pid}`;
                            setLocalRoster(prev => {
                                const before = prev[key] || {} as any;
                                const dayEntry = { ...(before[d.date] || {}) } as any;
                                if (dayEntry && dayEntry.type) delete dayEntry.type;
                                return { ...prev, [key]: { ...before, [d.date]: dayEntry } } as any;
                            });
                            if (onEntryAssigned) onEntryAssigned(key, d.date, (localRoster[key]?.[d.date]?.value || ''), '');
                            if (onRosterChanged) onRosterChanged();
                        } catch (e) {
                            console.warn('[MonthTabs] clearAssignedForSlot failed', e);
                        }
                    };
                    return (
                        <div key={d.day} style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 6 }}>
                            <div style={{ width: 140 }}>{d.day}. {months[currentMonth]} <small>({d.weekday})</small></div>
                            <div style={{ flex: 1 }}>
                                {/* RTW Abschnitte: je RTW Spalten Fahrzeugführer | Maschinist | Azubi und je zwei Zeilen (Tag/Nacht) */}
                                <div className={styles.container}>
                                    {Array.from({ length: numRTW }).map((_, rIdx) => (
                                        <div key={`rtw_${rIdx}`} className={styles.rtwWrapper}>
                                            <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>RTW{rIdx + 1}</div>
                                            {/* Spalten-Header */}
                                            <div className={styles.rtwInner}>
                                                <div className={styles.headerLabel}>Fahrzeugführer</div>
                                                <div className={styles.headerLabel}>Maschinist</div>
                                                <div className={styles.headerLabel}>Azubi</div>
                                            </div>
                                            {/* Zeile: Tag */}
                                            <div className={styles.rtwInner}>
                                                {(() => {
                                                    const slotId = `rtw${rIdx + 1}_tag_1`;
                                                    const value = getAssignedValue(slotId);
                                                    const optionsP = personnel
                                                        .filter(p => allowedByAuswertung(getDutyCodeFor(`p_${p.id}`), 'tag') && !!p.fahrzeugfuehrer)
                                                        .map(p => ({ value: `p:${p.id}`, label: `${p.name}${p.vorname ? `, ${p.vorname}` : ''}` }));
                                                    const renderOptions = (() => {
                                                        if (value && !optionsP.some(o => o.value === value)) {
                                                            const label = findPersonLabelByValue(value);
                                                            return [{ value, label }, ...optionsP];
                                                        }
                                                        return optionsP;
                                                    })();
                                                    return (
                                                        <select className={styles.select} value={value} 
                                                            onChange={e => { const v = e.target.value; if (v === '') { e.preventDefault(); e.stopPropagation(); (e.currentTarget as HTMLSelectElement).blur(); clearAssignedForSlot(slotId); } else { handleAssign(d.date, d.dayOfYear, v, slotId); } }}
                                                            onKeyDown={e => { if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); e.stopPropagation(); (e.currentTarget as HTMLSelectElement).blur(); clearAssignedForSlot(slotId); } }}>
                                                            <option value=""></option>
                                                            {renderOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                                        </select>
                                                    );
                                                })()}
                                                {(() => {
                                                    const slotId = `rtw${rIdx + 1}_tag_2`;
                                                    const value = getAssignedValue(slotId);
                                                    const optionsP = personnel
                                                        .filter(p => allowedByAuswertung(getDutyCodeFor(`p_${p.id}`), 'tag'))
                                                        .map(p => ({ value: `p:${p.id}`, label: `${p.name}${p.vorname ? `, ${p.vorname}` : ''}` }));
                                                    const optionsA = azubis
                                                        .filter(a => allowedByAuswertung(getDutyCodeFor(`a_${a.id}`), 'tag'))
                                                        .map(a => ({ value: `a:${a.id}`, label: `${a.name}${a.vorname ? `, ${a.vorname}` : ''} (Azubi)` }));
                                                    const options = [...optionsP, ...optionsA];
                                                    const renderOptions = (() => {
                                                        if (value && !options.some(o => o.value === value)) {
                                                            const label = findPersonLabelByValue(value);
                                                            return [{ value, label }, ...options];
                                                        }
                                                        return options;
                                                    })();
                                                    return (
                                                        <select className={styles.select} value={value} 
                                                            onChange={e => { const v = e.target.value; if (v === '') { e.preventDefault(); e.stopPropagation(); (e.currentTarget as HTMLSelectElement).blur(); clearAssignedForSlot(slotId); } else { handleAssign(d.date, d.dayOfYear, v, slotId); } }}
                                                            onKeyDown={e => { if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); e.stopPropagation(); (e.currentTarget as HTMLSelectElement).blur(); clearAssignedForSlot(slotId); } }}>
                                                            <option value=""></option>
                                                            {renderOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                                        </select>
                                                    );
                                                })()}
                                                {(() => {
                                                    const slotId = `rtw${rIdx + 1}_tag_3`;
                                                    const value = getAssignedValue(slotId);
                                                    const optionsA = azubis
                                                        .filter(a => allowedByAuswertung(getDutyCodeFor(`a_${a.id}`), 'tag'))
                                                        .map(a => ({ value: `a:${a.id}`, label: `${a.name}${a.vorname ? `, ${a.vorname}` : ''} (Azubi)` }));
                                                    const renderOptions = (() => {
                                                        if (value && !optionsA.some(o => o.value === value)) {
                                                            const label = findPersonLabelByValue(value);
                                                            return [{ value, label }, ...optionsA];
                                                        }
                                                        return optionsA;
                                                    })();
                                                    return (
                                                        <select className={styles.select} value={value} 
                                                            onChange={e => { const v = e.target.value; if (v === '') { e.preventDefault(); e.stopPropagation(); (e.currentTarget as HTMLSelectElement).blur(); clearAssignedForSlot(slotId); } else { handleAssign(d.date, d.dayOfYear, v, slotId); } }}
                                                            onKeyDown={e => { if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); e.stopPropagation(); (e.currentTarget as HTMLSelectElement).blur(); clearAssignedForSlot(slotId); } }}>
                                                            <option value=""></option>
                                                            {renderOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                                        </select>
                                                    );
                                                })()}
                                            </div>
                                            {/* Zeile: Nacht */}
                                            <div className={styles.rtwInner}>
                                                {(() => {
                                                    const slotId = `rtw${rIdx + 1}_nacht_1`;
                                                    const value = getAssignedValue(slotId);
                                                    const optionsP = personnel
                                                        .filter(p => allowedByAuswertung(getDutyCodeFor(`p_${p.id}`), 'nacht') && !!p.fahrzeugfuehrer)
                                                        .map(p => ({ value: `p:${p.id}`, label: `${p.name}${p.vorname ? `, ${p.vorname}` : ''}` }));
                                                    const renderOptions = (() => {
                                                        if (value && !optionsP.some(o => o.value === value)) {
                                                            const label = findPersonLabelByValue(value);
                                                            return [{ value, label }, ...optionsP];
                                                        }
                                                        return optionsP;
                                                    })();
                                                    return (
                                                        <select className={styles.select} value={value} 
                                                            onChange={e => { const v = e.target.value; if (v === '') { e.preventDefault(); e.stopPropagation(); (e.currentTarget as HTMLSelectElement).blur(); clearAssignedForSlot(slotId); } else { handleAssign(d.date, d.dayOfYear, v, slotId); } }}
                                                            onKeyDown={e => { if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); e.stopPropagation(); (e.currentTarget as HTMLSelectElement).blur(); clearAssignedForSlot(slotId); } }}>
                                                            <option value=""></option>
                                                            {renderOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                                        </select>
                                                    );
                                                })()}
                                                {(() => {
                                                    const slotId = `rtw${rIdx + 1}_nacht_2`;
                                                    const value = getAssignedValue(slotId);
                                                    const optionsP = personnel
                                                        .filter(p => allowedByAuswertung(getDutyCodeFor(`p_${p.id}`), 'nacht'))
                                                        .map(p => ({ value: `p:${p.id}`, label: `${p.name}${p.vorname ? `, ${p.vorname}` : ''}` }));
                                                    const optionsA = azubis
                                                        .filter(a => allowedByAuswertung(getDutyCodeFor(`a_${a.id}`), 'nacht'))
                                                        .map(a => ({ value: `a:${a.id}`, label: `${a.name}${a.vorname ? `, ${a.vorname}` : ''} (Azubi)` }));
                                                    const options = [...optionsP, ...optionsA];
                                                    const renderOptions = (() => {
                                                        if (value && !options.some(o => o.value === value)) {
                                                            const label = findPersonLabelByValue(value);
                                                            return [{ value, label }, ...options];
                                                        }
                                                        return options;
                                                    })();
                                                    return (
                                                        <select className={styles.select} value={value} 
                                                            onChange={e => { const v = e.target.value; if (v === '') { e.preventDefault(); e.stopPropagation(); (e.currentTarget as HTMLSelectElement).blur(); clearAssignedForSlot(slotId); } else { handleAssign(d.date, d.dayOfYear, v, slotId); } }}
                                                            onKeyDown={e => { if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); e.stopPropagation(); (e.currentTarget as HTMLSelectElement).blur(); clearAssignedForSlot(slotId); } }}>
                                                            <option value=""></option>
                                                            {renderOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                                        </select>
                                                    );
                                                })()}
                                                {(() => {
                                                    const slotId = `rtw${rIdx + 1}_nacht_3`;
                                                    const value = getAssignedValue(slotId);
                                                    const optionsA = azubis
                                                        .filter(a => allowedByAuswertung(getDutyCodeFor(`a_${a.id}`), 'nacht'))
                                                        .map(a => ({ value: `a:${a.id}`, label: `${a.name}${a.vorname ? `, ${a.vorname}` : ''} (Azubi)` }));
                                                    const renderOptions = (() => {
                                                        if (value && !optionsA.some(o => o.value === value)) {
                                                            const label = findPersonLabelByValue(value);
                                                            return [{ value, label }, ...optionsA];
                                                        }
                                                        return optionsA;
                                                    })();
                                                    return (
                                                        <select className={styles.select} value={value} 
                                                            onChange={e => handleAssign(d.date, d.dayOfYear, e.target.value, slotId)}
                                                            onKeyDown={e => { if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); clearAssignedForSlot(slotId); } }}>
                                                            <option value=""></option>
                                                            {renderOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                                        </select>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    ))}

                                    {/* NEF Abschnitt: eine Zeile, Spalten: Assistent | Azubi */}
                                    {nefEnabled && (
                                        <div className={styles.rtwWrapper}>
                                            <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>NEF</div>
                                            <div className={styles.nef}>
                                                <div>
                                                    <div className={styles.headerLabel}>NEF Assistent</div>
                                                    {(() => {
                                                        const slotId = 'nef_assist';
                                                        const value = getAssignedValue(slotId);
                                                        const optionsP = personnel
                                                            .filter(p => !!p.nef && allowedByAuswertung(getDutyCodeFor(`p_${p.id}`), 'any'))
                                                            .map(p => ({ value: `p:${p.id}`, label: `${p.name}${p.vorname ? `, ${p.vorname}` : ''}` }));
                                                        const renderOptions = (() => {
                                                            if (value && !optionsP.some(o => o.value === value)) {
                                                                const label = findPersonLabelByValue(value);
                                                                return [{ value, label }, ...optionsP];
                                                            }
                                                            return optionsP;
                                                        })();
                                                        return (
                                                            <select className={styles.select} value={value} 
                                                                onChange={e => { const v = e.target.value; if (v === '') { e.preventDefault(); e.stopPropagation(); (e.currentTarget as HTMLSelectElement).blur(); clearAssignedForSlot(slotId); } else { handleAssign(d.date, d.dayOfYear, v, slotId); } }}
                                                                onKeyDown={e => { if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); e.stopPropagation(); (e.currentTarget as HTMLSelectElement).blur(); clearAssignedForSlot(slotId); } }}>
                                                                <option value=""></option>
                                                                {renderOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                                            </select>
                                                        );
                                                    })()}
                                                </div>
                                                <div>
                                                    <div className={styles.headerLabel}>Azubi</div>
                                                    {(() => {
                                                        const slotId = 'nef_azubi';
                                                        const value = getAssignedValue(slotId);
                                                        const optionsA = azubis
                                                            .filter(a => allowedByAuswertung(getDutyCodeFor(`a_${a.id}`), 'any'))
                                                            .map(a => ({ value: `a:${a.id}`, label: `${a.name}${a.vorname ? `, ${a.vorname}` : ''} (Azubi)` }));
                                                        const renderOptions = (() => {
                                                            if (value && !optionsA.some(o => o.value === value)) {
                                                                const label = findPersonLabelByValue(value);
                                                                return [{ value, label }, ...optionsA];
                                                            }
                                                            return optionsA;
                                                        })();
                                                        return (
                                                            <select className={styles.select} value={value} 
                                                                onChange={e => handleAssign(d.date, d.dayOfYear, e.target.value, slotId)}
                                                                onKeyDown={e => { if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); e.stopPropagation(); (e.currentTarget as HTMLSelectElement).blur(); clearAssignedForSlot(slotId); } }}>
                                                                <option value=""></option>
                                                                {renderOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                                            </select>
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* ITW Abschnitt: wenn aktiviert, Spalte "Besatzung" und 4 Zeilen */}
                                    {itwEnabled && (
                                        <div className={styles.rtwWrapper}>
                                            <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>ITW</div>
                                            <div className={styles.rtwInner}>
                                                <div className={styles.headerLabel}>Besatzung</div>
                                            </div>
                                            {Array.from({ length: 4 }).map((_, i) => (
                                                <div key={`itw_row_${i}`} className={styles.rtwInner}>
                                                    <select className={styles.select} value="" onChange={() => {}}>
                                                        <option value=""></option>
                                                    </select>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default MonthTabs;