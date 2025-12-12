import React, { useEffect, useState } from 'react';
import styles from './PersonnelOverview.module.css';

interface VehiclePosition {
    id: number;
    vehicleType: 'rtw' | 'nef' | 'itw';
    vehicleId: number;
    positionName: string;
    qualificationTypeId: number | null;
    qualificationName?: string;
    qualificationDescription?: string;
    sort: number;
}

interface QualificationType {
    id: number;
    name: string;
    description: string;
    category: string;
    active: boolean;
}

interface VehiclePositionEditorProps {
    vehicleId: number;
    vehicleName: string;
    vehicleType: 'rtw' | 'nef' | 'itw';
    onClose: () => void;
}

export const VehiclePositionEditor: React.FC<VehiclePositionEditorProps> = ({
    vehicleId,
    vehicleName,
    vehicleType,
    onClose
}) => {
    const [positions, setPositions] = useState<VehiclePosition[]>([]);
    const [qualificationTypes, setQualificationTypes] = useState<QualificationType[]>([]);
    const [editing, setEditing] = useState(false);
    const [selectedPositionId, setSelectedPositionId] = useState<number | null>(null);
    const [originalPositions, setOriginalPositions] = useState<VehiclePosition[] | null>(null);

    // Drag & Drop State
    const [draggedId, setDraggedId] = useState<number | null>(null);
    const [dragOverId, setDragOverId] = useState<number | null>(null);
    const [dragPosition, setDragPosition] = useState<'above' | 'below' | null>(null);

    const loadData = async () => {
        try {
            const pos = await (window as any).api.getVehiclePositionsWithQualifications(vehicleType, vehicleId);
            setPositions(pos);
            const quals = await (window as any).api.getQualificationTypes();
            setQualificationTypes(quals.filter((q: QualificationType) => q.active));
        } catch (e) {
            console.warn('[VehiclePositionEditor] loadData error:', e);
        }
    };

    useEffect(() => {
        loadData();
    }, [vehicleId, vehicleType]);

    const startEditing = () => {
        setOriginalPositions(JSON.parse(JSON.stringify(positions)));
        setEditing(true);
    };

    const cancelEditing = () => {
        if (originalPositions) {
            setPositions(originalPositions);
        }
        setEditing(false);
        setOriginalPositions(null);
        setSelectedPositionId(null);
    };

    const saveEditing = async () => {
        try {
            // Aktualisiere geänderte Positionen
            for (const pos of positions) {
                const orig = originalPositions?.find(o => o.id === pos.id);
                if (!orig) {
                    // Neue Position
                    await (window as any).api.addVehiclePosition({
                        vehicleType,
                        vehicleId,
                        positionName: pos.positionName,
                        qualificationTypeId: pos.qualificationTypeId,
                        sort: pos.sort
                    });
                } else if (
                    orig.positionName !== pos.positionName ||
                    orig.qualificationTypeId !== pos.qualificationTypeId ||
                    orig.sort !== pos.sort
                ) {
                    // Geänderte Position
                    await (window as any).api.updateVehiclePosition(pos);
                }
            }

            // Lösche entfernte Positionen
            if (originalPositions) {
                for (const orig of originalPositions) {
                    if (!positions.find(p => p.id === orig.id)) {
                        await (window as any).api.deleteVehiclePosition(orig.id);
                    }
                }
            }

            setEditing(false);
            setOriginalPositions(null);
            setSelectedPositionId(null);
            await loadData();
        } catch (e) {
            console.warn('[VehiclePositionEditor] saveEditing error:', e);
        }
    };

    const addPosition = () => {
        const maxSort = positions.length > 0 ? Math.max(...positions.map(p => p.sort)) : -1;
        const newPos: VehiclePosition = {
            id: Date.now(), // Temporäre ID
            vehicleType,
            vehicleId,
            positionName: 'Neue Position',
            qualificationTypeId: null,
            sort: maxSort + 1
        };
        setPositions([...positions, newPos]);
        setEditing(true);
        if (!originalPositions) {
            setOriginalPositions(JSON.parse(JSON.stringify(positions)));
        }
    };

    const deleteSelectedPosition = async () => {
        if (selectedPositionId === null) return;
        
        if (!editing) {
            // Direktes Löschen
            try {
                await (window as any).api.deleteVehiclePosition(selectedPositionId);
                setSelectedPositionId(null);
                await loadData();
            } catch (e) {
                console.warn('[VehiclePositionEditor] deleteSelectedPosition error:', e);
            }
        } else {
            // Im Bearbeitungsmodus: aus Liste entfernen
            setPositions(positions.filter(p => p.id !== selectedPositionId));
            setSelectedPositionId(null);
        }
    };

    const updatePositionName = (id: number, name: string) => {
        setPositions(positions.map(p => p.id === id ? { ...p, positionName: name } : p));
    };

    const updatePositionQualification = (id: number, qualId: number | null) => {
        const qual = qualificationTypes.find(q => q.id === qualId);
        setPositions(positions.map(p => 
            p.id === id 
                ? { 
                    ...p, 
                    qualificationTypeId: qualId,
                    qualificationName: qual?.name,
                    qualificationDescription: qual?.description
                } 
                : p
        ));
    };

    const onRowClick = (id: number) => {
        setSelectedPositionId(prev => prev === id ? null : id);
    };

    // Drag & Drop Handlers
    const onDragStart = (id: number) => {
        setDraggedId(id);
    };

    const onDragOver = (e: React.DragEvent<HTMLTableRowElement>, overId: number) => {
        e.preventDefault();
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const pos = (e.clientY - rect.top) < rect.height / 2 ? 'above' : 'below';
        setDragOverId(overId);
        setDragPosition(pos);
    };

    const onDragLeave = () => {
        setDragOverId(null);
        setDragPosition(null);
    };

    const onDrop = async (targetId: number) => {
        if (draggedId === null || draggedId === targetId) return;

        const oldIndex = positions.findIndex(p => p.id === draggedId);
        let newIndex = positions.findIndex(p => p.id === targetId);

        if (dragPosition === 'below') newIndex += 1;

        const updated = [...positions];
        const [removed] = updated.splice(oldIndex, 1);
        if (oldIndex < newIndex) newIndex -= 1;
        updated.splice(Math.max(0, Math.min(updated.length, newIndex)), 0, removed);

        // Update sort values
        const withNewSort = updated.map((p, idx) => ({ ...p, sort: idx }));
        setPositions(withNewSort);

        setDraggedId(null);
        setDragOverId(null);
        setDragPosition(null);

        // Persistiere die neue Reihenfolge
        if (!editing) {
            try {
                await (window as any).api.updateVehiclePositionOrder(withNewSort.map(p => p.id));
                await loadData();
            } catch (e) {
                console.warn('[VehiclePositionEditor] onDrop error:', e);
            }
        }
    };

    return (
        <div 
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                backgroundColor: 'rgba(0,0,0,0.5)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 1000
            }}
            onClick={onClose}
        >
            <div 
                style={{
                    backgroundColor: 'white',
                    padding: 24,
                    borderRadius: 8,
                    width: '90%',
                    maxWidth: 800,
                    maxHeight: '90%',
                    overflow: 'auto'
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <h3>Positionen für {vehicleName} ({vehicleType.toUpperCase()})</h3>
                <p style={{ marginBottom: 16, color: '#666' }}>
                    Definieren Sie die Positionen für dieses Fahrzeug und ordnen Sie ihnen optional Qualifikationen zu.
                </p>

                <table className={styles.table}>
                    <thead>
                        <tr className={styles.thead}>
                            <th>Positionsname</th>
                            <th style={{ width: 300 }}>Erforderliche Qualifikation</th>
                            <th className={styles.center} style={{ width: 60 }}>#</th>
                        </tr>
                    </thead>
                    <tbody className={styles.tbody}>
                        {positions.map(pos => {
                            const isOver = dragOverId === pos.id;
                            const rowClass = [
                                styles.row,
                                selectedPositionId === pos.id ? styles.selected : '',
                                isOver && dragPosition === 'above' ? styles.dropAbove : '',
                                isOver && dragPosition === 'below' ? styles.dropBelow : ''
                            ].filter(Boolean).join(' ');

                            return (
                                <tr
                                    key={pos.id}
                                    draggable={!editing}
                                    onDragStart={() => !editing && onDragStart(pos.id)}
                                    onDragOver={(e) => !editing && onDragOver(e, pos.id)}
                                    onDragLeave={() => !editing && onDragLeave()}
                                    onDrop={() => !editing && onDrop(pos.id)}
                                    onClick={() => onRowClick(pos.id)}
                                    className={rowClass}
                                    style={{ cursor: editing ? 'default' : 'move' }}
                                >
                                    <td>
                                        {editing ? (
                                            <input
                                                value={pos.positionName}
                                                onChange={(e) => updatePositionName(pos.id, e.target.value)}
                                                style={{ width: '100%' }}
                                            />
                                        ) : (
                                            pos.positionName
                                        )}
                                    </td>
                                    <td>
                                        {editing ? (
                                            <select
                                                value={pos.qualificationTypeId || ''}
                                                onChange={(e) => updatePositionQualification(
                                                    pos.id,
                                                    e.target.value ? Number(e.target.value) : null
                                                )}
                                                style={{ width: '100%' }}
                                            >
                                                <option value="">Keine Qualifikation erforderlich</option>
                                                {qualificationTypes.map(q => (
                                                    <option key={q.id} value={q.id}>
                                                        {q.name} {q.category ? `(${q.category})` : ''}
                                                    </option>
                                                ))}
                                            </select>
                                        ) : (
                                            <span>
                                                {pos.qualificationName || <em style={{ color: '#999' }}>Keine</em>}
                                                {pos.qualificationName && pos.qualificationDescription && (
                                                    <span style={{ color: '#666', fontSize: '0.9em', marginLeft: 8 }}>
                                                        ({pos.qualificationDescription})
                                                    </span>
                                                )}
                                            </span>
                                        )}
                                    </td>
                                    <td className={styles.center}>
                                        {selectedPositionId === pos.id ? '✓' : ''}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {!editing ? (
                    <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                        <button onClick={addPosition}>Hinzufügen</button>
                        <button onClick={startEditing} disabled={positions.length === 0}>Ändern</button>
                        <button onClick={deleteSelectedPosition} disabled={selectedPositionId === null}>Löschen</button>
                        <button onClick={onClose} style={{ marginLeft: 'auto' }}>Schließen</button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                        <button onClick={saveEditing}>Speichern</button>
                        <button onClick={cancelEditing}>Abbrechen</button>
                    </div>
                )}
            </div>
        </div>
    );
};
