import React, { useState, useEffect } from 'react';
import ImportYearTable from './ImportYearTable';
import SettingsImportExport from './SettingsImportExport';
import { BUILD_INFO } from '../buildInfo';
import styles from './PersonnelOverview.module.css';

interface SettingsMenuProps {
    onClose: () => void;
}

const SettingsMenu: React.FC<SettingsMenuProps> = ({ onClose }) => {
  const [rescueStation, setRescueStation] = useState('1');
    const [year, setYear] = useState(new Date().getFullYear());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
  const [shiftTypes, setShiftTypes] = useState<{ id: number, code: string, description: string; _isNew?: boolean }[]>([]);
    const [shiftTypesLoading, setShiftTypesLoading] = useState(true);
    // ShiftTypes: Auswahl + Editiermodus
    const [selectedShiftTypeId, setSelectedShiftTypeId] = useState<number | null>(null);
    const [editingShiftTypes, setEditingShiftTypes] = useState(false);
    const [originalShiftTypes, setOriginalShiftTypes] = useState<{ id: number, code: string, description: string }[] | null>(null);
  // Fahrzeuge wurden in einen separaten Menüpunkt ausgelagert
  // ITW-Option ins Fahrzeuge-Fenster verlagert
    const [department, setDepartment] = useState<number>(1);
  const [auswertungByType, setAuswertungByType] = useState<Record<string, 'off'|'tag'|'nacht'|'24h'|'itw'>>({});
  const [colorByType, setColorByType] = useState<Record<string, string>>({});
  // ITW Schichtfolgen mit Gültig-ab
  const [itwPatternSeqs, setItwPatternSeqs] = useState<{ startDate: string, pattern: string[] }[]>([]);
  const [editingItwPatterns, setEditingItwPatterns] = useState(false);
  const [originalItwPatterns, setOriginalItwPatterns] = useState<{ startDate: string, pattern: string[] }[] | null>(null);
  const [selectedItwPatternIndex, setSelectedItwPatternIndex] = useState<number | null>(null);
  // Department (1/2/3) Schichtfolgen mit Gültig-ab
  const [deptPatternSeqs, setDeptPatternSeqs] = useState<{ startDate: string, pattern: string[] }[]>([]);
  const [editingDeptPatterns, setEditingDeptPatterns] = useState(false);
  const [originalDeptPatterns, setOriginalDeptPatterns] = useState<{ startDate: string, pattern: string[] }[] | null>(null);
  const [selectedDeptPatternIndex, setSelectedDeptPatternIndex] = useState<number | null>(null);
    // Feiertage des aktuellen Jahres
  const [holidays, setHolidays] = useState<{ date: string, name: string }[]>([]);
  const [editingHolidays, setEditingHolidays] = useState(false);
  const [originalHolidays, setOriginalHolidays] = useState<{ date: string, name: string }[] | null>(null);
  const [selectedHolidayIndex, setSelectedHolidayIndex] = useState<number | null>(null);
  // Jahres-Import UI State
  const [showYearImport, setShowYearImport] = useState(false);
  const [yearImportData, setYearImportData] = useState<string[][] | null>(null);
  const [yearImportProgress, setYearImportProgress] = useState<{ processed: number; total: number } | null>(null);
  // Settings Import/Export UI State
  const [showSettingsImportExport, setShowSettingsImportExport] = useState(false);

    useEffect(() => {
        (async () => {
            const value = await (window as any).api.getSetting('rescueStation');
            if (value) {
              const v = String(value);
              setRescueStation(['1','2','3','4','5'].includes(v) ? v : '1');
            }
            const y = await (window as any).api.getSetting('year');
            if (y) setYear(Number(y));
            const types = await (window as any).api.getShiftTypes();
            setShiftTypes(types);
            // Fahrzeug-UI entfernt
            // ITW-Einstellung wird im Fahrzeuge-Bereich gepflegt
      // load per-shift-type auswertung settings
      const map: Record<string, 'off'|'tag'|'nacht'|'24h'|'itw'> = {};
      const colorMap: Record<string, string> = {};
      for (const t of types) {
        try {
          const v = await (window as any).api.getSetting(`auswertung_${t.code}`);
          map[t.code] = (v || 'off') as any;
        } catch (e) {
          map[t.code] = 'off';
        }
        try {
          const c = await (window as any).api.getSetting(`color_${t.code}`);
          colorMap[t.code] = (typeof c === 'string' && /^#?[0-9a-fA-F]{6}$/.test(c)) ? (c.startsWith('#') ? c : `#${c}`) : '';
        } catch (e) {
          colorMap[t.code] = '';
        }
      }
      setAuswertungByType(map);
      setColorByType(colorMap);
            const dep = await (window as any).api.getSetting('department');
            if (dep) setDepartment(Number(dep));
      // Sequenzen laden
        try {
          const seqs = await (window as any).api.getItwPatterns?.();
        const norm = (arr: string[], len = 21) => (arr || []).slice(0,len).concat(Array(len).fill('')).slice(0,len).map(v => (v === 'IW' ? 'IW' : ''));
        if (Array.isArray(seqs) && seqs.length > 0) {
          const parsed = seqs.map((s: any) => ({ startDate: String(s.startDate), pattern: norm(String(s.pattern).split(',').map((x: string) => x.trim()), 21) }));
            parsed.sort((a, b) => a.startDate.localeCompare(b.startDate));
            setItwPatternSeqs(parsed);
        }
        } catch {}
      // Dept Sequenzen laden
      try {
        const seqs = await (window as any).api.getDeptPatterns?.();
        const normDept = (arr: string[], len = 21) => (arr || []).slice(0,len).concat(Array(len).fill('')).slice(0,len).map(v => (v === '1' || v === '2' || v === '3') ? v : '');
        if (Array.isArray(seqs) && seqs.length > 0) {
          const parsed = seqs.map((s: any) => ({ startDate: String(s.startDate), pattern: normDept(String(s.pattern).split(',').map((x: string) => x.trim()), 21) }));
          parsed.sort((a,b) => a.startDate.localeCompare(b.startDate));
          setDeptPatternSeqs(parsed);
        }
      } catch {}
      // Feiertage laden
      try {
        const list = await (window as any).api.getHolidaysForYear?.(Number(y || new Date().getFullYear()));
        setHolidays((list || []).map((h: any) => ({ date: String(h.date), name: String(h.name || '') })));
      } catch {}
            setShiftTypesLoading(false);
            setLoading(false);
        })();
    }, []);

    // Fahrzeug-UI entfernt

    const handleSave = async () => {
        setSaving(true);
        await (window as any).api.setSetting('rescueStation', rescueStation);
        await (window as any).api.setSetting('year', String(year));
  // Anzahl RTW/NEF leitet sich aus den Einträgen ab – keine separaten Settings mehr
  // ITW wird im Fahrzeuge-Menü gesetzt
        await (window as any).api.setSetting('department', String(department));
      // save per-shift-type auswertung settings
      for (const code of Object.keys(auswertungByType)) {
        await (window as any).api.setSetting(`auswertung_${code}`, auswertungByType[code]);
      }
      // save per-shift-type color settings
      for (const code of Object.keys(colorByType)) {
        const raw = colorByType[code] || '';
        const v = raw ? (raw.startsWith('#') ? raw : `#${raw}`) : '';
        await (window as any).api.setSetting(`color_${code}`, v);
      }
      // Sequenzen speichern
      try {
        const payload = (itwPatternSeqs || []).map(s => ({ startDate: s.startDate, pattern: (s.pattern || []).map(v => (v === 'IW' ? 'IW' : '')).join(',') }));
        await (window as any).api.setItwPatterns?.(payload);
      } catch {}
      // Dept Sequenzen speichern
      try {
        const payloadDept = (deptPatternSeqs || []).map(s => ({ startDate: s.startDate, pattern: (s.pattern || []).map(v => (v === '1' || v === '2' || v === '3') ? v : '').join(',') }));
        await (window as any).api.setDeptPatterns?.(payloadDept);
      } catch {}
      // Feiertage speichern (überschreibt Jahr komplett). Danach Liste für Zieljahr neu laden
      try {
        await (window as any).api.setHolidaysForYear?.(year, holidays.map(h => ({ date: h.date, name: h.name })));
        // Nach dem Speichern direkt neu laden, um UI-Sicherheit zu erhöhen
        try {
          const fresh = await (window as any).api.getHolidaysForYear?.(year);
          setHolidays((fresh || []).map((h: any) => ({ date: String(h.date), name: String(h.name || '') })));
        } catch {}
      } catch {}
        setSaving(false);
        onClose();
    };

    // Jahres-Import: Daten anwenden
    const applyYearImport = async (importData?: string[][]) => {
      const data = importData || yearImportData;
      if (!data) return;
      try {
        const ok = window.confirm(`Alle Einträge im Dienstplan für das Jahr ${year} werden überschrieben. Fortfahren?`);
        if (!ok) return;
        const list = await (window as any).api.getPersonnelList();
        const azubiList = await (window as any).api.getAzubiList();
        const combined = [
          ...list.map((p: any) => ({ id: `p_${p.id}`, origId: p.id, type: 'person' })),
          ...azubiList.map((a: any) => ({ id: `a_${a.id}`, origId: a.id, type: 'azubi' }))
        ];
        const entries: any[] = [];
        for (let row = 0; row < combined.length; row++) {
          const rowData = data[row];
          if (!rowData) continue;
          for (let col = 0; col < rowData.length; col++) {
            const value = (rowData[col] || '').trim();
            if (!value) continue;
            // Verwende UTC, um Off-by-one durch Zeitzone zu vermeiden
            const dObj = new Date(Date.UTC(year, 0, 1 + col));
            if (dObj.getUTCFullYear() !== year) continue;
            const date = dObj.toISOString().slice(0,10);
            const type = (shiftTypes.some(st => st.code === value)) ? 'dropdown' : 'text';
            entries.push({ personId: combined[row].origId, personType: combined[row].type, date, value, type });
          }
        }
        const progHandler = (_ev: any, info: { processed: number; total: number }) => {
          setYearImportProgress(info);
        };
        (window as any).api.onBulkImportProgress(progHandler);
        // Jahr säubern, dann bulk import
        await (window as any).api.clearDutyRosterYear(year);
        await (window as any).api.bulkSetDutyRoster(entries);
        (window as any).api.offBulkImportProgress(progHandler);
        setShowYearImport(false);
        setYearImportData(null);
        setYearImportProgress(null);
      } catch (e) {
        console.warn('[SettingsMenu] applyYearImport Fehler', e);
      }
    };

    // Wenn die Jahreszahl im Settings-Menü geändert wird, die Feiertage dieses Jahres anzeigen
    useEffect(() => {
      (async () => {
        try {
          const list = await (window as any).api.getHolidaysForYear?.(year);
          setHolidays((list || []).map((h: any) => ({ date: String(h.date), name: String(h.name || '') })));
        } catch {}
      })();
    }, [year]);

  // ShiftTypes: Verhalten wie bei Personal/Fahrzeuge (Auswahl, Ändern, Speichern/Abbrechen, Hinzufügen als leere Zeile)
  const startEditingShiftTypes = () => {
    setOriginalShiftTypes(JSON.parse(JSON.stringify(shiftTypes)));
    setEditingShiftTypes(true);
  };
  const cancelEditingShiftTypes = () => {
    if (originalShiftTypes) setShiftTypes(originalShiftTypes);
    setOriginalShiftTypes(null);
    setEditingShiftTypes(false);
  };
  const saveEditingShiftTypes = async () => {
    try {
      // Speichere Änderungen und neue Zeilen
      const orig = originalShiftTypes || [];
      // Map für alte Codes -> auswertung Werte
      const ausMap = { ...(auswertungByType || {}) } as Record<string, 'off'|'tag'|'nacht'|'24h'|'itw'>;
      const colMap = { ...(colorByType || {}) } as Record<string, string>;
      for (const t of shiftTypes) {
        if (t._isNew) {
          if (!t.code.trim() || !t.description.trim()) continue;
          await (window as any).api.addShiftType({ code: t.code, description: t.description });
          const v = ausMap[t.code] || 'off';
          try { await (window as any).api.setSetting(`auswertung_${t.code}`, v); } catch {}
          // persist color for new code (if any)
          try { await (window as any).api.setSetting(`color_${t.code}`, (colMap[t.code] || '')); } catch {}
        } else {
          const prev = orig.find(o => o.id === t.id);
          if (prev && (prev.code !== t.code || prev.description !== t.description)) {
            // bei Code-Änderung Auswertung verschieben
            const oldCode = prev.code;
            const newCode = t.code;
            await (window as any).api.updateShiftType({ id: t.id, code: newCode, description: t.description });
            if (oldCode !== newCode) {
              const val = ausMap[oldCode] || 'off';
              ausMap[newCode] = val;
              ausMap[oldCode] = ausMap[oldCode] ?? 'off';
              try { await (window as any).api.setSetting(`auswertung_${newCode}`, val); } catch {}
              try { await (window as any).api.setSetting(`auswertung_${oldCode}`, ausMap[oldCode]); } catch {}
              // move color setting
              const colVal = colMap[oldCode] || '';
              colMap[newCode] = colVal;
              colMap[oldCode] = colMap[oldCode] ?? '';
              try { await (window as any).api.setSetting(`color_${newCode}`, colVal || ''); } catch {}
              try { await (window as any).api.setSetting(`color_${oldCode}`, colMap[oldCode] || ''); } catch {}
            } else {
              // Code gleich -> akt. Auswertung persistieren
              try { await (window as any).api.setSetting(`auswertung_${newCode}`, ausMap[newCode] || 'off'); } catch {}
              try { await (window as any).api.setSetting(`color_${newCode}`, colMap[newCode] || ''); } catch {}
            }
          } else if (prev) {
            // keine Textänderung, aber ggf. Auswertung aktualisieren
            try { await (window as any).api.setSetting(`auswertung_${t.code}`, ausMap[t.code] || 'off'); } catch {}
            try { await (window as any).api.setSetting(`color_${t.code}`, colMap[t.code] || ''); } catch {}
          }
        }
      }
      // Entferne temporäre Marker und re-lade Liste
      setEditingShiftTypes(false);
      setOriginalShiftTypes(null);
      const fresh = await (window as any).api.getShiftTypes();
      setShiftTypes(fresh);
    } catch (e) {
      console.warn('[SettingsMenu] saveEditingShiftTypes Fehler', e);
    }
  };
  const addShiftTypeRow = () => {
    setEditingShiftTypes(true);
    setShiftTypes(prev => [...prev, { id: Math.floor(-Date.now() / 1000), code: '', description: '', _isNew: true }]);
  };
  const deleteSelectedShiftType = async () => {
    if (selectedShiftTypeId == null) return;
    // Nur echte DB-Einträge löschen
    const row = shiftTypes.find(t => t.id === selectedShiftTypeId);
    if (!row) return;
    if (row._isNew) {
      setShiftTypes(prev => prev.filter(t => t.id !== row.id));
      setSelectedShiftTypeId(null);
      return;
    }
    await (window as any).api.deleteShiftType(row.id);
    setSelectedShiftTypeId(null);
    setShiftTypes(await (window as any).api.getShiftTypes());
  };

  const handleSettingsImportComplete = (result: any) => {
    console.log('Settings-Import abgeschlossen:', result);
    // Daten neu laden nach Import durch Seiten-Reload
    if (result.success) {
      const total = result.imported.settings + result.imported.shiftTypes + result.imported.holidays + 
                   result.imported.itwPatterns + result.imported.deptPatterns + result.imported.rtwVehicles + 
                   result.imported.nefVehicles;
      alert(`Import erfolgreich! ${total} Einstellungen importiert, ${result.skipped} übersprungen.`);
      // Reload der Seite um alle Daten neu zu laden
      window.location.reload();
    }
  };

    if (loading) return <div className="settings-menu"><p>Lade Einstellungen ...</p></div>;

  return (
        <div className="settings-menu">
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <h2 style={{ margin: 0 }}>Einstellungen</h2>
              <div style={{ fontSize: 12, color: '#666' }}>
                Version {BUILD_INFO.version} (Build {BUILD_INFO.build}) — © Benjamin Kreitz
              </div>
            </div>
            {/* Reihenfolge: Jahr / Rettungswache / Abteilung */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
              <label>
                Jahr:
                <input
                  type="number"
                  value={year}
                  min={2020}
                  max={2100}
                  onChange={e => setYear(Number(e.target.value))}
                  style={{ marginLeft: 8, width: 80 }}
                />
              </label>
              <label>
                Feuer- und Rettungswache:
                <select value={rescueStation} onChange={e => setRescueStation(e.target.value)} style={{ marginLeft: 8 }}>
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                  <option value="5">5</option>
                </select>
              </label>
              <label>
                Abteilung:
                <select value={department} onChange={e => setDepartment(Number(e.target.value))} style={{ marginLeft: 8 }}>
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                </select>
              </label>
            </div>
            {/* Import Dienstplan separater Block */}
            <div style={{ marginTop: 12 }}>
              <button onClick={() => setShowYearImport(true)}>Import Dienstplan…</button>
              <span style={{ marginLeft: 8, fontSize: 12, color: '#555' }}>Bestehende Einträge werden für Tage mit Werten überschrieben.</span>
            </div>
            {/* Import/Export Einstellungen separater Block */}
            <div style={{ marginTop: 12 }}>
              <button onClick={() => setShowSettingsImportExport(true)} style={{ backgroundColor: '#17a2b8', color: 'white' }}>Einstellungen Import/Export…</button>
              <span style={{ marginLeft: 8, fontSize: 12, color: '#555' }}>Backup und Transfer von Konfigurationen.</span>
            </div>
      {/* Buttons werden ans Seitenende verschoben */}
      {/* per-shift-type auswertung selector will be rendered as a column in the Dienstarten table below */}
      {/* ITW Schichtfolgen */}
      <div style={{ marginTop: 24, borderTop: '1px solid #eee', paddingTop: 12 }}>
        <h3>ITW Schichtfolgen</h3>
        <p style={{ marginTop: 0, color: '#666' }}>Pflege hier beliebig viele 21‑Tage‑Schichtfolgen, die ab einem Datum gelten. Die Folge setzt sich jahresübergreifend fort, bis eine neuere Folge beginnt.</p>
        <div>
          <h4>Schichtfolgenwechsel (gültig ab)</h4>
          <table className={styles.table}>
            <thead>
              <tr className={styles.thead}>
                <th style={{ width: 180, position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 1 }}>Gültig ab (YYYY-MM-DD)</th>
                <th>Muster (21 Felder, "IW" oder leer)</th>
                <th className={styles.center} style={{ width: 60 }}>#</th>
              </tr>
            </thead>
            <tbody className={styles.tbody}>
              {(itwPatternSeqs || []).map((s, idx) => (
                <tr key={`${s.startDate}_${idx}`} className={[styles.row, selectedItwPatternIndex === idx ? styles.selected : ''].filter(Boolean).join(' ')} onClick={() => setSelectedItwPatternIndex(prev => prev === idx ? null : idx)}>
                  <td>
                    <input type="date" value={s.startDate} disabled={!editingItwPatterns}
                      onChange={e => {
                        if (!editingItwPatterns) return;
                        const v = e.target.value;
                        setItwPatternSeqs(prev => prev.map((x, i) => i === idx ? { ...x, startDate: v } : x).sort((a,b) => a.startDate.localeCompare(b.startDate)));
                      }} />
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {Array.from({ length: 21 }).map((_, i) => (
                        <select key={i} value={s.pattern[i] || ''} disabled={!editingItwPatterns}
                          onChange={e => {
                            if (!editingItwPatterns) return;
                            const v = e.target.value === 'IW' ? 'IW' : '';
                            setItwPatternSeqs(prev => prev.map((x, j) => {
                              if (j !== idx) return x;
                              const next = [...x.pattern];
                              next[i] = v;
                              return { ...x, pattern: next };
                            }));
                          }}>
                          <option value=""></option>
                          <option value="IW">IW</option>
                        </select>
                      ))}
                    </div>
                  </td>
                  <td className={styles.center}>{selectedItwPatternIndex === idx ? '✓' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!editingItwPatterns ? (
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={() => { setEditingItwPatterns(true); setOriginalItwPatterns(JSON.parse(JSON.stringify(itwPatternSeqs))); setItwPatternSeqs(prev => [...prev, { startDate: new Date().toISOString().slice(0,10), pattern: Array(21).fill('') }].sort((a,b) => a.startDate.localeCompare(b.startDate))); setSelectedItwPatternIndex((itwPatternSeqs?.length ?? 0)); }}>Hinzufügen</button>
              <button onClick={() => { setEditingItwPatterns(true); setOriginalItwPatterns(JSON.parse(JSON.stringify(itwPatternSeqs))); }} disabled={(itwPatternSeqs || []).length === 0}>Ändern</button>
              <button onClick={() => { if (selectedItwPatternIndex != null) setItwPatternSeqs(prev => prev.filter((_, i) => i !== selectedItwPatternIndex)); setSelectedItwPatternIndex(null); }} disabled={selectedItwPatternIndex == null}>Löschen</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={async () => { try { const payload = (itwPatternSeqs || []).map(s => ({ startDate: s.startDate, pattern: (s.pattern || []).map(v => (v === 'IW' ? 'IW' : '')).join(',') })); await (window as any).api.setItwPatterns?.(payload); } catch {} finally { setEditingItwPatterns(false); setOriginalItwPatterns(null); } }}>Speichern</button>
              <button onClick={() => { if (originalItwPatterns) setItwPatternSeqs(originalItwPatterns); setOriginalItwPatterns(null); setEditingItwPatterns(false); setSelectedItwPatternIndex(null); }}>Abbrechen</button>
            </div>
          )}
        </div>
      </div>

      {/* Department Schichtfolgen */}
      <div style={{ marginTop: 24, borderTop: '1px solid #eee', paddingTop: 12 }}>
        <h3>Reguläre Schichtfolgen (Abteilungen 1/2/3)</h3>
        <p style={{ marginTop: 0, color: '#666' }}>Pflege hier die 21‑Tage‑Schichtfolgen mit Gültig-ab; Werte sind 1, 2 oder 3.</p>
        <div>
          <h4>Schichtfolgenwechsel (gültig ab)</h4>
          <table className={styles.table}>
            <thead>
              <tr className={styles.thead}>
                <th style={{ width: 180, position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 1 }}>Gültig ab (YYYY-MM-DD)</th>
                <th>Muster (21 Felder, 1/2/3)</th>
                <th className={styles.center} style={{ width: 60 }}>#</th>
              </tr>
            </thead>
            <tbody className={styles.tbody}>
              {(deptPatternSeqs || []).map((s, idx) => (
                <tr key={`${s.startDate}_${idx}`} className={[styles.row, selectedDeptPatternIndex === idx ? styles.selected : ''].filter(Boolean).join(' ')} onClick={() => setSelectedDeptPatternIndex(prev => prev === idx ? null : idx)}>
                  <td>
                    <input type="date" value={s.startDate} disabled={!editingDeptPatterns}
                      onChange={e => {
                        if (!editingDeptPatterns) return;
                        const v = e.target.value;
                        setDeptPatternSeqs(prev => prev.map((x, i) => i === idx ? { ...x, startDate: v } : x).sort((a,b) => a.startDate.localeCompare(b.startDate)));
                      }} />
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {Array.from({ length: 21 }).map((_, i) => (
                        <select key={i} value={s.pattern[i] || ''} disabled={!editingDeptPatterns}
                          onChange={e => {
                            if (!editingDeptPatterns) return;
                            const v = ['1','2','3'].includes(e.target.value) ? e.target.value : '';
                            setDeptPatternSeqs(prev => prev.map((x, j) => {
                              if (j !== idx) return x;
                              const next = [...x.pattern];
                              next[i] = v as any;
                              return { ...x, pattern: next };
                            }));
                          }}>
                          <option value=""></option>
                          <option value="1">1</option>
                          <option value="2">2</option>
                          <option value="3">3</option>
                        </select>
                      ))}
                    </div>
                  </td>
                  <td className={styles.center}>{selectedDeptPatternIndex === idx ? '✓' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!editingDeptPatterns ? (
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={() => { setEditingDeptPatterns(true); setOriginalDeptPatterns(JSON.parse(JSON.stringify(deptPatternSeqs))); setDeptPatternSeqs(prev => [...prev, { startDate: new Date().toISOString().slice(0,10), pattern: Array(21).fill('') }].sort((a,b) => a.startDate.localeCompare(b.startDate))); setSelectedDeptPatternIndex((deptPatternSeqs?.length ?? 0)); }}>Hinzufügen</button>
              <button onClick={() => { setEditingDeptPatterns(true); setOriginalDeptPatterns(JSON.parse(JSON.stringify(deptPatternSeqs))); }} disabled={(deptPatternSeqs || []).length === 0}>Ändern</button>
              <button onClick={() => { if (selectedDeptPatternIndex != null) setDeptPatternSeqs(prev => prev.filter((_, i) => i !== selectedDeptPatternIndex)); setSelectedDeptPatternIndex(null); }} disabled={selectedDeptPatternIndex == null}>Löschen</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={async () => { try { const payload = (deptPatternSeqs || []).map(s => ({ startDate: s.startDate, pattern: (s.pattern || []).map(v => (v === '1' || v === '2' || v === '3') ? v : '').join(',') })); await (window as any).api.setDeptPatterns?.(payload); } catch {} finally { setEditingDeptPatterns(false); setOriginalDeptPatterns(null); } }}>Speichern</button>
              <button onClick={() => { if (originalDeptPatterns) setDeptPatternSeqs(originalDeptPatterns); setOriginalDeptPatterns(null); setEditingDeptPatterns(false); setSelectedDeptPatternIndex(null); }}>Abbrechen</button>
            </div>
          )}
        </div>
      </div>

      {/* Feiertage (dieses Jahr) */}
      <div style={{ marginTop: 24, borderTop: '1px solid #eee', paddingTop: 12 }}>
        <h3>Feiertage {year}</h3>
        <p style={{ marginTop: 0, color: '#666' }}>An diesen Tagen wird der ITW nicht besetzt (IW entfällt). Du kannst Datum und (optional) Name pflegen.</p>
        <table className={styles.table}>
          <thead>
            <tr className={styles.thead}>
              <th style={{ width: 160 }}>Datum (YYYY-MM-DD)</th>
              <th>Name</th>
              <th className={styles.center} style={{ width: 60 }}>#</th>
            </tr>
          </thead>
          <tbody className={styles.tbody}>
            {holidays.map((h, idx) => (
              <tr key={`${h.date}_${idx}`} className={[styles.row, selectedHolidayIndex === idx ? styles.selected : ''].filter(Boolean).join(' ')} onClick={() => setSelectedHolidayIndex(prev => prev === idx ? null : idx)}>
                <td>
                  <input
                    type="date"
                    value={h.date}
                    disabled={!editingHolidays}
                    onChange={e => {
                      if (!editingHolidays) return;
                      const v = e.target.value;
                      setHolidays(prev => prev.map((x, i) => i === idx ? { ...x, date: v } : x));
                    }}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={h.name}
                    disabled={!editingHolidays}
                    onChange={e => {
                      if (!editingHolidays) return;
                      const v = e.target.value;
                      setHolidays(prev => prev.map((x, i) => i === idx ? { ...x, name: v } : x));
                    }}
                  />
                </td>
                <td className={styles.center}>{selectedHolidayIndex === idx ? '✓' : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!editingHolidays ? (
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={() => { setEditingHolidays(true); setOriginalHolidays(JSON.parse(JSON.stringify(holidays))); setHolidays(prev => [...prev, { date: `${year}-01-01`, name: '' }]); setSelectedHolidayIndex((holidays?.length ?? 0)); }}>Hinzufügen</button>
            <button onClick={() => setEditingHolidays(true)} disabled={holidays.length === 0}>Ändern</button>
            <button onClick={() => { if (selectedHolidayIndex != null) setHolidays(prev => prev.filter((_, i) => i !== selectedHolidayIndex)); setSelectedHolidayIndex(null); }} disabled={selectedHolidayIndex == null}>Löschen</button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={async () => { try { await (window as any).api.setHolidaysForYear?.(year, holidays.map(h => ({ date: h.date, name: h.name }))); const fresh = await (window as any).api.getHolidaysForYear?.(year); setHolidays((fresh || []).map((h: any) => ({ date: String(h.date), name: String(h.name || '') }))); } catch {} finally { setEditingHolidays(false); setOriginalHolidays(null); setSelectedHolidayIndex(null); } }}>Speichern</button>
            <button onClick={() => { if (originalHolidays) setHolidays(originalHolidays); setOriginalHolidays(null); setEditingHolidays(false); setSelectedHolidayIndex(null); }}>Abbrechen</button>
          </div>
        )}
      </div>

      {/* Dienstarten */}
      <div style={{ marginTop: 24, borderTop: '1px solid #eee', paddingTop: 12 }}>
        <h3>Dienstarten</h3>
        {shiftTypesLoading ? <div>Lade Dienstarten ...</div> : (
          <>
            <table className={styles.table}>
              <thead>
                <tr className={styles.thead}>
                  <th style={{ width: 80 }}>Kürzel</th>
                  <th>Beschreibung</th>
                  <th style={{ width: 140 }}>Farbe</th>
                  <th style={{ width: 220 }}>Auswertung</th>
                  <th className={styles.center} style={{ width: 60 }}>#</th>
                </tr>
              </thead>
              <tbody className={styles.tbody}>
                {shiftTypes.map(st => (
                  <tr key={st.id} className={[styles.row, selectedShiftTypeId === st.id ? styles.selected : ''].filter(Boolean).join(' ')} onClick={() => setSelectedShiftTypeId(prev => prev === st.id ? null : st.id)}>
                    <td>
                      {editingShiftTypes ? (
                        <input value={st.code} maxLength={4} style={{ width: 60 }}
                          onChange={e => {
                            const v = e.target.value;
                            const prevCode = st.code;
                            setShiftTypes(prev => prev.map(x => x.id === st.id ? { ...x, code: v } : x));
                            // Stelle sicher, dass ein Auswertungseintrag existiert
                            setAuswertungByType(prev => prev[v] ? prev : ({ ...prev, [v]: prev[prevCode] || 'off' }));
                            // Farbeintrag übertragen, falls noch nicht vorhanden
                            setColorByType(prev => prev[v] ? prev : ({ ...prev, [v]: prev[prevCode] || '' }));
                          }} />
                      ) : st.code}
                    </td>
                    <td>
                      {editingShiftTypes ? (
                        <input value={st.description}
                          onChange={e => setShiftTypes(prev => prev.map(x => x.id === st.id ? { ...x, description: e.target.value } : x))} />
                      ) : st.description}
                    </td>
                    <td>
                      {editingShiftTypes ? (
                        <input
                          type="color"
                          value={(colorByType[st.code] && /^#?[0-9a-fA-F]{6}$/.test(colorByType[st.code]) ? (colorByType[st.code].startsWith('#') ? colorByType[st.code] : `#${colorByType[st.code]}`) : '#888888')}
                          onChange={e => {
                            const val = e.target.value;
                            setColorByType(prev => ({ ...prev, [st.code]: val }));
                          }}
                          style={{ width: 48, height: 28, padding: 0, border: '1px solid var(--line)', borderRadius: 6, background: 'transparent' }}
                          title="Farbe für diese Dienstart"
                        />
                      ) : (
                        <div style={{ width: 16, height: 16, borderRadius: 4, border: '1px solid var(--line)', background: (colorByType[st.code] || '') || 'transparent' }} title={colorByType[st.code] || 'keine Farbe'} />
                      )}
                    </td>
                    <td>
                      {editingShiftTypes ? (
                        <select value={auswertungByType[st.code] || 'off'}
                          onChange={e => {
                            const val = e.target.value as any;
                            setAuswertungByType(prev => ({ ...prev, [st.code]: val }));
                          }}>
                          <option value="off">Aus</option>
                          <option value="tag">Tag</option>
                          <option value="nacht">Nacht</option>
                          <option value="24h">24h</option>
                          <option value="itw">ITW</option>
                        </select>
                      ) : (
                        (() => {
                          const v = auswertungByType[st.code] || 'off';
                          switch (v) {
                            case 'tag': return 'Tag';
                            case 'nacht': return 'Nacht';
                            case '24h': return '24h';
                            case 'itw': return 'ITW';
                            default: return 'Aus';
                          }
                        })()
                      )}
                    </td>
                    <td className={styles.center}>{selectedShiftTypeId === st.id ? '✓' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!editingShiftTypes ? (
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button onClick={addShiftTypeRow}>Hinzufügen</button>
                <button onClick={startEditingShiftTypes} disabled={shiftTypes.length === 0}>Ändern</button>
                <button onClick={deleteSelectedShiftType} disabled={selectedShiftTypeId == null}>Löschen</button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button onClick={saveEditingShiftTypes}>Speichern</button>
                <button onClick={cancelEditingShiftTypes}>Abbrechen</button>
              </div>
            )}
          </>
        )}
      </div>
      {/* Speichern/Abbrechen unten platzieren */}
      <div style={{ marginTop: 24, borderTop: '1px solid #eee', paddingTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={{ marginRight: 8 }}>Abbrechen</button>
        <button onClick={handleSave} disabled={saving}>
          {saving ? 'Speichern ...' : 'Speichern'}
        </button>
      </div>
      {showYearImport && (
        <YearImportOverlay
          year={year}
          progress={yearImportProgress}
          onClose={() => { setShowYearImport(false); setYearImportData(null); setYearImportProgress(null); }}
          onImport={(data) => { setYearImportData(data); applyYearImport(data); }}
        />
      )}
      {showSettingsImportExport && (
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          backgroundColor: 'rgba(0,0,0,0.5)', 
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
          }}>
            <SettingsImportExport 
              onImportComplete={handleSettingsImportComplete}
              onClose={() => setShowSettingsImportExport(false)}
            />
          </div>
        </div>
      )}
          </div>
    );
};

// Hilfskomponente für das asynchrone Laden der Personen/Azubis vor Anzeige der ImportYearTable
const YearImportOverlay: React.FC<{ year: number; onClose: () => void; onImport: (data: string[][]) => void; progress?: { processed: number; total: number } | null; }> = ({ year, onClose, onImport, progress }) => {
  const [loading, setLoading] = React.useState(true);
  const [list, setList] = React.useState<any[]>([]);
  React.useEffect(() => {
    (async () => {
      try {
        const p = await (window as any).api.getPersonnelList();
        const a = await (window as any).api.getAzubiList();
        const combined = [
          ...p.map((x: any) => ({ id: `p_${x.id}`, name: x.name, vorname: x.vorname, isAzubi: false })),
          ...a.map((x: any) => ({ id: `a_${x.id}`, name: x.name, vorname: x.vorname, isAzubi: true, lehrjahr: x.lehrjahr }))
        ];
        setList(combined);
      } catch (e) { console.warn('[YearImportOverlay] Laden fehlgeschlagen', e); }
      setLoading(false);
    })();
  }, []);
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {loading ? (
        <div style={{ background: '#fff', padding: 32, borderRadius: 8 }}>Lade Personen & Azubis ...</div>
      ) : progress ? (
        <div style={{ background: '#fff', padding: 32, borderRadius: 8, minWidth: 340 }}>
          <h3 style={{ marginTop: 0 }}>Importiere Jahresdaten ...</h3>
          <div style={{ marginTop: 16 }}>
            <div style={{ height: 18, background: '#eee', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${Math.max(0, Math.min(100, progress.total ? (progress.processed / progress.total * 100) : 0)).toFixed(1)}%`, background: '#1976d2', height: '100%', transition: 'width 0.2s' }} />
            </div>
            <div style={{ marginTop: 8, fontSize: 13, color: '#444' }}>{progress.processed} / {progress.total} Einträge</div>
          </div>
          <div style={{ marginTop: 16, textAlign: 'right' }}>
            <button onClick={onClose}>Schließen</button>
          </div>
        </div>
      ) : (
        <ImportYearTable
          year={year}
          personnel={list}
          onCancel={onClose}
          onImport={onImport}
        />
      )}
    </div>
  );
};

export default SettingsMenu;