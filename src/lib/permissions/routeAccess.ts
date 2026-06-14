// ============================================================
// JEET ERP — Route-level access control (allowlist for restricted roles)
//
// Only roles listed here are restricted; every other role (admin,
// manager, engineer, …) is UNRESTRICTED — behaves exactly as before,
// so legacy users are never locked out. Admin is always allowed.
// Configure deeper, permission-driven access in Admin → Users, Roles
// & Permissions; this is the hard route fence for scoped roles.
// ============================================================

// role (lowercased) → allowed route prefixes
export const RESTRICTED_ROLE_ALLOWLIST: Record<string, string[]> = {
  accountant: ['/finance', '/documents', '/assets', '/reports', '/dashboard'],
  account: ['/finance', '/documents', '/assets', '/reports', '/dashboard'], // legacy key
};

// Always reachable regardless of role (home, own profile, etc.)
const ALWAYS_ALLOWED = ['/', '/dashboard', '/profile'];

export function isRoleRestricted(role: string | null | undefined): boolean {
  if (!role) return false;
  if (role.toLowerCase() === 'admin') return false;
  return !!RESTRICTED_ROLE_ALLOWLIST[role.toLowerCase()];
}

export function isRouteAllowed(role: string | null | undefined, pathname: string): boolean {
  if (!role || role.toLowerCase() === 'admin') return true;
  const allow = RESTRICTED_ROLE_ALLOWLIST[role.toLowerCase()];
  if (!allow) return true; // unrestricted role
  if (ALWAYS_ALLOWED.some(p => pathname === p)) return true;
  return allow.some(prefix => pathname === prefix || pathname.startsWith(prefix + '/'));
}
