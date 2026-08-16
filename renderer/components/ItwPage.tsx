import React, { useState } from 'react';
import ItwVorplanungTab from './ItwVorplanungTab';
import ItwAerzteVorplanungTab from './ItwAerzteVorplanungTab';
import ItwDienstplanTab from './ItwDienstplanTab';

const ItwPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'vorplanung' | 'aerzte' | 'dienstplan'>('vorplanung');

    return (
        <div className="page-container">
            {/* Sticky Container für Header + Tabs */}
            <div className="sticky-header-container">
                <h2 className="page-header">ITW</h2>

                {/* Tab Navigation - GRÜN */}
                <div className="tab-navigation" style={{ paddingTop: 0, paddingBottom: 0 }}>
                    <button
                        onClick={() => setActiveTab('vorplanung')}
                        style={{
                            padding: '8px 16px',
                            border: 'none',
                            borderBottom: activeTab === 'vorplanung' ? '3px solid #0ea5e9' : '3px solid transparent',
                            background: activeTab === 'vorplanung' ? '#f8f9fa' : 'transparent',
                            fontWeight: activeTab === 'vorplanung' ? 600 : 400,
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        ITW Vorplanung
                    </button>
                    <button
                        onClick={() => setActiveTab('aerzte')}
                        style={{
                            padding: '8px 16px',
                            border: 'none',
                            borderBottom: activeTab === 'aerzte' ? '3px solid #0ea5e9' : '3px solid transparent',
                            background: activeTab === 'aerzte' ? '#f8f9fa' : 'transparent',
                            fontWeight: activeTab === 'aerzte' ? 600 : 400,
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        Ärzte Vorplanung
                    </button>
                    <button
                        onClick={() => setActiveTab('dienstplan')}
                        style={{
                            padding: '8px 16px',
                            border: 'none',
                            borderBottom: activeTab === 'dienstplan' ? '3px solid #0ea5e9' : '3px solid transparent',
                            background: activeTab === 'dienstplan' ? '#f8f9fa' : 'transparent',
                            fontWeight: activeTab === 'dienstplan' ? 600 : 400,
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        ITW-Dienstplan
                    </button>
                </div>
            </div>

            {/* Content */}
            <div style={{ paddingTop: 16, flex: 1, overflow: 'auto' }}>
                {activeTab === 'vorplanung' && <ItwVorplanungTab />}
                {activeTab === 'aerzte' && <ItwAerzteVorplanungTab />}
                {activeTab === 'dienstplan' && <ItwDienstplanTab />}
            </div>
        </div>
    );
};

export default ItwPage;
