// ============================================================
// AURA 0.2 — CORE Signal Scan (Batch 2A)
// Detects TEMPORAL / STATE-based risk conditions in CORE that no single mutation
// emits (a project becomes late as time passes; a quote nears expiry). Reads CORE
// READ-ONLY and emits the matching event into system_events — never writes CORE.
//
// Idempotent: emits ONE event per (event_type, entity_id). The risk-engine's own
// dedup_key then collapses repeats into a single active alert. Pair with
// POST /api/intelligence/process to score the emitted events into alerts.
//
// Action-triggered events (e.g. po.high_value) stay as service hooks; this layer
// is only for conditions that must be POLLED.
// ============================================================

import supabaseAdmin from '@/lib/supabaseAdmin';

interface Candidate {
  eventType: string;
  entityType: string;
  entityId: string;
  projectId?: string | null;
  companyId?: string | null;
  payload: Record<string, any>;
}

const DAY = 86_400_000;
const dayStr = (offsetDays = 0) => new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10);
const daysFromNow = (iso: string) => Math.round((new Date(iso).getTime() - Date.now()) / DAY);

// ── Detector: project.delay — past planned end, not actually finished ──────
async function detectProjectDelays(companyId?: string | null): Promise<Candidate[]> {
  let q = supabaseAdmin
    .from('projects')
    .select('id, project_number, name, planned_end_date, actual_end_date, contract_value, revised_contract_value, company_id, status, is_active')
    .lt('planned_end_date', dayStr(0))
    .is('actual_end_date', null)
    .eq('is_active', true)
    .limit(500);
  if (companyId) q = q.eq('company_id', companyId);
  const { data, error } = await q;
  if (error) throw new Error(`projects: ${error.message}`);
  return (data ?? [])
    .filter((r: any) => r.planned_end_date)
    .map((r: any) => ({
      eventType: 'project.delay',
      entityType: 'PROJECT',
      entityId: r.id,
      projectId: r.id,
      companyId: r.company_id ?? null,
      payload: {
        name: r.name,
        project_number: r.project_number,
        planned_end_date: r.planned_end_date,
        days_overdue: Math.max(0, -daysFromNow(r.planned_end_date)),
        contract_value: r.revised_contract_value ?? r.contract_value ?? null,
        status: r.status,
      },
    }));
}

// ── Detector: quotation.expiring — sent, unanswered, valid_until within 7d ──
async function detectExpiringQuotations(companyId?: string | null): Promise<Candidate[]> {
  let q = supabaseAdmin
    .from('quotations')
    .select('id, quotation_number, client_name, valid_until, grand_total_with_vat, company_id, project_id, sent_to_client_at, client_responded_at')
    .gte('valid_until', dayStr(0))
    .lte('valid_until', dayStr(7))
    .not('sent_to_client_at', 'is', null)
    .is('client_responded_at', null)
    .limit(500);
  if (companyId) q = q.eq('company_id', companyId);
  const { data, error } = await q;
  if (error) throw new Error(`quotations: ${error.message}`);
  return (data ?? [])
    .filter((r: any) => r.valid_until)
    .map((r: any) => ({
      eventType: 'quotation.expiring',
      entityType: 'QUOTATION',
      entityId: r.id,
      projectId: r.project_id ?? null,
      companyId: r.company_id ?? null,
      payload: {
        name: r.client_name,
        reference: r.quotation_number,
        valid_until: r.valid_until,
        days_to_expiry: Math.max(0, daysFromNow(r.valid_until)),
        grand_total: r.grand_total_with_vat ?? null,
      },
    }));
}

const DETECTORS = [detectProjectDelays, detectExpiringQuotations];

export interface ScanSummary {
  scanned: number;
  emitted: number;
  skipped: number;
  byType: Record<string, number>;
  errors: string[];
}

/** Run every detector, then emit each new condition once (idempotent on event_type+entity_id). */
export async function scanCoreSignals(companyId?: string | null): Promise<ScanSummary> {
  const summary: ScanSummary = { scanned: 0, emitted: 0, skipped: 0, byType: {}, errors: [] };

  const candidates: Candidate[] = [];
  for (const detect of DETECTORS) {
    try {
      candidates.push(...(await detect(companyId)));
    } catch (e: any) {
      summary.errors.push(e?.message ?? String(e));
    }
  }
  summary.scanned = candidates.length;

  for (const c of candidates) {
    // Idempotent: one event per condition-instance. (Engine dedup is a second guard.)
    const { data: existing } = await supabaseAdmin
      .from('system_events')
      .select('id')
      .eq('event_type', c.eventType)
      .eq('entity_id', c.entityId)
      .limit(1)
      .maybeSingle();
    if (existing) { summary.skipped++; continue; }

    const { error } = await supabaseAdmin.from('system_events').insert({
      event_type: c.eventType,
      entity_type: c.entityType,
      entity_id: c.entityId,
      project_id: c.projectId ?? null,
      payload: c.payload,
      actor_user_id: null,
      company_id: c.companyId ?? null,
      event_version: 1,
    });
    if (error) { summary.errors.push(`${c.eventType}/${c.entityId}: ${error.message}`); continue; }

    summary.emitted++;
    summary.byType[c.eventType] = (summary.byType[c.eventType] ?? 0) + 1;
  }

  return summary;
}
