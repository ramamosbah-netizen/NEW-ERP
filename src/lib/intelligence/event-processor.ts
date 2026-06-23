// ============================================================
// AURA 0.2 — Event Processor
// The ONLY place that routes events → engines → persists → marks the ledger.
// Reads system_events, writes intel_* tables only. CORE tables are never touched.
//
// Risk alerts are DEDUPLICATED: one active alert per fingerprint (dedup_key).
// A repeat of the same problem with a HIGHER score escalates the existing alert
// in place (no duplicate); a lower/equal score just bumps occurrence_count.
// ============================================================

import supabaseAdmin from '@/lib/supabaseAdmin';
import type { IngestEvent, EngineOutput, NewRiskAlert } from '@/types/intelligence.types';
import { analyzeRisk } from './risk-engine';
import { analyzeMargin } from './margin-engine';
import { analyzeForecast } from './forecast-engine';
import { runForecastPass } from './forecast-series';

function merge(...outs: EngineOutput[]): EngineOutput {
  return {
    riskAlerts: outs.flatMap(o => o.riskAlerts),
    recommendations: outs.flatMap(o => o.recommendations),
    insights: outs.flatMap(o => o.insights),
  };
}

/** Fan a single event out to every engine and merge their results. */
export function runEngines(event: IngestEvent): EngineOutput {
  return merge(analyzeRisk(event), analyzeMargin(event), analyzeForecast(event));
}

function toIngest(row: any): IngestEvent {
  const payload = (row.payload ?? {}) as Record<string, any>;
  return {
    id: row.id,
    event_type: row.event_type,
    entity_type: row.entity_type ?? null,
    entity_id: row.entity_id ?? null,
    project_id: row.project_id ?? null,
    company_id: row.company_id ?? payload.company_id ?? payload.companyId ?? null,
    payload,
    created_at: row.created_at,
  };
}

type RiskOutcome = 'inserted' | 'escalated' | 'skipped';

async function persistRiskAlert(a: NewRiskAlert, retried = false): Promise<RiskOutcome> {
  const { data: existing } = await supabaseAdmin
    .from('intel_risk_alert')
    .select('id, score, occurrence_count')
    .eq('dedup_key', a.dedup_key)
    .in('status', ['OPEN', 'ACKNOWLEDGED'])
    .maybeSingle();

  const now = new Date().toISOString();

  if (!existing) {
    const { error } = await supabaseAdmin
      .from('intel_risk_alert')
      .insert({ ...a, occurrence_count: 1, last_event_at: now, updated_at: now });
    if (error) {
      // Lost a race to the partial-unique index → an active alert now exists; escalate it.
      if ((error as any).code === '23505' && !retried) return persistRiskAlert(a, true);
      if ((error as any).code === '23505') return 'skipped';
      throw new Error(`risk insert: ${error.message}`);
    }
    return 'inserted';
  }

  const ex = existing as { id: string; score: number; occurrence_count: number };
  const patch: Record<string, any> = {
    occurrence_count: (ex.occurrence_count ?? 1) + 1,
    last_event_at: now,
    updated_at: now,
  };
  let outcome: RiskOutcome = 'skipped';
  if (a.score > (ex.score ?? 0)) {
    // Escalate severity in place — no duplicate alert.
    Object.assign(patch, {
      severity: a.severity,
      score: a.score,
      factors: a.factors,
      title: a.title,
      detail: a.detail,
      confidence: a.confidence,
      source_event_id: a.source_event_id,
      source_event_type: a.source_event_type,
    });
    outcome = 'escalated';
  }
  const { error } = await supabaseAdmin.from('intel_risk_alert').update(patch).eq('id', ex.id);
  if (error) throw new Error(`risk update: ${error.message}`);
  return outcome;
}

interface PersistCounts { risk: number; recommendations: number; insights: number }

async function persist(out: EngineOutput): Promise<PersistCounts> {
  let risk = 0;
  for (const a of out.riskAlerts) {
    const r = await persistRiskAlert(a);
    if (r === 'inserted' || r === 'escalated') risk++;
  }
  // Other engines (Phase 2B/2C) — not produced by the Risk Engine.
  if (out.recommendations.length) {
    const { error } = await supabaseAdmin.from('intel_recommendation').insert(out.recommendations);
    if (error) throw new Error(`recommendation insert: ${error.message}`);
  }
  if (out.insights.length) {
    const { error } = await supabaseAdmin.from('intel_insight').insert(out.insights);
    if (error) throw new Error(`insight insert: ${error.message}`);
  }
  return { risk, recommendations: out.recommendations.length, insights: out.insights.length };
}

export interface ProcessSummary {
  processed: number;
  riskAlerts: number;
  recommendations: number;
  insights: number;
  forecast: { insights: number; recommendations: number };
  errors: { eventId: string; error: string }[];
}

/** Analyze one ledger row and persist its artifacts (dedup-aware). */
export async function processEvent(row: any): Promise<PersistCounts> {
  return persist(runEngines(toIngest(row)));
}

/**
 * Drain the unprocessed tail of the event ledger. Idempotent at the ledger level
 * (each row is stamped processed_at) and at the alert level (dedup fingerprint).
 */
export async function processUnprocessedEvents(limit = 200): Promise<ProcessSummary> {
  const summary: ProcessSummary = { processed: 0, riskAlerts: 0, recommendations: 0, insights: 0, forecast: { insights: 0, recommendations: 0 }, errors: [] };

  const { data, error } = await supabaseAdmin
    .from('system_events')
    .select('*')
    .is('processed_at', null)
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) throw new Error(`fetch events: ${error.message}`);

  for (const row of data ?? []) {
    try {
      const c = await processEvent(row);
      summary.processed++;
      summary.riskAlerts += c.risk;
      summary.recommendations += c.recommendations;
      summary.insights += c.insights;
      await supabaseAdmin
        .from('system_events')
        .update({ processed_at: new Date().toISOString(), processing_error: null })
        .eq('id', row.id);
    } catch (err: any) {
      const message = err?.message ?? String(err);
      summary.errors.push({ eventId: row.id, error: message });
      await supabaseAdmin.from('system_events').update({ processing_error: message }).eq('id', row.id);
    }
  }

  // Forecast pass (Phase 2B): full-refresh derived forecasts over the whole
  // ledger. Non-fatal — a forecast failure must never fail event processing.
  try {
    const fc = await runForecastPass();
    summary.forecast = { insights: fc.insights, recommendations: fc.recommendations };
  } catch (err: any) {
    summary.errors.push({ eventId: 'forecast', error: err?.message ?? String(err) });
  }

  return summary;
}
