// ============================================================
// AURA 0.2 — Forecast series builder + activation (Phase 2B · Batch 2)
//
// The IMPURE side of Forecast: reads the event ledger, reconstructs a
// ForecastSeries per (company, scope, kind), runs the PURE engine (runForecast),
// and persists the result. The engine never touches the DB; this module is the
// only Forecast code that does. Reads ONLY system_events; writes ONLY
// intel_insight / intel_recommendation. No CORE access.
//
// Refresh strategy = FULL-REFRESH: forecasts are derived + ephemeral, so each
// pass wipes all engine='FORECAST' artifacts and rebuilds the current set —
// one live forecast per scope+kind, no stale rows, no schema change.
// ============================================================

import supabaseAdmin from '@/lib/supabaseAdmin';
import { pickNum, pickStr } from './engine-utils';
import { runForecast } from './forecast-engine';
import type { ForecastKind, ForecastSeries, ForecastPoint } from '@/types/forecast.types';
import type { EngineOutput } from '@/types/intelligence.types';

// ---- event → series mapping (which events feed each kind, and the value key) ----
interface KindSpec {
  kind: ForecastKind;
  scope: 'project' | 'company';
  eventTypes: string[];
  valueKeys: string[];          // the time-series measurement
  budgetKeys?: string[];        // reference target (latest non-null wins)
  cashKeys?: string[];
  plannedEndKeys?: string[];
}

const SPECS: KindSpec[] = [
  {
    kind: 'SCHEDULE_DELAY_FORECAST', scope: 'project',
    eventTypes: ['project.progress_updated'],
    valueKeys: ['progress', 'percent_complete', 'pct_complete'],
    plannedEndKeys: ['planned_end', 'end_date', 'baseline_end'],
  },
  {
    kind: 'BUDGET_OVERRUN_FORECAST', scope: 'project',
    eventTypes: ['project.progress_updated', 'budget.exceeded', 'project.budget_overrun'],
    valueKeys: ['actual_cost', 'actual', 'spent', 'cost_to_date', 'eac'],
    budgetKeys: ['budget', 'approved_budget', 'budget_amount'],
    plannedEndKeys: ['planned_end', 'end_date', 'baseline_end'],
  },
  {
    kind: 'CASHFLOW_RISK_FORECAST', scope: 'company',
    eventTypes: ['cash.snapshot', 'payment.recorded', 'invoice.overdue'],
    valueKeys: ['cash_balance', 'balance', 'cash_on_hand', 'net_position'],
    cashKeys: ['cash_balance', 'balance', 'cash_on_hand'],
  },
];

interface LedgerRow {
  id: string;
  event_type: string;
  company_id: string | null;
  project_id: string | null;
  entity_id: string | null;
  payload: Record<string, any>;
  created_at: string;
}

const SERIES_LIMIT = 2000;

async function fetchRows(eventTypes: string[]): Promise<LedgerRow[]> {
  const { data, error } = await supabaseAdmin
    .from('system_events')
    .select('id, event_type, company_id, project_id, entity_id, payload, created_at')
    .in('event_type', eventTypes)
    .order('created_at', { ascending: true })
    .limit(SERIES_LIMIT);
  if (error) throw new Error(`forecast fetch (${eventTypes.join(',')}): ${error.message}`);
  return (data ?? []) as LedgerRow[];
}

/** Group rows by scope and turn each group into a ForecastSeries (or drop it if too thin). */
function buildSeries(spec: KindSpec, rows: LedgerRow[]): ForecastSeries[] {
  const groups = new Map<string, LedgerRow[]>();
  for (const r of rows) {
    const scopeId = spec.scope === 'project' ? r.project_id : r.company_id;
    if (!scopeId) continue;
    let arr = groups.get(scopeId);
    if (!arr) { arr = []; groups.set(scopeId, arr); }
    arr.push(r);
  }

  const series: ForecastSeries[] = [];
  for (const [scopeId, grp] of groups) {
    const points: ForecastPoint[] = [];
    let budget: number | undefined;
    let cashOnHand: number | undefined;
    let plannedEnd: string | undefined;
    for (const r of grp) {
      const v = pickNum(r.payload, spec.valueKeys);
      if (v !== undefined) points.push({ t: r.created_at, value: v });
      if (spec.budgetKeys) { const b = pickNum(r.payload, spec.budgetKeys); if (b !== undefined) budget = b; }
      if (spec.cashKeys) { const c = pickNum(r.payload, spec.cashKeys); if (c !== undefined) cashOnHand = c; }
      if (spec.plannedEndKeys) { const p = pickStr(r.payload, spec.plannedEndKeys); if (p) plannedEnd = p; }
    }
    if (points.length < 2) continue;                       // engine also guards; skip early
    const tip = grp[grp.length - 1];
    series.push({
      company_id: tip.company_id,
      scopeId,
      sourceEventId: tip.id,
      observations: points.length,
      periodStart: points[0].t,
      periodEnd: points[points.length - 1].t,
      points,
      budget, cashOnHand, plannedEnd,
    });
  }
  return series;
}

/** Read the ledger, build every series, run the pure engine, merge the artifacts. */
export async function gatherForecasts(): Promise<EngineOutput> {
  const merged: EngineOutput = { riskAlerts: [], recommendations: [], insights: [] };
  for (const spec of SPECS) {
    const rows = await fetchRows(spec.eventTypes);
    for (const s of buildSeries(spec, rows)) {
      const out = runForecast(spec.kind, s);
      merged.recommendations.push(...out.recommendations);
      merged.insights.push(...out.insights);
    }
  }
  return merged;
}

export interface ForecastCounts { insights: number; recommendations: number }

/** Full-refresh persist: wipe all FORECAST artifacts, then write the current set. */
export async function persistForecasts(out: EngineOutput): Promise<ForecastCounts> {
  const del1 = await supabaseAdmin.from('intel_insight').delete().eq('engine', 'FORECAST');
  if (del1.error) throw new Error(`forecast insight wipe: ${del1.error.message}`);
  const del2 = await supabaseAdmin.from('intel_recommendation').delete().eq('engine', 'FORECAST');
  if (del2.error) throw new Error(`forecast recommendation wipe: ${del2.error.message}`);

  let insights = 0;
  let recommendations = 0;
  if (out.insights.length) {
    const { error } = await supabaseAdmin.from('intel_insight').insert(out.insights);
    if (error) throw new Error(`forecast insight insert: ${error.message}`);
    insights = out.insights.length;
  }
  if (out.recommendations.length) {
    const { error } = await supabaseAdmin.from('intel_recommendation').insert(out.recommendations);
    if (error) throw new Error(`forecast recommendation insert: ${error.message}`);
    recommendations = out.recommendations.length;
  }
  return { insights, recommendations };
}

/** Activation entry — called by the processor after the per-event drain. */
export async function runForecastPass(): Promise<ForecastCounts> {
  return persistForecasts(await gatherForecasts());
}
