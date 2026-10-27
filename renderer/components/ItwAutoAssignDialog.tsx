import React, { useState, useMemo } from 'react';
import {
  ItwDayAutoPlan,
  updateDayPlanChoice
} from '../utils/itwAutoAssign';
import { normalizeDeptCode } from '../utils/itwPatternUtils';

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
  crossDeptPersonnel
}) => {
  const [plans, setPlans] = useState<ItwDayAutoPlan[]>(initialPlans);
  const [filterMode, setFilterMode] = useState<'all' | 'conflicts'>('all');

  const myDeptCode = normalizeDeptCode(departmentName || departmentId);

  const crossPersonMap = useMemo(() => {
    const map = new Map<number, any>();
    (crossDeptPersonnel || []).forEach(p => {
      if (p && p.id != null) map.set(Number(p.id), p);
    });
    return map;
  }, [crossDeptPersonnel]);

  // Sync state if initialPlans changes
  React.useEffect(() => {
    setPlans(initialPlans);
    const hasConflicts = initialPlans.some(p => p.conflictType !== 'none');
    if (hasConflicts) {
      setFilterMode('conflicts');
    } else {
      setFilterMode('all');
    }
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

  const allResolved = plans.every(p => p.resolved);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20
      }}
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: 'var(--bg, #ffffff)',
          color: 'var(--text, #1e293b)',
          borderRadius: 14,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          width: 'min(980px, 95vw)',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid var(--line, #e2e8f0)'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px 16px 24px',
            borderBottom: '1px solid var(--line, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--card-header-bg, #f8fafc)'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  background: '#fef3c7',
                  color: '#d97706',
                  fontSize: 18
                }}
              >
                ⚡
              </span>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
                Automatische ITW-Einteilung
              </h2>
            </div>
            <p style={{ margin: '4px 0 0 44px', fontSize: 13, color: '#64748b' }}>
              Vorschau und Übernahme für <strong>{monthName} {year}</strong> &bull; {departmentName || `${departmentId}. Abteilung`}
            </p>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: 22,
              cursor: 'pointer',
              color: '#94a3b8',
              padding: 4,
              borderRadius: 6
            }}
            title="Schließen"
          >
            &times;
          </button>
        </div>

        {/* Summary KPIs */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12,
            padding: '14px 24px',
            background: '#f1f5f9',
            borderBottom: '1px solid #e2e8f0'
          }}
        >
          <div
            style={{
              background: '#fff',
              padding: '10px 14px',
              borderRadius: 8,
              border: '1px solid #e2e8f0'
            }}
          >
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
              ITW-Tage Gesamt
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#0f172a' }}>{totalDays}</div>
          </div>

          <div
            style={{
              background: '#fff',
              padding: '10px 14px',
              borderRadius: 8,
              border: '1px solid #e2e8f0'
            }}
          >
            <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 600, textTransform: 'uppercase' }}>
              Direkte Übereinstimmung
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#16a34a' }}>{matchDays.length}</div>
          </div>

          <div
            style={{
              background: conflictDays.length > 0 ? '#fffbeb' : '#fff',
              padding: '10px 14px',
              borderRadius: 8,
              border: conflictDays.length > 0 ? '1px solid #fcd34d' : '1px solid #e2e8f0'
            }}
          >
            <div style={{ fontSize: 11, color: conflictDays.length > 0 ? '#b45309' : '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
              Klärungsbedarf
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: conflictDays.length > 0 ? '#d97706' : '#64748b' }}>
              {conflictDays.length}
            </div>
          </div>

          <div
            style={{
              background: '#fff',
              padding: '10px 14px',
              borderRadius: 8,
              border: '1px solid #e2e8f0'
            }}
          >
            <div style={{ fontSize: 11, color: '#2563eb', fontWeight: 600, textTransform: 'uppercase' }}>
              Externe Vorplanungen (Info)
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#2563eb' }}>{externalSlotsCount}</div>
          </div>
        </div>

        {/* Filter Navigation */}
        <div
          style={{
            padding: '10px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--line, #e2e8f0)',
            background: '#fff'
          }}
        >
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setFilterMode('all')}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                border: 'none',
                background: filterMode === 'all' ? '#0284c7' : '#f1f5f9',
                color: filterMode === 'all' ? '#fff' : '#475569',
                cursor: 'pointer'
              }}
            >
              Alle Tage ({totalDays})
            </button>
            <button
              onClick={() => setFilterMode('conflicts')}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                border: 'none',
                background: filterMode === 'conflicts' ? '#d97706' : '#f1f5f9',
                color: filterMode === 'conflicts' ? '#fff' : (conflictDays.length > 0 ? '#b45309' : '#475569'),
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              Nur Klärungsbedarf
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

          <div style={{ fontSize: 12, color: '#64748b' }}>
            {filterMode === 'conflicts' && conflictDays.length === 0
              ? 'Keine Abweichungen oder Konflikte vorhanden.'
              : `${displayedPlans.length} von ${totalDays} Tagen angezeigt`}
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
                Alle ITW-Dienste stimmen mit der Vorplanung überein oder sind eindeutig zuordenbar.
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
                    border: isConflict ? '1.5px solid #f59e0b' : '1px solid #e2e8f0',
                    borderRadius: 10,
                    overflow: 'hidden',
                    background: '#fff',
                    boxShadow: isConflict ? '0 2px 8px rgba(245, 158, 11, 0.12)' : '0 1px 3px rgba(0,0,0,0.04)'
                  }}
                >
                  {/* Card Header */}
                  <div
                    style={{
                      padding: '10px 16px',
                      background: isConflict ? '#fffbeb' : '#f8fafc',
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
                          fontSize: 11,
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
                            fontWeight: 600,
                            color: '#b45309',
                            background: '#fef3c7',
                            padding: '3px 10px',
                            borderRadius: 12,
                            border: '1px solid #fde68a'
                          }}
                        >
                          Klärungsbedarf
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
                          &check; Eindeutig
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Conflict Box (if deviation or multi_iw) */}
                  {isConflict && (
                    <div
                      style={{
                        padding: '12px 16px',
                        background: '#fefce8',
                        borderBottom: '1px solid #fef08a'
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#92400e', marginBottom: 8 }}>
                        {plan.conflictType === 'deviation' && '⚠️ Abweichung gegenüber Vorplanung'}
                        {plan.conflictType === 'multi_iw' && '👥 2 Kollegen mit IW (Eigene Abteilung)'}
                      </div>

                      <div style={{ fontSize: 13, color: '#78350f', marginBottom: 10 }}>
                        {plan.conflictDescription}
                      </div>

                      {/* Interactive Controls */}
                      {plan.conflictType === 'deviation' && plan.deptIwColleagues.length === 1 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
                            Position für {plan.deptIwColleagues[0].name}:
                          </span>

                          <label
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              cursor: 'pointer',
                              fontSize: 13,
                              fontWeight: 500,
                              color: '#1e293b'
                            }}
                          >
                            <input
                              type="radio"
                              name={`dev_role_${plan.date}`}
                              checked={plan.selectedRoleForColleague === 'fzf' || plan.proposedFzf.personId === plan.deptIwColleagues[0].id}
                              onChange={() => handleDeviationChoice(plan.date, 'fzf')}
                            />
                            Fahrzeugführer (FzF)
                          </label>

                          <label
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              cursor: 'pointer',
                              fontSize: 13,
                              fontWeight: 500,
                              color: '#1e293b'
                            }}
                          >
                            <input
                              type="radio"
                              name={`dev_role_${plan.date}`}
                              checked={plan.selectedRoleForColleague === 'ma' || plan.proposedMa.personId === plan.deptIwColleagues[0].id}
                              onChange={() => handleDeviationChoice(plan.date, 'ma')}
                            />
                            Maschinist (Ma)
                          </label>
                        </div>
                      )}

                      {plan.conflictType === 'multi_iw' && plan.deptIwColleagues.length >= 2 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>FzF:</span>
                            <select
                              value={plan.selectedFzfPersonId || plan.proposedFzf.personId || ''}
                              onChange={e => {
                                const newFzfId = Number(e.target.value);
                                const otherColleague = plan.deptIwColleagues.find(c => c.id !== newFzfId);
                                if (otherColleague) {
                                  handleMultiIwChoice(plan.date, newFzfId, otherColleague.id);
                                }
                              }}
                              style={{
                                padding: '4px 8px',
                                borderRadius: 6,
                                border: '1px solid #cbd5e1',
                                fontSize: 13
                              }}
                            >
                              {plan.deptIwColleagues.map(c => (
                                <option key={c.id} value={c.id}>
                                  {c.name} {c.fahrzeugfuehrer ? '(FzF-Qual.)' : ''}
                                </option>
                              ))}
                            </select>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleSwapMultiIw(plan.date)}
                            style={{
                              padding: '4px 10px',
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
                            ⇄ Tauschen
                          </button>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Ma:</span>
                            <select
                              value={plan.selectedMaPersonId || plan.proposedMa.personId || ''}
                              onChange={e => {
                                const newMaId = Number(e.target.value);
                                const otherColleague = plan.deptIwColleagues.find(c => c.id !== newMaId);
                                if (otherColleague) {
                                  handleMultiIwChoice(plan.date, otherColleague.id, newMaId);
                                }
                              }}
                              style={{
                                padding: '4px 8px',
                                borderRadius: 6,
                                border: '1px solid #cbd5e1',
                                fontSize: 13
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

                  {/* 3 Slot Display Cards */}
                  <div
                    style={{
                      padding: '12px 16px',
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
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
                            Extern (Info)
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

                      <div style={{ marginTop: 4, fontWeight: 600, fontSize: 14, color: '#0f172a' }}>
                        {plan.proposedFzf.label || <span style={{ color: '#94a3b8', fontWeight: 400 }}>– nicht besetzt –</span>}
                      </div>

                      <div style={{ marginTop: 2, fontSize: 11, color: '#64748b' }}>
                        {plan.proposedFzf.reason}
                      </div>
                    </div>

                    {/* Maschinist Slot */}
                    <div
                      style={{
                        padding: '10px 12px',
                        borderRadius: 8,
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
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
                            Extern (Info)
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

                      <div style={{ marginTop: 4, fontWeight: 600, fontSize: 14, color: '#0f172a' }}>
                        {plan.proposedMa.label || <span style={{ color: '#94a3b8', fontWeight: 400 }}>– nicht besetzt –</span>}
                      </div>

                      <div style={{ marginTop: 2, fontSize: 11, color: '#64748b' }}>
                        {plan.proposedMa.reason}
                      </div>
                    </div>

                    {/* ITW-Arzt Slot */}
                    <div
                      style={{
                        padding: '10px 12px',
                        borderRadius: 8,
                        background: plan.proposedDoctor.value ? '#faf5ff' : '#f8fafc',
                        border: plan.proposedDoctor.value ? '1px solid #e9d5ff' : '1px solid #e2e8f0'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>
                          ITW-Arzt
                        </span>
                        {plan.proposedDoctor.value ? (
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
                            Arzt (Info)
                          </span>
                        ) : (
                          <span style={{ fontSize: 10, color: '#94a3b8' }}>Frei</span>
                        )}
                      </div>

                      <div style={{ marginTop: 4, fontWeight: 600, fontSize: 14, color: '#0f172a' }}>
                        {plan.proposedDoctor.label || <span style={{ color: '#94a3b8', fontWeight: 400 }}>– kein Arzt vorgeplant –</span>}
                      </div>

                      <div style={{ marginTop: 2, fontSize: 11, color: '#64748b' }}>
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
            padding: '16px 24px',
            borderTop: '1px solid var(--line, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--card-header-bg, #f8fafc)'
          }}
        >
          <div style={{ fontSize: 13, color: '#64748b' }}>
            ℹ️ Externe Kollegen &amp; Ärzte dienen als Information und fließen <strong>nicht</strong> in die RTW-Berechnung ein.
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={onClose}
              style={{
                padding: '8px 18px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                background: '#fff',
                fontSize: 14,
                fontWeight: 600,
                color: '#475569',
                cursor: 'pointer'
              }}
            >
              Abbrechen
            </button>

            <button
              onClick={() => onConfirm(plans)}
              disabled={!allResolved || totalDays === 0}
              style={{
                padding: '8px 20px',
                borderRadius: 8,
                border: 'none',
                background: allResolved && totalDays > 0 ? '#16a34a' : '#94a3b8',
                color: '#fff',
                fontSize: 14,
                fontWeight: 700,
                cursor: allResolved && totalDays > 0 ? 'pointer' : 'not-allowed',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: allResolved && totalDays > 0 ? '0 2px 8px rgba(22, 163, 74, 0.3)' : 'none'
              }}
            >
              <span>⚡</span>
              Einteilung anwenden ({totalDays} Tage)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
