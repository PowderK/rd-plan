import React, { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
// ImportMonthDialog entfällt für direkten Monatsimport
import ImportTable from './ImportTable';
// DepartmentDutyDaysTable entfernt
// DepartmentDutyDaysTableData entfernt
import { BUILD_INFO } from '../buildInfo';

interface Person {
  id: number;
  name: string;
  vorname: string;
  fahrzeugfuehrerHLFB?: boolean | number;
}

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

const months = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];

// Helper function to check if azubi is active on a specific date
const isAzubiActiveOnDate = (azubiPeriods: any[], checkDate: string): boolean => {
  if (!azubiPeriods || azubiPeriods.length === 0) {
    // No periods defined = always active (backward compatibility)
    return true;
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
  if (!allPeriods || allPeriods.length === 0) {
    return azubis; // No periods defined = all azubis active
  }
  
  // Check if azubi is active at any point during the month
  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0);
  
  return azubis.filter(azubi => {
    const azubiPeriods = allPeriods.filter(p => p.azubi_id === azubi.id);
    
    if (azubiPeriods.length === 0) {
      return true; // No periods = always active
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
  const [personnel, setPersonnel] = useState<Person[]>([]);
  const [year, setYear] = useState<number>((window as any).rdPlanYear || new Date().getFullYear());
  const [yearPlannings, setYearPlannings] = useState<{ year: number; filePath: string }[]>([]);
  const [shiftTypes, setShiftTypes] = useState<{ id: number, code: string, description: string }[]>([]);
  const [customDropdownValues, setCustomDropdownValues] = useState<string[]>([]);
  const [department, setDepartment] = useState<number>(1);
  const [itwEnabled, setItwEnabled] = useState<boolean>(false);
  const [itwPatternSeqs, setItwPatternSeqs] = useState<{ startDate: string; pattern: string[] }[]>([]);
  const [deptPatternSeqs, setDeptPatternSeqs] = useState<{ startDate: string; pattern: string[] }[]>([]);
  const [holidays, setHolidays] = useState<Set<string>>(new Set());
  const [auswertungByType, setAuswertungByType] = useState<Record<string, 'off'|'tag'|'nacht'|'24h'|'itw'>>({});
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
  const [importTableMonth, setImportTableMonth] = useState<number|null>(null);
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
  const [pendingImportYear, setPendingImportYear] = useState<number>(0);
  const [pendingImportMonth, setPendingImportMonth] = useState<number | undefined>(undefined);
  // Fahrzeuge und Aktivierungen für Positions-Berechnungen
  const [rtwVehicles, setRtwVehicles] = useState<{ id:number; name:string }[]>([]);
  const [nefVehicles, setNefVehicles] = useState<{ id:number; name:string }[]>([]);
  const [rtwActs, setRtwActs] = useState<Record<number, boolean[]>>({});
  const [nefActs, setNefActs] = useState<Record<number, boolean[]>>({});

  useEffect(() => {
    (async () => {
      const list = await (window as any).api.getPersonnelList();
      const azubiList = await (window as any).api.getAzubiList();
      const allPeriods = await (window as any).api.getAllAzubiPeriods();
      
      setPersonnel(list);
      setAzubis(azubiList);
      setAzubiPeriods(allPeriods);
      
      // Lade jahresspezifische Vorplanungen
      try {
        const plannings = await (window as any).api.getYearPlannings?.();
        if (plannings && Array.isArray(plannings)) {
          setYearPlannings(plannings.map((p: any) => ({ year: Number(p.year), filePath: String(p.filePath) })));
        }
      } catch (e) {
        console.error('Failed to load year plannings:', e);
      }
      
      // Lade das Jahr aus den Settings für initialen Daten-Load
      const y = await (window as any).api.getSetting('year');
      const yearToUse = Number(y) || year;
      console.log('[DEBUG] Initial load, year from settings:', y, 'using:', yearToUse, 'state year:', year);
      
  const types = await (window as any).api.getShiftTypes();
  setShiftTypes(types);
  // Lade Auswertung je Dienstart (off|tag|nacht|24h|itw)
  try {
    const map: Record<string, 'off'|'tag'|'nacht'|'24h'|'itw'> = {};
    for (const t of (types || [])) {
      const v = await (window as any).api.getSetting(`auswertung_${t.code}`);
      map[t.code] = (v === 'tag' || v === 'nacht' || v === '24h' || v === 'itw') ? v : 'off';
    }
    setAuswertungByType(map);
  } catch {}
  // Lade Farben je Dienstart (color_<code>)
  try {
    const cmap: Record<string, string> = {};
    for (const t of (types || [])) {
      const c = await (window as any).api.getSetting(`color_${t.code}`);
      const norm = (typeof c === 'string' && /^#?[0-9a-fA-F]{6}$/.test(c)) ? (c.startsWith('#') ? c : `#${c}`) : '';
      cmap[t.code] = norm;
    }
    setColorByType(cmap);
  } catch {}
  const custom = await (window as any).api.getSetting('customDropdownValues');
  if (custom) setCustomDropdownValues(String(custom).split('\n').map(s => s.trim()).filter(Boolean));
    const dep = await (window as any).api.getSetting('department');
    if (dep) setDepartment(Number(dep));
    const itwVal = await (window as any).api.getSetting('itw');
    if (itwVal) setItwEnabled(itwVal === 'true');
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
    // Dept Sequenzen laden
    try {
      const seqs = await (window as any).api.getDeptPatterns?.();
      const normDept = (arr: string[], len = 21) => (arr || []).slice(0,len).concat(Array(len).fill('')).slice(0,len).map(v => (v === '1'||v==='2'||v==='3') ? v : '');
      if (Array.isArray(seqs) && seqs.length > 0) {
        const parsed = seqs.map((s: any) => ({ startDate: String(s.startDate), pattern: normDept(String(s.pattern).split(',').map((x: string) => x.trim()), 21) }));
        parsed.sort((a: any, b: any) => a.startDate.localeCompare(b.startDate));
        setDeptPatternSeqs(parsed);
      }
    } catch {}
    // Feiertage laden
    try {
      const hlist = await (window as any).api.getHolidaysForYear(yearToUse);
      const set = new Set<string>((hlist || []).map((h: any) => String(h.date)));
      setHolidays(set);
    } catch {}
    // Fahrzeuge und Aktivierungen laden (für aktuelle Settings-Jahr)
    try {
      const r = await (window as any).api.getRtwVehicles?.();
      if (Array.isArray(r)) setRtwVehicles(r);
    } catch {}
    try {
      const n = await (window as any).api.getNefVehicles?.();
      if (Array.isArray(n)) setNefVehicles(n);
    } catch {}
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
    } catch {}
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
    } catch {}
      // Dienstplan-Einträge laden
      const entries = await (window as any).api.getDutyRoster(yearToUse);
      console.log('[Renderer] getDutyRoster fetched', Array.isArray(entries) ? entries.length : typeof entries, 'entries for year', yearToUse);
      if (Array.isArray(entries) && entries.length > 0) {
        console.log('[Renderer] sample entry[0]=', entries[0]);
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
      } catch {}
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
      console.log('[Renderer] constructed rosterObj keys=', Object.keys(rosterObj).slice(0,20), 'total=', Object.keys(rosterObj).length);
      setRoster(rosterObj);
      
      // Aktualisiere Year-State falls das geladene Jahr vom initialen State abweicht
      if (yearToUse !== year) {
        console.log('[DEBUG] Updating year state from', year, 'to', yearToUse);
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
          const map: Record<string, 'off'|'tag'|'nacht'|'24h'|'itw'> = {};
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
          } catch {}
        } catch {}
        // ITW-Pattern Sequenzen neu laden
        try {
          const norm = (arr: string[], len = 21) => (arr || []).slice(0,len).concat(Array(len).fill('')).slice(0,len).map(v => (v === 'IW' ? 'IW' : ''));
          const seqs = await (window as any).api.getItwPatterns?.();
          if (Array.isArray(seqs) && seqs.length > 0) {
            const parsed = seqs.map((s: any) => ({ startDate: String(s.startDate), pattern: norm(String(s.pattern).split(',').map((x: string) => x.trim()), 21) }));
            parsed.sort((a, b) => a.startDate.localeCompare(b.startDate));
            setItwPatternSeqs(parsed);
          }
        } catch {}
        // Dept Sequenzen neu laden
        try {
          const seqs = await (window as any).api.getDeptPatterns?.();
          const normDept = (arr: string[], len = 21) => (arr || []).slice(0,len).concat(Array(len).fill('')).slice(0,len).map(v => (v === '1'||v==='2'||v==='3') ? v : '');
          if (Array.isArray(seqs) && seqs.length > 0) {
            const parsed = seqs.map((s: any) => ({ startDate: String(s.startDate), pattern: normDept(String(s.pattern).split(',').map((x: string) => x.trim()), 21) }));
            parsed.sort((a: any, b: any) => a.startDate.localeCompare(b.startDate));
            setDeptPatternSeqs(parsed);
          }
        } catch {}
        // Feiertage neu laden – gezielt für das neue Settings-Jahr
        try {
          const hlist = await (window as any).api.getHolidaysForYear(newYear);
          setHolidays(new Set<string>((hlist || []).map((h: any) => String(h.date))));
        } catch {}
        // Roster gezielt für das neue Jahr laden, auch wenn setYear async ist
        await reloadRoster(newYear);
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

  // Monatsweise Ansicht: ausgewählter Monat und Tage
  const [currentMonth, setCurrentMonth] = useState<number>(() => {
    // Restore from window if available, otherwise use current month or January based on year
    if ((window as any).rdPlanMonth !== undefined) {
      return (window as any).rdPlanMonth;
    }
    const currentYear = new Date().getFullYear();
    return year === currentYear ? new Date().getMonth() : 0;
  });
  
  // Speichere currentMonth im window-Objekt
  useEffect(() => {
    (window as any).rdPlanMonth = currentMonth;
  }, [currentMonth]);
  
  // Synchronisiere Jahr mit window-Objekt für Header und springe zum passenden Monat NUR bei Jahr-Änderung
  useEffect(() => {
    // Teile Jahr mit anderen Komponenten
    (window as any).rdPlanYear = year;
    window.dispatchEvent(new CustomEvent('rdplan-year-changed', { detail: { year } }));
    
    // Persistiere Jahr in Settings
    (async () => {
      try {
        await (window as any).api.setSetting('year', String(year));
        console.log('[DEBUG] Year saved to settings:', year);
      } catch (err) {
        console.error('[DEBUG] Failed to save year to settings:', err);
      }
    })();
    
    // Wenn aktuelles Jahr: springe zum aktuellen Monat, sonst Januar (nur wenn Jahr wirklich geändert wurde)
    const currentYear = new Date().getFullYear();
    if (year === currentYear) {
      setCurrentMonth(new Date().getMonth());
    } else {
      setCurrentMonth(0); // Januar
    }
  }, [year]);

  // Filter azubis based on active periods for current month OR having roster entries in the year
  useEffect(() => {
    console.log('[DEBUG] filteredAzubis useEffect triggered, roster keys:', Object.keys(roster).length, 'azubis:', azubis.length, 'year:', year, 'month:', currentMonth);
    const filtered = filterActiveAzubisForMonth(azubis, azubiPeriods, year, currentMonth + 1);
    
    // Zusätzlich: Azubis hinzufügen, die Dienstplan-Einträge im aktuellen Jahr haben
    const azubiIdsWithEntries = new Set<number>();
    Object.keys(roster).forEach(key => {
      if (key.startsWith('a_')) {
        const azubiId = parseInt(key.substring(2));
        if (!isNaN(azubiId)) {
          azubiIdsWithEntries.add(azubiId);
        }
      }
    });
    
    console.log('[DEBUG] azubiIdsWithEntries:', Array.from(azubiIdsWithEntries), 'filtered from periods:', filtered.length);
    
    // Füge Azubis hinzu, die nicht in filtered sind, aber Einträge haben
    const additionalAzubis = azubis.filter(azubi => 
      azubiIdsWithEntries.has(azubi.id) && !filtered.some(f => f.id === azubi.id)
    );
    
    console.log('[DEBUG] additionalAzubis:', additionalAzubis.length, 'total filteredAzubis:', filtered.length + additionalAzubis.length);
    setFilteredAzubis([...filtered, ...additionalAzubis]);
  }, [azubis, azubiPeriods, year, currentMonth, roster]);
  const days = getDaysInMonthView(year, currentMonth);
  // Debug: Zeige die ersten 5 Tage im Jahr
  console.log('[DEBUG] days[0-4]:', days.slice(0,5));

  // Kombiniere Personal und Azubis für die Dienstplan-Tabelle
  type Row = { id: string; origId: number; name: string; vorname: string; isAzubi: boolean; lehrjahr?: number };
  const allRows: Row[] = [
    ...personnel.map(p => ({ id: `p_${p.id}`, origId: p.id, name: p.name, vorname: p.vorname, isAzubi: false })),
    ...filteredAzubis.map(a => ({ id: `a_${a.id}`, origId: a.id, name: a.name, vorname: a.vorname, isAzubi: true, lehrjahr: a.lehrjahr }))
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
    const r = parseInt(h.slice(0,2), 16);
    const g = parseInt(h.slice(2,4), 16);
    const b = parseInt(h.slice(4,6), 16);
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
  const handleCreateNewAzubis = async (newAzubis: Array<{name: string, vorname: string, lehrjahr: number}>) => {
    try {
      const retryResult = await (window as any).api.importDutyRoster(pendingImportPath, year, currentMonth, { newAzubis });
      if (retryResult.success) {
        alert(`Import erfolgreich: ${retryResult.importedCount} Einträge wurden verarbeitet. ${newAzubis.length} neue Azubis wurden angelegt.`);
        await reloadRoster();
      } else {
        alert(`Import fehlgeschlagen: ${retryResult.message}`);
      }
    } catch (error) {
      console.error('Fehler beim erneuten Import:', error);
      alert('Fehler beim Import.');
    }
    setShowNewAzubiDialog(false);
  };

  const handleCancelNewAzubis = () => {
    setShowNewAzubiDialog(false);
  };

  // New ShiftType Dialog Handlers
  const handleCreateNewShiftTypes = async (newShiftTypes: Array<{code: string, description: string, color: string, auswertung: string}>) => {
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
            alert(`Import erfolgreich: ${retryResult.importedCount} Einträge wurden verarbeitet. ${newShiftTypes.length} neue Dienstarten wurden angelegt.`);
            await reloadRoster();
          }
        } else {
          alert(`Import erfolgreich: ${retryResult.importedCount} Einträge wurden verarbeitet. ${newShiftTypes.length} neue Dienstarten wurden angelegt.`);
          await reloadRoster();
        }
      } else {
        alert(`Import fehlgeschlagen: ${retryResult.message}`);
      }
    } catch (error) {
      console.error('Fehler beim erneuten Import:', error);
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
      console.warn('Fehler beim Laden der jahresspezifischen Vorplanung:', e);
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
            
            alert(`Import erfolgreich: ${result.importedCount} Einträge wurden verarbeitet.`);
            await reloadRoster();
        } else {
            alert(`Import fehlgeschlagen: ${result.message}`);
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Ein unbekannter Fehler ist aufgetreten.';
        alert(`Fehler beim Import: ${message}`);
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
          const date = dObj.toISOString().slice(0,10);
          const type = shiftTypes.some(t => t.code === value) ? 'dropdown' : 'text';
          entries.push({ personId: person.id, personType: 'person', date, value, type });
        }
      }
      if (entries.length) {
        await (window as any).api.bulkSetDutyRoster(entries);
      }
    } catch (e) {
      console.warn('[DutyRoster] Monatsimport Fehler', e);
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
    
    setPersonnel(list);
    setAzubis(azubiList);
    setAzubiPeriods(allPeriods);
    // Hole Dienstplan-Einträge für das lokal ausgewählte Jahr (nicht globales Setting)
    const yUse = typeof yearOverride === 'number' ? yearOverride : year;
    const entries = await (window as any).api.getDutyRoster(yUse);
    console.log('[Renderer] reloadRoster getDutyRoster fetched', Array.isArray(entries) ? entries.length : typeof entries, 'entries');
    if (Array.isArray(entries) && entries.length > 0) {
      console.log('[Renderer] reloadRoster sample entry[0]=', entries[0]);
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
    } catch {}
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
      console.log('[Renderer] reloadRoster constructed rosterObj keys=', Object.keys(rosterObj).slice(0,20), 'total=', Object.keys(rosterObj).length);
    
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
        setNefActs(map);
      } catch {}
    })();
  }, [year]);

  // KPI-Hilfswerte für aktuellen Monat berechnen
  console.log('[DEBUG] KPI calculation start, roster keys:', Object.keys(roster).length, 'personnel:', personnel.length, 'filteredAzubis:', filteredAzubis.length);
  const monthIndex = currentMonth;
  const deptShiftsInMonth = (() => {
    let cnt = 0;
    for (const d of days) {
      const iso = d.iso;
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
    console.log('[DEBUG] activePersonnelInMonth:', sum, 'from', personnel.length, 'personnel');
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
      console.log('[DEBUG] 1.1. Eintrag:', { personId, origId, personType, date, value, type });
    }

    // Qualifikations-Validierung für nicht-leere Werte und nur für Personen (nicht Azubis)
    if (value && value.trim() !== '' && personType === 'person' && origId) {
      try {
        // Hole cellType aus dem aktuellen roster-Eintrag (z.B. "rtw1_tag_1")
        const cellType = roster[personId]?.[date]?.type || undefined;
        const validation = await (window as any).api.validateQualificationForShift(origId, value, date, cellType);
        
        if (!validation.isValid) {
          const missingQuals = validation.missingQualifications.join(', ');
          const message = `⚠️ Fehlende Qualifikationen für "${value}": ${missingQuals}\n\nTrotzdem zuordnen?`;
          
          if (!confirm(message)) {
            return; // Abbruch der Zuordnung
          }
        }

        // Zeige Warnungen an (abgelaufene Qualifikationen)
        if (validation.warnings && validation.warnings.length > 0) {
          const warnings = validation.warnings.join('\n');
          alert(`⚠️ Warnungen:\n${warnings}`);
        }
      } catch (err) {
        console.error('Fehler bei Qualifikations-Validierung:', err);
        // Bei Validierungsfehlern trotzdem fortfahren
      }
    }

    const entry = { personId: origId, personType, date, value, type };
    console.log('[Renderer] setDutyRosterEntry SEND', entry);
    try {
      await (window as any).api.setDutyRosterEntry(entry);
      console.log('[Renderer] setDutyRosterEntry OK', entry);
      console.log('[Renderer] handleCellChange triggering reloadRoster...');
      await reloadRoster();
      console.log('[Renderer] handleCellChange reloadRoster completed');
    } catch (err) {
      console.error('[Renderer] setDutyRosterEntry ERROR', err, entry);
    }
  };

  return (
    <div style={{ overflowX: 'auto', padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <h2 style={{ margin: 0, marginRight: 'auto' }}>Dienstplan</h2>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          Jahr:
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            style={{ 
              padding: '6px 10px',
              fontSize: 14,
              borderRadius: 6,
              border: '1px solid #bbb',
              background: '#fff',
              cursor: 'pointer'
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
        </label>
      </div>
      {/* Monats-Tabs */}
      <div style={{ 
        display: 'flex', 
        gap: '4px', 
        borderBottom: '1px solid #e5e7eb',
        marginBottom: '16px',
        flexWrap: 'wrap'
      }}>
        {months.map((m, i) => (
          <button
            key={i}
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
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <button onClick={handleImport}>
          Import Monat (Excel)
        </button>
        <span style={{fontSize: 12, color: '#555'}}>Importiert den aktuellen Monat aus der in den Einstellungen hinterlegten Excel-Datei.</span>
      </div>
      <table style={{ borderCollapse: 'collapse', minWidth: Math.max(800, days.length * 90) }}>
        <thead style={{ position: 'sticky', top: 0, zIndex: 3, background: 'var(--bg)' }}>
          <tr>
            <th style={{ position: 'sticky', left: 0, background: 'var(--bg)', zIndex: 4, border: '1px solid var(--line)', minWidth: nameColWidth }}>{'Name'}</th>
            <th style={{ border: '1px solid var(--line)', minWidth: 50, whiteSpace: 'nowrap' }}>24h</th>
            <th style={{ border: '1px solid var(--line)', minWidth: 50, whiteSpace: 'nowrap' }}>IW</th>
            <th style={{ border: '1px solid var(--line)', minWidth: 70, whiteSpace: 'nowrap' }}>Soll RTW</th>
            {days.map((d, i) => (
              <th key={i} style={{ border: '1px solid var(--line)', whiteSpace: 'nowrap' }}>{d.date}</th>
            ))}
          </tr>
          <tr>
            <th style={{ position: 'sticky', left: 0, background: 'var(--bg)', zIndex: 4, border: '1px solid var(--line)', minWidth: nameColWidth }}> </th>
            <th style={{ border: '1px solid var(--line)' }}> </th>
            <th style={{ border: '1px solid var(--line)' }}> </th>
            <th style={{ border: '1px solid var(--line)' }}> </th>
            {days.map((d, i) => (
              <th key={i} style={{ border: '1px solid var(--line)', whiteSpace: 'nowrap' }}>{d.weekday}</th>
            ))}
          </tr>
          <tr>
            <th style={{ position: 'sticky', left: 0, background: 'var(--bg)', zIndex: 4, border: '1px solid var(--line)', minWidth: nameColWidth, fontWeight: 'normal', color: 'var(--muted)', fontSize: 13 }}>Schichtfolge</th>
            <th style={{ border: '1px solid var(--line)' }} />
            <th style={{ border: '1px solid var(--line)' }} />
            <th style={{ border: '1px solid var(--line)' }} />
            {days.map((d, i) => {
              // Dept day via deptPatternSeqs gültig-ab + 21er Modulo
              const iso = d.iso;
              const seqs = [...(deptPatternSeqs || [])].sort((a,b) => a.startDate.localeCompare(b.startDate));
              let active = seqs[0];
              for (const s of seqs) { if (s.startDate <= iso) active = s; else break; }
              const start = new Date((active?.startDate || '1970-01-01') + 'T00:00:00Z');
              const cur = new Date(iso + 'T00:00:00Z');
              const diffDays = Math.floor((cur.getTime() - start.getTime()) / (1000*60*60*24));
              const pat = active?.pattern || [];
              const depDay = pat.length ? pat[((diffDays % 21) + 21) % 21] : '';
              return (
                <th key={i} style={{ border: '1px solid var(--line)', fontWeight: 'normal', color: 'var(--muted)', fontSize: 13 }}>
                  {depDay}
                </th>
              );
            })}
          </tr>
          {itwEnabled && (
            <>
              <tr>
                <th style={{ position: 'sticky', left: 0, background: 'var(--bg)', zIndex: 4, border: '1px solid var(--line)', minWidth: nameColWidth, fontWeight: 'normal', color: 'var(--text)', fontSize: 13 }}>
                  Abteilung: {department}
                </th>
                <th style={{ border: '1px solid var(--line)' }} />
                <th style={{ border: '1px solid var(--line)' }} />
                <th style={{ border: '1px solid var(--line)' }} />
                {days.map((_, i) => (
                  <th key={`dept_${i}`} style={{ border: '1px solid var(--line)' }} />
                ))}
              </tr>
              <tr>
                <th style={{ position: 'sticky', left: 0, background: 'var(--bg)', zIndex: 4, border: '1px solid var(--line)', minWidth: nameColWidth, fontWeight: 'normal', color: 'var(--muted)', fontSize: 13 }}>ITW</th>
                <th style={{ border: '1px solid var(--line)' }} />
                <th style={{ border: '1px solid var(--line)' }} />
                <th style={{ border: '1px solid var(--line)' }} />
                {days.map((_, i) => {
                  const showIW = isIwDay(i);
                  return (
                    <th key={`itw_${i}`} style={{ border: '1px solid var(--line)', fontWeight: 'normal', color: 'var(--muted)', fontSize: 13 }}>
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
                  <td colSpan={days.length + 4} style={{ background: '#e0e0e0', fontWeight: 'bold', textAlign: 'left', border: '1px solid #bbb' }}>
                    Azubis
                  </td>
                </tr>
              ) : null,
              (
                <tr key={person.id} style={{ background: rowIdx % 2 === 1 ? 'var(--hover)' : undefined }}>
                  <td style={{ position: 'sticky', left: 0, background: 'var(--bg)', zIndex: 1, border: '1px solid var(--line)', fontStyle: person.isAzubi ? 'italic' : undefined, color: (!person.isAzubi && !!(personnel.find(p => p.id === person.origId)?.fahrzeugfuehrerHLFB)) ? '#1565c0' : undefined }}>
                    {person.name}{person.isAzubi && person.lehrjahr !== undefined ? ` (Azubi, ${person.lehrjahr}. Lj.)` : ''}
                  </td>
                  <td style={{ border: '1px solid var(--line)', textAlign: 'center', minWidth: 50 }}>
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
                  <td style={{ border: '1px solid var(--line)', textAlign: 'center', minWidth: 50 }}>
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
                  <td style={{ border: '1px solid var(--line)', textAlign: 'center', minWidth: 70 }}>
                    {!person.isAzubi ? (
                      (() => {
                        const key = getStateKey(person);
                        // Präsenz-Tage (Auswertung ≠ 'off') als Basis
                        let presence = 0;
                        for (const d of days) {
                          const raw = (roster[key]?.[d.iso]?.value || '').trim();
                          if (raw && (auswertungByType[raw] || 'off') !== 'off') presence++;
                        }
                        // Qualifikation HLF-B Fahrzeugführer -> 75% wirken auf Präsenz
                        const base = personnel.find(p => p.id === person.origId);
                        const hasHLFB = (base && (base as any).fahrzeugfuehrerHLFB === 1);
                        if (hasHLFB && presence > 0) {
                          presence = presence * 0.75;
                        }
                        // Verhältnis der Gesamtlast pro Kopf
                        // statt 24h+ITW‑Mittel nutzen wir die durchschnittliche Präsenz als Bezugsgröße
                        const mw = avgPresenceInMonth;
                        const spp = shiftsPerPersonInMonth;
                        if (mw <= 0 || spp <= 0 || presence <= 0) return '';
                        const target = Math.round((spp / mw) * presence);
                        return target;
                      })()
                    ) : ''}
                  </td>
                  {days.map((_, dayIdx) => {
                    const iso = days[dayIdx]?.iso;
                    const cell = roster[getStateKey(person)]?.[iso] || { value: '', type: 'dropdown' };
                    const isEditing = editing[getStateKey(person)]?.[dayIdx];
                    const code = (cell.value || '').trim();
                    const hex = colorByType[code] || '';
                    const bgTint = hex ? hexToRgba(hex, 0.2) : undefined; // sanfter Hintergrund
                    const isManualEdit = cell.manualEdit;
                    
                    // Debug: Log wenn manuelle Bearbeitung erkannt wird
                    if (isManualEdit && code) {
                      console.log('[DEBUG] Rendering manual edit:', { 
                        person: person.name, 
                        dayIdx, 
                        iso, 
                        code, 
                        isManualEdit,
                        cell
                      });
                    }
                    const cellStyle = { 
                      minWidth: 90, 
                      cursor: 'pointer', 
                      border: '1px solid var(--line)', 
                      whiteSpace: 'nowrap', 
                      background: bgTint,
                      ...(isManualEdit ? { borderLeft: '4px solid #1976d2' } : {})
                    };
                    return (
                      <td key={dayIdx} style={cellStyle}
                          onClick={() => {
                            if (!isEditing) {
                              console.log('[DEBUG] Zellenklick:', { dayIdx, iso: days[dayIdx].iso, date: days[dayIdx].date });
                              startEdit(getStateKey(person), dayIdx);
                            }
                          }}>
                        {isEditing ? (
                          (
                            <select
                              autoFocus
                              value={cell.value}
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
                          <span style={{ color: cell.value ? undefined : '#bbb' }}>
                            {cell.value || <i>–</i>}
                          </span>
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

    {/* Version/Build Anzeige entfernt */}
  </div>
  );
};

// New ShiftType Dialog Component
interface NewShiftTypeDialogProps {
  unknownShiftTypes: string[];
  onConfirm: (shiftTypes: Array<{code: string, description: string, color: string, auswertung: string}>) => void;
  onCancel: () => void;
}

const NewShiftTypeDialog: React.FC<NewShiftTypeDialogProps> = ({ unknownShiftTypes, onConfirm, onCancel }) => {
  const [shiftTypeData, setShiftTypeData] = useState<Array<{code: string, description: string, color: string, auswertung: string}>>(() => {
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
  onConfirm: (azubis: Array<{name: string, vorname: string, lehrjahr: number}>) => void;
  onCancel: () => void;
}

const NewAzubiDialog: React.FC<NewAzubiDialogProps> = ({ unknownNames, onConfirm, onCancel }) => {
  const [azubiData, setAzubiData] = useState<Array<{name: string, vorname: string, lehrjahr: number}>>(() => {
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
                <option value={4}>4</option>
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

export default DutyRoster;
