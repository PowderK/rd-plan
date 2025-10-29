import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';

const monthNames = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];

function useYear(): number {
  const [year, setYear] = useState<number>(new Date().getFullYear());
  useEffect(() => {
    (async () => {
      try {
        const y = await (window as any).api.getSetting('year');
        setYear(Number(y || new Date().getFullYear()));
      } catch {}
    })();
  }, []);
  return year;
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
  const [list, setList] = useState<{ id:number; name:string; vorname:string }[]>([]);
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

function computeActivePersonnelPerMonth(year: number, roster: any[], auswertungByType: Record<string, 'off'|'tag'|'nacht'|'24h'|'itw'>) {
  // Zählt pro Monat die Anzahl Stammpersonal (personType==='person'),
  // die mindestens eine Schicht (beliebiger Code, nicht leer) in diesem Monat haben
  const setByMonth: Array<Set<string>> = Array.from({ length: 12 }, () => new Set());
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
      const key = `${row.personType}:${row.personId}`;
      setByMonth[month].add(key);
    } catch {}
  }
  return setByMonth.map(s => s.size);
}

function computeShiftsPerPerson(row1: number[], row2: number[]) {
  // Zeile 3 = Zeile1 / Zeile2, mit 2 Nachkommastellen
  return row1.map((num, i) => (row2[i] > 0 ? +(num / row2[i]).toFixed(2) : 0));
}

const ValuesPage: React.FC = () => {
  const year = useYear();
  const roster = useRoster(year);
  const personnel = usePersonnel();
  const azubis = useAzubis();
  const auswertungByType = useAuswertungByType();
  const { rtw, nef } = useVehicles();
  const { rtwActs, nefActs } = useActivations(year);
  const department = useDepartment();
  const deptPatternSeqs = useDeptPatterns();

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
  const row2 = useMemo(() => computeActivePersonnelPerMonth(year, roster, auswertungByType), [year, roster, auswertungByType]);
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
    const rows = (personnel || []).map(p => ({
      id: p.id,
      name: `${p.vorname ? p.vorname + ' ' : ''}${p.name}`.trim(),
      counts: countsByPerson[p.id] || Array(12).fill(0)
    }));
    return rows;
  }, [roster, personnel, auswertungByType]);

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
    const rows = (personnel || []).map(p => ({
      id: p.id,
      name: `${p.vorname ? p.vorname + ' ' : ''}${p.name}`.trim(),
      counts: countsByPerson[p.id] || Array(12).fill(0)
    }));
    return rows;
  }, [roster, personnel, auswertungByType]);

  // Merge 24h + ITW per person
  const perPersonCombined = useMemo(() => {
    const itwById: Record<number, number[]> = {};
    for (const r of (perPersonITW || [])) itwById[r.id] = r.counts;
    return (perPerson24h || []).map(r => ({
      id: r.id,
      name: r.name,
      counts: r.counts.map((v, i) => v + (itwById[r.id]?.[i] || 0))
    }));
  }, [perPerson24h, perPersonITW]);

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
    const rows = (azubis || []).map(a => ({
      id: a.id,
      name: `${a.vorname ? a.vorname + ' ' : ''}${a.name} (Azubi)`.trim(),
      counts: countsByAzubi[a.id] || Array(12).fill(0)
    }));
    return rows;
  }, [roster, azubis]);

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
    const rows = perPersonCombined || [];
    for (let i = 0; i < 12; i++) {
      let sum = 0, cnt = 0;
      for (const r of rows) {
        const v = Number(r.counts[i] || 0);
        if (v > 0) { sum += v; cnt++; }
      }
      avgs[i] = cnt > 0 ? Math.round(sum / cnt) : 0;
    }
    return avgs;
  }, [perPersonCombined]);

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
                <div style={{ fontSize: 12, color: '#666' }}>Abteilungsschichten × (RTW×4 + NEF×2) + ITW − Azubis (Maschinist)</div>
              </td>
              {row1Adj.map((v, i) => <td key={i} style={{ ...styles.td, ...styles.kpiRow }}>{fmt(v)}</td>)}
              <td style={{ ...styles.td, ...styles.kpiRow }} />
            </tr>
            <tr>
              <td style={{ ...(styles.nameSticky as any), ...styles.kpiRow }}>
                <div style={{ fontWeight: 600 }}>Anzahl Personal</div>
                <div style={{ fontSize: 12, color: '#666' }}>Stammpersonal mit mind. einer Schicht (Auswertung ≠ off) im Monat</div>
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
                <div style={{ fontWeight: 600 }}>ITW‑Schichten</div>
                <div style={{ fontSize: 12, color: '#666' }}>Summe aller ITW‑Einsätze (Slot oder Auswertung = ITW)</div>
              </td>
              {rowItw.map((v, i) => <td key={i} style={{ ...styles.td, ...styles.kpiRow }}>{fmt(v)}</td>)}
              <td style={{ ...styles.td, ...styles.kpiRow }} />
            </tr>
            <tr>
              <td style={{ ...(styles.nameSticky as any), ...styles.kpiRow }}>
                <div style={{ fontWeight: 600 }}>Mittelwert (24h + ITW)</div>
                <div style={{ fontSize: 12, color: '#666' }}>Durchschnitt pro Monat über Personen mit &gt; 0 (gerundet)</div>
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
            {/* Separator zwischen KPI- und Personen-Bereich */}
            <tr>
              <td style={{ ...styles.sectionSep }} colSpan={monthNames.length + 2} />
            </tr>
            {perPersonCombined.map(row => {
              const sum = row.counts.reduce((a, b) => a + b, 0);
              return (
                <tr key={row.id} style={Number(row.id) % 2 === 0 ? styles.zebra1 : styles.zebra2}>
                  <td style={styles.nameSticky as any}>{row.name}</td>
                  {row.counts.map((v, i) => (
                    <td key={i} style={styles.td}>{v ? fmt(v) : ''}</td>
                  ))}
                  <td style={styles.td}>{sum ? fmt(sum) : ''}</td>
                </tr>
              );
            })}
            {/* Separator vor Azubis */}
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

const root = createRoot(document.getElementById('root')!);
root.render(<ValuesPage />);
