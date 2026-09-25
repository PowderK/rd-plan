import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { normalizeDepartmentName } from '../utils/personPeriods';
import { parseItwPatternString, parseItwDay, normalizeDeptCode, deptCodeToLabel } from '../utils/itwPatternUtils';
import './SettingsMenuTables.css';

interface QualPeriod {
    qualType: string;
    startYM: string;
    endYM: string | null;
    active: boolean;
}

const DEPARTMENTS = ['1. Abteilung', '2. Abteilung', '3. Abteilung'];

const ItwVorplanungTab: React.FC = () => {
    const [itwSeqs, setItwSeqs] = useState<{ startDate: string, pattern: string, department?: string }[]>([]);
    const [personnel, setPersonnel] = useState<any[]>([]);
    const [assignments, setAssignments] = useState<any[]>([]);
    const [activeQuals, setActiveQuals] = useState<Record<number, string[]>>({});
    const [holidays, setHolidays] = useState<string[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [year, setYear] = useState<number>(new Date().getFullYear());

    const { currentUser, isDevMode } = useAuth();
    const isAppAdmin = isDevMode || currentUser?.roleName?.toLowerCase() === 'administrator';
    const itwPerm = isAppAdmin ? 'write_all' : (currentUser?.permissions?.itw || 'none');
    const canWriteAll = itwPerm === 'write_all';
    const canWriteOwn = itwPerm === 'write';

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

    const userDept = useMemo(() => {
        if (currentUser?.assignedDepartment && currentUser.assignedDepartment !== 'all') {
            return currentUser.assignedDepartment;
        }
        const ownPerson = personnel.find(p => isOwnUser(p));
        return ownPerson?.department || (currentUser?.assignedDepartment === 'all' ? '1. Abteilung' : '1. Abteilung');
    }, [currentUser, personnel]);

    const sortedItwSeqs = useMemo(() => {
        return [...itwSeqs].sort((a, b) => a.startDate.localeCompare(b.startDate));
    }, [itwSeqs]);

    const minYear = useMemo(() => {
        if (sortedItwSeqs.length === 0) return 1970;
        return parseInt(sortedItwSeqs[0].startDate.slice(0, 4), 10);
    }, [sortedItwSeqs]);

    const loadData = async () => {
        setLoading(true);
        try {
            const seqs = await (window as any).api.getItwPatterns?.() || [];
            setItwSeqs(seqs);

            const persInfo = await (window as any).api.getPersonnel?.(false, 'all') || [];
            setPersonnel(persInfo);

            const assigns = await (window as any).api.getItwPhaseAssignments?.() || [];
            setAssignments(assigns);

            const holis = await (window as any).api.getHolidaysForYear?.(year) || [];
            setHolidays(holis.map((h: any) => h.date));

            const now = new Date();
            const yearMonth = now.toISOString().slice(0, 7);
            const qualMap: Record<number, string[]> = {};
            for (const p of persInfo) {
                const quals: QualPeriod[] = await (window as any).api.getActiveQualifications?.(p.id, yearMonth) || [];
                qualMap[p.id] = quals.map(q => q.qualType);
            }
            setActiveQuals(qualMap);

        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [year]);

    useEffect(() => {
        const handleItwPatternsUpdated = () => {
            console.log('[ItwVorplanungTab] ITW patterns updated, reloading data');
            loadData();
        };
        window.addEventListener('itw-patterns-updated', handleItwPatternsUpdated);
        (window as any).api?.onItwUpdated?.(handleItwPatternsUpdated);
        (window as any).api?.onSettingsUpdated?.(handleItwPatternsUpdated);
        return () => {
            window.removeEventListener('itw-patterns-updated', handleItwPatternsUpdated);
            (window as any).api?.offItwUpdated?.(handleItwPatternsUpdated);
            (window as any).api?.offSettingsUpdated?.(handleItwPatternsUpdated);
        };
    }, []);

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

    // Generate all phases for the selected year, taking into account sequence transitions
    const displayedPhases = useMemo(() => {
        if (!year || !sortedItwSeqs || sortedItwSeqs.length === 0 || year < minYear) return [];

        const uniqueSeqs = Array.from(
            new Map(sortedItwSeqs.map(s => [s.startDate, s])).values()
        ).sort((a, b) => a.startDate.localeCompare(b.startDate));

        const dayMs = 24 * 60 * 60 * 1000;
        const phaseDays = 21;
        const phaseLengthMs = phaseDays * dayMs;
        const phaseDurationMs = (phaseDays - 1) * dayMs;

        const yearStartTime = new Date(`${year}-01-01T00:00:00Z`).getTime();
        const yearEndTime = new Date(`${year}-12-31T23:59:59Z`).getTime();

        let currentSeqIdx = 0;
        let phaseStartTime = new Date(uniqueSeqs[0].startDate + 'T00:00:00Z').getTime();

        const phases = [];
        let steps = 0;

        while (steps < 2000) {
            steps++;
            const phaseEndTime = phaseStartTime + phaseDurationMs;

            if (phaseEndTime >= yearStartTime && phaseStartTime <= yearEndTime) {
                const dStart = new Date(phaseStartTime);
                const dEnd = new Date(phaseEndTime);

                const phaseStartStr = dStart.toISOString().slice(0, 10);
                const phaseEndStr = dEnd.toISOString().slice(0, 10);
                const labelStr = `${phaseStartStr.slice(8, 10)}.${phaseStartStr.slice(5, 7)}.${phaseStartStr.slice(0, 4)} - ${phaseEndStr.slice(8, 10)}.${phaseEndStr.slice(5, 7)}.${phaseEndStr.slice(0, 4)}`;

                phases.push({
                    start: phaseStartStr,
                    end: phaseEndStr,
                    label: labelStr,
                    title: `Phase ${phases.length + 1}`
                });
            }

            if (phaseStartTime > yearEndTime && currentSeqIdx >= uniqueSeqs.length - 1) {
                break;
            }

            // Check if there is a newer sequence that takes effect
            if (currentSeqIdx + 1 < uniqueSeqs.length) {
                const nextSeqStartMs = new Date(uniqueSeqs[currentSeqIdx + 1].startDate + 'T00:00:00Z').getTime();
                if (nextSeqStartMs <= phaseStartTime + phaseLengthMs) {
                    currentSeqIdx++;
                    phaseStartTime = nextSeqStartMs;
                    continue;
                }
            }

            phaseStartTime += phaseLengthMs;
        }

        return phases;
    }, [sortedItwSeqs, year, minYear]);

    const calculatePhaseItwDays = (phaseStartStr: string, phaseEndStr: string, department?: string) => {
        if (!sortedItwSeqs || sortedItwSeqs.length === 0) {
            return [];
        }

        const phaseStart = new Date(phaseStartStr + 'T00:00:00Z').getTime();
        const phaseEnd = new Date(phaseEndStr + 'T23:59:59Z').getTime();
        const dayMs = 24 * 60 * 60 * 1000;
        const targetDeptCode = department ? normalizeDeptCode(department) : '';

        const itwDays: string[] = [];
        let currentTime = phaseStart;

        while (currentTime <= phaseEnd) {
            const dateStr = new Date(currentTime).toISOString().slice(0, 10);

            // Skip if holiday
            if (holidays.includes(dateStr)) {
                currentTime += dayMs;
                continue;
            }

            const activeSeq = getActiveItwSequence(dateStr);
            if (!activeSeq) {
                currentTime += dayMs;
                continue;
            }

            const patternSlots = parseItwPatternString(activeSeq.pattern);
            const baseTime = new Date(activeSeq.startDate + 'T00:00:00Z').getTime();
            const diffMs = currentTime - baseTime;
            const diffDays = Math.round(diffMs / dayMs);

            if (diffDays >= 0 && patternSlots.length > 0) {
                const patternIndex = ((diffDays % patternSlots.length) + patternSlots.length) % patternSlots.length;
                const slot = patternSlots[patternIndex];

                if (!targetDeptCode) {
                    if (slot.fzf || slot.maschinist) {
                        itwDays.push(dateStr);
                    }
                } else {
                    if (slot.fzf === targetDeptCode || slot.maschinist === targetDeptCode) {
                        itwDays.push(dateStr);
                    }
                }
            }

            currentTime += dayMs;
        }

        return itwDays;
    };

    const getPhaseDepartmentDuties = (phaseStartStr: string, phaseEndStr: string, deptCode: string) => {
        const phaseStart = new Date(phaseStartStr + 'T00:00:00Z').getTime();
        const phaseEnd = new Date(phaseEndStr + 'T23:59:59Z').getTime();
        const dayMs = 24 * 60 * 60 * 1000;

        let fzfDays = 0;
        let maDays = 0;
        let currentTime = phaseStart;

        while (currentTime <= phaseEnd) {
            const dateStr = new Date(currentTime).toISOString().slice(0, 10);
            if (!holidays.includes(dateStr)) {
                const activeSeq = getActiveItwSequence(dateStr);
                if (activeSeq) {
                    const patternSlots = parseItwPatternString(activeSeq.pattern);
                    const baseTime = new Date(activeSeq.startDate + 'T00:00:00Z').getTime();
                    const diffMs = currentTime - baseTime;
                    const diffDays = Math.round(diffMs / dayMs);
                    if (diffDays >= 0 && patternSlots.length > 0) {
                        const patternIndex = ((diffDays % patternSlots.length) + patternSlots.length) % patternSlots.length;
                        const slot = patternSlots[patternIndex];
                        if (slot.fzf === deptCode) fzfDays++;
                        if (slot.maschinist === deptCode) maDays++;
                    }
                }
            }
            currentTime += dayMs;
        }

        return { fzfDays, maDays, total: fzfDays + maDays };
    };

    const transferSchichtToRoster = async (personId: number, phaseStartStr: string, phaseEndStr: string) => {
        const person = personnel.find(p => Number(p.id) === Number(personId));
        const personDept = person?.department || '1. Abteilung';
        const itwDays = calculatePhaseItwDays(phaseStartStr, phaseEndStr, personDept);
        
        if (itwDays.length === 0) {
            console.warn('[ITW] Keine IW-Tage gefunden für Phase', { phaseStartStr, phaseEndStr, personDept });
            return;
        }
        
        for (const dateStr of itwDays) {
            try {
                await (window as any).api.setItwDutyRosterEntry?.({
                    personId,
                    personType: 'person',
                    date: dateStr,
                    value: '1',
                    type: 'IW',
                    manual_edit: 0
                });
            } catch (e: any) {
                console.error(`[ITW] Fehler beim Übertrag der Schicht für ${dateStr}:`, e);
            }
        }
    };

    const removeSchichtFromRoster = async (personId: number, phaseStartStr: string, phaseEndStr: string) => {
        const person = personnel.find(p => Number(p.id) === Number(personId));
        const personDept = person?.department || '1. Abteilung';
        const itwDays = calculatePhaseItwDays(phaseStartStr, phaseEndStr, personDept);
        
        for (const dateStr of itwDays) {
            try {
                await (window as any).api.setItwDutyRosterEntry?.({
                    personId,
                    personType: 'person',
                    date: dateStr,
                    value: '',
                    type: '',
                    manual_edit: 0
                });
            } catch (e: any) {
                console.error(`[ITW] Fehler beim Löschen der Schicht für ${dateStr}:`, e);
            }
        }
    };

    const getAssignmentForPhase = (phaseStart: string, department: string) => {
        const pStart = new Date(phaseStart + 'T00:00:00Z').getTime();
        const deptNorm = normalizeDepartmentName(department);
        return assignments.find(a => {
            const aRole = String(a.role || '');
            const matchRole = normalizeDepartmentName(aRole) === deptNorm ||
                (deptNorm === '1. Abteilung' && aRole === 'Fahrzeugführer 1') ||
                (deptNorm === '2. Abteilung' && aRole === 'Fahrzeugführer 2') ||
                (deptNorm === '3. Abteilung' && aRole === 'Maschinist');
            if (!matchRole) return false;
            const aStart = new Date(a.start_date + 'T00:00:00Z').getTime();
            const aEnd = aStart + (21 * 24 * 3600 * 1000);
            return pStart >= aStart && pStart < aEnd;
        });
    };

    const handleAssign = async (phaseStart: string, phaseEnd: string, department: string, value: string) => {
        const pId = value ? parseInt(value, 10) : null;
        
        const oldEntry = getAssignmentForPhase(phaseStart, department);
        if (oldEntry && oldEntry.person_id) {
             await removeSchichtFromRoster(oldEntry.person_id, oldEntry.start_date, phaseEnd);
             await (window as any).api.removeItwPhaseAssignment?.(oldEntry.start_date, oldEntry.person_id);
        }

        if (pId) {
            const deptCode = normalizeDeptCode(department);
            const duties = getPhaseDepartmentDuties(phaseStart, phaseEnd, deptCode);

            const quals = activeQuals[pId] || [];
            const isFzf = quals.includes('ITW Fahrzeugführer') || quals.includes('Fahrzeugführer') || quals.includes('Fahrzeugführer HLF-B');
            const isMasch = quals.includes('ITW Maschinist');

            if (duties.fzfDays > 0 && !isFzf) {
                alert('Mitarbeiter hat keine Fahrzeugführer Qualifikation!');
                return;
            }
            if (duties.maDays > 0 && !isMasch) {
                alert('Mitarbeiter hat keine Maschinist Qualifikation!');
                return;
            }

            try {
                await (window as any).api.addItwPhaseAssignment?.(
                    phaseStart, 
                    pId, 
                    department
                );
                await transferSchichtToRoster(pId, phaseStart, phaseEnd);
            } catch (e: any) {
                console.error('[ITW] Fehler:', e);
                alert('Fehler beim Speichern: ' + e.message);
            }
        }

        const assigns = await (window as any).api.getItwPhaseAssignments?.() || [];
        setAssignments(assigns);
    };

    if (loading) return <div style={{ padding: 20 }}>Lade Daten...</div>;

    if (itwSeqs.length === 0) {
        return (
            <div style={{ padding: 20 }}>
                Bitte konfigurieren Sie zuerst den Start des 3-Wochen ITW Loops in den Einstellungen.
            </div>
        );
    }

    const getDepartmentColor = (dept: string) => {
        const norm = normalizeDepartmentName(dept);
        if (norm.startsWith('1')) {
            return {
                badgeBg: '#fef2f2',
                badgeColor: '#b91c1c',
                badgeBorder: '#fecaca',
                containerBg: '#fffbfb',
                containerBorder: '#fee2e2',
                accent: '#ef4444'
            };
        }
        if (norm.startsWith('2')) {
            return {
                badgeBg: '#eff6ff',
                badgeColor: '#1d4ed8',
                badgeBorder: '#bfdbfe',
                containerBg: '#f8faff',
                containerBorder: '#dbeafe',
                accent: '#2563eb'
            };
        }
        if (norm.startsWith('3')) {
            return {
                badgeBg: '#f0fdf4',
                badgeColor: '#15803d',
                badgeBorder: '#bbf7d0',
                containerBg: '#f8fdf9',
                containerBorder: '#dcfce7',
                accent: '#16a34a'
            };
        }
        return {
            badgeBg: '#f3f4f6',
            badgeColor: '#4b5563',
            badgeBorder: '#e5e7eb',
            containerBg: '#fafafa',
            containerBorder: '#e5e7eb',
            accent: '#6b7280'
        };
    };

    return (
        <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '18px', margin: 0, color: '#333' }}>ITW Phasen Vorplanung</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <label style={{ fontWeight: 'bold' }}>Jahr:</label>
                    <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #ccc', borderRadius: '4px', overflow: 'hidden' }}>
                        <button 
                            onClick={() => setYear(prev => Math.max(minYear, prev - 1))}
                            disabled={year <= minYear}
                            style={{ padding: '6px 12px', background: '#f8f9fa', border: 'none', borderRight: '1px solid #ccc', cursor: year <= minYear ? 'default' : 'pointer' }}
                        >
                            &lt;
                        </button>
                        <div style={{ padding: '6px 20px', minWidth: '60px', textAlign: 'center', fontWeight: 'bold', background: '#fff' }}>
                            {year}
                        </div>
                        <button 
                            onClick={() => setYear(prev => prev + 1)}
                            style={{ padding: '6px 12px', background: '#f8f9fa', border: 'none', borderLeft: '1px solid #ccc', cursor: 'pointer' }}
                        >
                            &gt;
                        </button>
                    </div>
                </div>
            </div>
            
            {year < minYear && (
                <div style={{ padding: '20px', background: '#fff5f5', color: '#c53030', borderRadius: '8px', border: '1px solid #feb2b2', marginBottom: '20px', textAlign: 'center' }}>
                    Für das Jahr {year} ist noch kein ITW-Loop in den Einstellungen hinterlegt (erster Loop startet erst {minYear}).
                </div>
            )}
            
            {sortedItwSeqs.length > 0 && displayedPhases.length === 0 && year >= minYear && (
                <div style={{ padding: '20px', background: '#fff9f0', color: '#975a16', borderRadius: '8px', border: '1px solid #fbd38d', marginBottom: '20px', textAlign: 'center' }}>
                    Für das Jahr {year} konnten keine Phasen generiert werden. Bitte überprüfen Sie die Loop-Einstellungen.
                </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', paddingBottom: 20 }}>
                {displayedPhases.map((phase) => {
                    return (
                        <div key={phase.start} style={{ 
                            flex: '1',
                            minWidth: '320px', 
                            border: '1px solid #ddd', 
                            borderRadius: '8px',
                            background: '#fff',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                            display: 'flex',
                            flexDirection: 'column'
                        }}>
                            <div style={{ 
                                padding: '12px 16px', 
                                borderBottom: '1px solid #ddd', 
                                background: '#f8f9fa',
                                borderRadius: '8px 8px 0 0',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <div>
                                    <div style={{ fontWeight: 'bold', fontSize: '15px' }}>{phase.title}</div>
                                    <div style={{ fontSize: '13px', color: '#666', marginTop: '2px' }}>{phase.label}</div>
                                </div>
                            </div>
                            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
                                {DEPARTMENTS.map((dept) => {
                                    const deptCode = normalizeDeptCode(dept);
                                    const duties = getPhaseDepartmentDuties(phase.start, phase.end, deptCode);

                                    const currentAssgn = getAssignmentForPhase(phase.start, dept);
                                    const currentId = currentAssgn ? currentAssgn.person_id : '';
                                    const isOccupied = Boolean(currentId);
                                    const isAssignedToSelf = Boolean(
                                        currentId && personnel.some(p => Number(p.id) === Number(currentId) && isOwnUser(p))
                                    );

                                    const isUserInTargetDept = normalizeDepartmentName(userDept) === normalizeDepartmentName(dept);

                                    let selectDisabled = false;
                                    let disabledReason = '';
                                    if (duties.total === 0) {
                                        selectDisabled = true;
                                        disabledReason = 'Keine Dienste in dieser Phase';
                                    } else if (canWriteAll) {
                                        selectDisabled = false;
                                    } else if (canWriteOwn) {
                                        if (!isUserInTargetDept) {
                                            selectDisabled = !isAssignedToSelf;
                                            if (selectDisabled) disabledReason = `Nur für ${dept}`;
                                        } else {
                                            selectDisabled = isOccupied && !isAssignedToSelf;
                                            if (selectDisabled) disabledReason = 'Bereits belegt';
                                        }
                                    } else {
                                        selectDisabled = true;
                                        disabledReason = 'Keine Schreibrechte';
                                    }

                                    // Filter personnel for dropdown
                                    const availablePersonnel = canWriteAll
                                        ? personnel
                                        : (canWriteOwn
                                            ? personnel.filter(p => (isOwnUser(p) && isUserInTargetDept) || Number(p.id) === Number(currentId))
                                            : personnel.filter(p => Number(p.id) === Number(currentId)));

                                    const colors = getDepartmentColor(dept);

                                    const dutyText = duties.total === 0 
                                        ? 'Keine Dienste'
                                        : [
                                            duties.fzfDays > 0 ? `${duties.fzfDays}× FzF` : null,
                                            duties.maDays > 0 ? `${duties.maDays}× Ma` : null
                                        ].filter(Boolean).join(', ');

                                    return (
                                        <div 
                                            key={dept} 
                                            style={{ 
                                                display: 'flex', 
                                                flexDirection: 'column', 
                                                gap: 6,
                                                padding: '10px 12px',
                                                borderRadius: 6,
                                                background: colors.containerBg,
                                                border: `1px solid ${colors.containerBorder}`,
                                                borderLeft: `4px solid ${colors.accent}`,
                                                opacity: duties.total === 0 ? 0.65 : 1
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <label style={{ fontSize: 13, color: '#333', fontWeight: 600 }}>{dept}</label>
                                                <span style={{
                                                    fontSize: '11px',
                                                    fontWeight: 600,
                                                    padding: '2px 8px',
                                                    borderRadius: 12,
                                                    background: colors.badgeBg,
                                                    color: colors.badgeColor,
                                                    border: `1px solid ${colors.badgeBorder}`
                                                }}>
                                                    {dutyText}
                                                </span>
                                            </div>
                                            <select
                                                value={currentId || ''}
                                                disabled={selectDisabled}
                                                onChange={e => handleAssign(phase.start, phase.end, dept, e.target.value)}
                                                title={disabledReason ? disabledReason : undefined}
                                                style={{
                                                    padding: '7px 8px',
                                                    borderRadius: 4,
                                                    border: '1px solid #ccc',
                                                    backgroundColor: selectDisabled ? '#f1f5f9' : '#fff',
                                                    cursor: selectDisabled ? 'not-allowed' : 'pointer',
                                                    fontSize: 13
                                                }}
                                            >
                                                <option value="">
                                                    {disabledReason && !isOccupied ? `- ${disabledReason} -` : '- Leer -'}
                                                </option>
                                                {availablePersonnel.map(p => {
                                                    const quals = activeQuals[p.id] || [];
                                                    const isFzf = quals.includes('ITW Fahrzeugführer') || quals.includes('Fahrzeugführer') || quals.includes('Fahrzeugführer HLF-B');
                                                    const isMasch = quals.includes('ITW Maschinist');
                                                    
                                                    let valid = true;
                                                    let missing = '';
                                                    if (duties.fzfDays > 0 && !isFzf) {
                                                        valid = false;
                                                        missing = 'FzF fehlt';
                                                    }
                                                    if (duties.maDays > 0 && !isMasch) {
                                                        valid = false;
                                                        missing = missing ? 'FzF & Ma fehlt' : 'Ma fehlt';
                                                    }

                                                    const deptLabel = p.department ? ` (${p.department})` : '';

                                                    return (
                                                        <option 
                                                            key={p.id} 
                                                            value={p.id}
                                                            disabled={!valid}
                                                            style={{ color: valid ? '#000' : '#ccc' }}
                                                        >
                                                            {p.name}, {p.vorname}{deptLabel} {!valid ? `(${missing})` : ''}
                                                        </option>
                                                    );
                                                })}
                                            </select>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );

};

export default ItwVorplanungTab;
