# JEET ERP — HR & Workforce — Enterprise Roadmap

Mirrors the other programs: extend HR & Workforce with enterprise analytics + a
UAE compliance-expiry dashboard **without breaking the payroll/leave/timesheet/EOSB
execution**. New pages use the in-house UI kit + Recharts and the separate-lookup
pattern. All analytics over existing tables — **no migrations**.

## Build order (authoritative 14-item program)

1. **HR & Workforce Dashboard** — `/hr/dashboard` *(no migration)*.
2. **Document Compliance & Expiry Tracker** — `/hr/compliance-tracker` *(no migration)*.
3. **Workforce Analytics** — `/hr/workforce` *(no migration)*.
4. **Payroll Analytics** — `/payroll/analytics` *(no migration)*.
5. **Leave Analytics** — `/hr/leave-analytics` *(no migration)*.
6. **Timesheet & Utilization** — `/timesheets/analytics` *(no migration)*.
7. **Project Labour Cost** — `/hr/labour-cost` *(no migration)*.
8. **EOSB Liability** — `/payroll/eosb-liability` *(no migration)*.
9. **Manpower Dashboard** — headcount/cost by assigned project, deployed vs bench. `/hr/manpower` *(no migration)*.
10. **Certification Tracker** — employee certifications + expiry (surface `employee_certifications`). `/hr/certifications` *(no migration)*.
11. **Training & Competency Matrix** — skills/competency per employee × skill, gaps. `/hr/competency` *(migration: training records + competency matrix)*.
12. **Attendance & GPS** — daily attendance check-in/out with geolocation, summaries. `/hr/attendance` *(migration: attendance table)*.
13. **Employee Documents Center** — central document register per employee (IDs, contracts, certs) with expiry. `/hr/documents` *(migration: employee_documents table)*.
14. **HR Hub + Audit & Export Polish** — `/hr/hub` with attention strip; audit on new writes; PDF/Excel across all.

Each ships: page(s), filters/search, export (PDF/Excel via `finance-export`),
Recharts where useful, sidebar link, RBAC (existing roles), and a roadmap update.

## Status
- ✅ **Module report** (`HR-MODULE-REPORT.md`) + this roadmap.
- ✅ **Phase 1 — HR & Workforce Dashboard** (`/hr/dashboard`): headcount, departments, latest payroll cost, UAE doc-expiry alerts (expired / ≤30d / 31–90d across visa/labour-card/EID/passport/insurance/licence), leave + timesheet pending, headcount-by-department + by-employment-type charts, attention banner. PDF/Excel.
- ✅ **Phase 2 — Document Compliance & Expiry Tracker** (`/hr/compliance-tracker`): flattens every employee document expiry (visa/labour-card/EID/passport/medical+ILOE insurance/licence) into rows bucketed by urgency (Expired/≤30/31–60/61–90/Valid); clickable KPI filters, expired+expiring-by-document chart, search + document + status filters, table sorted by soonest, drill to employee. PDF/Excel.
- ✅ **Phase 3 — Workforce Analytics** (`/hr/workforce`): KPIs (headcount, departments, nationalities, avg tenure), by-department / by-nationality / by-employment-type / tenure-distribution charts, headcount-by-department table with avg tenure. PDF/Excel.
- ✅ **Phase 4 — Payroll Analytics** (`/payroll/analytics`): KPIs (latest gross/net, total OT, avg net), gross-vs-net cost trend, pay-component pie (basic/housing/transport/other/OT), net-by-department, run-history table. PDF/Excel.
- ✅ **Phase 5 — Leave Analytics** (`/hr/leave-analytics`): KPIs (requests, pending, approved days, upcoming), days-by-leave-type pie, by-status, approved-days-by-department, pending-approval queue table. PDF/Excel.
- ✅ **Phase 6 — Timesheet & Utilization** (`/timesheets/analytics`): KPIs (total hours, OT, OT %, pending), hours-by-week regular-vs-OT stack, by-allocation pie, by-project + by-employee charts. PDF/Excel.
- ✅ **Phase 7 — Project Labour Cost** (`/hr/labour-cost`): from `project_labour_costs` (defensive `select(*)`). KPIs (total cost, hours, projects + employees charged), cost-by-project + cost-trend charts, by-project table. PDF/Excel.
- ✅ **Phase 8 — EOSB Liability** (`/payroll/eosb-liability`): accrued UAE gratuity across the workforce (reuses `gratuityService.calculateEOSB`, basic salary from payroll lines, rate-based estimate fallback), liability-by-department + by-tenure charts, per-employee table. PDF/Excel.
- ✅ **Phase 9 — Manpower Dashboard** (`/hr/manpower`): headcount + est. monthly cost by assigned project, deployed-vs-bench split + utilisation %, headcount-by-project chart, manpower-by-project table and an on-bench list. PDF/Excel.
- ⏭ Then: Certifications → Training/Competency → Attendance & GPS → Documents Center → Hub/Polish.
