import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './MonthTabs.module.css';

interface MonthTabsProps {
    currentMonth: number;
    onMonthChange: (month: number) => void;
    personnel: { id: number; name: string; vorname: string; fahrzeugfuehrer?: boolean; nef?: boolean; fahrzeugfuehrerHLFB?: boolean | number; teilzeit?: number }[];
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
    const [forceUpdateCounter, setForceUpdateCounter] = useState(0);
    const [isUpdating, setIsUpdating] = useState(false); // Verhindert Race-Conditions während Updates
    const [holidays, setHolidays] = useState<Set<string>>(new Set());
    // Zusätzliche ITW-Tage außerhalb der Schichtfolge (nur UI-state für aktuellen Monat)
    const [itwExtraDays, setItwExtraDays] = useState<Set<string>>(new Set());
    const [itwExtraInput, setItwExtraInput] = useState<string>('');
    // Hervorgehobene Person aus Kontrollkasten
    const [highlightedPersonKey, setHighlightedPersonKey] = useState<string | null>(null);

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
                console.log('[MonthTabs] Loading shift types:', types);
                for (const t of (types || [])) {
                    const v = await (window as any).api.getSetting(`auswertung_${t.code}`);
                    console.log(`[MonthTabs] Loaded auswertung for ${t.code}:`, v);
                    map[t.code] = (v || 'off') as any;
                }
                console.log('[MonthTabs] Final auswertungByType:', map);
                setAuswertungByType(map);
            } catch (e) {
                console.error('[MonthTabs] Error loading shift types:', e);
            }
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
        // Event-Handler entfernt - Parent (EinteilungPage) kümmert sich um Roster-Updates
        return () => { (window as any).api?.offSettingsUpdated?.(onSettingsUpdated); };
    }, []);

    // Intelligenter Sync: Nur updaten, wenn sich wirklich was geändert hat UND wir nicht gerade lokal updaten
    useEffect(() => {
        if (!roster || isUpdating) return; // Skip während lokaler Updates
        
        // Nur synchronisieren, wenn der Parent-State sich wirklich geändert hat
        const currentKeys = Object.keys(localRoster);
        const newKeys = Object.keys(roster);
        const hasChanged = currentKeys.length !== newKeys.length || 
                          newKeys.some(key => JSON.stringify(localRoster[key]) !== JSON.stringify(roster[key]));
        
        if (hasChanged) {
            console.log('[MonthTabs] Syncing roster from parent - significant changes detected');
            setLocalRoster({ ...roster });
        }
    }, [roster, localRoster, isUpdating]);

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
            // Nur Tage der eingestellten Abteilung anzeigen
            if (depDay !== undefined && String(department) === depDay) {
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
        // Wenn kein Dienstcode vorhanden ist, ist die Person nicht verfügbar
        if (!code || code.trim() === '') {
            return false;
        }
        
        if (desired === 'any') return true;
        const evalMode = auswertungByType[code] || 'off';
        
        // Wenn der Auswertungsmodus 'off' ist, ist die Person nicht verfügbar
        if (evalMode === 'off') {
            return false;
        }
        
        if (desired === 'tag') return (evalMode === 'tag' || evalMode === '24h');
        if (desired === 'nacht') return (evalMode === 'nacht' || evalMode === '24h');
        if (desired === '24h') return evalMode === '24h';
        return false;
    };
    const getAssignedValueFor = (date: string, slotId: string): string => {
        const mergedKeys = Array.from(new Set([...(Object.keys(localRoster || {})), ...(Object.keys(roster || {}))]));
        let foundMatch = false;
        for (const key of mergedKeys) {
            const entry = ((localRoster as any)?.[key]?.[date]) || ((roster as any)?.[key]?.[date]);
            if (!entry) continue;
            const t = String(entry.type || '');
            if (t === slotId) {
                foundMatch = true;
                if (key.startsWith('p_')) return `p:${key.slice(2)}`;
                if (key.startsWith('a_')) return `a:${key.slice(2)}`;
                return `p:${key}`;
            }
        }
        // Debug: Log wenn nichts gefunden wurde für RTW Fahrzeugführer
        if (!foundMatch && slotId.includes('_1') && (slotId.startsWith('rtw') || slotId.startsWith('nef'))) {
            console.log('[MonthTabs] No assignment found for', { date, slotId, rosterKeys: mergedKeys.length });
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
            console.log('[MonthTabs] handleAssign START:', { date, value, slotId, pid, ptype });
            
            // 1. Blockiere Parent-Updates während unseres lokalen Updates
            setIsUpdating(true);
            
            // 2. Sofortiges optimistisches UI-Update (verhindert Flackern)
            const key = ptype === 'person' ? `p_${pid}` : (ptype === 'azubi' ? `a_${pid}` : `d_${pid}`);
            
            setLocalRoster(prev => {
                const newState = { ...prev };
                
                // Entferne alle anderen Personen aus dem Ziel-Slot (slotId) an diesem Tag
                if (slotId) {
                    Object.keys(newState).forEach(personKey => {
                        if (personKey !== key && newState[personKey][date]?.type === slotId) {
                            console.log('[MonthTabs] Optimistically removing', personKey, 'from slot', slotId);
                            newState[personKey] = {
                                ...newState[personKey],
                                [date]: { ...(newState[personKey][date] || {}), type: '' }
                            };
                        }
                    });
                }
                
                // Aktualisiere die Ziel-Person
                const currentPersonState = newState[key] || {};
                const dayEntry = { ...(currentPersonState[date] || {}), type: slotId || '' };
                newState[key] = { ...currentPersonState, [date]: dayEntry };
                
                return newState;
            });
            
            // Force UI update
            setForceUpdateCounter(prev => prev + 1);
            
            // 3. Backend-Call (async)
            await (window as any).api.assignSlot({ personId: pid, personType: ptype, date, slotType: slotId || '' });
            console.log('[MonthTabs] handleAssign API call completed');
            
            // 4. Kurze Verzögerung, dann Parent-Updates wieder erlauben
            setTimeout(() => {
                setIsUpdating(false);
            }, 100);
            
            if (onEntryAssigned) onEntryAssigned(key, date, (localRoster[key]?.[date]?.value || ''), slotId || '');
            // onRosterChanged wird nur verzögert aufgerufen um excessive Reloads zu vermeiden
            setTimeout(() => {
                if (onRosterChanged) onRosterChanged();
            }, 200);
            
            console.log('[MonthTabs] handleAssign COMPLETED');
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
                // Immutable removal of type property
                const { type, ...cleanDayEntry } = dayEntry;
                const newPersonState = { ...before, [date]: cleanDayEntry };
                return { ...prev, [key]: newPersonState };
            });
            if (onEntryAssigned) onEntryAssigned(key, date, (localRoster[key]?.[date]?.value || ''), '');
            if (onRosterChanged) onRosterChanged();
        } catch (e) {
            console.warn('[MonthTabs] clearAssignedForDate failed', e);
        }
    };

    return (
        <div key={forceUpdateCounter} style={{ padding: 12 }}>
            {/* Sub‑Header: RTW/ITW Einteilung (Monat) - jetzt oberhalb der Tabs */}
            <div style={{ margin: '4px 0 10px 0' }}>
                <span style={{ fontSize: 18, fontWeight: 700 }}>
                    {viewMode === 'rtwnef' ? 'RTW Einteilung' : 'ITW Einteilung'} ({months[currentMonth]})
                </span>
            </div>
            {/* Monats-Tabs */}
            <div style={{ 
                display: 'flex', 
                gap: '4px', 
                borderBottom: '1px solid #e5e7eb',
                marginBottom: '16px',
                flexWrap: 'wrap'
            }}>
                {months.map((m, i) => {
                    // RTW/NEF = rot (#dc3545), ITW = gelb (#ffc107)
                    const accentColor = viewMode === 'rtwnef' ? '#dc3545' : '#ffc107';
                    const hoverColor = viewMode === 'rtwnef' ? '#b02a37' : '#e0a800';
                    
                    return (
                        <button
                            key={i}
                            onClick={() => onMonthChange(i)}
                            style={{
                                padding: '8px 16px',
                                background: currentMonth === i ? '#f8f9fa' : 'transparent',
                                border: 'none',
                                borderBottom: currentMonth === i ? `3px solid ${accentColor}` : '3px solid transparent',
                                cursor: 'pointer',
                                fontWeight: currentMonth === i ? 600 : 400,
                                color: currentMonth === i ? accentColor : '#6b7280',
                                transition: 'all 0.2s',
                                fontSize: '14px'
                            }}
                            onMouseEnter={(e) => {
                                if (currentMonth !== i) {
                                    e.currentTarget.style.background = '#f3f4f6';
                                    e.currentTarget.style.color = '#374151';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (currentMonth !== i) {
                                    e.currentTarget.style.background = 'transparent';
                                    e.currentTarget.style.color = '#6b7280';
                                }
                            }}
                        >
                            {m}
                        </button>
                    );
                })}
            </div>
            {/* Ansichts-Umschalter */}
            <div style={{ 
                display: 'flex', 
                gap: '4px', 
                borderBottom: '1px solid #e5e7eb',
                marginBottom: '16px',
                marginTop: '8px'
            }}>
                <button 
                    onClick={() => setViewMode('rtwnef')} 
                    style={{
                        padding: '8px 16px',
                        background: viewMode === 'rtwnef' ? '#f8f9fa' : 'transparent',
                        border: 'none',
                        borderBottom: viewMode === 'rtwnef' ? '3px solid #dc3545' : '3px solid transparent',
                        cursor: 'pointer',
                        fontWeight: viewMode === 'rtwnef' ? 600 : 400,
                        color: viewMode === 'rtwnef' ? '#dc3545' : '#6b7280',
                        transition: 'all 0.2s',
                        fontSize: '14px'
                    }}
                    onMouseEnter={(e) => {
                        if (viewMode !== 'rtwnef') {
                            e.currentTarget.style.background = '#f3f4f6';
                            e.currentTarget.style.color = '#374151';
                        }
                    }}
                    onMouseLeave={(e) => {
                        if (viewMode !== 'rtwnef') {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = '#6b7280';
                        }
                    }}
                >
                    RTW/NEF
                </button>
                <button 
                    onClick={() => setViewMode('itw')} 
                    disabled={!itwEnabled}
                    style={{
                        padding: '8px 16px',
                        background: viewMode === 'itw' ? '#f8f9fa' : 'transparent',
                        border: 'none',
                        borderBottom: viewMode === 'itw' ? '3px solid #ffc107' : '3px solid transparent',
                        cursor: itwEnabled ? 'pointer' : 'not-allowed',
                        fontWeight: viewMode === 'itw' ? 600 : 400,
                        color: viewMode === 'itw' ? '#ffc107' : '#6b7280',
                        transition: 'all 0.2s',
                        fontSize: '14px',
                        opacity: itwEnabled ? 1 : 0.5
                    }}
                    onMouseEnter={(e) => {
                        if (viewMode !== 'itw' && itwEnabled) {
                            e.currentTarget.style.background = '#f3f4f6';
                            e.currentTarget.style.color = '#374151';
                        }
                    }}
                    onMouseLeave={(e) => {
                        if (viewMode !== 'itw' && itwEnabled) {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = '#6b7280';
                        }
                    }}
                >
                    ITW
                </button>
            </div>

            {viewMode === 'rtwnef' && (
                <>
                    <div>
                    {days.map(d => {
                        const getDutyCodeFor = (key: string) => getDutyCodeForDate(key, d.date);
                        const getAssignedValue = (slotId: string) => getAssignedValueFor(d.date, slotId);
                        const clearAssignedForSlot = async (slotId: string) => clearAssignedForDate(slotId, d.date);
                        const isFirstDay = days.length > 0 && days[0].date === d.date;
                        
                        // Debug: Log roster structure für ersten Tag
                        if (isFirstDay) {
                            console.log('[MonthTabs DEBUG] First day:', d.date);
                            console.log('[MonthTabs DEBUG] Personnel count:', personnel.length);
                            console.log('[MonthTabs DEBUG] Roster keys:', Object.keys(roster || {}).length);
                            console.log('[MonthTabs DEBUG] Sample roster entry:', roster ? roster[Object.keys(roster)[0]] : 'none');
                            console.log('[MonthTabs DEBUG] Personnel sample:', personnel.slice(0, 3).map(p => ({
                                name: p.name,
                                fahrzeugfuehrer: p.fahrzeugfuehrer,
                                typeof_fzf: typeof p.fahrzeugfuehrer
                            })));
                            console.log('[MonthTabs DEBUG] Personnel with fahrzeugfuehrer:', personnel.filter(p => p.fahrzeugfuehrer).map(p => p.name));
                            console.log('[MonthTabs DEBUG] auswertungByType:', auswertungByType);
                        }
                        
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
                                                    
                                                    // Debug: Zeige alle relevanten Daten für ERSTEN Tag
                                                    if (d.dayOfMonth === 1) {
                                                        console.log(`[MonthTabs Debug ${d.date}] Filtering personnel for RTW${rIdx + 1} Tag FzF slot`);
                                                        console.log(`  - Total personnel: ${personnel.length}`);
                                                        console.log(`  - auswertungByType:`, auswertungByType);
                                                    }
                                                    
                                                    const optionsP = personnel
                                                        .filter(p => {
                                                            const hasQual = p.fahrzeugfuehrer === 1;
                                                            const dutyCode = getDutyCodeFor(`p_${p.id}`);
                                                            const allowed = allowedByAuswertung(dutyCode, 'tag');
                                                            
                                                            // Debug für ersten Tag
                                                            if (d.dayOfMonth === 1 && hasQual) {
                                                                console.log(`  - ${p.name}: dutyCode="${dutyCode}", evalMode="${auswertungByType[dutyCode] || 'undefined'}", allowed=${allowed}`);
                                                            }
                                                            
                                                            return allowed && hasQual;
                                                        })
                                                        .map(p => ({ value: `p:${p.id}`, label: `${p.name}` }));
                                                    const renderOptions = value && !optionsP.some(o => o.value === value)
                                                        ? [{ value, label: findPersonLabelByValue(value) }, ...optionsP] : optionsP;
                                                    const isHighlighted = highlightedPersonKey && value && value.startsWith('p:') && value === `p:${highlightedPersonKey.replace('p_', '')}`;
                                                    return (
                                                        <select 
                                                            className={styles.select} 
                                                            value={value}
                                                            style={isHighlighted ? { background: '#fef3c7', border: '2px solid #f59e0b', fontWeight: 600 } : undefined}
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
                                                        .filter(p => allowedByAuswertung(getDutyCodeFor(`p_${p.id}`), 'nacht') && p.fahrzeugfuehrer === 1)
                                                        .map(p => ({ value: `p:${p.id}`, label: `${p.name}` }));
                                                    const renderOptions = value && !optionsP.some(o => o.value === value)
                                                        ? [{ value, label: findPersonLabelByValue(value) }, ...optionsP] : optionsP;
                                                    const isHighlighted = highlightedPersonKey && value && value.startsWith('p:') && value === `p:${highlightedPersonKey.replace('p_', '')}`;
                                                    return (
                                                        <select 
                                                            className={styles.select} 
                                                            value={value}
                                                            style={isHighlighted ? { background: '#fef3c7', border: '2px solid #f59e0b', fontWeight: 600 } : undefined}
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
                                                    const isHighlighted = highlightedPersonKey && value && value.startsWith('p:') && value === `p:${highlightedPersonKey.replace('p_', '')}`;
                                                    return (
                                                        <select className={styles.select} value={value}
                                                            style={isHighlighted ? { background: '#fef3c7', border: '2px solid #f59e0b', fontWeight: 600 } : undefined}
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
                                                    const isHighlighted = highlightedPersonKey && value && value.startsWith('p:') && value === `p:${highlightedPersonKey.replace('p_', '')}`;
                                                    return (
                                                        <select className={styles.select} value={value}
                                                            style={isHighlighted ? { background: '#fef3c7', border: '2px solid #f59e0b', fontWeight: 600 } : undefined}
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
                                                        .filter(p => p.nef === 1 && allowedByAuswertung(getDutyCodeFor(`p_${p.id}`), 'any'))
                                                        .map(p => ({ value: `p:${p.id}`, label: `${p.name}` }));
                                                    const renderOptions = value && !optionsP.some(o => o.value === value)
                                                        ? [{ value, label: findPersonLabelByValue(value) }, ...optionsP] : optionsP;
                                                    const isHighlighted = highlightedPersonKey && value && value.startsWith('p:') && value === `p:${highlightedPersonKey.replace('p_', '')}`;
                                                    return (
                                                        <select className={styles.select} value={value}
                                                            style={isHighlighted ? { background: '#fef3c7', border: '2px solid #f59e0b', fontWeight: 600 } : undefined}
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
                        // Ü50-Personen-Schichten (alle Positionen)
                        const ue50ShiftsInMonth = (() => {
                            let sum = 0;
                            for (const p of personnel || []) {
                                if ((p as any).ue50 !== 1) continue;
                                const key = `p_${p.id}`;
                                for (const iso of allMonthDays) {
                                    const t = String(((localRoster as any)?.[key]?.[iso] || (roster as any)?.[key]?.[iso])?.type || '');
                                    if (t) sum++;
                                }
                            }
                            return sum;
                        })();
                        const positionsAdjInMonth = Math.max(0, deptShiftsInMonth * (activeRtwCount * 4 + activeNefCount * 2) + itwShiftsInMonth - azubiMaschinistShiftsInMonth - ue50ShiftsInMonth);
                        // Aktives Stammpersonal im Monat (mind. ein Präsenz-Tag) – ungewichtet
                        const activePersonnelInMonth = (() => {
                            let sum = 0;
                            for (const p of personnel || []) {
                                // Ü50-Personen ausschließen (wie Azubis: keine Soll/Ist-Berechnung)
                                if ((p as any).ue50 === 1) continue;
                                const key = `p_${p.id}`;
                                let presence = 0;
                                for (const iso of allMonthDays) {
                                    const raw = String(((localRoster as any)?.[key]?.[iso] || (roster as any)?.[key]?.[iso])?.value || '').trim();
                                    if (!raw) continue;
                                    if ((auswertungByType[raw] || 'off') !== 'off') presence++;
                                }
                                if (presence > 0) {
                                    sum += 1;
                                }
                            }
                            return sum;
                        })();
                        const shiftsPerPersonInMonth = activePersonnelInMonth > 0 ? (positionsAdjInMonth / activePersonnelInMonth) : 0;
                        // Präsenz je Person im Monat (Auswertung != 'off') – RAW und gewichtete (HLF‑B=round(0,75×Ai))
                        const perPersonPresenceInMonth: Record<string, number> = (() => {
                            const map: Record<string, number> = {};
                            for (const p of personnel || []) {
                                // Ü50-Personen ausschließen
                                if ((p as any).ue50 === 1) continue;
                                const key = `p_${p.id}`;
                                let presence = 0;
                                for (const iso of allMonthDays) {
                                    const cell = (localRoster as any)?.[key]?.[iso] || (roster as any)?.[key]?.[iso];
                                    const raw = String(cell?.value || '').trim();
                                    if (raw && (auswertungByType[raw] || 'off') !== 'off') presence++;
                                }
                                map[key] = presence;
                            }
                            return map;
                        })();
                        const perPersonPresenceWeightedInMonth: Record<string, number> = (() => {
                            const map: Record<string, number> = {};
                            for (const p of personnel || []) {
                                // Ü50-Personen ausschließen
                                if ((p as any).ue50 === 1) continue;
                                const key = `p_${p.id}`;
                                const raw = perPersonPresenceInMonth[key] || 0;
                                const hasHLFB = (p as any).fahrzeugfuehrerHLFB === 1;
                                map[key] = hasHLFB ? Math.round(raw * 0.75) : raw;
                            }
                            return map;
                        })();
                        const avgPresenceInMonth = (() => {
                            const vals = Object.values(perPersonPresenceWeightedInMonth).filter(v => v > 0);
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
                            // Ü50-Personen ausschließen
                            if ((p as any).ue50 === 1) continue;
                            const key = `p_${p.id}`;
                            let cnt = 0;
                            let tagCnt = 0;
                            let nachtCnt = 0;
                            let nefCnt = 0;
                            let itwCnt = 0;
                            // Für Tag/Nacht-Zählung nur Abteilungs-Tage dieses Monats berücksichtigen
                            const monthDeptIsos: string[] = (() => {
                                const list: string[] = [];
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
                                    if (depDay && String(department) === depDay) list.push(iso);
                                }
                                return list;
                            })();
                            for (const iso of monthDeptIsos) {
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
                        // Jahres-Soll je Person: Summe der monatlichen Soll-Ziele über alle Monate (Hamilton auf Basis gewichteter Präsenz, HLF‑B=0,75)
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
                            // Ü50-Personen-Schichten (alle Positionen)
                            const ue50ShiftsInMonthCalc = (() => {
                                let sum = 0;
                                const reSlot = /^(rtw\d+_(tag|nacht)_[12]|nef(\d+)?_(arzt|assist|azubi)|itw_row_[123])$/;
                                for (const p of personnel || []) {
                                    if ((p as any).ue50 !== 1) continue;
                                    const key = `p_${p.id}`;
                                    for (const iso of allMonthDays) {
                                        const t = String(((localRoster as any)?.[key]?.[iso] || (roster as any)?.[key]?.[iso])?.type || '');
                                        if (reSlot.test(t)) sum++;
                                    }
                                }
                                return sum;
                            })();
                            const positionsAdjInMonthCalc = Math.max(0, deptShiftsInMonthCalc * (activeRtwCountM * 4 + activeNefCountM * 2) + itwShiftsInMonthCalc - azubiMaschinistShiftsInMonthCalc - ue50ShiftsInMonthCalc);
                            const perPersonPresenceInMonthCalc: Record<string, number> = (() => {
                                const map: Record<string, number> = {};
                                for (const p of personnel || []) {
                                    if ((p as any).ue50 === 1) continue;
                                    const key = `p_${p.id}`;
                                    let presence = 0;
                                    for (const iso of allMonthDays) {
                                        const cell = (localRoster as any)?.[key]?.[iso] || (roster as any)?.[key]?.[iso];
                                        const raw = String(cell?.value || '').trim();
                                        if (raw && (auswertungByType[raw] || 'off') !== 'off') presence++;
                                    }
                                    map[key] = presence;
                                }
                                return map;
                            })();
                            const perPersonPresenceWeightedInMonthCalc: Record<string, number> = (() => {
                                const map: Record<string, number> = {};
                                for (const p of personnel || []) {
                                    if ((p as any).ue50 === 1) continue;
                                    const key = `p_${p.id}`;
                                    const raw = perPersonPresenceInMonthCalc[key] || 0;
                                    const hasHLFB = (p as any).fahrzeugfuehrerHLFB === 1;
                                    map[key] = hasHLFB ? Math.round(raw * 0.75) : raw;
                                }
                                return map;
                            })();
                            // Hamilton-Allokation: Summe == positionsAdjInMonthCalc
                            const entries = (personnel || []).map(p => {
                                const key = `p_${p.id}`;
                                return { key, w: perPersonPresenceWeightedInMonthCalc[key] || 0 };
                            }).filter(e => e.w > 0);
                            const totalW = entries.reduce((s, e) => s + e.w, 0);
                            const targets: Record<string, number> = {};
                            if (positionsAdjInMonthCalc <= 0 || totalW <= 0) return targets;
                            const parts = entries.map(e => ({ key: e.key, exact: (positionsAdjInMonthCalc * e.w) / totalW }));
                            const floors = parts.map(p => ({ key: p.key, v: Math.floor(p.exact), frac: p.exact - Math.floor(p.exact) }));
                            let assigned = floors.reduce((s, f) => s + f.v, 0);
                            let rest = positionsAdjInMonthCalc - assigned;
                            floors.sort((a, b) => b.frac - a.frac);
                            for (let i = 0; i < floors.length && rest > 0; i++, rest--) floors[i].v += 1;
                            for (const f of floors) targets[f.key] = f.v;
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
                        
                        // Jahres-Zählung Tag/Nacht (RTW) je Person (global über das Jahr)
                        const perPersonRtwTagNightYear: Record<string, { tag: number; nacht: number }> = {};
                        for (const p of (personnel || [])) {
                            const key = `p_${p.id}`;
                            let tagCntY = 0;
                            let nachtCntY = 0;
                            for (let mIdx = 0; mIdx < 12; mIdx++) {
                                const dim = new Date(year, mIdx + 1, 0).getDate();
                                for (let i = 1; i <= dim; i++) {
                                    const iso = new Date(Date.UTC(year, mIdx, i)).toISOString().slice(0,10);
                                    const cell = (localRoster as any)?.[key]?.[iso] || (roster as any)?.[key]?.[iso];
                                    const t = String(cell?.type || '');
                                    if (/^rtw\d+_tag_(1|2)$/.test(t)) tagCntY += 1;
                                    if (/^rtw\d+_nacht_(1|2)$/.test(t)) nachtCntY += 1;
                                }
                            }
                            perPersonRtwTagNightYear[key] = { tag: tagCntY, nacht: nachtCntY };
                        }
                        // Hamilton-Verteilung für den aktuellen Monat (Summe == positionsAdjInMonth)
                        const allocTargetsInMonth: Record<string, number> = (() => {
                            const entries = (personnel || []).map(p => {
                                const key = `p_${p.id}`;
                                return { key, w: perPersonPresenceWeightedInMonth[key] || 0 };
                            }).filter(e => e.w > 0);
                            const totalW = entries.reduce((s, e) => s + e.w, 0);
                            const res: Record<string, number> = {};
                            if (positionsAdjInMonth <= 0 || totalW <= 0) return res;
                            const parts = entries.map(e => ({ key: e.key, exact: (positionsAdjInMonth * e.w) / totalW }));
                            const floors = parts.map(p => ({ key: p.key, v: Math.floor(p.exact), frac: p.exact - Math.floor(p.exact) }));
                            let assigned = floors.reduce((s, f) => s + f.v, 0);
                            let rest = positionsAdjInMonth - assigned;
                            floors.sort((a, b) => b.frac - a.frac);
                            for (let i = 0; i < floors.length && rest > 0; i++, rest--) floors[i].v += 1;
                            for (const f of floors) res[f.key] = f.v;
                            return res;
                        })();

                        const items = (personnel || []).map(p => {
                            const key = `p_${p.id}`;
                            // Anzeige-Ziel aus Hamilton-Allokation
                            const target = (allocTargetsInMonth[key] ?? 0) || '';
                            const count = perPersonAssignedWeightedInMonth[key] || 0;
                            const tn = perPersonRtwTagNightYear[key] || { tag: 0, nacht: 0 };
                            const nef = perPersonNefInMonth[key] || 0;
                            const itw = perPersonItwInMonth[key] || 0;
                            const rest = (() => {
                                const ty = targetYearMap[key] || 0;
                                const dy = drivenYearMap[key] || 0;
                                return ty - dy;
                            })();
                            const teilzeit = Number((p as any).teilzeit ?? 100) || 100;
                            const hlfb = (p as any).fahrzeugfuehrerHLFB === 1;
                            const ue50 = (p as any).ue50 === 1;
                            return { key, name: p.name, target, count, tag: tn.tag, nacht: tn.nacht, nef, itw, rest, teilzeit, hlfb, ue50 } as { key: string, name: string, target: number|string, count: number, tag: number, nacht: number, nef: number, itw: number, rest: number, teilzeit: number, hlfb: boolean, ue50: boolean };
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
                        // Restliches Jahr: ISO-Daten sammeln (ab aktuellem Monat bis Dezember)
                        const restYearIsos: string[] = (() => {
                            const list: string[] = [];
                            for (let mIdx = currentMonth; mIdx < 12; mIdx++) {
                                const dim = new Date(year, mIdx + 1, 0).getDate();
                                for (let d = 1; d <= dim; d++) {
                                    list.push(new Date(Date.UTC(year, mIdx, d)).toISOString().slice(0,10));
                                }
                            }
                            return list;
                        })();
                        // Verbleibende Anwesenheitsschichten (Auswertung != 'off') im restlichen Jahr je Person
                        const presenceRemainingByPerson: Record<string, number> = (() => {
                            const map: Record<string, number> = {};
                            for (const p of (personnel || [])) {
                                const key = `p_${p.id}`;
                                let cnt = 0;
                                for (const iso of restYearIsos) {
                                    const cell = (localRoster as any)?.[key]?.[iso] || (roster as any)?.[key]?.[iso];
                                    const raw = String(cell?.value || '').trim();
                                    if (raw && (auswertungByType[raw] || 'off') !== 'off') cnt++;
                                }
                                map[key] = cnt;
                            }
                            return map;
                        })();
                        // Bereits eingeteilte Schichten im restlichen Jahr (RTW/ITW/NEF) je Person
                        const assignedRemainingByPerson: Record<string, number> = (() => {
                            const map: Record<string, number> = {};
                            for (const p of (personnel || [])) {
                                const key = `p_${p.id}`;
                                let sum = 0;
                                for (const iso of restYearIsos) {
                                    const cell = (localRoster as any)?.[key]?.[iso] || (roster as any)?.[key]?.[iso];
                                    const t = String(cell?.type || '');
                                    if (/^rtw\d+_(tag|nacht)_(1|2)$/.test(t)) sum += 1;
                                    else if (/^itw_row_[12]$/.test(t)) sum += 1;
                                    else if (/^nef(\d+)?_assist$/.test(t)) sum += 2;
                                }
                                map[key] = sum;
                            }
                            return map;
                        })();
                        
                        const sidebar = (
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
                                            <span 
                                                className={styles.sidebarName} 
                                                onClick={() => setHighlightedPersonKey(highlightedPersonKey === it.key ? null : it.key)}
                                                style={{ 
                                                    color: it.ue50 ? '#dc3545' : it.hlfb ? '#1565c0' : undefined,
                                                    cursor: 'pointer',
                                                    fontWeight: highlightedPersonKey === it.key ? 700 : undefined,
                                                    textDecoration: highlightedPersonKey === it.key ? 'underline' : undefined
                                                }}
                                            >
                                                {it.name}
                                            </span>
                                            <span className={styles.sidebarVal}>{(it.target === '' ? '–' : it.target) + ' | ' + it.count}</span>
                                            <span className={styles.sidebarVal}>{it.nef}</span>
                                            <span className={styles.sidebarVal}>{it.itw}</span>
                                                {!it.ue50 && <span className={styles.sidebarVal} style={restStyle}>{Number.isFinite(it.rest) ? it.rest : '–'}</span>}
                                                {it.ue50 && <span className={styles.sidebarVal}>–</span>}
                                            {/* Zweiteilige Balkenanzeige: links Nacht (blau), rechts Tag (orange) - nur wenn nicht Ü50 */}
                                                {!it.ue50 && <div style={{ gridColumn: '1 / span 6', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                                <div style={{ position: 'relative', width: 100, height: 8, background: '#eef2f7', borderRadius: 4 }}>
                                                    <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: '#cbd5e1' }} />
                                                    {(() => {
                                                        const total = (it.tag || 0) + (it.nacht || 0);
                                                        const lp = total > 0 ? Math.min(1, (it.nacht || 0) / total) : 0;
                                                        const rp = total > 0 ? Math.min(1, (it.tag || 0) / total) : 0;
                                                        const leftW = lp * 50; // px, da Container 100px breit
                                                        const rightW = rp * 50;
                                                        return (
                                                            <>
                                                                <div style={{ position: 'absolute', right: '50%', width: `${lp * 50}%`, top: 0, bottom: 0, background: '#60a5fa', borderTopLeftRadius: 4, borderBottomLeftRadius: 4 }} />
                                                                <div style={{ position: 'absolute', left: '50%', width: `${rp * 50}%`, top: 0, bottom: 0, background: '#fb923c', borderTopRightRadius: 4, borderBottomRightRadius: 4 }} />
                                                                {leftW >= 18 && (
                                                                    <div style={{ position: 'absolute', left: `${lp * 25}%`, top: '50%', transform: 'translate(-50%, -50%)', fontSize: 9, color: '#ffffff', textShadow: '0 0 2px rgba(0,0,0,0.6)', fontWeight: 600 }}>{it.nacht}</div>
                                                                )}
                                                                {rightW >= 18 && (
                                                                    <div style={{ position: 'absolute', left: `${50 + rp * 25}%`, top: '50%', transform: 'translate(-50%, -50%)', fontSize: 9, color: '#ffffff', textShadow: '0 0 2px rgba(0,0,0,0.6)', fontWeight: 600 }}>{it.tag}</div>
                                                                )}
                                                            </>
                                                        );
                                                    })()}
                                                </div>
                                                {(() => {
                                                    const pres = presenceRemainingByPerson[it.key] || 0;
                                                    const assigned = assignedRemainingByPerson[it.key] || 0;
                                                    const remain = Math.max(0, pres - assigned);
                                                    const frac = pres > 0 ? Math.min(1, remain / pres) : 0;
                                                    // Harte Schwellwerte für die Färbung:
                                                    // - Rot (#ef4444), wenn verbleibende Anwesenheit < verbleibendes Jahres-Soll (Unterdeckung)
                                                    // - Gelb (#f59e0b), wenn der positive Puffer ≤ 20% des verbleibenden Solls ist
                                                    // - Grün (#34c759), wenn der Puffer > 20% des verbleibenden Solls ist
                                                    const needed = Math.max(0, Number(it.rest || 0));
                                                    let barColor = '#34c759';
                                                    if (needed > 0) {
                                                        if (remain < needed) {
                                                            barColor = '#ef4444';
                                                        } else {
                                                            const diff = remain - needed; // >= 0
                                                            const threshold = 0.2 * needed;
                                                            barColor = (diff <= threshold) ? '#f59e0b' : '#34c759';
                                                        }
                                                    }
                                                    return (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                            <div style={{ position: 'relative', width: 80, height: 8, background: '#eef2f7', borderRadius: 4 }}>
                                                                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${frac * 100}%`, background: barColor, borderRadius: 5 }} />
                                                                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#111827' }}>{remain}</div>
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
                                                </div>}
                                            </div>
                                        );
                                    })}
                                </div>
                            </aside>
                        );
                        const target = (typeof document !== 'undefined') ? document.getElementById('einteilung-right-sidebar') : null;
                        return target ? createPortal(sidebar, target) : sidebar;
                    })()}
                </>
            )}

            {viewMode === 'itw' && itwEnabled && (
                <>
                    <div>
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
                        // Nur Tage anzeigen, an denen im Dienstplan tatsächlich ITW gefahren wird (Slot oder Auswertung = ITW) – Musterfolge ignorieren
                        const assignedItwDates = new Set<string>();
                        try {
                            const mergedKeys = Array.from(new Set([...(Object.keys(localRoster || {})), ...(Object.keys(roster || {}))]));
                            for (const key of mergedKeys) {
                                const rec = (localRoster as any)?.[key] || (roster as any)?.[key] || {};
                                for (const iso of Object.keys(rec)) {
                                    const entry = rec[iso];
                                    if (!entry) continue;
                                    const t = String(entry.type || '');
                                    const raw = String(entry.value || '').trim();
                                    const isItw = t.startsWith('itw_') || (raw && auswertungByType[raw] === 'itw');
                                    if (!isItw) continue;
                                    const dt = new Date(iso + 'T00:00:00Z');
                                    if (dt.getUTCFullYear() === year && dt.getUTCMonth() === currentMonth) {
                                        if (!holidays.has(iso)) assignedItwDates.add(iso);
                                    }
                                }
                            }
                        } catch {}
                        // Manuell hinzugefügte Zusatz-Tage (bereits gefiltert auf Monat)
                        const extras = Array.from(itwExtraDays || []);
                        // Union aus tatsächlichen ITW-Tagen und manuell hinzugefügten Tagen bilden und aufsteigend sortieren
                        const daysSet = new Map<string, { date: string; weekday: string; day: number; dayOfYear: number }>();
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
                                        const qualified = (role === 1) ? (p.fahrzeugfuehrer === 1) : true;
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
                            const isHighlighted = highlightedPersonKey && value && value.startsWith('p:') && value === `p:${highlightedPersonKey.replace('p_', '')}`;
                            return (
                                <select className={styles.select} value={value}
                                    style={isHighlighted ? { background: '#fef3c7', border: '2px solid #f59e0b', fontWeight: 600 } : undefined}
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
                        // Kontrollkasten-Berechnungen (Monatsbasis) – identisch wie in RTW/NEF-Ansicht (mit Präsenz & HLF‑B Gewichtung)
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
                        // Ü50-Personen-Schichten (alle Positionen)
                        const ue50ShiftsInMonth = (() => {
                            let sum = 0;
                            const reSlot = /^(rtw\d+_(tag|nacht)_[12]|nef(\d+)?_(arzt|assist|azubi)|itw_row_[123])$/;
                            for (const p of personnel || []) {
                                if ((p as any).ue50 !== 1) continue;
                                const key = `p_${p.id}`;
                                for (const iso of allMonthDays) {
                                    const t = String(((localRoster as any)?.[key]?.[iso] || (roster as any)?.[key]?.[iso])?.type || '');
                                    if (reSlot.test(t)) sum++;
                                }
                            }
                            return sum;
                        })();
                        const positionsAdjInMonth = Math.max(0, deptShiftsInMonth * (activeRtwCount * 4 + activeNefCount * 2) + itwShiftsInMonth - azubiMaschinistShiftsInMonth - ue50ShiftsInMonth);
                        const activePersonnelInMonth = (() => {
                            let sum = 0;
                            for (const p of personnel || []) {
                                // Ü50-Personen ausschließen (ITW View)
                                if ((p as any).ue50 === 1) continue;
                                const key = `p_${p.id}`;
                                let presence = 0;
                                for (const iso of allMonthDays) {
                                    const raw = String(((localRoster as any)?.[key]?.[iso] || (roster as any)?.[key]?.[iso])?.value || '').trim();
                                    if (!raw) continue;
                                    if ((auswertungByType[raw] || 'off') !== 'off') presence++;
                                }
                                if (presence > 0) {
                                    sum += 1;
                                }
                            }
                            return sum;
                        })();
                        const shiftsPerPersonInMonth = activePersonnelInMonth > 0 ? (positionsAdjInMonth / activePersonnelInMonth) : 0;
                        const perPersonPresenceInMonth: Record<string, number> = (() => {
                            const map: Record<string, number> = {};
                            for (const p of personnel || []) {
                                if ((p as any).ue50 === 1) continue;
                                const key = `p_${p.id}`;
                                let presence = 0;
                                for (const iso of allMonthDays) {
                                    const cell = (localRoster as any)?.[key]?.[iso] || (roster as any)?.[key]?.[iso];
                                    const raw = String(cell?.value || '').trim();
                                    if (raw && (auswertungByType[raw] || 'off') !== 'off') presence++;
                                }
                                map[key] = presence;
                            }
                            return map;
                        })();
                        const avgPresenceInMonth = (() => {
                            const vals = Object.values(perPersonPresenceInMonth).filter(v => v > 0);
                            if (vals.length === 0) return 0;
                            const sum = vals.reduce((a, b) => a + b, 0);
                            return Math.round(sum / vals.length);
                        })();
                        const perPersonAssignedWeightedInMonth: Record<string, number> = {};
                        const perPersonRtwTagNightInMonth: Record<string, { tag: number; nacht: number }> = {};
                        const perPersonNefInMonth: Record<string, number> = {};
                        const perPersonItwInMonth: Record<string, number> = {};
                        for (const p of (personnel || [])) {
                            // Ü50-Personen ausschließen
                            if ((p as any).ue50 === 1) continue;
                            const key = `p_${p.id}`;
                            let cnt = 0;
                            let tagCnt = 0;
                            let nachtCnt = 0;
                            let nefCnt = 0;
                            let itwCnt = 0;
                            // Für Tag/Nacht-Zählung nur Abteilungs-Tage dieses Monats berücksichtigen
                            const monthDeptIsos: string[] = (() => {
                                const list: string[] = [];
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
                                    if (depDay && String(department) === depDay) list.push(iso);
                                }
                                return list;
                            })();
                            for (const iso of monthDeptIsos) {
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
                            // Ü50-Personen-Schichten (alle Positionen)
                            const ue50ShiftsInMonthCalc = (() => {
                                let sum = 0;
                                const reSlot = /^(rtw\d+_(tag|nacht)_[12]|nef(\d+)?_(arzt|assist|azubi)|itw_row_[123])$/;
                                for (const p of personnel || []) {
                                    if ((p as any).ue50 !== 1) continue;
                                    const key = `p_${p.id}`;
                                    for (const iso of allMonthDays) {
                                        const t = String(((localRoster as any)?.[key]?.[iso] || (roster as any)?.[key]?.[iso])?.type || '');
                                        if (reSlot.test(t)) sum++;
                                    }
                                }
                                return sum;
                            })();
                            const positionsAdjInMonthCalc = Math.max(0, deptShiftsInMonthCalc * (activeRtwCountM * 4 + activeNefCountM * 2) + itwShiftsInMonthCalc - azubiMaschinistShiftsInMonthCalc - ue50ShiftsInMonthCalc);
                            const activePersonnelInMonthCalc = (() => {
                                let sum = 0;
                                for (const p of personnel || []) {
                                    if ((p as any).ue50 === 1) continue;
                                    const key = `p_${p.id}`;
                                    let presence = 0;
                                    for (const iso of allMonthDays) {
                                        const raw = String(((localRoster as any)?.[key]?.[iso] || (roster as any)?.[key]?.[iso])?.value || '').trim();
                                        if (!raw) continue;
                                        if ((auswertungByType[raw] || 'off') !== 'off') presence++;
                                    }
                                    if (presence > 0) {
                                        sum += 1;
                                    }
                                }
                                return sum;
                            })();
                            const shiftsPerPersonInMonthCalc = activePersonnelInMonthCalc > 0 ? (positionsAdjInMonthCalc / activePersonnelInMonthCalc) : 0;
                            const perPersonPresenceInMonthCalc: Record<string, number> = (() => {
                                const map: Record<string, number> = {};
                                for (const p of personnel || []) {
                                    if ((p as any).ue50 === 1) continue;
                                    const key = `p_${p.id}`;
                                    let presence = 0;
                                    for (const iso of allMonthDays) {
                                        const cell = (localRoster as any)?.[key]?.[iso] || (roster as any)?.[key]?.[iso];
                                        const raw = String(cell?.value || '').trim();
                                        if (raw && (auswertungByType[raw] || 'off') !== 'off') presence++;
                                    }
                                    map[key] = presence;
                                }
                                return map;
                            })();
                            const perPersonPresenceWeightedInMonthCalc: Record<string, number> = (() => {
                                const map: Record<string, number> = {};
                                for (const p of personnel || []) {
                                    if ((p as any).ue50 === 1) continue;
                                    const key = `p_${p.id}`;
                                    const raw = perPersonPresenceInMonthCalc[key] || 0;
                                    const hasHLFB = (p as any).fahrzeugfuehrerHLFB === 1;
                                    map[key] = hasHLFB ? Math.round(raw * 0.75) : raw;
                                }
                                return map;
                            })();
                            // Hamilton-Allokation: Summe == positionsAdjInMonthCalc
                            const entries = (personnel || []).map(p => {
                                const key = `p_${p.id}`;
                                return { key, w: perPersonPresenceWeightedInMonthCalc[key] || 0 };
                            }).filter(e => e.w > 0);
                            const totalW = entries.reduce((s, e) => s + e.w, 0);
                            const targets: Record<string, number> = {};
                            if (positionsAdjInMonthCalc <= 0 || totalW <= 0) return targets;
                            const parts = entries.map(e => ({ key: e.key, exact: (positionsAdjInMonthCalc * e.w) / totalW }));
                            const floors = parts.map(p => ({ key: p.key, v: Math.floor(p.exact), frac: p.exact - Math.floor(p.exact) }));
                            let assigned = floors.reduce((s, f) => s + f.v, 0);
                            let rest = positionsAdjInMonthCalc - assigned;
                            floors.sort((a, b) => b.frac - a.frac);
                            for (let i = 0; i < floors.length && rest > 0; i++, rest--) floors[i].v += 1;
                            for (const f of floors) targets[f.key] = f.v;
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
                        // Gewichtete Präsenz für aktuellen Monat (HLF‑B = round(0,75×Ai)) und Hamilton-Allokation (ITW-Ansicht)
                        const perPersonPresenceWeightedInMonth_CUR: Record<string, number> = (() => {
                            const map: Record<string, number> = {};
                            for (const p of personnel || []) {
                                if ((p as any).ue50 === 1) continue;
                                const key = `p_${p.id}`;
                                const raw = perPersonPresenceInMonth[key] || 0;
                                const hasHLFB = (p as any).fahrzeugfuehrerHLFB === 1;
                                map[key] = hasHLFB ? Math.round(raw * 0.75) : raw;
                            }
                            return map;
                        })();
                        const allocTargetsInMonth: Record<string, number> = (() => {
                            const entries = (personnel || []).map(p => {
                                const key = `p_${p.id}`;
                                return { key, w: perPersonPresenceWeightedInMonth_CUR[key] || 0 };
                            }).filter(e => e.w > 0);
                            const totalW = entries.reduce((s, e) => s + e.w, 0);
                            const res: Record<string, number> = {};
                            if (positionsAdjInMonth <= 0 || totalW <= 0) return res;
                            const parts = entries.map(e => ({ key: e.key, exact: (positionsAdjInMonth * e.w) / totalW }));
                            const floors = parts.map(p => ({ key: p.key, v: Math.floor(p.exact), frac: p.exact - Math.floor(p.exact) }));
                            let assigned = floors.reduce((s, f) => s + f.v, 0);
                            let rest = positionsAdjInMonth - assigned;
                            floors.sort((a, b) => b.frac - a.frac);
                            for (let i = 0; i < floors.length && rest > 0; i++, rest--) floors[i].v += 1;
                            for (const f of floors) res[f.key] = f.v;
                            return res;
                        })();
                        // Jahres-Zählung Tag/Nacht (RTW) je Person (global über das Jahr) – für ITW-Kontrollkasten benötigt
                        const perPersonRtwTagNightYear: Record<string, { tag: number; nacht: number }> = (() => {
                            const map: Record<string, { tag: number; nacht: number }> = {};
                            for (const p of (personnel || [])) {
                                const key = `p_${p.id}`;
                                let tagCntY = 0;
                                let nachtCntY = 0;
                                for (let mIdx = 0; mIdx < 12; mIdx++) {
                                    const dim = new Date(year, mIdx + 1, 0).getDate();
                                    for (let i = 1; i <= dim; i++) {
                                        const iso = new Date(Date.UTC(year, mIdx, i)).toISOString().slice(0,10);
                                        const cell = (localRoster as any)?.[key]?.[iso] || (roster as any)?.[key]?.[iso];
                                        const t = String(cell?.type || '');
                                        if (/^rtw\d+_tag_(1|2)$/.test(t)) tagCntY += 1;
                                        if (/^rtw\d+_nacht_(1|2)$/.test(t)) nachtCntY += 1;
                                    }
                                }
                                map[key] = { tag: tagCntY, nacht: nachtCntY };
                            }
                            return map;
                        })();
                        const items = (personnel || []).map(p => {
                            const key = `p_${p.id}`;
                            const target = (allocTargetsInMonth[key] ?? 0) || '';
                            const count = perPersonAssignedWeightedInMonth[key] || 0;
                            const tn = perPersonRtwTagNightYear[key] || { tag: 0, nacht: 0 };
                            const nef = perPersonNefInMonth[key] || 0;
                            const itw = perPersonItwInMonth[key] || 0;
                            const rest = (() => {
                                const ty = targetYearMap[key] || 0;
                                const dy = drivenYearMap[key] || 0;
                                return ty - dy;
                            })();
                            const teilzeit = Number((p as any).teilzeit ?? 100) || 100;
                            const hlfb = (p as any).fahrzeugfuehrerHLFB === 1;
                            const ue50 = (p as any).ue50 === 1;
                            return { key, name: p.name, target, count, tag: tn.tag, nacht: tn.nacht, nef, itw, rest, teilzeit, hlfb, ue50 } as { key: string, name: string, target: number|string, count: number, tag: number, nacht: number, nef: number, itw: number, rest: number, teilzeit: number, hlfb: boolean, ue50: boolean };
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
                        // Restliches Jahr (ab aktuellem Monat) berechnen – Anwesenheit und bereits eingeteilte Schichten
                        const restYearIsos: string[] = (() => {
                            const list: string[] = [];
                            for (let mIdx = currentMonth; mIdx < 12; mIdx++) {
                                const dim = new Date(year, mIdx + 1, 0).getDate();
                                for (let d = 1; d <= dim; d++) {
                                    list.push(new Date(Date.UTC(year, mIdx, d)).toISOString().slice(0,10));
                                }
                            }
                            return list;
                        })();
                        const presenceRemainingByPerson: Record<string, number> = (() => {
                            const map: Record<string, number> = {};
                            for (const p of (personnel || [])) {
                                const key = `p_${p.id}`;
                                let cnt = 0;
                                for (const iso of restYearIsos) {
                                    const cell = (localRoster as any)?.[key]?.[iso] || (roster as any)?.[key]?.[iso];
                                    const raw = String(cell?.value || '').trim();
                                    if (raw && (auswertungByType[raw] || 'off') !== 'off') cnt++;
                                }
                                map[key] = cnt;
                            }
                            return map;
                        })();
                        const assignedRemainingByPerson: Record<string, number> = (() => {
                            const map: Record<string, number> = {};
                            for (const p of (personnel || [])) {
                                const key = `p_${p.id}`;
                                let sum = 0;
                                for (const iso of restYearIsos) {
                                    const cell = (localRoster as any)?.[key]?.[iso] || (roster as any)?.[key]?.[iso];
                                    const t = String(cell?.type || '');
                                    if (/^rtw\d+_(tag|nacht)_(1|2)$/.test(t)) sum += 1;
                                    else if (/^itw_row_[12]$/.test(t)) sum += 1;
                                    else if (/^nef(\d+)?_assist$/.test(t)) sum += 2;
                                }
                                map[key] = sum;
                            }
                            return map;
                        })();
                        const sidebar = (
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
                                                <span 
                                                    className={styles.sidebarName} 
                                                    onClick={() => setHighlightedPersonKey(highlightedPersonKey === it.key ? null : it.key)}
                                                    style={{ 
                                                        color: it.ue50 ? '#dc3545' : it.hlfb ? '#1565c0' : undefined,
                                                        cursor: 'pointer',
                                                        fontWeight: highlightedPersonKey === it.key ? 700 : undefined,
                                                        textDecoration: highlightedPersonKey === it.key ? 'underline' : undefined
                                                    }}
                                                >
                                                    {it.name}
                                                </span>
                                                <span className={styles.sidebarVal}>{(it.target === '' ? '–' : it.target) + ' | ' + it.count}</span>
                                                <span className={styles.sidebarVal}>{it.nef}</span>
                                                <span className={styles.sidebarVal}>{it.itw}</span>
                                                {!it.ue50 && <span className={styles.sidebarVal} style={restStyle}>{Number.isFinite(it.rest) ? it.rest : '–'}</span>}
                                                {it.ue50 && <span className={styles.sidebarVal}>–</span>}
                                                {!it.ue50 && <div style={{ gridColumn: '1 / span 6', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                                
                                                    <div style={{ position: 'relative', width: 100, height: 8, background: '#eef2f7', borderRadius: 4 }}>
                                                        <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: '#cbd5e1' }} />
                                                        {(() => {
                                                            const total = (it.tag || 0) + (it.nacht || 0);
                                                            const lp = total > 0 ? Math.min(1, (it.nacht || 0) / total) : 0;
                                                            const rp = total > 0 ? Math.min(1, (it.tag || 0) / total) : 0;
                                                            const leftW = lp * 50;
                                                            const rightW = rp * 50;
                                                            return (
                                                                <>
                                                                    <div style={{ position: 'absolute', right: '50%', width: `${lp * 50}%`, top: 0, bottom: 0, background: '#60a5fa', borderTopLeftRadius: 4, borderBottomLeftRadius: 4 }} />
                                                                    <div style={{ position: 'absolute', left: '50%', width: `${rp * 50}%`, top: 0, bottom: 0, background: '#fb923c', borderTopRightRadius: 4, borderBottomRightRadius: 4 }} />
                                                                    {leftW >= 18 && (
                                                                        <div style={{ position: 'absolute', left: `${lp * 25}%`, top: '50%', transform: 'translate(-50%, -50%)', fontSize: 9, color: '#ffffff', textShadow: '0 0 2px rgba(0,0,0,0.6)', fontWeight: 600 }}>{it.nacht}</div>
                                                                    )}
                                                                    {rightW >= 18 && (
                                                                        <div style={{ position: 'absolute', left: `${50 + rp * 25}%`, top: '50%', transform: 'translate(-50%, -50%)', fontSize: 9, color: '#ffffff', textShadow: '0 0 2px rgba(0,0,0,0.6)', fontWeight: 600 }}>{it.tag}</div>
                                                                    )}
                                                                </>
                                                            );
                                                        })()}
                                                    </div>
                                                    {(() => {
                                                        const pres = presenceRemainingByPerson[it.key] || 0;
                                                        const assigned = assignedRemainingByPerson[it.key] || 0;
                                                        const remain = Math.max(0, pres - assigned);
                                                        const frac = pres > 0 ? Math.min(1, remain / pres) : 0;
                                                        const needed = Math.max(0, Number(it.rest || 0));
                                                        let barColor = '#34c759';
                                                        if (needed > 0) {
                                                            if (remain < needed) {
                                                                barColor = '#ef4444';
                                                            } else {
                                                                const diff = remain - needed; // >= 0
                                                                const threshold = 0.2 * needed;
                                                                barColor = (diff <= threshold) ? '#f59e0b' : '#34c759';
                                                            }
                                                        }
                                                        return (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                                <div style={{ position: 'relative', width: 80, height: 8, background: '#eef2f7', borderRadius: 4 }}>
                                                                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${frac * 100}%`, background: barColor, borderRadius: 5 }} />
                                                                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#111827' }}>{remain}</div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}
                                                </div>}
                                            </div>
                                        );
                                    })}
                                </div>
                            </aside>
                        );
                        const target = (typeof document !== 'undefined') ? document.getElementById('einteilung-right-sidebar') : null;
                        return target ? createPortal(sidebar, target) : sidebar;
                    })()}
                </>
            )}
        </div>
    );
};

export default MonthTabs;