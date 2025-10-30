import React, { useEffect, useState } from 'react';

interface DepartmentDutyDaysTableProps {
  year: number;
  deptPatternSeqs: { startDate: string, pattern: string[] }[];
}

const months = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
];

// Hilfsfunktion: Berechne den Index in der Schichtfolge ab 1.1.2025, überspringe 29.2. in Schaltjahren
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

const DepartmentDutyDaysTable: React.FC<DepartmentDutyDaysTableProps> = ({ year, deptPatternSeqs }) => {
  const [department, setDepartment] = useState<number>(1);
  const [dutyDays, setDutyDays] = useState<{ [month: number]: { day: number, weekday: string }[] }>({});

  useEffect(() => {
    (async () => {
      const dep = await (window as any).api.getSetting('department');
      setDepartment(Number(dep) || 1);
    })();
  }, []);

  useEffect(() => {
    const result: { [month: number]: { day: number, weekday: string }[] } = {};
    for (let m = 0; m < 12; ++m) {
      result[m] = [];
      const daysInMonth = new Date(year, m + 1, 0).getDate();
      for (let d = 1; d <= daysInMonth; ++d) {
        const dateObj = new Date(year, m, d);
        const depDay = getDeptDayFor(dateObj, deptPatternSeqs);
        if (depDay && String(department) === depDay) {
          result[m].push({ day: d, weekday: dateObj.toLocaleDateString('de-DE', { weekday: 'short' }) });
        }
      }
    }
    setDutyDays(result);
  }, [year, JSON.stringify(deptPatternSeqs), department]);

  return (
    <div style={{ marginTop: 32 }}>
      <h3>Diensttage Abteilung {department} ({year})</h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', minWidth: 900 }}>
          <thead>
            <tr>
              {months.map((m, i) => (
                <th key={i} style={{ border: '1px solid #bbb', padding: 4, background: '#f5f7fa' }}>{m}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Finde die maximale Anzahl Diensttage in einem Monat für die Zeilenanzahl */}
            {(() => {
              const maxRows = Math.max(...Object.values(dutyDays).map(arr => arr.length));
              return Array.from({ length: maxRows }).map((_, rowIdx) => (
                <tr key={rowIdx}>
                  {months.map((_, mIdx) => (
                    <td key={mIdx} style={{ border: '1px solid #ccc', padding: 4, minWidth: 60, textAlign: 'center', fontSize: 15 }}>
                      {dutyDays[mIdx] && dutyDays[mIdx][rowIdx] ? `${dutyDays[mIdx][rowIdx].day}. (${dutyDays[mIdx][rowIdx].weekday})` : ''}
                    </td>
                  ))}
                </tr>
              ));
            })()}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DepartmentDutyDaysTable;
