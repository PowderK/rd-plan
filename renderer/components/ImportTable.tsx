import React, { useEffect, useRef, useState } from 'react';

interface ImportTablePerson {
  id: string; // jetzt string (mit Präfix)
  name: string;
  vorname?: string;
  isAzubi?: boolean;
  lehrjahr?: number;
}

interface ImportTableProps {
  month: number; // 0-basiert
  year: number;
  personnel: ImportTablePerson[];
  onCancel: () => void;
  onImport: (data: string[][]) => void;
}

const getDaysInMonth = (year: number, month: number) => {
  const days: { date: string; weekday: string }[] = [];
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 1);
  for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
    const date = d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
    const weekday = d.toLocaleDateString('de-DE', { weekday: 'short' });
    days.push({ date, weekday });
  }
  return days;
};

const ImportTable: React.FC<ImportTableProps> = ({ month, year, personnel, onCancel, onImport }) => {
  const days = getDaysInMonth(year, month);
  const [table, setTable] = useState<string[][]>(
    personnel.map(() => Array(days.length).fill(''))
  );
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  // Copy&Paste-Handler
  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      if (!tableRef.current || document.activeElement?.tagName === 'INPUT') return;
      const text = e.clipboardData?.getData('text');
      if (!text) return;
      const rows = text.split(/\r?\n/).filter(Boolean).map(row => row.split(/\t/));
      if (rows.length > 0) {
        setTable(prev => {
          const newTable = prev.map(row => [...row]);
          // Startposition bestimmen
          const startRow = selectedCell ? selectedCell.row : 0;
          const startCol = selectedCell ? selectedCell.col : 0;
          for (let i = 0; i < rows.length && (i + startRow) < newTable.length; ++i) {
            for (let j = 0; j < rows[i].length && (j + startCol) < newTable[i + startRow].length; ++j) {
              newTable[i + startRow][j + startCol] = rows[i][j];
            }
          }
          return newTable;
        });
      }
    };
    document.addEventListener('paste', handler);
    return () => document.removeEventListener('paste', handler);
  }, [days.length, personnel.length, selectedCell]);

  return (
    <div style={{ background: '#fff', border: '1px solid #ccc', borderRadius: 8, padding: 24, minWidth: 800 }}>
      <h3>Dienstplan-Import für {new Date(year, month).toLocaleString('de-DE', { month: 'long', year: 'numeric' })}</h3>
      <table ref={tableRef} style={{ borderCollapse: 'collapse', minWidth: 800 }}>
        <thead>
          <tr>
            <th style={{ position: 'sticky', left: 0, background: '#fff', zIndex: 2, border: '1px solid #ccc' }}>Name</th>
            {days.map((d, i) => (
              <th key={i} style={{ border: '1px solid #ccc' }}>{d.date}</th>
            ))}
          </tr>
          <tr>
            <th style={{ position: 'sticky', left: 0, background: '#fff', zIndex: 2, border: '1px solid #ccc' }}> </th>
            {days.map((d, i) => (
              <th key={i} style={{ border: '1px solid #ccc' }}>{d.weekday}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {personnel.map((person, rowIdx) => {
            const isFirstAzubi = person.isAzubi && (rowIdx === 0 || !personnel[rowIdx - 1].isAzubi);
            return [
              isFirstAzubi ? (
                <tr key="azubi-separator">
                  <td colSpan={days.length + 1} style={{ background: '#e3f2fd', fontWeight: 'bold', color: '#1976d2', borderTop: '2px solid #1976d2', borderBottom: '2px solid #1976d2', textAlign: 'left' }}>
                    Azubis
                  </td>
                </tr>
              ) : null,
              <tr key={person.id} style={{ background: rowIdx % 2 === 1 ? '#f5f7fa' : undefined }}>
                <td style={{ position: 'sticky', left: 0, background: '#fff', zIndex: 1, border: '1px solid #ccc', fontStyle: person.isAzubi ? 'italic' : undefined }}>
                  {person.name}
                  {person.isAzubi && person.lehrjahr ? (
                    <span style={{ color: '#888', fontSize: 12 }}> (Azubi, {person.lehrjahr}. Lj.)</span>
                  ) : null}
                </td>
                {days.map((_, dayIdx) => (
                  <td
                    key={dayIdx}
                    style={{ minWidth: 90, border: '1px solid #ccc', cursor: 'pointer', background: selectedCell && selectedCell.row === rowIdx && selectedCell.col === dayIdx ? '#e3f2fd' : undefined }}
                    onClick={() => setSelectedCell({ row: rowIdx, col: dayIdx })}
                  >
                    <div
                      contentEditable
                      suppressContentEditableWarning
                      style={{ outline: 'none', minWidth: 70, minHeight: 22, textAlign: 'center', background: 'transparent' }}
                      onInput={e => {
                        const value = (e.target as HTMLDivElement).innerText;
                        setTable(prev => {
                          const newTable = prev.map(row => [...row]);
                          newTable[rowIdx][dayIdx] = value;
                          return newTable;
                        });
                      }}
                      onPaste={e => {
                        e.preventDefault(); // Verhindert, dass der gesamte Block in die Zelle eingefügt wird
                      }}
                    >{table[rowIdx][dayIdx]}</div>
                  </td>
                ))}
              </tr>
            ];
          })}
        </tbody>
      </table>
      <div style={{ marginTop: 24 }}>
        <button onClick={() => onImport(table)} style={{ marginRight: 12 }}>Importieren</button>
        <button onClick={onCancel}>Abbrechen</button>
      </div>
      <div style={{ marginTop: 12, color: '#555', fontSize: 14 }}>
        <b>Tipp:</b> Kopiere die gewünschten Zellen aus Excel und füge sie direkt in diese Tabelle ein (Strg+V/Cmd+V).
      </div>
    </div>
  );
};

export default ImportTable;
