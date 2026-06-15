# JEET ERP — Pre-Sales Enterprise Program — Completion Report

Status: **all 10 modules delivered** on branch `feature-update`. Built additively
on the existing tender → BOQ → quotation → project chain — **no existing business
logic was changed or removed**. New pages use the in-house UI kit (`PageHeader`/
`Card`/`Button`/`EmptyState` + Recharts) and the separate-lookup pattern. Every
analytics page exports to **PDF + Excel** via `src/lib/finance-export.ts`.

The headline addition is the **first-ever Client/CRM layer** — there was no
clients UI at all — plus pipeline, win/loss, margin and follow-up analytics over
data the tender/quotation system already produces.

---

## 1. Modules

| # | Module | Route | Source |
|---|--------|-------|--------|
| 1 | Pre-Sales Dashboard | `/sales/dashboard` | tenders + boqs + quotations |
| 2 | Sales Pipeline | `/sales/pipeline` | tenders |
| 3 | Quotation Analytics | `/sales/quotations` | quotations |
| 4 | Win / Loss Analysis | `/sales/win-loss` | quotations |
| 5 | Estimation & Margin Analysis | `/sales/margin` | boqs.financials + quotations |
| 6 | Client Directory & 360 (CRM) | `/sales/clients` (+ `/[id]`) | clients + tenders + quotations + amc |
| 7 | Tender Deadline Tracker | `/sales/deadlines` | tenders |
| 8 | Quotation Follow-ups & Validity | `/sales/follow-ups` | quotations |
| 9 | Sales Performance (by owner) | `/sales/performance` | tenders + quotations + profiles |
| 10 | Pre-Sales Hub + Audit & Export Polish | `/sales` | reuses above |
| + | **Competitor Tracking** (add-on) | `/sales/competitors` | competitors + tender_competitors |

All pages are linked in the sidebar **Sales & Projects** group; `/sales` is the hub.

### Add-on — Competitor Tracking (`/sales/competitors`)

Captures **who won the job**, the **competitor's estimated price**, and the **reason
we lost**, on two new tables (`competitors`, `tender_competitors`). Competitive-
intelligence KPIs (competitors tracked, jobs lost to competitors, value lost,
toughest competitor), jobs-won-by-competitor + reasons-for-loss charts, a two-tab
UI (competitor directory + competitive log) with full CRUD, and PDF/Excel.
New `competitorService` (audit-logged; lists degrade to `[]` before migration).

---

## 2. Migrations to apply (Supabase SQL editor)

Two migrations, both safe to apply any time (the pages degrade gracefully without
them — `clientService` has a PGRST204 fallback; `competitorService` returns `[]`):

1. `supabase/migrations/20260615260000_clients_crm_fields.sql` — adds `segment, industry, owner_name, status, website, trn, notes` to `clients`.
2. `supabase/migrations/20260615280000_competitor_tracking.sql` — `competitors` + `tender_competitors` (who won, estimated price, reason for loss).

Everything else computes over existing tables (`tenders`, `boqs`, `quotations`,
`amc_contracts`, `profiles`).

---

## 3. Business logic highlights

- **Won/Lost/Pending** derived consistently across pages: won = quotation `ACCEPTED` / `client_response=ACCEPTED` / linked to a project; lost = `REJECTED` or has a rejection reason; pending = anything else except `SUPERSEDED`.
- **Funnel:** tenders → BOQs → quotations → won, with pipeline value (open tender budgets) and conversion (won ÷ tenders).
- **Margin:** per-BOQ cost (`direct_total + indirect_total`), profit (`profit_value`) and margin % from `boqs.financials`, with a cost-component breakdown.
- **CRM 360:** one client's tenders (by name), quotations and AMC contracts (by client_id) in one view, with quoted/won/active-AMC rollups.
- **Follow-ups:** pending quotes bucketed by awaiting-response (days waiting), expiring ≤14d, expired, not-sent.

---

## 4. Cross-cutting

- **Audit:** the new write path (CRM client create/update) is audit-logged via `clientService` (module `Sales`). Tender/quotation execution was left untouched (no inline-page audit added).
- **Exports:** every analytics page exposes PDF + Excel.
- **RBAC:** all routes under `/sales/*`; restricted roles remain scoped by the `routeAccess` allowlist, operational roles keep full access.

---

## 5. Verification

- `npx tsc --noEmit --skipLibCheck` → **0 source errors** after every phase.
- One commit per module on `feature-update` for easy review/rollback.
