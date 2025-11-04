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
  const handleInactivate = async () => {
    if (type !== 'azubi') {
      await (window as any).api.setPersonActive(id, false);
      if (window.opener) window.opener.postMessage('personnel-updated', '*');
    }
    window.close();
  };

  return (
    <div style={{ padding: 24 }}>
      <h2>{type === 'azubi' ? 'Azubi löschen?' : 'Person inaktiv setzen oder löschen?'}</h2>
      {type === 'azubi' ? (
        <p>Möchten Sie diesen Azubi-Eintrag wirklich löschen?</p>
      ) : (
        <>
          <p>Inaktiv setzen: Person wird aus Auswahl/Einteilung ausgeblendet, alle historischen Werte bleiben erhalten.</p>
          <p style={{ color: '#b00020' }}>Endgültig löschen: Person wird vollständig entfernt. Historische Nachweise/Zuordnungen können dadurch unvollständig werden.</p>
        </>
      )}
      {type !== 'azubi' && (
        <button onClick={handleInactivate} style={{ background: '#666', color: 'white', marginRight: 8 }}>Inaktiv setzen</button>
      )}
      <button onClick={handleDelete} style={{ background: 'red', color: 'white' }}>{type === 'azubi' ? 'Löschen' : 'Endgültig löschen'}</button>
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
