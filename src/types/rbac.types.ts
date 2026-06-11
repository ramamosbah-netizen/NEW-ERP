export type PermissionScope = 'ALL' | 'OWN' | 'ASSIGNED' | 'TEAM';

export interface Role {
  id: string;
  role_key: string;
  name: string;
  description: string | null;
  hierarchy_level: number;
  is_system: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Permission {
  id: string;
  permission_key: string;
  module: string;
  description: string | null;
  created_at: string;
}

export interface RolePermission {
  role_id: string;
  permission_id: string;
  scope: PermissionScope;
  role?: Role;
  permission?: Permission;
}

export interface UserRole {
  user_id: string;
  role_id: string;
  assigned_by: string | null;
  assigned_at: string;
  role?: Role;
}

export interface UserPermission {
  permission_key: string;
  scope: PermissionScope;
}
