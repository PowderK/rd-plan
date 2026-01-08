import React, { useState, useEffect } from 'react';

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

const EditPerson: React.FC = () => {
  // ID aus URL-Query lesen
  const id = Number(new URLSearchParams(window.location.search).get('id'));
  const [name, setName] = useState('');
  const [vorname, setVorname] = useState('');
  const [teilzeit, setTeilzeit] = useState(100);
  const [sort, setSort] = useState(0);
  // Alte Qualifikations-States entfernt - jetzt über Qualifikationsperioden verwaltet
  const [qualificationPeriods, setQualificationPeriods] = useState<QualificationPeriod[]>([]);
  const [showQualifications, setShowQualifications] = useState(true);
  const [editingQualification, setEditingQualification] = useState<QualificationPeriod | null>(null);
  const [showAddQualification, setShowAddQualification] = useState(false);

  // Active Periods State
  const [activePeriods, setActivePeriods] = useState<ActivePeriod[]>([]);
  const [showActivePeriods, setShowActivePeriods] = useState(true);
  const [editingActivePeriod, setEditingActivePeriod] = useState<ActivePeriod | null>(null);
  const [showAddActivePeriod, setShowAddActivePeriod] = useState(false);

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
          setSort(person.sort ?? 0);
        } else {
          // console.error('Person not found for ID:', id);
        }
        
        // Lade Qualifikationsperioden
        // console.log('Loading qualification periods for person ID:', id);
        const periods = await (window as any).api.getQualificationPeriods(id);
        // console.log('Loaded qualification periods:', periods);
        setQualificationPeriods(periods || []);

        // Lade Aktivitätsperioden
        // console.log('Loading active periods for person ID:', id);
        const actPeriods = await (window as any).api.getPersonnelActivePeriods(id);
        // console.log('Loaded active periods:', actPeriods);
        setActivePeriods(actPeriods || []);
        
        // console.log('editPerson data loading completed for ID:', id);
      } catch (error) {
        // console.error('Error in editPerson useEffect:', error);
        alert('Fehler beim Laden der Personendaten: ' + (error as Error).message);
      }
    })();
  }, [id]);

  const handleSave = async () => {
    // Nur noch Basisdaten speichern - Qualifikationen werden separat über Perioden verwaltet
    await (window as any).api.updatePerson({ id, name, vorname, teilzeit, sort });
    if (window.opener) window.opener.postMessage('personnel-updated', '*');
    window.close();
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

  return (
    <div style={{ padding: 24 }}>
      <h2>Personal ändern</h2>
      <div style={{ marginBottom: 12 }}>
        <label>Name: <input value={name} onChange={e => setName(e.target.value)} /></label>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label>Vorname: <input value={vorname} onChange={e => setVorname(e.target.value)} /></label>
      </div>
      <div style={{ marginBottom: 24 }}>
        <label>Teilzeit (%): <input type="number" value={teilzeit} min={0} max={100} onChange={e => setTeilzeit(Number(e.target.value))} /></label>
      </div>
      
      {/* Aktivitätszeiträume */}
      <div style={{ 
        marginBottom: 24, 
        border: '2px solid #28a745', 
        padding: 20, 
        borderRadius: 8, 
        backgroundColor: '#f8f9fa' 
      }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <h3 style={{ margin: 0, color: '#28a745' }}>Aktivitätszeiträume</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: '#666' }}>
                {activePeriods.length} Periode(n)
              </span>
              <button 
                type="button" 
                onClick={() => setShowActivePeriods(!showActivePeriods)}
                style={{ 
                  background: showActivePeriods ? '#dc3545' : '#28a745', 
                  color: 'white', 
                  border: 'none', 
                  cursor: 'pointer', 
                  fontSize: '12px',
                  padding: '4px 8px',
                  borderRadius: '4px'
                }}
              >
                {showActivePeriods ? '▼ Ausblenden' : '▶ Anzeigen'}
              </button>
            </div>
          </div>
          <p style={{ margin: 0, fontSize: '13px', color: '#666', fontStyle: 'italic' }}>
            Legen Sie fest, in welchen Zeiträumen der Mitarbeiter aktiv ist (z.B. Elternzeit, Sabbatical).
          </p>
        </div>
        
        {showActivePeriods && (
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
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f5f5f5' }}>
                    <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #ddd' }}>Von</th>
                    <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #ddd' }}>Bis</th>
                    <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #ddd' }}>Beschreibung</th>
                    <th style={{ padding: '8px', textAlign: 'center', border: '1px solid #ddd' }}>Aktiv</th>
                    <th style={{ padding: '8px', textAlign: 'center', border: '1px solid #ddd' }}>Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {activePeriods.map((period) => (
                    <tr key={period.id}>
                      <td style={{ padding: '8px', border: '1px solid #ddd' }}>{period.startYM}</td>
                      <td style={{ padding: '8px', border: '1px solid #ddd' }}>{period.endYM || 'Unbegrenzt'}</td>
                      <td style={{ padding: '8px', border: '1px solid #ddd' }}>{period.description}</td>
                      <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center' }}>
                        <span style={{ color: period.active ? '#28a745' : '#dc3545' }}>
                          {period.active ? '✓' : '✗'}
                        </span>
                      </td>
                      <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center' }}>
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
        )}
      </div>
      
      {/* Qualifikationen & Zeiträume - Hauptfunktion */}
      <div style={{ 
        marginBottom: 24, 
        border: '2px solid #007bff', 
        padding: 20, 
        borderRadius: 8, 
        backgroundColor: '#f8f9fa' 
      }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <h3 style={{ margin: 0, color: '#007bff' }}>Qualifikationen & Zeiträume</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: '#666' }}>
                {qualificationPeriods.length} Periode(n)
              </span>
              <button 
                type="button" 
                onClick={() => setShowQualifications(!showQualifications)}
                style={{ 
                  background: showQualifications ? '#dc3545' : '#28a745', 
                  color: 'white', 
                  border: 'none', 
                  cursor: 'pointer', 
                  fontSize: '12px',
                  padding: '4px 8px',
                  borderRadius: '4px'
                }}
              >
                {showQualifications ? '▼ Ausblenden' : '▶ Anzeigen'}
              </button>
            </div>
          </div>
          <p style={{ margin: 0, fontSize: '13px', color: '#666', fontStyle: 'italic' }}>
            Verwalten Sie Qualifikationen mit genauen Zeiträumen (Monat/Jahr). Ersetzt die alten Checkbox-Qualifikationen.
          </p>
        </div>
        
        {showQualifications && (
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
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f5f5f5' }}>
                    <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #ddd' }}>Qualifikation</th>
                    <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #ddd' }}>Von</th>
                    <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #ddd' }}>Bis</th>
                    <th style={{ padding: '8px', textAlign: 'center', border: '1px solid #ddd' }}>Aktiv</th>
                    <th style={{ padding: '8px', textAlign: 'center', border: '1px solid #ddd' }}>Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {qualificationPeriods.map((period) => (
                    <tr key={period.id}>
                      <td style={{ padding: '8px', border: '1px solid #ddd' }}>{period.qualType}</td>
                      <td style={{ padding: '8px', border: '1px solid #ddd' }}>{period.startYM}</td>
                      <td style={{ padding: '8px', border: '1px solid #ddd' }}>{period.endYM || 'Unbegrenzt'}</td>
                      <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center' }}>
                        <span style={{ color: period.active ? '#28a745' : '#dc3545' }}>
                          {period.active ? '✓' : '✗'}
                        </span>
                      </td>
                      <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center' }}>
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
        )}
      </div>
      
      <button onClick={handleSave} style={{ backgroundColor: '#007bff', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Speichern</button>
      <button onClick={handleDelete} style={{ marginLeft: 8, backgroundColor: '#dc3545', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Löschen</button>
      <button onClick={() => window.close()} style={{ marginLeft: 8, padding: '8px 16px', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer' }}>Abbrechen</button>
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
