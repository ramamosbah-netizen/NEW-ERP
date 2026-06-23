# ADR — Risk Engine V1 (Phase 2A)

- **Status:** Batch 1 **ACCEPTED** · Risk Contract V1 **ACCEPTED** · Batch 2 wiring **DONE** (contract-only state) · Batch 2.5 read-projection layer **DONE 2026-06-22** (`risk-query.ts` = DB-side query compiler + filtered/sorted board, typecheck green). **Live E2E + multi-tenant scoping RUNTIME-VERIFIED 2026-06-22 (see §8).**
- **Date:** 2026-06-22
- **Layer:** Intelligence (the AURA "brain") — reads `public.system_events`, writes only `public.intel_risk_alert`
- **Type:** Deterministic, rules-based. **No LLM. No autonomy. No Core writes.**

---

## 1. Architecture Snapshot — Risk Engine V1

```
Risk Engine V1

Input:
  public.system_events            (append-only ledger, company_id-scoped)

Processor:
  risk-engine.ts                  (RULES registry → RiskFactor[] → score)
  event-processor.ts              (dedup-aware persist / escalate; only writer)

Output:
  public.intel_risk_alert         (the ONLY table the engine writes)

States (status):
  OPEN → ACKNOWLEDGED → RESOLVED
  OPEN / ACKNOWLEDGED → DISMISSED

Domains (risk_domain):
  FINANCE · PROCUREMENT · PROJECT · COMPLIANCE · SUPPLY · HR · GENERAL

Covered Events: 7
  1. budget.exceeded
  2. project.budget_overrun
  3. po.high_value
  4. three_way_match.exception
  5. invoice.overdue
  6. employee.visa_expiring
  7. material.shortage
```

---

## 2. Scoring model

- Each matched rule emits `RiskFactor[]`; each factor carries a point `impact`.
- `score = clamp(Σ impact, 0, 100)`.
- Severity bands: **0–39 LOW · 40–69 MEDIUM · 70–89 HIGH · 90–100 CRITICAL**.
- **Payload-tolerant:** a missing field drops only its own factor (and lowers confidence) — the engine never throws.

---

## 3. Deduplication & escalation (`event-processor.ts`)

- `dedup_key` fingerprints an alert. **Partial `UNIQUE(dedup_key) WHERE status IN (OPEN, ACKNOWLEDGED)`** ⇒ at most one active alert per fingerprint.
- Re-fire with a **higher** score ⇒ UPDATE in place (escalate, no duplicate row).
- Re-fire with a **lower/equal** score ⇒ bump `occurrence_count`.
- Unique-violation race (Postgres `23505`) is caught and retried as an escalate.

---

## 4. Batch 1 — DONE (engine core)

| Item | Status |
|---|:---:|
| Migration `20260622120000_risk_engine_phase2a.sql` | ✅ |
| `risk_domain` column + 7 domains | ✅ |
| `RiskFactor` type | ✅ |
| Registry = **7 events only** | ✅ |
| Factor-summed scoring + severity bands | ✅ |
| Deduplication (`dedup_key`) | ✅ |
| Severity escalation in place | ✅ |
| Payload tolerance (never throws) | ✅ |
| Typecheck green | ✅ |

---

## 5. ~~FROZEN~~ → ACTIVATED in Batch 2 (the lifecycle layer)

> **UPDATE 2026-06-22 (Batch 2 wiring):** these are now **ACTIVE** and routed through the
> contract; `[FROZEN · Phase 2A boundary]` tags removed from source. History kept for the record.

Originally built ahead of the Batch-1 boundary and frozen (`COMPILED · NOT USED · NOT EXTENDED`).

| Artifact | Path |
|---|---|
| Alert-Actions API | `src/app/api/intelligence/alert/route.ts` |
| Lifecycle service fns (`transitionAlert`, `alertCompany`) | `src/lib/intelligence/intelligence-service.ts` (lower section only) |
| Risk Board UI | `src/app/intelligence/page.tsx` |
| Ack / Resolve / Dismiss buttons | `src/app/intelligence/AlertActions.tsx` |
| Active-company **cookie mirror** | `src/lib/company/useCompany.tsx` (cookie write only; provider stays active) |

**Decision: KEEP + FREEZE** (do not delete, do not extend, do not rebuild).
Rationale — engineering, not code: deleting now then re-creating in Batch 2 pays the cost twice
(delete → review → rebuild). The read path (`riskSummary`, `listRiskAlerts`) and `ProcessButton`
remain **active** — they are Batch 1, not lifecycle.

---

## 5b. Risk Contract Layer (V1) — enforcement boundary (added BEFORE Batch 2)

`src/lib/intelligence/risk-contract.ts` is the **single orchestration boundary** for
alert-state changes: a pure state machine + an injected `RiskAlertStore` port (zero
infrastructure coupling, unit-testable). UI/API must mutate alert state **only** through
its command interface — never inline, never bypassing the engine's lifecycle.

- **State machine:** `OPEN → ACKNOWLEDGED → RESOLVED`, and `OPEN / ACKNOWLEDGED → DISMISSED`.
- **Allowed transitions:** `OPEN→ACK`, `OPEN→DISMISS`, `ACK→RESOLVED`, `ACK→DISMISS`
  — **stricter** than the frozen `transitionAlert` (no direct `OPEN→RESOLVED`; must ACK first).
- **Commands (the only gateway):** `ackAlert()` · `resolveAlert()` · `dismissAlert()`
  (+ `dispatchAlertCommand`, and pure helpers `planTransition` / `canTransition`).
- **Status:** ADDITIVE, not yet wired. **Supersedes** the inline state machine in
  `intelligence-service.ts` once Batch 2 routes through it.

**Decision (ratified 2026-06-22):** AURA is **compliance-first** — traceability & state
correctness over UX shortcuts. Removing the `OPEN→RESOLVED` shortcut is deliberate: every
RESOLVED alert carries an ACK in its history ⇒ a clean audit trail for the future
AI/analytics/reasoning layer. Trade-off accepted (slightly more friction on low-value alerts).

**Deferred — do NOT build until real UX friction appears:** a *semantic* fast-resolution
flag, e.g. `resolveAlert({ mode: 'direct' | 'via_ack' })`, as **metadata/audit + UI hint
ONLY**. It must NOT add a state-machine edge — the contract stays strict.

### Layer stack (canonical)

```
[ UI ]
   ↓
AlertActions
   ↓
risk-contract.ts   ← ENFORCEMENT boundary (state legality; the only mutation gateway)
   ↓
risk-engine.ts     ← SCORING only
   ↓
event-store (system_events)
```

## 6. Batch 2 — wiring (lifecycle layer ONLY, when approved)

Batch 2 is **structural wiring, not features**:

1. **Wire-up layer** — `AlertActions` → contract commands only. Remove every direct
   service mutation; nothing bypasses `risk-contract.ts`.
2. **Persistence adapter** — a Supabase-backed `RiskAlertStore` implementation living
   *behind* the contract (the only place alert-state DB writes happen).
3. **Query layer** — risk-board filters (status/severity/domain) + `company_id` scoping
   become **derived read state ONLY — never a source of truth** for alert state.

**Critical:** the contract must stay an *enforcement boundary*, not a pass-through wrapper.
If any path mutates alert state without going through a command, Batch 2 has failed.

**Explicitly NOT in Batch 2:** ❌ Forecast ❌ Margin ❌ Memory ❌ Hermes.

---

### Batch 2 wiring — DONE (2026-06-22)

- **Adapter:** `src/lib/intelligence/risk-alert-store.ts` (`makeSupabaseAlertStore`) — the only place alert-state DB writes happen.
- **Dispatch:** `POST /api/intelligence/alert` → `dispatchAlertCommand` (contract) → adapter. The old inline `transitionAlert` is **deleted**; `intelligence-service.ts` is read-only again (kept `alertCompany` for the API company-access check).
- **UI derives from contract:** `AlertActions` uses `allowedActions(status)` — OPEN shows **Ack / Dismiss** (no direct Resolve), matching the strict machine.
- **Acceptance test PASSED:** the *only* writer of `status` is the adapter. The engine (`event-processor`) writes creation + score/severity/occurrence only — **never `status`** — and escalates active alerts only. No state mutation bypasses a command. ✅
- Typecheck green.

---

### Batch 2.5 — Read Projection Layer — DONE (2026-06-22)

Locks the *read* path the way Batch 2 locked the *write* path. `risk-query.ts` is a
**query compiler over Supabase** — it SHAPES data, never INTERPRETS it (severity/score/domain
read AS STORED; no recompute, no rules, no transitions).

- **Row primitive — `getRiskAlerts(RiskQueryInput)`:** filtering (company/status/severity/domain),
  `sort` (`'newest' | 'severity'`), and `limit`/`offset` pagination all pushed to **Supabase** (DB-side,
  no fetch-then-filter). `status` accepts an array (a pragmatic superset of the spec) so the board's
  `ACTIVE` maps to `status IN (OPEN, ACKNOWLEDGED)`.
- **Counts — `getRiskCounts(companyId)`:** lightweight column-only tally for the KPI chips
  (status totals + active bySeverity/byDomain). Scale upgrade = a DB aggregate RPC/view later.
- **Composite — `getRiskBoard`:** board view = `getRiskAlerts` (paginated list) + `getRiskCounts`
  (chips), fetched in parallel.
- **Dumb renderer:** `page.tsx` (server component); status/severity/domain **and sort** are
  **URL params** applied server-side. No client filtering, no recompute, no rules in the UI.
- **Consolidation:** `riskSummary` **and** `listRiskAlerts` removed — risk-query owns all board reads.
  `intelligence-service.ts` now holds recs/insights access + `alertCompany` only
  (`listRecommendations`/`listInsights` are **unwired**, pending their UI).
- **Read consistency:** board is `force-dynamic` (every render = fresh server projection) +
  `AlertActions` calls `router.refresh()` post-mutation → no stale/partial reads.

**Layer ownership:** alert reads (`risk-query` → Supabase) · recs/insights + company lookup
(`intelligence-service`) · render (`page`) · mutation (`risk-contract` → `risk-alert-store`).

---

## 7. Manual step — DONE (applied 2026-06-22)

Migrations applied on the live Supabase project: `20260622100000_events_upgrade.sql`,
`20260622110000_intelligence_layer.sql`, `20260622120000_risk_engine_phase2a.sql`.
Multi-company foundation repaired (`repair-multi-company.sql` — RLS policies + explicit
GRANTs + JEET group / 6 companies / member backfill + PostgREST reload). `/intelligence`
now renders the live board (no more "Setup required" card).

---

## 8. Runtime Verification — DONE (2026-06-22)

Verified against a **live Next 16 dev server + the real Supabase project** (not types alone).
Demo data was seeded through a temporary endpoint, exercised, then **fully removed** (7 demo
events + 7 alerts deleted; the temp seed route deleted). Multi-company foundation data kept.

### 8.1 Risk Engine V1 — RUNTIME VERIFIED
- 7 events (one per rule) → `POST /api/intelligence/process` → `{ processed: 7, riskAlerts: 7, errors: [] }`.
- Board rendered all 7 alerts across 5 domains; severities spread CRITICAL→MEDIUM exactly as scored.
- **Contract drives the UI:** OPEN alerts rendered **Ack ×7, Dismiss ×7, Resolve ×0** — i.e.
  `allowedActions(OPEN) = {ack, dismiss}`, no direct Resolve. The compliance-first rule holds at runtime.

### 8.2 Multi-Tenant Scoping — RUNTIME VERIFIED
Exercised via the real cookie path (`erp-active-company`), alerts tagged to JEET-CON:

| Active company (cookie) | Alerts shown | Expected |
|---|:---:|:---:|
| JEET-CON (owner)        | 7        | 7 ✅ |
| JEET-FIT (sibling)      | 0        | 0 ✅ |
| JEET-CON (return)       | 7        | 7 ✅ |
| random / non-member id  | 0        | 0 ✅ |
| no active company       | 7 (all)  | all ✅ |

Proves end-to-end in one cycle: **Company Switcher → cookie → `page.tsx` →
`getRiskBoard({companyId})` → `risk-query` `.eq('company_id')` → Board** = tenant isolation +
company context + company cookie + query scoping + UI scoping.

> **Scope caveat (honest):** this is **application-derived** read scoping (the query filters by
> `company_id`). Hard **row-level DB isolation** (RLS `company_id IN auth_company_ids()` on
> `intel_*`) is still **deferred to the Tenancy phase (Option B)** — the service-role read path is
> intentionally cross-company for the system/admin view. App-level scoping is verified; DB-level
> enforcement is not yet in place.
