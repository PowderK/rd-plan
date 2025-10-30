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
    deptPatternSeqs?: { startDate: string; pattern: string[] }[];
    onRosterChanged?: () => void;
    onEntryAssigned?: (key: string, date: string, value: string, type: string) => void;
}

const months = [
    'Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'
];

const MonthTabs: React.FC<MonthTabsProps> = ({ currentMonth, onMonthChange, personnel, azubis, roster, year, shiftPattern, deptPatternSeqs = [], onRosterChanged, onEntryAssigned }) => {
    const [department, setDepartment] = useState<number>(1);
    const [localRoster, setLocalRoster] = useState(roster || {} as Record<string, Record<string, { value: string; type: string }>>);
    const [rtwVehicles, setRtwVehicles] = useState<{ id: number; name: string }[]>([]);
    const [nefVehicles, setNefVehicles] = useState<{ id: number; name: string; occupancy_mode?: '24h' | 'tag' }[]>([]);
    const [itwEnabled, setItwEnabled] = useState<boolean>(false);
    const [shiftTypes, setShiftTypes] = useState<{ id: number, code: string, description: string }[]>([]);
    const [auswertungByType, setAuswertungByType] = useState<Record<string, 'off'|'tag'|'nacht'|'24h'|'itw'>>({});
    const [days, setDays] = useState<{ date: string; weekday: string; day: number; dayOfYear: number }[]>([]);
    const [itwDoctors, setItwDoctors] = useState<{ id: number; name: string }[]>([]);
    const [viewMode, setViewMode] = useState<'rtwnef' | 'itw'>('rtwnef');
    const [rtwNames, setRtwNames] = useState<string[]>([]);
    const [nefName, setNefName] = useState<string>('');
    const [rtwActivations, setRtwActivations] = useState<Record<number, boolean[]>>({});
    const [nefActivations, setNefActivations] = useState<Record<number, boolean[]>>({});
    const [itwPatternSeqs, setItwPatternSeqs] = useState<{ startDate: string; pattern: string[] }[]>([]);
    const [holidays, setHolidays] = useState<Set<string>>(new Set());
    // Zusätzliche ITW-Tage außerhalb der Schichtfolge (nur UI-state für aktuellen Monat)
    const [itwExtraDays, setItwExtraDays] = useState<Set<string>>(new Set());
    const [itwExtraInput, setItwExtraInput] = useState<string>('');

    useEffect(() => {
        const load = async () => {
            try {
                const dep = await (window as any).api.getSetting('department');
                if (dep) setDepartment(Number(dep));
            } catch {}
            try { const r = await (window as any).api.getRtwVehicles?.(); if (Array.isArray(r)) setRtwVehicles(r); } catch {}
            try { const n = await (window as any).api.getNefVehicles?.(); if (Array.isArray(n)) setNefVehicles(n); } catch {}
            // Monats-Aktivierungen laden (Standard true)
            try {
                const acts = await (window as any).api.getRtwVehicleActivations?.(year);
                const map: Record<number, boolean[]> = {};
                (acts || []).forEach((row: any) => {
                    const vid = Number(row.vehicleId);
                    const m = Number(row.month);
                    const arr = map[vid] || Array(12).fill(true);
                    arr[m - 1] = !!row.enabled;
                    map[vid] = arr;
                });
                setRtwActivations(map);
            } catch {}
            try {
                const acts = await (window as any).api.getNefVehicleActivations?.(year);
                const map: Record<number, boolean[]> = {};
                (acts || []).forEach((row: any) => {
                    const vid = Number(row.vehicleId);
                    const m = Number(row.month);
                    const arr = map[vid] || Array(12).fill(true);
                    arr[m - 1] = !!row.enabled;
                    map[vid] = arr;
                });
                setNefActivations(map);
            } catch {}
            try {
                const itwVal = await (window as any).api.getSetting('itw');
                setItwEnabled(itwVal === 'true' || itwVal === '1');
            } catch {}
            // ITW Sequenzen laden
            try {
                const norm = (arr: string[], len = 21) => (arr || []).slice(0,len).concat(Array(len).fill('')).slice(0,len).map(v => (v === 'IW' ? 'IW' : ''));
                const seqs = await (window as any).api.getItwPatterns?.();
                if (Array.isArray(seqs) && seqs.length > 0) {
                    const parsed = seqs.map((s: any) => ({ startDate: String(s.startDate), pattern: norm(String(s.pattern).split(',').map((x: string) => x.trim()), 21) }));
                    parsed.sort((a, b) => a.startDate.localeCompare(b.startDate));
                    setItwPatternSeqs(parsed);
                }
            } catch {}
            try {
                const types = await (window as any).api.getShiftTypes();
                setShiftTypes(types || []);
                const map: Record<string, 'off'|'tag'|'nacht'|'24h'|'itw'> = {};
                for (const t of (types || [])) {
                    const v = await (window as any).api.getSetting(`auswertung_${t.code}`);
                    map[t.code] = (v || 'off') as any;
                }
                setAuswertungByType(map);
            } catch {}
            try {
                const docs = await (window as any).api.getItwDoctors?.();
                if (Array.isArray(docs)) setItwDoctors(docs);
            } catch {}
            // Feiertage laden
            try {
                const list = await (window as any).api.getHolidaysForYear?.(year);
                const s = new Set<string>((list || []).map((h: any) => String(h.date)));
                setHolidays(s);
            } catch {}
        };
        load();
        const onSettingsUpdated = async () => {
            try {
                const y = await (window as any).api.getSetting('year');
                const yearNum = Number(y || new Date().getFullYear());
                // Fahrzeuge neu laden (z.B. nach Löschen)
                try { const r = await (window as any).api.getRtwVehicles?.(); if (Array.isArray(r)) setRtwVehicles(r); } catch {}
                try { const n = await (window as any).api.getNefVehicles?.(); if (Array.isArray(n)) setNefVehicles(n); } catch {}
                // Aktivierungen für das Settings-Jahr neu laden
                try {
                    const acts = await (window as any).api.getRtwVehicleActivations?.(yearNum);
                    const map: Record<number, boolean[]> = {};
                    (acts || []).forEach((row: any) => {
                        const vid = Number(row.vehicleId);
                        const m = Number(row.month);
                        const arr = map[vid] || Array(12).fill(true);
                        arr[m - 1] = !!row.enabled;
                        map[vid] = arr;
                    });
                    setRtwActivations(map);
                } catch {}
                try {
                    const acts = await (window as any).api.getNefVehicleActivations?.(yearNum);
                    const map: Record<number, boolean[]> = {};
                    (acts || []).forEach((row: any) => {
                        const vid = Number(row.vehicleId);
                        const m = Number(row.month);
                        const arr = map[vid] || Array(12).fill(true);
                        arr[m - 1] = !!row.enabled;
                        map[vid] = arr;
                    });
                    setNefActivations(map);
                } catch {}
                // ITW-Sequenzen aktualisieren
                try {
                    const norm = (arr: string[], len = 21) => (arr || []).slice(0,len).concat(Array(len).fill('')).slice(0,len).map(v => (v === 'IW' ? 'IW' : ''));
                    const seqs = await (window as any).api.getItwPatterns?.();
                    if (Array.isArray(seqs) && seqs.length > 0) {
                        const parsed = seqs.map((s: any) => ({ startDate: String(s.startDate), pattern: norm(String(s.pattern).split(',').map((x: string) => x.trim()), 21) }));
                        parsed.sort((a, b) => a.startDate.localeCompare(b.startDate));
                        setItwPatternSeqs(parsed);
                    }
                } catch {}
                // Feiertage für Settings-Jahr neu laden
                try {
                    const list = await (window as any).api.getHolidaysForYear?.(yearNum);
                    const s = new Set<string>((list || []).map((h: any) => String(h.date)));
                    setHolidays(s);
                } catch {}
            } catch {}
        };
        (window as any).api?.onSettingsUpdated?.(onSettingsUpdated);
        // Bei Dienstplan-Änderungen lokalen Roster aktualisieren (nur Delta ziehen wäre besser, hier einfacher Full Reload)
        const onDutyRosterUpdated = async () => {
            try {
                const yearSetting = await (window as any).api.getSetting('year');
                const useYear = Number(yearSetting || new Date().getFullYear());
                const entries = await (window as any).api.getDutyRoster(useYear);
                const rosterObj: Record<string, Record<string, { value: string; type: string }>> = {};
                (entries || []).forEach((e: any) => {
                    if (!e || !e.date) return;
                    let key = '';
                    if (e.personType === 'person') key = `p_${e.personId}`;
                    else if (e.personType === 'azubi') key = `a_${e.personId}`;
                    else if (e.personType === 'doctor') key = `d_${e.personId}`;
                    if (!key) return;
                    if (!rosterObj[key]) rosterObj[key] = {};
                    rosterObj[key][String(e.date)] = { value: e.value, type: e.type };
                });
                setLocalRoster(rosterObj);
            } catch (e) { console.warn('[MonthTabs] duty-roster-updated reload failed', e); }
        };
        (window as any).api?.onDutyRosterUpdated?.(onDutyRosterUpdated);
        return () => { (window as any).api?.offSettingsUpdated?.(onSettingsUpdated); };
    }, []);

    useEffect(() => setLocalRoster(roster || {}), [roster]);

    // Übernehme RTW Namen aus Fahrzeugliste
    useEffect(() => {
        setRtwNames((rtwVehicles || []).map(v => v.name || ''));
    }, [rtwVehicles]);

    useEffect(() => {
        const daysInMonth = new Date(year, currentMonth + 1, 0).getDate();
        const daysArr: { date: string; weekday: string; day: number; dayOfYear: number }[] = [];
        let base = 0;
        for (let m = 0; m < currentMonth; ++m) base += new Date(year, m + 1, 0).getDate();
        for (let d = 1; d <= daysInMonth; ++d) {
            const idx = base + (d - 1);
            const local = new Date(year, currentMonth, d);
            // Determine department day using deptPatternSeqs (gültig-ab + 21er Modulo)
            let depDay: string | undefined = undefined;
            if (Array.isArray(deptPatternSeqs) && deptPatternSeqs.length > 0) {
                const iso = new Date(Date.UTC(year, currentMonth, d)).toISOString().slice(0, 10);
                const seqs = [...deptPatternSeqs].sort((a,b) => a.startDate.localeCompare(b.startDate));
                let active = seqs[0];
                for (const s of seqs) { if (s.startDate <= iso) active = s; else break; }
                const start = new Date((active?.startDate || '1970-01-01') + 'T00:00:00Z');
                const cur = new Date(iso + 'T00:00:00Z');
                const diffDays = Math.floor((cur.getTime() - start.getTime()) / (1000*60*60*24));
                const pat = active?.pattern || [];
                depDay = pat.length ? pat[((diffDays % 21) + 21) % 21] : undefined;
            } else if (shiftPattern && shiftPattern.length) {
                depDay = shiftPattern[(idx % shiftPattern.length)];
            }
            if (depDay === undefined || String(department) === depDay) {
                const iso = new Date(Date.UTC(year, currentMonth, d)).toISOString().slice(0, 10);
                const weekday = local.toLocaleDateString('de-DE', { weekday: 'short' });
                daysArr.push({ date: iso, weekday, day: d, dayOfYear: idx });
            }
        }
        setDays(daysArr);
    }, [currentMonth, year, department, shiftPattern, JSON.stringify(deptPatternSeqs)]);

    // Reagiere auf Jahreswechsel: Aktivierungen neu laden
    useEffect(() => {
        const loadActs = async () => {
            try {
                const acts = await (window as any).api.getRtwVehicleActivations?.(year);
                const map: Record<number, boolean[]> = {};
                (acts || []).forEach((row: any) => {
                    const vid = Number(row.vehicleId);
                    const m = Number(row.month);
                    const arr = map[vid] || Array(12).fill(true);
                    arr[m - 1] = !!row.enabled;
                    map[vid] = arr;
                });
                setRtwActivations(map);
            } catch {}
            try {
                const acts = await (window as any).api.getNefVehicleActivations?.(year);
                const map: Record<number, boolean[]> = {};
                (acts || []).forEach((row: any) => {
                    const vid = Number(row.vehicleId);
                    const m = Number(row.month);
                    const arr = map[vid] || Array(12).fill(true);
                    arr[m - 1] = !!row.enabled;
                    map[vid] = arr;
                });
                setNefActivations(map);
            } catch {}
        };
        loadActs();
    }, [year]);

    // Bei Monatswechsel lokale Extra-Tage zurücksetzen
    useEffect(() => {
        setItwExtraDays(new Set());
        setItwExtraInput('');
    }, [currentMonth, year]);

    // Feiertage bei Jahreswechsel neu laden
    useEffect(() => {
        (async () => {
            try {
                const list = await (window as any).api.getHolidaysForYear?.(year);
                const s = new Set<string>((list || []).map((h: any) => String(h.date)));
                setHolidays(s);
            } catch {}
        })();
    }, [year]);

    const getDutyCodeForDate = (key: string, date: string): string => {
        try {
            const vLocal = (localRoster as any)?.[key]?.[date]?.value;
            const vGlobal = (roster as any)?.[key]?.[date]?.value;
            return (vLocal ?? vGlobal ?? '') as string;
        } catch { return ''; }
    };
    const allowedByAuswertung = (code: string, desired: 'tag'|'nacht'|'24h'|'any'): boolean => {
        if (desired === 'any') return true;
        const evalMode = auswertungByType[code] || 'off';
        if (desired === 'tag') return (evalMode === 'tag' || evalMode === '24h');
        if (desired === 'nacht') return (evalMode === 'nacht' || evalMode === '24h');
        if (desired === '24h') return evalMode === '24h';
        return false;
    };
    const getAssignedValueFor = (date: string, slotId: string): string => {
        const mergedKeys = Array.from(new Set([...(Object.keys(localRoster || {})), ...(Object.keys(roster || {}))]));
        for (const key of mergedKeys) {
            const entry = ((localRoster as any)?.[key]?.[date]) || ((roster as any)?.[key]?.[date]);
            if (!entry) continue;
            const t = String(entry.type || '');
            if (t === slotId) {
                if (key.startsWith('p_')) return `p:${key.slice(2)}`;
                if (key.startsWith('a_')) return `a:${key.slice(2)}`;
                return `p:${key}`;
            }
        }
        return '';
    };
    const findPersonLabelByValue = (val: string) => {
        if (!val) return '';
        try {
            const [t, idStr] = val.split(':');
            const id = Number(idStr);
            if (t === 'p') {
                const p = personnel.find(x => x.id === id);
                return p ? `${p.name}` : `Person ${id}`;
            }
            if (t === 'a') {
                const a = azubis.find(x => x.id === id);
                return a ? `${a.name}` : `Azubi ${id}`;
            }
            if (t === 'd') {
                const d = itwDoctors.find(x => x.id === id);
                return d ? `${d.name}` : `Arzt ${id}`;
            }
        } catch { /* ignore */ }
        return val;
    };

    const handleAssign = async (date: string, dayIdx: number, value: string, slotId?: string) => {
        if (!value) return;
        const [t, idStr] = value.split(':');
        const pid = Number(idStr);
        const ptype = t === 'a' ? 'azubi' : (t === 'd' ? 'doctor' : 'person');
        try {
            await (window as any).api.assignSlot({ personId: pid, personType: ptype, date, slotType: slotId || '' });
            const key = ptype === 'person' ? `p_${pid}` : (ptype === 'azubi' ? `a_${pid}` : `d_${pid}`);
            setLocalRoster(prev => {
                const before = prev[key] || {} as any;
                const dayEntry = { ...(before[date] || {}) } as any;
                dayEntry.type = slotId || '';
                return { ...prev, [key]: { ...before, [date]: dayEntry } } as any;
            });
            if (onEntryAssigned) onEntryAssigned(key, date, (localRoster[key]?.[date]?.value || ''), slotId || '');
            if (onRosterChanged) onRosterChanged();
        } catch (e) {
            console.warn('[MonthTabs] handleAssign failed', e);
        }
    };
    const clearAssignedForDate = async (slotId: string, date: string) => {
        const currentVal = getAssignedValueFor(date, slotId);
        if (!currentVal) return;
        try {
            const [t, idStr] = currentVal.split(':');
            const pid = Number(idStr);
            const ptype = t === 'a' ? 'azubi' : (t === 'd' ? 'doctor' : 'person');
            await (window as any).api.assignSlot({ personId: pid, personType: ptype, date, slotType: '' });
            const key = ptype === 'person' ? `p_${pid}` : (ptype === 'azubi' ? `a_${pid}` : `d_${pid}`);
            setLocalRoster(prev => {
                const before = prev[key] || {} as any;
                const dayEntry = { ...(before[date] || {}) } as any;
                if (dayEntry && dayEntry.type) delete dayEntry.type;
                return { ...prev, [key]: { ...before, [date]: dayEntry } } as any;
            });
            if (onEntryAssigned) onEntryAssigned(key, date, (localRoster[key]?.[date]?.value || ''), '');
            if (onRosterChanged) onRosterChanged();
        } catch (e) {
            console.warn('[MonthTabs] clearAssignedForDate failed', e);
        }
    };

    return (
        <div style={{ padding: 12 }}>
            {/* Sub‑Header: RTW/ITW Einteilung (Monat) - jetzt oberhalb der Tabs */}
            <div style={{ margin: '4px 0 10px 0' }}>
                <span style={{ fontSize: 18, fontWeight: 700 }}>
                    {viewMode === 'rtwnef' ? 'RTW Einteilung' : 'ITW Einteilung'} ({months[currentMonth]})
                </span>
            </div>
            {/* Monats-Tabs */}
            <div className={styles.tabs}>
                {months.map((m, i) => (
                    <button
                        key={i}
                        onClick={() => onMonthChange(i)}
                        className={`${styles.tab} ${currentMonth === i ? styles.tabActive : ''}`}
                    >
                        {m}
                    </button>
                ))}
            </div>
            {/* Ansichts-Umschalter */}
            <div className={styles.toggleGroup}>
                <button onClick={() => setViewMode('rtwnef')} className={styles.toggleBtn} style={{ background: viewMode === 'rtwnef' ? '#f3f4f6' : undefined }}>RTW/NEF</button>
                <button onClick={() => setViewMode('itw')} disabled={!itwEnabled} className={styles.toggleBtn} style={{ background: viewMode === 'itw' ? '#f3f4f6' : undefined, opacity: itwEnabled ? 1 : 0.5 }}>ITW</button>
            </div>

            {viewMode === 'rtwnef' && (
                <div className={styles.layoutRow}>
                    <div className={styles.assignCol}>
                    {days.map(d => {
                        const getDutyCodeFor = (key: string) => getDutyCodeForDate(key, d.date);
                        const getAssignedValue = (slotId: string) => getAssignedValueFor(d.date, slotId);
                        const clearAssignedForSlot = async (slotId: string) => clearAssignedForDate(slotId, d.date);
                        const isFirstDay = days.length > 0 && days[0].date === d.date;
                                                return (
                            <div key={d.date} style={{ marginBottom: 12 }}>
                                                                                                {(() => {
                                                                    const dt = new Date(d.date + 'T00:00:00');
                                                                    const label = dt.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }); // DD.MM
                                                                    return (
                                                                        <div style={{ position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 2, textAlign: 'left', fontWeight: 600, marginBottom: 6, padding: '2px 0' }}>
                                                                            {label} <small style={{ fontWeight: 400 }}>({d.weekday})</small>
                                                                        </div>
                                                                    );
                                                                })()}
                                                                                                {viewMode === 'rtwnef' && <div className={styles.dayDivider} />}
                                <div>
                                    <div className={styles.container}>
                                        {(rtwVehicles || []).map((v, rIdx) => {
                                            const enabled = (rtwActivations[v.id] ?? Array(12).fill(true))[currentMonth] !== false;
                                            if (!enabled) return null;
                                            return (
                                            <div key={`rtw_${rIdx}`} className={styles.rtwTable}>
                                                {isFirstDay && (
                                                    <>
                                                        <div className={styles.tableHeadFull} style={{ textAlign: 'left', fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{v.name || rtwNames[rIdx] || ''}</div>
                                                        <div className={styles.tableHead}></div>
                                                        <div className={styles.tableHead}>Tag</div>
                                                        <div className={styles.tableHead}>Nacht</div>
                                                    </>
                                                )}
                                                <div className={styles.rowLabel}>FzF</div>
                                                {(() => {
                                                    const slotId = `rtw${rIdx + 1}_tag_1`;
                                                    const value = getAssignedValue(slotId);
                                                    const optionsP = personnel
                                                        .filter(p => allowedByAuswertung(getDutyCodeFor(`p_${p.id}`), 'tag') && !!p.fahrzeugfuehrer)
                                                        .map(p => ({ value: `p:${p.id}`, label: `${p.name}` }));
                                                    const renderOptions = value && !optionsP.some(o => o.value === value)
                                                        ? [{ value, label: findPersonLabelByValue(value) }, ...optionsP] : optionsP;
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
                                                    const slotId = `rtw${rIdx + 1}_nacht_1`;
                                                    const value = getAssignedValue(slotId);
                                                    const optionsP = personnel
                                                        .filter(p => allowedByAuswertung(getDutyCodeFor(`p_${p.id}`), 'nacht') && !!p.fahrzeugfuehrer)
                                                        .map(p => ({ value: `p:${p.id}`, label: `${p.name}` }));
                                                    const renderOptions = value && !optionsP.some(o => o.value === value)
                                                        ? [{ value, label: findPersonLabelByValue(value) }, ...optionsP] : optionsP;
                                                    return (
                                                        <select className={styles.select} value={value}
                                                            onChange={e => { const v = e.target.value; if (v === '') { e.preventDefault(); e.stopPropagation(); (e.currentTarget as HTMLSelectElement).blur(); clearAssignedForSlot(slotId); } else { handleAssign(d.date, d.dayOfYear, v, slotId); } }}
                                                            onKeyDown={e => { if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); e.stopPropagation(); (e.currentTarget as HTMLSelectElement).blur(); clearAssignedForSlot(slotId); } }}>
                                                            <option value=""></option>
                                                            {renderOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                                        </select>
                                                    );
                                                })()}
                                                <div className={styles.rowLabel}>Ma</div>
                                                {(() => {
                                                    const slotId = `rtw${rIdx + 1}_tag_2`;
                                                    const value = getAssignedValue(slotId);
                                                    const optionsP = personnel
                                                        .filter(p => allowedByAuswertung(getDutyCodeFor(`p_${p.id}`), 'tag'))
                                                        .map(p => ({ value: `p:${p.id}`, label: `${p.name}` }));
                                                    const optionsA = azubis
                                                        .filter(a => allowedByAuswertung(getDutyCodeFor(`a_${a.id}`), 'tag'))
                                                        .map(a => ({ value: `a:${a.id}`, label: `${a.name}` }));
                                                    const options = [...optionsP, ...optionsA];
                                                    const renderOptions = value && !options.some(o => o.value === value)
                                                        ? [{ value, label: findPersonLabelByValue(value) }, ...options] : options;
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
                                                        .map(p => ({ value: `p:${p.id}`, label: `${p.name}` }));
                                                    const optionsA = azubis
                                                        .filter(a => allowedByAuswertung(getDutyCodeFor(`a_${a.id}`), 'nacht'))
                                                        .map(a => ({ value: `a:${a.id}`, label: `${a.name}` }));
                                                    const options = [...optionsP, ...optionsA];
                                                    const renderOptions = value && !options.some(o => o.value === value)
                                                        ? [{ value, label: findPersonLabelByValue(value) }, ...options] : options;
                                                    return (
                                                        <select className={styles.select} value={value}
                                                            onChange={e => { const v = e.target.value; if (v === '') { e.preventDefault(); e.stopPropagation(); (e.currentTarget as HTMLSelectElement).blur(); clearAssignedForSlot(slotId); } else { handleAssign(d.date, d.dayOfYear, v, slotId); } }}
                                                            onKeyDown={e => { if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); e.stopPropagation(); (e.currentTarget as HTMLSelectElement).blur(); clearAssignedForSlot(slotId); } }}>
                                                            <option value=""></option>
                                                            {renderOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                                        </select>
                                                    );
                                                })()}
                                                <div className={styles.rowLabel}>Azubi</div>
                                                {(() => {
                                                    const slotId = `rtw${rIdx + 1}_tag_3`;
                                                    const value = getAssignedValue(slotId);
                                                    const optionsA = azubis
                                                        .filter(a => allowedByAuswertung(getDutyCodeFor(`a_${a.id}`), 'tag'))
                                                        .map(a => ({ value: `a:${a.id}`, label: `${a.name}` }));
                                                    const renderOptions = value && !optionsA.some(o => o.value === value)
                                                        ? [{ value, label: findPersonLabelByValue(value) }, ...optionsA] : optionsA;
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
                                                        .map(a => ({ value: `a:${a.id}`, label: `${a.name}` }));
                                                    const renderOptions = value && !optionsA.some(o => o.value === value)
                                                        ? [{ value, label: findPersonLabelByValue(value) }, ...optionsA] : optionsA;
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
                                            );
                                        })}

                                        {(nefVehicles || []).map((v, nefIdx) => {
                                            const enabled = (nefActivations[v.id] ?? Array(12).fill(true))[currentMonth] !== false;
                                            if (!enabled) return null;
                                            return (
                                            <div key={`nef_${nefIdx}`} className={styles.nefTable}>
                                                {isFirstDay && (
                                                    <>
                                                        <div className={styles.tableHeadFull} style={{ textAlign: 'left', fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{v.name || ''}</div>
                                                        <div className={styles.tableHeadEmpty}></div>
                                                        {(() => {
                                                            const mode = (v as any).occupancy_mode as ('24h'|'tag'|undefined);
                                                            const label = mode === 'tag' ? 'Tag' : '24h';
                                                            return <div className={styles.tableHead}>{label}</div>;
                                                        })()}
                                                    </>
                                                )}
                                                <div className={styles.rowLabel}>FzF</div>
                                                {(() => {
                                                    const slotId = `nef${nefIdx + 1}_assist`;
                                                    const value = (() => {
                                                        let v = getAssignedValue(slotId);
                                                        if (!v && nefIdx === 0) v = getAssignedValue('nef_assist');
                                                        return v;
                                                    })();
                                                    const optionsP = personnel
                                                        .filter(p => !!p.nef && allowedByAuswertung(getDutyCodeFor(`p_${p.id}`), 'any'))
                                                        .map(p => ({ value: `p:${p.id}`, label: `${p.name}` }));
                                                    const renderOptions = value && !optionsP.some(o => o.value === value)
                                                        ? [{ value, label: findPersonLabelByValue(value) }, ...optionsP] : optionsP;
                                                    return (
                                                        <select className={styles.select} value={value}
                                                            onChange={e => { const v = e.target.value; if (v === '') { e.preventDefault(); e.stopPropagation(); (e.currentTarget as HTMLSelectElement).blur(); clearAssignedForSlot(slotId); if (nefIdx===0) clearAssignedForSlot('nef_assist'); } else { handleAssign(d.date, d.dayOfYear, v, slotId); } }}
                                                            onKeyDown={e => { if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); e.stopPropagation(); (e.currentTarget as HTMLSelectElement).blur(); clearAssignedForSlot(slotId); if (nefIdx===0) clearAssignedForSlot('nef_assist'); } }}>
                                                            <option value=""></option>
                                                            {renderOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                                        </select>
                                                    );
                                                })()}
                                                <div className={styles.rowLabel}>Azubi</div>
                                                {(() => {
                                                    const slotId = `nef${nefIdx + 1}_azubi`;
                                                    const value = (() => {
                                                        let v = getAssignedValue(slotId);
                                                        if (!v && nefIdx === 0) v = getAssignedValue('nef_azubi');
                                                        return v;
                                                    })();
                                                    const optionsA = azubis
                                                        .filter(a => allowedByAuswertung(getDutyCodeFor(`a_${a.id}`), 'any'))
                                                        .map(a => ({ value: `a:${a.id}`, label: `${a.name}` }));
                                                    const renderOptions = value && !optionsA.some(o => o.value === value)
                                                        ? [{ value, label: findPersonLabelByValue(value) }, ...optionsA] : optionsA;
                                                    return (
                                                        <select className={styles.select} value={value}
                                                            onChange={e => handleAssign(d.date, d.dayOfYear, e.target.value, slotId)}
                                                            onKeyDown={e => { if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); e.stopPropagation(); (e.currentTarget as HTMLSelectElement).blur(); clearAssignedForSlot(slotId); if (nefIdx===0) clearAssignedForSlot('nef_azubi'); } }}>
                                                            <option value=""></option>
                                                            {renderOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                                        </select>
                                                    );
                                                })()}
                                            </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    </div>
                    {(() => {
                        // Kontrollkasten-Berechnungen (Monatsbasis)
                        const daysInMonth = new Date(year, currentMonth + 1, 0).getDate();
                        const allMonthDays: string[] = [];
                        for (let i = 1; i <= daysInMonth; i++) {
                            allMonthDays.push(new Date(Date.UTC(year, currentMonth, i)).toISOString().slice(0,10));
                        }
                        // Dept-Schichten im Monat
                        const deptShiftsInMonth = (() => {
                            let cnt = 0;
                            for (let i = 1; i <= daysInMonth; i++) {
                                const iso = new Date(Date.UTC(year, currentMonth, i)).toISOString().slice(0,10);
                                const seqs = [...(deptPatternSeqs || [])].sort((a,b) => a.startDate.localeCompare(b.startDate));
                                let active = seqs[0];
                                for (const s of seqs) { if (s.startDate <= iso) active = s; else break; }
                                const start = new Date((active?.startDate || '1970-01-01') + 'T00:00:00Z');
                                const cur = new Date(iso + 'T00:00:00Z');
                                const diffDays = Math.floor((cur.getTime() - start.getTime()) / (1000*60*60*24));
                                const pat = active?.pattern || [];
                                const depDay = pat.length ? pat[((diffDays % 21) + 21) % 21] : '';
                                if (depDay && String(department) === depDay) cnt++;
                            }
                            return cnt;
                        })();
                        // Aktive Fahrzeuge im Monat
                        const activeRtwCount = (rtwVehicles || []).filter(v => (rtwActivations[v.id] ?? Array(12).fill(true))[currentMonth] !== false).length;
                        const activeNefCount = (nefVehicles || []).filter(v => (nefActivations[v.id] ?? Array(12).fill(true))[currentMonth] !== false).length;
                        // ITW-Schichten im Monat (aus Roster)
                        const itwShiftsInMonth = (() => {
                            let sum = 0;
                            const mergedKeys = Array.from(new Set([...(Object.keys(localRoster || {})), ...(Object.keys(roster || {}))]));
                            for (const key of mergedKeys) {
                                for (const iso of allMonthDays) {
                                    const cell = (localRoster as any)?.[key]?.[iso] || (roster as any)?.[key]?.[iso];
                                    if (!cell) continue;
                                    const t = String(cell.type || '');
                                    const raw = String(cell.value || '').trim();
                                    if (t.startsWith('itw_') || (raw && auswertungByType[raw] === 'itw')) sum++;
                                }
                            }
                            return sum;
                        })();
                        // Azubi-Maschinist-Schichten (Slot 2)
                        const azubiMaschinistShiftsInMonth = (() => {
                            let sum = 0;
                            const reMasch = /^rtw\d+_(tag|nacht)_2$/;
                            for (const a of azubis || []) {
                                const key = `a_${a.id}`;
                                for (const iso of allMonthDays) {
                                    const t = String(((localRoster as any)?.[key]?.[iso] || (roster as any)?.[key]?.[iso])?.type || '');
                                    if (reMasch.test(t)) sum++;
                                }
                            }
                            return sum;
                        })();
                        const positionsAdjInMonth = Math.max(0, deptShiftsInMonth * (activeRtwCount * 4 + activeNefCount * 2) + itwShiftsInMonth - azubiMaschinistShiftsInMonth);
                        // Aktives Stammpersonal im Monat (mind. ein echter Code mit Auswertung != off)
                        const activePersonnelInMonth = (() => {
                            const set = new Set<string>();
                            for (const p of personnel || []) {
                                const key = `p_${p.id}`;
                                for (const iso of allMonthDays) {
                                    const raw = String(((localRoster as any)?.[key]?.[iso] || (roster as any)?.[key]?.[iso])?.value || '').trim();
                                    if (!raw) continue;
                                    if ((auswertungByType[raw] || 'off') === 'off') continue;
                                    set.add(key);
                                    break;
                                }
                            }
                            return set.size;
                        })();
                        const shiftsPerPersonInMonth = activePersonnelInMonth > 0 ? (positionsAdjInMonth / activePersonnelInMonth) : 0;
                        // Individuelle 24h+ITW je Person
                        const perPersonCombinedInMonth: Record<string, number> = (() => {
                            const map: Record<string, number> = {};
                            for (const p of personnel || []) {
                                const key = `p_${p.id}`;
                                let c24 = 0, cItw = 0;
                                for (const iso of allMonthDays) {
                                    const cell = (localRoster as any)?.[key]?.[iso] || (roster as any)?.[key]?.[iso];
                                    const raw = String(cell?.value || '').trim();
                                    if (raw && auswertungByType[raw] === '24h') c24++;
                                    const t = String(cell?.type || '');
                                    if (t.startsWith('itw_') || (raw && auswertungByType[raw] === 'itw')) cItw++;
                                }
                                map[key] = c24 + cItw;
                            }
                            return map;
                        })();
                        const avgCombinedInMonth = (() => {
                            const vals = Object.values(perPersonCombinedInMonth).filter(v => v > 0);
                            if (vals.length === 0) return 0;
                            const sum = vals.reduce((a, b) => a + b, 0);
                            return Math.round(sum / vals.length);
                        })();
                        // Gewichtet gezählte Einsätze je Person im Monat:
                        // - RTW (Fahrzeugführer/Maschinist): +1 bei rtw\d+_(tag|nacht)_(1|2)
                        // - ITW (Pos 1/2): +1 bei itw_row_[12]
                        // - NEF Assistent: +2 bei nef(\d+_)?assist
                        // - Keine Zählung für Azubi-Positionen (z.B. itw_row_3, nef*_azubi)
                        const perPersonAssignedWeightedInMonth: Record<string, number> = {};
                        const perPersonRtwTagNightInMonth: Record<string, { tag: number; nacht: number }> = {};
                        const perPersonNefInMonth: Record<string, number> = {};
                        const perPersonItwInMonth: Record<string, number> = {};
                        for (const p of (personnel || [])) {
                            const key = `p_${p.id}`;
                            let cnt = 0;
                            let tagCnt = 0;
                            let nachtCnt = 0;
                            let nefCnt = 0;
                            let itwCnt = 0;
                            for (const iso of allMonthDays) {
                                const cell = (localRoster as any)?.[key]?.[iso] || (roster as any)?.[key]?.[iso];
                                const t = String(cell?.type || '');
                                if (/^rtw\d+_(tag|nacht)_(1|2)$/.test(t)) cnt += 1;
                                if (/^rtw\d+_tag_(1|2)$/.test(t)) tagCnt += 1;
                                if (/^rtw\d+_nacht_(1|2)$/.test(t)) nachtCnt += 1;
                                else if (/^itw_row_[12]$/.test(t)) cnt += 1;
                                else if (/^nef(\d+)?_assist$/.test(t)) cnt += 2;
                                // separate Summen für NEF/ITW
                                if (/^itw_row_[12]$/.test(t)) itwCnt += 1;
                                if (/^nef(\d+)?_assist$/.test(t)) nefCnt += 2;
                            }
                            perPersonAssignedWeightedInMonth[key] = cnt;
                            perPersonRtwTagNightInMonth[key] = { tag: tagCnt, nacht: nachtCnt };
                            perPersonNefInMonth[key] = nefCnt;
                            perPersonItwInMonth[key] = itwCnt;
                        }
                        // Jahres-Soll je Person: Summe der monatlichen Soll-Ziele über alle Monate
                        const computeTargetsForMonth = (mIdx: number) => {
                            const daysInMonth = new Date(year, mIdx + 1, 0).getDate();
                            const allMonthDays: string[] = [];
                            for (let i = 1; i <= daysInMonth; i++) {
                                allMonthDays.push(new Date(Date.UTC(year, mIdx, i)).toISOString().slice(0,10));
                            }
                            const deptShiftsInMonthCalc = (() => {
                                let cnt = 0;
                                for (let i = 1; i <= daysInMonth; i++) {
                                    const iso = new Date(Date.UTC(year, mIdx, i)).toISOString().slice(0,10);
                                    const seqs = [...(deptPatternSeqs || [])].sort((a,b) => a.startDate.localeCompare(b.startDate));
                                    let active = seqs[0];
                                    for (const s of seqs) { if (s.startDate <= iso) active = s; else break; }
                                    const start = new Date((active?.startDate || '1970-01-01') + 'T00:00:00Z');
                                    const cur = new Date(iso + 'T00:00:00Z');
                                    const diffDays = Math.floor((cur.getTime() - start.getTime()) / (1000*60*60*24));
                                    const pat = active?.pattern || [];
                                    const depDay = pat.length ? pat[((diffDays % 21) + 21) % 21] : '';
                                    if (depDay && String(department) === depDay) cnt++;
                                }
                                return cnt;
                            })();
                            const activeRtwCountM = (rtwVehicles || []).filter(v => (rtwActivations[v.id] ?? Array(12).fill(true))[mIdx] !== false).length;
                            const activeNefCountM = (nefVehicles || []).filter(v => (nefActivations[v.id] ?? Array(12).fill(true))[mIdx] !== false).length;
                            const itwShiftsInMonthCalc = (() => {
                                let sum = 0;
                                const mergedKeys = Array.from(new Set([...(Object.keys(localRoster || {})), ...(Object.keys(roster || {}))]));
                                for (const key of mergedKeys) {
                                    for (const iso of allMonthDays) {
                                        const cell = (localRoster as any)?.[key]?.[iso] || (roster as any)?.[key]?.[iso];
                                        if (!cell) continue;
                                        const t = String(cell.type || '');
                                        const raw = String(cell.value || '').trim();
                                        if (t.startsWith('itw_') || (raw && auswertungByType[raw] === 'itw')) sum++;
                                    }
                                }
                                return sum;
                            })();
                            const azubiMaschinistShiftsInMonthCalc = (() => {
                                let sum = 0;
                                const reMasch = /^rtw\d+_(tag|nacht)_2$/;
                                for (const a of azubis || []) {
                                    const key = `a_${a.id}`;
                                    for (const iso of allMonthDays) {
                                        const t = String(((localRoster as any)?.[key]?.[iso] || (roster as any)?.[key]?.[iso])?.type || '');
                                        if (reMasch.test(t)) sum++;
                                    }
                                }
                                return sum;
                            })();
                            const positionsAdjInMonthCalc = Math.max(0, deptShiftsInMonthCalc * (activeRtwCountM * 4 + activeNefCountM * 2) + itwShiftsInMonthCalc - azubiMaschinistShiftsInMonthCalc);
                            const activePersonnelInMonthCalc = (() => {
                                const set = new Set<string>();
                                for (const p of personnel || []) {
                                    const key = `p_${p.id}`;
                                    for (const iso of allMonthDays) {
                                        const raw = String(((localRoster as any)?.[key]?.[iso] || (roster as any)?.[key]?.[iso])?.value || '').trim();
                                        if (!raw) continue;
                                        if ((auswertungByType[raw] || 'off') === 'off') continue;
                                        set.add(key);
                                        break;
                                    }
                                }
                                return set.size;
                            })();
                            const shiftsPerPersonInMonthCalc = activePersonnelInMonthCalc > 0 ? (positionsAdjInMonthCalc / activePersonnelInMonthCalc) : 0;
                            const perPersonCombinedInMonthCalc: Record<string, number> = (() => {
                                const map: Record<string, number> = {};
                                for (const p of personnel || []) {
                                    const key = `p_${p.id}`;
                                    let c24 = 0, cItw = 0;
                                    for (const iso of allMonthDays) {
                                        const cell = (localRoster as any)?.[key]?.[iso] || (roster as any)?.[key]?.[iso];
                                        const raw = String(cell?.value || '').trim();
                                        if (raw && auswertungByType[raw] === '24h') c24++;
                                        const t = String(cell?.type || '');
                                        if (t.startsWith('itw_') || (raw && auswertungByType[raw] === 'itw')) cItw++;
                                    }
                                    map[key] = c24 + cItw;
                                }
                                return map;
                            })();
                            const avgCombinedInMonthCalc = (() => {
                                const vals = Object.values(perPersonCombinedInMonthCalc).filter(v => v > 0);
                                if (vals.length === 0) return 0;
                                const sum = vals.reduce((a, b) => a + b, 0);
                                return Math.round(sum / vals.length);
                            })();
                            const targets: Record<string, number> = {};
                            for (const p of personnel || []) {
                                const key = `p_${p.id}`;
                                const indiv = perPersonCombinedInMonthCalc[key] || 0;
                                const mw = avgCombinedInMonthCalc;
                                const spp = shiftsPerPersonInMonthCalc;
                                const t = (mw > 0 && spp > 0 && indiv > 0) ? Math.round((spp / mw) * indiv) : 0;
                                targets[key] = t;
                            }
                            return targets;
                        };
                        const targetYearMap: Record<string, number> = {};
                        for (let mIdx = 0; mIdx < 12; mIdx++) {
                            const mt = computeTargetsForMonth(mIdx);
                            for (const [k, v] of Object.entries(mt)) targetYearMap[k] = (targetYearMap[k] || 0) + (v || 0);
                        }
                        // Jahres-Zählung der gefahrenen (RTW+ITW+NEF) je Person
                        const drivenYearMap: Record<string, number> = {};
                        for (const p of (personnel || [])) {
                            const key = `p_${p.id}`;
                            let sum = 0;
                            for (let mIdx = 0; mIdx < 12; mIdx++) {
                                const daysInMonth = new Date(year, mIdx + 1, 0).getDate();
                                for (let i = 1; i <= daysInMonth; i++) {
                                    const iso = new Date(Date.UTC(year, mIdx, i)).toISOString().slice(0,10);
                                    const cell = (localRoster as any)?.[key]?.[iso] || (roster as any)?.[key]?.[iso];
                                    const t = String(cell?.type || '');
                                    if (/^rtw\d+_(tag|nacht)_(1|2)$/.test(t)) sum += 1;
                                    else if (/^itw_row_[12]$/.test(t)) sum += 1;
                                    else if (/^nef(\d+)?_assist$/.test(t)) sum += 2;
                                }
                            }
                            drivenYearMap[key] = sum;
                        }
                        const items = (personnel || []).map(p => {
                            const key = `p_${p.id}`;
                            const indiv = perPersonCombinedInMonth[key] || 0;
                            const mw = avgCombinedInMonth;
                            const spp = shiftsPerPersonInMonth;
                            const target = (mw > 0 && spp > 0 && indiv > 0) ? Math.round((spp / mw) * indiv) : '';
                            const count = perPersonAssignedWeightedInMonth[key] || 0;
                            const tn = perPersonRtwTagNightInMonth[key] || { tag: 0, nacht: 0 };
                            const nef = perPersonNefInMonth[key] || 0;
                            const itw = perPersonItwInMonth[key] || 0;
                            const rest = (() => {
                                const ty = targetYearMap[key] || 0;
                                const dy = drivenYearMap[key] || 0;
                                return ty - dy;
                            })();
                            const teilzeit = Number((p as any).teilzeit ?? 100) || 100;
                            return { name: p.name, target, count, tag: tn.tag, nacht: tn.nacht, nef, itw, rest, teilzeit } as { name: string, target: number|string, count: number, tag: number, nacht: number, nef: number, itw: number, rest: number, teilzeit: number };
                        });
                        // Farbliche Hervorhebung: nur Personen mit Monats-Soll > 0 berücksichtigen, Rest (Jahr) auf 100%-Äquivalent normalisieren
                        const itemsWithIndex = items.map((it, idx) => ({ ...it, idx }));
                        const eligible = itemsWithIndex.filter(it => typeof it.target === 'number' && (it.target as number) > 0);
                        const normRests = eligible.map(it => {
                            const fte = Math.max(0.01, (it.teilzeit || 100) / 100);
                            return it.rest / fte;
                        });
                        const minNR = normRests.length ? Math.min(...normRests) : 0;
                        const maxNR = normRests.length ? Math.max(...normRests) : 0;
                        const mixColor = (t: number) => {
                            // t in [0,1]: 0 = grün (wenig Rest), 1 = rot (viel Rest)
                            const clamp = (x: number) => Math.max(0, Math.min(1, x));
                            const tt = clamp(t);
                            const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
                            const r = Math.round(lerp(34, 239, tt));   // 34c55e -> ef4444
                            const g = Math.round(lerp(197, 68, tt));
                            const b = Math.round(lerp(94, 68, tt));
                            return { r, g, b };
                        };
                        return (
                            <aside className={styles.sidebar}>
                                <div className={styles.sidebarTitle}>Kontrolle</div>
                                <div className={styles.sidebarSub}></div>
                                <div className={styles.sidebarList}>
                                    {/* Header-Zeile über den Werten, zentriert */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto auto auto', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 12, color: '#374151', marginBottom: 4 }}>
                                        <span></span>
                                        <span style={{ textAlign: 'center' }}>Soll | Ist</span>
                                        <span style={{ textAlign: 'center' }}>NEF</span>
                                        <span style={{ textAlign: 'center' }}>ITW</span>
                                        <span style={{ textAlign: 'center' }}>Gesamt</span>
                                        <span></span>
                                    </div>
                                    {items.map((it, idx) => {
                                        // Hervorhebung nur für Personen mit Monats-Soll > 0 und nur am Rest-Wert anzeigen
                                        const isEligible = (typeof it.target === 'number' && (it.target as number) > 0);
                                        let restStyle: React.CSSProperties | undefined = undefined;
                                        if (isEligible && (maxNR > minNR)) {
                                            const fte = Math.max(0.01, (it.teilzeit || 100) / 100);
                                            const normRest = it.rest / fte;
                                            const t = (normRest - minNR) / (maxNR - minNR);
                                            const col = mixColor(t);
                                            const bg = `rgba(${col.r}, ${col.g}, ${col.b}, 0.18)`;
                                            const border = `1px solid rgba(${col.r}, ${col.g}, ${col.b}, 0.35)`;
                                            restStyle = { background: bg, borderRadius: 4, border, padding: '0 6px' };
                                        }
                                        return (
                                            <div key={idx} className={styles.sidebarItem} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto auto auto', alignItems: 'center', gap: 8 }}>
                                            <span className={styles.sidebarName}>{it.name}</span>
                                            <span className={styles.sidebarVal}>{(it.target === '' ? '–' : it.target) + ' | ' + it.count}</span>
                                            <span className={styles.sidebarVal}>{it.nef}</span>
                                            <span className={styles.sidebarVal}>{it.itw}</span>
                                                <span className={styles.sidebarVal} style={restStyle}>{Number.isFinite(it.rest) ? it.rest : '–'}</span>
                                            {/* Zweiteilige Balkenanzeige: links Nacht (blau), rechts Tag (orange) */}
                                                <div style={{ gridColumn: '1 / span 6', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <div style={{ fontSize: 10, color: '#4b5563', minWidth: 56 }}>{`T:${it.tag} / N:${it.nacht}`}</div>
                                                <div style={{ position: 'relative', width: 100, height: 8, background: '#eef2f7', borderRadius: 4 }}>
                                                    <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: '#cbd5e1' }} />
                                                    {(() => {
                                                        const total = (it.tag || 0) + (it.nacht || 0);
                                                        const lp = total > 0 ? Math.min(1, (it.nacht || 0) / total) : 0;
                                                        const rp = total > 0 ? Math.min(1, (it.tag || 0) / total) : 0;
                                                        return (
                                                            <>
                                                                <div style={{ position: 'absolute', right: '50%', width: `${lp * 50}%`, top: 0, bottom: 0, background: '#60a5fa', borderTopLeftRadius: 4, borderBottomLeftRadius: 4 }} />
                                                                <div style={{ position: 'absolute', left: '50%', width: `${rp * 50}%`, top: 0, bottom: 0, background: '#fb923c', borderTopRightRadius: 4, borderBottomRightRadius: 4 }} />
                                                            </>
                                                        );
                                                    })()}
                                                </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </aside>
                        );
                    })()}
                </div>
            )}

            {viewMode === 'itw' && itwEnabled && (
                <div className={styles.layoutRow}>
                    <div className={styles.assignCol}>
                        <div className={styles.itwRacks}>
                            {(() => {
                        // Baue alle Tage des Monats (ohne Abteilungs-/Schichtfolge-Filter)
                        const daysInMonth = new Date(year, currentMonth + 1, 0).getDate();
                        let base = 0;
                        for (let m = 0; m < currentMonth; ++m) base += new Date(year, m + 1, 0).getDate();
                        const allMonthDays: { date: string; weekday: string; day: number; dayOfYear: number }[] = [];
                        for (let d = 1; d <= daysInMonth; ++d) {
                            const idx = base + (d - 1);
                            const local = new Date(year, currentMonth, d);
                            const iso = new Date(Date.UTC(year, currentMonth, d)).toISOString().slice(0, 10);
                            const weekday = local.toLocaleDateString('de-DE', { weekday: 'short' });
                            allMonthDays.push({ date: iso, weekday, day: d, dayOfYear: idx });
                        }
                        // Aktives Muster je Datum bestimmen (letzte Sequenz mit startDate <= Datum)
                        const getActivePatternFor = (iso: string): string[] => {
                            const seqs = (itwPatternSeqs && itwPatternSeqs.length > 0) ? itwPatternSeqs : [];
                            let active = seqs[0];
                            for (const s of seqs) { if (s.startDate <= iso) active = s; else break; }
                            return (active && active.pattern) ? active.pattern : [];
                        };
                        const getIndexSinceStart = (startIso: string, iso: string): number => {
                            const start = new Date(startIso + 'T00:00:00Z');
                            const cur = new Date(iso + 'T00:00:00Z');
                            const diffDays = Math.floor((cur.getTime() - start.getTime()) / (1000*60*60*24));
                            return ((diffDays % 21) + 21) % 21;
                        };
                        // Nur Tage anzeigen, an denen gemäß aktivem Muster "IW" ist und kein Feiertag ist
                        // Tage laut IW-Muster (keine Feiertage)
                        const iwDaysAll = allMonthDays.filter(d => {
                            if (holidays.has(d.date)) return false;
                            const seqs = (itwPatternSeqs && itwPatternSeqs.length > 0) ? itwPatternSeqs : [];
                            let active = seqs[0];
                            for (const s of seqs) { if (s.startDate <= d.date) active = s; else break; }
                            const idx = getIndexSinceStart(active.startDate, d.date);
                            return ((active && active.pattern) ? active.pattern : [])[idx] === 'IW';
                        });
                        // Zusätzlich: Bereits zugewiesene ITW-Slots (unabhängig vom Muster) in diesem Monat
                        const assignedItwDates = new Set<string>();
                        try {
                            const mergedKeys = Array.from(new Set([...(Object.keys(localRoster || {})), ...(Object.keys(roster || {}))]));
                            for (const key of mergedKeys) {
                                const rec = (localRoster as any)?.[key] || (roster as any)?.[key] || {};
                                for (const iso of Object.keys(rec)) {
                                    const entry = rec[iso];
                                    if (!entry || !entry.type || typeof entry.type !== 'string') continue;
                                    if (!/^itw_/.test(entry.type)) continue;
                                    const dt = new Date(iso + 'T00:00:00Z');
                                    if (dt.getUTCFullYear() === year && dt.getUTCMonth() === currentMonth) {
                                        // Feiertage weiterhin aussparen
                                        if (!holidays.has(iso)) assignedItwDates.add(iso);
                                    }
                                }
                            }
                        } catch {}
                        // Manuell hinzugefügte Zusatz-Tage (bereits gefiltert auf Monat)
                        const extras = Array.from(itwExtraDays || []);
                        // Union bilden und aufsteigend sortieren
                        const daysSet = new Map<string, { date: string; weekday: string; day: number; dayOfYear: number }>();
                        for (const d of iwDaysAll) daysSet.set(d.date, d);
                        for (const iso of assignedItwDates) {
                            if (!daysSet.has(iso)) {
                                const local = new Date(year, currentMonth, Number(iso.slice(8,10)));
                                const weekday = local.toLocaleDateString('de-DE', { weekday: 'short' });
                                daysSet.set(iso, { date: iso, weekday, day: Number(iso.slice(8,10)), dayOfYear: 0 });
                            }
                        }
                        for (const iso of extras) {
                            if (!daysSet.has(iso)) {
                                const local = new Date(year, currentMonth, Number(iso.slice(8,10)));
                                const weekday = local.toLocaleDateString('de-DE', { weekday: 'short' });
                                daysSet.set(iso, { date: iso, weekday, day: Number(iso.slice(8,10)), dayOfYear: 0 });
                            }
                        }
                        const allItwDays = Array.from(daysSet.values()).sort((a, b) => a.date.localeCompare(b.date));
                        const isOnItwDuty = (key: string, date: string) => {
                            const code = getDutyCodeForDate(key, date);
                            return !!code && (auswertungByType[code] === 'itw');
                        };
                        const renderItwSelect = (date: string, role: 1|2|3|4) => {
                            const slotId = role === 1 ? 'itw_row_1' : role === 2 ? 'itw_row_2' : role === 3 ? 'itw_row_3' : 'itw_row_4';
                            const value = getAssignedValueFor(date, slotId);
                                let options: { value: string, label: string }[] = [];
                            if (role === 1 || role === 2) {
                                options = personnel
                                    .filter(p => {
                                        const key = `p_${p.id}`;
                                        // Qualifikation: Rolle 1 benötigt Fahrzeuführer, Rolle 2 allgemeines Personal
                                        const qualified = (role === 1) ? !!p.fahrzeugfuehrer : true;
                                        // Dienstplan: Nur mit ITW-Schichtcode am Tag zulassen
                                        const onItw = isOnItwDuty(key, date);
                                        return qualified && onItw;
                                    })
                                    .map(p => ({ value: `p:${p.id}`, label: `${p.name}` }));
                            } else if (role === 3) {
                                options = azubis
                                    .filter(a => allowedByAuswertung(getDutyCodeForDate(`a_${a.id}`, date), 'any'))
                                    .map(a => ({ value: `a:${a.id}`, label: `${a.name}` }));
                            } else if (role === 4) {
                                options = (itwDoctors || []).map(d => ({ value: `d:${d.id}`, label: d.name }));
                            }
                            if (value && !options.some(o => o.value === value)) {
                                const label = findPersonLabelByValue(value);
                                options = [{ value, label }, ...options];
                            }
                            return (
                                <select className={styles.select} value={value}
                                    onChange={e => { const v = e.target.value; if (v === '') { e.preventDefault(); e.stopPropagation(); (e.currentTarget as HTMLSelectElement).blur(); clearAssignedForDate(slotId, date); } else { handleAssign(date, 0, v, slotId); } }}
                                    onKeyDown={e => { if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); e.stopPropagation(); (e.currentTarget as HTMLSelectElement).blur(); clearAssignedForDate(slotId, date); } }}>
                                    <option value=""></option>
                                    {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                            );
                        };
                        const racks: typeof days[] = [] as any;
                        for (let i = 0; i < allItwDays.length; i += 15) racks.push(allItwDays.slice(i, i + 15));
                        return racks.map((rackDays, rackIdx) => (
                            <div key={`itw_rack_${rackIdx}`} className={styles.itwRack}>
                                {rackDays.map((d2) => {
                                    const dd = new Date(d2.date + 'T00:00:00Z');
                                    const label = dd.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
                                    return (
                                        <div key={`itw_card_${d2.date}`} className={styles.itwCardWrap}>
                                            {/* Datum (DD.MM) + Wochentag und gelbe Trennlinie über dem ITW-Kasten */}
                                            <div className={styles.itwCardHeader}>{label} <small style={{ fontWeight: 400, color: 'var(--muted)' }}>({d2.weekday})</small></div>
                                            <div className={styles.itwDivider} />
                                            <div className={styles.itwCard}>
                                                <div className={styles.itwRow}><div className={styles.itwRoleLabel}>FzF</div>{renderItwSelect(d2.date, 1)}</div>
                                                <div className={styles.itwRow}><div className={styles.itwRoleLabel}>Ma</div>{renderItwSelect(d2.date, 2)}</div>
                                                <div className={styles.itwRow}><div className={styles.itwRoleLabel}>Azubi</div>{renderItwSelect(d2.date, 3)}</div>
                                                <div className={styles.itwRow}><div className={styles.itwRoleLabel}>Arzt</div>{renderItwSelect(d2.date, 4)}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ));
                            })()}
                            {/* Zusatz-Funktion: ITW-Tage außerhalb der Schichtfolge hinzufügen (unter den Karten) */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                                <label style={{ fontSize: 13, color: '#555' }}>Zusatz-Tag:</label>
                                <input
                                  type="date"
                                  value={itwExtraInput}
                                  onChange={e => setItwExtraInput(e.target.value)}
                                />
                                <button onClick={() => {
                                    if (!itwExtraInput) return;
                                    // Nur Tage des aktuellen Monats zulassen
                                    const d = new Date(itwExtraInput + 'T00:00:00Z');
                                    if (d.getUTCFullYear() !== year || d.getUTCMonth() !== currentMonth) return;
                                    // Feiertage weiterhin aussparen (ITW entfällt)
                                    if (holidays.has(itwExtraInput)) return;
                                    setItwExtraDays(prev => new Set([...Array.from(prev), itwExtraInput]));
                                }}>Tag hinzufügen</button>
                                <span style={{ fontSize: 12, color: '#666' }}>Für Ersatzbesetzungen außerhalb der IW-Folge.</span>
                            </div>
                        </div>
                    </div>
                    {(() => {
                        // Kontrollkasten-Berechnungen (Monatsbasis) – identisch wie in RTW/NEF-Ansicht
                        const daysInMonth = new Date(year, currentMonth + 1, 0).getDate();
                        const allMonthDays: string[] = [];
                        for (let i = 1; i <= daysInMonth; i++) {
                            allMonthDays.push(new Date(Date.UTC(year, currentMonth, i)).toISOString().slice(0,10));
                        }
                        const deptShiftsInMonth = (() => {
                            let cnt = 0;
                            for (let i = 1; i <= daysInMonth; i++) {
                                const iso = new Date(Date.UTC(year, currentMonth, i)).toISOString().slice(0,10);
                                const seqs = [...(deptPatternSeqs || [])].sort((a,b) => a.startDate.localeCompare(b.startDate));
                                let active = seqs[0];
                                for (const s of seqs) { if (s.startDate <= iso) active = s; else break; }
                                const start = new Date((active?.startDate || '1970-01-01') + 'T00:00:00Z');
                                const cur = new Date(iso + 'T00:00:00Z');
                                const diffDays = Math.floor((cur.getTime() - start.getTime()) / (1000*60*60*24));
                                const pat = active?.pattern || [];
                                const depDay = pat.length ? pat[((diffDays % 21) + 21) % 21] : '';
                                if (depDay && String(department) === depDay) cnt++;
                            }
                            return cnt;
                        })();
                        const activeRtwCount = (rtwVehicles || []).filter(v => (rtwActivations[v.id] ?? Array(12).fill(true))[currentMonth] !== false).length;
                        const activeNefCount = (nefVehicles || []).filter(v => (nefActivations[v.id] ?? Array(12).fill(true))[currentMonth] !== false).length;
                        const itwShiftsInMonth = (() => {
                            let sum = 0;
                            const mergedKeys = Array.from(new Set([...(Object.keys(localRoster || {})), ...(Object.keys(roster || {}))]));
                            for (const key of mergedKeys) {
                                for (const iso of allMonthDays) {
                                    const cell = (localRoster as any)?.[key]?.[iso] || (roster as any)?.[key]?.[iso];
                                    if (!cell) continue;
                                    const t = String(cell.type || '');
                                    const raw = String(cell.value || '').trim();
                                    if (t.startsWith('itw_') || (raw && auswertungByType[raw] === 'itw')) sum++;
                                }
                            }
                            return sum;
                        })();
                        const azubiMaschinistShiftsInMonth = (() => {
                            let sum = 0;
                            const reMasch = /^rtw\d+_(tag|nacht)_2$/;
                            for (const a of azubis || []) {
                                const key = `a_${a.id}`;
                                for (const iso of allMonthDays) {
                                    const t = String(((localRoster as any)?.[key]?.[iso] || (roster as any)?.[key]?.[iso])?.type || '');
                                    if (reMasch.test(t)) sum++;
                                }
                            }
                            return sum;
                        })();
                        const positionsAdjInMonth = Math.max(0, deptShiftsInMonth * (activeRtwCount * 4 + activeNefCount * 2) + itwShiftsInMonth - azubiMaschinistShiftsInMonth);
                        const activePersonnelInMonth = (() => {
                            const set = new Set<string>();
                            for (const p of personnel || []) {
                                const key = `p_${p.id}`;
                                for (const iso of allMonthDays) {
                                    const raw = String(((localRoster as any)?.[key]?.[iso] || (roster as any)?.[key]?.[iso])?.value || '').trim();
                                    if (!raw) continue;
                                    if ((auswertungByType[raw] || 'off') === 'off') continue;
                                    set.add(key);
                                    break;
                                }
                            }
                            return set.size;
                        })();
                        const shiftsPerPersonInMonth = activePersonnelInMonth > 0 ? (positionsAdjInMonth / activePersonnelInMonth) : 0;
                        const perPersonCombinedInMonth: Record<string, number> = (() => {
                            const map: Record<string, number> = {};
                            for (const p of personnel || []) {
                                const key = `p_${p.id}`;
                                let c24 = 0, cItw = 0;
                                for (const iso of allMonthDays) {
                                    const cell = (localRoster as any)?.[key]?.[iso] || (roster as any)?.[key]?.[iso];
                                    const raw = String(cell?.value || '').trim();
                                    if (raw && auswertungByType[raw] === '24h') c24++;
                                    const t = String(cell?.type || '');
                                    if (t.startsWith('itw_') || (raw && auswertungByType[raw] === 'itw')) cItw++;
                                }
                                map[key] = c24 + cItw;
                            }
                            return map;
                        })();
                        const avgCombinedInMonth = (() => {
                            const vals = Object.values(perPersonCombinedInMonth).filter(v => v > 0);
                            if (vals.length === 0) return 0;
                            const sum = vals.reduce((a, b) => a + b, 0);
                            return Math.round(sum / vals.length);
                        })();
                        const perPersonAssignedWeightedInMonth: Record<string, number> = {};
                        const perPersonRtwTagNightInMonth: Record<string, { tag: number; nacht: number }> = {};
                        const perPersonNefInMonth: Record<string, number> = {};
                        const perPersonItwInMonth: Record<string, number> = {};
                        for (const p of (personnel || [])) {
                            const key = `p_${p.id}`;
                            let cnt = 0;
                            let tagCnt = 0;
                            let nachtCnt = 0;
                            let nefCnt = 0;
                            let itwCnt = 0;
                            for (const iso of allMonthDays) {
                                const cell = (localRoster as any)?.[key]?.[iso] || (roster as any)?.[key]?.[iso];
                                const t = String(cell?.type || '');
                                if (/^rtw\d+_(tag|nacht)_(1|2)$/.test(t)) cnt += 1;
                                if (/^rtw\d+_tag_(1|2)$/.test(t)) tagCnt += 1;
                                if (/^rtw\d+_nacht_(1|2)$/.test(t)) nachtCnt += 1;
                                else if (/^itw_row_[12]$/.test(t)) cnt += 1;
                                else if (/^nef(\d+)?_assist$/.test(t)) cnt += 2;
                                if (/^itw_row_[12]$/.test(t)) itwCnt += 1;
                                if (/^nef(\d+)?_assist$/.test(t)) nefCnt += 2;
                            }
                            perPersonAssignedWeightedInMonth[key] = cnt;
                            perPersonRtwTagNightInMonth[key] = { tag: tagCnt, nacht: nachtCnt };
                            perPersonNefInMonth[key] = nefCnt;
                            perPersonItwInMonth[key] = itwCnt;
                        }
                        const computeTargetsForMonth = (mIdx: number) => {
                            const daysInMonth = new Date(year, mIdx + 1, 0).getDate();
                            const allMonthDays: string[] = [];
                            for (let i = 1; i <= daysInMonth; i++) {
                                allMonthDays.push(new Date(Date.UTC(year, mIdx, i)).toISOString().slice(0,10));
                            }
                            const deptShiftsInMonthCalc = (() => {
                                let cnt = 0;
                                for (let i = 1; i <= daysInMonth; i++) {
                                    const iso = new Date(Date.UTC(year, mIdx, i)).toISOString().slice(0,10);
                                    const seqs = [...(deptPatternSeqs || [])].sort((a,b) => a.startDate.localeCompare(b.startDate));
                                    let active = seqs[0];
                                    for (const s of seqs) { if (s.startDate <= iso) active = s; else break; }
                                    const start = new Date((active?.startDate || '1970-01-01') + 'T00:00:00Z');
                                    const cur = new Date(iso + 'T00:00:00Z');
                                    const diffDays = Math.floor((cur.getTime() - start.getTime()) / (1000*60*60*24));
                                    const pat = active?.pattern || [];
                                    const depDay = pat.length ? pat[((diffDays % 21) + 21) % 21] : '';
                                    if (depDay && String(department) === depDay) cnt++;
                                }
                                return cnt;
                            })();
                            const activeRtwCountM = (rtwVehicles || []).filter(v => (rtwActivations[v.id] ?? Array(12).fill(true))[mIdx] !== false).length;
                            const activeNefCountM = (nefVehicles || []).filter(v => (nefActivations[v.id] ?? Array(12).fill(true))[mIdx] !== false).length;
                            const itwShiftsInMonthCalc = (() => {
                                let sum = 0;
                                const mergedKeys = Array.from(new Set([...(Object.keys(localRoster || {})), ...(Object.keys(roster || {}))]));
                                for (const key of mergedKeys) {
                                    for (const iso of allMonthDays) {
                                        const cell = (localRoster as any)?.[key]?.[iso] || (roster as any)?.[key]?.[iso];
                                        if (!cell) continue;
                                        const t = String(cell.type || '');
                                        const raw = String(cell.value || '').trim();
                                        if (t.startsWith('itw_') || (raw && auswertungByType[raw] === 'itw')) sum++;
                                    }
                                }
                                return sum;
                            })();
                            const azubiMaschinistShiftsInMonthCalc = (() => {
                                let sum = 0;
                                const reMasch = /^rtw\d+_(tag|nacht)_2$/;
                                for (const a of azubis || []) {
                                    const key = `a_${a.id}`;
                                    for (const iso of allMonthDays) {
                                        const t = String(((localRoster as any)?.[key]?.[iso] || (roster as any)?.[key]?.[iso])?.type || '');
                                        if (reMasch.test(t)) sum++;
                                    }
                                }
                                return sum;
                            })();
                            const positionsAdjInMonthCalc = Math.max(0, deptShiftsInMonthCalc * (activeRtwCountM * 4 + activeNefCountM * 2) + itwShiftsInMonthCalc - azubiMaschinistShiftsInMonthCalc);
                            const activePersonnelInMonthCalc = (() => {
                                const set = new Set<string>();
                                for (const p of personnel || []) {
                                    const key = `p_${p.id}`;
                                    for (const iso of allMonthDays) {
                                        const raw = String(((localRoster as any)?.[key]?.[iso] || (roster as any)?.[key]?.[iso])?.value || '').trim();
                                        if (!raw) continue;
                                        if ((auswertungByType[raw] || 'off') === 'off') continue;
                                        set.add(key);
                                        break;
                                    }
                                }
                                return set.size;
                            })();
                            const shiftsPerPersonInMonthCalc = activePersonnelInMonthCalc > 0 ? (positionsAdjInMonthCalc / activePersonnelInMonthCalc) : 0;
                            const perPersonCombinedInMonthCalc: Record<string, number> = (() => {
                                const map: Record<string, number> = {};
                                for (const p of personnel || []) {
                                    const key = `p_${p.id}`;
                                    let c24 = 0, cItw = 0;
                                    for (const iso of allMonthDays) {
                                        const cell = (localRoster as any)?.[key]?.[iso] || (roster as any)?.[key]?.[iso];
                                        const raw = String(cell?.value || '').trim();
                                        if (raw && auswertungByType[raw] === '24h') c24++;
                                        const t = String(cell?.type || '');
                                        if (t.startsWith('itw_') || (raw && auswertungByType[raw] === 'itw')) cItw++;
                                    }
                                    map[key] = c24 + cItw;
                                }
                                return map;
                            })();
                            const avgCombinedInMonthCalc = (() => {
                                const vals = Object.values(perPersonCombinedInMonthCalc).filter(v => v > 0);
                                if (vals.length === 0) return 0;
                                const sum = vals.reduce((a, b) => a + b, 0);
                                return Math.round(sum / vals.length);
                            })();
                            const targets: Record<string, number> = {};
                            for (const p of personnel || []) {
                                const key = `p_${p.id}`;
                                const indiv = perPersonCombinedInMonthCalc[key] || 0;
                                const mw = avgCombinedInMonthCalc;
                                const spp = shiftsPerPersonInMonthCalc;
                                const t = (mw > 0 && spp > 0 && indiv > 0) ? Math.round((spp / mw) * indiv) : 0;
                                targets[key] = t;
                            }
                            return targets;
                        };
                        const targetYearMap: Record<string, number> = {};
                        for (let mIdx = 0; mIdx < 12; mIdx++) {
                            const mt = computeTargetsForMonth(mIdx);
                            for (const [k, v] of Object.entries(mt)) targetYearMap[k] = (targetYearMap[k] || 0) + (v || 0);
                        }
                        const drivenYearMap: Record<string, number> = {};
                        for (const p of (personnel || [])) {
                            const key = `p_${p.id}`;
                            let sum = 0;
                            for (let mIdx = 0; mIdx < 12; mIdx++) {
                                const daysInMonth = new Date(year, mIdx + 1, 0).getDate();
                                for (let i = 1; i <= daysInMonth; i++) {
                                    const iso = new Date(Date.UTC(year, mIdx, i)).toISOString().slice(0,10);
                                    const cell = (localRoster as any)?.[key]?.[iso] || (roster as any)?.[key]?.[iso];
                                    const t = String(cell?.type || '');
                                    if (/^rtw\d+_(tag|nacht)_(1|2)$/.test(t)) sum += 1;
                                    else if (/^itw_row_[12]$/.test(t)) sum += 1;
                                    else if (/^nef(\d+)?_assist$/.test(t)) sum += 2;
                                }
                            }
                            drivenYearMap[key] = sum;
                        }
                        const items = (personnel || []).map(p => {
                            const key = `p_${p.id}`;
                            const indiv = perPersonCombinedInMonth[key] || 0;
                            const mw = avgCombinedInMonth;
                            const spp = shiftsPerPersonInMonth;
                            const target = (mw > 0 && spp > 0 && indiv > 0) ? Math.round((spp / mw) * indiv) : '';
                            const count = perPersonAssignedWeightedInMonth[key] || 0;
                            const tn = perPersonRtwTagNightInMonth[key] || { tag: 0, nacht: 0 };
                            const nef = perPersonNefInMonth[key] || 0;
                            const itw = perPersonItwInMonth[key] || 0;
                            const rest = (() => {
                                const ty = targetYearMap[key] || 0;
                                const dy = drivenYearMap[key] || 0;
                                return ty - dy;
                            })();
                            const teilzeit = Number((p as any).teilzeit ?? 100) || 100;
                            return { name: p.name, target, count, tag: tn.tag, nacht: tn.nacht, nef, itw, rest, teilzeit } as { name: string, target: number|string, count: number, tag: number, nacht: number, nef: number, itw: number, rest: number, teilzeit: number };
                        });
                        const itemsWithIndex = items.map((it, idx) => ({ ...it, idx }));
                        const eligible = itemsWithIndex.filter(it => typeof it.target === 'number' && (it.target as number) > 0);
                        const normRests = eligible.map(it => {
                            const fte = Math.max(0.01, (it.teilzeit || 100) / 100);
                            return it.rest / fte;
                        });
                        const minNR = normRests.length ? Math.min(...normRests) : 0;
                        const maxNR = normRests.length ? Math.max(...normRests) : 0;
                        const mixColor = (t: number) => {
                            const clamp = (x: number) => Math.max(0, Math.min(1, x));
                            const tt = clamp(t);
                            const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
                            const r = Math.round(lerp(34, 239, tt));
                            const g = Math.round(lerp(197, 68, tt));
                            const b = Math.round(lerp(94, 68, tt));
                            return { r, g, b };
                        };
                        return (
                            <aside className={styles.sidebar}>
                                <div className={styles.sidebarTitle}>Kontrolle</div>
                                <div className={styles.sidebarSub}></div>
                                <div className={styles.sidebarList}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto auto auto', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 12, color: '#374151', marginBottom: 4 }}>
                                        <span></span>
                                        <span style={{ textAlign: 'center' }}>Soll | Ist</span>
                                        <span style={{ textAlign: 'center' }}>NEF</span>
                                        <span style={{ textAlign: 'center' }}>ITW</span>
                                        <span style={{ textAlign: 'center' }}>Gesamt</span>
                                        <span></span>
                                    </div>
                                    {items.map((it, idx) => {
                                        const isEligible = (typeof it.target === 'number' && (it.target as number) > 0);
                                        let restStyle: React.CSSProperties | undefined = undefined;
                                        if (isEligible && (maxNR > minNR)) {
                                            const fte = Math.max(0.01, (it.teilzeit || 100) / 100);
                                            const normRest = it.rest / fte;
                                            const t = (normRest - minNR) / (maxNR - minNR);
                                            const col = mixColor(t);
                                            const bg = `rgba(${col.r}, ${col.g}, ${col.b}, 0.18)`;
                                            const border = `1px solid rgba(${col.r}, ${col.g}, ${col.b}, 0.35)`;
                                            restStyle = { background: bg, borderRadius: 4, border, padding: '0 6px' };
                                        }
                                        return (
                                            <div key={idx} className={styles.sidebarItem} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto auto auto', alignItems: 'center', gap: 8 }}>
                                                <span className={styles.sidebarName}>{it.name}</span>
                                                <span className={styles.sidebarVal}>{(it.target === '' ? '–' : it.target) + ' | ' + it.count}</span>
                                                <span className={styles.sidebarVal}>{it.nef}</span>
                                                <span className={styles.sidebarVal}>{it.itw}</span>
                                                <span className={styles.sidebarVal} style={restStyle}>{Number.isFinite(it.rest) ? it.rest : '–'}</span>
                                                <div style={{ gridColumn: '1 / span 6', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <div style={{ fontSize: 10, color: '#4b5563', minWidth: 56 }}>{`T:${it.tag} / N:${it.nacht}`}</div>
                                                    <div style={{ position: 'relative', width: 100, height: 8, background: '#eef2f7', borderRadius: 4 }}>
                                                        <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: '#cbd5e1' }} />
                                                        {(() => {
                                                            const total = (it.tag || 0) + (it.nacht || 0);
                                                            const lp = total > 0 ? Math.min(1, (it.nacht || 0) / total) : 0;
                                                            const rp = total > 0 ? Math.min(1, (it.tag || 0) / total) : 0;
                                                            return (
                                                                <>
                                                                    <div style={{ position: 'absolute', right: '50%', width: `${lp * 50}%`, top: 0, bottom: 0, background: '#60a5fa', borderTopLeftRadius: 4, borderBottomLeftRadius: 4 }} />
                                                                    <div style={{ position: 'absolute', left: '50%', width: `${rp * 50}%`, top: 0, bottom: 0, background: '#fb923c', borderTopRightRadius: 4, borderBottomRightRadius: 4 }} />
                                                                </>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </aside>
                        );
                    })()}
                </div>
            )}
        </div>
    );
};

export default MonthTabs;