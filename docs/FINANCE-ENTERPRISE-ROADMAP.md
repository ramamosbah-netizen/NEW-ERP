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
| 1 | **Budget & Cost Control** | ❌ new | ✅ **DONE** |
| 2 | **Commitments** | 🟡 `commitmentService` (by-system) existed | ✅ **DONE** — `cost_commitments` table + `commitmentLedgerService` (unifies LPO/payroll/manual) + `/finance/commitments` |
| 3 | **Project Profitability** | 🟡 `projectFinancialsService` existed | ✅ **DONE** — `/finance/project-profitability` list + `[id]` charts (reuses service) |
| 4 | **Bank Reconciliation** | 🟡 `statementImportService` existed | ✅ **DONE** — `bank_reconciliations` + lines, CSV/Excel import, auto-match (client/supplier payments), manual match/charge/adjustment |
| 5 | **Retention Management** | 🟡 `project_retention_ledger` existed | ✅ **DONE** — `/finance/retentions` view over the ledger (held/released/net, release schedule, overdue) |
| 6 | **Treasury** | ❌ new | ✅ **DONE** — `treasury_facilities` (loans/overdrafts/guarantees/LCs), limit-vs-utilization, maturity/expiry tracking, `/finance/treasury` |
| 7 | **Project Cash Flow** | 🟡 company `cashFlowService` existed | ✅ **DONE** — `/finance/project-cashflow` (per-project monthly in/out + cumulative) |
| 8 | **Petty Cash** | 🟡 PETTY_CASH account type existed | ✅ **DONE** — `petty_cash_funds` + `petty_cash_transactions` (expense claims, approvals, replenish/return), `/finance/petty-cash` |
| 9 | Fixed Assets | 🟢 `fixedAssetService` + `depreciationService` + disposal exist | Surface under `/finance/assets` (reuse services); avoid rebuild |
| 10 | **Financial Reports** | 🟡 `accountingExportService` existed | ✅ **DONE** — `/finance/reports`: P&L, Trial Balance, GL, cost/revenue by project, aging links, CSV export (Balance Sheet pending a COA map) |
| 11 | **Executive Dashboard** | ❌ new | ✅ **DONE** — `/finance/executive`: cash/AR/AP/commitments/profit KPIs, cash & revenue trends, aging, project margin, risk alerts |
| 12 | AI Finance Agent | ❌ new | New `/finance/ai`: rule-based risk scoring first; LLM later |

**Important:** #9 Fixed Assets and #2/#3/#5/#7 partially exist — we **extend/surface**
them rather than recreate, per "do not break existing modules".

## Build order (recommended)

1. ✅ **Budget & Cost Control** — foundation; feeds variance, profitability, executive.
2. ✅ **Commitments** (table + unified ledger + page).
3. ✅ **Project Profitability** pages (list + detail charts).
4. ✅ **Project Cash Flow** — per-project monthly in/out + cumulative.
5. ✅ **Retention Management** — view over the existing ledger.
6. ✅ **Financial Reports** — P&L/TB/GL/by-project/aging links + CSV.
7. **Executive Dashboard** — aggregates 1–6 + cash + alerts. ← next
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
