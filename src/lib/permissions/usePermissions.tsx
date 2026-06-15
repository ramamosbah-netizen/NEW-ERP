'use client';

import React, { createContext, useContext, useEffect, useState, useTransition } from 'react';
import { supabase } from '@/lib/supabase';
import { permissionService, type EffectivePermission } from '@/services/permissionService';
import type { PermissionScope } from '@/types/rbac.types';

interface PermissionsContextType {
  permissions: EffectivePermission[];
  userId: string | null;
  userDepartment: string | null;
  role: string | null;
  loading: boolean;
  hasPermission: (
    permissionKey: string,
    recordCreatorId?: string | null,
    recordAssignedId?: string | null,
    recordCreatorDept?: string | null
  ) => boolean;
  refresh: () => Promise<void>;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

export const PermissionsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [permissions, setPermissions] = useState<EffectivePermission[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [userDepartment, setUserDepartment] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [, startTransition] = useTransition();

  const loadPermissions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setPermissions([]);
        setUserId(null);
        setUserDepartment(null);
        setRole(null);
        setLoading(false);
        return;
      }

      setUserId(user.id);

      // Load the user's role (for route-level access control)
      try {
        const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
        setRole(prof?.role || null);
      } catch { /* role optional */ }

      // Load effective permissions
      const effective = await permissionService.getUserEffectivePermissions(user.id);
      
      // Load user's department if exists in employees
      const { data: emp, error: empErr } = await supabase
        .from('employees')
        .select('department')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (!empErr && emp) {
        setUserDepartment(emp.department);
      }

      setPermissions(effective);
    } catch (err) {
      console.error('Failed to load user permissions context:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // PWA Service Worker Registration
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then(reg => console.log('PWA Service Worker registered:', reg.scope))
          .catch(err => console.error('Service Worker registration failed:', err));
      });
    }

    loadPermissions();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        startTransition(() => {
          loadPermissions();
        });
      } else if (event === 'SIGNED_OUT') {
        setPermissions([]);
        setUserId(null);
        setUserDepartment(null);
        setRole(null);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const hasPermission = (
    permissionKey: string,
    recordCreatorId?: string | null,
    recordAssignedId?: string | null,
    recordCreatorDept?: string | null
  ): boolean => {
    // 1. If admin role exists in list, hierarchy <= 10, bypass
    const hasAdminBypass = permissions.some(p => p.permission_key === permissionKey && p.hierarchy_level <= 10);
    if (hasAdminBypass) return true;

    // 2. Find specific permission key
    const match = permissions.find(p => p.permission_key === permissionKey);
    if (!match) return false;

    const { scope } = match;

    // 3. Evaluate scope
    if (scope === 'ALL') {
      return true;
    }
    
    if (scope === 'OWN' && recordCreatorId && userId) {
      return recordCreatorId === userId;
    }
    
    if (scope === 'ASSIGNED' && recordAssignedId && userId) {
      return recordAssignedId === userId;
    }
    
    if (scope === 'TEAM') {
      if (recordCreatorDept && userDepartment) {
        return recordCreatorDept === userDepartment;
      }
      // If we only have recordCreatorId, we could check if it is the user themselves
      if (recordCreatorId && userId && recordCreatorId === userId) {
        return true;
      }
    }

    return false;
  };

  const refresh = async () => {
    setLoading(true);
    await loadPermissions();
  };

  return (
    <PermissionsContext.Provider value={{ permissions, userId, userDepartment, role, loading, hasPermission, refresh }}>
      {children}
    </PermissionsContext.Provider>
  );
};

export const usePermissions = () => {
  const context = useContext(PermissionsContext);
  if (context === undefined) {
    throw new Error('usePermissions must be used within a PermissionsProvider');
  }
  return context;
};
