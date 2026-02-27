import React, { useState, useEffect } from 'react';
import { ShiftTransferDialog } from './ShiftTransferDialog';
import { ShiftTransfer } from '../utils/calculation';

interface ShiftTransferManagerProps {
    onClose: () => void;
    fixedToPersonId?: number;
}

export const ShiftTransferManager: React.FC<ShiftTransferManagerProps> = ({ onClose, fixedToPersonId }) => {
    const [transfers, setTransfers] = useState<ShiftTransfer[]>([]);
    const [personnel, setPersonnel] = useState<{ id: number; name: string; vorname: string }[]>([]);
    const [year, setYear] = useState<number>(new Date().getFullYear());
    const [showDialog, setShowDialog] = useState(false);
    const [editingTransfer, setEditingTransfer] = useState<ShiftTransfer | undefined>(undefined);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        loadPersonnel();
        loadTransfers();
    }, [year]);

    const loadPersonnel = async () => {
        try {
            const data = await (window as any).api.getPersonnelList(true); // Include inactive? Maybe yes, for history
            setPersonnel(data);
        } catch (e) {
            console.error('Failed to load personnel', e);
        }
    };

    const loadTransfers = async () => {
        setIsLoading(true);
        try {
            const data = await (window as any).api.getShiftTransfers(year);
            setTransfers(data || []);
        } catch (e) {
            console.error('Failed to load transfers', e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAdd = () => {
        setEditingTransfer(undefined);
        setShowDialog(true);
    };

    const handleEdit = (transfer: ShiftTransfer) => {
        setEditingTransfer(transfer);
        setShowDialog(true);
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Möchten Sie diese Übernahme wirklich löschen?')) return;
        try {
            await (window as any).api.deleteShiftTransfer(id);
            loadTransfers();
        } catch (e) {
            alert('Fehler beim Löschen');
        }
    };

    const handleSave = async (data: any) => {
        try {
            if (data.id) {
                await (window as any).api.updateShiftTransfer(data.id, data);
            } else {
                await (window as any).api.addShiftTransfer(data);
            }
            setShowDialog(false);
            loadTransfers();
        } catch (e) {
            console.error(e);
            alert('Fehler beim Speichern');
        }
    };

    const getPersonName = (id: number) => {
        const p = personnel.find(p => p.id === id);
        return p ? `${p.name}, ${p.vorname}` : `ID: ${id}`;
    };

    const formatMonth = (monthStr: string) => {
        if (!monthStr) return '';
        const [y, m] = monthStr.split('-');
        return `${m}.${y}`;
    };

    const visibleTransfers = fixedToPersonId
        ? transfers.filter(t => Number(t.to_person_id) === Number(fixedToPersonId))
        : transfers;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 900
        }}>
            <div style={{
                background: 'white', padding: '24px', borderRadius: '8px', width: '900px', maxHeight: '90vh', overflow: 'auto', display: 'flex', flexDirection: 'column'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2 style={{ margin: 0 }}>Schichtübernahmen verwalten</h2>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <select
                            value={year}
                            onChange={e => setYear(Number(e.target.value))}
                            style={{ padding: '8px' }}
                        >
                            {Array.from({ length: 5 }).map((_, i) => {
                                const y = new Date().getFullYear() - 2 + i;
                                return <option key={y} value={y}>{y}</option>;
                            })}
                        </select>
                        <button onClick={onClose} style={{ padding: '8px 16px', cursor: 'pointer' }}>Schließen</button>
                    </div>
                </div>

                <div style={{ marginBottom: '10px' }}>
                    <button
                        onClick={handleAdd}
                        style={{ padding: '10px 20px', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                        + Neue Übernahme
                    </button>
                </div>

                {isLoading ? (
                    <div>Laden...</div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', flex: 1 }}>
                        <thead>
                            <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                                <th style={{ padding: '12px', textAlign: 'left' }}>Von (Geber)</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>An (Empfänger)</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>Anzahl</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>Typ</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>Monat</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>Grund</th>
                                <th style={{ padding: '12px', textAlign: 'right' }}>Aktionen</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visibleTransfers.length === 0 ? (
                                <tr>
                                    <td colSpan={7} style={{ padding: '20px', textAlign: 'center', color: '#6c757d' }}>
                                        Keine Übernahmen in diesem Jahr gefunden.
                                    </td>
                                </tr>
                            ) : (
                                visibleTransfers.map(t => (
                                    <tr key={t.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                                        <td style={{ padding: '12px' }}>{getPersonName(t.from_person_id)}</td>
                                        <td style={{ padding: '12px' }}>{getPersonName(t.to_person_id)}</td>
                                        <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>{t.shift_count}</td>
                                        <td style={{ padding: '12px' }}>{t.position_type}</td>
                                        <td style={{ padding: '12px' }}>
                                            {formatMonth(t.month)}
                                        </td>
                                        <td style={{ padding: '12px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {t.reason}
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'right' }}>
                                            <button
                                                onClick={() => handleEdit(t)}
                                                style={{ marginRight: '8px', padding: '4px 8px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                            >
                                                Bearbeiten
                                            </button>
                                            <button
                                                onClick={() => handleDelete(t.id)}
                                                style={{ padding: '4px 8px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                            >
                                                Löschen
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                )}

                {showDialog && (
                    <ShiftTransferDialog
                        transfer={editingTransfer}
                        personnel={personnel}
                        fixedToPersonId={fixedToPersonId}
                        onSave={handleSave}
                        onCancel={() => setShowDialog(false)}
                    />
                )}
            </div>
        </div>
    );
};
