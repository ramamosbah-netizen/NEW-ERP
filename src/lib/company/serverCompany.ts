// ============================================================
// AURA 0.2 — Server-side company resolution (Foundation · minimum-safe tenancy)
//
// Resolves the authoritative company_id for an operation SERVER-SIDE from the
// authenticated user's membership. The frontend can never spoof a company the
// user is not a member of: a requested/active company is honoured ONLY if the
// user actually belongs to it (or is admin); otherwise we fall back to the
// user's default membership.
//
// Uses the service-role client → SERVER ONLY. Never import from a client bundle.
// ============================================================

import supabaseAdmin from '@/lib/supabaseAdmin';

async function isAdmin(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('profiles').select('role').eq('id', userId).maybeSingle();
  return (data as { role?: string } | null)?.role === 'admin';
}

async function membership(userId: string): Promise<{ ids: string[]; defaultId: string | null }> {
  const { data } = await supabaseAdmin
    .from('company_members').select('company_id, is_default').eq('user_id', userId);
  const rows = (data ?? []) as { company_id: string; is_default: boolean }[];
  const def = rows.find(r => r.is_default)?.company_id ?? rows[0]?.company_id ?? null;
  return { ids: rows.map(r => r.company_id), defaultId: def };
}

/** True if a company id exists — guards intelligence against acting on a bogus company. */
export async function companyExists(companyId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('companies').select('id').eq('id', companyId).maybeSingle();
  return !!data;
}

/** True if the user may act within this company (member, or admin). */
export async function isCompanyAccessible(userId: string, companyId: string | null): Promise<boolean> {
  if (!companyId) return true; // company-less (system) artifacts are not company-gated
  if (await isAdmin(userId)) return true;
  const { ids } = await membership(userId);
  return ids.includes(companyId);
}

/**
 * Resolve the company_id for a user-initiated operation.
 * `requested` (the active company the client claims) is honoured ONLY if the
 * user is a member of it, or is an admin and it exists. Otherwise falls back to
 * the user's default membership. Returns null only when the user has no company.
 */
export async function resolveCompanyIdForUser(
  userId: string,
  requested?: string | null,
): Promise<string | null> {
  if (await isAdmin(userId)) {
    if (requested && (await companyExists(requested))) return requested;
    return (await membership(userId)).defaultId;
  }
  const { ids, defaultId } = await membership(userId);
  if (requested && ids.includes(requested)) return requested;
  return defaultId;
}
