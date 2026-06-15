# JEET ERP — Procurement — Enterprise Roadmap

Mirrors the Finance / Projects / Warehouse / AMC / Pre-Sales programs: extend
Procurement with enterprise analytics **without breaking the source-to-pay chain**
(PR → RFQ → comparison → PO → GRN → invoice). New pages use the in-house UI kit
(`PageHeader`/`Card`/`Button`/`EmptyState` + Recharts) and the separate-lookup
pattern. Everything is **analytics over existing tables** — no migrations.

## Build order (proposed 10-item program)

1. **Procurement Dashboard** — spend (committed), PR/PO/GRN status, pending receipts, match exceptions, suppliers + funnel. `/procurement/dashboard` *(no migration)*.
2. **Spend Analysis** — PO spend by supplier / category / project / month, top suppliers. `/procurement/spend` *(no migration)*.
3. **Supplier Performance Leaderboard** — on-time delivery, PO volume/value, match rate, across suppliers. `/procurement/suppliers` *(no migration)*.
4. **PO Delivery Tracking** — open POs, delivery status, overdue vs required date, ack status. `/procurement/deliveries` *(no migration)*.
5. **PR Pipeline & Cycle Time** — PR status funnel, approval turnaround, conversion to PO. `/procurement/pr-pipeline` *(no migration)*.
6. **Three-Way Match Exceptions** — supplier invoices by match status, mismatches to resolve. `/procurement/match` *(no migration)*.
7. **Goods Receipt (GRN) Analytics** — receipts over time, pending receipts (PO sent not received), by project/supplier. `/procurement/grn-analytics` *(no migration)*.
8. **Savings & Comparison Analysis** — comparison awards: lowest vs awarded, savings captured. `/procurement/savings` *(no migration)*.
9. **Payables Overview (procurement AP)** — supplier invoices by status/due/overdue, value by supplier. `/procurement/payables` *(no migration)*.
10. **Procurement Hub + Audit & Export Polish** — `/procurement` hub with attention strip; PDF/Excel across all; sidebar wiring.

Each ships: page(s), filters/search, export (PDF/Excel via `finance-export`),
Recharts where useful, sidebar link, RBAC (existing roles), and a roadmap update.

## Status
- ✅ **Module report** (`PROCUREMENT-MODULE-REPORT.md`) + this roadmap.
- ✅ **Phase 1 — Procurement Dashboard** (`/procurement/dashboard`): KPIs (committed PO spend, open POs, PRs pending, suppliers, pending receipts, overdue deliveries, GRNs, match exceptions), source-to-pay funnel, PO-spend trend, PO-by-status chart, attention banner. PDF/Excel.
- ✅ **Phase 2 — Spend Analysis** (`/procurement/spend`): committed-vs-all scope, spend by supplier/project/type + monthly trend, supplier-spend table with % of total. PDF/Excel.
- ✅ **Phase 3 — Supplier Performance Leaderboard** (`/procurement/suppliers`): per-supplier PO volume/value, delivery completion %, overdue, invoice-match exceptions; active-only toggle, PO-value chart, leaderboard table linking to each supplier's scorecard. PDF/Excel.
- ⏭ Then: Deliveries → PR Pipeline → Match → GRN → Savings → Payables → Hub/Polish.
