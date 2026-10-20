import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

const params = new URLSearchParams(window.location.search);
const itwId = params.get('id');

interface DoctorPeriod {
  id?: number;
  doctor_id: number;
  start_date: string;
  end_date: string;
  description?: string;
}

const EditItw: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'stammdaten' | 'zeitraeume'>('stammdaten');
  const [anrede, setAnrede] = useState('');
  const [title, setTitle] = useState('');
  const [name, setName] = useState('');
  const [vorname, setVorname] = useState('');
  const [isNef, setIsNef] = useState(false);
  const [isItw, setIsItw] = useState(true);
  const [attemptedSave, setAttemptedSave] = useState(false);
  const [saving, setSaving] = useState(false);

  // Perioden State
  const [doctorPeriods, setDoctorPeriods] = useState<DoctorPeriod[]>([]);
  const [newPeriod, setNewPeriod] = useState({ start_date: '', end_date: '', description: '' });
  const [editingPeriod, setEditingPeriod] = useState<DoctorPeriod | null>(null);

  const loadDoctorPeriods = async () => {
    if (!itwId) return;
    try {
      const periods = await (window as any).api.getDoctorPeriods(Number(itwId));
      setDoctorPeriods(Array.isArray(periods) ? periods : []);
    } catch (e) {
      console.error('Fehler beim Laden der Arzt-Perioden:', e);
    }
  };

  useEffect(() => {
    if (!itwId) return;
    (window as any).api.getItwDoctors().then((list: any[]) => {
      const d = list.find(x => String(x.id) === itwId);
      if (d) {
        setAnrede(d.anrede || '');
        setTitle(d.title || '');
        setName(d.name || '');
        setVorname(d.vorname || '');
        setIsNef(!!d.is_nef);
        setIsItw(d.is_itw === undefined ? true : !!d.is_itw);
      }
    });
    loadDoctorPeriods();
  }, []);

  const handleSave = async () => {
    if (!itwId) return;
    setAttemptedSave(true);
    if (!name.trim() || !vorname.trim()) {
      alert('Bitte alle Pflichtfelder ausfüllen: Name und Vorname.');
      return;
    }
    if (!isNef && !isItw) {
      alert('Bitte mindestens einen Einsatzbereich auswählen (NEF und/oder ITW).');
      return;
    }
    setSaving(true);
    try {
      await (window as any).api.updateItwDoctor({
        id: Number(itwId),
        name: name.trim(),
        vorname: vorname.trim(),
        anrede: anrede.trim(),
        title: title.trim(),
        is_nef: isNef,
        is_itw: isItw
      });
      try { if (window.opener) window.opener.postMessage('itw-updated', '*'); } catch {}
      window.close();
    } catch (e: any) {
      alert('Speichern fehlgeschlagen: ' + (e?.message || String(e)));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!itwId) return;
    (window as any).api.openConfirmDeleteWindow(Number(itwId), 'itw');
    window.close();
  };

  const handleAddPeriod = async () => {
    if (!itwId) return;
    if (!newPeriod.start_date || !newPeriod.end_date) {
      alert('Bitte Start- und Enddatum für den Zeitraum eingeben.');
      return;
    }
    if (new Date(newPeriod.start_date) > new Date(newPeriod.end_date)) {
      alert('Das Startdatum muss vor oder am Enddatum liegen.');
      return;
    }

    try {
      await (window as any).api.addDoctorPeriod({
        doctor_id: Number(itwId),
        start_date: newPeriod.start_date,
        end_date: newPeriod.end_date,
        description: newPeriod.description.trim()
      });
      setNewPeriod({ start_date: '', end_date: '', description: '' });
      await loadDoctorPeriods();
    } catch (e: any) {
      alert('Fehler beim Hinzufügen des Zeitraums: ' + (e?.message || String(e)));
    }
  };

  const handleSaveEditedPeriod = async () => {
    if (!editingPeriod || !editingPeriod.id) return;
    if (!editingPeriod.start_date || !editingPeriod.end_date) {
      alert('Bitte Start- und Enddatum eingeben.');
      return;
    }
    if (new Date(editingPeriod.start_date) > new Date(editingPeriod.end_date)) {
      alert('Das Startdatum muss vor oder am Enddatum liegen.');
      return;
    }

    try {
      await (window as any).api.updateDoctorPeriod(editingPeriod.id, {
        doctor_id: Number(itwId),
        start_date: editingPeriod.start_date,
        end_date: editingPeriod.end_date,
        description: (editingPeriod.description || '').trim()
      });
      setEditingPeriod(null);
      await loadDoctorPeriods();
    } catch (e: any) {
      alert('Fehler beim Speichern des Zeitraums: ' + (e?.message || String(e)));
    }
  };

  const handleDeletePeriod = async (periodId: number) => {
    if (!confirm('Möchten Sie diesen Verfügbarkeitszeitraum wirklich löschen?')) return;
    try {
      await (window as any).api.deleteDoctorPeriod(periodId);
      await loadDoctorPeriods();
    } catch (e: any) {
      alert('Fehler beim Löschen des Zeitraums: ' + (e?.message || String(e)));
    }
  };

  return (
    <div style={{ padding: '24px', fontFamily: 'Arial, sans-serif', maxWidth: '600px', margin: '0 auto' }}>
      <h2 style={{ marginTop: 0, marginBottom: '16px', color: '#1e293b' }}>
        Arzt bearbeiten {name ? `– ${title ? title + ' ' : ''}${vorname} ${name}` : ''}
      </h2>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', marginBottom: '20px' }}>
        <button
          type="button"
          onClick={() => setActiveTab('stammdaten')}
          style={{
            padding: '8px 18px',
            border: 'none',
            borderBottom: activeTab === 'stammdaten' ? '3px solid #0284c7' : '3px solid transparent',
            background: activeTab === 'stammdaten' ? '#f0f9ff' : 'transparent',
            color: activeTab === 'stammdaten' ? '#0369a1' : '#64748b',
            fontWeight: activeTab === 'stammdaten' ? 600 : 400,
            cursor: 'pointer',
            fontSize: '14px',
            transition: 'all 0.15s ease'
          }}
        >
          Stammdaten
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('zeitraeume')}
          style={{
            padding: '8px 18px',
            border: 'none',
            borderBottom: activeTab === 'zeitraeume' ? '3px solid #0284c7' : '3px solid transparent',
            background: activeTab === 'zeitraeume' ? '#f0f9ff' : 'transparent',
            color: activeTab === 'zeitraeume' ? '#0369a1' : '#64748b',
            fontWeight: activeTab === 'zeitraeume' ? 600 : 400,
            cursor: 'pointer',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease'
          }}
        >
          <span>Verfügbarkeit / Perioden</span>
          {doctorPeriods.length > 0 && (
            <span style={{
              background: '#0284c7',
              color: '#ffffff',
              borderRadius: '9999px',
              padding: '1px 6px',
              fontSize: '11px',
              fontWeight: 600
            }}>
              {doctorPeriods.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'stammdaten' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500, color: '#334155' }}>
                Anrede
              </label>
              <select
                value={anrede}
                onChange={e => setAnrede(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                  backgroundColor: '#fff'
                }}
              >
                <option value="">-- Keine --</option>
                <option value="Herr">Herr</option>
                <option value="Frau">Frau</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500, color: '#334155' }}>
                Titel
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="z. B. Dr. oder Prof."
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  fontSize: '14px',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500, color: '#334155' }}>
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
                  border: attemptedSave && !name.trim() ? '2px solid #b00020' : '1px solid #cbd5e1',
                  borderRadius: '6px',
                  fontSize: '14px',
                  boxSizing: 'border-box'
                }}
              />
              {attemptedSave && !name.trim() && (
                <div style={{ color: '#b00020', fontSize: '12px', marginTop: '4px' }}>Bitte Name eingeben.</div>
              )}
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500, color: '#334155' }}>
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
                  border: attemptedSave && !vorname.trim() ? '2px solid #b00020' : '1px solid #cbd5e1',
                  borderRadius: '6px',
                  fontSize: '14px',
                  boxSizing: 'border-box'
                }}
              />
              {attemptedSave && !vorname.trim() && (
                <div style={{ color: '#b00020', fontSize: '12px', marginTop: '4px' }}>Bitte Vorname eingeben.</div>
              )}
            </div>
          </div>

          <div style={{ marginBottom: '24px', padding: '16px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
            <label style={{ display: 'block', marginBottom: '10px', fontWeight: 600, color: '#334155' }}>
              Einsatzbereich / Zuordnung *
            </label>
            <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>
                <input
                  type="checkbox"
                  checked={isItw}
                  onChange={e => setIsItw(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: '#16a34a', cursor: 'pointer' }}
                />
                <span>ITW-Arzt</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>
                <input
                  type="checkbox"
                  checked={isNef}
                  onChange={e => setIsNef(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: '#2563eb', cursor: 'pointer' }}
                />
                <span>NEF-Arzt</span>
              </label>
            </div>
            {attemptedSave && !isNef && !isItw && (
              <div style={{ color: '#b00020', fontSize: '12px', marginTop: '6px' }}>Bitte mindestens einen Einsatzbereich ankreuzen.</div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                flex: 1,
                background: saving ? '#6c757d' : '#0284c7',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '6px',
                cursor: saving ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 600
              }}
            >
              {saving ? 'Speichere...' : 'Speichern'}
            </button>
            <button
              onClick={handleDelete}
              disabled={saving}
              style={{
                flex: 1,
                background: '#dc2626',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '6px',
                cursor: saving ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 600
              }}
            >
              Löschen
            </button>
            <button
              onClick={() => window.close()}
              disabled={saving}
              style={{
                flex: 1,
                background: '#64748b',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '6px',
                cursor: saving ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 600
              }}
            >
              Abbrechen
            </button>
          </div>
        </>
      )}

      {activeTab === 'zeitraeume' && (
        <div>
          <div style={{ marginBottom: '16px', color: '#475569', fontSize: '13px', lineHeight: '1.5' }}>
            Definieren Sie hier die Zeiträume, in denen der Arzt für Dienste (ITW / NEF) zur Verfügung steht. 
            Außerhalb dieser Zeiträume wird der Arzt in den Auswahlmenüs ausgeblendet.
            <em> Wenn keine Zeiträume hinterlegt sind, steht der Arzt dauerhaft zur Verfügung.</em>
          </div>

          {/* Liste bestehender Perioden */}
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#334155', fontSize: '14px' }}>Bestehende Zeiträume</h4>
            {doctorPeriods.length === 0 ? (
              <div style={{ padding: '14px', background: '#f8fafc', borderRadius: '6px', border: '1px dashed #cbd5e1', color: '#64748b', fontSize: '13px', textAlign: 'center' }}>
                Keine Zeiträume hinterlegt (Arzt ist dauerhaft verfügbar).
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {doctorPeriods.map(period => {
                  const isEditingThis = editingPeriod?.id === period.id;
                  const now = new Date();
                  const curIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                  const isCurrent = period.start_date <= curIso && period.end_date >= curIso;

                  if (isEditingThis) {
                    return (
                      <div key={period.id} style={{ padding: '12px', background: '#f0f9ff', borderRadius: '6px', border: '1px solid #0284c7' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '8px' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '4px' }}>Startdatum</label>
                            <input
                              type="date"
                              value={editingPeriod?.start_date || ''}
                              onChange={e => setEditingPeriod(prev => prev ? { ...prev, start_date: e.target.value } : null)}
                              style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '4px' }}>Enddatum</label>
                            <input
                              type="date"
                              value={editingPeriod?.end_date || ''}
                              onChange={e => setEditingPeriod(prev => prev ? { ...prev, end_date: e.target.value } : null)}
                              style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                            />
                          </div>
                        </div>
                        <div style={{ marginBottom: '10px' }}>
                          <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '4px' }}>Beschreibung / Grund</label>
                          <input
                            type="text"
                            value={editingPeriod?.description || ''}
                            onChange={e => setEditingPeriod(prev => prev ? { ...prev, description: e.target.value } : null)}
                            placeholder="z. B. Befristeter Einsatz, Rotation..."
                            style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                          />
                        </div>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            onClick={handleSaveEditedPeriod}
                            style={{ padding: '6px 14px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                          >
                            Speichern
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingPeriod(null)}
                            style={{ padding: '6px 14px', background: '#94a3b8', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                          >
                            Abbrechen
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={period.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 600, fontSize: '14px', color: '#1e293b' }}>
                            {new Date(period.start_date + 'T00:00:00').toLocaleDateString('de-DE')} – {new Date(period.end_date + 'T00:00:00').toLocaleDateString('de-DE')}
                          </span>
                          {isCurrent ? (
                            <span style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', padding: '1px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                              Aktuell aktiv
                            </span>
                          ) : (
                            <span style={{ background: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1', padding: '1px 6px', borderRadius: '4px', fontSize: '11px' }}>
                              Inaktiv
                            </span>
                          )}
                        </div>
                        {period.description && (
                          <div style={{ color: '#64748b', fontSize: '12px', marginTop: '2px' }}>
                            {period.description}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => setEditingPeriod(period)}
                          style={{
                            padding: '4px 10px',
                            background: '#f1f5f9',
                            color: '#334155',
                            border: '1px solid #cbd5e1',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          Bearbeiten
                        </button>
                        <button
                          type="button"
                          onClick={() => period.id && handleDeletePeriod(period.id)}
                          style={{
                            padding: '4px 10px',
                            background: '#fee2e2',
                            color: '#dc2626',
                            border: '1px solid #fca5a5',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          Löschen
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Neuen Zeitraum anlegen */}
          <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <h4 style={{ margin: '0 0 12px 0', color: '#334155', fontSize: '14px' }}>Neuen Zeitraum hinzufügen</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#475569', marginBottom: '4px' }}>
                  Startdatum *
                </label>
                <input
                  type="date"
                  value={newPeriod.start_date}
                  onChange={e => setNewPeriod({ ...newPeriod, start_date: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#475569', marginBottom: '4px' }}>
                  Enddatum *
                </label>
                <input
                  type="date"
                  value={newPeriod.end_date}
                  onChange={e => setNewPeriod({ ...newPeriod, end_date: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#475569', marginBottom: '4px' }}>
                Beschreibung / Bemerkung
              </label>
              <input
                type="text"
                value={newPeriod.description}
                onChange={e => setNewPeriod({ ...newPeriod, description: e.target.value })}
                placeholder="z. B. Dienstaufnahme, Befristet bis..."
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            <button
              type="button"
              onClick={handleAddPeriod}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                background: '#0284c7',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 600
              }}
            >
              + Zeitraum hinzufügen
            </button>
          </div>

          <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => window.close()}
              style={{
                padding: '10px 20px',
                background: '#64748b',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 600
              }}
            >
              Schließen
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const container = document.getElementById('edit-itw-root');
if (container) {
  const root = createRoot(container);
  root.render(<EditItw />);
}
