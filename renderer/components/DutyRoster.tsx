import React, { useEffect, useState, useRef } from 'react';
import * as XLSX from 'xlsx';
// ImportMonthDialog entfällt für direkten Monatsimport
import ImportTable from './ImportTable';
import CommentDialog from './CommentDialog';
// DepartmentDutyDaysTable entfernt
// DepartmentDutyDaysTableData entfernt
import { BUILD_INFO } from '../buildInfo';
import { useAuth } from '../contexts/AuthContext';

interface Person {
  id: number;
  name: string;
  vorname: string;
  fahrzeugfuehrerHLFB?: boolean | number;
  personnelNumber?: string;
}

type CommentMenuState = {
  x: number;
  y: number;
  scope: 'global' | 'personal';
  dateIso: string;
  personId?: number;
};

type CommentEditorState = {
  scope: 'global' | 'personal';
  dateIso: string;
  personId?: number;
};

const getDaysInYear = (year: number) => {
  const days: { date: string; weekday: string; iso: string }[] = [];
  const start = new Date(year, 0, 1);
  const end = new Date(year + 1, 0, 1);
  const numDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  for (let i = 0; i < numDays; i++) {
    const d = new Date(Date.UTC(year, 0, 1 + i));
    const date = d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
    const weekday = d.toLocaleDateString('de-DE', { weekday: 'short' });
    const iso = d.toISOString().slice(0, 10);
    days.push({ date, weekday, iso });
  }
  return days;
};

const getDaysInMonthView = (year: number, month: number) => {
  // Liefert Tage des Monats inkl. dayOfYear Index
  const days: { date: string; weekday: string; iso: string; dayOfYear: number }[] = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let base = 0;
  for (let m = 0; m < month; ++m) base += new Date(year, m + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; ++d) {
    const idx = base + (d - 1);
    const local = new Date(year, month, d);
    const iso = new Date(Date.UTC(year, month, d)).toISOString().slice(0, 10);
    const date = local.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
    const weekday = local.toLocaleDateString('de-DE', { weekday: 'short' });
    days.push({ date, weekday, iso, dayOfYear: idx });
  }
  return days;
};

const months = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

// Helper function to check if azubi is active on a specific date
const isAzubiActiveOnDate = (azubiPeriods: any[], checkDate: string): boolean => {
  if (!azubiPeriods || azubiPeriods.length === 0) {
    // No periods defined = not active (must have explicit period)
    return false;
  }

  const check = new Date(checkDate);
  return azubiPeriods.some(period => {
    const start = new Date(period.start_date);
    const end = new Date(period.end_date);
    return check >= start && check <= end;
  });
};

// Helper function to filter azubis based on their active periods for a specific month
const filterActiveAzubisForMonth = (azubis: any[], allPeriods: any[], year: number, month: number): any[] => {
  // Azubis müssen einen aktiven Zeitraum haben, um angezeigt zu werden
  if (!allPeriods || allPeriods.length === 0) {
    return []; // No periods defined globally = no azubis active
  }

  // Check if azubi is active at any point during the month
  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0);

  return azubis.filter(azubi => {
    const azubiPeriods = allPeriods.filter(p => p.azubi_id === azubi.id);

    if (azubiPeriods.length === 0) {
      return false; // No periods = not active (must have explicit period)
    }

    return azubiPeriods.some(period => {
      const periodStart = new Date(period.start_date);
      const periodEnd = new Date(period.end_date);

      // Check if period overlaps with the month
      return periodStart <= endOfMonth && periodEnd >= startOfMonth;
    });
  });
};

const DutyRoster: React.FC = () => {
  const { currentUser, hasPermission } = useAuth();
  const canWrite = hasPermission('dienstplan', 'write');
  const canRead = hasPermission('dienstplan', 'read');
  const canReadAll = currentUser?.permissions['dienstplan'] === 'read_all';
  const canWriteGlobalComments = hasPermission('kommentar_global', 'write') || canWrite;
  const canWritePersonalComments = hasPermission('kommentar_individuell', 'write') || canWrite;

  const [personnel, setPersonnel] = useState<Person[]>([]);
  const [year, setYear] = useState<number>((window as any).rdPlanYear || new Date().getFullYear());
  const [yearPlannings, setYearPlannings] = useState<{ year: number; filePath: string }[]>([]);
  const monthButtonsRef = useRef<{ [key: number]: HTMLButtonElement | null }>({});
  const [shiftTypes, setShiftTypes] = useState<{ id: number, code: string, description: string }[]>([]);
  const [customDropdownValues, setCustomDropdownValues] = useState<string[]>([]);
  const [department, setDepartment] = useState<number>(1);
  const [itwEnabled, setItwEnabled] = useState<boolean>(false);
  const [itwPatternSeqs, setItwPatternSeqs] = useState<{ startDate: string; pattern: string[] }[]>([]);
  const [deptPatternSeqs, setDeptPatternSeqs] = useState<{ startDate: string; pattern: string[] }[]>([]);
  const [holidays, setHolidays] = useState<Set<string>>(new Set());
  const [auswertungByType, setAuswertungByType] = useState<Record<string, 'off' | 'tag' | 'nacht' | '24h' | 'itw'>>({});
  const [colorByType, setColorByType] = useState<Record<string, string>>({});
  const [shiftPattern] = useState<string[]>([
    '3', '2', '1', '3', '1', '3', '2', '1', '3', '2', '1', '2', '1', '3', '2', '1', '3', '2', '3', '2', '1'
  ]);
  // Dienstplan-State: { [personId: string]: { [dayIndex]: { value, type } } }
  const [roster, setRoster] = useState<Record<string, Record<string, { value: string, type: string, manualEdit?: boolean }>>>({});
  // Editierstatus: [personId: string][dayIdx] => true/false
  const [editing, setEditing] = useState<Record<string, Record<number, boolean>>>({});
  // Force Update Counter für UI-Refresh
  const [updateCounter, setUpdateCounter] = useState(0);
  // Monats-Import direkt für currentMonth
  const [showImportTable, setShowImportTable] = useState(false);
  const [importTableMonth, setImportTableMonth] = useState<number | null>(null);
  const [azubis, setAzubis] = useState<{ id: number; name: string; vorname: string; lehrjahr: number }[]>([]);
  const [azubiPeriods, setAzubiPeriods] = useState<any[]>([]);
  const [filteredAzubis, setFilteredAzubis] = useState<{ id: number; name: string; vorname: string; lehrjahr: number }[]>([]);
  const [itwDates, setItwDates] = useState<Set<string>>(new Set());
  // New Azubi Dialog States
  const [showNewAzubiDialog, setShowNewAzubiDialog] = useState(false);
  const [unknownAzubiNames, setUnknownAzubiNames] = useState<string[]>([]);
  const [pendingImportPath, setPendingImportPath] = useState<string>('');
  // New ShiftType Dialog States
  const [showNewShiftTypeDialog, setShowNewShiftTypeDialog] = useState(false);
  const [unknownShiftTypes, setUnknownShiftTypes] = useState<string[]>([]);
  // Azubi Period Dialog States
  const [showAzubiPeriodDialog, setShowAzubiPeriodDialog] = useState(false);
  const [azubisWithoutPeriod, setAzubisWithoutPeriod] = useState<Array<{ azubiId: number, azubiName: string, importDateRange: { start: string, end: string } }>>([]);
  const [pendingImportYear, setPendingImportYear] = useState<number>(0);
  const [pendingImportMonth, setPendingImportMonth] = useState<number | { start: number, end: number } | undefined>(undefined);
  // Fahrzeuge und Aktivierungen für Positions-Berechnungen
  const [rtwVehicles, setRtwVehicles] = useState<{ id: number; name: string }[]>([]);
  const [nefVehicles, setNefVehicles] = useState<{ id: number; name: string }[]>([]);
  const [rtwActs, setRtwActs] = useState<Record<number, boolean[]>>({});
  const [nefActs, setNefActs] = useState<Record<number, boolean[]>>({});
  // Monatsweise Ansicht: ausgewählter Monat und Tage
  const [currentMonth, setCurrentMonth] = useState<number>(() => {
    if ((window as any).rdPlanMonth !== undefined && typeof (window as any).rdPlanMonth === 'number') {
      return (window as any).rdPlanMonth;
    }
    return 0;
  });
  // Freigabe-Status pro Monat
  const [releasedMonths, setReleasedMonths] = useState<boolean[]>(Array(12).fill(false));
  const [globalComments, setGlobalComments] = useState<Map<string, { id: number; comment: string }>>(new Map());
  const [personalComments, setPersonalComments] = useState<Map<string, { id: number; comment: string }>>(new Map());
  const [commentMenu, setCommentMenu] = useState<CommentMenuState | null>(null);
  const [commentEditor, setCommentEditor] = useState<CommentEditorState | null>(null);

  const getPersonalCommentKey = (personId: number, dateIso: string) => `${personId}_${dateIso}`;

  const invokeCommentApi = async (methodName: string, channel: string, ...args: any[]) => {
    const apiMethod = (window as any)?.api?.[methodName];
    if (typeof apiMethod === 'function') {
      return apiMethod(...args);
    }
    const invoke = (window as any)?.electronAPI?.invoke;
    if (typeof invoke === 'function') {
      return invoke(channel, ...args);
    }
    throw new Error(`Kommentar-API nicht verfügbar (${methodName}).`);
  };

  const loadComments = async (yearOverride?: number, monthOverride?: number) => {
    try {
      const y = typeof yearOverride === 'number' ? yearOverride : year;
      const m = typeof monthOverride === 'number' ? monthOverride : currentMonth;
      const [persRes, globRes] = await Promise.all([
        invokeCommentApi('getPersonalCommentsForMonth', 'roster-comment-personal-get-month', y, m),
        invokeCommentApi('getGlobalCommentsForMonth', 'roster-comment-global-get-month', y, m)
      ]);

      const persMap = new Map<string, { id: number; comment: string }>();
      (persRes || []).forEach((c: any) => {
        persMap.set(getPersonalCommentKey(Number(c.person_id), String(c.date)), {
          id: Number(c.id),
          comment: String(c.comment || '')
        });
      });

      const globMap = new Map<string, { id: number; comment: string }>();
      (globRes || []).forEach((c: any) => {
        globMap.set(String(c.date), {
          id: Number(c.id),
          comment: String(c.comment || '')
        });
      });

      setPersonalComments(persMap);
      setGlobalComments(globMap);
    } catch (err) {
      console.warn('[DutyRoster] Kommentare konnten nicht geladen werden', err);
    }
  };

  const openGlobalCommentMenu = (e: React.MouseEvent, dateIso: string) => {
    if (!canWriteGlobalComments) return;
    e.preventDefault();
    setCommentMenu({ x: e.clientX, y: e.clientY, scope: 'global', dateIso });
  };

  const openPersonalCommentMenu = (e: React.MouseEvent, personId: number, dateIso: string) => {
    if (!canWritePersonalComments) return;
    e.preventDefault();
    setCommentMenu({ x: e.clientX, y: e.clientY, scope: 'personal', dateIso, personId });
  };

  const handleUpsertGlobalComment = async (dateIso: string, text: string) => {
    try {
      await invokeCommentApi('addGlobalComment', 'roster-comment-global-add', dateIso, text);
      await loadComments();
    } catch (err: any) {
      alert(`Kommentar konnte nicht gespeichert werden: ${err?.message || String(err)}`);
    }
  };

  const handleDeleteGlobalComment = async (dateIso: string, skipConfirm = false) => {
    try {
      if (!globalComments.has(dateIso)) return;
      if (!skipConfirm && !window.confirm('Globalen Kommentar wirklich löschen?')) return;
      await invokeCommentApi('deleteGlobalComment', 'roster-comment-global-delete', dateIso);
      await loadComments();
    } catch (err: any) {
      alert(`Kommentar konnte nicht gelöscht werden: ${err?.message || String(err)}`);
    }
  };

  const handleUpsertPersonalComment = async (personId: number, dateIso: string, text: string) => {
    try {
      await invokeCommentApi('addPersonalComment', 'roster-comment-personal-add', personId, dateIso, text);
      await loadComments();
    } catch (err: any) {
      alert(`Kommentar konnte nicht gespeichert werden: ${err?.message || String(err)}`);
    }
  };

  const handleDeletePersonalComment = async (personId: number, dateIso: string, skipConfirm = false) => {
    try {
      const key = getPersonalCommentKey(personId, dateIso);
      if (!personalComments.has(key)) return;
      if (!skipConfirm && !window.confirm('Individuellen Kommentar wirklich löschen?')) return;
      await invokeCommentApi('deletePersonalComment', 'roster-comment-personal-delete', personId, dateIso);
      await loadComments();
    } catch (err: any) {
      alert(`Kommentar konnte nicht gelöscht werden: ${err?.message || String(err)}`);
    }
  };

  useEffect(() => {
    (async () => {
      const list = await (window as any).api.getPersonnelList();
      const azubiList = await (window as any).api.getAzubiList();
      const allPeriods = await (window as any).api.getAllAzubiPeriods();
      const allQualPeriods = await (window as any).api.getAllQualificationPeriods();

      // Filtere Personal: Nur Personen MIT Rettungsdienst-Qualifikation in mindestens einem Monat
      let rettungsdienstQualName = 'Rettungsdienst';
      try {
        const val = await (window as any).api.getSetting('rettungsdienst_qualification_type');
        if (val) rettungsdienstQualName = String(val);
      } catch { }

      const periodsByPerson: Record<number, any[]> = {};
      if (Array.isArray(allQualPeriods)) {
        allQualPeriods.forEach((p: any) => {
          if (!periodsByPerson[p.personId]) periodsByPerson[p.personId] = [];
          periodsByPerson[p.personId].push(p);
        });
      }

      const filteredPersonnel = (list || []).filter((p: any) => {
        const pPeriods = periodsByPerson[p.id] || [];
        const rdPeriods = pPeriods.filter((per: any) => per.qualType === rettungsdienstQualName && per.active);
        // Person muss mindestens eine aktive Rettungsdienst-Periode haben (in irgendeinem Zeitraum)
        const hasRD = rdPeriods.length > 0;
        if (!hasRD) {
          console.log('[DutyRoster Initial] Filtered out:', p.name, '- No Rettungsdienst qualification');
        }
        return hasRD;
      });

      console.log('[DutyRoster Initial] Personnel before filter:', list.length, '| after filter:', filteredPersonnel.length);
      setPersonnel(filteredPersonnel);
      setAzubis(azubiList);
      setAzubiPeriods(allPeriods);

      // Lade jahresspezifische Vorplanungen
      try {
        const plannings = await (window as any).api.getYearPlannings?.();
        if (plannings && Array.isArray(plannings)) {
          setYearPlannings(plannings.map((p: any) => ({ year: Number(p.year), filePath: String(p.filePath) })));
        }
      } catch (e) {
        // console.error('Failed to load year plannings:', e);
      }

      // Lade das Jahr aus den Settings für initialen Daten-Load
      const y = await (window as any).api.getSetting('year');
      const yearToUse = Number(y) || year;
      // console.log('[DEBUG] Initial load, year from settings:', y, 'using:', yearToUse, 'state year:', year);

      const types = await (window as any).api.getShiftTypes();
      setShiftTypes(types);
      // Lade Auswertung je Dienstart (off|tag|nacht|24h|itw)
      try {
        const map: Record<string, 'off' | 'tag' | 'nacht' | '24h' | 'itw'> = {};
        for (const t of (types || [])) {
          const v = await (window as any).api.getSetting(`auswertung_${t.code}`);
          map[t.code] = (v === 'tag' || v === 'nacht' || v === '24h' || v === 'itw') ? v : 'off';
        }
        setAuswertungByType(map);
      } catch { }
      // Lade Farben je Dienstart (color_<code>)
      try {
        const cmap: Record<string, string> = {};
        for (const t of (types || [])) {
          const c = await (window as any).api.getSetting(`color_${t.code}`);
          const norm = (typeof c === 'string' && /^#?[0-9a-fA-F]{6}$/.test(c)) ? (c.startsWith('#') ? c : `#${c}`) : '';
          cmap[t.code] = norm;
        }
        setColorByType(cmap);
      } catch { }
      const custom = await (window as any).api.getSetting('customDropdownValues');
      if (custom) setCustomDropdownValues(String(custom).split('\n').map(s => s.trim()).filter(Boolean));
      const dep = await (window as any).api.getSetting('department');
      if (dep) setDepartment(Number(dep));
      const itwVal = await (window as any).api.getSetting('itw');
      if (itwVal) setItwEnabled(itwVal === 'true');
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
      // Dept Sequenzen laden
      try {
        const seqs = await (window as any).api.getDeptPatterns?.();
        const normDept = (arr: string[], len = 21) => (arr || []).slice(0, len).concat(Array(len).fill('')).slice(0, len).map(v => (v === '1' || v === '2' || v === '3') ? v : '');
        if (Array.isArray(seqs) && seqs.length > 0) {
          const parsed = seqs.map((s: any) => ({ startDate: String(s.startDate), pattern: normDept(String(s.pattern).split(',').map((x: string) => x.trim()), 21) }));
          parsed.sort((a: any, b: any) => a.startDate.localeCompare(b.startDate));
          setDeptPatternSeqs(parsed);
        }
      } catch { }
      // Feiertage laden
      try {
        const hlist = await (window as any).api.getHolidaysForYear(yearToUse);
        const set = new Set<string>((hlist || []).map((h: any) => String(h.date)));
        setHolidays(set);
      } catch { }
      // Fahrzeuge und Aktivierungen laden (für aktuelle Settings-Jahr)
      try {
        const r = await (window as any).api.getRtwVehicles?.();
        if (Array.isArray(r)) setRtwVehicles(r);
      } catch { }
      try {
        const n = await (window as any).api.getNefVehicles?.();
        if (Array.isArray(n)) setNefVehicles(n);
      } catch { }
      try {
        const acts = await (window as any).api.getRtwVehicleActivations?.(yearToUse);
        const map: Record<number, boolean[]> = {};
        (acts || []).forEach((row: any) => {
          const vid = Number(row.vehicleId);
          const m = Number(row.month);
          const arr = map[vid] || Array(12).fill(true);
          arr[m - 1] = !!row.enabled;
          map[vid] = arr;
        });
        setRtwActs(map);
      } catch { }
      try {
        const acts = await (window as any).api.getNefVehicleActivations?.(yearToUse);
        const map: Record<number, boolean[]> = {};
        (acts || []).forEach((row: any) => {
          const vid = Number(row.vehicleId);
          const m = Number(row.month);
          const arr = map[vid] || Array(12).fill(true);
          arr[m - 1] = !!row.enabled;
          map[vid] = arr;
        });
        setNefActs(map);
      } catch { }
      // Dienstplan-Einträge laden
      const entries = await (window as any).api.getDutyRoster(yearToUse);
      // console.log('[Renderer] getDutyRoster fetched', Array.isArray(entries) ? entries.length : typeof entries, 'entries for year', yearToUse);
      if (Array.isArray(entries) && entries.length > 0) {
        // console.log('[Renderer] sample entry[0]=', entries[0]);
      }
      // ITW-Tage bestimmen: jedes Datum, an dem mindestens ein ITW-Dienst eingetragen ist
      try {
        const itwSet = new Set<string>();
        (entries || []).forEach((e: any) => {
          if (!e || !e.date) return;
          const t = String(e.type || '');
          const raw = String(e.value || '').trim();
          if (t.startsWith('itw_')) itwSet.add(String(e.date));
          else if (raw && (auswertungByType[raw] === 'itw')) itwSet.add(String(e.date));
        });
        setItwDates(itwSet);
      } catch { }
      // IDs für Mapping vorbereiten (immer aktuell aus den geladenen Listen)
      const personalIds = new Set(list.map((p: { id: number }) => p.id));
      const azubiIds = new Set(azubiList.map((a: { id: number }) => a.id));
      const rosterObj: Record<string, Record<string, { value: string, type: string, manualEdit?: boolean }>> = {};
      entries.forEach((entry: any) => {
        const iso = String(entry.date);
        if (!iso) return;
        // Normalize type: if value matches a known shift code, prefer dropdown
        try {
          const existingType = String(entry.type || '');
          const isSlot = /^(rtw|nef|itw)/.test(existingType);
          if (!isSlot) {
            if (entry && entry.value) {
              const code = String(entry.value).trim();
              if (shiftTypes && Array.isArray(shiftTypes) && shiftTypes.some((t: any) => t.code === code)) {
                entry.type = 'dropdown';
              } else {
                entry.type = 'text';
              }
            } else {
              entry.type = existingType || 'text';
            }
          }
        } catch (e) { /* ignore */ }
        let key = '';
        if (entry.personType === 'person' && personalIds.has(entry.personId)) {
          key = `p_${entry.personId}`;
        } else if (entry.personType === 'azubi' && azubiIds.has(entry.personId)) {
          key = `a_${entry.personId}`;
        } else {
          key = String(entry.personId);
        }
        if (!rosterObj[key]) rosterObj[key] = {};
        rosterObj[key][iso] = { value: entry.value, type: String(entry.type || ''), manualEdit: !!entry.manual_edit };
      });
      // console.log('[Renderer] constructed rosterObj keys=', Object.keys(rosterObj).slice(0,20), 'total=', Object.keys(rosterObj).length);
      setRoster(rosterObj);

      // Aktualisiere Year-State falls das geladene Jahr vom initialen State abweicht
      if (yearToUse !== year) {
        // console.log('[DEBUG] Updating year state from', year, 'to', yearToUse);
        setYear(yearToUse);
      }
    })();
    // Listener: wenn Main einen Update-Broadcast sendet, neu laden
    const onUpdated = () => { console.log('[Renderer] duty-roster-updated empfangen, reloadRoster aufrufen'); reloadRoster(); };
    const onSettingsUpdated = async () => {
      try {
        const y = await (window as any).api.getSetting('year');
        const newYear = Number(y || new Date().getFullYear());
        if (newYear !== year) setYear(newYear);
        // Shift-Typen und Auswertungen neu laden
        try {
          const types = await (window as any).api.getShiftTypes();
          setShiftTypes(types);
          const map: Record<string, 'off' | 'tag' | 'nacht' | '24h' | 'itw'> = {};
          for (const t of (types || [])) {
            const v = await (window as any).api.getSetting(`auswertung_${t.code}`);
            map[t.code] = (v === 'tag' || v === 'nacht' || v === '24h' || v === 'itw') ? v : 'off';
          }
          setAuswertungByType(map);
          // Farben neu laden
          try {
            const cmap: Record<string, string> = {};
            for (const t of (types || [])) {
              const c = await (window as any).api.getSetting(`color_${t.code}`);
              const norm = (typeof c === 'string' && /^#?[0-9a-fA-F]{6}$/.test(c)) ? (c.startsWith('#') ? c : `#${c}`) : '';
              cmap[t.code] = norm;
            }
            setColorByType(cmap);
          } catch { }
        } catch { }
        // ITW-Pattern Sequenzen neu laden
        try {
          const norm = (arr: string[], len = 21) => (arr || []).slice(0, len).concat(Array(len).fill('')).slice(0, len).map(v => (v === 'IW' ? 'IW' : ''));
          const seqs = await (window as any).api.getItwPatterns?.();
          if (Array.isArray(seqs) && seqs.length > 0) {
            const parsed = seqs.map((s: any) => ({ startDate: String(s.startDate), pattern: norm(String(s.pattern).split(',').map((x: string) => x.trim()), 21) }));
            parsed.sort((a, b) => a.startDate.localeCompare(b.startDate));
            setItwPatternSeqs(parsed);
          }
        } catch { }
        // Dept Sequenzen neu laden
        try {
          const seqs = await (window as any).api.getDeptPatterns?.();
          const normDept = (arr: string[], len = 21) => (arr || []).slice(0, len).concat(Array(len).fill('')).slice(0, len).map(v => (v === '1' || v === '2' || v === '3') ? v : '');
          if (Array.isArray(seqs) && seqs.length > 0) {
            const parsed = seqs.map((s: any) => ({ startDate: String(s.startDate), pattern: normDept(String(s.pattern).split(',').map((x: string) => x.trim()), 21) }));
            parsed.sort((a: any, b: any) => a.startDate.localeCompare(b.startDate));
            setDeptPatternSeqs(parsed);
          }
        } catch { }
        // Feiertage neu laden – gezielt für das neue Settings-Jahr
        try {
          const hlist = await (window as any).api.getHolidaysForYear(newYear);
          setHolidays(new Set<string>((hlist || []).map((h: any) => String(h.date))));
        } catch { }
        // Roster gezielt für das neue Jahr laden, auch wenn setYear async ist
        await reloadRoster(newYear);
        // Freigabe-Status neu laden
        try {
          const releasedProms = Array(12).fill(0).map((_, i) => {
            const key = `roster_released_${newYear}_${i}`;
            return (window as any).api.getSetting(key).then((val: string) => val === '1');
          });
          const status = await Promise.all(releasedProms);
          setReleasedMonths(status);
        } catch (e) { console.warn('Failed to reload released status', e); }
      } catch (e) { console.warn('[Renderer] settings-updated handler error', e); }


    };
    (window as any).api && (window as any).api.onDutyRosterUpdated && (window as any).api.onDutyRosterUpdated(onUpdated);
    (window as any).api?.onSettingsUpdated?.(onSettingsUpdated);
    // Cleanup
    return () => {
      (window as any).api && (window as any).api.offDutyRosterUpdated && (window as any).api.offDutyRosterUpdated(onUpdated);
      (window as any).api?.offSettingsUpdated?.(onSettingsUpdated);
    };
  }, []);

  useEffect(() => {
    loadComments();
  }, [year, currentMonth]);

  useEffect(() => {
    if (!commentMenu) return;
    const close = () => setCommentMenu(null);
    window.addEventListener('click', close);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [commentMenu]);

  // Speichere currentMonth im window-Objekt
  useEffect(() => {
    (window as any).rdPlanMonth = currentMonth;
  }, [currentMonth]);

  // Lausche auf Monatsänderungen aus der Einteilung
  useEffect(() => {
    const handleMonthChange = () => {
      const einteilungMonth = (window as any).rdPlanMonth;
      if (einteilungMonth !== undefined && typeof einteilungMonth === 'number' && einteilungMonth !== currentMonth) {
        setCurrentMonth(einteilungMonth);
      }
    };

    // Event-Listener für explizite Monatsänderungen
    window.addEventListener('rdplan-month-changed', handleMonthChange);

    // Intervall-Check als Fallback (falls kein Event gefeuert wird)
    const interval = setInterval(() => {
      const einteilungMonth = (window as any).rdPlanMonth;
      if (einteilungMonth !== undefined && typeof einteilungMonth === 'number' && einteilungMonth !== currentMonth) {
        setCurrentMonth(einteilungMonth);
      }
    }, 500);

    return () => {
      window.removeEventListener('rdplan-month-changed', handleMonthChange);
      clearInterval(interval);
    };
  }, [currentMonth]);

  // Synchronisiere Jahr mit window-Objekt für Header
  useEffect(() => {
    // Teile Jahr mit anderen Komponenten
    (window as any).rdPlanYear = year;
    window.dispatchEvent(new CustomEvent('rdplan-year-changed', { detail: { year } }));

    // Persistiere Jahr in Settings
    (async () => {
      try {
        await (window as any).api.setSetting('year', String(year));
        // console.log('[DEBUG] Year saved to settings:', year);
      } catch (err) {
        // console.error('[DEBUG] Failed to save year to settings:', err);
      }
    })();

    // NICHT automatisch Monat ändern - respektiere rdPlanMonth aus Einteilung
  }, [year]);

  // Filter azubis based on active periods for current month (only show azubis with valid period)
  useEffect(() => {
    // console.log('[DEBUG] filteredAzubis useEffect triggered, azubis:', azubis.length, 'year:', year, 'month:', currentMonth);
    const filtered = filterActiveAzubisForMonth(azubis, azubiPeriods, year, currentMonth + 1);
    // console.log('[DEBUG] filtered azubis with active period:', filtered.length);
    setFilteredAzubis(filtered);
  }, [azubis, azubiPeriods, year, currentMonth]);
  const days = getDaysInMonthView(year, currentMonth);
  // Debug: Zeige die ersten 5 Tage im Jahr
  // console.log('[DEBUG] days[0-4]:', days.slice(0,5));

  // Kombiniere Personal und Azubis für die Dienstplan-Tabelle
  type Row = { id: string; origId: number; name: string; vorname: string; isAzubi: boolean; lehrjahr?: number };

  // Filtere Personal basierend auf Berechtigungen
  let visiblePersonnel = personnel;
  if ((canRead || canReadAll) && !canWrite && currentUser) {
    // Read-Only: Zeige nur eigene Zeile, es sei denn user hat dienstplan_read_all
    if (!canReadAll) {
      visiblePersonnel = personnel.filter(p => p.personnelNumber === currentUser.personnelNumber);
    }
  }

  // Filtere Azubis: nur bei Schreibrechten anzeigen
  const visibleAzubis = canWrite ? filteredAzubis : [];

  const allRows: Row[] = [
    ...visiblePersonnel.map(p => ({ id: `p_${p.id}`, origId: p.id, name: p.name, vorname: p.vorname, isAzubi: false })),
    ...visibleAzubis.map(a => ({ id: `a_${a.id}`, origId: a.id, name: a.name, vorname: a.vorname, isAzubi: true, lehrjahr: a.lehrjahr }))
  ];
  // Sortiere Azubis nach Lehrjahr, Personal bleibt oben
  allRows.sort((a, b) => {
    if (a.isAzubi && b.isAzubi) return ((a.lehrjahr ?? 0) - (b.lehrjahr ?? 0)) || a.name.localeCompare(b.name);
    if (a.isAzubi) return 1;
    if (b.isAzubi) return -1;
    return 0;
  });

  // Hilfsfunktion: Hex (#rrggbb) -> rgba(r,g,b,a)
  const hexToRgba = (hex: string, alpha: number): string => {
    if (!hex) return '';
    const h = hex.replace('#', '').trim();
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return '';
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    const a = Math.max(0, Math.min(1, alpha));
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  };

  // Hilfsfunktionen für State-Keys
  const getStateKey = (row: Row) => row.id;

  // Maximale Nachnamenslänge für Spaltenbreite berechnen
  const maxNameLength = Math.max(...personnel.map(p => p.name.length), 4);
  const nameColWidth = Math.max(80, maxNameLength * 12 + 24); // 12px pro Buchstabe + etwas Puffer

  // Wähle aktive Sequenz nach Datum (letzte mit startDate <= iso)
  const getActivePatternFor = (iso: string): string[] => {
    if (!iso) return [];
    const seqs = (itwPatternSeqs && itwPatternSeqs.length > 0) ? itwPatternSeqs : [];
    let active = seqs[0];
    for (const s of seqs) {
      if (s.startDate <= iso) active = s; else break;
    }
    return (active && active.pattern) ? active.pattern : [];
  };
  const isIwDay = (i: number) => {
    // NEU: Ein ITW-Tag ist jeder Tag, an dem mindestens eine Person einen ITW-Dienst eingeteilt ist.
    const day = days[i];
    if (!day) return false;
    const iso = day.iso;
    if (!iso) return false;
    return itwDates.has(iso);
  };

  // New Azubi Dialog Handler
  const handleCreateNewAzubis = async (newAzubis: Array<{ name: string, vorname: string, lehrjahr: number }>) => {
    try {
      const retryResult = await (window as any).api.importDutyRoster(pendingImportPath, year, currentMonth, { newAzubis });
      if (retryResult.success) {
        let message = `Import erfolgreich: ${retryResult.importedCount} Einträge wurden verarbeitet. ${newAzubis.length} neue Azubis wurden angelegt.`;

        // Check for availability conflicts
        if (retryResult.availabilityConflicts && retryResult.availabilityConflicts.length > 0) {
          const conflictList = retryResult.availabilityConflicts.map((c: any) =>
            `${c.personName} am ${c.date}: Schichtart "${c.dutyRosterValue}" (nicht verfügbar), aber eingeteilt auf "${c.einteilungValue}"`
          ).join('\n');

          message += `\n\n⚠️ WARNUNG: ${retryResult.availabilityConflicts.length} Verfügbarkeitskonflikt(e) gefunden:\n\n${conflictList}\n\nBitte prüfen Sie die Einteilungen!`;
        }

        alert(message);
        await reloadRoster();
      } else {
        alert(`Import fehlgeschlagen: ${retryResult.message}`);
      }
    } catch (error) {
      // console.error('Fehler beim erneuten Import:', error);
      alert('Fehler beim Import.');
    }
    setShowNewAzubiDialog(false);
  };

  const handleCancelNewAzubis = () => {
    setShowNewAzubiDialog(false);
  };

  const handleAdjustAzubiPeriods = async (adjustments: Array<{ azubiId: number, startDate: string, endDate: string, description: string, lehrjahr: number }>) => {
    try {
      const retryResult = await (window as any).api.importDutyRoster(pendingImportPath, pendingImportYear, pendingImportMonth, { azubiPeriodAdjustments: adjustments });
      if (retryResult.success) {
        let message = `Import erfolgreich: ${retryResult.importedCount} Einträge wurden verarbeitet. ${adjustments.length} Azubi-Zeiträume wurden angepasst.`;

        // Check for availability conflicts
        if (retryResult.availabilityConflicts && retryResult.availabilityConflicts.length > 0) {
          const conflictList = retryResult.availabilityConflicts.map((c: any) =>
            `${c.personName} am ${c.date}: Schichtart "${c.dutyRosterValue}" (nicht verfügbar), aber eingeteilt auf "${c.einteilungValue}"`
          ).join('\n');

          message += `\n\n⚠️ WARNUNG: ${retryResult.availabilityConflicts.length} Verfügbarkeitskonflikt(e) gefunden:\n\n${conflictList}\n\nBitte prüfen Sie die Einteilungen!`;
        }

        alert(message);
        await reloadRoster();
      } else {
        alert(`Import fehlgeschlagen: ${retryResult.message}`);
      }
    } catch (error) {
      // console.error('Fehler beim erneuten Import:', error);
      alert('Fehler beim Import.');
    }
    setShowAzubiPeriodDialog(false);
  };

  const handleCancelAzubiPeriodDialog = () => {
    setShowAzubiPeriodDialog(false);
  };

  // New ShiftType Dialog Handlers
  const handleCreateNewShiftTypes = async (newShiftTypes: Array<{ code: string, description: string, color: string, auswertung: string }>) => {
    try {
      const retryResult = await (window as any).api.importDutyRoster(pendingImportPath, pendingImportYear, pendingImportMonth, { newShiftTypes });
      if (retryResult.success) {
        // Check if there are still unknown azubis after creating shift types
        if (retryResult.unknownAzubis && retryResult.unknownAzubis.length > 0) {
          const createNewAzubis = window.confirm(
            `Folgende unbekannte Azubi-Namen wurden gefunden:\n${retryResult.unknownAzubis.join('\n')}\n\nMöchten Sie diese als neue Azubis anlegen?`
          );

          if (createNewAzubis) {
            setShowNewAzubiDialog(true);
            setUnknownAzubiNames(retryResult.unknownAzubis);
            // Keep the same pending import parameters
          } else {
            let message = `Import erfolgreich: ${retryResult.importedCount} Einträge wurden verarbeitet. ${newShiftTypes.length} neue Dienstarten wurden angelegt.`;

            // Check for availability conflicts
            if (retryResult.availabilityConflicts && retryResult.availabilityConflicts.length > 0) {
              const conflictList = retryResult.availabilityConflicts.map((c: any) =>
                `${c.personName} am ${c.date}: Schichtart "${c.dutyRosterValue}" (nicht verfügbar), aber eingeteilt auf "${c.einteilungValue}"`
              ).join('\n');

              message += `\n\n⚠️ WARNUNG: ${retryResult.availabilityConflicts.length} Verfügbarkeitskonflikt(e) gefunden:\n\n${conflictList}\n\nBitte prüfen Sie die Einteilungen!`;
            }

            alert(message);
            await reloadRoster();
          }
        } else {
          let message = `Import erfolgreich: ${retryResult.importedCount} Einträge wurden verarbeitet. ${newShiftTypes.length} neue Dienstarten wurden angelegt.`;

          // Check for availability conflicts
          if (retryResult.availabilityConflicts && retryResult.availabilityConflicts.length > 0) {
            const conflictList = retryResult.availabilityConflicts.map((c: any) =>
              `${c.personName} am ${c.date}: Schichtart "${c.dutyRosterValue}" (nicht verfügbar), aber eingeteilt auf "${c.einteilungValue}"`
            ).join('\n');

            message += `\n\n⚠️ WARNUNG: ${retryResult.availabilityConflicts.length} Verfügbarkeitskonflikt(e) gefunden:\n\n${conflictList}\n\nBitte prüfen Sie die Einteilungen!`;
          }

          alert(message);
          await reloadRoster();
        }
      } else {
        alert(`Import fehlgeschlagen: ${retryResult.message}`);
      }
    } catch (error) {
      // console.error('Fehler beim erneuten Import:', error);
      alert('Fehler beim Import.');
    }
    setShowNewShiftTypeDialog(false);
  };

  const handleCancelNewShiftTypes = () => {
    setShowNewShiftTypeDialog(false);
  };

  // Import-Handler
  const handleImport = async () => {
    // Versuche jahresspezifische Vorplanungsdatei zu laden
    let rosterImportPath = null;
    try {
      const yearPlanning = await (window as any).api.getYearPlanningForYear?.(year);
      if (yearPlanning?.filePath) {
        rosterImportPath = yearPlanning.filePath;
      }
    } catch (e) {
      // console.warn('Fehler beim Laden der jahresspezifischen Vorplanung:', e);
    }

    // Fallback: alte rosterImportPath Einstellung
    if (!rosterImportPath) {
      rosterImportPath = await (window as any).api.getSetting('rosterImportPath');
    }

    if (!rosterImportPath) {
      alert('Bitte hinterlegen Sie zuerst eine Vorplanungsdatei für das Jahr ' + year + ' in den Einstellungen.');
      return;
    }
    const ok = window.confirm(`Möchten Sie den Dienstplan für ${months[currentMonth]} ${year} aus der Excel-Datei importieren? Bestehende Daten für diesen Monat werden überschrieben.`);
    if (!ok) return;

    try {
      const result = await (window as any).api.importDutyRoster(rosterImportPath, year, currentMonth);
      if (result.success) {
        // Check if unknown shift types were found
        if (result.unknownShiftTypes && result.unknownShiftTypes.length > 0) {
          const createNewShiftTypes = window.confirm(
            `Folgende unbekannte Dienstarten wurden gefunden:\n${result.unknownShiftTypes.join('\n')}\n\nMöchten Sie diese als neue Dienstarten anlegen?`
          );

          if (createNewShiftTypes) {
            // Show new shift type dialog
            setShowNewShiftTypeDialog(true);
            setUnknownShiftTypes(result.unknownShiftTypes);
            setPendingImportPath(rosterImportPath);
            setPendingImportYear(year);
            setPendingImportMonth(currentMonth);
          }
          return;
        }

        // Check if azubis without valid periods were found
        if (result.azubisWithoutPeriod && result.azubisWithoutPeriod.length > 0) {
          // Show dialog to adjust periods
          setShowAzubiPeriodDialog(true);
          setAzubisWithoutPeriod(result.azubisWithoutPeriod);
          setPendingImportPath(rosterImportPath);
          setPendingImportYear(year);
          setPendingImportMonth(currentMonth);
          return;
        }

        // Check if unknown azubis were found
        if (result.unknownAzubis && result.unknownAzubis.length > 0) {
          const createNewAzubis = window.confirm(
            `Folgende unbekannte Azubi-Namen wurden gefunden:\n${result.unknownAzubis.join('\n')}\n\nMöchten Sie diese als neue Azubis anlegen?`
          );

          if (createNewAzubis) {
            // Show new azubi dialog
            setShowNewAzubiDialog(true);
            setUnknownAzubiNames(result.unknownAzubis);
            setPendingImportPath(rosterImportPath);
            setPendingImportYear(year);
            setPendingImportMonth(currentMonth);
          }
          return;
        }

        // Check for availability conflicts (person assigned to vehicle but marked as unavailable)
        let message = `Import erfolgreich: ${result.importedCount} Einträge wurden verarbeitet.`;

        if (result.availabilityConflicts && result.availabilityConflicts.length > 0) {
          const conflictList = result.availabilityConflicts.map((c: any) =>
            `${c.personName} am ${c.date}: Schichtart "${c.dutyRosterValue}" (nicht verfügbar), aber eingeteilt auf "${c.einteilungValue}"`
          ).join('\n');

          message += `\n\n⚠️ WARNUNG: ${result.availabilityConflicts.length} Verfügbarkeitskonflikt(e) gefunden:\n\n${conflictList}\n\nBitte prüfen Sie die Einteilungen!`;
        }

        alert(message);
        await reloadRoster();
      } else {
        alert(`Import fehlgeschlagen: ${result.message}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ein unbekannter Fehler ist aufgetreten.';
      alert(`Fehler beim Import: ${message}`);
    }
  };

  const handleSyncPastAndFuture = async () => {
    // Versuche jahresspezifische Vorplanungsdatei zu laden
    let rosterImportPath = null;
    try {
      const yearPlanning = await (window as any).api.getYearPlanningForYear?.(year);
      if (yearPlanning?.filePath) {
        rosterImportPath = yearPlanning.filePath;
      }
    } catch (e) {
      // console.warn('Fehler beim Laden der jahresspezifischen Vorplanung:', e);
    }

    // Fallback: alte rosterImportPath Einstellung
    if (!rosterImportPath) {
      rosterImportPath = await (window as any).api.getSetting('rosterImportPath');
    }

    if (!rosterImportPath) {
      alert('Bitte hinterlegen Sie zuerst eine Vorplanungsdatei für das Jahr ' + year + ' in den Einstellungen.');
      return;
    }
    
    const startMonthIndex = currentMonth > 0 ? currentMonth - 1 : 0;
    const endMonthIndex = 11;
    
    const rangeLabel = startMonthIndex === endMonthIndex 
      ? months[startMonthIndex] 
      : `${months[startMonthIndex]} bis ${months[endMonthIndex]}`;
      
    const ok = window.confirm(`Möchten Sie den Dienstplan für den Zeitraum ${rangeLabel} ${year} synchronisieren?\n\nDies führt einen Abgleich (Sync) durch, bei dem leere Zellen in Excel bestehende Einträge im Programm löschen. Manuelle Änderungen werden im Synchronisations-Modus NICHT überschrieben.`);
    if (!ok) return;

    const monthRange = { start: startMonthIndex, end: endMonthIndex };

    try {
      const result = await (window as any).api.importDutyRoster(rosterImportPath, year, monthRange);
      if (result.success) {
        // Check if unknown shift types were found
        if (result.unknownShiftTypes && result.unknownShiftTypes.length > 0) {
          const createNewShiftTypes = window.confirm(
            `Folgende unbekannte Dienstarten wurden gefunden:\n${result.unknownShiftTypes.join('\n')}\n\nMöchten Sie diese als neue Dienstarten anlegen?`
          );

          if (createNewShiftTypes) {
            setPendingImportPath(rosterImportPath);
            setPendingImportYear(year);
            setPendingImportMonth(monthRange);
            setUnknownShiftTypes(result.unknownShiftTypes);
            setShowNewShiftTypeDialog(true);
            return;
          }
        }

        // Check for unknown azubis
        if (result.unknownAzubis && result.unknownAzubis.length > 0) {
          const createNewAzubis = window.confirm(
            `Folgende unbekannte Azubi-Namen wurden gefunden:\n${result.unknownAzubis.join('\n')}\n\nMöchten Sie diese als neue Azubis anlegen?`
          );

          if (createNewAzubis) {
            setPendingImportPath(rosterImportPath);
            setPendingImportYear(year);
            setPendingImportMonth(monthRange);
            setShowNewAzubiDialog(true);
            setUnknownAzubiNames(result.unknownAzubis);
            return;
          }
        }

        // Check for azubis without period
        if (result.azubisWithoutPeriod && result.azubisWithoutPeriod.length > 0) {
          setAzubisWithoutPeriod(result.azubisWithoutPeriod);
          setPendingImportPath(rosterImportPath);
          setPendingImportYear(year);
          setPendingImportMonth(monthRange);
          setShowAzubiPeriodDialog(true);
          return;
        }

        let message = `Synchronisation erfolgreich: ${result.importedCount} Einträge wurden verarbeitet.`;
        
        // Check for availability conflicts
        if (result.availabilityConflicts && result.availabilityConflicts.length > 0) {
          const conflictList = result.availabilityConflicts.map((c: any) => 
            `${c.personName} am ${c.date}: Schichtart "${c.dutyRosterValue}" (nicht verfügbar), aber eingeteilt auf "${c.einteilungValue}"`
          ).join('\n');
          
          message += `\n\n⚠️ WARNUNG: ${result.availabilityConflicts.length} Verfügbarkeitskonflikt(e) gefunden:\n\n${conflictList}\n\nBitte prüfen Sie die Einteilungen!`;
        }
        
        alert(message);
        await reloadRoster();
      } else {
        alert(`Synchronisation fehlgeschlagen: ${result.message}`);
      }
    } catch (error) {
      // console.error('Fehler bei der Synchronisation:', error);
      alert('Fehler bei der Synchronisation.');
    }
  };

  const handleImportTableCancel = () => {
    setShowImportTable(false);
    setImportTableMonth(null);
  };
  const handleImportTableImport = async (data: string[][]) => {
    if (importTableMonth === null) return;
    try {
      // Warnung vor Überschreiben des Monats
      const ok = window.confirm(`Alle Einträge für ${months[importTableMonth]} ${year} werden überschrieben. Fortfahren?`);
      if (!ok) return;
      // Monat säubern
      await (window as any).api.clearDutyRosterMonth(year, importTableMonth);
      const daysInMonth = new Date(year, importTableMonth + 1, 0).getDate();
      const entries: any[] = [];
      for (let row = 0; row < personnel.length; ++row) {
        const person = personnel[row];
        const rowData = data[row] || [];
        for (let col = 0; col < daysInMonth; ++col) {
          const raw = rowData[col] || '';
          const value = raw.trim();
          if (!value) continue;
          // Verwende UTC, um Datum stabil zu halten (kein -1 Tag)
          const dObj = new Date(Date.UTC(year, importTableMonth, col + 1));
          const date = dObj.toISOString().slice(0, 10);
          const type = shiftTypes.some(t => t.code === value) ? 'dropdown' : 'text';
          entries.push({ personId: person.id, personType: 'person', date, value, type });
        }
      }
      if (entries.length) {
        await (window as any).api.bulkSetDutyRoster(entries);
      }
    } catch (e) {
      // console.warn('[DutyRoster] Monatsimport Fehler', e);
    } finally {
      setShowImportTable(false);
      setImportTableMonth(null);
      await reloadRoster();
    }
  };

  // Hilfsfunktion zum Neuladen NUR des Dienstplan-States (Roster)
  // Optional: Jahr überschreiben, sonst aktuellen State-Wert verwenden
  const reloadRoster = async (yearOverride?: number) => {
    const list = await (window as any).api.getPersonnelList();
    const azubiList = await (window as any).api.getAzubiList();
    const allPeriods = await (window as any).api.getAllAzubiPeriods();
    const allQualPeriods = await (window as any).api.getAllQualificationPeriods();

    // Filtere Personal: Nur Personen MIT Rettungsdienst-Qualifikation
    const rettungsdienstQualName = 'Rettungsdienst';
    const periodsByPerson: Record<number, any[]> = {};
    if (Array.isArray(allQualPeriods)) {
      allQualPeriods.forEach((p: any) => {
        if (!periodsByPerson[p.personId]) periodsByPerson[p.personId] = [];
        periodsByPerson[p.personId].push(p);
      });
    }

    const filteredPersonnel = (list || []).filter((p: any) => {
      const pPeriods = periodsByPerson[p.id] || [];
      const rdPeriods = pPeriods.filter((per: any) => per.qualType === rettungsdienstQualName && per.active);
      return rdPeriods.length > 0;
    });

    setPersonnel(filteredPersonnel);
    setAzubis(azubiList);
    setAzubiPeriods(allPeriods);
    // Hole Dienstplan-Einträge für das lokal ausgewählte Jahr (nicht globales Setting)
    const yUse = typeof yearOverride === 'number' ? yearOverride : year;
    const entries = await (window as any).api.getDutyRoster(yUse);
    // console.log('[Renderer] reloadRoster getDutyRoster fetched', Array.isArray(entries) ? entries.length : typeof entries, 'entries');
    if (Array.isArray(entries) && entries.length > 0) {
      // console.log('[Renderer] reloadRoster sample entry[0]=', entries[0]);
    }
    // ITW-Tage neu berechnen (mind. ein ITW-Dienst am Tag)
    try {
      const itwSet = new Set<string>();
      (entries || []).forEach((e: any) => {
        if (!e || !e.date) return;
        const t = String(e.type || '');
        const raw = String(e.value || '').trim();
        if (t.startsWith('itw_')) itwSet.add(String(e.date));
        else if (raw && (auswertungByType[raw] === 'itw')) itwSet.add(String(e.date));
      });
      setItwDates(itwSet);
    } catch { }
    // IDs für Mapping IMMER aus aktuellem State
    const personalIds = new Set(list.map((p: { id: number }) => p.id));
    const azubiIds = new Set(azubiList.map((a: { id: number }) => a.id));
    const rosterObj: Record<string, Record<string, { value: string, type: string, manualEdit?: boolean }>> = {};
    entries.forEach((entry: any) => {
      const iso = String(entry.date);
      if (iso) {
        // Normalize type: if value matches a known shift code, prefer dropdown
        try {
          const existingType = String(entry.type || '');
          const isSlot = /^(rtw|nef|itw)/.test(existingType);
          if (!isSlot) {
            if (entry && entry.value) {
              const code = String(entry.value).trim();
              if (shiftTypes && Array.isArray(shiftTypes) && shiftTypes.some((t: any) => t.code === code)) {
                entry.type = 'dropdown';
              } else {
                entry.type = 'text';
              }
            } else {
              entry.type = existingType || 'text';
            }
          }
        } catch (e) { /* ignore */ }
        let key = '';
        if (entry.personType === 'person' && personalIds.has(entry.personId)) {
          key = `p_${entry.personId}`;
        } else if (entry.personType === 'azubi' && azubiIds.has(entry.personId)) {
          key = `a_${entry.personId}`;
        } else {
          key = String(entry.personId);
        }
        if (!rosterObj[key]) rosterObj[key] = {};
        rosterObj[key][iso] = { value: entry.value, type: String(entry.type || ''), manualEdit: !!entry.manual_edit };
      }
    });
    // console.log('[Renderer] reloadRoster constructed rosterObj keys=', Object.keys(rosterObj).slice(0,20), 'total=', Object.keys(rosterObj).length);

    // Force React re-render durch Erstellen eines neuen Objekts
    setRoster({ ...rosterObj });
    // Zusätzlicher Force-Update
    setUpdateCounter(prev => prev + 1);
  };

  // Roster und Feiertage neu laden, wenn das lokale Jahr gewechselt wird
  useEffect(() => {
    (async () => {
      try {
        await reloadRoster(year);
      } catch (e) { console.warn('[DutyRoster] reloadRoster on year change failed', e); }
      try {
        const hlist = await (window as any).api.getHolidaysForYear?.(year);
        const set = new Set<string>((hlist || []).map((h: any) => String(h.date)));
        setHolidays(set);
      } catch (e) { console.warn('[DutyRoster] load holidays on year change failed', e); }
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
        setRtwActs(map);
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
        setNefActs(map);
      } catch { }
      // Freigabe-Status laden bei Jahreswechsel
      try {
        const status = await Promise.all(Array(12).fill(0).map(async (_, i) => {
          const key = `roster_released_${year}_${i}`;
          const val = await (window as any).api.getSetting(key);
          return val === '1';
        }));
        setReleasedMonths(status);
      } catch (e) { console.warn('Failed to load released status', e); }
    })();
  }, [year]);

  // KPI-Hilfswerte für aktuellen Monat berechnen
  // console.log('[DEBUG] KPI calculation start, roster keys:', Object.keys(roster).length, 'personnel:', personnel.length, 'filteredAzubis:', filteredAzubis.length);
  const monthIndex = currentMonth;
  const deptShiftsInMonth = (() => {
    let cnt = 0;
    for (const d of days) {
      const iso = d.iso;
      const seqs = [...(deptPatternSeqs || [])].sort((a, b) => a.startDate.localeCompare(b.startDate));
      let active = seqs[0];
      for (const s of seqs) { if (s.startDate <= iso) active = s; else break; }
      const start = new Date((active?.startDate || '1970-01-01') + 'T00:00:00Z');
      const cur = new Date(iso + 'T00:00:00Z');
      const diffDays = Math.floor((cur.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      const pat = active?.pattern || [];
      const depDay = pat.length ? pat[((diffDays % 21) + 21) % 21] : '';
      if (depDay && String(department) === depDay) cnt++;
    }
    return cnt;
  })();

  const activeRtwCount = (rtwVehicles || []).filter(v => (rtwActs[v.id] ?? Array(12).fill(true))[monthIndex] !== false).length;
  const activeNefCount = (nefVehicles || []).filter(v => (nefActs[v.id] ?? Array(12).fill(true))[monthIndex] !== false).length;

  const itwShiftsInMonth = (() => {
    let sum = 0;
    for (const key of Object.keys(roster || {})) {
      for (const d of days) {
        const cell = roster[key]?.[d.iso];
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
    const azubiIdSet = new Set(filteredAzubis.map(a => a.id));
    for (const a of filteredAzubis) {
      const key = `a_${a.id}`;
      for (const d of days) {
        const t = String(roster[key]?.[d.iso]?.type || '');
        if (reMasch.test(t)) sum++;
      }
    }
    return sum;
  })();

  const positionsAdjInMonth = Math.max(0, deptShiftsInMonth * (activeRtwCount * 4 + activeNefCount * 2) + itwShiftsInMonth - azubiMaschinistShiftsInMonth);

  const activePersonnelInMonth = (() => {
    // Gewichtete Personalanzahl: Personen mit mind. 1 Präsenz-Tag zählen,
    // HLF‑B werden mit 0,75 gewichtet
    let sum = 0;
    for (const p of personnel) {
      const key = `p_${p.id}`;
      let presence = 0;
      for (const d of days) {
        const raw = String(roster[key]?.[d.iso]?.value || '').trim();
        if (raw && (auswertungByType[raw] || 'off') !== 'off') {
          presence++;
        }
      }
      if (presence > 0) {
        const hasHLFB = (p as any).fahrzeugfuehrerHLFB === 1;
        sum += hasHLFB ? 0.75 : 1;
      }
    }
    // console.log('[DEBUG] activePersonnelInMonth:', sum, 'from', personnel.length, 'personnel');
    return sum;
  })();

  const shiftsPerPersonInMonth = activePersonnelInMonth > 0 ? positionsAdjInMonth / activePersonnelInMonth : 0;

  // Präsenz je Person im Monat: Anzahl Tage mit Auswertung ≠ 'off' (tag|nacht|24h|itw)
  const perPersonPresenceInMonth: Record<string, number> = (() => {
    const map: Record<string, number> = {};
    for (const p of personnel) {
      const key = `p_${p.id}`;
      let presence = 0;
      for (const d of days) {
        const raw = String(roster[key]?.[d.iso]?.value || '').trim();
        if (raw && (auswertungByType[raw] || 'off') !== 'off') presence++;
      }
      map[key] = presence;
    }
    return map;
  })();

  // 24h + ITW je Person im Monat (bestehend)
  const perPersonCombinedInMonth: Record<string, number> = (() => {
    const map: Record<string, number> = {};
    for (const p of personnel) {
      const key = `p_${p.id}`;
      let c24 = 0, cItw = 0;
      for (const d of days) {
        const raw = String(roster[key]?.[d.iso]?.value || '').trim();
        if (raw && auswertungByType[raw] === '24h') c24++;
        const t = String(roster[key]?.[d.iso]?.type || '');
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

  // Mittelwert Präsenz (tage mit Auswertung ≠ off) je Monat – nur >0
  const avgPresenceInMonth = (() => {
    const vals = Object.values(perPersonPresenceInMonth).filter(v => v > 0);
    if (vals.length === 0) return 0;
    const sum = vals.reduce((a, b) => a + b, 0);
    return Math.round(sum / vals.length);
  })();

  // Handler für Zellenbearbeitung
  const startEdit = (personId: string, dayIdx: number) => {
    if (!canWrite) return;
    setEditing(prev => ({
      ...prev,
      [personId]: { ...prev[personId], [dayIdx]: true }
    }));
  };

  const stopEdit = (personId: string, dayIdx: number) => {
    setEditing(prev => ({
      ...prev,
      [personId]: { ...prev[personId], [dayIdx]: false }
    }));
  };

  const handleCellChange = async (personId: string, dayIdx: number, value: string, type: string) => {
    // setRoster entfernt, da reloadRoster die Daten korrekt lädt
    let origId: number | null = null;
    let personType = 'person';
    if (personId.startsWith('p_')) {
      origId = parseInt(personId.slice(2), 10);
      personType = 'person';
    } else if (personId.startsWith('a_')) {
      origId = parseInt(personId.slice(2), 10);
      personType = 'azubi';
    }
    // ISO-Datum aus der Monatsansicht
    const date = days[dayIdx]?.iso;
    if (dayIdx === 0) {
      // console.log('[DEBUG] 1.1. Eintrag:', { personId, origId, personType, date, value, type });
    }

    // VERFÜGBARKEITSPRÜFUNG: Ist die Person auf einem Fahrzeug eingeteilt, aber als nicht verfügbar markiert?
    if (value && value.trim() !== '' && origId) {
      try {
        // Hole cellType aus dem aktuellen roster-Eintrag (z.B. "rtw1_tag_1")
        const cellType = roster[personId]?.[date]?.type || undefined;

        // Prüfe nur, wenn Person auf Fahrzeug eingeteilt ist
        if (cellType && (cellType.startsWith('rtw') || cellType.startsWith('nef') || cellType.startsWith('itw'))) {
          console.log('[DutyRoster] Verfügbarkeitsprüfung: Person ist auf Fahrzeug eingeteilt:', { cellType, value });

          // Prüfe, ob die neue Dienstart "nicht verfügbar" bedeutet
          const shiftTypes = await (window as any).api.getShiftTypes();
          const shiftType = shiftTypes.find((st: any) => st.code === value);

          if (shiftType) {
            const auswertung = await (window as any).api.getSetting(`auswertung_${shiftType.code}`);

            console.log('[DutyRoster] Dienstart Auswertung:', { code: shiftType.code, auswertung });

            // 'off' = nicht verfügbar (Urlaub, Krank, Frei, etc.)
            if (!auswertung || auswertung === 'off') {
              const confirmChange = confirm(
                `⚠️ WARNUNG: Verfügbarkeitskonflikt!\n\n` +
                `Person ist auf "${cellType}" eingeteilt, aber Dienstart "${value}" bedeutet "nicht verfügbar".\n\n` +
                `Möchten Sie die Änderung trotzdem durchführen?\n\n` +
                `Hinweis: Dies könnte zu Besetzungsproblemen führen.`
              );

              if (!confirmChange) {
                return; // Abbruch der Änderung
              }
            }
          }
        }
      } catch (err) {
        console.error('Fehler bei Verfügbarkeitsprüfung:', err);
        // Bei Validierungsfehlern trotzdem fortfahren
      }
    }

    const entry = { personId: origId, personType, date, value, type };
    // console.log('[Renderer] setDutyRosterEntry SEND', entry);
    try {
      await (window as any).api.setDutyRosterEntry(entry);
      // console.log('[Renderer] setDutyRosterEntry OK', entry);
      // console.log('[Renderer] handleCellChange triggering reloadRoster...');
      await reloadRoster();
      // console.log('[Renderer] handleCellChange reloadRoster completed');
    } catch (err) {
      // console.error('[Renderer] setDutyRosterEntry ERROR', err, entry);
    }
  };

  // Auto-scroll zum aktiven Monat beim Laden
  useEffect(() => {
    if (monthButtonsRef.current[currentMonth]) {
      setTimeout(() => {
        monthButtonsRef.current[currentMonth]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }, 100);
    }
  }, [currentMonth]);

  return (
    <div className="page-container" style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxSizing: 'border-box' }}>
      {/* Header-Bereich mit fester Größe */}
      <div style={{ flexShrink: 0 }}>
        {/* Überschrift - ROT */}
        <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h2 style={{ margin: 0, marginRight: 'auto' }}>Dienstplan</h2>
        </div>
        {/* Monats-Tabs - GRÜN */}
        <div style={{ 
          display: 'flex', 
          gap: 24, 
          alignItems: 'center', 
          marginTop: 8,
          marginBottom: 0, 
          paddingTop: 4,
          paddingBottom: 4,
          flexWrap: 'wrap',
          borderBottom: '1px solid var(--line)'
        }}>
          {/* Jahresumschalter direkt bei den Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 500 }}>Jahr:</span>
            <select
              value={year}
              disabled={!canWrite}
              onChange={e => setYear(Number(e.target.value))}
              style={{
                padding: '4px 8px',
                fontSize: 13,
                borderRadius: 6,
                border: '1px solid #ddd',
                background: '#fff',
                cursor: 'pointer',
                color: 'var(--text)'
              }}
            >
              {yearPlannings.length > 0 ? (
                yearPlannings.map(yp => (
                  <option key={yp.year} value={yp.year}>{yp.year}</option>
                ))
              ) : (
                <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
              )}
            </select>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
            <button 
              onClick={handleImport} 
              disabled={!canWrite}
              title="Importiert den aktuellen Monat aus der Excel-Vorplanung"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                background: 'transparent',
                border: 'none',
                borderBottom: '3px solid transparent',
                fontSize: '14px',
                fontWeight: 500,
                color: '#6b7280',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                if (!canWrite) return;
                e.currentTarget.style.color = 'var(--text)';
                e.currentTarget.style.borderBottomColor = 'var(--accent)';
                e.currentTarget.style.background = '#f8f9fa';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#6b7280';
                e.currentTarget.style.borderBottomColor = 'transparent';
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <svg aria-hidden width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Import Monat
            </button>
            
            <button 
              onClick={handleSyncPastAndFuture} 
              disabled={!canWrite}
              title="Abgleich des Vormonats und des restlichen Jahres (Sync-Modus)"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                background: 'transparent',
                border: 'none',
                borderBottom: '3px solid transparent',
                fontSize: '14px',
                fontWeight: 500,
                color: '#6b7280',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                if (!canWrite) return;
                e.currentTarget.style.color = 'var(--text)';
                e.currentTarget.style.borderBottomColor = 'var(--accent)';
                e.currentTarget.style.background = '#f8f9fa';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#6b7280';
                e.currentTarget.style.borderBottomColor = 'transparent';
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <svg aria-hidden width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M21 2v6h-6" />
                <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                <path d="M3 22v-6h6" />
                <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
              </svg>
              Sync (Monat zurück + Rest-Jahr)
            </button>
          </div>
        </div>

        {/* Monats-Tabs - GRÜN */}
        <div className="tab-navigation tab-navigation-with-header" style={{
          background: 'var(--bg)',
          paddingTop: '8px',
          paddingBottom: '8px',
          display: 'flex',
          gap: '4px',
          borderBottom: '1px solid var(--line)',
          marginBottom: '8px',
          flexWrap: 'wrap'
        }}>
          {months.map((m, i) => (
            <button
              key={i}
              ref={el => monthButtonsRef.current[i] = el}
              onClick={() => setCurrentMonth(i)}
              style={{
                padding: '8px 16px',
                background: currentMonth === i ? '#f8f9fa' : 'transparent',
                border: 'none',
                borderBottom: currentMonth === i ? '3px solid #0ea5e9' : '3px solid transparent',
                cursor: 'pointer',
                fontWeight: currentMonth === i ? 600 : 400,
                color: currentMonth === i ? '#0ea5e9' : '#6b7280',
                transition: 'all 0.2s',
                fontSize: '14px'
              }}
              onMouseEnter={(e) => {
                if (currentMonth !== i) {
                  e.currentTarget.style.background = 'var(--hover)';
                  e.currentTarget.style.color = 'var(--text)';
                }
              }}
              onMouseLeave={(e) => {
                if (currentMonth !== i) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--muted)';
                }
              }}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
      {/* Table Wrapper für Scroll-Synchronisation */}
      <div
        id="table-wrapper"
        style={{
          overflowX: 'auto',
          overflowY: 'auto',
          flex: 1,
          minHeight: 0,
          position: 'relative',
          border: '1px solid #d6e4ff',
          borderRadius: 10,
          background: '#ffffff',
          boxSizing: 'border-box'
        }}
        onScroll={(e) => {
          const bottomScroller = document.getElementById('bottom-scroller');
          if (bottomScroller) {
            bottomScroller.scrollLeft = e.currentTarget.scrollLeft;
          }
        }}
      >
        <style>{`
          #table-wrapper::-webkit-scrollbar {
            height: 0px;
          }
          #table-wrapper::-webkit-scrollbar-thumb {
            background: transparent;
          }
        `}</style>
        {/* Alle Monate sichtbar lassen, damit Kommentare auch in nicht freigegebenen Monaten möglich sind */}
        {false ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: 'var(--muted)',
            background: 'var(--hover)',
            minHeight: '400px'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
            <div style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Dienstplan noch nicht freigegeben</div>
            <div style={{ fontSize: '14px' }}>Der Dienstplan für diesen Monat ist derzeit nur für Administratoren sichtbar.</div>
          </div>
        ) : (
          <table style={{ borderCollapse: 'separate', borderSpacing: 0, minWidth: Math.max(800, days.length * 40), background: '#ffffff' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 5, background: '#f8fbff', boxShadow: '0 1px 0 0 #dbe7ff' }}>
              <tr>
                <th style={{ position: 'sticky', left: 0, background: '#f8fbff', zIndex: 6, borderBottom: '1px solid #dbe7ff', borderRight: '1px solid #dbe7ff', minWidth: nameColWidth }}>{'Name'}</th>
                <th style={{ borderBottom: '1px solid #dbe7ff', minWidth: 40, whiteSpace: 'nowrap', background: '#f8fbff' }}>24h</th>
                <th style={{ borderBottom: '1px solid #dbe7ff', minWidth: 40, whiteSpace: 'nowrap', background: '#f8fbff' }}>IW</th>
                {days.map((d, i) => {
                  const gComment = globalComments.get(d.iso);
                  return (
                    <th
                      key={i}
                      onContextMenu={(e) => openGlobalCommentMenu(e, d.iso)}
                      title={gComment?.comment || ''}
                      style={{ borderBottom: '1px solid #dbe7ff', whiteSpace: 'nowrap', background: '#f8fbff', position: 'relative', cursor: canWriteGlobalComments ? 'context-menu' : 'default' }}
                    >
                      {d.date}
                      {gComment && (
                        <span
                          style={{
                            position: 'absolute',
                            top: 0,
                            right: 0,
                            width: 0,
                            height: 0,
                            borderTop: '9px solid #dc2626',
                            borderLeft: '9px solid transparent'
                          }}
                        />
                      )}
                    </th>
                  );
                })}
              </tr>
              <tr>
                <th style={{ position: 'sticky', left: 0, background: '#f8fbff', zIndex: 6, borderBottom: '1px solid #dbe7ff', borderRight: '1px solid #dbe7ff', minWidth: nameColWidth, fontWeight: 'normal', color: 'var(--text)', fontSize: 13 }}>
                  Abteilung: {department}
                </th>
                <th style={{ borderBottom: '1px solid #dbe7ff', background: '#f8fbff' }}> </th>
                <th style={{ borderBottom: '1px solid #dbe7ff', background: '#f8fbff' }}> </th>
                {days.map((d, i) => (
                  <th key={i} style={{ borderBottom: '1px solid #dbe7ff', whiteSpace: 'nowrap', background: '#f8fbff' }}>{d.weekday}</th>
                ))}
              </tr>
              <tr>
                <th style={{ position: 'sticky', left: 0, background: '#f8fbff', zIndex: 6, borderBottom: '1px solid #dbe7ff', borderRight: '1px solid #dbe7ff', minWidth: nameColWidth, fontWeight: 'normal', color: 'var(--muted)', fontSize: 13 }}>Schichtfolge</th>
                <th style={{ borderBottom: '1px solid #dbe7ff', background: '#f8fbff' }} />
                <th style={{ borderBottom: '1px solid #dbe7ff', background: '#f8fbff' }} />
                {days.map((d, i) => {
                  // Dept day via deptPatternSeqs gültig-ab + 21er Modulo
                  const iso = d.iso;
                  const seqs = [...(deptPatternSeqs || [])].sort((a, b) => a.startDate.localeCompare(b.startDate));
                  let active = seqs[0];
                  for (const s of seqs) { if (s.startDate <= iso) active = s; else break; }
                  const start = new Date((active?.startDate || '1970-01-01') + 'T00:00:00Z');
                  const cur = new Date(iso + 'T00:00:00Z');
                  const diffDays = Math.floor((cur.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                  const pat = active?.pattern || [];
                  const depDay = pat.length ? pat[((diffDays % 21) + 21) % 21] : '';
                  const depDayStyle = depDay === '1'
                    ? { background: '#fff1f2', color: '#b91c1c' }
                    : depDay === '2'
                      ? { background: '#eff6ff', color: '#1d4ed8' }
                      : depDay === '3'
                        ? { background: '#f0fdf4', color: '#15803d' }
                        : {};
                  return (
                    <th key={i} style={{ borderBottom: '1px solid #dbe7ff', fontWeight: 'normal', color: depDay ? (depDayStyle as any).color : 'var(--muted)', fontSize: 13, background: depDay ? (depDayStyle as any).background : '#f8fbff' }}>
                      {depDay}
                    </th>
                  );
                })}
              </tr>
              {itwEnabled && (
                <>
                  <tr>
                    <th style={{ position: 'sticky', left: 0, background: '#f8fbff', zIndex: 6, borderBottom: '1px solid #dbe7ff', borderRight: '1px solid #dbe7ff', minWidth: nameColWidth, fontWeight: 'normal', color: 'var(--muted)', fontSize: 13 }}>ITW</th>
                    <th style={{ borderBottom: '1px solid #dbe7ff', background: '#f8fbff' }} />
                    <th style={{ borderBottom: '1px solid #dbe7ff', background: '#f8fbff' }} />
                    {days.map((_, i) => {
                      const showIW = isIwDay(i);
                      return (
                        <th key={`itw_${i}`} style={{ borderBottom: '1px solid #dbe7ff', fontWeight: 'normal', color: 'var(--muted)', fontSize: 13, background: '#f8fbff' }}>
                          {showIW ? 'IW' : ''}
                        </th>
                      );
                    })}
                  </tr>
                </>
              )}
            </thead>
            <tbody>
              {allRows.map((person, rowIdx) => {
                // Trennzeile vor dem ersten Azubi
                const isFirstAzubi = person.isAzubi && (rowIdx === 0 || !allRows[rowIdx - 1].isAzubi);
                return [
                  isFirstAzubi ? (
                    <tr key="azubi-separator">
                      <td colSpan={days.length + 3} style={{ background: '#eef5ff', fontWeight: 'bold', textAlign: 'left', borderBottom: '1px solid #dbe7ff' }}>
                        Azubis
                      </td>
                    </tr>
                  ) : null,
                  (
                    <tr key={person.id} style={{ background: rowIdx % 2 === 1 ? '#f5f9ff' : '#ffffff' }}>
                      <td style={{ position: 'sticky', left: 0, background: rowIdx % 2 === 1 ? '#f5f9ff' : '#ffffff', zIndex: 1, borderBottom: '1px solid #e4edff', borderRight: '1px solid #dbe7ff', fontStyle: person.isAzubi ? 'italic' : undefined, color: (!person.isAzubi && !!(personnel.find(p => p.id === person.origId)?.fahrzeugfuehrerHLFB)) ? '#1565c0' : undefined }}>
                        {person.name}{person.isAzubi && person.lehrjahr !== undefined ? ` (Azubi, ${person.lehrjahr}. Lj.)` : ''}
                      </td>
                      <td style={{ borderBottom: '1px solid #e4edff', textAlign: 'center', minWidth: 30 }}>
                        {!person.isAzubi ? (
                          (() => {
                            const key = getStateKey(person);
                            let count = 0;
                            for (const d of days) {
                              const raw = (roster[key]?.[d.iso]?.value || '').trim();
                              if (!raw) continue;
                              // Zähle nur, wenn der Code als 24h ausgewertet wird
                              if (auswertungByType[raw] === '24h') count++;
                            }
                            return count;
                          })()
                        ) : ''}
                      </td>
                      <td style={{ borderBottom: '1px solid #e4edff', textAlign: 'center', minWidth: 40 }}>
                        {!person.isAzubi ? (
                          (() => {
                            const key = getStateKey(person);
                            let count = 0;
                            for (const d of days) {
                              const t = String(roster[key]?.[d.iso]?.type || '');
                              const raw = (roster[key]?.[d.iso]?.value || '').trim();
                              if (t.startsWith('itw_') || (raw && auswertungByType[raw] === 'itw')) count++;
                            }
                            return count;
                          })()
                        ) : ''}
                      </td>
                      {days.map((_, dayIdx) => {
                        const iso = days[dayIdx]?.iso;
                        const cell = roster[getStateKey(person)]?.[iso] || { value: '', type: 'dropdown' };
                        const isEditing = editing[getStateKey(person)]?.[dayIdx];
                        const personalComment = !person.isAzubi ? personalComments.get(getPersonalCommentKey(person.origId, iso)) : undefined;
                        const code = (cell.value || '').trim();
                        const hex = colorByType[code] || '';
                        const bgTint = hex ? hexToRgba(hex, 0.2) : undefined; // sanfter Hintergrund
                        const isManualEdit = cell.manualEdit;

                        // Debug: Log wenn manuelle Bearbeitung erkannt wird
                        if (isManualEdit && code) {
                          // console.log('[DEBUG] Rendering manual edit:', { person: person.name, dayIdx, iso, code, isManualEdit, cell });
                        }
                        const cellStyle = {
                          minWidth: 40,
                          cursor: canWrite ? 'pointer' : 'default',
                          borderBottom: '1px solid #e4edff',
                          whiteSpace: 'nowrap',
                          position: 'relative' as const,
                          background: bgTint,
                          ...(isManualEdit ? { borderLeft: '4px solid #1976d2' } : {})
                        };
                        return (
                          <td key={dayIdx} style={cellStyle}
                            onContextMenu={(e) => {
                              if (person.isAzubi || !iso) return;
                              openPersonalCommentMenu(e, person.origId, iso);
                            }}
                            title={personalComment?.comment || ''}
                            onClick={() => {
                              if (!canWrite) return;
                              if (!isEditing) {
                                // console.log('[DEBUG] Zellenklick:', { dayIdx, iso: days[dayIdx].iso, date: days[dayIdx].date });
                                startEdit(getStateKey(person), dayIdx);
                              }
                            }}>
                            {isEditing ? (
                              (
                                <select
                                  autoFocus
                                  value={cell.value}
                                  disabled={!canWrite}
                                  onBlur={() => stopEdit(getStateKey(person), dayIdx)}
                                  onChange={e => {
                                    handleCellChange(getStateKey(person), dayIdx, e.target.value, 'dropdown');
                                    stopEdit(getStateKey(person), dayIdx);
                                  }}
                                >
                                  <option value="">-</option>
                                  {shiftTypes.map(type => (
                                    <option key={type.id} value={type.code}>{type.code}</option>
                                  ))}
                                  {customDropdownValues.map((v, idx) => (
                                    <option key={`custom_${idx}`} value={v}>{v}</option>
                                  ))}
                                </select>
                              )
                            ) : (
                              <span style={{ color: cell.value ? undefined : 'var(--muted)' }}>
                                {cell.value || <i>–</i>}
                              </span>
                            )}
                            {personalComment && (
                              <span
                                style={{
                                  position: 'absolute',
                                  top: 0,
                                  right: 0,
                                  width: 0,
                                  height: 0,
                                  borderTop: '9px solid #dc2626',
                                  borderLeft: '9px solid transparent'
                                }}
                              />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  )
                ];
              })}
            </tbody>
          </table>
        )}
      </div>
      {/* Tabellen 'Diensttage Abteilung 1 (2025)' entfernt */}
      {showImportTable && importTableMonth !== null && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.3)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <ImportTable
            month={importTableMonth}
            year={year}
            personnel={[
              ...personnel.map(p => ({ id: `p_${p.id}`, name: p.name, vorname: p.vorname, isAzubi: false })),
              ...filteredAzubis.map(a => ({ id: `a_${a.id}`, name: a.name, vorname: a.vorname, isAzubi: true, lehrjahr: a.lehrjahr }))
            ]}
            onImport={handleImportTableImport}
            onCancel={handleImportTableCancel}
          />
        </div>
      )}

      {/* New Azubi Dialog */}
      {showNewAzubiDialog && (
        <NewAzubiDialog
          unknownNames={unknownAzubiNames}
          onConfirm={handleCreateNewAzubis}
          onCancel={handleCancelNewAzubis}
        />
      )}

      {/* New ShiftType Dialog */}
      {showNewShiftTypeDialog && (
        <NewShiftTypeDialog
          unknownShiftTypes={unknownShiftTypes}
          onConfirm={handleCreateNewShiftTypes}
          onCancel={handleCancelNewShiftTypes}
        />
      )}

      {/* Azubi Period Dialog */}
      {showAzubiPeriodDialog && (
        <AzubiPeriodDialog
          azubisWithoutPeriod={azubisWithoutPeriod}
          onConfirm={handleAdjustAzubiPeriods}
          onCancel={handleCancelAzubiPeriodDialog}
        />
      )}

      {/* Version/Build Anzeige entfernt */}

      {commentMenu && (
        <div
          style={{
            position: 'fixed',
            top: commentMenu.y,
            left: commentMenu.x,
            zIndex: 3000,
            minWidth: 240,
            background: '#fff',
            border: '1px solid #d1d5db',
            borderRadius: 8,
            boxShadow: '0 10px 24px rgba(0,0,0,0.15)',
            overflow: 'hidden'
          }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          {commentMenu.scope === 'global' ? (
            <>
              <button
                style={{ width: '100%', textAlign: 'left', padding: '9px 12px', background: '#fff', border: 'none', cursor: 'pointer' }}
                onClick={() => {
                  setCommentEditor({ scope: 'global', dateIso: commentMenu.dateIso });
                  setCommentMenu(null);
                }}
              >
                {globalComments.has(commentMenu.dateIso) ? 'Globalen Kommentar bearbeiten' : 'Globalen Kommentar hinzufügen'}
              </button>
              <button
                disabled={!globalComments.has(commentMenu.dateIso)}
                style={{ width: '100%', textAlign: 'left', padding: '9px 12px', background: '#fff', border: 'none', cursor: globalComments.has(commentMenu.dateIso) ? 'pointer' : 'not-allowed', color: globalComments.has(commentMenu.dateIso) ? '#dc2626' : '#9ca3af' }}
                onClick={async () => {
                  await handleDeleteGlobalComment(commentMenu.dateIso);
                  setCommentMenu(null);
                }}
              >
                Globalen Kommentar löschen
              </button>
            </>
          ) : (
            <>
              <button
                style={{ width: '100%', textAlign: 'left', padding: '9px 12px', background: '#fff', border: 'none', cursor: 'pointer' }}
                onClick={() => {
                  if (typeof commentMenu.personId === 'number') {
                    setCommentEditor({ scope: 'personal', dateIso: commentMenu.dateIso, personId: commentMenu.personId });
                  }
                  setCommentMenu(null);
                }}
              >
                {typeof commentMenu.personId === 'number' && personalComments.has(getPersonalCommentKey(commentMenu.personId, commentMenu.dateIso))
                  ? 'Individuellen Kommentar bearbeiten'
                  : 'Individuellen Kommentar hinzufügen'}
              </button>
              <button
                disabled={!(typeof commentMenu.personId === 'number' && personalComments.has(getPersonalCommentKey(commentMenu.personId, commentMenu.dateIso)))}
                style={{ width: '100%', textAlign: 'left', padding: '9px 12px', background: '#fff', border: 'none', cursor: (typeof commentMenu.personId === 'number' && personalComments.has(getPersonalCommentKey(commentMenu.personId, commentMenu.dateIso))) ? 'pointer' : 'not-allowed', color: (typeof commentMenu.personId === 'number' && personalComments.has(getPersonalCommentKey(commentMenu.personId, commentMenu.dateIso))) ? '#dc2626' : '#9ca3af' }}
                onClick={async () => {
                  if (typeof commentMenu.personId === 'number') {
                    await handleDeletePersonalComment(commentMenu.personId, commentMenu.dateIso);
                  }
                  setCommentMenu(null);
                }}
              >
                Individuellen Kommentar löschen
              </button>
            </>
          )}
        </div>
      )}

      {commentEditor && (
        <CommentDialog
          type={commentEditor.scope === 'global' ? 'global' : 'personal'}
          personName={commentEditor.scope === 'personal' && typeof commentEditor.personId === 'number'
            ? `${personnel.find(p => p.id === commentEditor.personId)?.vorname || ''} ${personnel.find(p => p.id === commentEditor.personId)?.name || ''}`.trim()
            : undefined}
          date={commentEditor.dateIso}
          existingComment={commentEditor.scope === 'global'
            ? (globalComments.get(commentEditor.dateIso)?.comment || '')
            : (typeof commentEditor.personId === 'number'
              ? (personalComments.get(getPersonalCommentKey(commentEditor.personId, commentEditor.dateIso))?.comment || '')
              : '')}
          canEdit={commentEditor.scope === 'global' ? canWriteGlobalComments : canWritePersonalComments}
          canDelete={commentEditor.scope === 'global' ? canWriteGlobalComments : canWritePersonalComments}
          onSave={async (comment) => {
            if (commentEditor.scope === 'global') {
              await handleUpsertGlobalComment(commentEditor.dateIso, comment);
            } else if (typeof commentEditor.personId === 'number') {
              await handleUpsertPersonalComment(commentEditor.personId, commentEditor.dateIso, comment);
            }
            setCommentEditor(null);
          }}
          onDelete={async () => {
            if (commentEditor.scope === 'global') {
              await handleDeleteGlobalComment(commentEditor.dateIso, true);
            } else if (typeof commentEditor.personId === 'number') {
              await handleDeletePersonalComment(commentEditor.personId, commentEditor.dateIso, true);
            }
            setCommentEditor(null);
          }}
          onClose={() => setCommentEditor(null)}
        />
      )}

      {/* Fixierter horizontaler Scrollbalken unten */}
      <div
        id="footer-scroller-container"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 'var(--sidebar-offset, 200px)',
          right: 0,
          height: '40px',
          background: 'var(--bg)',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          paddingLeft: 24,
          paddingRight: 24,
          boxSizing: 'border-box'
        }}
      >
        {/* Horizontaler Trenner über dem Scrollbalken */}
        <div style={{ width: '100%', borderTop: '1px solid var(--line)' }}></div>
        
        <div
          id="bottom-scroller"
          style={{
            width: '100%',
            height: '24px',
            overflowX: 'auto',
            overflowY: 'hidden',
            marginTop: '2px'
          }}
          onScroll={(e) => {
            const tableWrapper = document.getElementById('table-wrapper');
            if (tableWrapper) {
              tableWrapper.scrollLeft = e.currentTarget.scrollLeft;
            }
          }}
        >
          <div style={{ width: Math.max(800, (days.length + 3) * 40 + nameColWidth), height: '1px' }}></div>
        </div>
      </div>
    </div>
  );
};

// New ShiftType Dialog Component
interface NewShiftTypeDialogProps {
  unknownShiftTypes: string[];
  onConfirm: (shiftTypes: Array<{ code: string, description: string, color: string, auswertung: string }>) => void;
  onCancel: () => void;
}

const NewShiftTypeDialog: React.FC<NewShiftTypeDialogProps> = ({ unknownShiftTypes, onConfirm, onCancel }) => {
  const [shiftTypeData, setShiftTypeData] = useState<Array<{ code: string, description: string, color: string, auswertung: string }>>(() => {
    return unknownShiftTypes.map(code => ({
      code: code,
      description: code, // Default description is the code itself
      color: '#cccccc', // Default gray color
      auswertung: 'off' // Default: no counting
    }));
  });

  const handleDescriptionChange = (index: number, value: string) => {
    const newData = [...shiftTypeData];
    newData[index].description = value;
    setShiftTypeData(newData);
  };

  const handleColorChange = (index: number, value: string) => {
    const newData = [...shiftTypeData];
    newData[index].color = value;
    setShiftTypeData(newData);
  };

  const handleAuswertungChange = (index: number, value: string) => {
    const newData = [...shiftTypeData];
    newData[index].auswertung = value;
    setShiftTypeData(newData);
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        background: 'white', padding: '20px', borderRadius: '8px', minWidth: '600px', maxWidth: '800px', maxHeight: '80vh', overflow: 'auto'
      }}>
        <h3>Neue Dienstarten anlegen</h3>
        <p>Folgende unbekannte Dienstarten wurden gefunden:</p>

        {shiftTypeData.map((shiftType, index) => (
          <div key={index} style={{ marginBottom: '20px', border: '1px solid #ddd', padding: '15px', borderRadius: '4px' }}>
            <div><strong>Code:</strong> {shiftType.code}</div>

            <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'center' }}>
              <div>
                <label>Bezeichnung: </label>
                <input
                  type="text"
                  value={shiftType.description}
                  onChange={(e) => handleDescriptionChange(index, e.target.value)}
                  style={{ width: '150px', padding: '4px' }}
                  placeholder="z.B. Tagdienst"
                />
              </div>

              <div>
                <label>Farbe: </label>
                <input
                  type="color"
                  value={shiftType.color}
                  onChange={(e) => handleColorChange(index, e.target.value)}
                  style={{ width: '50px', height: '30px', padding: '2px' }}
                />
              </div>

              <div>
                <label>Auswertung: </label>
                <select
                  value={shiftType.auswertung}
                  onChange={(e) => handleAuswertungChange(index, e.target.value)}
                  style={{ padding: '4px' }}
                >
                  <option value="off">Nicht zählen</option>
                  <option value="tag">Tagdienst</option>
                  <option value="nacht">Nachtdienst</option>
                  <option value="24h">24h-Dienst</option>
                  <option value="itw">ITW-Dienst</option>
                </select>
              </div>
            </div>
          </div>
        ))}

        <div style={{ marginTop: '20px', textAlign: 'right' }}>
          <button
            onClick={onCancel}
            style={{ marginRight: '10px', padding: '8px 16px' }}
          >
            Abbrechen
          </button>
          <button
            onClick={() => onConfirm(shiftTypeData)}
            style={{ padding: '8px 16px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px' }}
          >
            Dienstarten anlegen und Import fortsetzen
          </button>
        </div>
      </div>
    </div>
  );
};

// New Azubi Dialog Component
interface NewAzubiDialogProps {
  unknownNames: string[];
  onConfirm: (azubis: Array<{ name: string, vorname: string, lehrjahr: number }>) => void;
  onCancel: () => void;
}

const NewAzubiDialog: React.FC<NewAzubiDialogProps> = ({ unknownNames, onConfirm, onCancel }) => {
  const [azubiData, setAzubiData] = useState<Array<{ name: string, vorname: string, lehrjahr: number }>>(() => {
    return unknownNames.map(fullName => {
      const parts = fullName.split(',').map(p => p.trim());
      return {
        name: parts[0] || fullName,
        vorname: parts[1] || '',
        lehrjahr: 1
      };
    });
  });

  const handleLehrjahrChange = (index: number, value: string) => {
    const newData = [...azubiData];
    newData[index].lehrjahr = parseInt(value) || 1;
    setAzubiData(newData);
  };

  const handleVornameChange = (index: number, value: string) => {
    const newData = [...azubiData];
    newData[index].vorname = value;
    setAzubiData(newData);
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        background: 'white', padding: '20px', borderRadius: '8px', minWidth: '400px', maxWidth: '600px'
      }}>
        <h3>Neue Azubis anlegen</h3>
        <p>Folgende unbekannte Namen wurden gefunden:</p>

        {azubiData.map((azubi, index) => (
          <div key={index} style={{ marginBottom: '15px', border: '1px solid #ddd', padding: '10px', borderRadius: '4px' }}>
            <div><strong>Original:</strong> {unknownNames[index]}</div>
            <div style={{ marginTop: '5px' }}>
              <label>Nachname: </label>
              <input
                type="text"
                value={azubi.name}
                readOnly
                style={{ marginRight: '10px', padding: '2px' }}
              />
              <label>Vorname: </label>
              <input
                type="text"
                value={azubi.vorname}
                onChange={(e) => handleVornameChange(index, e.target.value)}
                style={{ marginRight: '10px', padding: '2px' }}
              />
              <label>Lehrjahr: </label>
              <select
                value={azubi.lehrjahr}
                onChange={(e) => handleLehrjahrChange(index, e.target.value)}
                style={{ padding: '2px' }}
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
              </select>
            </div>
          </div>
        ))}

        <div style={{ marginTop: '20px', textAlign: 'right' }}>
          <button
            onClick={onCancel}
            style={{ marginRight: '10px', padding: '8px 16px' }}
          >
            Abbrechen
          </button>
          <button
            onClick={() => onConfirm(azubiData)}
            style={{ padding: '8px 16px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px' }}
          >
            Azubis anlegen und Import fortsetzen
          </button>
        </div>
      </div>
    </div>
  );
};

// Azubi Period Dialog Component
interface AzubiPeriodDialogProps {
  azubisWithoutPeriod: Array<{ azubiId: number, azubiName: string, importDateRange: { start: string, end: string } }>;
  onConfirm: (adjustments: Array<{ azubiId: number, startDate: string, endDate: string, description: string, lehrjahr: number }>) => void;
  onCancel: () => void;
}

const AzubiPeriodDialog: React.FC<AzubiPeriodDialogProps> = ({ azubisWithoutPeriod, onConfirm, onCancel }) => {
  const [adjustments, setAdjustments] = useState<Array<{ azubiId: number, startDate: string, endDate: string, description: string, lehrjahr: number }>>([]);
  const [minLehrjahre, setMinLehrjahre] = useState<{ [key: number]: number }>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAzubiPeriods = async () => {
      const minLehrjahrMap: { [key: number]: number } = {};
      const initialAdjustments = [];

      for (const azubi of azubisWithoutPeriod) {
        try {
          const periods = await (window as any).api.getAzubiPeriods(azubi.azubiId);

          // Ermittle das Lehrjahr des letzten Zeitraums
          let minLehrjahr = 1;
          if (periods && periods.length > 0) {
            const sortedPeriods = [...periods].sort((a, b) =>
              new Date(b.end_date).getTime() - new Date(a.end_date).getTime()
            );
            minLehrjahr = sortedPeriods[0].lehrjahr || 1;
          }

          minLehrjahrMap[azubi.azubiId] = minLehrjahr;

          initialAdjustments.push({
            azubiId: azubi.azubiId,
            startDate: azubi.importDateRange.start,
            endDate: azubi.importDateRange.end,
            description: 'Automatisch durch Import erstellt',
            lehrjahr: minLehrjahr
          });
        } catch (error) {
          // Bei Fehler: Standard-Werte verwenden
          minLehrjahrMap[azubi.azubiId] = 1;
          initialAdjustments.push({
            azubiId: azubi.azubiId,
            startDate: azubi.importDateRange.start,
            endDate: azubi.importDateRange.end,
            description: 'Automatisch durch Import erstellt',
            lehrjahr: 1
          });
        }
      }

      setMinLehrjahre(minLehrjahrMap);
      setAdjustments(initialAdjustments);
      setLoading(false);
    };

    loadAzubiPeriods();
  }, [azubisWithoutPeriod]);

  const handleStartDateChange = (index: number, value: string) => {
    const newData = [...adjustments];
    newData[index].startDate = value;
    setAdjustments(newData);
  };

  const handleEndDateChange = (index: number, value: string) => {
    const newData = [...adjustments];
    newData[index].endDate = value;
    setAdjustments(newData);
  };

  const handleDescriptionChange = (index: number, value: string) => {
    const newData = [...adjustments];
    newData[index].description = value;
    setAdjustments(newData);
  };

  const handleLehrjahrChange = (index: number, value: string) => {
    const newData = [...adjustments];
    newData[index].lehrjahr = parseInt(value) || 1;
    setAdjustments(newData);
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        background: 'white', padding: '20px', borderRadius: '8px', minWidth: '600px', maxWidth: '800px', maxHeight: '80vh', overflow: 'auto'
      }}>
        <h3>Azubi-Zeiträume korrigieren</h3>
        {loading ? (
          <p>Lade Azubi-Daten...</p>
        ) : (
          <>
            <p>Folgende Azubis haben keinen aktiven Zeitraum für den Importzeitraum. Bitte korrigieren Sie die Zeiträume:</p>

            {azubisWithoutPeriod.map((azubi, index) => (
              <div key={index} style={{ marginBottom: '20px', border: '1px solid #ddd', padding: '15px', borderRadius: '4px' }}>
                <div><strong>Azubi:</strong> {azubi.azubiName}</div>
                <div><strong>Import-Zeitraum:</strong> {azubi.importDateRange.start} bis {azubi.importDateRange.end}</div>

                <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'inline-block', width: '120px' }}>Startdatum: </label>
                    <input
                      type="date"
                      value={adjustments[index].startDate}
                      onChange={(e) => handleStartDateChange(index, e.target.value)}
                      style={{ padding: '4px', width: '150px' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'inline-block', width: '120px' }}>Enddatum: </label>
                    <input
                      type="date"
                      value={adjustments[index].endDate}
                      onChange={(e) => handleEndDateChange(index, e.target.value)}
                      style={{ padding: '4px', width: '150px' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'inline-block', width: '120px' }}>Lehrjahr: </label>
                    <select
                      value={adjustments[index].lehrjahr}
                      onChange={(e) => handleLehrjahrChange(index, e.target.value)}
                      style={{ padding: '4px' }}
                      disabled={loading}
                    >
                      {minLehrjahre[adjustments[index].azubiId] <= 1 && <option value={1}>1</option>}
                      {minLehrjahre[adjustments[index].azubiId] <= 2 && <option value={2}>2</option>}
                      <option value={3}>3</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'inline-block', width: '120px' }}>Beschreibung: </label>
                    <input
                      type="text"
                      value={adjustments[index].description}
                      onChange={(e) => handleDescriptionChange(index, e.target.value)}
                      style={{ padding: '4px', width: '300px' }}
                      placeholder="z.B. Ausbildungsabschnitt 1"
                    />
                  </div>
                </div>
              </div>
            ))}

            <div style={{ marginTop: '20px', textAlign: 'right' }}>
              <button
                onClick={onCancel}
                style={{ marginRight: '10px', padding: '8px 16px' }}
                disabled={loading}
              >
                Abbrechen
              </button>
              <button
                onClick={() => onConfirm(adjustments)}
                style={{ padding: '8px 16px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px' }}
                disabled={loading}
              >
                Zeiträume anlegen und Import fortsetzen
              </button>
            </div>
          </>
        )}
      </div>

    </div>
  );
};

export default DutyRoster;
