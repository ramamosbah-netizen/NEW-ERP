// ============================================================
// JEET ERP — Route-level access control (allowlist for restricted roles)
//
// Only roles listed in ROLE_ALLOWLIST are restricted; every other role
// (admin, manager, engineer, …) is UNRESTRICTED — behaves exactly as
// before, so legacy users are never locked out. Admin is always allowed.
//
// Restricted roles ALWAYS keep the personal workspace (My Day, Tasks,
// Meetings, Alerts, Approvals, Calendar) — those pages already scope to
// the signed-in user. On top of that they get the module prefixes for
// their function. Configure finer, permission-driven access in
// Admin → Users, Roles & Permissions; this is the hard route fence.
// ============================================================

// Personal productivity surface — available to EVERY role.
const WORKSPACE_ROUTES = [
  '/', '/dashboard', '/profile', '/myday', '/tasks', '/meetings',
  '/notifications', '/workspace',
];

// role (lowercased) → allowed module route prefixes (workspace added automatically)
const ROLE_ALLOWLIST: Record<string, string[]> = {
  accountant: ['/finance', '/documents', '/assets', '/reports'],
  account: ['/finance', '/documents', '/assets', '/reports'], // legacy key
  'procurement officer': ['/procurement', '/warehouse', '/pricing'],
  'procurement': ['/procurement', '/warehouse', '/pricing'],
  storekeeper: ['/warehouse', '/pricing'],
  'hr manager': ['/hr', '/payroll', '/timesheets'],
  hr: ['/hr', '/payroll', '/timesheets'],
  'service coordinator': ['/service', '/service-desk', '/ppm', '/amc'],
  estimator: ['/tenders', '/quotations', '/sales', '/pricing'],
  'fleet coordinator': ['/fleet', '/vehicles'],
  'site engineer': ['/projects', '/tc', '/snags', '/handover', '/vo'],
  'field technician': ['/service-desk', '/ppm'],
};

function effectiveAllowlist(roleLower: string): string[] | null {
  const base = ROLE_ALLOWLIST[roleLower];
  if (!base) return null; // unrestricted role
  return [...base, ...WORKSPACE_ROUTES];
}

export function isRoleRestricted(role: string | null | undefined): boolean {
  if (!role) return false;
  if (role.toLowerCase() === 'admin') return false;
  return !!ROLE_ALLOWLIST[role.toLowerCase()];
}

export function isRouteAllowed(role: string | null | undefined, pathname: string): boolean {
  if (!role || role.toLowerCase() === 'admin') return true;
  const allow = effectiveAllowlist(role.toLowerCase());
  if (!allow) return true; // unrestricted role
  return allow.some(prefix => pathname === prefix || pathname.startsWith(prefix + '/'));
}
