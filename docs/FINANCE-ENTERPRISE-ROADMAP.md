# JEET ERP — Enterprise Finance Modules — Roadmap & Gap Analysis

The 12-module enterprise finance spec is a multi-phase program. This document
records what **already exists** (so we don't duplicate or break it), what's
**new**, and the build order. **Phase 1 (Budget & Cost Control) is delivered.**

> Architecture note: the codebase uses its **own UI kit** (`PageHeader`, `Card`,
> `Button`, `EmptyState`) + Tailwind v4 + Recharts — not shadcn/ui. New modules
> follow the existing kit to stay consistent and avoid breakage. Migrations are
> applied manually in Supabase, then `NOTIFY pgrst, 'reload schema';`.

## Gap analysis (spec vs. existing)

| # | Module | Status today | Plan |
|---|---|---|---|
| 1 | **Budget & Cost Control** | ❌ new | ✅ **DONE** (this phase) |
| 2 | Commitments | 🟡 `commitmentService` computes committed-by-system live (no table/page) | Add `cost_commitments` table + page; keep live calc as a source |
| 3 | Project Profitability | 🟡 `projectFinancialsService.computeProjectFinancials` exists | Add `/finance/project-profitability` list + `[id]` pages + charts (reuse service) |
| 4 | Bank Reconciliation | 🟡 `statementImportService` parses statements | New `bank_reconciliations` + lines, CSV/Excel import, auto/manual match |
| 5 | Retention Management | 🟡 `project_retention_ledger` + AR retention exist | New `/finance/retentions` view + `retention_forecasts`; reuse ledger |
| 6 | Treasury | ❌ new | New `treasury_facilities` (loans/guarantees/LC), maturity tracking |
| 7 | Project Cash Flow | 🟡 company `cashFlowService` (13-week) exists | New `/finance/project-cashflow` (per-project monthly in/out) |
| 8 | Petty Cash | 🟡 `payment_accounts` has PETTY_CASH type + expense capture | New `petty_cash_funds` + `petty_cash_transactions`, requests/replenish |
| 9 | Fixed Assets | 🟢 `fixedAssetService` + `depreciationService` + disposal exist | Surface under `/finance/assets` (reuse services); avoid rebuild |
| 10 | Financial Reports | 🟡 `accountingExportService` (journal CSV/Excel) exists | New `/finance/reports`: P&L, Balance Sheet, Trial Balance, GL, aging, by-project |
| 11 | Executive Dashboard | ❌ new (aggregation) | New `/finance/executive` aggregating cash/AR/AP/budget/profitability + alerts |
| 12 | AI Finance Agent | ❌ new | New `/finance/ai`: rule-based risk scoring first; LLM later |

**Important:** #9 Fixed Assets and #2/#3/#5/#7 partially exist — we **extend/surface**
them rather than recreate, per "do not break existing modules".

## Build order (recommended)

1. ✅ **Budget & Cost Control** — foundation; feeds variance, profitability, executive.
2. **Commitments** (table + page) — formalises the committed-cost source.
3. **Project Profitability** pages — thin UI over the existing service + Budget.
4. **Project Cash Flow** — per-project, reuses cashflow patterns.
5. **Retention Management** — view over the existing ledger + forecast.
6. **Financial Reports** — P&L/BS/TB/GL/aging (reads existing finance tables).
7. **Executive Dashboard** — aggregates 1–6 + cash + alerts.
8. **Petty Cash** — funds/transactions/replenishment.
9. **Bank Reconciliation** — import + matching.
10. **Treasury** — facilities/loans/guarantees/LC.
11. **Fixed Assets** — surface existing services under `/finance/assets`.
12. **AI Finance Agent** — risk scoring + recommendations on top of 1–11.

Each module ships: migration, TypeScript types, service, hook(s), dashboard +
list + detail pages, filters/search, export, Recharts, nav + Finance Hub link,
RBAC (Admin → Users, Roles & Permissions), and docs.

---

## Phase 1 delivered — Budget & Cost Control

**Routes:** `/finance/budget` (dashboard + list), `/finance/budget/[id]` (detail).

**Tables** (`20260614260000_project_budgets.sql`): `project_budgets`
(revisioned, DRAFT→APPROVED→SUPERSEDED, total_budget, contingency, approved_date)
and `project_budget_lines` (cost_category, system_name, boq_item_id, planned,
committed, actual, forecast, variance).

**Service** (`budgetService`): `createFromBoq(projectId)` (imports BOQ items as
planned-cost lines, new revision each time), `list()`, `get(id)`, `approve(id)`
(freeze + supersede prior). Committed cost is read **live** from
`commitmentService` (LPOs by system) and actual from `supplier_invoices` by
project, distributed to lines proportionally by planned cost; **forecast at
completion** = max(planned, committed, actual); variance = planned − forecast.

**Dashboard KPIs:** Budget Utilization %, Cost Variance, Forecast Profit, Cost
Overrun Alerts. **Detail:** KPI strip, cost-by-system bar chart (planned vs
committed vs forecast), per-line variance table, **Approve & Freeze**.

**Features covered:** import from BOQ ✅, revisions ✅, by-system ✅, by-category
(stored) ✅, forecast at completion ✅, variance analysis ✅, freeze after
approval ✅. Original-vs-revised compare and per-line manual editing are the next
small increments on this module.

**Wired into:** Finance sidebar ("Budget & Cost"). RBAC via the existing roles
system. No existing service or table was modified.
