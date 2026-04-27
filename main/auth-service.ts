import { DatabaseAdapter } from './database-manager';

export interface AuthSession {
  userId: number;
  personnelNumber: string;
  name: string;
  vorname: string;
  roleId: number | null;
  roleName?: string;
  permissions: Record<string, 'none' | 'read' | 'read_all' | 'write'>;
  assignedDepartment: string | 'all';
}

export class AuthService {
  private currentSession: AuthSession | null = null;
  private getDefaultPermissions(): Record<string, 'none' | 'read' | 'read_all' | 'write'> {
    return {
      einteilung: 'none',
      dienstplan: 'none',
      werte: 'none',
      personal: 'none',
      fahrzeuge: 'none',
      einstellungen: 'none',
      kommentar_global: 'none',
      kommentar_individuell: 'none'
    };
  }

  private async resolveRoleInfo(roleId: number | null | undefined): Promise<{ permissions: Record<string, 'none' | 'read' | 'read_all' | 'write'>, name?: string }> {
    const permissions = this.getDefaultPermissions();
    if (!roleId) return { permissions };

    const rolesData = await this.dbAdapter.getSetting('roles');
    if (!rolesData) return { permissions };

    try {
      const roles = JSON.parse(rolesData);
      const role = roles.find((r: any) => r.id === roleId);
      if (role) {
        return { 
          permissions: { ...permissions, ...(role.permissions || {}) },
          name: role.name
        };
      }
    } catch (e) {
      console.error('[AuthService] Error parsing roles:', e);
    }

    return { permissions };
  }

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

      const { permissions, name: roleName } = await this.resolveRoleInfo(person.roleId || null);
      
      let assignedDepartment: string | 'all' = '1. Abteilung';
      if (roleName?.toLowerCase() === 'administrator') {
        assignedDepartment = 'all';
      } else {
        const dept = await this.dbAdapter.getCurrentDepartmentForPerson(person.id);
        if (dept) assignedDepartment = dept;
      }

      this.currentSession = {
        userId: person.id,
        personnelNumber: person.personnelNumber || '',
        name: person.name,
        vorname: person.vorname,
        roleId: person.roleId || null,
        roleName,
        permissions,
        assignedDepartment
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

  async refreshCurrentSession(): Promise<AuthSession | null> {
    if (!this.currentSession) return null;

    try {
      const allPersonnel = await this.dbAdapter.getPersonnel(true);
      const person = (allPersonnel || []).find((p: any) => Number(p?.id) === Number(this.currentSession?.userId));

      if (!person) {
        this.currentSession = null;
        return null;
      }

      const { permissions, name: roleName } = await this.resolveRoleInfo(person.roleId || null);
      
      let assignedDepartment: string | 'all' = 'Rettungsdienst';
      if (roleName?.toLowerCase() === 'administrator') {
        assignedDepartment = 'all';
      } else {
        const dept = await this.dbAdapter.getCurrentDepartmentForPerson(person.id);
        if (dept) assignedDepartment = dept;
      }

      this.currentSession = {
        userId: person.id,
        personnelNumber: person.personnelNumber || '',
        name: person.name,
        vorname: person.vorname,
        roleId: person.roleId || null,
        roleName,
        permissions,
        assignedDepartment
      };

      return this.currentSession;
    } catch (error) {
      console.error('[AuthService] refreshCurrentSession failed:', error);
      return this.currentSession;
    }
  }

  checkPermission(area: string, requiredLevel: 'read' | 'write'): boolean {
    if (!this.currentSession) return false;
    
    const userLevel = this.currentSession.permissions[area] || 'none';
    
    if (userLevel === 'none') return false;
    if (requiredLevel === 'read') return userLevel === 'read' || userLevel === 'read_all' || userLevel === 'write';
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
