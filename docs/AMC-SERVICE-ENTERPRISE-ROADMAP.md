# JEET ERP — AMC & Service — Enterprise Roadmap

Mirrors the Finance / Projects / Warehouse programs: extend AMC & Service with
enterprise analytics **without breaking existing flows** (ticket lifecycle, SLA
engine, PPM execution, AMC billing/renewal). New pages use the in-house UI kit
(`PageHeader`/`Card`/`Button`/`EmptyState` + Recharts) and the separate-lookup
data pattern. Most logic exists in services — the work is largely **surfacing
analytics** over tickets, visits and contracts.

## Build order (proposed 11-item program)

1. **Service & AMC Operations Dashboard** — unified KPIs (open tickets, SLA compliance, PPM due, active/expiring contracts, AMC revenue, overdue) + charts. `/service/dashboard` *(no migration)*.
2. **SLA Analytics & Compliance** — response/resolution compliance %, breaches by priority/system/technician, MTTR trend. `/service/sla` *(no migration)*.
3. **Technician Utilization & Dispatch** — open assignments + workload per technician, completion rate, dispatch board. `/service/technicians` *(no migration)*.
4. **PPM Compliance Dashboard** — scheduled vs completed visits, overdue/upcoming, by contract/system. `/service/ppm-compliance` *(no migration)*.
5. **AMC Renewals Pipeline** — contracts expiring 30/60/90, renewal value at risk, auto-renew + SIRA expiry. `/amc/pipeline` *(no migration)*.
6. **Contract Profitability** — annual value vs service cost (visits + tickets + parts) → margin per contract. `/amc/profitability` *(no migration)*.
7. **Equipment / Asset Register** — consolidated AMC equipment across contracts, condition, warranty, service history. `/amc/equipment` *(no migration)*.
8. **Spare Parts & Consumption** — parts used on tickets/visits, cost, by item/contract/period. `/service/parts` *(no migration)*.
9. **Client / Site Service History** — per client/site timeline of tickets, visits and contracts. `/service/history` *(no migration)*.
10. **AMC Billing & Revenue** — billing-schedule status (due/overdue/billed), recognised revenue, run due installments. `/amc/billing` *(no migration)*.
11. **Audit & Export Polish** — audit-log writes across new flows; PDF/Excel on all pages; hub + sidebar + controls wiring.

Each ships: service touch-ups as needed, page(s), filters/search, export
(PDF/Excel via `finance-export`), Recharts where useful, hub card + sidebar link,
RBAC (existing roles), audit logging, and a roadmap update.

## Status
- ✅ **Module report** (`AMC-SERVICE-MODULE-REPORT.md`) + this roadmap.
- ✅ **Phase 1 — Service & AMC Operations Dashboard** (`/service/dashboard`): unified KPIs (open tickets, SLA breaches/compliance, emergency, active contracts, AMC revenue, expiring, SIRA expiring, PPM open/overdue/completion), tickets-by-status/priority + PPM-by-status charts, attention banner, drill-through. PDF/Excel.
- ✅ **Phase 2 — SLA Analytics & Compliance** (`/service/sla`): response/resolution compliance %, breaches, MTTR, compliance-trend line, compliance-by-priority, breaches-by-system, per-technician compliance table; priority filter; PDF/Excel.
- ✅ **Phase 3 — Technician Utilization & Dispatch** (`/service/technicians`): per-technician open workload (tickets + PPM), throughput (done), SLA compliance; unassigned-ticket KPI; stacked workload chart; PDF/Excel.
- ✅ **Phase 4 — PPM Compliance Dashboard** (`/service/ppm-compliance`): scheduled vs completed, completion rate, overdue + due-this-month, by-status pie, completion-rate trend, lowest-completion-by-contract, action list with drill to execute. PDF/Excel.
- ✅ **Phase 5 — AMC Renewals Pipeline** (`/amc/pipeline`): contracts expiring ≤90d (and expired, not yet renewed) bucketed by window, value at risk, auto-renew + SIRA-expiry, value-by-window chart, drill-through, PDF/Excel.
- ✅ **Phase 6 — Contract Profitability** (`/amc/profitability`): annual value vs covered (non-chargeable) spare-parts cost + service activity (tickets/visits) → indicative margin per contract (labour not modelled). Revenue-vs-cost chart, margin %, low-margin KPI, PDF/Excel.
- ✅ **Phase 7 — Equipment / Asset Register** (`/amc/equipment`): consolidated AMC equipment across contracts with condition, by-system + by-condition charts, search/system/condition filters, per-equipment ticket-history count, PDF/Excel.
- ✅ **Phase 8 — Spare Parts & Consumption** (`/service/parts`): flattens ticket `parts_used` → total value, chargeable vs covered split, top items by value, monthly consumption trend, per-item table, PDF/Excel.
- ✅ **Phase 9 — Client / Site Service History** (`/service/history`): pick a client → unified reverse-chronological timeline of contracts + tickets + PPM visits, with summary KPIs and drill-through. PDF/Excel.
- ⏭ Then: AMC Billing → Polish.
