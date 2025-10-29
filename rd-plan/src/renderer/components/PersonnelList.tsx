import React from 'react';

const PersonnelList: React.FC = () => {
    const personnel = [
        { id: 1, name: 'Max Mustermann', role: 'Sanitäter', shifts: 'Mo, Mi, Fr' },
        { id: 2, name: 'Erika Mustermann', role: 'Notfallsanitäterin', shifts: 'Di, Do, Sa' },
        { id: 3, name: 'Hans Müller', role: 'Fahrer', shifts: 'So, Mo, Di' },
        // Weitere Mitarbeiter können hier hinzugefügt werden
    ];

    return (
        <div>
            <h2>Personalübersicht</h2>
            <ul>
                {personnel.map(person => (
                    <li key={person.id}>
                        <strong>{person.name}</strong> - {person.role} (Schichten: {person.shifts})
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default PersonnelList;