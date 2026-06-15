# JEET ERP — Warehouse & Inventory — Enterprise Roadmap

Mirrors the Finance and Projects programs: extend Warehouse & Inventory with
enterprise capabilities **without breaking existing flows** (GRN→stock,
issue→project costing, supplier register, movement ledger). New pages follow the
existing UI kit (`PageHeader`/`Card`/`Button`/`EmptyState` + Recharts) and the
separate-lookup data pattern. Most logic already exists in services — the work is
largely **surfacing it** plus a dashboard and replenishment.

## Build order

1. **Inventory Dashboard** — KPIs (total value, SKUs, locations, out/low/dead counts) + charts (value by location/category, movement trend, top movers). Reuses valuation/balances/ledger. `/warehouse/dashboard` *(no migration)*.
2. **Stock Count / Stock-take** — surface `stockCountService`: start count per location, enter counted qty, see variance + value, post adjustments. `/warehouse/stock-count` *(no migration)*.
3. **Material Requisition (MRF)** — surface `mrfService`: raise from project, approve qty, issue (→ stock out + project cost), return from site. `/warehouse/mrf` *(no migration)*.
4. **Valuation & Aging report** — `getValuationReport` + aging buckets by last movement; by location/category; PDF/Excel. `/warehouse/valuation` *(no migration)*.
5. **Dead-stock report** — `getDeadStockReport` (no movement N days) with value at risk; PDF/Excel. `/warehouse/dead-stock` *(no migration)*.
6. **Serial-number tracking** — `getSerialUnits`: filter by status/location/project; warranty expiry; per-serial history. `/warehouse/serials` *(no migration unless schema gaps)*.
7. **Reorder / Replenishment planning** — items at/below reorder level → suggested order qty (reorder_qty or to-max), grouped by preferred supplier, export / hand-off to PR. `/warehouse/replenishment` *(no migration)*.
8. **Locations management** — admin list of stock locations (type, custodian, project, active), create/edit. `/warehouse/locations` *(no migration)*.
9. **Audit & export polish** — audit-log writes on count/MRF/serial/location changes; PDF/Excel across all new pages; hub + sidebar wiring.

Each ships: types/service touch-ups as needed, page(s), filters/search, export
(PDF/Excel via `finance-export`), Recharts where useful, hub card + sidebar link,
RBAC (existing roles), audit logging, and a roadmap update.

## Status
- ✅ **Module report** (`WAREHOUSE-MODULE-REPORT.md`) + this roadmap.
- ⏭ Next: **Inventory Dashboard**.
