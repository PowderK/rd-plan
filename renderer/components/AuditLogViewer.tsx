import React, { useEffect, useState } from 'react';

interface AuditLog {
    id: number;
    timestamp: string;
    user_id: number;
    user_name: string;
    action_type: string;
    entity_type: string;
    entity_ref: string;
    old_value: string;
    new_value: string;
    details: string;
}

export const AuditLogViewer: React.FC = () => {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [yearFilter, setYearFilter] = useState<number>(new Date().getFullYear());

    const loadLogs = async () => {
        setLoading(true);
        try {
            const data = await window.api.getAuditLogs({ year: yearFilter });
            setLogs(data || []);
        } catch (error) {
            console.error('Fehler beim Laden der Audit Logs:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadLogs();
    }, [yearFilter]);

    return (
        <div style={{ padding: '0 20px', maxWidth: '100%', overflowX: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2 style={{ fontSize: '18px', margin: 0 }}>Änderungsprotokoll</h2>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <label style={{ fontSize: '14px', fontWeight: 500 }}>Jahr:</label>
                    <select 
                        value={yearFilter} 
                        onChange={(e) => setYearFilter(Number(e.target.value))}
                        style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid #ccc' }}
                    >
                        {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                    <button 
                        onClick={loadLogs}
                        style={{ padding: '6px 16px', borderRadius: '4px', border: 'none', background: '#e0e0e0', cursor: 'pointer' }}
                    >
                        Aktualisieren
                    </button>
                </div>
            </div>

            {loading ? (
                <p>Lade Protokolle...</p>
            ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ borderBottom: '2px solid #ddd', backgroundColor: '#f9f9f9' }}>
                            <th style={{ padding: '12px' }}>Datum & Uhrzeit</th>
                            <th style={{ padding: '12px' }}>Benutzer</th>
                            <th style={{ padding: '12px' }}>Aktion</th>
                            <th style={{ padding: '12px' }}>Referenz</th>
                            <th style={{ padding: '12px' }}>Alter Wert</th>
                            <th style={{ padding: '12px' }}>Neuer Wert</th>
                            <th style={{ padding: '12px' }}>Details</th>
                        </tr>
                    </thead>
                    <tbody>
                        {logs.length > 0 ? logs.map(log => {
                            const dateObj = new Date(log.timestamp);
                            const formattedDate = dateObj.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                            return (
                                <tr key={log.id} style={{ borderBottom: '1px solid #eee' }}>
                                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{formattedDate}</td>
                                    <td style={{ padding: '10px 12px' }}>{log.user_name || `ID: ${log.user_id}`}</td>
                                    <td style={{ padding: '10px 12px' }}>{log.action_type}</td>
                                    <td style={{ padding: '10px 12px' }}>{log.entity_ref}</td>
                                    <td style={{ padding: '10px 12px', color: '#d32f2f' }}>{log.old_value}</td>
                                    <td style={{ padding: '10px 12px', color: '#388e3c' }}>{log.new_value}</td>
                                    <td style={{ padding: '10px 12px', color: '#666' }}>{log.details}</td>
                                </tr>
                            );
                        }) : (
                            <tr>
                                <td colSpan={7} style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                                    Keine Änderungen in diesem Jahr gefunden.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            )}
        </div>
    );
};
