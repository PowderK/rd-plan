import React, { useEffect, useState, useCallback } from 'react';
import MonthTabs from './MonthTabs';
import {
  qualificationAppliesInMonth,
  buildDepartmentActiveMonthly,
  indexDepartmentPeriodsByPerson,
  yearMonthKey
} from '../utils/personPeriods';

type RosterState = Record<string, Record<string, { value: string; type: string }>>;

const EinteilungPage: React.FC<{ departmentName?: string }> = ({ departmentName }) => {
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
  /** Alle Personen der Abteilung (ohne Monatsfilter) – für Namensauflösung in der Einteilung. */
  const [personnelLookup, setPersonnelLookup] = useState<{ id: number; name: string; vorname?: string }[]>([]);
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
      const rawList = await (window as any).api.getPersonnelList(false, filterDate, departmentName);
      try {
        const deptWide = await (window as any).api.getPersonnelList(false, undefined, departmentName);
        setPersonnelLookup((deptWide || []).map((p: any) => ({
          id: Number(p.id),
          name: String(p.name || ''),
          vorname: p.vorname ? String(p.vorname) : undefined
        })));
      } catch {
        setPersonnelLookup([]);
      }
      const [allQualPeriods, allDeptPeriods] = await Promise.all([
        (window as any).api.getAllQualificationPeriods?.(),
        (window as any).api.getAllPersonnelDepartmentPeriods?.()
      ]);

      const deptPeriodsByPerson = indexDepartmentPeriodsByPerson(
        Array.isArray(allDeptPeriods) ? allDeptPeriods : []
      );

      // Filtere Personal: Nur Personen MIT Rettungsdienst-Qualifikation
      let rettungsdienstQualName = 'Rettungsdienst';
      try {
        const val = await (window as any).api.getSetting('rettungsdienst_qualification_type');
        if (val) rettungsdienstQualName = String(val);
      } catch { }
      const periodsByPerson: Record<number, any[]> = {};
      if (Array.isArray(allQualPeriods)) {
        allQualPeriods.forEach((p: any) => {
          if (!periodsByPerson[p.personId]) periodsByPerson[p.personId] = [];
          periodsByPerson[p.personId].push(p);
        });
      }

      const yearMonth = `${year}-${String(currentMonth + 1).padStart(2, '0')}`;

      const list = (rawList || []).filter((p: any) => {
        const pPeriods = periodsByPerson[p.id] || [];
        const rdPeriods = pPeriods.filter((per: any) => per.qualType === rettungsdienstQualName);
        if (rdPeriods.length === 0) return true;
        return rdPeriods.some((per: any) => qualificationAppliesInMonth(per, yearMonth));
      });

      console.log('[EinteilungPage] Personnel before filter:', rawList.length, '| after filter:', list.length);

      // Lade HLFB Qualifikationstyp aus Settings
      let hlfbQualName = 'FzF HLF B'; // Fallback
      try {
        const setting = await (window as any).api.getSetting('hlfb_qualification_type');
        if (setting) hlfbQualName = String(setting);
      } catch { }

      // Lade Ü50 Qualifikationstyp aus Settings
      let ue50QualName = 'Ü50'; // Fallback
      try {
        const setting = await (window as any).api.getSetting('ue50_qualification_type');
        if (setting) ue50QualName = String(setting);
      } catch { }

      // Lade LPAL Qualifikationstyp aus Settings
      let lpalQualName = 'LPAL'; // Fallback
      try {
        const setting = await (window as any).api.getSetting('lpal_qualification_type');
        if (setting) lpalQualName = String(setting);
      } catch { }

      // Lade RTW und NEF Fahrzeuge um die konfigurierten Qualifikationen zu ermitteln
      const rtwVehicles = await (window as any).api.getRtwVehicles?.(year) || [];
      const nefVehicles = await (window as any).api.getNefVehicles?.(year) || [];

      // Ermittle Fahrzeugführer-Qualifikationen aus RTW-Positionen (Position 0 = FzF)
      const rtwQualifications = new Set<string>();
      for (const rtw of rtwVehicles.slice(0, 1)) { // Erstes Fahrzeug reicht als Referenz
        try {
          const positions = await (window as any).api.getVehiclePositionsWithQualifications?.('rtw', rtw.id) || [];
          if (positions[0]?.qualificationName) {
            rtwQualifications.add(positions[0].qualificationName);
          }
        } catch { }
      }

      // Ermittle NEF-Qualifikationen aus NEF-Positionen
      const nefQualifications = new Set<string>();
      for (const nef of nefVehicles.slice(0, 1)) { // Erstes Fahrzeug reicht als Referenz
        try {
          const positions = await (window as any).api.getVehiclePositionsWithQualifications?.('nef', nef.id) || [];
          if (positions[0]?.qualificationName) {
            nefQualifications.add(positions[0].qualificationName);
          }
        } catch { }
      }

      // Fallbacks für alte hard-coded Qualifikationen
      rtwQualifications.add('FzF RTW');
      rtwQualifications.add('Fahrzeugführer');
      rtwQualifications.add('Fahrzeugführer RTW');
      nefQualifications.add('NEF');
      nefQualifications.add('NEF Assistent');
      nefQualifications.add('NA');

      // console.log('[EinteilungPage] Erkannte RTW-Qualifikationen:', Array.from(rtwQualifications));
      // console.log('[EinteilungPage] Erkannte NEF-Qualifikationen:', Array.from(nefQualifications));
      // console.log('[EinteilungPage] HLFB-Qualifikation:', hlfbQualName);
      // console.log('[EinteilungPage] Ü50-Qualifikation:', ue50QualName);

      console.log('[DEBUG EinteilungPage] RTW Qualifications:', Array.from(rtwQualifications));
      console.log('[DEBUG EinteilungPage] NEF Qualifications:', Array.from(nefQualifications));
      // Für jede Person die Qualifikationen aus qualification_periods laden
      const enrichedList = await Promise.all((list || []).map(async (person: any) => {
        try {
          // Lade Qualifikationsperioden (altes System mit qualType als String)
          const periods = await (window as any).api.getQualificationPeriods?.(person.id) || [];

          const hasFahrzeugfuehrer = periods.some((p: any) =>
            rtwQualifications.has(p.qualType) &&
            qualificationAppliesInMonth(p, yearMonth)
          );

          // Prüfe, ob Person NEF-Qualifikation hat
          const hasNef = periods.some((p: any) =>
            nefQualifications.has(p.qualType) &&
            qualificationAppliesInMonth(p, yearMonth)
          );

          const hasHLFB = periods.some((p: any) =>
            p.qualType === hlfbQualName &&
            qualificationAppliesInMonth(p, yearMonth)
          );

          const hasUe50 = periods.some((p: any) =>
            p.qualType === ue50QualName &&
            qualificationAppliesInMonth(p, yearMonth)
          );

          const hasLpal = periods.some((p: any) =>
            p.qualType === lpalQualName &&
            qualificationAppliesInMonth(p, yearMonth)
          );

          const hlfbMonthly = Array(12).fill(false);
          const ue50Monthly = Array(12).fill(false);
          const lpalMonthly = Array(12).fill(false);
          const rettungsdienstMonthly = Array(12).fill(false);

          const hlfbPeriods = periods.filter((per: any) => per.qualType === hlfbQualName);
          const hasHlfbPeriod = hlfbPeriods.length > 0;

          const ue50Periods = periods.filter((per: any) => per.qualType === ue50QualName);
          const hasUe50Period = ue50Periods.length > 0;

          const lpalPeriods = periods.filter((per: any) => per.qualType === lpalQualName);
          const hasLpalPeriod = lpalPeriods.length > 0;

          const rettungsdienstPeriods = periods.filter((per: any) => per.qualType === rettungsdienstQualName);
          const hasRettungsdienstPeriod = rettungsdienstPeriods.length > 0;

          const qualApplies = (perList: any[], ym: string) =>
            perList.some((per: any) => qualificationAppliesInMonth(per, ym));

          for (let m = 0; m < 12; m++) {
            const ym = yearMonthKey(year, m);
            if (hasHlfbPeriod) hlfbMonthly[m] = qualApplies(hlfbPeriods, ym);
            if (hasUe50Period) ue50Monthly[m] = qualApplies(ue50Periods, ym);
            if (hasLpalPeriod) lpalMonthly[m] = qualApplies(lpalPeriods, ym);
            if (hasRettungsdienstPeriod) rettungsdienstMonthly[m] = qualApplies(rettungsdienstPeriods, ym);
            else rettungsdienstMonthly[m] = true;
          }

          const deptActiveMonthly = buildDepartmentActiveMonthly(
            person.id,
            year,
            deptPeriodsByPerson,
            departmentName
          );

          // Statisches Flag als Fallback für HLF-B
          const staticFlag = person.fahrzeugfuehrerHLFB === 1 || person.fahrzeugfuehrerHLFB === true || person.fahrzeugfuehrerHLFB === '1' ||
            person.fahrzeugfuehrer_hlf_b === 1 || person.fahrzeugfuehrer_hlf_b === true || person.fahrzeugfuehrer_hlf_b === '1';

          if (!hasHlfbPeriod && staticFlag) {
            hlfbMonthly.fill(true);
          }

          return {
            ...person,
            fahrzeugfuehrer: hasFahrzeugfuehrer ? 1 : person.fahrzeugfuehrer,
            nef: hasNef ? 1 : person.nef,
            fahrzeugfuehrerHLFB: hasHLFB ? 1 : person.fahrzeugfuehrerHLFB,
            ue50: hasUe50 ? 1 : 0,  // Ü50-Status
            lpal: hasLpal ? 1 : 0,  // LPAL-Status
            oldRtwShifts: person.old_rtw_shifts || 0, // Aus Altsystem
            hlfbMonthly,
            ue50Monthly,
            lpalMonthly,
            rettungsdienstMonthly,
            deptActiveMonthly
          };
        } catch {
          return person;
        }
      }));

      setPersonnel(enrichedList);
    } catch { }
    try { const a = await (window as any).api.getAzubiList(departmentName); setAzubis(a || []); } catch { }
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
    } catch { }
  }, [year, currentMonth, departmentName]);

  useEffect(() => {
    loadBasics();
  }, [loadBasics]); // Reload when loadBasics changes (which changes when year/month changes)

  const loadRoster = useCallback(async (targetYear?: number) => {
    try {
      const settingsYear = await (window as any).api.getSetting('year');
      // console.log('[DEBUG EinteilungPage] loadRoster called, targetYear:', targetYear, 'settingsYear:', settingsYear, 'state year:', year);
      const y = typeof targetYear === 'number' ? targetYear : Number(settingsYear || new Date().getFullYear());
      // console.log('[DEBUG EinteilungPage] Loading roster for year:', y);
      const entries = await (window as any).api.getDutyRoster(y, departmentName);
      // console.log('[DEBUG EinteilungPage] Loaded', entries?.length, 'roster entries for year', y);
      const map: RosterState = {};
      (entries || []).forEach((e: any) => {
        if (!e || !e.date) return;
        let prefix = 'p_';
        if (e.personType === 'azubi') prefix = 'a_';
        else if (e.personType === 'guest') prefix = 'g_';
        else if (e.personType === 'doctor') prefix = 'd_';
        
        const key = `${prefix}${e.personId}`;
        if (!map[key]) map[key] = {};
        map[key][String(e.date)] = { value: e.value, type: e.type };
      });
      setRoster(map);

      setRoster(map);
    } catch { }
  }, [departmentName]);

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
  }, [loadBasics, loadRoster, year, departmentName]);

  const handleMonthChange = (m: number) => setCurrentMonth(m);

  const handleYearChange = async (newYear: number) => {
    if (!Number.isFinite(newYear) || newYear === year) return;

    setYear(newYear);
    (window as any).rdPlanYear = newYear;
    window.dispatchEvent(new CustomEvent('rdplan-year-changed', { detail: { year: newYear } }));

    const currentYear = new Date().getFullYear();
    setCurrentMonth(newYear === currentYear ? new Date().getMonth() : 0);

    await loadRoster(newYear);
  };

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
        gridTemplateColumns: 'minmax(0, 1fr) 440px',
        gap: 12,
        alignItems: 'start'
      }}
    >
      {/* Hauptbereich: Einteilung */}
      <div style={{ minWidth: 0 }}>
        <MonthTabs
          currentMonth={currentMonth}
          onMonthChange={handleMonthChange}
          onYearChange={handleYearChange}
          departmentName={departmentName}
          personnelLookup={personnelLookup}
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
          top: 'clamp(140px, 14vh, 190px)',
          right: 24,
          width: 440,
          maxWidth: 'calc(100vw - 320px)',
          height: 'calc(100vh - clamp(140px, 14vh, 190px) - 52px)',
          overflowY: 'hidden',
          overflowX: 'hidden',
          zIndex: 102
        }}
      />
    </div>
  );
};

export default EinteilungPage;
