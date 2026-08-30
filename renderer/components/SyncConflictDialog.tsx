import React, { useState } from 'react';

export interface AvailabilityConflictItem {
  personId?: number;
  personType?: 'person' | 'azubi';
  personName: string;
  date: string;
  formattedDate?: string;
  dutyRosterValue: string;
  einteilungValue: string;
  conflictType?: 'removed_from_roster' | 'unavailable_shift';
  reason?: string;
}

export interface MissingPersonnelItem {
  id: number;
  name: string;
  vorname: string;
  displayName: string;
}

export interface PersonnelSyncStats {
  total: number;
  matched: number;
  missing: number;
}

interface SyncConflictDialogProps {
  isOpen: boolean;
  conflicts?: AvailabilityConflictItem[];
  missingPersonnel?: MissingPersonnelItem[];
  personnelSyncStats?: PersonnelSyncStats;
  title?: string;
  subtitle?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isProcessing?: boolean;
}

export const SyncConflictDialog: React.FC<SyncConflictDialogProps> = ({
  isOpen,
  conflicts = [],
  missingPersonnel = [],
  personnelSyncStats,
  title = 'Vorprüfung der Dienstplan-Synchronisation',
  subtitle,
  onConfirm,
  onCancel,
  isProcessing = false,
}) => {
  const [filterText, setFilterText] = useState('');

  if (!isOpen) return null;

  const hasConflicts = conflicts.length > 0;
  const hasMissingPersonnel = missingPersonnel.length > 0;

  const filteredConflicts = conflicts.filter(c => {
    if (!filterText.trim()) return true;
    const q = filterText.toLowerCase();
    return (
      (c.personName || '').toLowerCase().includes(q) ||
      (c.date || '').toLowerCase().includes(q) ||
      (c.formattedDate || '').toLowerCase().includes(q) ||
      (c.einteilungValue || '').toLowerCase().includes(q) ||
      (c.dutyRosterValue || '').toLowerCase().includes(q) ||
      (c.reason || '').toLowerCase().includes(q)
    );
  });

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(3px)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isProcessing) onCancel();
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--bg, #ffffff)',
          color: 'var(--text, #1e293b)',
          borderRadius: '10px',
          maxWidth: '860px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.3)',
          border: '1px solid var(--line, #e2e8f0)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            backgroundColor: '#ffffff',
            borderBottom: '1px solid #e2e8f0',
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: '17px',
              fontWeight: 700,
              color: '#0f172a',
            }}
          >
            {title}
          </h3>
          <p
            style={{
              margin: '4px 0 0 0',
              fontSize: '13px',
              color: '#64748b',
            }}
          >
            {subtitle || (
              hasConflicts
                ? `${conflicts.length} Verfügbarkeitskonflikt(e) festgestellt.`
                : 'Vorprüfung der Vorplanung und des Stammpersonals abgeschlossen.'
            )}
          </p>
        </div>

        {/* Content */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '18px' }}>
          
          {/* Section 1: Stammpersonal Synchronisations-Check */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Stammpersonal-Abgleich
            </div>

            {hasMissingPersonnel ? (
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: '6px',
                  backgroundColor: '#fffbeb',
                  border: '1px solid #fde68a',
                  fontSize: '13px',
                  color: '#92400e',
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: '6px' }}>
                  {missingPersonnel.length} von {personnelSyncStats?.total || (missingPersonnel.length + (personnelSyncStats?.matched || 0))} Mitarbeiter(n) nicht in der Vorplanung gefunden:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '90px', overflowY: 'auto' }}>
                  {missingPersonnel.map((p, idx) => (
                    <span
                      key={idx}
                      style={{
                        display: 'inline-block',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        background: '#ffffff',
                        border: '1px solid #fcd34d',
                        fontWeight: 500,
                        fontSize: '12px',
                        color: '#78350f',
                      }}
                    >
                      {p.displayName}
                    </span>
                  ))}
                </div>
              </div>
            ) : personnelSyncStats ? (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '6px',
                  backgroundColor: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  fontSize: '13px',
                  color: '#166534',
                }}
              >
                <strong>Vollständig:</strong> Alle {personnelSyncStats.total} aktiven Mitarbeiter der Abteilung wurden in der Vorplanung gefunden und abgeglichen.
              </div>
            ) : null}
          </div>

          {/* Section 2: Verfügbarkeitskonflikte (Einteilung) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Fahrzeug-Einteilung ({conflicts.length} Konflikte)
            </div>

            {hasConflicts ? (
              <>
                {/* Filter bar if more than 4 conflicts */}
                {conflicts.length > 4 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="text"
                      placeholder="Konflikte filtern (Name, Datum, Fahrzeug)..."
                      value={filterText}
                      onChange={(e) => setFilterText(e.target.value)}
                      style={{
                        flex: 1,
                        padding: '7px 11px',
                        borderRadius: '5px',
                        border: '1px solid #cbd5e1',
                        fontSize: '12.5px',
                      }}
                    />
                    {filterText && (
                      <button
                        onClick={() => setFilterText('')}
                        style={{
                          padding: '6px 11px',
                          borderRadius: '5px',
                          border: '1px solid #cbd5e1',
                          background: '#fff',
                          cursor: 'pointer',
                          fontSize: '12px',
                        }}
                      >
                        Zurücksetzen
                      </button>
                    )}
                  </div>
                )}

                {/* Conflicts Table */}
                <div
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    overflow: 'auto',
                    maxHeight: '280px',
                  }}
                >
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: '12.5px',
                      textAlign: 'left',
                    }}
                  >
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <th style={{ padding: '9px 12px', fontWeight: 600, color: '#475569' }}>Datum</th>
                        <th style={{ padding: '9px 12px', fontWeight: 600, color: '#475569' }}>Kollege / Kollegin</th>
                        <th style={{ padding: '9px 12px', fontWeight: 600, color: '#475569' }}>Bisherige Einteilung</th>
                        <th style={{ padding: '9px 12px', fontWeight: 600, color: '#475569' }}>Vorplanung (Excel)</th>
                        <th style={{ padding: '9px 12px', fontWeight: 600, color: '#475569' }}>Auswirkung</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredConflicts.map((c, index) => {
                        const isRemoved = c.conflictType === 'removed_from_roster' || !c.dutyRosterValue || c.dutyRosterValue.includes('Aus Vorplanung');
                        
                        return (
                          <tr
                            key={index}
                            style={{
                              borderBottom: '1px solid #f1f5f9',
                              backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8fafc',
                            }}
                          >
                            {/* Datum */}
                            <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', fontWeight: 500 }}>
                              {c.formattedDate || c.date}
                            </td>

                            {/* Name */}
                            <td style={{ padding: '8px 12px', fontWeight: 600, color: '#1e293b' }}>
                              {c.personName}
                            </td>

                            {/* Einteilung */}
                            <td style={{ padding: '8px 12px' }}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '2px 7px',
                                  borderRadius: '4px',
                                  background: '#eff6ff',
                                  color: '#1d4ed8',
                                  border: '1px solid #bfdbfe',
                                  fontWeight: 500,
                                  fontSize: '11.5px',
                                }}
                              >
                                {c.einteilungValue}
                              </span>
                            </td>

                            {/* Vorplanung */}
                            <td style={{ padding: '8px 12px' }}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '2px 7px',
                                  borderRadius: '4px',
                                  background: isRemoved ? '#fef2f2' : '#fffbeb',
                                  color: isRemoved ? '#b91c1c' : '#b45309',
                                  border: `1px solid ${isRemoved ? '#fecaca' : '#fde68a'}`,
                                  fontWeight: 600,
                                  fontSize: '11.5px',
                                }}
                              >
                                {c.dutyRosterValue || 'Kein Dienst'}
                              </span>
                            </td>

                            {/* Auswirkung */}
                            <td style={{ padding: '8px 12px', color: '#dc2626', fontSize: '11.5px', fontWeight: 500 }}>
                              Wird aus Einteilung entfernt
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '6px',
                  backgroundColor: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  fontSize: '13px',
                  color: '#166534',
                }}
              >
                <strong>Keine Einteilungs-Konflikte:</strong> Alle eingeteilten Kollegen sind in der Vorplanung verfügbar.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 24px',
            backgroundColor: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            Abbrechen wählen, um keine Änderungen vorzunehmen.
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {/* Cancel Button */}
            <button
              onClick={onCancel}
              disabled={isProcessing}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#334155',
                fontSize: '13px',
                fontWeight: 600,
                cursor: isProcessing ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (!isProcessing) {
                  e.currentTarget.style.backgroundColor = '#f1f5f9';
                  e.currentTarget.style.borderColor = '#94a3b8';
                }
              }}
              onMouseLeave={(e) => {
                if (!isProcessing) {
                  e.currentTarget.style.backgroundColor = '#ffffff';
                  e.currentTarget.style.borderColor = '#cbd5e1';
                }
              }}
            >
              Abbrechen
            </button>

            {/* Confirm Button */}
            <button
              onClick={onConfirm}
              disabled={isProcessing}
              style={{
                padding: '8px 18px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 600,
                cursor: isProcessing ? 'not-allowed' : 'pointer',
                boxShadow: '0 1px 3px rgba(37, 99, 235, 0.25)',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (!isProcessing) {
                  e.currentTarget.style.backgroundColor = '#1d4ed8';
                }
              }}
              onMouseLeave={(e) => {
                if (!isProcessing) {
                  e.currentTarget.style.backgroundColor = '#2563eb';
                }
              }}
            >
              {isProcessing
                ? 'Synchronisiere...'
                : hasConflicts
                  ? 'Synchronisation durchführen & Einteilung bereinigen'
                  : 'Synchronisation durchführen'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
export default SyncConflictDialog;
