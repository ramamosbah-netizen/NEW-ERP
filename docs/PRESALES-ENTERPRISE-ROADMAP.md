# JEET ERP — Pre-Sales — Enterprise Roadmap

Mirrors the Finance / Projects / Warehouse / AMC programs: extend Pre-Sales with
enterprise analytics + a CRM layer **without breaking the existing tender → BOQ →
quotation → project chain**. New pages use the in-house UI kit (`PageHeader`/
`Card`/`Button`/`EmptyState` + Recharts) and the separate-lookup pattern. Most is
**analytics over existing data**; only the CRM client extension needs a migration.

## Build order (proposed 10-item program)

1. **Pre-Sales Dashboard** — funnel (tenders → BOQs → quotations → won), pipeline value, win rate, conversion %, upcoming deadlines, expiring quotes. `/sales/dashboard` *(no migration)*.
2. **Sales Pipeline (Opportunities)** — tenders by stage, value, by client/discipline, deadline awareness. `/sales/pipeline` *(no migration)*.
3. **Quotation Analytics** — by status & value, conversion, revisions, monthly trend, aging of pending. `/sales/quotations` *(no migration)*.
4. **Win / Loss Analysis** — won vs lost/superseded quotations, value, rejection reasons, by client. `/sales/win-loss` *(no migration)*.
5. **Estimation & Margin Analysis** — BOQ cost vs quotation price → margin per opportunity, margin distribution, profit components. `/sales/margin` *(no migration)*.
6. **Client Directory & 360 (CRM)** — clients list + create/edit + per-client 360 (tenders, quotes, projects, AMC). `/sales/clients` (+ `/[id]`) *(migration: extend clients with segment/industry/owner/status/notes)*.
7. **Tender Deadline Tracker** — upcoming & overdue submission deadlines, calendar-style list. `/sales/deadlines` *(no migration)*.
8. **Quotation Follow-ups & Validity** — sent awaiting response, days since sent, expiring quotes (valid_until). `/sales/follow-ups` *(no migration)*.
9. **Sales Performance (by owner)** — tenders + quotations by owner/preparer, win rate, value. `/sales/performance` *(no migration)*.
10. **Pre-Sales Hub + Audit & Export Polish** — `/sales` hub; audit on CRM writes; PDF/Excel across all pages; sidebar wiring.

Each ships: service touch-ups as needed, page(s), filters/search, export
(PDF/Excel via `finance-export`), Recharts where useful, sidebar link, RBAC,
audit logging where it writes, and a roadmap update.

## Status
- ✅ **Module report** (`PRESALES-MODULE-REPORT.md`) + this roadmap.
- ✅ **Phase 1 — Pre-Sales Dashboard** (`/sales/dashboard`): funnel (tenders→BOQs→quotations→won), pipeline value, win rate, conversion, pending quotes, deadline/validity alerts, value-by-status + value-trend charts. PDF/Excel.
- ✅ **Phase 2 — Sales Pipeline (Opportunities)** (`/sales/pipeline`): tenders by stage (count + value strip), value-by-stage + value-by-discipline charts, search/stage filters, table with deadline highlighting and drill-through. PDF/Excel.
- ✅ **Phase 3 — Quotation Analytics** (`/sales/quotations`): KPIs (count, value, won value, win rate, revised/avg revision), count-by-status pie, issued-value trend, value-by-status, pending-quote aging buckets. PDF/Excel.
- ✅ **Phase 4 — Win / Loss Analysis** (`/sales/win-loss`): won vs lost counts + value, win rate by count and by value, reasons-for-loss chart, won-vs-lost-by-client chart, lost-quotations table. PDF/Excel.
- ✅ **Phase 5 — Estimation & Margin Analysis** (`/sales/margin`): per-BOQ estimated cost/profit/sell + margin % from `boqs.financials`, margin-distribution histogram, cost-component pie (supply/labour/equipment/subcontract/logistics/overhead), table with linked quotation value, drill to BOQ. PDF/Excel.
- ✅ **Phase 6 — Client Directory & 360 (CRM)** (`/sales/clients` + `/[id]`): client list with CRM segmentation (segment/industry/owner/status), per-client quoted + active-AMC rollups, search/segment/status filters, create/edit modal, and a 360 detail (profile + tenders + quotations + AMC). New `clientService` (CRUD with PGRST204 fallback + get360, audit), migration `20260615260000_clients_crm_fields` (additive; page degrades gracefully). PDF/Excel.
- ⏭ Then: Deadlines → Follow-ups → Performance → Hub/Polish.
