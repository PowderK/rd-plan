import React, { useState, useEffect } from 'react';
import { ShiftTransferManager } from './components/ShiftTransferManager';
import './styles.css';

interface QualificationPeriod {
  id: number;
  personId: number;
  qualType: string;
  startYM: string;
  endYM: string;
  active: boolean;
}

// Qualification Form Component
interface QualificationFormProps {
  qualification?: QualificationPeriod;
  onSave: (qualification: QualificationPeriod | Omit<QualificationPeriod, 'id'>) => Promise<void>;
  onCancel: () => void;
  title: string;
}

const QualificationForm: React.FC<QualificationFormProps> = ({ qualification, onSave, onCancel, title }) => {
  const [qualType, setQualType] = useState(qualification?.qualType || '');
  const [startYM, setStartYM] = useState(qualification?.startYM || '');
  const [endYM, setEndYM] = useState(qualification?.endYM || '');
  const [active, setActive] = useState(qualification?.active ?? true);
  const [isUnlimited, setIsUnlimited] = useState(!qualification?.endYM);
  const [qualificationTypes, setQualificationTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Lade Qualifikationstypen aus der Datenbank
  useEffect(() => {
    const loadQualificationTypes = async () => {
      try {
        const types = await (window as any).api.getQualificationTypes();
        const activeTypes = types.filter((t: any) => t.active).map((t: any) => t.name);
        setQualificationTypes(activeTypes);
      } catch (error) {
        // console.error('Failed to load qualification types:', error);
        // Fallback zu hardcodierten Typen falls API fehlt
        setQualificationTypes([
          'Fahrzeugführer',
          'Fahrzeugführer HLF-B',
          'NEF',
          'ITW Maschinist',
          'ITW Fahrzeugführer',
          'Atemschutz',
          'Höhenrettung',
          'Technische Hilfeleistung'
        ]);
      } finally {
        setLoading(false);
      }
    };

    loadQualificationTypes();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!qualType || !startYM) {
      alert('Bitte füllen Sie alle Pflichtfelder aus.');
      return;
    }

    const formData = {
      ...(qualification?.id ? { id: qualification.id } : {}),
      personId: qualification?.personId || 0,
      qualType: qualType,
      startYM: startYM,
      endYM: isUnlimited ? '' : endYM,
      active
    };

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
              Qualifikation *
            </label>
            <select
              value={qualType}
              onChange={e => setQualType(e.target.value)}
              required
              disabled={loading}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}
            >
              <option value="">{loading ? 'Lade Qualifikationen...' : 'Bitte wählen...'}</option>
              {qualificationTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

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
              Unbegrenzte Gültigkeit
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
              Inaktive Qualifikationen werden bei der Dienstplanung nicht berücksichtigt
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

interface ActivePeriod {
  id: number;
  personId: number;
  startYM: string;
  endYM: string;
  description: string;
  active: boolean;
}

interface ActivePeriodFormProps {
  period?: ActivePeriod;
  onSave: (period: ActivePeriod | Omit<ActivePeriod, 'id'>) => Promise<void>;
  onCancel: () => void;
  title: string;
}

const ActivePeriodForm: React.FC<ActivePeriodFormProps> = ({ period, onSave, onCancel, title }) => {
  const [startYM, setStartYM] = useState(period?.startYM || '');
  const [endYM, setEndYM] = useState(period?.endYM || '');
  const [description, setDescription] = useState(period?.description || '');
  // Active ist immer true, da der Zeitraum an sich die Aktivität definiert
  const active = true;
  const [isUnlimited, setIsUnlimited] = useState(!period?.endYM);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!startYM) {
      alert('Bitte Start-Monat angeben.');
      return;
    }

    const formData = {
      ...(period?.id ? { id: period.id } : {}),
      personId: period?.personId || 0,
      startYM: startYM,
      endYM: isUnlimited ? '' : endYM,
      description,
      active
    };

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
              Unbegrenzte Gültigkeit
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

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>
              Beschreibung (optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="z.B. Elternzeit, Sabbatical"
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            {/* Aktiv-Checkbox entfernt, da Zeiträume implizit aktiv sind */}
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

interface DepartmentPeriodFormProps {
  onSave: (period: { department: string; startDate: string; endDate?: string }) => Promise<void>;
  onCancel: () => void;
  title: string;
}

const DepartmentPeriodForm: React.FC<DepartmentPeriodFormProps> = ({ onSave, onCancel, title }) => {
  const [department, setDepartment] = useState('1. Abteilung');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isUnlimited, setIsUnlimited] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate) {
      alert('Bitte Start-Datum angeben.');
      return;
    }
    onSave({
      department,
      startDate,
      endDate: isUnlimited ? undefined : endDate
    });
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
      <div style={{ background: 'white', padding: '24px', borderRadius: '8px', width: '480px' }}>
        <h3 style={{ marginTop: 0, marginBottom: '20px' }}>{title}</h3>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>Abteilung *</label>
            <select value={department} onChange={e => setDepartment(e.target.value)} required style={{ width: '100%', padding: '8px' }}>
              <option value="1. Abteilung">1. Abteilung</option>
              <option value="2. Abteilung">2. Abteilung</option>
              <option value="3. Abteilung">3. Abteilung</option>
            </select>
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>Start-Datum (YYYY-MM-DD) *</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required style={{ width: '100%', padding: '8px' }} />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', marginBottom: '6px' }}>
              <input type="checkbox" checked={isUnlimited} onChange={e => setIsUnlimited(e.target.checked)} style={{ marginRight: '8px' }} />
              Unbegrenzte Gültigkeit
            </label>
            {!isUnlimited && (
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ width: '100%', padding: '8px' }} />
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" onClick={onCancel} style={{ background: '#6c757d', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '4px' }}>Abbrechen</button>
            <button type="submit" style={{ background: '#007bff', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '4px' }}>Speichern</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const EditPerson: React.FC = () => {
  // ID aus URL-Query lesen
  const id = Number(new URLSearchParams(window.location.search).get('id'));
  const [name, setName] = useState('');
  const [vorname, setVorname] = useState('');
  const [teilzeit, setTeilzeit] = useState(100);
  const [department, setDepartment] = useState('1. Abteilung');
  const [sort, setSort] = useState(0);
  const [personnelNumber, setPersonnelNumber] = useState('');
  const [roleId, setRoleId] = useState<number | null>(null);
  const [roles, setRoles] = useState<{ id: number; name: string }[]>([]);
  const [oldRtwShifts, setOldRtwShifts] = useState<number>(0);
  const [showOldRtwShiftsFeature, setShowOldRtwShiftsFeature] = useState(false);
  const [showShiftTransferFeature, setShowShiftTransferFeature] = useState(false);
  const [showShiftTransferManager, setShowShiftTransferManager] = useState(false);
  // Alte Qualifikations-States entfernt - jetzt über Qualifikationsperioden verwaltet
  const [qualificationPeriods, setQualificationPeriods] = useState<QualificationPeriod[]>([]);
  const [editingQualification, setEditingQualification] = useState<QualificationPeriod | null>(null);
  const [showAddQualification, setShowAddQualification] = useState(false);

  // Active Periods State
  const [activePeriods, setActivePeriods] = useState<ActivePeriod[]>([]);
  const [editingActivePeriod, setEditingActivePeriod] = useState<ActivePeriod | null>(null);
  const [showAddActivePeriod, setShowAddActivePeriod] = useState(false);

  const [active, setActive] = useState(true);
  const [activeTab, setActiveTab] = useState<'stammdaten' | 'qualifikationen' | 'zeitraeume' | 'abteilungen'>('stammdaten');

  // Department Periods State
  const [departmentPeriods, setDepartmentPeriods] = useState<any[]>([]);
  const [showAddDepartmentPeriod, setShowAddDepartmentPeriod] = useState(false);

  useEffect(() => {
    if (!id) {
      // console.error('No person ID provided to editPerson');
      return;
    }

    // console.log('editPerson useEffect triggered for ID:', id);

    (async () => {
      try {
        // Lade Personendaten
        // console.log('Loading person data for ID:', id);
        const person = await (window as any).api.getPerson(id);
        // console.log('Person data loaded:', person);

        if (person) {
          setName(person.name || '');
          setVorname(person.vorname || '');
          setTeilzeit(person.teilzeit ?? 100);
          setDepartment(person.department || '1. Abteilung');
          setSort(person.sort ?? 0);
          setSort(person.sort ?? 0);
          setPersonnelNumber(person.personnelNumber || '');
          setRoleId(person.roleId || null);
          setOldRtwShifts(person.old_rtw_shifts || 0);
          setActive(person.active !== 0 && person.active !== false);
        } else {
          // console.error('Person not found for ID:', id);
        }

        // Lade Rollen
        try {
          const rolesData = await (window as any).api.getSetting('roles');
          if (rolesData) {
            const parsedRoles = JSON.parse(rolesData);
            setRoles(Array.isArray(parsedRoles) ? parsedRoles.map((r: any) => ({ id: r.id, name: r.name })) : []);
          }
        } catch (e) {
          // console.error('Fehler beim Laden der Rollen:', e);
        }

        // Feature-Toggle laden
        try {
          const feat = await (window as any).api.getSetting('feature_old_rtw_shifts');
          setShowOldRtwShiftsFeature(feat === 'true' || feat === true);
        } catch { }

        try {
          const feat = await (window as any).api.getSetting('feature_shift_transfers');
          setShowShiftTransferFeature(feat === 'true' || feat === true);
        } catch { }

        // Lade Qualifikationsperioden
        // console.log('Loading qualification periods for person ID:', id);
        const periods = await (window as any).api.getQualificationPeriods(id);
        // console.log('Loaded qualification periods:', periods);
        setQualificationPeriods(periods || []);

        // Lade Aktivitätsperioden
        const actPeriods = await (window as any).api.getPersonnelActivePeriods(id);
        setActivePeriods(actPeriods || []);

        // Lade Abteilungsperioden
        const depPeriods = await (window as any).api.getPersonnelDepartmentPeriods(id);
        setDepartmentPeriods(depPeriods || []);

        // console.log('editPerson data loading completed for ID:', id);
      } catch (error) {
        // console.error('Error in editPerson useEffect:', error);
        alert('Fehler beim Laden der Personendaten: ' + (error as Error).message);
      }
    })();
  }, [id]);

  const handleSave = async () => {
    if (!personnelNumber.trim()) {
      alert('Bitte eine Personalnummer eingeben.');
      return;
    }

    if (roleId == null) {
      alert('Bitte eine Rolle auswählen.');
      return;
    }

    try {
      // Nur noch Basisdaten speichern - Qualifikationen werden separat über Perioden verwaltet
      await (window as any).api.updatePerson({ id, name, vorname, teilzeit, department, active, sort, personnelNumber: personnelNumber.trim(), roleId, oldRtwShifts });
      if (window.opener) window.opener.postMessage('personnel-updated', '*');
      window.close();
    } catch (e) {
      alert('Fehler beim Speichern: ' + (e as Error).message);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Sind Sie sicher, dass Sie ${vorname} ${name} löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.`)) {
      return;
    }

    try {
      await (window as any).api.deletePerson(id);
      if (window.opener) window.opener.postMessage('personnel-updated', '*');
      window.close();
    } catch (error) {
      // console.error('Fehler beim Löschen der Person:', error);
      alert('Fehler beim Löschen der Person!');
    }
  };

  const refreshQualificationPeriods = async () => {
    try {
      const periods = await (window as any).api.getQualificationPeriods(id);
      setQualificationPeriods(periods || []);
    } catch (error) {
      // console.error('Fehler beim Laden der Qualifikationsperioden:', error);
    }
  };

  const handleAddQualification = async (qualification: Omit<QualificationPeriod, 'id'>) => {
    try {
      // Prüfung: Qualifikation bereits vorhanden?
      const existingQualification = qualificationPeriods.find(
        period => period.qualType === qualification.qualType
      );

      if (existingQualification) {
        alert(`Die Qualifikation "${qualification.qualType}" ist bereits vorhanden. Jede Qualifikation kann nur einmal eingetragen werden. Bearbeiten Sie die bestehende Qualifikation, falls Sie Änderungen vornehmen möchten.`);
        return;
      }

      await (window as any).api.addQualificationPeriod({
        personId: id,
        qualType: qualification.qualType,
        startYM: qualification.startYM,
        endYM: qualification.endYM || null,
        active: qualification.active
      });
      await refreshQualificationPeriods();
      setShowAddQualification(false);
    } catch (error) {
      // console.error('Fehler beim Hinzufügen der Qualifikationsperiode:', error);
      alert('Fehler beim Hinzufügen der Qualifikationsperiode');
    }
  };

  const handleEditQualification = async (qualification: QualificationPeriod | Omit<QualificationPeriod, 'id'>) => {
    try {
      // Wenn es eine ID hat, ist es ein Update, sonst ein Add (sollte aber nicht passieren)
      if ('id' in qualification && qualification.id) {
        // Prüfung: Qualifikationstyp bereits bei anderem Eintrag vorhanden?
        const existingQualification = qualificationPeriods.find(
          period => period.qualType === qualification.qualType && period.id !== qualification.id
        );

        if (existingQualification) {
          alert(`Die Qualifikation "${qualification.qualType}" ist bereits bei einem anderen Eintrag vorhanden. Jede Qualifikation kann nur einmal eingetragen werden.`);
          return;
        }

        await (window as any).api.updateQualificationPeriod(qualification.id, {
          personId: id,
          qualType: qualification.qualType,
          startYM: qualification.startYM,
          endYM: qualification.endYM || null,
          active: qualification.active
        });
      } else {
        // console.error('Versuche ein Update ohne ID durchzuführen');
        return;
      }
      await refreshQualificationPeriods();
      setEditingQualification(null);
    } catch (error) {
      // console.error('Fehler beim Bearbeiten der Qualifikationsperiode:', error);
      alert('Fehler beim Bearbeiten der Qualifikationsperiode');
    }
  };

  const handleDeleteQualification = async (qualificationId: number) => {
    if (confirm('Sind Sie sicher, dass Sie diese Qualifikationsperiode löschen möchten?')) {
      try {
        await (window as any).api.deleteQualificationPeriod(qualificationId);
        await refreshQualificationPeriods();
      } catch (error) {
        // console.error('Fehler beim Löschen der Qualifikationsperiode:', error);
        alert('Fehler beim Löschen der Qualifikationsperiode');
      }
    }
  };

  // Active Periods Handlers
  const refreshActivePeriods = async () => {
    try {
      const periods = await (window as any).api.getPersonnelActivePeriods(id);
      setActivePeriods(periods || []);
    } catch (error) {
      // console.error('Fehler beim Laden der Aktivitätsperioden:', error);
    }
  };

  const handleAddActivePeriod = async (period: Omit<ActivePeriod, 'id'>) => {
    try {
      await (window as any).api.addPersonnelActivePeriod({
        personId: id,
        startYM: period.startYM,
        endYM: period.endYM || null,
        description: period.description,
        active: period.active
      });
      await refreshActivePeriods();
      setShowAddActivePeriod(false);
    } catch (error) {
      // console.error('Fehler beim Hinzufügen der Aktivitätsperiode:', error);
      alert('Fehler beim Hinzufügen der Aktivitätsperiode');
    }
  };

  const handleEditActivePeriod = async (period: ActivePeriod | Omit<ActivePeriod, 'id'>) => {
    try {
      if ('id' in period && period.id) {
        await (window as any).api.updatePersonnelActivePeriod(period.id, {
          personId: id,
          startYM: period.startYM,
          endYM: period.endYM || null,
          description: period.description,
          active: period.active
        });
      } else {
        // console.error('Versuche ein Update ohne ID durchzuführen');
        return;
      }
      await refreshActivePeriods();
      setEditingActivePeriod(null);
    } catch (error) {
      // console.error('Fehler beim Bearbeiten der Aktivitätsperiode:', error);
      alert('Fehler beim Bearbeiten der Aktivitätsperiode');
    }
  };

  const handleDeleteActivePeriod = async (periodId: number) => {
    if (confirm('Sind Sie sicher, dass Sie diese Aktivitätsperiode löschen möchten?')) {
      try {
        await (window as any).api.deletePersonnelActivePeriod(periodId);
        await refreshActivePeriods();
      } catch (error) {
        // console.error('Fehler beim Löschen der Aktivitätsperiode:', error);
        alert('Fehler beim Löschen der Aktivitätsperiode');
      }
    }
  };

  // Department Periods Handlers
  const refreshDepartmentPeriods = async () => {
    try {
      const periods = await (window as any).api.getPersonnelDepartmentPeriods(id);
      setDepartmentPeriods(periods || []);
    } catch (error) {}
  };

  const handleAddDepartmentPeriod = async (period: any) => {
    try {
      await (window as any).api.addPersonnelDepartmentPeriod({
        personId: id,
        department: period.department,
        startDate: period.startDate,
        endDate: period.endDate || null
      });
      await refreshDepartmentPeriods();
      setShowAddDepartmentPeriod(false);
    } catch (error) {
      alert('Fehler beim Hinzufügen der Abteilungsperiode');
    }
  };

  const handleDeleteDepartmentPeriod = async (periodId: number) => {
    if (confirm('Sind Sie sicher, dass Sie diese Abteilungsperiode löschen möchten?')) {
      try {
        await (window as any).api.deletePersonnelDepartmentPeriod(periodId);
        await refreshDepartmentPeriods();
      } catch (error) {
        alert('Fehler beim Löschen der Abteilungsperiode');
      }
    }
  };

  return (
    <div style={{ padding: 24, height: '100vh', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
      <h2>Personal ändern</h2>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 4 }}>

      <div style={{
        display: 'flex',
        gap: 4,
        borderBottom: '2px solid #dee2e6',
        marginBottom: 16,
        position: 'sticky',
        top: 0,
        background: 'var(--bg)',
        zIndex: 20,
        paddingTop: 4,
        paddingBottom: 4
      }}>
        <button
          type="button"
          onClick={() => setActiveTab('stammdaten')}
          style={{
            padding: '8px 16px',
            border: 'none',
            borderBottom: activeTab === 'stammdaten' ? '3px solid #0d6efd' : '3px solid transparent',
            background: activeTab === 'stammdaten' ? '#f8f9fa' : 'transparent',
            fontWeight: activeTab === 'stammdaten' ? 600 : 400,
            cursor: 'pointer'
          }}
        >
          Stammdaten
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('qualifikationen')}
          style={{
            padding: '8px 16px',
            border: 'none',
            borderBottom: activeTab === 'qualifikationen' ? '3px solid #0d6efd' : '3px solid transparent',
            background: activeTab === 'qualifikationen' ? '#f8f9fa' : 'transparent',
            fontWeight: activeTab === 'qualifikationen' ? 600 : 400,
            cursor: 'pointer'
          }}
        >
          Qualifikationen
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('abteilungen')}
          style={{
            padding: '8px 16px',
            border: 'none',
            borderBottom: activeTab === 'abteilungen' ? '3px solid #0d6efd' : '3px solid transparent',
            background: activeTab === 'abteilungen' ? '#f8f9fa' : 'transparent',
            fontWeight: activeTab === 'abteilungen' ? 600 : 400,
            cursor: 'pointer'
          }}
        >
          Abteilungen
        </button>
      </div>

      {activeTab === 'stammdaten' && (
        <>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(280px, 1fr) minmax(280px, 1fr)',
        gap: 12,
        marginBottom: 16
      }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span>Name</span>
          <input value={name} onChange={e => setName(e.target.value)} />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span>Vorname</span>
          <input value={vorname} onChange={e => setVorname(e.target.value)} />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span>Personalnummer *</span>
          <input value={personnelNumber} onChange={e => setPersonnelNumber(e.target.value)} />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span>Rolle *</span>
          <select value={roleId || ''} onChange={e => setRoleId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">Bitte wählen</option>
            {roles.map(role => (
              <option key={role.id} value={role.id}>{role.name}</option>
            ))}
          </select>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 220 }}>
          <span>Teilzeit (%)</span>
          <input type="number" value={teilzeit} min={0} max={100} onChange={e => setTeilzeit(Number(e.target.value))} />
        </label>
      </div>

      {showOldRtwShiftsFeature && (
        <div style={{ marginBottom: 16, padding: 12, border: '1px solid #dee2e6', borderRadius: 8, background: '#f8f9fa' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 280 }}>
            <span>Alte RTW-Schichten (aus Altsystem)</span>
            <input
              type="number"
              value={oldRtwShifts === 0 ? '' : oldRtwShifts}
              onChange={(e) => setOldRtwShifts(e.target.value === '' ? 0 : Number(e.target.value))}
              min="0"
            />
          </label>
          <div style={{ fontSize: '0.85em', color: '#666', marginTop: 4 }}>
            Dieser Wert wird im Dienstplan angezeigt, aber <strong>nicht</strong> zur aktuellen Ist-Berechnung addiert.
          </div>
        </div>
      )}

      {showShiftTransferFeature && (
        <div style={{ marginBottom: 16, border: '1px solid #dee2e6', borderRadius: 8, padding: 12, background: '#f8f9fa' }}>
          <h3 style={{ marginTop: 0, marginBottom: 6 }}>Gezielte Schichtübernahmen</h3>
          <p style={{ marginTop: 0, marginBottom: 8, color: '#666' }}>
            Neue Übernahmen aus dieser Ansicht setzen automatisch <strong>{name || 'diese Person'}</strong> als Empfänger.
          </p>
          <button
            type="button"
            onClick={() => setShowShiftTransferManager(true)}
            style={{ padding: '8px 12px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Übernahmen verwalten
          </button>
        </div>
      )}

      <div style={{ marginTop: 8 }}>
        <button
          onClick={handleDelete}
          style={{ backgroundColor: '#dc3545', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          Löschen
        </button>
      </div>
        </>
      )}

      {/* Aktivitätszeiträume */}
      {activeTab === 'zeitraeume' && (
      <div style={{
        marginBottom: 24,
        border: '2px solid #28a745',
        padding: 20,
        borderRadius: 8,
        backgroundColor: '#f8f9fa'
      }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: '8px' }}>
            <h3 style={{ margin: 0, color: '#28a745' }}>Aktivitätszeiträume</h3>
          </div>
          <p style={{ margin: 0, fontSize: '13px', color: '#666', fontStyle: 'italic' }}>
            Legen Sie fest, in welchen Zeiträumen der Mitarbeiter aktiv ist (z.B. Elternzeit, Sabbatical).
          </p>
        </div>

          <div>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', color: '#666' }}>
                {activePeriods.length} Aktivitätsperioden
              </span>
              <button
                type="button"
                onClick={() => setShowAddActivePeriod(true)}
                style={{
                  background: '#28a745',
                  color: 'white',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                + Hinzufügen
              </button>
            </div>

            {activePeriods.length === 0 ? (
              <p style={{ color: '#666', fontStyle: 'italic', textAlign: 'center', padding: '20px' }}>
                Keine Aktivitätsperioden vorhanden (Mitarbeiter ist immer aktiv, wenn "Aktiv" gesetzt)
              </p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '14px', border: '1px solid #d6e4ff', borderRadius: 10, overflow: 'hidden' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fbff' }}>
                    <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #dbe7ff' }}>Von</th>
                    <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #dbe7ff' }}>Bis</th>
                    <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #dbe7ff' }}>Beschreibung</th>
                    <th style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid #dbe7ff' }}>Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {activePeriods.map((period) => (
                    <tr key={period.id}>
                      <td style={{ padding: '8px', borderBottom: '1px solid #e4edff' }}>{period.startYM}</td>
                      <td style={{ padding: '8px', borderBottom: '1px solid #e4edff' }}>{period.endYM || 'Unbegrenzt'}</td>
                      <td style={{ padding: '8px', borderBottom: '1px solid #e4edff' }}>{period.description}</td>
                      <td style={{ padding: '8px', borderBottom: '1px solid #e4edff', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => setEditingActivePeriod(period)}
                          style={{
                            background: '#007bff',
                            color: 'white',
                            border: 'none',
                            padding: '4px 8px',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            marginRight: '4px'
                          }}
                        >
                          Bearbeiten
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteActivePeriod(period.id)}
                          style={{
                            background: '#dc3545',
                            color: 'white',
                            border: 'none',
                            padding: '4px 8px',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            fontSize: '11px'
                          }}
                        >
                          Löschen
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Add Active Period Form */}
            {showAddActivePeriod && (
              <ActivePeriodForm
                onSave={handleAddActivePeriod}
                onCancel={() => setShowAddActivePeriod(false)}
                title="Neue Aktivitätsperiode"
              />
            )}

            {/* Edit Active Period Form */}
            {editingActivePeriod && (
              <ActivePeriodForm
                period={editingActivePeriod}
                onSave={handleEditActivePeriod}
                onCancel={() => setEditingActivePeriod(null)}
                title="Aktivitätsperiode bearbeiten"
              />
            )}
          </div>
      </div>
      )}

      {/* Qualifikationen & Zeiträume - Hauptfunktion */}
      {activeTab === 'qualifikationen' && (
      <div style={{
        marginBottom: 24,
        border: '2px solid #007bff',
        padding: 20,
        borderRadius: 8,
        backgroundColor: '#f8f9fa'
      }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: '8px' }}>
            <h3 style={{ margin: 0, color: '#007bff' }}>Qualifikationen & Zeiträume</h3>
          </div>
          <p style={{ margin: 0, fontSize: '13px', color: '#666', fontStyle: 'italic' }}>
            Verwalten Sie Qualifikationen mit genauen Zeiträumen (Monat/Jahr). Ersetzt die alten Checkbox-Qualifikationen.
          </p>
        </div>

          <div>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', color: '#666' }}>
                {qualificationPeriods.length} Qualifikationsperioden
              </span>
              <button
                type="button"
                onClick={() => setShowAddQualification(true)}
                style={{
                  background: '#28a745',
                  color: 'white',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                + Hinzufügen
              </button>
            </div>

            {qualificationPeriods.length === 0 ? (
              <p style={{ color: '#666', fontStyle: 'italic', textAlign: 'center', padding: '20px' }}>
                Keine Qualifikationsperioden vorhanden
              </p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '14px', border: '1px solid #d6e4ff', borderRadius: 10, overflow: 'hidden' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fbff' }}>
                    <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #dbe7ff' }}>Qualifikation</th>
                    <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #dbe7ff' }}>Von</th>
                    <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #dbe7ff' }}>Bis</th>
                    <th style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid #dbe7ff' }}>Aktiv</th>
                    <th style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid #dbe7ff' }}>Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {qualificationPeriods.map((period) => (
                    <tr key={period.id}>
                      <td style={{ padding: '8px', borderBottom: '1px solid #e4edff' }}>{period.qualType}</td>
                      <td style={{ padding: '8px', borderBottom: '1px solid #e4edff' }}>{period.startYM}</td>
                      <td style={{ padding: '8px', borderBottom: '1px solid #e4edff' }}>{period.endYM || 'Unbegrenzt'}</td>
                      <td style={{ padding: '8px', borderBottom: '1px solid #e4edff', textAlign: 'center' }}>
                        <span style={{ color: period.active ? '#28a745' : '#dc3545' }}>
                          {period.active ? '✓' : '✗'}
                        </span>
                      </td>
                      <td style={{ padding: '8px', borderBottom: '1px solid #e4edff', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => setEditingQualification(period)}
                          style={{
                            background: '#007bff',
                            color: 'white',
                            border: 'none',
                            padding: '4px 8px',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            marginRight: '4px'
                          }}
                        >
                          Bearbeiten
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteQualification(period.id)}
                          style={{
                            background: '#dc3545',
                            color: 'white',
                            border: 'none',
                            padding: '4px 8px',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            fontSize: '11px'
                          }}
                        >
                          Löschen
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Add Qualification Form */}
            {showAddQualification && (
              <QualificationForm
                onSave={handleAddQualification}
                onCancel={() => setShowAddQualification(false)}
                title="Neue Qualifikationsperiode"
              />
            )}

            {/* Edit Qualification Form */}
            {editingQualification && (
              <QualificationForm
                qualification={editingQualification}
                onSave={handleEditQualification}
                onCancel={() => setEditingQualification(null)}
                title="Qualifikationsperiode bearbeiten"
              />
            )}
          </div>
      </div>
      )}

      {activeTab === 'abteilungen' && (
        <div style={{ padding: '10px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h4 style={{ margin: 0 }}>Abteilungshistorie</h4>
            <button type="button" onClick={() => setShowAddDepartmentPeriod(true)} style={{ background: '#28a745', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px' }}>
              + Abteilung hinzufügen
            </button>
          </div>
          <table className="qual-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                <th style={{ padding: '12px', textAlign: 'left' }}>Abteilung</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Von</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Bis</th>
                <th style={{ padding: '12px', textAlign: 'center', width: '100px' }}>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {departmentPeriods.length > 0 ? (
                departmentPeriods.map(period => (
                  <tr key={period.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                    <td style={{ padding: '12px' }}>{period.department}</td>
                    <td style={{ padding: '12px' }}>{period.startDate}</td>
                    <td style={{ padding: '12px' }}>{period.endDate || 'Laufend'}</td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <button type="button" onClick={() => handleDeleteDepartmentPeriod(period.id)} style={{ background: '#dc3545', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '3px' }}>Löschen</button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: '#6c757d' }}>Keine Abteilungen hinterlegt</td></tr>
              )}
            </tbody>
          </table>
          {showAddDepartmentPeriod && (
            <DepartmentPeriodForm onSave={handleAddDepartmentPeriod} onCancel={() => setShowAddDepartmentPeriod(false)} title="Abteilung hinzufügen" />
          )}
        </div>
      )}

      </div>

      <div
        style={{
          borderTop: '1px solid #eee',
          paddingTop: 12,
          paddingBottom: 12,
          background: 'var(--bg)',
          display: 'flex',
          gap: 8,
          justifyContent: 'flex-end',
          flexShrink: 0
        }}
      >
        <button onClick={handleSave} style={{ backgroundColor: '#007bff', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Speichern</button>
        <button onClick={() => window.close()} style={{ padding: '8px 16px', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer' }}>Abbrechen</button>
      </div>

      {showShiftTransferManager && (
        <ShiftTransferManager
          onClose={() => setShowShiftTransferManager(false)}
          fixedToPersonId={id}
        />
      )}
    </div>
  );
};

export default EditPerson;

// Mounten
import { createRoot } from 'react-dom/client';
const container = document.getElementById('edit-person-root');
if (container) {
  const root = createRoot(container);
  root.render(<EditPerson />);
}
