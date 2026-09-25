import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { normalizeDepartmentName } from '../utils/personPeriods';
import { parseItwPatternString, parseItwDay, normalizeDeptCode } from '../utils/itwPatternUtils';
import './SettingsMenuTables.css';

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
    manual_edit?: number;
}

const ItwDienstplanTab: React.FC = () => {
    const { currentUser, isDevMode } = useAuth();
    const isAppAdmin = isDevMode || currentUser?.roleName?.toLowerCase() === 'administrator';
    const itwDienstplanPerm = isAppAdmin
        ? 'write'
        : (currentUser?.permissions?.itw_dienstplan || (
            currentUser?.permissions?.itw === 'write_all' ? 'write' :
            currentUser?.permissions?.itw === 'write' ? 'read_all' :
            currentUser?.permissions?.itw === 'read' ? 'read' : 'none'
        ));

    const canEditDienstplan = isAppAdmin || itwDienstplanPerm === 'write' || itwDienstplanPerm === 'write_all';
    const canReadAll = isAppAdmin || canEditDienstplan || itwDienstplanPerm === 'read_all';
    const canReadOwn = itwDienstplanPerm === 'read';
    const canRead = canReadAll || canReadOwn;

    const [year, setYear] = useState<number>(new Date().getFullYear());
    const [month, setMonth] = useState<number>(new Date().getMonth());

    useEffect(() => {
        let isMounted = true;
        (async () => {
            try {
                const settingYear = await (window as any).api.getSetting?.('itw_vorplanung_year');
                if (settingYear && !isNaN(Number(settingYear)) && isMounted) {
                    setYear(Number(settingYear));
                }
            } catch (e) {
                console.error('[ITW] Error loading itw_vorplanung_year for dienstplan:', e);
            }
        })();
        return () => { isMounted = false; };
    }, []);
    
    const [personnel, setPersonnel] = useState<any[]>([]);
    const [doctors, setDoctors] = useState<any[]>([]);
    const [doctorPeriods, setDoctorPeriods] = useState<Record<number, any[]>>({});
    const [roster, setRoster] = useState<RosterEntry[]>([]);
    const [holidays, setHolidays] = useState<string[]>([]);
    const [itwSeqs, setItwSeqs] = useState<{ startDate: string, pattern: string, department?: string }[]>([]);
    const [assignments, setAssignments] = useState<any[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    const isOwnUser = (p: any) => {
        if (!currentUser) return false;
        if (isDevMode || currentUser.userId === -1) return true;
        if (currentUser.userId && Number(p.id) === Number(currentUser.userId)) return true;
        if (currentUser.personnelNumber && p.personnelNumber && String(p.personnelNumber).trim().toLowerCase() === String(currentUser.personnelNumber).trim().toLowerCase()) return true;
        if (currentUser.name && currentUser.vorname && p.name && p.vorname) {
            return String(p.name).trim().toLowerCase() === String(currentUser.name).trim().toLowerCase() &&
                   String(p.vorname).trim().toLowerCase() === String(currentUser.vorname).trim().toLowerCase();
        }
        return false;
    };

    const sortedItwSeqs = useMemo(() => {
        return [...itwSeqs].sort((a, b) => a.startDate.localeCompare(b.startDate));
    }, [itwSeqs]);

    const isItwDoctor = (d: any) => {
        return d.is_itw === 1 || d.is_itw === true || String(d.is_itw) === '1' || (d.is_itw === undefined && !d.is_nef);
    };

    const isDoctorActiveInMonth = (docId: number) => {
        const periods = doctorPeriods[docId] || [];
        if (periods.length === 0) return true; // Keine Perioden definiert => dauerhaft aktiv
        const mStart = `${year}-${String(month + 1).padStart(2, '0')}-01`;
        const lastDay = new Date(year, month + 1, 0).getDate();
        const mEnd = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        return periods.some(p => {
            const s = String(p.start_date || '').slice(0, 10);
            const e = String(p.end_date || '').slice(0, 10);
            return s <= mEnd && e >= mStart;
        });
    };

    const filteredDoctors = useMemo(() => {
        if (!canReadAll) return [];
        return (doctors || []).filter(d => {
            if (!isItwDoctor(d)) return false;
            const hasRosterInMonth = (roster || []).some(r => {
                if (r.personType !== 'doctor' || Number(r.personId) !== Number(d.id)) return false;
                const rMonth = Number(r.date.slice(5, 7)) - 1;
                const rYear = Number(r.date.slice(0, 4));
                return rYear === year && rMonth === month && (r.value === '1' || r.type === 'IW');
            });
            if (hasRosterInMonth) return true;
            return isDoctorActiveInMonth(d.id);
        });
    }, [doctors, doctorPeriods, roster, year, month, canReadAll]);

    const formatDateString = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
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

        const person = personnel.find(p => Number(p.id) === Number(personId));
        const personDept = person?.department || '1. Abteilung';
        const deptCode = normalizeDeptCode(personDept);

        const targetTime = new Date(dateStr + 'T00:00:00Z').getTime();
        const activeSeq = getActiveItwSequence(dateStr);
        if (!activeSeq) return null;

        const patternSlots = parseItwPatternString(activeSeq.pattern);
        if (!patternSlots || patternSlots.length === 0) return null;

        const baseTime = new Date(activeSeq.startDate + 'T00:00:00Z').getTime();
        const diffMs = targetTime - baseTime;
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffDays < 0) return null;

        const patternIndex = ((diffDays % patternSlots.length) + patternSlots.length) % patternSlots.length;
        const slot = patternSlots[patternIndex];
        const isAssignedDay = slot.fzf === deptCode || slot.maschinist === deptCode;
        if (!isAssignedDay) return null;

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

            const persInfo = await (window as any).api.getPersonnel?.(false, 'all') || [];
            setPersonnel(persInfo);

            const docs = await (window as any).api.getItwDoctors?.() || [];
            setDoctors(docs);

            const docP = await (window as any).api.getAllDoctorPeriods?.() || [];
            const dpMap: Record<number, any[]> = {};
            (docP || []).forEach((p: any) => {
                if (!dpMap[p.doctor_id]) dpMap[p.doctor_id] = [];
                dpMap[p.doctor_id].push(p);
            });
            setDoctorPeriods(dpMap);

            const hols = await (window as any).api.getHolidaysForYear?.(year) || [];
            setHolidays(hols.map((h: any) => h.date));

            const rosterData = await (window as any).api.getItwDutyRoster?.(year) || [];
            setRoster(rosterData);

            // Automatically transfer planned assignments to roster for the current month if user has edit rights
            if (canEditDienstplan) {
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
                        } else if (existing && (!existing.manual_edit || existing.manual_edit === 0) && existing.type === 'IW' && planned !== 'IW') {
                            transferPromises.push(
                                (window as any).api.setItwDutyRosterEntry?.({
                                    personId: person.id,
                                    personType: 'person',
                                    date: dateStr,
                                    value: '',
                                    type: '',
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
        window.addEventListener('itw-doctors-updated', handleUpdate);
        window.addEventListener('doctor-periods-updated', handleUpdate);
        return () => {
            (window as any).api?.offItwUpdated?.(handleUpdate);
            window.removeEventListener('itw-duty-roster-updated', handleUpdate);
            window.removeEventListener('itw-doctors-updated', handleUpdate);
            window.removeEventListener('doctor-periods-updated', handleUpdate);
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

    const visiblePersonnel = useMemo(() => {
        if (canReadAll) {
            return personnel;
        }
        if (canReadOwn) {
            return personnel.filter(p => isOwnUser(p));
        }
        return [];
    }, [personnel, canReadAll, canReadOwn, currentUser]);

    const groupedPersonnel = useMemo(() => {
        const map = new Map<string, any[]>();
        for (const p of visiblePersonnel) {
            const dept = p.department || '1. Abteilung';
            if (!map.has(dept)) map.set(dept, []);
            map.get(dept)!.push(p);
        }
        const sortedDepts = Array.from(map.keys()).sort((a, b) => {
            return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
        });
        return sortedDepts.map(dept => ({
            department: dept,
            members: map.get(dept)!
        }));
    }, [visiblePersonnel]);



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
                    {type === 'doctor' 
                        ? `${person.title ? person.title + ' ' : ''}${person.name}, ${person.vorname}`.trim()
                        : `${person.name}, ${person.vorname}`}
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
                                    disabled={!canEditDienstplan}
                                    onChange={(e) => {
                                        if (!canEditDienstplan) return;
                                        const v = e.target.value.toUpperCase();
                                        if (v === 'IW') handleCellChange(person.id, type, dateStr, 'IW');
                                        else if (v === '') handleClearCell(person.id, type, dateStr);
                                    }}
                                    style={{
                                        width: '100%',
                                        border: 'none',
                                        background: 'transparent',
                                        textAlign: 'center',
                                        fontWeight: 'bold',
                                        cursor: canEditDienstplan ? 'text' : 'not-allowed'
                                    }}
                                />
                            )}
                        </td>
                    );
                })}
            </tr>
        );
    };

    if (!canRead) {
        return (
            <div style={{ padding: 20, color: '#666' }}>
                Sie haben keine Berechtigung, den ITW-Dienstplan einzusehen.
            </div>
        );
    }

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
                    <tbody>
                        {groupedPersonnel.map(({ department, members }) => {
                            let deptHeaderStyle: React.CSSProperties = {
                                background: '#f1f5f9',
                                fontWeight: 'bold',
                                padding: '8px 12px',
                                fontSize: '13px',
                                color: '#1e293b',
                                borderTop: '2px solid #cbd5e1',
                                borderBottom: '1px solid #cbd5e1'
                            };
                            if (department.startsWith('1')) {
                                deptHeaderStyle = { background: '#fef2f2', fontWeight: 'bold', padding: '8px 12px', fontSize: '13px', color: '#b91c1c', borderTop: '2px solid #fecaca', borderBottom: '1px solid #fecaca', borderLeft: '4px solid #ef4444' };
                            } else if (department.startsWith('2')) {
                                deptHeaderStyle = { background: '#eff6ff', fontWeight: 'bold', padding: '8px 12px', fontSize: '13px', color: '#1d4ed8', borderTop: '2px solid #bfdbfe', borderBottom: '1px solid #bfdbfe', borderLeft: '4px solid #2563eb' };
                            } else if (department.startsWith('3')) {
                                deptHeaderStyle = { background: '#f0fdf4', fontWeight: 'bold', padding: '8px 12px', fontSize: '13px', color: '#15803d', borderTop: '2px solid #bbf7d0', borderBottom: '1px solid #bbf7d0', borderLeft: '4px solid #16a34a' };
                            }

                            return (
                                <React.Fragment key={department}>
                                    <tr>
                                        <td 
                                            colSpan={daysInMonth.length + 1} 
                                            style={deptHeaderStyle}
                                        >
                                            {department}
                                        </td>
                                    </tr>
                                    {members.map(p => renderGridRow(p, 'person'))}
                                </React.Fragment>
                            );
                        })}
                        {filteredDoctors.length > 0 && (
                            <React.Fragment key="doctors">
                                <tr>
                                    <td 
                                        colSpan={daysInMonth.length + 1} 
                                        style={{ 
                                            background: '#f1f5f9', 
                                            fontWeight: 'bold', 
                                            padding: '8px 12px', 
                                            fontSize: '13px',
                                            color: '#1e293b',
                                            borderTop: '2px solid #cbd5e1',
                                            borderBottom: '1px solid #cbd5e1'
                                        }}
                                    >
                                        ITW-Ärzte
                                    </td>
                                </tr>
                                {filteredDoctors.map(d => renderGridRow(d, 'doctor'))}
                            </React.Fragment>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ItwDienstplanTab;
