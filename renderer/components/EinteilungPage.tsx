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
    try { const list = await (window as any).api.getPersonnelList(); setPersonnel(list || []); } catch {}
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
    <div style={{ padding: 8 }}>
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
  );
};

export default EinteilungPage;
