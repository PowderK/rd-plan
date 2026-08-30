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

interface SyncConflictDialogProps {
  isOpen: boolean;
  conflicts: AvailabilityConflictItem[];
  title?: string;
  subtitle?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isProcessing?: boolean;
}

export const SyncConflictDialog: React.FC<SyncConflictDialogProps> = ({
  isOpen,
  conflicts,
  title = 'Konflikte bei der Dienstplan-Synchronisation',
  subtitle,
  onConfirm,
  onCancel,
  isProcessing = false,
}) => {
  const [filterText, setFilterText] = useState('');

  if (!isOpen) return null;

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
          maxWidth: '860px',
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
            padding: '20px 24px',
            background: 'linear-gradient(to right, #fffbeb, #fef3c7)',
            borderBottom: '1px solid #fde68a',
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
              backgroundColor: '#f59e0b',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px',
              flexShrink: 0,
              boxShadow: '0 2px 6px rgba(245, 158, 11, 0.35)',
            }}
          >
            ⚠️
          </div>
          <div style={{ flex: 1 }}>
            <h3
              style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: 700,
                color: '#92400e',
              }}
            >
              {title}
            </h3>
            <p
              style={{
                margin: '3px 0 0 0',
                fontSize: '13px',
                color: '#b45309',
              }}
            >
              {subtitle || `${conflicts.length} Verfügbarkeitskonflikt(e) zwischen Vorplanung und Fahrzeug-Einteilung festgestellt.`}
            </p>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Explanation Box */}
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '8px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              fontSize: '13.5px',
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

          {/* Search / Filter bar if more than 4 conflicts */}
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
              maxHeight: '340px',
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
              {isProcessing ? 'Synchronisiere...' : '✓ Synchronisation durchführen & Einteilung bereinigen'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
export default SyncConflictDialog;
