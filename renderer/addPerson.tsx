import React, { useState, useEffect } from 'react';

interface QualificationPeriod {
  qualType: string;
  startYM: string;
  endYM: string;
  active: boolean;
}

// Qualification Form Component für neue Person
interface QualificationFormProps {
  qualification?: QualificationPeriod;
  onSave: (qualification: QualificationPeriod) => void;
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

  useEffect(() => {
    const loadQualificationTypes = async () => {
      try {
        const types = await (window as any).api.getQualificationTypes();
        const activeTypes = types.filter((t: any) => t.active).map((t: any) => t.name);
        setQualificationTypes(activeTypes);
      } catch (error) {
        // console.error('Failed to load qualification types:', error);
        setQualificationTypes([
          'Fahrzeugführer',
          'Fahrzeugführer HLF-B',
          'NEF',
          'ITW Maschinist',
          'ITW Fahrzeugführer'
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

    onSave({
      qualType,
      startYM,
      endYM: isUnlimited ? '' : endYM,
      active
    });
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
              <option value="">{loading ? 'Lade...' : 'Bitte wählen...'}</option>
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
              Hinzufügen
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const AddPerson: React.FC = () => {
  const [name, setName] = useState('');
  const [vorname, setVorname] = useState('');
  const [teilzeit, setTeilzeit] = useState(100);
  const [qualifications, setQualifications] = useState<QualificationPeriod[]>([]);
  const [showAddQualification, setShowAddQualification] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const handleAddQualification = (qual: QualificationPeriod) => {
    if (editingIndex !== null) {
      const updated = [...qualifications];
      updated[editingIndex] = qual;
      setQualifications(updated);
      setEditingIndex(null);
    } else {
      setQualifications([...qualifications, qual]);
    }
    setShowAddQualification(false);
  };

  const handleEditQualification = (index: number) => {
    setEditingIndex(index);
    setShowAddQualification(true);
  };

  const handleDeleteQualification = (index: number) => {
    setQualifications(qualifications.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!name.trim() || !vorname.trim()) {
      alert('Bitte Name und Vorname eingeben.');
      return;
    }

    try {
      // Person erstellen
      const result = await (window as any).api.addPerson({ 
        name, 
        vorname, 
        teilzeit,
        fahrzeugfuehrer: false,
        fahrzeugfuehrerHLFB: false,
        nef: false,
        itwMaschinist: false,
        itwFahrzeugfuehrer: false
      });

      // Automatisch Aktivitätszeitraum ab aktuellem Monat erstellen
      if (result && result.id) {
        const now = new Date();
        const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        
        await (window as any).api.addPersonnelActivePeriod({
          personId: result.id,
          startYM: currentYM,
          endYM: null,
          description: 'Erstellung',
          active: true
        });
      }

      // Qualifikationen hinzufügen (falls die API die personId zurückgibt)
      if (result && result.id && qualifications.length > 0) {
        for (const qual of qualifications) {
          await (window as any).api.addQualificationPeriod({
            personId: result.id,
            ...qual
          });
        }
      }
      
      if (window.opener) window.opener.postMessage('personnel-updated', '*');
      window.close();
    } catch (error) {
      // console.error('Fehler beim Hinzufügen der Person:', error);
      alert('Fehler beim Speichern!');
    }
  };

  return (
    <div style={{ padding: '24px', fontFamily: 'Arial, sans-serif' }}>
      <h2 style={{ marginTop: 0, marginBottom: '24px', color: '#333' }}>Personal hinzufügen</h2>
      
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500 }}>
          Name *
        </label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Nachname"
          style={{
            width: '100%',
            padding: '10px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '14px',
            boxSizing: 'border-box'
          }}
        />
      </div>

      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500 }}>
          Vorname *
        </label>
        <input
          type="text"
          value={vorname}
          onChange={e => setVorname(e.target.value)}
          placeholder="Vorname"
          style={{
            width: '100%',
            padding: '10px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '14px',
            boxSizing: 'border-box'
          }}
        />
      </div>

      <div style={{ marginBottom: '24px' }}>
        <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500 }}>
          Teilzeit (%)
        </label>
        <input
          type="number"
          value={teilzeit}
          min={0}
          max={100}
          onChange={e => setTeilzeit(Number(e.target.value))}
          style={{
            width: '100%',
            padding: '10px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '14px',
            boxSizing: 'border-box'
          }}
        />
      </div>

      {/* Qualifikationen Sektion */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '16px' }}>Qualifikationen</h3>
          <button
            type="button"
            onClick={() => {
              setEditingIndex(null);
              setShowAddQualification(true);
            }}
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
            + Qualifikation
          </button>
        </div>

        {qualifications.length > 0 ? (
          <div style={{ border: '1px solid #ddd', borderRadius: '4px' }}>
            {qualifications.map((qual, index) => (
              <div
                key={index}
                style={{
                  padding: '12px',
                  borderBottom: index < qualifications.length - 1 ? '1px solid #eee' : 'none',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, marginBottom: '4px' }}>{qual.qualType}</div>
                  <div style={{ fontSize: '13px', color: '#666' }}>
                    {qual.startYM} {qual.endYM ? `bis ${qual.endYM}` : '(unbegrenzt)'}
                    {!qual.active && <span style={{ color: '#dc3545', marginLeft: '8px' }}>(Inaktiv)</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => handleEditQualification(index)}
                    style={{
                      background: '#007bff',
                      color: 'white',
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    Bearbeiten
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteQualification(index)}
                    style={{
                      background: '#dc3545',
                      color: 'white',
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    Löschen
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{
            padding: '16px',
            background: '#f8f9fa',
            border: '1px dashed #ddd',
            borderRadius: '4px',
            textAlign: 'center',
            color: '#666',
            fontSize: '14px'
          }}>
            Noch keine Qualifikationen hinzugefügt
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={handleSave}
          style={{
            flex: 1,
            background: '#007bff',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 500
          }}
        >
          Speichern
        </button>
        <button
          onClick={() => window.close()}
          style={{
            flex: 1,
            background: '#6c757d',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 500
          }}
        >
          Abbrechen
        </button>
      </div>

      {/* Qualifikations-Form Modal */}
      {showAddQualification && (
        <QualificationForm
          qualification={editingIndex !== null ? qualifications[editingIndex] : undefined}
          onSave={handleAddQualification}
          onCancel={() => {
            setShowAddQualification(false);
            setEditingIndex(null);
          }}
          title={editingIndex !== null ? 'Qualifikation bearbeiten' : 'Qualifikation hinzufügen'}
        />
      )}
    </div>
  );
};

export default AddPerson;

// Mounten
import { createRoot } from 'react-dom/client';
const container = document.getElementById('add-person-root');
if (container) {
  const root = createRoot(container);
  root.render(<AddPerson />);
}
