# JEET ERP — AMC & Service — Current-State Report

Scope: `src/app/{service-desk, amc, ppm}/*`, `src/services/{ticketService,
slaService, visitService, amcService, amcBillingService, ppmScheduleService,
maintenanceService, visitReportPDFService, kpiService, supplierPerformanceService}.ts`,
`src/types/{ticket.types, amc.types}.ts`.

## 1. Pages (UI today)

| Route | Purpose |
|-------|---------|
| `/service-desk` | Ticket **Kanban board** (New→Assigned→In&nbsp;Progress→On&nbsp;Hold→Resolved→Closed) with live **SLA clocks**, assign/dispatch |
| `/service-desk/new` | Create ticket (intake channel, client/contract, system, priority, coverage) |
| `/service-desk/[id]` | Ticket detail — lifecycle actions, parts, resolution, client sign-off |
| `/amc` | AMC contract list + KPI grid (active, expiring, total annual value) |
| `/amc/create` | New contract (systems, coverage matrix, SLA tier, visits/yr, billing, equipment) |
| `/amc/renewal` | Renewal workspace |
| `/amc/[id]` | Contract detail — equipment, billing schedule, visits, lifecycle |
| `/ppm/calendar` | PPM visit calendar/schedule |
| `/ppm/execute/[id]` | Execute a PPM visit (checklist, results, report) |

Sidebar group (between Procurement/Warehouse): **Service Desk**, **PPM Schedule**, **AMC Contracts**.

## 2. Data model

- **ServiceTicket** — full lifecycle (NEW…CLOSED/CANCELLED/DUPLICATE); priority (LOW…EMERGENCY); coverage (COVERED/CHARGEABLE/WARRANTY); **SLA fields** (response/resolution due, pause tracking, response_met/resolution_met); technician; parts_used; client signature; chargeable quote + invoice links; intake channel (incl. WHATSAPP).
- **AMCContract** — type (COMPREHENSIVE/NON_COMP/LABOUR_ONLY), systems[], coverage_matrix, parts cap, **visits_per_year**, **SLA tier + response/resolution hours**, emergency callouts, **annual_value**, billing_frequency, start/end, auto_renewal, **SIRA linkage + expiry**, status (DRAFT…EXPIRED/RENEWED/TERMINATED), renewal links.
- **AMCEquipment** — per-contract asset (system, type, brand, model, serial, location, install date, condition).
- **AMCBillingSchedule** — installment plan from billing frequency.
- **PPMVisit** + **ChecklistTemplate/Result** — scheduled preventive visits with system checklists.

## 3. Services (logic today)

- **ticketService** — create, assign, dispatch, pause-for-parts, resume, resolve, close, comment (full lifecycle + events).
- **slaService** — business-time SLA due-date calc, pause/resume minutes, breach detection, countdown text.
- **visitService** — schedule/start/complete PPM visits, checklist templates + results.
- **ppmScheduleService** — auto-generate PPM visits for a contract (from visits_per_year).
- **amcService** — contract CRUD, activate, add equipment, convert quotation→AMC / project→AMC, renew.
- **amcBillingService** — generate billing schedule, process due installments.
- **maintenanceService**, **visitReportPDFService**, **kpiService** (SLA compliance rate), **supplierPerformanceService**.

## 4. Business logic highlights

- **SLA**: business-hours/holiday-aware response & resolution deadlines; clock pauses on "On Hold (parts)"; met/breached flags on resolve.
- **AMC lifecycle**: quotation/project → AMC; activate generates billing schedule + PPM visits; renewal chains contracts; SIRA expiry tracked.
- **Coverage → billing**: COVERED vs CHARGEABLE tickets; chargeable → quote → invoice.

## 5. Gap analysis (build targets)

| # | Capability | Status today |
|---|-----------|--------------|
| 1 | **Unified Ops Dashboard** (tickets + SLA + PPM + contracts + revenue) | ❌ none |
| 2 | **SLA Analytics & Compliance** (trends, breaches by priority/tech/system, MTTR) | 🟡 per-ticket clocks only |
| 3 | **Technician Utilization & Dispatch** (workload, completion) | ❌ none |
| 4 | **PPM Compliance** (scheduled vs done, overdue, upcoming) | 🟡 calendar only |
| 5 | **AMC Renewals Pipeline** (30/60/90, value, SIRA expiry) | 🟡 renewal page exists |
| 6 | **Contract Profitability** (annual value vs service cost) | ❌ none |
| 7 | **Equipment / Asset Register** (consolidated, condition, history) | 🟡 per-contract only |
| 8 | **Spare Parts & Consumption** (parts used, cost, by item/contract) | 🟡 captured on tickets |
| 9 | **Client / Site Service History** (tickets+visits+contracts timeline) | ❌ none |
| 10 | **AMC Billing & Revenue** (due/overdue installments, recognised) | 🟡 service exists |
| 11 | **Audit & Export Polish** | 🟡 partial |

**Reuse, don't rebuild:** SLA engine, ticket lifecycle, PPM execution and AMC
billing all exist — the program is mostly **analytics + cross-cutting dashboards**
over data the services already produce.
