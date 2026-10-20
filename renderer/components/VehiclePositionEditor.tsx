import React, { useEffect, useState, useCallback } from 'react';

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
  embedded?: boolean;
  externalSaveControls?: boolean;
  onEmbeddedSaveStateChange?: (canSave: boolean, saveHandler: (() => Promise<void>) | null) => void;
}

export const VehiclePositionEditor: React.FC<VehiclePositionEditorProps> = ({
  vehicleId,
  vehicleName,
  vehicleType,
  onClose,
  embedded = false,
  externalSaveControls = false,
  onEmbeddedSaveStateChange
}) => {
  const [positions, setPositions] = useState<VehiclePosition[]>([]);
  const [qualificationTypes, setQualificationTypes] = useState<QualificationType[]>([]);
  const [originalPositions, setOriginalPositions] = useState<VehiclePosition[] | null>(null);

  const loadData = async () => {
    try {
      const pos = await (window as any).api.getVehiclePositionsWithQualifications(vehicleType, vehicleId);
      setPositions(pos || []);
      setOriginalPositions(JSON.parse(JSON.stringify(pos || [])));
      const quals = await (window as any).api.getQualificationTypes();
      setQualificationTypes((quals || []).filter((q: QualificationType) => q.active));
    } catch (e) {
      // console.warn('[VehiclePositionEditor] loadData error:', e);
    }
  };

  useEffect(() => {
    loadData();
  }, [vehicleId, vehicleType]);

  const handleAddPosition = () => {
    const maxSort = positions.length > 0 ? Math.max(...positions.map(p => p.sort)) : -1;
    const newPos: VehiclePosition = {
      id: Date.now(),
      vehicleType,
      vehicleId,
      positionName: 'Neue Position',
      qualificationTypeId: null,
      sort: maxSort + 1
    };
    setPositions([...positions, newPos]);
  };

  const handleRemovePosition = (id: number) => {
    if (!confirm('Möchten Sie diese Schicht-Position wirklich löschen?')) return;
    setPositions(positions.filter(p => p.id !== id));
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

  const saveEditing = useCallback(async () => {
    try {
      // Speichere oder aktualisiere Positionen
      for (let i = 0; i < positions.length; i++) {
        const pos = positions[i];
        const orig = originalPositions?.find(o => o.id === pos.id);
        if (!orig) {
          await (window as any).api.addVehiclePosition({
            vehicleType,
            vehicleId,
            positionName: pos.positionName,
            qualificationTypeId: pos.qualificationTypeId,
            sort: i
          });
        } else if (
          orig.positionName !== pos.positionName ||
          orig.qualificationTypeId !== pos.qualificationTypeId ||
          orig.sort !== i
        ) {
          await (window as any).api.updateVehiclePosition({ ...pos, sort: i });
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

      await loadData();
    } catch (e) {
      // console.warn('[VehiclePositionEditor] saveEditing error:', e);
    }
  }, [positions, originalPositions, vehicleId, vehicleType]);

  useEffect(() => {
    if (!externalSaveControls || !onEmbeddedSaveStateChange) return;
    onEmbeddedSaveStateChange(true, saveEditing);
    return () => onEmbeddedSaveStateChange(false, null);
  }, [externalSaveControls, onEmbeddedSaveStateChange, saveEditing]);

  const content = (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: '16px', color: '#333', fontWeight: 600 }}>
          Schicht-Positionen
        </h3>
        <button
          type="button"
          onClick={handleAddPosition}
          style={{
            background: '#28a745',
            color: 'white',
            border: 'none',
            padding: '6px 12px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '13px'
          }}
        >
          + Position
        </button>
      </div>

      {positions.length > 0 ? (
        <div style={{ border: '1px solid #ddd', borderRadius: '4px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #ddd' }}>
                <th style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 600, width: '40%' }}>Positionsname</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 600 }}>Erforderliche Qualifikation</th>
                <th style={{ textAlign: 'center', padding: '10px 12px', fontWeight: 600, width: '80px' }}>Aktion</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((pos) => (
                <tr key={pos.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '8px 12px' }}>
                    <input
                      type="text"
                      value={pos.positionName}
                      onChange={(e) => updatePositionName(pos.id, e.target.value)}
                      style={{ width: '100%', padding: '6px 8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '13px', boxSizing: 'border-box' }}
                    />
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <select
                      value={pos.qualificationTypeId || ''}
                      onChange={(e) => updatePositionQualification(pos.id, e.target.value ? Number(e.target.value) : null)}
                      style={{ width: '100%', padding: '6px 8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '13px', boxSizing: 'border-box' }}
                    >
                      <option value="">(Keine Qualifikation erforderlich)</option>
                      {qualificationTypes.map(q => (
                        <option key={q.id} value={q.id}>
                          {q.name} {q.category ? `(${q.category})` : ''}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ textAlign: 'center', padding: '8px 12px' }}>
                    <button
                      type="button"
                      onClick={() => handleRemovePosition(pos.id)}
                      style={{
                        background: '#dc3545',
                        color: 'white',
                        border: 'none',
                        padding: '4px 8px',
                        borderRadius: '3px',
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      Löschen
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ padding: '16px', background: '#f8f9fa', border: '1px dashed #ddd', borderRadius: '4px', textAlign: 'center', color: '#6c757d', fontSize: '14px' }}>
          Keine Positionen definiert. Klicken Sie auf „+ Position“, um Schicht-Slots hinzuzufügen.
        </div>
      )}
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <div style={{
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
    }}>
      <div style={{ background: 'white', padding: 24, borderRadius: 8, width: 640 }}>
        {content}
        <div style={{ marginTop: 16, textAlign: 'right' }}>
          <button type="button" onClick={onClose} style={{ padding: '8px 16px', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer' }}>
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
};
