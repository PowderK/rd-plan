import React, { useState, useMemo } from 'react';
import {
  ItwDayAutoPlan,
  updateDayPlanChoice,
  formatDoctorName
} from '../utils/itwAutoAssign';
import { normalizeDeptCode, deptCodeToLabel } from '../utils/itwPatternUtils';

interface ItwAutoAssignDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (plans: ItwDayAutoPlan[]) => void;
  monthName: string;
  year: number;
  departmentName?: string;
  departmentId: number;
  initialPlans: ItwDayAutoPlan[];
  crossDeptPersonnel: any[];
  itwDoctors?: any[];
}

export const ItwAutoAssignDialog: React.FC<ItwAutoAssignDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  monthName,
  year,
  departmentName,
  departmentId,
  initialPlans,
  crossDeptPersonnel,
  itwDoctors = []
}) => {
  const [plans, setPlans] = useState<ItwDayAutoPlan[]>(() => initialPlans || []);
  const [filterMode, setFilterMode] = useState<'all' | 'conflicts'>('all');

  const myDeptCode = normalizeDeptCode(departmentName || departmentId);

  const crossPersonMap = useMemo(() => {
    const map = new Map<number, any>();
    (crossDeptPersonnel || []).forEach(p => {
      if (p && p.id != null) map.set(Number(p.id), p);
    });
    return map;
  }, [crossDeptPersonnel]);

  const doctorMap = useMemo(() => {
    const map = new Map<number, any>();
    (itwDoctors || []).forEach(d => {
      if (d && d.id != null) map.set(Number(d.id), d);
    });
    return map;
  }, [itwDoctors]);

  // Sync state when initialPlans changes
  React.useEffect(() => {
    setPlans(initialPlans || []);
    setFilterMode('all');
  }, [initialPlans]);

  if (!isOpen) return null;

  const totalDays = plans.length;
  const conflictDays = plans.filter(p => p.conflictType !== 'none');
  const matchDays = plans.filter(p => p.conflictType === 'none');
  const externalSlotsCount = plans.reduce((acc, p) => {
    let count = 0;
    if (p.proposedFzf.isExternal && p.proposedFzf.value) count++;
    if (p.proposedMa.isExternal && p.proposedMa.value) count++;
    return acc + count;
  }, 0);

  const displayedPlans = filterMode === 'conflicts' ? conflictDays : plans;

  // Handlers for conflict resolutions
  const handleDeviationChoice = (date: string, role: 'fzf' | 'ma') => {
    setPlans(prev =>
      prev.map(p => {
        if (p.date !== date) return p;
        return updateDayPlanChoice(
          p,
          { selectedRoleForColleague: role },
          crossPersonMap,
          myDeptCode
        );
      })
    );
  };

  const handleMultiIwChoice = (date: string, fzfId: number, maId: number) => {
    setPlans(prev =>
      prev.map(p => {
        if (p.date !== date) return p;
        return updateDayPlanChoice(
          p,
          { selectedFzfPersonId: fzfId, selectedMaPersonId: maId },
          crossPersonMap,
          myDeptCode
        );
      })
    );
  };

  const handleSwapMultiIw = (date: string) => {
    setPlans(prev =>
      prev.map(p => {
        if (p.date !== date) return p;
        const currentFzf = p.selectedFzfPersonId || p.proposedFzf.personId;
        const currentMa = p.selectedMaPersonId || p.proposedMa.personId;
        if (!currentFzf || !currentMa) return p;
        return updateDayPlanChoice(
          p,
          { selectedFzfPersonId: currentMa, selectedMaPersonId: currentFzf },
          crossPersonMap,
          myDeptCode
        );
      })
    );
  };

  // Direct slot assignment from dropdown
  const handleDirectSlotChange = (date: string, role: 'fzf' | 'ma' | 'doctor', val: string) => {
    setPlans(prev =>
      prev.map(p => {
        if (p.date !== date) return p;
        const next = { ...p };

        if (role === 'fzf') {
          if (!val) {
            next.proposedFzf = {
              value: '',
              label: '',
              personId: null,
              isExternal: false,
              deptCode: '',
              deptName: '',
              reason: 'Manuell entfernt'
            };
          } else {
            const pid = Number(val.replace('p:', ''));
            const person = crossPersonMap.get(pid);
            const pDept = person?.department ? normalizeDeptCode(person.department) : myDeptCode;
            const isExt = pDept !== myDeptCode;
            next.proposedFzf = {
              value: val,
              label: `${person?.name || val}${isExt ? ` [${pDept}. Abt.]` : ''}`,
              personId: pid,
              isExternal: isExt,
              deptCode: pDept,
              deptName: deptCodeToLabel(pDept),
              reason: isExt ? `Manuell (${pDept}. Abt. - nur Info)` : 'Manuell ausgewählt'
            };
          }
          next.resolved = true;
        } else if (role === 'ma') {
          if (!val) {
            next.proposedMa = {
              value: '',
              label: '',
              personId: null,
              isExternal: false,
              deptCode: '',
              deptName: '',
              reason: 'Manuell entfernt'
            };
          } else {
            const pid = Number(val.replace('p:', ''));
            const person = crossPersonMap.get(pid);
            const pDept = person?.department ? normalizeDeptCode(person.department) : myDeptCode;
            const isExt = pDept !== myDeptCode;
            next.proposedMa = {
              value: val,
              label: `${person?.name || val}${isExt ? ` [${pDept}. Abt.]` : ''}`,
              personId: pid,
              isExternal: isExt,
              deptCode: pDept,
              deptName: deptCodeToLabel(pDept),
              reason: isExt ? `Manuell (${pDept}. Abt. - nur Info)` : 'Manuell ausgewählt'
            };
          }
          next.resolved = true;
        } else if (role === 'doctor') {
          if (!val) {
            next.proposedDoctor = {
              value: '',
              label: '',
              doctorId: null,
              isDoctor: true,
              isExternal: false,
              deptCode: '',
              deptName: '',
              reason: 'Kein Arzt eingeteilt'
            };
          } else {
            const did = Number(val.replace('d:', ''));
            const doc = doctorMap.get(did);
            const name = doc ? formatDoctorName(doc) : `Arzt ${did}`;
            next.proposedDoctor = {
              value: val,
              label: `${name} [Arzt]`,
              doctorId: did,
              isDoctor: true,
              isExternal: false,
              deptCode: '',
              deptName: '',
              reason: 'Manuell ausgewählt'
            };
          }
        }
        return next;
      })
    );
  };

  // Group personnel for select dropdowns
  const ownPersonnel = (crossDeptPersonnel || []).filter(
    p => p && normalizeDeptCode(p.department) === myDeptCode
  );
  const foreignPersonnel = (crossDeptPersonnel || []).filter(
    p => p && normalizeDeptCode(p.department) !== myDeptCode
  );

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(15, 23, 42, 0.7)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16
      }}
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: '#ffffff',
          color: '#1e293b',
          borderRadius: 14,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          width: 'min(1120px, 97vw)',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid #cbd5e1'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid #e2e8f0',
            background: 'linear-gradient(to right, #f8fafc, #f1f5f9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>⚡</span>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
                Automatische ITW-Einteilung – {monthName} {year}
              </h2>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  background: '#e0f2fe',
                  color: '#0369a1',
                  padding: '2px 8px',
                  borderRadius: 6
                }}
              >
                {departmentName || `${departmentId}. Abteilung`}
              </span>
            </div>
            <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
              Priorisiert Kollegen der eigenen Abteilung mit IW-Diensten. Übernimmt Vorplanungs-Besetzungen fremder Abteilungen (blau/kursiv) und Ärzte als reine Information ohne Einfluss auf das RTW-Soll.
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              background: '#fff',
              color: '#64748b',
              cursor: 'pointer',
              fontSize: 16,
              fontWeight: 700
            }}
            title="Schließen"
          >
            ✕
          </button>
        </div>

        {/* Stats & Filters Bar */}
        <div
          style={{
            padding: '12px 24px',
            borderBottom: '1px solid #e2e8f0',
            background: '#fafafa',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                border: filterMode === 'all' ? '1px solid #0284c7' : '1px solid #cbd5e1',
                background: filterMode === 'all' ? '#0284c7' : '#fff',
                color: filterMode === 'all' ? '#fff' : '#475569',
                cursor: 'pointer'
              }}
            >
              Alle ITW-Tage ({totalDays})
            </button>

            <button
              type="button"
              onClick={() => setFilterMode('conflicts')}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                border: filterMode === 'conflicts' ? '1px solid #d97706' : '1px solid #cbd5e1',
                background: filterMode === 'conflicts' ? '#d97706' : '#fff',
                color: filterMode === 'conflicts' ? '#fff' : (conflictDays.length > 0 ? '#b45309' : '#475569'),
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              ⚠️ Nur Klärungsbedarf
              {conflictDays.length > 0 && (
                <span
                  style={{
                    background: filterMode === 'conflicts' ? '#b45309' : '#fef3c7',
                    color: filterMode === 'conflicts' ? '#fff' : '#92400e',
                    padding: '1px 6px',
                    borderRadius: 10,
                    fontSize: 11
                  }}
                >
                  {conflictDays.length}
                </span>
              )}
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 12, color: '#64748b' }}>
            <span>
              <strong>{matchDays.length}</strong> eindeutig
            </span>
            <span>•</span>
            <span style={{ color: externalSlotsCount > 0 ? '#1d4ed8' : '#64748b' }}>
              <strong>{externalSlotsCount}</strong> externe Vorplanungs-Slots (nur Info)
            </span>
            <span>•</span>
            <span>{displayedPlans.length} von {totalDays} Tagen angezeigt</span>
          </div>
        </div>

        {/* Content list */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16
          }}
        >
          {displayedPlans.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '40px 20px',
                color: '#64748b'
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
              <div style={{ fontWeight: 600, fontSize: 16 }}>Keine offenen Klärungsbedarfe!</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>
                Alle ITW-Dienste für {monthName} sind eindeutig zuordenbar.
              </div>
            </div>
          ) : (
            displayedPlans.map(plan => {
              const isConflict = plan.conflictType !== 'none';
              const dayStr = String(plan.dayNumber).padStart(2, '0');
              const monthStr = String(new Date(plan.date).getMonth() + 1).padStart(2, '0');

              return (
                <div
                  key={plan.date}
                  style={{
                    border: isConflict ? '2px solid #f59e0b' : '1px solid #cbd5e1',
                    borderRadius: 10,
                    overflow: 'visible',
                    background: '#fff',
                    boxShadow: isConflict ? '0 2px 10px rgba(245, 158, 11, 0.15)' : '0 1px 3px rgba(0,0,0,0.04)'
                  }}
                >
                  {/* Card Header */}
                  <div
                    style={{
                      padding: '10px 16px',
                      background: isConflict ? '#fffbeb' : '#f8fafc',
                      borderTopLeftRadius: 8,
                      borderTopRightRadius: 8,
                      borderBottom: '1px solid ' + (isConflict ? '#fde68a' : '#e2e8f0'),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 8
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: 15,
                          color: '#0f172a'
                        }}
                      >
                        {dayStr}.{monthStr}.{year} ({plan.weekday})
                      </span>

                      <span
                        style={{
                          fontSize: 12,
                          padding: '2px 8px',
                          borderRadius: 4,
                          background: '#e2e8f0',
                          color: '#475569',
                          fontWeight: 500
                        }}
                      >
                        Muster: FzF {plan.slotPattern.fzf || '–'}. Abt. / Ma {plan.slotPattern.maschinist || '–'}. Abt.
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {isConflict ? (
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: '#b45309',
                            background: '#fef3c7',
                            padding: '3px 10px',
                            borderRadius: 12,
                            border: '1px solid #fde68a'
                          }}
                        >
                          ⚠️ Klärungsbedarf
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: '#15803d',
                            background: '#dcfce7',
                            padding: '3px 10px',
                            borderRadius: 12,
                            border: '1px solid #bbf7d0'
                          }}
                        >
                          ✓ Eindeutig
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Conflict Box (if deviation or multi_iw) */}
                  {isConflict && (
                    <div
                      style={{
                        padding: '14px 16px',
                        background: '#fefce8',
                        borderBottom: '1px solid #fef08a'
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#92400e', marginBottom: 6 }}>
                        {plan.conflictType === 'deviation' && '⚠️ Abweichung gegenüber Vorplanung'}
                        {plan.conflictType === 'multi_iw' && '👥 2 Kollegen mit IW (Eigene Abteilung)'}
                      </div>

                      <div style={{ fontSize: 13, color: '#78350f', marginBottom: 12 }}>
                        {plan.conflictDescription}
                      </div>

                      {/* Prominent Quick-Decision Dropdowns */}
                      {plan.conflictType === 'deviation' && plan.deptIwColleagues.length >= 1 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#92400e' }}>
                            👉 Position für {plan.deptIwColleagues[0].name}:
                          </span>

                          <select
                            value={plan.selectedRoleForColleague || (plan.proposedFzf.personId === plan.deptIwColleagues[0].id ? 'fzf' : 'ma')}
                            onChange={e => handleDeviationChoice(plan.date, e.target.value as 'fzf' | 'ma')}
                            style={{
                              padding: '6px 12px',
                              borderRadius: 6,
                              border: '1.5px solid #d97706',
                              background: '#fff',
                              fontWeight: 600,
                              color: '#92400e',
                              fontSize: 13,
                              cursor: 'pointer',
                              boxSizing: 'border-box'
                            }}
                          >
                            <option value="fzf">Als Fahrzeugführer (FzF) einteilen</option>
                            <option value="ma">Als Maschinist (Ma) einteilen</option>
                          </select>

                          <span style={{ fontSize: 12, color: '#78350f' }}>
                            (Die jeweils andere Position wird automatisch aus der Vorplanung besetzt)
                          </span>
                        </div>
                      )}

                      {plan.conflictType === 'multi_iw' && plan.deptIwColleagues.length >= 2 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#92400e' }}>
                            👉 Rollenaufteilung festlegen:
                          </span>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>FzF:</span>
                            <select
                              value={plan.selectedFzfPersonId || plan.proposedFzf.personId || ''}
                              onChange={e => {
                                const newFzfId = Number(e.target.value);
                                const other = plan.deptIwColleagues.find(c => c.id !== newFzfId);
                                if (other) handleMultiIwChoice(plan.date, newFzfId, other.id);
                              }}
                              style={{
                                padding: '6px 10px',
                                borderRadius: 6,
                                border: '1.5px solid #d97706',
                                background: '#fff',
                                fontWeight: 600,
                                color: '#1e293b',
                                fontSize: 13,
                                cursor: 'pointer',
                                boxSizing: 'border-box'
                              }}
                            >
                              {plan.deptIwColleagues.map(c => (
                                <option key={c.id} value={c.id}>
                                  {c.name} {c.fahrzeugfuehrer ? '(FzF)' : ''}
                                </option>
                              ))}
                            </select>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleSwapMultiIw(plan.date)}
                            style={{
                              padding: '5px 12px',
                              borderRadius: 6,
                              border: '1px solid #cbd5e1',
                              background: '#fff',
                              cursor: 'pointer',
                              fontSize: 12,
                              fontWeight: 600,
                              color: '#475569'
                            }}
                            title="Positionen tauschen"
                          >
                            ⇄ Rollen tauschen
                          </button>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Ma:</span>
                            <select
                              value={plan.selectedMaPersonId || plan.proposedMa.personId || ''}
                              onChange={e => {
                                const newMaId = Number(e.target.value);
                                const other = plan.deptIwColleagues.find(c => c.id !== newMaId);
                                if (other) handleMultiIwChoice(plan.date, other.id, newMaId);
                              }}
                              style={{
                                padding: '6px 10px',
                                borderRadius: 6,
                                border: '1.5px solid #d97706',
                                background: '#fff',
                                fontWeight: 600,
                                color: '#1e293b',
                                fontSize: 13,
                                cursor: 'pointer',
                                boxSizing: 'border-box'
                              }}
                            >
                              {plan.deptIwColleagues.map(c => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 3 Slot Display Cards with Interactive Dropdowns */}
                  <div
                    style={{
                      padding: '14px 16px',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                      gap: 12
                    }}
                  >
                    {/* FzF Slot */}
                    <div
                      style={{
                        padding: '10px 12px',
                        borderRadius: 8,
                        minWidth: 0,
                        boxSizing: 'border-box',
                        background: plan.proposedFzf.isExternal
                          ? '#eff6ff'
                          : plan.proposedFzf.value
                          ? '#f0fdf4'
                          : '#f8fafc',
                        border: plan.proposedFzf.isExternal
                          ? '1px dashed #93c5fd'
                          : plan.proposedFzf.value
                          ? '1px solid #bbf7d0'
                          : '1px solid #e2e8f0'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>
                          Fahrzeugführer (FzF)
                        </span>
                        {plan.proposedFzf.isExternal ? (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              background: '#dbeafe',
                              color: '#1d4ed8',
                              padding: '1px 6px',
                              borderRadius: 4
                            }}
                          >
                            Extern (nur Info)
                          </span>
                        ) : plan.proposedFzf.value ? (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              background: '#dcfce7',
                              color: '#15803d',
                              padding: '1px 6px',
                              borderRadius: 4
                            }}
                          >
                            Eigene Abt.
                          </span>
                        ) : (
                          <span style={{ fontSize: 10, color: '#94a3b8' }}>Frei</span>
                        )}
                      </div>

                      {/* Interactive Dropdown */}
                      <select
                        value={plan.proposedFzf.value || ''}
                        onChange={e => handleDirectSlotChange(plan.date, 'fzf', e.target.value)}
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          padding: '6px 8px',
                          borderRadius: 6,
                          fontSize: 13,
                          fontWeight: 600,
                          border: plan.proposedFzf.isExternal ? '1.5px dashed #93c5fd' : '1px solid #cbd5e1',
                          background: plan.proposedFzf.isExternal ? '#eff6ff' : (plan.proposedFzf.value ? '#ffffff' : '#f8fafc'),
                          color: plan.proposedFzf.isExternal ? '#1d4ed8' : '#0f172a',
                          fontStyle: plan.proposedFzf.isExternal ? 'italic' : 'normal',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="">– Nicht besetzt –</option>

                        {/* Group 1: Colleagues with IW */}
                        {plan.deptIwColleagues.length > 0 && (
                          <optgroup label="Priorität: Eigene Kollegen mit IW">
                            {plan.deptIwColleagues.map(c => (
                              <option key={`iw_${c.id}`} value={`p:${c.id}`}>
                                ⭐ {c.name} {c.fahrzeugfuehrer ? '(FzF)' : ''}
                              </option>
                            ))}
                          </optgroup>
                        )}

                        {/* Group 2: Vorplanung colleague if not already in IW */}
                        {plan.plannedFzf.personId && !plan.deptIwColleagues.some(c => c.id === plan.plannedFzf.personId) && (
                          <optgroup label="Vorplanung">
                            <option value={`p:${plan.plannedFzf.personId}`}>
                              📅 {plan.plannedFzf.name} {plan.plannedFzf.isOwnDept ? '' : `[${plan.plannedFzf.deptCode}. Abt. - Info]`}
                            </option>
                          </optgroup>
                        )}

                        {/* Group 3: All own department colleagues */}
                        <optgroup label="Eigene Abteilung">
                          {ownPersonnel.map(p => (
                            <option key={`own_${p.id}`} value={`p:${p.id}`}>
                              {p.name} {p.fahrzeugfuehrer ? '(FzF)' : ''}
                            </option>
                          ))}
                        </optgroup>

                        {/* Group 4: Partner departments (only info) */}
                        <optgroup label="Partner-Abteilungen (Extern - nur Info)">
                          {foreignPersonnel.map(p => {
                            const pDept = normalizeDeptCode(p.department);
                            return (
                              <option key={`ext_${p.id}`} value={`p:${p.id}`}>
                                {p.name} [{pDept}. Abt.]
                              </option>
                            );
                          })}
                        </optgroup>

                        {/* Fallback if current value is outside defined groups */}
                        {plan.proposedFzf.value &&
                          !plan.deptIwColleagues.some(c => `p:${c.id}` === plan.proposedFzf.value) &&
                          `p:${plan.plannedFzf.personId}` !== plan.proposedFzf.value &&
                          !ownPersonnel.some(p => `p:${p.id}` === plan.proposedFzf.value) &&
                          !foreignPersonnel.some(p => `p:${p.id}` === plan.proposedFzf.value) && (
                            <option value={plan.proposedFzf.value}>
                              {plan.proposedFzf.label || plan.proposedFzf.value}
                            </option>
                        )}
                      </select>

                      <div style={{ marginTop: 4, fontSize: 11, color: '#64748b' }}>
                        {plan.proposedFzf.reason}
                      </div>
                    </div>

                    {/* Maschinist Slot */}
                    <div
                      style={{
                        padding: '10px 12px',
                        borderRadius: 8,
                        minWidth: 0,
                        boxSizing: 'border-box',
                        background: plan.proposedMa.isExternal
                          ? '#eff6ff'
                          : plan.proposedMa.value
                          ? '#f0fdf4'
                          : '#f8fafc',
                        border: plan.proposedMa.isExternal
                          ? '1px dashed #93c5fd'
                          : plan.proposedMa.value
                          ? '1px solid #bbf7d0'
                          : '1px solid #e2e8f0'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>
                          Maschinist (Ma)
                        </span>
                        {plan.proposedMa.isExternal ? (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              background: '#dbeafe',
                              color: '#1d4ed8',
                              padding: '1px 6px',
                              borderRadius: 4
                            }}
                          >
                            Extern (nur Info)
                          </span>
                        ) : plan.proposedMa.value ? (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              background: '#dcfce7',
                              color: '#15803d',
                              padding: '1px 6px',
                              borderRadius: 4
                            }}
                          >
                            Eigene Abt.
                          </span>
                        ) : (
                          <span style={{ fontSize: 10, color: '#94a3b8' }}>Frei</span>
                        )}
                      </div>

                      {/* Interactive Dropdown */}
                      <select
                        value={plan.proposedMa.value || ''}
                        onChange={e => handleDirectSlotChange(plan.date, 'ma', e.target.value)}
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          padding: '6px 8px',
                          borderRadius: 6,
                          fontSize: 13,
                          fontWeight: 600,
                          border: plan.proposedMa.isExternal ? '1.5px dashed #93c5fd' : '1px solid #cbd5e1',
                          background: plan.proposedMa.isExternal ? '#eff6ff' : (plan.proposedMa.value ? '#ffffff' : '#f8fafc'),
                          color: plan.proposedMa.isExternal ? '#1d4ed8' : '#0f172a',
                          fontStyle: plan.proposedMa.isExternal ? 'italic' : 'normal',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="">– Nicht besetzt –</option>

                        {/* Group 1: Colleagues with IW */}
                        {plan.deptIwColleagues.length > 0 && (
                          <optgroup label="Priorität: Eigene Kollegen mit IW">
                            {plan.deptIwColleagues.map(c => (
                              <option key={`iw_${c.id}`} value={`p:${c.id}`}>
                                ⭐ {c.name}
                              </option>
                            ))}
                          </optgroup>
                        )}

                        {/* Group 2: Vorplanung colleague if not already in IW */}
                        {plan.plannedMa.personId && !plan.deptIwColleagues.some(c => c.id === plan.plannedMa.personId) && (
                          <optgroup label="Vorplanung">
                            <option value={`p:${plan.plannedMa.personId}`}>
                              📅 {plan.plannedMa.name} {plan.plannedMa.isOwnDept ? '' : `[${plan.plannedMa.deptCode}. Abt. - Info]`}
                            </option>
                          </optgroup>
                        )}

                        {/* Group 3: All own department colleagues */}
                        <optgroup label="Eigene Abteilung">
                          {ownPersonnel.map(p => (
                            <option key={`own_${p.id}`} value={`p:${p.id}`}>
                              {p.name}
                            </option>
                          ))}
                        </optgroup>

                        {/* Group 4: Partner departments (only info) */}
                        <optgroup label="Partner-Abteilungen (Extern - nur Info)">
                          {foreignPersonnel.map(p => {
                            const pDept = normalizeDeptCode(p.department);
                            return (
                              <option key={`ext_${p.id}`} value={`p:${p.id}`}>
                                {p.name} [{pDept}. Abt.]
                              </option>
                            );
                          })}
                        </optgroup>

                        {/* Fallback if current value is outside defined groups */}
                        {plan.proposedMa.value &&
                          !plan.deptIwColleagues.some(c => `p:${c.id}` === plan.proposedMa.value) &&
                          `p:${plan.plannedMa.personId}` !== plan.proposedMa.value &&
                          !ownPersonnel.some(p => `p:${p.id}` === plan.proposedMa.value) &&
                          !foreignPersonnel.some(p => `p:${p.id}` === plan.proposedMa.value) && (
                            <option value={plan.proposedMa.value}>
                              {plan.proposedMa.label || plan.proposedMa.value}
                            </option>
                        )}
                      </select>

                      <div style={{ marginTop: 4, fontSize: 11, color: '#64748b' }}>
                        {plan.proposedMa.reason}
                      </div>
                    </div>

                    {/* Arzt Slot */}
                    <div
                      style={{
                        padding: '10px 12px',
                        borderRadius: 8,
                        minWidth: 0,
                        boxSizing: 'border-box',
                        background: '#faf5ff',
                        border: '1px solid #e9d5ff'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#6b21a8' }}>
                          Notarzt (ITW-Dienstplan)
                        </span>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            background: '#f3e8ff',
                            color: '#7e22ce',
                            padding: '1px 6px',
                            borderRadius: 4
                          }}
                        >
                          Nur Info
                        </span>
                      </div>

                      {/* Interactive Dropdown */}
                      <select
                        value={plan.proposedDoctor.value || ''}
                        onChange={e => handleDirectSlotChange(plan.date, 'doctor', e.target.value)}
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          padding: '6px 8px',
                          borderRadius: 6,
                          fontSize: 13,
                          fontWeight: 600,
                          border: '1px solid #d8b4fe',
                          background: '#ffffff',
                          color: '#7e22ce',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="">– Kein Arzt –</option>
                        {itwDoctors.map(doc => {
                          const formatted = formatDoctorName(doc);
                          return (
                            <option key={`doc_${doc.id}`} value={`d:${doc.id}`}>
                              🩺 {formatted} [Notarzt]
                            </option>
                          );
                        })}
                        {/* Fallback if doctor is not in itwDoctors list */}
                        {plan.proposedDoctor.value &&
                          !itwDoctors.some(d => `d:${d.id}` === plan.proposedDoctor.value) && (
                            <option value={plan.proposedDoctor.value}>
                              {plan.proposedDoctor.label || plan.proposedDoctor.value}
                            </option>
                        )}
                      </select>

                      <div style={{ marginTop: 4, fontSize: 11, color: '#64748b' }}>
                        {plan.proposedDoctor.reason}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid #e2e8f0',
            background: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16
          }}
        >
          <div style={{ fontSize: 13, color: '#475569' }}>
            {conflictDays.length > 0 ? (
              <span style={{ color: '#b45309', fontWeight: 600 }}>
                ⚠️ {conflictDays.length} Tag(e) mit Klärungsbedarf – bitte vor Übernahme prüfen.
              </span>
            ) : (
              <span style={{ color: '#15803d', fontWeight: 600 }}>
                ✓ Alle {totalDays} ITW-Tage sind vollständig zugeordnet und bereit zur Übernahme.
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 18px',
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                background: '#fff',
                color: '#475569',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 13
              }}
            >
              Abbrechen
            </button>

            <button
              type="button"
              onClick={() => onConfirm(plans)}
              style={{
                padding: '8px 20px',
                borderRadius: 6,
                border: 'none',
                background: '#0284c7',
                color: '#fff',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: 13,
                boxShadow: '0 2px 4px rgba(2, 132, 199, 0.25)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              <span>⚡</span>
              Einteilung übernehmen ({plans.length} Tage)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
