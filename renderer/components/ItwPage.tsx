import React, { useState } from 'react';
import ItwVorplanungTab from './ItwVorplanungTab';
import ItwDienstplanTab from './ItwDienstplanTab';

const ItwPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'vorplanung' | 'dienstplan'>('vorplanung');

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: 'Arial, sans-serif' }}>
            {/* Header/Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid #ddd', padding: '10px 20px 0 20px', background: '#f8f9fa' }}>
                <button
                    onClick={() => setActiveTab('vorplanung')}
                    style={{
                        padding: '10px 20px',
                        background: 'transparent',
                        border: 'none',
                        borderBottom: activeTab === 'vorplanung' ? '3px solid #007bff' : '3px solid transparent',
                        color: activeTab === 'vorplanung' ? '#007bff' : '#666',
                        fontWeight: activeTab === 'vorplanung' ? 'bold' : 'normal',
                        cursor: 'pointer',
                        fontSize: '15px'
                    }}
                >
                    Abteilungsplanung
                </button>
                <button
                    onClick={() => setActiveTab('dienstplan')}
                    style={{
                        padding: '10px 20px',
                        background: 'transparent',
                        border: 'none',
                        borderBottom: activeTab === 'dienstplan' ? '3px solid #007bff' : '3px solid transparent',
                        color: activeTab === 'dienstplan' ? '#007bff' : '#666',
                        fontWeight: activeTab === 'dienstplan' ? 'bold' : 'normal',
                        cursor: 'pointer',
                        fontSize: '15px'
                    }}
                >
                    ITW-Dienstplan
                </button>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflow: 'auto' }}>
                {activeTab === 'vorplanung' ? <ItwVorplanungTab /> : <ItwDienstplanTab />}
            </div>
        </div>
    );
};

export default ItwPage;
