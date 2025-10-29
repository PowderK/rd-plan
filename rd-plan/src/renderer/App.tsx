import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import Body from './components/Body';
import { BUILD_INFO } from './buildInfo';

const monthNames = [
    'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
];

const App: React.FC = () => {
    const [currentMonth, setCurrentMonth] = useState<number>(new Date().getMonth());
    const [rescueStation, setRescueStation] = useState<string>('');
    const [personnel, setPersonnel] = useState<any[]>([]);
    const [azubis, setAzubis] = useState<any[]>([]);
    const [roster, setRoster] = useState<Record<string, Record<string, { value: string, type: string }>>>({});
    const [year, setYear] = useState<number>(new Date().getFullYear());
    const [shiftPattern] = useState<string[]>([
        '3', '2', '1', '3', '1', '3', '2', '1', '3', '2', '1', '2', '1', '3', '2', '1', '3', '2', '3', '2', '1'
    ]);

    async function loadRescueStation() {
        const value = await (window as any).api.getSetting('rescueStation');
        if (value) setRescueStation(value);
    }

    useEffect(() => {
        loadRescueStation();
        (async () => {
            const list = await (window as any).api.getPersonnelList();
            const azubiList = await (window as any).api.getAzubiList();
            console.log('[App] personnel fetched length=', Array.isArray(list) ? list.length : typeof list, 'sample=', Array.isArray(list) ? list.slice(0,10).map((p: any) => ({ id: p.id, name: p.name, vorname: p.vorname, fahrzeugfuehrer: p.fahrzeugfuehrer, nef: p.nef })) : list);
            setPersonnel(list);
            setAzubis(azubiList);
        })();
    }, []);

    // Wenn Personal außerhalb geändert wird (Edit-Fenster), dann sofort neu laden
    useEffect(() => {
        const reloadAll = async () => {
            try {
                console.log('[App] personnel-updated empfangen -> reload personnel, azubis und roster');
                const list = await (window as any).api.getPersonnelList();
                const azubiList = await (window as any).api.getAzubiList();
                setPersonnel(list);
                setAzubis(azubiList);

                // reload roster for current year
                const y = await (window as any).api.getSetting('year');
                const yearNum = Number(y || new Date().getFullYear());
                const entries = await (window as any).api.getDutyRoster(yearNum);
                const rosterObj: Record<string, Record<string, { value: string, type: string }>> = {};
                entries.forEach((entry: any) => {
                    const key = `${entry.personType === 'azubi' ? 'a_' : 'p_'}${entry.personId}`;
                    if (!rosterObj[key]) rosterObj[key] = {};
                    rosterObj[key][entry.date] = { value: entry.value, type: entry.type };
                });
                setRoster(rosterObj);
            } catch (e) {
                console.error('[App] Fehler beim Neuladen nach personnel-updated', e);
            }
        };

        const onIPC = async () => { await reloadAll(); };
        // Register IPC listener
        (window as any).api?.onPersonnelUpdated?.(onIPC);
        // Also support window.postMessage from popup windows
        const onMessage = (e: any) => { if (e && e.data === 'personnel-updated') { reloadAll(); } };
        window.addEventListener('message', onMessage);

        return () => {
            (window as any).api?.offPersonnelUpdated?.(onIPC);
            window.removeEventListener('message', onMessage);
        };
    }, []);

    useEffect(() => {
        const loadRoster = async () => {
            const y = await (window as any).api.getSetting('year');
            const yearNum = Number(y || new Date().getFullYear());
            const getDaysInYear = (year: number) => {
                const days: { date: string; weekday: string; iso: string }[] = [];
                // Build days using local Date for display (date, weekday) but construct the ISO
                // using UTC to avoid timezone offsets when calling toISOString().
                for (let month = 0; month < 12; month++) {
                    const daysInMonth = new Date(year, month + 1, 0).getDate();
                    for (let d = 1; d <= daysInMonth; d++) {
                        const local = new Date(year, month, d); // local date for display
                        const date = local.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
                        const weekday = local.toLocaleDateString('de-DE', { weekday: 'short' });
                        const iso = new Date(Date.UTC(year, month, d)).toISOString().slice(0, 10); // stable ISO for DB keys
                        days.push({ date, weekday, iso });
                    }
                }
                return days;
            };
            const entries = await (window as any).api.getDutyRoster(yearNum);
            console.log('[App] loadRoster entries', entries);
            const daysArr = getDaysInYear(yearNum);
            const personalIds = new Set(personnel.map((p: { id: number }) => p.id));
            const azubiIds = new Set(azubis.map((a: { id: number }) => a.id));
            const rosterObj: Record<string, Record<string, { value: string, type: string }>> = {};
            entries.forEach((entry: any) => {
                // Always store with explicit prefix so lookup is stable regardless of personnel load order
                const key = `${entry.personType === 'azubi' ? 'a_' : 'p_'}${entry.personId}`;
                if (!rosterObj[key]) rosterObj[key] = {};
                rosterObj[key][entry.date] = { value: entry.value, type: entry.type };
            });
            console.log('[App] setRoster', rosterObj);
            setRoster(rosterObj);
        };

        loadRoster();

        const onUpdated = () => { console.log('[Renderer/App] duty-roster-updated empfangen, lade roster neu'); loadRoster(); };
        (window as any).api?.onDutyRosterUpdated?.(onUpdated);
        const handler = () => loadRescueStation();
        (window as any).api?.onSettingsUpdated?.(handler);
        return () => {
            (window as any).api?.offSettingsUpdated?.(handler);
            (window as any).api?.offDutyRosterUpdated?.(onUpdated);
        };
    }, [personnel, azubis, year, currentMonth]);

    const openSettingsMenu = () => {
        (window as any).api.openSettingsWindow();
    };

    const handleMonthChange = (month: number) => {
        setCurrentMonth(month);
    };

    const handleRosterChanged = () => {
        console.log('[App] handleRosterChanged: Dienstplan wird neu geladen');
        (async () => {
            const y = await (window as any).api.getSetting('year');
            const yearNum = Number(y || new Date().getFullYear());
            const getDaysInYear = (year: number) => {
                const days: { date: string; weekday: string; iso: string }[] = [];
                const start = new Date(year, 0, 1);
                const end = new Date(year + 1, 0, 1);
                for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
                    const date = d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
                    const weekday = d.toLocaleDateString('de-DE', { weekday: 'short' });
                    const iso = d.toISOString().slice(0, 10);
                    days.push({ date, weekday, iso });
                }
                return days;
            };
            const entries = await (window as any).api.getDutyRoster(yearNum);
            console.log('[App] handleRosterChanged entries', entries);
            const daysArr = getDaysInYear(yearNum);
            const personalIds = new Set(personnel.map((p: { id: number }) => p.id));
            const azubiIds = new Set(azubis.map((a: { id: number }) => a.id));
            const rosterObj: Record<string, Record<string, { value: string, type: string }>> = {};
            entries.forEach((entry: any) => {
                const key = `${entry.personType === 'azubi' ? 'a_' : 'p_'}${entry.personId}`;
                if (!rosterObj[key]) rosterObj[key] = {};
                rosterObj[key][entry.date] = { value: entry.value, type: entry.type };
            });
            console.log('[App] handleRosterChanged setRoster', rosterObj);
            setRoster(rosterObj);
        })();
    };

    const handleEntryAssigned = (key: string, date: string, value: string, type: string) => {
        // Merge single assigned entry into roster state immediately for instant UI feedback
        setRoster(prev => ({
            ...prev,
            [key]: { ...(prev[key] || {}), [date]: { value, type } }
        }));
        console.log('[App] handleEntryAssigned merged into roster', { key, date, value, type });
    };

    return (
        <div>
            <Header currentMonth={monthNames[currentMonth]} rescueStation={rescueStation} onOpenSettings={openSettingsMenu} />
            <Body
                currentMonth={currentMonth}
                onMonthChange={handleMonthChange}
                personnel={personnel}
                azubis={azubis}
                roster={roster}
                year={year}
                shiftPattern={shiftPattern}
                onRosterChanged={handleRosterChanged}
                onEntryAssigned={handleEntryAssigned}
            />
            <div style={{textAlign: 'center', marginTop: '1rem', color: '#888'}}>
                <small>Version: {BUILD_INFO.version} | Build: {BUILD_INFO.build}</small>
            </div>
            <Footer />
        </div>
    );
};

export default App;
