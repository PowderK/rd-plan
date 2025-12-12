import React, { useCallback, useEffect, useState } from 'react';

interface Azubi {
  id: number;
  name: string;
  vorname: string;
  lehrjahr: number;
}

// Azubi Edit Modal Komponente  
const AzubiEditModal: React.FC<{ azubi: Azubi; onClose: () => void; onSave: () => void }> = ({ azubi, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: azubi.name || '',
    vorname: azubi.vorname || '',
    lehrjahr: azubi.lehrjahr || 1
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await (window as any).api.updateAzubi(azubi.id, formData);
      onSave();
      onClose();
    } catch (error) {
      console.error('Fehler beim Speichern des Azubis:', error);
      alert('Fehler beim Speichern!');
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '24px',
        borderRadius: '8px',
        minWidth: '400px'
      }}>
        <h3>Azubi bearbeiten: {azubi.name}, {azubi.vorname}</h3>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '12px' }}>
            <label>Nachname:
              <input 
                type="text" 
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                style={{ width: '100%', marginTop: '4px', padding: '8px' }}
                required
              />
            </label>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label>Vorname:
              <input 
                type="text" 
                value={formData.vorname}
                onChange={(e) => setFormData(prev => ({ ...prev, vorname: e.target.value }))}
                style={{ width: '100%', marginTop: '4px', padding: '8px' }}
                required
              />
            </label>
          </div>
          <div style={{ marginBottom: '24px' }}>
            <label>Lehrjahr:
              <select 
                value={formData.lehrjahr}
                onChange={(e) => setFormData(prev => ({ ...prev, lehrjahr: Number(e.target.value) }))}
                style={{ width: '100%', marginTop: '4px', padding: '8px' }}
              >
                <option value={1}>1. Lehrjahr</option>
                <option value={2}>2. Lehrjahr</option>
                <option value={3}>3. Lehrjahr</option>
              </select>
            </label>
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose}>Abbrechen</button>
            <button type="submit" style={{ backgroundColor: '#007bff', color: 'white' }}>Speichern</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const AzubiOverview: React.FC = () => {
  const [azubis, setAzubis] = useState<Azubi[]>([]);
  const [editingAzubiModal, setEditingAzubiModal] = useState<Azubi | null>(null);

  const loadAzubis = useCallback(async () => {
    const list = await (window as any).api.getAzubiList();
    setAzubis(list);
  }, []);

  useEffect(() => {
    loadAzubis();
    // subscribe to main broadcasts
    const ipcHandler = (_event: any) => loadAzubis();
    (window as any).api.onAzubisUpdated?.(ipcHandler);
    // Nach Rückkehr ins Fenster immer neu laden
    const focusHandler = () => loadAzubis();
    window.addEventListener('focus', focusHandler);
    return () => {
      (window as any).api.offAzubisUpdated?.(ipcHandler);
      window.removeEventListener('focus', focusHandler);
    };
  }, [loadAzubis]);

  const handleAdd = async () => {
    (window as any).api.openAddAzubiWindow();
  };

  const handleEdit = async (azubi: Azubi) => {
    setEditingAzubiModal(azubi);
  };

  const handleDelete = async (id: number) => {
    (window as any).api.openEditAzubiWindow(id);
  };

  return (
    <div style={{ padding: 24 }}>
      <h2>Azubis</h2>
      <button onClick={handleAdd} style={{ marginBottom: 16 }}>Azubi hinzufügen</button>
      <table style={{ borderCollapse: 'collapse', minWidth: 400 }}>
        <thead>
          <tr>
            <th style={{ border: '1px solid #ccc' }}>Nachname</th>
            <th style={{ border: '1px solid #ccc' }}>Vorname</th>
            <th style={{ border: '1px solid #ccc' }}>Lehrjahr</th>
            <th style={{ border: '1px solid #ccc' }}>Aktionen</th>
          </tr>
        </thead>
        <tbody>
          {azubis.map(a => (
            <tr key={a.id}>
              <td style={{ border: '1px solid #ccc' }}>{a.name}</td>
              <td style={{ border: '1px solid #ccc' }}>{a.vorname}</td>
              <td style={{ border: '1px solid #ccc' }}>{a.lehrjahr}</td>
              <td style={{ border: '1px solid #ccc' }}>
                <button onClick={() => handleEdit(a)} style={{ marginRight: 8 }}>Bearbeiten</button>
                <button onClick={() => handleDelete(a.id)}>Löschen</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {/* Azubi Edit Modal */}
      {editingAzubiModal && (
        <AzubiEditModal 
          azubi={editingAzubiModal}
          onClose={() => setEditingAzubiModal(null)}
          onSave={() => {
            loadAzubis();
          }}
        />
      )}
    </div>
  );
};

export default AzubiOverview;
