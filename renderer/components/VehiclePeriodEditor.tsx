import React, { useState } from 'react';

interface VehiclePeriod {
  id: number;
  vehicleId: number;
  startYM: string;
  endYM: string;
  active: boolean;
}

interface VehiclePeriodFormProps {
  period?: VehiclePeriod;
  vehicleId: number;
  onSave: (period: VehiclePeriod | Omit<VehiclePeriod, 'id'>) => Promise<void>;
  onCancel: () => void;
  title: string;
}

export const VehiclePeriodForm: React.FC<VehiclePeriodFormProps> = ({ 
  period, 
  vehicleId,
  onSave, 
  onCancel, 
  title 
}) => {
  const [startYM, setStartYM] = useState(period?.startYM || '');
  const [endYM, setEndYM] = useState(period?.endYM || '');
  const [active, setActive] = useState(period?.active ?? true);
  const [isUnlimited, setIsUnlimited] = useState(!period?.endYM);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!startYM) {
      alert('Bitte füllen Sie das Start-Datum aus.');
      return;
    }

    const formData = {
      ...(period?.id ? { id: period.id } : {}),
      vehicleId: vehicleId,
      startYM: startYM,
      endYM: isUnlimited ? '' : (endYM || ''),
      active: active
    };

    // console.log('[VehiclePeriodForm] Saving period:', formData);
    onSave(formData as any);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: 'white',
        padding: '24px',
        borderRadius: '8px',
        width: '480px',
        maxHeight: '80vh',
        overflow: 'auto'
      }}>
        <h3 style={{ marginTop: 0, marginBottom: '20px' }}>{title}</h3>
        
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>
              Start-Monat (YYYY-MM) *
            </label>
            <input
              type="month"
              value={startYM}
              onChange={e => setStartYM(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', marginBottom: '6px' }}>
              <input
                type="checkbox"
                checked={isUnlimited}
                onChange={e => setIsUnlimited(e.target.checked)}
                style={{ marginRight: '8px' }}
              />
              Unbegrenzter Einsatzzeitraum
            </label>
            
            {!isUnlimited && (
              <>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>
                  End-Monat (YYYY-MM)
                </label>
                <input
                  type="month"
                  value={endYM}
                  onChange={e => setEndYM(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ddd',
                    borderRadius: '4px'
                  }}
                />
              </>
            )}
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'flex', alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={active}
                onChange={e => setActive(e.target.checked)}
                style={{ marginRight: '8px' }}
              />
              <span style={{ fontWeight: 'bold' }}>Aktiv</span>
            </label>
            <small style={{ color: '#666', fontSize: '12px' }}>
              Inaktive Zeiträume werden bei der Dienstplanung nicht berücksichtigt
            </small>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button
              type="button"
              onClick={onCancel}
              style={{
                background: '#6c757d',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Abbrechen
            </button>
            <button
              type="submit"
              style={{
                background: '#007bff',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Speichern
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface VehiclePeriodListProps {
  vehicleId: number;
  vehicleName: string;
  vehicleType: 'rtw' | 'nef' | 'itw';
  onClose: () => void;
}

export const VehiclePeriodList: React.FC<VehiclePeriodListProps> = ({ 
  vehicleId, 
  vehicleName,
  vehicleType,
  onClose 
}) => {
  const [periods, setPeriods] = useState<VehiclePeriod[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<VehiclePeriod | undefined>(undefined);

  const loadPeriods = async () => {
    try {
      let data;
      if (vehicleType === 'rtw') {
        data = await (window as any).api.getRtwVehiclePeriods(vehicleId);
      } else if (vehicleType === 'nef') {
        data = await (window as any).api.getNefVehiclePeriods(vehicleId);
      } else {
        data = await (window as any).api.getItwVehiclePeriods(vehicleId);
      }
      setPeriods(data || []);
    } catch (error) {
      // console.error('Failed to load vehicle periods:', error);
    }
  };

  React.useEffect(() => {
    loadPeriods();
  }, [vehicleId, vehicleType]);

  const handleAdd = () => {
    setEditingPeriod(undefined);
    setShowForm(true);
  };

  const handleEdit = (period: VehiclePeriod) => {
    setEditingPeriod(period);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Möchten Sie diesen Zeitraum wirklich löschen?')) {
      return;
    }

    try {
      if (vehicleType === 'rtw') {
        await (window as any).api.deleteRtwVehiclePeriod(id);
      } else if (vehicleType === 'nef') {
        await (window as any).api.deleteNefVehiclePeriod(id);
      } else {
        await (window as any).api.deleteItwVehiclePeriod(id);
      }
      await loadPeriods();
    } catch (error) {
      // console.error('Failed to delete period:', error);
      alert('Fehler beim Löschen des Zeitraums.');
    }
  };

  const handleSave = async (period: VehiclePeriod | Omit<VehiclePeriod, 'id'>) => {
    try {
      if ('id' in period) {
        // Update
        if (vehicleType === 'rtw') {
          await (window as any).api.updateRtwVehiclePeriod(period);
        } else if (vehicleType === 'nef') {
          await (window as any).api.updateNefVehiclePeriod(period);
        } else {
          await (window as any).api.updateItwVehiclePeriod(period);
        }
      } else {
        // Create
        if (vehicleType === 'rtw') {
          await (window as any).api.addRtwVehiclePeriod(period);
        } else if (vehicleType === 'nef') {
          await (window as any).api.addNefVehiclePeriod(period);
        } else {
          await (window as any).api.addItwVehiclePeriod(period);
        }
      }
      
      setShowForm(false);
      setEditingPeriod(undefined);
      await loadPeriods();
    } catch (error) {
      // console.error('Failed to save period:', error);
      alert('Fehler beim Speichern des Zeitraums.');
    }
  };

  const formatYM = (ym: string) => {
    if (!ym) return '';
    const [year, month] = ym.split('-');
    return `${month}/${year}`;
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 999
    }}>
      <div style={{
        background: 'white',
        padding: '24px',
        borderRadius: '8px',
        width: '700px',
        maxHeight: '80vh',
        overflow: 'auto'
      }}>
        <h3 style={{ marginTop: 0, marginBottom: '20px' }}>
          Einsatzzeiträume: {vehicleName}
        </h3>

        <table style={{ 
          width: '100%', 
          borderCollapse: 'collapse',
          marginBottom: '16px'
        }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #ddd' }}>
              <th style={{ textAlign: 'left', padding: '8px' }}>Start</th>
              <th style={{ textAlign: 'left', padding: '8px' }}>Ende</th>
              <th style={{ textAlign: 'center', padding: '8px' }}>Aktiv</th>
              <th style={{ textAlign: 'right', padding: '8px' }}>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {periods.length === 0 && (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: '24px', color: '#999' }}>
                  Keine Einsatzzeiträume definiert
                </td>
              </tr>
            )}
            {periods.map(period => (
              <tr key={period.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '8px' }}>{formatYM(period.startYM)}</td>
                <td style={{ padding: '8px' }}>
                  {period.endYM ? formatYM(period.endYM) : 'Unbegrenzt'}
                </td>
                <td style={{ textAlign: 'center', padding: '8px' }}>
                  <span style={{ 
                    display: 'inline-block',
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    background: period.active ? '#28a745' : '#dc3545'
                  }} />
                </td>
                <td style={{ textAlign: 'right', padding: '8px' }}>
                  <button
                    onClick={() => handleEdit(period)}
                    style={{
                      background: '#007bff',
                      color: 'white',
                      border: 'none',
                      padding: '4px 12px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      marginRight: '8px'
                    }}
                  >
                    Bearbeiten
                  </button>
                  <button
                    onClick={() => handleDelete(period.id)}
                    style={{
                      background: '#dc3545',
                      color: 'white',
                      border: 'none',
                      padding: '4px 12px',
                      borderRadius: '4px',
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

        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <button
            onClick={handleAdd}
            style={{
              background: '#28a745',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Neuer Zeitraum
          </button>
          <button
            onClick={onClose}
            style={{
              background: '#6c757d',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Schließen
          </button>
        </div>

        {showForm && (
          <VehiclePeriodForm
            period={editingPeriod}
            vehicleId={vehicleId}
            onSave={handleSave}
            onCancel={() => {
              setShowForm(false);
              setEditingPeriod(undefined);
            }}
            title={editingPeriod ? 'Zeitraum bearbeiten' : 'Neuer Zeitraum'}
          />
        )}
      </div>
    </div>
  );
};
