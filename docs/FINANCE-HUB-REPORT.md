# JEET ERP — Finance Hub — Full Report

Complete reference for the Finance hub: every page, service/function, data model,
business logic, workflow, automation, export and audit hook. Stack: Next.js App
Router → React hooks → services → Supabase (Postgres + RLS + Storage + RPC).
Currency **AED**, locale **en-AE**, VAT **5%**. UI kit: in-house components
(`PageHeader`, `Card`, `Button`, `EmptyState`) + Tailwind v4 + Recharts.
(See also: `FINANCE-MODULE.md` for AR/AP detail, `FINANCE-ENTERPRISE-ROADMAP.md`.)

---

## 1. Hub map (all routes)

### Core
| Area | Route | Purpose |
|---|---|---|
| Finance Hub | `/finance` | KPI dashboard + quick links |
| Executive Dashboard | `/finance/executive` | Company-wide cash/AR/AP/profit/risk |
| Receivables (AR) | `/finance/ar`, `/create`, `/from-phases`, `/[id]`, `/aging`, `/payment`, `/statement` | Client invoicing, phase billing, receipts, aging, statements |
| Payables (AP) | `/finance/ap`, `/register`, `/match/[id]`, `/expenses`, `/aging`, `/schedule` | Supplier bills, expenses, 3-way match, scheduling |
| Cash Flow | `/finance/cashflow` | 13-week company forecast |
| VAT | `/finance/vat` | VAT-201 boxes + filing |
| GRN-to-Expense | `/finance/grn-expense` | Received vs invoiced vs paid |

### Enterprise (12 modules)
| # | Module | Route |
|---|---|---|
| 1 | Budget & Cost Control | `/finance/budget`, `/[id]` |
| 2 | Commitments | `/finance/commitments` |
| 3 | Project Profitability | `/finance/project-profitability`, `/[id]` |
| 4 | Bank Reconciliation | `/finance/bank-reconciliation`, `/[id]` |
| 5 | Retention Management | `/finance/retentions` |
| 6 | Treasury | `/finance/treasury` |
| 7 | Project Cash Flow | `/finance/project-cashflow` |
| 8 | Petty Cash | `/finance/petty-cash` |
| 9 | Fixed Assets | `/assets` (surfaced in Finance nav) |
| 10 | Financial Reports | `/finance/reports` |
| 11 | Executive Dashboard | `/finance/executive` |
| 12 | AI Finance Agent | `/finance/ai` |

---

## 2. Services & key functions

**Core AR/AP/cash:**
- `invoiceService` — client invoices: fetch, `createInvoiceDraft` (math + ceiling guard), `getBillableMilestones`, `generateProgressFromMilestones`, submit/approve/reject/markSent/writeOff, retention ledger.
- `supplierInvoiceService` — supplier bills: fetch, `createExpectedFromPO` (DRAFT from approved LPO + proforma import), `validateExpected` (DRAFT→REGISTERED), `recordExpense` (non-LPO/fuel/petty/office/workforce), `registerSupplierInvoice` (3-way match), approve/override, `recordSupplierPayment`.
- `paymentService` — client receipts + allocations.
- `paymentAccountService` — cards/bank/cash with live balance.
- `cashFlowService.get13WeekForecast` — weekly inflow/outflow + cumulative.
- `vatService` — VAT-201 boxes, periods, RCM via PO TRN.
- `threeWayMatchService`, `invoiceMathService`, `accountingExportService` (journal CSV/Excel), `commitmentService` (by-system), `projectFinancialsService.computeProjectFinancials`.

**Enterprise:**
- `budgetService` — `createFromBoq`, `list`, `get` (live committed/actual), `approve` (freeze).
- `commitmentLedgerService` — `list` (unifies LPO + payroll + manual), `addManual`, `cancelManual`.
- `projectCashFlowService.getProjectCashFlow` — per-project monthly in/out + cumulative.
- `retentionService.list` — net held per invoice + release status.
- `treasuryService` — `list` (limit/utilized/available + maturity), `create`, `setStatus`.
- `pettyCashService` — `listFunds` (live balance), `listTransactions`, `createFund`, `createTransaction`, `setStatus`.
- `bankReconciliationService` — `create`, `get`, `importLines`, `autoMatch`, `setLine`, `complete`.
- `financialReportsService` — `profitAndLoss`, `trialBalance`, `generalLedger`, `byProject`.
- `executiveFinanceService.getDashboard` — KPIs + chart series + alerts.
- `aiFinanceService.getInsights` — risk score + predictions + recommendations.

**Shared libs:** `finance-export` (PDF/Excel/CSV table), `payroll-export`, `invoicePDFService`, `amount-to-words`.

---

## 3. Data model (finance tables)

**AR:** client_invoices, client_invoice_items (milestone-linked), client_payments, payment_allocations, credit_notes, project_retention_ledger.
**AP:** supplier_invoices (+ DRAFT/REVISED status, cost_bucket, payment_account_id, payee_name, proforma_path, WORKFORCE category), supplier_invoice_items, supplier_payments, supplier_payment_allocations.
**Accounts/budget/commitments:** payment_accounts, project_budgets, project_budget_lines, cost_commitments.
**Cash/treasury/petty/bank:** treasury_facilities, petty_cash_funds, petty_cash_transactions, bank_reconciliations, bank_reconciliation_lines.
**VAT/numbering:** vat_periods + per-year sequence tables (JI-INV/RCT/CN/SINV/SPAY).
RLS: authenticated read/write (collaborative); roles enforced in the app layer.

---

## 4. Core business logic

- **Invoice math** (`invoiceMathService`): taxable → 5%/0% VAT → totals, advance recovery, retention, net due.
- **Over-claim ceiling guard**: cumulative client billing ≤ revised contract value.
- **Progress billing** (`from-phases`): claim DONE milestones; advance % + retention % auto-applied; retention posts to ledger.
- **3-way match**: invoice ↔ PO ↔ GRN on price/qty/TRN → MATCHED/EXCEPTION.
- **Budget**: planned (BOQ) vs committed (LPOs by system) vs actual (bills); FAC = max(planned, committed, actual); variance = planned − FAC; freeze on approval.
- **Commitments**: outstanding = PO total − paid; + payroll outstanding; + manual.
- **Account balance**: opening − (supplier payments + quick-paid expenses).
- **Payroll → AP**: per-employee net split across projects by timesheet hours → assigned project → office.
- **Bank rec**: import → auto-match by amount ±5 days → manual match/charge/adjustment → difference check.
- **VAT-201**: output by emirate + RCM (Box 3) for no-TRN suppliers; input (Box 9) for registered.
- **AI risk score (0–100)**: weighted from negative cash forecast, overdue-AR ratio, projects at risk, vendor exposure, net loss.

---

## 5. Workflows (Admin → Workflows)

- **`INV` — Client Invoice (AR)** and **`SINV` — Supplier Bill (AP)** detail pages carry a `WorkflowPanel`; the **Accountant → Financial Director → GM** chain is configured in the designer (not hard-coded). Status lifecycles are enforced by the services; the engine drives the approval transitions.
- Petty-cash claims and budgets have their own approve/freeze status flows in-service.

---

## 6. Automations (cross-module)

- Approved **LPO → AP DRAFT payable** (+ proforma import).
- **Payroll approved → DRAFT workforce payables**, split per project.
- Supplier-invoice prices → **pricing catalogue** write-back.
- GRN receipts → **GRN-to-Expense** + stock.
- Backfills: `scripts/backfill-ap-from-lpos.mjs`.

---

## 7. Exports

- **Shared `finance-export`** → PDF (jsPDF+autoTable, branded), Excel (SheetJS), CSV — wired into Financial Reports, Budget, Commitments, Retentions, Treasury, GRN-to-Expense.
- AR Tax-Invoice PDF, payroll XLSX, accounting journal CSV/Excel, statement CSV.
- Bank statement **import** (CSV/Excel) on Bank Reconciliation.

---

## 8. Audit logging

`auditService.logEvent({ module:'FINANCE', action, entity_type, entity_id, summary })`
is wired (best-effort) into the new write paths: **budget** create/approve,
**commitments** add/cancel, **petty cash** create/approve/reject, **bank
reconciliation** complete, **treasury** create/status. AR/AP approvals already
emit `system_events`. Logs surface in **Admin → Audit Log**.

---

## 9. Permissions

Roles (incl. **accountant**, **Financial Director**, **GM**) + module/action
permissions are configured in **Admin → Settings → Users, Roles & Permissions**.
Justification documents (LPO/PR PDF, payroll XLSX) are exposed as **output files**
so the accounts team needs no procurement/HR module access.

**Per-route RBAC** is now enforced via `AppShell` + `src/lib/permissions/routeAccess.ts`:
roles listed in `RESTRICTED_ROLE_ALLOWLIST` (e.g. **accountant** → finance,
documents, assets, reports, dashboard) are fenced to those route prefixes (and
their sidebar is filtered to match); every other role (admin/manager/engineer)
is unrestricted, so legacy users are never locked out. Deeper module/action
scopes are configured in Admin → Users, Roles & Permissions.

---

## 10. Migrations to apply (Supabase SQL editor, then reload schema)

```
20260613140000_po_proforma_invoice
20260614200000_ap_accounts_expenses
20260614220000_ap_draft_lifecycle
20260614240000_employee_assigned_project
20260614260000_project_budgets
20260614280000_cost_commitments
20260614300000_petty_cash
20260614320000_bank_reconciliation
20260614340000_treasury_facilities
```
(Pages 3, 5, 7, 10, 11, 12 need no migration — they read existing tables.)

---

## 11. Known gaps / next

- ✅ **Balance Sheet** — done (`/finance/reports` → Balance Sheet tab; derived
  from the journal by account-code range, current-year earnings as equity).
- **Retention payable** to subcontractors (ledger is client-side only).
- ✅ **Formal supplier-payment ↔ account** linking — done (AP disbursement scheduler
  records which payment account funded the payment, so balances stay accurate).
- ✅ **Per-route RBAC** for the accountant role — done (route fence + sidebar filter).
- **LLM-backed** AI agent narrative (interface already in place).
