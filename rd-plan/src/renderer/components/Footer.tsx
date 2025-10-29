import React from 'react';

const Footer: React.FC = () => {
    const version = "1.0.0"; // Aktuelle Version
    const lastUpdated = "2023-10-01"; // Datum der letzten Aktualisierung

    return (
        <footer style={{ textAlign: 'center', padding: '10px', borderTop: '1px solid #ccc' }}>
            <p>Version: {version}</p>
            <p>Letzte Aktualisierung: {lastUpdated}</p>
        </footer>
    );
};

export default Footer;