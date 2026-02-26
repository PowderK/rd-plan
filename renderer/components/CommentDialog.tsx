import React, { useState, useEffect } from 'react';

interface CommentDialogProps {
    type: 'personal' | 'global';
    personName?: string;
    date: string; // YYYY-MM-DD
    existingComment?: string;
    canEdit?: boolean;
    canDelete?: boolean;
    onSave: (comment: string) => void;
    onDelete?: () => void;
    onClose: () => void;
}

const CommentDialog: React.FC<CommentDialogProps> = ({
    type,
    personName,
    date,
    existingComment,
    canEdit = true,
    canDelete = true,
    onSave,
    onDelete,
    onClose,
}) => {
    const [comment, setComment] = useState(existingComment || '');
    const maxLength = type === 'global' ? 300 : 200;

    // Format date nicely
    const formattedDate = (() => {
        try {
            const d = new Date(date + 'T00:00:00');
            return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
        } catch { return date; }
    })();

    const title = type === 'global'
        ? `Globaler Kommentar für ${formattedDate}`
        : `Kommentar für ${personName} am ${formattedDate}`;

    const subtitle = type === 'global'
        ? 'Dieser Kommentar ist für alle sichtbar'
        : undefined;

    useEffect(() => {
        setComment(existingComment || '');
    }, [existingComment]);

    const handleSave = () => {
        const trimmed = comment.trim();
        if (!trimmed) return;
        onSave(trimmed);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSave(); }
    };

    return (
        <div
            style={{
                position: 'fixed', inset: 0, zIndex: 10000,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(0,0,0,0.45)',
            }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div
                style={{
                    background: 'var(--bg, #fff)',
                    border: '1px solid var(--border, #e5e7eb)',
                    borderRadius: 10,
                    boxShadow: '0 10px 24px rgba(0,0,0,0.18)',
                    minWidth: 400,
                    maxWidth: 520,
                    padding: '24px 28px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 14,
                }}
                onKeyDown={handleKeyDown}
            >
                {/* Header */}
                <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text, #111)', marginBottom: subtitle ? 4 : 0 }}>
                        {title}
                    </div>
                    {subtitle && (
                        <div style={{ fontSize: 12, color: '#6b7280', fontStyle: 'italic' }}>{subtitle}</div>
                    )}
                </div>

                {/* Textarea */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted, #374151)' }}>Kommentar:</label>
                    <textarea
                        autoFocus
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        disabled={!canEdit}
                        maxLength={maxLength}
                        rows={4}
                        style={{
                            width: '100%',
                            padding: '8px 10px',
                            borderRadius: 6,
                            border: '1px solid var(--border, #d1d5db)',
                            fontSize: 13,
                            fontFamily: 'inherit',
                            resize: 'vertical',
                            minHeight: 80,
                            background: canEdit ? 'var(--bg-input, #f9fafb)' : 'var(--bg, #fff)',
                            color: 'var(--text, #111)',
                            outline: 'none',
                            boxSizing: 'border-box',
                            opacity: canEdit ? 1 : 0.8,
                            cursor: canEdit ? 'text' : 'not-allowed',
                        }}
                        placeholder={type === 'global'
                            ? 'z.B. Betriebsversammlung 14:00 Uhr – alle Schichten enden 13:30'
                            : 'z.B. Keine Nachtschicht – Arzttermin morgens'}
                    />
                    <div style={{ fontSize: 11, color: '#9ca3af', textAlign: 'right' }}>
                        {comment.length}/{maxLength} Zeichen
                    </div>
                </div>

                {/* Buttons */}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                    {canDelete && onDelete && existingComment && (
                        <button
                            onClick={onDelete}
                            style={{
                                marginRight: 'auto',
                                padding: '6px 14px', borderRadius: 6, border: '1px solid #fca5a5',
                                background: '#fef2f2', color: '#b91c1c', fontSize: 12, cursor: 'pointer', fontWeight: 600,
                            }}
                        >
                            🗑️ Löschen
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        style={{
                            padding: '6px 16px', borderRadius: 6, border: '1px solid var(--border, #d1d5db)',
                            background: 'var(--bg, #f3f4f6)', color: 'var(--text, #374151)', fontSize: 13, cursor: 'pointer',
                        }}
                    >
                        {canEdit ? 'Abbrechen' : 'Schließen'}
                    </button>
                    {canEdit && (
                        <button
                            onClick={handleSave}
                            disabled={!comment.trim()}
                            style={{
                                padding: '6px 18px', borderRadius: 6, border: 'none',
                                background: comment.trim() ? '#2563eb' : '#9ca3af', color: '#fff',
                                fontSize: 13, cursor: comment.trim() ? 'pointer' : 'not-allowed', fontWeight: 600,
                            }}
                        >
                            Speichern
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CommentDialog;
