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
- ⏭ Next: **Service & AMC Operations Dashboard**.
