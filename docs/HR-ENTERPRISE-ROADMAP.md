# JEET ERP — HR & Workforce — Enterprise Roadmap

Mirrors the other programs: extend HR & Workforce with enterprise analytics + a
UAE compliance-expiry dashboard **without breaking the payroll/leave/timesheet/EOSB
execution**. New pages use the in-house UI kit + Recharts and the separate-lookup
pattern. All analytics over existing tables — **no migrations**.

## Build order (proposed 10-item program)

1. **HR & Workforce Dashboard** — headcount, by department/type, compliance alerts (expiries due), payroll cost, leave/timesheet pending. `/hr/dashboard` *(no migration)*.
2. **Document Compliance & Expiry Tracker** — visa / labour card / EID / passport / insurance / licence / probation expiries bucketed by urgency. `/hr/compliance-tracker` *(no migration)*.
3. **Workforce Analytics** — by department / nationality / employment type / designation, tenure and status mix. `/hr/workforce` *(no migration)*.
4. **Payroll Analytics** — run history, cost trend, gross/net/OT/deductions breakdown, by department. `/payroll/analytics` *(no migration)*.
5. **Leave Analytics** — by type / status / department, pending queue, working days. `/hr/leave-analytics` *(no migration)*.
6. **Timesheet & Utilization** — hours & OT logged, by employee / project, approval status. `/timesheets/analytics` *(no migration)*.
7. **Project Labour Cost** — labour cost by project (from project_labour_costs). `/hr/labour-cost` *(no migration)*.
8. **End-of-Service Liability** — EOSB/gratuity accrual across the workforce. `/payroll/eosb-liability` *(no migration)*.
9. **Headcount by Project / Manpower** — employee distribution by assigned project. `/hr/manpower` *(no migration)*.
10. **HR Hub + Audit & Export Polish** — `/hr` hub with attention strip; PDF/Excel across all; sidebar wiring.

Each ships: page(s), filters/search, export (PDF/Excel via `finance-export`),
Recharts where useful, sidebar link, RBAC (existing roles), and a roadmap update.

## Status
- ✅ **Module report** (`HR-MODULE-REPORT.md`) + this roadmap.
- ✅ **Phase 1 — HR & Workforce Dashboard** (`/hr/dashboard`): headcount, departments, latest payroll cost, UAE doc-expiry alerts (expired / ≤30d / 31–90d across visa/labour-card/EID/passport/insurance/licence), leave + timesheet pending, headcount-by-department + by-employment-type charts, attention banner. PDF/Excel.
- ✅ **Phase 2 — Document Compliance & Expiry Tracker** (`/hr/compliance-tracker`): flattens every employee document expiry (visa/labour-card/EID/passport/medical+ILOE insurance/licence) into rows bucketed by urgency (Expired/≤30/31–60/61–90/Valid); clickable KPI filters, expired+expiring-by-document chart, search + document + status filters, table sorted by soonest, drill to employee. PDF/Excel.
- ⏭ Then: Workforce → Payroll → Leave → Timesheets → Labour Cost → EOSB → Manpower → Hub/Polish.
