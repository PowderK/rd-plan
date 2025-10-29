import React, { useState, useEffect } from 'react';

const EditPerson: React.FC = () => {
  // ID aus URL-Query lesen
  const id = Number(new URLSearchParams(window.location.search).get('id'));
  const [name, setName] = useState('');
  const [vorname, setVorname] = useState('');
  const [teilzeit, setTeilzeit] = useState(100);
  const [fahrzeugfuehrer, setFahrzeugfuehrer] = useState(false);
  const [fahrzeugfuehrerHLFB, setFahrzeugfuehrerHLFB] = useState(false);
  const [nef, setNef] = useState(false);
  const [itwMaschinist, setItwMaschinist] = useState(false);
  const [itwFahrzeugfuehrer, setItwFahrzeugfuehrer] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const person = await (window as any).api.getPerson(id);
      if (person) {
        setName(person.name || '');
        setVorname(person.vorname || '');
        setTeilzeit(person.teilzeit ?? 100);
        setFahrzeugfuehrer(!!person.fahrzeugfuehrer);
        setFahrzeugfuehrerHLFB(!!person.fahrzeugfuehrerHLFB);
  setNef(!!person.nef);
    setItwMaschinist(!!person.itwMaschinist);
    setItwFahrzeugfuehrer(!!person.itwFahrzeugfuehrer);
      }
    })();
  }, [id]);

  const handleSave = async () => {
  await (window as any).api.updatePerson({ id, name, vorname, teilzeit, fahrzeugfuehrer, fahrzeugfuehrerHLFB, nef, itwMaschinist, itwFahrzeugfuehrer });
    if (window.opener) window.opener.postMessage('personnel-updated', '*');
    window.close();
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
      <div style={{ marginBottom: 12 }}>
        <label>Teilzeit (%): <input type="number" value={teilzeit} min={0} max={100} onChange={e => setTeilzeit(Number(e.target.value))} /></label>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label><input type="checkbox" checked={fahrzeugfuehrer} onChange={e => setFahrzeugfuehrer(e.target.checked)} /> Fahrzeugführer</label>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label><input type="checkbox" checked={fahrzeugfuehrerHLFB} onChange={e => setFahrzeugfuehrerHLFB(e.target.checked)} /> Fahrzeugführer HLF-B</label>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label><input type="checkbox" checked={nef} onChange={e => setNef(e.target.checked)} /> NEF</label>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label><input type="checkbox" checked={itwMaschinist} onChange={e => setItwMaschinist(e.target.checked)} /> ITW Maschinist</label>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label><input type="checkbox" checked={itwFahrzeugfuehrer} onChange={e => setItwFahrzeugfuehrer(e.target.checked)} /> ITW Fahrzeugführer</label>
      </div>
      <button onClick={handleSave}>Speichern</button>
      <button onClick={() => window.close()} style={{ marginLeft: 8 }}>Abbrechen</button>
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
