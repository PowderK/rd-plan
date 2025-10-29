import React, { useState, useEffect, useCallback } from 'react';

interface Person {
  id: number;
  name: string;
  vorname: string;
  teilzeit: number;
  fahrzeugfuehrer: boolean;
  fahrzeugfuehrerHLFB: boolean;
  sort?: number;
}

const PersonnelOverview: React.FC = () => {
  const [personnel, setPersonnel] = useState<Person[]>([]);
  const [azubis, setAzubis] = useState<{ id: number; name: string; vorname: string; lehrjahr: number }[]>([]);
  const [itws, setItws] = useState<{ id: number; name: string; vorname: string }[]>([]);
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [draggedAzubiId, setDraggedAzubiId] = useState<number | null>(null);
  const [draggedItwId, setDraggedItwId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const loadPersonnel = useCallback(async () => {
    setLoading(true);
    const list = await (window as any).api.getPersonnelList();
    setPersonnel(list);
    setLoading(false);
  }, []);

  const loadAzubis = useCallback(async () => {
    const list = await (window as any).api.getAzubiList();
    setAzubis(list);
  }, []);

  const loadItws = useCallback(async () => {
    const list = await (window as any).api.getItwDoctors();
    setItws(list);
  }, []);

  useEffect(() => {
    loadPersonnel();
    loadAzubis();
    loadItws();
    const handler = (_event: any) => {
      console.log('[Renderer] personnel-updated Event empfangen');
      loadPersonnel();
      loadAzubis();
      loadItws();
    };
    (window as any).api.onPersonnelUpdated?.(handler);
    // subscribe to azubi broadcasts from main
    const azubiHandler = (_event: any) => {
      console.log('[Renderer] azubis-updated Event empfangen');
      loadAzubis();
    };
    (window as any).api.onAzubisUpdated?.(azubiHandler);
    const itwHandler = (_event: any) => {
      console.log('[Renderer] itw-updated Event empfangen');
      loadItws();
    };
    (window as any).api.onItwUpdated?.(itwHandler);
    // postMessage-Listener für Popups
    const messageHandler = (event: MessageEvent) => {
      if (event.data === 'personnel-updated') {
        console.log('[Renderer] personnel-updated via postMessage empfangen');
        loadPersonnel();
      } else if (event.data === 'azubis-updated') {
        console.log('[Renderer] azubis-updated via postMessage empfangen');
        loadAzubis();
      } else if (event.data === 'itw-updated') {
        console.log('[Renderer] itw-updated via postMessage empfangen');
        loadItws();
      }
    };
    window.addEventListener('message', messageHandler);
    return () => {
      (window as any).api.offPersonnelUpdated?.(handler);
      (window as any).api.offAzubisUpdated?.(azubiHandler);
      (window as any).api.offItwUpdated?.(itwHandler);
      window.removeEventListener('message', messageHandler);
    };
  }, [loadPersonnel, loadAzubis]);

  const onDragStart = (id: number) => setDraggedId(id);
  const onDragOver = (e: React.DragEvent<HTMLTableRowElement>) => e.preventDefault();
  const onDrop = async (id: number) => {
    if (draggedId === null || draggedId === id) return;
    const oldIndex = personnel.findIndex(p => p.id === draggedId);
    const newIndex = personnel.findIndex(p => p.id === id);
    const updated = [...personnel];
    const [removed] = updated.splice(oldIndex, 1);
    updated.splice(newIndex, 0, removed);
    setPersonnel(updated);
    setDraggedId(null);
    // Reihenfolge in DB speichern
    await (window as any).api.updatePersonnelOrder(updated.map(p => p.id));
    loadPersonnel();
  };

  const onAzubiDragStart = (id: number) => setDraggedAzubiId(id);
  const onAzubiDrop = async (id: number) => {
    if (draggedAzubiId === null || draggedAzubiId === id) return;
    const oldIndex = azubis.findIndex(a => a.id === draggedAzubiId);
    const newIndex = azubis.findIndex(a => a.id === id);
    const updated = [...azubis];
    const [removed] = updated.splice(oldIndex, 1);
    updated.splice(newIndex, 0, removed);
    setAzubis(updated);
    setDraggedAzubiId(null);
    // Reihenfolge in DB speichern
    await (window as any).api.updateAzubiOrder(updated.map(a => a.id));
    loadAzubis();
  };

  const onItwDragStart = (id: number) => setDraggedItwId(id);
  const onItwDrop = async (id: number) => {
    if (draggedItwId === null || draggedItwId === id) return;
    const oldIndex = itws.findIndex(a => a.id === draggedItwId);
    const newIndex = itws.findIndex(a => a.id === id);
    const updated = [...itws];
    const [removed] = updated.splice(oldIndex, 1);
    updated.splice(newIndex, 0, removed);
    setItws(updated);
    setDraggedItwId(null);
    // Reihenfolge in DB speichern
    await (window as any).api.updateItwDoctorOrder(updated.map(a => a.id));
    loadItws();
  };

  return (
    <div style={{ padding: 24 }}>
      <h2>Personalübersicht</h2>
      {loading ? <div>Lade Daten...</div> : (
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Vorname</th>
            <th>Teilzeit (%)</th>
            <th>Fahrzeugführer</th>
            <th>Fahrzeugführer HLF-B</th>
            <th>Aktionen</th>
          </tr>
        </thead>
        <tbody>
          {personnel.map(person => (
            <tr key={person.id} draggable onDragStart={() => onDragStart(person.id)} onDragOver={onDragOver} onDrop={() => onDrop(person.id)} style={{ cursor: 'move' }}>
              <td>{person.name}</td>
              <td>{person.vorname}</td>
              <td>{person.teilzeit}</td>
              <td><input type="checkbox" checked={!!person.fahrzeugfuehrer} readOnly /></td>
              <td><input type="checkbox" checked={!!person.fahrzeugfuehrerHLFB} readOnly /></td>
              <td>
                <button style={{ marginRight: 8 }} onClick={() => (window as any).api.openEditPersonWindow(person.id)}>Ändern</button>
                <button onClick={() => (window as any).api.openConfirmDeleteWindow(person.id)}>Löschen</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      )}
      <div style={{ marginTop: 32 }}>
        <h3>Azubis</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Vorname</th>
              <th>Lehrjahr</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {azubis.map(a => (
              <tr key={a.id} draggable onDragStart={() => onAzubiDragStart(a.id)} onDragOver={onDragOver} onDrop={() => onAzubiDrop(a.id)} style={{ cursor: 'move' }}>
                <td>{a.name}</td>
                <td>{a.vorname}</td>
                <td>{a.lehrjahr}</td>
                <td>
                  <button style={{ marginRight: 8 }} onClick={() => (window as any).api.openEditAzubiWindow(a.id)}>Ändern</button>
                  <button onClick={() => (window as any).api.openConfirmDeleteWindow(a.id, 'azubi')}>Löschen</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: 12 }}>
          <button onClick={() => (window as any).api.openAddAzubiWindow()}>Azubi hinzufügen</button>
        </div>
      </div>
      <div style={{ marginTop: 32 }}>
        <h3>ITW Ärzte</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Vorname</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {itws.map(a => (
              <tr key={a.id} draggable onDragStart={() => onItwDragStart(a.id)} onDragOver={onDragOver} onDrop={() => onItwDrop(a.id)} style={{ cursor: 'move' }}>
                <td>{a.name}</td>
                <td>{a.vorname}</td>
                <td>
                  <button style={{ marginRight: 8 }} onClick={() => (window as any).api.openEditItwWindow(a.id)}>Ändern</button>
                  <button onClick={() => (window as any).api.openConfirmDeleteWindow(a.id, 'itw')}>Löschen</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: 12 }}>
          <button onClick={() => (window as any).api.openAddItwWindow()}>ITW Arzt hinzufügen</button>
        </div>
      </div>
      <div style={{ marginTop: 16 }}>
        <button onClick={() => (window as any).api.openAddPersonWindow()}>Hinzufügen</button>
        <button onClick={() => window.close()} style={{ marginLeft: 8 }}>Schließen</button>
      </div>
    </div>
  );
};

export default PersonnelOverview;
