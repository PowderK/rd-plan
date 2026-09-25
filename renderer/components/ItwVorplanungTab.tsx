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
    const [itwRotationPhases, setItwRotationPhases] = useState<{ fzf1: string; fzf2: string; maschinist: string }[]>([
        { fzf1: '1. Abteilung', fzf2: '2. Abteilung', maschinist: '3. Abteilung' },
        { fzf1: '3. Abteilung', fzf2: '1. Abteilung', maschinist: '2. Abteilung' },
        { fzf1: '2. Abteilung', fzf2: '3. Abteilung', maschinist: '1. Abteilung' },
    ]);
    const [personnel, setPersonnel] = useState<any[]>([]);
    const [assignments, setAssignments] = useState<any[]>([]);
    const [activeQuals, setActiveQuals] = useState<Record<number, string[]>>({});
    const [holidays, setHolidays] = useState<string[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [year, setYear] = useState<number>(2027);

    useEffect(() => {
        let isMounted = true;
        (async () => {
            try {
                const settingYear = await (window as any).api.getSetting?.('itw_vorplanung_year');
                if (settingYear && !isNaN(Number(settingYear)) && isMounted) {
                    setYear(Number(settingYear));
                }
            } catch (e) {
                console.error('[ITW] Error loading itw_vorplanung_year:', e);
            }
        })();
        return () => { isMounted = false; };
    }, []);

    const { currentUser, isDevMode } = useAuth();
    const isAppAdmin = isDevMode || currentUser?.roleName?.toLowerCase() === 'administrator';
    const itwPerm = isAppAdmin 
        ? 'write_all' 
        : (currentUser?.permissions?.itw_vorplanung || currentUser?.permissions?.itw || 'none');
    const canWriteAll = itwPerm === 'write_all';
    const canWriteOwn = itwPerm === 'write';
    const canRead = canWriteAll || canWriteOwn || itwPerm === 'read';

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

            try {
                const rotVal = await (window as any).api.getSetting?.('itw_rotation_pattern');
                if (rotVal) {
                    const parsed = JSON.parse(rotVal);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        setItwRotationPhases(parsed);
                    }
                }
            } catch (e) {
                console.error(e);
            }

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

        const allPhases: { start: string; end: string; label: string; startYear: number }[] = [];

        for (let i = 0; i < uniqueSeqs.length; i++) {
            const seq = uniqueSeqs[i];
            const nextSeq = uniqueSeqs[i + 1];
            const seqStartMs = new Date(seq.startDate + 'T00:00:00Z').getTime();
            const nextSeqStartMs = nextSeq ? new Date(nextSeq.startDate + 'T00:00:00Z').getTime() : Infinity;

            let phaseStartMs = seqStartMs;
            while (phaseStartMs < nextSeqStartMs) {
                let phaseEndMs = phaseStartMs + phaseDurationMs;
                if (nextSeqStartMs < Infinity && phaseEndMs >= nextSeqStartMs) {
                    phaseEndMs = nextSeqStartMs - dayMs;
                }

                const dStart = new Date(phaseStartMs);
                const dEnd = new Date(phaseEndMs);

                const phaseStartStr = dStart.toISOString().slice(0, 10);
                const phaseEndStr = dEnd.toISOString().slice(0, 10);
                const labelStr = `${phaseStartStr.slice(8, 10)}.${phaseStartStr.slice(5, 7)}.${phaseStartStr.slice(0, 4)} - ${phaseEndStr.slice(8, 10)}.${phaseEndStr.slice(5, 7)}.${phaseEndStr.slice(0, 4)}`;

                const startYear = parseInt(phaseStartStr.slice(0, 4), 10);
                allPhases.push({
                    start: phaseStartStr,
                    end: phaseEndStr,
                    label: labelStr,
                    startYear
                });

                phaseStartMs += phaseLengthMs;
                // Safety bound to avoid infinite loop
                if (phaseStartMs > new Date('2040-01-01T00:00:00Z').getTime()) break;
            }
        }

        // Filter phases for the selected year
        const phasesInYear = allPhases.filter(p => p.startYear === year);

        return phasesInYear.map((p, idx) => ({
            ...p,
            title: `Phase ${idx + 1}`
        }));
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

    const transferSchichtToRoster = async (personId: number, phaseStartStr: string, phaseEndStr: string, department?: string) => {
        const person = personnel.find(p => Number(p.id) === Number(personId));
        const personDept = department || person?.department || '1. Abteilung';
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

    const removeSchichtFromRoster = async (personId: number, phaseStartStr: string, phaseEndStr: string, department?: string) => {
        const person = personnel.find(p => Number(p.id) === Number(personId));
        const personDept = department || person?.department || '1. Abteilung';
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

    const getAssignmentForPhase = (phaseStart: string, role: string, department?: string) => {
        const deptNorm = department ? normalizeDepartmentName(department) : '';
        return assignments.find(a => {
            if (a.start_date !== phaseStart) return false;
            const aRole = String(a.role || '');
            if (aRole === role) return true;
            // Legacy match: only when a.role was saved as the department name itself
            if (department && !['Fahrzeugführer 1', 'Fahrzeugführer 2', 'Maschinist'].includes(aRole)) {
                return normalizeDepartmentName(aRole) === deptNorm;
            }
            return false;
        });
    };

    const handleAssign = async (phaseStart: string, phaseEnd: string, role: string, department: string, value: string) => {
        const pId = value ? parseInt(value, 10) : null;
        
        const oldEntry = getAssignmentForPhase(phaseStart, role, department);
        if (oldEntry && oldEntry.person_id) {
             await removeSchichtFromRoster(oldEntry.person_id, oldEntry.start_date, phaseEnd, department);
             await (window as any).api.removeItwPhaseAssignment?.(oldEntry.start_date, oldEntry.person_id);
        }

        if (pId) {
            const quals = activeQuals[pId] || [];
            const isFzf = quals.includes('ITW Fahrzeugführer') || quals.includes('Fahrzeugführer') || quals.includes('Fahrzeugführer HLF-B');
            const isMasch = quals.includes('ITW Maschinist');

            if (role.startsWith('Fahrzeugführer') && !isFzf) {
                alert('Mitarbeiter hat keine Fahrzeugführer Qualifikation!');
                return;
            }
            if (role === 'Maschinist' && !isMasch) {
                alert('Mitarbeiter hat keine Maschinist Qualifikation!');
                return;
            }

            try {
                await (window as any).api.addItwPhaseAssignment?.(
                    phaseStart, 
                    pId, 
                    role
                );
                await transferSchichtToRoster(pId, phaseStart, phaseEnd, department);
            } catch (e: any) {
                console.error('[ITW] Fehler:', e);
                alert('Fehler beim Speichern: ' + e.message);
            }
        }

        const assigns = await (window as any).api.getItwPhaseAssignments?.() || [];
        setAssignments(assigns);
    };

    if (loading) return <div style={{ padding: 20 }}>Lade Daten...</div>;

    if (!canRead) {
        return (
            <div style={{ padding: 20, color: '#c53030' }}>
                Sie haben keine Berechtigung für die ITW Vorplanung.
            </div>
        );
    }

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
                {displayedPhases.map((phase, phaseIdx) => {
                    const rotCount = itwRotationPhases.length || 3;
                    const rotIdx = phaseIdx % rotCount;
                    const rotConfig = itwRotationPhases[rotIdx] || { fzf1: '1. Abteilung', fzf2: '2. Abteilung', maschinist: '3. Abteilung' };

                    const phaseRoles = [
                        { role: 'Fahrzeugführer 1', department: rotConfig.fzf1 },
                        { role: 'Fahrzeugführer 2', department: rotConfig.fzf2 },
                        { role: 'Maschinist', department: rotConfig.maschinist }
                    ];

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
                                {phaseRoles.map(({ role, department }) => {
                                    const currentAssgn = getAssignmentForPhase(phase.start, role, department);
                                    const currentId = currentAssgn ? currentAssgn.person_id : '';
                                    const isOccupied = Boolean(currentId);
                                    const isAssignedToSelf = Boolean(
                                        currentId && personnel.some(p => Number(p.id) === Number(currentId) && isOwnUser(p))
                                    );

                                    const isUserInTargetDept = normalizeDepartmentName(userDept) === normalizeDepartmentName(department);

                                    const ownPerson = personnel.find(p => isOwnUser(p));
                                    const ownQuals = ownPerson ? (activeQuals[ownPerson.id] || []) : [];
                                    const isOwnFzf = ownQuals.includes('ITW Fahrzeugführer') || ownQuals.includes('Fahrzeugführer') || ownQuals.includes('Fahrzeugführer HLF-B');
                                    const isOwnMasch = ownQuals.includes('ITW Maschinist');
                                    const hasRequiredQual = role.startsWith('Fahrzeugführer') ? isOwnFzf : (role === 'Maschinist' ? isOwnMasch : true);

                                    let selectDisabled = false;
                                    let disabledReason = '';
                                    if (canWriteAll) {
                                        selectDisabled = false;
                                    } else if (canWriteOwn) {
                                        if (!isUserInTargetDept) {
                                            selectDisabled = !isAssignedToSelf;
                                            if (selectDisabled) disabledReason = `Nur für ${department}`;
                                        } else if (!hasRequiredQual && !isAssignedToSelf) {
                                            selectDisabled = true;
                                            disabledReason = 'Qualifikation fehlt';
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

                                    const colors = getDepartmentColor(department);

                                    return (
                                        <div 
                                            key={role} 
                                            style={{ 
                                                display: 'flex', 
                                                flexDirection: 'column', 
                                                gap: 6,
                                                padding: '10px 12px',
                                                borderRadius: 6,
                                                background: colors.containerBg,
                                                border: `1px solid ${colors.containerBorder}`,
                                                borderLeft: `4px solid ${colors.accent}`
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <label style={{ fontSize: 13, color: '#333', fontWeight: 600 }}>{role}</label>
                                                <span style={{
                                                    fontSize: '11px',
                                                    fontWeight: 600,
                                                    padding: '2px 8px',
                                                    borderRadius: 12,
                                                    background: colors.badgeBg,
                                                    color: colors.badgeColor,
                                                    border: `1px solid ${colors.badgeBorder}`
                                                }}>
                                                    {department}
                                                </span>
                                            </div>
                                            <select
                                                value={currentId || ''}
                                                disabled={selectDisabled}
                                                onChange={e => handleAssign(phase.start, phase.end, role, department, e.target.value)}
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
                                                    if (role.startsWith('Fahrzeugführer') && !isFzf) {
                                                        valid = false;
                                                        missing = 'FzF fehlt';
                                                    }
                                                    if (role === 'Maschinist' && !isMasch) {
                                                        valid = false;
                                                        missing = 'Ma fehlt';
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
