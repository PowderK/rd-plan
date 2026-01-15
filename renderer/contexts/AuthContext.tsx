import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface AuthUser {
  userId: number;
  personnelNumber: string;
  name: string;
  vorname: string;
  roleId: number | null;
  permissions: Record<string, 'none' | 'read' | 'write'>;
}

interface AuthContextType {
  currentUser: AuthUser | null;
  isDevMode: boolean;
  isAuthenticated: boolean;
  login: (personnelNumber: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  hasPermission: (area: string, level: 'read' | 'write') => boolean;
  requirePermission: (area: string, level: 'read' | 'write') => boolean;
  showToast: (message: string, type: 'error' | 'success' | 'info') => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isDevMode, setIsDevMode] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [toasts, setToasts] = useState<Array<{ id: number; message: string; type: string }>>([]);

  useEffect(() => {
    // Check Dev-Mode
    (window as any).api.authIsDevMode().then((devMode: boolean) => {
      console.log('[AuthContext] Dev-Mode:', devMode);
      setIsDevMode(devMode);
      
      // Auto-Login im Dev-Mode mit vollen Admin-Rechten
      if (devMode) {
        console.log('[AuthContext] Dev-Mode aktiv - Auto-Login');
        setCurrentUser({
          userId: -1,
          personnelNumber: 'dev',
          name: 'Developer',
          vorname: 'Mode',
          roleId: null,
          permissions: {
            einteilung: 'write',
            dienstplan: 'write',
            werte: 'write',
            personal: 'write',
            fahrzeuge: 'write',
            einstellungen: 'write'
          }
        });
        setIsAuthenticated(true);
      } else {
        // Check ob User bereits eingeloggt ist (z.B. nach Reload)
        (window as any).api.authGetCurrentUser().then((user: AuthUser | null) => {
          console.log('[AuthContext] Aktueller User:', user);
          if (user) {
            setCurrentUser(user);
            setIsAuthenticated(true);
          }
        }).catch((error: any) => {
          console.error('[AuthContext] Fehler beim Laden des Users:', error);
        });
      }
    }).catch((error: any) => {
      console.error('[AuthContext] Fehler beim Prüfen des Dev-Mode:', error);
    });
  }, []);

  const login = async (personnelNumber: string): Promise<{ success: boolean; error?: string }> => {
    try {
      console.log('[AuthContext] Login-Versuch mit Personalnummer:', personnelNumber);
      const result = await (window as any).api.authLogin(personnelNumber);
      console.log('[AuthContext] Login-Resultat:', result);
      
      if (result.success && result.session) {
        console.log('[AuthContext] Login erfolgreich, setze User:', result.session);
        setCurrentUser(result.session);
        setIsAuthenticated(true);
        return { success: true };
      } else {
        console.error('[AuthContext] Login fehlgeschlagen:', result.error);
        return { success: false, error: result.error || 'Login fehlgeschlagen' };
      }
    } catch (error: any) {
      console.error('[AuthContext] Login Exception:', error);
      return { success: false, error: error.message || 'Login fehlgeschlagen' };
    }
  };

  const logout = async () => {
    await (window as any).api.authLogout();
    setCurrentUser(null);
    setIsAuthenticated(false);
  };

  const hasPermission = (area: string, level: 'read' | 'write'): boolean => {
    if (!currentUser) return false;
    
    const userLevel = currentUser.permissions[area] || 'none';
    
    if (userLevel === 'none') return false;
    if (level === 'read') return userLevel === 'read' || userLevel === 'write';
    if (level === 'write') return userLevel === 'write';
    
    return false;
  };

  const requirePermission = (area: string, level: 'read' | 'write'): boolean => {
    const has = hasPermission(area, level);
    if (!has) {
      showToast(`Keine Berechtigung für ${area} (${level === 'read' ? 'Lesen' : 'Schreiben'})`, 'error');
    }
    return has;
  };

  const showToast = (message: string, type: 'error' | 'success' | 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    
    // Auto-remove nach 4 Sekunden
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  return (
    <AuthContext.Provider value={{ 
      currentUser, 
      isDevMode, 
      isAuthenticated, 
      login, 
      logout, 
      hasPermission, 
      requirePermission,
      showToast
    }}>
      {children}
      
      {/* Toast Container */}
      <div style={{
        position: 'fixed',
        top: 20,
        right: 20,
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        pointerEvents: 'none'
      }}>
        {toasts.map(toast => (
          <div
            key={toast.id}
            style={{
              background: toast.type === 'error' ? '#dc3545' : toast.type === 'success' ? '#28a745' : '#007bff',
              color: 'white',
              padding: '12px 20px',
              borderRadius: '6px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              fontSize: '14px',
              fontWeight: '500',
              minWidth: '250px',
              maxWidth: '400px',
              pointerEvents: 'auto',
              animation: 'slideIn 0.3s ease-out'
            }}
          >
            {toast.message}
          </div>
        ))}
      </div>
      
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </AuthContext.Provider>
  );
}
