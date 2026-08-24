import React, { useEffect, useMemo, useState } from 'react';
import { departmentNameToId } from './MonthTabs';
import { useAuth } from '../contexts/AuthContext';
import {
  buildDepartmentActiveMonthly,
  indexDepartmentPeriodsByPerson,
  qualificationAppliesInMonth,
  yearMonthKey,
} from '../utils/personPeriods';
import { isVehicleActiveOnDate, VehiclePeriod, VehicleSpecialDay } from '../utils/vehiclePeriods';
import {
  buildVehicleActivationMap,
  calculateTargetsWithDetails,
  computeAssignedShiftsPerPerson,
} from '../utils/calculation';

const monthNames = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

function useYear(): [number, React.Dispatch<React.SetStateAction<number>>] {
  const [year, setYear] = useState<number>((window as any).rdPlanYear || new Date().getFullYear());
  return [year, setYear];
}

function useRoster(year: number, departmentName?: string) {
  const [roster, setRoster] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const rows = await (window as any).api.getDutyRoster(year, departmentName);
        setRoster(Array.isArray(rows) ? rows : []);
      } catch { setRoster([]); }
    })();
  }, [year, departmentName]);
  return roster;
}

type PersonnelStatsRow = {
  id: number;
  name: string;
  vorname: string;
  fahrzeugfuehrerHLFB?: boolean;
  hlfbMonthly?: boolean[];
  ue50?: boolean;
  ue50Monthly?: boolean[];
  lpal?: boolean;
  lpalMonthly?: boolean[];
  rettungsdienst?: boolean;
  rettungsdienstMonthly?: boolean[];
  deptActiveMonthly?: boolean[];
};

function isEligibleForStatsMonth(person: PersonnelStatsRow, monthIndex: number): boolean {
  if (!person.rettungsdienstMonthly?.[monthIndex]) return false;
  if (person.deptActiveMonthly && !person.deptActiveMonthly[monthIndex]) return false;
  return true;
}

function usePersonnel(year: number, departmentName?: string) {
  const [list, setList] = useState<PersonnelStatsRow[]>([]);
  const fetch = async () => {
    try {
      const currentYear = year.toString();
      const [rawList, allPeriods, allDeptPeriods, hlfbQualSetting, ue50QualSetting, lpalQualSetting, rdQualSetting] = await Promise.all([
        (window as any).api.getPersonnelList?.(false, currentYear, departmentName),
        (window as any).api.getAllQualificationPeriods?.(),
        (window as any).api.getAllPersonnelDepartmentPeriods?.(),
        (window as any).api.getSetting?.('hlfb_qualification_type'),
        (window as any).api.getSetting?.('ue50_qualification_type'),
        (window as any).api.getSetting?.('lpal_qualification_type'),
        (window as any).api.getSetting?.('rettungsdienst_qualification_type'),
      ]);

      const hlfbQualName = String(hlfbQualSetting || 'Fahrzeugführer HLF-B');
      const ue50QualName = String(ue50QualSetting || 'Ü50');
      const lpalQualName = String(lpalQualSetting || 'LPAL');
      const rdQualName = String(rdQualSetting || 'Rettungsdienst');

      const periodsByPerson: Record<number, any[]> = {};
      if (Array.isArray(allPeriods)) {
        allPeriods.forEach((p: any) => {
          if (!periodsByPerson[p.personId]) periodsByPerson[p.personId] = [];
          periodsByPerson[p.personId].push(p);
        });
      }

      const deptPeriodsByPerson = indexDepartmentPeriodsByPerson(
        Array.isArray(allDeptPeriods) ? allDeptPeriods : []
      );

      const mapped: PersonnelStatsRow[] = (rawList || []).map((p: any) => {
        const pPeriods = periodsByPerson[p.id] || [];
        const hlfbPeriods = pPeriods.filter((per: any) => per.qualType === hlfbQualName);
        const ue50Periods = pPeriods.filter((per: any) => per.qualType === ue50QualName);
        const lpalPeriods = pPeriods.filter((per: any) => per.qualType === lpalQualName);
        const rdPeriods = pPeriods.filter((per: any) => per.qualType === rdQualName);

        const hlfbMonthly = Array(12).fill(false);
        const ue50Monthly = Array(12).fill(false);
        const lpalMonthly = Array(12).fill(false);
        const rettungsdienstMonthly = Array(12).fill(false);

        const qualApplies = (perList: any[], ym: string) =>
          perList.some((per: any) => qualificationAppliesInMonth(per, ym));

        for (let m = 0; m < 12; m++) {
          const ym = yearMonthKey(year, m);
          if (hlfbPeriods.length > 0) hlfbMonthly[m] = qualApplies(hlfbPeriods, ym);
          if (ue50Periods.length > 0) ue50Monthly[m] = qualApplies(ue50Periods, ym);
          if (lpalPeriods.length > 0) lpalMonthly[m] = qualApplies(lpalPeriods, ym);
          if (rdPeriods.length > 0) rettungsdienstMonthly[m] = qualApplies(rdPeriods, ym);
        }

        const deptActiveMonthly = buildDepartmentActiveMonthly(
          p.id,
          year,
          deptPeriodsByPerson,
          departmentName
        );

        const staticFlag = p.fahrzeugfuehrerHLFB === 1 || p.fahrzeugfuehrerHLFB === true || p.fahrzeugfuehrerHLFB === '1';
        if (hlfbPeriods.length === 0 && staticFlag) {
          hlfbMonthly.fill(true);
        }

        return {
          id: p.id,
          name: p.name,
          vorname: p.vorname,
          fahrzeugfuehrerHLFB: hlfbMonthly.some(Boolean),
          hlfbMonthly,
          ue50: ue50Monthly.some(Boolean),
          ue50Monthly,
          lpal: lpalMonthly.some(Boolean),
          lpalMonthly,
          rettungsdienst: rettungsdienstMonthly.some(Boolean),
          rettungsdienstMonthly,
          deptActiveMonthly
        };
      });

      setList(mapped);
    } catch {
      setList([]);
    }
  };

  useEffect(() => {
    fetch();
    const api = (window as any).api;
    if (api?.onPersonnelUpdated) {
      api.onPersonnelUpdated(fetch);
      return () => api.offPersonnelUpdated?.(fetch);
    }
  }, [year, departmentName]);

  return list;
}

function useAzubis(departmentName?: string) {
  const [list, setList] = useState<{ id: number; name: string; vorname: string }[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const raw = await (window as any).api.getAzubiList?.(false, undefined, departmentName);
        setList(Array.isArray(raw) ? raw : []);
      } catch { setList([]); }
    })();
  }, [departmentName]);
  return list;
}

function useGuests(year: number) {
  const [list, setList] = useState<{ id: number; name: string }[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const raw = await (window as any).api.getAllGuests?.();
        setList(Array.isArray(raw) ? raw : []);
      } catch { setList([]); }
    })();
  }, [year]);
  return list;
}

function useUe50PersonnelIds(year: number, departmentName?: string) {
  const [ids, setIds] = useState<Set<number>>(new Set());
  useEffect(() => {
    (async () => {
      try {
        const [rawList, allPeriods, ue50QualSetting, lpalQualSetting] = await Promise.all([
          (window as any).api.getPersonnelList?.(false, year.toString(), departmentName),
          (window as any).api.getAllQualificationPeriods?.(),
          (window as any).api.getSetting?.('ue50_qualification_type'),
          (window as any).api.getSetting?.('lpal_qualification_type'),
        ]);
        const ue50QualName = String(ue50QualSetting || 'Ü50');
        const lpalQualName = String(lpalQualSetting || 'LPAL');
        const nextIds = new Set<number>();
        (allPeriods || []).forEach((per: any) => {
          if (per.active && (per.qualType === ue50QualName || per.qualType === lpalQualName)) {
            nextIds.add(per.personId);
          }
        });
        setIds(nextIds);
      } catch { setIds(new Set()); }
    })();
  }, [year, departmentName]);
  return ids;
}

function useAuswertungByType() {
  const [map, setMap] = useState<Record<string, 'off' | 'tag' | 'nacht' | '24h' | 'itw'>>({});
  useEffect(() => {
    (async () => {
      try {
        const types = await (window as any).api.getShiftTypes?.();
        const next: Record<string, 'off' | 'tag' | 'nacht' | '24h' | 'itw'> = {};
        for (const t of types || []) {
          const mode = await (window as any).api.getSetting?.(`auswertung_${t.code}`);
          next[t.code] = (mode === 'tag' || mode === 'nacht' || mode === '24h' || mode === 'itw') ? mode : 'off';
        }
        setMap(next);
      } catch { }
    })();
  }, []);
  return map;
}

function useVehicles(year?: number) {
  const [rtw, setRtw] = useState<{ id: number; name: string }[]>([]);
  const [nef, setNef] = useState<{ id: number; name: string; occupancyMode?: '24h' | 'tag' }[]>([]);
  useEffect(() => {
    (async () => {
      try { const r = await (window as any).api.getRtwVehicles?.(year); if (Array.isArray(r)) setRtw(r); } catch { }
      try { const n = await (window as any).api.getNefVehicles?.(year); if (Array.isArray(n)) setNef(n); } catch { }
    })();
  }, [year]);
  return { rtw, nef };
}

function useVehicleActivations(year?: number) {
  const [rtwActs, setRtwActs] = useState<Record<number, boolean[]>>({});
  const [nefActs, setNefActs] = useState<Record<number, boolean[]>>({});
  useEffect(() => {
    (async () => {
      try {
        const acts = await (window as any).api.getRtwVehicleActivations?.(year);
        setRtwActs(buildVehicleActivationMap(acts));
      } catch { }
      try {
        const acts = await (window as any).api.getNefVehicleActivations?.(year);
        setNefActs(buildVehicleActivationMap(acts));
      } catch { }
    })();
  }, [year]);
  return { rtwActs, nefActs };
}

function useVehicleData() {
  const [rtwPeriods, setRtwPeriods] = useState<Record<number, VehiclePeriod[]>>({});
  const [nefPeriods, setNefPeriods] = useState<Record<number, VehiclePeriod[]>>({});
  const [specialDays, setSpecialDays] = useState<VehicleSpecialDay[]>([]);

  const fetchAll = async () => {
    try {
      const [rtwP, nefP, spec] = await Promise.all([
        (window as any).api.getAllRtwVehiclePeriods?.() || [],
        (window as any).api.getAllNefVehiclePeriods?.() || [],
        (window as any).api.getAllVehicleSpecialDays?.() || []
      ]);

      const rMap: Record<number, VehiclePeriod[]> = {};
      (rtwP || []).forEach((p: any) => {
        const vid = Number(p.vehicleId);
        if (!rMap[vid]) rMap[vid] = [];
        rMap[vid].push(p);
      });
      const nMap: Record<number, VehiclePeriod[]> = {};
      (nefP || []).forEach((p: any) => {
        const vid = Number(p.vehicleId);
        if (!nMap[vid]) nMap[vid] = [];
        nMap[vid].push(p);
      });

      setRtwPeriods(rMap);
      setNefPeriods(nMap);
      setSpecialDays(Array.isArray(spec) ? spec : []);
    } catch { }
  };

  useEffect(() => {
    fetchAll();
    const api = (window as any).api;
    if (api?.onVehiclesUpdated) {
      api.onVehiclesUpdated(fetchAll);
      return () => api.offVehiclesUpdated?.(fetchAll);
    }
  }, []);

  return { rtwPeriods, nefPeriods, specialDays };
}

function useDeptPatterns() {
  const [seqs, setSeqs] = useState<{ startDate: string; pattern: string[] }[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const raw = await (window as any).api.getDeptPatterns?.();
        const parsePattern = (pat: any) => {
          if (Array.isArray(pat)) return pat;
          if (typeof pat === 'string') return pat.split(',').map((s: string) => s.trim());
          return [];
        };
        const normDept = (arr: string[], len = 21) => (arr || []).slice(0, len).concat(Array(Math.max(0, len - (arr || []).length)).fill('1'));
        if (Array.isArray(raw)) {
          setSeqs(raw.map((p: any) => ({ startDate: p.startDate, pattern: normDept(parsePattern(p.pattern)) })));
        }
      } catch { }
    })();
  }, []);
  return seqs;
}

function computeActivePersonnelPerMonth(
  year: number,
  roster: any[],
  auswertungByType: Record<string, 'off' | 'tag' | 'nacht' | '24h' | 'itw'>,
  personnel: PersonnelStatsRow[],
  ue50Ids: Set<number>
) {
  const activeIds = new Set(personnel.map(p => p.id));
  const personnelById = new Map(personnel.map(p => [p.id, p]));
  const presentByMonth: Array<Set<number>> = Array.from({ length: 12 }, () => new Set());

  for (const row of (roster || [])) {
    try {
      if (String(row.personType) !== 'person') continue;
      const pid = Number(row.personId);
      if (!activeIds.has(pid)) continue;

      const val = String(row.value || '').trim();
      if (!val) continue;
      const evalMode = auswertungByType[val] || 'off';
      if (evalMode === 'off') continue;

      const iso = String(row.date);
      const m = new Date(iso + 'T00:00:00Z');
      const month = m.getUTCMonth();

      const person = personnelById.get(pid);
      if (!person || !isEligibleForStatsMonth(person, month)) {
        continue;
      }

      if (person.ue50Monthly?.[month] || person.lpalMonthly?.[month]) {
        continue;
      }

      presentByMonth[month].add(pid);
    } catch { }
  }

  return presentByMonth.map(set => set.size);
}

function computeShiftsPerPerson(row1: number[], row2: number[]) {
  return row1.map((num, i) => (row2[i] > 0 ? +(num / row2[i]).toFixed(2) : 0));
}

const ValuesPage: React.FC<{ departmentName?: string }> = ({ departmentName }) => {
  const [year, setYear] = useYear();
  const [department, setDepartment] = useState<number>(() => departmentNameToId(departmentName));
  const roster = useRoster(year, departmentName);
  const personnel = usePersonnel(year, departmentName);
  const azubis = useAzubis(departmentName);
  const guests = useGuests(year);
  const { currentUser } = useAuth();
  const ue50Ids = useUe50PersonnelIds(year, departmentName);
  const auswertungByType = useAuswertungByType();
  const { rtw, nef } = useVehicles(year);
  const { rtwActs, nefActs } = useVehicleActivations(year);
  const vehicleData = useVehicleData();
  const deptPatternSeqs = useDeptPatterns();
  const [shiftTransfers, setShiftTransfers] = useState<any[]>([]);

  useEffect(() => {
    setDepartment(departmentNameToId(departmentName));
  }, [departmentName]);

  useEffect(() => {
    const handler = (e: CustomEvent<{ department?: string }>) => {
      setDepartment(departmentNameToId(e.detail?.department));
    };
    window.addEventListener('rdplan-department-changed', handler as EventListener);
    return () => window.removeEventListener('rdplan-department-changed', handler as EventListener);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const transfers = await (window as any).api.getShiftTransfers(year);
        setShiftTransfers(Array.isArray(transfers) ? transfers : []);
      } catch { setShiftTransfers([]); }
    })();
  }, [year]);

  useEffect(() => {
    const handleYearChange = (e: any) => {
      if (e.detail?.year) {
        setYear(e.detail.year);
      }
    };
    window.addEventListener('rdplan-year-changed', handleYearChange);
    return () => window.removeEventListener('rdplan-year-changed', handleYearChange);
  }, [setYear]);

  const calculationResult = useMemo(() => {
    return calculateTargetsWithDetails(
      year,
      roster,
      personnel,
      azubis,
      ue50Ids,
      auswertungByType,
      { rtw, nef },
      { rtwActs, nefActs },
      department,
      deptPatternSeqs,
      undefined,
      shiftTransfers,
      vehicleData
    );
  }, [year, roster, personnel, azubis, ue50Ids, auswertungByType, rtw, nef, rtwActs, nefActs, department, deptPatternSeqs, shiftTransfers, vehicleData]);

  const perPersonAssignedMap = useMemo(() => {
    return computeAssignedShiftsPerPerson(year, roster, personnel, department, deptPatternSeqs, nef);
  }, [year, roster, personnel, department, deptPatternSeqs, nef]);

  const rowAzubis = calculationResult.azubiShifts;
  const rowUe50 = calculationResult.ue50Shifts;
  const rowItw = calculationResult.itwShifts;
  const row1Adj = calculationResult.positionsAdj;

  const perAzubiMaschinist = useMemo(() => {
    const countsByAzubi: Record<number, number[]> = {};
    const ensure = (id: number) => (countsByAzubi[id] ||= Array(12).fill(0));
    const reMasch = /^rtw\d+_(tag|nacht)_2$/;
    for (const row of (roster || [])) {
      try {
        if (String(row.personType) !== 'azubi') continue;
        const t = String(row.type || '');
        if (!reMasch.test(t)) continue;
        const iso = String(row.date);
        const m = new Date(iso + 'T00:00:00Z');
        const month = m.getUTCMonth();
        ensure(Number(row.personId))[month] += 1;
      } catch { }
    }
    const knownAzubiMap = new Map<number, any>((azubis || []).map(a => [Number(a.id), a]));
    const rows: { id: number | string; name: string; counts: number[]; isDeleted?: boolean }[] = [];

    // Bekannte Azubis
    (azubis || []).forEach(a => {
      rows.push({
        id: a.id,
        name: `${a.vorname ? a.vorname + ' ' : ''}${a.name} (Azubi)`.trim(),
        counts: countsByAzubi[a.id] || Array(12).fill(0)
      });
    });

    // Fallback-Zeilen für gelöschte / ehemalige Azubis mit Schichten
    for (const [idStr, counts] of Object.entries(countsByAzubi)) {
      const azId = Number(idStr);
      if (!knownAzubiMap.has(azId) && counts.some(c => c > 0)) {
        rows.push({
          id: `del_az_${azId}`,
          name: `Gelöschter Azubi (ID ${azId})`,
          counts,
          isDeleted: true
        });
      }
    }

    return rows;
  }, [roster, azubis]);

  const deletedPersonnelFallbackRows = useMemo(() => {
    const knownIds = new Set((personnel || []).map(p => Number(p.id)));
    const deletedCounts: Record<number, number[]> = {};
    const ensure = (id: number) => (deletedCounts[id] ||= Array(12).fill(0));

    for (const row of (roster || [])) {
      try {
        if (String(row.personType) !== 'person') continue;
        const pid = Number(row.personId);
        if (knownIds.has(pid)) continue;
        const t = String(row.type || '');
        const iso = String(row.date);
        if (!iso) continue;
        const month = new Date(iso + 'T00:00:00Z').getUTCMonth();
        if (/^rtw\d+_(tag|nacht)_(1|2)$/.test(t) || t.startsWith('itw_row_')) {
          ensure(pid)[month] += 1;
        } else if (/^nef(\d+)?_assist$/.test(t)) {
          const nefMatch = t.match(/^nef(\d+)?_assist$/);
          const nefIndex = nefMatch && nefMatch[1] ? Math.max(0, Number(nefMatch[1]) - 1) : 0;
          const nefObj = nef[nefIndex] as any;
          const mode = nefObj?.occupancyMode || nefObj?.occupancy_mode || '24h';
          ensure(pid)[month] += (mode === 'tag' ? 1 : 2);
        }
      } catch { }
    }

    const rows: { id: number; name: string; assigned: number[]; targets: number[]; isDeleted: boolean; fahrzeugfuehrerHLFB?: boolean; ue50?: boolean; vorname?: string }[] = [];
    for (const [idStr, counts] of Object.entries(deletedCounts)) {
      const pid = Number(idStr);
      if (counts.some(c => c > 0)) {
        rows.push({
          id: pid,
          name: `Gelöschter Mitarbeiter (ID ${pid})`,
          assigned: counts,
          targets: Array(12).fill(0),
          isDeleted: true
        });
      }
    }
    return rows;
  }, [roster, personnel, nef]);

  const perGuestPositions = useMemo(() => {
    const countsByGuest: Record<number, number[]> = {};
    const ensure = (id: number) => (countsByGuest[id] ||= Array(12).fill(0));
    const reSlot = /^(rtw\d+_(tag|nacht)_[12]|nef(\d+)?_assist)$/;
    for (const row of (roster || [])) {
      try {
        if (String(row.personType) !== 'guest') continue;
        const t = String(row.type || '');
        if (!reSlot.test(t)) continue;
        const iso = String(row.date);
        const m = new Date(iso + 'T00:00:00Z');
        const month = m.getUTCMonth();
        ensure(Number(row.personId))[month] += 1;
      } catch { }
    }
    const rows = (guests || []).map(g => ({
      id: g.id,
      name: `${g.name} (Gast)`.trim(),
      counts: countsByGuest[g.id] || Array(12).fill(0)
    }));
    return rows.filter(r => r.counts.some(c => c > 0));
  }, [roster, guests]);

  const rowGuests = useMemo(() => {
    const sums = Array(12).fill(0);
    for (const r of (perGuestPositions || [])) {
      r.counts.forEach((v, i) => { sums[i] += v; });
    }
    return sums;
  }, [perGuestPositions]);

  const row2 = useMemo(() => computeActivePersonnelPerMonth(year, roster, auswertungByType, personnel, ue50Ids), [year, roster, auswertungByType, personnel, ue50Ids]);
  const row3 = useMemo(() => computeShiftsPerPerson(row1Adj, row2), [row1Adj, row2]);

  const rowAvgCombined = useMemo(() => {
    const avgs = Array(12).fill(0);
    const rows = calculationResult.presence || [];
    for (let i = 0; i < 12; i++) {
      let sum = 0, cnt = 0;
      for (const r of rows) {
        const v = Number(r.counts[i] || 0);
        if (v > 0) { sum += v; cnt++; }
      }
      avgs[i] = cnt > 0 ? Math.round(sum / cnt) : 0;
    }
    return avgs;
  }, [calculationResult.presence]);

  const calculationDetails = calculationResult.detailsById;

  const wertePermission: 'none' | 'read' | 'read_all' | 'write' =
    (currentUser?.permissions?.werte as any) || 'none';
  const canReadAllWerte = wertePermission === 'read_all' || wertePermission === 'write';
  
  const visiblePersonnelRows = useMemo(() => {
    const eligible = (personnel || []).filter(p => {
      for (let m = 0; m < 12; m++) {
        if (isEligibleForStatsMonth(p, m)) return true;
      }
      return false;
    });
    if (canReadAllWerte) return eligible;
    if (wertePermission === 'read' && currentUser?.userId != null) {
      const currentUserId = Number(currentUser.userId);
      return eligible.filter(r => Number(r.id) === currentUserId);
    }
    return [];
  }, [personnel, canReadAllWerte, wertePermission, currentUser?.userId]);

  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(null);

  const fmt = (v: number) => new Intl.NumberFormat('de-DE').format(Number(v || 0));
  const fmtDec = (v: number) => new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(Number(v || 0));

  const getSollIstStyle = (targVal: number, istVal: number, hasTransfer: boolean = false) => {
    // 1. Both zeros: Muted Grey
    if (targVal === 0 && istVal === 0) {
      return {
        targetColor: 'var(--muted, #94a3b8)',
        targetWeight: 'normal' as const,
        istColor: 'var(--muted, #94a3b8)',
        istWeight: 'normal' as const,
        tooltipExtra: 'Kein Dienst / Kein Soll'
      };
    }

    // 2. Extra shifts without Soll (targVal == 0, istVal > 0)
    if (targVal === 0 && istVal > 0) {
      return {
        targetColor: 'var(--muted, #94a3b8)',
        targetWeight: 'normal' as const,
        istColor: '#6366f1',
        istWeight: 600 as const,
        tooltipExtra: `+${istVal} Zusatzschichten ohne Soll`
      };
    }

    // 3. Soll > 0
    const targetColor = hasTransfer ? 'var(--accent)' : 'var(--text)';
    const targetWeight = hasTransfer ? ('bold' as const) : ('normal' as const);
    const delta = istVal - targVal;

    if (istVal === 0) {
      return {
        targetColor,
        targetWeight,
        istColor: '#ef4444',
        istWeight: 600 as const,
        tooltipExtra: `Starkes Defizit: 0 von ${targVal} Schichten geleistet (-${targVal})`
      };
    }

    if (delta === 0) {
      return {
        targetColor,
        targetWeight,
        istColor: '#16a34a',
        istWeight: 600 as const,
        tooltipExtra: 'Soll exakt erfüllt (±0)'
      };
    }

    if (delta > 0) {
      return {
        targetColor,
        targetWeight,
        istColor: '#0284c7',
        istWeight: 600 as const,
        tooltipExtra: `Überhang: +${delta} ${delta === 1 ? 'Schicht' : 'Schichten'} über Soll`
      };
    }

    if (delta === -1) {
      return {
        targetColor,
        targetWeight,
        istColor: '#d97706',
        istWeight: 600 as const,
        tooltipExtra: 'Geringes Defizit: 1 Schicht unter Soll (-1)'
      };
    }

    return {
      targetColor,
      targetWeight,
      istColor: '#dc2626',
      istWeight: 600 as const,
      tooltipExtra: `Defizit: ${Math.abs(delta)} Schichten unter Soll (${delta})`
    };
  };

  const InfoIcon = ({ color = 'var(--primary)' }: { color?: string }) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ minWidth: 14, cursor: 'help' }}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );

  const AlertIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--status-warning)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ minWidth: 16 }}>
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );

  const styles = {
    table: { borderCollapse: 'separate', borderSpacing: 0, minWidth: 980, background: 'var(--bg-card)' } as React.CSSProperties,
    thSticky: { position: 'sticky' as const, top: 0, background: 'var(--hover)', color: 'var(--text)', zIndex: 2, borderBottom: '1px solid var(--line)', padding: '8px 10px', boxShadow: '0 1px 0 0 var(--line)' },
    thStickyName: { position: 'sticky' as const, top: 0, left: 0, background: 'var(--hover)', color: 'var(--text)', zIndex: 4, borderBottom: '1px solid var(--line)', borderRight: '1px solid var(--line)', padding: '8px 10px', boxShadow: '0 1px 0 0 var(--line)' },
    th: { borderBottom: '1px solid var(--line)', padding: '8px 10px', color: 'var(--text)' },
    nameSticky: { position: 'sticky' as const, left: 0, background: 'var(--bg-card)', color: 'var(--text)', zIndex: 3, borderBottom: '1px solid var(--line)', borderRight: '1px solid var(--line)', padding: '8px 10px', minWidth: 240, textAlign: 'left' },
    td: { borderBottom: '1px solid var(--line)', padding: '8px 10px', textAlign: 'right', color: 'var(--text)' } as React.CSSProperties,
    tdLeft: { borderBottom: '1px solid var(--line)', padding: '8px 10px', textAlign: 'left', color: 'var(--text)' } as React.CSSProperties,
    kpiRow: { background: 'var(--hover)' } as React.CSSProperties,
    zebra1: { background: 'var(--bg-card)' } as React.CSSProperties,
    zebra2: { background: 'var(--hover)' } as React.CSSProperties,
    sectionSep: { height: 8, background: 'var(--line)' } as React.CSSProperties,
    popupOverlay: {
      position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center'
    },
    popupContent: {
      background: 'var(--bg-card)', color: 'var(--text)', padding: 20, borderRadius: 8, maxWidth: '90vw', maxHeight: '90vh', overflow: 'auto',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)', border: '1px solid var(--line)'
    },
    closeBtn: {
      float: 'right' as const, cursor: 'pointer', fontSize: 20, fontWeight: 'bold', color: 'var(--muted)'
    }
  };

  const renderCalculationPopup = () => {
    if (selectedPersonId === null) return null;
    const details = calculationDetails[selectedPersonId];
    const person = personnel.find(p => p.id === selectedPersonId);
    if (!details || !person) return null;

    return (
      <div style={styles.popupOverlay} onClick={() => setSelectedPersonId(null)}>
        <div style={styles.popupContent} onClick={e => e.stopPropagation()}>
          <div style={styles.closeBtn} onClick={() => setSelectedPersonId(null)}>×</div>
          <h3 style={{ margin: '0 0 12px', color: 'var(--text)' }}>Soll-Berechnung für {person.vorname ? `${person.vorname} ` : ''}{person.name}</h3>
          {person.ue50 && (
            <div style={{
              marginBottom: 15,
              padding: '10px 12px',
              backgroundColor: 'var(--status-warning-bg)',
              color: 'var(--text)',
              border: '1px solid var(--line)',
              borderRadius: 6,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <AlertIcon />
              <span>Ü50-Qualifikation: Wird von der Soll-Berechnung ausgeschlossen.</span>
            </div>
          )}
          {!person.ue50 && person.fahrzeugfuehrerHLFB && (
            <div style={{
              marginBottom: 15,
              padding: '10px 12px',
              backgroundColor: 'var(--hover)',
              color: 'var(--text)',
              border: '1px solid var(--line)',
              borderRadius: 6,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <InfoIcon />
              <span>HLF-B Fahrzeugführer: Persönliches Gewicht wird mit 0,75 multipliziert.</span>
            </div>
          )}
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--hover)' }}>
                <th style={styles.th}>Monat</th>
                <th style={styles.th}>Pos. (Netto)</th>
                <th style={styles.th}>Gesamt-Gewicht</th>
                <th style={styles.th}>Pers. Gewicht</th>
                <th style={styles.th}>Anteil (Exakt)</th>
                <th style={styles.th}>Anteil (Floor)</th>
                <th style={styles.th}>Bonus</th>
                <th style={styles.th}>Final</th>
              </tr>
            </thead>
            <tbody>
              {details.map((d, i) => {
                const isHlfbMonth = person.hlfbMonthly ? person.hlfbMonthly[d.month] : false;
                const hasTransfer = (shiftTransfers || []).some((t: any) => {
                  if (t.to_person_id !== selectedPersonId) return false;
                  const [ty, tm] = (t.month || '').split('-').map(Number);
                  return ty === year && tm === (d.month + 1);
                });
                return (
                  <tr key={i} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={styles.tdLeft}>{monthNames[d.month]}</td>
                    <td style={styles.td}>{fmt(d.required)}</td>
                    <td style={styles.td}>{fmt(d.totalWeight)}</td>
                    <td style={{ ...styles.td, color: isHlfbMonth ? 'var(--accent)' : 'inherit', fontWeight: isHlfbMonth ? 'bold' : 'normal', background: isHlfbMonth ? 'var(--hover)' : 'transparent' }}>{fmt(d.personWeight)}</td>
                    <td style={{ ...styles.td, color: hasTransfer ? 'var(--accent)' : 'inherit', fontWeight: hasTransfer ? 'bold' : 'normal' }}>{fmtDec(d.exact)}</td>
                    <td style={styles.td}>{d.floor}</td>
                    <td style={styles.td}>{d.bonus > 0 ? '+1' : '-'}</td>
                    <td style={{ ...styles.td, fontWeight: 'bold', color: hasTransfer ? 'var(--accent)' : 'var(--text)' }}>{d.final}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div style={{ marginTop: 20, padding: 12, background: 'var(--hover)', border: '1px solid var(--line)', borderRadius: 6, fontSize: 13, lineHeight: 1.5, color: 'var(--text)' }}>
            <h4 style={{ marginTop: 0, marginBottom: 8, color: 'var(--text)' }}>Erklärung der Berechnung</h4>
            <ul style={{ paddingLeft: 20, margin: 0, color: 'var(--muted)' }}>
              <li><strong style={{ color: 'var(--text)' }}>Pos. (Netto):</strong> Gesamtzahl der zu besetzenden Schichten im Monat. <br />
                <em>Formel: (Abteilungsschichten × (RTW×4 + NEF×Besetzung)) + ITW − Azubi-Maschinisten − Ü50-Schichten.</em></li>
              <li><strong style={{ color: 'var(--text)' }}>Pers. Gewicht:</strong> Anzahl der Dienste, die die Person in diesem Monat tatsächlich geleistet hat (Anwesenheit). <br />
                <em>Bei HLF-B Fahrzeugführern wird dieser Wert mit 0,75 multipliziert.</em></li>
              <li><strong style={{ color: 'var(--text)' }}>Gesamt-Gewicht:</strong> Summe der Gewichte aller aktiven Mitarbeiter in diesem Monat.</li>
              <li><strong style={{ color: 'var(--text)' }}>Anteil (Exakt):</strong> Der rechnerische Anteil an den Soll-Schichten. <br />
                <em>Formel: (Pos. Netto × Pers. Gewicht) ÷ Gesamt-Gewicht.</em></li>
              <li><strong style={{ color: 'var(--text)' }}>Anteil (Floor):</strong> Der abgerundete ganzzahlige Anteil (Basis-Soll).</li>
              <li><strong style={{ color: 'var(--text)' }}>Bonus:</strong> Verteilung der Rest-Schichten nach dem Hamilton-Verfahren (größte Nachkommastellen erhalten +1), bis die Summe der Soll-Schichten exakt den Netto-Positionen entspricht.</li>
              <li><strong style={{ color: 'var(--text)' }}>Final:</strong> Das endgültige Soll für diesen Monat (Floor + Bonus).</li>
            </ul>
          </div>
        </div>
      </div>
    );
  };

  const totalTargetsPerMonth = useMemo(() => {
    const sums = Array(12).fill(0);
    for (const targets of Object.values(calculationResult.targetsById)) {
      targets.forEach((v, i) => { sums[i] += v; });
    }
    return sums;
  }, [calculationResult.targetsById]);

  const sumPositionsYear = useMemo(() => (row1Adj || []).reduce((a, b) => a + (Number(b) || 0), 0), [row1Adj]);
  const sumTargetsYear = useMemo(() => (totalTargetsPerMonth || []).reduce((a, b) => a + (Number(b) || 0), 0), [totalTargetsPerMonth]);

  return (
    <div className="page-container">
      {renderCalculationPopup()}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
        <h2 className="page-header" style={{ margin: 0 }}>Werte – {year}{departmentName ? ` – ${departmentName}` : ''}</h2>
        {/* Ampel Legende */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          fontSize: '12px',
          background: 'var(--bg-card)',
          padding: '6px 12px',
          borderRadius: 8,
          border: '1px solid var(--line)',
          color: 'var(--text)'
        }}>
          <span style={{ fontWeight: 600, color: 'var(--muted)', marginRight: 2 }}>Ampel (Soll | Ist):</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#16a34a' }} />
            <span>Im Soll</span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#0284c7' }} />
            <span>Plus</span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#d97706' }} />
            <span>-1 Schicht</span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#dc2626' }} />
            <span>Defizit</span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#94a3b8' }} />
            <span style={{ color: '#94a3b8' }}>0 / Kein Dienst</span>
          </span>
        </div>
      </div>
      <div className="page-content" style={{ overflow: 'auto', maxHeight: '74vh', border: '1px solid var(--line)', borderRadius: 10, position: 'relative', paddingTop: 0 }}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.thStickyName as any}>Name</th>
              {monthNames.map((m, i) => (
                <th key={i} style={styles.thSticky as any}>{m}</th>
              ))}
              <th style={styles.thSticky as any}>Summe</th>
            </tr>
          </thead>
          <tbody>
            {/* SECTION 1: GESAMTWERTE & STATIONSÜBERSICHT */}
            <tr key="section-gesamtwerte">
              <td
                colSpan={monthNames.length + 2}
                style={{
                  background: 'linear-gradient(90deg, #0284c7 0%, #0ea5e9 100%)',
                  color: '#ffffff',
                  padding: '10px 14px',
                  fontWeight: 700,
                  fontSize: '0.95em',
                  letterSpacing: '0.3px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                }}
              >
                GESAMTWERTE & STATIONSÜBERSICHT
              </td>
            </tr>

            <tr title="Gesamtzahl aller zu besetzenden Schichten im Monat (RTW, NEF, ITW) abzüglich der von Azubis, Gästen und Ü50-Personal besetzten Schichten.">
              <td style={{ ...(styles.nameSticky as any), ...styles.kpiRow }}>
                <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>Positionen gesamt (netto)</span>
                  <InfoIcon />
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Abteilungsschichten × (RTW×4 + NEF×2) + ITW − Gast/Azubis − Ü50</div>
              </td>
              {row1Adj.map((v, i) => <td key={i} style={{ ...styles.td, ...styles.kpiRow }}>{fmt(v)}</td>)}
              <td style={{ ...styles.td, ...styles.kpiRow }}>{fmt(sumPositionsYear)}</td>
            </tr>

            <tr title="Anzahl der aktiven Mitarbeiter, die in diesem Monat mindestens eine Schicht leisten (ohne Ü50/LPAL).">
              <td style={{ ...(styles.nameSticky as any), ...styles.kpiRow }}>
                <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>Anzahl Personal (gewichtet)</span>
                  <InfoIcon />
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Stammpersonal mit mind. einer Schicht (Auswertung ≠ off); HLF‑B ungewichtet gezählt</div>
              </td>
              {row2.map((v, i) => <td key={i} style={{ ...styles.td, ...styles.kpiRow }}>{fmt(v)}</td>)}
              <td style={{ ...styles.td, ...styles.kpiRow }} />
            </tr>

            <tr title="Summe aller Einsätze von Gästen sowie Azubis auf Maschinist-Positionen in diesem Monat.">
              <td style={{ ...(styles.nameSticky as any), ...styles.kpiRow }}>
                <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>Anzahl Gast / Azubis</span>
                  <InfoIcon />
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Summe der Gast- und Azubi-Maschinist-Einsätze je Monat</div>
              </td>
              {rowAzubis.map((v, i) => <td key={i} style={{ ...styles.td, ...styles.kpiRow }}>{fmt(v + (rowGuests[i] || 0))}</td>)}
              <td style={{ ...styles.td, ...styles.kpiRow }} />
            </tr>

            <tr title="Summe aller Schichten von Kolleginnen und Kollegen mit Ü50- oder LPAL-Qualifikation in diesem Monat.">
              <td style={{ ...(styles.nameSticky as any), ...styles.kpiRow }}>
                <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>Anzahl Ü50-Schichten</span>
                  <InfoIcon />
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Summe aller Ü50-Personen-Einsätze je Monat (alle Positionen)</div>
              </td>
              {rowUe50.map((v, i) => <td key={i} style={{ ...styles.td, ...styles.kpiRow }}>{fmt(v)}</td>)}
              <td style={{ ...styles.td, ...styles.kpiRow }} />
            </tr>

            <tr title="Anzahl aller im Dienstplan geplanten Schichten auf dem ITW (Integrierter Behandlungs- und Wirkstoffplan).">
              <td style={{ ...(styles.nameSticky as any), ...styles.kpiRow }}>
                <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>ITW‑Schichten</span>
                  <InfoIcon />
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Summe aller ITW‑Einsätze (Slot oder Auswertung = ITW)</div>
              </td>
              {rowItw.map((v, i) => <td key={i} style={{ ...styles.td, ...styles.kpiRow }}>{fmt(v)}</td>)}
              <td style={{ ...styles.td, ...styles.kpiRow }} />
            </tr>

            <tr title="Durchschnittliche Schichtanzahl (24h- und ITW-Dienste) pro aktiver Person in diesem Monat.">
              <td style={{ ...(styles.nameSticky as any), ...styles.kpiRow }}>
                <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>Mittelwert (24h + ITW)</span>
                  <InfoIcon />
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Durchschnitt pro Monat über Personen mit {'>'} 0 (gerundet)</div>
              </td>
              {rowAvgCombined.map((v, i) => <td key={i} style={{ ...styles.td, ...styles.kpiRow }}>{fmt(v)}</td>)}
              <td style={{ ...styles.td, ...styles.kpiRow }} />
            </tr>

            <tr title="Rechnerischer Richtwert: Netto-Positionen dividiert durch die Anzahl des aktiven Personals.">
              <td style={{ ...(styles.nameSticky as any), ...styles.kpiRow }}>
                <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>Schichten je Person</span>
                  <InfoIcon />
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Positionen gesamt ÷ Anzahl Personal</div>
              </td>
              {row3.map((v, i) => <td key={i} style={{ ...styles.td, ...styles.kpiRow }}>{fmt(v)}</td>)}
              <td style={{ ...styles.td, ...styles.kpiRow }} />
            </tr>

            {/* KONTROLLE */}
            <tr title="Vergleich zwischen den tatsächlich benötigten Netto-Schichtpositionen (links) und der Summe aller vergebenen Personen-Soll-Schichten (rechts). Grüner Hintergrund zeigt exakte Übereinstimmung.">
              <td style={{ ...(styles.nameSticky as any), ...styles.kpiRow }}>
                <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>Kontrolle: Positionen vs. Soll</span>
                  <InfoIcon />
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Markiert = Vergleich Positionen zu Soll</div>
              </td>
              {row1Adj.map((pos, i) => {
                const soll = totalTargetsPerMonth[i] || 0;
                const ok = Number(pos || 0) === Number(soll || 0);
                const bg = ok ? 'var(--status-success-bg)' : 'var(--bg-card)';
                const border = '1px solid var(--line)';
                return (
                  <td key={i} style={{ ...styles.td, ...styles.kpiRow, background: bg, border }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                      <span>{fmt(pos)}</span>
                      <span style={{ color: 'var(--muted)' }}>|</span>
                      <span style={{ color: ok ? 'var(--status-success)' : 'var(--text)', fontWeight: ok ? 600 : 400 }}>{fmt(soll)}</span>
                    </div>
                  </td>
                );
              })}
              {(() => {
                const ok = Number(sumPositionsYear || 0) === Number(sumTargetsYear || 0);
                const bg = ok ? 'var(--status-success-bg)' : 'var(--bg-card)';
                const border = '1px solid var(--line)';
                return (
                  <td style={{ ...styles.td, ...styles.kpiRow, background: bg, border }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                      <span>{fmt(sumPositionsYear)}</span>
                      <span style={{ color: 'var(--muted)' }}>|</span>
                      <span style={{ color: ok ? 'var(--status-success)' : 'var(--text)', fontWeight: ok ? 600 : 400 }}>{fmt(sumTargetsYear)}</span>
                    </div>
                  </td>
                );
              })()}
            </tr>

            {/* SECTION 2: PERSÖNLICHE WERTE */}
            <tr key="section-persoenlich-header">
              <td
                colSpan={monthNames.length + 2}
                style={{
                  background: 'linear-gradient(90deg, #15803d 0%, #22c55e 100%)',
                  color: '#ffffff',
                  padding: '10px 14px',
                  fontWeight: 700,
                  fontSize: '0.95em',
                  letterSpacing: '0.3px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                }}
              >
                PERSÖNLICHE WERTE — STAMMPERSONAL & EINSATZKRÄFTE (Soll | Ist)
              </td>
            </tr>

            {[...visiblePersonnelRows, ...(canReadAllWerte ? deletedPersonnelFallbackRows : [])].map(row => {
              const isDeleted = (row as any).isDeleted === true;
              const assigned = isDeleted ? (row as any).assigned : (perPersonAssignedMap[row.id] || Array(12).fill(0));
              const sumAssigned = assigned.reduce((a: number, b: number) => a + b, 0);
              const targets = isDeleted ? (row as any).targets : (calculationResult.targetsById[row.id] || Array(12).fill(0));
              const sumTargets = targets.reduce((a: number, b: number) => a + b, 0);
              const nameColor = isDeleted ? 'var(--muted)' : row.fahrzeugfuehrerHLFB ? 'var(--accent)' : undefined;
              const displayName = isDeleted ? row.name : `${row.vorname ? `${row.vorname} ` : ''}${row.name}`.trim();
              const quicktipText = isDeleted
                ? `Altdaten für ${displayName} (Mitarbeiter nicht mehr im aktiven Personalbestand): Tatsächlich geleistete Schichten = ${sumAssigned}.`
                : `Persönliche Werte von ${displayName}: Links = Berechnetes Schichtsoll laut Verteilungsschlüssel (Soll). Rechts = Tatsächlich geleistete Schichten (Ist). Klicken für Details zur Soll-Berechnung.`;

              return (
                <tr key={isDeleted ? `del_p_${row.id}` : row.id} style={Number(row.id) % 2 === 0 ? styles.zebra1 : styles.zebra2} title={quicktipText}>
                  <td
                    style={{
                      ...(styles.nameSticky as any),
                      color: nameColor,
                      fontStyle: isDeleted ? 'italic' : undefined,
                      fontWeight: (!isDeleted && row.ue50) ? 600 : undefined,
                      cursor: isDeleted ? 'default' : 'pointer',
                      textDecoration: isDeleted ? 'none' : 'underline'
                    }}
                    onClick={() => {
                      if (!isDeleted) setSelectedPersonId(row.id);
                    }}
                    title={isDeleted ? quicktipText : `Klicken für Details zur Soll-Berechnung von ${displayName}`}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>{displayName}</span>
                      {isDeleted ? <AlertIcon /> : <InfoIcon color="var(--status-success)" />}
                    </div>
                  </td>
                  {assigned.map((istVal: number, i: number) => {
                    const targVal = targets[i] || 0;
                    const hasTransfer = !isDeleted && (shiftTransfers || []).some((t: any) => {
                      if (t.to_person_id !== row.id) return false;
                      const [ty, tm] = (t.month || '').split('-').map(Number);
                      return ty === year && tm === (i + 1);
                    });
                    const cellStyle = getSollIstStyle(targVal, istVal, hasTransfer);

                    return (
                      <td key={i} style={styles.td} title={`${monthNames[i]}: ${fmt(targVal)} Soll | ${fmt(istVal)} Ist (${cellStyle.tooltipExtra})`}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                          <span style={{ color: cellStyle.targetColor, fontWeight: cellStyle.targetWeight }}>
                            {targVal ? fmt(targVal) : <span style={{ color: '#94a3b8' }}>0</span>}
                          </span>
                          <span style={{ color: '#cbd5e1', fontSize: '10px' }}>|</span>
                          <span style={{ color: cellStyle.istColor, fontWeight: cellStyle.istWeight }}>
                            {istVal ? fmt(istVal) : <span style={{ color: targVal === 0 ? '#94a3b8' : '#ef4444', fontWeight: targVal === 0 ? 'normal' : 600 }}>0</span>}
                          </span>
                        </div>
                      </td>
                    );
                  })}
                  {(() => {
                    const sumStyle = getSollIstStyle(sumTargets, sumAssigned, false);
                    return (
                      <td style={styles.td} title={`Jahressumme ${displayName}: ${fmt(sumTargets)} Soll | ${fmt(sumAssigned)} Ist (${sumStyle.tooltipExtra})`}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                          <span style={{ color: sumTargets > 0 ? 'var(--accent)' : '#94a3b8', fontWeight: 600 }}>
                            {fmt(sumTargets)}
                          </span>
                          <span style={{ color: '#cbd5e1', fontSize: '10px' }}>|</span>
                          <span style={{ color: sumStyle.istColor, fontWeight: 700 }}>
                            {fmt(sumAssigned)}
                          </span>
                        </div>
                      </td>
                    );
                  })()}
                </tr>
              );
            })}
            {/* SUBSECTION: GAST / AZUBIS */}
            {canReadAllWerte && (
              <>
                <tr key="section-azubis-header">
                  <td
                    colSpan={monthNames.length + 2}
                    style={{
                      background: 'linear-gradient(90deg, #b45309 0%, #d97706 100%)',
                      color: '#ffffff',
                      padding: '10px 14px',
                      fontWeight: 700,
                      fontSize: '0.95em',
                      letterSpacing: '0.3px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                    }}
                  >
                    GAST-EINSÄTZE & AZUBI-MASCHINISTEN
                  </td>
                </tr>
                {[...perGuestPositions, ...perAzubiMaschinist].map((row, idx) => {
                  const sum = row.counts.reduce((a, b) => a + b, 0);
                  const isDel = (row as any).isDeleted === true;
                  const guestQuicktip = isDel
                    ? `Altdaten für ${row.name} (Azubi nicht mehr im aktiven Bestand): ${sum} geleistete Maschinist-Einsätze.`
                    : `Geleistete Einsätze von ${row.name} auf Gast- oder Azubi-Maschinist-Positionen.`;
                  return (
                    <tr key={`ga_${idx}_${row.id}`} style={idx % 2 === 0 ? styles.zebra1 : styles.zebra2} title={guestQuicktip}>
                      <td style={{
                        ...(styles.nameSticky as any),
                        color: isDel ? 'var(--muted)' : undefined,
                        fontStyle: isDel ? 'italic' : undefined
                      }} title={guestQuicktip}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>{row.name}</span>
                          {isDel ? <AlertIcon /> : <InfoIcon color="var(--status-warning)" />}
                        </div>
                      </td>
                      {row.counts.map((v, i) => (
                        <td key={i} style={styles.td} title={`${monthNames[i]}: ${v ? fmt(v) : '0'} Einsätze`}>
                          {v ? <span style={{ color: '#0284c7', fontWeight: 600 }}>{fmt(v)}</span> : <span style={{ color: '#94a3b8' }}>0</span>}
                        </td>
                      ))}
                      <td style={styles.td} title={`Jahressumme: ${sum ? fmt(sum) : '0'} Einsätze`}>
                        {sum ? <span style={{ color: '#0284c7', fontWeight: 700 }}>{fmt(sum)}</span> : <span style={{ color: '#94a3b8' }}>0</span>}
                      </td>
                    </tr>
                  );
                })}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ValuesPage;
