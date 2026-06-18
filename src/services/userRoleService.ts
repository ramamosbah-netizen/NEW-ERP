import { supabase } from '@/lib/supabase';
import { recordAudit } from '@/lib/audit/recordAudit';
import type { Role, UserRole } from '@/types/rbac.types';

export interface UserWithRoles {
  id: string;
  full_name: string;
  email: string;
  role: string; // legacy primary role
  roles: Role[]; // dynamic roles list
  updated_at: string;
}

export const userRoleService = {
  /**
   * Fetches all registered roles.
   */
  async getRoles(): Promise<Role[]> {
    const { data, error } = await supabase
      .from('roles')
      .select('*')
      .order('hierarchy_level', { ascending: true });

    if (error) throw error;
    return data as Role[];
  },

  /**
   * Fetches all users along with their active dynamically assigned roles.
   */
  async getUsers(): Promise<UserWithRoles[]> {
    const { data: profiles, error: pError } = await supabase
      .from('profiles')
      .select('*')
      .order('full_name', { ascending: true });

    if (pError) throw pError;

    const { data: userRoles, error: urError } = await supabase
      .from('user_roles')
      .select(`
        user_id,
        role:roles(*)
      `);

    if (urError) throw urError;

    // Group user roles by user_id
    const rolesMap: Record<string, Role[]> = {};
    if (userRoles) {
      for (const ur of userRoles) {
        if (!ur.user_id || !ur.role) continue;
        const roleObj = ur.role as unknown as Role;
        if (!rolesMap[ur.user_id]) {
          rolesMap[ur.user_id] = [];
        }
        rolesMap[ur.user_id].push(roleObj);
      }
    }

    return (profiles || []).map(p => ({
      id: p.id,
      full_name: p.full_name,
      email: p.email,
      role: p.role,
      roles: rolesMap[p.id] || [],
      updated_at: p.updated_at || ''
    }));
  },

  /**
   * Gets specific user's assigned roles.
   */
  async getUserRoles(userId: string): Promise<Role[]> {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role:roles(*)')
      .eq('user_id', userId);

    if (error) throw error;
    return (data || []).map(d => d.role) as unknown as Role[];
  },

  /**
   * Assigns multiple roles to a user, replacing existing assignments.
   * Also keeps the legacy profiles.role field updated for backwards compatibility.
   */
  async updateUserRoles(userId: string, roleIds: string[]): Promise<void> {
    const { data: { user: currentUser } } = await supabase.auth.getUser();

    // 1. Delete all current role associations for the target user
    const { error: delError } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId);

    if (delError) throw delError;

    if (roleIds.length === 0) {
      // Clear legacy role
      await supabase
        .from('profiles')
        .update({ role: 'engineer', updated_at: new Date().toISOString() })
        .eq('id', userId);
      return;
    }

    // 2. Insert new role mappings
    const inserts = roleIds.map(roleId => ({
      user_id: userId,
      role_id: roleId,
      assigned_by: currentUser?.id || null,
      assigned_at: new Date().toISOString()
    }));

    const { error: insError } = await supabase
      .from('user_roles')
      .insert(inserts);

    if (insError) throw insError;

    // 3. Resolve roles details to update legacy profile role column
    const { data: loadedRoles, error: rolesError } = await supabase
      .from('roles')
      .select('*')
      .in('id', roleIds);

    if (rolesError) throw rolesError;

    // Determine the highest priority role (lowest hierarchy_level)
    let highestRole = loadedRoles[0];
    for (const r of loadedRoles) {
      if (r.hierarchy_level < highestRole.hierarchy_level) {
        highestRole = r;
      }
    }

    // Map the highest role key back to legacy profiles schema role options:
    // 'admin' | 'manager' | 'account' | 'engineer' | 'storekeeper'
    let legacyRole = 'engineer';
    if (highestRole) {
      const key = highestRole.role_key;
      if (key === 'admin') legacyRole = 'admin';
      else if (key === 'pm' || key === 'gm' || key === 'commercial_mgr') legacyRole = 'manager';
      else if (key === 'accountant') legacyRole = 'account';
      else if (key === 'storekeeper') legacyRole = 'storekeeper';
      else legacyRole = 'engineer';
    }

    const { error: profError } = await supabase
      .from('profiles')
      .update({
        role: legacyRole,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (profError) throw profError;
  },

  /**
   * Toggles role activation status.
   */
  async toggleRoleStatus(roleId: string, isActive: boolean): Promise<Role> {
    const { data, error } = await supabase
      .from('roles')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', roleId)
      .select()
      .single();

    if (error) throw error;
    await recordAudit({
      action: 'UPDATE', entity_type: 'ROLE', entity_id: roleId, entity_label: data.name,
      summary: `Role '${data.name}' ${isActive ? 'activated' : 'deactivated'}`, module: 'SYSTEM',
    });
    return data as Role;
  },

  /**
   * Creates a new custom role. role_key is normalised (lowercase, a-z0-9_).
   */
  async createRole(input: { role_key: string; name: string; description?: string; hierarchy_level?: number }): Promise<Role> {
    const role_key = (input.role_key || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
    if (!role_key) throw new Error('A valid role key is required (letters, numbers, underscore).');
    if (!input.name?.trim()) throw new Error('Role name is required.');

    const { data: existing } = await supabase.from('roles').select('id').eq('role_key', role_key).maybeSingle();
    if (existing) throw new Error(`A role with key '${role_key}' already exists.`);

    const { data, error } = await supabase
      .from('roles')
      .insert({
        role_key,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        hierarchy_level: Number.isFinite(input.hierarchy_level) ? input.hierarchy_level : 100,
        is_system: false,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;
    await recordAudit({
      action: 'CREATE', entity_type: 'ROLE', entity_id: data.id, entity_label: data.name,
      summary: `Created role '${data.name}' (${data.role_key}) at hierarchy L${data.hierarchy_level}`,
      after: data, module: 'SYSTEM',
    });
    return data as Role;
  },

  /**
   * Updates an editable role's name / description / hierarchy (role_key is immutable).
   */
  async updateRole(id: string, patch: { name?: string; description?: string | null; hierarchy_level?: number }): Promise<Role> {
    const { data: before, error: bErr } = await supabase.from('roles').select('*').eq('id', id).single();
    if (bErr) throw bErr;

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.name !== undefined) {
      if (!patch.name.trim()) throw new Error('Role name cannot be empty.');
      update.name = patch.name.trim();
    }
    if (patch.description !== undefined) update.description = patch.description?.trim() || null;
    if (patch.hierarchy_level !== undefined && Number.isFinite(patch.hierarchy_level)) update.hierarchy_level = patch.hierarchy_level;

    const { data, error } = await supabase.from('roles').update(update).eq('id', id).select().single();
    if (error) throw error;
    await recordAudit({
      action: 'UPDATE', entity_type: 'ROLE', entity_id: id, entity_label: data.name,
      summary: `Updated role '${data.name}'`, before, after: data, module: 'SYSTEM',
    });
    return data as Role;
  },

  /**
   * Deletes a custom role. Blocks system roles and roles still assigned to users.
   * (role_permissions cascade-delete with the role.)
   */
  async deleteRole(id: string): Promise<void> {
    const { data: role, error: rErr } = await supabase.from('roles').select('*').eq('id', id).single();
    if (rErr) throw rErr;
    if (role.is_system) throw new Error('System roles cannot be deleted — deactivate it instead.');

    const { count } = await supabase.from('user_roles').select('*', { count: 'exact', head: true }).eq('role_id', id);
    if ((count ?? 0) > 0) {
      throw new Error(`Cannot delete: ${count} user(s) still hold this role. Reassign them first.`);
    }

    const { error } = await supabase.from('roles').delete().eq('id', id);
    if (error) throw error;
    await recordAudit({
      action: 'DELETE', entity_type: 'ROLE', entity_id: id, entity_label: role.name,
      summary: `Deleted role '${role.name}' (${role.role_key})`, before: role, module: 'SYSTEM',
    });
  },
};

export default userRoleService;
