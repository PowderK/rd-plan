
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import styles from './PersonnelOverview.module.css';
import { normalizeDepartmentName } from '../utils/personPeriods';
import * as XLSX from 'xlsx';

// Zeiträume Manager Komponente
const AzubiPeriodsManager: React.FC<{ azubi: Azubi; onClose: () => void }> = ({ azubi, onClose }) => {
  const [periods, setPeriods] = useState<AzubiPeriod[]>([]);
  const [minLehrjahr, setMinLehrjahr] = useState(1);
  const [newPeriod, setNewPeriod] = useState({ start_date: '', end_date: '', description: '', lehrjahr: 1 });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadPeriods = async () => {
      try {
        const azubiPeriods = await (window as any).api.getAzubiPeriods(azubi.id);
        setPeriods(azubiPeriods);

        // Ermittle das Lehrjahr des letzten Zeitraums als Minimum
        if (azubiPeriods.length > 0) {
          const sortedPeriods = [...azubiPeriods].sort((a, b) =>
            new Date(b.end_date).getTime() - new Date(a.end_date).getTime()
          );
          const lastLehrjahr = sortedPeriods[0].lehrjahr || 1;
          setMinLehrjahr(lastLehrjahr);
          setNewPeriod(prev => ({ ...prev, lehrjahr: lastLehrjahr }));
        }
      } catch (error) {
        // console.error('Fehler beim Laden der Zeiträume:', error);
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
        description: newPeriod.description || undefined,
        lehrjahr: newPeriod.lehrjahr
      });

      // Zeiträume neu laden
      const updatedPeriods = await (window as any).api.getAzubiPeriods(azubi.id);
      setPeriods(updatedPeriods);

      // Aktualisiere minLehrjahr basierend auf neuem letzten Zeitraum
      if (updatedPeriods.length > 0) {
        const sortedPeriods = [...updatedPeriods].sort((a, b) =>
          new Date(b.end_date).getTime() - new Date(a.end_date).getTime()
        );
        const lastLehrjahr = sortedPeriods[0].lehrjahr || 1;
        setMinLehrjahr(lastLehrjahr);
        setNewPeriod({ start_date: '', end_date: '', description: '', lehrjahr: lastLehrjahr });
      } else {
        setNewPeriod({ start_date: '', end_date: '', description: '', lehrjahr: minLehrjahr });
      }
    } catch (error) {
      // console.error('Fehler beim Hinzufügen des Zeitraums:', error);
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
      // console.error('Fehler beim Löschen des Zeitraums:', error);
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
                  <strong>{new Date(period.start_date).toLocaleDateString('de-DE', { month: '2-digit', year: 'numeric' })} - {new Date(period.end_date).toLocaleDateString('de-DE', { month: '2-digit', year: 'numeric' })}</strong>
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
                onChange={e => setNewPeriod({ ...newPeriod, start_date: e.target.value })}
                style={{ width: '100%', padding: '8px' }}
                disabled={loading}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: '0.9em', fontWeight: 'bold' }}>Bis:</label>
              <input
                type="date"
                value={newPeriod.end_date}
                onChange={e => setNewPeriod({ ...newPeriod, end_date: e.target.value })}
                style={{ width: '100%', padding: '8px' }}
                disabled={loading}
              />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', marginBottom: 4, fontSize: '0.9em', fontWeight: 'bold' }}>Lehrjahr:</label>
            <select
              value={newPeriod.lehrjahr}
              onChange={e => setNewPeriod({ ...newPeriod, lehrjahr: Number(e.target.value) })}
              style={{ width: '100%', padding: '8px' }}
              disabled={loading}
            >
              {minLehrjahr <= 1 && <option value={1}>1. Lehrjahr</option>}
              {minLehrjahr <= 2 && <option value={2}>2. Lehrjahr</option>}
              <option value={3}>3. Lehrjahr</option>
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', marginBottom: 4, fontSize: '0.9em', fontWeight: 'bold' }}>Beschreibung (optional):</label>
            <input
              type="text"
              value={newPeriod.description}
              onChange={e => setNewPeriod({ ...newPeriod, description: e.target.value })}
              placeholder="z.B. Praktikum, Urlaub..."
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
  roleId?: number;
  personnelNumber?: string;
  department?: string;
}

interface Azubi { id: number; name: string; vorname: string; lehrjahr: number }
interface ItwDoctor { id: number; name: string; vorname: string; anrede?: string; title?: string }
interface AzubiPeriod {
  id: number;
  azubi_id: number;
  start_date: string;
  end_date: string;
  description?: string;
  lehrjahr?: number;
}

interface QualificationPeriod {
  id: number;
  personId: number;
  qualType: string;
  startYM: string;
  endYM: string;
  active: boolean;
}

interface ActivePeriod {
  id: number;
  personId: number;
  startYM: string;
  endYM: string;
  description: string;
  active: boolean;
}

interface PersonnelOverviewProps {
  setFooterActions?: (actions: React.ReactNode) => void;
}

const PersonnelOverview: React.FC<PersonnelOverviewProps & { departmentName?: string }> = ({ setFooterActions, departmentName }) => {
  const [activeTab, setActiveTab] = useState<'stammpersonal' | 'azubis' | 'ärzte' | 'gäste'>('stammpersonal');
  const [itwEnabled, setItwEnabled] = useState<boolean>(false);
  const [personnel, setPersonnel] = useState<Person[]>([]);
  const [azubis, setAzubis] = useState<Azubi[]>([]);
  const [azubiPeriods, setAzubiPeriods] = useState<Record<number, AzubiPeriod[]>>({});
  const [showPeriodManager, setShowPeriodManager] = useState(false);
  const [selectedAzubiForPeriods, setSelectedAzubiForPeriods] = useState<Azubi | null>(null);
  const [qualificationPeriods, setQualificationPeriods] = useState<Record<number, QualificationPeriod[]>>({});
  const [activePeriods, setActivePeriods] = useState<Record<number, ActivePeriod[]>>({});
  const [departmentPeriods, setDepartmentPeriods] = useState<Record<number, any[]>>({});
  const [itws, setItws] = useState<ItwDoctor[]>([]);
  const [guests, setGuests] = useState<any[]>([]);
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [draggedAzubiId, setDraggedAzubiId] = useState<number | null>(null);
  const [draggedItwId, setDraggedItwId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const [dragPosition, setDragPosition] = useState<'above' | 'below' | null>(null);
  const [dragContext, setDragContext] = useState<'person' | 'azubi' | 'itw' | null>(null);
  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(null);
  // Azubi/ITW: gleiche Optik/Verhalten/Bearbeitung
  const [editingAzubis, setEditingAzubis] = useState(false);
  const [selectedAzubiId, setSelectedAzubiId] = useState<number | null>(null);
  const [originalAzubis, setOriginalAzubis] = useState<Azubi[] | null>(null);
  const [editingItw, setEditingItw] = useState(false);
  const [selectedItwId, setSelectedItwId] = useState<number | null>(null);
  const [originalItws, setOriginalItws] = useState<ItwDoctor[] | null>(null);

  const [showInactive, setShowInactive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [formatModal, setFormatModal] = useState<{ action: 'import' | 'export'; category: 'stammpersonal' | 'azubis' | 'ärzte' | 'gäste' } | null>(null);
  const [conflictModal, setConflictModal] = useState<{ name: string; category: string; onResolve: (action: 'update' | 'skip', applyToAll: boolean) => void } | null>(null);
  const [conflictApplyToAll, setConflictApplyToAll] = useState<boolean>(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Rollen für Dropdown
  const [roles, setRoles] = useState<{ id: number; name: string }[]>([]);

  // Modal States entfernt - nutzt direkt openEditPersonWindow für alle

  const handleFooterAdd = useCallback(() => {
    if (activeTab === 'azubis') {
      (window as any).api.openAddAzubiWindow();
      return;
    }

    if (activeTab === 'ärzte' && itwEnabled) {
      (window as any).api.openAddItwWindow();
      return;
    }

    (window as any).api.openAddPersonWindow();
  }, [activeTab, itwEnabled]);

  useEffect(() => {
    if (!setFooterActions) return;
    setFooterActions(<button onClick={handleFooterAdd}>Hinzufügen</button>);
    return () => setFooterActions(null);
  }, [setFooterActions, handleFooterAdd]);

  const loadPersonnel = useCallback(async () => {
    setLoading(true);
    // Wenn inaktive angezeigt werden sollen: includeInactive=true, date egal
    // Wenn inaktive ausgeblendet werden sollen: includeInactive=false, date=Aktuelles Jahr
    const currentYear = new Date().getFullYear().toString();
    const list = await (window as any).api.getPersonnelList(showInactive, showInactive ? undefined : currentYear, departmentName);
    setPersonnel(list);
    setLoading(false);
  }, [showInactive, departmentName]);

  const loadActivePeriods = useCallback(async () => {
    try {
      const allPeriods = await (window as any).api.getAllPersonnelActivePeriods();
      const periodsByPerson: Record<number, ActivePeriod[]> = {};
      allPeriods.forEach((period: ActivePeriod) => {
        if (!periodsByPerson[period.personId]) {
          periodsByPerson[period.personId] = [];
        }
        periodsByPerson[period.personId].push(period);
      });
      setActivePeriods(periodsByPerson);
    } catch (error) {}
  }, []);

  const loadAllDepartmentPeriods = useCallback(async () => {
    try {
      const allPeriods = await (window as any).api.getAllPersonnelDepartmentPeriods();
      const periodsByPerson: Record<number, any[]> = {};
      allPeriods.forEach((period: any) => {
        if (!periodsByPerson[period.personId]) {
          periodsByPerson[period.personId] = [];
        }
        periodsByPerson[period.personId].push(period);
      });
      setDepartmentPeriods(periodsByPerson);
    } catch (error) {}
  }, []);

  const loadAzubis = useCallback(async () => {
    const list = await (window as any).api.getAzubiList(departmentName);
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
  }, [departmentName]);

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
      // console.error('Fehler beim Laden der Qualifikationsperioden:', error);
    }
  }, []);

  const loadItws = useCallback(async () => {
    const list = await (window as any).api.getItwDoctors();
    setItws(list);
  }, []);

  const loadGuests = useCallback(async () => {
    try {
      const list = await (window as any).api.getAllGuests();
      setGuests(list || []);
    } catch(e) {}
  }, []);

  const loadRoles = useCallback(async () => {
    try {
      let list: any[] = [];
      try {
        const fetchedRoles = await (window as any).api.getRoles?.();
        if (Array.isArray(fetchedRoles) && fetchedRoles.length > 0) {
          list = fetchedRoles;
        }
      } catch (error) {
        console.warn('Failed to load roles from table:', error);
        list = [];
      }

      if (list.length === 0) {
        try {
          const rolesData = await (window as any).api.getSetting('roles');
          if (rolesData) {
            const parsedRoles = JSON.parse(String(rolesData));
            list = Array.isArray(parsedRoles) ? parsedRoles : [];
          }
        } catch (error) {
          console.warn('Failed to load legacy roles from settings:', error);
          list = [];
        }
      }

      setRoles(Array.isArray(list) ? list.map((r: any) => ({ id: Number(r.id), name: String(r.name || r.id) })) : []);
    } catch (error) {
      console.warn('Unexpected error loading roles:', error);
    }
  }, []);

  useEffect(() => {
    const loadItwFeature = async () => {
      try {
        const val = await (window as any).api.getSetting('itw');
        const enabled = val === 'true' || val === '1';
        setItwEnabled(enabled);
        if (!enabled) {
          setActiveTab(prev => prev === 'ärzte' ? 'stammpersonal' : prev);
        }
      } catch {}
    };

    loadPersonnel();
    loadAzubis();
    loadItws();
    loadQualificationPeriods();
    loadActivePeriods();
    loadAllDepartmentPeriods();
    loadRoles();
    loadItwFeature();
    const handler = (_event: any) => {
      // console.log('[Renderer] personnel-updated Event empfangen');
      loadPersonnel();
      loadAzubis();
      loadItws();
      loadQualificationPeriods();
      loadActivePeriods();
    };
    (window as any).api.onPersonnelUpdated?.(handler);
    // subscribe to azubi broadcasts from main
    const azubiHandler = (_event: any) => {
      // console.log('[Renderer] azubis-updated Event empfangen');
      loadAzubis();
      loadQualificationPeriods();
    };
    (window as any).api.onAzubisUpdated?.(azubiHandler);
    const itwHandler = (_event: any) => {
      // console.log('[Renderer] itw-updated Event empfangen');
      loadItws();
    };
    (window as any).api.onItwUpdated?.(itwHandler);
    const guestsHandler = () => loadGuests();
    (window as any).api.onGuestsUpdated?.(guestsHandler);
    const settingsHandler = async () => {
      await loadItwFeature();
      loadPersonnel();
    };
    (window as any).api.onSettingsUpdated?.(settingsHandler);
    // postMessage-Listener für Popups
    const messageHandler = (event: MessageEvent) => {
      if (event.data === 'personnel-updated') {
        // console.log('[Renderer] personnel-updated via postMessage empfangen');
        loadPersonnel();
      } else if (event.data === 'azubis-updated') {
        // console.log('[Renderer] azubis-updated via postMessage empfangen');
        loadAzubis();
      } else if (event.data === 'itw-updated') {
        // console.log('[Renderer] itw-updated via postMessage empfangen');
        loadItws();
      }
    };
    window.addEventListener('message', messageHandler);
    loadGuests(); // Initial load for guests
    return () => {
      (window as any).api.offPersonnelUpdated?.(handler);
      (window as any).api.offAzubisUpdated?.(azubiHandler);
      (window as any).api.offItwUpdated?.(itwHandler);
      (window as any).api.offGuestsUpdated?.(guestsHandler);
      (window as any).api.offSettingsUpdated?.(settingsHandler);
      window.removeEventListener('message', messageHandler);
    };
  }, [loadPersonnel, loadAzubis, departmentName, loadGuests]);

  const onDragStart = (id: number) => setDraggedId(id);
  const onDragOver = (e: React.DragEvent<HTMLTableRowElement>, overId: number, ctx: 'person' | 'azubi' | 'itw') => {
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

  const isPersonActive = (p: Person) => {
    // If we are NOT showing inactives, then by definition anyone in the 'personnel' list is active
    // because the backend already filtered them for us.
    if (!showInactive) return true;

    const currentYM = new Date().toISOString().slice(0, 7);
    const currentDate = new Date().toISOString().slice(0, 10);
    
    // 1. Check department periods
    // In 'all' view, we don't filter by department activity
    if (departmentName && departmentName !== 'all') {
      const targetDept = normalizeDepartmentName(departmentName);
      const dPeriods = departmentPeriods[p.id] || [];
      if (dPeriods.length > 0) {
        const inDept = dPeriods.some((per: any) => 
          normalizeDepartmentName(per.department) === targetDept &&
          per.startDate <= currentDate &&
          (!per.endDate || per.endDate >= currentDate)
        );
        if (!inDept) return false;
      } else {
        // Fallback to legacy department flag if no periods exist
        if (normalizeDepartmentName(p.department) !== targetDept) return false;
      }
    }

    // 2. Check active periods (fitness for duty)
    const periods = activePeriods[p.id];
    if (periods && periods.length > 0) {
      return periods.some(per =>
        per.active &&
        per.startYM <= currentYM &&
        (!per.endYM || per.endYM >= currentYM)
      );
    }
    
    // 3. Fallback to legacy active flag
    return !!(p.active ?? 1);
  };

  const filteredActivePersonnel = useMemo(() => {
    const list = personnel.filter(p => isPersonActive(p));
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter(p => {
      const name = `${p.vorname} ${p.name}`.toLowerCase();
      const revName = `${p.name} ${p.vorname}`.toLowerCase();
      const pNum = (p.personnelNumber || '').toLowerCase();
      const roleName = (roles.find(r => r.id === p.roleId)?.name || '').toLowerCase();
      return name.includes(q) || revName.includes(q) || pNum.includes(q) || roleName.includes(q);
    });
  }, [personnel, isPersonActive, searchQuery, roles]);

  const filteredInactivePersonnel = useMemo(() => {
    const list = personnel.filter(p => !isPersonActive(p));
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter(p => {
      const name = `${p.vorname} ${p.name}`.toLowerCase();
      const revName = `${p.name} ${p.vorname}`.toLowerCase();
      const pNum = (p.personnelNumber || '').toLowerCase();
      const roleName = (roles.find(r => r.id === p.roleId)?.name || '').toLowerCase();
      return name.includes(q) || revName.includes(q) || pNum.includes(q) || roleName.includes(q);
    });
  }, [personnel, isPersonActive, searchQuery, roles]);

  const filteredAzubis = useMemo(() => {
    if (!searchQuery.trim()) return azubis;
    const q = searchQuery.toLowerCase().trim();
    return azubis.filter(a => {
      const name = `${a.vorname} ${a.name}`.toLowerCase();
      const revName = `${a.name} ${a.vorname}`.toLowerCase();
      const lj = String(a.lehrjahr || '');
      return name.includes(q) || revName.includes(q) || lj.includes(q);
    });
  }, [azubis, searchQuery]);

  const filteredItws = useMemo(() => {
    if (!searchQuery.trim()) return itws;
    const q = searchQuery.toLowerCase().trim();
    return itws.filter(a => {
      const name = `${a.anrede || ''} ${a.title || ''} ${a.vorname} ${a.name}`.toLowerCase();
      const revName = `${a.name} ${a.vorname}`.toLowerCase();
      return name.includes(q) || revName.includes(q);
    });
  }, [itws, searchQuery]);

  const filteredGuests = useMemo(() => {
    if (!searchQuery.trim()) return guests;
    const q = searchQuery.toLowerCase().trim();
    return guests.filter(g => {
      const n = (g.name || '').toLowerCase();
      const r = (g.remark || '').toLowerCase();
      return n.includes(q) || r.includes(q);
    });
  }, [guests, searchQuery]);

  const handleCategoryExport = (tab: 'stammpersonal' | 'azubis' | 'ärzte' | 'gäste', format: 'json' | 'excel') => {
    let categoryName = '';

    if (tab === 'stammpersonal') {
      categoryName = 'Stammpersonal';
      if (personnel.length === 0) {
        alert('Keine Daten für den Export im Stammpersonal vorhanden.');
        return;
      }

      if (format === 'json') {
        const fullExportData = personnel.map(p => ({
          name: p.name,
          vorname: p.vorname,
          personnelNumber: p.personnelNumber || '',
          roleName: roles.find(r => r.id === p.roleId)?.name || '',
          roleId: p.roleId || null,
          teilzeit: p.teilzeit || 100,
          department: p.department || departmentName || 'Rettungsdienst',
          active: p.active !== false,
          street: p.street || '',
          postalCode: p.postalCode || '',
          city: p.city || '',
          phone: p.phone || '',
          mobile: p.mobile || '',
          email: p.email || '',
          qualificationPeriods: (qualificationPeriods[p.id] || []).map(q => ({
            qualType: q.qualType,
            startYM: q.startYM,
            endYM: q.endYM || '',
            active: q.active !== false
          })),
          departmentPeriods: (departmentPeriods[p.id] || []).map(d => ({
            department: d.department,
            startDate: d.startDate,
            endDate: d.endDate || ''
          }))
        }));

        const jsonStr = JSON.stringify(fullExportData, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `RD-Plan_Stammpersonal_Export_${new Date().toISOString().slice(0, 10)}.json`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        // Multi-Sheet Excel Export
        const wb = XLSX.utils.book_new();

        // Sheet 1: Stammpersonal (Nur echte Kerndaten)
        const mainRows = personnel.map(p => ({
          Personalnummer: p.personnelNumber || '',
          Name: p.name,
          Vorname: p.vorname,
          Nutzerrolle: roles.find(r => r.id === p.roleId)?.name || '',
          Teilzeit: p.teilzeit || 100,
          Abteilung: p.department || departmentName || 'Rettungsdienst',
          Status: p.active !== false ? 'Aktiv' : 'Inaktiv',
          Strasse: p.street || '',
          PLZ: p.postalCode || '',
          Ort: p.city || '',
          Telefon: p.phone || '',
          Mobil: p.mobile || '',
          Email: p.email || ''
        }));
        const ws1 = XLSX.utils.json_to_sheet(mainRows);
        XLSX.utils.book_append_sheet(wb, ws1, 'Stammpersonal');

        // Sheet 2: Qualifikationen (Tatsächliche Qualifikationszeiträume)
        const qualRows: any[] = [];
        personnel.forEach(p => {
          (qualificationPeriods[p.id] || []).forEach(q => {
            qualRows.push({
              Personalnummer: p.personnelNumber || '',
              Name: p.name,
              Vorname: p.vorname,
              Qualifikation: q.qualType,
              Start_YM: q.startYM,
              Ende_YM: q.endYM || '',
              Aktiv: q.active !== false ? 'Ja' : 'Nein'
            });
          });
        });
        const ws2 = XLSX.utils.json_to_sheet(qualRows.length > 0 ? qualRows : [{ Personalnummer: '', Name: '', Vorname: '', Qualifikation: '', Start_YM: '', Ende_YM: '', Aktiv: '' }]);
        XLSX.utils.book_append_sheet(wb, ws2, 'Qualifikationen');

        // Sheet 3: Abteilungs_Zeitraeume (Abteilungszugehörigkeiten)
        const deptRows: any[] = [];
        personnel.forEach(p => {
          (departmentPeriods[p.id] || []).forEach(d => {
            deptRows.push({
              Personalnummer: p.personnelNumber || '',
              Name: p.name,
              Vorname: p.vorname,
              Abteilung: d.department,
              Start_Datum: d.startDate,
              Ende_Datum: d.endDate || ''
            });
          });
        });
        const ws3 = XLSX.utils.json_to_sheet(deptRows.length > 0 ? deptRows : [{ Personalnummer: '', Name: '', Vorname: '', Abteilung: '', Start_Datum: '', Ende_Datum: '' }]);
        XLSX.utils.book_append_sheet(wb, ws3, 'Abteilungs_Zeitraeume');

        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `RD-Plan_Stammpersonal_Export_${new Date().toISOString().slice(0, 10)}.xlsx`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } else if (tab === 'azubis') {
      categoryName = 'Azubis';
      if (azubis.length === 0) {
        alert('Keine Daten für den Export bei den Azubis vorhanden.');
        return;
      }

      if (format === 'json') {
        const fullExportData = azubis.map(a => ({
          name: a.name,
          vorname: a.vorname,
          lehrjahr: a.lehrjahr || 1,
          department: departmentName || 'Rettungsdienst',
          periods: (azubiPeriods[a.id] || []).map(p => ({
            start_date: p.start_date,
            end_date: p.end_date,
            description: p.description || '',
            lehrjahr: p.lehrjahr || 1
          }))
        }));

        const jsonStr = JSON.stringify(fullExportData, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `RD-Plan_Azubis_Export_${new Date().toISOString().slice(0, 10)}.json`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        const wb = XLSX.utils.book_new();

        // Sheet 1: Azubis
        const mainRows = azubis.map(a => ({
          Name: a.name,
          Vorname: a.vorname,
          Lehrjahr: a.lehrjahr || 1,
          Abteilung: departmentName || 'Rettungsdienst'
        }));
        const ws1 = XLSX.utils.json_to_sheet(mainRows);
        XLSX.utils.book_append_sheet(wb, ws1, 'Azubis');

        // Sheet 2: Ausbildungs_Zeitraeume
        const periodRows: any[] = [];
        azubis.forEach(a => {
          (azubiPeriods[a.id] || []).forEach(p => {
            periodRows.push({
              Name: a.name,
              Vorname: a.vorname,
              Startdatum: p.start_date,
              Enddatum: p.end_date,
              Lehrjahr: p.lehrjahr || 1,
              Beschreibung: p.description || ''
            });
          });
        });
        const ws2 = XLSX.utils.json_to_sheet(periodRows.length > 0 ? periodRows : [{ Name: '', Vorname: '', Startdatum: '', Enddatum: '', Lehrjahr: '', Beschreibung: '' }]);
        XLSX.utils.book_append_sheet(wb, ws2, 'Ausbildungs_Zeitraeume');

        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `RD-Plan_Azubis_Export_${new Date().toISOString().slice(0, 10)}.xlsx`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } else if (tab === 'ärzte') {
      categoryName = 'ITW_Aerzte';
      const exportData = itws.map(doc => ({
        Anrede: doc.anrede || '',
        Titel: doc.title || '',
        Name: doc.name,
        Vorname: doc.vorname
      }));
      if (exportData.length === 0) {
        alert('Keine Daten für den Export bei den ITW-Ärzten vorhanden.');
        return;
      }
      if (format === 'json') {
        const jsonStr = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `RD-Plan_ITW_Aerzte_Export_${new Date().toISOString().slice(0, 10)}.json`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, categoryName);
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `RD-Plan_ITW_Aerzte_Export_${new Date().toISOString().slice(0, 10)}.xlsx`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } else if (tab === 'gäste') {
      categoryName = 'Gaeste';
      const exportData = guests.map(g => ({
        Datum: g.date,
        Enddatum: g.end_date || g.endDate || '',
        Name: g.name,
        Bemerkung: g.remark || ''
      }));
      if (exportData.length === 0) {
        alert('Keine Daten für den Export bei den Gästen vorhanden.');
        return;
      }
      if (format === 'json') {
        const jsonStr = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `RD-Plan_Gaeste_Export_${new Date().toISOString().slice(0, 10)}.json`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, categoryName);
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `RD-Plan_Gaeste_Export_${new Date().toISOString().slice(0, 10)}.xlsx`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    }
  };

  const askConflictResolution = (name: string, category: string): Promise<{ action: 'update' | 'skip'; applyToAll: boolean }> => {
    setConflictApplyToAll(false);
    return new Promise((resolve) => {
      setConflictModal({
        name,
        category,
        onResolve: (action, applyToAll) => {
          setConflictModal(null);
          resolve({ action, applyToAll });
        }
      });
    });
  };

  const triggerCategoryImport = (format: 'json' | 'excel') => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.accept = format === 'json' ? '.json' : '.xlsx,.xls,.csv';
      fileInputRef.current.click();
    }
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      let importedItems: any[] = [];
      let qualRows: any[] = [];
      let deptRows: any[] = [];
      let azubiPeriodRows: any[] = [];

      const fileName = file.name.toLowerCase();

      if (fileName.endsWith('.json')) {
        const text = await file.text();
        const parsed = JSON.parse(text);
        importedItems = Array.isArray(parsed) ? parsed : [parsed];
      } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv')) {
        const arrayBuffer = await file.arrayBuffer();
        const wb = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheetName = wb.SheetNames[0];
        importedItems = XLSX.utils.sheet_to_json(wb.Sheets[firstSheetName]);

        if (wb.SheetNames.includes('Qualifikationen')) {
          qualRows = XLSX.utils.sheet_to_json(wb.Sheets['Qualifikationen']);
        }
        if (wb.SheetNames.includes('Abteilungs_Zeitraeume')) {
          deptRows = XLSX.utils.sheet_to_json(wb.Sheets['Abteilungs_Zeitraeume']);
        }
        if (wb.SheetNames.includes('Ausbildungs_Zeitraeume')) {
          azubiPeriodRows = XLSX.utils.sheet_to_json(wb.Sheets['Ausbildungs_Zeitraeume']);
        }
      } else {
        alert('Bitte eine gültige .json, .xlsx oder .csv Datei auswählen.');
        return;
      }

      if (importedItems.length === 0) {
        alert('Keine gültigen Daten zum Importieren gefunden.');
        return;
      }

      let insertedCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;
      let bulkChoice: 'update' | 'skip' | null = null;

      if (activeTab === 'stammpersonal') {
        for (const item of importedItems) {
          const name = item.name || item.Name;
          const vorname = item.vorname || item.Vorname;
          if (!name || !vorname) continue;
          const pNum = item.personnelNumber || item.PersonnelNumber || item.Personalnummer || item.personalnummer || '';
          const tz = Number(item.teilzeit || item.Teilzeit) || 100;
          const matchedRole = roles.find(r => r.name === item.roleName || r.name === item.Nutzerrolle || r.id === item.roleId);

          // Prüfe, ob die Person bereits existiert
          const existingPerson = personnel.find(p =>
            (pNum && p.personnelNumber && p.personnelNumber.trim() === pNum.trim()) ||
            (p.name.trim().toLowerCase() === name.trim().toLowerCase() && p.vorname.trim().toLowerCase() === vorname.trim().toLowerCase())
          );

          let actionToTake: 'add' | 'update' | 'skip' = 'add';

          if (existingPerson) {
            if (bulkChoice) {
              actionToTake = bulkChoice;
            } else {
              const choice = await askConflictResolution(`${vorname} ${name}`, 'Stammpersonal');
              if (choice.applyToAll) {
                bulkChoice = choice.action;
              }
              actionToTake = choice.action;
            }
          }

          if (actionToTake === 'skip') {
            skippedCount++;
            continue;
          }

          let targetPersonId: number | null = null;

          if (actionToTake === 'update' && existingPerson) {
            targetPersonId = existingPerson.id;
            await (window as any).api.updatePerson({
              id: existingPerson.id,
              name,
              vorname,
              personnelNumber: pNum || existingPerson.personnelNumber,
              roleId: matchedRole?.id || item.roleId || existingPerson.roleId,
              teilzeit: tz,
              department: item.department || item.Abteilung || departmentName || 'Rettungsdienst',
              street: item.street || item.Strasse || existingPerson.street,
              postalCode: item.postalCode || item.PLZ || existingPerson.postalCode,
              city: item.city || item.Ort || existingPerson.city,
              phone: item.phone || item.Telefon || existingPerson.phone,
              mobile: item.mobile || item.Mobil || existingPerson.mobile,
              email: item.email || item.Email || existingPerson.email
            });
            updatedCount++;
          } else {
            const res = await (window as any).api.addPerson({
              name,
              vorname,
              personnelNumber: pNum,
              roleId: matchedRole?.id || item.roleId || null,
              teilzeit: tz,
              department: item.department || item.Abteilung || departmentName || 'Rettungsdienst',
              street: item.street || item.Strasse || '',
              postalCode: item.postalCode || item.PLZ || '',
              city: item.city || item.Ort || '',
              phone: item.phone || item.Telefon || '',
              mobile: item.mobile || item.Mobil || '',
              email: item.email || item.Email || ''
            });
            insertedCount++;

            targetPersonId = res?.lastInsertRowid || res?.lastID;
            if (!targetPersonId) {
              const currentList = await (window as any).api.getPersonnelList(true, undefined, departmentName);
              const found = currentList.find((p: any) => p.name === name && p.vorname === vorname);
              if (found) targetPersonId = found.id;
            }
          }

          if (targetPersonId) {
            // 1. Qualifikationszeiträume importieren
            const qList = item.qualificationPeriods || qualRows.filter(r =>
              (pNum && (r.Personalnummer === pNum || r.personalnummer === pNum)) ||
              ((r.Name || r.name) === name && (r.Vorname || r.vorname) === vorname)
            ).map(r => ({
              qualType: r.Qualifikation || r.qualType,
              startYM: String(r.Start_YM || r.startYM || ''),
              endYM: String(r.Ende_YM || r.endYM || ''),
              active: r.Aktiv === 'Ja' || r.active === true || r.Aktiv === true
            }));

            if (Array.isArray(qList)) {
              for (const q of qList) {
                if (q.qualType && q.startYM) {
                  await (window as any).api.addQualificationPeriod({
                    personId: targetPersonId,
                    qualType: q.qualType,
                    startYM: q.startYM,
                    endYM: q.endYM || '',
                    active: q.active !== false
                  });
                }
              }
            }

            // 2. Abteilungszeiträume importieren
            const dList = item.departmentPeriods || deptRows.filter(r =>
              (pNum && (r.Personalnummer === pNum || r.personalnummer === pNum)) ||
              ((r.Name || r.name) === name && (r.Vorname || r.vorname) === vorname)
            ).map(r => ({
              department: r.Abteilung || r.department,
              startDate: String(r.Start_Datum || r.startDate || ''),
              endDate: String(r.Ende_Datum || r.endDate || '')
            }));

            if (Array.isArray(dList)) {
              for (const d of dList) {
                if (d.department && d.startDate) {
                  await (window as any).api.addPersonnelDepartmentPeriod({
                    personId: targetPersonId,
                    department: d.department,
                    startDate: d.startDate,
                    endDate: d.endDate || ''
                  });
                }
              }
            }
          }
        }
        await loadPersonnel();
        await loadQualificationPeriods();
        await loadAllDepartmentPeriods();
        alert(`Import beendet: ${insertedCount} neu angelegt, ${updatedCount} aktualisiert, ${skippedCount} übersprungen.`);
      } else if (activeTab === 'azubis') {
        for (const item of importedItems) {
          const name = item.name || item.Name;
          const vorname = item.vorname || item.Vorname;
          if (!name || !vorname) continue;
          const lj = Number(item.lehrjahr || item.Lehrjahr) || 1;

          const existingAzubi = azubis.find(a =>
            a.name.trim().toLowerCase() === name.trim().toLowerCase() && a.vorname.trim().toLowerCase() === vorname.trim().toLowerCase()
          );

          let actionToTake: 'add' | 'update' | 'skip' = 'add';
          if (existingAzubi) {
            if (bulkChoice) {
              actionToTake = bulkChoice;
            } else {
              const choice = await askConflictResolution(`${vorname} ${name}`, 'Azubis');
              if (choice.applyToAll) bulkChoice = choice.action;
              actionToTake = choice.action;
            }
          }

          if (actionToTake === 'skip') {
            skippedCount++;
            continue;
          }

          const pList = item.periods || azubiPeriodRows.filter(r =>
            (r.Name || r.name) === name && (r.Vorname || r.vorname) === vorname
          ).map(r => ({
            start_date: String(r.Startdatum || r.start_date || ''),
            end_date: String(r.Enddatum || r.end_date || ''),
            description: r.Beschreibung || r.description || '',
            lehrjahr: Number(r.Lehrjahr || r.lehrjahr) || 1
          }));

          if (actionToTake === 'update' && existingAzubi) {
            await (window as any).api.updateAzubi({
              id: existingAzubi.id,
              name,
              vorname,
              lehrjahr: lj,
              department: item.department || item.Abteilung || departmentName || 'Rettungsdienst'
            });
            updatedCount++;
          } else {
            await (window as any).api.addAzubi({
              name,
              vorname,
              lehrjahr: lj,
              department: item.department || item.Abteilung || departmentName || 'Rettungsdienst',
              periods: Array.isArray(pList) ? pList : []
            });
            insertedCount++;
          }
        }
        await loadAzubis();
        alert(`Import beendet: ${insertedCount} neu angelegt, ${updatedCount} aktualisiert, ${skippedCount} übersprungen.`);
      } else if (activeTab === 'ärzte') {
        for (const item of importedItems) {
          const name = item.name || item.Name;
          const vorname = item.vorname || item.Vorname;
          if (!name || !vorname) continue;

          const existingDoc = itws.find(d =>
            d.name.trim().toLowerCase() === name.trim().toLowerCase() && d.vorname.trim().toLowerCase() === vorname.trim().toLowerCase()
          );

          let actionToTake: 'add' | 'update' | 'skip' = 'add';
          if (existingDoc) {
            if (bulkChoice) {
              actionToTake = bulkChoice;
            } else {
              const choice = await askConflictResolution(`${vorname} ${name}`, 'ITW-Ärzte');
              if (choice.applyToAll) bulkChoice = choice.action;
              actionToTake = choice.action;
            }
          }

          if (actionToTake === 'skip') {
            skippedCount++;
            continue;
          }

          if (actionToTake === 'update' && existingDoc) {
            await (window as any).api.updateItwDoctor({
              id: existingDoc.id,
              anrede: item.anrede || item.Anrede || existingDoc.anrede || '',
              title: item.title || item.Titel || existingDoc.title || '',
              name,
              vorname
            });
            updatedCount++;
          } else {
            await (window as any).api.addItwDoctor({
              anrede: item.anrede || item.Anrede || '',
              title: item.title || item.Titel || '',
              name,
              vorname
            });
            insertedCount++;
          }
        }
        await loadItws();
        alert(`Import beendet: ${insertedCount} neu angelegt, ${updatedCount} aktualisiert, ${skippedCount} übersprungen.`);
      } else if (activeTab === 'gäste') {
        for (const item of importedItems) {
          const name = item.name || item.Name;
          const dt = item.date || item.Datum || item.datum;
          if (!name || !dt) continue;

          const existingGuest = guests.find(g =>
            (g.name || '').trim().toLowerCase() === name.trim().toLowerCase() && (g.date || g.date) === dt
          );

          let actionToTake: 'add' | 'update' | 'skip' = 'add';
          if (existingGuest) {
            if (bulkChoice) {
              actionToTake = bulkChoice;
            } else {
              const choice = await askConflictResolution(`${name} (${dt})`, 'Gäste');
              if (choice.applyToAll) bulkChoice = choice.action;
              actionToTake = choice.action;
            }
          }

          if (actionToTake === 'skip') {
            skippedCount++;
            continue;
          }

          await (window as any).api.addGuest({
            date: dt,
            end_date: item.end_date || item.endDate || item.Enddatum || '',
            name,
            remark: item.remark || item.Bemerkung || ''
          });
          insertedCount++;
        }
        await loadGuests();
        alert(`Import beendet: ${insertedCount} neu angelegt, ${skippedCount} übersprungen.`);
      }
    } catch (err: any) {
      console.error('Import Fehler:', err);
      alert('Fehler beim Importieren: ' + err.message);
    }
  };

  const activePersonnel = filteredActivePersonnel;
  const inactivePersonnel = filteredInactivePersonnel;

  return (
    <div className="page-container">
      {loading ? (
        <div>Lade Daten...</div>
      ) : (
        <>

          {/* Sticky Container für Header + Controls + Tabs */}
          <div className="sticky-header-container">
            <h2 className="page-header">Personal</h2>

            {/* Steuerungselemente Header (Über den Tabs) */}
            <div style={{
              display: 'flex',
              gap: '12px',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: '12px',
              borderBottom: '1px solid #e2e8f0',
              marginBottom: '12px'
            }}>
              {/* Live-Suche Input */}
              <div style={{ position: 'relative', flex: '1', maxWidth: '320px' }}>
                <svg aria-hidden width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  placeholder={`${activeTab === 'stammpersonal' ? 'Stammpersonal' : activeTab === 'azubis' ? 'Azubis' : activeTab === 'ärzte' ? 'Ärzte' : 'Gäste'} suchen...`}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 28px 6px 34px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    style={{
                      position: 'absolute',
                      right: 8,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#94a3b8',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center'
                    }}
                    title="Suche zurücksetzen"
                  >
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Action-Buttons Header */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {activeTab === 'stammpersonal' && (
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#475569', marginRight: '6px', cursor: 'pointer', userSelect: 'none' }}>
                    <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
                    Inaktive anzeigen
                  </label>
                )}

                <button
                  onClick={handleFooterAdd}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    borderRadius: '6px',
                    border: 'none',
                    background: '#0ea5e9',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <svg aria-hidden width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Hinzufügen
                </button>

                <button
                  onClick={() => setFormatModal({ action: 'import', category: activeTab })}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#334155',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <svg aria-hidden width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  Import
                </button>

                <button
                  onClick={() => setFormatModal({ action: 'export', category: activeTab })}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#334155',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <svg aria-hidden width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Export
                </button>

                {activeTab === 'azubis' && editingAzubis && (
                  <button
                    onClick={saveEditingAzubis}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 14px',
                      borderRadius: '6px',
                      border: 'none',
                      background: '#22c55e',
                      color: 'white',
                      fontWeight: 600,
                      fontSize: '13px',
                      cursor: 'pointer'
                    }}
                  >
                    <svg aria-hidden width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Speichern
                  </button>
                )}
                {activeTab === 'azubis' && editingAzubis && (
                  <button
                    onClick={cancelEditingAzubis}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 14px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      background: '#fff',
                      color: '#64748b',
                      fontSize: '13px',
                      cursor: 'pointer'
                    }}
                  >
                    <svg aria-hidden width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                    Abbrechen
                  </button>
                )}
              </div>
            </div>

            {/* Tab Navigation - GRÜN */}
            <div className="tab-navigation" style={{ paddingTop: 0, paddingBottom: 0 }}>
              <button
                onClick={() => setActiveTab('stammpersonal')}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderBottom: activeTab === 'stammpersonal' ? '3px solid #0ea5e9' : '3px solid transparent',
                  background: activeTab === 'stammpersonal' ? '#f8f9fa' : 'transparent',
                  fontWeight: activeTab === 'stammpersonal' ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Stammpersonal
              </button>
              <button
                onClick={() => setActiveTab('azubis')}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderBottom: activeTab === 'azubis' ? '3px solid #0ea5e9' : '3px solid transparent',
                  background: activeTab === 'azubis' ? '#f8f9fa' : 'transparent',
                  fontWeight: activeTab === 'azubis' ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Azubis
              </button>
              {itwEnabled && (
                <button
                  onClick={() => setActiveTab('ärzte')}
                  style={{
                    padding: '8px 16px',
                    border: 'none',
                    borderBottom: activeTab === 'ärzte' ? '3px solid #0ea5e9' : '3px solid transparent',
                    background: activeTab === 'ärzte' ? '#f8f9fa' : 'transparent',
                    fontWeight: activeTab === 'ärzte' ? 600 : 400,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  Ärzte
                </button>
              )}
              <button
                onClick={() => setActiveTab('gäste')}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderBottom: activeTab === 'gäste' ? '3px solid #0ea5e9' : '3px solid transparent',
                  background: activeTab === 'gäste' ? '#f8f9fa' : 'transparent',
                  fontWeight: activeTab === 'gäste' ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Gäste
              </button>
            </div>
          </div>
          {/* Ende Sticky Container */}

          {/* Content - GRAU */}
          <div style={{ paddingTop: 16 }}>

            {/* Verstecktes File-Input für Kategorie-Import */}
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept=".json,.csv,.xlsx"
              onChange={handleFileImport}
            />

            {/* Stammpersonal Tab */}
            {activeTab === 'stammpersonal' && (
              <div>

                {/* Aktives Personal Tabelle */}
                <table className={styles.table}>
                  <thead>
                    <tr className={styles.thead}>
                      <th>Name</th>
                      <th>Vorname</th>
                      <th style={{ width: 130 }}>Personalnummer</th>
                      <th style={{ width: 160 }}>Nutzerrolle</th>
                      <th style={{ width: 120 }} className={styles.center}>Qualifikationen</th>
                      <th style={{ width: 100 }} className={styles.center}>Aktionen</th>
                    </tr>
                  </thead>
                  <tbody className={styles.tbody}>
                    {activePersonnel.map((person: Person) => {
                      const selected = person.id === selectedPersonId;
                      const isOver = dragContext === 'person' && dragOverId === person.id;
                      const rowClass = [styles.row, selected ? styles.selected : '', isOver && dragPosition === 'above' ? styles.dropAbove : '', isOver && dragPosition === 'below' ? styles.dropBelow : ''].filter(Boolean).join(' ');
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
                          style={{ cursor: 'move' }}
                          title={`Status: ${isPersonActive(person) ? 'Aktiv' : 'Inaktiv'}\nAbteilung: ${departmentName || 'all'}\nID: ${person.id}`}
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
                          <td>{person.personnelNumber || '—'}</td>
                          <td>
                            {roles.find(r => r.id === person.roleId)?.name || '—'}
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
                                      title={`${qual.qualType}: ${qual.startYM} - ${qual.endYM || 'unbegrenzt'} `}
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

                {/* Inaktives Personal Tabelle */}
                {showInactive && inactivePersonnel.length > 0 && (
                  <div style={{ marginTop: '32px' }}>
                    <h4 style={{ color: '#666', marginBottom: '8px', borderBottom: '1px solid #eee', paddingBottom: '4px' }}>Inaktives Personal</h4>
                    <table className={styles.table} style={{ opacity: 0.75 }}>
                      <thead>
                        <tr className={styles.thead} style={{ color: '#666' }}>
                          <th>Name</th>
                          <th>Vorname</th>
                          <th style={{ width: 130 }}>Personalnummer</th>
                          <th style={{ width: 160 }}>Nutzerrolle</th>
                          <th style={{ width: 120 }} className={styles.center}>Qualifikationen</th>
                          <th style={{ width: 100 }} className={styles.center}>Aktionen</th>
                        </tr>
                      </thead>
                      <tbody className={styles.tbody}>
                        {inactivePersonnel.map((person: Person) => {
                          const selected = person.id === selectedPersonId;
                          const rowClass = [styles.row, selected ? styles.selected : ''].filter(Boolean).join(' ');
                          return (
                            <tr
                              key={person.id}
                              onClick={() => handleRowClick(person.id)}
                              className={rowClass}
                              style={{ color: '#666' }}
                            >
                              <td>
                                {person.name}
                                {person.teilzeit && person.teilzeit < 100 && (
                                  <span style={{ fontSize: '11px', color: '#999', marginLeft: '8px' }}>
                                    ({person.teilzeit}%)
                                  </span>
                                )}
                              </td>
                              <td>{person.vorname}</td>
                              <td>{person.personnelNumber || '—'}</td>
                              <td>
                                {roles.find(r => r.id === person.roleId)?.name || '—'}
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
                                            background: '#6c757d',
                                            color: 'white',
                                            padding: '2px 6px',
                                            borderRadius: '3px',
                                            fontSize: '10px',
                                            whiteSpace: 'nowrap'
                                          }}
                                          title={`${qual.qualType}: ${qual.startYM} - ${qual.endYM || 'unbegrenzt'} `}
                                        >
                                          {qual.qualType === 'Fahrzeugführer' ? 'FzF' :
                                            qual.qualType === 'Fahrzeugführer HLF-B' ? 'HLF' :
                                              qual.qualType === 'ITW Maschinist' ? 'ITW-Ma' :
                                                qual.qualType === 'ITW Fahrzeugführer' ? 'ITW-FzF' :
                                                  qual.qualType.substring(0, 4)}
                                        </span>
                                      ))}
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
                                      background: '#f1f5f9',
                                      color: '#0f172a',
                                      border: '1px solid #cbd5e1',
                                      padding: '4px 8px',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      fontSize: '11px',
                                      fontWeight: 500
                                    }}
                                    title="Person bearbeiten"
                                  >
                                    Bearbeiten
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Aktionen unter der Stammpersonal-Tabelle */}
                {!setFooterActions && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button onClick={() => (window as any).api.openAddPersonWindow()}>
                      Hinzufügen
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Azubis Tab */}
            {activeTab === 'azubis' && (
              <div>
                {/* Azubis: Buttons unter der Tabelle */}
                <table className={styles.table}>
                  <thead>
                    <tr className={styles.thead}>
                      <th>Name</th>
                      <th>Vorname</th>
                      <th className={styles.narrow}>Lehrjahr</th>
                      <th>Zeiträume</th>
                      <th className={styles.center}>Aktionen</th>
                    </tr>
                  </thead>
                  <tbody className={styles.tbody}>
                    {filteredAzubis.map((a: Azubi) => {
                      const isOver = dragContext === 'azubi' && dragOverId === a.id;
                      const rowClass = [styles.row, selectedAzubiId === a.id ? styles.selected : '', isOver && dragPosition === 'above' ? styles.dropAbove : '', isOver && dragPosition === 'below' ? styles.dropBelow : ''].filter(Boolean).join(' ');
                      const periods = azubiPeriods[a.id] || [];
                      const periodsText = periods.length > 0
                        ? periods.map(p => `${new Date(p.start_date).toLocaleDateString('de-DE', { month: '2-digit', year: 'numeric' })} - ${new Date(p.end_date).toLocaleDateString('de-DE', { month: '2-digit', year: 'numeric' })} `).join(', ')
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
                                  background: '#f1f5f9',
                                  color: '#0f172a',
                                  border: '1px solid #cbd5e1',
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '11px',
                                  fontWeight: 500
                                }}
                                title="Azubi bearbeiten"
                              >
                                Bearbeiten
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {!editingAzubis ? (
                  !setFooterActions ? (
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <button onClick={() => (window as any).api.openAddAzubiWindow()}>Hinzufügen</button>
                    </div>
                  ) : null
                ) : (
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button onClick={saveEditingAzubis}>Speichern</button>
                    <button onClick={cancelEditingAzubis}>Abbrechen</button>
                  </div>
                )}
              </div>
            )}

            {/* Ärzte Tab */}
            {itwEnabled && activeTab === 'ärzte' && (
              <div>
                {/* ITW Ärzte: Tabelle & Steuerelemente identisch zu Stammpersonal & Azubis */}
                <table className={styles.table}>
                  <thead>
                    <tr className={styles.thead}>
                      <th style={{ width: 80 }}>Anrede</th>
                      <th style={{ width: 100 }}>Titel</th>
                      <th>Name</th>
                      <th>Vorname</th>
                      <th className={styles.center}>Aktionen</th>
                    </tr>
                  </thead>
                  <tbody className={styles.tbody}>
                    {filteredItws.map((a: ItwDoctor) => {
                      const isOver = dragContext === 'itw' && dragOverId === a.id;
                      const rowClass = [styles.row, selectedItwId === a.id ? styles.selected : '', isOver && dragPosition === 'above' ? styles.dropAbove : '', isOver && dragPosition === 'below' ? styles.dropBelow : ''].filter(Boolean).join(' ');
                      return (
                        <tr key={a.id}
                          draggable
                          onDragStart={() => onItwDragStart(a.id)}
                          onDragOver={(e) => onDragOver(e, a.id, 'itw')}
                          onDragLeave={() => onDragLeave()}
                          onDrop={() => onItwDrop(a.id)}
                          onClick={() => handleItwRowClick(a.id)}
                          onDoubleClick={() => (window as any).api.openEditItwWindow(a.id)}
                          className={rowClass}
                          style={{ cursor: 'move' }}>
                          <td>{a.anrede || '—'}</td>
                          <td>{a.title || '—'}</td>
                          <td>{a.name}</td>
                          <td>{a.vorname}</td>
                          <td className={styles.center}>
                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  (window as any).api.openEditItwWindow(a.id);
                                }}
                                style={{
                                  background: '#f1f5f9',
                                  color: '#0f172a',
                                  border: '1px solid #cbd5e1',
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '11px',
                                  fontWeight: 500
                                }}
                                title="ITW-Arzt bearbeiten"
                              >
                                Bearbeiten
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {!setFooterActions && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button onClick={() => (window as any).api.openAddItwWindow()}>Hinzufügen</button>
                  </div>
                )}
              </div>
            )}

            {/* Gäste Tab */}
            {activeTab === 'gäste' && (
              <div>
                <table className={styles.table}>
                  <thead>
                    <tr className={styles.thead}>
                      <th>Datum</th>
                      <th>Name</th>
                      <th>Bemerkung</th>
                      <th className={styles.center} style={{ width: 100 }}>Aktionen</th>
                    </tr>
                  </thead>
                  <tbody className={styles.tbody}>
                    {filteredGuests.map((g: any) => (
                      <tr key={g.id} className={styles.row}>
                        <td>
                          {g.end_date || g.endDate ? (
                            `${new Date(g.date).toLocaleDateString('de-DE')} – ${new Date(g.end_date || g.endDate).toLocaleDateString('de-DE')}`
                          ) : (
                            new Date(g.date).toLocaleDateString('de-DE')
                          )}
                        </td>
                        <td>{g.name}</td>
                        <td>{g.remark || '—'}</td>
                        <td className={styles.center}>
                          <button
                            onClick={async () => {
                              if (confirm('Gast wirklich löschen?')) {
                                await (window as any).api.deleteGuest(g.id);
                              }
                            }}
                            style={{
                              background: '#dc3545', color: 'white', border: 'none',
                              padding: '4px 8px', borderRadius: '3px', cursor: 'pointer', fontSize: '11px'
                            }}
                          >
                            Löschen
                          </button>
                        </td>
                      </tr>
                    ))}
                    {guests.length === 0 && (
                      <tr><td colSpan={4} style={{textAlign: 'center', padding: '16px', color: '#666'}}>Keine Gäste angelegt</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

          </div>
          {/* Ende Content */}

          {/* Modal zur Formatauswahl (JSON / Excel) */}
          {formatModal && (
            <div style={{
              position: 'fixed',
              top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.4)',
              zIndex: 1100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <div style={{
                backgroundColor: '#ffffff',
                borderRadius: '8px',
                padding: '24px',
                width: '380px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
              }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 600, color: '#0f172a' }}>
                  {formatModal.action === 'import' ? 'Import-Format wählen' : 'Export-Format wählen'}
                </h3>
                <p style={{ fontSize: '13px', color: '#475569', marginBottom: '16px', lineHeight: '1.4' }}>
                  Bitte wählen Sie das gewünschte Dateiformat für den {formatModal.action === 'import' ? 'Import' : 'Export'} von <strong>{activeTab === 'stammpersonal' ? 'Stammpersonal' : activeTab === 'azubis' ? 'Azubis' : activeTab === 'ärzte' ? 'Ärzte' : 'Gäste'}</strong>:
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                  <button
                    onClick={() => {
                      const action = formatModal.action;
                      const category = formatModal.category;
                      setFormatModal(null);
                      if (action === 'export') {
                        handleCategoryExport(category, 'json');
                      } else {
                        triggerCategoryImport('json');
                      }
                    }}
                    style={{
                      padding: '10px 16px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#0f172a',
                      fontWeight: 500,
                      fontSize: '13px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <span>JSON-Datei (*.json)</span>
                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>JSON</span>
                  </button>

                  <button
                    onClick={() => {
                      const action = formatModal.action;
                      const category = formatModal.category;
                      setFormatModal(null);
                      if (action === 'export') {
                        handleCategoryExport(category, 'excel');
                      } else {
                        triggerCategoryImport('excel');
                      }
                    }}
                    style={{
                      padding: '10px 16px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#0f172a',
                      fontWeight: 500,
                      fontSize: '13px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <span>Excel-Datei (*.xlsx)</span>
                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>XLSX</span>
                  </button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setFormatModal(null)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '4px',
                      border: '1px solid #cbd5e1',
                      background: '#fff',
                      color: '#475569',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal bei Duplikat-Konflikt */}
          {conflictModal && (
            <div style={{
              position: 'fixed',
              top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              zIndex: 1200,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <div style={{
                backgroundColor: '#ffffff',
                borderRadius: '8px',
                padding: '24px',
                width: '420px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.25)'
              }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 600, color: '#0f172a' }}>
                  Eintrag bereits vorhanden
                </h3>
                <p style={{ fontSize: '13px', color: '#334155', marginBottom: '16px', lineHeight: '1.4' }}>
                  Der Eintrag <strong>"{conflictModal.name}"</strong> existiert bereits in der Datenbank.
                  <br />
                  Wie möchten Sie fortfahren?
                </p>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#475569', cursor: 'pointer', userSelect: 'none' }}>
                    <input
                      type="checkbox"
                      checked={conflictApplyToAll}
                      onChange={e => setConflictApplyToAll(e.target.checked)}
                    />
                    Auswahl für alle weiteren Konflikte übernehmen
                  </label>
                </div>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => conflictModal.onResolve('skip', conflictApplyToAll)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#475569',
                      fontSize: '13px',
                      fontWeight: 500,
                      cursor: 'pointer'
                    }}
                  >
                    Überspringen
                  </button>

                  <button
                    onClick={() => conflictModal.onResolve('update', conflictApplyToAll)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      border: 'none',
                      background: '#0ea5e9',
                      color: '#ffffff',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Aktualisieren / Überschreiben
                  </button>
                </div>
              </div>
            </div>
          )}

        </>
      )}
    </div>
  );
};

export default PersonnelOverview;
