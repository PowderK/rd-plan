import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import ItwVorplanungTab from './ItwVorplanungTab';
import ItwAerzteVorplanungTab from './ItwAerzteVorplanungTab';
import ItwDienstplanTab from './ItwDienstplanTab';

const ItwPage: React.FC = () => {
    const { currentUser, isDevMode } = useAuth();
    const isAppAdmin = isDevMode || currentUser?.roleName?.toLowerCase() === 'administrator';

    // Permissions per tab with fallback to legacy `itw` permission
    const canViewVorplanung = isAppAdmin || (
        currentUser?.permissions?.itw_vorplanung 
            ? currentUser.permissions.itw_vorplanung !== 'none'
            : (currentUser?.permissions?.itw && currentUser.permissions.itw !== 'none')
    );

    const canViewAerzte = isAppAdmin || (
        currentUser?.permissions?.itw_aerzte
            ? currentUser.permissions.itw_aerzte !== 'none'
            : (currentUser?.permissions?.itw === 'write_all' || currentUser?.permissions?.itw === 'write')
    );

    const canViewDienstplan = isAppAdmin || (
        currentUser?.permissions?.itw_dienstplan
            ? currentUser.permissions.itw_dienstplan !== 'none'
            : (currentUser?.permissions?.itw && currentUser.permissions.itw !== 'none')
    );

    const availableTabs = useMemo(() => {
        const tabs: { key: 'vorplanung' | 'aerzte' | 'dienstplan'; label: string }[] = [];
        if (canViewVorplanung) tabs.push({ key: 'vorplanung', label: 'ITW Vorplanung' });
        if (canViewAerzte) tabs.push({ key: 'aerzte', label: 'Ärzte Vorplanung' });
        if (canViewDienstplan) tabs.push({ key: 'dienstplan', label: 'ITW-Dienstplan' });
        return tabs;
    }, [canViewVorplanung, canViewAerzte, canViewDienstplan]);

    const [activeTab, setActiveTab] = useState<'vorplanung' | 'aerzte' | 'dienstplan'>('vorplanung');

    useEffect(() => {
        if (availableTabs.length > 0 && !availableTabs.some(t => t.key === activeTab)) {
            setActiveTab(availableTabs[0].key);
        }
    }, [availableTabs, activeTab]);

    if (availableTabs.length === 0) {
        return (
            <div className="page-container" style={{ padding: 24 }}>
                <h2 className="page-header">ITW</h2>
                <div style={{ marginTop: 20, padding: 16, background: '#fff5f5', color: '#c53030', borderRadius: 8, border: '1px solid #feb2b2' }}>
                    Sie besitzen keine Berechtigung zum Anzeigen der ITW-Bereiche.
                </div>
            </div>
        );
    }

    return (
        <div className="page-container">
            {/* Sticky Container für Header + Tabs */}
            <div className="sticky-header-container">
                <h2 className="page-header">ITW</h2>

                {/* Tab Navigation */}
                <div className="tab-navigation" style={{ paddingTop: 0, paddingBottom: 0 }}>
                    {availableTabs.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            style={{
                                padding: '8px 16px',
                                border: 'none',
                                borderBottom: activeTab === tab.key ? '3px solid #0ea5e9' : '3px solid transparent',
                                background: activeTab === tab.key ? '#f8f9fa' : 'transparent',
                                fontWeight: activeTab === tab.key ? 600 : 400,
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div style={{ paddingTop: 16, flex: 1, overflow: 'auto' }}>
                {activeTab === 'vorplanung' && canViewVorplanung && <ItwVorplanungTab />}
                {activeTab === 'aerzte' && canViewAerzte && <ItwAerzteVorplanungTab />}
                {activeTab === 'dienstplan' && canViewDienstplan && <ItwDienstplanTab />}
            </div>
        </div>
    );
};

export default ItwPage;
