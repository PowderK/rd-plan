import React from 'react';

const ConfirmDelete: React.FC = () => {
  // ID aus URL-Query lesen
  const id = Number(new URLSearchParams(window.location.search).get('id'));
  const type = new URLSearchParams(window.location.search).get('type') || 'person';
  const handleDelete = async () => {
    if (type === 'azubi') {
      await (window as any).api.deleteAzubi(id);
      if (window.opener) window.opener.postMessage('azubis-updated', '*');
    } else {
      await (window as any).api.deletePerson(id);
      if (window.opener) window.opener.postMessage('personnel-updated', '*');
    }
    window.close();
  };

  return (
    <div style={{ padding: 24 }}>
      <h2>Eintrag löschen?</h2>
      <p>Möchten Sie diesen Personaleintrag wirklich löschen?</p>
      <button onClick={handleDelete} style={{ background: 'red', color: 'white' }}>Löschen</button>
      <button onClick={() => window.close()} style={{ marginLeft: 8 }}>Abbrechen</button>
    </div>
  );
};

export default ConfirmDelete;

// Mounten
import { createRoot } from 'react-dom/client';
const container = document.getElementById('confirm-delete-root');
if (container) {
  const root = createRoot(container);
  root.render(<ConfirmDelete />);
}
