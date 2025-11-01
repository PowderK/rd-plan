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
  // Settings Import/Export UI State
  const [showSettingsImportExport, setShowSettingsImportExport] = useState(false);
  const [rosterImportPath, setRosterImportPath] = useState('');
  const [doBackup, setDoBackup] = useState<boolean>(true);
  const [showRestore, setShowRestore] = useState<boolean>(false);
  const [backups, setBackups] = useState<Array<{ path: string; year: string; ym: string; timestamp: string; label: string }>>([]);
  const [previewCounts, setPreviewCounts] = useState<Record<string, { personnel: number; azubis: number; dutyRoster: number }>>({});
  const [showImportPreview, setShowImportPreview] = useState<boolean>(false);
  const [importPreviewData, setImportPreviewData] = useState<{ total: number; matched: number; unmatchedNames: string[]; overwrites: number } | null>(null);
  const [nameMappings, setNameMappings] = useState<Record<string, number>>({}); // normalizedLastName -> personId
  const [peopleOptions, setPeopleOptions] = useState<Array<{ id: number; label: string; lastNameKey: string }>>([]);
  const [restoreFilterYear, setRestoreFilterYear] = useState<string>('Alle');
  const [restoreFilterMonth, setRestoreFilterMonth] = useState<string>('Alle'); // 'Alle' | 'ALL' | '01'..'12'
  const [restorePreviewYear, setRestorePreviewYear] = useState<number>(year);
  const [restorePreviewMonth, setRestorePreviewMonth] = useState<string>('Alle');

    useEffect(() => {
        (async () => {
            const value = await (window as any).api.getSetting('rescueStation');
            if (value) {
              const v = String(value);
              setRescueStation(['1','2','3','4','5'].includes(v) ? v : '1');
            }
            const y = await (window as any).api.getSetting('year');
            if (y) setYear(Number(y));
            const rosterPath = await (window as any).api.getSetting('rosterImportPath');
            if (rosterPath) setRosterImportPath(rosterPath);
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
        await (window as any).api.setSetting('rosterImportPath', rosterImportPath);
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
        onClose();
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

            {/* Dienstplan-Import */}
            <div style={{ marginTop: 24, borderTop: '1px solid #eee', paddingTop: 12 }}>
                <h3>Dienstplan-Vorausplanung</h3>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                        type="text"
                        value={rosterImportPath}
                        readOnly
                        placeholder="Pfad zur Excel-Datei für die Vorausplanung"
                        style={{ flex: 1 }}
                    />
          <button onClick={async () => {
            const result = await (window as any).api.showOpenDialog({
              properties: ['openFile'],
              filters: [{ name: 'Excel-Dateien', extensions: ['xlsx', 'xls', 'xlsm'] }]
            });
            if (!result.canceled && result.filePaths.length > 0) {
              const p = result.filePaths[0];
              setRosterImportPath(p);
              try { await (window as any).api.setSetting('rosterImportPath', p); } catch {}
            }
          }}>Datei auswählen</button>
                </div>
            </div>

            {/* Import Dienstplan (Excel) - Monatsimport aus Settings entfernt */}
            <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="checkbox" checked={doBackup} onChange={e => setDoBackup(e.target.checked)} />
                Backup vor Import erstellen
              </label>
            </div>
            <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                onClick={async () => {
                  try {
                    if (!rosterImportPath) {
                      alert('Bitte zuerst die Excel-Datei auswählen.');
                      return;
                    }
                    // Pfad sicherheitshalber direkt persistieren, falls der Nutzer nicht speichert
                    try { await (window as any).api.setSetting('rosterImportPath', rosterImportPath); } catch {}
                    // Warnung anzeigen: Überschreiben bestätigen
                    let proceed = true;
                    try {
                      const prev = await (window as any).api.getDatabaseSummary?.(Number(year));
                      const prevCount = prev?.success ? prev.counts?.dutyRoster : undefined;
                      const detail = `Vorhandene Einträge für ${year}: ${prevCount ?? 'n/v'}\n`+
                        `Backup wird unter backups/${year}/${year}-ALL/... erstellt.`;
                      const box = await (window as any).api.showMessageBox?.({
                        type: 'warning',
                        buttons: ['Import starten', 'Abbrechen'],
                        defaultId: 0,
                        cancelId: 1,
                        title: 'Dienstplan überschreiben',
                        message: `Achtung: Der Dienstplan für ${year} wird vollständig überschrieben. Fortfahren?`,
                        detail
                      });
                      proceed = !box || typeof box.response !== 'number' ? true : (box.response === 0);
                    } catch {}
                    if (!proceed) return;
                    
                    // Optionales Backup
                    if (doBackup) {
                      try {
                        const r = await (window as any).api.createDatabaseBackup?.({ year: Number(year) });
                        if (!r?.success) console.warn('[SettingsMenu] Backup fehlgeschlagen:', r?.message);
                        else console.log('[SettingsMenu] Backup erstellt unter:', r.dir);
                      } catch (e) {
                        console.warn('[SettingsMenu] Backup Fehler', e);
                      }
                    }

                    // Browser-Confirm Fallback ist bereits im obigen try/catch abgedeckt

                    // Altdaten für das Jahr löschen
                    try {
                      await (window as any).api.clearDutyRosterYear?.(Number(year));
                    } catch (e) {
                      console.warn('[SettingsMenu] clearDutyRosterYear Fehler', e);
                    }

                    const res = await (window as any).api.importDutyRoster(rosterImportPath, Number(year));
                    if (res && res.success) {
                      alert(`Dienstplan für ${year} erfolgreich importiert. Einträge: ${res.importedCount ?? 'n/v'}`);
                      try { (window as any).api.onDutyRosterUpdated?.(() => {}); } catch {}
                    } else {
                      alert(`Import fehlgeschlagen: ${res?.message || 'Unbekannter Fehler'}`);
                    }
                  } catch (e: any) {
                    alert(`Fehler beim Import: ${e?.message || String(e)}`);
                  }
                }}
              >Jahr importieren</button>
              <button
                onClick={async () => {
                  try {
                    if (!rosterImportPath) {
                      alert('Bitte zuerst die Excel-Datei auswählen.');
                      return;
                    }
                    // Lade Vorschau
                    const prev = await (window as any).api.previewDutyRoster?.(rosterImportPath, Number(year));
                    if (!prev?.success) {
                      alert('Vorschau fehlgeschlagen: ' + (prev?.message || 'Unbekannt'));
                      return;
                    }
                    setImportPreviewData({ total: prev.total, matched: prev.matched, unmatchedNames: prev.unmatchedNames || [], overwrites: prev.overwrites || 0 });
                    // Lade Personen + Azubis für Mapping-Vorschläge
                    const [pers, az] = await Promise.all([(window as any).api.getPersonnel?.(), (window as any).api.getAzubiList?.()]);
                    const opts: Array<{ id: number; label: string; lastNameKey: string }> = [];
                    const norm = (s: string) => String(s || '').toLowerCase().trim().replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss').replace(/\./g,'').replace(/\s+/g,' ');
                    for (const p of (pers || [])) opts.push({ id: p.id, label: `${p.name}, ${p.vorname} [P]`, lastNameKey: norm(p.name) });
                    for (const a of (az || [])) opts.push({ id: a.id, label: `${a.name}, ${a.vorname} [A]`, lastNameKey: norm(a.name) });
                    setPeopleOptions(opts);
                    setNameMappings({});
                    setShowImportPreview(true);
                  } catch (e: any) {
                    alert('Fehler bei der Vorschau: ' + (e?.message || String(e)));
                  }
                }}
                style={{ backgroundColor: '#6c757d', color: 'white' }}
              >Import-Vorschau…</button>
              {/* Monatsimport entfernt – erfolgt in Monats-Tabs */}
              <button
                onClick={async () => {
                  try {
                    const res = await (window as any).api.listBackups?.(100);
                    if (res?.success) setBackups(res.list || []);
                    else setBackups([]);
                  } catch {
                    setBackups([]);
                  } finally {
                    setShowRestore(true);
                  }
                }}
              >Backup wiederherstellen…</button>
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
      {showImportPreview && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: 8, width: '92%', maxWidth: 1000, maxHeight: '90vh', overflow: 'auto', padding: 16 }}>
            <h3>Import-Vorschau {year}</h3>
            {importPreviewData ? (
              <>
                <p style={{ marginTop: 0, color: '#555' }}>
                  Gesamt: {importPreviewData.total} · Gematcht: {importPreviewData.matched} · Unmatched: {importPreviewData.unmatchedNames.length} · Überschreibungen: {importPreviewData.overwrites}
                </p>
                {importPreviewData.unmatchedNames.length > 0 ? (
                  <>
                    <p>Bitte ordne nicht erkannte Nachnamen zu:</p>
                    <table className={styles.table}>
                      <thead>
                        <tr className={styles.thead}><th>Nachname (normalisiert)</th><th>Vorschlag</th></tr>
                      </thead>
                      <tbody className={styles.tbody}>
                        {importPreviewData.unmatchedNames.map((ln) => {
                          // einfache Fuzzy-Suche: kleinstes Levenshtein zwischen lastNameKey
                          const levenshtein = (a: string, b: string) => {
                            const m = a.length, n = b.length; const d: number[][] = Array.from({ length: m+1 }, () => Array(n+1).fill(0));
                            for (let i=0;i<=m;i++) d[i][0]=i; for (let j=0;j<=n;j++) d[0][j]=j;
                            for (let i=1;i<=m;i++) for (let j=1;j<=n;j++) {
                              const cost = a[i-1]===b[j-1]?0:1; d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+cost);
                            }
                            return d[m][n];
                          };
                          const candidates = peopleOptions
                            .map(o => ({ ...o, dist: levenshtein(ln, o.lastNameKey) }))
                            .sort((a,b) => a.dist - b.dist)
                            .slice(0, 5);
                          const current = nameMappings[ln] ?? (candidates[0]?.id);
                          return (
                            <tr key={ln} className={styles.row}>
                              <td>{ln}</td>
                              <td>
                                <select value={current ?? ''} onChange={e => setNameMappings(prev => ({ ...prev, [ln]: Number(e.target.value) || undefined }))}>
                                  {candidates.map(c => (
                                    <option key={c.id} value={c.id}>{c.label} · d={c.dist}</option>
                                  ))}
                                  <option value="">(Überspringen)</option>
                                </select>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </>
                ) : (
                  <p>Alle Namen wurden erkannt. Du kannst direkt importieren.</p>
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                  <button onClick={() => setShowImportPreview(false)}>Schließen</button>
                  <button style={{ background: '#28a745', color: 'white' }} onClick={async () => {
                    try {
                      // Sicherheitsabfrage + optionales Backup + Clear (Jahr)
                      let proceed = true;
                      try {
                        const prev = await (window as any).api.getDatabaseSummary?.(Number(year));
                        const prevCount = prev?.success ? prev.counts?.dutyRoster : undefined;
                        const detail = `Vorhandene Einträge für ${year}: ${prevCount ?? 'n/v'}\n`+
                          `Backup wird unter backups/${year}/${year}-ALL/... erstellt.`;
                        const box = await (window as any).api.showMessageBox?.({
                          type: 'warning', buttons: ['Import starten', 'Abbrechen'], defaultId: 0, cancelId: 1,
                          title: 'Dienstplan überschreiben', message: `Achtung: Der Dienstplan für ${year} wird vollständig überschrieben. Fortfahren?`, detail
                        });
                        proceed = !box || typeof box.response !== 'number' ? true : (box.response === 0);
                      } catch {}
                      if (!proceed) return;
                      if (doBackup) {
                        try { await (window as any).api.createDatabaseBackup?.({ year: Number(year) }); } catch {}
                      }
                      try { await (window as any).api.clearDutyRosterYear?.(Number(year)); } catch {}
                      const res = await (window as any).api.importDutyRoster(rosterImportPath, Number(year), undefined, { mappings: nameMappings });
                      if (res?.success) {
                        alert(`Import erfolgreich. Einträge: ${res.importedCount ?? 'n/v'}`);
                        setShowImportPreview(false);
                      } else {
                        alert('Import fehlgeschlagen: ' + (res?.message || 'Unbekannt'));
                      }
                    } catch (e: any) {
                      alert('Fehler beim Import: ' + (e?.message || String(e)));
                    }
                  }}>Jetzt importieren</button>
                </div>
              </>
            ) : (
              <div>Lade Vorschau…</div>
            )}
          </div>
        </div>
      )}
      {showRestore && (
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
          <div style={{ backgroundColor: 'white', borderRadius: 8, width: '90%', maxWidth: 1000, maxHeight: '90vh', overflow: 'auto', padding: 16 }}>
            <h3>Backups wiederherstellen</h3>
            <p style={{ marginTop: 0, color: '#555' }}>Wähle ein Backup aus. Mit den Filtern grenzt du die Anzeige ein. Die Vorschau zeigt die Einträge für das unten gewählte Jahr/Monat. Beim Wiederherstellen wird die App neu gestartet.</p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', margin: '8px 0 12px' }}>
              <label>Filtern: Jahr
                <select value={restoreFilterYear} onChange={e => setRestoreFilterYear(e.target.value)} style={{ marginLeft: 6 }}>
                  <option>Alle</option>
                  {Array.from(new Set((backups||[]).map(b => b.year))).sort().map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </label>
              <label>Monat
                <select value={restoreFilterMonth} onChange={e => setRestoreFilterMonth(e.target.value)} style={{ marginLeft: 6 }}>
                  <option value="Alle">Alle</option>
                  <option value="ALL">ALL</option>
                  {Array.from({ length: 12 }).map((_, i) => {
                    const m = String(i+1).padStart(2, '0');
                    return <option key={m} value={m}>{m}</option>;
                  })}
                </select>
              </label>
              <span style={{ marginLeft: 12, color: '#777' }}>| Vorschau für: </span>
              <label>Jahr
                <input type="number" value={restorePreviewYear} onChange={e => setRestorePreviewYear(Number(e.target.value))} style={{ width: 90, marginLeft: 6 }} />
              </label>
              <label>Monat
                <select value={restorePreviewMonth} onChange={e => setRestorePreviewMonth(e.target.value)} style={{ marginLeft: 6 }}>
                  <option value="Alle">Alle</option>
                  <option value="ALL">ALL</option>
                  {Array.from({ length: 12 }).map((_, i) => {
                    const m = String(i+1).padStart(2, '0');
                    return <option key={m} value={m}>{m}</option>;
                  })}
                </select>
              </label>
            </div>
            <table className={styles.table}>
              <thead>
                <tr className={styles.thead}>
                  <th>Jahr</th>
                  <th>Monat</th>
                  <th>Erstellt (TS)</th>
                  <th>Label</th>
                  <th>Vorschau</th>
                  <th className={styles.center}>Aktion</th>
                </tr>
              </thead>
              <tbody className={styles.tbody}>
                {(backups || [])
                  .filter(b => restoreFilterYear === 'Alle' ? true : b.year === restoreFilterYear)
                  .filter(b => {
                    if (restoreFilterMonth === 'Alle') return true;
                    const mon = (b.ym || '').split('-')[1] || '';
                    return mon === restoreFilterMonth;
                  })
                  .map((b) => {
                  const key = b.path;
                  const counts = previewCounts[key];
                  return (
                    <tr key={key} className={styles.row}>
                      <td>{b.year}</td>
                      <td>{(b.ym || '').split('-')[1] || ''}</td>
                      <td>{b.timestamp}</td>
                      <td>{b.label || '-'}</td>
                      <td>
                        {counts ? (
                          <span>DP: {counts.dutyRoster}, Pers.: {counts.personnel}, Azubis: {counts.azubis}</span>
                        ) : (
                          <button onClick={async () => {
                            try {
                              const y = Number(restorePreviewYear);
                              const mStr = restorePreviewMonth;
                              const mIdx = (mStr && mStr !== 'Alle' && mStr !== 'ALL') ? (Number(mStr) - 1) : undefined;
                              const prev = await (window as any).api.getBackupSummary?.(b.path, isNaN(y) ? undefined : y, mIdx);
                              if (prev?.success) setPreviewCounts(prevState => ({ ...prevState, [key]: prev.counts }));
                            } catch {}
                          }}>Vorschau</button>
                        )}
                      </td>
                      <td className={styles.center}>
                        <button style={{ backgroundColor: '#dc3545', color: 'white' }}
                          onClick={async () => {
                            const ok = window.confirm('Dieses Backup wiederherstellen? Die App wird danach neu gestartet.');
                            if (!ok) return;
                            try {
                              const r = await (window as any).api.restoreBackup?.(b.path);
                              if (!r?.success) alert('Restore fehlgeschlagen: ' + (r?.message || 'Unbekannt'));
                              // Bei Erfolg wird die App neu gestartet
                            } catch (e: any) {
                              alert('Restore Fehler: ' + (e?.message || String(e)));
                            }
                          }}>Wiederherstellen</button>
                      </td>
                    </tr>
                  );
                })}
                {(!backups || backups.length === 0) && (
                  <tr className={styles.row}><td colSpan={6} style={{ color: '#777' }}>Keine Backups gefunden.</td></tr>
                )}
              </tbody>
            </table>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
              <button onClick={() => setShowRestore(false)}>Schließen</button>
            </div>
          </div>
        </div>
      )}
          </div>
    );
};

export default SettingsMenu;