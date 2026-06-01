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
import ItwPage from './components/ItwPage';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './login';
import './global-layout.css';

const monthNames = [
    'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
];

const AppContent: React.FC = () => {
    const { isAuthenticated, login, isDevMode, currentUser } = useAuth();
    const [currentMonth] = useState<number>(new Date().getMonth());
    const [rescueStation, setRescueStation] = useState<string>('');
    const [departmentName, setDepartmentName] = useState<string>('Rettungsdienst');
    const [year, setYear] = useState<number>(new Date().getFullYear());
    const [activeView, setActiveView] = useState<'einteilung'|'dienstplan'|'werte'|'personal'|'fahrzeuge'|'einstellungen'|'itw'>('einteilung');
    const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
    const [footerActions, setFooterActions] = useState<React.ReactNode>(null);

    async function loadHeaderInfo() {
        try {
            const rs = await (window as any).api.getSetting('rescueStation');
            if (rs != null) setRescueStation(String(rs));
        } catch {}
        try {
            if (currentUser?.assignedDepartment && currentUser.assignedDepartment !== 'all') {
                setDepartmentName(currentUser.assignedDepartment);
            } else {
                // Admin mode or "all" access
                const adminDept = await (window as any).api.getSetting('admin_selected_department');
                if (adminDept) {
                    setDepartmentName(String(adminDept));
                } else {
                    const currentDepts = await (window as any).api.getUniqueDepartments?.();
                    if (Array.isArray(currentDepts) && currentDepts.length > 0) {
                        setDepartmentName(currentDepts[0]);
                        await (window as any).api.setSetting('admin_selected_department', currentDepts[0]);
                    } else {
                        setDepartmentName('1. Abteilung');
                    }
                }
            }
        } catch {}
        // Jahr wird nicht mehr aus Settings geladen - wird von DutyRoster/Values gesteuert
        // Setze initial auf aktuelles Jahr oder bereits gesetztes window.rdPlanYear
        if ((window as any).rdPlanYear) {
            setYear((window as any).rdPlanYear);
        }
    }

    useEffect(() => {
        if (isAuthenticated) {
            setActiveView('einteilung');
            loadHeaderInfo();
            
            // Reagiere auf Jahr-Änderungen von DutyRoster/Values
            const handleYearChange = (e: any) => {
                if (e.detail?.year) {
                    setYear(e.detail.year);
                }
            };
            window.addEventListener('rdplan-year-changed', handleYearChange);

            // Reagiere auf Abteilungs-Änderungen
            const handleDepartmentChange = (e: any) => {
                if (e.detail?.department) {
                    setDepartmentName(e.detail.department);
                }
            };
            window.addEventListener('rdplan-department-changed', handleDepartmentChange);
            
            return () => {
                window.removeEventListener('rdplan-year-changed', handleYearChange);
                window.removeEventListener('rdplan-department-changed', handleDepartmentChange);
            };
        }
    }, [isAuthenticated, currentUser]);

    useEffect(() => {
        if (!isAuthenticated) return;
        const handler = async () => {
            try { await loadHeaderInfo(); } catch {}
        };
        (window as any).api?.onSettingsUpdated?.(handler);
        window.addEventListener('settings-updated', handler);
        return () => {
            (window as any).api?.offSettingsUpdated?.(handler);
            window.removeEventListener('settings-updated', handler);
        };
    }, [isAuthenticated]);

    useEffect(() => {
      if (!isAuthenticated) return;
      
      const handler = (e: Event) => {
        const ce = e as CustomEvent;
        const view = (ce.detail?.view || '') as string;
                if (['einteilung','dienstplan','werte','personal','fahrzeuge','einstellungen','itw'].includes(view)) {
          setActiveView(view as any);
        }
      };
      window.addEventListener('navigate', handler as EventListener);
                    (window as any).api?.onNavigate?.((v: any) => {
                        if (typeof v === 'string' && ['einteilung','dienstplan','werte','personal','fahrzeuge','einstellungen','itw'].includes(v)) setActiveView(v as any);
                        else if (v && typeof v.view === 'string' && ['einteilung','dienstplan','werte','personal','fahrzeuge','einstellungen','itw'].includes(v.view)) setActiveView(v.view as any);
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
                                    return <EinteilungPage departmentName={departmentName} />;
                case 'dienstplan':
                    return <DutyRoster departmentName={departmentName} />;
                case 'werte':
                    return <ValuesPage departmentName={departmentName} />;
                case 'personal':
                    return <PersonnelOverview setFooterActions={setFooterActions} departmentName={departmentName} />;
                case 'fahrzeuge':
                    return <Vehicles setFooterActions={setFooterActions} />;
                case 'einstellungen':
                                        return (
                                            <SettingsMenu
                                                onClose={() => setActiveView('dienstplan')}
                                                setFooterActions={setFooterActions}
                                                departmentName={departmentName}
                                            />
                                        );
                case 'itw':
                    return <ItwPage />;
                default:
                    return null;
            }
                }, [activeView, departmentName]);

                useEffect(() => {
                    if (activeView !== 'einstellungen' && activeView !== 'personal' && activeView !== 'fahrzeuge') setFooterActions(null);
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
            <div style={{ 
                display: 'grid', 
                gridTemplateColumns: `${sidebarCollapsed ? '56px' : '200px'} 1fr`, 
                gridTemplateRows: 'auto 1fr auto', 
                height: '100vh', 
                transition: 'grid-template-columns 0.15s',
                ['--sidebar-offset' as any]: sidebarCollapsed ? '56px' : '200px'
            }}>
                <div style={{ gridRow: 1, gridColumn: '1 / span 2' }}>
                    <Header 
                        rescueStation={rescueStation} 
                        department={departmentName} 
                        year={year} 
                    />
                </div>
                <div style={{ gridRow: '2 / span 2', gridColumn: 1 }}>
                    <Sidebar active={activeView} />
                </div>
                <main style={{ gridRow: 2, gridColumn: 2, overflow: 'auto' }}>
                    {content}
                </main>
                <div style={{ gridRow: 3, gridColumn: 2 }}>
                    <Footer actions={footerActions} />
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
