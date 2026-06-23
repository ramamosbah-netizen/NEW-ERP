// ============================================================
// AURA 0.2 — Risk Read Projection Layer (risk-query.ts)
// A query compiler over Supabase for the Risk Board — the SINGLE read path for
// risk alerts. It SHAPES data (select / filter / sort / paginate / count); it
// never INTERPRETS it: severity/score/domain are read AS STORED by the engine —
// no recomputation, no rules, no state transitions, no UI decisions.
// ============================================================

import supabaseAdmin from '@/lib/supabaseAdmin';
import { listInsights, listRecommendations } from './intelligence-service';
import type { RiskAlertRow, RiskSeverity, RiskStatus, RecommendationRow, InsightRow } from '@/types/intelligence.types';

// ---- Row query primitive (DB-side: predicates + sort + pagination) ---------

export interface RiskQueryInput {
  companyId?: string | null;
  status?: RiskStatus | RiskStatus[];   // array → IN (lets the board express ACTIVE = OPEN+ACK)
  severity?: RiskSeverity;
  domain?: string;
  limit?: number;                        // default 100
  offset?: number;                       // default 0
  sort?: 'newest' | 'severity';          // default 'severity'
}

/** Fetch alerts with all filtering/sort/pagination pushed to Supabase. Pure selection. */
export async function getRiskAlerts(q: RiskQueryInput = {}): Promise<RiskAlertRow[]> {
  const limit = q.limit ?? 100;
  const offset = q.offset ?? 0;

  let query = supabaseAdmin.from('intel_risk_alert').select('*');
  if (q.companyId) query = query.eq('company_id', q.companyId);
  if (Array.isArray(q.status)) query = query.in('status', q.status);
  else if (q.status) query = query.eq('status', q.status);
  if (q.severity) query = query.eq('severity', q.severity);
  if (q.domain) query = query.eq('risk_domain', q.domain);

  query = q.sort === 'newest'
    ? query.order('created_at', { ascending: false })
    : query.order('score', { ascending: false }).order('created_at', { ascending: false });

  const { data, error } = await query.range(offset, offset + limit - 1);
  if (error) throw new Error(error.message);
  return (data ?? []) as RiskAlertRow[];
}

// ---- Aggregate counts (board KPI chips) ------------------------------------
// Lightweight column-only projection tallied in memory. Scale upgrade later:
// replace with a DB aggregate (RPC/view) if a company's alert volume grows large.

export interface RiskCounts {
  open: number; acknowledged: number; resolved: number; dismissed: number; total: number;
  bySeverity: Record<RiskSeverity, number>; // active (OPEN + ACKNOWLEDGED)
  byDomain: Record<string, number>;         // active (OPEN + ACKNOWLEDGED)
}

export async function getRiskCounts(companyId?: string | null): Promise<RiskCounts> {
  let q = supabaseAdmin.from('intel_risk_alert').select('status, severity, risk_domain');
  if (companyId) q = q.eq('company_id', companyId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { status: RiskStatus; severity: RiskSeverity; risk_domain: string }[];

  const bySeverity: Record<RiskSeverity, number> = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
  const byDomain: Record<string, number> = {};
  const c = { open: 0, acknowledged: 0, resolved: 0, dismissed: 0, total: rows.length };
  for (const r of rows) {
    if (r.status === 'OPEN') c.open++;
    else if (r.status === 'ACKNOWLEDGED') c.acknowledged++;
    else if (r.status === 'RESOLVED') c.resolved++;
    else if (r.status === 'DISMISSED') c.dismissed++;
    if (r.status === 'OPEN' || r.status === 'ACKNOWLEDGED') {
      bySeverity[r.severity] = (bySeverity[r.severity] ?? 0) + 1;
      byDomain[r.risk_domain] = (byDomain[r.risk_domain] ?? 0) + 1;
    }
  }
  return { ...c, bySeverity, byDomain };
}

// ---- Board composite (list + counts) ---------------------------------------

export type StatusFilter = RiskStatus | 'ACTIVE' | 'ALL';

export interface RiskBoardFilters {
  companyId?: string | null;
  status?: StatusFilter;
  severity?: RiskSeverity | null;
  domain?: string | null;
  sort?: 'newest' | 'severity';
  limit?: number;
  offset?: number;
}

export interface RiskBoardView {
  filters: { status: StatusFilter; severity: RiskSeverity | null; domain: string | null; sort: 'newest' | 'severity' };
  counts: { open: number; acknowledged: number; resolved: number; dismissed: number; total: number };
  bySeverity: Record<RiskSeverity, number>;
  byDomain: Record<string, number>;
  alerts: RiskAlertRow[];
  filteredCount: number;  // rows on this page
}

/** Thin composite: the filtered/paginated list (getRiskAlerts) + KPI counts (getRiskCounts). */
export async function getRiskBoard(filters: RiskBoardFilters = {}): Promise<RiskBoardView> {
  const status: StatusFilter = filters.status ?? 'ACTIVE';
  const severity = filters.severity ?? null;
  const domain = filters.domain ?? null;
  const sort = filters.sort ?? 'severity';

  const statusArg: RiskStatus | RiskStatus[] | undefined =
    status === 'ACTIVE' ? ['OPEN', 'ACKNOWLEDGED'] : status === 'ALL' ? undefined : status;

  const [alerts, counts] = await Promise.all([
    getRiskAlerts({
      companyId: filters.companyId,
      status: statusArg,
      severity: severity ?? undefined,
      domain: domain ?? undefined,
      sort,
      limit: filters.limit,
      offset: filters.offset,
    }),
    getRiskCounts(filters.companyId),
  ]);

  return {
    filters: { status, severity, domain, sort },
    counts: {
      open: counts.open, acknowledged: counts.acknowledged,
      resolved: counts.resolved, dismissed: counts.dismissed, total: counts.total,
    },
    bySeverity: counts.bySeverity,
    byDomain: counts.byDomain,
    alerts,
    filteredCount: alerts.length,
  };
}

// ---- Executive Intelligence summary (Risk + Forecast + Recommendations) -----

export interface ExecSummary {
  counts: { critical: number; high: number; forecasts: number; recommendations: number };
  alerts: RiskAlertRow[];
  forecasts: InsightRow[];
  recommendations: RecommendationRow[];
}

/** One read for the exec surface: active risk alerts + forecast insights + recommendations. */
export async function getExecSummary(companyId?: string | null): Promise<ExecSummary> {
  const [alerts, forecasts, recommendations] = await Promise.all([
    getRiskAlerts({ companyId, status: ['OPEN', 'ACKNOWLEDGED'], sort: 'severity', limit: 50 }),
    listInsights({ companyId, limit: 50 }),
    listRecommendations({ companyId, limit: 50 }),
  ]);
  return {
    counts: {
      critical: alerts.filter((a) => a.severity === 'CRITICAL').length,
      high: alerts.filter((a) => a.severity === 'HIGH').length,
      forecasts: forecasts.length,
      recommendations: recommendations.length,
    },
    alerts, forecasts, recommendations,
  };
}
