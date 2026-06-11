import { supabase } from '@/lib/supabase';
import type { Permission, RolePermission, PermissionScope } from '@/types/rbac.types';

export interface EffectivePermission {
  permission_key: string;
  scope: PermissionScope;
  hierarchy_level: number;
}

export const permissionService = {
  /**
   * Fetches the entire permissions catalog.
   */
  async getPermissions(): Promise<Permission[]> {
    const { data, error } = await supabase
      .from('permissions')
      .select('*')
      .order('module', { ascending: true })
      .order('permission_key', { ascending: true });

    if (error) throw error;
    return data as Permission[];
  },

  /**
   * Fetches permissions currently linked to a specific role.
   */
  async getRolePermissions(roleId: string): Promise<RolePermission[]> {
    const { data, error } = await supabase
      .from('role_permissions')
      .select(`
        role_id,
        permission_id,
        scope,
        permission:permissions(*)
      `)
      .eq('role_id', roleId);

    if (error) throw error;
    return data as unknown as RolePermission[];
  },

  /**
   * Updates permission mappings and scopes for a role.
   */
  async updateRolePermissions(
    roleId: string,
    mappings: { permissionId: string; scope: PermissionScope }[]
  ): Promise<void> {
    // 1. Delete existing permissions for this role
    const { error: delError } = await supabase
      .from('role_permissions')
      .delete()
      .eq('role_id', roleId);

    if (delError) throw delError;

    if (mappings.length === 0) return;

    // 2. Insert new mappings
    const inserts = mappings.map(m => ({
      role_id: roleId,
      permission_id: m.permissionId,
      scope: m.scope
    }));

    const { error: insError } = await supabase
      .from('role_permissions')
      .insert(inserts);

    if (insError) throw insError;
  },

  /**
   * Resolves the list of effective permissions and scopes for a user.
   * Leverages roles hierarchy level to resolve the most permissive scope (ALL > TEAM > ASSIGNED > OWN).
   */
  async getUserEffectivePermissions(userId: string): Promise<EffectivePermission[]> {
    // First, check if the user is an admin.
    // If the user has 'admin' role, grant ALL scope for everything in the database.
    const { data: userRoles, error: urErr } = await supabase
      .from('user_roles')
      .select('role:roles(*)')
      .eq('user_id', userId);

    if (urErr) throw urErr;

    const rolesList = (userRoles || []).map(ur => ur.role).filter(Boolean) as any[];
    const isAdmin = rolesList.some(r => r.role_key === 'admin' && r.is_active);

    if (isAdmin) {
      const allPerms = await this.getPermissions();
      return allPerms.map(p => ({
        permission_key: p.permission_key,
        scope: 'ALL',
        hierarchy_level: 10
      }));
    }

    // Otherwise, fetch active roles permissions mapping
    const activeRoleIds = rolesList.filter(r => r.is_active).map(r => r.id);
    if (activeRoleIds.length === 0) {
      return [];
    }

    const { data: mappings, error: mapErr } = await supabase
      .from('role_permissions')
      .select(`
        scope,
        role:roles(hierarchy_level),
        permission:permissions(permission_key)
      `)
      .in('role_id', activeRoleIds);

    if (mapErr) throw mapErr;

    // Resolve scopes: ALL > TEAM > ASSIGNED > OWN
    const permMap: Record<string, { scope: PermissionScope; hierarchyLevel: number }> = {};
    const scopeOrder: Record<PermissionScope, number> = {
      ALL: 1,
      TEAM: 2,
      ASSIGNED: 3,
      OWN: 4
    };

    if (mappings) {
      for (const m of mappings) {
        const key = (m.permission as any)?.permission_key;
        const scope = m.scope as PermissionScope;
        const hierarchyLevel = (m.role as any)?.hierarchy_level ?? 100;
        if (!key) continue;

        const existing = permMap[key];
        if (!existing) {
          permMap[key] = { scope, hierarchyLevel };
        } else {
          // Keep the wider scope (lower scopeOrder value)
          const keepNewScope = scopeOrder[scope] < scopeOrder[existing.scope];
          if (keepNewScope) {
            permMap[key] = {
              scope,
              hierarchyLevel: Math.min(hierarchyLevel, existing.hierarchyLevel)
            };
          } else if (scope === existing.scope) {
            permMap[key].hierarchyLevel = Math.min(hierarchyLevel, existing.hierarchyLevel);
          }
        }
      }
    }

    return Object.entries(permMap).map(([permission_key, val]) => ({
      permission_key,
      scope: val.scope,
      hierarchy_level: val.hierarchyLevel
    }));
  }
};

export default permissionService;
