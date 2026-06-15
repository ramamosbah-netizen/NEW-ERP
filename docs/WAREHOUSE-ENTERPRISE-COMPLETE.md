# JEET ERP — Warehouse & Inventory Enterprise Program — Completion Report

Status: **all 11 modules delivered** on branch `feature-update`. Built additively
on the existing warehouse flow (GRN→stock, issue→project costing, supplier
register, movement ledger) — **no existing business logic was changed or removed**.
New pages follow the in-house UI kit (`PageHeader`/`Card`/`Button`/`EmptyState`
+ Recharts) and the separate-lookup data pattern. Every new list/report exports
to **PDF + Excel** via `src/lib/finance-export.ts`.

A large part of the value was **surfacing logic that already existed in services
but had no UI** (stock count, MRF, dead-stock, serials), and **hardening broken
PostgREST embeds** discovered by probing the live DB.

---

## 1. Modules

| # | Module | Route | Migration | Source |
|---|--------|-------|-----------|--------|
| 1 | Inventory Dashboard | `/warehouse/dashboard` | — | `getStock` + plain trend query |
| 2 | Stock Count / Stock-take | `/warehouse/stock-count` (+ `/[id]`) | — | `stockCountService` |
| 3 | Material Requisitions (MRF) | `/warehouse/mrf` (+ `/[id]`) | — | `mrfService` |
| 4 | Replenishment Planning | `/warehouse/replenishment` | — | `getStockItems` + `getStock` |
| 5 | Inventory Aging | `/warehouse/aging` | — | `getStock` |
| 6 | Dead Stock Dashboard | `/warehouse/dead-stock` | — | `getDeadStockReport` |
| 7 | Serial Tracking | `/warehouse/serials` | — | `getSerialUnits` |
| 8 | Installed Assets Tracking | `/warehouse/installed` | — | `getSerialUnits` (deployed) |
| 9 | Material Forecasting | `/warehouse/forecast` | — | open MRF demand vs stock |
| 10 | Inventory GL Integration | `/warehouse/gl` | `20260615240000_inventory_gl_mappings` | `inventoryGlService` |
| 11 | Audit & Export Polish | (cross-cutting) | — | audit on MRF + stock-count |

All pages are linked from the **Warehouse hub** (`/warehouse`) and the sidebar
**Warehouse & Inventory** group.

---

## 2. Migrations to apply (Supabase SQL editor)

Only **one** migration is required for this program; everything else computes over
existing tables.

1. `supabase/migrations/20260615240000_inventory_gl_mappings.sql` — GL account mapping table + seed + RLS.

The GL page falls back to built-in default mappings until this is applied, so it
works immediately; applying the migration lets you **persist** edited mappings.

---

## 3. Embed fixes (hardening)

PostgREST embeds were probed against the live DB; the following had **no FK** and
were 400-ing (PGRST200). All replaced with batched separate keyed lookups (output
shape unchanged):

- `stock_counts → profiles` (counter name) — `stockCountService`
- `stock_transactions → projects / profiles` — `stockService.getMovementLedger`
- `serial_units → projects` — `stockService.getSerialUnits`
- `material_requisitions → projects / profiles` — `mrfService` (preserving the `projects.boq_id` shape `issueMRF` relies on)

Embeds that **were** valid (kept as-is): `stock_balances → stock_items / stock_locations`,
`mrf_items → stock_items`, `stock_counts → stock_locations`, `serial_units → stock_locations`.

---

## 4. Business logic highlights

- **Stock count:** freeze location balances as baseline → enter counts → live variance × WAC → post `ADJUSTMENT_IN/OUT` to the ledger (blocked while recount flags are set).
- **MRF:** create (draft/submit) → approve (reserve stock) → issue (`ISSUE_TO_PROJECT`, decrement on-hand + reserved, update project actual cost, BOQ-overrun event).
- **Replenishment** (supply-driven): items ≤ reorder level → suggested qty (reorder_qty or shortfall) grouped by preferred supplier.
- **Forecasting** (demand-driven): open MRF outstanding demand vs available → net position + shortfall to procure.
- **Aging / Dead stock:** value bucketed by age since last movement; dead stock = no movement N days + qty>0, with one-click write-off.
- **GL:** movement type → Dr/Cr accounts; period journal with debit/credit totals; transfers flagged no-impact.

---

## 5. Cross-cutting

- **Audit:** stock-count start/post and MRF create/approve/issue now write audit events (module `Warehouse`), alongside the existing movement events.
- **Exports:** every report/list exposes PDF + Excel via the shared helper.
- **RBAC:** all routes under `/warehouse/*`; restricted roles remain scoped by the `routeAccess` allowlist, operational roles keep full access.

---

## 6. Verification

- `npx tsc --noEmit --skipLibCheck` → **0 source errors** after every phase.
- Each phase committed and pushed independently on `feature-update` for easy review/rollback.
