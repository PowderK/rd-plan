import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { buildVehicleActivationMap, calculateTargets } from '../utils/calculation';
import { rosterReleasedSettingKey } from '../utils/rosterRelease';
import styles from './MonthTabs.module.css';
import { Kontrollkasten } from './Kontrollkasten';
import { AzubiAutoAssignDialog, ShiftSummary, ProposedAssignment, ConflictAzubi } from './AzubiAutoAssignDialog';

/** Abteilungsnummer aus Anzeigenamen (z. B. „2. Abteilung“ → 2). */
export function departmentNameToId(departmentName?: string): number {
    const d = String(departmentName || '');
    if (d.includes('3')) return 3;
    if (d.includes('2')) return 2;
    return 1;
}

interface MonthTabsProps {
    currentMonth: number;
    onMonthChange: (month: number) => void;
    onYearChange?: (year: number) => void;
    /** Aktuelle Abteilung aus App/Sidebar – nicht mit globalem Setting „department“ verwechseln. */
    departmentName?: string;
    /** Vollständige Namensliste der Abteilung (ohne Monatsfilter) für Slot-Labels. */
    personnelLookup?: { id: number; name: string; vorname?: string }[];
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

type AssignmentUndoEntry = {
    date: string;
    slotId: string;
    previousValue: string;
    nextValue: string;
    ts: number;
};

const MonthTabs: React.FC<MonthTabsProps> = ({ currentMonth, onMonthChange, onYearChange, departmentName, personnelLookup, personnel, azubis, roster, year, shiftPattern, deptPatternSeqs = [], onRosterChanged, onEntryAssigned }) => {
    const { hasPermission, currentUser } = useAuth();
    const canWrite = hasPermission('einteilung', 'write');
    // Read permission is implicit if they can see the page, but we use it to check for "read-only" status
    // If they have write permission, they are not read-only.
    // If they DON'T have write permission, we enforcement visibility rules.

    const [department, setDepartment] = useState<number>(() => departmentNameToId(departmentName));
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
    const [rtwVehiclePeriods, setRtwVehiclePeriods] = useState<Record<number, any[]>>({});
    const [nefVehiclePeriods, setNefVehiclePeriods] = useState<Record<number, any[]>>({});
    const [itwPatternSeqs, setItwPatternSeqs] = useState<{ startDate: string; department: string; pattern: string[] }[]>([]);
    const [forceUpdateCounter, setForceUpdateCounter] = useState(0);
    const [isUpdating, setIsUpdating] = useState(false); // Verhindert Race-Conditions während Updates
    const [holidays, setHolidays] = useState<Set<string>>(new Set());
    // Hervorgehobene Person aus Kontrollkasten
    const [highlightedPersonKey, setHighlightedPersonKey] = useState<string | null>(null);
    // Hervorgehobenes Datum für Verfügbarkeitsanzeige im Kontrollkasten
    const [selectedAvailDate, setSelectedAvailDate] = useState<string | null>(null);
    // Ü50-IDs für korrekte Berechnung (analog ValuesPage)
    const [ue50Ids, setUe50Ids] = useState<Set<number>>(new Set());
    // LPAL-IDs (Leitender Praxisanleiter) - wie Ü50, aber orange
    const [lpalIds, setLpalIds] = useState<Set<number>>(new Set());
    // HLF-B Perioden für korrekte Berechnung
    const [hlfbPeriodsByPerson, setHlfbPeriodsByPerson] = useState<Record<number, Array<{ startYM: string; endYM?: string }>>>({});
    // Performance: Debouncing für Roster-Updates
    const [updateTimeout, setUpdateTimeout] = useState<NodeJS.Timeout | null>(null);
    const undoStackStorageKey = '__rdPlanAssignmentUndoStack';
    const redoStackStorageKey = '__rdPlanAssignmentRedoStack';
    const isApplyingUndoRef = React.useRef(false);
    const [undoStack, setUndoStack] = useState<AssignmentUndoEntry[]>(() => {
        const existing = (window as any)[undoStackStorageKey];
        return Array.isArray(existing) ? existing : [];
    });
    const [redoStack, setRedoStack] = useState<AssignmentUndoEntry[]>(() => {
        const existing = (window as any)[redoStackStorageKey];
        return Array.isArray(existing) ? existing : [];
    });

    const [showWeekendShifts, setShowWeekendShifts] = useState<boolean>(false);
    // Freigabe-Status pro Monat
    const [releasedMonths, setReleasedMonths] = useState<boolean[]>(Array(12).fill(false));
    /** Monate mit unbesetzten Pflichtpositionen (für gelbe Markierung bei Freigabe). */
    const [monthsWithEmptySlots, setMonthsWithEmptySlots] = useState<boolean[]>(Array(12).fill(false));
    // Sidebar Collapse Status
    const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
    // Feature Toggle: Alte RTW Schichten
    const [featureOldRtwShifts, setFeatureOldRtwShifts] = useState(false);
    // Schichtübernahmen
    const [shiftTransfers, setShiftTransfers] = useState<any[]>([]);
    const [azubiAutoState, setAzubiAutoState] = useState<ShiftSummary[] | null>(null);
    const [availableYears, setAvailableYears] = useState<number[]>([]);

    useEffect(() => {
        (window as any)[undoStackStorageKey] = undoStack;
    }, [undoStack]);

    useEffect(() => {
        (window as any)[redoStackStorageKey] = redoStack;
    }, [redoStack]);

    useEffect(() => {
        const loadYearOptions = async () => {
            try {
                const plannings = await (window as any).api.getYearPlannings?.();
                const years = Array.isArray(plannings)
                    ? plannings
                        .map((p: any) => Number(p.year))
                        .filter((y: number) => Number.isFinite(y))
                    : [];
                const merged = Array.from(new Set([year, ...years])).sort((a, b) => b - a);
                setAvailableYears(merged);
            } catch {
                setAvailableYears([year]);
            }
        };

        loadYearOptions();
    }, [year]);

    useEffect(() => {
        if (!itwEnabled && viewMode === 'itw') {
            setViewMode('rtwnef');
        }
    }, [itwEnabled, viewMode]);

    // Kommentar-State für Einteilung (Issue #22 UI-Anpassungen)
    const [personalComments, setPersonalComments] = useState<Map<string, { id: number; comment: string; created_by: string }>>(new Map());
    const [globalComments, setGlobalComments] = useState<Map<string, { id: number; comment: string; created_by: string }>>(new Map());
    const [activeCommentsData, setActiveCommentsData] = useState<{ dateStr: string; comments: string[] } | null>(null);

    const loadComments = useCallback(async () => {
        try {
            const persRes = await (window as any).api.getPersonalCommentsForMonth(year, currentMonth);
            if (Array.isArray(persRes)) {
                const map = new Map();
                persRes.forEach((c: any) => map.set(`${c.person_id}_${c.date}`, c));
                setPersonalComments(map);
            }

            const globRes = await (window as any).api.getGlobalCommentsForMonth(year, currentMonth);
            if (Array.isArray(globRes)) {
                const map = new Map();
                globRes.forEach((c: any) => map.set(c.date, c));
                setGlobalComments(map);
            }
        } catch (err) {
            console.error('[MonthTabs] Error loading comments:', err);
        }
    }, [year, currentMonth]);

    const getCommentLinesForDate = useCallback((isoDate: string): string[] => {
        const lines: string[] = [];

        if (globalComments.has(isoDate)) {
            lines.push(`Global: ${globalComments.get(isoDate)?.comment}`);
        }

        personalComments.forEach((c, key) => {
            if (key.endsWith(`_${isoDate}`)) {
                const pId = Number(key.split('_')[0]);
                const pName = personnel.find(p => p.id === pId)?.name || 'Jemand';
                lines.push(`${pName}: ${c.comment}`);
            }
        });

        return lines;
    }, [globalComments, personalComments, personnel]);

    useEffect(() => {
        loadComments();
    }, [loadComments]);

    // Listener für Updates
    useEffect(() => {
        const loadReleased = async () => {
            try {
                const status = await Promise.all(months.map(async (_, i) => {
                    const key = rosterReleasedSettingKey(year, i, departmentName);
                    const val = await (window as any).api.getSetting(key);
                    return val === '1';
                }));
                setReleasedMonths(status);
            } catch (e) { console.warn('Failed to load released status', e); }
        };

        const loadTransfers = async () => {
            try {
                const transfers = await (window as any).api.getShiftTransfers(year);
                if (Array.isArray(transfers)) setShiftTransfers(transfers);
            } catch (e) { console.error('[MonthTabs] Failed to load shift transfers:', e); }
        };

        loadReleased();
        loadTransfers();

        const onTransfersUpdated = () => loadTransfers();
        const onSettingsUpdated = () => loadReleased();

        (window as any).api?.onShiftTransfersUpdated?.(onTransfersUpdated);
        (window as any).api?.onSettingsUpdated?.(onSettingsUpdated);

        return () => {
            (window as any).api?.offShiftTransfersUpdated?.(onTransfersUpdated);
            (window as any).api?.offSettingsUpdated?.(onSettingsUpdated);
        };
    }, [year, departmentName]);

    // Höre auf Sidebar Collapse Events
    useEffect(() => {
        const handler = () => {
            setSidebarCollapsed(!!(window as any).sidebarCollapsed);
        };
        window.addEventListener('sidebar-collapsed', handler as EventListener);
        return () => window.removeEventListener('sidebar-collapsed', handler as EventListener);
    }, []);

    // Abteilung aus App-Prop / Sidebar-Event (nicht aus globalem settings.department)
    useEffect(() => {
        setDepartment(departmentNameToId(departmentName));
    }, [departmentName]);

    useEffect(() => {
        const handler = (e: any) => {
            setDepartment(departmentNameToId(e.detail?.department));
        };
        window.addEventListener('rdplan-department-changed', handler);
        return () => window.removeEventListener('rdplan-department-changed', handler);
    }, []);

    useEffect(() => {
        const loadUe50 = async () => {
            try {
                let ue50QualName = 'Ü50';
                const setting = await (window as any).api.getSetting('ue50_qualification_type');
                if (setting) ue50QualName = String(setting);

                let lpalQualName = 'LPAL';
                const lpalSetting = await (window as any).api.getSetting('lpal_qualification_type');
                if (lpalSetting) lpalQualName = String(lpalSetting);

                const combinedIds = new Set<number>();
                const lpalOnlyIds = new Set<number>();
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
                            const hasLpal = periods.some((per: any) =>
                                per.active &&
                                per.qualType === lpalQualName &&
                                per.startYM <= yearMonth &&
                                (!per.endYM || per.endYM >= yearMonth)
                            );
                            if (hasUe50 || hasLpal) {
                                combinedIds.add(p.id);
                                if (hasLpal) lpalOnlyIds.add(p.id);
                                break;
                            }
                        }
                    } catch { }
                }
                setUe50Ids(combinedIds);
                setLpalIds(lpalOnlyIds);
            } catch { setUe50Ids(new Set()); setLpalIds(new Set()); }
        };
        loadUe50();
    }, [year, personnel]);

    useEffect(() => {
        const load = async () => {
            try {
                const sws = await (window as any).api.getSetting('show_weekend_shifts');
                setShowWeekendShifts(sws === 'true');
            } catch { }
            try { const r = await (window as any).api.getRtwVehicles?.(year); if (Array.isArray(r)) setRtwVehicles(r); } catch { }
            try { const n = await (window as any).api.getNefVehicles?.(year); if (Array.isArray(n)) setNefVehicles(n); } catch { }
            // Monats-Aktivierungen laden
            try {
                const acts = await (window as any).api.getRtwVehicleActivations?.(year);
                setRtwActivations(buildVehicleActivationMap(acts));
            } catch { }
            try {
                const acts = await (window as any).api.getNefVehicleActivations?.(year);
                setNefActivations(buildVehicleActivationMap(acts));
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
                    const parsed = seqs.map((s: any) => ({ 
                        startDate: String(s.startDate), 
                        department: s.department || '1. Abteilung',
                        pattern: norm(String(s.pattern).split(',').map((x: string) => x.trim()), 21) 
                    }));
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
            } catch (e) { }
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
            // Feature Toggle laden
            try {
                const feat = await (window as any).api.getSetting(`feature_old_rtw_shifts_${departmentName}`);
                setFeatureOldRtwShifts(feat === 'true' || feat === true);
            } catch { }
            // Neue Fahrzeug-Zeiträume laden
            try {
                const rtwP = await (window as any).api.getAllRtwVehiclePeriods?.();
                const rMap: Record<number, any[]> = {};
                (rtwP || []).forEach((p: any) => {
                    if (!rMap[p.vehicleId]) rMap[p.vehicleId] = [];
                    rMap[p.vehicleId].push(p);
                });
                setRtwVehiclePeriods(rMap);
                
                const nefP = await (window as any).api.getAllNefVehiclePeriods?.();
                const nMap: Record<number, any[]> = {};
                (nefP || []).forEach((p: any) => {
                    if (!nMap[p.vehicleId]) nMap[p.vehicleId] = [];
                    nMap[p.vehicleId].push(p);
                });
                setNefVehiclePeriods(nMap);
            } catch { }
        };
        load();
    }, [year, currentMonth]);

    // Separater Effekt für Settings-Listener (verhindert Listener-Leaks)
    useEffect(() => {
        const onSettingsUpdated = async () => {
            try {
                const y = await (window as any).api.getSetting('year');
                const yearNum = Number(y || new Date().getFullYear());
                // Fahrzeuge neu laden (z.B. nach Löschen)
                try { const r = await (window as any).api.getRtwVehicles?.(yearNum); if (Array.isArray(r)) setRtwVehicles(r); } catch { }
                try { const n = await (window as any).api.getNefVehicles?.(yearNum); if (Array.isArray(n)) setNefVehicles(n); } catch { }
                // Aktivierungen für das Settings-Jahr neu laden
                try {
                    const acts = await (window as any).api.getRtwVehicleActivations?.(yearNum);
                    setRtwActivations(buildVehicleActivationMap(acts));
                } catch { }
                try {
                    const acts = await (window as any).api.getNefVehicleActivations?.(yearNum);
                    setNefActivations(buildVehicleActivationMap(acts));
                } catch { }
                // ITW-Sequenzen aktualisieren
                try {
                    const norm = (arr: string[], len = 21) => (arr || []).slice(0, len).concat(Array(len).fill('')).slice(0, len).map(v => (v === 'IW' ? 'IW' : ''));
                    const seqs = await (window as any).api.getItwPatterns?.();
                    if (Array.isArray(seqs) && seqs.length > 0) {
                        const parsed = seqs.map((s: any) => ({ 
                            startDate: String(s.startDate), 
                            department: s.department || '1. Abteilung',
                            pattern: norm(String(s.pattern).split(',').map((x: string) => x.trim()), 21) 
                        }));
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

                // Neue Fahrzeug-Zeiträume neu laden
                try {
                    const rtwP = await (window as any).api.getAllRtwVehiclePeriods?.();
                    const rMap: Record<number, any[]> = {};
                    (rtwP || []).forEach((p: any) => {
                        if (!rMap[p.vehicleId]) rMap[p.vehicleId] = [];
                        rMap[p.vehicleId].push(p);
                    });
                    setRtwVehiclePeriods(rMap);
                    
                    const nefP = await (window as any).api.getAllNefVehiclePeriods?.();
                    const nMap: Record<number, any[]> = {};
                    (nefP || []).forEach((p: any) => {
                        if (!nMap[p.vehicleId]) nMap[p.vehicleId] = [];
                        nMap[p.vehicleId].push(p);
                    });
                    setNefVehiclePeriods(nMap);
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

    type VehiclePositionRow = { positionName: string; sort: number };
    const [rtwPositionsMap, setRtwPositionsMap] = useState<Record<number, VehiclePositionRow[]>>({});
    const [nefPositionsMap, setNefPositionsMap] = useState<Record<number, VehiclePositionRow[]>>({});

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const rtw: Record<number, VehiclePositionRow[]> = {};
            for (const v of rtwVehicles || []) {
                try {
                    const positions = await (window as any).api.getVehiclePositions?.('rtw', v.id) || [];
                    rtw[v.id] = positions.sort((a: VehiclePositionRow, b: VehiclePositionRow) => a.sort - b.sort);
                } catch { /* ignore */ }
            }
            const nef: Record<number, VehiclePositionRow[]> = {};
            for (const v of nefVehicles || []) {
                try {
                    const positions = await (window as any).api.getVehiclePositions?.('nef', v.id) || [];
                    nef[v.id] = positions.sort((a: VehiclePositionRow, b: VehiclePositionRow) => a.sort - b.sort);
                } catch { /* ignore */ }
            }
            if (!cancelled) {
                setRtwPositionsMap(rtw);
                setNefPositionsMap(nef);
            }
        })();
        return () => { cancelled = true; };
    }, [rtwVehicles, nefVehicles]);

    const buildDepartmentDaysForMonth = useCallback((monthIndex: number): string[] => {
        const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
        const dates: string[] = [];
        let base = 0;
        for (let m = 0; m < monthIndex; ++m) base += new Date(year, m + 1, 0).getDate();
        for (let d = 1; d <= daysInMonth; ++d) {
            const idx = base + (d - 1);
            let depDay: string | undefined;
            if (Array.isArray(deptPatternSeqs) && deptPatternSeqs.length > 0) {
                const iso = new Date(Date.UTC(year, monthIndex, d)).toISOString().slice(0, 10);
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
            if (depDay !== undefined && String(department) === depDay) {
                dates.push(new Date(Date.UTC(year, monthIndex, d)).toISOString().slice(0, 10));
            }
        }
        return dates;
    }, [year, department, shiftPattern, deptPatternSeqs]);

    const collectEmptySlotsForMonth = useCallback((
        monthIndex: number,
        rtwMap: Record<number, VehiclePositionRow[]>,
        nefMap: Record<number, VehiclePositionRow[]>
    ): string[] => {
        const monthDays = buildDepartmentDaysForMonth(monthIndex);
        const emptySlots: string[] = [];

        for (const iso of monthDays) {
            for (let rIdx = 0; rIdx < (rtwVehicles || []).length; rIdx++) {
                const v = rtwVehicles[rIdx];
                const enabled = (rtwActivations[v.id] ?? Array(12).fill(true))[monthIndex] !== false;
                if (!enabled) continue;

                const positions = rtwMap[v.id] || [];

                for (let pIdx = 0; pIdx < Math.min(2, positions.length); pIdx++) {
                    const pos = positions[pIdx];
                    const slotId = `rtw${rIdx + 1}_tag_${pIdx + 1}`;
                    const value = getAssignedValueFor(iso, slotId);
                    if (!value || value.trim() === '') {
                        const dt = new Date(iso + 'T00:00:00');
                        const label = dt.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
                        const posName = pos.positionName.replace(/\s+\d+$/, '');
                        emptySlots.push(`${label}: ${v.name || `RTW ${rIdx + 1}`} ${posName} Tag`);
                    }
                }

                for (let pIdx = 0; pIdx < Math.min(2, positions.length); pIdx++) {
                    const pos = positions[pIdx];
                    const slotId = `rtw${rIdx + 1}_nacht_${pIdx + 1}`;
                    const value = getAssignedValueFor(iso, slotId);
                    if (!value || value.trim() === '') {
                        const dt = new Date(iso + 'T00:00:00');
                        const label = dt.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
                        const posName = pos.positionName.replace(/\s+\d+$/, '');
                        emptySlots.push(`${label}: ${v.name || `RTW ${rIdx + 1}`} ${posName} Nacht`);
                    }
                }
            }

            for (let nIdx = 0; nIdx < (nefVehicles || []).length; nIdx++) {
                const v = nefVehicles[nIdx];
                const enabled = (nefActivations[v.id] ?? Array(12).fill(true))[monthIndex] !== false;
                if (!enabled) continue;

                const positions = nefMap[v.id] || [];
                if (positions.length === 0) continue;

                const slotId = `nef${nIdx + 1}_assist`;
                const value = getAssignedValueFor(iso, slotId);
                if (!value || value.trim() === '') {
                    const dt = new Date(iso + 'T00:00:00');
                    const label = dt.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
                    const posName = positions[0].positionName.replace(/\s+\d+$/, '');
                    emptySlots.push(`${label}: ${v.name || `NEF ${nIdx + 1}`} ${posName}`);
                }
            }
        }

        return emptySlots;
    }, [buildDepartmentDaysForMonth, rtwVehicles, nefVehicles, rtwActivations, nefActivations, getAssignedValueFor]);

    useEffect(() => {
        const flags = Array.from({ length: 12 }, (_, i) =>
            collectEmptySlotsForMonth(i, rtwPositionsMap, nefPositionsMap).length > 0
        );
        setMonthsWithEmptySlots(flags);
    }, [collectEmptySlotsForMonth, rtwPositionsMap, nefPositionsMap, localRoster, roster]);

    const loadVehiclePositionMaps = useCallback(async () => {
        const rtw: Record<number, VehiclePositionRow[]> = {};
        for (const v of rtwVehicles || []) {
            try {
                const positions = await (window as any).api.getVehiclePositions?.('rtw', v.id) || [];
                rtw[v.id] = positions.sort((a: VehiclePositionRow, b: VehiclePositionRow) => a.sort - b.sort);
            } catch { /* ignore */ }
        }
        const nef: Record<number, VehiclePositionRow[]> = {};
        for (const v of nefVehicles || []) {
            try {
                const positions = await (window as any).api.getVehiclePositions?.('nef', v.id) || [];
                nef[v.id] = positions.sort((a: VehiclePositionRow, b: VehiclePositionRow) => a.sort - b.sort);
            } catch { /* ignore */ }
        }
        return { rtw, nef };
    }, [rtwVehicles, nefVehicles]);

    const toggleReleased = useCallback(async () => {
        const newVal = !releasedMonths[currentMonth];

        if (newVal) {
            let rtwMap = rtwPositionsMap;
            let nefMap = nefPositionsMap;
            if (Object.keys(rtwMap).length === 0 && (rtwVehicles || []).length > 0) {
                const loaded = await loadVehiclePositionMaps();
                rtwMap = loaded.rtw;
                nefMap = loaded.nef;
            }

            const emptySlots = collectEmptySlotsForMonth(currentMonth, rtwMap, nefMap);
            if (emptySlots.length > 0) {
                const maxShow = 10;
                const preview = emptySlots.slice(0, maxShow).join('\n');
                const more = emptySlots.length > maxShow ? `\n... und ${emptySlots.length - maxShow} weitere` : '';
                alert(
                    `Hinweis: Folgende Positionen sind nicht besetzt:\n\n${preview}${more}\n\n` +
                    'Die Freigabe wird trotzdem gespeichert. Der Monat wird gelb markiert, solange Lücken bestehen.'
                );
            }

            const monthDays = buildDepartmentDaysForMonth(currentMonth);
            const unavailableAssignments: string[] = [];

            for (const iso of monthDays) {
                for (let rIdx = 0; rIdx < (rtwVehicles || []).length; rIdx++) {
                    const v = rtwVehicles[rIdx];
                    const enabled = (rtwActivations[v.id] ?? Array(12).fill(true))[currentMonth] !== false;
                    if (!enabled) continue;

                    const positions = rtwMap[v.id] || [];

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

                for (let nIdx = 0; nIdx < (nefVehicles || []).length; nIdx++) {
                    const v = nefVehicles[nIdx];
                    const enabled = (nefActivations[v.id] ?? Array(12).fill(true))[currentMonth] !== false;
                    if (!enabled) continue;

                    const positions = nefMap[v.id] || [];
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

        const key = rosterReleasedSettingKey(year, currentMonth, departmentName);
        try {
            await (window as any).api.setSetting(key, newVal ? '1' : '0');
            setReleasedMonths(prev => {
                const next = [...prev];
                next[currentMonth] = newVal;
                return next;
            });
        } catch (e) { console.warn('Failed to save released status', e); }
    }, [
        releasedMonths,
        currentMonth,
        year,
        departmentName,
        rtwPositionsMap,
        nefPositionsMap,
        rtwVehicles,
        nefVehicles,
        loadVehiclePositionMaps,
        collectEmptySlotsForMonth,
        buildDepartmentDaysForMonth,
        rtwActivations,
        nefActivations,
        getAssignedValueFor,
        getDutyCodeForDate,
        allowedByAuswertung,
        personnel,
    ]);

    const personNameById = useMemo(() => {
        const map = new Map<number, string>();
        const add = (list: { id: number; name: string; vorname?: string }[] | undefined) => {
            (list || []).forEach(p => {
                if (p?.id != null && p.name) map.set(Number(p.id), String(p.name));
            });
        };
        add(personnelLookup);
        add(personnel);
        return map;
    }, [personnelLookup, personnel]);

    const findPersonLabelByValue = useCallback((val: string) => {
        if (!val) return '';
        try {
            const [t, idStr] = val.split(':');
            const id = Number(idStr);
            if (t === 'p') {
                const fromMap = personNameById.get(id);
                if (fromMap) return fromMap;
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
    }, [personNameById, personnel, azubis, itwDoctors]);

    const pushUndoEntry = useCallback((entry: AssignmentUndoEntry) => {
        if (!entry.slotId || entry.previousValue === entry.nextValue) return;
        setUndoStack(prev => {
            const next = [...prev, entry];
            return next.length > 2000 ? next.slice(next.length - 2000) : next;
        });
        setRedoStack([]);
    }, []);

    const handleAssign = useCallback(async (date: string, dayIdx: number, value: string, slotId?: string) => {
        if (!canWrite) return;
        if (!value) return;
        if (slotId) {
            const currentValue = getAssignedValueFor(date, slotId);
            if (currentValue === value) return;
            if (!isApplyingUndoRef.current) {
                pushUndoEntry({
                    date,
                    slotId,
                    previousValue: currentValue,
                    nextValue: value,
                    ts: Date.now()
                });
            }
        }
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
    }, [canWrite, localRoster, updateTimeout, onRosterChanged, onEntryAssigned, getAssignedValueFor, pushUndoEntry]);
    const clearAssignedForDate = async (slotId: string, date: string) => {
        if (!canWrite) return;
        const currentVal = getAssignedValueFor(date, slotId);
        if (!currentVal) return;
        try {
            if (!isApplyingUndoRef.current) {
                pushUndoEntry({
                    date,
                    slotId,
                    previousValue: currentVal,
                    nextValue: '',
                    ts: Date.now()
                });
            }
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

    const undoLastAssignmentChange = useCallback(async () => {
        if (!canWrite) return;
        if (undoStack.length === 0) return;

        const lastEntry = undoStack[undoStack.length - 1];
        setUndoStack(prev => prev.slice(0, -1));
        if (!lastEntry) return;

        try {
            isApplyingUndoRef.current = true;
            const currentVal = getAssignedValueFor(lastEntry.date, lastEntry.slotId);
            if (currentVal === lastEntry.previousValue) return;

            const parseAssignment = (val: string) => {
                if (!val) return null;
                const [t, idStr] = val.split(':');
                const pid = Number(idStr);
                if (!Number.isFinite(pid)) return null;
                const ptype = t === 'a' ? 'azubi' : (t === 'd' ? 'doctor' : 'person');
                const key = ptype === 'person' ? `p_${pid}` : (ptype === 'azubi' ? `a_${pid}` : `d_${pid}`);
                return { pid, ptype, key };
            };

            const currentTarget = parseAssignment(currentVal);
            const previousTarget = parseAssignment(lastEntry.previousValue);

            setLocalRoster(prev => {
                const newState = { ...prev } as Record<string, Record<string, { value: string; type: string }>>;

                Object.keys(newState).forEach(personKey => {
                    const dayEntry = newState[personKey]?.[lastEntry.date];
                    if (!dayEntry || dayEntry.type !== lastEntry.slotId) return;
                    newState[personKey] = {
                        ...newState[personKey],
                        [lastEntry.date]: { ...(dayEntry as any), type: '' }
                    };
                });

                if (previousTarget) {
                    const currentPersonState = newState[previousTarget.key] || {};
                    const dayEntry = { ...(currentPersonState[lastEntry.date] || {}), type: lastEntry.slotId };
                    newState[previousTarget.key] = { ...currentPersonState, [lastEntry.date]: dayEntry };
                }

                return newState;
            });
            setForceUpdateCounter(prev => prev + 1);

            if (currentTarget) {
                await (window as any).api.assignSlot({
                    personId: currentTarget.pid,
                    personType: currentTarget.ptype,
                    date: lastEntry.date,
                    slotType: ''
                });
            }

            if (previousTarget) {
                await (window as any).api.assignSlot({
                    personId: previousTarget.pid,
                    personType: previousTarget.ptype,
                    date: lastEntry.date,
                    slotType: lastEntry.slotId
                });
            }

            if (onRosterChanged) onRosterChanged();
            setRedoStack(prev => {
                const next = [...prev, lastEntry];
                return next.length > 2000 ? next.slice(next.length - 2000) : next;
            });
        } catch {
            setUndoStack(prev => [...prev, lastEntry as AssignmentUndoEntry]);
        } finally {
            setTimeout(() => {
                isApplyingUndoRef.current = false;
            }, 0);
        }
    }, [canWrite, undoStack, getAssignedValueFor, onRosterChanged]);

    const handleAutoAssignAzubis = () => {
        if (!canWrite) return;
        const summaries: ShiftSummary[] = [];

        const DateStrs: string[] = days.map(d => d.date);

        const isSlotTakenGlobally = (dateStr: string, slotId: string) => {
            return !!getAssignedValueFor(dateStr, slotId);
        };

        const isAzubiAssigned = (key: string, dateStr: string) => {
           const type = String((localRoster as any)?.[key]?.[dateStr]?.type ?? (roster as any)?.[key]?.[dateStr]?.type ?? '');
           return type.startsWith('rtw') || type.startsWith('nef') || type.startsWith('itw');
        };

        DateStrs.forEach(DateStr => {
            const dailyAzubisTag: typeof azubis = [];
            const dailyAzubisNacht: typeof azubis = [];
            
            azubis.forEach(a => {
                const key = `a_${a.id}`;
                if (isAzubiAssigned(key, DateStr)) return;
                
                const dutyCode = getDutyCodeForDate(key, DateStr);
                if (dutyCode && dutyCode.trim() !== '') {
                    const evalMode = auswertungByType[dutyCode];
                    if (evalMode === 'tag' || evalMode === '24h') dailyAzubisTag.push(a);
                    if (evalMode === 'nacht' || evalMode === '24h') dailyAzubisNacht.push(a);
                }
            });

            const processShift = (shift: 'tag' | 'nacht', candidates: typeof azubis) => {
                if (candidates.length === 0) return;
                
                const availableMaSlots: string[] = [];
                const availableAzSlots: string[] = [];
                const allAvailableFallbackSlots: { id: string; label: string }[] = [];

                (rtwVehicles || []).forEach((v, rIdx) => {
                    const enabled = (rtwActivations[v.id] ?? Array(12).fill(true))[currentMonth] !== false;
                    if (!enabled) return;

                    const slot2 = shift === 'tag' ? `rtw${rIdx+1}_tag_2` : `rtw${rIdx+1}_nacht_2`;
                    const slot3 = shift === 'tag' ? `rtw${rIdx+1}_tag_3` : `rtw${rIdx+1}_nacht_3`;
                    
                    const taken2 = isSlotTakenGlobally(DateStr, slot2);
                    const taken3 = isSlotTakenGlobally(DateStr, slot3);

                    if (!taken2) availableMaSlots.push(slot2);
                    if (!taken3) availableAzSlots.push(slot3);
                    
                    if (!taken2) allAvailableFallbackSlots.push({ id: slot2, label: `${v.name} Maschinist` });
                    if (!taken3) allAvailableFallbackSlots.push({ id: slot3, label: `${v.name} Azubi` });
                });

                (nefVehicles || []).forEach((v, nIdx) => {
                    const enabled = (nefActivations[v.id] ?? Array(12).fill(true))[currentMonth] !== false;
                    if (!enabled) return;
                    const slotId = nIdx === 0 ? 'nef_azubi' : `nef${nIdx+1}_azubi`;
                    if (!isSlotTakenGlobally(DateStr, slotId)) allAvailableFallbackSlots.push({ id: slotId, label: `${v.name} Azubi` });
                });

                const assignments: ProposedAssignment[] = [];
                const conflicts: ConflictAzubi[] = [];

                candidates.forEach(a => {
                    if (a.lehrjahr >= 2) {
                        if (availableMaSlots.length > 0) {
                            assignments.push({ azubiId: a.id, azubiName: `${a.name} ${a.vorname}`, lehrjahr: a.lehrjahr, proposedSlot: availableMaSlots.shift()! });
                        } else {
                            conflicts.push({ azubiId: a.id, azubiName: `${a.name} ${a.vorname}`, lehrjahr: a.lehrjahr, reason: 'Keine Maschinisten-Plätze mehr frei.' });
                        }
                    } else {
                        if (availableAzSlots.length > 0) {
                            assignments.push({ azubiId: a.id, azubiName: `${a.name} ${a.vorname}`, lehrjahr: a.lehrjahr, proposedSlot: availableAzSlots.shift()! });
                        } else {
                            conflicts.push({ azubiId: a.id, azubiName: `${a.name} ${a.vorname}`, lehrjahr: a.lehrjahr, reason: 'Keine regulären Azubi-Plätze mehr frei.' });
                        }
                    }
                });

                if (assignments.length > 0 || conflicts.length > 0) {
                    const usedSlots = assignments.map(x => x.proposedSlot);
                    const safeFallbacks = allAvailableFallbackSlots.filter(fb => !usedSlots.includes(fb.id));
                    summaries.push({
                        date: DateStr,
                        shift,
                        assignments,
                        conflicts,
                        availableFallbackSlots: safeFallbacks
                    });
                }
            };

            processShift('tag', dailyAzubisTag);
            processShift('nacht', dailyAzubisNacht);
        });

        if (summaries.length > 0) {
            setAzubiAutoState(summaries);
        } else {
            alert('Keine ungeplanten Azubis mit gültigen Dienstcodes für diesen Monat gefunden.');
        }
    };

    const handleConfirmAutoAssign = async (finalAssignments: { azubiId: number; date: string; slotId: string }[]) => {
        setAzubiAutoState(null);
        if (finalAssignments.length === 0) return;

        setIsUpdating(true);

        setLocalRoster(prev => {
            const newState = { ...prev };

            finalAssignments.forEach(assignment => {
                const key = `a_${assignment.azubiId}`;
                const date = assignment.date;
                const slotId = assignment.slotId;

                Object.keys(newState).forEach(personKey => {
                    if (personKey !== key && newState[personKey][date]?.type === slotId) {
                         newState[personKey] = {
                             ...newState[personKey],
                             [date]: { ...(newState[personKey][date] || {}), type: '' }
                         };
                    }
                });

                const currentPersonState = newState[key] || {};
                const dayEntry = { ...(currentPersonState[date] || {}), type: slotId };
                newState[key] = { ...currentPersonState, [date]: dayEntry };
            });

            return newState;
        });

        setForceUpdateCounter(prev => prev + 1);

        try {
            await Promise.all(finalAssignments.map(assignment => 
                (window as any).api.assignSlot({
                    personId: assignment.azubiId,
                    personType: 'azubi',
                    date: assignment.date,
                    slotType: assignment.slotId
                })
            ));
        } catch(e) { console.error('Bulk auto-assign failed', e); }

        if (onRosterChanged) onRosterChanged();
        setTimeout(() => setIsUpdating(false), 100);
    };

    const redoLastAssignmentChange = useCallback(async () => {
        if (!canWrite) return;
        if (redoStack.length === 0) return;

        const lastEntry = redoStack[redoStack.length - 1];
        setRedoStack(prev => prev.slice(0, -1));
        if (!lastEntry) return;

        try {
            isApplyingUndoRef.current = true;
            const currentVal = getAssignedValueFor(lastEntry.date, lastEntry.slotId);
            if (currentVal === lastEntry.nextValue) return;

            const parseAssignment = (val: string) => {
                if (!val) return null;
                const [t, idStr] = val.split(':');
                const pid = Number(idStr);
                if (!Number.isFinite(pid)) return null;
                const ptype = t === 'a' ? 'azubi' : (t === 'd' ? 'doctor' : 'person');
                const key = ptype === 'person' ? `p_${pid}` : (ptype === 'azubi' ? `a_${pid}` : `d_${pid}`);
                return { pid, ptype, key };
            };

            const currentTarget = parseAssignment(currentVal);
            const nextTarget = parseAssignment(lastEntry.nextValue);

            setLocalRoster(prev => {
                const newState = { ...prev } as Record<string, Record<string, { value: string; type: string }>>;

                Object.keys(newState).forEach(personKey => {
                    const dayEntry = newState[personKey]?.[lastEntry.date];
                    if (!dayEntry || dayEntry.type !== lastEntry.slotId) return;
                    newState[personKey] = {
                        ...newState[personKey],
                        [lastEntry.date]: { ...(dayEntry as any), type: '' }
                    };
                });

                if (nextTarget) {
                    const currentPersonState = newState[nextTarget.key] || {};
                    const dayEntry = { ...(currentPersonState[lastEntry.date] || {}), type: lastEntry.slotId };
                    newState[nextTarget.key] = { ...currentPersonState, [lastEntry.date]: dayEntry };
                }

                return newState;
            });
            setForceUpdateCounter(prev => prev + 1);

            if (currentTarget) {
                await (window as any).api.assignSlot({
                    personId: currentTarget.pid,
                    personType: currentTarget.ptype,
                    date: lastEntry.date,
                    slotType: ''
                });
            }

            if (nextTarget) {
                await (window as any).api.assignSlot({
                    personId: nextTarget.pid,
                    personType: nextTarget.ptype,
                    date: lastEntry.date,
                    slotType: lastEntry.slotId
                });
            }

            if (onRosterChanged) onRosterChanged();
            setUndoStack(prev => {
                const next = [...prev, lastEntry];
                return next.length > 2000 ? next.slice(next.length - 2000) : next;
            });
        } catch {
            setRedoStack(prev => [...prev, lastEntry as AssignmentUndoEntry]);
        } finally {
            setTimeout(() => {
                isApplyingUndoRef.current = false;
            }, 0);
        }
    }, [canWrite, redoStack, getAssignedValueFor, onRosterChanged]);

    const vehicleHeaderRef = React.useRef<HTMLDivElement>(null);
    const contentRef = React.useRef<HTMLDivElement>(null);
    const fixedHeaderContainerRef = React.useRef<HTMLDivElement>(null);
    const [headerHeight, setHeaderHeight] = React.useState(280);

    const [sidebarWidth, setSidebarWidth] = React.useState(512);

    // Messe die Höhe des Fixed Header Containers
    React.useEffect(() => {
        const measureHeader = () => {
            if (fixedHeaderContainerRef.current) {
                const height = fixedHeaderContainerRef.current.offsetHeight;
                setHeaderHeight(height + 10); // +10px Sicherheitsabstand
            }

            const sidebar = document.getElementById('einteilung-right-sidebar');
            if (sidebar) {
                setSidebarWidth(sidebar.offsetWidth + 12);
            }
        };

        measureHeader();

        // Messe erneut bei Größenänderungen
        const resizeObserver = new ResizeObserver(measureHeader);
        if (fixedHeaderContainerRef.current) {
            resizeObserver.observe(fixedHeaderContainerRef.current);

            // Auch die Sidebar beobachten, falls sie sich durch Namen vergrößert
            const sidebar = document.getElementById('einteilung-right-sidebar');
            if (sidebar) resizeObserver.observe(sidebar);
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

    const getNefAssistWeight = useCallback((slotType: string): number => {
        const match = String(slotType || '').match(/^nef(\d+)?_assist$/);
        if (!match) return 0;
        const idx = match[1] ? Math.max(0, Number(match[1]) - 1) : 0;
        const mode = nefVehicles[idx]?.occupancy_mode || '24h';
        return mode === 'tag' ? 1 : 2;
    }, [nefVehicles]);

    // ==========================================================
    // GEMEINSAME SOLL-BERECHNUNG für RTW-Tab und ITW-Tab
    // ==========================================================
    useMemo(() => {
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
                hlfbPeriodsByPerson,
                shiftTransfers // <-- Pass loaded transfers here
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
            const perPersonWeekendInYear: Record<string, number> = {};

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
                    const rd = (p as any).rettungsdienstMonthly;
                    const dept = (p as any).deptActiveMonthly;
                    if (rd && !rd[mIdx]) continue;
                    if (dept && !dept[mIdx]) continue;

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
                        else if (/^nef(\d+)?_assist$/.test(t)) cumDriven += getNefAssistWeight(t);
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
                let weekendCntY = 0;
                for (let mIdx = 0; mIdx < 12; mIdx++) {
                    const rd = (p as any).rettungsdienstMonthly;
                    const dept = (p as any).deptActiveMonthly;
                    if (rd && !rd[mIdx]) continue;
                    if (dept && !dept[mIdx]) continue;

                    const dim = new Date(year, mIdx + 1, 0).getDate();
                    for (let i = 1; i <= dim; i++) {
                        const iso = new Date(Date.UTC(year, mIdx, i)).toISOString().slice(0, 10);
                        const cell = getCell(key, iso);
                        const t = String(cell?.type || '');
                        let isShift = false;
                        if (/^rtw\d+_(tag|nacht)_(1|2)$/.test(t)) { sumDrivenY += 1; isShift = true; }
                        else if (t.startsWith('itw_row_')) { sumDrivenY += 1; isShift = true; }
                        else if (/^nef(\d+)?_assist$/.test(t)) { sumDrivenY += getNefAssistWeight(t); isShift = true; }

                        if (/^rtw\d+_tag_(1|2)$/.test(t)) tagCntY += 1;
                        if (/^rtw\d+_nacht_(1|2)$/.test(t)) nachtCntY += 1;

                        if (isShift) {
                            const dow = new Date(iso).getDay();
                            if (dow === 0 || dow === 6) weekendCntY += 1;
                        }
                    }
                }
                drivenYearMap[key] = sumDrivenY;
                perPersonRtwTagNightYear[key] = { tag: tagCntY, nacht: nachtCntY };
                perPersonWeekendInYear[key] = weekendCntY;

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
                    else if (/^nef(\d+)?_assist$/.test(t)) cntM += getNefAssistWeight(t);
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
                            if (/^nef(\d+)?_assist$/.test(t)) nefCntYear += getNefAssistWeight(t);
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
                perPersonWeekendInYear,
                targetCumulativeMap,
                drivenCumulativeMap
            };
        };

        const result = computeSharedTargets();
        (window as any).__sharedTargets = result;

    }, [year, roster, localRoster, personnel, azubis, ue50Ids, auswertungByType,
        rtwVehicles, nefVehicles, rtwActivations, nefActivations, department,
        deptPatternSeqs, hlfbPeriodsByPerson, shiftTransfers, currentMonth]);

    const availablePersonKeys = React.useMemo(() => {
        if (!selectedAvailDate) return undefined;
        const keys = new Set<string>();

        const DateStr = selectedAvailDate;
        
        const isAssigned = (key: string) => {
           const type = String((localRoster as any)?.[key]?.[DateStr]?.type ?? (roster as any)?.[key]?.[DateStr]?.type ?? '');
           return type.startsWith('rtw') || type.startsWith('nef') || type.startsWith('itw');
        };

        (personnel || []).forEach(p => {
            const key = `p_${p.id}`;
            if (isAssigned(key)) return; 
            
            const dutyCode = getDutyCodeForDate(key, DateStr);
            if (dutyCode && dutyCode.trim() !== '') {
                const evalMode = auswertungByType[dutyCode];
                if (evalMode && evalMode !== 'off') {
                    keys.add(key);
                }
            }
        });
        
        return keys;
    }, [selectedAvailDate, roster, localRoster, personnel, auswertungByType, getDutyCodeForDate]);

    return (
        <div key={forceUpdateCounter}>
            {/* Gemeinsamer Fixed Header Container */}
            <div
                ref={fixedHeaderContainerRef}
                style={{
                    position: 'fixed',
                    top: 'clamp(56px, 6.5vw, 90px)',
                    left: sidebarCollapsed ? 56 : 200,
                    right: sidebarWidth + 16,
                    zIndex: 100,
                    background: 'var(--bg)',
                    paddingLeft: 24,
                    paddingRight: 24,
                    transition: 'left 0.15s'
                }}
            >
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    gap: 12,
                    paddingTop: 12,
                    paddingBottom: 14
                }}>
                    <h2 style={{ margin: 0 }}>Einteilung</h2>
                    <span style={{ fontSize: 22, fontWeight: 700, whiteSpace: 'nowrap' }}>
                        {viewMode === 'rtwnef' ? 'RTW Einteilung' : 'ITW Einteilung'} ({months[currentMonth]})
                    </span>
                    <div style={{
                        position: 'absolute',
                        top: 8,
                        right: `-${Math.max(0, sidebarWidth - 28)}px`,
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 16,
                        zIndex: 103
                    }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 140, justifyContent: 'flex-end' }}>
                            Jahr:
                            <select
                                value={year}
                                onChange={e => onYearChange?.(Number(e.target.value))}
                                style={{
                                    padding: '6px 10px',
                                    fontSize: 14,
                                    borderRadius: 6,
                                    border: '1px solid #bbb',
                                    background: '#fff',
                                    cursor: 'pointer'
                                }}
                            >
                                {(availableYears.length > 0 ? availableYears : [year]).map(y => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        </label>
                        <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        minWidth: 200,
                        justifyContent: 'flex-end',
                        cursor: 'pointer',
                        userSelect: 'none',
                        flexShrink: 0,
                        zIndex: 103
                    }}>
                        <span style={{ fontSize: 14, color: '#666' }}>Status:</span>
                        {(() => {
                            const isReleased = releasedMonths[currentMonth];
                            const hasGaps = isReleased && monthsWithEmptySlots[currentMonth];
                            const statusColor = !isReleased ? '#dc3545' : (hasGaps ? '#f59e0b' : '#28a745');
                            return (
                                <>
                        <div style={{
                            position: 'relative',
                            width: 40,
                            height: 20,
                            background: statusColor,
                            borderRadius: 10,
                            transition: 'background 0.3s'
                        }}>
                            <div style={{
                                position: 'absolute',
                                top: 2,
                                left: isReleased ? 22 : 2,
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
                            checked={isReleased}
                            onChange={toggleReleased}
                            disabled={!canWrite}
                            style={{ display: 'none' }}
                        />
                        <span style={{ fontSize: 14, fontWeight: 600, color: statusColor, minWidth: 110, whiteSpace: 'nowrap' }}>
                            {!isReleased ? 'In Bearbeitung' : (hasGaps ? 'Freigegeben (Lücken)' : 'Freigegeben')}
                        </span>
                                </>
                            );
                        })()}
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button
                            type="button"
                            onClick={handleAutoAssignAzubis}
                            disabled={!canWrite}
                            style={{
                                padding: '6px 12px',
                                background: canWrite ? '#fff' : '#f9fafb',
                                color: canWrite ? '#4b5563' : '#9ca3af',
                                border: '1px solid #d1d5db',
                                borderRadius: '6px',
                                fontSize: '0.85rem',
                                fontWeight: 500,
                                cursor: canWrite ? 'pointer' : 'not-allowed',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}
                            title="Azubis automatisch auf freie Plätze verteilen"
                        >
                            <span>Azubis Automatik</span>
                        </button>
                        <button
                            type="button"
                            onClick={undoLastAssignmentChange}
                            disabled={!canWrite || undoStack.length === 0}
                            title={undoStack.length > 0 ? `Zurück (${undoStack.length})` : 'Keine Änderung zum Rückgängigmachen'}
                            aria-label="Zurück"
                            style={{
                                width: 30,
                                height: 30,
                                borderRadius: 6,
                                border: '1px solid #d1d5db',
                                background: (!canWrite || undoStack.length === 0) ? '#f9fafb' : '#fff',
                                color: (!canWrite || undoStack.length === 0) ? '#9ca3af' : '#4b5563',
                                cursor: (!canWrite || undoStack.length === 0) ? 'not-allowed' : 'pointer',
                                fontSize: 16,
                                lineHeight: 1,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            ↶
                        </button>
                        <button
                            type="button"
                            onClick={redoLastAssignmentChange}
                            disabled={!canWrite || redoStack.length === 0}
                            title={redoStack.length > 0 ? `Wiederherstellen (${redoStack.length})` : 'Keine Änderung zum Wiederherstellen'}
                            aria-label="Wiederherstellen"
                            style={{
                                width: 30,
                                height: 30,
                                borderRadius: 6,
                                border: '1px solid #d1d5db',
                                background: (!canWrite || redoStack.length === 0) ? '#f9fafb' : '#fff',
                                color: (!canWrite || redoStack.length === 0) ? '#9ca3af' : '#4b5563',
                                cursor: (!canWrite || redoStack.length === 0) ? 'not-allowed' : 'pointer',
                                fontSize: 16,
                                lineHeight: 1,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            ↷
                        </button>
                    </div>
                    </div>
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
                        // Status-Farbe: Rot = in Bearbeitung, Grün = freigegeben vollständig, Gelb = freigegeben mit Lücken
                        const isReleased = releasedMonths[i];
                        const hasGaps = isReleased && monthsWithEmptySlots[i];
                        const stripeColor = !isReleased ? '#dc3545' : (hasGaps ? '#f59e0b' : '#28a745');

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
                        const showItwIndicator = itwEnabled && viewMode === 'rtwnef' && hasItwAssignments;

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
                                {itwEnabled && (
                                    <button
                                        onClick={() => setViewMode('itw')}
                                        style={{
                                            padding: '8px 16px',
                                            background: viewMode === 'itw' ? '#f8f9fa' : (showItwIndicator ? '#fefce8' : 'transparent'),
                                            border: 'none',
                                            borderBottom: viewMode === 'itw' ? '3px solid #ffc107' : '3px solid transparent',
                                            cursor: 'pointer',
                                            fontWeight: viewMode === 'itw' ? 600 : (showItwIndicator ? 600 : 400),
                                            color: viewMode === 'itw' ? '#ffc107' : (showItwIndicator ? '#ca8a04' : '#6b7280'),
                                            transition: 'all 0.2s',
                                            fontSize: '14px',
                                            position: 'relative'
                                        }}
                                        onMouseEnter={(e) => {
                                            if (viewMode !== 'itw') {
                                                e.currentTarget.style.background = '#f3f4f6';
                                                e.currentTarget.style.color = '#374151';
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            if (viewMode !== 'itw') {
                                                e.currentTarget.style.background = showItwIndicator ? '#fefce8' : 'transparent';
                                                e.currentTarget.style.color = showItwIndicator ? '#ca8a04' : '#6b7280';
                                            }
                                        }}
                                    >
                                        ITW
                                    </button>
                                )}
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
                                        marginRight: 8,
                                        marginBottom: 8,
                                        width: 'var(--vehicle-card-width)',
                                        minWidth: 'var(--vehicle-card-width)',
                                        maxWidth: 'var(--vehicle-card-width)',
                                        padding: 8,
                                        boxSizing: 'border-box',
                                        background: 'var(--bg)'
                                    }}>
                                        <div style={{ paddingBottom: 4, borderBottom: '2px solid #ef4444' }}>
                                            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', marginBottom: 4, paddingLeft: 66 }}>{v.name || rtwNames[rIdx] || ''}</div>
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
                                        marginRight: 8,
                                        marginBottom: 8,
                                        width: 'var(--vehicle-card-width)',
                                        minWidth: 'var(--vehicle-card-width)',
                                        maxWidth: 'var(--vehicle-card-width)',
                                        padding: 8,
                                        boxSizing: 'border-box',
                                        background: 'var(--bg)'
                                    }}>
                                        <div style={{ paddingBottom: 4, borderBottom: '2px solid #ef4444' }}>
                                            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', marginBottom: 4, paddingLeft: 66 }}>{v.name || nefName || ''}</div>
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
                    paddingLeft: 24,
                    paddingRight: 24,
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



                        {viewMode === 'rtwnef' && (
                            <>
                                {days.map(d => {
                                    const getDutyCodeFor = (key: string) => getDutyCodeForDate(key, d.date);
                                    const getAssignedValue = (slotId: string) => getAssignedValueFor(d.date, slotId);
                                    const clearAssignedForSlot = async (slotId: string) => clearAssignedForDate(slotId, d.date);
                                    const isFirstDay = days.length > 0 && days[0].date === d.date;

                                    // Prüfe ob hervorgehobene Person an diesem Tag eingeteilt oder verfügbar ist
                                    let dayHighlightColor: string | undefined = undefined;
                                    if (selectedAvailDate === d.date) {
                                        dayHighlightColor = '#e8f5e9';
                                    } else if (highlightedPersonKey) {
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

                                                const tooltipParts = getCommentLinesForDate(d.date);
                                                const commentCount = tooltipParts.length;

                                                const tooltipText = tooltipParts.join('\n');

                                                return (
                                                    <div
                                                        onClick={() => setSelectedAvailDate(selectedAvailDate === d.date ? null : d.date)}
                                                        style={{
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
                                                        paddingRight: dayHighlightColor ? 6 : 0,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '6px',
                                                        cursor: 'pointer'
                                                    }}>
                                                        <span>{label} <small style={{ fontWeight: 400 }}>({d.weekday})</small></span>
                                                        {commentCount > 0 && (
                                                            <div
                                                                title={tooltipText || 'Kommentare anzeigen'}
                                                                onClick={() => {
                                                                    setActiveCommentsData({ dateStr: label, comments: tooltipParts });
                                                                }}
                                                                style={{
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    minWidth: '18px',
                                                                    height: '18px',
                                                                    padding: '0 5px',
                                                                    background: '#dc3545',
                                                                    color: 'white',
                                                                    borderRadius: '999px',
                                                                    fontSize: '11px',
                                                                    fontWeight: 700,
                                                                    lineHeight: 1,
                                                                    cursor: 'pointer'
                                                                }}
                                                            >
                                                                {commentCount > 99 ? '99+' : commentCount}
                                                            </div>
                                                        )}
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
                                                                            
                                                                            if (d.day === 2 && rIdx === 0) {
                                                                                console.log(`[DEBUG MonthTabs] Filter p=${p.name}, hasQual=${hasQual}, dutyCode=${dutyCode}, allowed=${allowed}`);
                                                                            }
                                                                            
                                                                            return allowed && hasQual;
                                                                        })
                                                                        .map(p => ({ value: `p:${p.id}`, label: `${p.name}` }));
                                                                    const renderOptions = value && !optionsP.some(o => o.value === value)
                                                                        ? [{ value, label: findPersonLabelByValue(value) }, ...optionsP] : optionsP;

                                                                    // Prüfe ob hervorgehobene Person eingeteilt ist (rot)
                                                                    const isAssigned = highlightedPersonKey && value && value.startsWith('p:') && value === `p:${highlightedPersonKey.replace('p_', '')}`;
                                                                    const highlightStyle = isAssigned ? { background: '#ffebee', fontWeight: 600 } : undefined;

                                                                    if (d.day === 2) {
                                                                        console.log('[DEBUG MonthTabs] RTW Select Day 2:', {
                                                                            slotId,
                                                                            value,
                                                                            personnelCount: personnel.length,
                                                                            matchingPersonnel: optionsP.map(o => o.label)
                                                                        });
                                                                    }
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
                                                                            disabled={!canWrite}
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
                                        perPersonWeekendInYear,
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
                                        const itw = itwEnabled ? (perPersonItwInMonth[key] || 0) : 0;
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
                                        const lpal = lpalIds.has(p.id);
                                        const total = tn.tag + tn.nacht + nef + itw;
                                        const oldRtwShifts = (p as any).old_rtw_shifts || 0;
                                        const weekend = perPersonWeekendInYear[key] || 0;

                                        // Prüfe ob für diesen Monat eine Übernahme vorliegt
                                        const hasTransfer = (shiftTransfers || []).some((t: any) => {
                                            if (t.to_person_id !== p.id) return false;
                                            const [ty, tm] = (t.month || '').split('-').map(Number);
                                            return ty === year && tm === (currentMonth + 1);
                                        });

                                        return { key, name: p.name, target, count, tag: tn.tag, nacht: tn.nacht, nef, itw, weekend, rest, cumDiff, teilzeit, hlfb, ue50, lpal, total, oldRtwShifts, hasTransfer } as any;
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
                                            const rd = (p as any).rettungsdienstMonthly;
                                            const dept = (p as any).deptActiveMonthly;

                                            for (let mIdx = currentMonth; mIdx < 12; mIdx++) {
                                                if (rd && !rd[mIdx]) continue;
                                                if (dept && !dept[mIdx]) continue;

                                                const dim = new Date(year, mIdx + 1, 0).getDate();
                                                for (let d = 1; d <= dim; d++) {
                                                    const iso = new Date(Date.UTC(year, mIdx, d)).toISOString().slice(0, 10);
                                                    const cell = (localRoster as any)?.[key]?.[iso] || (roster as any)?.[key]?.[iso];
                                                    const raw = String(cell?.value || '').trim();
                                                    if (raw && (auswertungByType[raw] || 'off') !== 'off') cnt++;
                                                }
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
                                            const rd = (p as any).rettungsdienstMonthly;
                                            const dept = (p as any).deptActiveMonthly;

                                            for (let mIdx = currentMonth; mIdx < 12; mIdx++) {
                                                if (rd && !rd[mIdx]) continue;
                                                if (dept && !dept[mIdx]) continue;

                                                const dim = new Date(year, mIdx + 1, 0).getDate();
                                                for (let d = 1; d <= dim; d++) {
                                                    const iso = new Date(Date.UTC(year, mIdx, d)).toISOString().slice(0, 10);
                                                    const cell = (localRoster as any)?.[key]?.[iso] || (roster as any)?.[key]?.[iso];
                                                    const t = String(cell?.type || '');
                                                    if (/^rtw\d+_(tag|nacht)_(1|2)$/.test(t)) sum += 1;
                                                    else if (itwEnabled && /^itw_row_[12]$/.test(t)) sum += 1;
                                                    else if (/^nef(\d+)?_assist$/.test(t)) sum += getNefAssistWeight(t);
                                                }
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
                                                showOldRtwShifts={featureOldRtwShifts}
                                                showWeekendShifts={showWeekendShifts}
                                                showItw={itwEnabled}
                                                availablePersonKeys={availablePersonKeys}
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
                                        // 1. Musterfolge (Loop-Vorschau für die aktuelle Abteilung)
                                        const deptStr = `${department}. Abteilung`;
                                        for (let i = 1; i <= daysInMonth; i++) {
                                            const iso = new Date(Date.UTC(year, currentMonth, i)).toISOString().slice(0, 10);
                                            if (holidays.has(iso)) continue;

                                            const seqs = [...(itwPatternSeqs || [])]
                                                .filter(s => s.department === deptStr)
                                                .sort((a, b) => a.startDate.localeCompare(b.startDate));
                                            if (seqs.length === 0) continue;

                                            let active = seqs[0];
                                            for (const s of seqs) { if (s.startDate <= iso) active = s; else break; }

                                            const start = new Date((active?.startDate || '1970-01-01') + 'T00:00:00Z');
                                            const cur = new Date(iso + 'T00:00:00Z');
                                            const diffDays = Math.floor((cur.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                                            const pat = active?.pattern || [];
                                            if (pat.length === 0) continue;

                                            const val = pat[((diffDays % pat.length) + pat.length) % pat.length];
                                            if (val === 'IW') assignedItwDates.add(iso);
                                        }

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
                                                    disabled={!canWrite}
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
                                                    if (selectedAvailDate === d2.date) {
                                                        dayHighlightColor = '#e8f5e9';
                                                    } else if (highlightedPersonKey) {
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
                                                            <div
                                                                onClick={() => setSelectedAvailDate(selectedAvailDate === d2.date ? null : d2.date)}
                                                                className={styles.itwCardHeader} style={{
                                                                background: dayHighlightColor,
                                                                borderRadius: dayHighlightColor ? 4 : 0,
                                                                paddingLeft: dayHighlightColor ? 6 : undefined,
                                                                paddingRight: dayHighlightColor ? 6 : undefined,
                                                                cursor: 'pointer'
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
                                        perPersonRtwTagNightYear: {},
                                        perPersonWeekendInYear: {}
                                    };
                                    const {
                                        targetYearMap,
                                        drivenYearMap,
                                        allocTargetsInMonth,
                                        perPersonAssignedWeightedInMonth,
                                        perPersonNefInMonth,
                                        perPersonItwInMonth,
                                        perPersonRtwTagNightYear,
                                        perPersonWeekendInYear,
                                        targetCumulativeMap,
                                        drivenCumulativeMap
                                    } = sharedTargets;
                                    const items = (personnel || []).map(p => {
                                        const key = `p_${p.id}`;
                                        const target = (allocTargetsInMonth[key] ?? 0) || '';
                                        const count = perPersonAssignedWeightedInMonth[key] || 0;
                                        const tn = perPersonRtwTagNightYear[key] || { tag: 0, nacht: 0 };
                                        const nef = perPersonNefInMonth[key] || 0;
                                        const itw = itwEnabled ? (perPersonItwInMonth[key] || 0) : 0;
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
                                        const lpal = lpalIds.has(p.id);
                                        const oldRtwShifts = (p as any).oldRtwShifts || 0;
                                        const weekend = perPersonWeekendInYear[key] || 0;
                                        const total = tn.tag + tn.nacht + nef + itw;
                                        return { key, name: p.name, target, count, tag: tn.tag, nacht: tn.nacht, nef, itw, weekend, rest, cumDiff, teilzeit, hlfb, ue50, lpal, total, oldRtwShifts } as any;
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
                                            const rd = (p as any).rettungsdienstMonthly;
                                            const dept = (p as any).deptActiveMonthly;

                                            for (let mIdx = currentMonth; mIdx < 12; mIdx++) {
                                                if (rd && !rd[mIdx]) continue;
                                                if (dept && !dept[mIdx]) continue;

                                                const dim = new Date(year, mIdx + 1, 0).getDate();
                                                for (let d = 1; d <= dim; d++) {
                                                    const iso = new Date(Date.UTC(year, mIdx, d)).toISOString().slice(0, 10);
                                                    const cell = (localRoster as any)?.[key]?.[iso] || (roster as any)?.[key]?.[iso];
                                                    const raw = String(cell?.value || '').trim();
                                                    if (raw && (auswertungByType[raw] || 'off') !== 'off') cnt++;
                                                }
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
                                            const rd = (p as any).rettungsdienstMonthly;
                                            const dept = (p as any).deptActiveMonthly;

                                            for (let mIdx = currentMonth; mIdx < 12; mIdx++) {
                                                if (rd && !rd[mIdx]) continue;
                                                if (dept && !dept[mIdx]) continue;

                                                const dim = new Date(year, mIdx + 1, 0).getDate();
                                                for (let d = 1; d <= dim; d++) {
                                                    const iso = new Date(Date.UTC(year, mIdx, d)).toISOString().slice(0, 10);
                                                    const cell = (localRoster as any)?.[key]?.[iso] || (roster as any)?.[key]?.[iso];
                                                    const t = String(cell?.type || '');
                                                    if (/^rtw\d+_(tag|nacht)_(1|2)$/.test(t)) sum += 1;
                                                    else if (itwEnabled && /^itw_row_[12]$/.test(t)) sum += 1;
                                                    else if (/^nef(\d+)?_assist$/.test(t)) sum += getNefAssistWeight(t);
                                                }
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
                                                showOldRtwShifts={featureOldRtwShifts}
                                                showItw={itwEnabled}
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

            {/* Kommentar-Modal */}
            {activeCommentsData && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999
                }} onClick={() => { setActiveCommentsData(null); }}>
                    <div style={{
                        background: 'var(--bg)',
                        color: 'var(--fg)',
                        padding: '20px',
                        borderRadius: '8px',
                        minWidth: '300px',
                        maxWidth: '500px',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
                    }} onClick={e => e.stopPropagation()}>
                        <h3 style={{ marginTop: 0, marginBottom: '15px' }}>Kommentare ({activeCommentsData.dateStr})</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '45vh', overflowY: 'auto' }}>
                            {activeCommentsData.comments.length === 0 && (
                                <div style={{ padding: '10px', color: 'var(--muted)' }}>Keine Kommentare vorhanden.</div>
                            )}
                            {activeCommentsData.comments.map((comment, idx) => (
                                <div key={idx} style={{
                                    padding: '10px',
                                    background: idx % 2 === 1 ? 'var(--hover, #f3f4f6)' : 'transparent',
                                    borderRadius: '6px',
                                    whiteSpace: 'pre-wrap'
                                }}>
                                    {comment}
                                </div>
                            ))}
                        </div>
                        <div style={{ marginTop: '20px', textAlign: 'right' }}>
                            <button onClick={() => { setActiveCommentsData(null); }} style={{
                                padding: '8px 16px',
                                background: '#dc3545',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer'
                            }}>Schließen</button>
                        </div>
                    </div>
                </div>
            )}

            <AzubiAutoAssignDialog
                isOpen={azubiAutoState !== null}
                onClose={() => setAzubiAutoState(null)}
                onConfirm={handleConfirmAutoAssign}
                summaries={azubiAutoState || []}
            />
        </div>
    );
};

export default MonthTabs;