// ============================================================
// AURA 0.2 — Shared helpers for the intelligence engines.
// Engines are PURE: event in → outputs out. No DB access here.
// ============================================================

import type { IngestEvent, EngineOutput, SourceContext, RiskSeverity } from '@/types/intelligence.types';

export function emptyOutput(): EngineOutput {
  return { riskAlerts: [], recommendations: [], insights: [] };
}

/** Pull the first present, parseable number from a set of candidate keys. */
export function pickNum(payload: Record<string, any>, keys: string[]): number | undefined {
  for (const k of keys) {
    const v = payload?.[k];
    if (typeof v === 'number' && !Number.isNaN(v)) return v;
    if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
  }
  return undefined;
}

/** Pull the first present non-empty string from a set of candidate keys. */
export function pickStr(payload: Record<string, any>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = payload?.[k];
    if (typeof v === 'string' && v.trim() !== '') return v;
  }
  return undefined;
}

/** Context linking every emitted artifact back to its source event. */
export function ctx(e: IngestEvent): SourceContext {
  return {
    company_id: e.company_id ?? null,
    source_event_id: e.id,
    source_event_type: e.event_type,
    entity_type: e.entity_type ?? null,
    entity_id: e.entity_id ?? null,
    project_id: e.project_id ?? null,
  };
}

export const aed = (n: number) =>
  `AED ${new Intl.NumberFormat('en-AE', { maximumFractionDigits: 0 }).format(Math.round(n))}`;

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Phase 2A severity bands (CTO-set). CRITICAL starts at 90 so adding the
 * Forecast/Margin engines later doesn't flood the board with criticals.
 */
export function severityFromScore(score: number): RiskSeverity {
  if (score >= 90) return 'CRITICAL';
  if (score >= 70) return 'HIGH';
  if (score >= 40) return 'MEDIUM';
  return 'LOW';
}

/**
 * Stable fingerprint so the same problem never spawns a duplicate ACTIVE alert.
 * Scope is the entity (or project) the risk is about. Same key + active alert →
 * the processor escalates that alert instead of inserting a new one.
 */
export function dedupKey(e: IngestEvent, scopeId: string | null): string {
  return `${e.company_id ?? 'global'}:${scopeId ?? 'none'}:${e.event_type}`;
}
