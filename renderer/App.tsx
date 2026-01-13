import React, { useEffect, useMemo, useState } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import Sidebar from './components/Sidebar';
import DutyRoster from './components/DutyRoster';
import PersonnelOverview from './components/PersonnelOverview';
import Vehicles from './components/Vehicles';
import SettingsMenu from './components/SettingsMenu';
import ValuesPage from './components/ValuesPage';
import EinteilungPage from './components/EinteilungPage';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './login';

const monthNames = [
    'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
];

const AppContent: React.FC = () => {
    const { isAuthenticated, login, isDevMode } = useAuth();
    const [currentMonth] = useState<number>(new Date().getMonth());
    const [rescueStation, setRescueStation] = useState<string>('');
    const [department, setDepartment] = useState<number>(1);
    const [year, setYear] = useState<number>(new Date().getFullYear());
    const [activeView, setActiveView] = useState<'einteilung'|'dienstplan'|'werte'|'personal'|'fahrzeuge'|'einstellungen'>('einteilung');
    const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);

    async function loadHeaderInfo() {
        try {
            const rs = await (window as any).api.getSetting('rescueStation');
            if (rs != null) setRescueStation(String(rs));
        } catch {}
        try {
            const dep = await (window as any).api.getSetting('department');
            if (dep != null) setDepartment(Number(dep));
        } catch {}
        // Jahr wird nicht mehr aus Settings geladen - wird von DutyRoster/Values gesteuert
        // Setze initial auf aktuelles Jahr oder bereits gesetztes window.rdPlanYear
        if ((window as any).rdPlanYear) {
            setYear((window as any).rdPlanYear);
        }
    }

    useEffect(() => {
        if (isAuthenticated) {
            loadHeaderInfo();
            
            // Reagiere auf Jahr-Änderungen von DutyRoster/Values
            const handleYearChange = (e: any) => {
                if (e.detail?.year) {
                    setYear(e.detail.year);
                }
            };
            window.addEventListener('rdplan-year-changed', handleYearChange);
            
            return () => window.removeEventListener('rdplan-year-changed', handleYearChange);
        }
    }, [isAuthenticated]);

    // Navigation via CustomEvent 'navigate' und via API (falls Main etwas triggert)
    useEffect(() => {
      if (!isAuthenticated) return;
      
      const handler = (e: Event) => {
        const ce = e as CustomEvent;
        const view = (ce.detail?.view || '') as string;
                if (['einteilung','dienstplan','werte','personal','fahrzeuge','einstellungen'].includes(view)) {
          setActiveView(view as any);
        }
      };
      window.addEventListener('navigate', handler as EventListener);
                    (window as any).api?.onNavigate?.((v: any) => {
                        if (typeof v === 'string' && ['einteilung','dienstplan','werte','personal','fahrzeuge','einstellungen'].includes(v)) setActiveView(v as any);
                        else if (v && typeof v.view === 'string' && ['einteilung','dienstplan','werte','personal','fahrzeuge','einstellungen'].includes(v.view)) setActiveView(v.view as any);
            });
      return () => {
        (window as any).api?.offNavigate?.();
        window.removeEventListener('navigate', handler as EventListener);
      };
    }, [isAuthenticated]);

        // Reagiere auf Settings-Änderungen (Rettungswache/Abteilung/Jahr für Header)
        useEffect(() => {
            if (!isAuthenticated) return;
            
            const handler = async () => {
                try { await loadHeaderInfo(); } catch {}
            };
            (window as any).api?.onSettingsUpdated?.(handler);
            return () => (window as any).api?.offSettingsUpdated?.(handler);
        }, [isAuthenticated]);

        const onNavigate = (view: typeof activeView) => setActiveView(view);

        const content = useMemo(() => {
                    switch (activeView) {
                        case 'einteilung':
                                    return <EinteilungPage />;
                case 'dienstplan':
                    return <DutyRoster />;
                case 'werte':
                    return <ValuesPage />;
                case 'personal':
                    return <PersonnelOverview />;
                case 'fahrzeuge':
                    return <Vehicles />;
                case 'einstellungen':
                    return <div style={{ padding: 16 }}><SettingsMenu onClose={() => setActiveView('dienstplan')} /></div>;
                default:
                    return null;
            }
        }, [activeView]);

        // Reagiere auf Sidebar Collapse Events
        useEffect(() => {
            if (!isAuthenticated) return;
            
            const handler = (e: Event) => {
                const ce = e as CustomEvent;
                if (typeof ce.detail?.collapsed === 'boolean') {
                    setSidebarCollapsed(ce.detail.collapsed);
                }
            };
            window.addEventListener('sidebar-collapsed', handler as EventListener);
            return () => window.removeEventListener('sidebar-collapsed', handler as EventListener);
        }, [isAuthenticated]);

        // Zeige Login-Dialog wenn nicht authentifiziert und nicht im Dev-Mode
        if (!isAuthenticated && !isDevMode) {
            return <Login onLoginSuccess={() => {}} onLogin={login} />;
        }

        return (
            <div style={{ display: 'grid', gridTemplateColumns: `${sidebarCollapsed ? '56px' : '200px'} 1fr`, gridTemplateRows: 'auto 1fr auto', height: '100vh', transition: 'grid-template-columns 0.15s' }}>
                <div style={{ gridRow: 1, gridColumn: '1 / span 2' }}>
                    <Header rescueStation={rescueStation} department={department} year={year} />
                </div>
                <div style={{ gridRow: 2, gridColumn: 1 }}>
                    <Sidebar active={activeView} />
                </div>
                <main style={{ gridRow: 2, gridColumn: 2, overflow: 'auto' }}>
                    {content}
                </main>
                <div style={{ gridRow: 3, gridColumn: 2 }}>
                    <Footer />
                </div>
            </div>
        );
};

const App: React.FC = () => {
    return (
        <AuthProvider>
            <AppContent />
        </AuthProvider>
    );
};

export default App;
