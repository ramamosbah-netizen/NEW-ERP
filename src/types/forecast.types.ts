// ============================================================
// AURA 0.2 — Forecast Engine type contracts (Phase 2B · Batch 1)
// Deterministic projection over a PREPARED time series. The engine is pure;
// the series is gathered by the processor in Batch 2 (NOT here).
// ============================================================

/** The three Batch-1 forecast kinds (and ONLY these three). */
export type ForecastKind =
  | 'BUDGET_OVERRUN_FORECAST'
  | 'CASHFLOW_RISK_FORECAST'
  | 'SCHEDULE_DELAY_FORECAST';

/** One chronological sample. `t` = ISO timestamp; `value` = the measured quantity. */
export interface ForecastPoint {
  t: string;
  value: number;
}

/**
 * The prepared input the pure engine projects.
 *
 * `observations` / `periodStart` / `periodEnd` are EXPLICIT (NOT derived from
 * `points.length`): they feed confidence + audit and disambiguate an aggregated
 * or filtered series from a raw point count. `sourceEventId` links every emitted
 * artifact back to the ledger (the latest event in the window — the recompute
 * trigger). The processor (Batch 2) builds this from system_events /
 * intel_risk_alert; tests pass it synthetically.
 */
export interface ForecastSeries {
  company_id: string | null;
  scopeId: string | null;     // project_id (budget/schedule) | company_id (cashflow)
  sourceEventId: string;      // latest event in the window — links artifact → ledger
  observations: number;       // authoritative count (NOT points.length)
  periodStart: string;        // ISO — window covered
  periodEnd: string;          // ISO
  points: ForecastPoint[];    // chronological samples
  // per-kind reference targets:
  budget?: number;            // BUDGET_OVERRUN_FORECAST
  cashOnHand?: number;        // CASHFLOW_RISK_FORECAST
  plannedEnd?: string;        // BUDGET / SCHEDULE — planned completion (ISO)
  now?: string;               // injected → deterministic
}

/** Explainable projection — serialized into insight.metrics for full traceability. */
export interface ForecastProjection {
  kind: ForecastKind;
  observations: number;
  slope: number;              // trend per day
  projected: number;          // EAC | runway_days | slippage_days
  horizon: string | null;     // ISO date the projection targets (where applicable)
  threshold: number;
  breach: boolean;
  confidence: number;
}
