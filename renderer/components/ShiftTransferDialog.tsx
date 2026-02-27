import React, { useState, useEffect } from 'react';
import { ShiftTransfer } from '../utils/calculation';

interface ShiftTransferDialogProps {
    transfer?: ShiftTransfer;
    personnel: Array<{ id: number; name: string; vorname: string }>;
    fixedToPersonId?: number;
    onSave: (transfer: any) => Promise<void>;
    onCancel: () => void;
}

export const ShiftTransferDialog: React.FC<ShiftTransferDialogProps> = ({
    transfer,
    personnel,
    fixedToPersonId,
    onSave,
    onCancel
}) => {
    const [fromId, setFromId] = useState(transfer?.from_person_id || '');
    const [toId, setToId] = useState(transfer?.to_person_id || fixedToPersonId || '');
    const [shiftCount, setShiftCount] = useState(transfer?.shift_count?.toString() || '0');
    const [positionType, setPositionType] = useState(transfer?.position_type || 'RTW');
    const [month, setMonth] = useState(transfer?.month || '');
    const [reason, setReason] = useState(transfer?.reason || '');

    useEffect(() => {
        if (!transfer && fixedToPersonId) {
            setToId(fixedToPersonId);
        }
    }, [fixedToPersonId, transfer]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!fromId || !toId) {
            alert('Bitte wählen Sie beide Personen aus.');
            return;
        }

        if (fromId === toId) {
            alert('Ursprung und Ziel müssen unterschiedlich sein.');
            return;
        }

        if (!month) {
            alert('Bitte wählen Sie einen Monat aus.');
            return;
        }

        const data = {
            ...(transfer?.id ? { id: transfer.id } : {}),
            from_person_id: Number(fromId),
            to_person_id: Number(toId),
            shift_count: Number(shiftCount),
            position_type: positionType,
            month: month,
            reason: reason
        };

        await onSave(data);
    };

    const sortedPersonnel = [...personnel].sort((a, b) => a.name.localeCompare(b.name));
    const fixedRecipient = fixedToPersonId ? sortedPersonnel.find(p => p.id === fixedToPersonId) : undefined;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
            <div style={{
                background: 'white', padding: '24px', borderRadius: '8px', width: '500px', maxHeight: '90vh', overflow: 'auto'
            }}>
                <h3 style={{ marginTop: 0 }}>{transfer ? 'Übernahme bearbeiten' : 'Neue Übernahme'}</h3>

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', fontWeight: 'bold' }}>Von (Geber)</label>
                        <select
                            value={fromId}
                            onChange={e => setFromId(Number(e.target.value))}
                            style={{ width: '100%', padding: '8px' }}
                            required
                        >
                            <option value="">Bitte wählen...</option>
                            {sortedPersonnel.map(p => (
                                <option key={p.id} value={p.id}>{p.name}, {p.vorname}</option>
                            ))}
                        </select>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', fontWeight: 'bold' }}>An (Empfänger)</label>
                        {fixedToPersonId ? (
                            <input
                                type="text"
                                value={fixedRecipient ? `${fixedRecipient.name}, ${fixedRecipient.vorname}` : `ID: ${fixedToPersonId}`}
                                readOnly
                                style={{ width: '100%', padding: '8px', background: '#f8f9fa', border: '1px solid #ddd', borderRadius: '4px' }}
                            />
                        ) : (
                            <select
                                value={toId}
                                onChange={e => setToId(Number(e.target.value))}
                                style={{ width: '100%', padding: '8px' }}
                                required
                            >
                                <option value="">Bitte wählen...</option>
                                {sortedPersonnel.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}, {p.vorname}</option>
                                ))}
                            </select>
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontWeight: 'bold' }}>Anzahl Schichten</label>
                            <input
                                type="number"
                                step="0.5"
                                value={shiftCount}
                                onChange={e => setShiftCount(e.target.value)}
                                style={{ width: '100%', padding: '8px' }}
                                required
                            />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontWeight: 'bold' }}>Typ</label>
                            <select
                                value={positionType}
                                onChange={e => setPositionType(e.target.value)}
                                style={{ width: '100%', padding: '8px' }}
                            >
                                <option value="RTW">RTW (Allgemein)</option>
                                <option value="NEF">NEF (Allgemein)</option>
                            </select>
                        </div>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', fontWeight: 'bold' }}>Monat</label>
                        <input
                            type="month"
                            value={month}
                            onChange={e => setMonth(e.target.value)}
                            style={{ width: '100%', padding: '8px' }}
                            required
                        />
                    </div>

                    <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'block', fontWeight: 'bold' }}>Grund / Notiz</label>
                        <textarea
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            style={{ width: '100%', padding: '8px', height: '60px' }}
                        />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button type="button" onClick={onCancel} style={{ padding: '8px 16px', cursor: 'pointer' }}>Abbrechen</button>
                        <button type="submit" style={{ padding: '8px 16px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Speichern</button>
                    </div>
                </form>
            </div>
        </div>
    );
};
