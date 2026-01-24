import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { calculateTargets } from '../utils/calculation';
import styles from './MonthTabs.module.css';
import { Kontrollkasten } from './Kontrollkasten';

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

import { useAuth } from '../contexts/AuthContext';

const months = [
    'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
];

const MonthTabs: React.FC<MonthTabsProps> = ({ currentMonth, onMonthChange, personnel, azubis, roster, year, shiftPattern, deptPatternSeqs = [], onRosterChanged, onEntryAssigned }) => {
    const { hasPermission } = useAuth();
    const canWrite = hasPermission('einteilung', 'write');
    // Read permission is implicit if they can see the page, but we use it to check for "read-only" status
    // If they have write permission, they are not read-only.
    // If they DON'T have write permission, we enforcement visibility rules.

    const [department, setDepartment] = useState<number>(1);
    const [localRoster, setLocalRoster] = useState(roster || {} as Record<string, Record<string, { value: string; type: string }>>);
    const [rtwVehicles, setRtwVehicles] = useState<{ id: number; name: string }[]>([]);
    const [nefVehicles, setNefVehicles] = useState<{ id: number; name: string; occupancy_mode?: '24h' | 'tag' }[]>([]);
    const [itwEnabled, setItwEnabled] = useState<boolean>(false);
    const [shiftTypes, setShiftTypes] = useState<{ id: number, code: string, description: string }[]>([]);
    const [auswertungByType, setAuswertungByType] = useState<Record<string, 'off' | 'tag' | 'nacht' | '24h' | 'itw'>>({});
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
    // Hervorgehobene Person aus Kontrollkasten
    const [highlightedPersonKey, setHighlightedPersonKey] = useState<string | null>(null);
    // Ü50-IDs für korrekte Berechnung (analog ValuesPage)
    const [ue50Ids, setUe50Ids] = useState<Set<number>>(new Set());
    // HLF-B Perioden für korrekte Berechnung
    const [hlfbPeriodsByPerson, setHlfbPeriodsByPerson] = useState<Record<number, Array<{ startYM: string; endYM?: string }>>>({});
    // Performance: Debouncing für Roster-Updates
    const [updateTimeout, setUpdateTimeout] = useState<NodeJS.Timeout | null>(null);
    // Freigabe-Status pro Monat
    const [releasedMonths, setReleasedMonths] = useState<boolean[]>(Array(12).fill(false));
    // Sidebar Collapse Status
    const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);

    useEffect(() => {
        const loadHlfbPeriods = async () => {
            try {
                const hlfbQualSetting = await (window as any).api.getSetting?.('hlfb_qualification_type');
                const hlfbQualName = String(hlfbQualSetting || 'FzF HLF B');
                const allPeriods = await (window as any).api.getAllQualificationPeriods?.();

                const map: Record<number, Array<{ startYM: string; endYM?: string }>> = {};

                if (Array.isArray(allPeriods)) {
                    allPeriods.forEach((p: any) => {
                        if (p.active && p.qualType === hlfbQualName) {
                            if (!map[p.personId]) map[p.personId] = [];
                            map[p.personId].push({ startYM: p.startYM, endYM: p.endYM });
                        }
                    });
                }
                setHlfbPeriodsByPerson(map);
            } catch (e) { console.warn('Failed to load HLF-B periods', e); }
        };
        loadHlfbPeriods();
    }, []);

    useEffect(() => {
        const loadReleased = async () => {
            try {
                const status = await Promise.all(months.map(async (_, i) => {
                    const key = `roster_released_${year}_${i}`;
                    const val = await (window as any).api.getSetting(key);
                    return val === '1';
                }));
                setReleasedMonths(status);
            } catch (e) { console.warn('Failed to load released status', e); }
        };
        loadReleased();
    }, [year]);

    // Höre auf Sidebar Collapse Events
    useEffect(() => {
        const handler = (e: Event) => {
            const ce = e as CustomEvent;
            if (typeof ce.detail?.collapsed === 'boolean') {
                setSidebarCollapsed(ce.detail.collapsed);
            }
        };
        window.addEventListener('sidebar-collapsed', handler as EventListener);
        return () => window.removeEventListener('sidebar-collapsed', handler as EventListener);
    }, []);

    const toggleReleased = async () => {
        const newVal = !releasedMonths[currentMonth];

        // Prüfungen nur beim Freigeben (nicht beim Zurücksetzen)
        if (newVal) {
            // Erstelle Liste nur der Tage, die in der Einteilung vorhanden sind (days array)
            const monthDays: string[] = days.map(d => d.date);

            // Lade RTW-Positionen von allen aktiven Fahrzeugen
            const rtwPositionsMap: Record<number, Array<{ positionName: string; sort: number }>> = {};
            for (const v of rtwVehicles || []) {
                const enabled = (rtwActivations[v.id] ?? Array(12).fill(true))[currentMonth] !== false;
                if (!enabled) continue;
                try {
                    const positions = await (window as any).api.getVehiclePositions?.('rtw', v.id) || [];
                    rtwPositionsMap[v.id] = positions.sort((a: any, b: any) => a.sort - b.sort);
                } catch { }
            }

            // Lade NEF-Positionen von allen aktiven Fahrzeugen
            const nefPositionsMap: Record<number, Array<{ positionName: string; sort: number }>> = {};
            for (const v of nefVehicles || []) {
                const enabled = (nefActivations[v.id] ?? Array(12).fill(true))[currentMonth] !== false;
                if (!enabled) continue;
                try {
                    const positions = await (window as any).api.getVehiclePositions?.('nef', v.id) || [];
                    nefPositionsMap[v.id] = positions.sort((a: any, b: any) => a.sort - b.sort);
                } catch { }
            }

            // 1. Prüfung: Sind alle RTW/NEF Positionen besetzt (Azubi-Plätze werden nicht überwacht)?
            const emptySlots: string[] = [];

            for (const iso of monthDays) {
                // RTW Positionen prüfen
                for (let rIdx = 0; rIdx < (rtwVehicles || []).length; rIdx++) {
                    const v = rtwVehicles[rIdx];
                    const enabled = (rtwActivations[v.id] ?? Array(12).fill(true))[currentMonth] !== false;
                    if (!enabled) continue;

                    const positions = rtwPositionsMap[v.id] || [];

                    // Tag-Schicht - nur erste 2 Positionen (keine Azubis)
                    for (let pIdx = 0; pIdx < Math.min(2, positions.length); pIdx++) {
                        const pos = positions[pIdx];
                        const slotId = `rtw${rIdx + 1}_tag_${pIdx + 1}`;
                        const value = getAssignedValueFor(iso, slotId);

                        if (!value || value.trim() === '') {
                            const dt = new Date(iso + 'T00:00:00');
                            const label = dt.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
                            // Positionsname ohne Zahl am Ende verwenden
                            const posName = pos.positionName.replace(/\s+\d+$/, '');
                            emptySlots.push(`${label}: ${v.name || `RTW ${rIdx + 1}`} ${posName} Tag`);
                        }
                    }

                    // Nacht-Schicht - nur erste 2 Positionen (keine Azubis)
                    for (let pIdx = 0; pIdx < Math.min(2, positions.length); pIdx++) {
                        const pos = positions[pIdx];
                        const slotId = `rtw${rIdx + 1}_nacht_${pIdx + 1}`;
                        const value = getAssignedValueFor(iso, slotId);

                        if (!value || value.trim() === '') {
                            const dt = new Date(iso + 'T00:00:00');
                            const label = dt.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
                            // Positionsname ohne Zahl am Ende verwenden
                            const posName = pos.positionName.replace(/\s+\d+$/, '');
                            emptySlots.push(`${label}: ${v.name || `RTW ${rIdx + 1}`} ${posName} Nacht`);
                        }
                    }
                }

                // NEF Positionen prüfen
                for (let nIdx = 0; nIdx < (nefVehicles || []).length; nIdx++) {
                    const v = nefVehicles[nIdx];
                    const enabled = (nefActivations[v.id] ?? Array(12).fill(true))[currentMonth] !== false;
                    if (!enabled) continue;

                    const positions = nefPositionsMap[v.id] || [];
                    if (positions.length === 0) continue;

                    const slotId = `nef${nIdx + 1}_assist`;
                    const value = getAssignedValueFor(iso, slotId);
                    if (!value || value.trim() === '') {
                        const dt = new Date(iso + 'T00:00:00');
                        const label = dt.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
                        // Ersten Positionsnamen verwenden (normalerweise "Assistent")
                        const posName = positions[0].positionName.replace(/\s+\d+$/, '');
                        emptySlots.push(`${label}: ${v.name || `NEF ${nIdx + 1}`} ${posName}`);
                    }
                }
            }

            if (emptySlots.length > 0) {
                const maxShow = 10;
                const preview = emptySlots.slice(0, maxShow).join('\n');
                const more = emptySlots.length > maxShow ? `\n... und ${emptySlots.length - maxShow} weitere` : '';
                alert(`Freigabe nicht möglich!\n\nFolgende Positionen sind nicht besetzt:\n\n${preview}${more}`);
                return;
            }

            // 2. Prüfung: Sind alle eingeteilten Personen im Dienstplan verfügbar?
            const unavailableAssignments: string[] = [];

            for (const iso of monthDays) {
                // RTW Slots prüfen
                for (let rIdx = 0; rIdx < (rtwVehicles || []).length; rIdx++) {
                    const v = rtwVehicles[rIdx];
                    const enabled = (rtwActivations[v.id] ?? Array(12).fill(true))[currentMonth] !== false;
                    if (!enabled) continue;

                    const positions = rtwPositionsMap[v.id] || [];

                    // Tag-Schicht - alle Positionen prüfen (inkl. Azubis falls vorhanden)
                    for (let pIdx = 0; pIdx < positions.length; pIdx++) {
                        const pos = positions[pIdx];
                        const slotId = `rtw${rIdx + 1}_tag_${pIdx + 1}`;
                        const value = getAssignedValueFor(iso, slotId);

                        if (value && value.startsWith('p:')) {
                            const personId = value.replace('p:', '');
                            const key = `p_${personId}`;
                            const dutyCode = getDutyCodeForDate(key, iso);
                            const allowed = allowedByAuswertung(dutyCode, 'tag');

                            if (!allowed) {
                                const person = personnel.find(p => p.id === Number(personId));
                                const dt = new Date(iso + 'T00:00:00');
                                const label = dt.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
                                const posName = pos.positionName.replace(/\s+\d+$/, '');
                                unavailableAssignments.push(`${label}: ${person?.name || personId} bei ${v.name || `RTW ${rIdx + 1}`} ${posName} Tag`);
                            }
                        }
                    }

                    // Nacht-Schicht - alle Positionen prüfen (inkl. Azubis falls vorhanden)
                    for (let pIdx = 0; pIdx < positions.length; pIdx++) {
                        const pos = positions[pIdx];
                        const slotId = `rtw${rIdx + 1}_nacht_${pIdx + 1}`;
                        const value = getAssignedValueFor(iso, slotId);

                        if (value && value.startsWith('p:')) {
                            const personId = value.replace('p:', '');
                            const key = `p_${personId}`;
                            const dutyCode = getDutyCodeForDate(key, iso);
                            const allowed = allowedByAuswertung(dutyCode, 'nacht');

                            if (!allowed) {
                                const person = personnel.find(p => p.id === Number(personId));
                                const dt = new Date(iso + 'T00:00:00');
                                const label = dt.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
                                const posName = pos.positionName.replace(/\s+\d+$/, '');
                                unavailableAssignments.push(`${label}: ${person?.name || personId} bei ${v.name || `RTW ${rIdx + 1}`} ${posName} Nacht`);
                            }
                        }
                    }
                }

                // NEF Slots prüfen
                for (let nIdx = 0; nIdx < (nefVehicles || []).length; nIdx++) {
                    const v = nefVehicles[nIdx];
                    const enabled = (nefActivations[v.id] ?? Array(12).fill(true))[currentMonth] !== false;
                    if (!enabled) continue;

                    const positions = nefPositionsMap[v.id] || [];
                    if (positions.length === 0) continue;

                    const slotId = `nef${nIdx + 1}_assist`;
                    const value = getAssignedValueFor(iso, slotId);
                    if (value && value.startsWith('p:')) {
                        const personId = value.replace('p:', '');
                        const key = `p_${personId}`;
                        const dutyCode = getDutyCodeForDate(key, iso);
                        const shift = v.occupancy_mode === '24h' ? '24h' : 'tag';
                        const allowed = allowedByAuswertung(dutyCode, shift);

                        if (!allowed) {
                            const person = personnel.find(p => p.id === Number(personId));
                            const dt = new Date(iso + 'T00:00:00');
                            const label = dt.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
                            const posName = positions[0].positionName.replace(/\s+\d+$/, '');
                            unavailableAssignments.push(`${label}: ${person?.name || personId} bei ${v.name || `NEF ${nIdx + 1}`} ${posName}`);
                        }
                    }
                }
            }

            if (unavailableAssignments.length > 0) {
                const maxShow = 10;
                const preview = unavailableAssignments.slice(0, maxShow).join('\n');
                const more = unavailableAssignments.length > maxShow ? `\n... und ${unavailableAssignments.length - maxShow} weitere` : '';
                alert(`Freigabe nicht möglich!\n\nFolgende Personen sind nicht verfügbar:\n\n${preview}${more}`);
                return;
            }
        }

        const key = `roster_released_${year}_${currentMonth}`;
        try {
            await (window as any).api.setSetting(key, newVal ? '1' : '0');
            setReleasedMonths(prev => {
                const next = [...prev];
                next[currentMonth] = newVal;
                return next;
            });
        } catch (e) { console.warn('Failed to save released status', e); }
    };

    useEffect(() => {
        const loadUe50 = async () => {
            try {
                let ue50QualName = 'Ü50';
                const setting = await (window as any).api.getSetting('ue50_qualification_type');
                if (setting) ue50QualName = String(setting);

                const ids = new Set<number>();
                for (const p of personnel) {
                    try {
                        const periods = await (window as any).api.getQualificationPeriods?.(p.id) || [];
                        for (let month = 0; month < 12; month++) {
                            const yearMonth = `${year}-${String(month + 1).padStart(2, '0')}`;
                            const hasUe50 = periods.some((per: any) =>
                                per.active &&
                                per.qualType === ue50QualName &&
                                per.startYM <= yearMonth &&
                                (!per.endYM || per.endYM >= yearMonth)
                            );
                            if (hasUe50) {
                                ids.add(p.id);
                                break;
                            }
                        }
                    } catch { }
                }
                setUe50Ids(ids);
            } catch { setUe50Ids(new Set()); }
        };
        loadUe50();
    }, [year, personnel]);

    useEffect(() => {
        const load = async () => {
            try {
                const dep = await (window as any).api.getSetting('department');
                if (dep) setDepartment(Number(dep));
            } catch { }
            try { const r = await (window as any).api.getRtwVehicles?.(); if (Array.isArray(r)) setRtwVehicles(r); } catch { }
            try { const n = await (window as any).api.getNefVehicles?.(); if (Array.isArray(n)) setNefVehicles(n); } catch { }
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
            } catch { }
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
            } catch { }
            try {
                const itwVal = await (window as any).api.getSetting('itw');
                setItwEnabled(itwVal === 'true' || itwVal === '1');
            } catch { }
            // ITW Sequenzen laden
            try {
                const norm = (arr: string[], len = 21) => (arr || []).slice(0, len).concat(Array(len).fill('')).slice(0, len).map(v => (v === 'IW' ? 'IW' : ''));
                const seqs = await (window as any).api.getItwPatterns?.();
                if (Array.isArray(seqs) && seqs.length > 0) {
                    const parsed = seqs.map((s: any) => ({ startDate: String(s.startDate), pattern: norm(String(s.pattern).split(',').map((x: string) => x.trim()), 21) }));
                    parsed.sort((a, b) => a.startDate.localeCompare(b.startDate));
                    setItwPatternSeqs(parsed);
                }
            } catch { }
            try {
                const types = await (window as any).api.getShiftTypes();
                setShiftTypes(types || []);
                const map: Record<string, 'off' | 'tag' | 'nacht' | '24h' | 'itw'> = {};
                for (const t of (types || [])) {
                    const v = await (window as any).api.getSetting(`auswertung_${t.code}`);
                    map[t.code] = (v || 'off') as any;
                }
                setAuswertungByType(map);
            } catch (e) {
                // console.error('[MonthTabs] Error loading shift types:', e);
            }
            try {
                const docs = await (window as any).api.getItwDoctors?.();
                if (Array.isArray(docs)) setItwDoctors(docs);
            } catch { }
            // Feiertage laden
            try {
                const list = await (window as any).api.getHolidaysForYear?.(year);
                const s = new Set<string>((list || []).map((h: any) => String(h.date)));
                setHolidays(s);
            } catch { }
        };
        load();
        const onSettingsUpdated = async () => {
            try {
                const y = await (window as any).api.getSetting('year');
                const yearNum = Number(y || new Date().getFullYear());
                // Fahrzeuge neu laden (z.B. nach Löschen)
                try { const r = await (window as any).api.getRtwVehicles?.(); if (Array.isArray(r)) setRtwVehicles(r); } catch { }
                try { const n = await (window as any).api.getNefVehicles?.(); if (Array.isArray(n)) setNefVehicles(n); } catch { }
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
                } catch { }
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
                } catch { }
                // ITW-Sequenzen aktualisieren
                try {
                    const norm = (arr: string[], len = 21) => (arr || []).slice(0, len).concat(Array(len).fill('')).slice(0, len).map(v => (v === 'IW' ? 'IW' : ''));
                    const seqs = await (window as any).api.getItwPatterns?.();
                    if (Array.isArray(seqs) && seqs.length > 0) {
                        const parsed = seqs.map((s: any) => ({ startDate: String(s.startDate), pattern: norm(String(s.pattern).split(',').map((x: string) => x.trim()), 21) }));
                        parsed.sort((a, b) => a.startDate.localeCompare(b.startDate));
                        setItwPatternSeqs(parsed);
                    }
                } catch { }
                // Feiertage für Settings-Jahr neu laden
                try {
                    const list = await (window as any).api.getHolidaysForYear?.(yearNum);
                    const s = new Set<string>((list || []).map((h: any) => String(h.date)));
                    setHolidays(s);
                } catch { }
            } catch { }
        };
        (window as any).api?.onSettingsUpdated?.(onSettingsUpdated);
        // Event-Handler entfernt - Parent (EinteilungPage) kümmert sich um Roster-Updates
        return () => { (window as any).api?.offSettingsUpdated?.(onSettingsUpdated); };
    }, []);

    // Synchronisiere currentMonth mit window-Objekt für Dienstplan
    useEffect(() => {
        (window as any).rdPlanMonth = currentMonth;
        window.dispatchEvent(new CustomEvent('rdplan-month-changed', { detail: { month: currentMonth } }));
    }, [currentMonth]);

    // Intelligenter Sync: Nur updaten, wenn sich wirklich was geändert hat UND wir nicht gerade lokal updaten
    useEffect(() => {
        if (!roster || isUpdating) return; // Skip während lokaler Updates

        // Nur synchronisieren, wenn der Parent-State sich wirklich geändert hat
        const currentKeys = Object.keys(localRoster);
        const newKeys = Object.keys(roster);
        const hasChanged = currentKeys.length !== newKeys.length ||
            newKeys.some(key => JSON.stringify(localRoster[key]) !== JSON.stringify(roster[key]));

        if (hasChanged) {
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
                const seqs = [...deptPatternSeqs].sort((a, b) => a.startDate.localeCompare(b.startDate));
                let active = seqs[0];
                for (const s of seqs) { if (s.startDate <= iso) active = s; else break; }
                const start = new Date((active?.startDate || '1970-01-01') + 'T00:00:00Z');
                const cur = new Date(iso + 'T00:00:00Z');
                const diffDays = Math.floor((cur.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
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
            } catch { }
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
            } catch { }
        };
        loadActs();
    }, [year]);

    // Feiertage bei Jahreswechsel neu laden
    useEffect(() => {
        (async () => {
            try {
                const list = await (window as any).api.getHolidaysForYear?.(year);
                const s = new Set<string>((list || []).map((h: any) => String(h.date)));
                setHolidays(s);
            } catch { }
        })();
    }, [year]);

    // Cleanup effect für Debounce-Timeout
    useEffect(() => {
        return () => {
            if (updateTimeout) clearTimeout(updateTimeout);
        };
    }, [updateTimeout]);

    const getDutyCodeForDate = useCallback((key: string, date: string): string => {
        try {
            const vLocal = (localRoster as any)?.[key]?.[date]?.value;
            const vGlobal = (roster as any)?.[key]?.[date]?.value;
            return (vLocal ?? vGlobal ?? '') as string;
        } catch { return ''; }
    }, [localRoster, roster]);

    const allowedByAuswertung = useCallback((code: string, desired: 'tag' | 'nacht' | '24h' | 'any'): boolean => {
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
    }, [auswertungByType]);

    const getAssignedValueFor = useCallback((date: string, slotId: string): string => {
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
        return '';
    }, [localRoster, roster]);
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

    const handleAssign = useCallback(async (date: string, dayIdx: number, value: string, slotId?: string) => {
        if (!value) return;
        const [t, idStr] = value.split(':');
        const pid = Number(idStr);
        const ptype = t === 'a' ? 'azubi' : (t === 'd' ? 'doctor' : 'person');
        try {
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

            // Debounced Backend-Call
            if (updateTimeout) clearTimeout(updateTimeout);

            const timeout = setTimeout(async () => {
                await (window as any).api.assignSlot({ personId: pid, personType: ptype, date, slotType: slotId || '' });

                if (onRosterChanged) onRosterChanged();

                setTimeout(() => setIsUpdating(false), 100);
            }, 300); // 300ms Debounce

            setUpdateTimeout(timeout);

            if (onEntryAssigned) onEntryAssigned(key, date, (localRoster[key]?.[date]?.value || ''), slotId || '');
        } catch (e) {
            setIsUpdating(false);
        }
    }, [localRoster, updateTimeout, onRosterChanged, onEntryAssigned]);
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
            // Silently ignore errors
        }
    };

    const vehicleHeaderRef = React.useRef<HTMLDivElement>(null);
    const contentRef = React.useRef<HTMLDivElement>(null);
    const fixedHeaderContainerRef = React.useRef<HTMLDivElement>(null);
    const [headerHeight, setHeaderHeight] = React.useState(280);

    // Messe die Höhe des Fixed Header Containers
    React.useEffect(() => {
        const measureHeader = () => {
            if (fixedHeaderContainerRef.current) {
                const height = fixedHeaderContainerRef.current.offsetHeight;
                setHeaderHeight(height + 10); // +10px Sicherheitsabstand
            }
        };

        measureHeader();

        // Messe erneut bei Größenänderungen
        const resizeObserver = new ResizeObserver(measureHeader);
        if (fixedHeaderContainerRef.current) {
            resizeObserver.observe(fixedHeaderContainerRef.current);
        }

        return () => {
            resizeObserver.disconnect();
        };
    }, [viewMode, currentMonth, rtwVehicles, nefVehicles, rtwActivations, nefActivations, sidebarCollapsed]);

    // Synchronisiere Scroll zwischen Fahrzeug-Header und Content
    const handleContentScroll = (e: React.UIEvent<HTMLDivElement>) => {
        if (vehicleHeaderRef.current) {
            vehicleHeaderRef.current.scrollLeft = e.currentTarget.scrollLeft;
        }
    };

    return (
        <div key={forceUpdateCounter}>
            {/* Gemeinsamer Fixed Header Container */}
            <div
                ref={fixedHeaderContainerRef}
                style={{
                    position: 'fixed',
                    top: 'clamp(56px, 6.5vw, 90px)',
                    left: sidebarCollapsed ? 66 : 210,
                    right: 392,
                    zIndex: 100,
                    background: 'var(--bg)',
                    paddingLeft: 25,
                    paddingRight: 25,
                    transition: 'left 0.15s'
                }}
            >
                {/* Sub‑Header: RTW/ITW Einteilung (Monat) */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: 8,
                    paddingBottom: 14
                }}>
                    <span style={{ fontSize: 18, fontWeight: 700 }}>
                        {viewMode === 'rtwnef' ? 'RTW Einteilung' : 'ITW Einteilung'} ({months[currentMonth]})
                    </span>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
                        <span style={{ fontSize: 14, color: '#666' }}>Status:</span>
                        <div style={{
                            position: 'relative',
                            width: 40,
                            height: 20,
                            background: releasedMonths[currentMonth] ? '#28a745' : '#dc3545',
                            borderRadius: 10,
                            transition: 'background 0.3s'
                        }}>
                            <div style={{
                                position: 'absolute',
                                top: 2,
                                left: releasedMonths[currentMonth] ? 22 : 2,
                                width: 16,
                                height: 16,
                                background: 'white',
                                borderRadius: '50%',
                                transition: 'left 0.3s',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                            }} />
                        </div>
                        <input
                            type="checkbox"
                            checked={releasedMonths[currentMonth]}
                            onChange={toggleReleased}
                            disabled={!canWrite}
                            style={{ display: 'none' }}
                        />
                        <span style={{ fontSize: 14, fontWeight: 600, color: releasedMonths[currentMonth] ? '#28a745' : '#dc3545', minWidth: 120 }}>
                            {releasedMonths[currentMonth] ? 'Freigegeben' : 'In Bearbeitung'}
                        </span>
                    </label>
                </div>
                {/* Monats-Tabs */}
                <div style={{
                    display: 'flex',
                    gap: '4px',
                    borderBottom: '1px solid #e5e7eb',
                    flexWrap: 'wrap',
                    paddingTop: 4,
                    paddingBottom: 20
                }}>
                    {months.map((m, i) => {
                        // Status-Farbe: Grün wenn freigegeben, Rot wenn nicht
                        const isReleased = releasedMonths[i];
                        const stripeColor = isReleased ? '#28a745' : '#dc3545';

                        return (
                            <button
                                key={i}
                                onClick={() => {
                                    onMonthChange(i);
                                    // Informiere andere Komponenten über Monatsänderung
                                    (window as any).rdPlanMonth = i;
                                    window.dispatchEvent(new CustomEvent('rdplan-month-changed', { detail: { month: i } }));
                                }}
                                style={{
                                    padding: '8px 16px',
                                    background: currentMonth === i ? '#f8f9fa' : 'transparent',
                                    border: 'none',
                                    borderBottom: `3px solid ${stripeColor}`,
                                    cursor: 'pointer',
                                    fontWeight: currentMonth === i ? 600 : 400,
                                    color: currentMonth === i ? '#374151' : '#6b7280',
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
                {/* Ansichts-Umschalter (RTW/NEF + ITW) */}
                <div style={{
                    display: 'flex',
                    gap: '4px',
                    borderBottom: '1px solid #e5e7eb',
                    paddingTop: 12,
                    paddingBottom: 20
                }}>
                    {(() => {
                        // Prüfe ob die hervorgehobene Person im jeweils anderen Tab Einteilungen hat
                        let hasRtwNefAssignments = false;
                        let hasItwAssignments = false;

                        if (highlightedPersonKey) {
                            // Hole die Daten der hervorgehobenen Person
                            const personData = (localRoster as any)?.[highlightedPersonKey] || (roster as any)?.[highlightedPersonKey];

                            if (personData) {
                                // Durchsuche ALLE Tage im aktuellen Monat
                                const daysInMonth = new Date(year, currentMonth + 1, 0).getDate();
                                for (let d = 1; d <= daysInMonth; ++d) {
                                    const date = new Date(Date.UTC(year, currentMonth, d)).toISOString().slice(0, 10);
                                    const entry = personData[date];

                                    if (entry && entry.type) {
                                        const type = entry.type;

                                        // Prüfe ob RTW/NEF Einteilung
                                        if (type.startsWith('rtw') || type.startsWith('nef')) {
                                            hasRtwNefAssignments = true;
                                        }

                                        // Prüfe ob ITW Einteilung
                                        if (type.startsWith('itw_row_')) {
                                            hasItwAssignments = true;
                                        }
                                    }
                                }
                            }
                        }

                        const showRtwNefIndicator = viewMode === 'itw' && hasRtwNefAssignments;
                        const showItwIndicator = viewMode === 'rtwnef' && hasItwAssignments;

                        return (
                            <>
                                <button
                                    onClick={() => setViewMode('rtwnef')}
                                    style={{
                                        padding: '8px 16px',
                                        background: viewMode === 'rtwnef' ? '#f8f9fa' : (showRtwNefIndicator ? '#fef2f2' : 'transparent'),
                                        border: 'none',
                                        borderBottom: viewMode === 'rtwnef' ? '3px solid #dc3545' : '3px solid transparent',
                                        cursor: 'pointer',
                                        fontWeight: viewMode === 'rtwnef' ? 600 : (showRtwNefIndicator ? 600 : 400),
                                        color: viewMode === 'rtwnef' ? '#dc3545' : (showRtwNefIndicator ? '#dc2626' : '#6b7280'),
                                        transition: 'all 0.2s',
                                        fontSize: '14px',
                                        position: 'relative'
                                    }}
                                    onMouseEnter={(e) => {
                                        if (viewMode !== 'rtwnef') {
                                            e.currentTarget.style.background = '#f3f4f6';
                                            e.currentTarget.style.color = '#374151';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (viewMode !== 'rtwnef') {
                                            e.currentTarget.style.background = showRtwNefIndicator ? '#fef2f2' : 'transparent';
                                            e.currentTarget.style.color = showRtwNefIndicator ? '#dc2626' : '#6b7280';
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
                                        background: viewMode === 'itw' ? '#f8f9fa' : (showItwIndicator ? '#fefce8' : 'transparent'),
                                        border: 'none',
                                        borderBottom: viewMode === 'itw' ? '3px solid #ffc107' : '3px solid transparent',
                                        cursor: itwEnabled ? 'pointer' : 'not-allowed',
                                        fontWeight: viewMode === 'itw' ? 600 : (showItwIndicator ? 600 : 400),
                                        color: viewMode === 'itw' ? '#ffc107' : (showItwIndicator ? '#ca8a04' : '#6b7280'),
                                        transition: 'all 0.2s',
                                        fontSize: '14px',
                                        opacity: itwEnabled ? 1 : 0.5,
                                        position: 'relative'
                                    }}
                                    onMouseEnter={(e) => {
                                        if (viewMode !== 'itw' && itwEnabled) {
                                            e.currentTarget.style.background = '#f3f4f6';
                                            e.currentTarget.style.color = '#374151';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (viewMode !== 'itw' && itwEnabled) {
                                            e.currentTarget.style.background = showItwIndicator ? '#fefce8' : 'transparent';
                                            e.currentTarget.style.color = showItwIndicator ? '#ca8a04' : '#6b7280';
                                        }
                                    }}
                                >
                                    ITW
                                </button>
                            </>
                        );
                    })()}
                </div>

                {/* Fahrzeug-Header (RTW/NEF) im Fixed Container */}
                {viewMode === 'rtwnef' && (
                    <div
                        ref={vehicleHeaderRef}
                        style={{ overflowX: 'auto', overflowY: 'hidden', background: 'var(--bg)' }}
                        onScroll={(e) => {
                            // Synchronisiere zurück zum Content wenn Header gescrollt wird
                            if (contentRef.current) {
                                contentRef.current.scrollLeft = e.currentTarget.scrollLeft;
                            }
                        }}
                    >
                        <div className={styles.container}>
                            {(rtwVehicles || []).map((v, rIdx) => {
                                const enabled = (rtwActivations[v.id] ?? Array(12).fill(true))[currentMonth] !== false;
                                if (!enabled) return null;
                                return (
                                    <div key={`rtw_header_${rIdx}`} style={{
                                        marginRight: 0,
                                        marginBottom: 8,
                                        minWidth: 339,
                                        paddingTop: 8,
                                        paddingLeft: 8,
                                        background: 'var(--bg)'
                                    }}>
                                        <div style={{ paddingBottom: 4, borderBottom: '2px solid #ef4444' }}>
                                            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', marginBottom: 4 }}>{v.name || rtwNames[rIdx] || ''}</div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 1fr', gap: '6px' }}>
                                                <div></div>
                                                <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textAlign: 'center' }}>Tag</div>
                                                <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textAlign: 'center' }}>Nacht</div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            {(nefVehicles || []).map((v, nIdx) => {
                                const enabled = (nefActivations[v.id] ?? Array(12).fill(true))[currentMonth] !== false;
                                if (!enabled) return null;
                                const nefLabel = v.occupancy_mode === '24h' ? '24h' : 'Tag';
                                return (
                                    <div key={`nef_header_${nIdx}`} style={{
                                        marginLeft: 8,
                                        marginBottom: 8,
                                        minWidth: 239,
                                        paddingTop: 8,
                                        paddingLeft: 0,
                                        background: 'var(--bg)'
                                    }}>
                                        <div style={{ paddingBottom: 4, borderBottom: '2px solid #ef4444' }}>
                                            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', marginBottom: 4 }}>{v.name || nefName || ''}</div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr', gap: '6px' }}>
                                                <div></div>
                                                <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textAlign: 'center' }}>{nefLabel}</div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Fahrzeug-Header (ITW) im Fixed Container */}
                {viewMode === 'itw' && itwEnabled && (
                    <div style={{ padding: '8px 12px', borderBottom: '2px solid #f59e0b' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', textAlign: 'left' }}>ITW</div>
                    </div>
                )}

            </div>
            {/* Ende Fixed Header Container */}

            {/* Content-Bereich mit padding-top um Platz für fixed Header zu schaffen */}
            <div
                ref={contentRef}
                style={{
                    paddingTop: headerHeight,
                    paddingBottom: 12,
                    paddingLeft: sidebarCollapsed ? 46 : 46,
                    paddingRight: 25,
                    overflowX: 'auto',
                    overflowY: 'visible',
                    transition: 'padding-left 0.15s',
                    boxSizing: 'border-box'
                }}
                onScroll={handleContentScroll}
            >

                {/* View Protection: Hide content if read-only and not released */}
                {!canWrite && !releasedMonths[currentMonth] ? (
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '400px',
                        color: '#6b7280',
                        background: '#f9fafb',
                        borderRadius: '8px',
                        border: '1px dashed #d1d5db',
                        margin: '20px'
                    }}>
                        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
                        <div style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Einteilung noch nicht freigegeben</div>
                        <div style={{ fontSize: '14px' }}>Die Einteilung für diesen Monat ist derzeit nur für Administratoren sichtbar.</div>
                    </div>
                ) : (
                    <>

                        {/* ========================================================== */}
                        {/* GEMEINSAME SOLL-BERECHNUNG für RTW-Tab und ITW-Tab        */}
                        {/* ========================================================== */}
                        {(() => {
                            const computeSharedTargets = () => {
                                // 1. Flatten Roster for Shared Calculation
                                const flattenedRoster: any[] = [];
                                const mergedKeys = Array.from(new Set([...Object.keys(roster || {}), ...Object.keys(localRoster || {})]));
                                for (const key of mergedKeys) {
                                    const pid = Number(key.replace(/^[pa]_/, ''));
                                    const pType = key.startsWith('p_') ? 'person' : 'azubi';
                                    const rowMap = { ...(roster?.[key] || {}), ...(localRoster?.[key] || {}) };
                                    for (const [date, cell] of Object.entries(rowMap)) {
                                        if (cell) {
                                            flattenedRoster.push({
                                                date,
                                                personId: pid,
                                                personType: pType,
                                                type: cell.type,
                                                value: cell.value
                                            });
                                        }
                                    }
                                }

                                // 2. Calculate Targets using Shared Utility
                                const targetsByPersonId = calculateTargets(
                                    year,
                                    flattenedRoster,
                                    personnel,
                                    azubis,
                                    ue50Ids,
                                    auswertungByType,
                                    {
                                        rtw: rtwVehicles,
                                        nef: nefVehicles.map(n => ({ ...n, occupancyMode: n.occupancy_mode }))
                                    },
                                    { rtwActs: rtwActivations, nefActs: nefActivations },
                                    department,
                                    deptPatternSeqs || [],
                                    hlfbPeriodsByPerson
                                );

                                // 3. Map Targets to MonthTabs format
                                const targetYearMap: Record<string, number> = {};
                                const allocTargetsInMonth: Record<string, number> = {};

                                for (const p of personnel) {
                                    const key = `p_${p.id}`;
                                    const t = targetsByPersonId[p.id] || Array(12).fill(0);
                                    targetYearMap[key] = t.reduce((a, b) => a + b, 0);
                                    allocTargetsInMonth[key] = t[currentMonth];
                                }

                                // 4. Calculate Driven/Assigned Stats (Local Logic preserved)
                                const drivenYearMap: Record<string, number> = {};
                                const perPersonAssignedWeightedInMonth: Record<string, number> = {};
                                const perPersonNefInMonth: Record<string, number> = {};
                                const perPersonItwInMonth: Record<string, number> = {};
                                const perPersonRtwTagNightYear: Record<string, { tag: number; nacht: number }> = {};
                                const perPersonRtwTagNightInMonth: Record<string, { tag: number; nacht: number }> = {};

                                const daysInMonth = new Date(year, currentMonth + 1, 0).getDate();
                                const allMonthDays: string[] = [];
                                for (let i = 1; i <= daysInMonth; i++) {
                                    allMonthDays.push(new Date(Date.UTC(year, currentMonth, i)).toISOString().slice(0, 10));
                                }

                                // Helper to get cell from local or global roster
                                const getCell = (key: string, iso: string) => (localRoster as any)?.[key]?.[iso] || (roster as any)?.[key]?.[iso];

                                // Berechne kumulative Soll/Ist-Werte bis zum aktuellen Monat (einschließlich)
                                const targetCumulativeMap: Record<string, number> = {};
                                const drivenCumulativeMap: Record<string, number> = {};

                                for (const p of personnel) {
                                    const key = `p_${p.id}`;
                                    const t = targetsByPersonId[p.id] || Array(12).fill(0);

                                    // Summiere Soll-Schichten von Januar bis aktuellen Monat (einschließlich)
                                    let cumTarget = 0;
                                    for (let m = 0; m <= currentMonth; m++) {
                                        cumTarget += t[m];
                                    }
                                    targetCumulativeMap[key] = cumTarget;

                                    // Summiere Ist-Schichten von Januar bis aktuellen Monat (einschließlich)
                                    // Verwende die gleiche Logik wie bei der monatlichen Zählung (RTW/NEF nur an Abteilungstagen)
                                    let cumDriven = 0;
                                    for (let mIdx = 0; mIdx <= currentMonth; mIdx++) {
                                        const dim = new Date(year, mIdx + 1, 0).getDate();

                                        // Ermittle Abteilungstage für diesen Monat
                                        const deptDays: string[] = [];
                                        for (let i = 1; i <= dim; i++) {
                                            const iso = new Date(Date.UTC(year, mIdx, i)).toISOString().slice(0, 10);
                                            const seqs = [...(deptPatternSeqs || [])].sort((a, b) => a.startDate.localeCompare(b.startDate));
                                            let active = seqs[0];
                                            for (const s of seqs) { if (s.startDate <= iso) active = s; else break; }
                                            const start = new Date((active?.startDate || '1970-01-01') + 'T00:00:00Z');
                                            const cur = new Date(iso + 'T00:00:00Z');
                                            const diffDays = Math.floor((cur.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                                            const pat = active?.pattern || [];
                                            const depDay = pat.length ? pat[((diffDays % 21) + 21) % 21] : '';
                                            if (depDay && String(department) === depDay) deptDays.push(iso);
                                        }

                                        // Zähle RTW/NEF nur an Abteilungstagen
                                        for (const iso of deptDays) {
                                            const cell = getCell(key, iso);
                                            const t = String(cell?.type || '');
                                            if (/^rtw\d+_(tag|nacht)_(1|2)$/.test(t)) cumDriven += 1;
                                            else if (/^nef(\d+)?_assist$/.test(t)) cumDriven += 2;
                                        }

                                        // ITW zählt an allen Tagen des Monats
                                        for (let i = 1; i <= dim; i++) {
                                            const iso = new Date(Date.UTC(year, mIdx, i)).toISOString().slice(0, 10);
                                            const cell = getCell(key, iso);
                                            const t = String(cell?.type || '');
                                            if (t.startsWith('itw_row_')) {
                                                cumDriven += 1;
                                            }
                                        }
                                    }
                                    drivenCumulativeMap[key] = cumDriven;
                                }

                                for (const p of (personnel || [])) {
                                    const key = `p_${p.id}`;

                                    // Yearly Stats
                                    let sumDrivenY = 0;
                                    let tagCntY = 0;
                                    let nachtCntY = 0;
                                    for (let mIdx = 0; mIdx < 12; mIdx++) {
                                        const dim = new Date(year, mIdx + 1, 0).getDate();
                                        for (let i = 1; i <= dim; i++) {
                                            const iso = new Date(Date.UTC(year, mIdx, i)).toISOString().slice(0, 10);
                                            const cell = getCell(key, iso);
                                            const t = String(cell?.type || '');
                                            if (/^rtw\d+_(tag|nacht)_(1|2)$/.test(t)) sumDrivenY += 1;
                                            else if (t.startsWith('itw_row_')) sumDrivenY += 1;
                                            else if (/^nef(\d+)?_assist$/.test(t)) sumDrivenY += 2;

                                            if (/^rtw\d+_tag_(1|2)$/.test(t)) tagCntY += 1;
                                            if (/^rtw\d+_nacht_(1|2)$/.test(t)) nachtCntY += 1;
                                        }
                                    }
                                    drivenYearMap[key] = sumDrivenY;
                                    perPersonRtwTagNightYear[key] = { tag: tagCntY, nacht: nachtCntY };

                                    // Monthly Stats (aktueller Monat für Soll/Ist)
                                    let cntM = 0;
                                    let tagCntM = 0;
                                    let nachtCntM = 0;

                                    // NEF und ITW Stats für das GESAMTE JAHR
                                    let nefCntYear = 0;
                                    let itwCntYear = 0;

                                    // Filter days where department is active (aktueller Monat)
                                    const monthDeptIsos: string[] = (() => {
                                        const list: string[] = [];
                                        for (let i = 1; i <= daysInMonth; i++) {
                                            const iso = new Date(Date.UTC(year, currentMonth, i)).toISOString().slice(0, 10);
                                            const seqs = [...(deptPatternSeqs || [])].sort((a, b) => a.startDate.localeCompare(b.startDate));
                                            let active = seqs[0];
                                            for (const s of seqs) { if (s.startDate <= iso) active = s; else break; }
                                            const start = new Date((active?.startDate || '1970-01-01') + 'T00:00:00Z');
                                            const cur = new Date(iso + 'T00:00:00Z');
                                            const diffDays = Math.floor((cur.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                                            const pat = active?.pattern || [];
                                            const depDay = pat.length ? pat[((diffDays % 21) + 21) % 21] : '';
                                            if (depDay && String(department) === depDay) list.push(iso);
                                        }
                                        return list;
                                    })();

                                    for (const iso of monthDeptIsos) {
                                        const cell = getCell(key, iso);
                                        const t = String(cell?.type || '');
                                        if (/^rtw\d+_(tag|nacht)_(1|2)$/.test(t)) cntM += 1;
                                        if (/^rtw\d+_tag_(1|2)$/.test(t)) tagCntM += 1;
                                        if (/^rtw\d+_nacht_(1|2)$/.test(t)) nachtCntM += 1;
                                        else if (/^nef(\d+)?_assist$/.test(t)) cntM += 2;
                                    }
                                    // ITW counts (aktueller Monat) - zählt für cntM
                                    for (const iso of allMonthDays) {
                                        const cell = getCell(key, iso);
                                        const t = String(cell?.type || '');
                                        if (t.startsWith('itw_row_')) {
                                            cntM += 1;
                                        }
                                    }

                                    // NEF und ITW für GESAMTES JAHR zählen
                                    for (let mIdx = 0; mIdx < 12; mIdx++) {
                                        const dim = new Date(year, mIdx + 1, 0).getDate();

                                        // NEF an Abteilungstagen
                                        for (let i = 1; i <= dim; i++) {
                                            const iso = new Date(Date.UTC(year, mIdx, i)).toISOString().slice(0, 10);
                                            // Prüfe ob Abteilungstag
                                            const seqs = [...(deptPatternSeqs || [])].sort((a, b) => a.startDate.localeCompare(b.startDate));
                                            let active = seqs[0];
                                            for (const s of seqs) { if (s.startDate <= iso) active = s; else break; }
                                            const start = new Date((active?.startDate || '1970-01-01') + 'T00:00:00Z');
                                            const cur = new Date(iso + 'T00:00:00Z');
                                            const diffDays = Math.floor((cur.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                                            const pat = active?.pattern || [];
                                            const depDay = pat.length ? pat[((diffDays % 21) + 21) % 21] : '';

                                            if (depDay && String(department) === depDay) {
                                                const cell = getCell(key, iso);
                                                const t = String(cell?.type || '');
                                                if (/^nef(\d+)?_assist$/.test(t)) nefCntYear += 2;
                                            }
                                        }

                                        // ITW an allen Tagen
                                        for (let i = 1; i <= dim; i++) {
                                            const iso = new Date(Date.UTC(year, mIdx, i)).toISOString().slice(0, 10);
                                            const cell = getCell(key, iso);
                                            const t = String(cell?.type || '');
                                            if (t.startsWith('itw_row_')) itwCntYear += 1;
                                        }
                                    }

                                    perPersonAssignedWeightedInMonth[key] = cntM;
                                    perPersonRtwTagNightInMonth[key] = { tag: tagCntM, nacht: nachtCntM };
                                    perPersonNefInMonth[key] = nefCntYear;  // Jetzt Jahressumme
                                    perPersonItwInMonth[key] = itwCntYear;  // Jetzt Jahressumme
                                }

                                return {
                                    targetYearMap,
                                    drivenYearMap,
                                    allocTargetsInMonth,
                                    perPersonAssignedWeightedInMonth,
                                    perPersonNefInMonth,
                                    perPersonItwInMonth,
                                    perPersonRtwTagNightYear,
                                    targetCumulativeMap,
                                    drivenCumulativeMap
                                };
                            };

                            (window as any).__sharedTargets = computeSharedTargets();
                            return null;
                        })()}

                        {viewMode === 'rtwnef' && (
                            <>
                                {days.map(d => {
                                    const getDutyCodeFor = (key: string) => getDutyCodeForDate(key, d.date);
                                    const getAssignedValue = (slotId: string) => getAssignedValueFor(d.date, slotId);
                                    const clearAssignedForSlot = async (slotId: string) => clearAssignedForDate(slotId, d.date);
                                    const isFirstDay = days.length > 0 && days[0].date === d.date;

                                    // Prüfe ob hervorgehobene Person an diesem Tag eingeteilt oder verfügbar ist
                                    let dayHighlightColor: string | undefined = undefined;
                                    if (highlightedPersonKey) {
                                        const personId = highlightedPersonKey.replace('p_', '');
                                        const personValue = `p:${personId}`;

                                        // Prüfe alle Slots an diesem Tag
                                        let isAssigned = false;
                                        let isAvailable = false;

                                        // RTW Slots prüfen
                                        for (let rIdx = 0; rIdx < (rtwVehicles || []).length; rIdx++) {
                                            const slots = [
                                                `rtw${rIdx + 1}_tag_1`, `rtw${rIdx + 1}_nacht_1`,
                                                `rtw${rIdx + 1}_tag_2`, `rtw${rIdx + 1}_nacht_2`
                                            ];
                                            for (const slotId of slots) {
                                                const value = getAssignedValueFor(d.date, slotId);
                                                if (value === personValue) {
                                                    isAssigned = true;
                                                    break;
                                                }
                                            }
                                            if (isAssigned) break;
                                        }

                                        // NEF Slots prüfen
                                        if (!isAssigned) {
                                            for (let nIdx = 0; nIdx < (nefVehicles || []).length; nIdx++) {
                                                const slotId = `nef${nIdx + 1}_assist`;
                                                const value = getAssignedValueFor(d.date, slotId);
                                                if (value === personValue) {
                                                    isAssigned = true;
                                                    break;
                                                }
                                            }
                                        }

                                        // Wenn nicht eingeteilt, prüfe ob verfügbar
                                        if (!isAssigned) {
                                            const dutyCode = getDutyCodeFor(highlightedPersonKey);
                                            if (dutyCode && dutyCode.trim() !== '') {
                                                const evalMode = auswertungByType[dutyCode];
                                                if (evalMode && evalMode !== 'off') {
                                                    isAvailable = true;
                                                }
                                            }
                                        }

                                        // Nur grün markieren wenn verfügbar (nicht eingeteilt)
                                        if (isAvailable) {
                                            dayHighlightColor = '#e8f5e9'; // Grün: verfügbar
                                        }
                                    }

                                    return (
                                        <div key={d.date} style={{ marginBottom: 12 }}>
                                            {(() => {
                                                const dt = new Date(d.date + 'T00:00:00');
                                                const label = dt.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }); // DD.MM
                                                return (
                                                    <div style={{
                                                        position: 'sticky',
                                                        top: 0,
                                                        background: dayHighlightColor || 'var(--bg)',
                                                        zIndex: 2,
                                                        textAlign: 'left',
                                                        fontWeight: 600,
                                                        marginBottom: 6,
                                                        padding: '2px 0',
                                                        borderRadius: dayHighlightColor ? 4 : 0,
                                                        paddingLeft: dayHighlightColor ? 6 : 0,
                                                        paddingRight: dayHighlightColor ? 6 : 0
                                                    }}>
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
                                                                <div className={styles.rowLabel}>FzF</div>
                                                                {(() => {
                                                                    const slotId = `rtw${rIdx + 1}_tag_1`;
                                                                    const value = getAssignedValue(slotId);

                                                                    const optionsP = personnel
                                                                        .filter(p => {
                                                                            const hasQual = p.fahrzeugfuehrer;
                                                                            const dutyCode = getDutyCodeFor(`p_${p.id}`);
                                                                            const allowed = allowedByAuswertung(dutyCode, 'tag');
                                                                            return allowed && hasQual;
                                                                        })
                                                                        .map(p => ({ value: `p:${p.id}`, label: `${p.name}` }));
                                                                    const renderOptions = value && !optionsP.some(o => o.value === value)
                                                                        ? [{ value, label: findPersonLabelByValue(value) }, ...optionsP] : optionsP;

                                                                    // Prüfe ob hervorgehobene Person eingeteilt ist (rot)
                                                                    const isAssigned = highlightedPersonKey && value && value.startsWith('p:') && value === `p:${highlightedPersonKey.replace('p_', '')}`;
                                                                    const highlightStyle = isAssigned ? { background: '#ffebee', fontWeight: 600 } : undefined;

                                                                    return (
                                                                        <select
                                                                            className={styles.select}
                                                                            value={value}
                                                                            disabled={!canWrite}
                                                                            style={highlightStyle}
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
                                                                        .filter(p => allowedByAuswertung(getDutyCodeFor(`p_${p.id}`), 'nacht') && p.fahrzeugfuehrer)
                                                                        .map(p => ({ value: `p:${p.id}`, label: `${p.name}` }));
                                                                    const renderOptions = value && !optionsP.some(o => o.value === value)
                                                                        ? [{ value, label: findPersonLabelByValue(value) }, ...optionsP] : optionsP;

                                                                    // Prüfe ob hervorgehobene Person eingeteilt ist (blau)
                                                                    const isAssigned = highlightedPersonKey && value && value.startsWith('p:') && value === `p:${highlightedPersonKey.replace('p_', '')}`;
                                                                    const highlightStyle = isAssigned ? { background: '#e3f2fd', fontWeight: 600 } : undefined;

                                                                    return (
                                                                        <select
                                                                            className={styles.select}
                                                                            value={value}
                                                                            disabled={!canWrite}
                                                                            style={highlightStyle}
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

                                                                    const isAssigned = highlightedPersonKey && value && value.startsWith('p:') && value === `p:${highlightedPersonKey.replace('p_', '')}`;
                                                                    const highlightStyle = isAssigned ? { background: '#ffebee', fontWeight: 600 } : undefined;

                                                                    return (
                                                                        <select className={styles.select} value={value}
                                                                            disabled={!canWrite}
                                                                            style={highlightStyle}
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

                                                                    const isAssigned = highlightedPersonKey && value && value.startsWith('p:') && value === `p:${highlightedPersonKey.replace('p_', '')}`;
                                                                    const highlightStyle = isAssigned ? { background: '#e3f2fd', fontWeight: 600 } : undefined;

                                                                    return (
                                                                        <select className={styles.select} value={value}
                                                                            disabled={!canWrite}
                                                                            style={highlightStyle}
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
                                                                            disabled={!canWrite}
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
                                                                            disabled={!canWrite}
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
                                                                <div className={styles.rowLabel}>FzF</div>
                                                                {(() => {
                                                                    const slotId = `nef${nefIdx + 1}_assist`;
                                                                    const value = (() => {
                                                                        let v = getAssignedValue(slotId);
                                                                        if (!v && nefIdx === 0) v = getAssignedValue('nef_assist');
                                                                        return v;
                                                                    })();
                                                                    const optionsP = personnel
                                                                        .filter(p => {
                                                                            if (!p.nef) return false;
                                                                            const dutyCode = getDutyCodeFor(`p_${p.id}`);
                                                                            const evalMode = auswertungByType[dutyCode];
                                                                            // Nur Personen die an diesem Tag tatsächlich im aktiven Dienst sind (nicht 'off', nicht leer, nicht undefined)
                                                                            if (!dutyCode || dutyCode.trim() === '') return false;
                                                                            if (!evalMode || evalMode === 'off') return false;
                                                                            return true;
                                                                        })
                                                                        .map(p => ({ value: `p:${p.id}`, label: `${p.name}` }));
                                                                    const renderOptions = value && !optionsP.some(o => o.value === value)
                                                                        ? [{ value, label: findPersonLabelByValue(value) }, ...optionsP] : optionsP;

                                                                    const isAssigned = highlightedPersonKey && value && value.startsWith('p:') && value === `p:${highlightedPersonKey.replace('p_', '')}`;
                                                                    const highlightStyle = isAssigned ? { background: '#ffebee', fontWeight: 600 } : undefined;

                                                                    return (
                                                                        <select className={styles.select} value={value}
                                                                            disabled={!canWrite}
                                                                            style={highlightStyle}
                                                                            onChange={e => { const v = e.target.value; if (v === '') { e.preventDefault(); e.stopPropagation(); (e.currentTarget as HTMLSelectElement).blur(); clearAssignedForSlot(slotId); if (nefIdx === 0) clearAssignedForSlot('nef_assist'); } else { handleAssign(d.date, d.dayOfYear, v, slotId); } }}
                                                                            onKeyDown={e => { if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); e.stopPropagation(); (e.currentTarget as HTMLSelectElement).blur(); clearAssignedForSlot(slotId); if (nefIdx === 0) clearAssignedForSlot('nef_assist'); } }}>
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
                                                                        .filter(a => {
                                                                            const dutyCode = getDutyCodeFor(`a_${a.id}`);
                                                                            const evalMode = auswertungByType[dutyCode];
                                                                            // Nur Azubis die an diesem Tag tatsächlich im aktiven Dienst sind (nicht 'off', nicht leer, nicht undefined)
                                                                            if (!dutyCode || dutyCode.trim() === '') return false;
                                                                            if (!evalMode || evalMode === 'off') return false;
                                                                            return true;
                                                                        })
                                                                        .map(a => ({ value: `a:${a.id}`, label: `${a.name}` }));
                                                                    const renderOptions = value && !optionsA.some(o => o.value === value)
                                                                        ? [{ value, label: findPersonLabelByValue(value) }, ...optionsA] : optionsA;
                                                                    return (
                                                                        <select className={styles.select} value={value}
                                                                            onChange={e => handleAssign(d.date, d.dayOfYear, e.target.value, slotId)}
                                                                            onKeyDown={e => { if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); e.stopPropagation(); (e.currentTarget as HTMLSelectElement).blur(); clearAssignedForSlot(slotId); if (nefIdx === 0) clearAssignedForSlot('nef_azubi'); } }}>
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
                                {(() => {
                                    // Kontrollkasten-Berechnungen (Monatsbasis) - jetzt zentralisiert
                                    const {
                                        targetYearMap,
                                        drivenYearMap,
                                        allocTargetsInMonth,
                                        perPersonAssignedWeightedInMonth,
                                        perPersonNefInMonth,
                                        perPersonItwInMonth,
                                        perPersonRtwTagNightYear,
                                        targetCumulativeMap,
                                        drivenCumulativeMap
                                    } = (window as any).__sharedTargets || {};

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
                                            return dy - ty;
                                        })();
                                        // Kumulative Differenz bis aktuellen Monat
                                        const cumTarget = targetCumulativeMap?.[key] || 0;
                                        const cumDriven = drivenCumulativeMap?.[key] || 0;
                                        const cumDiff = cumTarget - cumDriven;
                                        const teilzeit = Number((p as any).teilzeit ?? 100) || 100;
                                        const hlfb = (p as any).fahrzeugfuehrerHLFB === 1;
                                        const ue50 = (p as any).ue50 === 1;
                                        const total = tn.tag + tn.nacht + nef + itw;
                                        return { key, name: p.name, target, count, tag: tn.tag, nacht: tn.nacht, nef, itw, rest, cumDiff, teilzeit, hlfb, ue50, total } as { key: string, name: string, target: number | string, count: number, tag: number, nacht: number, nef: number, itw: number, rest: number, cumDiff: number, teilzeit: number, hlfb: boolean, ue50: boolean, total: number };
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
                                        // t in [0,1]: 0 = rot (negativ/noch nicht genug gefahren), 0.5 = gelb (ausgeglichen), 1 = grün (positiv/mehr gefahren als Soll)
                                        const clamp = (x: number) => Math.max(0, Math.min(1, x));
                                        const tt = clamp(t);
                                        const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
                                        if (tt < 0.5) {
                                            // Rot -> Gelb (0 bis 0.5)
                                            const factor = tt * 2;
                                            const r = 239; // ef4444 rot konstant
                                            const g = Math.round(lerp(68, 234, factor)); // ef4444 -> eab308 (gelb)
                                            const b = Math.round(lerp(68, 8, factor));
                                            return { r, g, b };
                                        } else {
                                            // Gelb -> Grün (0.5 bis 1)
                                            const factor = (tt - 0.5) * 2;
                                            const r = Math.round(lerp(234, 34, factor)); // eab308 -> 34c55e (grün)
                                            const g = Math.round(lerp(179, 197, factor));
                                            const b = Math.round(lerp(8, 94, factor));
                                            return { r, g, b };
                                        }
                                    };
                                    // Restliches Jahr: ISO-Daten sammeln (ab aktuellem Monat bis Dezember)
                                    const restYearIsos: string[] = (() => {
                                        const list: string[] = [];
                                        for (let mIdx = currentMonth; mIdx < 12; mIdx++) {
                                            const dim = new Date(year, mIdx + 1, 0).getDate();
                                            for (let d = 1; d <= dim; d++) {
                                                list.push(new Date(Date.UTC(year, mIdx, d)).toISOString().slice(0, 10));
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
                                            <Kontrollkasten
                                                items={items}
                                                highlightedPersonKey={highlightedPersonKey}
                                                setHighlightedPersonKey={setHighlightedPersonKey}
                                                mixColor={mixColor}
                                                minNR={minNR}
                                                maxNR={maxNR}
                                                presenceRemainingByPerson={presenceRemainingByPerson}
                                                assignedRemainingByPerson={assignedRemainingByPerson}
                                                renderPresenceMeter={(value: number, height: number) => (
                                                    <div style={{ position: 'relative', width: 45, height, background: '#eef2f7', borderRadius: 3 }}>
                                                        <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: '#cbd5e1', zIndex: 1 }} />
                                                        {(() => {
                                                            const diff = value;
                                                            const absVal = Math.abs(diff);
                                                            const maxVal = 5;
                                                            const percentage = Math.min(1, absVal / maxVal);
                                                            const width = percentage * 50;

                                                            if (diff > 0) {
                                                                return (
                                                                    <div style={{
                                                                        position: 'absolute',
                                                                        right: '50%',
                                                                        width: `${width}%`,
                                                                        top: 0,
                                                                        bottom: 0,
                                                                        background: '#ef4444',
                                                                        borderTopLeftRadius: 3,
                                                                        borderBottomLeftRadius: 3
                                                                    }} />
                                                                );
                                                            } else if (diff < 0) {
                                                                return (
                                                                    <div style={{
                                                                        position: 'absolute',
                                                                        left: '50%',
                                                                        width: `${width}%`,
                                                                        top: 0,
                                                                        bottom: 0,
                                                                        background: '#34c759',
                                                                        borderTopRightRadius: 3,
                                                                        borderBottomRightRadius: 3
                                                                    }} />
                                                                );
                                                            }
                                                            return null;
                                                        })()}
                                                    </div>
                                                )}
                                            />
                                        </aside>
                                    );
                                    const target = (typeof document !== 'undefined') ? document.getElementById('einteilung-right-sidebar') : null;
                                    return target ? createPortal(sidebar, target) : sidebar;
                                })()}
                            </>
                        )}

                        {viewMode === 'itw' && itwEnabled && (
                            <>
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
                                        // Tage ermitteln: 1. Aus Musterfolge, 2. Aus tatsächlichen Einträgen (Slot/Auswertung), 3. Manuelle Extras
                                        const assignedItwDates = new Set<string>();

                                        // 1. Musterfolge (Deaktiviert: ITW-Spalten nur anzeigen, wenn tatsächlich Einträge im Dienstplan existieren)
                                        /*
                                        for (let i = 1; i <= daysInMonth; i++) {
                                            const iso = new Date(Date.UTC(year, currentMonth, i)).toISOString().slice(0,10);
                                            if (holidays.has(iso)) continue;
                                            
                                            const seqs = [...(itwPatternSeqs || [])].sort((a,b) => a.startDate.localeCompare(b.startDate));
                                            if (seqs.length === 0) continue;
                                            
                                            let active = seqs[0];
                                            for (const s of seqs) { if (s.startDate <= iso) active = s; else break; }
                                            
                                            const start = new Date((active?.startDate || '1970-01-01') + 'T00:00:00Z');
                                            const cur = new Date(iso + 'T00:00:00Z');
                                            const diffDays = Math.floor((cur.getTime() - start.getTime()) / (1000*60*60*24));
                                            const pat = active?.pattern || [];
                                            if (pat.length === 0) continue;
                                            
                                            const val = pat[((diffDays % pat.length) + pat.length) % pat.length];
                                            if (val) assignedItwDates.add(iso);
                                        }
                                        */

                                        // 2. Tatsächliche Einträge
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
                                        } catch { }
                                        // Union aus tatsächlichen ITW-Tagen bilden und aufsteigend sortieren
                                        const daysSet = new Map<string, { date: string; weekday: string; day: number; dayOfYear: number }>();
                                        for (const iso of assignedItwDates) {
                                            if (!daysSet.has(iso)) {
                                                const local = new Date(year, currentMonth, Number(iso.slice(8, 10)));
                                                const weekday = local.toLocaleDateString('de-DE', { weekday: 'short' });
                                                daysSet.set(iso, { date: iso, weekday, day: Number(iso.slice(8, 10)), dayOfYear: 0 });
                                            }
                                        }
                                        const allItwDays = Array.from(daysSet.values()).sort((a, b) => a.date.localeCompare(b.date));
                                        const isOnItwDuty = (key: string, date: string) => {
                                            const code = getDutyCodeForDate(key, date);
                                            return !!code && (auswertungByType[code] === 'itw');
                                        };
                                        const renderItwSelect = (date: string, role: 1 | 2 | 3 | 4) => {
                                            const slotId = role === 1 ? 'itw_row_1' : role === 2 ? 'itw_row_2' : role === 3 ? 'itw_row_3' : 'itw_row_4';
                                            const value = getAssignedValueFor(date, slotId);
                                            let options: { value: string, label: string }[] = [];
                                            if (role === 1 || role === 2) {
                                                options = personnel
                                                    .filter(p => {
                                                        const key = `p_${p.id}`;
                                                        // Qualifikation: Rolle 1 benötigt Fahrzeuführer, Rolle 2 allgemeines Personal
                                                        const qualified = (role === 1) ? p.fahrzeugfuehrer : true;
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

                                            const isAssigned = highlightedPersonKey && value && value.startsWith('p:') && value === `p:${highlightedPersonKey.replace('p_', '')}`;
                                            const highlightStyle = isAssigned ? { background: '#ffebee', fontWeight: 600 } : undefined;

                                            return (
                                                <select className={styles.select} value={value}
                                                    style={highlightStyle}
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

                                                    // Prüfe ob hervorgehobene Person an diesem ITW-Tag eingeteilt oder verfügbar ist
                                                    let dayHighlightColor: string | undefined = undefined;
                                                    if (highlightedPersonKey) {
                                                        const personId = highlightedPersonKey.replace('p_', '');
                                                        const personValue = `p:${personId}`;

                                                        let isAssigned = false;
                                                        const itwSlots = ['itw_row_1', 'itw_row_2'];
                                                        for (const slotId of itwSlots) {
                                                            const value = getAssignedValueFor(d2.date, slotId);
                                                            if (value === personValue) {
                                                                isAssigned = true;
                                                                break;
                                                            }
                                                        }

                                                        // Wenn nicht eingeteilt, prüfe ob verfügbar (ITW-Dienst)
                                                        if (!isAssigned) {
                                                            const dutyCode = getDutyCodeForDate(highlightedPersonKey, d2.date);
                                                            if (dutyCode && auswertungByType[dutyCode] === 'itw') {
                                                                dayHighlightColor = '#e8f5e9'; // Grün: verfügbar
                                                            }
                                                        }
                                                        // Rot-Markierung entfernt - Dropdowns zeigen bereits Einteilung
                                                    }

                                                    return (
                                                        <div key={`itw_card_${d2.date}`} className={styles.itwCardWrap}>
                                                            {/* Datum (DD.MM) + Wochentag und gelbe Trennlinie über dem ITW-Kasten */}
                                                            <div className={styles.itwCardHeader} style={{
                                                                background: dayHighlightColor,
                                                                borderRadius: dayHighlightColor ? 4 : 0,
                                                                paddingLeft: dayHighlightColor ? 6 : undefined,
                                                                paddingRight: dayHighlightColor ? 6 : undefined
                                                            }}>{label} <small style={{ fontWeight: 400, color: 'var(--muted)' }}>({d2.weekday})</small></div>
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
                                </div>
                                {(() => {
                                    // Kontrollkasten-Berechnungen (Monatsbasis) – identisch wie in RTW/NEF-Ansicht (mit Präsenz & HLF‑B Gewichtung)
                                    // Verwende gemeinsame SOLL-Berechnung (ITW-Tab)
                                    const sharedTargets = (window as any).__sharedTargets || {
                                        targetYearMap: {},
                                        drivenYearMap: {},
                                        allocTargetsInMonth: {},
                                        perPersonAssignedWeightedInMonth: {},
                                        perPersonNefInMonth: {},
                                        perPersonItwInMonth: {},
                                        perPersonRtwTagNightYear: {}
                                    };
                                    const {
                                        targetYearMap,
                                        drivenYearMap,
                                        allocTargetsInMonth,
                                        perPersonAssignedWeightedInMonth,
                                        perPersonNefInMonth,
                                        perPersonItwInMonth,
                                        perPersonRtwTagNightYear,
                                        targetCumulativeMap,
                                        drivenCumulativeMap
                                    } = sharedTargets;
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
                                            return dy - ty;
                                        })();
                                        const cumTarget = targetCumulativeMap?.[key] || 0;
                                        const cumDriven = drivenCumulativeMap?.[key] || 0;
                                        const cumDiff = cumTarget - cumDriven;
                                        const teilzeit = Number((p as any).teilzeit ?? 100) || 100;
                                        const hlfb = (p as any).fahrzeugfuehrerHLFB === 1;
                                        const ue50 = (p as any).ue50 === 1;
                                        const total = tn.tag + tn.nacht + nef + itw;
                                        return { key, name: p.name, target, count, tag: tn.tag, nacht: tn.nacht, nef, itw, rest, cumDiff, teilzeit, hlfb, ue50, total } as { key: string, name: string, target: number | string, count: number, tag: number, nacht: number, nef: number, itw: number, rest: number, cumDiff: number, teilzeit: number, hlfb: boolean, ue50: boolean, total: number };
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
                                        // t in [0,1]: 0 = rot (negativ/noch nicht genug gefahren), 0.5 = gelb (ausgeglichen), 1 = grün (positiv/mehr gefahren als Soll)
                                        const clamp = (x: number) => Math.max(0, Math.min(1, x));
                                        const tt = clamp(t);
                                        const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
                                        if (tt < 0.5) {
                                            // Rot -> Gelb (0 bis 0.5)
                                            const factor = tt * 2;
                                            const r = 239; // ef4444 rot konstant
                                            const g = Math.round(lerp(68, 234, factor)); // ef4444 -> eab308 (gelb)
                                            const b = Math.round(lerp(68, 8, factor));
                                            return { r, g, b };
                                        } else {
                                            // Gelb -> Grün (0.5 bis 1)
                                            const factor = (tt - 0.5) * 2;
                                            const r = Math.round(lerp(234, 34, factor)); // eab308 -> 34c55e (grün)
                                            const g = Math.round(lerp(179, 197, factor));
                                            const b = Math.round(lerp(8, 94, factor));
                                            return { r, g, b };
                                        }
                                    };
                                    // Restliches Jahr (ab aktuellem Monat) berechnen – Anwesenheit und bereits eingeteilte Schichten
                                    const restYearIsos: string[] = (() => {
                                        const list: string[] = [];
                                        for (let mIdx = currentMonth; mIdx < 12; mIdx++) {
                                            const dim = new Date(year, mIdx + 1, 0).getDate();
                                            for (let d = 1; d <= dim; d++) {
                                                list.push(new Date(Date.UTC(year, mIdx, d)).toISOString().slice(0, 10));
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
                                            <Kontrollkasten
                                                items={items}
                                                highlightedPersonKey={highlightedPersonKey}
                                                setHighlightedPersonKey={setHighlightedPersonKey}
                                                mixColor={mixColor}
                                                minNR={minNR}
                                                maxNR={maxNR}
                                                presenceRemainingByPerson={presenceRemainingByPerson}
                                                assignedRemainingByPerson={assignedRemainingByPerson}
                                                renderPresenceMeter={(value: number, height: number) => (
                                                    <div style={{ position: 'relative', width: 45, height, background: '#eef2f7', borderRadius: 3 }}>
                                                        <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: '#cbd5e1', zIndex: 1 }} />
                                                        {(() => {
                                                            const diff = value;
                                                            const absVal = Math.abs(diff);
                                                            const maxVal = 5;
                                                            const percentage = Math.min(1, absVal / maxVal);
                                                            const width = percentage * 50;

                                                            if (diff > 0) {
                                                                return (
                                                                    <div style={{
                                                                        position: 'absolute',
                                                                        right: '50%',
                                                                        width: `${width}%`,
                                                                        top: 0,
                                                                        bottom: 0,
                                                                        background: '#ef4444',
                                                                        borderTopLeftRadius: 3,
                                                                        borderBottomLeftRadius: 3
                                                                    }} />
                                                                );
                                                            } else if (diff < 0) {
                                                                return (
                                                                    <div style={{
                                                                        position: 'absolute',
                                                                        left: '50%',
                                                                        width: `${width}%`,
                                                                        top: 0,
                                                                        bottom: 0,
                                                                        background: '#34c759',
                                                                        borderTopRightRadius: 3,
                                                                        borderBottomRightRadius: 3
                                                                    }} />
                                                                );
                                                            }
                                                            return null;
                                                        })()}
                                                    </div>
                                                )}
                                            />
                                        </aside>
                                    );
                                    const target = (typeof document !== 'undefined') ? document.getElementById('einteilung-right-sidebar') : null;
                                    return target ? createPortal(sidebar, target) : sidebar;
                                })()}
                            </>
                        )}
                    </>
                )}
            </div>
            {/* Ende Content-Bereich mit padding-top */}
        </div>
    );
};

export default MonthTabs;