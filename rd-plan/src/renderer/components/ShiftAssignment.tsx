import React from 'react';

const ShiftAssignment: React.FC = () => {
    return (
        <div className="shift-assignment">
            <h2>Rettungswagenschichten Einteilung</h2>
            {/* Hier können die Schichten für den aktuellen Monat angezeigt werden */}
            <table>
                <thead>
                    <tr>
                        <th>Datum</th>
                        <th>Schicht</th>
                        <th>Personal</th>
                    </tr>
                </thead>
                <tbody>
                    {/* Beispielhafte Datenzeilen */}
                    <tr>
                        <td>01.10.2023</td>
                        <td>Tag</td>
                        <td>Max Mustermann</td>
                    </tr>
                    <tr>
                        <td>01.10.2023</td>
                        <td>Nacht</td>
                        <td>Erika Musterfrau</td>
                    </tr>
                    {/* Weitere Zeilen können hier hinzugefügt werden */}
                </tbody>
            </table>
        </div>
    );
};

export default ShiftAssignment;