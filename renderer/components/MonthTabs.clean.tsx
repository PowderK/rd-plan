import React, { useEffect, useState } from 'react';

interface MonthTabsProps {
  currentMonth: number;
  onMonthChange: (month: number) => void;
  personnel: { id: number; name: string; vorname: string; fahrzeugfuehrer?: boolean }[];
  azubis: { id: number; name: string; vorname: string; lehrjahr: number }[];
  roster: Record<string, Record<number, { value: string; type: string }>>;
  year: number;
  shiftPattern: string[];
}

const months = [
  'Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'
];

const MonthTabs: React.FC<MonthTabsProps> = ({ currentMonth, onMonthChange, personnel, azubis, roster, year, shiftPattern }) => {
  const [department, setDepartment] = useState<number>(1);
  const [localRoster, setLocalRoster] = useState(roster || {} as Record<string, Record<number, { value: string; type: string }>>);
  const [days, setDays] = useState<{ date: string; weekday: string; day: number; dayOfYear: number }[]>([]);
  const [numRTW, setNumRTW] = useState<number>(1);
  const [nef, setNef] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      const dep = await (window as any).api.getSetting('department');
      if (dep) setDepartment(Number(dep));
      const nRTW = await (window as any).api.getSetting('numRTW');
      if (nRTW) setNumRTW(Number(nRTW));
      const nefVal = await (window as any).api.getSetting('nef');
      if (nefVal) setNef(nefVal === 'true');
    })();
  }, []);

  useEffect(() => setLocalRoster(roster || {}), [roster]);

  useEffect(() => {
    const daysInMonth = new Date(year, currentMonth + 1, 0).getDate();
    const daysArr: { date: string; weekday: string; day: number; dayOfYear: number }[] = [];
    let dayOfYear = 0;
    for (let m = 0; m < currentMonth; ++m) dayOfYear += new Date(year, m + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; ++d) {
      const idx = dayOfYear + (d - 1);
      const dateObj = new Date(year, currentMonth, d);
      const schicht = shiftPattern[(idx % shiftPattern.length)];
      if (String(department) === schicht) daysArr.push({ date: dateObj.toISOString().slice(0, 10), weekday: dateObj.toLocaleDateString('de-DE', { weekday: 'short' }), day: d, dayOfYear: idx });
    }
    setDays(daysArr);
  }, [currentMonth, year, department, shiftPattern]);

  const handleAssign = async (date: string, dayIdx: number, value: string) => {
    if (!value) return;
    if (value === '__text__') {
      const text = prompt('Freitext eingeben:');
      if (!text) return;
      await (window as any).api.setDutyRosterEntry({ personId: 0, personType: 'department', date, value: text, type: 'text' });
      setLocalRoster(prev => ({ ...prev, ['0']: { ...(prev['0'] || {}), [dayIdx]: { value: text, type: 'text' } } }));
      return;
    }
    const [t, idStr] = value.split(':');
    const pid = Number(idStr);
    const ptype = t === 'a' ? 'azubi' : 'person';
    try {
      await (window as any).api.setDutyRosterEntry({ personId: pid, personType: ptype, date, value: 'V', type: 'dropdown' });
      const key = `${ptype === 'person' ? 'p' : 'a'}_${pid}`;
      setLocalRoster(prev => ({ ...prev, [key]: { ...(prev[key] || {}), [dayIdx]: { value: 'V', type: 'dropdown' } } }));
    } catch (err) {
      console.error('Fehler beim Speichern', err);
    }
  };

  return (
    <div>
      <div className="month-tabs">
        <div style={{ padding: '6px 10px', background: '#ffd', color: '#000', borderRadius: 6, display: 'inline-block', marginBottom: 8 }}>Neue Dropdowns aktiv</div>
        {months.map((m, i) => (<button key={i} className={`tab ${currentMonth === i ? 'active' : ''}`} onClick={() => onMonthChange(i)}>{m}</button>))}
      </div>

      <div style={{ marginTop: 8, marginLeft: 4, fontSize: 15, color: '#1976d2', textAlign: 'left' }}>
        <b>Diensttage Abteilung {department}:</b>
        <span style={{ marginLeft: 12, fontSize: 13, color: '#fff', background: '#2e7d32', padding: '4px 8px', borderRadius: 6 }}>Neue Dropdowns aktiv</span>
        <div style={{ marginTop: 4, fontSize: 15 }}>
          {days.map(d => {
            const dayIdx = d.dayOfYear;
            const fahrzeugfuehrer = personnel.filter(p => p.fahrzeugfuehrer && roster[`p_${p.id}`]?.[dayIdx]?.value === 'V');
            const maschinisten = [
              ...personnel.filter(p => roster[`p_${p.id}`]?.[dayIdx]?.value === 'V'),
              ...azubis.filter(a => a.lehrjahr >= 2 && ['RTN','RTT'].includes(roster[`a_${a.id}`]?.[dayIdx]?.value))
            ];
            const azubiOpts = azubis.filter(a => ['RTN','RTT'].includes(roster[`a_${a.id}`]?.[dayIdx]?.value));

            const assignedPersons: string[] = [];
            personnel.forEach(p => { if ((localRoster[`p_${p.id}`] || roster[`p_${p.id}`])?.[dayIdx]?.value === 'V') assignedPersons.push(`p:${p.id}`); });
            azubis.forEach(a => { if ((localRoster[`a_${a.id}`] || roster[`a_${a.id}`])?.[dayIdx]?.value === 'V') assignedPersons.push(`a:${a.id}`); });
            const deptText = (localRoster['0'] || roster['0'])?.[dayIdx];

            return (
              <div key={d.day} style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                <span style={{ minWidth: 80 }}>{d.day}. {months[currentMonth]}</span>

                {[...Array(numRTW)].map((_, rtwIdx) => (
                  <div key={rtwIdx} style={{ display: 'inline-block', marginRight: 8 }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <select style={{ width: 140, marginBottom: 2 }} value={assignedPersons[0] || (deptText && deptText.type === 'text' ? '__text__' : '')} onChange={async e => handleAssign(d.date, dayIdx, e.target.value)}>
                        <option value=""></option>
                        <option value="__text__">Freitext...</option>
                        {personnel.map(p => <option key={`p_${p.id}`} value={`p:${p.id}`}>{p.name}</option>)}
                        {azubis.map(a => <option key={`a_${a.id}`} value={`a:${a.id}`}>{a.name} (Azubi)</option>)}
                      </select>
                      {deptText && deptText.type === 'text' && <span style={{ marginLeft: 8, fontStyle: 'italic', color: '#333' }}>{deptText.value}</span>}

                      <select style={{ width: 140, marginBottom: 2 }} value={assignedPersons[1] || ''} onChange={async e => handleAssign(d.date, dayIdx, e.target.value)}>
                        <option value=""></option>
                        <option value="__text__">Freitext...</option>
                        {personnel.map(p => <option key={`p2_${p.id}`} value={`p:${p.id}`}>{p.name}</option>)}
                        {azubis.map(a => <option key={`a2_${a.id}`} value={`a:${a.id}`}>{a.name} (Azubi)</option>)}
                      </select>

                      <select style={{ width: 140, marginBottom: 2 }} value={assignedPersons[2] || ''} onChange={async e => handleAssign(d.date, dayIdx, e.target.value)}>
                        <option value=""></option>
                        <option value="__text__">Freitext...</option>
                        {personnel.map(p => <option key={`p3_${p.id}`} value={`p:${p.id}`}>{p.name}</option>)}
                        {azubis.map(a => <option key={`a3_${a.id}`} value={`a:${a.id}`}>{a.name} (Azubi)</option>)}
                      </select>
                    </div>

                    <div style={{ display: 'flex', gap: 4 }}>
                      <select style={{ width: 60 }}><option></option>{fahrzeugfuehrer.map(p => <option key={p.id}>{p.name}</option>)}</select>
                      <select style={{ width: 60 }}><option></option>{maschinisten.map(p => <option key={p.id}>{p.name}</option>)}</select>
                      <select style={{ width: 60 }}><option></option>{azubiOpts.map(a => <option key={a.id}>{a.name}</option>)}</select>
                    </div>
                  </div>
                ))}

                {nef && (
                    <div style={{ display: 'inline-block', marginRight: 8 }}>
                        <select style={{ width: 60 }}><option></option>{fahrzeugfuehrer.map(p => <option key={p.id}>{p.name}</option>)}</select>
                    </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
        </div>
    );
};

export default MonthTabs;
