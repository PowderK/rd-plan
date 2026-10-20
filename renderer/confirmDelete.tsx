import React from 'react';

const ConfirmDelete: React.FC = () => {
  // ID aus URL-Query lesen
  const id = Number(new URLSearchParams(window.location.search).get('id'));
  const type = new URLSearchParams(window.location.search).get('type') || 'person';
  const isItw = type === 'itw' || type === 'doctor';

  const handleDelete = async () => {
    if (type === 'azubi') {
      await (window as any).api.deleteAzubi(id);
      try { if (window.opener) window.opener.postMessage('azubis-updated', '*'); } catch {}
    } else if (isItw) {
      await (window as any).api.deleteItwDoctor(id);
      try { if (window.opener) window.opener.postMessage('itw-updated', '*'); } catch {}
    } else {
      await (window as any).api.deletePerson(id);
      try { if (window.opener) window.opener.postMessage('personnel-updated', '*'); } catch {}
    }
    window.close();
  };

  const handleInactivate = async () => {
    if (type !== 'azubi' && !isItw) {
      await (window as any).api.setPersonActive(id, false);
      try { if (window.opener) window.opener.postMessage('personnel-updated', '*'); } catch {}
    }
    window.close();
  };

  const renderContent = () => {
    if (type === 'azubi') return <p>Möchten Sie diesen Azubi-Eintrag wirklich löschen?</p>;
    if (isItw) return <p>Möchten Sie diesen ITW-Arzt-Eintrag wirklich löschen?</p>;
    return (
      <>
        <p>Inaktiv setzen: Person wird aus Auswahl/Einteilung ausgeblendet, alle historischen Werte bleiben erhalten.</p>
        <p style={{ color: '#b00020' }}>Endgültig löschen: Person wird vollständig entfernt. Historische Nachweise/Zuordnungen können dadurch unvollständig werden.</p>
      </>
    );
  };

  const getTitle = () => {
    if (type === 'azubi') return 'Azubi löschen?';
    if (isItw) return 'ITW-Arzt löschen?';
    return 'Person inaktiv setzen oder löschen?';
  };

  return (
    <div style={{ padding: 24 }}>
      <h2>{getTitle()}</h2>
      {renderContent()}
      {type !== 'azubi' && !isItw && (
        <button onClick={handleInactivate} style={{ background: '#666', color: 'white', marginRight: 8 }}>Inaktiv setzen</button>
      )}
      <button onClick={handleDelete} style={{ background: 'red', color: 'white' }}>{(type === 'azubi' || isItw) ? 'Löschen' : 'Endgültig löschen'}</button>
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
