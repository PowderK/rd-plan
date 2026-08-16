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
        (window as any).api.getSetting?.('rettungsdienst_qualification_type')
      ]);

      const deptPeriodsByPerson = indexDepartmentPeriodsByPerson(
        Array.isArray(allDeptPeriods) ? allDeptPeriods : []
      );

      const hlfbQualName = String(hlfbQualSetting || 'FzF HLF B');
      const ue50QualName = String(ue50QualSetting || 'Ü50');
      const lpalQualName = String(lpalQualSetting || 'LPAL');
      const rettungsdienstQualName = String(rdQualSetting || 'Rettungsdienst'); // Neue Grundqualifikation

      const periodsByPerson: Record<number, any[]> = {};
      if (Array.isArray(allPeriods)) {
        allPeriods.forEach((p: any) => {
          if (!periodsByPerson[p.personId]) periodsByPerson[p.personId] = [];
          periodsByPerson[p.personId].push(p);
        });
      }

      const enriched = (Array.isArray(rawList) ? rawList : []).map((p: any) => {
        const pPeriods = periodsByPerson[p.id] || [];

        const hlfbMonthly = Array(12).fill(false);
        const ue50Monthly = Array(12).fill(false);
        const lpalMonthly = Array(12).fill(false);
        const rettungsdienstMonthly = Array(12).fill(false);

        // Filter periods relevant for HLF-B
        const hlfbPeriods = pPeriods.filter((per: any) => per.qualType === hlfbQualName);
        const hasHlfbPeriod = hlfbPeriods.length > 0;

        // Filter periods relevant for Ü50
        const ue50Periods = pPeriods.filter((per: any) => per.qualType === ue50QualName);
        const hasUe50Period = ue50Periods.length > 0;

        // Filter periods relevant for LPAL
        const lpalPeriods = pPeriods.filter((per: any) => per.qualType === lpalQualName);
        const hasLpalPeriod = lpalPeriods.length > 0;

        // Filter periods relevant for Rettungsdienst
        const rettungsdienstPeriods = pPeriods.filter((per: any) => per.qualType === rettungsdienstQualName);
        const hasRettungsdienstPeriod = rettungsdienstPeriods.length > 0;

        const qualApplies = (periods: any[], ym: string) =>
          periods.some((per: any) => qualificationAppliesInMonth(per, ym));

        if (hasHlfbPeriod) {
          for (let m = 0; m < 12; m++) {
            hlfbMonthly[m] = qualApplies(hlfbPeriods, yearMonthKey(year, m));
          }
        }

        if (hasUe50Period) {
          for (let m = 0; m < 12; m++) {
            ue50Monthly[m] = qualApplies(ue50Periods, yearMonthKey(year, m));
          }
        }

        if (hasLpalPeriod) {
          for (let m = 0; m < 12; m++) {
            lpalMonthly[m] = qualApplies(lpalPeriods, yearMonthKey(year, m));
          }
        }

        if (hasRettungsdienstPeriod) {
          for (let m = 0; m < 12; m++) {
            rettungsdienstMonthly[m] = qualApplies(rettungsdienstPeriods, yearMonthKey(year, m));
          }
        } else {
          rettungsdienstMonthly.fill(false);
        }

        const deptActiveMonthly = buildDepartmentActiveMonthly(
          p.id,
          year,
          deptPeriodsByPerson,
          departmentName
        );

        // Statisches Flag als Fallback
        const staticFlag = p.fahrzeugfuehrerHLFB === 1 || p.fahrzeugfuehrerHLFB === true || p.fahrzeugfuehrerHLFB === '1' ||
          p.fahrzeugfuehrer_hlf_b === 1 || p.fahrzeugfuehrer_hlf_b === true || p.fahrzeugfuehrer_hlf_b === '1';

        // Wenn keine HLF-B Perioden gefunden wurden, aber das statische Flag gesetzt ist, gilt es für das ganze Jahr
        if (!hasHlfbPeriod && staticFlag) {
          hlfbMonthly.fill(true);
        }

        return {
          ...p,
          fahrzeugfuehrerHLFB: hlfbMonthly.some(b => b),
          hlfbMonthly,
          ue50: ue50Monthly.some(b => b),
          ue50Monthly,
          lpal: lpalMonthly.some(b => b),
          lpalMonthly,
          rettungsdienst: rettungsdienstMonthly.some(b => b),
          rettungsdienstMonthly,
          deptActiveMonthly
        };
      });

      setList(enriched);
    } catch { setList([]); }
  };
  useEffect(() => {
    fetch();
    const api = (window as any).api;
    if (api.onPersonnelUpdated) {
      api.onPersonnelUpdated(fetch);
      return () => api.offPersonnelUpdated(fetch);
    }
  }, [year, departmentName]); // Re-fetch when year or department changes
  return list;
}

function useAzubis(departmentName?: string) {
  const [list, setList] = useState<{ id: number; name: string; vorname: string }[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const r = await (window as any).api.getAzubiList?.(departmentName);
        setList(Array.isArray(r) ? r : []);
      } catch { setList([]); }
    })();
  }, [departmentName]);
  return list;
}

function useGuests(year: number) {
  const [list, setList] = useState<{ id: number; name: string; date: string }[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const r = await (window as any).api.getAllGuests?.(year);
        setList(Array.isArray(r) ? r : []);
      } catch { setList([]); }
    })();
  }, [year]);
  return list;
}

function useUe50PersonnelIds(year: number, departmentName?: string) {
  const [ue50Ids, setUe50Ids] = useState<Set<number>>(new Set());
  useEffect(() => {
    (async () => {
      try {
        // Lade Ü50 und LPAL Qualifikationstypen aus Settings
        let ue50QualName = 'Ü50';
        const setting = await (window as any).api.getSetting('ue50_qualification_type');
        if (setting) ue50QualName = String(setting);

        let lpalQualName = 'LPAL';
        const lpalSetting = await (window as any).api.getSetting('lpal_qualification_type');
        if (lpalSetting) lpalQualName = String(lpalSetting);

        const personnel = await (window as any).api.getPersonnelList?.(false, String(year), departmentName) || [];
        const ids = new Set<number>();

        // Für jede Person prüfen, ob sie Ü50- oder LPAL-Qualifikation hat
        for (const person of personnel) {
          try {
            const periods = await (window as any).api.getQualificationPeriods?.(person.id) || [];

            // Prüfe für jeden Monat des Jahres
            for (let month = 0; month < 12; month++) {
              const yearMonth = `${year}-${String(month + 1).padStart(2, '0')}`;
              const hasUe50OrLpal = periods.some((p: any) =>
                p.active &&
                (p.qualType === ue50QualName || p.qualType === lpalQualName) &&
                p.startYM <= yearMonth &&
                (!p.endYM || p.endYM >= yearMonth)
              );
              if (hasUe50OrLpal) {
                ids.add(person.id);
                break; // Einmal gefunden reicht
              }
            }
          } catch { }
        }
        setUe50Ids(ids);
      } catch { setUe50Ids(new Set()); }
    })();
  }, [year, departmentName]);
  return ue50Ids;
}

function useAuswertungByType() {
  const [map, setMap] = useState<Record<string, 'off' | 'tag' | 'nacht' | '24h' | 'itw'>>({});
  useEffect(() => {
    (async () => {
      try {
        const types = await (window as any).api.getShiftTypes?.();
        const m: Record<string, 'off' | 'tag' | 'nacht' | '24h' | 'itw'> = {};
        for (const t of (types || [])) {
          const v = await (window as any).api.getSetting?.(`auswertung_${t.code}`);
          m[t.code] = (v === 'tag' || v === 'nacht' || v === '24h' || v === 'itw') ? v : 'off';
        }
        setMap(m);
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
      try { const r = await (window as any).api.getRtwVehicles?.(); if (Array.isArray(r)) setRtw(r); } catch { }
      try { const n = await (window as any).api.getNefVehicles?.(); if (Array.isArray(n)) setNef(n); } catch { }
    })();
  }, [year]);
  return { rtw, nef };
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
        const normDept = (arr: string[], len = 21) => (arr || []).slice(0, len).concat(Array(Math.max(0, len - (arr || []).length)).fill('1'));
        if (Array.isArray(raw)) {
          setSeqs(raw.map((p: any) => ({ startDate: p.startDate, pattern: normDept(p.pattern || []) })));
        }
      } catch { }
    })();
  }, []);
  return seqs;
}

function getDeptDayFor(dateObj: Date, seqs: { startDate: string, pattern: string[] }[]): string | undefined {
  const iso = new Date(Date.UTC(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate())).toISOString().slice(0, 10);
  if (!seqs || seqs.length === 0) return undefined;
  const sorted = [...seqs].sort((a, b) => a.startDate.localeCompare(b.startDate));
  let active = sorted[0];
  for (const s of sorted) { if (s.startDate <= iso) active = s; else break; }
  const start = new Date((active?.startDate || '1970-01-01') + 'T00:00:00Z');
  const diffDays = Math.floor((new Date(iso + 'T00:00:00Z').getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const pat = active?.pattern || [];
  return pat.length ? pat[((diffDays % 21) + 21) % 21] : undefined;
}

function computeDeptShiftsPerMonth(year: number, department: number, seqs: { startDate: string; pattern: string[] }[]) {
  const counts: number[] = Array(12).fill(0);
  for (let m = 0; m < 12; m++) {
    const daysInMonth = new Date(year, m + 1, 0).getDate();
    let cnt = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(year, m, d);
      const depDay = getDeptDayFor(dateObj, seqs);
      if (depDay && String(department) === depDay) cnt++;
    }
    counts[m] = cnt;
  }
  return counts;
}

function computePositionsPerMonth(
  year: number,
  department: number,
  vehicles: { rtw: { id: number }[]; nef: { id: number; occupancyMode?: '24h' | 'tag' }[] },
  vehicleData: { rtwPeriods: Record<number, VehiclePeriod[]>; nefPeriods: Record<number, VehiclePeriod[]>; specialDays: VehicleSpecialDay[] },
  deptPatternSeqs: { startDate: string; pattern: string[] }[],
  itwShifts: number[]
) {
  const positions: number[] = Array(12).fill(0);

  for (let m = 0; m < 12; m++) {
    const daysInMonth = new Date(year, m + 1, 0).getDate();
    let monthTotal = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(year, m, d);
      const dateStr = `${year}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const depDay = getDeptDayFor(dateObj, deptPatternSeqs);
      const isDeptDay = depDay && String(department) === depDay;

      // RTWs
      for (const v of (vehicles?.rtw || [])) {
        if (!v) continue;
        const vPeriods = (vehicleData?.rtwPeriods) ? vehicleData.rtwPeriods[v.id] || [] : [];
        const vSpec = (vehicleData?.specialDays || []).filter(s => s && (s.vehicleType || 'rtw') === 'rtw' && Number(s.vehicleId) === Number(v.id));
        const isReserve = (v as any).category === 'reserve';
        const status = isVehicleActiveOnDate(dateStr, vPeriods, vSpec, isReserve);

        if (status.active) {
          if (status.isSpecialDay) {
            if (status.shiftMode === 'tag' || status.shiftMode === 'nacht') {
              monthTotal += 2;
            } else {
              monthTotal += 4;
            }
          } else if (isDeptDay) {
            monthTotal += 4;
          }
        }
      }

      // NEFs
      for (const v of (vehicles?.nef || [])) {
        if (!v) continue;
        const vPeriods = (vehicleData?.nefPeriods) ? vehicleData.nefPeriods[v.id] || [] : [];
        const vSpec = (vehicleData?.specialDays || []).filter(s => s && (s.vehicleType || 'nef') === 'nef' && Number(s.vehicleId) === Number(v.id));
        const isReserve = (v as any).category === 'reserve';
        const status = isVehicleActiveOnDate(dateStr, vPeriods, vSpec, isReserve);

        if (status.active) {
          const defaultSlots = (v.occupancyMode === 'tag') ? 1 : 2;
          if (status.isSpecialDay) {
            if (status.shiftMode === 'tag' || status.shiftMode === 'nacht') {
              monthTotal += 1;
            } else {
              monthTotal += 2;
            }
          } else if (isDeptDay) {
            monthTotal += defaultSlots;
          }
        }
      }
    }

    positions[m] = monthTotal + (itwShifts[m] || 0);
  }

  return positions;
}

function computeActivePersonnelPerMonth(
  year: number,
  roster: any[],
  auswertungByType: Record<string, 'off' | 'tag' | 'nacht' | '24h' | 'itw'>,
  personnel: PersonnelStatsRow[],
  ue50Ids: Set<number>
) {
  // Ermittelt Anwesenheit pro Monat und zählt UNGEWICHTET: jede Person mit >0 Präsenz zählt 1
  // Ü50-Personen werden monatsweise ausgeschlossen (wie Azubis)
  // NEU: Nur Personal MIT Rettungsdienst-Qualifikation wird gezählt!
  const activeIds = new Set(personnel.map(p => p.id));
  const personnelById = new Map(personnel.map(p => [p.id, p]));
  const presentByMonth: Array<Set<number>> = Array.from({ length: 12 }, () => new Set());

  for (const row of (roster || [])) {
    try {
      if (String(row.personType) !== 'person') continue;
      const pid = Number(row.personId);

      // Filter: Person muss im aktuellen Personalstamm sein
      if (!activeIds.has(pid)) continue;

      const val = String(row.value || '').trim();
      if (!val) continue;
      const evalMode = auswertungByType[val] || 'off';
      if (evalMode === 'off') continue;

      const iso = String(row.date);
      const m = new Date(iso + 'T00:00:00Z');
      const month = m.getUTCMonth();

      // NEU: Prüfe ob Person in diesem Monat Rettungsdienst-Qualifikation hat
      const person = personnelById.get(pid);
      if (!person || !isEligibleForStatsMonth(person, month)) {
        continue;
      }

      // Ü50 / LPAL in diesem Monat ausschließen
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
  const vehicleData = useVehicleData();
  const deptPatternSeqs = useDeptPatterns();

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
  const [shiftTransfers, setShiftTransfers] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const transfers = await (window as any).api.getShiftTransfers(year);
        setShiftTransfers(Array.isArray(transfers) ? transfers : []);
      } catch { setShiftTransfers([]); }
    })();
  }, [year]);

  // Reagiere auf Jahr-Änderungen von DutyRoster
  useEffect(() => {
    const handleYearChange = (e: any) => {
      if (e.detail?.year) {
        setYear(e.detail.year);
      }
    };
    window.addEventListener('rdplan-year-changed', handleYearChange);
    return () => window.removeEventListener('rdplan-year-changed', handleYearChange);
  }, [setYear]);

  const rowItw = useMemo(() => {
    const sums = Array(12).fill(0);
    const activeIds = new Set(personnel.map(p => p.id));
    for (const row of (roster || [])) {
      try {
        // Nur Stammpersonal zählen, keine Ärzte/Azubis
        if (String(row.personType) !== 'person') continue;

        // Nur aktives Personal zählen (das auch in der Liste angezeigt wird)
        const pid = Number(row.personId);
        if (!activeIds.has(pid)) continue;

        const iso = String(row.date);
        if (!iso) continue;
        const m = new Date(iso + 'T00:00:00Z').getUTCMonth();
        const t = String(row.type || '');
        const code = String(row.value || '').trim();
        if (t.startsWith('itw_') || (code && auswertungByType[code] === 'itw')) {
          sums[m] += 1;
        }
      } catch { }
    }
    return sums;
  }, [roster, auswertungByType, personnel]);

  const deptShifts = useMemo(() => computeDeptShiftsPerMonth(year, department, deptPatternSeqs), [year, department, JSON.stringify(deptPatternSeqs)]);

  const row1 = useMemo(
    () => computePositionsPerMonth(year, department, { rtw, nef }, vehicleData, deptPatternSeqs, rowItw),
    [year, department, rtw, nef, vehicleData, deptPatternSeqs, rowItw]
  );
  const row2 = useMemo(() => computeActivePersonnelPerMonth(year, roster, auswertungByType, personnel, ue50Ids), [year, roster, auswertungByType, personnel, ue50Ids]);

  const perPerson24h = useMemo(() => {
    const countsByPerson: Record<number, number[]> = {};
    const ensure = (pid: number) => (countsByPerson[pid] ||= Array(12).fill(0));
    const personnelById = new Map((personnel || []).map(p => [p.id, p]));
    for (const row of (roster || [])) {
      try {
        if (String(row.personType) !== 'person') continue;
        const pid = Number(row.personId);
        const iso = String(row.date);
        const m = new Date(iso + 'T00:00:00Z');
        const month = m.getUTCMonth();
        const p = personnelById.get(pid);
        if (p?.ue50Monthly?.[month] || p?.lpalMonthly?.[month]) continue; // Ü50 in diesem Monat ausschließen
        const code = String(row.value || '').trim();
        if (!code) continue;
        if (auswertungByType[code] !== '24h') continue;
        ensure(pid)[month] += 1;
      } catch { }
    }
    const rows = (personnel || []).map(p => ({
      id: p.id,
      name: `${p.vorname ? p.vorname + ' ' : ''}${p.name}`.trim(),
      counts: countsByPerson[p.id] || Array(12).fill(0)
    }));
    return rows;
  }, [roster, personnel, auswertungByType]);

  const perPersonITW = useMemo(() => {
    const countsByPerson: Record<number, number[]> = {};
    const ensure = (pid: number) => (countsByPerson[pid] ||= Array(12).fill(0));
    const personnelById = new Map((personnel || []).map(p => [p.id, p]));
    for (const row of (roster || [])) {
      try {
        if (String(row.personType) !== 'person') continue;
        const pid = Number(row.personId);
        const iso = String(row.date);
        const m = new Date(iso + 'T00:00:00Z').getUTCMonth();
        const p = personnelById.get(pid);
        if (p?.ue50Monthly?.[m] || p?.lpalMonthly?.[m]) continue; // Ü50 in diesem Monat ausschließen
        const t = String(row.type || '');
        const code = String(row.value || '').trim();
        if (t.startsWith('itw_') || (code && auswertungByType[code] === 'itw')) {
          ensure(pid)[m] += 1;
        }
      } catch { }
    }
    const rows = (personnel || []).map(p => ({
      id: p.id,
      name: `${p.vorname ? p.vorname + ' ' : ''}${p.name}`.trim(),
      counts: countsByPerson[p.id] || Array(12).fill(0)
    }));
    return rows;
  }, [roster, personnel, auswertungByType]);

  // Präsenz je Person (Auswertung ≠ 'off'), inkl. HLF‑B Flag
  const perPersonPresence = useMemo(() => {
    const countsByPerson: Record<number, number[]> = {};
    const ensure = (pid: number) => (countsByPerson[pid] ||= Array(12).fill(0));
    const personnelById = new Map((personnel || []).map(p => [p.id, p]));
    for (const row of (roster || [])) {
      try {
        if (String(row.personType) !== 'person') continue;
        const pid = Number(row.personId);
        const iso = String(row.date);
        const month = new Date(iso + 'T00:00:00Z').getUTCMonth();
        const person = personnelById.get(pid);
        if (!person || !isEligibleForStatsMonth(person, month)) continue;
        if (person.ue50Monthly?.[month] || person.lpalMonthly?.[month]) continue; // Ü50 in diesem Monat ausschließen
        const code = String(row.value || '').trim();
        if (!code) continue;
        if ((auswertungByType[code] || 'off') === 'off') continue;
        ensure(pid)[month] += 1;
      } catch { }
    }
    const byId: Record<number, boolean> = {};
    const monthlyById: Record<number, boolean[]> = {};
    const ue50ById: Record<number, boolean> = {};
    const ue50MonthlyById: Record<number, boolean[]> = {};
    const rettungsdienstMonthlyById: Record<number, boolean[]> = {};
    const deptActiveMonthlyById: Record<number, boolean[]> = {};
    for (const p of (personnel || [])) {
      byId[p.id] = !!(p as any).fahrzeugfuehrerHLFB;
      monthlyById[p.id] = (p as any).hlfbMonthly || Array(12).fill(false);
      ue50ById[p.id] = !!(p as any).ue50;
      ue50MonthlyById[p.id] = (p as any).ue50Monthly || Array(12).fill(false);
      rettungsdienstMonthlyById[p.id] = (p as any).rettungsdienstMonthly || Array(12).fill(false);
      deptActiveMonthlyById[p.id] = (p as any).deptActiveMonthly || Array(12).fill(true);
    }
    const rows = (personnel || [])
      .filter(p => {
        for (let m = 0; m < 12; m++) {
          if (isEligibleForStatsMonth(p, m)) return true;
        }
        return false;
      })
      .map(p => ({
        id: p.id,
        name: `${p.vorname ? p.vorname + ' ' : ''}${p.name}`.trim(),
        hlfb: byId[p.id] || false,
        hlfbMonthly: monthlyById[p.id],
        ue50: ue50ById[p.id] || false,
        ue50Monthly: ue50MonthlyById[p.id],
        counts: countsByPerson[p.id] || Array(12).fill(0)
      }));
    return rows;
  }, [roster, personnel, auswertungByType]);

  // Gewichtete Präsenz je Person/Monat für Anzeige & Berechnung (HLF‑B = round(0,75 × Ai,m))
  const perPersonPresenceWeighted = useMemo(() => {
    const personnelById = new Map((personnel || []).map(p => [p.id, p]));
    const rows = (perPersonPresence || []).map(r => ({
      id: r.id,
      name: r.name,
      hlfb: r.hlfb,
      hlfbMonthly: r.hlfbMonthly,
      ue50: r.ue50,
      ue50Monthly: r.ue50Monthly,
      counts: (r.counts || []).map((v: number, i: number) => {
        const p = personnelById.get(r.id);
        if (!p || !isEligibleForStatsMonth(p, i)) return 0;
        const isHlfbMonth = r.hlfbMonthly ? r.hlfbMonthly[i] : r.hlfb;
        return isHlfbMonth ? Math.round(Number(v || 0) * 0.75) : Number(v || 0);
      })
    }));
    return rows;
  }, [perPersonPresence, personnel]);

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
    const rows = (azubis || []).map(a => ({
      id: a.id,
      name: `${a.vorname ? a.vorname + ' ' : ''}${a.name} (Azubi)`.trim(),
      counts: countsByAzubi[a.id] || Array(12).fill(0)
    }));
    return rows;
  }, [roster, azubis]);

  const rowAzubis = useMemo(() => {
    const sums = Array(12).fill(0);
    for (const r of (perAzubiMaschinist || [])) {
      r.counts.forEach((v, i) => { sums[i] += v; });
    }
    return sums;
  }, [perAzubiMaschinist]);

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
    return rows.filter(r => r.counts.some(c => c > 0)); // Only show guests with shifts
  }, [roster, guests]);

  const rowGuests = useMemo(() => {
    const sums = Array(12).fill(0);
    for (const r of (perGuestPositions || [])) {
      r.counts.forEach((v, i) => { sums[i] += v; });
    }
    return sums;
  }, [perGuestPositions]);

  // Ü50-Schichten pro Monat (alle Positionen)
  const rowUe50 = useMemo(() => {
    const sums = Array(12).fill(0);
    const reSlot = /^(rtw\d+_(tag|nacht)_[12]|nef(\d+)?_(arzt|assist|azubi)|itw_row_[123])$/;
    const personnelById = new Map((personnel || []).map(p => [p.id, p]));

    const getNefMode = (idStr?: string) => {
      if (!idStr) {
        if (nef.length > 0) return nef[0].occupancyMode || '24h';
        return '24h';
      }
      const vid = Number(idStr);
      const v = nef.find(n => n.id === vid);
      return v?.occupancyMode || '24h';
    };

    for (const row of (roster || [])) {
      try {
        if (String(row.personType) !== 'person') continue;
        const pid = Number(row.personId);
        const iso = String(row.date);
        const m = new Date(iso + 'T00:00:00Z').getUTCMonth();
        const p = personnelById.get(pid);
        if (!p?.ue50Monthly?.[m] && !p?.lpalMonthly?.[m]) continue;
        const t = String(row.type || '');
        if (!reSlot.test(t)) continue; // Nur echte Schicht-Slots zählen

        // NEF Assistenz zählt doppelt bei 24h-Besetzung
        const nefMatch = t.match(/^nef(\d+)?_assist$/);
        if (nefMatch) {
          const mode = getNefMode(nefMatch[1]);
          if (mode === 'tag') sums[m] += 1;
          else sums[m] += 2; // 24h
        } else {
          sums[m] += 1;
        }
      } catch { }
    }
    return sums;
  }, [roster, personnel, nef]);

  const row1Adj = useMemo(() => row1.map((v, i) => Math.max(0, v - (rowAzubis[i] || 0) - (rowGuests[i] || 0) - (rowUe50[i] || 0))), [row1, rowAzubis, rowGuests, rowUe50]);
  const row3 = useMemo(() => computeShiftsPerPerson(row1Adj, row2), [row1Adj, row2]);

  const rowAvgCombined = useMemo(() => {
    const avgs = Array(12).fill(0);
    const rows = perPersonPresence || [];
    for (let i = 0; i < 12; i++) {
      let sum = 0, cnt = 0;
      for (const r of rows) {
        const v = Number(r.counts[i] || 0);
        if (v > 0) { sum += v; cnt++; }
      }
      avgs[i] = cnt > 0 ? Math.round(sum / cnt) : 0;
    }
    return avgs;
  }, [perPersonPresence]);

  // Soll-Berechnung pro Person/Monat via Hamilton (größtes Rest-Verfahren) auf Basis gewichteter Präsenz
  const calculationDetails = useMemo(() => {
    const personnelById = new Map((personnel || []).map(p => [p.id, p]));
    const byId: Record<number, number[]> = {};
    for (const r of (perPersonPresenceWeighted || [])) byId[r.id] = r.counts.slice();
    const idList = (perPersonPresenceWeighted || []).map(r => r.id);

    const detailsById: Record<number, Array<{
      month: number;
      required: number;
      totalWeight: number;
      personWeight: number;
      exact: number;
      floor: number;
      bonus: number;
      final: number;
    }>> = Object.fromEntries(idList.map(id => [id, []]));

    for (let m = 0; m < 12; m++) {
      const required = Number(row1Adj[m] || 0);
      if (required <= 0) {
        idList.forEach(id => {
          detailsById[id].push({ month: m, required: 0, totalWeight: 0, personWeight: 0, exact: 0, floor: 0, bonus: 0, final: 0 });
        });
        continue;
      }
      const weights = idList.map(id => ({ id, w: Number((byId[id] || [])[m] || 0) }));
      const active = weights.filter(x => x.w > 0);
      const totalW = active.reduce((a, b) => a + b.w, 0);

      const parts: Record<number, number> = {};
      for (const a of active) {
        parts[a.id] = (required * a.w) / totalW;
      }

      // Integration von Schichtübernahmen auf Exakt-Ebene
      const monthTransfers = (shiftTransfers || []).filter((t: any) => {
        const [ty, tm] = (t.month || '').split('-').map(Number);
        return ty === year && tm === (m + 1);
      });

      const transfersByPerson: Record<number, number> = {};
      if (monthTransfers.length > 0) {
        let totalTransferred = 0;
        const excludedIds = new Set<number>();

        for (const t of monthTransfers) {
          const toId = Number(t.to_person_id);
          const toPerson = personnelById.get(toId);
          if (!toPerson || !isEligibleForStatsMonth(toPerson, m)) continue;

          totalTransferred += t.shift_count;
          if (t.from_person_id) excludedIds.add(t.from_person_id);
          excludedIds.add(toId);

          parts[toId] = (parts[toId] || 0) + t.shift_count;
          transfersByPerson[toId] = (transfersByPerson[toId] || 0) + t.shift_count;
        }

        const pool = active.filter(a => !excludedIds.has(a.id));
        const poolWeight = pool.reduce((sum, a) => sum + a.w, 0);

        if (poolWeight > 0 && totalTransferred > 0) {
          for (const p of pool) {
            const reduction = (totalTransferred * p.w) / poolWeight;
            parts[p.id] = Math.max(0, (parts[p.id] || 0) - reduction);
          }
        }
      }

      const exactList = idList.map(id => ({ id, exact: parts[id] || 0, w: Number((byId[id] || [])[m] || 0) }));
      const floors = exactList.filter(e => e.w > 0 || transfersByPerson[e.id]).map(p => ({
        id: p.id,
        v: Math.floor(p.exact),
        frac: p.exact - Math.floor(p.exact),
        exact: p.exact,
        w: p.w
      }));

      let assigned = floors.reduce((s, f) => s + f.v, 0);
      let rest = required - assigned;
      floors.sort((a, b) => b.frac - a.frac);

      const bonuses: Record<number, number> = {};
      for (let i = 0; i < floors.length && rest > 0; i++, rest--) {
        floors[i].v += 1;
        bonuses[floors[i].id] = 1;
      }

      // Fill details for those who have entries (active or transfer)
      const processedIds = new Set<number>();
      floors.forEach(f => {
        processedIds.add(f.id);
        detailsById[f.id].push({
          month: m,
          required,
          totalWeight: totalW,
          personWeight: f.w,
          exact: f.exact,
          floor: Math.floor(f.exact),
          bonus: bonuses[f.id] || 0,
          final: f.v
        });
      });

      // Fill details for others (weight 0 and no transfer)
      idList.forEach(id => {
        if (!processedIds.has(id)) {
          detailsById[id].push({
            month: m,
            required,
            totalWeight: totalW,
            personWeight: 0,
            exact: parts[id] || 0,
            floor: 0,
            bonus: 0,
            final: Math.floor(parts[id] || 0) + (bonuses[id] || 0)
          });
        }
      });
    }
    return detailsById;
  }, [perPersonPresenceWeighted, row1Adj, shiftTransfers, year, personnel]);

  const perPersonTargets = useMemo(() => {
    return Object.entries(calculationDetails).map(([idStr, details]) => ({
      id: Number(idStr),
      targets: details.map(d => d.final)
    }));
  }, [calculationDetails]);

  // Gesamt-Soll pro Monat (Summe aller Personen-Soll je Monat)
  const totalTargetsPerMonth = useMemo(() => {
    const sums = Array(12).fill(0);
    for (const r of (perPersonTargets || [])) {
      (r.targets || []).forEach((v, i) => { sums[i] += Number(v || 0); });
    }
    return sums;
  }, [perPersonTargets]);

  // Jahres-Gesamtsumme der Positionen
  const sumPositionsYear = useMemo(() => (row1Adj || []).reduce((a, b) => a + (Number(b) || 0), 0), [row1Adj]);
  // Jahres-Gesamtsumme der Soll-Schichten
  const sumTargetsYear = useMemo(() => (totalTargetsPerMonth || []).reduce((a, b) => a + (Number(b) || 0), 0), [totalTargetsPerMonth]);

  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(null);

  const wertePermission: 'none' | 'read' | 'read_all' | 'write' =
    (currentUser?.permissions?.werte as any) || 'none';
  /** Alle Namen: Werte „alle lesen“ (read_all) oder Schreiben; „nur lesen“ (read) = nur eigene Zeile. */
  const canReadAllWerte = wertePermission === 'read_all' || wertePermission === 'write';
  const visiblePresenceRows = useMemo(() => {
    if (canReadAllWerte) return perPersonPresenceWeighted;
    if (wertePermission === 'read' && currentUser?.userId != null) {
      const currentUserId = Number(currentUser.userId);
      return perPersonPresenceWeighted.filter(r => Number(r.id) === currentUserId);
    }
    return [];
  }, [perPersonPresenceWeighted, canReadAllWerte, wertePermission, currentUser?.userId]);

  const fmt = (v: number) => new Intl.NumberFormat('de-DE').format(Number(v || 0));
  const fmtDec = (v: number) => new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(Number(v || 0));

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
    const person = perPersonPresenceWeighted.find(p => p.id === selectedPersonId);
    if (!details || !person) return null;

    return (
      <div style={styles.popupOverlay} onClick={() => setSelectedPersonId(null)}>
        <div style={styles.popupContent} onClick={e => e.stopPropagation()}>
          <div style={styles.closeBtn} onClick={() => setSelectedPersonId(null)}>×</div>
          <h3 style={{ margin: '0 0 12px', color: 'var(--text)' }}>Soll-Berechnung für {person.name}</h3>
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
          {!person.ue50 && person.hlfb && (
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

  return (
    <div className="page-container">
      {renderCalculationPopup()}
      {/* Überschrift */}
      <h2 className="page-header">Werte – {year}{departmentName ? ` – ${departmentName}` : ''}</h2>
      {/* Content */}
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
                PERSÖNLICHE WERTE — STAMMPERSONAL & EINSATZKRÄFTE (Ist | Soll)
              </td>
            </tr>

            {visiblePresenceRows.map(row => {
              const sumPresence = row.counts.reduce((a, b) => a + b, 0);
              const targRow = perPersonTargets.find(t => t.id === row.id);
              const targets = targRow?.targets || Array(12).fill(0);
              const sumTargets = targets.reduce((a, b) => a + b, 0);
              const nameColor = row.hlfb ? 'var(--accent)' : undefined;
              const quicktipText = `Persönliche Werte von ${row.name}: Links = Tatsächlich geleistete Schichten (Ist). Rechts = Berechnetes Schichtsoll laut Verteilungsschlüssel (Soll). Klicken für Details zur Soll-Berechnung.`;

              return (
                <tr key={row.id} style={Number(row.id) % 2 === 0 ? styles.zebra1 : styles.zebra2} title={quicktipText}>
                  <td
                    style={{
                      ...(styles.nameSticky as any),
                      color: nameColor,
                      fontWeight: row.ue50 ? 600 : undefined,
                      cursor: 'pointer',
                      textDecoration: 'underline'
                    }}
                    onClick={() => setSelectedPersonId(row.id)}
                    title={`Klicken für Details zur Soll-Berechnung von ${row.name}`}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>{row.name}</span>
                      <InfoIcon color="var(--status-success)" />
                    </div>
                  </td>
                  {row.counts.map((v, i) => {
                    const hasTransfer = (shiftTransfers || []).some((t: any) => {
                      if (t.to_person_id !== row.id) return false;
                      const [ty, tm] = (t.month || '').split('-').map(Number);
                      return ty === year && tm === (i + 1);
                    });
                    const targetColor = hasTransfer ? 'var(--accent)' : 'var(--text)';
                    const targetWeight = hasTransfer ? 'bold' : 'normal';

                    return (
                      <td key={i} style={styles.td} title={`${monthNames[i]}: ${v ? fmt(v) : '0'} Ist-Schichten | ${targets[i] ? fmt(targets[i]) : '0'} Soll-Schichten`}>
                        {v ? (
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                            <span>{fmt(v)}</span>
                            <span style={{ color: 'var(--muted)' }}>|</span>
                            <span style={{ color: targetColor, fontWeight: targetWeight }}>{targets[i] ? fmt(targets[i]) : ''}</span>
                          </div>
                        ) : (targets[i] ? (
                          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <span style={{ color: targetColor, fontWeight: targetWeight }}>{fmt(targets[i])}</span>
                          </div>
                        ) : '')}
                      </td>
                    );
                  })}
                  <td style={styles.td} title={`Jahressumme ${row.name}: ${sumPresence ? fmt(sumPresence) : '0'} Ist | ${sumTargets ? fmt(sumTargets) : '0'} Soll`}>
                    {(sumPresence || sumTargets) ? (
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                        <span>{sumPresence ? fmt(sumPresence) : ''}</span>
                        <span style={{ color: 'var(--muted)' }}>|</span>
                        <span style={{ color: 'var(--accent)' }}>{sumTargets ? fmt(sumTargets) : ''}</span>
                      </div>
                    ) : ''}
                  </td>
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
                  const guestQuicktip = `Geleistete Einsätze von ${row.name} auf Gast- oder Azubi-Maschinist-Positionen.`;
                  return (
                    <tr key={`ga_${idx}_${row.id}`} style={idx % 2 === 0 ? styles.zebra1 : styles.zebra2} title={guestQuicktip}>
                      <td style={styles.nameSticky as any} title={guestQuicktip}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>{row.name}</span>
                          <InfoIcon color="var(--status-warning)" />
                        </div>
                      </td>
                      {row.counts.map((v, i) => (
                        <td key={i} style={styles.td} title={`${monthNames[i]}: ${v ? fmt(v) : '0'} Einsätze`}>{v ? fmt(v) : ''}</td>
                      ))}
                      <td style={styles.td} title={`Jahressumme: ${sum ? fmt(sum) : '0'} Einsätze`}>{sum ? fmt(sum) : ''}</td>
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
