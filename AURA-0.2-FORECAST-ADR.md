# ADR — Forecast Engine V1 (Phase 2B · Batch 1 spec)

- **Status:** **APPROVED 2026-06-22** (CTO) with 2 amendments — explicit `observations`/period fields (§2b) + documented confidence formula (§4), both folded in below. **Batch 1 BUILT + typecheck-green 2026-06-22 (§8).**
- **Date:** 2026-06-22
- **Layer:** Intelligence (the AURA "brain") — reads `public.system_events` (+ `intel_risk_alert`), writes only `intel_insight` / `intel_recommendation`.
- **Type:** **Deterministic** projection (trend / moving-average / linear). **No LLM. No autonomy. No Core writes.**
- **Discipline:** mirrors Risk Engine V1 — pure engine, only-writer processor, `company_id`-scoped, factor-traceable.

---

## 1. Batch-1 scope (engine core ONLY)

**In Batch 1 — exactly three files:**
| File | Role |
|---|---|
| `src/types/forecast.types.ts` | Forecast type contracts (series, result, the 3 kinds) |
| `src/lib/intelligence/forecast-engine.ts` | **Pure** projection engine (replaces the Phase-0 stub) |
| `AURA-0.2-FORECAST-ADR.md` | this ADR |

**Explicitly NOT in Batch 1:** ❌ UI / Forecast Board ❌ `forecast-query.ts` ❌ recommendations page ❌ charts ❌ processor wiring / series-gathering ❌ persistence/dedup ❌ AI ❌ notifications ❌ automation ❌ Margin/Memory/Hermes.

---

## 2. The architectural shift (Risk → Forecast)

Risk is **stateless**: one event → one alert. Forecast is **aggregate**: a *time series* → a projection.
To keep the engine **pure & unit-testable**, the boundary is:

```
[ history ]  system_events / intel_risk_alert
     ↓        (gathered by the PROCESSOR — Batch 2, NOT now)
[ ForecastSeries ]   prepared numeric series + reference targets
     ↓
forecast-engine.ts   ← PURE math: slope · moving avg · linear projection · thresholds
     ↓
EngineOutput         insights (always) + recommendations (only on threshold breach)
     ↓        (persisted by the PROCESSOR — Batch 2)
intel_insight / intel_recommendation   (engine = 'FORECAST')
```

**Batch 1 builds only the PURE middle box.** It accepts a `ForecastSeries` (synthetic in tests),
runs deterministic math, returns `EngineOutput`. The series-gathering + persistence is Batch 2.
This preserves the "engines never touch the DB" rule already enforced for Risk.

### 2b. `ForecastSeries` — the Batch-1 input contract

```ts
interface ForecastPoint { t: string; /* ISO */ value: number; }

interface ForecastSeries {
  company_id: string | null;
  scopeId: string | null;     // project_id (budget/schedule) or company_id (cashflow)
  sourceEventId: string;      // latest event in the window — links artifact → ledger
  observations: number;       // AUTHORITATIVE count — drives confidence + audit.
                              // NOT re-derived from points.length (a series may be
                              // pre-aggregated/filtered, so the two can differ).
  periodStart: string;        // ISO — window the series covers (auditability)
  periodEnd: string;          // ISO
  points: ForecastPoint[];    // chronological samples
  // reference targets (per kind):
  budget?: number;            // BUDGET_OVERRUN_FORECAST
  cashOnHand?: number;        // CASHFLOW_RISK_FORECAST
  plannedEnd?: string;        // BUDGET / SCHEDULE — planned completion (ISO)
  now?: string;               // injected → deterministic tests
}
```

`observations` / `periodStart` / `periodEnd` are **explicit, not inferred from `points.length`**:
they feed confidence directly, make every forecast auditable, and disambiguate an aggregated or
filtered series from a raw point count.

---

## 3. The three forecast types (Batch-1 coverage — and ONLY these three)

| Kind | Scope | Series input | Deterministic model | Breach → recommendation |
|---|---|---|---|---|
| `BUDGET_OVERRUN_FORECAST` | project | (progress%, cumulative_cost) or (t, cost) + `budget` | **EAC** = linear projection of cost → 100% (or over time) | `EAC > budget` → `action_type: REBASELINE` |
| `CASHFLOW_RISK_FORECAST` | company | (t, net_cash_delta) + `cash_on_hand` | **burn rate** = moving avg of net outflow; **runway_days** = cash / burn | `runway_days < threshold` → `action_type: CASH_ACTION` |
| `SCHEDULE_DELAY_FORECAST` | project | (t, progress%) + `planned_end` | **rate** = slope(progress); **ETA** = now + (100−progress)/rate; **slippage** = ETA − planned_end | `slippage_days > grace` → `action_type: EXPEDITE` |

Every kind emits **one insight always** (the projection itself, even if no breach) and a **recommendation only on breach**. Priority scales with breach magnitude.

---

## 4. Determinism & traceability

- **Pure math only** (a small `forecast-math` toolkit, all in `forecast-engine.ts`):
  - `slope(points)` — least-squares (or `(last−first)/Δt` fallback)
  - `movingAverage(points, window)`
  - `linearProject(points, toX)` — y at a target x
  - `confidenceFromSeries(series)` — **fixed, documented formula (so two implementations can't drift):**
    ```
    base             = min(0.95, 0.30 + observations / 20)
    variance_factor  = stddev(deltas) / (|mean(deltas)| + ε)   // coeff. of variation of step-to-step deltas
    variance_penalty = clamp(variance_factor, 0.00, 0.25)
    confidence       = clamp(base − variance_penalty, 0.30, 0.95)
    ```
    Uses `series.observations` (NOT `points.length`). **Invariant: same series ⇒ same confidence, always.**
- **No randomness, no LLM, no time-of-day dependence** beyond the explicit `now` passed in (injected for testable determinism, like Risk's `ctx.now`).
- **Traceable:** every forecast carries its inputs in `metrics` / `expected_impact` — `{ n_points, slope, projected, horizon, threshold, breach }` — so any number is reproducible from the series. (Mirrors Risk's factor-summed, auditable score.)
- **Series-tolerant (never throws):** `< N_min` points (default **3**) ⇒ **skip** (no forecast). Flat/zero rate ⇒ no projection ⇒ emit a low-confidence "stalled / indeterminate" insight, no recommendation.

---

## 5. Schema mapping — NO migration needed in Batch 1

Outputs reuse the existing intelligence tables (created by `20260622110000_intelligence_layer.sql`):
- **`intel_insight`** — `kind` = the `ForecastKind`; `metrics` jsonb = the projection breakdown; `confidence`; `engine='FORECAST'`.
- **`intel_recommendation`** — `action_type` (REBASELINE / CASH_ACTION / EXPEDITE); `priority`; `rationale`; `expected_impact` jsonb; `engine='FORECAST'`.

Both already carry `company_id` + the `SourceContext` columns. **Batch 1 needs no DDL.**

> **Deferred to Batch 2 (persistence):** forecasts should *refresh* (one live forecast per
> `company + scope + kind`, recomputed as data arrives), but `intel_insight`/`intel_recommendation`
> have **no `dedup_key` / lifecycle** like `intel_risk_alert`. Decide then: (a) add a `dedup_key`
> + "supersede" convention, (b) delete-and-replace the active forecast per scope+kind, or
> (c) append-only history. **Not a Batch-1 concern.**

---

## 6. The Phase-0 stub is REPLACED

The current `analyzeForecast(e: IngestEvent)` (single-event switch on `project.status_changed` /
`task.overdue` / `project.dlp_expiring` — none of them canonical) is **removed**, exactly as Risk
Batch 1 dropped its Phase-0 carryover rules. Forecast V1 is series-based, not event-reactive.

---

## 7. Decisions — RATIFIED 2026-06-22 (CTO)

All six confirmed; amendments 1 (`observations`/period → §2b) and 2 (confidence formula → §4)
folded in. Held OUT of Batch 1 (no scope creep): forecast-query, forecast-board, charts, AI,
agent actions, notifications, automation, dedup strategy, refresh strategy.

1. **Confirm the 3 kinds** (BUDGET_OVERRUN / CASHFLOW_RISK / SCHEDULE_DELAY) as the entire Batch-1 coverage.
2. **Confirm the engine boundary:** pure functions over a *prepared* `ForecastSeries`; the processor gathers the series in Batch 2.
3. **Confirm `forecast.types.ts`** as a new file (vs extending `intelligence.types.ts`).
4. **Confirm removal** of the Phase-0 `analyzeForecast` stub.
5. **Defaults** (propose; adjust): `N_min = 3` points · runway threshold = **60 days** · schedule grace = **0 days** · budget breach when EAC > budget. Confidence clamp [0.30, 0.95].
6. **Confirm no DDL in Batch 1** (reuse intel_insight/recommendation; dedup/refresh → Batch 2).

**Trigger to build Batch 1 = `start forecast batch 1`.** ✅ Given 2026-06-22 → built (§8).

---

## 8. Batch 1 — BUILT (2026-06-22, typecheck green)

| Item | Status |
|---|:---:|
| `src/types/forecast.types.ts` (ForecastKind · ForecastPoint · **ForecastSeries** w/ `observations`/period/`sourceEventId` · ForecastProjection) | ✅ |
| `src/lib/intelligence/forecast-engine.ts` — **pure**, series-based, replaces the Phase-0 stub | ✅ |
| 3 kinds only: `forecastBudgetOverrun` · `forecastCashflowRisk` · `forecastScheduleDelay` (+ `runForecast` dispatch) | ✅ |
| Pure math toolkit (least-squares `slopePerDay`, `mean`/`stddev`/`deltas`) | ✅ |
| Confidence = §4 fixed formula (same series ⇒ same confidence) | ✅ |
| Insight ALWAYS + recommendation on breach only | ✅ |
| Tolerance: `observations < N_MIN(3)` ⇒ skip; flat/non-actionable rate ⇒ insight-only | ✅ |
| No DDL — outputs shape `intel_insight` / `intel_recommendation` (`engine='FORECAST'`) | ✅ |
| `analyzeForecast(event)` = **intentional no-op** + exported `FORECAST_RUNTIME_STATUS='DISABLED_BATCH_2_PENDING'` (observable, not silent) | ✅ |
| Typecheck green (`tsc --noEmit` → 0) | ✅ |

**NOT yet wired (Batch 2):** the processor neither gathers series nor calls `runForecast`;
`analyzeForecast` is a no-op, so **no forecast rows are produced at runtime** until Batch 2 builds
the series-gathering path + persistence / refresh (dedup). The disconnection is **observable**
via `FORECAST_RUNTIME_STATUS` (not silent) — so runtime "no forecasts" reads as *intentionally
disabled*, not a bug. Trigger for that = `start forecast batch 2`.

**Batch-2 wiring contract (the condition that makes the Batch-1 no-op legitimate):** the processor
will build a `ForecastSeries` per scope (from `system_events` / `intel_risk_alert`) and call
`runForecast(kind, series)`; `analyzeForecast` then becomes the series entry point **or is removed** —
**no silent dead path may remain.** Type safety preserved (no UI/DB outside scope).

**At Batch-2 close — retire `FORECAST_RUNTIME_STATUS`** (it's a transition aid, not a permanent flag):
**(A, preferred)** remove it / demote to an internal debug flag — avoids global-flag pollution; or
**(B)** fold it into `intel_insight.meta` as an audit/debug trace. Once Forecast is live, the constant
has served its purpose.
