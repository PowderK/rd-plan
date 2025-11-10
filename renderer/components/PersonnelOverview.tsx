import React, { useState, useEffect, useCallback } from 'react';
import styles from './PersonnelOverview.module.css';

// Person Edit Modal Komponente
// PersonEditModal entfernt - direkte Verwendung von openEditPersonWindow
const removedPersonEditModal = () => {
  const [formData, setFormData] = useState({
    name: person.name || '',
    vorname: person.vorname || '',
    street: person.street || '',
    postalCode: person.postalCode || '',
    city: person.city || '',
    phone: person.phone || '',
    mobile: person.mobile || '',
    email: person.email || '',
    active: person.active ?? true
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await (window as any).api.updatePerson(person.id, formData);
      onSave();
      onClose();
    } catch (error) {
      console.error('Fehler beim Speichern der Person:', error);
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
        minWidth: '400px',
        maxHeight: '80vh',
        overflow: 'auto'
      }}>
        <h3>Person bearbeiten: {person.name}, {person.vorname}</h3>
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
          <div style={{ marginBottom: '12px' }}>
            <label>Straße:
              <input 
                type="text" 
                value={formData.street}
                onChange={(e) => setFormData(prev => ({ ...prev, street: e.target.value }))}
                style={{ width: '100%', marginTop: '4px', padding: '8px' }}
              />
            </label>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <label style={{ flex: '1' }}>PLZ:
              <input 
                type="text" 
                value={formData.postalCode}
                onChange={(e) => setFormData(prev => ({ ...prev, postalCode: e.target.value }))}
                style={{ width: '100%', marginTop: '4px', padding: '8px' }}
              />
            </label>
            <label style={{ flex: '2' }}>Stadt:
              <input 
                type="text" 
                value={formData.city}
                onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                style={{ width: '100%', marginTop: '4px', padding: '8px' }}
              />
            </label>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label>Telefon:
              <input 
                type="tel" 
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                style={{ width: '100%', marginTop: '4px', padding: '8px' }}
              />
            </label>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label>Mobil:
              <input 
                type="tel" 
                value={formData.mobile}
                onChange={(e) => setFormData(prev => ({ ...prev, mobile: e.target.value }))}
                style={{ width: '100%', marginTop: '4px', padding: '8px' }}
              />
            </label>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label>E-Mail:
              <input 
                type="email" 
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                style={{ width: '100%', marginTop: '4px', padding: '8px' }}
              />
            </label>
          </div>
          <div style={{ marginBottom: '24px' }}>
            <label>
              <input 
                type="checkbox" 
                checked={Boolean(formData.active)}
                onChange={(e) => setFormData(prev => ({ ...prev, active: e.target.checked }))}
              />
              {' '}Aktiv
            </label>
          </div>
          
          {/* Qualifikations-Management */}
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ marginBottom: '12px' }}>Qualifikationen</h4>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <button 
                type="button"
                onClick={() => {
                  // Öffne Qualifikations-Management für diese Person
                  (window as any).api.openEditPersonWindow(person.id);
                  onClose(); // Schließe das aktuelle Modal
                }}
                style={{
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  padding: '8px 12px',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Qualifikationen verwalten
              </button>
            </div>
            
            {/* Zeige aktuelle Qualifikationen */}
            <div style={{ 
              background: '#f8f9fa', 
              padding: '8px', 
              borderRadius: '4px',
              fontSize: '12px'
            }}>
              <strong>Aktuelle Qualifikationen:</strong><br/>
              {qualificationPeriods && qualificationPeriods.length > 0 ? (
                qualificationPeriods
                  .filter((q: QualificationPeriod) => q.active)
                  .map((q: QualificationPeriod) => `${q.qualType} (${q.startYM || 'offen'} - ${q.endYM || 'unbegrenzt'})`)
                  .join(', ')
              ) : (
                'Keine Qualifikationen vorhanden'
              )}
            </div>
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

// Azubi Edit Modal Komponente  
// AzubiEditModal entfernt - nutzt direkt openEditPersonWindow über Qualifikationssystem
const removedAzubiEditModal = () => {
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

// Zeiträume Manager Komponente
const AzubiPeriodsManager: React.FC<{ azubi: Azubi; onClose: () => void }> = ({ azubi, onClose }) => {
  const [periods, setPeriods] = useState<AzubiPeriod[]>([]);
  const [newPeriod, setNewPeriod] = useState({ start_date: '', end_date: '', description: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadPeriods = async () => {
      try {
        const azubiPeriods = await (window as any).api.getAzubiPeriods(azubi.id);
        setPeriods(azubiPeriods);
      } catch (error) {
        console.error('Fehler beim Laden der Zeiträume:', error);
      }
    };
    loadPeriods();
  }, [azubi.id]);

  const addPeriod = async () => {
    try {
      if (!newPeriod.start_date || !newPeriod.end_date) {
        alert('Bitte geben Sie Start- und Enddatum ein.');
        return;
      }

      if (new Date(newPeriod.start_date) >= new Date(newPeriod.end_date)) {
        alert('Das Startdatum muss vor dem Enddatum liegen.');
        return;
      }

      setLoading(true);
      await (window as any).api.addAzubiPeriod({
        azubi_id: azubi.id,
        start_date: newPeriod.start_date,
        end_date: newPeriod.end_date,
        description: newPeriod.description || undefined
      });

      // Zeiträume neu laden
      const updatedPeriods = await (window as any).api.getAzubiPeriods(azubi.id);
      setPeriods(updatedPeriods);
      setNewPeriod({ start_date: '', end_date: '', description: '' });
    } catch (error) {
      console.error('Fehler beim Hinzufügen des Zeitraums:', error);
      alert('Fehler beim Hinzufügen des Zeitraums!');
    } finally {
      setLoading(false);
    }
  };

  const deletePeriod = async (periodId: number) => {
    try {
      if (!confirm('Zeitraum wirklich löschen?')) {
        return;
      }

      setLoading(true);
      await (window as any).api.deleteAzubiPeriod(periodId);

      // Zeiträume neu laden
      const updatedPeriods = await (window as any).api.getAzubiPeriods(azubi.id);
      setPeriods(updatedPeriods);
    } catch (error) {
      console.error('Fehler beim Löschen des Zeitraums:', error);
      alert('Fehler beim Löschen des Zeitraums!');
    } finally {
      setLoading(false);
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
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '24px',
        maxWidth: '600px',
        width: '90%',
        maxHeight: '80vh',
        overflow: 'auto',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
      }}>
        <h2>Zeiträume für {azubi.vorname} {azubi.name}</h2>
        
        {/* Aktuelle Zeiträume anzeigen */}
        {periods.length > 0 ? (
          <div style={{ marginBottom: 24 }}>
            <h3>Aktuelle Zeiträume:</h3>
            {periods.map(period => (
              <div key={period.id} style={{ 
                display: 'flex', 
                alignItems: 'center', 
                marginBottom: 12, 
                padding: 12, 
                backgroundColor: '#f5f5f5', 
                borderRadius: 4 
              }}>
                <div style={{ flexGrow: 1 }}>
                  <strong>{new Date(period.start_date).toLocaleDateString('de-DE')} - {new Date(period.end_date).toLocaleDateString('de-DE')}</strong>
                  {period.description && <div style={{ fontSize: '0.9em', color: '#666' }}>{period.description}</div>}
                </div>
                <button 
                  onClick={() => deletePeriod(period.id)} 
                  disabled={loading}
                  style={{ 
                    marginLeft: 12, 
                    backgroundColor: '#ff4444', 
                    color: 'white', 
                    border: 'none', 
                    padding: '6px 12px', 
                    borderRadius: 4, 
                    cursor: loading ? 'not-allowed' : 'pointer'
                  }}
                >
                  Löschen
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: '#666', fontStyle: 'italic', marginBottom: 24 }}>Keine Zeiträume definiert</p>
        )}

        {/* Neuen Zeitraum hinzufügen */}
        <div style={{ border: '1px solid #ddd', padding: 16, borderRadius: 4, backgroundColor: '#fafafa' }}>
          <h3>Neuen Zeitraum hinzufügen:</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: '0.9em', fontWeight: 'bold' }}>Von:</label>
              <input 
                type="date" 
                value={newPeriod.start_date} 
                onChange={e => setNewPeriod({...newPeriod, start_date: e.target.value})}
                style={{ width: '100%', padding: '8px' }}
                disabled={loading}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: '0.9em', fontWeight: 'bold' }}>Bis:</label>
              <input 
                type="date" 
                value={newPeriod.end_date} 
                onChange={e => setNewPeriod({...newPeriod, end_date: e.target.value})}
                style={{ width: '100%', padding: '8px' }}
                disabled={loading}
              />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', marginBottom: 4, fontSize: '0.9em', fontWeight: 'bold' }}>Beschreibung (optional):</label>
            <input 
              type="text" 
              value={newPeriod.description} 
              onChange={e => setNewPeriod({...newPeriod, description: e.target.value})}
              placeholder="z.B. 2. Lehrjahr, Praktikum..."
              style={{ width: '100%', padding: '8px' }}
              disabled={loading}
            />
          </div>
          <button 
            onClick={addPeriod}
            disabled={loading}
            style={{ 
              backgroundColor: '#007acc', 
              color: 'white', 
              border: 'none', 
              padding: '10px 20px', 
              borderRadius: 4, 
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Wird hinzugefügt...' : 'Hinzufügen'}
          </button>
        </div>

        <div style={{ marginTop: 24, textAlign: 'right' }}>
          <button 
            onClick={onClose}
            style={{ 
              backgroundColor: '#6c757d', 
              color: 'white', 
              border: 'none', 
              padding: '10px 20px', 
              borderRadius: 4, 
              cursor: 'pointer'
            }}
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
};

interface Person {
  id: number;
  name: string;
  vorname: string;
  teilzeit: number;
  fahrzeugfuehrer: boolean;
  fahrzeugfuehrerHLFB: boolean;
  nef?: boolean; // durchreichen (nicht inline editierbar hier)
  itwMaschinist?: boolean;
  itwFahrzeugfuehrer?: boolean;
  sort?: number;
  active?: number | boolean;
  street?: string;
  postalCode?: string;
  city?: string;
  phone?: string;
  mobile?: string;
  email?: string;
}

interface Azubi { id: number; name: string; vorname: string; lehrjahr: number }
interface ItwDoctor { id: number; name: string; vorname: string }
interface AzubiPeriod {
  id: number;
  azubi_id: number;
  start_date: string;
  end_date: string;
  description?: string;
}

interface QualificationPeriod {
  id: number;
  personId: number;
  qualType: string;
  startYM: string;
  endYM: string;
  active: boolean;
}

const PersonnelOverview: React.FC = () => {
  const [personnel, setPersonnel] = useState<Person[]>([]);
  const [azubis, setAzubis] = useState<Azubi[]>([]);
  const [azubiPeriods, setAzubiPeriods] = useState<Record<number, AzubiPeriod[]>>({});
  const [showPeriodManager, setShowPeriodManager] = useState(false);
  const [selectedAzubiForPeriods, setSelectedAzubiForPeriods] = useState<Azubi | null>(null);
  const [qualificationPeriods, setQualificationPeriods] = useState<Record<number, QualificationPeriod[]>>({});
  const [itws, setItws] = useState<ItwDoctor[]>([]);
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [draggedAzubiId, setDraggedAzubiId] = useState<number | null>(null);
  const [draggedItwId, setDraggedItwId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const [dragPosition, setDragPosition] = useState<'above' | 'below' | null>(null);
  const [dragContext, setDragContext] = useState<'person'|'azubi'|'itw'|null>(null);
  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(null);
  // Azubi/ITW: gleiche Optik/Verhalten/Bearbeitung
  const [editingAzubis, setEditingAzubis] = useState(false);
  const [selectedAzubiId, setSelectedAzubiId] = useState<number | null>(null);
  const [originalAzubis, setOriginalAzubis] = useState<Azubi[] | null>(null);
  const [editingItw, setEditingItw] = useState(false);
  const [selectedItwId, setSelectedItwId] = useState<number | null>(null);
  const [originalItws, setOriginalItws] = useState<ItwDoctor[] | null>(null);

  const [showInactive, setShowInactive] = useState(false);
  
  // Modal States entfernt - nutzt direkt openEditPersonWindow für alle

  const loadPersonnel = useCallback(async () => {
    setLoading(true);
    const list = await (window as any).api.getPersonnelList(showInactive);
    setPersonnel(list);
    setLoading(false);
  }, [showInactive]);

  const loadAzubis = useCallback(async () => {
    const list = await (window as any).api.getAzubiList();
    setAzubis(list);
    // Lade Zeiträume für alle Azubis
    const allPeriods = await (window as any).api.getAllAzubiPeriods();
    const periodsByAzubi: Record<number, AzubiPeriod[]> = {};
    allPeriods.forEach((period: AzubiPeriod) => {
      if (!periodsByAzubi[period.azubi_id]) {
        periodsByAzubi[period.azubi_id] = [];
      }
      periodsByAzubi[period.azubi_id].push(period);
    });
    setAzubiPeriods(periodsByAzubi);
  }, []);

  const loadQualificationPeriods = useCallback(async () => {
    try {
      const allPeriods = await (window as any).api.getAllQualificationPeriods();
      const periodsByPerson: Record<number, QualificationPeriod[]> = {};
      allPeriods.forEach((period: QualificationPeriod) => {
        if (!periodsByPerson[period.personId]) {
          periodsByPerson[period.personId] = [];
        }
        periodsByPerson[period.personId].push(period);
      });
      setQualificationPeriods(periodsByPerson);
    } catch (error) {
      console.error('Fehler beim Laden der Qualifikationsperioden:', error);
    }
  }, []);

  const loadItws = useCallback(async () => {
    const list = await (window as any).api.getItwDoctors();
    setItws(list);
  }, []);

  useEffect(() => {
    loadPersonnel();
    loadAzubis();
    loadItws();
    loadQualificationPeriods();
    const handler = (_event: any) => {
      console.log('[Renderer] personnel-updated Event empfangen');
      loadPersonnel();
      loadAzubis();
      loadItws();
      loadQualificationPeriods();
    };
    (window as any).api.onPersonnelUpdated?.(handler);
    // subscribe to azubi broadcasts from main
    const azubiHandler = (_event: any) => {
      console.log('[Renderer] azubis-updated Event empfangen');
      loadAzubis();
      loadQualificationPeriods();
    };
    (window as any).api.onAzubisUpdated?.(azubiHandler);
    const itwHandler = (_event: any) => {
      console.log('[Renderer] itw-updated Event empfangen');
      loadItws();
    };
    (window as any).api.onItwUpdated?.(itwHandler);
    // postMessage-Listener für Popups
    const messageHandler = (event: MessageEvent) => {
      if (event.data === 'personnel-updated') {
        console.log('[Renderer] personnel-updated via postMessage empfangen');
        loadPersonnel();
      } else if (event.data === 'azubis-updated') {
        console.log('[Renderer] azubis-updated via postMessage empfangen');
        loadAzubis();
      } else if (event.data === 'itw-updated') {
        console.log('[Renderer] itw-updated via postMessage empfangen');
        loadItws();
      }
    };
    window.addEventListener('message', messageHandler);
    return () => {
      (window as any).api.offPersonnelUpdated?.(handler);
      (window as any).api.offAzubisUpdated?.(azubiHandler);
      (window as any).api.offItwUpdated?.(itwHandler);
      window.removeEventListener('message', messageHandler);
    };
  }, [loadPersonnel, loadAzubis]);

  const onDragStart = (id: number) => setDraggedId(id);
  const onDragOver = (e: React.DragEvent<HTMLTableRowElement>, overId: number, ctx: 'person'|'azubi'|'itw') => {
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const pos = offsetY < rect.height / 2 ? 'above' : 'below';
    setDragOverId(overId);
    setDragPosition(pos);
    setDragContext(ctx);
  };
  const onDragLeave = () => {
    setDragOverId(null);
    setDragPosition(null);
    setDragContext(null);
  };
  const onDrop = async (id: number) => {
    if (draggedId === null || draggedId === id) return;
    const oldIndex = personnel.findIndex(p => p.id === draggedId);
    let newIndex = personnel.findIndex(p => p.id === id);
    if (dragPosition === 'below') newIndex += 1;
    const updated = [...personnel];
    const [removed] = updated.splice(oldIndex, 1);
    if (oldIndex < newIndex) newIndex -= 1; // nach Entfernen rutscht Ziel nach oben
    updated.splice(Math.max(0, Math.min(updated.length, newIndex)), 0, removed);
    setPersonnel(updated);
    setDraggedId(null);
    setDragOverId(null);
    setDragPosition(null);
    // Reihenfolge in DB speichern
    await (window as any).api.updatePersonnelOrder(updated.map(p => p.id));
    loadPersonnel();
  };

  // --- Personal Actions ---
  const handleRowClick = (id: number) => {
    setSelectedPersonId(id === selectedPersonId ? null : id);
  };

  const onAzubiDragStart = (id: number) => setDraggedAzubiId(id);
  const onAzubiDrop = async (id: number) => {
    if (draggedAzubiId === null || draggedAzubiId === id) return;
    const oldIndex = azubis.findIndex(a => a.id === draggedAzubiId);
    let newIndex = azubis.findIndex(a => a.id === id);
    if (dragPosition === 'below') newIndex += 1;
    const updated = [...azubis];
    const [removed] = updated.splice(oldIndex, 1);
    if (oldIndex < newIndex) newIndex -= 1;
    updated.splice(Math.max(0, Math.min(updated.length, newIndex)), 0, removed);
    setAzubis(updated);
    setDraggedAzubiId(null);
    setDragOverId(null);
    setDragPosition(null);
    // Reihenfolge in DB speichern
    await (window as any).api.updateAzubiOrder(updated.map(a => a.id));
    loadAzubis();
  };

  const onItwDragStart = (id: number) => setDraggedItwId(id);
  const onItwDrop = async (id: number) => {
    if (draggedItwId === null || draggedItwId === id) return;
    const oldIndex = itws.findIndex(a => a.id === draggedItwId);
    let newIndex = itws.findIndex(a => a.id === id);
    if (dragPosition === 'below') newIndex += 1;
    const updated = [...itws];
    const [removed] = updated.splice(oldIndex, 1);
    if (oldIndex < newIndex) newIndex -= 1;
    updated.splice(Math.max(0, Math.min(updated.length, newIndex)), 0, removed);
    setItws(updated);
    setDraggedItwId(null);
    setDragOverId(null);
    setDragPosition(null);
    // Reihenfolge in DB speichern
    await (window as any).api.updateItwDoctorOrder(updated.map(a => a.id));
    loadItws();
  };

  // Azubi Inline-Edit Handling
  const startEditingAzubis = () => { setOriginalAzubis(JSON.parse(JSON.stringify(azubis))); setEditingAzubis(true); };
  const cancelEditingAzubis = () => { if (originalAzubis) setAzubis(originalAzubis); setEditingAzubis(false); };
  const saveEditingAzubis = async () => {
    try {
      for (const a of azubis) {
        const orig = originalAzubis?.find(o => o.id === a.id);
        if (!orig || JSON.stringify(orig) !== JSON.stringify(a)) {
          await (window as any).api.updateAzubi({ id: a.id, name: a.name, vorname: a.vorname, lehrjahr: a.lehrjahr });
        }
      }
      setEditingAzubis(false);
      setOriginalAzubis(null);
      loadAzubis();
    } catch (e) { console.warn('[PersonnelOverview] saveEditingAzubis Fehler', e); }
  };
  const updateAzubiField = (id: number, field: keyof Azubi, value: any) => {
    setAzubis(prev => prev.map(a => a.id === id ? { ...a, [field]: value } as Azubi : a));
  };
  const handleAzubiRowClick = (id: number) => setSelectedAzubiId(id === selectedAzubiId ? null : id);
  const handleDeleteSelectedAzubi = () => { if (selectedAzubiId == null) return; (window as any).api.openConfirmDeleteWindow(selectedAzubiId, 'azubi'); };

  // ITW Inline-Edit Handling
  const startEditingItw = () => { setOriginalItws(JSON.parse(JSON.stringify(itws))); setEditingItw(true); };
  const cancelEditingItw = () => { if (originalItws) setItws(originalItws); setEditingItw(false); };
  const saveEditingItw = async () => {
    try {
      for (const d of itws) {
        const orig = originalItws?.find(o => o.id === d.id);
        if (!orig || JSON.stringify(orig) !== JSON.stringify(d)) {
          await (window as any).api.updateItwDoctor({ id: d.id, name: d.name, vorname: d.vorname });
        }
      }
      setEditingItw(false);
      setOriginalItws(null);
      loadItws();
    } catch (e) { console.warn('[PersonnelOverview] saveEditingItw Fehler', e); }
  };
  const updateItwField = (id: number, field: keyof ItwDoctor, value: any) => {
    setItws(prev => prev.map(a => a.id === id ? { ...a, [field]: value } as ItwDoctor : a));
  };
  const handleItwRowClick = (id: number) => setSelectedItwId(id === selectedItwId ? null : id);
  const handleDeleteSelectedItw = () => { if (selectedItwId == null) return; (window as any).api.openConfirmDeleteWindow(selectedItwId, 'itw'); };



  return (
    <div style={{ padding: 24 }}>

  {/* Überschrift entfernt */}
      {loading ? <div>Lade Daten...</div> : (
      <>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} /> Inaktive anzeigen
        </label>
      </div>
      {/* Stammpersonal: Buttons unter der Tabelle */}
      <table className={styles.table}>
        <thead>
          <tr className={styles.thead}>
            <th>Name</th>
            <th>Vorname</th>
            <th className={styles.checkboxCell}>Aktiv</th>
            <th style={{ width: 120 }} className={styles.center}>Qualifikationen</th>
            <th style={{ width: 100 }} className={styles.center}>Aktionen</th>
          </tr>
        </thead>
        <tbody className={styles.tbody}>
          {personnel.map(person => {
            const selected = person.id === selectedPersonId;
            const isOver = dragContext === 'person' && dragOverId === person.id;
            const rowClass = [styles.row, selected ? styles.selected : '', isOver && dragPosition === 'above' ? styles.dropAbove : '', isOver && dragPosition === 'below' ? styles.dropBelow : ''].filter(Boolean).join(' ');
            const inactive = !(person.active ?? 1);
            return (
              <tr
                key={person.id}
                draggable={true}
                onDragStart={() => onDragStart(person.id)}
                onDragOver={(e) => onDragOver(e, person.id, 'person')}
                onDragLeave={() => onDragLeave()}
                onDrop={() => onDrop(person.id)}
                onClick={() => handleRowClick(person.id)}
                className={rowClass}
                style={{ cursor: 'move', opacity: inactive ? 0.6 : 1 }}
              >
                <td>
                  {person.name}
                  {person.teilzeit && person.teilzeit < 100 && (
                    <span style={{ fontSize: '11px', color: '#666', marginLeft: '8px' }}>
                      ({person.teilzeit}%)
                    </span>
                  )}
                </td>
                <td>{person.vorname}</td>
                <td className={styles.checkboxCell}>
                  <span style={{ 
                    color: (person.active ?? 1) ? '#28a745' : '#dc3545',
                    fontSize: '16px'
                  }}>
                    {(person.active ?? 1) ? '✓' : '✗'}
                  </span>
                </td>
                <td className={styles.center} style={{ fontSize: '11px', padding: '4px' }}>
                  {qualificationPeriods[person.id] && qualificationPeriods[person.id].length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px' }}>
                      {qualificationPeriods[person.id]
                        .filter(q => q.active)
                        .slice(0, 3)
                        .map((qual, idx) => (
                          <span
                            key={idx}
                            style={{
                              background: '#007bff',
                              color: 'white',
                              padding: '2px 6px',
                              borderRadius: '3px',
                              fontSize: '10px',
                              whiteSpace: 'nowrap'
                            }}
                            title={`${qual.qualType}: ${qual.startYM} - ${qual.endYM || 'unbegrenzt'}`}
                          >
                            {qual.qualType === 'Fahrzeugführer' ? 'FzF' :
                             qual.qualType === 'Fahrzeugführer HLF-B' ? 'HLF' :
                             qual.qualType === 'ITW Maschinist' ? 'ITW-Ma' :
                             qual.qualType === 'ITW Fahrzeugführer' ? 'ITW-FzF' :
                             qual.qualType.substring(0, 4)}
                          </span>
                        ))}
                      {qualificationPeriods[person.id].filter(q => q.active).length > 3 && (
                        <span style={{ fontSize: '10px', color: '#666' }}>
                          +{qualificationPeriods[person.id].filter(q => q.active).length - 3}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span style={{ color: '#ccc', fontSize: '10px' }}>Keine</span>
                  )}
                </td>
                <td className={styles.center}>
                  <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        (window as any).api.openEditPersonWindow(person.id);
                      }}
                      style={{
                        background: '#007bff',
                        color: 'white',
                        border: 'none',
                        padding: '4px 8px',
                        borderRadius: '3px',
                        cursor: 'pointer',
                        fontSize: '11px'
                      }}
                      title="Person bearbeiten"
                    >
                      ✏️
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
  </table>
  {/* Aktionen unter der Stammpersonal-Tabelle */}
  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
    <button onClick={() => (window as any).api.openAddPersonWindow()}>
      Hinzufügen
    </button>
  </div>
  </>
      )}
      <div style={{ marginTop: 32 }}>
        <h3>Azubis</h3>
        {/* Azubis: Buttons unter der Tabelle */}
        <table className={styles.table}>
          <thead>
            <tr className={styles.thead}>
              <th>Name</th>
              <th>Vorname</th>
              <th className={styles.narrow}>Lehrjahr</th>
              <th>Zeiträume</th>
              <th className={styles.center}>Aktionen</th>
              <th className={styles.center} style={{ width: 60 }}>#</th>
            </tr>
          </thead>
          <tbody className={styles.tbody}>
            {azubis.map(a => {
              const isOver = dragContext === 'azubi' && dragOverId === a.id;
              const rowClass = [styles.row, selectedAzubiId === a.id ? styles.selected : '', isOver && dragPosition === 'above' ? styles.dropAbove : '', isOver && dragPosition === 'below' ? styles.dropBelow : ''].filter(Boolean).join(' ');
              const periods = azubiPeriods[a.id] || [];
              const periodsText = periods.length > 0 
                ? periods.map(p => `${new Date(p.start_date).toLocaleDateString('de-DE')} - ${new Date(p.end_date).toLocaleDateString('de-DE')}`).join(', ')
                : 'Keine Zeiträume definiert';
              
              return (
                <tr key={a.id}
                    draggable={!editingAzubis}
                    onDragStart={() => !editingAzubis && onAzubiDragStart(a.id)}
                    onDragOver={(e) => !editingAzubis && onDragOver(e, a.id, 'azubi')}
                    onDragLeave={() => !editingAzubis && onDragLeave()}
                    onDrop={() => !editingAzubis && onAzubiDrop(a.id)}
                    onClick={() => handleAzubiRowClick(a.id)}
                    className={rowClass}
                    style={{ cursor: editingAzubis ? 'default' : 'move' }}>
                  <td>{editingAzubis ? <input value={a.name} onChange={e => updateAzubiField(a.id, 'name', e.target.value)} /> : a.name}</td>
                  <td>{editingAzubis ? <input value={a.vorname} onChange={e => updateAzubiField(a.id, 'vorname', e.target.value)} /> : a.vorname}</td>
                  <td>{editingAzubis ? <input type="number" className={styles.narrow} value={a.lehrjahr} onChange={e => updateAzubiField(a.id, 'lehrjahr', Number(e.target.value))} /> : a.lehrjahr}</td>
                  <td style={{ fontSize: '0.9em', color: periods.length > 0 ? '#333' : '#999', maxWidth: '200px', wordWrap: 'break-word' }}>
                    {periodsText}
                  </td>
                  <td className={styles.center}>
                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          (window as any).api.openEditAzubiWindow(a.id);
                        }}
                        style={{
                          background: '#007bff',
                          color: 'white',
                          border: 'none',
                          padding: '4px 8px',
                          borderRadius: '3px',
                          cursor: 'pointer',
                          fontSize: '11px'
                        }}
                        title="Azubi bearbeiten"
                      >
                        ✏️
                      </button>
                      {/* Zeiträume-Button entfernt - jetzt über Qualifikationssystem */}
                    </div>
                  </td>
                  <td className={styles.center}>{selectedAzubiId === a.id ? '✓' : ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!editingAzubis ? (
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={() => (window as any).api.openAddAzubiWindow()}>Hinzufügen</button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={saveEditingAzubis}>Speichern</button>
            <button onClick={cancelEditingAzubis}>Abbrechen</button>
          </div>
        )}
      </div>
      <div style={{ marginTop: 32 }}>
        <h3>ITW Ärzte</h3>
        {/* ITW Ärzte: Buttons unter der Tabelle */}
        <table className={styles.table}>
          <thead>
            <tr className={styles.thead}>
              <th>Name</th>
              <th>Vorname</th>
              <th className={styles.center} style={{ width: 60 }}>#</th>
            </tr>
          </thead>
          <tbody className={styles.tbody}>
            {itws.map(a => {
              const isOver = dragContext === 'itw' && dragOverId === a.id;
              const rowClass = [styles.row, selectedItwId === a.id ? styles.selected : '', isOver && dragPosition === 'above' ? styles.dropAbove : '', isOver && dragPosition === 'below' ? styles.dropBelow : ''].filter(Boolean).join(' ');
              return (
                <tr key={a.id}
                    draggable={!editingItw}
                    onDragStart={() => !editingItw && onItwDragStart(a.id)}
                    onDragOver={(e) => !editingItw && onDragOver(e, a.id, 'itw')}
                    onDragLeave={() => !editingItw && onDragLeave()}
                    onDrop={() => !editingItw && onItwDrop(a.id)}
                    onClick={() => handleItwRowClick(a.id)}
                    className={rowClass}
                    style={{ cursor: editingItw ? 'default' : 'move' }}>
                  <td>{editingItw ? <input value={a.name} onChange={e => updateItwField(a.id, 'name', e.target.value)} /> : a.name}</td>
                  <td>{editingItw ? <input value={a.vorname} onChange={e => updateItwField(a.id, 'vorname', e.target.value)} /> : a.vorname}</td>
                  <td className={styles.center}>{selectedItwId === a.id ? '✓' : ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!editingItw ? (
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={() => (window as any).api.openAddItwWindow()}>Hinzufügen</button>
            <button onClick={startEditingItw} disabled={itws.length === 0}>Ändern</button>
            <button onClick={handleDeleteSelectedItw} disabled={selectedItwId == null}>Löschen</button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={saveEditingItw}>Speichern</button>
            <button onClick={cancelEditingItw}>Abbrechen</button>
          </div>
        )}
      </div>
      
      {/* PersonEditModal entfernt - nutzt direkt openEditPersonWindow */}

      {/* AzubiEditModal entfernt - nutzt direkt openEditPersonWindow */}

      {/* Zeiträume Manager Dialog */}
      {/* AzubiPeriodsManager entfernt - jetzt über Qualifikationssystem */}
      
      {/* Globale Bottom-Buttons entfernt, da Aktionen nun unter jeder Tabelle stehen */}
    </div>
  );
};

export default PersonnelOverview;
