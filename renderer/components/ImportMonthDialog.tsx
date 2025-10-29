import React, { useState } from 'react';

interface ImportMonthDialogProps {
  onSelect: (month: number) => void;
  onCancel: () => void;
}

const months = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
];

const ImportMonthDialog: React.FC<ImportMonthDialogProps> = ({ onSelect, onCancel }) => {
  const [selected, setSelected] = useState<number>(new Date().getMonth());

  return (
    <div style={{ background: '#fff', border: '1px solid #ccc', borderRadius: 8, padding: 24, minWidth: 320 }}>
      <h3>Für welchen Monat sollen die Daten importiert werden?</h3>
      <select value={selected} onChange={e => setSelected(Number(e.target.value))} style={{ fontSize: 16, margin: '16px 0' }}>
        {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
      </select>
      <div style={{ marginTop: 16 }}>
        <button onClick={() => onSelect(selected)} style={{ marginRight: 12 }}>Weiter</button>
        <button onClick={onCancel}>Abbrechen</button>
      </div>
    </div>
  );
};

export default ImportMonthDialog;
