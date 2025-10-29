import React, { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import ImportMonthDialog from './ImportMonthDialog';
import ImportTable from './ImportTable';
import DepartmentDutyDaysTable from './DepartmentDutyDaysTable';
import DepartmentDutyDaysTableData from './DepartmentDutyDaysTableData';
import { BUILD_INFO } from '../buildInfo';

interface Person {
  id: number;
  name: string;
  vorname: string;
}

const getDaysInYear = (year: number) => {
  const days: { date: string; weekday: string; iso: string }[] = [];
  const start = new Date(year, 0, 1);
  const end = new Date(year + 1, 0, 1);
  const numDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  for (let i = 0; i < numDays; i++) {
    const d = new Date(Date.UTC(year, 0, 1 + i));
    const date = d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
    const weekday = d.toLocaleDateString('de-DE', { weekday: 'short' });
    const iso = d.toISOString().slice(0, 10);
    days.push({ date, weekday, iso });
  }
  return days;
};

const DutyRoster: React.FC = () => {
  const [personnel, setPersonnel] = useState<Person[]>([]);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [shiftTypes, setShiftTypes] = useState<{ id: number, code: string, description: string }[]>([]);
  const [customDropdownValues, setCustomDropdownValues] = useState<string[]>([]);
  const [shiftPattern] = useState<string[]>([
    '3', '2', '1', '3', '1', '3', '2', '1', '3', '2', '1', '2', '1', '3', '2', '1', '3', '2', '3', '2', '1'
  ]);
  // Dienstplan-State: { [personId: string]: { [dayIndex]: { value, type } } }
  const [roster, setRoster] = useState<Record<string, Record<number, { value: string, type: 'dropdown' | 'text' }>>>({});
  // Editierstatus: [personId: string][dayIdx] => true/false
  const [editing, setEditing] = useState<Record<string, Record<number, boolean>>>({});
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importMonth, setImportMonth] = useState<number|null>(null);
  const [showImportTable, setShowImportTable] = useState(false);
  const [importTableMonth, setImportTableMonth] = useState<number|null>(null);
  const [azubis, setAzubis] = useState<{ id: number; name: string; vorname: string; lehrjahr: number }[]>([]);

  useEffect(() => {
    (async () => {
      const list = await (window as any).api.getPersonnelList();
      const azubiList = await (window as any).api.getAzubiList();
      setPersonnel(list);
      setAzubis(azubiList);
      const y = await (window as any).api.getSetting('year');
      if (y) setYear(Number(y));
  const types = await (window as any).api.getShiftTypes();
  setShiftTypes(types);
  const custom = await (window as any).api.getSetting('customDropdownValues');
  if (custom) setCustomDropdownValues(String(custom).split('\n').map(s => s.trim()).filter(Boolean));
      // Dienstplan-Einträge laden
      const entries = await (window as any).api.getDutyRoster(y || new Date().getFullYear());
      console.log('[Renderer] getDutyRoster fetched', Array.isArray(entries) ? entries.length : typeof entries, 'entries');
      if (Array.isArray(entries) && entries.length > 0) {
        console.log('[Renderer] sample entry[0]=', entries[0]);
      }
      const daysArr = getDaysInYear(Number(y || new Date().getFullYear()));
      // IDs für Mapping vorbereiten (immer aktuell aus den geladenen Listen)
      const personalIds = new Set(list.map((p: { id: number }) => p.id));
      const azubiIds = new Set(azubiList.map((a: { id: number }) => a.id));
      const rosterObj: Record<string, Record<number, { value: string, type: 'dropdown' | 'text' }>> = {};
      entries.forEach((entry: any) => {
        const dayIdx = daysArr.findIndex(d => d.iso === entry.date);
        if (dayIdx >= 0) {
          // Normalize type: if value matches a known shift code, prefer dropdown
          try {
            if (entry && entry.value) {
              const code = String(entry.value).trim();
              if (shiftTypes && Array.isArray(shiftTypes) && shiftTypes.some((t: any) => t.code === code)) {
                entry.type = 'dropdown';
              } else {
                entry.type = 'text';
              }
            }
          } catch (e) { /* ignore */ }
          let key = '';
          if (entry.personType === 'person' && personalIds.has(entry.personId)) {
            key = `p_${entry.personId}`;
          } else if (entry.personType === 'azubi' && azubiIds.has(entry.personId)) {
            key = `a_${entry.personId}`;
          } else {
            key = String(entry.personId);
          }
            if (!rosterObj[key]) rosterObj[key] = {}; 
            rosterObj[key][dayIdx] = { value: entry.value, type: entry.type }; 
            console.log('[Renderer] constructed rosterObj keys=', Object.keys(rosterObj).slice(0,20), 'total=', Object.keys(rosterObj).length);
        }
      });
      setRoster(rosterObj);
    })();
    // Listener: wenn Main einen Update-Broadcast sendet, neu laden
    const onUpdated = () => { console.log('[Renderer] duty-roster-updated empfangen, reloadRoster aufrufen'); reloadRoster(); };
    (window as any).api && (window as any).api.onDutyRosterUpdated && (window as any).api.onDutyRosterUpdated(onUpdated);
    // Cleanup
    return () => {
      (window as any).api && (window as any).api.offDutyRosterUpdated && (window as any).api.offDutyRosterUpdated(onUpdated);
    };
  }, []);

  // Korrektur: Nutze immer das Jahr aus dem State
  const days = getDaysInYear(year);
  // Debug: Zeige die ersten 5 Tage im Jahr
  console.log('[DEBUG] days[0-4]:', days.slice(0,5));

  // Kombiniere Personal und Azubis für die Dienstplan-Tabelle
  type Row = { id: string; origId: number; name: string; vorname: string; isAzubi: boolean; lehrjahr?: number };
  const allRows: Row[] = [
    ...personnel.map(p => ({ id: `p_${p.id}`, origId: p.id, name: p.name, vorname: p.vorname, isAzubi: false })),
    ...azubis.map(a => ({ id: `a_${a.id}`, origId: a.id, name: a.name, vorname: a.vorname, isAzubi: true, lehrjahr: a.lehrjahr }))
  ];
  // Sortiere Azubis nach Lehrjahr, Personal bleibt oben
  allRows.sort((a, b) => {
    if (a.isAzubi && b.isAzubi) return ((a.lehrjahr ?? 0) - (b.lehrjahr ?? 0)) || a.name.localeCompare(b.name);
    if (a.isAzubi) return 1;
    if (b.isAzubi) return -1;
    return 0;
  });

  // Hilfsfunktionen für State-Keys
  const getStateKey = (row: Row) => row.id;

  // Maximale Nachnamenslänge für Spaltenbreite berechnen
  const maxNameLength = Math.max(...personnel.map(p => p.name.length), 4);
  const nameColWidth = Math.max(80, maxNameLength * 12 + 24); // 12px pro Buchstabe + etwas Puffer

  // Import-Handler
  const handleImport = () => {
    setShowImportDialog(true);
  };
  const handleMonthSelected = (month: number) => {
    setImportMonth(month);
    setShowImportDialog(false);
    setImportTableMonth(month);
    setShowImportTable(true);
  };
  const handleImportCancel = () => setShowImportDialog(false);
  const handleImportTableCancel = () => {
    setShowImportTable(false);
    setImportTableMonth(null);
  };
  const handleImportTableImport = async (data: string[][]) => {
    if (importTableMonth === null) return;
    const daysInMonth = new Date(year, importTableMonth + 1, 0).getDate();
    for (let row = 0; row < personnel.length; ++row) {
      const person = personnel[row];
      for (let col = 0; col < daysInMonth; ++col) {
        const value = (data[row] && data[row][col]) ? data[row][col].trim() : '';
        if (value) {
          const date = new Date(year, importTableMonth, col + 1).toISOString().slice(0, 10);
          const type = shiftTypes.some(t => t.code === value) ? 'dropdown' : 'text';
          await (window as any).api.setDutyRosterEntry({ personId: person.id, personType: 'person', date, value, type });
        }
      }
    }
    // Azubi-Import analog, falls gewünscht (hier ggf. erweitern)
    setShowImportTable(false);
    setImportTableMonth(null);
    window.location.reload();
  };

  // Hilfsfunktion zum Neuladen NUR des Dienstplan-States (Roster)
  const reloadRoster = async () => {
    const list = await (window as any).api.getPersonnelList();
    const azubiList = await (window as any).api.getAzubiList();
    setPersonnel(list);
    setAzubis(azubiList);
    const y = await (window as any).api.getSetting('year');
    const yearNum = Number(y || new Date().getFullYear());
    const entries = await (window as any).api.getDutyRoster(yearNum);
    console.log('[Renderer] reloadRoster getDutyRoster fetched', Array.isArray(entries) ? entries.length : typeof entries, 'entries');
    if (Array.isArray(entries) && entries.length > 0) {
      console.log('[Renderer] reloadRoster sample entry[0]=', entries[0]);
    }
    const daysArr = getDaysInYear(yearNum);
    // IDs für Mapping IMMER aus aktuellem State
    const personalIds = new Set(list.map((p: { id: number }) => p.id));
    const azubiIds = new Set(azubiList.map((a: { id: number }) => a.id));
    const rosterObj: Record<string, Record<number, { value: string, type: 'dropdown' | 'text' }>> = {};
    entries.forEach((entry: any) => {
      const dayIdx = daysArr.findIndex(d => d.iso === entry.date);
      if (dayIdx >= 0) {
          // Normalize type: if value matches a known shift code, prefer dropdown
          try {
            if (entry && entry.value) {
              const code = String(entry.value).trim();
              if (shiftTypes && Array.isArray(shiftTypes) && shiftTypes.some((t: any) => t.code === code)) {
                entry.type = 'dropdown';
              } else {
                entry.type = 'text';
              }
            }
          } catch (e) { /* ignore */ }
        let key = '';
        if (entry.personType === 'person' && personalIds.has(entry.personId)) {
          key = `p_${entry.personId}`;
        } else if (entry.personType === 'azubi' && azubiIds.has(entry.personId)) {
          key = `a_${entry.personId}`;
        } else {
          key = String(entry.personId);
        }
        if (!rosterObj[key]) rosterObj[key] = {};
        rosterObj[key][dayIdx] = { value: entry.value, type: entry.type };
      }
    });
      console.log('[Renderer] reloadRoster constructed rosterObj keys=', Object.keys(rosterObj).slice(0,20), 'total=', Object.keys(rosterObj).length);
    setRoster(rosterObj);
  };

  // Handler für Zellenbearbeitung
  const startEdit = (personId: string, dayIdx: number) => {
    setEditing(prev => ({
      ...prev,
      [personId]: { ...prev[personId], [dayIdx]: true }
    }));
  };

  const stopEdit = (personId: string, dayIdx: number) => {
    setEditing(prev => ({
      ...prev,
      [personId]: { ...prev[personId], [dayIdx]: false }
    }));
  };

  const handleCellChange = async (personId: string, dayIdx: number, value: string, type: 'dropdown' | 'text') => {
    // setRoster entfernt, da reloadRoster die Daten korrekt lädt
    let origId: number | null = null;
    let personType = 'person';
    if (personId.startsWith('p_')) {
      origId = parseInt(personId.slice(2), 10);
      personType = 'person';
    } else if (personId.startsWith('a_')) {
      origId = parseInt(personId.slice(2), 10);
      personType = 'azubi';
    }
  // Korrektur: Jahr aus State verwenden, damit 1.1. korrekt zugeordnet wird
  const date = days[dayIdx]?.iso;
    if (dayIdx === 0) {
      console.log('[DEBUG] 1.1. Eintrag:', { personId, origId, personType, date, value, type });
    }
    const entry = { personId: origId, personType, date, value, type };
    console.log('[Renderer] setDutyRosterEntry SEND', entry);
    try {
      await (window as any).api.setDutyRosterEntry(entry);
      console.log('[Renderer] setDutyRosterEntry OK', entry);
      await reloadRoster();
    } catch (err) {
      console.error('[Renderer] setDutyRosterEntry ERROR', err, entry);
    }
  };

  return (
    <div style={{ overflowX: 'auto', padding: 16 }}>
      <h2>Dienstplan {year}</h2>
      <label style={{ display: 'inline-block', marginBottom: 12 }}>
        <span style={{ background: '#1976d2', color: '#fff', padding: '6px 16px', borderRadius: 4, cursor: 'pointer', marginRight: 12 }}
          onClick={handleImport}>
          Import (Excel)
        </span>
        <input type="file" accept=".xlsx,.xls" style={{ display: 'none' }} disabled />
      </label>
      <table style={{ borderCollapse: 'collapse', minWidth: Math.max(800, days.length * 90) }}>
        <thead>
          <tr>
            <th style={{ position: 'sticky', left: 0, background: '#fff', zIndex: 2, border: '1px solid #ccc', minWidth: nameColWidth }}>{'Name'}</th>
            {days.map((d, i) => (
              <th key={i} style={{ border: '1px solid #ccc', whiteSpace: 'nowrap' }}>{d.date}</th>
            ))}
          </tr>
          <tr>
            <th style={{ position: 'sticky', left: 0, background: '#fff', zIndex: 2, border: '1px solid #ccc', minWidth: nameColWidth }}> </th>
            {days.map((d, i) => (
              <th key={i} style={{ border: '1px solid #ccc', whiteSpace: 'nowrap' }}>{d.weekday}</th>
            ))}
          </tr>
          <tr>
            <th style={{ position: 'sticky', left: 0, background: '#fff', zIndex: 2, border: '1px solid #ccc', minWidth: nameColWidth, fontWeight: 'normal', color: '#888', fontSize: 13 }}>Schichtfolge</th>
            {days.map((_, i) => (
              <th key={i} style={{ border: '1px solid #ccc', fontWeight: 'normal', color: '#888', fontSize: 13 }}>
                {shiftPattern[(i % shiftPattern.length)] || ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {allRows.map((person, rowIdx) => {
            // Trennzeile vor dem ersten Azubi
            const isFirstAzubi = person.isAzubi && (rowIdx === 0 || !allRows[rowIdx - 1].isAzubi);
            return [
              isFirstAzubi ? (
                <tr key="azubi-separator">
                  <td colSpan={days.length + 1} style={{ background: '#e0e0e0', fontWeight: 'bold', textAlign: 'left', border: '1px solid #bbb' }}>
                    Azubis
                  </td>
                </tr>
              ) : null,
              (
                <tr key={person.id} style={{ background: rowIdx % 2 === 1 ? '#f5f7fa' : undefined }}>
                  <td style={{ position: 'sticky', left: 0, background: '#fff', zIndex: 1, border: '1px solid #ccc', fontStyle: person.isAzubi ? 'italic' : undefined }}>
                    {person.name}{person.isAzubi && person.lehrjahr !== undefined ? ` (Azubi, ${person.lehrjahr}. Lj.)` : ''}
                  </td>
                  {days.map((_, dayIdx) => {
                    const cell = roster[getStateKey(person)]?.[dayIdx] || { value: '', type: 'dropdown' };
                    const isEditing = editing[getStateKey(person)]?.[dayIdx];
                    return (
                      <td key={dayIdx} style={{ minWidth: 90, cursor: 'pointer', border: '1px solid #ccc', whiteSpace: 'nowrap' }}
                          onClick={() => {
                            if (!isEditing) {
                              console.log('[DEBUG] Zellenklick:', { dayIdx, iso: days[dayIdx].iso, date: days[dayIdx].date });
                              startEdit(getStateKey(person), dayIdx);
                            }
                          }}>
                        {isEditing ? (
                          (
                            <select
                              autoFocus
                              value={cell.value}
                              onBlur={() => stopEdit(getStateKey(person), dayIdx)}
                              onChange={e => {
                                handleCellChange(getStateKey(person), dayIdx, e.target.value, 'dropdown');
                                stopEdit(getStateKey(person), dayIdx);
                              }}
                            >
                              <option value="">-</option>
                              {shiftTypes.map(type => (
                                <option key={type.id} value={type.code}>{type.code}</option>
                              ))}
                              {customDropdownValues.map((v, idx) => (
                                <option key={`custom_${idx}`} value={v}>{v}</option>
                              ))}
                            </select>
                          )
                        ) : (
                          <span style={{ color: cell.value ? undefined : '#bbb' }}>
                            {cell.value || <i>–</i>}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              )
            ];
          })}
        </tbody>
      </table>
      <DepartmentDutyDaysTable year={year} shiftPattern={shiftPattern} />
      <DepartmentDutyDaysTableData year={year} roster={roster} shiftPattern={shiftPattern} />
      {showImportDialog && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.3)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <ImportMonthDialog onSelect={handleMonthSelected} onCancel={handleImportCancel} />
        </div>
      )}
      {showImportTable && importTableMonth !== null && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.3)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <ImportTable
            month={importTableMonth}
            year={year}
            personnel={[
              ...personnel.map(p => ({ id: `p_${p.id}`, name: p.name, vorname: p.vorname, isAzubi: false })),
              ...azubis.map(a => ({ id: `a_${a.id}`, name: a.name, vorname: a.vorname, isAzubi: true, lehrjahr: a.lehrjahr }))
            ]}
            onImport={handleImportTableImport}
            onCancel={handleImportTableCancel}
          />
        </div>
      )}
    <div style={{textAlign: 'center', marginTop: '2rem', color: '#888'}}>
      <small>Version: {BUILD_INFO.version} | Build: {BUILD_INFO.build}</small>
    </div>
  </div>
  );
};

export default DutyRoster;
