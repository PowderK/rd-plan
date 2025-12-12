import React, { useEffect, useMemo, useState } from 'react';

const monthNames = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];

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

function usePersonnel() {
  const [list, setList] = useState<{ id:number; name:string; vorname:string; fahrzeugfuehrerHLFB?: boolean }[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const r = await (window as any).api.getPersonnelList?.();
        setList(Array.isArray(r) ? r : []);
      } catch { setList([]); }
    })();
  }, []);
  return list;
}

function useAzubis() {
  const [list, setList] = useState<{ id:number; name:string; vorname:string }[]>([]);
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
        // Lade Ü50 Qualifikationstyp aus Settings
        let ue50QualName = 'Ü50';
        const setting = await (window as any).api.getSetting('ue50_qualification_type');
        if (setting) ue50QualName = String(setting);

        // Lade alle Personen
        const personnel = await (window as any).api.getPersonnelList?.() || [];
        const ids = new Set<number>();

        // Für jede Person prüfen, ob sie Ü50-Qualifikation hat
        for (const person of personnel) {
          try {
            const periods = await (window as any).api.getQualificationPeriods?.(person.id) || [];
            
            // Prüfe für jeden Monat des Jahres, ob Ü50 aktiv ist
            for (let month = 0; month < 12; month++) {
              const yearMonth = `${year}-${String(month + 1).padStart(2, '0')}`;
              const hasUe50 = periods.some((p: any) => 
                p.active && 
                p.qualType === ue50QualName &&
                p.startYM <= yearMonth &&
                (!p.endYM || p.endYM >= yearMonth)
              );
              if (hasUe50) {
                ids.add(person.id);
                break; // Einmal gefunden reicht
              }
            }
          } catch {}
        }
        setUe50Ids(ids);
      } catch { setUe50Ids(new Set()); }
    })();
  }, [year]);
  return ue50Ids;
}

function useAuswertungByType() {
  const [map, setMap] = useState<Record<string, 'off'|'tag'|'nacht'|'24h'|'itw'>>({});
  useEffect(() => {
    (async () => {
      try {
        const types = await (window as any).api.getShiftTypes?.();
        const m: Record<string, 'off'|'tag'|'nacht'|'24h'|'itw'> = {};
        for (const t of (types || [])) {
          const v = await (window as any).api.getSetting?.(`auswertung_${t.code}`);
          m[t.code] = (v === 'tag' || v === 'nacht' || v === '24h' || v === 'itw') ? v : 'off';
        }
        setMap(m);
      } catch {}
    })();
  }, []);
  return map;
}

function useVehicles() {
  const [rtw, setRtw] = useState<{ id:number; name:string }[]>([]);
  const [nef, setNef] = useState<{ id:number; name:string }[]>([]);
  useEffect(() => {
    (async () => {
      try { const r = await (window as any).api.getRtwVehicles?.(); if (Array.isArray(r)) setRtw(r); } catch {}
      try { const n = await (window as any).api.getNefVehicles?.(); if (Array.isArray(n)) setNef(n); } catch {}
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
  return { rtwActs, nefActs };
}

function useDepartment() {
  const [department, setDepartment] = useState<number>(1);
  useEffect(() => {
    (async () => {
      try {
        const dep = await (window as any).api.getSetting?.('department');
        setDepartment(Number(dep) || 1);
      } catch {}
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
      } catch {}
    })();
  }, []);
  return seqs;
}

function getDeptDayFor(dateObj: Date, seqs: { startDate: string, pattern: string[] }[]): string | undefined {
  const iso = new Date(Date.UTC(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate())).toISOString().slice(0,10);
  if (!seqs || seqs.length === 0) return undefined;
  const sorted = [...seqs].sort((a,b) => a.startDate.localeCompare(b.startDate));
  let active = sorted[0];
  for (const s of sorted) { if (s.startDate <= iso) active = s; else break; }
  const start = new Date((active?.startDate || '1970-01-01') + 'T00:00:00Z');
  const diffDays = Math.floor((new Date(iso + 'T00:00:00Z').getTime() - start.getTime()) / (1000*60*60*24));
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
  vehicles: { rtw: { id: number }[]; nef: { id: number }[] },
  acts: { rtwActs: Record<number, boolean[]>; nefActs: Record<number, boolean[]> },
  deptShifts: number[],
  itwShifts: number[]
) {
  const positions: number[] = Array(12).fill(0);
  const rtwPerMonth: number[] = Array(12).fill(0);
  const nefPerMonth: number[] = Array(12).fill(0);
  for (let m = 0; m < 12; m++) {
    rtwPerMonth[m] = (vehicles.rtw || []).filter(v => (acts.rtwActs[v.id] ?? Array(12).fill(true))[m] !== false).length;
    nefPerMonth[m] = (vehicles.nef || []).filter(v => (acts.nefActs[v.id] ?? Array(12).fill(true))[m] !== false).length;
  }
  for (let m = 0; m < 12; m++) {
    const base = deptShifts[m] * (rtwPerMonth[m] * 4 + nefPerMonth[m] * 2);
    positions[m] = base + (itwShifts[m] || 0);
  }
  return positions;
}

function computeActivePersonnelPerMonth(
  year: number,
  roster: any[],
  auswertungByType: Record<string, 'off'|'tag'|'nacht'|'24h'|'itw'>,
  personnel: Array<{ id:number; fahrzeugfuehrerHLFB?: boolean }>,
  ue50Ids: Set<number>
) {
  // Ermittelt Anwesenheit pro Monat und zählt UNGEWICHTET: jede Person mit >0 Präsenz zählt 1
  // Ü50-Personen werden ausgeschlossen (wie Azubis)
  const presentByMonth: Array<Set<number>> = Array.from({ length: 12 }, () => new Set());
  for (const row of (roster || [])) {
    try {
      if (String(row.personType) !== 'person') continue;
      const pid = Number(row.personId);
      if (ue50Ids.has(pid)) continue; // Ü50 ausschließen
      const val = String(row.value || '').trim();
      if (!val) continue;
      const evalMode = auswertungByType[val] || 'off';
      if (evalMode === 'off') continue;
      const iso = String(row.date);
      const m = new Date(iso + 'T00:00:00Z');
      const month = m.getUTCMonth();
      presentByMonth[month].add(pid);
    } catch {}
  }
  return presentByMonth.map(set => set.size);
}

function computeShiftsPerPerson(row1: number[], row2: number[]) {
  return row1.map((num, i) => (row2[i] > 0 ? +(num / row2[i]).toFixed(2) : 0));
}

const ValuesPage: React.FC = () => {
  const [year, setYear] = useYear();
  const roster = useRoster(year);
  const personnel = usePersonnel();
  const azubis = useAzubis();
  const ue50Ids = useUe50PersonnelIds(year);
  const auswertungByType = useAuswertungByType();
  const { rtw, nef } = useVehicles();
  const { rtwActs, nefActs } = useActivations(year);
  const department = useDepartment();
  const deptPatternSeqs = useDeptPatterns();
  
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
    for (const row of (roster || [])) {
      try {
        const iso = String(row.date);
        if (!iso) continue;
        const m = new Date(iso + 'T00:00:00Z').getUTCMonth();
        const t = String(row.type || '');
        const code = String(row.value || '').trim();
        if (t.startsWith('itw_') || (code && auswertungByType[code] === 'itw')) {
          sums[m] += 1;
        }
      } catch {}
    }
    return sums;
  }, [roster, auswertungByType]);

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
      } catch {}
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
      } catch {}
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
      } catch {}
    }
    const byId: Record<number, boolean> = {};
    for (const p of (personnel || [])) byId[p.id] = !!(p as any).fahrzeugfuehrerHLFB;
    const rows = (personnel || []).map(p => ({
      id: p.id,
      name: `${p.vorname ? p.vorname + ' ' : ''}${p.name}`.trim(),
      hlfb: byId[p.id] || false,
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
      counts: (r.counts || []).map((v: number) => r.hlfb ? Math.round(Number(v || 0) * 0.75) : Number(v || 0))
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
      } catch {}
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
    for (const row of (roster || [])) {
      try {
        if (String(row.personType) !== 'person') continue;
        const pid = Number(row.personId);
        if (!ue50Ids.has(pid)) continue;
        const t = String(row.type || '');
        if (!reSlot.test(t)) continue; // Nur echte Schicht-Slots zählen
        const iso = String(row.date);
        const m = new Date(iso + 'T00:00:00Z').getUTCMonth();
        sums[m] += 1;
      } catch {}
    }
    return sums;
  }, [roster, ue50Ids]);

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
  const perPersonTargets = useMemo(() => {
    const byId: Record<number, number[]> = {};
    for (const r of (perPersonPresenceWeighted || [])) byId[r.id] = r.counts.slice();
    const idList = (perPersonPresenceWeighted || []).map(r => r.id);
    const targetsById: Record<number, number[]> = Object.fromEntries(idList.map(id => [id, Array(12).fill(0)]));

    for (let m = 0; m < 12; m++) {
      const required = Number(row1Adj[m] || 0);
      if (required <= 0) continue;
      const weights = idList.map(id => ({ id, w: Number((byId[id] || [])[m] || 0) }));
      const active = weights.filter(x => x.w > 0);
      const totalW = active.reduce((a, b) => a + b.w, 0);
      if (totalW <= 0) continue;
      const parts = active.map(a => ({ id: a.id, exact: (required * a.w) / totalW }));
      const floors = parts.map(p => ({ id: p.id, v: Math.floor(p.exact), frac: p.exact - Math.floor(p.exact) }));
      let assigned = floors.reduce((s, f) => s + f.v, 0);
      let rest = required - assigned;
      floors.sort((a, b) => b.frac - a.frac);
      for (let i = 0; i < floors.length && rest > 0; i++, rest--) floors[i].v += 1;
      for (const f of floors) targetsById[f.id][m] = f.v;
    }
    return idList.map(id => ({ id, targets: targetsById[id] || Array(12).fill(0) }));
  }, [perPersonPresenceWeighted, row1Adj]);

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

  const fmt = (v: number) => new Intl.NumberFormat('de-DE').format(Number(v || 0));
  const styles = {
    table: { borderCollapse: 'collapse', minWidth: 980 } as React.CSSProperties,
    thSticky: { position: 'sticky' as const, top: 0, background: '#fff', zIndex: 2, border: '1px solid #ccc', padding: '6px 8px' },
    thStickyName: { position: 'sticky' as const, top: 0, left: 0, background: '#fff', zIndex: 4, border: '1px solid #ccc', padding: '6px 8px' },
    th: { border: '1px solid #ccc', padding: '6px 8px' },
    nameSticky: { position: 'sticky' as const, left: 0, background: '#fff', zIndex: 3, border: '1px solid #ccc', padding: '6px 8px', minWidth: 240, textAlign: 'left' },
    td: { border: '1px solid #ccc', padding: '6px 8px', textAlign: 'right' } as React.CSSProperties,
    tdLeft: { border: '1px solid #ccc', padding: '6px 8px', textAlign: 'left' } as React.CSSProperties,
    kpiRow: { background: '#f9fafb' } as React.CSSProperties,
    zebra1: { background: '#fff' } as React.CSSProperties,
    zebra2: { background: '#f6f8fb' } as React.CSSProperties,
    sectionSep: { height: 8, background: '#eaeef3' } as React.CSSProperties,
  };
  return (
    <div style={{ padding: 16 }}>
      <h2>Werte – {year}</h2>
      <div style={{ overflow: 'auto', maxHeight: '70vh', border: '1px solid #e0e0e0', borderRadius: 8 }}>
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
                <div style={{ fontSize: 12, color: '#666' }}>Abteilungsschichten × (RTW×4 + NEF×2) + ITW − Azubis (Maschinist) − Ü50</div>
              </td>
              {row1Adj.map((v, i) => <td key={i} style={{ ...styles.td, ...styles.kpiRow }}>{fmt(v)}</td>)}
              <td style={{ ...styles.td, ...styles.kpiRow }}>{fmt(sumPositionsYear)}</td>
            </tr>
            <tr>
              <td style={{ ...(styles.nameSticky as any), ...styles.kpiRow }}>
                <div style={{ fontWeight: 600 }}>Anzahl Personal (gewichtet)</div>
                <div style={{ fontSize: 12, color: '#666' }}>Stammpersonal mit mind. einer Schicht (Auswertung ≠ off); HLF‑B ungewichtet gezählt</div>
              </td>
              {row2.map((v, i) => <td key={i} style={{ ...styles.td, ...styles.kpiRow }}>{fmt(v)}</td>)}
              <td style={{ ...styles.td, ...styles.kpiRow }} />
            </tr>
            <tr>
              <td style={{ ...(styles.nameSticky as any), ...styles.kpiRow }}>
                <div style={{ fontWeight: 600 }}>Anzahl Azubis (Maschinist)</div>
                <div style={{ fontSize: 12, color: '#666' }}>Summe der Azubi‑Maschinist‑Einsätze je Monat</div>
              </td>
              {rowAzubis.map((v, i) => <td key={i} style={{ ...styles.td, ...styles.kpiRow }}>{fmt(v)}</td>)}
              <td style={{ ...styles.td, ...styles.kpiRow }} />
            </tr>
            <tr>
              <td style={{ ...(styles.nameSticky as any), ...styles.kpiRow }}>
                <div style={{ fontWeight: 600 }}>Anzahl Ü50-Schichten</div>
                <div style={{ fontSize: 12, color: '#666' }}>Summe aller Ü50-Personen-Einsätze je Monat (alle Positionen)</div>
              </td>
              {rowUe50.map((v, i) => <td key={i} style={{ ...styles.td, ...styles.kpiRow }}>{fmt(v)}</td>)}
              <td style={{ ...styles.td, ...styles.kpiRow }} />
            </tr>
            <tr>
              <td style={{ ...(styles.nameSticky as any), ...styles.kpiRow }}>
                <div style={{ fontWeight: 600 }}>ITW‑Schichten</div>
                <div style={{ fontSize: 12, color: '#666' }}>Summe aller ITW‑Einsätze (Slot oder Auswertung = ITW)</div>
              </td>
              {rowItw.map((v, i) => <td key={i} style={{ ...styles.td, ...styles.kpiRow }}>{fmt(v)}</td>)}
              <td style={{ ...styles.td, ...styles.kpiRow }} />
            </tr>
            <tr>
              <td style={{ ...(styles.nameSticky as any), ...styles.kpiRow }}>
                <div style={{ fontWeight: 600 }}>Mittelwert (24h + ITW)</div>
                <div style={{ fontSize: 12, color: '#666' }}>Durchschnitt pro Monat über Personen mit {'>'} 0 (gerundet)</div>
              </td>
              {rowAvgCombined.map((v, i) => <td key={i} style={{ ...styles.td, ...styles.kpiRow }}>{fmt(v)}</td>)}
              <td style={{ ...styles.td, ...styles.kpiRow }} />
            </tr>
            <tr>
              <td style={{ ...(styles.nameSticky as any), ...styles.kpiRow }}>
                <div style={{ fontWeight: 600 }}>Schichten je Person</div>
                <div style={{ fontSize: 12, color: '#666' }}>Positionen gesamt ÷ Anzahl Personal</div>
              </td>
              {row3.map((v, i) => <td key={i} style={{ ...styles.td, ...styles.kpiRow }}>{fmt(v)}</td>)}
              <td style={{ ...styles.td, ...styles.kpiRow }} />
            </tr>
            {/* Kontrolle: Positionen vs. Soll (grün/rot je Monat und Summe) */}
            <tr>
              <td style={{ ...(styles.nameSticky as any), ...styles.kpiRow }}>
                <div style={{ fontWeight: 600 }}>Kontrolle: Positionen vs. Soll</div>
                <div style={{ fontSize: 12, color: '#666' }}>Grün = gleich, Rot = abweichend</div>
              </td>
              {row1Adj.map((pos, i) => {
                const soll = totalTargetsPerMonth[i] || 0;
                const ok = Number(pos || 0) === Number(soll || 0);
                const bg = ok ? '#e7f6ec' : '#fdeaea';
                const border = ok ? '1px solid #b7ebc6' : '1px solid #f5c2c7';
                return (
                  <td key={i} style={{ ...styles.td, ...styles.kpiRow, background: bg, border }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                      <span>{fmt(pos)}</span>
                      <span style={{ color: '#374151' }}>|</span>
                      <span>{fmt(soll)}</span>
                    </div>
                  </td>
                );
              })}
              {(() => {
                const ok = Number(sumPositionsYear || 0) === Number(sumTargetsYear || 0);
                const bg = ok ? '#e7f6ec' : '#fdeaea';
                const border = ok ? '1px solid #b7ebc6' : '1px solid #f5c2c7';
                return (
                  <td style={{ ...styles.td, ...styles.kpiRow, background: bg, border }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                      <span>{fmt(sumPositionsYear)}</span>
                      <span style={{ color: '#374151' }}>|</span>
                      <span>{fmt(sumTargetsYear)}</span>
                    </div>
                  </td>
                );
              })()}
            </tr>
            <tr>
              <td style={{ ...styles.sectionSep }} colSpan={monthNames.length + 2} />
            </tr>
              {perPersonPresenceWeighted.map(row => {
              const sumPresence = row.counts.reduce((a, b) => a + b, 0);
              const targRow = perPersonTargets.find(t => t.id === row.id);
              const targets = targRow?.targets || Array(12).fill(0);
              const sumTargets = targets.reduce((a, b) => a + b, 0);
              return (
                <tr key={row.id} style={Number(row.id) % 2 === 0 ? styles.zebra1 : styles.zebra2}>
                  <td style={{ ...(styles.nameSticky as any), color: row.hlfb ? '#1565c0' : undefined }}>{row.name}</td>
                  {row.counts.map((v, i) => (
                    <td key={i} style={styles.td}>
                      {v ? (
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                          <span>{fmt(v)}</span>
                          <span style={{ color: '#374151' }}>|</span>
                          <span style={{ color: '#0f766e' }}>{targets[i] ? fmt(targets[i]) : ''}</span>
                        </div>
                      ) : (targets[i] ? (
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}><span style={{ color: '#0f766e' }}>{fmt(targets[i])}</span></div>
                      ) : '')}
                    </td>
                  ))}
                  <td style={styles.td}>
                    {(sumPresence || sumTargets) ? (
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                        <span>{sumPresence ? fmt(sumPresence) : ''}</span>
                        <span style={{ color: '#374151' }}>|</span>
                        <span style={{ color: '#0f766e' }}>{sumTargets ? fmt(sumTargets) : ''}</span>
                      </div>
                    ) : ''}
                  </td>
                </tr>
              );
            })}
            <tr>
              <td colSpan={monthNames.length + 2} style={{ ...styles.tdLeft, background: '#eef2f7', fontWeight: 600 }}>Azubis</td>
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
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ValuesPage;
