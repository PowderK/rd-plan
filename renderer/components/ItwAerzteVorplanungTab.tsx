import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';

const monthNames = [
    'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
];

const dayNames = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

interface Doctor {
    id: number;
    name: string;
    vorname: string;
    anrede?: string;
    title?: string;
}

interface RosterEntry {
    personId: number;
    personType: string;
    date: string;
    value: string;
    type: string;
}

const ItwAerzteVorplanungTab: React.FC = () => {
    const { currentUser, isDevMode } = useAuth();
    const isAppAdmin = isDevMode || currentUser?.roleName?.toLowerCase() === 'administrator';
    const canEditDoctorAssignments = isAppAdmin || currentUser?.permissions?.itw === 'write_all';

    const [year, setYear] = useState<number>(new Date().getFullYear());
    const [month, setMonth] = useState<number>(new Date().getMonth());
    const [doctors, setDoctors] = useState<Doctor[]>([]);
    const [roster, setRoster] = useState<RosterEntry[]>([]);
    const [holidays, setHolidays] = useState<string[]>([]);
    const [itwSeqs, setItwSeqs] = useState<{ startDate: string, pattern: string }[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    const sortedItwSeqs = useMemo(() => {
        return [...itwSeqs].sort((a, b) => a.startDate.localeCompare(b.startDate));
    }, [itwSeqs]);

    const minYear = useMemo(() => {
        if (sortedItwSeqs.length === 0) return new Date().getFullYear();
        const y = Number(sortedItwSeqs[0].startDate.slice(0, 4));
        return Number.isNaN(y) ? new Date().getFullYear() : y;
    }, [sortedItwSeqs]);

    useEffect(() => {
        if (year < minYear) {
            setYear(minYear);
        }
    }, [minYear, year]);

    const formatDateString = (date: Date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const daysInMonth = useMemo(() => {
        const days: Date[] = [];
        const date = new Date(year, month, 1);
        while (date.getMonth() === month) {
            days.push(new Date(date));
            date.setDate(date.getDate() + 1);
        }
        return days;
    }, [year, month]);

    const loadData = async () => {
        setLoading(true);
        try {
            const seqs = await (window as any).api.getItwPatterns?.() || [];
            setItwSeqs(seqs);

            const docs = await (window as any).api.getItwDoctors?.() || [];
            setDoctors(docs);

            const rosterData = await (window as any).api.getItwDutyRoster?.(year) || [];
            setRoster(rosterData);

            const hols = await (window as any).api.getHolidaysForYear?.(year) || [];
            setHolidays(hols.map((h: any) => h.date));
        } catch (e) {
            console.error('Fehler beim Laden der Ärzte-Vorplanung:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [year, month]);

    useEffect(() => {
        const handleUpdated = () => {
            loadData();
        };
        (window as any).api.onItwUpdated?.(handleUpdated);
        window.addEventListener('itw-patterns-updated', handleUpdated);
        return () => {
            (window as any).api.offItwUpdated?.(handleUpdated);
            window.removeEventListener('itw-patterns-updated', handleUpdated);
        };
    }, [year, month]);

    const handleDoctorSelect = async (dateStr: string, selectedDoctorId: number) => {
        try {
            // Clear existing doctor assigned on this date
            const existingDoctorsOnDate = roster.filter(r => r.personType === 'doctor' && r.date === dateStr);
            for (const entry of existingDoctorsOnDate) {
                await (window as any).api.setItwDutyRosterEntry?.({
                    personId: entry.personId,
                    personType: 'doctor',
                    date: dateStr,
                    value: '',
                    type: '',
                    manual_edit: 1
                });
            }

            // Assign new doctor if selected
            if (selectedDoctorId > 0) {
                await (window as any).api.setItwDutyRosterEntry?.({
                    personId: selectedDoctorId,
                    personType: 'doctor',
                    date: dateStr,
                    value: '1',
                    type: 'IW',
                    manual_edit: 1
                });
            }

            await loadData();
        } catch (e) {
            console.error('Fehler beim Speichern der Arzt-Zuordnung:', e);
        }
    };

    // Calculate monthly stats
    const stats = useMemo(() => {
        let totalDutyDays = 0;
        let assignedDays = 0;

        for (const d of daysInMonth) {
            const dateStr = formatDateString(d);
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
            const isHoliday = holidays.includes(dateStr);
            const isDutyDay = !isWeekend && !isHoliday;

            if (isDutyDay) {
                totalDutyDays++;
                const assigned = roster.some(r => r.personType === 'doctor' && r.date === dateStr && r.type === 'IW');
                if (assigned) assignedDays++;
            }
        }

        return {
            totalDutyDays,
            assignedDays
        };
    }, [daysInMonth, roster, holidays]);

    return (
        <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', maxWidth: '1100px', margin: '0 auto' }}>
            {/* Header mit Jahr & Titel */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2 style={{ margin: 0, color: '#1e293b', fontSize: '20px' }}>ITW Ärzte Vorplanung</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                        onClick={() => setYear(prev => Math.max(minYear, prev - 1))}
                        disabled={year <= minYear}
                        style={{
                            padding: '6px 12px',
                            borderRadius: '4px',
                            border: '1px solid #cbd5e1',
                            background: year <= minYear ? '#f1f5f9' : '#fff',
                            color: year <= minYear ? '#94a3b8' : '#1e293b',
                            fontWeight: 'bold',
                            cursor: year <= minYear ? 'not-allowed' : 'pointer',
                            fontSize: '14px'
                        }}
                        title="Vorheriges Jahr"
                    >
                        &lt;
                    </button>
                    <span style={{ fontWeight: 'bold', fontSize: '16px', color: '#1e293b', minWidth: '50px', textAlign: 'center' }}>
                        {year}
                    </span>
                    <button
                        onClick={() => setYear(prev => prev + 1)}
                        style={{
                            padding: '6px 12px',
                            borderRadius: '4px',
                            border: '1px solid #cbd5e1',
                            background: '#fff',
                            color: '#1e293b',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            fontSize: '14px'
                        }}
                        title="Nächstes Jahr"
                    >
                        &gt;
                    </button>
                </div>
            </div>

            {/* Monate-Tabs Navigation */}
            <div style={{ display: 'flex', gap: '4px', borderBottom: '2px solid #cbd5e1', marginBottom: '20px', overflowX: 'auto' }}>
                {monthNames.map((name, idx) => (
                    <button
                        key={name}
                        onClick={() => setMonth(idx)}
                        style={{
                            padding: '8px 16px',
                            background: month === idx ? '#007bff' : '#f1f5f9',
                            color: month === idx ? '#fff' : '#475569',
                            border: 'none',
                            borderTopLeftRadius: '6px',
                            borderTopRightRadius: '6px',
                            fontWeight: month === idx ? 600 : 400,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            fontSize: '14px',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        {name}
                    </button>
                ))}
            </div>

            {/* Statistik-Leiste (Ärzte zugeteilt - Dynamische Farben) */}
            {(() => {
                const isAllAssigned = stats.totalDutyDays > 0 && stats.assignedDays >= stats.totalDutyDays;
                return (
                    <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
                        <div style={{
                            background: isAllAssigned ? '#f0fdf4' : '#fef2f2',
                            border: isAllAssigned ? '1px solid #bbf7d0' : '1px solid #fecaca',
                            borderRadius: '8px',
                            padding: '12px 18px',
                            flex: 1,
                            minWidth: '180px',
                            transition: 'all 0.2s ease'
                        }}>
                            <div style={{ fontSize: '12px', color: isAllAssigned ? '#15803d' : '#b91c1c', fontWeight: 600 }}>
                                Ärzte zugeteilt {isAllAssigned ? '✓ (Vollständig)' : '⚠ (Fehlt was)'}
                            </div>
                            <div style={{ fontSize: '20px', fontWeight: 'bold', color: isAllAssigned ? '#166534' : '#991b1b' }}>
                                {stats.assignedDays} / {stats.totalDutyDays} Tage
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Vorplanung Tabelle */}
            {loading ? (
                <div style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>Lade Ärzte-Vorplanung...</div>
            ) : (
                <div style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                        <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                                <th style={{ padding: '10px 16px', width: '120px' }}>Datum</th>
                                <th style={{ padding: '10px 16px', width: '120px' }}>Wochentag</th>
                                <th style={{ padding: '10px 16px', width: '180px' }}>Dienst-Status</th>
                                <th style={{ padding: '10px 16px' }}>Zugeordneter ITW-Arzt</th>
                            </tr>
                        </thead>
                        <tbody>
                            {daysInMonth.map(d => {
                                const dateStr = formatDateString(d);
                                const dayNum = d.getDay();
                                const isWeekend = dayNum === 0 || dayNum === 6;
                                const isHoliday = holidays.includes(dateStr);
                                const isDutyDay = !isWeekend && !isHoliday;

                                const currentDoctorEntry = roster.find(r => r.personType === 'doctor' && r.date === dateStr && r.type === 'IW');
                                const currentDoctorId = currentDoctorEntry ? currentDoctorEntry.personId : 0;

                                let rowBg = '#ffffff';
                                if (isWeekend || isHoliday) {
                                    rowBg = '#f8fafc';
                                } else if (currentDoctorId > 0) {
                                    rowBg = '#f0fdf4';
                                } else {
                                    rowBg = '#fef2f2';
                                }

                                return (
                                    <tr 
                                        key={dateStr}
                                        style={{ 
                                            background: rowBg, 
                                            borderBottom: '1px solid #f1f5f9',
                                            transition: 'background-color 0.15s ease'
                                        }}
                                    >
                                        <td style={{ padding: '10px 16px', fontWeight: 500, color: '#1e293b' }}>
                                            {d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                        </td>
                                        <td style={{ padding: '10px 16px', color: isWeekend ? '#94a3b8' : '#475569' }}>
                                            {dayNames[dayNum]}
                                        </td>
                                        <td style={{ padding: '10px 16px' }}>
                                            {isWeekend ? (
                                                <span style={{ background: '#e2e8f0', color: '#64748b', padding: '3px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 500 }}>
                                                    Wochenende
                                                </span>
                                            ) : isHoliday ? (
                                                <span style={{ background: '#fef3c7', color: '#b45309', padding: '3px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 500 }}>
                                                    Feiertag
                                                </span>
                                            ) : (
                                                <span style={{ background: currentDoctorId > 0 ? '#dcfce7' : '#fee2e2', color: currentDoctorId > 0 ? '#15803d' : '#991b1b', padding: '3px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600 }}>
                                                    ITW-Dienst
                                                </span>
                                            )}
                                        </td>
                                        <td style={{ padding: '10px 16px' }}>
                                            {!isDutyDay ? (
                                                <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '13px' }}>Kein ITW-Dienst</span>
                                            ) : (
                                                <select
                                                    value={currentDoctorId}
                                                    disabled={!canEditDoctorAssignments}
                                                    onChange={(e) => handleDoctorSelect(dateStr, Number(e.target.value))}
                                                    style={{
                                                        width: '100%',
                                                        maxWidth: '320px',
                                                        padding: '8px 12px',
                                                        borderRadius: '6px',
                                                        border: currentDoctorId > 0 ? '1.5px solid #22c55e' : '1.5px solid #ef4444',
                                                        backgroundColor: !canEditDoctorAssignments ? '#f1f5f9' : (currentDoctorId > 0 ? '#ffffff' : '#fef2f2'),
                                                        color: currentDoctorId > 0 ? '#0f172a' : '#991b1b',
                                                        fontWeight: currentDoctorId > 0 ? 600 : 400,
                                                        fontSize: '14px',
                                                        cursor: canEditDoctorAssignments ? 'pointer' : 'not-allowed'
                                                    }}
                                                >
                                                    <option value={0}>-- Kein Arzt eingeteilt --</option>
                                                    {doctors.map(doc => {
                                                        const parts = [];
                                                        if (doc.anrede) parts.push(doc.anrede);
                                                        if (doc.title) parts.push(doc.title);
                                                        parts.push(`${doc.name}, ${doc.vorname}`);
                                                        const label = parts.join(' ');
                                                        return (
                                                            <option key={doc.id} value={doc.id}>
                                                                {label}
                                                            </option>
                                                        );
                                                    })}
                                                </select>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default ItwAerzteVorplanungTab;
