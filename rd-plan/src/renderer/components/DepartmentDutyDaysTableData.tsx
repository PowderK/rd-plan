import React, { useEffect, useState } from 'react';

interface DepartmentDutyDaysTableDataProps {
  year: number;
  roster: Record<string, Record<number, { value: string, type: string }>>;
  shiftPattern: string[];
}

const months = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
];

const getDaysInYear = (year: number) => {
  const days: { date: string; weekday: string; iso: string }[] = [];
  const start = new Date(year, 0, 1);
  const end = new Date(year + 1, 0, 1);
  for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
    const date = d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
    const weekday = d.toLocaleDateString('de-DE', { weekday: 'short' });
    const iso = d.toISOString().slice(0, 10);
    days.push({ date, weekday, iso });
  }
  return days;
};

const DepartmentDutyDaysTableData: React.FC<DepartmentDutyDaysTableDataProps> = ({ year, roster, shiftPattern }) => {
  const [department, setDepartment] = useState<number>(1);
  const [dutyDays, setDutyDays] = useState<{ [month: number]: { day: number, weekday: string }[] }>({});

  useEffect(() => {
    (async () => {
      const dep = await (window as any).api.getSetting('department');
      setDepartment(Number(dep) || 1);
    })();
  }, []);

  useEffect(() => {
    const days = getDaysInYear(year);
    // Die Schichtfolge aus der Dienstplan-Kopfzeile (wie im Dienstplan gerendert)
    // Die Schichtfolge steht in der ersten Zeile (shiftPattern) und ist für alle gleich
    // Wir nehmen die Werte aus shiftPattern und mappen sie auf die Tage
    // Wir suchen alle Tage, an denen die Schichtfolge == department ist
    const result: { [month: number]: { day: number, weekday: string }[] } = {};
    for (let m = 0; m < 12; ++m) {
      result[m] = [];
    }
    days.forEach((d, i) => {
      const schicht = shiftPattern[(i % shiftPattern.length)];
      if (String(department) === schicht) {
        const dateObj = new Date(year, Number(d.date.slice(3, 5)) - 1, Number(d.date.slice(0, 2)));
        result[dateObj.getMonth()].push({ day: dateObj.getDate(), weekday: d.weekday });
      }
    });
    setDutyDays(result);
  }, [year, shiftPattern, department, roster]);

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

export default DepartmentDutyDaysTableData;
