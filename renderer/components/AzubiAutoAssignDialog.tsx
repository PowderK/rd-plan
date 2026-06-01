import React, { useState } from 'react';

export interface ProposedAssignment {
    azubiId: number;
    azubiName: string;
    lehrjahr: number;
    proposedSlot: string;
}

export interface ConflictAzubi {
    azubiId: number;
    azubiName: string;
    lehrjahr: number;
    reason: string;
}

export interface ShiftSummary {
    date: string;
    shift: 'tag' | 'nacht';
    assignments: ProposedAssignment[];
    conflicts: ConflictAzubi[];
    availableFallbackSlots: { id: string; label: string }[];
}

interface AzubiAutoAssignDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (finalAssignments: { azubiId: number; date: string; slotId: string }[]) => void;
    summaries: ShiftSummary[];
}

export const AzubiAutoAssignDialog: React.FC<AzubiAutoAssignDialogProps> = ({
    isOpen,
    onClose,
    onConfirm,
    summaries
}) => {
    // Map of "date_shift_azubiId" -> "slotId" for manual conflict resolutions
    const [resolutions, setResolutions] = useState<Record<string, string>>({});

    if (!isOpen) return null;

    const totalProposed = summaries.reduce((acc, s) => acc + s.assignments.length, 0);
    const totalConflicts = summaries.reduce((acc, s) => acc + s.conflicts.length, 0);

    const handleConfirm = () => {
        const finalResults: { azubiId: number; date: string; slotId: string }[] = [];
        
        summaries.forEach(s => {
            s.assignments.forEach(a => {
                finalResults.push({ azubiId: a.azubiId, date: s.date, slotId: a.proposedSlot });
            });
            s.conflicts.forEach(c => {
                const key = `${s.date}_${s.shift}_${c.azubiId}`;
                const chosenSlot = resolutions[key];
                if (chosenSlot && chosenSlot !== 'skip') {
                    finalResults.push({ azubiId: c.azubiId, date: s.date, slotId: chosenSlot });
                }
            });
        });

        onConfirm(finalResults);
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        }}>
            <div style={{
                background: 'var(--bg)',
                borderRadius: '8px',
                width: '800px',
                maxWidth: '90%',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                border: '1px solid var(--border)'
            }}>
                <div style={{ padding: '20px', borderBottom: '1px solid var(--border)' }}>
                    <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Automatische Azubi-Einteilung</h2>
                </div>
                
                <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
                    <div style={{ 
                        background: totalConflicts > 0 ? '#fff3e0' : '#e8f5e9',
                        padding: '12px 16px',
                        borderRadius: '6px',
                        marginBottom: '20px',
                        color: totalConflicts > 0 ? '#e65100' : '#2e7d32',
                        fontWeight: 500
                    }}>
                        {totalProposed} Azubis können automatisch verplant werden.
                        {totalConflicts > 0 && ` Es gibt ${totalConflicts} ungelöste Konflikte (zu wenig Standard-Plätze).`}
                    </div>

                    {summaries.map(s => {
                        if (s.assignments.length === 0 && s.conflicts.length === 0) return null;
                        
                        return (
                            <div key={`${s.date}_${s.shift}`} style={{ marginBottom: '24px' }}>
                                <h3 style={{ borderBottom: '1px solid var(--border)', paddingBottom: '4px', marginBottom: '12px', fontSize: '1rem' }}>
                                    {new Date(s.date).toLocaleDateString('de-DE')} - {s.shift === 'tag' ? 'Tagesschicht' : 'Nachtschicht'}
                                </h3>
                                
                                {s.assignments.length > 0 && (
                                    <div style={{ marginBottom: '12px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                        <strong>Regulär eingeteilt: </strong>
                                        {s.assignments.map(a => `${a.azubiName} (LJ ${a.lehrjahr}) -> ${a.proposedSlot}`).join(', ')}
                                    </div>
                                )}
                                
                                {s.conflicts.length > 0 && (
                                    <div style={{ background: 'var(--bg-accent)', padding: '12px', borderRadius: '6px' }}>
                                        <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: '#c62828' }}>Konflikte lösen:</h4>
                                        {s.conflicts.map(c => {
                                            const key = `${s.date}_${s.shift}_${c.azubiId}`;
                                            return (
                                                <div key={key} style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', gap: '12px' }}>
                                                    <div style={{ width: '250px', fontWeight: 500 }}>
                                                        {c.azubiName} (LJ {c.lehrjahr})
                                                    </div>
                                                    <div style={{ flex: 1 }}>
                                                        <select 
                                                            value={resolutions[key] || 'skip'}
                                                            onChange={e => setResolutions({ ...resolutions, [key]: e.target.value })}
                                                            style={{
                                                                padding: '6px',
                                                                borderRadius: '4px',
                                                                border: '1px solid var(--border)',
                                                                background: 'var(--bg)',
                                                                width: '100%'
                                                            }}
                                                        >
                                                            <option value="skip">Nicht einteilen (auslassen)</option>
                                                            {s.availableFallbackSlots.map(slot => (
                                                                <option key={slot.id} value={slot.id}>{slot.label}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button 
                        onClick={onClose}
                        style={{
                            padding: '8px 16px',
                            background: 'transparent',
                            border: '1px solid var(--border)',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        Abbrechen
                    </button>
                    <button 
                        onClick={handleConfirm}
                        style={{
                            padding: '8px 16px',
                            background: '#0284c7',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: 600
                        }}
                    >
                        Einteilung Anwenden
                    </button>
                </div>
            </div>
        </div>
    );
};
