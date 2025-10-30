import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

const params = new URLSearchParams(window.location.search);
const itwId = params.get('id');

const EditItw: React.FC = () => {
  const [name, setName] = useState('');
  const [vorname, setVorname] = useState('');

  useEffect(() => {
    if (!itwId) return;
    (window as any).api.getItwDoctors().then((list: any[]) => {
      const d = list.find(x => String(x.id) === itwId);
      if (d) {
        setName(d.name);
        setVorname(d.vorname);
      }
    });
  }, []);

  const handleSave = async () => {
    if (!itwId) return;
    await (window as any).api.updateItwDoctor({ id: Number(itwId), name, vorname });
    if (window.opener) window.opener.postMessage('itw-updated', '*');
    window.close();
  };

  return (
    <div style={{ padding: 24 }}>
      <h2>ITW Arzt bearbeiten</h2>
      <div style={{ marginBottom: 12 }}>
        <label>Name: <input value={name} onChange={e => setName(e.target.value)} /></label>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label>Vorname: <input value={vorname} onChange={e => setVorname(e.target.value)} /></label>
      </div>
      <button onClick={handleSave}>Speichern</button>
      <button onClick={() => window.close()} style={{ marginLeft: 8 }}>Abbrechen</button>
    </div>
  );
};

const container = document.getElementById('edit-itw-root');
if (container) {
  const root = createRoot(container);
  root.render(<EditItw />);
}
