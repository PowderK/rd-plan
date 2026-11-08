import React, { useState, useEffect } from 'react';
import { ReplacementFinderResult, ReplacementCandidate, ExcludedCandidate } from '../utils/replacementFinder';

interface WhoIsNextModalProps {
    result: ReplacementFinderResult | null;
    currentAssignedName?: string;
    onAssign: (personId: number) => void;
    onClose: () => void;
}

export const WhoIsNextModal: React.FC<WhoIsNextModalProps> = ({
    result,
    currentAssignedName,
    onAssign,
    onClose
}) => {
    const [showExcluded, setShowExcluded] = useState(false);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    if (!result) return null;

    // Formatiere deutsches Datum (z.B. "Samstag, 14.11.2026")
    const dateFormatted = (() => {
        try {
            const [y, m, d] = result.date.split('-').map(Number);
            const dateObj = new Date(Date.UTC(y, m - 1, d));
            return dateObj.toLocaleDateString('de-DE', {
                weekday: 'long',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                timeZone: 'UTC'
            });
        } catch {
            return result.date;
        }
    })();

    const shiftTime = result.isTag ? '07:00 – 19:00 Uhr (12h)' : '19:00 – 07:00 Uhr (12h)';

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16
        }}>
            <div style={{
                background: 'var(--card-bg, #ffffff)',
                color: 'var(--text, #1e293b)',
                borderRadius: 12,
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
                width: '100%',
                maxWidth: 720,
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                border: '1px solid var(--line, #e2e8f0)'
            }}>
                {/* Header */}
                <div style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid var(--line, #e2e8f0)',
                    background: 'linear-gradient(to right, #1e3a8a, #2563eb)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 20 }}>🔍</span>
                            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: '0.2px' }}>
                                Wer ist dran? – Nachrücker-Suche
                            </h2>
                        </div>
                        <div style={{ fontSize: 13, marginTop: 4, opacity: 0.9 }}>
                            <strong>{result.vehicleName}</strong> • {result.slotLabel} • {dateFormatted} ({shiftTime})
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        title="Schließen (ESC)"
                        style={{
                            background: 'rgba(255, 255, 255, 0.15)',
                            border: 'none',
                            color: '#ffffff',
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            fontSize: 16,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        ✕
                    </button>
                </div>

                {/* Ausfall-Hinweis falls vorhanden */}
                {currentAssignedName && (
                    <div style={{
                        padding: '10px 20px',
                        background: '#fef2f2',
                        borderBottom: '1px solid #fee2e2',
                        color: '#991b1b',
                        fontSize: 13,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8
                    }}>
                        <span>⚠️</span>
                        <span>
                            Ausfall / Ersatz für: <strong>{currentAssignedName}</strong>
                        </span>
                    </div>
                )}

                {/* Body Content */}
                <div style={{
                    padding: '16px 20px',
                    overflowY: 'auto',
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12
                }}>
                    {result.candidates.length === 0 ? (
                        <div style={{
                            padding: 24,
                            textAlign: 'center',
                            background: 'var(--hover, #f8fafc)',
                            borderRadius: 8,
                            border: '1px dashed var(--line, #cbd5e1)'
                        }}>
                            <div style={{ fontSize: 28, marginBottom: 8 }}>🚫</div>
                            <div style={{ fontSize: 15, fontWeight: 600 }}>Keine verfügbaren Wachkollegen gefunden</div>
                            <div style={{ fontSize: 13, color: 'var(--muted, #64748b)', marginTop: 4 }}>
                                An diesem Tag hat kein Kollege mit 24h-Wachdienst ('V') und passender Qualifikation freie Kapazitäten.
                            </div>
                        </div>
                    ) : (
                        <>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted, #64748b)' }}>
                                {result.candidates.length} verfügbare Wachkollegen (mit 'V' auf Wache) nach Score gereiht:
                            </div>

                            {result.candidates.map((c, idx) => {
                                const rank = idx + 1;
                                const isTop = rank === 1;

                                return (
                                    <div
                                        key={c.personId}
                                        style={{
                                            border: isTop ? '2px solid #3b82f6' : '1px solid var(--line, #e2e8f0)',
                                            borderRadius: 8,
                                            padding: '12px 16px',
                                            background: isTop ? 'var(--card-bg-highlight, #eff6ff)' : 'var(--card-bg, #ffffff)',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: 8,
                                            boxShadow: isTop ? '0 4px 6px -1px rgba(59, 130, 246, 0.1)' : 'none'
                                        }}
                                    >
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            gap: 12
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                {/* Rank Badge */}
                                                <div style={{
                                                    width: 28,
                                                    height: 28,
                                                    borderRadius: '50%',
                                                    background: isTop ? '#2563eb' : 'var(--line, #cbd5e1)',
                                                    color: isTop ? '#ffffff' : 'var(--text, #1e293b)',
                                                    fontSize: 13,
                                                    fontWeight: 700,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}>
                                                    {rank}
                                                </div>

                                                <div>
                                                    <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text, #0f172a)' }}>
                                                        {c.displayName}
                                                    </span>
                                                    {isTop && (
                                                        <span style={{
                                                            marginLeft: 8,
                                                            fontSize: 11,
                                                            fontWeight: 600,
                                                            background: '#dbeafe',
                                                            color: '#1d4ed8',
                                                            padding: '2px 8px',
                                                            borderRadius: 12
                                                        }}>
                                                            Empfehlung
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                {/* Score */}
                                                <div style={{ textAlign: 'right' }}>
                                                    <div style={{ fontSize: 14, fontWeight: 700, color: isTop ? '#1d4ed8' : 'var(--text, #1e293b)' }}>
                                                        {c.totalScore} Pkt.
                                                    </div>
                                                    <div style={{ fontSize: 10, color: 'var(--muted, #64748b)' }}>
                                                        Gesamt-Score
                                                    </div>
                                                </div>

                                                {/* Direct Assign Button */}
                                                <button
                                                    onClick={() => onAssign(c.personId)}
                                                    style={{
                                                        padding: '7px 14px',
                                                        borderRadius: 6,
                                                        background: isTop ? '#2563eb' : '#0f172a',
                                                        color: '#ffffff',
                                                        border: 'none',
                                                        fontSize: 13,
                                                        fontWeight: 600,
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 6,
                                                        transition: 'opacity 0.15s ease'
                                                    }}
                                                    onMouseOver={e => (e.currentTarget.style.opacity = '0.9')}
                                                    onMouseOut={e => (e.currentTarget.style.opacity = '1')}
                                                >
                                                    <span>Zuweisen</span>
                                                    <span>→</span>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Reasons / Badges */}
                                        <div style={{
                                            display: 'flex',
                                            flexWrap: 'wrap',
                                            gap: 6,
                                            paddingTop: 4
                                        }}>
                                            {c.badges.map((b, bIdx) => {
                                                const isBonus = b.type === 'bonus';
                                                const isPen = b.type === 'penalty';
                                                const bg = isBonus ? '#ecfdf5' : (isPen ? '#fef2f2' : '#f8fafc');
                                                const col = isBonus ? '#065f46' : (isPen ? '#991b1b' : '#475569');
                                                const borderCol = isBonus ? '#a7f3d0' : (isPen ? '#fecaca' : '#e2e8f0');

                                                return (
                                                    <span
                                                        key={bIdx}
                                                        style={{
                                                            fontSize: 11,
                                                            fontWeight: 500,
                                                            background: bg,
                                                            color: col,
                                                            border: `1px solid ${borderCol}`,
                                                            padding: '2px 8px',
                                                            borderRadius: 4
                                                        }}
                                                    >
                                                        {b.text}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </>
                    )}

                    {/* Excluded Section */}
                    {result.excluded.length > 0 && (
                        <div style={{ marginTop: 8, borderTop: '1px solid var(--line, #e2e8f0)', paddingTop: 10 }}>
                            <button
                                type="button"
                                onClick={() => setShowExcluded(!showExcluded)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--muted, #64748b)',
                                    fontSize: 12,
                                    cursor: 'pointer',
                                    padding: '4px 0',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6
                                }}
                            >
                                <span>{showExcluded ? '▼' : '▶'}</span>
                                <span>{result.excluded.length} nicht verfügbare Kollegen ausblenden / anzeigen</span>
                            </button>

                            {showExcluded && (
                                <div style={{
                                    marginTop: 8,
                                    background: 'var(--hover, #f8fafc)',
                                    borderRadius: 6,
                                    padding: '8px 12px',
                                    fontSize: 12,
                                    color: 'var(--muted, #64748b)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 4
                                }}>
                                    {result.excluded.map(ex => (
                                        <div key={ex.personId} style={{ display: 'flex', gap: 8 }}>
                                            <span style={{ fontWeight: 600, minWidth: 140 }}>{ex.displayName}:</span>
                                            <span>{ex.reason}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '10px 20px',
                    borderTop: '1px solid var(--line, #e2e8f0)',
                    background: 'var(--hover, #f8fafc)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: 12,
                    color: 'var(--muted, #64748b)'
                }}>
                    <span>Tipp: Ein Klick auf <strong>Zuweisen</strong> trägt den Kollegen direkt ein.</span>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '6px 14px',
                            background: 'transparent',
                            border: '1px solid var(--line, #cbd5e1)',
                            borderRadius: 6,
                            cursor: 'pointer',
                            fontSize: 12,
                            color: 'var(--text, #1e293b)'
                        }}
                    >
                        Abbrechen
                    </button>
                </div>
            </div>
        </div>
    );
};
