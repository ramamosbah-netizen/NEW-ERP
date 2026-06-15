# JEET ERP — HR & Workforce — Current-State Report

Scope: `src/app/{hr, payroll, timesheets}/*`, `src/services/{employeeService,
payrollService, leaveService, timesheetService, gratuityService, sifService,
fineService}.ts`, `src/types/{hr, payroll, timesheet}.types.ts`.

A complete **HR execution suite** (employees, payroll, timesheets, leave, EOSB,
WPS/SIF) — the gap is the **analytics / compliance-dashboard layer**.

## 1. Pages (UI today)

| Route | Purpose |
|-------|---------|
| `/hr` + `/[id]` | Employee register + 360 (compensation, certifications) |
| `/hr/calendar` | HR calendar (leave / events) |
| `/hr/compliance` | Document compliance view |
| `/hr/approvals` | HR approvals queue |
| `/payroll` | Monthly payroll run (compute, review, approve) |
| `/payroll/eosb` | End-of-service benefit (gratuity) |
| `/payroll/settlement` | Final settlement |
| `/payroll/sif` | WPS / SIF salary file generation |
| `/timesheets` + `/approvals` | Weekly timesheets (hours, OT) + approval |

Sidebar **HR & Payroll**: Employees, Payroll, Timesheets.

## 2. Data model (probed + types)

- **employees** — identity (name EN/AR, nationality, DOB, gender), job (`designation, department, employment_type, status, join_date, probation_end_date, assigned_project_id`), **UAE compliance expiries** (`passport_expiry, emirates_id_expiry, visa_expiry, labour_card_expiry, iloe_insurance_expiry, medical_insurance_expiry, driving_license_expiry`), MOHRE/WPS (`mohre_person_code, bank_name, iban, routing_code, agent_id`), `current_hourly_cost_rate`.
- **payroll_runs** — `period_month, status (DRAFT/REVIEW/APPROVED/PAID), gross_total, net_total, sif_generated_at`.
- **payroll_lines** — per employee: `basic_salary, housing/transport/other_allowance, ot_hours, ot_amount, leave_deductions, adjustments[], gross_pay, net_pay, days_worked`.
- **leave_requests** — leave lifecycle (request → approve/reject), working-day calc.
- **timesheets** + entries — weekly hours, OT, submit → approve.
- **project_labour_costs** — labour cost allocated to projects (feeds `projectFinancialsService`).

## 3. Services (logic today)

- **employeeService** — employee CRUD, compensation history, certifications.
- **payrollService** — `runPayrollForMonth` (OT + leave + adjustments → gross/net), `approvePayrollRun`.
- **leaveService** — request/approve/reject, working-day calc, leave calendar.
- **timesheetService** — weekly timesheet CRUD, submit/approve/reject, OT totals.
- **gratuityService** — EOSB accrual. **sifService** — WPS/SIF file. **fineService** — vehicle fines → payroll deduction.

## 4. Business logic highlights

- **Payroll:** basic + allowances + OT − leave deductions ± adjustments → gross/net; WPS/SIF export; EOSB on exit.
- **Timesheets → labour cost:** approved hours × cost rate → `project_labour_costs` (project actuals).
- **Compliance:** UAE document expiries tracked per employee (visa / labour card / EID / insurance).

## 5. Gap analysis (build targets)

| # | Capability | Status today |
|---|-----------|--------------|
| 1 | **HR & Workforce Dashboard** | ❌ none |
| 2 | **Document Compliance & Expiry Tracker** | 🟡 `/hr/compliance` exists, no urgency dashboard |
| 3 | **Workforce Analytics** (demographics, tenure) | ❌ none |
| 4 | **Payroll Analytics** (cost trend, breakdown) | ❌ none |
| 5 | **Leave Analytics** | ❌ none |
| 6 | **Timesheet & Utilization** | ❌ none |
| 7 | **Project Labour Cost** | 🟡 feeds financials, no HR view |
| 8 | **End-of-Service Liability** | 🟡 per-employee EOSB only |
| 9 | **Headcount by Project / Manpower** | ❌ none |
| 10 | **HR Hub + Audit & Export Polish** | — |

**Reuse, don't rebuild:** payroll/leave/timesheet/EOSB execution is mature — this
program is **analytics + a compliance-expiry dashboard** over existing data.
