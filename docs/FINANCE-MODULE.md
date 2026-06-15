# JEET ERP — Finance Module — Full Report

UAE ELV/MEP contractor finance module. Currency **AED**, locale **en-AE**, VAT
**5%** (FTA). Built on Next.js (App Router) → React hooks → services → Supabase
(Postgres + RLS + Storage + RPC). All money is `NUMERIC(14,2)`; client-side math
is centralised and rounded to 2 dp.

---

## 1. Submodules at a glance

| Submodule | Route base | Purpose |
|---|---|---|
| **Finance Hub** | `/finance` | KPI dashboard (AR/AP aging, cash, VAT) + quick links |
| **Accounts Receivable (AR)** | `/finance/ar` | Client invoicing, payments, aging, statements, retention |
| **Accounts Payable (AP)** | `/finance/ap` | Supplier bills, expenses, 3-way match, scheduling, payment |
| **Expenses & Accounts** | `/finance/ap/expenses` | Cards/bank/cash accounts + all expense capture |
| **Cash Flow** | `/finance/cashflow` | 13-week rolling cash forecast |
| **VAT Compliance** | `/finance/vat` | FTA VAT-201 boxes, periods, filing lock |
| **GRN-to-Expense** | `/finance/grn-expense` | Received vs invoiced vs paid, by project/period |

Cross-cutting: **configurable approval workflows** (modules `INV`, `SINV`),
**accounting journal export** (CSV/Excel), and **document outputs** (PDF/XLSX).

---

## 2. Pages

### Finance Hub — `/finance` (`finance/page.tsx`)
KPI cards (AR outstanding + aging, AP outstanding + aging, cash balance,
projected weekly net flow, VAT liability) with sparklines; quick-link cards into
AR, AP (Bill Registry, Register Invoice, Payables Aging, Disbursements,
**GRN-to-Expense**), Cash Flow and VAT.

### Accounts Receivable (AR)
| Page | Route | What it does |
|---|---|---|
| Invoice registry | `/finance/ar` | List/search/filter all client invoices; **New Invoice Draft** + **Bill Completed Phases** actions |
| Create invoice | `/finance/ar/create` | Build a client invoice (type, items, contract math, ceiling guard) |
| Bill completed phases | `/finance/ar/from-phases` | Pick project → claim DONE milestones at an amount → PROGRESS invoice (advance recovery + retention auto-applied) |
| Invoice detail | `/finance/ar/[id]` | View invoice + items, **WorkflowPanel (`INV`)**, approve/send/PDF, retention |
| AR aging | `/finance/ar/aging` | Receivables aging buckets |
| Record receipt | `/finance/ar/payment` | Record a client payment + allocate to invoices |
| Statement | `/finance/ar/statement` | Client statement of account |

### Accounts Payable (AP)
| Page | Route | What it does |
|---|---|---|
| Bill registry | `/finance/ap` | List all supplier bills/expenses, **Received (LPO)** column, **quick-validate** on DRAFT rows, status filter (all states) |
| Register invoice | `/finance/ap/register` | Manually register a supplier invoice (PO-matched or direct) |
| Bill detail / match | `/finance/ap/match/[id]` | 3-way match audit, **Source & Justification** (LPO/PR PDF, payroll XLSX, proforma, receipt), **Validate** panel, **WorkflowPanel (`SINV`)**, approve/override |
| Expenses & accounts | `/finance/ap/expenses` | Manage payment accounts (balances) + capture any expense |
| AP aging | `/finance/ap/aging` | Payables aging buckets |
| Disbursement schedule | `/finance/ap/schedule` | Schedule approved bills for payment |

### Other
| Page | Route | What it does |
|---|---|---|
| Cash Flow | `/finance/cashflow` | 13-week forecast chart from AR/AP due dates + base balance |
| VAT | `/finance/vat` | VAT-201 box computation, period create/lock |
| GRN-to-Expense | `/finance/grn-expense` | Per-project received value vs invoiced vs paid; CSV export |

---

## 3. Services & functions

### `invoiceService` — client invoices (AR)
- `fetchInvoices(filters)` / `fetchInvoiceById(id)` — list + detail (with items).
- `createInvoiceDraft(invoiceData, items)` — runs the invoice math engine, applies
  **over-claim ceiling guard** vs the project's (revised) contract value.
- `getBillableMilestones(projectId)` — DONE milestones available to bill.
- `generateProgressFromMilestones(projectId, lines)` — builds a PROGRESS invoice
  from completed phases; auto advance-recovery + retention from contract terms.
- `submitForApproval(id)` → `PENDING_APPROVAL` (emits `invoice.submitted`).
- `approveInvoice(id)` — re-checks ceiling, compiles the **Tax Invoice PDF** to the
  DMS, writes the **retention ledger** entry if any.
- `rejectInvoice`, `markAsSent`, `writeOffInvoice`, `deleteInvoice`.
- `fetchRetentionLedger(projectId)` / `releaseRetention(projectId, invoiceId, amount)`.

### `supplierInvoiceService` — supplier bills (AP)
- `fetchSupplierInvoices(filters)` / `fetchSupplierInvoiceById(id)`.
- `createExpectedFromPO(poId)` — **auto-creates a DRAFT payable** from an LPO
  (amounts + due from payment terms), imports the supplier proforma. Idempotent.
- `validateExpected(id, {number, date, amounts, doc})` — DRAFT → REGISTERED with
  the supplier's real invoice + attachment.
- `recordExpense(input)` — direct expense (non-LPO / petty cash / fuel / office /
  workforce); requires an invoice ref; buckets to PROJECT/PETTY_CASH/OFFICE; can
  mark paid from an account.
- `registerSupplierInvoice(invoice, items, trn)` — full registration + **3-way match**.
- `approveSupplierInvoice(id)`, `overrideMatchException(id, reason)`.
- `recordSupplierPayment(...)` — outgoing disbursement + allocation.

### `paymentService` — client receipts
`fetchPayments`, `fetchAllocations`, `recordPayment` (receipt + allocate across
invoices, updates `amount_paid`/status).

### `paymentAccountService` — cards / bank / cash
`list()` (with running **balance = opening − paid_out** from supplier_payments +
quick-paid expenses), `create()`, `setActive()`.

### `cashFlowService`
`get13WeekForecast(startingBalance)` — rolling 13-week inflow/outflow projection
from invoice/bill due dates.

### `vatService`
`fetchVATPeriods`, `createVATPeriod` (computes VAT-201 boxes), `lockVATPeriod`.
Input VAT reverse-charge (RCM) classification uses **`purchase_orders.supplier_trn`**.

### `threeWayMatchService` (pure)
`validateUAETrn(trn)`, `performThreeWayMatch(input)` — compares invoice vs PO vs
GRN on **price, quantity (incl. previously invoiced), and supplier TRN**; returns
exceptions → `match_status` MATCHED / EXCEPTION.

### `invoiceMathService` (pure)
`round2/round4`, `calculateInvoiceLine`, `calculateInvoiceTotals` — taxable, VAT
(5%/0%), totals, advance recovery, retention, net due.

### Supporting
- `accountingExportService` — `generateJournalLines(from,to)` (double-entry),
  `exportToCSV`, `exportToExcel` (accounting journal for the external GL).
- `commitmentService.getProjectCostCommitments(projectId)` — committed cost per
  system from LPOs (budget-overrun checks).
- `projectFinancialsService.computeProjectFinancials(projectId)` — revenue, cost,
  margin, billed/collected.
- `grnExpenseService.getReport(period)` — received vs invoiced vs paid by project.
- `statementImportService` — parse bank statement (e.g. extract fleet fines).
- `invoicePDFService` — branded Tax Invoice PDF.
- `amountInWordsService` / `amount-to-words` — AED amount in words for invoices.

---

## 4. Hooks
`useClientInvoices`, `useSupplierInvoices` (+ `useSupplierInvoice` detail),
`usePayments`, `useCashFlow`, `useVATPeriod`, `useThreeWayMatch`,
`useSupplierPerformance`. Each wraps a service, exposes `{ data, loading, error,
refetch }`.

---

## 5. Data model (schema-finance.sql)

**AR:** `client_invoices` (type ADVANCE/PROGRESS/FINAL/RETENTION_RELEASE/STANDALONE;
status DRAFT→PENDING_APPROVAL→APPROVED→SENT→PARTIALLY_PAID→PAID→OVERDUE/CANCELLED/
WRITTEN_OFF; gross_claim, advance_recovery, retention_held, taxable, vat, total,
net_due, amount_paid), `client_invoice_items` (milestone-linked), `client_payments`,
`payment_allocations`, `credit_notes`, `project_retention_ledger`.

**AP:** `supplier_invoices` (type PO_MATCHED/DIRECT_EXPENSE; status DRAFT→REGISTERED→
PENDING_APPROVAL→APPROVED→SCHEDULED→PARTIALLY_PAID→PAID→DISPUTED/REVISED/CANCELLED;
match_status, cost_bucket PROJECT/PETTY_CASH/OFFICE, payment_account_id, payee_name,
proforma_path/name, expense_category), `supplier_invoice_items`, `supplier_payments`,
`supplier_payment_allocations`.

**Accounts:** `payment_accounts` (BANK/CARD/CASH/PETTY_CASH + opening_balance).

**VAT:** `vat_periods`. **Numbering sequences:** per-year tables feeding triggers →
`JI-INV-`, `JI-RCT-`, `JI-CN-`, `JI-SINV-`, `JI-SPAY-`.

RLS: authenticated read/write (collaborative); role enforcement in the app layer
(Admin → Users, Roles & Permissions).

---

## 6. Core business logic

- **Invoice math:** taxable = Σ line (qty×price); VAT = 5% (or 0%); advance recovery
  and retention deducted → **net due**. Centralised in `invoiceMathService`.
- **Over-claim ceiling guard:** cumulative gross_claim across non-draft invoices
  cannot exceed the project's revised contract value (checked at create + approve).
- **Contract math (progress billing):** advance_pct & retention_pct from the project
  applied to each PROGRESS claim; retention posts to `project_retention_ledger`.
- **3-way match:** invoice ↔ PO ↔ GRN on price/qty/TRN → MATCHED or EXCEPTION
  (override requires a reason + authority).
- **Account balance:** opening − (supplier_payments from account + quick-paid
  expenses on that account).
- **Payroll labour allocation:** each employee's net pay split across projects by
  timesheet hours → assigned/home project → Office (fallback chain).
- **VAT-201:** output VAT by emirate + reverse-charge (Box 3) for supplier bills
  with no UAE TRN; input VAT (Box 9) for registered suppliers.

---

## 7. Workflows (configurable in Admin → Workflows)

- **`INV` — Client Invoice (AR)** and **`SINV` — Supplier Bill (AP)** each carry a
  `WorkflowPanel` on their detail page. Stages/approvers (e.g. **Accountant →
  Financial Director → GM**) are configured in the designer, not hard-coded. The
  panel renders only once a workflow is active for that module.
- **Lifecycles** (status enums above) are enforced by the services; the workflow
  engine drives the approval transitions on top.

---

## 8. Automations (procurement / HR → finance)

- **LPO approved → AP DRAFT payable** ("action to spend money"), proforma imported
  (`poApprovalService` → `createExpectedFromPO`).
- **Payroll approved → DRAFT workforce payables**, split per project from timesheets
  (`payrollService`).
- **Supplier invoice line prices → pricing catalogue** write-back (price history).
- **GRN receipts → GRN-to-Expense** report (received value).
- **Backfills:** `scripts/backfill-ap-from-lpos.mjs` (existing approved LPOs → AP).

---

## 9. Document outputs (no module access needed)

- **AR:** branded Tax Invoice PDF, client statement.
- **AP Source & Justification:** **LPO → PDF**, **PR → PDF**, **Payroll → XLSX**,
  **proforma** & **attached invoice/receipt** (signed-URL view from `documents`/
  `tender-documents` buckets).
- **Accounting:** journal CSV/Excel for the external GL.
- **GRN-to-Expense / expenses:** CSV/XLSX.

---

## 10. Permissions

Roles (incl. **accountant**) and module/action permissions with scopes are
configured in **Admin → Settings → Users, Roles & Permissions**. Enforcement is
app-layer (`Can` gate / `permissionService`); **per-route guards are not yet
wired** (a determined user can still reach a URL directly).

---

## 11. Migrations to apply (Supabase SQL editor, then `NOTIFY pgrst, 'reload schema';`)

| Migration | Purpose |
|---|---|
| `20260613140000_po_proforma_invoice` | Proforma fields on LPO (source for AP import) |
| `20260614200000_ap_accounts_expenses` | payment_accounts; supplier_invoices cost_bucket/payment_account_id/payee_name, nullable supplier_id, wider categories; supplier_payments.payment_account_id |
| `20260614220000_ap_draft_lifecycle` | DRAFT/REVISED statuses, proforma_path/name, WORKFORCE category |
| `20260614240000_employee_assigned_project` | employees.assigned_project_id (payroll fallback) |

(`supplier_invoices`/`client_invoices` base tables come from `schema-finance.sql`.)

---

## 12. Known gaps / next steps

- **Per-route RBAC enforcement** (accountant scoped to Finance + document outputs).
- **AI invoice extraction from mail** → pre-fill + match Draft bills (mailbox +
  edit needed).
- **Supplier credit notes / refunds** posting to AP (returns currently stock-side).
- **Formal supplier-payment ↔ account** linking in the disbursement UI (balance
  already counts quick-paid expenses).
- **Historical (as-of-date) stock/AP valuation** reports.
