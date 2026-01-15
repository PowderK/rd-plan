import React, { useEffect, useState, useCallback } from 'react';
import MonthTabs from './MonthTabs';

type RosterState = Record<string, Record<string, { value: string; type: string }>>;

const EinteilungPage: React.FC = () => {
  const [currentMonth, setCurrentMonth] = useState<number>(() => {
    // Restore from window if available
    if ((window as any).rdPlanMonth !== undefined) {
      return (window as any).rdPlanMonth;
    }
    const currentYear = new Date().getFullYear();
    const storedYear = (window as any).rdPlanYear || currentYear;
    return storedYear === currentYear ? new Date().getMonth() : 0;
  });
  const [year, setYear] = useState<number>((window as any).rdPlanYear || new Date().getFullYear());
  const [personnel, setPersonnel] = useState<any[]>([]);
  const [azubis, setAzubis] = useState<any[]>([]);
  const [roster, setRoster] = useState<RosterState>({});
  const [deptPatternSeqs, setDeptPatternSeqs] = useState<{ startDate: string; pattern: string[] }[]>([]);
  
  // Reagiere auf Jahr-Änderungen von DutyRoster
  useEffect(() => {
    const handleYearChange = (e: any) => {
      if (e.detail?.year && e.detail.year !== year) {
        const newYear = e.detail.year;
        setYear(newYear);
        // Springe zum aktuellen Monat wenn aktuelles Jahr, sonst Januar
        const currentYear = new Date().getFullYear();
        if (newYear === currentYear) {
          setCurrentMonth(new Date().getMonth());
        } else {
          setCurrentMonth(0);
        }
      }
    };
    window.addEventListener('rdplan-year-changed', handleYearChange);
    return () => window.removeEventListener('rdplan-year-changed', handleYearChange);
  }, [year]);

  const loadBasics = useCallback(async () => {
    // Jahr wird nicht mehr aus Settings geladen - kommt von DutyRoster
    // Initial auf window.rdPlanYear setzen falls vorhanden
    if ((window as any).rdPlanYear && year !== (window as any).rdPlanYear) {
      setYear((window as any).rdPlanYear);
    }
    try { 
      // Pass current year/month to filter personnel by active periods
      const filterDate = `${year}-${String(currentMonth + 1).padStart(2, '0')}-01`;
      const list = await (window as any).api.getPersonnelList(false, filterDate);
      
      // Aktueller Monat im Format YYYY-MM
      const now = new Date();
      const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      // Lade HLFB Qualifikationstyp aus Settings
      let hlfbQualName = 'FzF HLF B'; // Fallback
      try {
        const setting = await (window as any).api.getSetting('hlfb_qualification_type');
        if (setting) hlfbQualName = String(setting);
      } catch {}
      
      // Lade Ü50 Qualifikationstyp aus Settings
      let ue50QualName = 'Ü50'; // Fallback
      try {
        const setting = await (window as any).api.getSetting('ue50_qualification_type');
        if (setting) ue50QualName = String(setting);
      } catch {}
      
      // Lade RTW und NEF Fahrzeuge um die konfigurierten Qualifikationen zu ermitteln
      const rtwVehicles = await (window as any).api.getRtwVehicles?.() || [];
      const nefVehicles = await (window as any).api.getNefVehicles?.() || [];
      
      // Ermittle Fahrzeugführer-Qualifikationen aus RTW-Positionen (Position 0 = FzF)
      const rtwQualifications = new Set<string>();
      for (const rtw of rtwVehicles.slice(0, 1)) { // Erstes Fahrzeug reicht als Referenz
        try {
          const positions = await (window as any).api.getVehiclePositionsWithQualifications?.('rtw', rtw.id) || [];
          if (positions[0]?.qualificationName) {
            rtwQualifications.add(positions[0].qualificationName);
          }
        } catch {}
      }
      
      // Ermittle NEF-Qualifikationen aus NEF-Positionen
      const nefQualifications = new Set<string>();
      for (const nef of nefVehicles.slice(0, 1)) { // Erstes Fahrzeug reicht als Referenz
        try {
          const positions = await (window as any).api.getVehiclePositionsWithQualifications?.('nef', nef.id) || [];
          if (positions[0]?.qualificationName) {
            nefQualifications.add(positions[0].qualificationName);
          }
        } catch {}
      }
      
      // Fallbacks für alte hard-coded Qualifikationen
      rtwQualifications.add('FzF RTW');
      rtwQualifications.add('Fahrzeugführer');
      nefQualifications.add('NEF');
      nefQualifications.add('NA');
      
      // console.log('[EinteilungPage] Erkannte RTW-Qualifikationen:', Array.from(rtwQualifications));
      // console.log('[EinteilungPage] Erkannte NEF-Qualifikationen:', Array.from(nefQualifications));
      // console.log('[EinteilungPage] HLFB-Qualifikation:', hlfbQualName);
      // console.log('[EinteilungPage] Ü50-Qualifikation:', ue50QualName);
      
      // Für jede Person die Qualifikationen aus qualification_periods laden
      const enrichedList = await Promise.all((list || []).map(async (person: any) => {
        try {
          // Lade Qualifikationsperioden (altes System mit qualType als String)
          const periods = await (window as any).api.getQualificationPeriods?.(person.id) || [];
          
          // Prüfe, ob Person Fahrzeugführer-Qualifikation hat
          const hasFahrzeugfuehrer = periods.some((p: any) => 
            p.active && 
            rtwQualifications.has(p.qualType) &&
            p.startYM <= yearMonth &&
            (!p.endYM || p.endYM >= yearMonth)
          );
          
          // Prüfe, ob Person NEF-Qualifikation hat
          const hasNef = periods.some((p: any) => 
            p.active && 
            nefQualifications.has(p.qualType) &&
            p.startYM <= yearMonth &&
            (!p.endYM || p.endYM >= yearMonth)
          );
          
          // Prüfe, ob Person HLFB-Qualifikation hat (für 75%-Regel) - verwendet konfigurierbare Qualifikation
          const hasHLFB = periods.some((p: any) => 
            p.active && 
            p.qualType === hlfbQualName &&
            p.startYM <= yearMonth &&
            (!p.endYM || p.endYM >= yearMonth)
          );
          
          // Prüfe, ob Person Ü50-Qualifikation hat (keine Soll/Ist-Berechnung, wie Azubi)
          const hasUe50 = periods.some((p: any) => 
            p.active && 
            p.qualType === ue50QualName &&
            p.startYM <= yearMonth &&
            (!p.endYM || p.endYM >= yearMonth)
          );
          
          return {
            ...person,
            fahrzeugfuehrer: hasFahrzeugfuehrer ? 1 : person.fahrzeugfuehrer,
            nef: hasNef ? 1 : person.nef,
            fahrzeugfuehrerHLFB: hasHLFB ? 1 : person.fahrzeugfuehrerHLFB,
            ue50: hasUe50 ? 1 : 0  // Neues Feld für Ü50-Status
          };
        } catch {
          return person;
        }
      }));
      
      setPersonnel(enrichedList);
    } catch {}
    try { const a = await (window as any).api.getAzubiList(); setAzubis(a || []); } catch {}
    try {
      const seqs = await (window as any).api.getDeptPatterns?.();
      const norm = (arr: string[], len = 21) => (arr || [])
        .slice(0, len)
        .concat(Array(len).fill(''))
        .slice(0, len)
        .map(v => (v === '1' || v === '2' || v === '3') ? v : '');
      const parsed = (seqs || []).map((s: any) => ({
        startDate: String(s.startDate),
        pattern: norm(String(s.pattern || '').split(',').map((x: string) => x.trim()), 21)
      }));
  parsed.sort((a: { startDate: string }, b: { startDate: string }) => a.startDate.localeCompare(b.startDate));
      setDeptPatternSeqs(parsed);
    } catch {}
  }, [year, currentMonth]);

  useEffect(() => {
    loadBasics();
  }, [loadBasics]); // Reload when loadBasics changes (which changes when year/month changes)

  const loadRoster = useCallback(async (targetYear?: number) => {
    try {
      const settingsYear = await (window as any).api.getSetting('year');
      // console.log('[DEBUG EinteilungPage] loadRoster called, targetYear:', targetYear, 'settingsYear:', settingsYear, 'state year:', year);
      const y = typeof targetYear === 'number' ? targetYear : Number(settingsYear || new Date().getFullYear());
      // console.log('[DEBUG EinteilungPage] Loading roster for year:', y);
      const entries = await (window as any).api.getDutyRoster(y);
      // console.log('[DEBUG EinteilungPage] Loaded', entries?.length, 'roster entries for year', y);
      const map: RosterState = {};
      (entries || []).forEach((e: any) => {
        if (!e || !e.date) return;
        const key = `${e.personType === 'azubi' ? 'a_' : 'p_'}${e.personId}`;
        if (!map[key]) map[key] = {};
        map[key][String(e.date)] = { value: e.value, type: e.type };
      });
      setRoster(map);
    } catch {}
  }, []);

  useEffect(() => {
    loadBasics().then(() => loadRoster(year));
    const onSettings = async () => {
      await loadBasics();
      await loadRoster(year);
    };
    const onRoster = async () => { await loadRoster(); };
    const onPersonnel = async () => { await loadBasics(); await loadRoster(); };
    (window as any).api?.onSettingsUpdated?.(onSettings);
    (window as any).api?.onDutyRosterUpdated?.(onRoster);
    (window as any).api?.onPersonnelUpdated?.(onPersonnel);
    return () => {
      (window as any).api?.offSettingsUpdated?.(onSettings);
      (window as any).api?.offDutyRosterUpdated?.(onRoster);
      (window as any).api?.offPersonnelUpdated?.(onPersonnel);
    };
  }, [loadBasics, loadRoster]);

  const handleMonthChange = (m: number) => setCurrentMonth(m);

  const handleRosterChanged = async () => {
    await loadRoster(year);
  };

  const handleEntryAssigned = (key: string, date: string, value: string, type: string) => {
    setRoster(prev => ({ ...prev, [key]: { ...(prev[key] || {}), [date]: { value, type } } }));
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 380px',
        gap: 12,
        alignItems: 'start'
      }}
    >
      {/* Hauptbereich: Einteilung */}
      <div style={{ minWidth: 0 }}>
        <MonthTabs
          currentMonth={currentMonth}
          onMonthChange={handleMonthChange}
          personnel={personnel}
          azubis={azubis}
          roster={roster}
          year={year}
          shiftPattern={[]}
          deptPatternSeqs={deptPatternSeqs}
          onRosterChanged={handleRosterChanged}
          onEntryAssigned={handleEntryAssigned}
        />
      </div>
      {/* Rechte Sidebar: Zielcontainer für den Kontrollkasten */}
      <div
        id="einteilung-right-sidebar"
        style={{
          position: 'fixed',
          top: 'clamp(56px, 6.5vw, 90px)',
          right: 8,
          width: 380,
          height: 'calc(100vh - clamp(56px, 6.5vw, 90px))',
          overflowY: 'auto',
          overflowX: 'hidden'
        }}
      />
    </div>
  );
};

export default EinteilungPage;
