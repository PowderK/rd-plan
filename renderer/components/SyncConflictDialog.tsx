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
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
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
          borderRadius: '12px',
          maxWidth: '880px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          border: '1px solid var(--line, #e2e8f0)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            background: hasConflicts
              ? 'linear-gradient(to right, #fffbeb, #fef3c7)'
              : 'linear-gradient(to right, #eff6ff, #f8fafc)',
            borderBottom: hasConflicts ? '1px solid #fde68a' : '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              backgroundColor: hasConflicts ? '#f59e0b' : '#3b82f6',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px',
              flexShrink: 0,
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.15)',
            }}
          >
            {hasConflicts ? '⚠️' : 'ℹ️'}
          </div>
          <div style={{ flex: 1 }}>
            <h3
              style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: 700,
                color: hasConflicts ? '#92400e' : '#1e3a8a',
              }}
            >
              {title}
            </h3>
            <p
              style={{
                margin: '3px 0 0 0',
                fontSize: '13px',
                color: hasConflicts ? '#b45309' : '#475569',
              }}
            >
              {subtitle || (
                hasConflicts
                  ? `${conflicts.length} Verfügbarkeitskonflikt(e) zwischen Vorplanung und Fahrzeug-Einteilung festgestellt.`
                  : 'Vorprüfung der Vorplanung und des Stammpersonals abgeschlossen.'
              )}
            </p>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Section 1: Stammpersonal Synchronisations-Check */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#334155' }}>
              👤 Stammpersonal-Abgleich (Vorhandensein in Excel):
            </h4>

            {/* Case: Stammpersonal aus DB nicht in Excel gefunden */}
            {hasMissingPersonnel ? (
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: '8px',
                  backgroundColor: '#fffbeb',
                  border: '1px solid #fde68a',
                  fontSize: '13px',
                  color: '#92400e',
                }}
              >
                <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <span>ℹ️</span>
                  <span>
                    {missingPersonnel.length} von {personnelSyncStats?.total || (missingPersonnel.length + (personnelSyncStats?.matched || 0))} Mitarbeiter(n) aus dem Stammpersonal nicht in der Excel-Vorplanung gefunden:
                  </span>
                </div>
                <div style={{ marginBottom: '8px', color: '#b45309' }}>
                  Folgende aktive Mitarbeiter aus dem Stammpersonal der Abteilung wurden in der Excel-Vorplanungsdatei nicht gefunden:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '110px', overflowY: 'auto' }}>
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
                <div style={{ marginTop: '8px', fontSize: '12px', color: '#92400e' }}>
                  ➔ Für diese Personen wurden in der Vorplanung keine Schichten gefunden. Falls dies ein Versehen ist, prüfen Sie die Excel-Datei.
                </div>
              </div>
            ) : personnelSyncStats ? (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  backgroundColor: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  fontSize: '13px',
                  color: '#166534',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span style={{ fontSize: '16px' }}>✓</span>
                <span>
                  <strong>Stammpersonal vollständig:</strong> Alle {personnelSyncStats.total} aktiven Mitarbeiter der Abteilung wurden in der Excel-Vorplanung gefunden und abgeglichen.
                </span>
              </div>
            ) : null}
          </div>

          {/* Section 2: Verfügbarkeitskonflikte (Einteilung) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#334155' }}>
              🚑 Fahrzeug-Einteilung Verfügbarkeits-Check:
            </h4>

            {hasConflicts ? (
              <>
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    fontSize: '13px',
                    lineHeight: 1.5,
                    color: '#475569',
                  }}
                >
                  <strong>Was bedeutet dieser Konflikt?</strong>
                  <br />
                  Die unten aufgeführten Kollegen sind aktuell auf ein Fahrzeug eingeteilt, haben jedoch in der neuen Vorplanung <strong>keinen Dienst</strong> (z.&thinsp;B. gelöscht) oder sind als <strong>nicht verfügbar</strong> (z.&thinsp;B. Krank, Urlaub, Frei) markiert.
                  <br />
                  <span style={{ color: '#dc2626', fontWeight: 600 }}>
                    ➔ Beim Fortfahren werden diese Kollegen automatisch aus der Fahrzeug-Einteilung genommen.
                  </span>
                </div>

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
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px',
                      }}
                    />
                    {filterText && (
                      <button
                        onClick={() => setFilterText('')}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
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
                    borderRadius: '8px',
                    overflow: 'auto',
                    maxHeight: '260px',
                  }}
                >
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: '13px',
                      textAlign: 'left',
                    }}
                  >
                    <thead>
                      <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                        <th style={{ padding: '10px 12px', fontWeight: 600, color: '#334155' }}>Datum</th>
                        <th style={{ padding: '10px 12px', fontWeight: 600, color: '#334155' }}>Kollege / Kollegin</th>
                        <th style={{ padding: '10px 12px', fontWeight: 600, color: '#334155' }}>Bisherige Einteilung</th>
                        <th style={{ padding: '10px 12px', fontWeight: 600, color: '#334155' }}>Vorplanung (Excel)</th>
                        <th style={{ padding: '10px 12px', fontWeight: 600, color: '#334155' }}>Konsequenz</th>
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
                            <td style={{ padding: '9px 12px', whiteSpace: 'nowrap', fontWeight: 500 }}>
                              {c.formattedDate || c.date}
                            </td>

                            {/* Name */}
                            <td style={{ padding: '9px 12px', fontWeight: 600, color: '#1e293b' }}>
                              {c.personName}
                            </td>

                            {/* Einteilung */}
                            <td style={{ padding: '9px 12px' }}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '3px 8px',
                                  borderRadius: '4px',
                                  background: '#eff6ff',
                                  color: '#1d4ed8',
                                  border: '1px solid #bfdbfe',
                                  fontWeight: 500,
                                  fontSize: '12px',
                                }}
                              >
                                🚑 {c.einteilungValue}
                              </span>
                            </td>

                            {/* Vorplanung */}
                            <td style={{ padding: '9px 12px' }}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '3px 8px',
                                  borderRadius: '4px',
                                  background: isRemoved ? '#fef2f2' : '#fffbeb',
                                  color: isRemoved ? '#b91c1c' : '#b45309',
                                  border: `1px solid ${isRemoved ? '#fecaca' : '#fde68a'}`,
                                  fontWeight: 600,
                                  fontSize: '12px',
                                }}
                              >
                                {isRemoved ? '❌ ' : '⚠️ '}
                                {c.dutyRosterValue || 'Kein Dienst'}
                              </span>
                            </td>

                            {/* Konsequenz */}
                            <td style={{ padding: '9px 12px', color: '#dc2626', fontSize: '12px', fontWeight: 500 }}>
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
                  borderRadius: '8px',
                  backgroundColor: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  fontSize: '13px',
                  color: '#166534',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span style={{ fontSize: '16px' }}>✓</span>
                <span>
                  <strong>Keine Einteilungs-Konflikte:</strong> Alle eingeteilten Kollegen sind in der Vorplanung verfügbar.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            backgroundColor: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ fontSize: '12.5px', color: '#64748b' }}>
            💡 Falls es in der Vorplanung zu Fehlern kam, klicken Sie auf <strong>Abbrechen</strong>.
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {/* Cancel Button */}
            <button
              onClick={onCancel}
              disabled={isProcessing}
              style={{
                padding: '9px 18px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#334155',
                fontSize: '13.5px',
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
              ✕ Abbrechen (Keine Änderungen)
            </button>

            {/* Confirm Button */}
            <button
              onClick={onConfirm}
              disabled={isProcessing}
              style={{
                padding: '9px 20px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                fontSize: '13.5px',
                fontWeight: 600,
                cursor: isProcessing ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 4px rgba(37, 99, 235, 0.3)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
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
                  ? '✓ Synchronisation durchführen & Einteilung bereinigen'
                  : '✓ Synchronisation durchführen'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
export default SyncConflictDialog;
