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

  private getPermissionsFromRoleRow(role: any): Record<string, 'none' | 'read' | 'read_all' | 'write'> {
    const canViewReports = role.canViewReports === 1 || role.canViewReports === true;
    const canExportData = role.canExportData === 1 || role.canExportData === true;
    let werte: 'none' | 'read' | 'read_all' | 'write' = 'none';
    if (canExportData) werte = 'read_all';
    else if (canViewReports) werte = 'read';

    let einteilung: 'none' | 'read' | 'write' = 'none';
    if (role.canEditRoster === 1 || role.canEditRoster === true) einteilung = 'write';
    else if (role.canViewRoster === 1 || role.canViewRoster === true) einteilung = 'read';

    let dienstplan: 'none' | 'read' | 'read_all' | 'write' = 'none';
    if (role.canEditDienstplan === 1 || role.canEditDienstplan === true) dienstplan = 'write';
    else if (role.canViewDienstplanAll === 1 || role.canViewDienstplanAll === true) dienstplan = 'read_all';
    else if (role.canViewDienstplan === 1 || role.canViewDienstplan === true) dienstplan = 'read';

    return {
      einteilung,
      dienstplan,
      werte,
      personal: role.canEditPersonnel ? 'write' : 'none',
      fahrzeuge: role.canEditVehicles ? 'write' : 'none',
      einstellungen: role.canEditSettings ? 'write' : 'none',
      kommentar_global: role.canEditGlobalComments ? 'write' : 'none',
      kommentar_individuell: role.canEditPersonalComments ? 'write' : 'none'
    };
  }

  private mergeLegacyRolePermissions(
    permissions: Record<string, 'none' | 'read' | 'read_all' | 'write'>,
    legacyPermissions: any
  ): Record<string, 'none' | 'read' | 'read_all' | 'write'> {
    const merged = { ...permissions };
    if (!legacyPermissions || typeof legacyPermissions !== 'object') return merged;
    for (const [key, val] of Object.entries(legacyPermissions)) {
      if (val === 'none' || val === 'read' || val === 'read_all' || val === 'write') {
        merged[key] = val;
      }
    }
    return merged;
  }

  private applyAdministratorGrants(
    permissions: Record<string, 'none' | 'read' | 'read_all' | 'write'>,
    roleName?: string,
    role?: any
  ): Record<string, 'none' | 'read' | 'read_all' | 'write'> {
    const isAdmin =
      roleName?.toLowerCase() === 'administrator' ||
      role?.canManageUsers === 1 ||
      role?.canManageUsers === true;
    if (!isAdmin) return permissions;

    const werte =
      permissions.werte === 'write' || permissions.werte === 'read_all'
        ? permissions.werte
        : 'read_all';

    return {
      ...permissions,
      werte,
      einstellungen: permissions.einstellungen === 'none' ? 'write' : permissions.einstellungen,
      personal: permissions.personal === 'none' ? 'write' : permissions.personal,
      fahrzeuge: permissions.fahrzeuge === 'none' ? 'write' : permissions.fahrzeuge,
      einteilung: permissions.einteilung === 'none' ? 'write' : permissions.einteilung,
      dienstplan: permissions.dienstplan === 'none' ? 'write' : permissions.dienstplan,
    };
  }

  private async resolveRoleInfo(roleId: number | null | undefined): Promise<{ permissions: Record<string, 'none' | 'read' | 'read_all' | 'write'>, name?: string }> {
    const permissions = this.getDefaultPermissions();
    if (!roleId) return { permissions };

    try {
      const roles = await this.dbAdapter.getRoles();
      if (Array.isArray(roles) && roles.length > 0) {
        const role = roles.find((r: any) => Number(r.id) === Number(roleId));
        if (role) {
          let rolePermissions = { ...permissions, ...this.getPermissionsFromRoleRow(role) };
          const rolesData = await this.dbAdapter.getSetting('roles');
          if (rolesData) {
            try {
              const legacyRoles = JSON.parse(rolesData);
              const legacyRole = Array.isArray(legacyRoles) ? legacyRoles.find((r: any) => Number(r.id) === Number(roleId)) : null;
              if (legacyRole) {
                rolePermissions = this.mergeLegacyRolePermissions(rolePermissions, legacyRole.permissions);
              }
            } catch (e) {
              console.error('[AuthService] Error parsing legacy roles:', e);
            }
          }

          return {
            permissions: this.applyAdministratorGrants(rolePermissions, role.name, role),
            name: role.name
          };
        }
      }
    } catch (e) {
      console.error('[AuthService] Error reading roles from table:', e);
    }

    const rolesData = await this.dbAdapter.getSetting('roles');
    if (!rolesData) return { permissions };

    try {
      const roles = JSON.parse(rolesData);
      const role = roles.find((r: any) => r.id === roleId);
      if (role) {
        const merged = this.mergeLegacyRolePermissions(
          { ...permissions, ...(role.permissions || {}) },
          role.permissions
        );
        return {
          permissions: this.applyAdministratorGrants(merged, role.name),
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
