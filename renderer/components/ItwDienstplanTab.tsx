import React, { useEffect, useState, useMemo } from 'react';
import './SettingsMenuTables.css'; // Just using basic table styles from here if any

const monthNames = [
    'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
];

interface RosterEntry {
    date: string;
    value: string;
    type: string;
    personId: number;
    personType: string;
}

const ItwDienstplanTab: React.FC = () => {
    const [year, setYear] = useState<number>(new Date().getFullYear());
    const [month, setMonth] = useState<number>(new Date().getMonth());
    
    const [personnel, setPersonnel] = useState<any[]>([]);
    const [doctors, setDoctors] = useState<any[]>([]);
    const [roster, setRoster] = useState<RosterEntry[]>([]);
    const [holidays, setHolidays] = useState<string[]>([]);
    const [itwSeqs, setItwSeqs] = useState<{ startDate: string, pattern: string }[]>([]);
    const [assignments, setAssignments] = useState<any[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    const sortedItwSeqs = useMemo(() => {
        return [...itwSeqs].sort((a, b) => a.startDate.localeCompare(b.startDate));
    }, [itwSeqs]);

    const formatDateString = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const normalizeItwPattern = (pattern: string) => {
        return String(pattern)
            .split(',')
            .map(item => item.trim() === 'IW' ? 'IW' : '');
    };

    const getActiveItwSequence = (dateStr: string) => {
        if (sortedItwSeqs.length === 0) return null;
        if (dateStr < sortedItwSeqs[0].startDate) return null;

        let activeSeq = sortedItwSeqs[0];
        for (const seq of sortedItwSeqs) {
            if (seq.startDate <= dateStr) {
                activeSeq = seq;
            } else {
                break;
            }
        }
        return activeSeq;
    };

    const getPlannedCell = (personId: number, dateStr: string) => {
        if (sortedItwSeqs.length === 0) return null;
        if (holidays.includes(dateStr)) return null;

        const targetTime = new Date(dateStr + 'T00:00:00Z').getTime();
        const activeSeq = getActiveItwSequence(dateStr);
        if (!activeSeq) return null;

        const pattern = normalizeItwPattern(activeSeq.pattern);
        if (!pattern || pattern.length === 0) return null;

        const baseTime = new Date(activeSeq.startDate + 'T00:00:00Z').getTime();
        const diffMs = targetTime - baseTime;
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffDays < 0) return null;

        const patternIndex = ((diffDays % pattern.length) + pattern.length) % pattern.length;
        if (pattern[patternIndex] !== 'IW') return null;

        // Find assignment that covers this date
        const assignment = assignments.find(a => {
            if (Number(a.person_id) !== Number(personId)) return false;
            const aStart = new Date(a.start_date + 'T00:00:00Z').getTime();
            const aEnd = aStart + (21 * 24 * 3600 * 1000); // 21 days phase
            return targetTime >= aStart && targetTime < aEnd;
        });

        if (assignment) {
            return 'IW';
        }
        return null;
    };

    const loadData = async () => {
        setLoading(true);
        try {
            const seqs = await (window as any).api.getItwPatterns?.() || [];
            setItwSeqs(seqs);

            const assigns = await (window as any).api.getItwPhaseAssignments?.() || [];
            setAssignments(assigns);

            const persInfo = await (window as any).api.getPersonnel?.() || [];
            setPersonnel(persInfo);

            const hols = await (window as any).api.getHolidaysForYear?.(year) || [];
            setHolidays(hols.map((h: any) => h.date));

            const rosterData = await (window as any).api.getItwDutyRoster?.(year) || [];
            setRoster(rosterData);

            // Automatically transfer planned assignments to roster for the current month
            const days = [];
            const date = new Date(year, month, 1);
            while (date.getMonth() === month) {
                days.push(new Date(date));
                date.setDate(date.getDate() + 1);
            }
            const transferPromises = [];
            for (const person of persInfo) {
                for (const d of days) {
                            const dateStr = formatDateString(d);
                    const planned = getPlannedCell(person.id, dateStr);
                    const existing = rosterData.find((r: RosterEntry) => r.personId === person.id && r.personType === 'person' && r.date === dateStr);
                    if (planned === 'IW' && !existing) {
                        transferPromises.push(
                            (window as any).api.setItwDutyRosterEntry?.({
                                personId: person.id,
                                personType: 'person',
                                date: dateStr,
                                value: '1',
                                type: 'IW',
                                manual_edit: 0
                            })
                        );
                    }
                }
            }
            await Promise.all(transferPromises);
            if (transferPromises.length > 0) {
                const updatedRoster = await (window as any).api.getItwDutyRoster?.(year) || [];
                setRoster(updatedRoster);
            }
            
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [year, month]);

    // Listen to ITW update events
    useEffect(() => {
        const handleUpdate = () => loadData();
        (window as any).api?.onItwUpdated?.(handleUpdate);
        window.addEventListener('itw-duty-roster-updated', handleUpdate);
        return () => {
            (window as any).api?.offItwUpdated?.(handleUpdate);
            window.removeEventListener('itw-duty-roster-updated', handleUpdate);
        };
    }, [year, month]);

    // Generate days of the month
    const daysInMonth = useMemo(() => {
        const days = [];
        const date = new Date(year, month, 1);
        while (date.getMonth() === month) {
            days.push(new Date(date));
            date.setDate(date.getDate() + 1);
        }
        return days;
    }, [year, month]);



    const handleCellChange = async (personId: number, personType: string, date: string, type: string) => {
        try {
            await (window as any).api.setItwDutyRosterEntry?.({
                personId,
                personType,
                date,
                value: '1',
                type,
                manual_edit: 1
            });
            // Let the event handler reload the grid
            await loadData();
        } catch (e) {
            console.error('Failed to save ITW roster entry', e);
        }
    };

    const handleClearCell = async (personId: number, personType: string, date: string) => {
        try {
            await (window as any).api.setItwDutyRosterEntry?.({
                personId,
                personType,
                date,
                value: '',
                type: '',
                manual_edit: 1
            });
            await loadData();
        } catch (e) {
            console.error('Failed to clear ITW roster entry', e);
        }
    };

    const renderGridRow = (person: any, type: string) => {
        return (
            <tr key={`${type}-${person.id}`}>
                <td style={{ position: 'sticky', left: 0, background: '#fff', padding: '4px 8px', borderRight: '2px solid #ddd', minWidth: '150px' }}>
                    {type === 'doctor' ? `Dr. ${person.name}, ${person.vorname}` : `${person.name}, ${person.vorname}`}
                    {type === 'person' && <div style={{ fontSize: '10px', color: '#666' }}>{person.department || 'Rettungsdienst'}</div>}
                </td>
                {daysInMonth.map(d => {
                    const dateStr = formatDateString(d);
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                    const isHoliday = holidays.includes(dateStr);
                    
                    // DOCTORS hardcoded lock for weekends and holidays
                    const locked = type === 'doctor' && (isWeekend || isHoliday);
                    
                    const entry = roster.find(r => r.personId === person.id && r.personType === type && r.date === dateStr);
                    const plannedType = getPlannedCell(person.id, dateStr);
                    const finalType = entry ? entry.type : (plannedType || '');

                    const cellColor = locked ? '#ececec' : (finalType === 'IW' ? '#86efac' : '#fff');

                    return (
                        <td key={dateStr} style={{ 
                            minWidth: '40px', 
                            textAlign: 'center', 
                            border: '1px solid #eee', 
                            background: isWeekend && !locked ? '#fdfbf7' : cellColor,
                            color: locked ? '#999' : '#000'
                        }}>
                            {locked ? 'X' : (
                                <input
                                    type="text"
                                    value={finalType}
                                    onChange={(e) => {
                                        const v = e.target.value.toUpperCase();
                                        if (v === 'IW') handleCellChange(person.id, type, dateStr, 'IW');
                                        else if (v === '') handleClearCell(person.id, type, dateStr);
                                    }}
                                    style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'center', fontWeight: 'bold' }}
                                />
                            )}
                        </td>
                    );
                })}
            </tr>
        );
    };

    if (loading) return <div style={{ padding: 20 }}>Lade ITW-Dienstplan...</div>;

    return (
        <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
            <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', alignItems: 'center' }}>
                <select value={month} onChange={(e) => setMonth(Number(e.target.value))} style={{ padding: '8px' }}>
                    {monthNames.map((m, idx) => <option key={idx} value={idx}>{m}</option>)}
                </select>
                <input 
                    type="number" 
                    value={year} 
                    onChange={e => setYear(Number(e.target.value))} 
                    style={{ padding: '8px', width: '80px' }} 
                />
                <span style={{ fontSize: '13px', color: '#666' }}>
                    Tipp: Tragen Sie "IW" für ITW-Dienste in die Felder ein.
                </span>
            </div>

            <div style={{ overflowX: 'auto', border: '1px solid #ddd', borderRadius: '4px' }}>
                <table style={{ borderCollapse: 'collapse' }}>
                    <thead>
                        <tr>
                            <th style={{ position: 'sticky', top: 0, left: 0, zIndex: 2, background: '#f8f9fa', padding: '8px', borderRight: '2px solid #ddd', borderBottom: '2px solid #ddd' }}>
                                Personal
                            </th>
                            {daysInMonth.map(d => {
                                const isWe = d.getDay() === 0 || d.getDay() === 6;
                                return (
                                    <th key={d.getDate()} style={{ position: 'sticky', top: 0, zIndex: 1, background: isWe ? '#e2e8f0' : '#f8f9fa', padding: '6px', borderBottom: '2px solid #ddd', borderRight: '1px solid #eee', width: '40px' }}>
                                        <div style={{ fontSize: '12px', fontWeight: 'normal' }}>{['So','Mo','Di','Mi','Do','Fr','Sa'][d.getDay()]}</div>
                                        <div>{d.getDate()}</div>
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>                        {/* Render Personnel */}
                        <tr>
                            <td colSpan={daysInMonth.length + 1} style={{ background: '#f1f5f9', fontWeight: 'bold', padding: '8px', marginTop: '10px' }}>
                                Einsatzpersonal (ITW Vorplanung)
                            </td>
                        </tr>
                        {personnel.map(p => renderGridRow(p, 'person'))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ItwDienstplanTab;
