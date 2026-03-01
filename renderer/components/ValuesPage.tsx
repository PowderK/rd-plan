import React, { useEffect, useMemo, useState } from 'react';

const monthNames = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

function useYear(): [number, React.Dispatch<React.SetStateAction<number>>] {
  const [year, setYear] = useState<number>((window as any).rdPlanYear || new Date().getFullYear());
  return [year, setYear];
}

function useRoster(year: number) {
  const [roster, setRoster] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const rows = await (window as any).api.getDutyRoster(year);
        setRoster(Array.isArray(rows) ? rows : []);
      } catch { setRoster([]); }
    })();
  }, [year]);
  return roster;
}

function usePersonnel(year: number) {
  const [list, setList] = useState<{ id: number; name: string; vorname: string; fahrzeugfuehrerHLFB?: boolean; hlfbMonthly?: boolean[]; ue50?: boolean; ue50Monthly?: boolean[]; lpal?: boolean; lpalMonthly?: boolean[]; rettungsdienst?: boolean; rettungsdienstMonthly?: boolean[] }[]>([]);
  const fetch = async () => {
    try {
      const [rawList, allPeriods, hlfbQualSetting, ue50QualSetting, lpalQualSetting, rdQualSetting] = await Promise.all([
        (window as any).api.getPersonnelList?.(),
        (window as any).api.getAllQualificationPeriods?.(),
        (window as any).api.getSetting?.('hlfb_qualification_type'),
        (window as any).api.getSetting?.('ue50_qualification_type'),
        (window as any).api.getSetting?.('lpal_qualification_type'),
        (window as any).api.getSetting?.('rettungsdienst_qualification_type')
      ]);

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

        // Prüfe auf HLF-B Qualifikation pro Monat
        if (hasHlfbPeriod) {
          for (let m = 0; m < 12; m++) {
            const ym = `${year}-${String(m + 1).padStart(2, '0')}`;
            const isActive = hlfbPeriods.some((per: any) =>
              per.active &&
              per.startYM <= ym &&
              (!per.endYM || per.endYM >= ym)
            );
            hlfbMonthly[m] = isActive;
          }
        }

        // Prüfe auf Ü50 Qualifikation pro Monat
        if (hasUe50Period) {
          for (let m = 0; m < 12; m++) {
            const ym = `${year}-${String(m + 1).padStart(2, '0')}`;
            const isActive = ue50Periods.some((per: any) =>
              per.active &&
              per.startYM <= ym &&
              (!per.endYM || per.endYM >= ym)
            );
            ue50Monthly[m] = isActive;
          }
        }

        // Prüfe auf LPAL Qualifikation pro Monat
        if (hasLpalPeriod) {
          for (let m = 0; m < 12; m++) {
            const ym = `${year}-${String(m + 1).padStart(2, '0')}`;
            const isActive = lpalPeriods.some((per: any) =>
              per.active &&
              per.startYM <= ym &&
              (!per.endYM || per.endYM >= ym)
            );
            lpalMonthly[m] = isActive;
          }
        }

        // Prüfe auf Rettungsdienst Qualifikation pro Monat
        if (hasRettungsdienstPeriod) {
          for (let m = 0; m < 12; m++) {
            const ym = `${year}-${String(m + 1).padStart(2, '0')}`;
            const isActive = rettungsdienstPeriods.some((per: any) =>
              per.active &&
              per.startYM <= ym &&
              (!per.endYM || per.endYM >= ym)
            );
            rettungsdienstMonthly[m] = isActive;
          }
        }

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
          rettungsdienstMonthly
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
  }, [year]); // Re-fetch when year changes
  return list;
}

function useAzubis() {
  const [list, setList] = useState<{ id: number; name: string; vorname: string }[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const r = await (window as any).api.getAzubiList?.();
        setList(Array.isArray(r) ? r : []);
      } catch { setList([]); }
    })();
  }, []);
  return list;
}

function useUe50PersonnelIds(year: number) {
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

        // Lade alle Personen
        const personnel = await (window as any).api.getPersonnelList?.() || [];
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
  }, [year]);
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

function useVehicles() {
  const [rtw, setRtw] = useState<{ id: number; name: string }[]>([]);
  const [nef, setNef] = useState<{ id: number; name: string; occupancyMode?: '24h' | 'tag' }[]>([]);
  useEffect(() => {
    (async () => {
      try { const r = await (window as any).api.getRtwVehicles?.(); if (Array.isArray(r)) setRtw(r); } catch { }
      try {
        const n = await (window as any).api.getNefVehicles?.();
        if (Array.isArray(n)) {
          setNef(n.map((v: any) => ({ ...v, occupancyMode: v.occupancy_mode || v.occupancyMode || '24h' })));
        }
      } catch { }
    })();
  }, []);
  return { rtw, nef };
}

function useActivations(year: number) {
  const [rtwActs, setRtwActs] = useState<Record<number, boolean[]>>({});
  const [nefActs, setNefActs] = useState<Record<number, boolean[]>>({});
  useEffect(() => {
    (async () => {
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
    })();
  }, [year]);
  return { rtwActs, nefActs };
}

function useDepartment() {
  const [department, setDepartment] = useState<number>(1);
  useEffect(() => {
    (async () => {
      try {
        const dep = await (window as any).api.getSetting?.('department');
        setDepartment(Number(dep) || 1);
      } catch { }
    })();
  }, []);
  return department;
}

function useDeptPatterns() {
  const [seqs, setSeqs] = useState<{ startDate: string; pattern: string[] }[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const raw = await (window as any).api.getDeptPatterns?.();
        const normDept = (arr: string[], len = 21) => (arr || [])
          .slice(0, len)
          .concat(Array(len).fill(''))
          .slice(0, len)
          .map(v => (v === '1' || v === '2' || v === '3') ? v : '');
        const parsed = (raw || []).map((s: any) => ({
          startDate: String(s.startDate),
          pattern: normDept(String(s.pattern || '').split(',').map((x: string) => x.trim()), 21)
        }));
        setSeqs(parsed);
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
  vehicles: { rtw: { id: number }[]; nef: { id: number; occupancyMode?: '24h' | 'tag' }[] },
  acts: { rtwActs: Record<number, boolean[]>; nefActs: Record<number, boolean[]> },
  deptShifts: number[],
  itwShifts: number[]
) {
  const positions: number[] = Array(12).fill(0);
  for (let m = 0; m < 12; m++) {
    const rtwCount = (vehicles.rtw || []).filter(v => (acts.rtwActs[v.id] ?? Array(12).fill(true))[m] !== false).length;

    let nefShifts = 0;
    (vehicles.nef || []).forEach(v => {
      if ((acts.nefActs[v.id] ?? Array(12).fill(true))[m] !== false) {
        nefShifts += (v.occupancyMode === 'tag' ? 1 : 2);
      }
    });

    const base = deptShifts[m] * (rtwCount * 4 + nefShifts);
    positions[m] = base + (itwShifts[m] || 0);
  }
  return positions;
}

function computeActivePersonnelPerMonth(
  year: number,
  roster: any[],
  auswertungByType: Record<string, 'off' | 'tag' | 'nacht' | '24h' | 'itw'>,
  personnel: Array<{ id: number; fahrzeugfuehrerHLFB?: boolean; rettungsdienstMonthly?: boolean[] }>,
  ue50Ids: Set<number>
) {
  // Ermittelt Anwesenheit pro Monat und zählt UNGEWICHTET: jede Person mit >0 Präsenz zählt 1
  // Ü50-Personen werden ausgeschlossen (wie Azubis)
  // NEU: Nur Personal MIT Rettungsdienst-Qualifikation wird gezählt!
  const activeIds = new Set(personnel.map(p => p.id));
  const presentByMonth: Array<Set<number>> = Array.from({ length: 12 }, () => new Set());

  for (const row of (roster || [])) {
    try {
      if (String(row.personType) !== 'person') continue;
      const pid = Number(row.personId);

      // Filter: Person muss im aktuellen Personalstamm sein
      if (!activeIds.has(pid)) continue;

      if (ue50Ids.has(pid)) continue; // Ü50 ausschließen

      const val = String(row.value || '').trim();
      if (!val) continue;
      const evalMode = auswertungByType[val] || 'off';
      if (evalMode === 'off') continue;

      const iso = String(row.date);
      const m = new Date(iso + 'T00:00:00Z');
      const month = m.getUTCMonth();

      // NEU: Prüfe ob Person in diesem Monat Rettungsdienst-Qualifikation hat
      const person = personnel.find(p => p.id === pid);
      if (!person || !person.rettungsdienstMonthly || !person.rettungsdienstMonthly[month]) {
        continue; // Person hat keine Rettungsdienst-Qualifikation in diesem Monat
      }

      presentByMonth[month].add(pid);
    } catch { }
  }

  // Falls "gewichtet" gewünscht ist (HLF-B = 0.75), müsste man hier summieren.
  // Laut Tabellen-Beschreibung "HLF-B ungewichtet gezählt" -> also count 1.
  // Wir geben hier die Anzahl der Köpfe zurück.
  return presentByMonth.map(set => set.size);
}

function computeShiftsPerPerson(row1: number[], row2: number[]) {
  return row1.map((num, i) => (row2[i] > 0 ? +(num / row2[i]).toFixed(2) : 0));
}

const ValuesPage: React.FC = () => {
  const [year, setYear] = useYear();
  const roster = useRoster(year);
  const personnel = usePersonnel(year);
  const azubis = useAzubis();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const ue50Ids = useUe50PersonnelIds(year);
  const auswertungByType = useAuswertungByType();
  const { rtw, nef } = useVehicles();
  const { rtwActs, nefActs } = useActivations(year);
  const department = useDepartment();
  const deptPatternSeqs = useDeptPatterns();
  const [shiftTransfers, setShiftTransfers] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const transfers = await (window as any).api.getShiftTransfers(year);
        setShiftTransfers(Array.isArray(transfers) ? transfers : []);
      } catch { setShiftTransfers([]); }
    })();
  }, [year]);

  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const user = await (window as any).api.authGetCurrentUser?.();
        setCurrentUser(user || null);
      } catch {
        setCurrentUser(null);
      }
    };

    loadCurrentUser();

    const api = (window as any).api;
    api?.onSettingsUpdated?.(loadCurrentUser);
    api?.onPersonnelUpdated?.(loadCurrentUser);

    return () => {
      api?.offSettingsUpdated?.(loadCurrentUser);
      api?.offPersonnelUpdated?.(loadCurrentUser);
    };
  }, []);

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
    () => computePositionsPerMonth(year, { rtw, nef }, { rtwActs, nefActs }, deptShifts, rowItw),
    [year, rtw, nef, rtwActs, nefActs, deptShifts, rowItw]
  );
  const row2 = useMemo(() => computeActivePersonnelPerMonth(year, roster, auswertungByType, personnel, ue50Ids), [year, roster, auswertungByType, personnel, ue50Ids]);

  const perPerson24h = useMemo(() => {
    const countsByPerson: Record<number, number[]> = {};
    const ensure = (pid: number) => (countsByPerson[pid] ||= Array(12).fill(0));
    for (const row of (roster || [])) {
      try {
        if (String(row.personType) !== 'person') continue;
        const pid = Number(row.personId);
        if (ue50Ids.has(pid)) continue; // Ü50 ausschließen
        const code = String(row.value || '').trim();
        if (!code) continue;
        if (auswertungByType[code] !== '24h') continue;
        const iso = String(row.date);
        const m = new Date(iso + 'T00:00:00Z');
        const month = m.getUTCMonth();
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
    for (const row of (roster || [])) {
      try {
        if (String(row.personType) !== 'person') continue;
        const pid = Number(row.personId);
        if (ue50Ids.has(pid)) continue; // Ü50 ausschließen
        const iso = String(row.date);
        const m = new Date(iso + 'T00:00:00Z').getUTCMonth();
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
    for (const row of (roster || [])) {
      try {
        if (String(row.personType) !== 'person') continue;
        const pid = Number(row.personId);
        if (ue50Ids.has(pid)) continue; // Ü50 ausschließen
        const code = String(row.value || '').trim();
        if (!code) continue;
        if ((auswertungByType[code] || 'off') === 'off') continue;
        const iso = String(row.date);
        const month = new Date(iso + 'T00:00:00Z').getUTCMonth();
        ensure(pid)[month] += 1;
      } catch { }
    }
    const byId: Record<number, boolean> = {};
    const monthlyById: Record<number, boolean[]> = {};
    const ue50ById: Record<number, boolean> = {};
    const ue50MonthlyById: Record<number, boolean[]> = {};
    const rettungsdienstMonthlyById: Record<number, boolean[]> = {};
    for (const p of (personnel || [])) {
      byId[p.id] = !!(p as any).fahrzeugfuehrerHLFB;
      monthlyById[p.id] = (p as any).hlfbMonthly || Array(12).fill(false);
      ue50ById[p.id] = !!(p as any).ue50;
      ue50MonthlyById[p.id] = (p as any).ue50Monthly || Array(12).fill(false);
      rettungsdienstMonthlyById[p.id] = (p as any).rettungsdienstMonthly || Array(12).fill(false);
    }
    // WICHTIG: Nur Personen MIT Rettungsdienst-Qualifikation in mindestens einem Monat anzeigen
    const rows = (personnel || [])
      .filter(p => {
        const rdMonthly = rettungsdienstMonthlyById[p.id];
        return rdMonthly && rdMonthly.some(has => has); // Hat in mind. einem Monat Rettungsdienst
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
  }, [roster, personnel, auswertungByType, ue50Ids]);

  // Gewichtete Präsenz je Person/Monat für Anzeige & Berechnung (HLF‑B = round(0,75 × Ai,m))
  const perPersonPresenceWeighted = useMemo(() => {
    const rows = (perPersonPresence || []).map(r => ({
      id: r.id,
      name: r.name,
      hlfb: r.hlfb,
      hlfbMonthly: r.hlfbMonthly,
      ue50: r.ue50,
      ue50Monthly: r.ue50Monthly,
      counts: (r.counts || []).map((v: number, i: number) => {
        const isHlfbMonth = r.hlfbMonthly ? r.hlfbMonthly[i] : r.hlfb;
        return isHlfbMonth ? Math.round(Number(v || 0) * 0.75) : Number(v || 0);
      })
    }));
    return rows;
  }, [perPersonPresence]);

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

  // Ü50-Schichten pro Monat (alle Positionen)
  const rowUe50 = useMemo(() => {
    const sums = Array(12).fill(0);
    const reSlot = /^(rtw\d+_(tag|nacht)_[12]|nef(\d+)?_(arzt|assist|azubi)|itw_row_[123])$/;

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
        if (!ue50Ids.has(pid)) continue;
        const t = String(row.type || '');
        if (!reSlot.test(t)) continue; // Nur echte Schicht-Slots zählen
        const iso = String(row.date);
        const m = new Date(iso + 'T00:00:00Z').getUTCMonth();

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
  }, [roster, ue50Ids, nef]);

  const row1Adj = useMemo(() => row1.map((v, i) => Math.max(0, v - (rowAzubis[i] || 0) - (rowUe50[i] || 0))), [row1, rowAzubis, rowUe50]);
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
          totalTransferred += t.shift_count;
          if (t.from_person_id) excludedIds.add(t.from_person_id);
          excludedIds.add(t.to_person_id);

          parts[t.to_person_id] = (parts[t.to_person_id] || 0) + t.shift_count;
          transfersByPerson[t.to_person_id] = (transfersByPerson[t.to_person_id] || 0) + t.shift_count;
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
  }, [perPersonPresenceWeighted, row1Adj, shiftTransfers, year]);

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

  const wertePermission: 'none' | 'read' | 'read_all' | 'write' = (currentUser?.permissions?.werte as any) || 'none';
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

  const styles = {
    table: { borderCollapse: 'separate', borderSpacing: 0, minWidth: 980, background: '#ffffff' } as React.CSSProperties,
    thSticky: { position: 'sticky' as const, top: 0, background: '#f8fbff', zIndex: 2, borderBottom: '1px solid #dbe7ff', padding: '6px 8px', boxShadow: '0 1px 0 0 #dbe7ff' },
    thStickyName: { position: 'sticky' as const, top: 0, left: 0, background: '#f8fbff', zIndex: 4, borderBottom: '1px solid #dbe7ff', borderRight: '1px solid #dbe7ff', padding: '6px 8px', boxShadow: '0 1px 0 0 #dbe7ff' },
    th: { borderBottom: '1px solid #dbe7ff', padding: '6px 8px' },
    nameSticky: { position: 'sticky' as const, left: 0, background: '#ffffff', zIndex: 3, borderBottom: '1px solid #e4edff', borderRight: '1px solid #dbe7ff', padding: '6px 8px', minWidth: 240, textAlign: 'left' },
    td: { borderBottom: '1px solid #e4edff', padding: '6px 8px', textAlign: 'right' } as React.CSSProperties,
    tdLeft: { borderBottom: '1px solid #e4edff', padding: '6px 8px', textAlign: 'left' } as React.CSSProperties,
    kpiRow: { background: '#f5f9ff' } as React.CSSProperties,
    zebra1: { background: '#ffffff' } as React.CSSProperties,
    zebra2: { background: '#f5f9ff' } as React.CSSProperties,
    sectionSep: { height: 8, background: '#e4edff' } as React.CSSProperties,
    popupOverlay: {
      position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center'
    },
    popupContent: {
      background: 'var(--bg)', color: 'var(--text)', padding: 20, borderRadius: 8, maxWidth: '90vw', maxHeight: '90vh', overflow: 'auto',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
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
          <h3>Soll-Berechnung für {person.name}</h3>
          {person.ue50 && (
            <div style={{
              marginBottom: 15,
              padding: '10px',
              backgroundColor: 'var(--hover)',
              color: 'var(--text)',
              border: '1px solid var(--line)',
              borderRadius: 6,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span style={{ fontSize: '1.2em' }}>⚠️</span>
              <span>Ü50-Qualifikation: Wird von der Soll-Berechnung ausgeschlossen.</span>
            </div>
          )}
          {!person.ue50 && person.hlfb && (
            <div style={{
              marginBottom: 15,
              padding: '10px',
              backgroundColor: 'var(--hover)',
              color: 'var(--text)',
              border: '1px solid var(--line)',
              borderRadius: 6,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span style={{ fontSize: '1.2em' }}>ℹ️</span>
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
            <h4 style={{ marginTop: 0, marginBottom: 8 }}>Erklärung der Berechnung</h4>
            <ul style={{ paddingLeft: 20, margin: 0 }}>
              <li><strong>Pos. (Netto):</strong> Gesamtzahl der zu besetzenden Schichten im Monat. <br />
                <em>Formel: (Abteilungsschichten × (RTW×4 + NEF×Besetzung)) + ITW − Azubi-Maschinisten − Ü50-Schichten.</em></li>
              <li><strong>Pers. Gewicht:</strong> Anzahl der Dienste, die die Person in diesem Monat tatsächlich geleistet hat (Anwesenheit). <br />
                <em>Bei HLF-B Fahrzeugführern wird dieser Wert mit 0,75 multipliziert.</em></li>
              <li><strong>Gesamt-Gewicht:</strong> Summe der Gewichte aller aktiven Mitarbeiter in diesem Monat.</li>
              <li><strong>Anteil (Exakt):</strong> Der rechnerische Anteil an den Soll-Schichten. <br />
                <em>Formel: (Pos. Netto × Pers. Gewicht) ÷ Gesamt-Gewicht.</em></li>
              <li><strong>Anteil (Floor):</strong> Der abgerundete ganzzahlige Anteil (Basis-Soll).</li>
              <li><strong>Bonus:</strong> Verteilung der Rest-Schichten nach dem Hamilton-Verfahren (größte Nachkommastellen erhalten +1), bis die Summe der Soll-Schichten exakt den Netto-Positionen entspricht.</li>
              <li><strong>Final:</strong> Das endgültige Soll für diesen Monat (Floor + Bonus).</li>
            </ul>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="page-container">
      {renderCalculationPopup()}
      {/* Überschrift - ROT */}
      <h2 className="page-header">Werte – {year}</h2>
      {/* Content - GRAU */}
      <div className="page-content" style={{ overflow: 'auto', maxHeight: '70vh', border: '1px solid #d6e4ff', borderRadius: 10, position: 'relative', paddingTop: 0 }}>
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
            <tr>
              <td style={{ ...(styles.nameSticky as any), ...styles.kpiRow }}>
                <div style={{ fontWeight: 600 }}>Positionen gesamt (netto)</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Abteilungsschichten × (RTW×4 + NEF×2) + ITW − Azubis (Maschinist) − Ü50</div>
              </td>
              {row1Adj.map((v, i) => <td key={i} style={{ ...styles.td, ...styles.kpiRow }}>{fmt(v)}</td>)}
              <td style={{ ...styles.td, ...styles.kpiRow }}>{fmt(sumPositionsYear)}</td>
            </tr>
            <tr>
              <td style={{ ...(styles.nameSticky as any), ...styles.kpiRow }}>
                <div style={{ fontWeight: 600 }}>Anzahl Personal (gewichtet)</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Stammpersonal mit mind. einer Schicht (Auswertung ≠ off); HLF‑B ungewichtet gezählt</div>
              </td>
              {row2.map((v, i) => <td key={i} style={{ ...styles.td, ...styles.kpiRow }}>{fmt(v)}</td>)}
              <td style={{ ...styles.td, ...styles.kpiRow }} />
            </tr>
            <tr>
              <td style={{ ...(styles.nameSticky as any), ...styles.kpiRow }}>
                <div style={{ fontWeight: 600 }}>Anzahl Azubis (Maschinist)</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Summe der Azubi‑Maschinist‑Einsätze je Monat</div>
              </td>
              {rowAzubis.map((v, i) => <td key={i} style={{ ...styles.td, ...styles.kpiRow }}>{fmt(v)}</td>)}
              <td style={{ ...styles.td, ...styles.kpiRow }} />
            </tr>
            <tr>
              <td style={{ ...(styles.nameSticky as any), ...styles.kpiRow }}>
                <div style={{ fontWeight: 600 }}>Anzahl Ü50-Schichten</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Summe aller Ü50-Personen-Einsätze je Monat (alle Positionen)</div>
              </td>
              {rowUe50.map((v, i) => <td key={i} style={{ ...styles.td, ...styles.kpiRow }}>{fmt(v)}</td>)}
              <td style={{ ...styles.td, ...styles.kpiRow }} />
            </tr>
            <tr>
              <td style={{ ...(styles.nameSticky as any), ...styles.kpiRow }}>
                <div style={{ fontWeight: 600 }}>ITW‑Schichten</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Summe aller ITW‑Einsätze (Slot oder Auswertung = ITW)</div>
              </td>
              {rowItw.map((v, i) => <td key={i} style={{ ...styles.td, ...styles.kpiRow }}>{fmt(v)}</td>)}
              <td style={{ ...styles.td, ...styles.kpiRow }} />
            </tr>
            <tr>
              <td style={{ ...(styles.nameSticky as any), ...styles.kpiRow }}>
                <div style={{ fontWeight: 600 }}>Mittelwert (24h + ITW)</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Durchschnitt pro Monat über Personen mit {'>'} 0 (gerundet)</div>
              </td>
              {rowAvgCombined.map((v, i) => <td key={i} style={{ ...styles.td, ...styles.kpiRow }}>{fmt(v)}</td>)}
              <td style={{ ...styles.td, ...styles.kpiRow }} />
            </tr>
            <tr>
              <td style={{ ...(styles.nameSticky as any), ...styles.kpiRow }}>
                <div style={{ fontWeight: 600 }}>Schichten je Person</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Positionen gesamt ÷ Anzahl Personal</div>
              </td>
              {row3.map((v, i) => <td key={i} style={{ ...styles.td, ...styles.kpiRow }}>{fmt(v)}</td>)}
              <td style={{ ...styles.td, ...styles.kpiRow }} />
            </tr>
            {/* Kontrolle: Positionen vs. Soll (grün/rot je Monat und Summe) */}
            <tr>
              <td style={{ ...(styles.nameSticky as any), ...styles.kpiRow }}>
                <div style={{ fontWeight: 600 }}>Kontrolle: Positionen vs. Soll</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Markiert = Vergleich Positionen zu Soll</div>
              </td>
              {row1Adj.map((pos, i) => {
                const soll = totalTargetsPerMonth[i] || 0;
                const ok = Number(pos || 0) === Number(soll || 0);
                const bg = ok ? 'var(--hover)' : 'var(--bg)';
                const border = '1px solid var(--line)';
                return (
                  <td key={i} style={{ ...styles.td, ...styles.kpiRow, background: bg, border }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                      <span>{fmt(pos)}</span>
                      <span style={{ color: 'var(--muted)' }}>|</span>
                      <span style={{ color: ok ? 'var(--accent)' : 'var(--text)', fontWeight: ok ? 600 : 400 }}>{fmt(soll)}</span>
                    </div>
                  </td>
                );
              })}
              {(() => {
                const ok = Number(sumPositionsYear || 0) === Number(sumTargetsYear || 0);
                const bg = ok ? 'var(--hover)' : 'var(--bg)';
                const border = '1px solid var(--line)';
                return (
                  <td style={{ ...styles.td, ...styles.kpiRow, background: bg, border }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                      <span>{fmt(sumPositionsYear)}</span>
                      <span style={{ color: 'var(--muted)' }}>|</span>
                      <span style={{ color: ok ? 'var(--accent)' : 'var(--text)', fontWeight: ok ? 600 : 400 }}>{fmt(sumTargetsYear)}</span>
                    </div>
                  </td>
                );
              })()}
            </tr>
            <tr>
              <td style={{ ...styles.sectionSep }} colSpan={monthNames.length + 2} />
            </tr>
            {visiblePresenceRows.map(row => {
              const sumPresence = row.counts.reduce((a, b) => a + b, 0);
              const targRow = perPersonTargets.find(t => t.id === row.id);
              const targets = targRow?.targets || Array(12).fill(0);
              const sumTargets = targets.reduce((a, b) => a + b, 0);
              // Priorität: Ü50 (rot) > HLF-B (blau)
              const nameColor = row.hlfb ? 'var(--accent)' : undefined;
              return (
                <tr key={row.id} style={Number(row.id) % 2 === 0 ? styles.zebra1 : styles.zebra2}>
                  <td
                    style={{
                      ...(styles.nameSticky as any),
                      color: nameColor,
                      fontWeight: row.ue50 ? 600 : undefined,
                      cursor: 'pointer',
                      textDecoration: 'underline'
                    }}
                    onClick={() => setSelectedPersonId(row.id)}
                    title="Klicken für Details zur Soll-Berechnung"
                  >
                    {row.name}
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
                      <td key={i} style={styles.td}>
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
                  <td style={styles.td}>
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
            {canReadAllWerte && (
              <>
                <tr>
                  <td colSpan={monthNames.length + 2} style={{ ...styles.tdLeft, background: '#eef5ff', fontWeight: 600 }}>Azubis</td>
                </tr>
                {perAzubiMaschinist.map(row => {
                  const sum = row.counts.reduce((a, b) => a + b, 0);
                  return (
                    <tr key={`az_${row.id}`} style={Number(row.id) % 2 === 0 ? styles.zebra1 : styles.zebra2}>
                      <td style={styles.nameSticky as any}>{row.name}</td>
                      {row.counts.map((v, i) => (
                        <td key={i} style={styles.td}>{v ? fmt(v) : ''}</td>
                      ))}
                      <td style={styles.td}>{sum ? fmt(sum) : ''}</td>
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
