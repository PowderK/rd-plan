import { DatabaseAdapter } from './database-manager';

export interface AuthSession {
  userId: number;
  personnelNumber: string;
  name: string;
  vorname: string;
  roleId: number | null;
  permissions: Record<string, 'none' | 'read' | 'read_all' | 'write'>;
}

export class AuthService {
  private currentSession: AuthSession | null = null;
  private normalizePersonnelNumber(value: unknown): string {
    if (value === null || value === undefined) return '';
    return String(value).toLowerCase().trim();
  }
  
  constructor(private dbAdapter: DatabaseAdapter) {}

  async login(personnelNumber: string): Promise<{ success: boolean; error?: string; session?: AuthSession }> {
    try {
      // Finde Person mit dieser Personalnummer (case-insensitive)
      const allPersonnel = await this.dbAdapter.getPersonnel();
      const inputNumber = this.normalizePersonnelNumber(personnelNumber);
      if (!inputNumber) {
        return { success: false, error: 'Bitte eine gültige Personalnummer eingeben' };
      }
      const person = allPersonnel.find((p: any) => this.normalizePersonnelNumber(p?.personnelNumber) === inputNumber);
      
      if (!person) {
        return { success: false, error: 'Personalnummer nicht gefunden' };
      }

      // Lade Rollen-Permissions
      let permissions: Record<string, 'none' | 'read' | 'read_all' | 'write'> = {
        einteilung: 'none',
        dienstplan: 'none',
        werte: 'none',
        personal: 'none',
        fahrzeuge: 'none',
        einstellungen: 'none',
        kommentar_global: 'none',
        kommentar_individuell: 'none'
      };

      if (person.roleId) {
        const rolesData = await this.dbAdapter.getSetting('roles');
        if (rolesData) {
          try {
            const roles = JSON.parse(rolesData);
            const role = roles.find((r: any) => r.id === person.roleId);
            if (role && role.permissions) {
              permissions = { ...permissions, ...role.permissions };
            }
          } catch (e) {
            console.error('[AuthService] Error parsing roles:', e);
          }
        }
      }

      this.currentSession = {
        userId: person.id,
        personnelNumber: person.personnelNumber || '',
        name: person.name,
        vorname: person.vorname,
        roleId: person.roleId || null,
        permissions
      };

      return { success: true, session: this.currentSession };
    } catch (error: any) {
      return { success: false, error: error.message || 'Login fehlgeschlagen' };
    }
  }

  logout() {
    this.currentSession = null;
  }

  getCurrentUser(): AuthSession | null {
    return this.currentSession;
  }

  checkPermission(area: string, requiredLevel: 'read' | 'write'): boolean {
    if (!this.currentSession) return false;
    
    const userLevel = this.currentSession.permissions[area] || 'none';
    
    if (userLevel === 'none') return false;
    if (requiredLevel === 'read') return userLevel === 'read' || userLevel === 'write';
    if (requiredLevel === 'write') return userLevel === 'write';
    
    return false;
  }

  requirePermission(area: string, requiredLevel: 'read' | 'write'): void {
    if (!this.checkPermission(area, requiredLevel)) {
      throw new Error(`PERMISSION_DENIED: Keine Berechtigung für ${area} (${requiredLevel})`);
    }
  }
}

let authServiceInstance: AuthService | null = null;

export function initializeAuthService(dbAdapter: DatabaseAdapter): AuthService {
  authServiceInstance = new AuthService(dbAdapter);
  return authServiceInstance;
}

export function getAuthService(): AuthService {
  if (!authServiceInstance) {
    throw new Error('AuthService not initialized');
  }
  return authServiceInstance;
}
