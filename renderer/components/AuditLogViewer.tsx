import React, { useEffect, useState, useMemo } from 'react';

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
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState<string>('');

    const loadLogs = async () => {
        setLoading(true);
        try {
            const data = await (window as any).api.getAuditLogs({ year: yearFilter });
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

    const filteredLogs = useMemo(() => {
        return logs.filter(log => {
            // Category filter
            if (categoryFilter !== 'all') {
                if (categoryFilter === 'itw') {
                    if (log.entity_type !== 'itw_phase_assignment' && log.entity_type !== 'itw_duty_roster') {
                        return false;
                    }
                } else if (categoryFilter === 'dienstplan') {
                    if (log.entity_type !== 'duty_roster' && log.entity_type !== 'duty_roster_assignment') {
                        return false;
                    }
                } else if (log.entity_type !== categoryFilter) {
                    return false;
                }
            }

            // Search term filter
            if (searchTerm.trim()) {
                const term = searchTerm.toLowerCase();
                const uName = (log.user_name || '').toLowerCase();
                const ref = (log.entity_ref || '').toLowerCase();
                const oldV = (log.old_value || '').toLowerCase();
                const newV = (log.new_value || '').toLowerCase();
                const det = (log.details || '').toLowerCase();
                const act = (log.action_type || '').toLowerCase();

                if (!uName.includes(term) && !ref.includes(term) && !oldV.includes(term) && !newV.includes(term) && !det.includes(term) && !act.includes(term)) {
                    return false;
                }
            }

            return true;
        });
    }, [logs, categoryFilter, searchTerm]);

    const getEntityBadge = (entityType: string) => {
        switch (entityType) {
            case 'itw_phase_assignment':
                return { label: 'ITW Vorplanung', bg: '#e0f2fe', color: '#0369a1', border: '#bae6fd' };
            case 'itw_duty_roster':
                return { label: 'ITW Dienstplan', bg: '#e0e7ff', color: '#4338ca', border: '#c7d2fe' };
            case 'duty_roster_assignment':
                return { label: 'Einteilung', bg: '#fef3c7', color: '#92400e', border: '#fde68a' };
            case 'duty_roster':
                return { label: 'Dienstplan', bg: '#f3e8ff', color: '#6b21a8', border: '#e9d5ff' };
            default:
                return { label: entityType || 'System', bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' };
        }
    };

    const getActionBadge = (actionType: string) => {
        const act = (actionType || '').toLowerCase();
        if (act.includes('create') || act.includes('neu') || act.includes('assign')) {
            return { label: 'Eingetragen', bg: '#dcfce7', color: '#15803d', border: '#bbf7d0' };
        }
        if (act.includes('delete') || act.includes('remove') || act.includes('lösch')) {
            return { label: 'Entfernt', bg: '#fee2e2', color: '#b91c1c', border: '#fecaca' };
        }
        return { label: 'Geändert', bg: '#fef9c3', color: '#854d0e', border: '#fef08a' };
    };

    return (
        <div style={{ padding: '0 10px', maxWidth: '100%', overflowX: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <h2 style={{ fontSize: '18px', margin: '0 0 4px 0', fontWeight: 600 }}>Änderungsprotokoll / Verlauf</h2>
                    <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>
                        Übersicht über alle Änderungen an Dienstplänen, Einteilungen und der ITW-Vorplanung.
                    </p>
                </div>
                
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Bereichsfilter */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <label style={{ fontSize: '13px', fontWeight: 500 }}>Bereich:</label>
                        <select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '13px', background: '#fff' }}
                        >
                            <option value="all">Alle Bereiche</option>
                            <option value="itw">🚑 ITW Vorplanung & Dienstplan</option>
                            <option value="itw_phase_assignment">📅 Nur ITW-Vorplanung</option>
                            <option value="dienstplan">📋 Dienstplan & Einteilung</option>
                        </select>
                    </div>

                    {/* Jahr */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <label style={{ fontSize: '13px', fontWeight: 500 }}>Jahr:</label>
                        <select 
                            value={yearFilter} 
                            onChange={(e) => setYearFilter(Number(e.target.value))}
                            style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '13px', background: '#fff' }}
                        >
                            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>

                    {/* Suchfeld */}
                    <input
                        type="text"
                        placeholder="Suchen (Name, Datum, Rolle)..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '13px', minWidth: '200px' }}
                    />

                    <button 
                        onClick={loadLogs}
                        style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', background: '#0284c7', color: '#fff', fontSize: '13px', cursor: 'pointer', fontWeight: 500 }}
                    >
                        ↻ Aktualisieren
                    </button>
                </div>
            </div>

            <div style={{ marginBottom: '8px', fontSize: '12px', color: '#777', display: 'flex', justifyContent: 'space-between' }}>
                <span>Angezeigt: <strong>{filteredLogs.length}</strong> von {logs.length} Einträgen ({yearFilter})</span>
                {categoryFilter !== 'all' && (
                    <span>Filter aktiv: <strong>{categoryFilter === 'itw' ? 'ITW Vorplanung & Dienstplan' : categoryFilter === 'itw_phase_assignment' ? 'Nur ITW-Vorplanung' : 'Dienstplan & Einteilung'}</strong></span>
                )}
            </div>

            {loading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>Lade Protokolle...</div>
            ) : (
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid #cbd5e1', backgroundColor: '#f8fafc' }}>
                                <th style={{ padding: '10px 12px', fontWeight: 600, color: '#334155' }}>Datum & Uhrzeit</th>
                                <th style={{ padding: '10px 12px', fontWeight: 600, color: '#334155' }}>Bereich</th>
                                <th style={{ padding: '10px 12px', fontWeight: 600, color: '#334155' }}>Benutzer</th>
                                <th style={{ padding: '10px 12px', fontWeight: 600, color: '#334155' }}>Aktion</th>
                                <th style={{ padding: '10px 12px', fontWeight: 600, color: '#334155' }}>Referenz</th>
                                <th style={{ padding: '10px 12px', fontWeight: 600, color: '#334155' }}>Alter Wert</th>
                                <th style={{ padding: '10px 12px', fontWeight: 600, color: '#334155' }}>Neuer Wert</th>
                                <th style={{ padding: '10px 12px', fontWeight: 600, color: '#334155' }}>Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredLogs.length > 0 ? filteredLogs.map(log => {
                                const dateObj = new Date(log.timestamp);
                                const formattedDate = dateObj.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
                                const entityBadge = getEntityBadge(log.entity_type);
                                const actionBadge = getActionBadge(log.action_type);

                                return (
                                    <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.15s' }}>
                                        <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', color: '#475569', fontSize: '12px' }}>{formattedDate}</td>
                                        <td style={{ padding: '8px 12px' }}>
                                            <span style={{ 
                                                display: 'inline-block', 
                                                padding: '2px 8px', 
                                                borderRadius: '12px', 
                                                fontSize: '11px', 
                                                fontWeight: 600,
                                                backgroundColor: entityBadge.bg, 
                                                color: entityBadge.color,
                                                border: `1px solid ${entityBadge.border}`
                                            }}>
                                                {entityBadge.label}
                                            </span>
                                        </td>
                                        <td style={{ padding: '8px 12px', fontWeight: 500, color: '#1e293b' }}>{log.user_name || `ID: ${log.user_id}`}</td>
                                        <td style={{ padding: '8px 12px' }}>
                                            <span style={{ 
                                                display: 'inline-block', 
                                                padding: '2px 6px', 
                                                borderRadius: '4px', 
                                                fontSize: '11px', 
                                                fontWeight: 500,
                                                backgroundColor: actionBadge.bg, 
                                                color: actionBadge.color,
                                                border: `1px solid ${actionBadge.border}`
                                            }}>
                                                {actionBadge.label}
                                            </span>
                                        </td>
                                        <td style={{ padding: '8px 12px', fontWeight: 500, color: '#334155' }}>{log.entity_ref}</td>
                                        <td style={{ padding: '8px 12px', color: '#dc2626', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.old_value}>
                                            {log.old_value || '-'}
                                        </td>
                                        <td style={{ padding: '8px 12px', color: '#16a34a', fontWeight: 500, maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.new_value}>
                                            {log.new_value || '-'}
                                        </td>
                                        <td style={{ padding: '8px 12px', color: '#64748b', fontSize: '12px' }}>{log.details || '-'}</td>
                                    </tr>
                                );
                            }) : (
                                <tr>
                                    <td colSpan={8} style={{ padding: '32px 12px', textAlign: 'center', color: '#94a3b8' }}>
                                        Keine Änderungen für die ausgewählten Kriterien gefunden.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};
