// ============================================================
// AURA 0.2 — Forecast Engine V1 (Phase 2B · Batch 1, PURE)
//
// Deterministic projection over a prepared ForecastSeries. NO LLM, NO DB,
// NO Core access. Replaces the Phase-0 single-event stub. Coverage = exactly
// the three Batch-1 kinds. Each kind emits ONE insight ALWAYS (the projection)
// + a recommendation ONLY on a threshold breach.
//
// Math: least-squares slope + linear projection + thresholds. Same series ⇒
// same output, always (`now` injected for determinism). Tolerant: < N_MIN
// observations ⇒ skip (no garbage forecasts); flat / non-actionable trend ⇒
// insight only, no recommendation.
//
// Series-gathering + processor dispatch is Batch 2 — NOT here. The per-event
// `analyzeForecast` export below is an intentional no-op so the processor's
// fan-out keeps compiling without inventing forecasts from a single event.
// ============================================================

import type {
  EngineOutput, NewInsight, NewRecommendation, SourceContext, RecPriority, IngestEvent,
} from '@/types/intelligence.types';
import type { ForecastKind, ForecastSeries, ForecastPoint } from '@/types/forecast.types';
import { emptyOutput, clamp, aed } from './engine-utils';

// ---- tunables (ADR §7 defaults) -------------------------------------------
const N_MIN = 3;                    // fewer observations ⇒ skip
const RUNWAY_THRESHOLD_DAYS = 60;
const SCHEDULE_GRACE_DAYS = 0;
const DAY_MS = 86_400_000;
const EPS = 1e-9;

// ---- pure math toolkit -----------------------------------------------------
const dayNum = (iso: string): number => Date.parse(iso) / DAY_MS;
const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

function stddev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}

/** Least-squares slope of value vs time(days). 0 if x has no spread. */
function slopePerDay(points: ForecastPoint[]): number {
  const xs = points.map((p) => dayNum(p.t));
  const ys = points.map((p) => p.value);
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  return den < EPS ? 0 : num / den;
}

const deltas = (points: ForecastPoint[]): number[] =>
  points.slice(1).map((p, i) => p.value - points[i].value);

/** Documented, FIXED confidence (ADR §4): same series ⇒ same confidence. */
function confidence(s: ForecastSeries): number {
  const base = Math.min(0.95, 0.30 + s.observations / 20);
  const d = deltas(s.points);
  const varianceFactor = stddev(d) / (Math.abs(mean(d)) + EPS);
  const penalty = clamp(varianceFactor, 0, 0.25);
  return clamp(base - penalty, 0.30, 0.95);
}

// ---- artifact builders -----------------------------------------------------
function seriesCtx(s: ForecastSeries, kind: ForecastKind, scope: 'project' | 'company'): SourceContext {
  return {
    company_id: s.company_id,
    source_event_id: s.sourceEventId,
    source_event_type: kind,           // self-documenting on the row (free-text column)
    entity_type: scope,
    entity_id: s.scopeId,
    project_id: scope === 'project' ? s.scopeId : null,
  };
}

const insight = (
  c: SourceContext, kind: ForecastKind, title: string, detail: string,
  metrics: Record<string, unknown>, conf: number,
): NewInsight => ({ ...c, engine: 'FORECAST', kind, title, detail, metrics, confidence: conf });

const recommend = (
  c: SourceContext, action_type: string, priority: RecPriority,
  title: string, detail: string, rationale: string, expected_impact: Record<string, unknown>,
): NewRecommendation => ({ ...c, engine: 'FORECAST', action_type, priority, title, detail, rationale, expected_impact });

/** Too thin to project (prevents garbage forecasts). */
const insufficient = (s: ForecastSeries): boolean => s.observations < N_MIN || s.points.length < 2;
const last = (s: ForecastSeries): ForecastPoint => s.points[s.points.length - 1];

// ===========================================================================
// 1. BUDGET_OVERRUN_FORECAST (project) — points = (t, cumulative_cost).
//    Project cost to plannedEnd → EAC vs budget.
// ===========================================================================
export function forecastBudgetOverrun(s: ForecastSeries): EngineOutput {
  const out = emptyOutput();
  if (insufficient(s) || s.budget === undefined || !s.plannedEnd) return out;

  const c = seriesCtx(s, 'BUDGET_OVERRUN_FORECAST', 'project');
  const conf = confidence(s);
  const tip = last(s);
  const slope = slopePerDay(s.points);                                // cost / day
  const daysToEnd = Math.max(0, dayNum(s.plannedEnd) - dayNum(tip.t));
  const eac = tip.value + slope * daysToEnd;
  const overrun = eac - s.budget;
  const overrunPct = s.budget > 0 ? (overrun / s.budget) * 100 : 0;
  const breach = eac > s.budget;

  out.insights.push(insight(
    c, 'BUDGET_OVERRUN_FORECAST',
    `Budget forecast — EAC ${aed(eac)} vs ${aed(s.budget)}`,
    breach
      ? `At the current burn the project is forecast to finish ~${aed(overrun)} (${Math.round(overrunPct)}%) over budget.`
      : `At the current burn the project is forecast to land within budget (EAC ${aed(eac)}).`,
    {
      observations: s.observations, period: [s.periodStart, s.periodEnd],
      cost_to_date: Math.round(tip.value), cost_per_day: Math.round(slope),
      projected_eac: Math.round(eac), budget: s.budget,
      overrun: Math.round(overrun), overrun_pct: Math.round(overrunPct),
      horizon: s.plannedEnd, threshold: s.budget, breach,
    }, conf,
  ));

  if (breach) {
    out.recommendations.push(recommend(
      c, 'REBASELINE', overrunPct >= 20 ? 'HIGH' : 'MEDIUM',
      'Forecast budget overrun — re-baseline / cost control',
      `Projected EAC ${aed(eac)} exceeds the ${aed(s.budget)} budget by ~${Math.round(overrunPct)}%.`,
      'Linear projection of cost-to-date to the planned completion date exceeds the approved budget; early cost control reduces the final overrun.',
      { projected_eac: Math.round(eac), overrun: Math.round(overrun), overrun_pct: Math.round(overrunPct) },
    ));
  }
  return out;
}

// ===========================================================================
// 2. CASHFLOW_RISK_FORECAST (company) — points = (t, cash_balance).
//    burn = -slope; runway = cash / burn.
// ===========================================================================
export function forecastCashflowRisk(s: ForecastSeries): EngineOutput {
  const out = emptyOutput();
  if (insufficient(s)) return out;

  const c = seriesCtx(s, 'CASHFLOW_RISK_FORECAST', 'company');
  const conf = confidence(s);
  const cash = s.cashOnHand ?? last(s).value;
  const slope = slopePerDay(s.points);                 // balance change / day
  const burn = -slope;                                  // positive = losing cash
  const runwayDays = burn > EPS ? cash / burn : Infinity;
  const breach = Number.isFinite(runwayDays) && runwayDays < RUNWAY_THRESHOLD_DAYS;

  // Flat / non-burning ⇒ insight only (healthy), no recommendation.
  out.insights.push(insight(
    c, 'CASHFLOW_RISK_FORECAST',
    burn > EPS ? `Cash runway forecast — ${Math.round(runwayDays)} days` : 'Cash position stable / improving',
    burn > EPS
      ? `Net burn ~${aed(burn)}/day against ${aed(cash)} on hand ⇒ ~${Math.round(runwayDays)} days of runway.`
      : 'Net cash trend is flat or positive over the window; no runway risk projected.',
    {
      observations: s.observations, period: [s.periodStart, s.periodEnd],
      cash_on_hand: Math.round(cash), burn_per_day: Math.round(burn),
      runway_days: Number.isFinite(runwayDays) ? Math.round(runwayDays) : null,
      threshold: RUNWAY_THRESHOLD_DAYS, breach,
    }, conf,
  ));

  if (breach) {
    out.recommendations.push(recommend(
      c, 'CASH_ACTION', runwayDays < 30 ? 'HIGH' : 'MEDIUM',
      'Cash runway below threshold — act on liquidity',
      `Projected runway ~${Math.round(runwayDays)} days (< ${RUNWAY_THRESHOLD_DAYS}). Accelerate collections / defer discretionary spend.`,
      'Moving-average net burn against current cash projects runway below the safe threshold; liquidity action now avoids a shortfall.',
      { runway_days: Math.round(runwayDays), burn_per_day: Math.round(burn), cash_on_hand: Math.round(cash) },
    ));
  }
  return out;
}

// ===========================================================================
// 3. SCHEDULE_DELAY_FORECAST (project) — points = (t, progress%).
//    rate = slope; ETA = now + remaining/rate; slippage vs plannedEnd.
// ===========================================================================
export function forecastScheduleDelay(s: ForecastSeries): EngineOutput {
  const out = emptyOutput();
  if (insufficient(s) || !s.plannedEnd) return out;

  const c = seriesCtx(s, 'SCHEDULE_DELAY_FORECAST', 'project');
  const conf = confidence(s);
  const tip = last(s);
  const rate = slopePerDay(s.points);                  // progress % / day
  const remaining = Math.max(0, 100 - tip.value);

  // Stalled / negative progress ⇒ cannot project completion ⇒ insight only.
  if (rate <= EPS) {
    out.insights.push(insight(
      c, 'SCHEDULE_DELAY_FORECAST', 'Schedule stalled — progress flat',
      `Progress is flat (${Math.round(tip.value)}%) over the window; completion cannot be projected. Investigate the blocker.`,
      { observations: s.observations, progress: Math.round(tip.value), rate_per_day: 0, breach: false }, conf,
    ));
    return out;
  }

  const etaDay = dayNum(tip.t) + remaining / rate;
  const eta = new Date(etaDay * DAY_MS).toISOString();
  const slippageDays = etaDay - dayNum(s.plannedEnd);
  const breach = slippageDays > SCHEDULE_GRACE_DAYS;

  out.insights.push(insight(
    c, 'SCHEDULE_DELAY_FORECAST',
    breach ? `Schedule slippage forecast — ${Math.round(slippageDays)}d late` : 'Schedule forecast — on track',
    breach
      ? `At the current rate (${rate.toFixed(2)}%/day) completion projects to ${eta.slice(0, 10)} — ~${Math.round(slippageDays)} days past plan.`
      : 'At the current rate the project projects to finish on or ahead of the planned date.',
    {
      observations: s.observations, period: [s.periodStart, s.periodEnd],
      progress: Math.round(tip.value), rate_per_day: Number(rate.toFixed(3)),
      eta, planned_end: s.plannedEnd, slippage_days: Math.round(slippageDays),
      grace: SCHEDULE_GRACE_DAYS, breach,
    }, conf,
  ));

  if (breach) {
    out.recommendations.push(recommend(
      c, 'EXPEDITE', slippageDays >= 30 ? 'HIGH' : 'MEDIUM',
      'Forecast schedule delay — expedite',
      `Projected completion ${eta.slice(0, 10)} is ~${Math.round(slippageDays)} days past the planned ${s.plannedEnd.slice(0, 10)}.`,
      'Linear projection of the progress rate finishes past the planned end date; expediting now limits liquidated-damages exposure.',
      { eta, slippage_days: Math.round(slippageDays), rate_per_day: Number(rate.toFixed(3)) },
    ));
  }
  return out;
}

// ---- dispatch + legacy per-event entry ------------------------------------

/** Route a prepared series to its kind's projector. */
export function runForecast(kind: ForecastKind, series: ForecastSeries): EngineOutput {
  switch (kind) {
    case 'BUDGET_OVERRUN_FORECAST': return forecastBudgetOverrun(series);
    case 'CASHFLOW_RISK_FORECAST':  return forecastCashflowRisk(series);
    case 'SCHEDULE_DELAY_FORECAST': return forecastScheduleDelay(series);
    default:                        return emptyOutput();
  }
}

/**
 * Runtime wiring status of the Forecast engine. Batch 1 ships the pure engine but
 * does NOT connect it to the live event path (series-gathering = Batch 2). Exported
 * so telemetry / health checks / debuggers read "no forecasts at runtime" as
 * INTENTIONALLY DISABLED — not a bug, a dead module, or missing wiring.
 */
export const FORECAST_RUNTIME_STATUS = 'DISABLED_BATCH_2_PENDING' as const;

/**
 * Per-event entry retained for the processor's fan-out (`runEngines`). Forecast V1
 * is SERIES-based, so a single event produces nothing here — BY DESIGN, see
 * `FORECAST_RUNTIME_STATUS`. The real engine (`runForecast` / the three projectors)
 * runs over a prepared series; the processor's series-builder bridge that feeds it
 * is Batch 2. Returns an empty (type-safe) EngineOutput so the fan-out keeps
 * compiling. NOT the old Phase-0 stub.
 */
export function analyzeForecast(_event: IngestEvent): EngineOutput {
  return emptyOutput();
}
