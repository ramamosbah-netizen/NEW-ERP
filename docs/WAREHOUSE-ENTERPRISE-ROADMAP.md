# JEET ERP — Warehouse & Inventory — Enterprise Roadmap

Mirrors the Finance and Projects programs: extend Warehouse & Inventory with
enterprise capabilities **without breaking existing flows** (GRN→stock,
issue→project costing, supplier register, movement ledger). New pages follow the
existing UI kit (`PageHeader`/`Card`/`Button`/`EmptyState` + Recharts) and the
separate-lookup data pattern. Most logic already exists in services — the work is
largely **surfacing it** plus a dashboard and replenishment.

## Build order (authoritative 11-item program)

1. **Inventory Dashboard** — KPIs (value, SKUs, locations, out/low/dead) + charts (value by category/system, receipts vs issues trend, top movers). `/warehouse/dashboard` *(no migration)*.
2. **Stock Count / Stock-take UI** — surface `stockCountService`: start count per location, enter counted qty, see variance + value, post adjustments. `/warehouse/stock-count` *(no migration)*.
3. **Material Requisition (MRF) UI** — surface `mrfService`: raise from project, approve qty, issue (→ stock out + project cost), return from site. `/warehouse/mrf` *(no migration)*.
4. **Replenishment Planning** — items at/below reorder level → suggested order qty, grouped by preferred supplier, export / hand-off to PR. `/warehouse/replenishment` *(no migration)*.
5. **Inventory Aging** — value bucketed by age since last movement (0–30/31–90/91–180/180+) by category/location; PDF/Excel. `/warehouse/aging` *(no migration)*.
6. **Dead Stock Dashboard** — `getDeadStockReport` (no movement N days) with value at risk, drill-down + write-off shortcut; PDF/Excel. `/warehouse/dead-stock` *(no migration)*.
7. **Serial Tracking** — `getSerialUnits`: filter by status/location/project; warranty expiry; per-serial history. `/warehouse/serials` *(migration only if schema gaps)*.
8. **Installed Assets Tracking** — serials/items INSTALLED at project sites: what is deployed where, warranty, link to handover/DLP. `/warehouse/installed` *(migration if needed)*.
9. **Material Forecasting** — projected demand from open MRFs / BOQ vs on-hand → shortfall per item; reorder lead-time view. `/warehouse/forecast` *(no migration)*.
10. **Inventory GL Integration** — map stock movements to GL postings (inventory/COGS/WIP), period summary + export for accounting. `/warehouse/gl` *(migration for mapping table)*.
11. **Audit & Export Polish** — audit-log writes on count/MRF/serial/location changes; PDF/Excel across all pages; hub + sidebar + controls wiring.

Each ships: types/service touch-ups as needed, page(s), filters/search, export
(PDF/Excel via `finance-export`), Recharts where useful, hub card + sidebar link,
RBAC (existing roles), audit logging, and a roadmap update.

## Status
- ✅ **Module report** (`WAREHOUSE-MODULE-REPORT.md`) + this roadmap.
- ✅ **Phase 1 — Inventory Dashboard** (`/warehouse/dashboard`).
- ✅ **Phase 2 — Stock Count / Stock-take** (`/warehouse/stock-count` + `/[id]`). Also hardened broken embeds in stockCountService + stockService (getMovementLedger, getSerialUnits).
- ✅ **Phase 3 — Material Requisitions (MRF)** (`/warehouse/mrf` + `/[id]`): create (draft/submit) → approve (reserve) → issue (→ project cost). Hardened material_requisitions embeds in mrfService.
- ✅ **Phase 4 — Replenishment Planning** (`/warehouse/replenishment`): items ≤ reorder level → suggested qty (reorder_qty or shortfall), grouped by preferred supplier, est. value chart, editable qty, PDF/Excel for PR hand-off.
- ✅ **Phase 5 — Inventory Aging** (`/warehouse/aging`): value bucketed by age since last movement (0–30/31–90/91–180/180+), location + category filters, bucket chart + summary + item table, PDF/Excel.
- ✅ **Phase 6 — Dead Stock Dashboard** (`/warehouse/dead-stock`): no-movement-for-N-days (90/180/365) with capital tied up, dead-value-by-category chart, and a one-click WRITE_OFF shortcut. PDF/Excel.
- ✅ **Phase 7 — Serial Tracking** (`/warehouse/serials`): per-serial lifecycle (in store/issued/installed/faulty/returned), location, project, warranty-expiry highlighting; status/location/search filters; KPIs; PDF/Excel.
- ✅ **Phase 8 — Installed Assets Tracking** (`/warehouse/installed`): serialized assets deployed (issued/installed) per project site, deployed-by-project chart, warranty ≤90d / expired KPIs (feeds DLP), project filter, PDF/Excel.
- ✅ **Phase 9 — Material Forecasting** (`/warehouse/forecast`): open MRF demand (un-issued lines) vs on-hand available → net position + shortfall to procure per item, top-shortfalls chart, shortfalls-only toggle, PDF/Excel. Demand-driven complement to reorder-level Replenishment.
- ⏭ Then: GL Integration → Polish.
