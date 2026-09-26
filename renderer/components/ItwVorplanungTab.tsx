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

    const [showGapsModal, setShowGapsModal] = useState<boolean>(false);
    const [gapsDeptFilter, setGapsDeptFilter] = useState<string>('all');
    const [gapsRoleFilter, setGapsRoleFilter] = useState<string>('all');
    const [exportingPdf, setExportingPdf] = useState<boolean>(false);

    // Compute all gaps across displayedPhases
    interface ItwGap {
        phaseIdx: number;
        phaseTitle: string;
        phaseLabel: string;
        start: string;
        end: string;
        role: string;
        department: string;
    }

    const allGaps = useMemo<ItwGap[]>(() => {
        if (!displayedPhases || displayedPhases.length === 0) return [];
        const gapsList: ItwGap[] = [];
        const rotCount = itwRotationPhases.length || 3;

        displayedPhases.forEach((phase, phaseIdx) => {
            const rotIdx = phaseIdx % rotCount;
            const rotConfig = itwRotationPhases[rotIdx] || { fzf1: '1. Abteilung', fzf2: '2. Abteilung', maschinist: '3. Abteilung' };
            const phaseRoles = [
                { role: 'Fahrzeugführer 1', department: rotConfig.fzf1 },
                { role: 'Fahrzeugführer 2', department: rotConfig.fzf2 },
                { role: 'Maschinist', department: rotConfig.maschinist }
            ];

            phaseRoles.forEach(({ role, department }) => {
                const currentAssgn = getAssignmentForPhase(phase.start, role, department);
                const currentId = currentAssgn ? currentAssgn.person_id : null;
                if (!currentId) {
                    gapsList.push({
                        phaseIdx,
                        phaseTitle: phase.title,
                        phaseLabel: phase.label,
                        start: phase.start,
                        end: phase.end,
                        role,
                        department
                    });
                }
            });
        });

        return gapsList;
    }, [displayedPhases, itwRotationPhases, assignments]);

    const totalSlots = displayedPhases.length * 3;
    const occupiedSlots = totalSlots - allGaps.length;
    const occupancyPercent = totalSlots > 0 ? Math.round((occupiedSlots / totalSlots) * 100) : 0;

    const filteredGaps = useMemo(() => {
        return allGaps.filter(gap => {
            if (gapsDeptFilter !== 'all' && normalizeDepartmentName(gap.department) !== normalizeDepartmentName(gapsDeptFilter)) {
                return false;
            }
            if (gapsRoleFilter !== 'all' && gap.role !== gapsRoleFilter) {
                return false;
            }
            return true;
        });
    }, [allGaps, gapsDeptFilter, gapsRoleFilter]);

    const scrollToPhase = (phaseStart: string) => {
        setShowGapsModal(false);
        setTimeout(() => {
            const el = document.getElementById(`phase-card-${phaseStart}`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.style.transition = 'all 0.3s ease';
                el.style.boxShadow = '0 0 0 3px #0284c7, 0 10px 15px -3px rgba(0,0,0,0.1)';
                setTimeout(() => {
                    el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
                }, 2000);
            }
        }, 100);
    };

    const handleExportPdf = async () => {
        if (exportingPdf) return;
        setExportingPdf(true);
        try {
            const rotCount = itwRotationPhases.length || 3;
            const todayStr = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
            
            const rowsHtml = displayedPhases.map((phase, phaseIdx) => {
                const rotIdx = phaseIdx % rotCount;
                const rotConfig = itwRotationPhases[rotIdx] || { fzf1: '1. Abteilung', fzf2: '2. Abteilung', maschinist: '3. Abteilung' };
                const phaseRoles = [
                    { role: 'Fahrzeugführer 1', department: rotConfig.fzf1 },
                    { role: 'Fahrzeugführer 2', department: rotConfig.fzf2 },
                    { role: 'Maschinist', department: rotConfig.maschinist }
                ];

                const roleCells = phaseRoles.map(({ role, department }) => {
                    const currentAssgn = getAssignmentForPhase(phase.start, role, department);
                    const currentId = currentAssgn ? currentAssgn.person_id : null;
                    const person = currentId ? personnel.find(p => Number(p.id) === Number(currentId)) : null;
                    const deptColor = getDepartmentColor(department);
                    const deptShort = department.replace('. Abteilung', '. Abt');

                    if (person) {
                        return `
                            <td style="padding: 3px 6px; vertical-align: middle; border-right: 1px solid #e2e8f0; font-size: 10px;">
                                <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px;">
                                    <span style="font-weight: 600; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${person.name}, ${person.vorname}</span>
                                    <span style="display: inline-block; font-size: 8px; padding: 1px 4px; border-radius: 3px; background: ${deptColor.badgeBg}; color: ${deptColor.badgeColor}; border: 1px solid ${deptColor.badgeBorder}; font-weight: 600; white-space: nowrap;">${deptShort}</span>
                                </div>
                            </td>
                        `;
                    } else {
                        return `
                            <td style="padding: 3px 6px; vertical-align: middle; border-right: 1px solid #e2e8f0; font-size: 10px;">
                                <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px;">
                                    <span style="color: #94a3b8; font-style: italic; white-space: nowrap;">- Nicht besetzt -</span>
                                    <span style="display: inline-block; font-size: 8px; padding: 1px 4px; border-radius: 3px; background: ${deptColor.badgeBg}; color: ${deptColor.badgeColor}; border: 1px solid ${deptColor.badgeBorder}; font-weight: 600; white-space: nowrap;">${deptShort}</span>
                                </div>
                            </td>
                        `;
                    }
                }).join('');

                const phaseGapsCount = phaseRoles.filter(({ role, department }) => {
                    const currentAssgn = getAssignmentForPhase(phase.start, role, department);
                    return !currentAssgn?.person_id;
                }).length;

                const statusBadge = phaseGapsCount === 0
                    ? `<span style="display: inline-block; padding: 1px 6px; background: #f0fdf4; color: #166534; border: 1px solid #dcfce7; border-radius: 10px; font-size: 9px; font-weight: 600; white-space: nowrap;">Vollständig</span>`
                    : `<span style="display: inline-block; padding: 1px 6px; background: #f8fafc; color: #64748b; border: 1px solid #e2e8f0; border-radius: 10px; font-size: 9px; font-weight: 600; white-space: nowrap;">${phaseGapsCount} offen</span>`;

                const isEven = phaseIdx % 2 === 1;
                const rowBg = isEven ? '#f8fafc' : '#ffffff';

                return `
                    <tr style="border-bottom: 1px solid #e2e8f0; background: ${rowBg}; page-break-inside: avoid; height: 22px;">
                        <td style="padding: 3px 6px; vertical-align: middle; border-right: 1px solid #e2e8f0; white-space: nowrap; width: 140px;">
                            <span style="font-weight: 700; font-size: 10px; color: #0f172a;">${phase.title}</span>
                            <span style="font-size: 9px; color: #64748b; margin-left: 4px;">(${phase.label})</span>
                        </td>
                        ${roleCells}
                        <td style="padding: 3px 6px; vertical-align: middle; text-align: center; width: 85px;">
                            ${statusBadge}
                        </td>
                    </tr>
                `;
            }).join('');

            // Dept breakdown stats (compact banner)
            const deptStatsHtml = DEPARTMENTS.map(dept => {
                const colors = getDepartmentColor(dept);
                let reqCount = 0;
                let occCount = 0;
                displayedPhases.forEach((phase, phaseIdx) => {
                    const rotIdx = phaseIdx % rotCount;
                    const rotConfig = itwRotationPhases[rotIdx] || { fzf1: '1. Abteilung', fzf2: '2. Abteilung', maschinist: '3. Abteilung' };
                    const phaseRoles = [
                        { role: 'Fahrzeugführer 1', department: rotConfig.fzf1 },
                        { role: 'Fahrzeugführer 2', department: rotConfig.fzf2 },
                        { role: 'Maschinist', department: rotConfig.maschinist }
                    ];
                    phaseRoles.forEach(({ role, department }) => {
                        if (normalizeDepartmentName(department) === normalizeDepartmentName(dept)) {
                            reqCount++;
                            const a = getAssignmentForPhase(phase.start, role, department);
                            if (a?.person_id) occCount++;
                        }
                    });
                });
                const openCount = reqCount - occCount;
                return `
                    <div style="flex: 1; padding: 4px 10px; background: ${colors.containerBg}; border: 1px solid ${colors.containerBorder}; border-left: 3px solid ${colors.accent}; border-radius: 4px; display: flex; align-items: center; justify-content: space-between;">
                        <span style="font-size: 10px; font-weight: bold; color: ${colors.badgeColor};">${dept}</span>
                        <span style="font-size: 10px; font-weight: 600; color: #1f2937;">${occCount} / ${reqCount} besetzt</span>
                        <span style="font-size: 9px; color: ${openCount > 0 ? '#64748b' : '#15803d'}; font-weight: 500;">${openCount === 0 ? 'Vollständig' : `${openCount} offen`}</span>
                    </div>
                `;
            }).join('');

            const html = `
                <div style="padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; height: 100%; box-sizing: border-box;">
                    <!-- Compact Header -->
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0284c7; padding-bottom: 4px; margin-bottom: 6px;">
                        <div style="display: flex; align-items: baseline; gap: 10px;">
                            <h1 style="font-size: 15px; font-weight: 800; color: #0f172a; margin: 0;">RD-Plan &bull; ITW Phasen Vorplanung</h1>
                            <span style="font-size: 12px; color: #0284c7; font-weight: 700;">Planungsjahr ${year}</span>
                        </div>
                        <div style="font-size: 9.5px; color: #475569; display: flex; gap: 12px; align-items: center;">
                            <span>Stand: ${todayStr}</span>
                            <span><strong>${displayedPhases.length} Phasen</strong> (${totalSlots} Slots)</span>
                            <span style="font-weight: 600;">${occupiedSlots} / ${totalSlots} besetzt (${occupancyPercent}%) &bull; ${allGaps.length} offen</span>
                        </div>
                    </div>

                    <!-- Department Stats Banner -->
                    <div style="display: flex; gap: 8px; margin-bottom: 6px;">
                        ${deptStatsHtml}
                    </div>

                    <!-- 1-Page Compact Table -->
                    <table style="width: 100%; border-collapse: collapse; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 4px; overflow: hidden; table-layout: fixed;">
                        <thead>
                            <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1; text-align: left; font-size: 10px; color: #334155; height: 22px;">
                                <th style="padding: 3px 6px; width: 140px; border-right: 1px solid #cbd5e1;">Phase & Zeitraum</th>
                                <th style="padding: 3px 6px; border-right: 1px solid #cbd5e1;">Fahrzeugführer 1</th>
                                <th style="padding: 3px 6px; border-right: 1px solid #cbd5e1;">Fahrzeugführer 2</th>
                                <th style="padding: 3px 6px; border-right: 1px solid #cbd5e1;">Maschinist</th>
                                <th style="padding: 3px 6px; text-align: center; width: 85px;">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                        </tbody>
                    </table>

                    <!-- Minimal Footer -->
                    <div style="margin-top: 4px; text-align: center; font-size: 8.5px; color: #94a3b8;">
                        RD-Plan ITW-Vorplanung &bull; Jahr ${year} &bull; Seite 1 von 1
                    </div>
                </div>
            `;

            const res = await (window as any).api?.exportHtmlToPdf?.({
                html,
                title: `ITW Vorplanung ${year}`,
                defaultFileName: `ITW_Vorplanung_${year}.pdf`,
                landscape: true
            });

            if (res?.success) {
                alert(`PDF erfolgreich exportiert:\n${res.filePath}`);
            } else if (!res?.canceled && res?.error) {
                alert(`Fehler beim PDF-Export: ${res.error}`);
            }
        } catch (e: any) {
            console.error('PDF Export Error:', e);
            alert(`Fehler beim PDF Export: ${e.message}`);
        } finally {
            setExportingPdf(false);
        }
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
            {/* Header Toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                    <h2 style={{ fontSize: '18px', margin: 0, color: '#333' }}>ITW Phasen Vorplanung</h2>
                    
                    {/* Jahr Auswahl */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontWeight: 'bold', fontSize: 13 }}>Jahr:</label>
                        <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #ccc', borderRadius: '4px', overflow: 'hidden' }}>
                            <button 
                                onClick={() => setYear(prev => Math.max(minYear, prev - 1))}
                                disabled={year <= minYear}
                                style={{ padding: '5px 10px', background: '#f8f9fa', border: 'none', borderRight: '1px solid #ccc', cursor: year <= minYear ? 'default' : 'pointer' }}
                            >
                                &lt;
                            </button>
                            <div style={{ padding: '5px 16px', minWidth: '55px', textAlign: 'center', fontWeight: 'bold', background: '#fff', fontSize: 13 }}>
                                {year}
                            </div>
                            <button 
                                onClick={() => setYear(prev => prev + 1)}
                                style={{ padding: '5px 10px', background: '#f8f9fa', border: 'none', borderLeft: '1px solid #ccc', cursor: 'pointer' }}
                            >
                                &gt;
                            </button>
                        </div>
                    </div>

                    {/* Status Badge */}
                    {displayedPhases.length > 0 && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '4px 12px',
                            borderRadius: '16px',
                            background: allGaps.length === 0 ? '#f0fdf4' : '#f8fafc',
                            border: `1px solid ${allGaps.length === 0 ? '#dcfce7' : '#e2e8f0'}`,
                            fontSize: '12px',
                            fontWeight: 500,
                            color: allGaps.length === 0 ? '#166534' : '#475569'
                        }}>
                            <span>{occupiedSlots} / {totalSlots} besetzt ({occupancyPercent}%)</span>
                            {allGaps.length > 0 && (
                                <span style={{ background: '#f1f5f9', color: '#334155', padding: '1px 7px', borderRadius: '10px', fontSize: '11px', fontWeight: 600 }}>
                                    {allGaps.length} offen
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {/* Actions: Lücken-Übersicht & PDF Export */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <button
                        onClick={() => setShowGapsModal(true)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 14px',
                            borderRadius: '6px',
                            background: '#ffffff',
                            border: '1px solid #d1d5db',
                            color: '#374151',
                            fontWeight: 500,
                            fontSize: '13px',
                            cursor: 'pointer',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                            transition: 'all 0.15s'
                        }}
                    >
                        <span>Lücken-Übersicht</span>
                        <span style={{
                            padding: '1px 7px',
                            borderRadius: '10px',
                            background: allGaps.length > 0 ? '#f1f5f9' : '#f0fdf4',
                            color: allGaps.length > 0 ? '#475569' : '#166534',
                            fontSize: '11px',
                            fontWeight: 600
                        }}>
                            {allGaps.length}
                        </span>
                    </button>

                    <button
                        onClick={handleExportPdf}
                        disabled={exportingPdf || displayedPhases.length === 0}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 14px',
                            borderRadius: '6px',
                            background: '#0284c7',
                            border: '1px solid #0369a1',
                            color: '#ffffff',
                            fontWeight: 500,
                            fontSize: '13px',
                            cursor: (exportingPdf || displayedPhases.length === 0) ? 'not-allowed' : 'pointer',
                            opacity: (exportingPdf || displayedPhases.length === 0) ? 0.7 : 1,
                            boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                        }}
                    >
                        {exportingPdf ? 'Exportiere...' : 'Als PDF exportieren'}
                    </button>
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

            {/* Phasen Grid */}
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

                    const phaseGapsCount = phaseRoles.filter(({ role, department }) => {
                        const currentAssgn = getAssignmentForPhase(phase.start, role, department);
                        return !currentAssgn?.person_id;
                    }).length;

                    return (
                        <div 
                            key={phase.start} 
                            id={`phase-card-${phase.start}`}
                            style={{ 
                                flex: '1',
                                minWidth: '320px', 
                                border: '1px solid #e2e8f0', 
                                borderRadius: '8px',
                                background: '#fff',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                                display: 'flex',
                                flexDirection: 'column'
                            }}
                        >
                            <div style={{ 
                                padding: '12px 16px', 
                                borderBottom: '1px solid #e2e8f0', 
                                background: '#f8fafc', 
                                borderRadius: '8px 8px 0 0',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <div>
                                    <div style={{ fontWeight: 'bold', fontSize: '15px', color: '#1e293b' }}>
                                        {phase.title}
                                    </div>
                                    <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>{phase.label}</div>
                                </div>
                                {phaseGapsCount > 0 ? (
                                    <span style={{ fontSize: '11px', fontWeight: 500, padding: '2px 8px', borderRadius: '12px', background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0' }}>
                                        {phaseGapsCount} offen
                                    </span>
                                ) : (
                                    <span style={{ fontSize: '11px', fontWeight: 500, padding: '2px 8px', borderRadius: '12px', background: '#f0fdf4', color: '#166534', border: '1px solid #dcfce7' }}>
                                        Vollständig
                                    </span>
                                )}
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
                                                borderLeft: `3px solid ${colors.accent}`
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <label style={{ fontSize: 13, color: '#333', fontWeight: 600 }}>
                                                    {role}
                                                </label>
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
                                                    border: '1px solid #d1d5db',
                                                    backgroundColor: selectDisabled ? '#f1f5f9' : '#ffffff',
                                                    cursor: selectDisabled ? 'not-allowed' : 'pointer',
                                                    fontSize: 13,
                                                    color: !isOccupied ? '#64748b' : '#1f2937'
                                                }}
                                            >
                                                <option value="" style={{ color: '#64748b' }}>
                                                    {disabledReason && !isOccupied ? `- ${disabledReason} -` : '- Nicht besetzt -'}
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

            {/* MODAL: LÜCKEN-ÜBERSICHT */}
            {showGapsModal && (
                <div 
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 9999,
                        backdropFilter: 'blur(2px)'
                    }}
                    onClick={() => setShowGapsModal(false)}
                >
                    <div 
                        style={{
                            background: '#ffffff',
                            borderRadius: '12px',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.05)',
                            width: '90%',
                            maxWidth: '850px',
                            maxHeight: '90vh',
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden'
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div style={{
                            padding: '16px 24px',
                            borderBottom: '1px solid #e5e7eb',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: '#f8fafc'
                        }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 600, color: '#0f172a' }}>
                                    ITW Vorplanung &bull; Lücken-Übersicht {year}
                                </h3>
                                <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
                                    Übersicht aller unbesetzten ITW-Schichtblöcke für das Planungsjahr
                                </div>
                            </div>
                            <button
                                onClick={() => setShowGapsModal(false)}
                                style={{
                                    border: 'none',
                                    background: 'transparent',
                                    fontSize: '13px',
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    color: '#64748b',
                                    padding: '4px 8px',
                                    borderRadius: '6px'
                                }}
                            >
                                Schließen
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
                            {/* KPI Stat Cards */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                                <div style={{ padding: '12px', borderRadius: '8px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Gesamt-Bedarf</div>
                                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>{totalSlots} Slots</div>
                                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{displayedPhases.length} Phasen à 3 Rollen</div>
                                </div>

                                <div style={{ padding: '12px', borderRadius: '8px', background: '#f0fdf4', border: '1px solid #dcfce7' }}>
                                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#166534', textTransform: 'uppercase' }}>Besetzt</div>
                                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#166534', marginTop: '4px' }}>
                                        {occupiedSlots} <span style={{ fontSize: '13px', fontWeight: 500 }}>({occupancyPercent}%)</span>
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#166534', marginTop: '2px' }}>Zugeordnete Mitarbeiter</div>
                                </div>

                                <div style={{ padding: '12px', borderRadius: '8px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#475569', textTransform: 'uppercase' }}>Offene Lücken</div>
                                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>
                                        {allGaps.length} <span style={{ fontSize: '13px', fontWeight: 500, color: '#64748b' }}>Slots</span>
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                                        {allGaps.length === 0 ? 'Vollständig besetzt' : 'Noch zuzuordnen'}
                                    </div>
                                </div>
                            </div>

                            {/* Department Breakdown */}
                            <div style={{ marginBottom: '20px' }}>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                                    Lücken nach Abteilung:
                                </div>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    <button
                                        onClick={() => setGapsDeptFilter('all')}
                                        style={{
                                            padding: '5px 12px',
                                            borderRadius: '6px',
                                            border: gapsDeptFilter === 'all' ? '1px solid #0284c7' : '1px solid #d1d5db',
                                            background: gapsDeptFilter === 'all' ? '#f0f9ff' : '#ffffff',
                                            fontWeight: gapsDeptFilter === 'all' ? 600 : 400,
                                            color: gapsDeptFilter === 'all' ? '#0369a1' : '#374151',
                                            cursor: 'pointer',
                                            fontSize: '12px'
                                        }}
                                    >
                                        Alle Abteilungen ({allGaps.length})
                                    </button>
                                    {DEPARTMENTS.map(dept => {
                                        const count = allGaps.filter(g => normalizeDepartmentName(g.department) === normalizeDepartmentName(dept)).length;
                                        const colors = getDepartmentColor(dept);
                                        const isSelected = normalizeDepartmentName(gapsDeptFilter) === normalizeDepartmentName(dept);
                                        return (
                                            <button
                                                key={dept}
                                                onClick={() => setGapsDeptFilter(dept)}
                                                style={{
                                                    padding: '5px 12px',
                                                    borderRadius: '6px',
                                                    border: isSelected ? `1px solid ${colors.accent}` : '1px solid #d1d5db',
                                                    background: isSelected ? colors.badgeBg : '#ffffff',
                                                    fontWeight: isSelected ? 600 : 400,
                                                    color: isSelected ? colors.badgeColor : '#374151',
                                                    cursor: 'pointer',
                                                    fontSize: '12px'
                                                }}
                                            >
                                                {dept} ({count} offen)
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Role Filter */}
                            <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '13px', fontWeight: 500, color: '#334155' }}>Rolle:</span>
                                <select
                                    value={gapsRoleFilter}
                                    onChange={e => setGapsRoleFilter(e.target.value)}
                                    style={{
                                        padding: '4px 8px',
                                        borderRadius: '4px',
                                        border: '1px solid #d1d5db',
                                        fontSize: '12px'
                                    }}
                                >
                                    <option value="all">Alle Rollen</option>
                                    <option value="Fahrzeugführer 1">Fahrzeugführer 1</option>
                                    <option value="Fahrzeugführer 2">Fahrzeugführer 2</option>
                                    <option value="Maschinist">Maschinist</option>
                                </select>
                            </div>

                            {/* Gaps List / Table */}
                            {filteredGaps.length === 0 ? (
                                <div style={{
                                    padding: '24px',
                                    textAlign: 'center',
                                    background: '#f8fafc',
                                    borderRadius: '8px',
                                    border: '1px solid #e2e8f0',
                                    color: '#475569'
                                }}>
                                    <div style={{ fontWeight: 600, fontSize: '14px' }}>Keine offenen Lücken gefunden</div>
                                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                                        {allGaps.length === 0
                                             ? 'Alle ITW-Schichtblöcke für das Jahr sind vollständig besetzt.'
                                            : 'Für die gewählten Filter liegen keine offenen Lücken vor.'}
                                    </div>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {filteredGaps.map((gap, idx) => {
                                        const colors = getDepartmentColor(gap.department);
                                        const isUserInTargetDept = normalizeDepartmentName(userDept) === normalizeDepartmentName(gap.department);

                                        const ownPerson = personnel.find(p => isOwnUser(p));
                                        const ownQuals = ownPerson ? (activeQuals[ownPerson.id] || []) : [];
                                        const isOwnFzf = ownQuals.includes('ITW Fahrzeugführer') || ownQuals.includes('Fahrzeugführer') || ownQuals.includes('Fahrzeugführer HLF-B');
                                        const isOwnMasch = ownQuals.includes('ITW Maschinist');
                                        const hasRequiredQual = gap.role.startsWith('Fahrzeugführer') ? isOwnFzf : (gap.role === 'Maschinist' ? isOwnMasch : true);

                                        let selectDisabled = false;
                                        if (canWriteAll) {
                                            selectDisabled = false;
                                        } else if (canWriteOwn) {
                                            if (!isUserInTargetDept || !hasRequiredQual) {
                                                selectDisabled = true;
                                            }
                                        } else {
                                            selectDisabled = true;
                                        }

                                        const availablePersonnel = canWriteAll
                                            ? personnel
                                            : (canWriteOwn
                                                ? personnel.filter(p => isOwnUser(p) && isUserInTargetDept)
                                                : []);

                                        return (
                                            <div
                                                key={`${gap.start}-${gap.role}-${idx}`}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    flexWrap: 'wrap',
                                                    gap: '12px',
                                                    padding: '10px 14px',
                                                    borderRadius: '6px',
                                                    background: '#fff',
                                                    border: '1px solid #e2e8f0',
                                                    borderLeft: `3px solid ${colors.accent}`,
                                                    boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                                                }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '220px' }}>
                                                    <div>
                                                        <div style={{ fontWeight: 600, fontSize: '13px', color: '#1e293b' }}>
                                                            {gap.phaseTitle}
                                                        </div>
                                                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                                                            {gap.phaseLabel}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{ fontSize: '12px', fontWeight: 500, color: '#334155' }}>
                                                        {gap.role}
                                                    </span>
                                                    <span style={{
                                                        fontSize: '11px',
                                                        fontWeight: 500,
                                                        padding: '2px 8px',
                                                        borderRadius: '12px',
                                                        background: colors.badgeBg,
                                                        color: colors.badgeColor,
                                                        border: `1px solid ${colors.badgeBorder}`
                                                    }}>
                                                        {gap.department}
                                                    </span>
                                                </div>

                                                {/* Direct Assign or Jump Action */}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    {!selectDisabled && availablePersonnel.length > 0 ? (
                                                        <select
                                                            defaultValue=""
                                                            onChange={e => {
                                                                if (e.target.value) {
                                                                    handleAssign(gap.start, gap.end, gap.role, gap.department, e.target.value);
                                                                }
                                                            }}
                                                            style={{
                                                                padding: '5px 8px',
                                                                borderRadius: '4px',
                                                                border: '1px solid #cbd5e1',
                                                                fontSize: '12px',
                                                                maxWidth: '200px'
                                                            }}
                                                        >
                                                            <option value="">- Jetzt zuordnen -</option>
                                                            {availablePersonnel.map(p => {
                                                                const quals = activeQuals[p.id] || [];
                                                                const isFzf = quals.includes('ITW Fahrzeugführer') || quals.includes('Fahrzeugführer') || quals.includes('Fahrzeugführer HLF-B');
                                                                const isMasch = quals.includes('ITW Maschinist');
                                                                let valid = true;
                                                                if (gap.role.startsWith('Fahrzeugführer') && !isFzf) valid = false;
                                                                if (gap.role === 'Maschinist' && !isMasch) valid = false;

                                                                return (
                                                                    <option key={p.id} value={p.id} disabled={!valid}>
                                                                        {p.name}, {p.vorname} {!valid ? '(Quali fehlt)' : ''}
                                                                    </option>
                                                                );
                                                            })}
                                                        </select>
                                                    ) : null}

                                                    <button
                                                        onClick={() => scrollToPhase(gap.start)}
                                                        style={{
                                                            padding: '4px 10px',
                                                            borderRadius: '4px',
                                                            border: '1px solid #e2e8f0',
                                                            background: '#f8fafc',
                                                            color: '#0284c7',
                                                            fontSize: '11px',
                                                            fontWeight: 500,
                                                            cursor: 'pointer'
                                                        }}
                                                        title="Zu dieser Phase in der Übersicht springen"
                                                    >
                                                        Zur Phase
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div style={{
                            padding: '12px 24px',
                            borderTop: '1px solid #e5e7eb',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: '#f8fafc'
                        }}>
                            <button
                                onClick={handleExportPdf}
                                disabled={exportingPdf}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '6px 14px',
                                    borderRadius: '6px',
                                    background: '#0284c7',
                                    border: '1px solid #0369a1',
                                    color: '#ffffff',
                                    fontWeight: 500,
                                    fontSize: '13px',
                                    cursor: exportingPdf ? 'not-allowed' : 'pointer'
                                }}
                            >
                                {exportingPdf ? 'Exportiere...' : 'Vorplanung als PDF exportieren'}
                            </button>

                            <button
                                onClick={() => setShowGapsModal(false)}
                                style={{
                                    padding: '6px 16px',
                                    borderRadius: '6px',
                                    border: '1px solid #d1d5db',
                                    background: '#ffffff',
                                    color: '#374151',
                                    fontWeight: 500,
                                    fontSize: '13px',
                                    cursor: 'pointer'
                                }}
                            >
                                Schließen
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

};

export default ItwVorplanungTab;
