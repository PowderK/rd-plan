import React, { useEffect, useState, useCallback } from 'react';
import MonthTabs from './MonthTabs';

type RosterState = Record<string, Record<string, { value: string; type: string }>>;

const EinteilungPage: React.FC = () => {
  const [currentMonth, setCurrentMonth] = useState<number>(new Date().getMonth());
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [personnel, setPersonnel] = useState<any[]>([]);
  const [azubis, setAzubis] = useState<any[]>([]);
  const [roster, setRoster] = useState<RosterState>({});
  const [deptPatternSeqs, setDeptPatternSeqs] = useState<{ startDate: string; pattern: string[] }[]>([]);

  const loadBasics = useCallback(async () => {
    try {
      const y = await (window as any).api.getSetting('year');
      setYear(Number(y || new Date().getFullYear()));
    } catch {}
    try { 
      const list = await (window as any).api.getPersonnelList();
      
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
      
      console.log('[EinteilungPage] Erkannte RTW-Qualifikationen:', Array.from(rtwQualifications));
      console.log('[EinteilungPage] Erkannte NEF-Qualifikationen:', Array.from(nefQualifications));
      console.log('[EinteilungPage] HLFB-Qualifikation:', hlfbQualName);
      console.log('[EinteilungPage] Ü50-Qualifikation:', ue50QualName);
      
      // Für jede Person die Qualifikationen aus qualification_periods laden
      const enrichedList = await Promise.all((list || []).map(async (person: any) => {
        try {
          // Lade Qualifikationsperioden (altes System mit qualType als String)
          const periods = await (window as any).api.getQualificationPeriods?.(person.id) || [];
          
          console.log(`[EinteilungPage] Person ${person.name}: Perioden=`, periods.map((p: any) => `${p.qualType} (${p.startYM}-${p.endYM||'∞'}, active=${p.active})`));
          
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
          
          if (hasFahrzeugfuehrer || hasNef || hasHLFB || hasUe50) {
            console.log(`[EinteilungPage] ${person.name}: FzF=${hasFahrzeugfuehrer}, NEF=${hasNef}, HLFB=${hasHLFB}, Ü50=${hasUe50}`);
          }
          
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
  }, []);

  const loadRoster = useCallback(async (targetYear?: number) => {
    try {
      const y = typeof targetYear === 'number' ? targetYear : Number((await (window as any).api.getSetting('year')) || new Date().getFullYear());
      const entries = await (window as any).api.getDutyRoster(y);
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
    loadBasics().then(() => loadRoster());
    const onSettings = async () => {
      await loadBasics();
      await loadRoster();
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
        padding: 8,
        display: 'grid',
        gridTemplateColumns: '1fr 260px',
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
      {/* Rechte Sidebar: Zielcontainer für den Kontrollkasten (unterhalb des Headers, analog Menü) */}
      <div
        id="einteilung-right-sidebar"
        style={{
          position: 'sticky',
          top: 0, // beginnt unterhalb des Headers, da dieser außerhalb von <main> sticky ist
          alignSelf: 'start'
        }}
      />
    </div>
  );
};

export default EinteilungPage;
