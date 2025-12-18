/// <reference path="../types/cssmodule.d.ts" />
import React, { useState, useEffect } from 'react';
import ImportYearTable from './ImportYearTable';
import SettingsImportExport from './SettingsImportExport';
import ExcelImport from './ExcelImport';
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
  const [holidaysYear, setHolidaysYear] = useState<number>(year);
  // Settings Import/Export UI State
  const [showSettingsImportExport, setShowSettingsImportExport] = useState(false);
  const [showExcelImport, setShowExcelImport] = useState(false);
  const [rosterImportPath, setRosterImportPath] = useState('');
  // Jahresspezifische Vorplanungsdateien
  const [yearPlannings, setYearPlannings] = useState<{ year: number; filePath: string }[]>([]);
  const [editingYearPlannings, setEditingYearPlannings] = useState(false);
  const [originalYearPlannings, setOriginalYearPlannings] = useState<{ year: number; filePath: string }[] | null>(null);
  const [selectedYearPlanningIndex, setSelectedYearPlanningIndex] = useState<number | null>(null);
  const [yearImportSelectedYear, setYearImportSelectedYear] = useState<number>(year); // Jahr für Excel-Import
  const [currentImportPath, setCurrentImportPath] = useState<string | null>(null); // Aktueller Import-Pfad für Retry-Logik
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
  // Diagnostics UI
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [diagnostics, setDiagnostics] = useState<any>(null);
  // DB path config UI
  const [dbConfig, setDbConfig] = useState<{ currentPath: string|null, configuredDir: string|null, defaults?: { appDir: string, userDataDir: string } } | null>(null);
  const [dbDirInput, setDbDirInput] = useState<string>('');
  // Qualification Types Management UI
  const [qualificationTypes, setQualificationTypes] = useState<{ id: number; name: string; description?: string; category?: string; active: boolean; sort: number; excludeFromStats?: boolean }[]>([]);
  const [editingQualificationTypes, setEditingQualificationTypes] = useState(false);
  const [selectedQualificationTypeId, setSelectedQualificationTypeId] = useState<number | null>(null);
  const [originalQualificationTypes, setOriginalQualificationTypes] = useState<any[] | null>(null);
  // HLFB 75%-Regel Qualifikationszuordnung
  const [hlfbQualificationType, setHlfbQualificationType] = useState<string>('FzF HLF B');
  // Ü50 Qualifikationszuordnung (keine Soll/Ist-Berechnung, rot im Kontrollfeld)
  const [ue50QualificationType, setUe50QualificationType] = useState<string>('Ü50');
  // Year Import Dialog States
  const [showYearImportShiftTypeDialog, setShowYearImportShiftTypeDialog] = useState(false);
  const [yearImportUnknownShiftTypes, setYearImportUnknownShiftTypes] = useState<string[]>([]);
  const [yearImportPendingYear, setYearImportPendingYear] = useState<number>(0);
  
  const [showYearImportAzubiDialog, setShowYearImportAzubiDialog] = useState(false);
  const [yearImportUnknownAzubiNames, setYearImportUnknownAzubiNames] = useState<string[]>([]);

    useEffect(() => {
        (async () => {
            const value = await (window as any).api.getSetting('rescueStation');
            if (value) {
              const v = String(value);
              setRescueStation(['1','2','3','4','5'].includes(v) ? v : '1');
            }
            // year bleibt auf aktuellem Jahr (für Feiertage-Anzeige)
            const rosterPath = await (window as any).api.getSetting('rosterImportPath');
            if (rosterPath) setRosterImportPath(rosterPath);
            
            // Lade jahresspezifische Vorplanungen
            try {
              const plannings = await (window as any).api.getYearPlannings?.();
              if (plannings && Array.isArray(plannings)) {
                setYearPlannings(plannings.map((p: any) => ({ year: Number(p.year), filePath: String(p.filePath) })));
              }
            } catch (e) {
              console.error('Failed to load year plannings:', e);
            }
            
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
            
            // Load qualification types
            try {
              const qualTypes = await (window as any).api.getQualificationTypes();
              setQualificationTypes(qualTypes || []);
            } catch (e) {
              console.error('Failed to load qualification types:', e);
            }
            
            // Load HLFB qualification type setting
            try {
              const hlfbQual = await (window as any).api.getSetting('hlfb_qualification_type');
              if (hlfbQual) setHlfbQualificationType(String(hlfbQual));
            } catch (e) {
              console.error('Failed to load HLFB qualification type:', e);
            }
            
            // Load Ü50 qualification type setting
            try {
              const ue50Qual = await (window as any).api.getSetting('ue50_qualification_type');
              if (ue50Qual) setUe50QualificationType(String(ue50Qual));
            } catch (e) {
              console.error('Failed to load Ü50 qualification type:', e);
            }
            
            setShiftTypesLoading(false);
            setLoading(false);
            try {
              const cfg = await (window as any).api.getDbConfig?.();
              if (cfg?.success) {
                setDbConfig({ currentPath: cfg.currentPath || null, configuredDir: cfg.configuredDir || null, defaults: cfg.defaults });
                setDbDirInput((cfg.configuredDir || cfg.defaults?.appDir || ''));
              }
            } catch {}
        })();
    }, []);    // Fahrzeug-UI entfernt

    const handleSave = async () => {
        setSaving(true);
        await (window as any).api.setSetting('rescueStation', rescueStation);
        // year wird nicht mehr als Setting gespeichert - direkt im Dienstplan/Werte gewählt
        await (window as any).api.setSetting('hlfb_qualification_type', hlfbQualificationType);
        await (window as any).api.setSetting('ue50_qualification_type', ue50QualificationType);
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

    // Wenn Vorplanungen geladen/geändert werden und yearImportSelectedYear nicht in der Liste ist,
    // setze es auf das erste verfügbare Jahr oder das aktuelle Jahr
    useEffect(() => {
      if (yearPlannings.length > 0) {
        const hasSelectedYear = yearPlannings.some(yp => yp.year === yearImportSelectedYear);
        if (!hasSelectedYear) {
          // Setze auf das erste Jahr in der Liste (meist das aktuellste)
          setYearImportSelectedYear(yearPlannings[0].year);
        }
      }
    }, [yearPlannings]);

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

  const saveQualificationTypes = async () => {
    try {
      setLoading(true);
      
      // Validierung: Alle Qualifikationen müssen einen Namen haben
      const invalidQualifications = qualificationTypes.filter(qt => !qt.name || qt.name.trim() === '');
      if (invalidQualifications.length > 0) {
        alert('Alle Qualifikationen müssen einen Namen haben. Bitte füllen Sie alle leeren Namen aus.');
        return;
      }
      
      // Lösche entfernte Qualifikationen
      const currentIds = qualificationTypes.map(qt => qt.id);
      const originalIds = originalQualificationTypes?.map(qt => qt.id) || [];
      for (const id of originalIds) {
        if (!currentIds.includes(id)) {
          await (window as any).api.deleteQualificationType(id);
        }
      }
      
      // Speichere/aktualisiere bestehende Qualifikationen
      for (const qt of qualificationTypes) {
        const original = originalQualificationTypes?.find(o => o.id === qt.id);
        if (original) {
          // Update bestehende Qualifikation
          await (window as any).api.updateQualificationType(qt.id, qt);
        } else {
          // Neue Qualifikation hinzufügen
          await (window as any).api.addQualificationType(qt);
        }
      }
      
      console.log('Qualifikationen gespeichert!');
      alert('Qualifikationen gespeichert!');
      setEditingQualificationTypes(false);
      setSelectedQualificationTypeId(null);
      setOriginalQualificationTypes(null);
    } catch (err) {
      console.error('Fehler beim Speichern:', err);
      alert('Fehler beim Speichern: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
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

  // Year Import Shift Type Dialog Handlers
  const handleYearImportShiftTypeConfirm = async (newShiftTypes: Array<{code: string, description: string, color: string, auswertung: string}>) => {
    try {
      setShowYearImportShiftTypeDialog(false);
      
      // Retry import with new shift types
      const retryResult = await (window as any).api.importDutyRoster(currentImportPath || rosterImportPath, yearImportPendingYear, undefined, { newShiftTypes });
      
      if (retryResult && retryResult.success) {
        // Check if there are still unknown azubis
        if (retryResult.unknownAzubis && retryResult.unknownAzubis.length > 0) {
          const createNewAzubis = window.confirm(
            `Folgende unbekannte Azubi-Namen wurden gefunden:\n${retryResult.unknownAzubis.join('\n')}\n\nMöchten Sie diese als neue Azubis anlegen?`
          );
          
          if (createNewAzubis) {
            setShowYearImportAzubiDialog(true);
            setYearImportUnknownAzubiNames(retryResult.unknownAzubis);
            // Keep yearImportPendingYear as it is
          }
          // Reload shift types
          setShiftTypes(await (window as any).api.getShiftTypes());
          return;
        }
        
        alert(`Dienstplan für ${yearImportPendingYear} erfolgreich importiert. Einträge: ${retryResult.importedCount ?? 'n/v'}`);
        setCurrentImportPath(null); // Reset nach erfolgreichem Import
        try { (window as any).api.onDutyRosterUpdated?.(() => {}); } catch {}
      } else {
        alert(`Import fehlgeschlagen: ${retryResult?.message || 'Unbekannter Fehler'}`);
      }
      
      // Reload shift types
      setShiftTypes(await (window as any).api.getShiftTypes());
      setYearImportUnknownShiftTypes([]);
      setYearImportPendingYear(0);
      setCurrentImportPath(null); // Reset bei Abbruch/Fehler
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ein unbekannter Fehler ist aufgetreten.';
      alert(`Fehler beim Import: ${message}`);
    }
  };

  const handleYearImportShiftTypeCancel = () => {
    setShowYearImportShiftTypeDialog(false);
    setYearImportUnknownShiftTypes([]);
    setYearImportPendingYear(0);
    setCurrentImportPath(null); // Reset bei Abbruch
  };

  const handleYearImportAzubiConfirm = async (newAzubis: Array<{name: string, vorname: string, lehrjahr: number}>) => {
    setShowYearImportAzubiDialog(false);
    
    const retryResult = await (window as any).api.importDutyRoster(currentImportPath || rosterImportPath, yearImportPendingYear, undefined, { newAzubis });
    
    if (retryResult && retryResult.success) {
      // Check if there are still unknown shift types
      if (retryResult.unknownShiftTypes && retryResult.unknownShiftTypes.length > 0) {
        const createNewShiftTypes = window.confirm(
          `Folgende unbekannte Dienstarten wurden gefunden:\n${retryResult.unknownShiftTypes.join('\n')}\n\nMöchten Sie diese als neue Dienstarten anlegen?`
        );
        
        if (createNewShiftTypes) {
          setShowYearImportShiftTypeDialog(true);
          setYearImportUnknownShiftTypes(retryResult.unknownShiftTypes);
        }
        return;
      }
      
      alert(`Dienstplan für ${yearImportPendingYear} erfolgreich importiert. Einträge: ${retryResult.importedCount ?? 'n/v'}`);
      setCurrentImportPath(null); // Reset nach erfolgreichem Import
      try { (window as any).api.onDutyRosterUpdated?.(() => {}); } catch {}
    } else {
      alert(`Import fehlgeschlagen: ${retryResult?.message || 'Unbekannter Fehler'}`);
    }
    
    setYearImportUnknownAzubiNames([]);
    setYearImportPendingYear(0);
    setCurrentImportPath(null); // Reset bei Abbruch/Fehler
  };

  const handleYearImportAzubiCancel = () => {
    setShowYearImportAzubiDialog(false);
    setYearImportUnknownAzubiNames([]);
    setYearImportPendingYear(0);
    setCurrentImportPath(null); // Reset bei Abbruch
  };

  const handleExcelImportComplete = (result: any) => {
    console.log('Excel-Import abgeschlossen:', result);
    if (result.success) {
      alert(`Import erfolgreich! ${result.imported} Personen importiert, ${result.skipped} übersprungen.`);
    }
    setShowExcelImport(false);
  };

  // State für Kategorie-Tabs
  const [activeCategory, setActiveCategory] = useState<'general' | 'roster' | 'qualifications'>('general');

    if (loading) return <div className="settings-menu"><p>Lade Einstellungen ...</p></div>;

  return (
        <div className="settings-menu">
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <h2 style={{ margin: 0 }}>Einstellungen</h2>
              <div style={{ fontSize: 12, color: '#666' }}>
                Version {BUILD_INFO.version} (Build {BUILD_INFO.build}) — © Benjamin Kreitz
              </div>
            </div>

            {/* Kategorie-Tabs */}
            <div style={{ 
              display: 'flex', 
              gap: 4, 
              marginTop: 16, 
              borderBottom: '2px solid #dee2e6',
              marginBottom: 16
            }}>
              <button
                onClick={() => setActiveCategory('general')}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderBottom: activeCategory === 'general' ? '3px solid #0d6efd' : '3px solid transparent',
                  background: activeCategory === 'general' ? '#f8f9fa' : 'transparent',
                  fontWeight: activeCategory === 'general' ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Allgemein
              </button>
              <button
                onClick={() => setActiveCategory('roster')}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderBottom: activeCategory === 'roster' ? '3px solid #0d6efd' : '3px solid transparent',
                  background: activeCategory === 'roster' ? '#f8f9fa' : 'transparent',
                  fontWeight: activeCategory === 'roster' ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Dienstplan
              </button>
              <button
                onClick={() => setActiveCategory('qualifications')}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderBottom: activeCategory === 'qualifications' ? '3px solid #0d6efd' : '3px solid transparent',
                  background: activeCategory === 'qualifications' ? '#f8f9fa' : 'transparent',
                  fontWeight: activeCategory === 'qualifications' ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Qualifikationen
              </button>
            </div>

            {/* KATEGORIE: ALLGEMEIN */}
            {activeCategory === 'general' && (
              <div>
            <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
              <button onClick={async () => {
                try {
                  const diag = await (window as any).api.getDiagnostics?.();
                  setDiagnostics(diag || {});
                  setShowDiagnostics(true);
                } catch (err: any) {
                  alert('Diagnose abrufen fehlgeschlagen: ' + (err?.message || String(err)));
                }
              }}>Diagnose anzeigen…</button>
              {diagnostics?.db?.chosenDbPath ? (
                <button onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(String(diagnostics.db.chosenDbPath));
                    alert('DB-Speicherort kopiert.');
                  } catch {
                    alert('Kopieren nicht möglich.');
                  }
                }}>DB-Speicherort kopieren</button>
              ) : null}
            </div>

            {/* DB-Speicherort Konfiguration */}
            <div style={{ marginTop: 16, borderTop: '1px solid #eee', paddingTop: 12 }}>
              <h3>Datenbank-Speicherort</h3>
              <div style={{ color: '#666', marginBottom: 8 }}>
                Aktuell: <code>{dbConfig?.currentPath || 'unbekannt'}</code>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <input type="text" value={dbDirInput} onChange={e => setDbDirInput(e.target.value)} placeholder={dbConfig?.defaults?.appDir || ''} style={{ flex: 1, minWidth: 320 }} />
                <button onClick={async () => {
                  const result = await (window as any).api.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] });
                  if (!result?.canceled && Array.isArray(result?.filePaths) && result.filePaths.length > 0) {
                    setDbDirInput(result.filePaths[0]);
                  }
                }}>Ordner wählen…</button>
                <button onClick={async () => {
                  if (!dbDirInput) { alert('Bitte einen Zielordner angeben.'); return; }
                  const ok = window.confirm('Datenbank an neuen Speicherort übernehmen und Anwendung neu starten?');
                  if (!ok) return;
                  const res = await (window as any).api.setDbDir?.(dbDirInput);
                  if (!res?.success) alert('Fehler: ' + (res?.message || 'Unbekannt'));
                }} style={{ backgroundColor: '#0d6efd', color: 'white' }}>Übernehmen und neu starten</button>
              </div>
              <div style={{ marginTop: 6, color: '#777' }}>
                Standard: <code>{dbConfig?.defaults?.appDir || '-'}</code> · Alternative: <code>{dbConfig?.defaults?.userDataDir || '-'}</code>
              </div>
            </div>

            {/* Einstellungen importieren/exportieren */}
            <div style={{ marginTop: 24, borderTop: '1px solid #eee', paddingTop: 12 }}>
              <h3>Einstellungen importieren/exportieren</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setShowSettingsImportExport(true)}>
                  Einstellungen verwalten…
                </button>
              </div>
            </div>

            {/* Backups */}
            <div style={{ marginTop: 24, borderTop: '1px solid #eee', paddingTop: 12 }}>
              <h3>Backups</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={async () => {
                  try {
                    const res = await (window as any).api.listBackups?.(100);
                    if (res?.success) setBackups(res.list || []);
                    else setBackups([]);
                  } catch {
                    setBackups([]);
                  } finally {
                    setShowRestore(true);
                  }
                }}>
                  {showRestore ? 'Backups ausblenden' : 'Backups anzeigen…'}
                </button>
              </div>
              {showRestore && (
                <div style={{ marginTop: 16 }}>
                  {backups.length === 0 ? (
                    <p style={{ color: '#6b7280', fontSize: '14px' }}>Keine Backups gefunden.</p>
                  ) : (
                    <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                        <thead>
                          <tr style={{ borderBottom: '2px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                            <th style={{ padding: '8px', textAlign: 'left' }}>Zeitpunkt</th>
                            <th style={{ padding: '8px', textAlign: 'left' }}>Jahr</th>
                            <th style={{ padding: '8px', textAlign: 'left' }}>Monat</th>
                            <th style={{ padding: '8px', textAlign: 'left' }}>Pfad</th>
                            <th style={{ padding: '8px', textAlign: 'right' }}>Aktionen</th>
                          </tr>
                        </thead>
                        <tbody>
                          {backups.map((backup, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                              <td style={{ padding: '8px' }}>{backup.timestamp}</td>
                              <td style={{ padding: '8px' }}>{backup.year}</td>
                              <td style={{ padding: '8px' }}>{backup.ym === 'ALL' ? 'Alle' : backup.ym}</td>
                              <td style={{ padding: '8px', fontSize: '12px', color: '#6b7280' }}>{backup.path}</td>
                              <td style={{ padding: '8px', textAlign: 'right' }}>
                                <button
                                  onClick={async () => {
                                    if (confirm(`Backup vom ${backup.timestamp} wiederherstellen?\n\nAchtung: Die aktuellen Daten werden überschrieben!`)) {
                                      try {
                                        const res = await (window as any).api.restoreBackup?.(backup.path);
                                        if (res?.success) {
                                          alert(`Backup erfolgreich wiederhergestellt!\n\nPersonal: ${res.counts?.personnel || 0}\nAzubis: ${res.counts?.azubis || 0}\nDienstplan: ${res.counts?.dutyRoster || 0}`);
                                          // Reload backups
                                          const listRes = await (window as any).api.listBackups?.(100);
                                          if (listRes?.success) setBackups(listRes.list || []);
                                        } else {
                                          alert('Fehler beim Wiederherstellen: ' + (res?.error || 'Unbekannter Fehler'));
                                        }
                                      } catch (err: any) {
                                        alert('Fehler: ' + err.message);
                                      }
                                    }
                                  }}
                                  style={{
                                    padding: '4px 12px',
                                    fontSize: '13px',
                                    backgroundColor: '#0ea5e9',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                  }}
                                >
                                  Wiederherstellen
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Excel Import Personal */}
            <div style={{ marginTop: 24, borderTop: '1px solid #eee', paddingTop: 12 }}>
              <h3>Excel Import Personal</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setShowExcelImport(true)} style={{ backgroundColor: '#28a745', color: 'white' }}>
                  Personal aus Excel importieren…
                </button>
              </div>
            </div>
          </div>
        )}

        {/* KATEGORIE: DIENSTPLAN */}
        {activeCategory === 'roster' && (
          <div>
            {/* Rettungswache und Abteilung */}
            <div style={{ marginBottom: 24 }}>
              <h3>Rettungswache und Abteilung</h3>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
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
            </div>

            {/* Jahresspezifische Vorplanungsdateien */}
            <div style={{ marginBottom: 24 }}>
                <h3>Jahresspezifische Vorplanungsdateien</h3>
                <p style={{ fontSize: 14, color: '#666', marginBottom: 12 }}>
                  Hinterlegen Sie für jedes Jahr eine Excel-Datei mit der Vorausplanung.
                </p>
                
                {!editingYearPlannings && (
                  <div>
                    {yearPlannings.length === 0 && (
                      <p style={{ fontStyle: 'italic', color: '#999' }}>Keine Vorplanungen hinterlegt.</p>
                    )}
                    {yearPlannings.length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        {yearPlannings.map((yp, idx) => (
                          <div key={idx} style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                            padding: '8px 12px',
                            marginBottom: 4,
                            background: '#f8f9fa',
                            borderRadius: 4,
                            border: '1px solid #dee2e6'
                          }}>
                            <div style={{ flex: 1 }}>
                              <strong>Jahr {yp.year}:</strong> <span style={{ fontSize: 13, color: '#555' }}>{yp.filePath}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <button 
                      onClick={() => {
                        setEditingYearPlannings(true);
                        setOriginalYearPlannings(JSON.parse(JSON.stringify(yearPlannings)));
                        setSelectedYearPlanningIndex(null);
                      }}
                      style={{ padding: '6px 12px' }}
                    >
                      Bearbeiten / Jahr hinzufügen
                    </button>
                  </div>
                )}
                
                {editingYearPlannings && (
                  <div style={{ border: '1px solid #ddd', padding: 12, borderRadius: 4, background: '#f9f9f9' }}>
                    <h4 style={{ marginTop: 0 }}>Vorplanungen bearbeiten</h4>
                    
                    <div style={{ marginBottom: 12 }}>
                      {yearPlannings.map((yp, idx) => (
                        <div key={idx} style={{ 
                          display: 'flex', 
                          gap: 8, 
                          alignItems: 'center', 
                          marginBottom: 8,
                          padding: 8,
                          background: selectedYearPlanningIndex === idx ? '#e3f2fd' : 'white',
                          borderRadius: 4,
                          border: '1px solid #ccc',
                          cursor: 'pointer'
                        }}
                        onClick={() => setSelectedYearPlanningIndex(idx)}
                        >
                          <input
                            type="number"
                            value={yp.year}
                            onChange={e => {
                              const updated = [...yearPlannings];
                              updated[idx].year = Number(e.target.value) || new Date().getFullYear();
                              setYearPlannings(updated);
                            }}
                            onClick={e => e.stopPropagation()}
                            style={{ width: 80 }}
                          />
                          <input
                            type="text"
                            value={yp.filePath}
                            readOnly
                            placeholder="Pfad zur Excel-Datei"
                            style={{ flex: 1 }}
                            onClick={e => e.stopPropagation()}
                          />
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              const result = await (window as any).api.showOpenDialog({
                                properties: ['openFile'],
                                filters: [{ name: 'Excel-Dateien', extensions: ['xlsx', 'xls', 'xlsm'] }]
                              });
                              if (!result.canceled && result.filePaths.length > 0) {
                                const updated = [...yearPlannings];
                                updated[idx].filePath = result.filePaths[0];
                                setYearPlannings(updated);
                              }
                            }}
                            style={{ padding: '4px 8px', fontSize: 12 }}
                          >
                            Datei wählen
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm(`Jahr ${yp.year} wirklich löschen?`)) {
                                setYearPlannings(yearPlannings.filter((_, i) => i !== idx));
                                if (selectedYearPlanningIndex === idx) setSelectedYearPlanningIndex(null);
                              }
                            }}
                            style={{ padding: '4px 8px', fontSize: 12, background: '#dc3545', color: 'white', border: 'none', borderRadius: 4 }}
                          >
                            Löschen
                          </button>
                        </div>
                      ))}
                    </div>
                    
                    <button
                      onClick={() => {
                        // Finde das nächste freie Jahr
                        const currentYear = new Date().getFullYear();
                        const existingYears = yearPlannings.map(yp => yp.year).sort((a, b) => b - a);
                        
                        let newYear = currentYear;
                        
                        // Wenn es bereits Jahre gibt, nimm das höchste Jahr + 1
                        if (existingYears.length > 0) {
                          const maxYear = Math.max(...existingYears);
                          // Wenn das aktuelle Jahr oder höher schon existiert, nimm das Maximum + 1
                          if (maxYear >= currentYear) {
                            newYear = maxYear + 1;
                          }
                        }
                        
                        // Sicherheitsprüfung: Falls das Jahr trotzdem existiert, suche das nächste freie
                        while (yearPlannings.some(yp => yp.year === newYear)) {
                          newYear++;
                        }
                        
                        setYearPlannings([...yearPlannings, { year: newYear, filePath: '' }]);
                      }}
                      style={{ padding: '6px 12px', marginRight: 8 }}
                    >
                      + Jahr hinzufügen
                    </button>
                    
                    <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #ddd', display: 'flex', gap: 8 }}>
                      <button
                        onClick={async () => {
                          // Speichern in Datenbank
                          try {
                            await (window as any).api.saveYearPlannings?.(yearPlannings);
                            setEditingYearPlannings(false);
                            setOriginalYearPlannings(null);
                            setSelectedYearPlanningIndex(null);
                            alert('Vorplanungen gespeichert!');
                          } catch (e) {
                            alert(`Fehler beim Speichern: ${e instanceof Error ? e.message : String(e)}`);
                          }
                        }}
                        style={{ padding: '6px 12px', background: '#28a745', color: 'white', border: 'none', borderRadius: 4 }}
                      >
                        Speichern
                      </button>
                      <button
                        onClick={() => {
                          if (originalYearPlannings) {
                            setYearPlannings(originalYearPlannings);
                          }
                          setEditingYearPlannings(false);
                          setOriginalYearPlannings(null);
                          setSelectedYearPlanningIndex(null);
                        }}
                        style={{ padding: '6px 12px' }}
                      >
                        Abbrechen
                      </button>
                    </div>
                  </div>
                )}
            </div>

            {/* Import Dienstplan (Excel) - Monatsimport aus Settings entfernt */}
            <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                Jahr für Import:
                <select
                  value={yearImportSelectedYear}
                  onChange={e => setYearImportSelectedYear(Number(e.target.value))}
                  style={{ marginLeft: 6, padding: '4px 8px' }}
                >
                  {yearPlannings.map(yp => (
                    <option key={yp.year} value={yp.year}>{yp.year}</option>
                  ))}
                  {/* Fallback falls keine Jahr-Planungen definiert */}
                  {yearPlannings.length === 0 && <option value={year}>{year}</option>}
                </select>
              </label>
            </div>
            <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="checkbox" checked={doBackup} onChange={e => setDoBackup(e.target.checked)} />
                Backup vor Import erstellen
              </label>
            </div>
            <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                onClick={async () => {
                  try {
                    // Versuche jahresspezifische Vorplanungsdatei zu laden
                    let importPath = null;
                    try {
                      console.log('[Import] Lade Vorplanung für Jahr:', yearImportSelectedYear);
                      const yearPlanning = await (window as any).api.getYearPlanningForYear?.(yearImportSelectedYear);
                      console.log('[Import] Geladene Vorplanung:', yearPlanning);
                      if (yearPlanning?.filePath) {
                        importPath = yearPlanning.filePath;
                        console.log('[Import] Verwende jahresspezifische Datei:', importPath);
                      }
                    } catch (e) {
                      console.warn('Fehler beim Laden der jahresspezifischen Vorplanung:', e);
                    }
                    
                    // Fallback: alte rosterImportPath Einstellung
                    if (!importPath) {
                      importPath = rosterImportPath;
                      console.log('[Import] Fallback auf rosterImportPath:', importPath);
                    }
                    
                    if (!importPath) {
                      alert('Bitte zuerst eine Vorplanungsdatei für das Jahr ' + yearImportSelectedYear + ' hinterlegen.');
                      return;
                    }
                    
                    // Speichere Import-Pfad für Retry-Logik
                    setCurrentImportPath(importPath);
                    
                    // Warnung anzeigen: Überschreiben bestätigen
                    let proceed = true;
                    try {
                      const prev = await (window as any).api.getDatabaseSummary?.(yearImportSelectedYear);
                      const prevCount = prev?.success ? prev.counts?.dutyRoster : undefined;
                      const detail = `Vorhandene Einträge für ${yearImportSelectedYear}: ${prevCount ?? 'n/v'}\n`+
                        `Backup wird unter backups/${yearImportSelectedYear}/${yearImportSelectedYear}-ALL/... erstellt.`;
                      const box = await (window as any).api.showMessageBox?.({
                        type: 'warning',
                        buttons: ['Import starten', 'Abbrechen'],
                        defaultId: 0,
                        cancelId: 1,
                        title: 'Dienstplan überschreiben',
                        message: `Achtung: Der Dienstplan für ${yearImportSelectedYear} wird vollständig überschrieben. Fortfahren?`,
                        detail
                      });
                      proceed = !box || typeof box.response !== 'number' ? true : (box.response === 0);
                    } catch {}
                    if (!proceed) return;
                    
                    // Optionales Backup
                    if (doBackup) {
                      try {
                        const r = await (window as any).api.createDatabaseBackup?.({ year: yearImportSelectedYear });
                        if (!r?.success) console.warn('[SettingsMenu] Backup fehlgeschlagen:', r?.message);
                        else console.log('[SettingsMenu] Backup erstellt unter:', r.dir);
                      } catch (e) {
                        console.warn('[SettingsMenu] Backup Fehler', e);
                      }
                    }

                    // Browser-Confirm Fallback ist bereits im obigen try/catch abgedeckt

                    // Altdaten für das Jahr NICHT löschen, damit Einteilungen erhalten bleiben
                    // Die Import-Funktion kümmert sich um das Überschreiben der Dienste
                    /*
                    try {
                      await (window as any).api.clearDutyRosterYear?.(yearImportSelectedYear);
                    } catch (e) {
                      console.warn('[SettingsMenu] clearDutyRosterYear Fehler', e);
                    }
                    */

                    const res = await (window as any).api.importDutyRoster(importPath, yearImportSelectedYear);
                    if (res && res.success) {
                      // Check if unknown shift types were found
                      if (res.unknownShiftTypes && res.unknownShiftTypes.length > 0) {
                        const createNewShiftTypes = window.confirm(
                          `Folgende unbekannte Dienstarten wurden gefunden:\n${res.unknownShiftTypes.join('\n')}\n\nMöchten Sie diese als neue Dienstarten anlegen?`
                        );
                        
                        if (createNewShiftTypes) {
                          // Show new shift type dialog
                          setShowYearImportShiftTypeDialog(true);
                          setYearImportUnknownShiftTypes(res.unknownShiftTypes);
                          setYearImportPendingYear(yearImportSelectedYear);
                        }
                        return;
                      }
                      
                      // Check if unknown azubis were found  
                      if (res.unknownAzubis && res.unknownAzubis.length > 0) {
                        const createNewAzubis = window.confirm(
                          `Folgende unbekannte Azubi-Namen wurden gefunden:\n${res.unknownAzubis.join('\n')}\n\nMöchten Sie diese als neue Azubis anlegen?`
                        );
                        
                        if (createNewAzubis) {
                          setShowYearImportAzubiDialog(true);
                          setYearImportUnknownAzubiNames(res.unknownAzubis);
                          setYearImportPendingYear(yearImportSelectedYear);
                        }
                        return;
                      }
                      
                      alert(`Dienstplan für ${yearImportSelectedYear} erfolgreich importiert. Einträge: ${res.importedCount ?? 'n/v'}`);
                      setCurrentImportPath(null); // Reset nach erfolgreichem Import
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
                onClick={() => setShowSettingsImportExport(true)}
              >Einstellungen importieren/exportieren…</button>
              <button
                onClick={async () => {
                  try {
                    // Versuche jahresspezifische Vorplanungsdatei zu laden
                    let importPath = null;
                    try {
                      console.log('[Vorschau] Lade Vorplanung für Jahr:', yearImportSelectedYear);
                      const yearPlanning = await (window as any).api.getYearPlanningForYear?.(yearImportSelectedYear);
                      console.log('[Vorschau] Geladene Vorplanung:', yearPlanning);
                      if (yearPlanning?.filePath) {
                        importPath = yearPlanning.filePath;
                        console.log('[Vorschau] Verwende jahresspezifische Datei:', importPath);
                      }
                    } catch (e) {
                      console.warn('Fehler beim Laden der jahresspezifischen Vorplanung:', e);
                    }
                    
                    // Fallback: alte rosterImportPath Einstellung
                    if (!importPath) {
                      importPath = rosterImportPath;
                      console.log('[Vorschau] Fallback auf rosterImportPath:', importPath);
                    }
                    
                    if (!importPath) {
                      alert('Bitte zuerst eine Vorplanungsdatei für das Jahr ' + yearImportSelectedYear + ' hinterlegen.');
                      return;
                    }
                    
                    // Speichere Import-Pfad für Retry-Logik
                    setCurrentImportPath(importPath);
                    
                    // Lade Vorschau
                    const prev = await (window as any).api.previewDutyRoster?.(importPath, yearImportSelectedYear);
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
              <button
                onClick={() => setShowExcelImport(true)}
                style={{ backgroundColor: '#28a745', color: 'white' }}
              >Excel Import/Export Personal</button>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Feiertage</h3>
          <select 
            value={holidaysYear} 
            onChange={async (e) => {
              const newYear = Number(e.target.value);
              setHolidaysYear(newYear);
              try {
                const fresh = await (window as any).api.getHolidaysForYear?.(newYear);
                setHolidays((fresh || []).map((h: any) => ({ date: String(h.date), name: String(h.name || '') })));
              } catch {}
              setEditingHolidays(false);
              setOriginalHolidays(null);
              setSelectedHolidayIndex(null);
            }}
            style={{ padding: '4px 8px', fontSize: '1em', fontWeight: 600 }}
          >
            {yearPlannings.map(yp => (
              <option key={yp.year} value={yp.year}>{yp.year}</option>
            ))}
          </select>
        </div>
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
            <button onClick={() => { setEditingHolidays(true); setOriginalHolidays(JSON.parse(JSON.stringify(holidays))); setHolidays(prev => [...prev, { date: `${holidaysYear}-01-01`, name: '' }]); setSelectedHolidayIndex((holidays?.length ?? 0)); }}>Hinzufügen</button>
            <button onClick={() => setEditingHolidays(true)} disabled={holidays.length === 0}>Ändern</button>
            <button onClick={() => { if (selectedHolidayIndex != null) setHolidays(prev => prev.filter((_, i) => i !== selectedHolidayIndex)); setSelectedHolidayIndex(null); }} disabled={selectedHolidayIndex == null}>Löschen</button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={async () => { try { await (window as any).api.setHolidaysForYear?.(holidaysYear, holidays.map(h => ({ date: h.date, name: h.name }))); const fresh = await (window as any).api.getHolidaysForYear?.(holidaysYear); setHolidays((fresh || []).map((h: any) => ({ date: String(h.date), name: String(h.name || '') }))); } catch {} finally { setEditingHolidays(false); setOriginalHolidays(null); setSelectedHolidayIndex(null); } }}>Speichern</button>
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
          </div>
        )}

        {/* KATEGORIE: QUALIFIKATIONEN */}
        {activeCategory === 'qualifications' && (
          <div>
            {/* HLFB 75%-Regel Zuordnung */}
            <div style={{ marginBottom: 16, padding: 12, backgroundColor: '#f8f9fa', borderRadius: 6 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <strong style={{ minWidth: 250 }}>Qualifikation für FzF HLF B (75%-Regel):</strong>
                <select 
                  value={hlfbQualificationType} 
                  onChange={e => setHlfbQualificationType(e.target.value)}
                  style={{ flex: 1, maxWidth: 400 }}
                >
                  {qualificationTypes.filter(qt => qt.active).map(qt => (
                    <option key={qt.id} value={qt.name}>{qt.name}</option>
                  ))}
                </select>
              </label>
              <p style={{ margin: '8px 0 0', fontSize: '0.9em', color: '#666' }}>
                Personen mit dieser Qualifikation werden in der Anwesenheitsauswertung mit 75% gewichtet (statt 100%).
              </p>
            </div>

            {/* Ü50 Zuordnung (keine Soll/Ist-Berechnung) */}
            <div style={{ marginBottom: 16, padding: 12, backgroundColor: '#fff3cd', borderRadius: 6, border: '1px solid #ffc107' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <strong style={{ minWidth: 250 }}>Qualifikation für Ü50 (wie Azubi):</strong>
                <select 
                  value={ue50QualificationType} 
                  onChange={e => setUe50QualificationType(e.target.value)}
                  style={{ flex: 1, maxWidth: 400 }}
                >
                  {qualificationTypes.filter(qt => qt.active).map(qt => (
                    <option key={qt.id} value={qt.name}>{qt.name}</option>
                  ))}
                </select>
              </label>
              <p style={{ margin: '8px 0 0', fontSize: '0.9em', color: '#856404' }}>
                Personen mit dieser Qualifikation haben <strong>keine Soll/Ist-Berechnung</strong> (wie Azubis), werden aber <strong style={{color: '#dc3545'}}>rot</strong> im Kontrollfeld angezeigt. Alle anderen Qualifikationen bleiben gültig.
              </p>
            </div>

            {/* Qualifikationsverwaltung */}
            <div style={{ marginTop: 24, paddingTop: 12 }}>
              <h3>Qualifikationsverwaltung</h3>
        
              <table className={styles.table}>
                <thead>
                  <tr className={styles.thead}>
                    <th>Name</th>
                    <th>Beschreibung</th>
                    <th>Kategorie</th>
                    <th style={{ width: 80 }}>Aktiv</th>
                    <th style={{ width: 120 }}>Statistik ausschl.</th>
                    <th className={styles.center} style={{ width: 60 }}>#</th>
                  </tr>
                </thead>
                <tbody className={styles.tbody}>
                  {qualificationTypes.map(qt => (
                    <tr key={qt.id} className={[styles.row, selectedQualificationTypeId === qt.id ? styles.selected : ''].filter(Boolean).join(' ')} onClick={() => setSelectedQualificationTypeId(prev => prev === qt.id ? null : qt.id)}>
                      <td>
                        {editingQualificationTypes ? (
                          <input 
                            value={qt.name}
                            onChange={e => setQualificationTypes(prev => prev.map(x => x.id === qt.id ? { ...x, name: e.target.value } : x))}
                            style={{ 
                              borderColor: (!qt.name || qt.name.trim() === '') ? '#ff4444' : '#ddd',
                              backgroundColor: (!qt.name || qt.name.trim() === '') ? '#fff5f5' : 'white'
                            }}
                            placeholder="Name erforderlich"
                          />
                        ) : qt.name}
                      </td>
                      <td>
                        {editingQualificationTypes ? (
                          <input value={qt.description || ''}
                            onChange={e => setQualificationTypes(prev => prev.map(x => x.id === qt.id ? { ...x, description: e.target.value } : x))} />
                        ) : (qt.description || '')}
                      </td>
                      <td>
                        {editingQualificationTypes ? (
                          <select value={qt.category}
                            onChange={e => setQualificationTypes(prev => prev.map(x => x.id === qt.id ? { ...x, category: e.target.value } : x))}>
                            <option value="Fahrzeugführung">Fahrzeugführung</option>
                            <option value="Notfall">Notfall</option>
                            <option value="Transport">Transport</option>
                            <option value="Ausbildung">Ausbildung</option>
                            <option value="Sonstiges">Sonstiges</option>
                          </select>
                        ) : qt.category}
                      </td>
                      <td className={styles.center}>
                        {editingQualificationTypes ? (
                          <input type="checkbox" checked={qt.active}
                            onChange={e => setQualificationTypes(prev => prev.map(x => x.id === qt.id ? { ...x, active: e.target.checked } : x))} />
                        ) : (qt.active ? '✓' : '✗')}
                      </td>
                      <td className={styles.center} title="Von Soll/Ist-Berechnung ausschließen (wie Azubis)">
                        {editingQualificationTypes ? (
                          <input type="checkbox" checked={qt.excludeFromStats || false}
                            onChange={e => setQualificationTypes(prev => prev.map(x => x.id === qt.id ? { ...x, excludeFromStats: e.target.checked } : x))} />
                        ) : (qt.excludeFromStats ? '✓' : '✗')}
                      </td>
                      <td className={styles.center}>
                        <button onClick={() => {
                          if (confirm(`Qualifikation "${qt.name}" löschen?`)) {
                            setQualificationTypes(prev => prev.filter(x => x.id !== qt.id));
                          }
                        }}
                        disabled={!editingQualificationTypes}
                        style={{ color: '#cc0000', background: 'none', border: 'none', cursor: editingQualificationTypes ? 'pointer' : 'default' }}>
                          ✗
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button onClick={() => {
                  if (editingQualificationTypes) {
                    // Speichern
                    saveQualificationTypes();
                  } else {
                    // Bearbeiten starten
                    setEditingQualificationTypes(true);
                    setOriginalQualificationTypes([...qualificationTypes]);
                  }
                }}>
                  {editingQualificationTypes ? 'Speichern' : 'Bearbeiten'}
                </button>
                
                {editingQualificationTypes && (
                  <>
                    <button onClick={() => {
                      // Abbrechen
                      setQualificationTypes(originalQualificationTypes ? [...originalQualificationTypes] : []);
                      setEditingQualificationTypes(false);
                      setSelectedQualificationTypeId(null);
                      setOriginalQualificationTypes(null);
                    }}>
                      Abbrechen
                    </button>
                    
                    <button onClick={() => {
                      // Neue Qualifikation hinzufügen
                      const newId = Math.max(0, ...qualificationTypes.map(qt => qt.id)) + 1;
                      const newSort = Math.max(0, ...qualificationTypes.map(qt => qt.sort)) + 1;
                      setQualificationTypes(prev => [...prev, {
                        id: newId,
                        name: 'Neue Qualifikation',
                        description: '',
                        category: 'Sonstiges',
                        active: true,
                        sort: newSort
                      }]);
                      setSelectedQualificationTypeId(newId);
                    }}>
                      Neue Qualifikation
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
            
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
                                <select value={current ?? ''} onChange={e => setNameMappings(prev => {
                                  const next = { ...prev } as Record<string, number>;
                                  const raw = e.target.value;
                                  const num = Number(raw);
                                  if (!raw) {
                                    // Entfernen, wenn (Überspringen)
                                    delete (next as any)[ln];
                                  } else if (!Number.isNaN(num)) {
                                    next[ln] = num;
                                  }
                                  return next;
                                })}>
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
                  <button onClick={() => {
                    setShowImportPreview(false);
                    setCurrentImportPath(null); // Reset bei Abbruch
                  }}>Schließen</button>
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
                      const res = await (window as any).api.importDutyRoster(currentImportPath || rosterImportPath, Number(year), undefined, { mappings: nameMappings });
                      if (res?.success) {
                        alert(`Import erfolgreich. Einträge: ${res.importedCount ?? 'n/v'}`);
                        setShowImportPreview(false);
                        setCurrentImportPath(null); // Reset nach erfolgreichem Import
                      } else {
                        alert('Import fehlgeschlagen: ' + (res?.message || 'Unbekannt'));
                      }
                    } catch (e: any) {
                      alert('Fehler beim Import: ' + (e?.message || String(e)));
                    } finally {
                      setCurrentImportPath(null); // Reset auch bei Fehler
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
      {showDiagnostics && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: 8, width: '92%', maxWidth: 900, maxHeight: '90vh', overflow: 'auto', padding: 16 }}>
            <h3>Diagnose</h3>
            <p style={{ marginTop: 0, color: '#555' }}>Datenbankpfad-Entscheidung und verfügbare Header-Assets</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <h4 style={{ margin: '8px 0' }}>DB</h4>
                <pre style={{ background: '#f8f9fa', padding: 12, borderRadius: 6, overflow: 'auto' }}>{JSON.stringify(diagnostics?.db || diagnostics, null, 2)}</pre>
              </div>
              <div>
                <h4 style={{ margin: '8px 0' }}>Assets</h4>
                <pre style={{ background: '#f8f9fa', padding: 12, borderRadius: 6, overflow: 'auto' }}>{JSON.stringify({ paths: diagnostics?.paths, assets: diagnostics?.assets }, null, 2)}</pre>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <button onClick={() => setShowDiagnostics(false)}>Schließen</button>
            </div>
          </div>
        </div>
      )}
      {showExcelImport && (
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
            <ExcelImport 
              onImportComplete={handleExcelImportComplete}
              onClose={() => setShowExcelImport(false)}
            />
          </div>
        </div>
      )}

      {/* Year Import Shift Type Dialog */}
      {showYearImportShiftTypeDialog && (
        <NewShiftTypeDialog
          unknownShiftTypes={yearImportUnknownShiftTypes}
          onConfirm={handleYearImportShiftTypeConfirm}
          onCancel={handleYearImportShiftTypeCancel}
        />
      )}

      {/* Year Import Azubi Dialog */}
      {showYearImportAzubiDialog && (
        <NewAzubiDialog
          unknownNames={yearImportUnknownAzubiNames}
          onConfirm={handleYearImportAzubiConfirm}
          onCancel={handleYearImportAzubiCancel}
        />
      )}
          </div>
    );
};

// New ShiftType Dialog Component (shared with DutyRoster)
interface NewShiftTypeDialogProps {
  unknownShiftTypes: string[];
  onConfirm: (shiftTypes: Array<{code: string, description: string, color: string, auswertung: string}>) => void;
  onCancel: () => void;
}

const NewShiftTypeDialog: React.FC<NewShiftTypeDialogProps> = ({ unknownShiftTypes, onConfirm, onCancel }) => {
  const [shiftTypeData, setShiftTypeData] = useState<Array<{code: string, description: string, color: string, auswertung: string}>>(() => {
    return unknownShiftTypes.map(code => ({
      code: code,
      description: code, // Default description is the code itself
      color: '#cccccc', // Default gray color
      auswertung: 'off' // Default: no counting
    }));
  });

  const handleDescriptionChange = (index: number, value: string) => {
    const newData = [...shiftTypeData];
    newData[index].description = value;
    setShiftTypeData(newData);
  };

  const handleColorChange = (index: number, value: string) => {
    const newData = [...shiftTypeData];
    newData[index].color = value;
    setShiftTypeData(newData);
  };

  const handleAuswertungChange = (index: number, value: string) => {
    const newData = [...shiftTypeData];
    newData[index].auswertung = value;
    setShiftTypeData(newData);
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        background: 'white', padding: '20px', borderRadius: '8px', minWidth: '600px', maxWidth: '800px', maxHeight: '80vh', overflow: 'auto'
      }}>
        <h3>Neue Dienstarten anlegen</h3>
        <p>Folgende unbekannte Dienstarten wurden gefunden:</p>
        
        {shiftTypeData.map((shiftType, index) => (
          <div key={index} style={{ marginBottom: '20px', border: '1px solid #ddd', padding: '15px', borderRadius: '4px' }}>
            <div><strong>Code:</strong> {shiftType.code}</div>
            
            <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'center' }}>
              <div>
                <label>Bezeichnung: </label>
                <input 
                  type="text" 
                  value={shiftType.description} 
                  onChange={(e) => handleDescriptionChange(index, e.target.value)}
                  style={{ width: '150px', padding: '4px' }}
                  placeholder="z.B. Tagdienst"
                />
              </div>
              
              <div>
                <label>Farbe: </label>
                <input 
                  type="color" 
                  value={shiftType.color} 
                  onChange={(e) => handleColorChange(index, e.target.value)}
                  style={{ width: '50px', height: '30px', padding: '2px' }}
                />
              </div>
              
              <div>
                <label>Auswertung: </label>
                <select 
                  value={shiftType.auswertung} 
                  onChange={(e) => handleAuswertungChange(index, e.target.value)}
                  style={{ padding: '4px' }}
                >
                  <option value="off">Nicht zählen</option>
                  <option value="tag">Tagdienst</option>
                  <option value="nacht">Nachtdienst</option>
                  <option value="24h">24h-Dienst</option>
                  <option value="itw">ITW-Dienst</option>
                </select>
              </div>
            </div>
          </div>
        ))}
        
        <div style={{ marginTop: '20px', textAlign: 'right' }}>
          <button 
            onClick={onCancel}
            style={{ marginRight: '10px', padding: '8px 16px' }}
          >
            Abbrechen
          </button>
          <button 
            onClick={() => onConfirm(shiftTypeData)}
            style={{ padding: '8px 16px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px' }}
          >
            Dienstarten anlegen und Import fortsetzen
          </button>
        </div>
      </div>
    </div>
  );
};

// New Azubi Dialog Component (shared with DutyRoster)
interface NewAzubiDialogProps {
  unknownNames: string[];
  onConfirm: (azubis: Array<{name: string, vorname: string, lehrjahr: number}>) => void;
  onCancel: () => void;
}

const NewAzubiDialog: React.FC<NewAzubiDialogProps> = ({ unknownNames, onConfirm, onCancel }) => {
  const [azubiData, setAzubiData] = useState<Array<{name: string, vorname: string, lehrjahr: number}>>(() => {
    return unknownNames.map(fullName => {
      const parts = fullName.split(',').map(p => p.trim());
      return {
        name: parts[0] || fullName,
        vorname: parts[1] || '',
        lehrjahr: 1
      };
    });
  });

  const handleLehrjahrChange = (index: number, value: string) => {
    const newData = [...azubiData];
    newData[index].lehrjahr = parseInt(value) || 1;
    setAzubiData(newData);
  };

  const handleVornameChange = (index: number, value: string) => {
    const newData = [...azubiData];
    newData[index].vorname = value;
    setAzubiData(newData);
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        background: 'white', padding: '20px', borderRadius: '8px', minWidth: '400px', maxWidth: '600px', maxHeight: '80vh', overflow: 'auto'
      }}>
        <h3>Neue Azubis anlegen</h3>
        <p>Folgende unbekannte Namen wurden gefunden:</p>
        
        {azubiData.map((azubi, index) => (
          <div key={index} style={{ marginBottom: '15px', border: '1px solid #ddd', padding: '10px', borderRadius: '4px' }}>
            <div><strong>Original:</strong> {unknownNames[index]}</div>
            <div style={{ marginTop: '5px' }}>
              <label>Nachname: </label>
              <input 
                type="text" 
                value={azubi.name} 
                readOnly 
                style={{ marginRight: '10px', padding: '2px' }}
              />
              <label>Vorname: </label>
              <input 
                type="text" 
                value={azubi.vorname} 
                onChange={(e) => handleVornameChange(index, e.target.value)}
                style={{ marginRight: '10px', padding: '2px' }}
              />
              <label>Lehrjahr: </label>
              <select 
                value={azubi.lehrjahr} 
                onChange={(e) => handleLehrjahrChange(index, e.target.value)}
                style={{ padding: '2px' }}
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
                <option value={4}>4</option>
              </select>
            </div>
          </div>
        ))}
        
        <div style={{ marginTop: '20px', textAlign: 'right' }}>
          <button 
            onClick={onCancel}
            style={{ marginRight: '10px', padding: '8px 16px' }}
          >
            Abbrechen
          </button>
          <button 
            onClick={() => onConfirm(azubiData)}
            style={{ padding: '8px 16px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px' }}
          >
            Azubis anlegen und Import fortsetzen
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsMenu;