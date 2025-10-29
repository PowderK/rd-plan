import React, { useEffect, useState } from 'react';

interface DepartmentDutyDaysTableProps {
  year: number;
  shiftPattern: string[];
}

const months = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
];

// Hilfsfunktion: Berechne den Index in der Schichtfolge ab 1.1.2025, überspringe 29.2. in Schaltjahren
function getShiftPatternIndex(dateObj: Date) {
  let days = Math.floor((dateObj.getTime() - new Date(2025, 0, 1).getTime()) / (1000*60*60*24));
  // Für jedes Schaltjahr ab 2028, 2032, ... und jeden 29.2. ab 2028 einen Tag abziehen, wenn nach dem 29.2.
  for (let y = 2025; y <= dateObj.getFullYear(); y++) {
    if (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)) {
      const leapDay = new Date(y, 1, 29); // 29.2.y
      if (dateObj > leapDay) days--;
    }
  }
  return days;
}

const DepartmentDutyDaysTable: React.FC<DepartmentDutyDaysTableProps> = ({ year, shiftPattern }) => {
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
        const idx = getShiftPatternIndex(dateObj);
        // Exakte Schichtfolgenlogik wie in MonthTabs
        if (String(department) === shiftPattern[(idx % shiftPattern.length + shiftPattern.length) % shiftPattern.length]) {
          result[m].push({ day: d, weekday: dateObj.toLocaleDateString('de-DE', { weekday: 'short' }) });
        }
      }
    }
    setDutyDays(result);
  }, [year, shiftPattern, department]);

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
