// ============================================================
// AURA 0.2 — Intelligence data-access service (server-side, READ-ONLY)
// Raw reads of intel_recommendation / intel_insight + an alert→company lookup.
// Risk-alert board reads/queries live in risk-query.ts; state transitions in
// risk-contract.ts. (listRecommendations/listInsights are unwired pending their UI.)
// ============================================================

import supabaseAdmin from '@/lib/supabaseAdmin';
import type { RecommendationRow, InsightRow } from '@/types/intelligence.types';

interface ListOpts {
  companyId?: string | null;
  status?: string;
  limit?: number;
}

export async function listRecommendations(opts: ListOpts = {}): Promise<RecommendationRow[]> {
  let q = supabaseAdmin.from('intel_recommendation').select('*');
  if (opts.companyId) q = q.eq('company_id', opts.companyId);
  if (opts.status) q = q.eq('status', opts.status);
  const { data, error } = await q.order('created_at', { ascending: false }).limit(opts.limit ?? 100);
  if (error) throw new Error(error.message);
  return (data ?? []) as RecommendationRow[];
}

export async function listInsights(opts: ListOpts = {}): Promise<InsightRow[]> {
  let q = supabaseAdmin.from('intel_insight').select('*');
  if (opts.companyId) q = q.eq('company_id', opts.companyId);
  const { data, error } = await q.order('created_at', { ascending: false }).limit(opts.limit ?? 100);
  if (error) throw new Error(error.message);
  return (data ?? []) as InsightRow[];
}

// Risk-board projection (counts, grouping, filtered views) now lives in
// risk-query.ts (the read projection layer); this file is raw access only.

// ---- Alert company lookup (read — for company-isolation checks at the API) --
// Alert-state transitions now live in risk-contract.ts (the enforcement boundary)
// + risk-alert-store.ts (persistence). This service is read-only again.

/** Resolve the alert's owning company without transitioning (for access checks). */
export async function alertCompany(alertId: string): Promise<string | null | undefined> {
  const { data } = await supabaseAdmin
    .from('intel_risk_alert').select('company_id').eq('id', alertId).maybeSingle();
  return data ? (data as { company_id: string | null }).company_id : undefined;
}
