import React, { useEffect, useRef, useState } from 'react';

interface ImportYearTablePerson {
  id: string; // mit Präfix p_/a_
  name: string;
  vorname?: string;
  isAzubi?: boolean;
  lehrjahr?: number;
}

interface ImportYearTableProps {
  year: number;
  personnel: ImportYearTablePerson[];
  onCancel: () => void;
  onImport: (data: string[][]) => void;
}

const getDaysInYear = (year: number) => {
  const days: { iso: string; date: string; weekday: string }[] = [];
  const start = new Date(year, 0, 1);
  const end = new Date(year + 1, 0, 1);
  for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
    const iso = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString().slice(0, 10);
    const date = d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
    const weekday = d.toLocaleDateString('de-DE', { weekday: 'short' });
    days.push({ iso, date, weekday });
  }
  return days;
};

const ImportYearTable: React.FC<ImportYearTableProps> = ({ year, personnel, onCancel, onImport }) => {
  const days = getDaysInYear(year);
  const [table, setTable] = useState<string[][]>(
    personnel.map(() => Array(days.length).fill(''))
  );
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  // Copy&Paste (ganzer Bereich aus Excel einfügen)
  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      if (!tableRef.current || document.activeElement?.tagName === 'INPUT') return;
      const text = e.clipboardData?.getData('text');
      if (!text) return;
      const rows = text.split(/\r?\n/).filter(Boolean).map(r => r.split(/\t/));
      if (rows.length === 0) return;
      setTable(prev => {
        const newTable = prev.map(r => [...r]);
        const startRow = selectedCell ? selectedCell.row : 0;
        const startCol = selectedCell ? selectedCell.col : 0;
        for (let i = 0; i < rows.length && (i + startRow) < newTable.length; i++) {
          for (let j = 0; j < rows[i].length && (j + startCol) < newTable[i + startRow].length; j++) {
            newTable[i + startRow][j + startCol] = rows[i][j];
          }
        }
        return newTable;
      });
    };
    document.addEventListener('paste', handler);
    return () => document.removeEventListener('paste', handler);
  }, [selectedCell]);

  return (
    <div style={{ background: '#fff', border: '1px solid #ccc', borderRadius: 8, padding: 24, maxWidth: '95vw', maxHeight: '90vh', overflow: 'auto' }}>
      <h3>Jahres-Dienstplan-Import {year}</h3>
      <p style={{ marginTop: 0, color: '#555', fontSize: 14 }}>Füge (Copy & Paste) aus Excel ein. Jede Zeile = Person/Azubi, jede Spalte = Tag (MM.TT). Scrollbar für viele Tage.</p>
      <table ref={tableRef} style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ position: 'sticky', left: 0, top: 0, background: '#fff', zIndex: 3, border: '1px solid #ccc' }}>Name</th>
            {days.map((d, i) => (
              <th key={i} style={{ border: '1px solid #ccc', fontSize: 11 }}>{d.date}</th>
            ))}
          </tr>
          <tr>
            <th style={{ position: 'sticky', left: 0, top: 24, background: '#fff', zIndex: 3, border: '1px solid #ccc' }}> </th>
            {days.map((d, i) => (
              <th key={i} style={{ border: '1px solid #ccc', fontSize: 11 }}>{d.weekday}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {personnel.map((p, rowIdx) => {
            const isFirstAzubi = p.isAzubi && (rowIdx === 0 || !personnel[rowIdx - 1].isAzubi);
            return [
              isFirstAzubi ? (
                <tr key={`sep_${p.id}`}>
                  <td colSpan={days.length + 1} style={{ background: '#e3f2fd', fontWeight: 'bold', color: '#1976d2', borderTop: '2px solid #1976d2', borderBottom: '2px solid #1976d2', textAlign: 'left' }}>Azubis</td>
                </tr>
              ) : null,
              <tr key={p.id} style={{ background: rowIdx % 2 === 1 ? '#f8f9fb' : undefined }}>
                <td style={{ position: 'sticky', left: 0, background: '#fff', zIndex: 2, border: '1px solid #ccc', fontStyle: p.isAzubi ? 'italic' : undefined }}>
                  {p.name}{p.isAzubi && p.lehrjahr ? ` (Azubi, ${p.lehrjahr}. Lj.)` : ''}
                </td>
                {days.map((_, colIdx) => (
                  <td
                    key={colIdx}
                    style={{ minWidth: 70, border: '1px solid #ccc', cursor: 'pointer', background: selectedCell && selectedCell.row === rowIdx && selectedCell.col === colIdx ? '#e3f2fd' : undefined }}
                    onClick={() => setSelectedCell({ row: rowIdx, col: colIdx })}
                  >
                    <div
                      contentEditable
                      suppressContentEditableWarning
                      style={{ outline: 'none', minWidth: 60, minHeight: 20, textAlign: 'center' }}
                      onInput={e => {
                        const value = (e.target as HTMLDivElement).innerText;
                        setTable(prev => {
                          const newTable = prev.map(r => [...r]);
                          newTable[rowIdx][colIdx] = value;
                          return newTable;
                        });
                      }}
                      onPaste={e => { e.preventDefault(); }}
                    >{table[rowIdx][colIdx]}</div>
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
        <b>Tipp:</b> Kompletten Jahresplan aus Excel markieren (ohne Überschriften) und hier einfügen (Cmd+V / Strg+V).
      </div>
    </div>
  );
};

export default ImportYearTable;
