import { parseItwPatternString, parseItwDay, normalizeDeptCode, deptCodeToLabel } from './itwPatternUtils';

export interface ItwProposedSlot {
  value: string; // e.g. 'p:123', 'd:456', or ''
  label: string;
  personId?: number | null;
  doctorId?: number | null;
  isExternal: boolean;
  isDoctor?: boolean;
  deptCode: string;
  deptName: string;
  reason: string;
}

export type ItwConflictType = 'none' | 'deviation' | 'multi_iw';

export interface ItwDayAutoPlan {
  date: string; // YYYY-MM-DD
  weekday: string;
  dayNumber: number;
  isHoliday: boolean;
  phaseStart: string;
  phaseEnd: string;
  slotPattern: { fzf: string; maschinist: string };

  // Planned by Vorplanung
  plannedFzf: {
    personId: number | null;
    name: string;
    deptCode: string;
    deptName: string;
    isOwnDept: boolean;
  };
  plannedMa: {
    personId: number | null;
    name: string;
    deptCode: string;
    deptName: string;
    isOwnDept: boolean;
  };
  plannedDoctor: {
    doctorId: number | null;
    name: string;
  };

  // Colleagues in own department with IW duty code
  deptIwColleagues: {
    id: number;
    name: string;
    fahrzeugfuehrer: boolean;
  }[];

  // Conflict / Deviation info
  conflictType: ItwConflictType;
  conflictDescription: string;
  selectedRoleForColleague?: 'fzf' | 'ma'; // for deviation
  selectedFzfPersonId?: number; // for multi_iw
  selectedMaPersonId?: number; // for multi_iw
  resolved: boolean;

  // Proposed assignments
  proposedFzf: ItwProposedSlot;
  proposedMa: ItwProposedSlot;
  proposedDoctor: ItwProposedSlot;

  // Current values in roster
  currentValues: {
    fzf: string;
    ma: string;
    doctor: string;
  };
}

export interface BuildItwAutoAssignParams {
  year: number;
  month: number; // 0-11
  departmentId: number;
  departmentName?: string;
  personnel: any[]; // Own department personnel
  crossDeptPersonnel: any[]; // All personnel across departments
  itwPatternSeqs: { startDate: string; pattern: string[] }[];
  itwRotationPhases: any[];
  phaseOverrides: Record<string, any>;
  assignments: any[]; // itw_phase_assignments
  holidays: Set<string>;
  localRoster: any;
  roster: any;
  itwDoctors: any[];
  itwDutyRoster: any[]; // from getItwDutyRoster(year)
  auswertungByType: Record<string, string>;
  getAssignedValueFor: (date: string, slotId: string) => string;
}

/**
 * Find the active ITW sequence for a given ISO date string.
 */
export function getActiveItwSequence(
  dateStr: string,
  itwPatternSeqs: { startDate: string; pattern: string[] }[]
) {
  if (!itwPatternSeqs || itwPatternSeqs.length === 0) return null;
  const sorted = [...itwPatternSeqs].sort((a, b) => a.startDate.localeCompare(b.startDate));
  if (dateStr < sorted[0].startDate) return null;

  let active = sorted[0];
  for (const s of sorted) {
    if (s.startDate <= dateStr) {
      active = s;
    } else {
      break;
    }
  }
  return active;
}

/**
 * Format doctor full name.
 */
export function formatDoctorName(doc: any): string {
  if (!doc) return '';
  return [doc.title, doc.vorname, doc.name].filter(Boolean).join(' ') || doc.name || '';
}

/**
 * Build auto-assignment proposals for all ITW days in the selected month.
 */
export function buildItwMonthAutoAssignments(params: BuildItwAutoAssignParams): ItwDayAutoPlan[] {
  const {
    year,
    month,
    departmentId,
    departmentName,
    personnel,
    crossDeptPersonnel,
    itwPatternSeqs,
    itwRotationPhases,
    phaseOverrides,
    assignments,
    holidays,
    localRoster,
    roster,
    itwDoctors,
    itwDutyRoster,
    auswertungByType,
    getAssignedValueFor
  } = params;

  const myDeptCode = normalizeDeptCode(departmentName || departmentId);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dayMs = 24 * 60 * 60 * 1000;

  // Quick lookups
  const crossPersonMap = new Map<number, any>();
  (crossDeptPersonnel || []).forEach(p => {
    if (p && p.id != null) crossPersonMap.set(Number(p.id), p);
  });
  // Own personnel has precedence
  (personnel || []).forEach(p => {
    if (p && p.id != null) crossPersonMap.set(Number(p.id), p);
  });

  const doctorMap = new Map<number, any>();
  (itwDoctors || []).forEach(d => {
    if (d && d.id != null) doctorMap.set(Number(d.id), d);
  });

  const getDutyCode = (key: string, date: string): string => {
    return ((localRoster as any)?.[key]?.[date]?.value) || ((roster as any)?.[key]?.[date]?.value) || '';
  };

  const isColleagueOnItwDuty = (key: string, date: string): boolean => {
    const code = getDutyCode(key, date);
    return !!code && (auswertungByType[code] === 'itw');
  };

  const getPersonLabel = (personId: number | null, fallbackDeptCode?: string) => {
    if (!personId) return '';
    const p = crossPersonMap.get(personId);
    if (!p) return `Person ${personId}`;
    const pDept = p.department ? normalizeDeptCode(p.department) : (fallbackDeptCode ? normalizeDeptCode(fallbackDeptCode) : '');
    const isForeign = pDept && myDeptCode && pDept !== myDeptCode;
    const tag = isForeign ? ` [${pDept}. Abt.]` : '';
    return `${p.name}${tag}`;
  };

  const plans: ItwDayAutoPlan[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
    const localDate = new Date(year, month, day);
    const weekday = localDate.toLocaleDateString('de-DE', { weekday: 'short' });
    const isHoliday = holidays.has(dateStr);

    if (isHoliday) {
      continue; // ITW does not operate on holidays
    }

    const activeSeq = getActiveItwSequence(dateStr, itwPatternSeqs);
    if (!activeSeq) continue;

    const patternSlots = parseItwPatternString(Array.isArray(activeSeq.pattern) ? activeSeq.pattern.join(',') : String(activeSeq.pattern || ''));
    if (!patternSlots || patternSlots.length === 0) continue;

    const seqBaseTime = new Date(activeSeq.startDate + 'T00:00:00Z').getTime();
    const curTime = new Date(dateStr + 'T00:00:00Z').getTime();
    const diffDays = Math.round((curTime - seqBaseTime) / dayMs);
    if (diffDays < 0) continue;

    const patternIndex = ((diffDays % patternSlots.length) + patternSlots.length) % patternSlots.length;
    const slot = patternSlots[patternIndex]; // slot.fzf, slot.maschinist

    // If both slots are empty, ITW is not scheduled for this day
    if (!slot.fzf && !slot.maschinist) {
      continue;
    }

    // Determine 21-day phase
    const phaseDays = 21;
    const phaseIdx = Math.floor(diffDays / phaseDays);
    const phaseStartTime = seqBaseTime + phaseIdx * phaseDays * dayMs;
    const phaseStart = new Date(phaseStartTime).toISOString().slice(0, 10);
    const phaseEnd = new Date(phaseStartTime + (phaseDays - 1) * dayMs).toISOString().slice(0, 10);

    // Rotation config & overrides
    const rotCount = itwRotationPhases.length || 3;
    const rotConfig = itwRotationPhases[phaseIdx % rotCount] || {
      fzf1: '1. Abteilung',
      fzf2: '2. Abteilung',
      maschinist: '3. Abteilung'
    };
    const override = phaseOverrides[phaseStart] || {};

    const codeFzf1 = normalizeDeptCode(override.fzf1 || rotConfig.fzf1);
    const codeFzf2 = normalizeDeptCode(override.fzf2 || rotConfig.fzf2);

    // Role for FzF slot on this day
    let roleFzf = 'Fahrzeugführer 1';
    if (slot.fzf === codeFzf2) {
      roleFzf = 'Fahrzeugführer 2';
    } else if (slot.fzf === codeFzf1) {
      roleFzf = 'Fahrzeugführer 1';
    }

    // Planned FzF from assignments
    const assgnFzf = (assignments || []).find(a => a.start_date === phaseStart && a.role === roleFzf);
    const plannedFzfId = assgnFzf?.person_id ? Number(assgnFzf.person_id) : null;
    const plannedFzfPerson = plannedFzfId ? crossPersonMap.get(plannedFzfId) : null;
    const plannedFzfDept = slot.fzf || (plannedFzfPerson?.department ? normalizeDeptCode(plannedFzfPerson.department) : '');
    const isFzfOwnDept = plannedFzfDept === myDeptCode;

    // Planned Maschinist from assignments
    const assgnMa = (assignments || []).find(a => a.start_date === phaseStart && a.role === 'Maschinist');
    const plannedMaId = assgnMa?.person_id ? Number(assgnMa.person_id) : null;
    const plannedMaPerson = plannedMaId ? crossPersonMap.get(plannedMaId) : null;
    const plannedMaDept = slot.maschinist || (plannedMaPerson?.department ? normalizeDeptCode(plannedMaPerson.department) : '');
    const isMaOwnDept = plannedMaDept === myDeptCode;

    // Planned Doctor from itwDutyRoster
    const docEntry = (itwDutyRoster || []).find(
      r => r.personType === 'doctor' && r.date === dateStr && (r.type === 'IW' || r.value === '1')
    );
    const plannedDoctorId = docEntry?.personId ? Number(docEntry.personId) : null;
    const plannedDocObj = plannedDoctorId ? doctorMap.get(plannedDoctorId) : null;

    // Own department colleagues with IW
    const deptIwColleagues: { id: number; name: string; fahrzeugfuehrer: boolean }[] = [];
    (personnel || []).forEach(p => {
      if (isColleagueOnItwDuty(`p_${p.id}`, dateStr)) {
        deptIwColleagues.push({
          id: p.id,
          name: p.name,
          fahrzeugfuehrer: !!p.fahrzeugfuehrer
        });
      }
    });

    // Current values in roster
    const currentFzfVal = getAssignedValueFor(dateStr, 'itw_row_1');
    const currentMaVal = getAssignedValueFor(dateStr, 'itw_row_2');
    const currentDocVal = getAssignedValueFor(dateStr, 'itw_row_4');

    // Conflict detection and proposed slots
    let conflictType: ItwConflictType = 'none';
    let conflictDescription = '';
    let selectedRoleForColleague: 'fzf' | 'ma' | undefined = undefined;
    let selectedFzfPersonId: number | undefined = undefined;
    let selectedMaPersonId: number | undefined = undefined;

    let proposedFzfId: number | null = null;
    let proposedMaId: number | null = null;
    let fzfReason = '';
    let maReason = '';

    if (deptIwColleagues.length >= 2) {
      // Rule 2B: 2 or more colleagues in own department have IW -> both have priority!
      conflictType = 'multi_iw';
      const c1 = deptIwColleagues[0];
      const c2 = deptIwColleagues[1];

      // Smart default assignment
      if (c1.id === plannedFzfId || (c1.fahrzeugfuehrer && !c2.fahrzeugfuehrer)) {
        selectedFzfPersonId = c1.id;
        selectedMaPersonId = c2.id;
      } else if (c2.id === plannedFzfId || (!c1.fahrzeugfuehrer && c2.fahrzeugfuehrer)) {
        selectedFzfPersonId = c2.id;
        selectedMaPersonId = c1.id;
      } else {
        selectedFzfPersonId = c1.id;
        selectedMaPersonId = c2.id;
      }

      proposedFzfId = selectedFzfPersonId;
      proposedMaId = selectedMaPersonId;
      fzfReason = `Priorität: Eigener Kollege mit IW (${crossPersonMap.get(proposedFzfId)?.name || proposedFzfId})`;
      maReason = `Priorität: Eigener Kollege mit IW (${crossPersonMap.get(proposedMaId)?.name || proposedMaId})`;
      conflictDescription = `2 Kollegen der eigenen Abteilung haben IW eingetragen (${c1.name}, ${c2.name}). Bitte Rollenaufteilung (FzF / Ma) festlegen.`;

    } else if (deptIwColleagues.length === 1) {
      // Exactly 1 colleague has IW
      const c = deptIwColleagues[0];

      if (isFzfOwnDept) {
        if (plannedFzfId === c.id) {
          // Rule 1: Exact match with Vorplanung
          proposedFzfId = c.id;
          fzfReason = 'Vorplanung & IW: Eigener Kollege als FzF';
          proposedMaId = plannedMaId;
          maReason = isMaOwnDept
            ? 'Vorplanung: Maschinist'
            : `Vorplanung (${plannedMaDept}. Abt. - nur Info)`;
        } else {
          // Rule 2A: Deviation! Another colleague has IW than planned
          conflictType = 'deviation';
          selectedRoleForColleague = 'fzf';
          proposedFzfId = c.id;
          proposedMaId = plannedMaId;
          const plannedName = plannedFzfPerson?.name || 'nicht besetzt';
          conflictDescription = `Abweichung: ${c.name} hat IW, vorgeplant war ${plannedName} (${plannedFzfDept}. Abt. FzF).`;
          fzfReason = `Abweichung: ${c.name} (IW) als FzF`;
          maReason = isMaOwnDept
            ? 'Vorplanung: Maschinist'
            : `Vorplanung (${plannedMaDept}. Abt. - nur Info)`;
        }
      } else if (isMaOwnDept) {
        if (plannedMaId === c.id) {
          // Rule 1: Exact match as Maschinist
          proposedMaId = c.id;
          maReason = 'Vorplanung & IW: Eigener Kollege als Maschinist';
          proposedFzfId = plannedFzfId;
          fzfReason = isFzfOwnDept
            ? 'Vorplanung: Fahrzeugführer'
            : `Vorplanung (${plannedFzfDept}. Abt. - nur Info)`;
        } else {
          // Rule 2A: Deviation as Maschinist
          conflictType = 'deviation';
          selectedRoleForColleague = 'ma';
          proposedMaId = c.id;
          proposedFzfId = plannedFzfId;
          const plannedName = plannedMaPerson?.name || 'nicht besetzt';
          conflictDescription = `Abweichung: ${c.name} hat IW, vorgeplant war ${plannedName} (${plannedMaDept}. Abt. Ma).`;
          maReason = `Abweichung: ${c.name} (IW) als Maschinist`;
          fzfReason = isFzfOwnDept
            ? 'Vorplanung: Fahrzeugführer'
            : `Vorplanung (${plannedFzfDept}. Abt. - nur Info)`;
        }
      } else {
        // Own department was not planned for this day, but a colleague has IW
        conflictType = 'deviation';
        selectedRoleForColleague = c.fahrzeugfuehrer ? 'fzf' : 'ma';
        if (selectedRoleForColleague === 'fzf') {
          proposedFzfId = c.id;
          proposedMaId = plannedMaId;
          fzfReason = `Zusatz-IW: ${c.name} als FzF`;
          maReason = `Vorplanung (${plannedMaDept}. Abt. - nur Info)`;
        } else {
          proposedMaId = c.id;
          proposedFzfId = plannedFzfId;
          maReason = `Zusatz-IW: ${c.name} als Maschinist`;
          fzfReason = `Vorplanung (${plannedFzfDept}. Abt. - nur Info)`;
        }
        conflictDescription = `${c.name} hat IW, obwohl die eigene Abteilung für diesen Tag nicht im Vorplanungs-Muster vorgesehen ist.`;
      }
    } else {
      // Rule 3: No one from own department has IW -> fill completely from Vorplanung
      proposedFzfId = plannedFzfId;
      proposedMaId = plannedMaId;
      fzfReason = isFzfOwnDept
        ? 'Vorplanung: Eigene Abteilung (kein IW-Eintrag)'
        : `Vorplanung (${plannedFzfDept}. Abt. - nur Info)`;
      maReason = isMaOwnDept
        ? 'Vorplanung: Eigene Abteilung (kein IW-Eintrag)'
        : `Vorplanung (${plannedMaDept}. Abt. - nur Info)`;
    }

    // Build slot objects
    const fzfPerson = proposedFzfId ? crossPersonMap.get(proposedFzfId) : null;
    const fzfDept = fzfPerson?.department ? normalizeDeptCode(fzfPerson.department) : plannedFzfDept;
    const isFzfExternal = fzfDept ? fzfDept !== myDeptCode : false;

    const maPerson = proposedMaId ? crossPersonMap.get(proposedMaId) : null;
    const maDept = maPerson?.department ? normalizeDeptCode(maPerson.department) : plannedMaDept;
    const isMaExternal = maDept ? maDept !== myDeptCode : false;

    const docName = plannedDocObj ? formatDoctorName(plannedDocObj) : (plannedDoctorId ? `Arzt ${plannedDoctorId}` : '');

    const plan: ItwDayAutoPlan = {
      date: dateStr,
      weekday,
      dayNumber: day,
      isHoliday: false,
      phaseStart,
      phaseEnd,
      slotPattern: { fzf: slot.fzf, maschinist: slot.maschinist },

      plannedFzf: {
        personId: plannedFzfId,
        name: plannedFzfPerson ? plannedFzfPerson.name : (plannedFzfId ? `Person ${plannedFzfId}` : ''),
        deptCode: plannedFzfDept,
        deptName: deptCodeToLabel(plannedFzfDept),
        isOwnDept: isFzfOwnDept
      },
      plannedMa: {
        personId: plannedMaId,
        name: plannedMaPerson ? plannedMaPerson.name : (plannedMaId ? `Person ${plannedMaId}` : ''),
        deptCode: plannedMaDept,
        deptName: deptCodeToLabel(plannedMaDept),
        isOwnDept: isMaOwnDept
      },
      plannedDoctor: {
        doctorId: plannedDoctorId,
        name: docName
      },

      deptIwColleagues,
      conflictType,
      conflictDescription,
      selectedRoleForColleague,
      selectedFzfPersonId,
      selectedMaPersonId,
      resolved: conflictType === 'none',

      proposedFzf: {
        value: proposedFzfId ? `p:${proposedFzfId}` : '',
        label: getPersonLabel(proposedFzfId, plannedFzfDept),
        personId: proposedFzfId,
        isExternal: isFzfExternal,
        deptCode: fzfDept,
        deptName: deptCodeToLabel(fzfDept),
        reason: fzfReason
      },
      proposedMa: {
        value: proposedMaId ? `p:${proposedMaId}` : '',
        label: getPersonLabel(proposedMaId, plannedMaDept),
        personId: proposedMaId,
        isExternal: isMaExternal,
        deptCode: maDept,
        deptName: deptCodeToLabel(maDept),
        reason: maReason
      },
      proposedDoctor: {
        value: plannedDoctorId ? `d:${plannedDoctorId}` : '',
        label: docName ? `${docName} [Arzt]` : '',
        doctorId: plannedDoctorId,
        isDoctor: true,
        isExternal: false,
        deptCode: '',
        deptName: '',
        reason: plannedDoctorId ? 'Vorplanung: ITW-Arzt (nur Info)' : 'Kein Arzt vorgeplant'
      },

      currentValues: {
        fzf: currentFzfVal,
        ma: currentMaVal,
        doctor: currentDocVal
      }
    };

    plans.push(plan);
  }

  return plans;
}

/**
 * Recompute proposed assignment for a day when the user changes a resolution choice.
 */
export function updateDayPlanChoice(
  plan: ItwDayAutoPlan,
  updates: {
    selectedRoleForColleague?: 'fzf' | 'ma';
    selectedFzfPersonId?: number;
    selectedMaPersonId?: number;
  },
  crossPersonMap: Map<number, any>,
  myDeptCode: string
): ItwDayAutoPlan {
  const updated = { ...plan, ...updates };

  const getPersonLabel = (personId: number | null, fallbackDeptCode?: string) => {
    if (!personId) return '';
    const p = crossPersonMap.get(personId);
    if (!p) return `Person ${personId}`;
    const pDept = p.department ? normalizeDeptCode(p.department) : (fallbackDeptCode ? normalizeDeptCode(fallbackDeptCode) : '');
    const isForeign = pDept && myDeptCode && pDept !== myDeptCode;
    const tag = isForeign ? ` [${pDept}. Abt.]` : '';
    return `${p.name}${tag}`;
  };

  if (updated.conflictType === 'multi_iw') {
    const fzfId = updated.selectedFzfPersonId || null;
    const maId = updated.selectedMaPersonId || null;

    const fzfPerson = fzfId ? crossPersonMap.get(fzfId) : null;
    const fzfDept = fzfPerson?.department ? normalizeDeptCode(fzfPerson.department) : myDeptCode;
    const isFzfExternal = fzfDept ? fzfDept !== myDeptCode : false;

    const maPerson = maId ? crossPersonMap.get(maId) : null;
    const maDept = maPerson?.department ? normalizeDeptCode(maPerson.department) : myDeptCode;
    const isMaExternal = maDept ? maDept !== myDeptCode : false;

    updated.proposedFzf = {
      value: fzfId ? `p:${fzfId}` : '',
      label: getPersonLabel(fzfId, myDeptCode),
      personId: fzfId,
      isExternal: isFzfExternal,
      deptCode: fzfDept,
      deptName: deptCodeToLabel(fzfDept),
      reason: `Priorität: Eigener Kollege mit IW (${fzfPerson?.name || fzfId})`
    };

    updated.proposedMa = {
      value: maId ? `p:${maId}` : '',
      label: getPersonLabel(maId, myDeptCode),
      personId: maId,
      isExternal: isMaExternal,
      deptCode: maDept,
      deptName: deptCodeToLabel(maDept),
      reason: `Priorität: Eigener Kollege mit IW (${maPerson?.name || maId})`
    };

    updated.resolved = !!(fzfId && maId && fzfId !== maId);

  } else if (updated.conflictType === 'deviation' && updated.deptIwColleagues.length === 1) {
    const c = updated.deptIwColleagues[0];
    const role = updated.selectedRoleForColleague || 'fzf';

    if (role === 'fzf') {
      const fzfId = c.id;
      const maId = updated.plannedMa.personId;

      const fzfPerson = crossPersonMap.get(fzfId);
      const fzfDept = myDeptCode;

      const maPerson = maId ? crossPersonMap.get(maId) : null;
      const maDept = maPerson?.department ? normalizeDeptCode(maPerson.department) : updated.plannedMa.deptCode;
      const isMaExternal = maDept ? maDept !== myDeptCode : false;

      updated.proposedFzf = {
        value: `p:${fzfId}`,
        label: getPersonLabel(fzfId, myDeptCode),
        personId: fzfId,
        isExternal: false,
        deptCode: fzfDept,
        deptName: deptCodeToLabel(fzfDept),
        reason: `Abweichung: ${c.name} (IW) als FzF`
      };

      updated.proposedMa = {
        value: maId ? `p:${maId}` : '',
        label: getPersonLabel(maId, updated.plannedMa.deptCode),
        personId: maId,
        isExternal: isMaExternal,
        deptCode: maDept,
        deptName: deptCodeToLabel(maDept),
        reason: isMaExternal ? `Vorplanung (${maDept}. Abt. - nur Info)` : 'Vorplanung: Maschinist'
      };
    } else {
      const maId = c.id;
      const fzfId = updated.plannedFzf.personId;

      const maPerson = crossPersonMap.get(maId);
      const maDept = myDeptCode;

      const fzfPerson = fzfId ? crossPersonMap.get(fzfId) : null;
      const fzfDept = fzfPerson?.department ? normalizeDeptCode(fzfPerson.department) : updated.plannedFzf.deptCode;
      const isFzfExternal = fzfDept ? fzfDept !== myDeptCode : false;

      updated.proposedMa = {
        value: `p:${maId}`,
        label: getPersonLabel(maId, myDeptCode),
        personId: maId,
        isExternal: false,
        deptCode: maDept,
        deptName: deptCodeToLabel(maDept),
        reason: `Abweichung: ${c.name} (IW) als Maschinist`
      };

      updated.proposedFzf = {
        value: fzfId ? `p:${fzfId}` : '',
        label: getPersonLabel(fzfId, updated.plannedFzf.deptCode),
        personId: fzfId,
        isExternal: isFzfExternal,
        deptCode: fzfDept,
        deptName: deptCodeToLabel(fzfDept),
        reason: isFzfExternal ? `Vorplanung (${fzfDept}. Abt. - nur Info)` : 'Vorplanung: Fahrzeugführer'
      };
    }

    updated.resolved = true;
  }

  return updated;
}
