import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';

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
  // Wir laden die vollständigen Personen-Daten, damit wir Flags wie fahrzeugfuehrerHLFB auswerten können
  const [list, setList] = useState<Array<{ id:number; name:string; vorname:string; fahrzeugfuehrerHLFB?: boolean }>>([]);
  useEffect(() => {
    (async () => {
      try {
        const rawList = await (window as any).api.getPersonnelList?.();
        const allQualPeriods = await (window as any).api.getAllQualificationPeriods?.();
        
        // Filtere Personal: Nur Personen MIT Rettungsdienst-Qualifikation
        const rettungsdienstQualName = 'Rettungsdienst';
        const periodsByPerson: Record<number, any[]> = {};
        if (Array.isArray(allQualPeriods)) {
          allQualPeriods.forEach((p: any) => {
            if (!periodsByPerson[p.personId]) periodsByPerson[p.personId] = [];
            periodsByPerson[p.personId].push(p);
          });
        }
        
        const filteredList = (Array.isArray(rawList) ? rawList : []).filter((p: any) => {
          const pPeriods = periodsByPerson[p.id] || [];
          const rdPeriods = pPeriods.filter((per: any) => per.qualType === rettungsdienstQualName && per.active);
          // Person muss mindestens eine aktive Rettungsdienst-Periode haben
          return rdPeriods.length > 0;
        });
        
        setList(filteredList);
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

// Hilfshooks und Funktionen für Abteilungs-Schichttage
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
  // Aktive Fahrzeuganzahl je Monat bestimmen
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
  personnel: Array<{ id:number; fahrzeugfuehrerHLFB?: boolean }>
) {
  // Ermittelt je Monat die anwesenden Personen (mind. eine Schicht mit Auswertung ≠ off)
  // und bildet eine gewichtete Summe: Standard 1.0, FzF HLF‑B -> 0.75
  const presentByMonth: Array<Set<number>> = Array.from({ length: 12 }, () => new Set());
  for (const row of (roster || [])) {
    try {
      if (String(row.personType) !== 'person') continue; // nur Stammpersonal
      const val = String(row.value || '').trim();
      if (!val) continue; // ohne Code ignorieren
      // Nur Codes zählen, die als echte Schichten markiert sind (nicht 'off')
      const evalMode = auswertungByType[val] || 'off';
      if (evalMode === 'off') continue;
      const iso = String(row.date);
      const m = new Date(iso + 'T00:00:00Z');
      const month = m.getUTCMonth();
      const pid = Number(row.personId);
      presentByMonth[month].add(pid);
    } catch {}
  }
  // Gewichtung anwenden
  const byId: Record<number, { fahrzeugfuehrerHLFB?: boolean }> = {};
  for (const p of (personnel || [])) byId[p.id] = { fahrzeugfuehrerHLFB: !!p.fahrzeugfuehrerHLFB };
  const HLF_B_WEIGHT = 0.75; // Annahme: „nur 75% fahren“ => 0.75 Gewicht (leicht änderbar bei Bedarf)
  return presentByMonth.map(set => {
    let sum = 0;
    for (const pid of set) {
      const isHLFB = !!byId[pid]?.fahrzeugfuehrerHLFB;
      sum += isHLFB ? HLF_B_WEIGHT : 1;
    }
    return sum;
  });
}

function computeShiftsPerPerson(row1: number[], row2: number[]) {
  // Zeile 3 = Zeile1 / Zeile2, mit 2 Nachkommastellen
  return row1.map((num, i) => (row2[i] > 0 ? +(num / row2[i]).toFixed(2) : 0));
}

const ValuesPage: React.FC = () => {
  const [year, setYear] = useYear();
  const roster = useRoster(year);
  const personnel = usePersonnel();
  const azubis = useAzubis();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const auswertungByType = useAuswertungByType();
  const { rtw, nef } = useVehicles();
  const { rtwActs, nefActs } = useActivations(year);
  const department = useDepartment();
  const deptPatternSeqs = useDeptPatterns();

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

  const wertePermission: 'none' | 'read' | 'read_all' | 'write' =
    (currentUser?.permissions?.werte as any) || 'none';
  const canSeeAllWerteNames = wertePermission === 'read_all' || wertePermission === 'write';
  const visiblePersonnel = useMemo(() => {
    if (canSeeAllWerteNames) return personnel;
    if (wertePermission === 'read' && currentUser?.userId != null) {
      return personnel.filter(p => Number(p.id) === Number(currentUser.userId));
    }
    return [];
  }, [personnel, canSeeAllWerteNames, wertePermission, currentUser?.userId]);
  const visibleAzubis = useMemo(() => (canSeeAllWerteNames ? azubis : []), [azubis, canSeeAllWerteNames]);
  
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

  // KPI: Summe ITW-Schichten pro Monat (früh berechnen, da für Positionen benötigt)
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

  // Abteilungs-Schichten je Monat (gemäß eingestellter Abteilung und Schichtfolge)
  const deptShifts = useMemo(() => computeDeptShiftsPerMonth(year, department, deptPatternSeqs), [year, department, JSON.stringify(deptPatternSeqs)]);

  // Positionen pro Monat: Abteilungs-Schichten × (RTW×4 + NEF×2) + ITW-Schichten
  const row1 = useMemo(
    () => computePositionsPerMonth(year, { rtw, nef }, { rtwActs, nefActs }, deptShifts, rowItw),
    [year, rtw, nef, rtwActs, nefActs, deptShifts, rowItw]
  );
  const row2 = useMemo(() => computeActivePersonnelPerMonth(year, roster, auswertungByType, visiblePersonnel), [year, roster, auswertungByType, visiblePersonnel]);
  // row3 wird weiter unten nach Abzug der Azubis von den Positionen berechnet

  // Per-Person 24h-Counts pro Monat (gemäß Auswertungseinstellungen)
  const perPerson24h = useMemo(() => {
    const countsByPerson: Record<number, number[]> = {};
    const ensure = (pid: number) => (countsByPerson[pid] ||= Array(12).fill(0));
    for (const row of (roster || [])) {
      try {
        if (String(row.personType) !== 'person') continue; // nur Stammpersonal
        const code = String(row.value || '').trim();
        if (!code) continue;
        if (auswertungByType[code] !== '24h') continue; // nur 24h-codes zählen
        const iso = String(row.date);
        const m = new Date(iso + 'T00:00:00Z');
        const month = m.getUTCMonth();
        ensure(Number(row.personId))[month] += 1;
      } catch {}
    }
    // Baue Ausgabezeilen in Personen-Reihenfolge (alle Stammpersonen, auch ohne 24h als 0)
    const rows = (visiblePersonnel || []).map(p => ({
      id: p.id,
      name: `${p.vorname ? p.vorname + ' ' : ''}${p.name}`.trim(),
      counts: countsByPerson[p.id] || Array(12).fill(0)
    }));
    return rows;
  }, [roster, visiblePersonnel, auswertungByType]);

  // Per-Person ITW-Counts pro Monat (Slot itw_* oder Auswertung=itw)
  const perPersonITW = useMemo(() => {
    const countsByPerson: Record<number, number[]> = {};
    const ensure = (pid: number) => (countsByPerson[pid] ||= Array(12).fill(0));
    for (const row of (roster || [])) {
      try {
        if (String(row.personType) !== 'person') continue; // nur Stammpersonal
        const iso = String(row.date);
        const m = new Date(iso + 'T00:00:00Z').getUTCMonth();
        const t = String(row.type || '');
        const code = String(row.value || '').trim();
        if (t.startsWith('itw_') || (code && auswertungByType[code] === 'itw')) {
          ensure(Number(row.personId))[m] += 1;
        }
      } catch {}
    }
    const rows = (visiblePersonnel || []).map(p => ({
      id: p.id,
      name: `${p.vorname ? p.vorname + ' ' : ''}${p.name}`.trim(),
      counts: countsByPerson[p.id] || Array(12).fill(0)
    }));
    return rows;
  }, [roster, visiblePersonnel, auswertungByType]);

  // Präsenz je Person: Tage mit Auswertung ≠ 'off' (tag|nacht|24h|itw)
  const perPersonPresence = useMemo(() => {
    const countsByPerson: Record<number, number[]> = {};
    const ensure = (pid: number) => (countsByPerson[pid] ||= Array(12).fill(0));
    for (const row of (roster || [])) {
      try {
        if (String(row.personType) !== 'person') continue;
        const code = String(row.value || '').trim();
        if (!code) continue;
        if ((auswertungByType[code] || 'off') === 'off') continue;
        const iso = String(row.date);
        const month = new Date(iso + 'T00:00:00Z').getUTCMonth();
        ensure(Number(row.personId))[month] += 1;
      } catch {}
    }
    const rows = (visiblePersonnel || []).map(p => ({
      id: p.id,
      name: `${p.vorname ? p.vorname + ' ' : ''}${p.name}`.trim(),
      hlfb: !!(p as any)?.fahrzeugfuehrerHLFB,
      counts: countsByPerson[p.id] || Array(12).fill(0)
    }));
    return rows;
  }, [roster, visiblePersonnel, auswertungByType]);

  // Per-Azubi Maschinist-Counts pro Monat (RTW tag_2/nacht_2 Slots)
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
    const rows = (visibleAzubis || []).map(a => ({
      id: a.id,
      name: `${a.vorname ? a.vorname + ' ' : ''}${a.name} (Azubi)`.trim(),
      counts: countsByAzubi[a.id] || Array(12).fill(0)
    }));
    return rows;
  }, [roster, visibleAzubis]);

  // KPI: Summe der Azubi-Schichten (Maschinist) pro Monat
  const rowAzubis = useMemo(() => {
    const sums = Array(12).fill(0);
    for (const r of (perAzubiMaschinist || [])) {
      r.counts.forEach((v, i) => { sums[i] += v; });
    }
    return sums;
  }, [perAzubiMaschinist]);

  // Positionen bereinigt um Azubi-Maschinist-Schichten
  const row1Adj = useMemo(() => row1.map((v, i) => Math.max(0, v - (rowAzubis[i] || 0))), [row1, rowAzubis]);

  // Schichten pro Person = (bereinigte Positionen) / (Anzahl Personal)
  const row3 = useMemo(() => computeShiftsPerPerson(row1Adj, row2), [row1Adj, row2]);

  // rowItw ist bereits oben berechnet, da für "Positionen" benötigt

  // KPI: Mittelwert (24h + ITW) je Monat (nur Werte > 0 werden gemittelt)
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

  // Soll-Schichten pro Person und Monat ermitteln (Split-Zellen: Anwesenheit | Soll)
  // Formel: target = round((spp / avgPresence) * presenceWeighted)
  // wobei spp = row1Adj / row2 (Positionslast pro Kopf), avgPresence = rowAvgCombined,
  // presenceWeighted = presence * (0.75 bei HLF‑B, sonst 1)
  const perPersonTargets = useMemo(() => {
    const spp: number[] = row1Adj.map((pos, i) => (row2[i] > 0 ? pos / row2[i] : 0));
    const avgP = rowAvgCombined;
    return (perPersonPresence || []).map(r => {
      const targets = r.counts.map((presence: number, i: number) => {
        const weightedPresence = presence * (r.hlfb ? 0.75 : 1);
        const denom = avgP[i] || 0;
        const perCapita = spp[i] || 0;
        if (denom <= 0 || perCapita <= 0 || weightedPresence <= 0) return 0;
        return Math.round((perCapita / denom) * weightedPresence);
      });
      return { id: r.id, targets } as { id: number, targets: number[] };
    });
  }, [perPersonPresence, row1Adj, row2, rowAvgCombined]);

  // Summe Positionen gesamt (netto) über das Jahr
  const sumPositionsYear = useMemo(() => (row1Adj || []).reduce((a, b) => a + (Number(b) || 0), 0), [row1Adj]);

  const fmt = (v: number) => new Intl.NumberFormat('de-DE').format(Number(v || 0));
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
  };
  return (
    <div style={{ padding: 16 }}>
      <h2>Werte – {year}</h2>
      <div style={{ overflow: 'auto', maxHeight: '70vh', border: '1px solid #d6e4ff', borderRadius: 10 }}>
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
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Abteilungsschichten × (RTW×4 + NEF×2) + ITW − Azubis (Maschinist)</div>
              </td>
              {row1Adj.map((v, i) => <td key={i} style={{ ...styles.td, ...styles.kpiRow }}>{fmt(v)}</td>)}
              <td style={{ ...styles.td, ...styles.kpiRow }}>{fmt(sumPositionsYear)}</td>
            </tr>
            <tr>
              <td style={{ ...(styles.nameSticky as any), ...styles.kpiRow }}>
                <div style={{ fontWeight: 600 }}>Anzahl Personal (gewichtet)</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Stammpersonal mit mind. einer Schicht (Auswertung ≠ off) im Monat; FzF HLF‑B zählt mit 0,75</div>
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
                <div style={{ fontWeight: 600 }}>ITW‑Schichten</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Summe aller ITW‑Einsätze (Slot oder Auswertung = ITW)</div>
              </td>
              {rowItw.map((v, i) => <td key={i} style={{ ...styles.td, ...styles.kpiRow }}>{fmt(v)}</td>)}
              <td style={{ ...styles.td, ...styles.kpiRow }} />
            </tr>
            <tr>
              <td style={{ ...(styles.nameSticky as any), ...styles.kpiRow }}>
                <div style={{ fontWeight: 600 }}>Mittelwert (24h + ITW)</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Durchschnitt pro Monat über Personen mit &gt; 0 (gerundet)</div>
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
            {/* Separator zwischen KPI- und Personen-Bereich */}
            <tr>
              <td style={{ ...styles.sectionSep }} colSpan={monthNames.length + 2} />
            </tr>
            {perPersonPresence.map(row => {
              const sumPresence = row.counts.reduce((a, b) => a + b, 0);
              const targRow = perPersonTargets.find(t => t.id === row.id);
              const targets = targRow?.targets || Array(12).fill(0);
              const sumTargets = targets.reduce((a, b) => a + b, 0);
              return (
                <tr key={row.id} style={Number(row.id) % 2 === 0 ? styles.zebra1 : styles.zebra2}>
                  <td style={{ ...(styles.nameSticky as any), color: row.hlfb ? 'var(--accent)' : undefined }}>{row.name}</td>
                  {row.counts.map((v, i) => (
                    <td key={i} style={styles.td}>
                      {v ? (
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                          <span>{fmt(v)}</span>
                          <span style={{ color: 'var(--muted)' }}>|</span>
                          <span style={{ color: 'var(--accent)' }}>{targets[i] ? fmt(targets[i]) : ''}</span>
                        </div>
                      ) : (targets[i] ? (
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}><span style={{ color: 'var(--accent)' }}>{fmt(targets[i])}</span></div>
                      ) : '')}
                    </td>
                  ))}
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
            {canSeeAllWerteNames && (
              <>
                {/* Separator vor Azubis */}
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

const root = createRoot(document.getElementById('root')!);
root.render(<ValuesPage />);
