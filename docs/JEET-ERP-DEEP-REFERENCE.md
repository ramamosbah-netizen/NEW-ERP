# JEET ERP — Deep Reference (every page & function)

> Auto-generated from source. For each **page**: title, services used, tables queried.
> For each **function**: what it does (doc-comment), tables touched, RPCs called, DB operations.
> Pair with `JEET-ERP-SYSTEM-REPORT.md` (architecture & business-logic narrative).

**Totals:** 257 pages · 3 API routes · 116 services / **585 functions** · 45 hooks · 44 migrations.

Legend — **ops:** insert/update/delete/upsert/select/rpc/storage/realtime · **tables:** Postgres tables read or written · **rpc:** Postgres functions called.

---

## 1. Pages — detailed

### Root — `/` (1)

#### `/`
- *(presentational / composed of child components)*

### Administration — `/admin` (31)

#### `/admin` — Administration Center
- **tables:** `profiles`

#### `/admin/access` — Access & Roles Analytics
- **tables:** `roles`, `role_permissions`, `user_roles`, `profiles`

#### `/admin/audit` — Audit Log
- **services:** `auditService`

#### `/admin/audit/analytics` — Audit & Activity Analytics
- **tables:** `audit_log`, `profiles`

#### `/admin/configuration` — Platform Configuration Audit
- **tables:** `workflow_definitions`, `form_definitions`, `document_templates`, `business_rules`

#### `/admin/forms` — Forms Builder
- **services:** `formBuilderService`
- **tables:** `form_definitions`

#### `/admin/forms/[id]` — Structure
- **services:** `formBuilderService`

#### `/admin/hub` — Administration & Governance Hub
- **tables:** `profiles`, `roles`, `permissions`, `role_permissions`, `audit_log`, `workflow_definitions`, `workflow_instances`, `document_templates`, `form_definitions`, `business_rules`

#### `/admin/numbering` — Document Numbering
- **services:** `numberingService`

#### `/admin/permissions` — Permissions Matrix
- **tables:** `roles`, `permissions`, `role_permissions`

#### `/admin/rules` — Business Rules
- **services:** `rulesService`, `userRoleService`

#### `/admin/settings`
- *(presentational / composed of child components)*

#### `/admin/settings/backup`
- *(presentational / composed of child components)*

#### `/admin/settings/finance`
- *(presentational / composed of child components)*

#### `/admin/settings/hr`
- *(presentational / composed of child components)*

#### `/admin/settings/integrations`
- *(presentational / composed of child components)*

#### `/admin/settings/inventory`
- *(presentational / composed of child components)*

#### `/admin/settings/maintenance`
- *(presentational / composed of child components)*

#### `/admin/settings/modules`
- *(presentational / composed of child components)*

#### `/admin/settings/notifications`
- *(presentational / composed of child components)*

#### `/admin/settings/pdf-templates`
- *(presentational / composed of child components)*

#### `/admin/settings/procurement`
- *(presentational / composed of child components)*

#### `/admin/settings/projects`
- *(presentational / composed of child components)*

#### `/admin/settings/security`
- *(presentational / composed of child components)*

#### `/admin/settings/sessions`
- *(presentational / composed of child components)*

#### `/admin/settings/system`
- *(presentational / composed of child components)*

#### `/admin/settings/users`
- *(presentational / composed of child components)*

#### `/admin/templates` — Document Templates
- **services:** `templateService`

#### `/admin/workflows` — Workflow Builder
- **services:** `workflowService`

#### `/admin/workflows/[id]` — Pipeline diagram
- **services:** `workflowService`, `userRoleService`

#### `/admin/workflows/analytics` — Workflow & Approvals Analytics
- **tables:** `workflow_definitions`, `workflow_instances`

### AMC — `/amc` (8)

#### `/amc`
- *(presentational / composed of child components)*

#### `/amc/[id]`
- **tables:** `profiles`, `ppm_visits`

#### `/amc/billing` — AMC Billing & Revenue
- **services:** `amcBillingService`
- **tables:** `amc_billing_schedule`, `amc_contracts`

#### `/amc/create`
- **tables:** `clients`, `quotations`, `projects`

#### `/amc/equipment` — Equipment / Asset Register
- **tables:** `amc_equipment`, `amc_contracts`, `service_tickets`

#### `/amc/pipeline` — AMC Renewals Pipeline
- **tables:** `amc_contracts`

#### `/amc/profitability` — Contract Profitability
- **tables:** `amc_contracts`, `service_tickets`, `ppm_visits`

#### `/amc/renewal`
- *(presentational / composed of child components)*

### Assets — `/assets` (6)

#### `/assets`
- **tables:** `employees`, `vehicles`

#### `/assets/[id]`
- **tables:** `asset_disposals`

#### `/assets/dashboard` — Fixed Asset Dashboard
- **tables:** `fixed_assets`

#### `/assets/depreciation` — Reload schedule
- **tables:** `depreciation_schedule`

#### `/assets/depreciation-forecast` — Depreciation Forecast
- **tables:** `fixed_assets`

#### `/assets/disposals` — Disposals & Gain/Loss
- **tables:** `asset_disposals`, `fixed_assets`

### Communications — `/comms` (7)

#### `/comms` — Messages
- **services:** `commsService`, `commDocsService`

#### `/comms/admin` — Communication Settings
- **services:** `commsService`
- **tables:** `conversations`, `profiles`, `settings`

#### `/comms/announcements` — Company Announcements
- **services:** `announcementService`
- **tables:** `profiles`

#### `/comms/documents` — Shared Documents
- **services:** `commDocsService`

#### `/comms/meeting/[roomId]`
- **services:** `commsService`
- **tables:** `profiles`

#### `/comms/meetings` — Meeting Analytics
- **services:** `commsService`

#### `/comms/notifications` — Notifications Center
- **services:** `commNotificationService`

### dashboard — `/dashboard` (1)

#### `/dashboard` — Executive overview
- **services:** `kpiService`
- **tables:** `profiles`, `tenders`, `boqs`, `purchase_orders`

### documents — `/documents` (3)

#### `/documents`
- **tables:** `projects`, `documents`

#### `/documents/expiry`
- *(presentational / composed of child components)*

#### `/documents/review`
- *(presentational / composed of child components)*

### Finance — `/finance` (31)

#### `/finance` — Receivables (AR)
- **services:** `kpiService`, `executiveFinanceService`

#### `/finance/ai` — AI Finance Agent
- **services:** `aiFinanceService`

#### `/finance/ap` — Validate supplier invoice
- **services:** `supplierInvoiceService`
- **tables:** `po_items`

#### `/finance/ap/aging`
- *(presentational / composed of child components)*

#### `/finance/ap/expenses` — Expenses & Payment Accounts
- **services:** `paymentAccountService`, `supplierInvoiceService`
- **tables:** `projects`

#### `/finance/ap/match/[id]`
- **services:** `supplierInvoiceService`, `poPDFService`, `prService`
- **tables:** `purchase_orders`, `purchase_requests`, `documents`, `po_items`

#### `/finance/ap/register`
- **services:** `supplierInvoiceService`
- **tables:** `pricing_suppliers`, `projects`, `documents`, `purchase_orders`

#### `/finance/ap/schedule`
- **services:** `supplierInvoiceService`, `paymentAccountService`
- **tables:** `pricing_suppliers`, `supplier_invoices`

#### `/finance/ar`
- *(presentational / composed of child components)*

#### `/finance/ar/[id]`
- *(presentational / composed of child components)*

#### `/finance/ar/aging`
- *(presentational / composed of child components)*

#### `/finance/ar/create`
- **services:** `invoiceMathService`, `invoiceService`
- **tables:** `projects`, `clients`

#### `/finance/ar/from-phases` — Bill Completed Phases
- **services:** `invoiceService`
- **tables:** `projects`

#### `/finance/ar/payment`
- **services:** `paymentService`
- **tables:** `clients`, `client_invoices`

#### `/finance/ar/statement`
- **tables:** `clients`, `client_invoices`, `client_payments`

#### `/finance/bank-reconciliation` — Bank Reconciliation
- **services:** `bankReconciliationService`, `paymentAccountService`

#### `/finance/bank-reconciliation/[id]` — Mark matched
- **services:** `bankReconciliationService`

#### `/finance/budget` — Budget & Cost Control
- **services:** `budgetService`
- **tables:** `projects`

#### `/finance/budget/[id]`
- **services:** `budgetService`

#### `/finance/cashflow` — Refresh Forecast
- *(presentational / composed of child components)*

#### `/finance/commitments` — Commitments
- **services:** `commitmentLedgerService`
- **tables:** `projects`

#### `/finance/executive`
- *(presentational / composed of child components)*

#### `/finance/grn-expense` — GRN-to-Expense Report
- **services:** `grnExpenseService`

#### `/finance/petty-cash` — Petty Cash
- **services:** `pettyCashService`
- **tables:** `projects`

#### `/finance/project-cashflow` — Project Cash Flow
- **services:** `projectCashFlowService`
- **tables:** `projects`

#### `/finance/project-profitability` — Project Profitability
- **services:** `projectFinancialsService`
- **tables:** `projects`

#### `/finance/project-profitability/[id]` — Profitability — ${s.projectNumber}
- **services:** `projectFinancialsService`

#### `/finance/reports` — Financial Reports
- **services:** `financialReportsService`

#### `/finance/retentions` — Retention Management
- **services:** `retentionService`, `supplierRetentionService`
- **tables:** `pricing_suppliers`, `projects`

#### `/finance/treasury` — Treasury Management
- **services:** `treasuryService`

#### `/finance/vat`
- *(presentational / composed of child components)*

### Fleet — `/fleet` (10)

#### `/fleet` — Refresh Data
- **tables:** `vehicles`, `vehicle_fines`, `fuel_logs`, `vehicle_maintenance`

#### `/fleet/[id]`
- **tables:** `employees`, `projects`, `vehicle_fines`

#### `/fleet/compliance` — Vehicle Compliance Tracker
- **tables:** `vehicles`

#### `/fleet/dashboard` — Fleet Dashboard
- **tables:** `vehicles`

#### `/fleet/fines`
- **tables:** `employees`, `vehicles`, `vehicle_assignments`

#### `/fleet/fines-analytics` — Traffic Fines Analytics
- **tables:** `vehicle_fines`, `vehicles`, `employees`

#### `/fleet/fuel-analytics` — Fuel Analytics
- **tables:** `fuel_logs`, `vehicles`

#### `/fleet/hub` — Fleet & Assets Hub
- **tables:** `vehicles`, `vehicle_fines`, `fixed_assets`, `tools`

#### `/fleet/maintenance` — Maintenance & Downtime
- **tables:** `vehicle_maintenance`, `vehicles`

#### `/fleet/tco` — Total Cost of Ownership
- **tables:** `vehicles`, `fuel_logs`, `vehicle_fines`, `vehicle_maintenance`

### handover — `/handover` (1)

#### `/handover`
- **tables:** `documents`

### HR — `/hr` (16)

#### `/hr`
- **services:** `employeeService`
- **tables:** `projects`

#### `/hr/[id]` — Unlink Document
- **tables:** `profiles`, `documents`

#### `/hr/approvals`
- *(presentational / composed of child components)*

#### `/hr/attendance` — Attendance & GPS
- **services:** `attendanceService`
- **tables:** `employees`

#### `/hr/calendar`
- **services:** `leaveService`, `employeeService`

#### `/hr/certifications` — Certification Tracker
- **services:** `employeeService`
- **tables:** `employee_certifications`, `employees`

#### `/hr/competency` — Training & Competency Matrix
- **services:** `competencyService`
- **tables:** `employees`

#### `/hr/compliance` — Passport: ${pass.text}
- *(presentational / composed of child components)*

#### `/hr/compliance-tracker` — Document Compliance & Expiry
- **tables:** `employees`

#### `/hr/dashboard` — HR & Workforce Dashboard
- **tables:** `employees`, `payroll_runs`, `leave_requests`, `timesheets`

#### `/hr/documents` — Employee Documents Center
- **tables:** `employees`, `employee_certifications`, `documents`

#### `/hr/hub` — HR & Workforce
- **tables:** `employees`, `employee_certifications`, `leave_requests`, `timesheets`

#### `/hr/labour-cost` — Project Labour Cost
- **tables:** `project_labour_costs`, `projects`, `employees`

#### `/hr/leave-analytics` — Leave Analytics
- **tables:** `leave_requests`, `employees`

#### `/hr/manpower` — Manpower Dashboard
- **tables:** `employees`, `projects`

#### `/hr/workforce` — Workforce Analytics
- **tables:** `employees`

### meetings — `/meetings` (2)

#### `/meetings` — Accept invitation
- **tables:** `projects`

#### `/meetings/analytics` — Meeting Analytics & Action Items
- **tables:** `meetings`, `meeting_action_items`, `profiles`

### myday — `/myday` (1)

#### `/myday`
- **services:** `taskService`
- **tables:** `projects`, `profiles`

### notifications — `/notifications` (3)

#### `/notifications` — Reload alerts
- *(presentational / composed of child components)*

#### `/notifications/analytics` — Notifications & Alerts Analytics
- **tables:** `notifications`

#### `/notifications/preferences` — Back to Alerts Logs
- *(presentational / composed of child components)*

### Payroll — `/payroll` (6)

#### `/payroll` — Approve
- **tables:** `employees`, `payroll_runs`, `payroll_lines`

#### `/payroll/analytics` — Payroll Analytics
- **tables:** `payroll_runs`, `payroll_lines`, `employees`

#### `/payroll/eosb`
- *(presentational / composed of child components)*

#### `/payroll/eosb-liability` — End-of-Service Liability
- **services:** `gratuityService`
- **tables:** `employees`, `payroll_lines`

#### `/payroll/settlement`
- **services:** `employeeService`
- **tables:** `employees`, `employee_compensation`, `leave_balances`

#### `/payroll/sif`
- **services:** `sifService`
- **tables:** `payroll_runs`, `payroll_lines`

### ppm — `/ppm` (2)

#### `/ppm/calendar`
- **tables:** `profiles`

#### `/ppm/execute/[id]`
- *(presentational / composed of child components)*

### pricing — `/pricing` (1)

#### `/pricing` — Material cost never refreshed from a supplier price
- *(presentational / composed of child components)*

### Procurement — `/procurement` (30)

#### `/procurement` — Procurement
- **tables:** `purchase_requests`, `purchase_orders`, `supplier_invoices`

#### `/procurement/comparisons`
- **tables:** `supplier_comparisons`, `quotations`

#### `/procurement/comparisons/[id]` — Rename ${supName}
- **tables:** `pricing_suppliers`, `profiles`

#### `/procurement/comparisons/[id]/approve`
- **tables:** `profiles`

#### `/procurement/comparisons/[id]/item/[itemId]`
- **tables:** `supplier_performance_history`

#### `/procurement/comparisons/[id]/review`
- **tables:** `profiles`

#### `/procurement/comparisons/new/[quotationId]`
- **tables:** `quotations`, `quotation_lines`

#### `/procurement/dashboard` — Procurement Dashboard
- **tables:** `purchase_requests`, `purchase_orders`, `grns`, `supplier_invoices`, `pricing_suppliers`

#### `/procurement/deliveries` — PO Delivery Tracking
- **tables:** `purchase_orders`, `projects`

#### `/procurement/grn`
- **tables:** `projects`, `grns`, `grn_items`, `grn_returns`

#### `/procurement/grn-analytics` — Goods Receipt Analytics
- **tables:** `grns`, `purchase_orders`, `projects`

#### `/procurement/grn/[id]`
- **tables:** `documents`

#### `/procurement/grn/create`
- **services:** `poService`, `grnService`, `stockService`
- **tables:** `purchase_orders`

#### `/procurement/grn/receivables` — GRN Receivables
- **services:** `grnReceivablesService`

#### `/procurement/match` — Three-Way Match Exceptions
- **tables:** `supplier_invoices`, `pricing_suppliers`, `purchase_orders`

#### `/procurement/payables` — Payables Overview
- **tables:** `supplier_invoices`, `pricing_suppliers`

#### `/procurement/po`
- **tables:** `projects`, `purchase_orders`

#### `/procurement/po/[id]`
- **services:** `poPDFService`, `grnService`
- **tables:** `purchase_orders`, `profiles`

#### `/procurement/po/create`
- **services:** `poService`, `poFromComparisonService`
- **tables:** `pricing_suppliers`, `projects`

#### `/procurement/po/from-comparison/[id]`
- **services:** `poFromComparisonService`, `poService`
- **tables:** `projects`, `purchase_orders`

#### `/procurement/pr` — Purchase Requests
- **services:** `prService`

#### `/procurement/pr-pipeline` — PR Pipeline & Cycle Time
- **tables:** `purchase_requests`

#### `/procurement/pr/[id]` — Details
- **services:** `prService`

#### `/procurement/pr/create` — New Purchase Request
- **services:** `prService`
- **tables:** `projects`, `pricing_suppliers`

#### `/procurement/rfq` — Requests for Quotation
- **services:** `rfqService`

#### `/procurement/rfq/new/[boqId]` — Request for Quotation
- **services:** `rfqService`

#### `/procurement/savings` — Savings & Comparison Analysis
- **tables:** `supplier_comparisons`

#### `/procurement/spend` — Spend Analysis
- **tables:** `purchase_orders`, `projects`

#### `/procurement/suppliers` — Supplier Performance
- **tables:** `pricing_suppliers`, `purchase_orders`, `supplier_invoices`

#### `/procurement/suppliers/[id]/scorecard`
- **tables:** `supplier_performance_history`

### Projects — `/projects` (15)

#### `/projects`
- **tables:** `profiles`

#### `/projects/[id]`
- **tables:** `profiles`, `documents`

#### `/projects/controls` — Project Controls
- **services:** `projectPortfolioService`, `warrantyService`, `siteRecordsService`

#### `/projects/daily-reports` — Daily Site Reports
- **services:** `dailySiteReportService`
- **tables:** `projects`

#### `/projects/dashboard` — Project Executive Dashboard
- **services:** `projectPortfolioService`

#### `/projects/dlp` — DLP & Warranty Tracking
- **services:** `warrantyService`
- **tables:** `projects`

#### `/projects/evm` — Progress & Earned Value (EVM)
- **services:** `evmService`
- **tables:** `projects`

#### `/projects/new`
- *(presentational / composed of child components)*

#### `/projects/new/[quotationId]`
- *(presentational / composed of child components)*

#### `/projects/resources` — Resource & Manpower Planning
- **services:** `resourcePlanningService`
- **tables:** `projects`

#### `/projects/risks` — Risk Register
- **services:** `riskRegisterService`
- **tables:** `projects`

#### `/projects/schedule` — Project Schedule (Gantt)
- **services:** `wbsService`
- **tables:** `projects`

#### `/projects/site-records` — RFI / SI / NCR Register
- **services:** `siteRecordsService`
- **tables:** `projects`

#### `/projects/snag-analytics` — Snag Analytics & QA Dashboard
- **tables:** `projects`, `snags`

#### `/projects/wbs` — Work Breakdown Structure
- **services:** `wbsService`
- **tables:** `projects`

### quotations — `/quotations` (8)

#### `/quotations`
- **tables:** `tenders`, `boqs`, `quotations`

#### `/quotations/[id]`
- **tables:** `profiles`, `projects`, `quotations`

#### `/quotations/[id]/approve`
- **tables:** `profiles`

#### `/quotations/[id]/edit`
- **tables:** `clients`

#### `/quotations/[id]/pdf`
- *(presentational / composed of child components)*

#### `/quotations/[id]/review`
- **tables:** `profiles`

#### `/quotations/new/[boqId]`
- **tables:** `boqs`, `clients`, `pricing_items`

#### `/quotations/templates`
- **tables:** `profiles`, `quotation_templates`

### reports — `/reports` (1)

#### `/reports`
- **services:** `reportingService`

### Sales & Pre-Award — `/sales` (12)

#### `/sales` — Pre-Sales
- **tables:** `tenders`, `quotations`

#### `/sales/clients` — Client Directory
- **services:** `clientService`
- **tables:** `quotations`, `amc_contracts`

#### `/sales/clients/[id]`
- **services:** `clientService`

#### `/sales/competitors` — Competitor Tracking
- **services:** `competitorService`
- **tables:** `tenders`

#### `/sales/dashboard` — Pre-Sales Dashboard
- **tables:** `tenders`, `boqs`, `quotations`

#### `/sales/deadlines` — Tender Deadline Tracker
- **tables:** `tenders`

#### `/sales/follow-ups` — Quotation Follow-ups & Validity
- **tables:** `quotations`

#### `/sales/margin` — Estimation & Margin Analysis
- **tables:** `boqs`, `tenders`, `quotations`

#### `/sales/performance` — Sales Performance
- **tables:** `quotations`, `tenders`, `profiles`

#### `/sales/pipeline` — Sales Pipeline
- **tables:** `tenders`

#### `/sales/quotations` — Quotation Analytics
- **tables:** `quotations`

#### `/sales/win-loss` — Win / Loss Analysis
- **tables:** `quotations`

### Service Desk — `/service-desk` (3)

#### `/service-desk`
- **services:** `ticketService`
- **tables:** `profiles`

#### `/service-desk/[id]`
- *(presentational / composed of child components)*

#### `/service-desk/new`
- **tables:** `clients`, `amc_contracts`

### Service — `/service` (6)

#### `/service/dashboard` — Service & AMC Operations
- **tables:** `service_tickets`, `amc_contracts`, `ppm_visits`

#### `/service/history` — Client / Site Service History
- **tables:** `clients`, `amc_contracts`, `service_tickets`, `ppm_visits`

#### `/service/parts` — Spare Parts & Consumption
- **tables:** `service_tickets`

#### `/service/ppm-compliance` — PPM Compliance
- **tables:** `ppm_visits`, `amc_contracts`, `profiles`

#### `/service/sla` — SLA Analytics & Compliance
- **tables:** `service_tickets`, `profiles`

#### `/service/technicians` — Technician Utilization & Dispatch
- **tables:** `service_tickets`, `ppm_visits`, `profiles`

### settings — `/settings` (2)

#### `/settings/scoring-weights`
- *(presentational / composed of child components)*

#### `/settings/whatsapp`
- **services:** `whatsappService`

### Sign in — `/signin` (1)

#### `/signin`
- *(presentational / composed of child components)*

### Sign up — `/signup` (1)

#### `/signup`
- *(presentational / composed of child components)*

### snags — `/snags` (2)

#### `/snags`
- **tables:** `profiles`, `documents`

#### `/snags/capture`
- **tables:** `documents`

### tasks — `/tasks` (4)

#### `/tasks`
- **tables:** `projects`

#### `/tasks/analytics` — Task Analytics
- **tables:** `tasks`

#### `/tasks/team` — Team Workload
- **tables:** `tasks`, `profiles`

#### `/tasks/workload` — Back to Tasks
- *(presentational / composed of child components)*

### tc — `/tc` (4)

#### `/tc`
- **services:** `tcService`
- **tables:** `profiles`, `documents`

#### `/tc/[id]`
- **tables:** `tc_test_scripts`, `tc_devices`

#### `/tc/execute/[id]`
- **tables:** `tools`, `documents`, `snags`

#### `/tc/witness/[id]`
- **tables:** `private_documents`

### technician — `/technician` (1)

#### `/technician`
- **services:** `visitService`, `ticketService`
- **tables:** `profiles`

### tenders — `/tenders` (6)

#### `/tenders` — Project created from this tender
- **tables:** `tenders`, `boqs`, `projects`

#### `/tenders/[id]` — Project created from the accepted quotation
- **tables:** `tenders`, `tender_documents`, `boqs`, `projects`

#### `/tenders/[id]/boq` — Bill of Quantities Workspace
- **tables:** `profiles`, `tenders`, `boqs`, `boq_versions`, `quotations`, `pricing_items`, `quotation_lines`

#### `/tenders/[id]/boq/print`
- **tables:** `tenders`, `boqs`

#### `/tenders/[id]/edit`
- **tables:** `tenders`, `tender_documents`

#### `/tenders/new`
- **tables:** `tenders`, `tender_documents`

### timesheets — `/timesheets` (3)

#### `/timesheets`
- **services:** `timesheetService`
- **tables:** `employees`, `projects`, `service_tickets`, `ppm_visits`

#### `/timesheets/analytics` — Timesheet & Utilization
- **tables:** `timesheets`, `timesheet_entries`, `employees`, `projects`

#### `/timesheets/approvals`
- **services:** `timesheetService`

### tools — `/tools` (2)

#### `/tools` — Tools & Equipment Register
- **tables:** `tools`, `employees`, `stock_locations`

#### `/tools/calibration` — Calibration Tracker
- **tables:** `tools`, `employees`

### vo — `/vo` (4)

#### `/vo` — Refresh Registry
- **tables:** `projects`

#### `/vo/[id]` — Refresh detail view
- **services:** `voApprovalService`
- **tables:** `documents`

#### `/vo/approve` — Refresh Approval Queue
- **services:** `voService`, `voApprovalService`

#### `/vo/create` — Pick BOQ item
- **services:** `voService`
- **tables:** `projects`, `documents`, `boqs`

### Warehouse — `/warehouse` (17)

#### `/warehouse` — Warehouse & Inventory
- *(presentational / composed of child components)*

#### `/warehouse/aging` — Inventory Aging
- **services:** `warehouseService`

#### `/warehouse/dashboard` — Inventory Dashboard
- **services:** `warehouseService`
- **tables:** `stock_transactions`

#### `/warehouse/dead-stock` — Dead Stock Dashboard
- **services:** `stockService`, `stockTransactionService`

#### `/warehouse/forecast` — Material Forecasting
- **services:** `mrfService`, `stockService`, `warehouseService`
- **tables:** `mrf_items`

#### `/warehouse/gl` — Inventory GL Integration
- **services:** `inventoryGlService`

#### `/warehouse/installed` — Installed Assets Tracking
- **services:** `stockService`
- **tables:** `projects`

#### `/warehouse/movements` — Goods Movements
- **services:** `warehouseService`
- **tables:** `projects`

#### `/warehouse/mrf` — Material Requisitions (MRF)
- **services:** `mrfService`, `stockService`, `warehouseService`
- **tables:** `projects`

#### `/warehouse/mrf/[id]` — MRF ${mrf.mrf_number}
- **services:** `mrfService`

#### `/warehouse/replenishment` — Replenishment Planning
- **services:** `warehouseService`, `stockService`

#### `/warehouse/serials` — Serial Number Tracking
- **services:** `stockService`, `warehouseService`

#### `/warehouse/stock-count` — Stock Count / Stock-take
- **services:** `stockCountService`, `warehouseService`

#### `/warehouse/stock-count/[id]` — Stock Count ${count.count_number}
- **services:** `stockCountService`

#### `/warehouse/store` — Store
- **services:** `warehouseService`, `stockTransactionService`
- **tables:** `profiles`, `stock_transactions`

#### `/warehouse/suppliers` — Suppliers & Subcontractors
- **services:** `warehouseService`

#### `/warehouse/suppliers/[id]` — Purchase order history
- **services:** `warehouseService`

### whatsapp — `/whatsapp` (1)

#### `/whatsapp` — WhatsApp settings
- **tables:** `documents`, `clients`, `amc_contracts`

### My Workspace — `/workspace` (4)

#### `/workspace` — My Workspace
- **tables:** `tasks`, `notifications`, `meetings`

#### `/workspace/activity` — Activity Timeline
- **tables:** `audit_log`, `profiles`

#### `/workspace/approvals` — Approvals
- **tables:** `profiles`, `employees`, `purchase_requests`, `purchase_orders`, `supplier_comparisons`, `quotations`, `supplier_invoices`, `payroll_runs`, `leave_requests`, `timesheets`, `material_requisitions`, `amc_contracts`

#### `/workspace/calendar` — Unified Calendar
- **tables:** `tasks`, `meetings`, `leave_requests`, `ppm_visits`, `employees`

### API routes (server)

- `/api/admin/sessions`
- `/api/admin/users`
- `/api/fleet/import-statement`

---

## 2. Services — every function

### `accountingExportService` — JEET ERP — Accounting Journal Export Service (AP/AR Ledger) Formats: Excel (using SheetJS) & CSV formats for ERP syncing

**`async generateJournalLines(startDate: string, endDate: string)`**  
Computes the detailed double-entry journal ledger lines for a date range.  
› ops: select · tables: `projects`, `client_invoices`, `client_payments`, `supplier_invoices`, `supplier_payments`

**`async exportToCSV(startDate: string, endDate: string)`**  
Generates a CSV string representation of the journal ledger.  

**`async exportToExcel(startDate: string, endDate: string, filename: string = 'JEET_ERP_Accounting_Journal.xlsx')`**  
Triggers client-side download of a formatted Excel spreadsheet containing the journal ledger.  

### `aiFinanceService` — JEET ERP — Finance: AI Finance Agent (Phase 1, rule-based) Risk scoring + recommendations over existing finance data. No external LLM yet — deterministic heuristics with confidence

**`async getInsights()`**  
› ops: select · tables: `client_invoices`, `supplier_invoices`

### `amcBillingService` — JEET ERP — AMC Billing Schedule Service Manages installment calculations and automated draft invoicing.

**`addMonths(dateStr: string, months: number)`** *(pure fn)*  
Helper to add calendar months to a date string (YYYY-MM-DD). Handles end-of-month adjustments (e.g., Jan 31 + 1 month -> Feb 28/29).  

**`async generateBillingSchedule(contract: AMCContract)`**  
Generates and inserts the billing schedule for an active contract.  
› ops: insert, select · tables: `amc_billing_schedule`

**`async processDueInstallments()`**  
Scans for pending installments due in the next 7 days and generates draft invoices. Can be run via a daily cron edge function.  
› ops: select · tables: `amc_billing_schedule`

### `amcService` — JEET ERP — AMC Contracts Service Handles CRUD, quotation/project conversion, and activation.

**`async fetchAMCContracts(filters: { status?: string; clientId?: string; search?: string; } = {})`**  
Fetches AMC contracts matching optional filters.  
› ops: select · tables: `amc_contracts`

**`async fetchAMCContractById(id: string)`**  
Fetches detailed contract info, including equipment register and billing schedule.  
› ops: select · tables: `amc_contracts`, `amc_equipment`, `amc_billing_schedule`

**`async createAMCContract(contractData: Partial<AMCContract>)`**  
Creates a new AMC contract in DRAFT status.  
› ops: insert, select · tables: `clients`, `amc_contracts`

**`async updateAMCContract(id: string, updates: Partial<AMCContract>)`**  
Updates an existing contract record.  
› ops: update, select · tables: `amc_contracts`

**`async activateAMCContract(id: string)`**  
Activates an AMC contract, triggering visits and billing schedule generation.  
› ops: update, select · tables: `amc_contracts`

**`async addEquipmentToContract(contractId: string, equipmentItems: Array<Omit<Partial<AMCEquipment>, 'id' | 'contract_id' | 'crea…)`**  
Adds multiple equipment assets to the contract's register.  
› ops: insert, select · tables: `amc_equipment`

**`async convertQuotationToAMC(quotationId: string, customStartDate: string)`**  
Converts an accepted AMC quotation into a Draft AMC contract.  
› ops: update, select · tables: `quotations`

**`async convertProjectToAMC(projectId: string, customStartDate: string)`**  
Converts a project in DLP milestone status to a Draft AMC contract.  
› ops: select · tables: `projects`

**`async renewContract(oldContractId: string, customStartDate: string, newAnnualValue?: number)`**  
Renews an existing contract, copying assets and linking sequence.  
› ops: insert, select · tables: `amc_contracts`

### `amountInWordsService` — JEET ERP — Currency to English Words Conversion Service Formats: AED (Dirhams and Fils) Example: 1,250.50 -> One Thousand Two Hundred Fifty Dirhams and Fifty Fils Only

**`convertAmountToWords(amount: number)`** *(pure fn)*  
Converts a numerical AED amount to UAE Dirhams and Fils in words.  

### `announcementService` — JEET ERP — Company Announcements service

**`async list(userId?: string)`**  
› ops: select · tables: `announcements`, `profiles`, `announcement_reads`

**`async create(a: Partial<Announcement>)`**  
› ops: insert, select · tables: `announcements`

**`async togglePin(id: string, pinned: boolean)`**  
› ops: update · tables: `announcements`

**`async archive(id: string)`**  
› ops: update · tables: `announcements`

**`async markRead(id: string, userId: string)`**  
› ops: upsert · tables: `announcement_reads`

### `attendanceService` — JEET ERP — HR: Attendance & GPS service Daily check-in/out with geolocation. Audit-logged; degrades to [] before the migration is applied.

**`async list(opts?: { date?: string })`**  
› ops: select · tables: `attendance_records`

**`async checkIn(employee_id: string, geo?: { lat?: number; lng?: number; label?: string })`**  
› ops: upsert · tables: `attendance_records`

**`async checkOut(record: Attendance, geo?: { lat?: number; lng?: number })`**  
› ops: update · tables: `attendance_records`

### `auditService`

**`async logEvent(params: { actor_user_id?: string | null; action: string; entity_type: string; entity_id: string; e…)`**  
Inserts a new immutable audit log entry.  
› ops: insert, select · tables: `user_roles`, `audit_log`

**`async getLogs(filters?: AuditLogFilter)`**  
Fetches audit logs with granular filters.  
› ops: select · tables: `audit_log`, `profiles`

### `bankReconciliationService` — JEET ERP — Finance: Bank Reconciliation service Imports statement lines, auto-matches them against system receipts (client_payments) and payments (supplier_payments +

**`async list()`**  
› ops: select · tables: `bank_reconciliations`, `bank_reconciliation_lines`

**`async get(id: string)`**  
› ops: select · tables: `bank_reconciliations`, `bank_reconciliation_lines`

**`async create(input: { payment_account_id?: string | null; account_name?: string; statement_date: string; openin…)`**  
› ops: insert, select · tables: `bank_reconciliations`

**`async importLines(reconId: string, rows: ImportRow[])`**  
› ops: insert · tables: `bank_reconciliation_lines`

**`async autoMatch(reconId: string)`**  
Auto-match unmatched lines against system receipts/payments by amount ± date.  
› ops: update, select · tables: `bank_reconciliation_lines`, `client_payments`, `supplier_payments`

**`async setLine(lineId: string, patch: { matched?: boolean; match_type?: string; matched_ref?: string | null })`**  
› ops: update · tables: `bank_reconciliation_lines`

**`async complete(id: string)`**  
› ops: update · tables: `bank_reconciliations`

### `budgetService` — JEET ERP — Finance: Budget & Cost Control service Project budgets seeded from the BOQ, revisioned and frozen on approval. Committed cost is read live from commitments (LPOs),

**`async createFromBoq(projectId: string)`**  
Seed a new DRAFT budget revision from the project's BOQ.  
› ops: insert, select · tables: `projects`, `boqs`, `project_budgets`, `project_budget_lines`

**`async list()`**  
› ops: select · tables: `project_budgets`, `projects`, `project_budget_lines`

**`async get(id: string)`**  
› ops: select · tables: `project_budgets`, `projects`, `project_budget_lines`

**`async approve(id: string)`**  
Freeze a budget: APPROVED + supersede the previously approved revision.  
› ops: update, select · tables: `project_budgets`

### `businessTime` — JEET ERP — Business Time Utility Service Computes business-hours deadlines in Asia/Dubai (GST = UTC+4) Sunday–Thursday: 08:00 – 18:00 (10 hours/day). Fridays & Saturdays off.

**`getGSTParts(d: Date)`** *(pure fn)*  
Helper to convert a Date into GST parts.  

**`fromGSTParts(parts: Omit<GSTDateTime, 'dayOfWeek'>)`** *(pure fn)*  
Helper to convert GST parts back to a standard Date object.  

**`isWeekendOrHoliday(d: Date, holidays: string[] = [])`** *(pure fn)*  
Checks if a specific date string (YYYY-MM-DD) is a weekend or holiday.  

**`moveToNextBusinessDayStart(d: Date, holidays: string[] = [])`** *(pure fn)*  
Moves a Date to the start of the next business day (08:00 Asia/Dubai).  

**`addBusinessHours(start: Date, hoursToAdd: number, holidays: string[] = [])`** *(pure fn)*  
Adds business hours to a starting date, respecting Asia/Dubai work hours.  
› ops: select · tables: `company_holidays`

### `calendarSyncService` — JEET ERP — Google Calendar Synchronization client Interacts with Supabase Edge Functions for token refresh and API pushes 1. Invoke OAuth background sync edge function

**`async syncMeeting(meetingId: string, action: 'create' | 'update' | 'cancel')`**  
Syncs a meeting detail change to Google Calendars (under feature flag).  

**`async getAuthUrl(provider = 'google')`**  
Triggers the user authorization setup flow redirect.  
› ops: storage · tables: `temp`

### `cashFlowService` — JEET ERP — Rolling 13-Week Cash Flow Forecast Service Computes weekly cash inflows (AR + Milestones) vs outflows (AP + POs)

**`async get13WeekForecast(startingBalance: number = 500000)`**  
Computes a rolling 13-week forecast of cash inflows and outflows.  
› ops: select · tables: `client_invoices`, `project_milestones`, `projects`, `supplier_invoices`, `purchase_orders`

### `clientService` — JEET ERP — Pre-Sales: Client / CRM service CRUD over clients (+ optional CRM fields with a PGRST204 fallback so it works before the migration is applied) and a

**`async list()`**  
› ops: select · tables: `clients`

**`async get(id: string)`**  
› ops: select · tables: `clients`

**`async save(input: Partial<Client> & { name: string }, id?: string)`**  
create/update with graceful degradation if CRM columns don't exist yet  
› ops: insert, update, select · tables: `clients`

**`async get360(id: string, clientName: string)`**  
Per-client 360: tenders (by name), quotations + AMC (by client_id)  
› ops: select · tables: `tenders`, `quotations`, `amc_contracts`

### `commDocsService` — JEET ERP — Document sharing with version control + comments

**`async list()`**  
› ops: select · tables: `shared_documents`, `document_versions`, `document_comments`

**`async getVersions(documentId: string)`**  
› ops: select · tables: `document_versions`

**`async getComments(documentId: string)`**  
› ops: select · tables: `document_comments`

**`async upload(file: File, ownerId: string)`**  
› ops: storage

**`async create(p: { title: string; description?: string; ownerId: string; path: string; mime: string; size: numbe…)`**  
› ops: insert, select · tables: `shared_documents`, `document_versions`

**`async addVersion(documentId: string, p: { path: string; size: number; note?: string; uploadedBy: string })`**  
› ops: insert, update, select · tables: `shared_documents`, `document_versions`

**`async addComment(documentId: string, userId: string, body: string)`**  
› ops: insert · tables: `document_comments`

**`async signedUrl(path: string)`**  
› ops: storage

### `commNotificationService` — JEET ERP — Communication notifications: in-app feed + channel preferences

**`async list(userId: string)`**  
› ops: select · tables: `comm_notifications`, `profiles`

**`async unreadCount(userId: string)`**  
› ops: select · tables: `comm_notifications`

**`async markRead(id: string)`**  
› ops: update · tables: `comm_notifications`

**`async markAllRead(userId: string)`**  
› ops: update · tables: `comm_notifications`

**`async getPrefs(userId: string)`**  
› ops: select · tables: `comm_notification_prefs`

**`async setPref(userId: string, channel: NotifChannel, eventType: string, enabled: boolean)`**  
› ops: upsert · tables: `comm_notification_prefs`

### `commitmentLedgerService` — JEET ERP — Finance: Commitments ledger (cross-project) Unifies manual commitments (cost_commitments table) with LIVE commitments derived from approved LPOs and outstanding payroll

**`async list()`**  
› ops: select · tables: `supplier_invoices`, `purchase_orders`, `cost_commitments`, `projects`

**`async addManual(input: { project_id?: string | null; source_type: CommitmentSource; category?: string; vendor_name…)`**  
› ops: insert · tables: `cost_commitments`

**`async cancelManual(id: string)`**  
› ops: update · tables: `cost_commitments`

### `commitmentService` — JEET ERP — Cost Commitment Tracking Service

**`async getProjectCostCommitments(projectId: string)`**  
Calculates real-time cost commitments and budget comparisons by system for a project.  
› ops: select · tables: `projects`, `comparison_items`, `po_items`

### `commsService` — JEET ERP — Communication & Collaboration — core service Conversations, messages, members, reactions, read receipts, search and Supabase Realtime helpers. Degrades gracefully when

**`async getDirectory(excludeId?: string)`**  
› ops: select · tables: `profiles`

**`async getMyConversations(userId: string)`**  
---- conversations ----  
› ops: select · tables: `conversation_members`, `conversations`, `messages`

**`async getConversation(id: string, userId: string)`**  
› ops: select · tables: `conversations`, `conversation_members`

**`async getChannel(channelKey: string)`**  
› ops: select · tables: `conversations`

**`async getOrCreateDirect(meId: string, otherId: string)`**  
› ops: insert, select · tables: `conversation_members`, `conversations`

**`async createGroup(name: string, memberIds: string[], creatorId: string, type: 'GROUP' | 'PROJECT' = 'GROUP', project…)`**  
› ops: insert, select · tables: `conversations`, `conversation_members`

**`async getProjectRoom(projectId: string)`**  
› ops: select · tables: `conversations`

**`async joinChannel(conversationId: string, userId: string)`**  
› ops: upsert · tables: `conversation_members`

**`async addMembers(conversationId: string, userIds: string[])`**  
› ops: upsert · tables: `conversation_members`

**`async getMessages(conversationId: string, limit = 80)`**  
---- messages ----  
› ops: select · tables: `messages`, `message_reactions`, `message_reads`

**`async getThread(parentId: string)`**  
› ops: select · tables: `messages`

**`async sendMessage(p: { conversationId: string; senderId: string; body: string; attachments?: Attachment[]; mentions?…)`**  
› ops: insert, update, select · tables: `messages`, `conversations`, `comm_notifications`

**`async editMessage(id: string, body: string)`**  
› ops: update · tables: `messages`

**`async deleteMessage(id: string)`**  
› ops: update · tables: `messages`

**`async toggleReaction(messageId: string, userId: string, emoji: string)`**  
› ops: insert, delete, select · tables: `message_reactions`

**`async markRead(conversationId: string, userId: string, messageIds: string[] = [])`**  
› ops: upsert, update · tables: `conversation_members`, `message_reads`

**`async searchMessages(query: string, userId: string)`**  
› ops: select · tables: `conversation_members`, `conversations`, `messages`

**`subscribeToConversation(conversationId: string, onMessage: (m: any)`**  
---- realtime ----  
› ops: realtime

**`subscribeToInbox(userId: string, onChange: ()`**  
› ops: realtime

**`async getUserSmtpConfig(userId: string)`**  
---- SMTP configurations ----  
› ops: select · tables: `user_smtp_configs`

**`async saveUserSmtpConfig(userId: string, host: string, port: number, username: string, password: string, senderEmail: string)`**  
› ops: upsert · tables: `user_smtp_configs`

**`async deleteUserSmtpConfig(userId: string)`**  
› ops: delete · tables: `user_smtp_configs`

**`async getAllUserSmtpConfigs()`**  
› ops: select · tables: `user_smtp_configs`

**`async getMeetingByRoom(roomName: string)`**  
---- meetings / calls lifecycle ----  
› ops: select · tables: `comm_calls`

**`async startMeeting(p: { roomName: string; type: 'voice' | 'video'; conversationId?: string | null; startedBy: string;…)`**  
› ops: insert, select · tables: `comm_calls`

**`async getOrStartMeeting(roomName: string, p: { type: 'voice' | 'video'; conversationId?: string | null; startedBy: string;…)`**  
join existing live meeting for this room, or start a fresh one  

**`async recordParticipantJoin(callId: string, userId: string, displayName?: string)`**  
› ops: upsert, update · tables: `comm_call_participants`, `comm_calls`

**`async recordParticipantLeave(callId: string, userId: string)`**  
› ops: update, select · tables: `comm_call_participants`

**`async updateMeetingActivity(callId: string, count: number)`**  
› ops: update, select · tables: `comm_calls`

**`async updateMeetingStatus(callId: string, status: string)`**  
› ops: update · tables: `comm_calls`

**`async endMeeting(callId: string)`**  
› ops: update, select · tables: `comm_calls`, `comm_call_participants`

**`async endCall(callId: string)`**  
back-compat alias  

**`async reapStaleMeetings(thresholdMinutes = 15)`**  
Opportunistic cleanup: close meetings still marked live whose last activity is older than the threshold (e.g. everyone hard-closed their tab). Prefers the server-side reap_stale_meetings() RPC; falls back to a client-sid  
› ops: update, select, rpc · tables: `comm_calls`, `comm_call_participants` · rpc: `reap_stale_meetings`

**`async getMeetings(limit = 100)`**  
› ops: select · tables: `comm_calls`

**`async getMeetingAttendance(callId: string)`**  
› ops: select · tables: `comm_call_participants`

### `competencyService` — JEET ERP — HR: Training & Competency service Skill catalogue, employee×skill matrix and training records. Audit-logged; degrades to [] before the migration is applied.

**`async listSkills()`**  
› ops: select · tables: `competency_skills`

**`async addSkill(input: { name: string; category?: string; description?: string })`**  
› ops: insert, select · tables: `competency_skills`

**`async removeSkill(id: string)`**  
› ops: delete · tables: `competency_skills`

**`async listCompetencies()`**  
› ops: select · tables: `employee_competencies`

**`async setCompetency(employee_id: string, skill_id: string, level: number)`**  
› ops: upsert · tables: `employee_competencies`

**`async listTraining()`**  
› ops: select · tables: `training_records`

**`async addTraining(input: Partial<Training> & { employee_id: string; course_name: string })`**  
› ops: insert, select · tables: `training_records`

**`async removeTraining(id: string)`**  
› ops: delete · tables: `training_records`

### `competitorService` — JEET ERP — Pre-Sales: Competitor Tracking service Competitor register + per-tender competitive log (who won, their estimated price, reason we lost). Audit-logged; separate-lookup.

**`async listCompetitors()`**  
› ops: select · tables: `competitors`, `tender_competitors`

**`async createCompetitor(input: Partial<Competitor> & { name: string })`**  
› ops: insert, select · tables: `competitors`

**`async updateCompetitor(id: string, patch: Partial<Competitor>)`**  
› ops: update · tables: `competitors`

**`async removeCompetitor(id: string)`**  
› ops: delete · tables: `competitors`

**`async listTenderCompetitors(opts?: { tenderId?: string })`**  
› ops: select · tables: `tender_competitors`, `competitors`, `tenders`

**`async addTenderCompetitor(input: Partial<TenderCompetitor> & { tender_id: string; competitor_id: string })`**  
› ops: insert, select · tables: `tender_competitors`

**`async updateTenderCompetitor(id: string, patch: Partial<TenderCompetitor>)`**  
› ops: update · tables: `tender_competitors`

**`async removeTenderCompetitor(id: string)`**  
› ops: delete · tables: `tender_competitors`

### `dailySiteReportService` — JEET ERP — Projects: Daily Site Report (DSR) service

**`async list(filters: { projectId?: string } = {})`**  
› ops: select · tables: `daily_site_reports`

**`async get(id: string)`**  
› ops: select · tables: `daily_site_reports`

**`async create(input: DSRInput)`**  
› ops: insert, select · tables: `daily_site_reports`

**`async setStatus(id: string, status: 'DRAFT' | 'SUBMITTED')`**  
› ops: update · tables: `daily_site_reports`

### `depreciationService`

**`getPeriodMonth(dateStr: string)`**  
Helper to format a date to YYYY-MM-01 (first of the month)  

**`generateSchedule(acquisitionDateStr: string, acquisitionCost: number, salvageValue: number, usefulLifeMonths: number)`**  
Generates a complete depreciation schedule using Straight-Line method. Charges a full month's depreciation in the acquisition month (Full-Month Convention).  

**`getNbvAtPeriod(schedule: DepreciationScheduleRowInput[], targetPeriodMonthStr: string)`**  
Retrieves the closing NBV at a specific target period month from a generated schedule. If the period is before the acquisition month, returns acquisition cost. If the period is after the last schedule month, returns the   

**`truncateScheduleForDisposal(schedule: DepreciationScheduleRowInput[], disposalDateStr: string)`**  
Truncates the depreciation schedule up to the disposal period and returns it. Truncation month (disposal month) will be the final row.  

**`calculateDisposalGainLoss(nbvAtDisposal: number, proceeds: number)`**  
Calculates Gain or Loss on Asset Disposal: proceeds - NBV at disposal  

### `deviceImportService` — JEET ERP — Device Clipboard Import Service

**`parsePasteData(pasteText: string)`**  
Parses tab-separated values (TSV) from Excel/CSV copy-paste actions. Expected columns: Col 0: Device Type (mandatory) Col 1: Label / Tag (mandatory, e.g., CAM-GF-001) Col 2: Location (mandatory, e.g., Ground Floor Lobby)  

**`async importDevices(packageId: string, pasteText: string)`**  
Bulk inserts parsed devices into a T&C package.  
› ops: insert, select · tables: `tc_devices`

### `disposalService`

**`async getDisposals()`**  
Fetches all disposal records.  
› ops: select · tables: `asset_disposals`

**`async disposeAsset(disposal: Omit<AssetDisposal, 'id' | 'nbv_at_disposal' | 'gain_loss' | 'created_at'>)`**  
Records a new asset disposal, stops future depreciation, computes gain/loss, and syncs statuses.  
› ops: insert, update, delete, select · tables: `fixed_assets`, `depreciation_schedule`, `asset_disposals`

### `employeeService` — JEET ERP — Employee Master Service

**`async getEmployees(filters?: { department?: string; status?: string })`**  
Retrieves all employees with filters.  
› ops: select · tables: `employees`

**`async getEmployeeById(employeeId: string)`**  
Retrieves a single employee by ID.  
› ops: select · tables: `employees`

**`async createEmployee(params: Omit<Employee, 'id' | 'employee_number' | 'current_hourly_cost_rate' | 'created_at' | 'upd…)`**  
Creates a new employee master record.  
› ops: insert, select · tables: `employees`

**`async updateEmployee(employeeId: string, updates: Partial<Employee>)`**  
Updates an employee master record.  
› ops: update, select · tables: `employees`

**`async deleteEmployee(employeeId: string)`**  
Soft deletes an employee (sets is_active to false).  
› ops: update · tables: `employees`

**`async getCompensationHistory(employeeId: string)`**  
COMPENSATION HISTORY (RLS-Guarded)  
› ops: select · tables: `employee_compensation`

**`async addCompensation(params: { employee_id: string; effective_from: string; basic_salary: number; housing_allowance: nu…)`**  
› ops: insert, select · tables: `employee_compensation`

**`async getCertifications(employeeId: string)`**  
CERTIFICATIONS  
› ops: select · tables: `employee_certifications`

**`async addCertification(params: Omit<EmployeeCertification, 'id' | 'created_at' | 'updated_at'>)`**  
› ops: insert, select · tables: `employee_certifications`

**`async updateCertification(certId: string, updates: Partial<EmployeeCertification>)`**  
› ops: update, select · tables: `employee_certifications`

**`async deleteCertification(certId: string)`**  
› ops: delete · tables: `employee_certifications`

**`async getLinkedDocuments(employeeId: string)`**  
DMS DOCUMENT COHESION  
› ops: select · tables: `employee_documents`

**`async linkDocument(params: { employee_id: string; document_id: string; document_type: string; })`**  
› ops: insert, select · tables: `employee_documents`

**`async unlinkDocument(employeeDocId: string)`**  
› ops: delete · tables: `employee_documents`

### `eventService` — JEET ERP — Platform Event Bus Service Provides single entry point to emit ERP system events

**`async emitEvent(eventType: string, entityType?: string, entityId?: string, projectId?: string, payload: Record<str…)`**  
Emits a system event to the database event bus ledger.  
› ops: insert, select · tables: `system_events`

### `evmService` — JEET ERP — Projects: Earned Value Management (EVM) PV / EV / AC and SPI / CPI / EAC over the WBS + project actuals. Read-only; reuses wbsService + projectFinancialsService.

**`async compute(projectId: string)`**  

### `executiveFinanceService` — JEET ERP — Finance: Executive Dashboard aggregator Pulls headline cash/AR/AP/commitment/profit numbers, chart series and risk alerts from existing services and tables. Read-only.

**`async getDashboard()`**  

**`safe(supabase.from('client_invoices')`**  
› ops: select · tables: `client_invoices`

### `financialReportsService` — JEET ERP — Finance: Financial Reports P&L, Trial Balance, General Ledger, Cost/Revenue by project. Reads existing finance tables + the accounting journal. Read-only;

**`async profitAndLoss(start: string, end: string)`**  
› ops: select · tables: `client_invoices`, `supplier_invoices`

**`async trialBalance(start: string, end: string)`**  

**`async generalLedger(start: string, end: string)`**  

**`async balanceSheet(asOf: string)`**  
Balance Sheet as-of a date, derived from the posting journal (since inception).  

**`async byProject(start: string, end: string, kind: 'COST' | 'REVENUE')`**  
› ops: select · tables: `projects`

### `fineService`

**`async getFines()`**  
Fetches all traffic fines from the database, including vehicle and driver details.  
› ops: select · tables: `vehicle_fines`

**`async getFinesByVehicleId(vehicleId: string)`**  
Fetches traffic fines for a specific vehicle.  
› ops: select · tables: `vehicle_fines`

**`async resolveDriverForDate(vehicleId: string, fineDate: string)`**  
Attempts to auto-resolve the active driver for a specific vehicle on a given fine date.  
› ops: select · tables: `vehicle_assignments`

**`async createFine(fine: Omit<VehicleFine, 'id' | 'created_at' | 'updated_at'>)`**  
Creates a new traffic fine record. Auto-resolves driver if not explicitly provided.  
› ops: insert, select · tables: `vehicle_fines`

**`async updateFine(id: string, updates: Partial<VehicleFine>)`**  
Updates fine fields (e.g. status, comments, payment details).  
› ops: update, select · tables: `vehicle_fines`

**`async markFineDriverLiable(fineId: string, periodMonth: string)`**  
Marks a fine as Driver-Liable and posts a pending deduction adjustment to Phase 7 Employee Payroll.  
› ops: insert, update, select · tables: `vehicle_fines`, `payroll_adjustments`

**`async bulkCreateFines(fines: Omit<VehicleFine, 'id' | 'created_at' | 'updated_at'>[])`**  
Bulk inserts multiple fines after human review.  
› ops: insert, select · tables: `vehicle_fines`

### `fixedAssetService`

**`async getFixedAssets()`**  
Fetches all fixed assets.  
› ops: select · tables: `fixed_assets`

**`async getFixedAssetById(id: string)`**  
Fetches a specific fixed asset by its ID, along with its depreciation schedule.  
› ops: select · tables: `fixed_assets`, `depreciation_schedule`

**`async createFixedAsset(asset: Omit<FixedAsset, 'id' | 'asset_number' | 'accumulated_depreciation' | 'net_book_value' | 's…)`**  
Creates a new fixed asset, generates its depreciation schedule, and links it to a vehicle/tool.  
› ops: insert, update, select · tables: `fixed_assets`, `depreciation_schedule`, `vehicles`, `tools`

**`async runMonthlyDepreciation(periodMonth: string)`**  
Executes a monthly depreciation run: posts all pending schedule rows for a given period month, updates the accumulated depreciation and net book values of assets, and caps fully-depreciated ones.  
› ops: update, select · tables: `depreciation_schedule`, `fixed_assets`

**`async generateDepreciationJournal(periodMonth: string)`**  
Generates double-entry journal entries representing period depreciation for exporting.  
› ops: select · tables: `depreciation_schedule`

**`async exportJournalToExcel(periodMonth: string, filename?: string)`**  
Triggers download of the depreciation journal entries spreadsheet in Excel.  

### `formBuilderService` — JEET ERP — Form Builder Service Dynamic form definitions per module. Modules render the active form via getActiveForm() — no code changes needed

**`async getDefinitions()`**  
› ops: select · tables: `form_definitions`

**`async getDefinition(id: string)`**  
› ops: select · tables: `form_definitions`

**`async getActiveForm(moduleKey: string)`**  
Returns the active form schema for a module, or null when none configured.  
› ops: select · tables: `form_definitions`

**`async createDefinition(input: { module_key: string; name: string; description?: string; schema?: FormSchema })`**  
› ops: insert, select · tables: `form_definitions`

**`async updateSchema(id: string, schema: FormSchema)`**  
› ops: update · tables: `form_definitions`

**`async updateMeta(id: string, patch: { name?: string; description?: string })`**  
› ops: update · tables: `form_definitions`

**`async activateDefinition(id: string)`**  
› ops: update, select · tables: `form_definitions`

**`async deleteDefinition(id: string)`**  
› ops: delete · tables: `form_definitions`

**`flattenFields(schema: FormSchema)`**  
---------- Runtime helpers ---------- Returns all fields of a schema flattened.  

**`isFieldVisible(field: FormFieldDef, values: Record<string, unknown>)`**  
Resolves field visibility against current form values (conditional logic).  

**`validate(schema: FormSchema, values: Record<string, unknown>)`**  
Validates values against a schema; returns field-keyed error messages.  

### `fuelService`

**`async getFuelLogs()`**  
Fetches all fuel logs from the database, including vehicle, driver, and project details.  
› ops: select · tables: `fuel_logs`

**`async getFuelLogsByVehicleId(vehicleId: string)`**  
Fetches fuel logs for a specific vehicle.  
› ops: select · tables: `fuel_logs`

**`async createFuelLog(log: Omit<FuelLog, 'id' | 'efficiency_km_l' | 'is_anomaly' | 'created_at'>)`**  
Logs a new fuel fill-up, computes efficiency, checks for rolling anomalies, and updates vehicle mileage.  
› ops: insert, select · tables: `fuel_logs`

### `gratuityService` — JEET ERP — UAE Gratuity and EOSB Service Reference: UAE Federal Decree-Law No. 33 of 2021

**`calculateEOSB(params: { joinDate: string; // YYYY-MM-DD exitDate: string; // YYYY-MM-DD basicSalary: number; tot…)`**  
Calculates the End of Service Benefit (gratuity) and leave encashment. Basic salary is used for gratuity. Total salary is used for leave balance encashment.  

### `grnExpenseService` — JEET ERP — GRN-to-Expense Finance Report Reconciles received goods value against supplier invoicing and payment, by project, for a period. Answers: what did we receive,

**`async getReport(period: ExpensePeriod = 'ALL')`**  
› ops: select · tables: `grns`, `grn_items`, `po_items`, `supplier_invoices`

### `grnReceivablesService` — JEET ERP — GRN Receivables Consolidated view of every line item awaiting receipt across open LPOs (and direct-purchased PRs), with project, supplier,

**`async getReceivables()`**  
› ops: select · tables: `purchase_orders`, `po_items`, `supplier_invoices`, `projects`, `purchase_requests`, `purchase_request_items`

**`async cancelLineItem(poItemId: string)`**  
Cancels (closes short) an LPO line item that won't be delivered. If every line of the LPO ends up complete or closed, the LPO is cancelled too.  
› ops: update, select · tables: `po_items`, `purchase_orders`

**`async cancelPRLineItem(prItemId: string)`**  
Cancels a Purchase Request line item. When every line of the PR is cancelled, the PR itself is cancelled. Requires migration 20260613300000.  
› ops: update, select · tables: `purchase_request_items`, `purchase_requests`

### `grnService` — JEET ERP — Goods Receipt Note (GRN) Service

**`async recordGRN(grnData: Omit<GoodsReceiptNote, 'id' | 'grn_number' | 'received_by' | 'received_at' | 'status' | '…)`**  
Records a new Goods Receipt Note inside a database transaction.  
› ops: update, select, rpc · tables: `grn_items`, `grns`, `po_items` · rpc: `create_grn_transaction`

**`async getGRNs(filters?: { project_id?: string; po_id?: string; search?: string; })`**  
Retrieves all GRN records, optionally filtered.  
› ops: select · tables: `grns`

**`async getGRNDetail(grnId: string)`**  
Retrieves details of a single GRN.  
› ops: select · tables: `grns`, `grn_items`

**`async getReturns(filters?: { status?: GRNReturnStatus; project_id?: string; })`**  
Retrieves returns tracker tickets.  
› ops: select · tables: `grn_returns`

**`async updateReturnStatus(returnId: string, status: GRNReturnStatus, resolutionNotes?: string)`**  
Sign-off / Updates a return ticket status.  
› ops: update, select · tables: `grn_returns`

### `handoverCertPDFService` — JEET ERP — Handover Closeout Certificate PDF Service

**`async generateAndFileHandoverCertificate(projectId: string)`**  
Generates a branded Handover Certificate PDF, uploads it, registers it in DMS, and links it back to the handover package.  
› ops: select · tables: `projects`

**`autoTable(doc, { startY: y, margin: { left: margin + 5, right: margin + 5 }, body: specsRows, theme: 'plain'…)`**  

### `handoverService` — JEET ERP — Handover / Closeout Service

**`async getHandoverPackage(projectId: string)`**  
Retrieves the handover package and checklist for a project.  
› ops: select · tables: `handover_packages`, `handover_checklist_items`, `projects`, `profiles`, `documents`

**`async initializeHandoverPackage(projectId: string)`**  
Initializes a handover package and inserts the default checklist requirements.  
› ops: insert, select · tables: `projects`, `handover_packages`, `handover_checklist_items`

**`async checkGateStatus(projectId: string)`**  
Validates project readiness for handover by inspecting all gates.  
› ops: select · tables: `projects`, `tc_packages`, `snags`

**`async updateChecklistItemStatus(itemId: string, status: 'PENDING' | 'DONE' | 'WAIVED', params: { evidence_document_id?: string; wa…)`**  
Updates the status of a checklist item.  
› ops: update, select · tables: `handover_checklist_items`

**`async submitHandoverSignOff(projectId: string, params: { client_signatory_name: string; client_signatory_designation: string; …)`**  
Submits handover sign-off, updates project status, generates retention release invoices, and AMC opportunities.  
› ops: insert, select · tables: `projects`, `private_documents`, `documents`

### `inventoryGlService` — JEET ERP — Warehouse: Inventory GL Integration service Maps stock movement types to GL accounts and builds a period journal from the movement ledger. Degrades gracefully to built-in

**`async getMappings()`**  
› ops: select · tables: `inventory_gl_mappings`

**`async upsertMapping(m: GlMapping)`**  
› ops: upsert · tables: `inventory_gl_mappings`

**`async getPeriodJournal(opts: { date_from?: string; date_to?: string })`**  
› ops: select · tables: `stock_transactions`

### `invoiceMathService` — JEET ERP — Client Invoice Math Engine Handles: FTA-compliant line VAT (round half-up), advance recovery, retention deduction, and net due calculation.

**`round2(value: number)`** *(pure fn)*  
Rounds a number to exactly 2 decimal places (half-up rounding).  

**`round4(value: number)`** *(pure fn)*  
Rounds a number to exactly 4 decimal places for unit prices.  

**`calculateInvoiceLine(line: CalcLineInput)`** *(pure fn)*  
Computes taxable, VAT, and total for a single invoice line item. As per FTA regulations, VAT must be computed at the line level and rounded.  

**`calculateInvoiceTotals(input: InvoiceMathInput)`** *(pure fn)*  
Computes the overall invoice metrics based on items and project conditions.  

### `invoicePDFService` — JEET ERP — Client Invoice and Credit Note PDF Compiler Generates: FTA-compliant tax invoices & credit notes

**`async generateInvoicePDF(invoice: ClientInvoice, items: ClientInvoiceItem[])`**  
Generates a beautifully formatted jsPDF document for a client Tax Invoice.  

**`String(idx + 1)`**  

**`autoTable(doc, { startY: y, margin: { left: margin, right: margin }, head: [['No', 'Description', 'BOQ Ref',…)`**  

**`async generateCreditNotePDF(creditNote: CreditNote, invoice: ClientInvoice)`**  
Generates a beautifully formatted jsPDF document for a Credit Note.  

### `invoiceService` — JEET ERP — Client Invoice Service Handles: CRUD, approvals, status transitions, PDF uploads, retention ledgering, and event triggers.

**`async getBillableMilestones(projectId: string)`**  
Completed (DONE) milestones for a project that can be billed now.  
› ops: select · tables: `project_milestones`

**`async generateProgressFromMilestones(projectId: string, lines: Array<{ milestone_id: string; description: string; amount: number }>,)`**  
Generates a PROGRESS client invoice from completed project phases. Each line is a completed milestone with a claim amount; advance recovery and retention are auto-applied from the project's contract terms. The draft then  
› ops: select · tables: `projects`

**`async fetchInvoices(filters: { status?: string; projectId?: string; clientId?: string; search?: string; } = {})`**  
Fetches all client invoices matching the filters.  
› ops: select · tables: `client_invoices`

**`async fetchInvoiceById(id: string)`**  
Fetches details of a single invoice, including line items.  
› ops: select · tables: `client_invoices`, `client_invoice_items`

**`async createInvoiceDraft(invoiceData: Omit<Partial<ClientInvoice>, 'id' | 'created_at' | 'updated_at'>, itemsData: Array<Om…)`**  
Creates a new client invoice draft.  
› ops: insert, select · tables: `clients`, `projects`, `client_invoices`, `client_invoice_items`

**`async submitForApproval(id: string)`**  
Submits a draft invoice for manager review.  
› ops: update · tables: `client_invoices`

**`async approveInvoice(id: string)`**  
Approves a client invoice. Compiles the branded Tax Invoice PDF, uploads it to the DMS, and creates retention records in the ledger if applicable.  
› ops: insert, update, select · tables: `projects`, `client_invoices`, `documents`, `project_retention_ledger`, `profiles`

**`async rejectInvoice(id: string, reason: string)`**  
Rejects / returns a client invoice with comments.  
› ops: update · tables: `client_invoices`

**`async markAsSent(id: string)`**  
Marks approved client invoice as sent to the customer.  
› ops: update · tables: `client_invoices`

**`async writeOffInvoice(id: string, reason: string)`**  
Writes off an overdue client invoice.  
› ops: update · tables: `client_invoices`

**`async deleteInvoice(id: string)`**  
Soft deletes a client invoice draft.  
› ops: update · tables: `client_invoices`

**`async fetchRetentionLedger(projectId: string)`**  
Fetches retention ledger records for a project.  
› ops: select · tables: `project_retention_ledger`

**`async releaseRetention(projectId: string, invoiceId: string, amount: number)`**  
Explicitly releases retention for a project by inserting a RELEASED ledger record.  
› ops: insert · tables: `project_retention_ledger`

### `kpiService` — JEET ERP — Centralized KPI Aggregation Service Computes executive COE-level indicators and module stats

**`async getExecutiveKPIs()`**  
Fetches all high-level executive KPIs.  
› ops: select · tables: `projects`, `client_payments`, `supplier_payments`, `document_expiry_alerts`, `client_invoices`, `supplier_invoices`

**`async getFinanceKPIs()`**  
Fetches Finance module-specific KPIs.  
› ops: select · tables: `client_payments`, `supplier_payments`, `client_invoices`

### `leaveService` — JEET ERP — Leave & Attendance Management Service

**`async getLeaveRequests(employeeId: string)`**  
Retrieves leave requests for an employee.  
› ops: select · tables: `leave_requests`

**`async getApprovalsQueue()`**  
Retrieves all leave requests in the manager approval queue.  
› ops: select · tables: `leave_requests`

**`async calculateWorkingDays(fromDate: string, toDate: string)`**  
Calculates working days between two dates, excluding weekends (Fri/Sat) and company holidays.  
› ops: select · tables: `company_holidays`

**`async createLeaveRequest(params: Omit<LeaveRequest, 'id' | 'status' | 'approver_id' | 'created_at' | 'updated_at'>)`**  
Creates a new leave request. Validates overlaps and leave balance.  
› ops: insert, select · tables: `leave_requests`, `leave_balances`, `employees`

**`async approveLeaveRequest(requestId: string)`**  
Approves a leave request, updating leave balances where applicable.  
› ops: insert, update, select · tables: `leave_requests`, `leave_balances`

**`async rejectLeaveRequest(requestId: string)`**  
Rejects a leave request.  
› ops: update, select · tables: `leave_requests`

**`async getLeaveCalendar(startDate: string, endDate: string)`**  
Gets leave requests within a range for swimlane calendar mapping.  
› ops: select · tables: `leave_requests`

### `maintenanceService`

**`async getMaintenanceLogs()`**  
Fetches all vehicle maintenance logs, including vehicle details.  
› ops: select · tables: `vehicle_maintenance`

**`async getMaintenanceLogsByVehicleId(vehicleId: string)`**  
Fetches maintenance logs for a specific vehicle.  
› ops: select · tables: `vehicle_maintenance`

**`async createMaintenanceLog(log: Omit<VehicleMaintenance, 'id' | 'created_at' | 'updated_at'>)`**  
Creates a new vehicle maintenance log. Syncs vehicle odometer if completed.  
› ops: insert, select · tables: `vehicle_maintenance`

**`async updateMaintenanceLog(id: string, updates: Partial<VehicleMaintenance>)`**  
Updates an existing maintenance log. Syncs vehicle odometer if status shifts to completed.  
› ops: update, select · tables: `vehicle_maintenance`

**`async syncVehicleOdometer(vehicleId: string, odometerKm: number)`**  
Internal helper to update a vehicle's odometer reading if the maintenance log shows a higher mileage.  
› ops: update, select · tables: `vehicles`

### `meetingService` — JEET ERP — Meetings Service Client Handles creation, calendar feeds, responses, minutes, and AI parsing

**`async fetchMeetings(filters: { project_id?: string; organizer_id?: string; status?: MeetingStatus; } = {})`**  
Fetches all scheduled meetings.  
› ops: select · tables: `meetings`

**`async fetchMeetingById(id: string)`**  
Fetches meeting details along with attendees and action items.  
› ops: select · tables: `meetings`, `meeting_attendees`, `meeting_action_items`

**`async createMeeting(meetingData: Omit<Meeting, 'id' | 'created_at' | 'attendees' | 'action_items'>, attendees: Array<{…)`**  
Schedules a new meeting.  
› ops: insert, delete, select · tables: `meetings`, `meeting_attendees`

**`async updateMeeting(id: string, updates: Partial<Meeting>)`**  
Updates meeting status or time boundaries.  
› ops: update · tables: `meetings`

**`async respondToInvitation(meetingId: string, userId: string, response: AttendeeResponse)`**  
Responds to an invitation (RSVP).  
› ops: update · tables: `meeting_attendees`

**`async extractActionItems(minutesText: string)`**  
Invokes Gemini via Edge Function to extract checklist items from raw meeting minutes.  

**`async publishMinutes(meetingId: string, minutesMarkdown: string, actionItems: Array<{ description: string; assignee_id?…)`**  
Publishes minutes, creates action tasks, and files notes in project DMS.  
› ops: insert, update, select · tables: `meetings`, `tasks`, `meeting_action_items`

### `mrfService` — JEET ERP — Material Requisition Form (MRF) & Issue Service

**`async createMRF(mrf: Omit<MaterialRequisition, 'id' | 'mrf_number' | 'created_at' | 'updated_at' | 'requested_by'>…)`**  
Creates a new Material Requisition Form and its item lines in a transaction.  
› ops: insert, select · tables: `material_requisitions`, `mrf_items`

**`async getMRFs(filters?: { project_id?: string; status?: MRFStatus })`**  
Retrieves MRF lists.  
› ops: select · tables: `material_requisitions`, `projects`, `profiles`

**`async getMRFDetail(id: string)`**  
Retrieves details of a single MRF and its items.  
› ops: select · tables: `material_requisitions`, `projects`, `profiles`, `mrf_items`

**`async approveMRF(id: string, approvedItems: Array<{ id: string; qty_approved: number }>)`**  
Approves an MRF and sets reserved balances.  
› ops: insert, update, select · tables: `mrf_items`, `stock_balances`, `material_requisitions`

**`async issueMRF(id: string, issueItems: Array<{ id: string; qty_to_issue: number; serialNumbers?: string[] }>, opt…)`**  
Issues material against an approved MRF. Decrements stock balance, decrements reserved balance, and checks project BOQ limits.  
› ops: update, select · tables: `boqs`, `stock_balances`, `mrf_items`, `stock_items`, `stock_transactions`, `material_requisitions`

**`async returnFromSite(params: { project_id: string; stock_item_id: string; location_id: string; qty: number; serialNumbe…)`**  
Records a return of unused materials from site to warehouse. Credits the project (reduces project actuals) and increases inventory.  
› ops: select · tables: `stock_items`, `stock_balances`

### `notificationService` — JEET ERP — Notification Engine Service Handles client-side notification fetching, updates, and user preferences

**`async fetchNotifications(userId: string, limit = 50, onlyUnread = false)`**  
Fetches unread or all notifications for the active user.  
› ops: select · tables: `notifications`

**`async markAsRead(notificationId: string, actioned = false)`**  
Marks a specific notification as READ/ACTIONED.  
› ops: update · tables: `notifications`

**`async markAllAsRead(userId: string)`**  
Marks all pending/unread notifications for a user as READ.  
› ops: update · tables: `notifications`

**`async fetchPreferences(userId: string)`**  
Fetches the notification preference matrix for a user.  
› ops: select · tables: `user_notification_preferences`

**`async updatePreference(userId: string, eventModule: string, channel: NotificationChannel, mode: NotificationPreferenceMode)`**  
Updates or inserts a user notification preference.  
› ops: upsert · tables: `user_notification_preferences`

### `numberingService` — JEET ERP — Dynamic Numbering Service Configurable document numbering per module. Generation is atomic via the generate_document_number RPC (see migration).

**`previewNumber(rule: Pick<NumberingRule, 'prefix' | 'separator' | 'include_year' | 'include_month' | 'padding' | …)`** *(pure fn)*  

**`async getRules()`**  
› ops: select · tables: `numbering_rules`

**`async getRule(moduleKey: string)`**  
› ops: select · tables: `numbering_rules`

**`async upsertRule(rule: { id?: string; module_key: string; prefix: string; separator?: string; include_year?: boolea…)`**  
› ops: upsert, select · tables: `numbering_rules`

**`async deleteRule(id: string)`**  
› ops: delete · tables: `numbering_rules`

**`async generateNumber(moduleKey: string)`**  
Generates the next document number for a module (atomic, race-safe). Falls back to a timestamp-based number if the RPC is unavailable (e.g. migration not applied yet) so callers never break.  
› ops: rpc · rpc: `generate_document_number`

**`async previewNext(moduleKey: string)`**  
Preview of the next number without consuming the sequence.  

### `paymentAccountService` — JEET ERP — Payment Accounts / Cards Cards, bank accounts and cash/petty-cash floats that pay for expenses. Balance = opening balance − everything paid from it.

**`async list()`**  
› ops: select · tables: `payment_accounts`

**`safe(supabase.from('supplier_payments')`**  
› ops: select · tables: `supplier_payments`

**`async create(input: { name: string; type: AccountType; account_ref?: string | null; opening_balance?: number; n…)`**  
› ops: insert · tables: `payment_accounts`

**`async setActive(id: string, isActive: boolean)`**  
› ops: update · tables: `payment_accounts`

### `paymentService` — JEET ERP — Client Payment and Allocation Service Handles: Cash receipts (payments), invoice allocations, status updates, and notification events.

**`async fetchPayments(filters: { clientId?: string } = {})`**  
Fetches client payments.  
› ops: select · tables: `client_payments`

**`async fetchAllocations(paymentId: string)`**  
Fetches allocations for a payment.  
› ops: select · tables: `payment_allocations`

**`async recordPayment(paymentData: Omit<Partial<ClientPayment>, 'id' | 'payment_number' | 'created_by' | 'created_at'>, …)`**  
Records a new client payment and allocates it atomically to invoices.  
› ops: insert, select · tables: `client_payments`, `payment_allocations`, `client_invoices`

### `payrollService`

**`calculateEmployeeSalary(params: { periodMonth: string; // YYYY-MM-DD employee: Employee; compensation: EmployeeCompensatio…)`**  
Calculates a single employee's payroll line item for a given month.  

**`async fetchMonthlyOtHours(employeeId: string, startDateStr: string, endDateStr: string)`**  
Fetches overtime hours from approved timesheets for a given month.  
› ops: select · tables: `timesheets`, `timesheet_entries`

**`async fetchMonthlyLeaveDays(employeeId: string, startDateStr: string, endDateStr: string)`**  
Fetches leave details and processes sick leave tiers.  
› ops: select · tables: `leave_requests`

**`async runPayrollForMonth(periodMonth: string)`**  
Compiles the full payroll run for a month and writes to database.  
› ops: insert, update, select · tables: `employees`, `employee_compensation`, `payroll_adjustments`, `payroll_runs`, `payroll_lines`

**`async approvePayrollRun(runId: string)`**  
Approves a payroll run, locking it and all associated timesheets.  
› ops: update, select · tables: `payroll_runs`, `timesheets`, `supplier_invoices`, `timesheet_entries`

### `permissionService`

**`async getPermissions()`**  
Fetches the entire permissions catalog.  
› ops: select · tables: `permissions`

**`async getRolePermissions(roleId: string)`**  
Fetches permissions currently linked to a specific role.  
› ops: select · tables: `role_permissions`

**`async updateRolePermissions(roleId: string, mappings: { permissionId: string; scope: PermissionScope }[])`**  
Updates permission mappings and scopes for a role.  
› ops: insert, delete · tables: `role_permissions`

**`async getUserEffectivePermissions(userId: string)`**  
Resolves the list of effective permissions and scopes for a user. Leverages roles hierarchy level to resolve the most permissive scope (ALL > TEAM > ASSIGNED > OWN).  
› ops: select · tables: `user_roles`, `role_permissions`

### `pettyCashService` — JEET ERP — Finance: Petty Cash service Funds (floats) + transactions (expense/replenish/return) with approval. Balance = opening + approved replenish/return − approved

**`async listFunds()`**  
› ops: select · tables: `petty_cash_funds`, `petty_cash_transactions`

**`async listTransactions(limit = 100)`**  
› ops: select · tables: `petty_cash_transactions`

**`async createFund(input: { name: string; custodian_name?: string; opening_balance?: number; low_threshold?: number })`**  
› ops: insert · tables: `petty_cash_funds`

**`async createTransaction(input: { fund_id: string; type: PettyTxnType; amount: number; category?: string; description?: str…)`**  
Expense claims start PENDING; replenish/return post APPROVED (finance action).  
› ops: insert · tables: `petty_cash_transactions`

**`async setStatus(id: string, status: PettyTxnStatus)`**  
› ops: update · tables: `petty_cash_transactions`

### `poApprovalService` — JEET ERP — PO Approval Workflow Service

**`determineApprovalStages(totalWithVat: number)`**  
Determines the required approval stages based on the gross PO total. Total <= 50,000 AED (including VAT) -> Commercial Manager stage only. Total > 50,000 AED (including VAT) -> Commercial Manager + General Manager stages  

**`validatePOSubmission(po: Partial<PurchaseOrder>)`**  
Validates a Purchase Order before submission. Enforces that manual POs > 10,000 AED require a justification.  

**`async checkApprovalPermission(po: PurchaseOrder, userId: string, stage: POApprovalStage)`**  
Checks if a user is authorized to approve a PO at a given stage. Guard: Users cannot approve POs they created. Role: Only admin or manager roles can approve.  
› ops: rpc · rpc: `has_permission`

**`async submitForApproval(poId: string, actorUserId?: string)`**  
Submits a PO for approval, moving it to PENDING_APPROVAL.  
› ops: update, select · tables: `purchase_orders`

**`async processApproval(poId: string, stage: POApprovalStage, action: POApprovalAction, comment: string | null, actorUserI…)`**  
Processes a PO sign-off (APPROVE or REJECT).  
› ops: insert, update, select · tables: `purchase_orders`, `po_approvals`, `po_items`

### `poFromComparisonService` — JEET ERP — PO Generator From Comparison Service

**`async findComparisonForProject(projectId: string)`**  
Resolves the most relevant comparison sheet for a project (via its linked quotation), preferring APPROVED, then any non-superseded sheet. Returns the comparison id or null.  
› ops: select · tables: `projects`, `quotations`, `supplier_comparisons`

**`async getProposalsForProject(projectId: string)`**  
Convenience: resolve + build proposals for a project in one call.  

**`async generatePOProposalsFromComparison(comparisonId: string)`**  
Loads an approved comparison sheet and builds PO draft proposals grouped by selected supplier.  
› ops: select · tables: `supplier_comparisons`, `comparison_items`, `supplier_offers`, `pricing_suppliers`

### `poNumberService` — JEET ERP — PO & GRN Sequence Number Service Consumes admin-configured numbering rules (numbering_rules table) when available; falls back to the legacy per-module

**`async getNextPOPreview()`**  
Generates a preview of the next PO number. Prefers the admin-configured numbering rule; falls back to the legacy po_number_sequences table.  

**`async getNextGRNPreview()`**  
Generates a preview of the next GRN number. Prefers the admin-configured numbering rule; falls back to the legacy grn_number_sequences table.  

### `poPDFService` — JEET ERP — Purchase Order (LPO) PDF Compiler Service

**`async generatePOPDF(po: PurchaseOrder, items: POItem[])`**  
Generates a beautifully formatted jsPDF document for the LPO.  

**`String(idx + 1)`**  

**`autoTable(doc, { startY: y, margin: { left: margin, right: margin }, head: [['No', 'Item Code', 'Description…)`**  

### `poService` — JEET ERP — Purchase Order (LPO) Core Service

**`async getPOs(filters?: { status?: POStatus; project_id?: string; supplier_id?: string; search?: string; })`**  
Retrieves all PO records matching the filter criteria.  
› ops: select · tables: `purchase_orders`

**`async getPODetail(poId: string)`**  
Retrieves details of a single PO, including items and approvals history.  
› ops: select · tables: `purchase_orders`, `po_items`, `po_approvals`, `profiles`

**`async createPO(poData: Omit<PurchaseOrder, 'id' | 'po_number' | 'revision_number' | 'is_latest' | 'status' | 'is_…)`**  
Creates a new Purchase Order in DRAFT status with its line items.  
› ops: insert, delete, select · tables: `purchase_orders`, `po_items`

**`async updatePO(poId: string, poData: Partial<PurchaseOrder>, items?: Array<Omit<POItem, 'id' | 'po_id' | 'line_no…)`**  
Updates an existing DRAFT Purchase Order and resets/rewrites its line items.  
› ops: insert, update, delete, select · tables: `purchase_orders`, `po_items`

**`async sendPO(poId: string)`**  
Sets a Purchase Order status to SENT.  
› ops: update, select · tables: `purchase_orders`

**`async acknowledgePO(poId: string, ackReference: string, ackDate?: string)`**  
Sets a Purchase Order status to ACKNOWLEDGED and records the reference.  
› ops: update, select · tables: `purchase_orders`

**`async cancelPO(poId: string, reason: string)`**  
Cancels a Purchase Order.  
› ops: update, select · tables: `purchase_orders`

**`async closeShortPO(poId: string, reason: string)`**  
Closes a PO short (when deliveries are partially completed, but no more are expected).  
› ops: update, select · tables: `purchase_orders`, `po_items`

**`async revisePO(poId: string)`**  
Creates a new PO revision clone. Deprecates/Supersedes the old revision and spawns a new editable DRAFT.  
› ops: insert, update · tables: `purchase_orders`

### `ppmScheduleService` — JEET ERP — PPM Visits Scheduler Service Distributes PPM visits evenly across the contract duration.

**`async generatePPMVisitsForContract(contract: AMCContract)`**  
Generates unscheduled PPM visits distributed evenly across the contract period. Spacing is calculated based on visits_per_year over a 12-month period.  
› ops: insert, select · tables: `ppm_visits`

### `prService` — JEET ERP — Purchase Request (PR) Service Raise a PR (with or without a project), validate/approve it, then convert it into an LPO. The LPO links back via pr_id.

**`async list(filters: { status?: string; category?: string } = {})`**  
› ops: select · tables: `purchase_requests`

**`async get(id: string)`**  
› ops: select · tables: `purchase_requests`, `purchase_request_items`, `projects`

**`async create(input: PRInput)`**  
› ops: insert, delete, select · tables: `profiles`, `purchase_requests`, `purchase_request_items`

**`async submit(id: string)`**  

**`async approve(id: string)`**  
› ops: update, select · tables: `purchase_requests`

**`async reject(id: string, reason: string)`**  
› ops: update, select · tables: `purchase_requests`

**`async getDirectPurchaseThreshold()`**  
Returns the configurable direct-purchase threshold (AED).  

**`async markDirectPurchased(id: string)`**  
Marks an approved PR as directly purchased (no LPO), allowed only when its estimated total is below the configurable threshold.  
› ops: update, select · tables: `purchase_requests`

**`async markConverted(prId: string, poId: string)`**  
Marks the PR as converted and links the created LPO. Called after the LPO is saved.  
› ops: update · tables: `purchase_requests`

**`async _transition(id: string, to: PRStatus, allowedFrom: PRStatus[], summary: string)`**  
› ops: update, select · tables: `purchase_requests`

### `priceUpdateService` — JEET ERP — Catalogue Price Auto-Update Updates pricing_items.material_cost from real supplier prices (supplier invoices, proformas, POs) and keeps a price-history

**`async updateItemCost(pricingItemId: string, newCost: number, source: PriceSource, opts: { sourceRef?: string; supplierI…)`**  
Updates a catalogue item's material cost, recomputes its sell price from the stored markup, stamps last_price_change and records history. No-op when the new cost matches the current cost.  
› ops: insert, update, select · tables: `pricing_items`, `pricing_price_history`

**`async applyFromSupplierInvoice(invoiceId: string)`**  
Applies the billed unit prices on a supplier invoice back to the catalogue: each invoice line → po_item → pricing_item gets its material cost refreshed. Returns how many items were updated.  
› ops: select · tables: `supplier_invoices`, `supplier_invoice_items`, `po_items`

**`async getHistory(pricingItemId: string, limit = 20)`**  
Recent price-change history for an item.  
› ops: select · tables: `pricing_price_history`

### `projectCashFlowService` — JEET ERP — Finance: Project Cash Flow Per-project monthly cash in (client receipts) vs cash out (supplier payments + paid expenses) and cumulative position.

**`async getProjectCashFlow(projectId: string)`**  
› ops: select · tables: `client_invoices`, `payment_allocations`, `client_payments`, `supplier_invoices`, `supplier_payment_allocations`, `supplier_payments`

### `projectDocumentService` — JEET ERP — Project Document Register Walks the full relationship graph for a project and returns every linked document (tender, BOQ, quotation, comparisons,

**`async getLinkedRegister(project: ProjectInput)`**  
› ops: select · tables: `tenders`, `boqs`, `quotations`, `supplier_comparisons`

**`safe(supabase.from('purchase_orders')`**  
select('*') so the optional proforma_invoice_* columns (migration 20260613140000) are included when present without breaking the query when they are not.  
› ops: select · tables: `purchase_orders`

**`push('Tender', [{ category: 'Tender', reference: tender.title || `TND-${String(tender.id)`**  

### `projectFinancialsService` — JEET ERP — Project Cost Control and Financials Service Computes: Budget vs Committed vs Accrued vs Actual vs Revenue Billed

**`async computeProjectFinancials(projectId: string)`**  
Computes the complete financial matrix for a project. Queries run in parallel WAVES (same results as before, concurrent execution).  
› ops: select · tables: `projects`, `purchase_orders`, `supplier_invoice_items`, `grn_items`, `stock_transactions`, `project_labour_costs`, `client_invoices`

### `projectPortfolioService` — JEET ERP — Projects: Portfolio / Executive Dashboard service Read-only, BATCHED aggregation across all projects (no per-project N queries): contract/billed/collected/committed + projected margin,

**`async getPortfolio()`**  
› ops: select · tables: `projects`, `client_invoices`, `purchase_orders`, `project_risks`, `project_wbs`, `tc_packages`

### `pushService` — Utility helper to convert base64 VAPID key to Uint8Array

**`async registerPushNotifications()`**  
Prompts the browser for notification permissions, registers with Service Worker PushManager, and upserts the VAPID subscription keys into the public.push_subscriptions table.  
› ops: upsert · tables: `push_subscriptions`

**`async unsubscribePush()`**  
Cleans up push subscription from database on user sign out.  
› ops: delete · tables: `push_subscriptions`

### `reportingService`

**`async getFinancialSummary()`**  
Retrieves high-level company-wide financial performance metrics.  
› ops: select · tables: `client_invoices`, `supplier_invoices`, `projects`

**`async getAgingReport(type: 'AR' | 'AP')`**  
Generates AR (Accounts Receivable) and AP (Accounts Payable) Aging Buckets.  
› ops: select · tables: `client_invoices`, `supplier_invoices`

**`async getProjectMarginKPIs()`**  
Analyzes project budgets, committed costs (Purchase Orders), and actual costs (GRNs / supplier invoices).  
› ops: select · tables: `projects`

**`async getTicketSLAStats()`**  
Generates SLA Response/Resolution speed metrics for reactive tickets.  
› ops: select · tables: `service_tickets`

### `resourcePlanningService` — JEET ERP — Projects: Resource / Manpower Planning service CRUD over project_resource_allocations + a cross-project utilization summary. Audit-logged; separate-lookup pattern.

**`async list(opts?: { projectId?: string })`**  
› ops: select · tables: `project_resource_allocations`

**`async create(input: Partial<ResourceAllocation> & { project_id: string; resource_name: string })`**  
› ops: insert, select · tables: `project_resource_allocations`

**`async update(id: string, patch: Partial<ResourceAllocation>)`**  
› ops: update · tables: `project_resource_allocations`

**`async remove(id: string)`**  
› ops: delete · tables: `project_resource_allocations`

**`async utilization(onDate?: string)`**  
Cross-project utilization for a given day (defaults to today): which resources are committed where, and where the same resource is double-booked.  
› ops: select · tables: `project_resource_allocations`

### `retentionService` — JEET ERP — Finance: Retention Management Read-only view over the existing project_retention_ledger (client-side retention receivable). Net held per invoice =

**`async list()`**  
› ops: select · tables: `project_retention_ledger`, `client_invoices`, `projects`

### `rfqService` — JEET ERP — Request for Quotation (RFQ) service Drafts a sourcing request from a BOQ, records it as a log, and supports listing/export. The next step (AI) reads supplier email

**`async getRecipients()`**  
Suppliers + subcontractors that can be sent an RFQ  
› ops: select · tables: `pricing_suppliers`

**`async getBoqItems(boqId: string)`**  
BOQ items mapped to RFQ lines (cost columns intentionally dropped — suppliers quote the price)  
› ops: select · tables: `boqs`, `tenders`

**`async create(input: RFQInput)`**  
› ops: insert, select · tables: `rfqs`

**`async list()`**  
› ops: select · tables: `rfqs`

**`async get(id: string)`**  
› ops: select · tables: `rfqs`

**`async markSent(id: string)`**  
› ops: update · tables: `rfqs`

### `riskRegisterService` — JEET ERP — Projects: Risk Register service CRUD over project_risks + 5x5 matrix scoring. Audit-logged.

**`ratingFor(score: number)`** *(pure fn)*  
› ops: select · tables: `projects`

**`async list(opts?: { projectId?: string })`**  
› ops: select · tables: `project_risks`

**`async nextRefCode(projectId: string)`**  
› ops: select · tables: `project_risks`

**`async create(input: Partial<ProjectRisk> & { project_id: string; title: string })`**  
› ops: insert, select · tables: `project_risks`

**`async update(id: string, patch: Partial<ProjectRisk>)`**  
› ops: update · tables: `project_risks`

**`async remove(id: string)`**  
› ops: delete · tables: `project_risks`

### `rulesService` — JEET ERP — Business Rules Service IF/THEN rules configurable from the Admin Center; modules call evaluate() at their trigger points.

**`async getRules(moduleKey?: string)`**  
› ops: select · tables: `business_rules`

**`async upsertRule(rule: Partial<BusinessRule> & { module_key: string; name: string; trigger_event: RuleTriggerEvent; })`**  
› ops: insert, update, select · tables: `business_rules`

**`async toggleRule(id: string, isActive: boolean)`**  
› ops: update · tables: `business_rules`

**`async deleteRule(id: string)`**  
› ops: delete · tables: `business_rules`

**`async evaluate(moduleKey: string, triggerEvent: RuleTriggerEvent, context: Record<string, unknown>)`**  
Evaluates active rules for a module + event against a record. Returns matched actions and a blocked flag — callers should abort the operation when blocked. Example: const { blocked, reason, actions } = await rulesService  
› ops: select · tables: `business_rules`

### `settingsService`

**`async getSettings(category?: SettingCategory)`**  
Fetches all master settings.  
› ops: select · tables: `settings`

**`async getSettingByKey(key: string, defaultValue?: T)`**  
Retrieves a specific setting value by key.  
› ops: select · tables: `settings`

**`async updateSetting(key: string, value: any, category: SettingCategory = 'COMPANY', dataType: SettingDataType = 'JSON'…)`**  
Updates or inserts a setting value, records an audit log entry.  
› ops: upsert, select · tables: `settings`

**`async getCompanyProfile()`**  
Gets the company profile metadata.  

**`async getDocumentTemplates()`**  
Gets the PDF document branding templates.  

### `sifService` — JEET ERP — WPS SIF Generation Service Reference: MOHRE / UAE Central Bank Wages Protection System (WPS)

**`validateUAEIBAN(iban: string)`**  
Validates UAE IBAN checksum using ISO 7064 Mod 97-10. Format: AE + 21 digits (total 23 characters)  

**`generateSIF(params: { establishmentId: string; // 13 digits bankRoutingCode: string; // 9 digits salaryMonth: …)`**  
Generates a Wages Protection System (WPS) SIF file string. CSV, no header, EDR rows first, SCR trailer row last.  

### `siteRecordsService` — JEET ERP — Projects: RFI / SI / NCR register service One table, doc_type discriminator, per-type running ref. Audit-logged; separate-lookup pattern.

**`async list(opts?: { projectId?: string; docType?: SiteDocType })`**  
› ops: select · tables: `project_site_records`

**`async nextRef(projectId: string, docType: SiteDocType)`**  
› ops: select · tables: `project_site_records`

**`async create(input: Partial<SiteRecord> & { project_id: string; doc_type: SiteDocType; title: string })`**  
› ops: insert, select · tables: `project_site_records`

**`async update(id: string, patch: Partial<SiteRecord>)`**  
› ops: update · tables: `project_site_records`

**`async remove(id: string)`**  
› ops: delete · tables: `project_site_records`

### `slaService` — JEET ERP — SLA Management Service Handles SLA calculation, timer pauses on parts-hold, and SLA breach checks (holidays and business hours aware).

**`calculateSLADeadlines(params: { priority: TicketPriority; sla_tier?: SLATier; contract_response_hours?: number; contract…)`** *(pure fn)*  
Calculates Response and Resolution SLA deadlines for a ticket. - EMERGENCY priority tickets bypass business hours and holidays (24/7 calendar clock). - Other priorities respect business hours (08:00 - 18:00, Sun-Thu) and  

**`pauseSLATimer(ticket: ServiceTicket, pauseTime: Date = new Date()`** *(pure fn)*  
Pauses SLA timers when a ticket goes on hold (e.g. status changes to ON_HOLD_PARTS).  

**`resumeSLATimer(ticket: ServiceTicket, resumeTime: Date = new Date()`** *(pure fn)*  
Resumes SLA timers when a ticket resumes (e.g. status changes back to IN_PROGRESS). Calculates the pause duration and extends the due dates accordingly.  

**`evaluateSLABreach(ticket: ServiceTicket, checkTime: Date = new Date()`** *(pure fn)*  
Evaluates whether SLA response or resolution is breached. Takes current time or a specific check time and compares to the due dates.  

**`formatSLARemainingTime(dueTimeISO: string, pausedAtISO?: string | null)`** *(pure fn)*  
Formats a remaining time interval in a human-readable HH:MM:SS format. Returns negative if breached.  

### `snagExportService` — JEET ERP — Snag List Export Service

**`async exportSnagsToPDF(projectId: string)`**  
Generates a PDF report containing the complete snag list for a project.  
› ops: select · tables: `projects`

**`autoTable(doc, { startY: y, margin: { left: margin, right: margin }, head: [['Ref #', 'Severity', 'System', …)`**  

### `snagService` — JEET ERP — Snag / Punch List Service PostgREST embeds are unreliable in this setup (snags has no FK to profiles → PGRST200). Enrich rows with project + assignee/closer/verifier/creator names

**`async getSnagsByProject(projectId: string)`**  
Retrieves all snags for a specific project.  
› ops: select · tables: `snags`

**`async getSnagById(snagId: string)`**  
Retrieves a single snag by ID.  
› ops: select · tables: `snags`

**`async createSnag(params: { project_id: string; source: SnagSource; system: string; location: string; description: s…)`**  
Creates a new snag.  
› ops: insert, select · tables: `snags`

**`async updateSnag(snagId: string, updates: Partial<Snag>)`**  
Updates snag details.  
› ops: update, select · tables: `snags`

**`async transitionSnagStatus(snagId: string, newStatus: SnagStatus, params: { photo_paths?: string[]; // closed evidence photos…)`**  
Enforces transition constraints and closer/verifier segregation.  
› ops: update, select · tables: `snags`

**`async checkAndEmitAllClosedEvent(projectId: string)`**  
Helper to check if all snags for a project are closed or deferred, and emit an event.  
› ops: select · tables: `snags`, `projects`

### `statementImportService` — Extract the raw base64 string from data URL

**`resolve(base64Data)`**  

**`async extractFinesFromStatement(file: File)`**  
Uploads an RTA/Police statement document (PDF, Excel, or Image), calls the Gemini API parser, and returns the list of extracted traffic violations.  

### `stockCountService` — JEET ERP — Stock Count & Reconciliation Service

**`async startStockCount(locationId: string)`**  
Starts a new physical stock count, capturing the system quantity snapshot (freeze).  
› ops: insert, select · tables: `stock_counts`, `stock_balances`, `stock_count_lines`

**`async getStockCounts(locationId?: string)`**  
Retrieves stock counts list.  
› ops: select · tables: `stock_counts`, `profiles`

**`async getStockCountDetail(id: string)`**  
Retrieves count details with line items.  
› ops: select · tables: `stock_counts`, `profiles`, `stock_count_lines`

**`async saveCountLines(countId: string, lines: Array<{ stock_item_id: string; counted_qty: number; recount_flag?: boolean…)`**  
Saves count values, computing variances.  
› ops: update · tables: `stock_count_lines`

**`async postStockCount(id: string, reason: string)`**  
Posts stock count variances into the ledger, ending the freeze.  
› tables: `stock_counts`

### `stockService` — JEET ERP — Stock and Location Service Plain select + separate name lookups — PostgREST embeds for project_id/custodian_id are unreliable here (schema-cache).

**`async getLocations()`**  
Retrieves all stock locations, joining project and custodian details.  
› ops: select · tables: `stock_locations`

**`async _resolveLocationNames(locs: any[])`**  
Batch-resolve project and custodian display names for a set of locations.  
› ops: select · tables: `projects`, `employees`

**`async getLocationDetail(id: string)`**  
Retrieves details of a single stock location.  
› ops: select · tables: `stock_locations`

**`async createLocation(loc: Omit<StockLocation, 'id' | 'created_at'>)`**  
Creates a new stock location.  
› ops: insert, select · tables: `stock_locations`

**`async getStockItems()`**  
Retrieves all stock items, joining pricing_items master catalog detail.  
› ops: select · tables: `stock_items`

**`async getStockItemDetail(id: string)`**  
Retrieves details of a single stock item.  
› ops: select · tables: `stock_items`

**`async createStockItem(item: Omit<StockItem, 'id' | 'created_at'>)`**  
Adds an item to the stock registry.  
› ops: insert, select · tables: `stock_items`

**`async getBalances(filters?: { location_id?: string; stock_item_id?: string; })`**  
Retrieves stock balances, optionally filtered by location or stock item.  
› ops: select · tables: `stock_balances`

**`async getMovementLedger(filters?: { type?: string; location_id?: string; stock_item_id?: string; project_id?: string; date…)`**  
Queries the immutable movement ledger.  
› ops: select · tables: `stock_transactions`, `projects`, `profiles`

**`async getSerialUnits(filters?: { stock_item_id?: string; location_id?: string; status?: string; })`**  
Retrieves serial units for a stock item, optionally filtered by location or status.  
› ops: select · tables: `serial_units`, `projects`

**`async getDeadStockReport(inactiveDays: number = 180)`**  
Returns items with zero movement for more than a configured duration (defaults to 180 days) where there is positive stock on hand.  
› ops: select · tables: `stock_balances`

**`async getValuationReport(locationId?: string)`**  
Stock Valuation report. Grouped by category / company-wide or per location.  
› ops: select · tables: `stock_balances`

### `stockTransactionService` — JEET ERP — Stock Transaction Service

**`async recordTransaction(tx: Omit<StockTransaction, 'id' | 'transaction_number' | 'created_at' | 'performed_by'>, options?:…)`**  
Records a stock movement in the ledger. This inserts a transaction row, which triggers database updates on stock_balances. Also manages serial numbers for serialized items.  
› ops: select · tables: `profiles`, `stock_items`, `stock_balances`, `stock_counts`

### `supplierInvoiceService` — JEET ERP — Supplier Invoice (Accounts Payable) Service Handles: Registration, 3-way matching, exception overrides, approvals, and event triggers.

**`async fetchSupplierInvoices(filters: { status?: string; poId?: string; supplierId?: string; projectId?: string; } = {})`**  
Fetches supplier invoices with filters.  
› ops: select · tables: `supplier_invoices`

**`async fetchSupplierInvoiceById(id: string)`**  
Fetches details of a single supplier invoice.  
› ops: select · tables: `supplier_invoices`, `supplier_invoice_items`

**`async createExpectedFromPO(poId: string)`**  
Auto-creates an "expected" Accounts Payable bill the moment an LPO is emitted to a supplier, so every purchase surfaces in AP without waiting for the supplier's tax invoice. The accountant later completes it (real invoic  
› ops: insert, select · tables: `supplier_invoices`, `purchase_orders`

**`async validateExpected(id: string, input: { supplier_invoice_number: string; invoice_date?: string; taxable_amount: numbe…)`**  
Validates a DRAFT payable into a registered bill: records the supplier's actual invoice number, amounts and attached document. The internal_ref (id) already exists; this confirms the real invoice against it.  
› ops: update · tables: `supplier_invoices`

**`async recordExpense(input: { cost_bucket: 'PROJECT' | 'PETTY_CASH' | 'OFFICE'; project_id?: string | null; po_id?: str…)`**  
Records a direct expense (non-LPO purchase, car petrol, petty cash, office expense) as an AP bill. Always carries an invoice/receipt reference and a cost bucket (PROJECT via LPO, PETTY_CASH project-linked, or OFFICE). If  
› ops: insert, select · tables: `supplier_invoices`

**`async registerSupplierInvoice(invoiceData: Omit<Partial<SupplierInvoice>, 'id' | 'internal_ref' | 'created_by' | 'created_at' | …)`**  
Registers a new supplier invoice and triggers the 3-way matching engine.  
› ops: insert, select · tables: `purchase_orders`, `po_items`, `supplier_invoice_items`, `supplier_invoices`, `pricing_suppliers`

**`async approveSupplierInvoice(id: string)`**  
Approves a registered supplier invoice for payment schedule.  
› ops: update · tables: `supplier_invoices`

**`async overrideMatchException(id: string, reason: string)`**  
Overrides match exceptions, forcing approval with a reason.  
› ops: update · tables: `supplier_invoices`

**`async recordSupplierPayment(paymentData: { supplier_id: string; amount: number; payment_date: string; method: string; referenc…)`**  
Records disbursement details for AP scheduling.  
› ops: insert, select · tables: `supplier_payments`, `supplier_payment_allocations`, `supplier_invoices`

### `supplierPerformanceService` — JEET ERP — Supplier Performance Writeback Service 1. Fetch current performance record (to preserve win_rate or fallback)

**`async recalculateSupplierPerformance(supplierId: string)`**  
Recalculates and updates performance indicators for a supplier based on LPO and GRN records.  
› ops: select · tables: `supplier_performance_history`, `pricing_suppliers`, `purchase_orders`, `po_items`, `grns`

**`async savePerformanceRecord(data: any)`**  
Helper to write back to supplier_performance_history.  
› ops: upsert · tables: `supplier_performance_history`

### `supplierRetentionService` — JEET ERP — Finance: Retention Payable (subcontractor retention) Net retention held per subcontractor/project from the supplier retention ledger (HELD − RELEASED), with release-schedule status.

**`async list()`**  
› ops: select · tables: `supplier_retention_ledger`, `projects`

**`async addHold(input: { supplier_id?: string | null; supplier_name: string; project_id?: string | null; amount: n…)`**  
› ops: insert · tables: `supplier_retention_ledger`

**`async release(input: { supplier_id?: string | null; supplier_name: string; project_id?: string | null; amount: n…)`**  
› ops: insert · tables: `supplier_retention_ledger`

### `taskService` — JEET ERP — Task Management Service Client Handles task CRUD, comment additions, and workload analytics

**`async fetchTasks(filters: { assignee_id?: string; project_id?: string; status?: TaskStatus; priority?: TaskPriority…)`**  
Fetches tasks matching filter parameters.  
› ops: select · tables: `tasks`

**`async fetchTaskById(id: string)`**  
Fetches details of a single task including comments.  
› ops: select · tables: `tasks`

**`async createTask(taskData: Partial<Task>)`**  
Creates a new task.  
› ops: insert, select · tables: `tasks`

**`async updateTask(id: string, updates: Partial<Task>)`**  
Updates an existing task.  
› ops: update · tables: `tasks`

**`async deleteTask(id: string)`**  
Soft-deletes a task.  
› ops: update · tables: `tasks`

**`async fetchComments(taskId: string)`**  
Fetches comments for a task.  
› ops: select · tables: `task_comments`

**`async addComment(taskId: string, body: string)`**  
Adds a new comment to a task.  
› ops: insert, select · tables: `task_comments`, `profiles`

**`async fetchWorkloadAnalytics()`**  
Gathers workload statistics across all users.  
› ops: select · tables: `profiles`, `tasks`

**`async parseNaturalLanguageTask(promptText: string)`**  
Parses a natural language task description using Gemini 2.0 Flash.  

### `tcReportPDFService` — JEET ERP — Testing & Commissioning PDF & DMS Service

**`async generateAndFileTCReport(packageId: string)`**  
Generates a branded PDF for a T&C package, uploads it to storage, and registers it in the DMS linked to the package.  
› ops: select · tables: `tc_test_results`, `tc_witnesses`

**`autoTable(doc, { startY: y, margin: { left: margin, right: margin }, head: [['No', 'Test Checklist Item', 'E…)`**  

### `tcService` — JEET ERP — Testing & Commissioning (T&C) Service PostgREST embeds are unreliable in this setup (tc_packages has no FK to profiles → PGRST200). Enrich rows with project/engineer/creator names via

**`async getPackagesByProject(projectId: string)`**  
Retrieves all active T&C packages for a specific project.  
› ops: select · tables: `tc_packages`

**`async getPackageById(packageId: string)`**  
Retrieves a single T&C package by ID.  
› ops: select · tables: `tc_packages`

**`async createPackage(params: { project_id: string; system: string; title: string; assigned_engineer_id?: string; witnes…)`**  
Creates a new T&C package, optionally instantiating scripts from a template.  
› ops: insert, select · tables: `tc_packages`, `tc_script_template_items`, `tc_test_scripts`

**`async getTestScripts(packageId: string)`**  
Retrieves test scripts for a package.  
› ops: select · tables: `tc_test_scripts`

**`async getDevices(packageId: string)`**  
Retrieves devices linked to a package.  
› ops: select · tables: `tc_devices`

**`async logTestResult(params: { script_id: string; device_id?: string; result: 'PASS' | 'FAIL' | 'NA'; measured_value?: …)`**  
Logs a test execution result. If test fails, auto-creates a snag and links it.  
› ops: insert, update, select · tables: `tc_test_scripts`, `tc_devices`, `tc_test_results`

**`async recalculatePackageProgress(packageId: string)`**  
Recalculates progress percentage and updates package status.  
› ops: update, select · tables: `tc_devices`, `tc_test_scripts`, `tc_test_results`, `tc_packages`

**`async scheduleWitness(packageId: string, witnessDate: string)`**  
Schedules a witness sign-off validation event.  
› ops: update, select · tables: `tc_packages`

**`async submitWitnessSignOff(params: { package_id: string; witness_stage: 'INTERNAL' | 'CONSULTANT' | 'CLIENT'; witness_name: s…)`**  
Submits witness sign-off.  
› ops: insert, update, select · tables: `tc_packages`, `tc_witnesses`

### `templateService` — JEET ERP — Document Template Service Visual templates with {{variables}}, headers, footers, watermarks, QR placeholders and signature blocks.

**`async getTemplates()`**  
› ops: select · tables: `document_templates`

**`async getTemplate(idOrKey: string)`**  
› ops: select · tables: `document_templates`

**`async createTemplate(input: { template_key: string; name: string; module_key?: string; description?: string; })`**  
› ops: insert, select · tables: `document_templates`

**`async updateTemplate(id: string, patch: Partial<Pick<DocumentTemplate, 'name' | 'description' | 'content' | 'paper_size…)`**  
› ops: update · tables: `document_templates`

**`async deleteTemplate(id: string)`**  
› ops: delete · tables: `document_templates`

**`async cloneTemplate(id: string)`**  
› ops: insert, select · tables: `document_templates`

**`async renderToHtml(template: DocumentTemplate, variables: Record<string, unknown>)`**  
Renders a template to a complete print-ready HTML page. Variables resolve from the supplied map; company branding resolves from company settings automatically.  

**`async print(templateKey: string, variables: Record<string, unknown>)`**  
Opens a rendered template in a new window for print/PDF.  

**`setTimeout(()`**  

### `test-sla-service` — JEET ERP — SLA Math Service Unit Tests Run: npx ts-node src/services/test-sla-service.ts Parse .env.local manually and set env vars

**`assert('Standard SLA Response Due (24h business time)`**  

### `threeWayMatchService` — JEET ERP — Supplier 3-Way Matching Engine Verifies: Invoiced Unit Price vs PO Price (0.5% tolerance) Invoiced Qty vs (GRN Received Qty - Prev Invoiced Qty)

**`validateUAETrn(trn: string)`** *(pure fn)*  
Validates UAE TRN formatting (15 digits).  

**`performThreeWayMatch(input: MatchEngineInput)`** *(pure fn)*  
Performs a deterministic 3-way match audit on a registered supplier invoice.  

### `ticketService` — JEET ERP — Reactive Service Tickets Service Handles ticket lifecycle, SLAs, status changes, parts usage, and auto-generation of chargeable invoices upon closure.

**`async fetchTickets(filters: { status?: string; technicianId?: string; priority?: string; search?: string; } = {})`**  
Fetches service tickets based on filters.  
› ops: select · tables: `service_tickets`

**`async fetchTicketById(id: string)`**  
Fetches detailed ticket by ID including events thread.  
› ops: select · tables: `service_tickets`, `ticket_events`

**`async createTicket(ticketData: Omit<Partial<ServiceTicket>, 'id' | 'ticket_number' | 'created_at'>)`**  
Logs a new ticket. Calculates SLA due times based on priority and holidays.  
› ops: insert, select · tables: `amc_contracts`, `service_tickets`, `ticket_events`

**`async assignTicket(ticketId: string, technicianId: string)`**  
Assigns a ticket to a technician.  
› ops: insert, update, select · tables: `profiles`, `service_tickets`, `ticket_events`

**`async dispatchTechnician(ticketId: string)`**  
Dispatches a technician to the site. Marks start of SLA response response_met.  
› ops: insert, update, select · tables: `service_tickets`, `ticket_events`

**`async pauseTicketForParts(ticketId: string, reason: string)`**  
Pauses the SLA clock (status: ON_HOLD_PARTS).  
› ops: insert, update, select · tables: `service_tickets`, `ticket_events`

**`async resumeTicketFromHold(ticketId: string)`**  
Resumes the SLA clock from hold. Extends due dates by elapsed pause duration.  
› ops: insert, update, select · tables: `service_tickets`, `ticket_events`

**`async resolveTicket(ticketId: string, resolutionSummary: string, partsUsed: TicketPartItem[], clientSignName?: string)`**  
Resolves the ticket. Audits SLA resolution met.  
› ops: insert, update, select · tables: `service_tickets`, `ticket_events`

**`async closeTicket(ticketId: string)`**  
Closes the ticket. Generates draft standalone invoices for chargeable tickets.  
› ops: insert, update, select · tables: `service_tickets`, `ticket_events`

**`async addTicketComment(ticketId: string, commentText: string)`**  
Adds an communication comment log to the ticket timeline.  
› ops: insert, select · tables: `ticket_events`

### `timesheetService` — JEET ERP — Timesheet and Labour Allocations Service

**`async getTimesheet(employeeId: string, weekStart: string)`**  
Retrieves a timesheet for a specific employee and week.  
› ops: select · tables: `timesheets`, `timesheet_entries`

**`async getOrCreateTimesheet(employeeId: string, weekStart: string)`**  
Initializes or gets a timesheet for a week.  
› ops: insert, select · tables: `timesheets`

**`async saveEntries(timesheetId: string, entries: Omit<TimesheetEntry, 'id' | 'timesheet_id' | 'created_at'>[])`**  
Bulk saves timesheet entries and updates the header totals.  
› ops: insert, delete, select · tables: `timesheet_entries`

**`async updateTimesheetTotals(timesheetId: string)`**  
Helper to recalculate total regular and overtime hours on the timesheet header.  
› ops: update, select · tables: `timesheet_entries`, `timesheets`

**`async submitTimesheet(timesheetId: string)`**  
Submits a timesheet for approval.  
› ops: update, select · tables: `timesheets`

**`async approveTimesheet(timesheetId: string)`**  
Approves a timesheet.  
› ops: update, select · tables: `timesheets`

**`async rejectTimesheet(timesheetId: string, reason: string)`**  
Rejects a timesheet.  
› ops: update, select · tables: `timesheets`

**`async getApprovalsQueue()`**  
Retrieves all timesheets in the approval queue.  
› ops: select · tables: `timesheets`

**`async getPrefillSuggestions(employeeId: string, weekStart: string)`**  
Generates timesheet auto-suggestions from technician visit and ticket logs.  
› ops: select · tables: `employees`, `ppm_visits`, `service_tickets`

### `toolService` — JEET ERP — Tools & Equipment Register Service

**`async getTools(filters?: { category?: ToolCategory; status?: ToolStatus; condition?: ToolCondition; requires_cali…)`**  
Retrieves all tools with filters.  
› ops: select · tables: `tools`

**`async getToolDetail(id: string)`**  
Retrieves a single tool by ID.  
› ops: select · tables: `tools`

**`async createTool(tool: Omit<Tool, 'id' | 'tool_number' | 'created_at' | 'updated_at' | 'is_active'>)`**  
Creates a new tool in the register.  
› ops: insert, select · tables: `tools`

**`async getAssignments(filters?: { tool_id?: string; employee_id?: string })`**  
Retrieves assignments history for a tool or custodian.  
› ops: select · tables: `tool_assignments`

**`async assignTool(assignment: Omit<ToolAssignment, 'id' | 'issue_date' | 'returned_date' | 'issued_by' | 'return_con…)`**  
Issues/Assigns a tool to an employee or project site.  
› ops: insert, update, select · tables: `tool_assignments`, `tools`

**`async returnTool(assignmentId: string, returnCondition: ToolCondition, notes?: string)`**  
Returns a tool, recording returned date, inspection condition, and checking-in the tool.  
› ops: update, select · tables: `tool_assignments`, `tools`

**`async getMaintenanceLogs(toolId?: string)`**  
Retrieves maintenance history logs.  
› ops: select · tables: `tool_maintenance`

**`async recordMaintenance(log: Omit<ToolMaintenance, 'id' | 'created_at'>)`**  
Logs a service repair, calibration or inspection. If calibration log is created, it updates the tools' next due metrics.  
› ops: insert, update, select · tables: `tool_maintenance`, `tools`

### `transferService` — JEET ERP — Stock Transfer Service

**`async createTransfer(fromLocationId: string, toLocationId: string, items: Array<{ stock_item_id: string; qty: number; s…)`**  
Records a warehouse-to-warehouse stock transfer. Decrements source location via TRANSFER_OUT and increments destination via TRANSFER_IN.  
› ops: select · tables: `stock_balances`

### `treasuryService` — JEET ERP — Finance: Treasury service Bank facilities (loans/overdrafts/guarantees/LCs): limit vs utilization and maturity tracking. Self-contained.

**`async list()`**  
› ops: select · tables: `treasury_facilities`

**`async create(input: Partial<Facility>)`**  
› ops: insert · tables: `treasury_facilities`

**`async setStatus(id: string, status: FacilityStatus)`**  
› ops: update · tables: `treasury_facilities`

### `userRoleService`

**`async getRoles()`**  
Fetches all registered roles.  
› ops: select · tables: `roles`

**`async getUsers()`**  
Fetches all users along with their active dynamically assigned roles.  
› ops: select · tables: `profiles`, `user_roles`

**`async getUserRoles(userId: string)`**  
Gets specific user's assigned roles.  
› ops: select · tables: `user_roles`

**`async updateUserRoles(userId: string, roleIds: string[])`**  
Assigns multiple roles to a user, replacing existing assignments. Also keeps the legacy profiles.role field updated for backwards compatibility.  
› ops: insert, update, delete, select · tables: `user_roles`, `profiles`, `roles`

**`async toggleRoleStatus(roleId: string, isActive: boolean)`**  
Toggles role activation status  
› ops: update, select · tables: `roles`

### `vatService` — JEET ERP — UAE VAT Return (FTA Form 201) Service Computes outputs/inputs, Emirate splits, and handles locking.

**`async fetchVATPeriods()`**  
Fetches list of all VAT periods.  
› ops: select · tables: `vat_periods`

**`async createVATPeriod(periodData: Omit<Partial<VATPeriod>, 'id' | 'status' | 'is_active' | 'created_by' | 'created_at' |…)`**  
Initializes a new VAT period.  
› ops: insert, select · tables: `vat_periods`

**`async lockVATPeriod(id: string)`**  
Locks a VAT period, making it immutable.  
› ops: update · tables: `vat_periods`

**`async computeForm201(periodId: string)`**  
Computes the complete FTA Form 201 data for a VAT period.  
› ops: select · tables: `vat_periods`, `client_invoices`, `projects`, `clients`

### `vehicleService`

**`async getVehicles()`**  
Fetches all active vehicles from the database, including the assigned driver name.  
› ops: select · tables: `vehicles`

**`async getVehicleById(id: string)`**  
Fetches a specific vehicle details by its ID.  
› ops: select · tables: `vehicles`

**`async createVehicle(vehicle: Omit<Vehicle, 'id' | 'vehicle_code' | 'created_at' | 'updated_at'>)`**  
Creates a new vehicle record.  
› ops: insert, select · tables: `vehicles`

**`async updateVehicle(id: string, updates: Partial<Vehicle>)`**  
Updates an existing vehicle record.  
› ops: update, select · tables: `vehicles`

**`async deleteVehicle(id: string)`**  
Soft deletes a vehicle record.  
› ops: update · tables: `vehicles`

**`async getAssignments(vehicleId: string)`**  
Fetches the entire custody assignment history for a specific vehicle.  
› ops: select · tables: `vehicle_assignments`

**`async getActiveAssignment(vehicleId: string)`**  
Gets the active assignment for a vehicle (if any).  
› ops: select · tables: `vehicle_assignments`

**`async assignVehicle(assignment: Omit<VehicleAssignment, 'id' | 'to_date' | 'created_at' | 'updated_at'>)`**  
Assigns a vehicle to a driver. Closes any previous active assignment automatically.  
› ops: insert, update, select · tables: `vehicle_assignments`, `vehicles`

**`async endAssignment(assignmentId: string, returnOdometer: number, conditionNotes?: string | null, signaturePath?: stri…)`**  
Ends an assignment (driver hands back custody of the vehicle).  
› ops: update, select · tables: `vehicle_assignments`, `vehicles`

### `visitReportPDFService` — JEET ERP — PPM Visit Report PDF & DMS Service Compiles, uploads, and files signed PPM Visit reports.

**`async generateAndFileVisitReport(visitId: string)`**  
Generates a branded PDF for a completed PPM visit, uploads it to storage, creates a document record, and links it back to the visit.  
› ops: select · tables: `ppm_visits`, `ppm_visit_checklist_results`

**`autoTable(doc, { startY: y, margin: { left: margin, right: margin }, head: [['No', 'Maintenance Verification…)`**  

### `visitService` — JEET ERP — PPM Visit Execution Service Handles visit scheduling, starts, checklist logging, completion, and defect auto-ticket generation.

**`async fetchPPMVisits(filters: { status?: string; technicianId?: string; date?: string; } = {})`**  
Fetches scheduled and unscheduled PPM visits.  
› ops: select · tables: `ppm_visits`

**`async fetchPPMVisitById(id: string)`**  
Fetches a single PPM visit with full details.  
› ops: select · tables: `ppm_visits`

**`async schedulePPMVisit(visitId: string, scheduledDate: string, scheduledSlot: 'AM' | 'PM', technicianId: string, secondTe…)`**  
Schedules an unscheduled visit with date, slot, and technician assignment.  
› ops: update, select · tables: `ppm_visits`, `profiles`

**`async startPPMVisit(visitId: string)`**  
Starts a scheduled visit (e.g. technician clicks "Start Visit" on-site).  
› ops: update, select · tables: `ppm_visits`

**`async fetchChecklistTemplates()`**  
Fetches checklist templates and seeds defaults (CCTV, ACS, Gate) if empty.  
› ops: insert, select · tables: `checklist_templates`, `checklist_template_items`

**`async fetchChecklistTemplateBySystem(system: string)`**  
Fetches template details including checklist items.  

**`async saveChecklistResult(resultData: Omit<PPMVisitChecklistResult, 'id' | 'created_at'>)`**  
Logs a checklist item result. Supports batch/individual saves.  
› ops: insert, select · tables: `ppm_visit_checklist_results`

**`async completePPMVisit(visitId: string, completeData: { signaturePath: string; clientSignName: string; clientSignDesignat…)`**  
Completes a PPM visit execution. Compiles signature sign-offs, checks for checklist failures, and creates an automatic defect service ticket if failures are found.  
› ops: update, select · tables: `ppm_visits`, `ppm_visit_checklist_results`

### `voApprovalService` — JEET ERP — Variation Order Approval Service Location: src/services/voApprovalService.ts Handles threshold routing, self-approval guards, and transition logic.

**`async evaluateApprovalPermissions(vo: VariationOrder, userId: string)`**  
Evaluates if a user is permitted to approve a Variation Order. Enforces self-approval guard (a user cannot approve a VO they created). Evaluates thresholds: - Sell Amount <= 25,000 AED -> Commercial Manager ('commercial_  
› ops: select · tables: `profiles`, `user_roles`

### `voContractImpactService` — JEET ERP — Variation Order Contract Impact Calculation Engine Location: src/services/voContractImpactService.ts Pure, side-effect-free functions for contract value adjustments,

**`calculateVOMargin(sellAmount: number, costAmount: number)`** *(pure fn)*  
Calculates the profit margin amount and percentage for a Variation Order. VOs are often priced at different margins than the core contract. Excludes VAT from calculations.  

**`calculateContractImpact(input: VOContractImpactInput)`** *(pure fn)*  
Recomputes the project revised contract value and Target Completion End Date (EOT) based on all approved variation orders. Handles signed math (omission VOs are negative).  

**`validateInvoiceCeiling(revisedContractValue: number, cumulativeInvoiced: number, currentInvoiceGross: number)`** *(pure fn)*  
Validates if the sum of existing progress claims plus the new invoice gross claim exceeds the revised contract value (the over-claim ceiling). Formula: cumulativeInvoiced + currentInvoiceGross <= revisedContractValue  

### `voNumberService` — JEET ERP — Variation Order (VO) Number Sequence Service Location: src/services/voNumberService.ts Previews sequences before database trigger assignment.

**`async getNextVOPreview()`**  
Previews the next global Variation Order number. Format: JI-VO-YYYY-NNN  
› ops: select · tables: `vo_number_sequences`

**`async getNextProjectVOSequencePreview(projectId: string)`**  
Previews the next project display sequence number. Format: VO-NN  
› ops: select · tables: `variation_orders`

### `voPDFService` — JEET ERP — Variation Order PDF Generation Service Location: src/services/voPDFService.ts Branded client-facing document generation using jsPDF + autoTable.

**`async generateVOReport(vo: VariationOrder, items: VOItem[])`**  
Generates a jsPDF document for a Variation Order.  
› ops: select · tables: `projects`

**`autoTable(doc, { columns: columns, body: rows, startY: currentY, theme: 'plain', styles: { fontSize: 8, cell…)`**  

**`addPageBorderAndFooter(doc: jsPDF, pageNum: number, totalPages: number, voNo: string, footerDisclaimer?: string, primaryC…)`**  
Header and footer formatter  

### `voService` — JEET ERP — Variation Order (VO) Service Location: src/services/voService.ts Handles database CRUD, workflow approval chains, PDF generation

**`async fetchVOs(filters: VOFilters = {})`**  
Fetches Variation Orders based on filters.  
› ops: select · tables: `variation_orders`

**`async fetchVOById(id: string)`**  
Fetches details of a single Variation Order.  
› ops: select · tables: `variation_orders`, `vo_items`, `vo_status_history`, `profiles`

**`async createVODraft(voData: Omit<Partial<VariationOrder>, 'id' | 'vo_number' | 'project_vo_sequence' | 'created_at' | …)`**  
Creates a new Variation Order draft.  
› ops: insert, select · tables: `variation_orders`, `vo_items`, `vo_status_history`

**`async submitInternalReview(id: string, comment?: string)`**  
Submits a VO for internal approvals ( routes to commercial manager or GM based on threshold ).  
› ops: insert, update · tables: `variation_orders`, `vo_status_history`

**`async approveInternal(id: string, comment?: string)`**  
Approves a VO internally.  
› ops: insert, update · tables: `variation_orders`, `vo_status_history`

**`async submitToClient(id: string)`**  
Submits a Variation Order to the client (generates PDF, uploads to DMS).  
› ops: insert, update, select · tables: `documents`, `variation_orders`, `vo_status_history`

**`async recordClientApproval(id: string, approvalRef: string, approvalDate: string, signedDocId?: string | null)`**  
Records client signature / formal approval (updates contract value and BOQ).  
› ops: insert, update, select, rpc · tables: `variation_orders`, `vo_status_history`, `projects` · rpc: `recalculate_project_vo_totals`

**`async recordClientRejection(id: string, reason: string)`**  
Records client rejection.  
› ops: insert, update · tables: `variation_orders`, `vo_status_history`

**`async cancelVO(id: string, reason: string)`**  
Cancels a Variation Order.  
› ops: insert, update · tables: `variation_orders`, `vo_status_history`

**`async updateWorkStatus(id: string, workStatus: VOWorkStatus)`**  
Updates work status. Sets proceed_at_risk if work starts prior to client approval.  
› ops: insert, update · tables: `variation_orders`, `vo_status_history`

**`async applyApprovedVOToBOQ(boqId: string, voItems: VOItem[], voNumber: string)`**  
Applies client approved VO items directly to the project's BOQ items array.  
› ops: update, select · tables: `boqs`

**`async getProjectVOSummary(projectId: string)`**  
Generates project Variation summary statistics.  
› ops: select · tables: `projects`, `variation_orders`

**`async fetchApprovalQueue()`**  
Fetches pending internal approvals queue.  
› ops: select · tables: `variation_orders`

### `walkthroughService` — JEET ERP — Walkthrough & Rapid Snag Logging Service

**`async logWalkthrough(params: { project_id: string; inspector_name: string; client_representative: string; walkthrough_d…)`**  
Log walkthrough details, including client signature and bulk rapid-logged snags.  
› tables: `private_documents`

### `warehouseService` — JEET ERP — Warehouse & Inventory Service Aggregates the supplier/subcontractor registry (with historic scoring from PO performance), the store (stock items +

**`async getSuppliers()`**  
---------- Suppliers & subcontractors registry + scoring ----------  
› ops: select · tables: `pricing_suppliers`, `purchase_orders`

**`async getSupplierDetail(id: string)`**  
Full supplier profile with PO-by-PO history (for the scorecard).  
› ops: select · tables: `pricing_suppliers`, `purchase_orders`, `projects`

**`async createSupplier(input: { name: string; contact_person?: string; phone?: string; email?: string; payment_terms_days…)`**  
› ops: insert · tables: `pricing_suppliers`

**`async toggleSupplierActive(id: string, isActive: boolean)`**  
› ops: update · tables: `pricing_suppliers`

**`async getStock(locationId?: string)`**  
---------- Store: stock items + balances + risk ---------- locationId filters balances to a single store (for per-location views/export).  
› ops: select · tables: `stock_items`, `stock_balances`

**`async getLocations()`**  
---------- Locations ----------  
› ops: select · tables: `stock_locations`

**`async createLocation(input: { name: string; location_code: string; type: string })`**  
› ops: insert · tables: `stock_locations`

**`async getItemBalances(stockItemId: string)`**  
Per-location balances for one stock item — drives the movement source picker.  
› ops: select · tables: `stock_balances`, `stock_locations`

**`async getProjects()`**  
Active projects for linking a movement (cost charge).  
› ops: select · tables: `projects`

**`async getRegisterableItems()`**  
---------- Stock item registration ---------- Catalogue items not yet registered as stock items.  
› ops: select · tables: `pricing_items`, `stock_items`

**`async registerStockItem(input: { pricing_item_id: string; reorder_level?: number | null; reorder_qty?: number | null; pref…)`**  
› ops: insert · tables: `stock_items`

**`async getStockItemOptions()`**  
Registered stock items for the movement picker.  
› ops: select · tables: `stock_items`

**`async recordManualMovement(input: { type: StockTransactionType; stock_item_id: string; location_id: string; quantity: number;…)`**  
Records a manual stock movement (sign derived from the movement type).  

**`async getMovements(limit = 200)`**  
---------- Goods movements ----------  
› ops: select · tables: `stock_transactions`, `projects`, `stock_locations`, `profiles`

### `warrantyService` — JEET ERP — Projects: DLP & Warranty Tracking service Warranty register (with expiry reminders) + DLP-period defect tracking. Extends the handover/DLP flow. Audit-logged.

**`async listWarranties(opts?: { projectId?: string })`**  
---------------- Warranties ----------------  
› ops: select · tables: `project_warranties`

**`async createWarranty(input: Partial<Warranty> & { project_id: string; item_name: string })`**  
› ops: insert, select · tables: `project_warranties`

**`async updateWarranty(id: string, patch: Partial<Warranty>)`**  
› ops: update · tables: `project_warranties`

**`async removeWarranty(id: string)`**  
› ops: delete · tables: `project_warranties`

**`async listDefects(opts?: { projectId?: string })`**  
---------------- DLP defects ----------------  
› ops: select · tables: `project_dlp_defects`

**`async nextDefectRef(projectId: string)`**  
› ops: select · tables: `project_dlp_defects`

**`async createDefect(input: Partial<DlpDefect> & { project_id: string; title: string })`**  
› ops: insert, select · tables: `project_dlp_defects`

**`async updateDefect(id: string, patch: Partial<DlpDefect>)`**  
› ops: update · tables: `project_dlp_defects`

**`async removeDefect(id: string)`**  
› ops: delete · tables: `project_dlp_defects`

### `wbsService` — JEET ERP — Projects: WBS service Hierarchical work packages with budget/weight and rolled-up progress (leaf progress → parent by weighted average).

**`async listFlat(projectId: string)`**  
Flat list ordered for display (depth-first), with computed level + rolled-up progress.  
› ops: select · tables: `project_wbs`

**`walk(null, 0)`**  

**`async create(input: { project_id: string; parent_id?: string | null; name: string; code?: string; system_name?:…)`**  
› ops: insert, select · tables: `project_wbs`

**`async update(id: string, patch: Partial<{ name: string; code: string; system_name: string; budget_cost: number;…)`**  
› ops: update · tables: `project_wbs`

**`async remove(id: string)`**  
› ops: delete · tables: `project_wbs`

**`async seedFromSystems(projectId: string)`**  
Seed top-level WBS nodes from the project's systems[] array.  
› ops: select · tables: `projects`

### `weightedAverageService` — JEET ERP — Weighted Average Cost (WAC) Service (PURE MATH)

**`round4(val: number)`**  
Rounds a cost to 4 decimal places.  

**`calculateNewAverage(currentQty: number, currentAvgCost: number, addedQty: number, unitCost: number)`**  
Recalculates the weighted average cost when new items are added to stock. Formula: ((currentQty * currentAvgCost) + (addedQty * unitCost)) / (currentQty + addedQty)  

### `whatsappService` — JEET ERP — WhatsApp Integration Service Client-side functions for managing chats, messages, and settings

**`async fetchChats()`**  
Fetches all active or closed WhatsApp chat sessions  
› ops: select · tables: `whatsapp_chats`

**`async fetchMessages(chatId: string)`**  
Fetches conversation logs for a specific chat session  
› ops: select · tables: `whatsapp_messages`

**`async sendManualMessage(chatId: string, bodyText: string)`**  
Sends a manual free-form message from an ERP agent  

**`async updateChatStatus(chatId: string, status: 'AUTO_REPLY' | 'HUMAN_AGENT' | 'CLOSED', assignedTo?: string | null)`**  
Changes the session status (AUTO_REPLY / HUMAN_AGENT / CLOSED) or assigned agent  
› ops: update · tables: `whatsapp_chats`

**`async linkChatToClient(chatId: string, clientId: string | null, contractId: string | null)`**  
Manually links a chat session to a client and contract  
› ops: update · tables: `whatsapp_chats`

**`async fetchSettings()`**  
Fetches global WhatsApp integration configurations  
› ops: select · tables: `whatsapp_settings`

**`async saveSettings(updates: Partial<WhatsAppSettings>)`**  
Saves settings modifications  
› ops: update · tables: `whatsapp_settings`

**`async fetchTemplates()`**  
Fetches template registries  
› ops: select · tables: `whatsapp_templates`

**`async updateTemplate(templateId: string, updates: Partial<WhatsAppTemplate>)`**  
Updates a template mapping configuration  
› ops: update · tables: `whatsapp_templates`

### `workflowService` — JEET ERP — Workflow Service CRUD for workflow definitions + runtime instance engine. Any module starts/advances workflows via this service without

**`async getDefinitions()`**  
---------- Definitions ----------  
› ops: select · tables: `workflow_definitions`

**`async getWorkflowGraph(workflowId: string)`**  
› ops: select · tables: `workflow_definitions`, `workflow_statuses`, `workflow_transitions`

**`async createDefinition(input: { module_key: string; name: string; description?: string })`**  
› ops: insert, select · tables: `workflow_definitions`

**`async updateDefinition(id: string, patch: Partial<Pick<WorkflowDefinition, 'name' | 'description'>>)`**  
› ops: update · tables: `workflow_definitions`

**`async activateDefinition(id: string)`**  
Activates a workflow, deactivating any other active workflow for the same module.  
› ops: update, select · tables: `workflow_definitions`

**`async deactivateDefinition(id: string)`**  
› ops: update · tables: `workflow_definitions`

**`async deleteDefinition(id: string)`**  
› ops: delete · tables: `workflow_definitions`

**`async cloneDefinition(id: string, newName?: string)`**  
Deep-clones a workflow (statuses + transitions) as an inactive new version.  
› ops: insert, select · tables: `workflow_definitions`, `workflow_statuses`, `workflow_transitions`

**`async upsertStatus(status: Partial<WorkflowStatus> & { workflow_id: string; status_key: string; label: string })`**  
---------- Statuses ----------  
› ops: insert, update, select · tables: `workflow_statuses`

**`async deleteStatus(id: string)`**  
› ops: delete · tables: `workflow_statuses`

**`async upsertTransition(t: Partial<WorkflowTransition> & { workflow_id: string; from_status_id: string; to_status_id: stri…)`**  
---------- Transitions ----------  
› ops: insert, update, select · tables: `workflow_transitions`

**`async deleteTransition(id: string)`**  
› ops: delete · tables: `workflow_transitions`

**`async getActiveWorkflow(moduleKey: string)`**  
---------- Runtime ---------- Returns the active workflow graph for a module, or null when none configured.  
› ops: select · tables: `workflow_definitions`

**`async startInstance(moduleKey: string, entityId: string)`**  
Starts (or returns the existing) workflow instance for an entity.  
› ops: insert, select · tables: `workflow_instances`

**`async getInstance(moduleKey: string, entityId: string)`**  
› ops: select · tables: `workflow_instances`

**`async getMyAvailableTransitions(moduleKey: string, entityId: string, context: Record<string, unknown> = {})`**  
Returns transitions the current user can execute for an entity right now.  

**`async executeTransition(moduleKey: string, entityId: string, transitionId: string, options: { comment?: string; context?: …)`**  
Executes a transition. Handles approval gathering: if the transition requires approvals and they are not yet satisfied, the approval is recorded but the status does not change until the requirement is met.  
› ops: update, select · tables: `workflow_instances`

**`async getWorkflowAnalytics(moduleKey: string)`**  
---------- Analytics ----------  
› ops: select · tables: `workflow_instances`

---

## 3. Data hooks

- `useAMCContracts`
- `useAging`
- `useCashFlow`
- `useClientInvoices`
- `useComparisons`
- `useDocumentUpload`
- `useDocuments`
- `useEOSB`
- `useEmployees`
- `useExpiryAlerts`
- `useFines`
- `useFixedAssets`
- `useGRNs`
- `useHandover`
- `useLeave`
- `useMeetings`
- `useMyDay`
- `useNotifications`
- `usePOs`
- `usePPMVisits`
- `usePayments`
- `usePayrollRun`
- `useProjectActivity`
- `useProjectCommitments`
- `useProjectFinancials`
- `useProjects`
- `useQuotations`
- `useRenewalPipeline`
- `useReviewQueue`
- `useSLA`
- `useSnags`
- `useSupplierInvoices`
- `useSupplierPerformance`
- `useTCExecution`
- `useTCPackages`
- `useTasks`
- `useThreeWayMatch`
- `useTickets`
- `useTimesheet`
- `useVATPeriod`
- `useVOs`
- `useVehicles`
- `useWalkthrough`
- `useWhatsApp`
- `useWorkflow`

---

## 4. Migrations (data model)

- `20260610190000_phase10_consolidation.sql`
- `20260610210300_vo_module.sql`
- `20260612090000_admin_platform_engine.sql`
- `20260612130000_seed_default_workflows.sql`
- `20260613100000_fix_quotation_number_trigger.sql`
- `20260613120000_quotation_client_po_document.sql`
- `20260613140000_po_proforma_invoice.sql`
- `20260613160000_fix_pricing_audit_trigger.sql`
- `20260613180000_pricing_price_history.sql`
- `20260613200000_supplier_subcontractor_fields.sql`
- `20260613220000_fix_comparison_number_trigger.sql`
- `20260613240000_quotation_linked_project.sql`
- `20260613260000_purchase_requests.sql`
- `20260613280000_payment_method_and_direct_purchase.sql`
- `20260613300000_pr_item_line_status.sql`
- `20260614100000_grn_auto_store_receipt.sql`
- `20260614120000_grn_store_robust.sql`
- `20260614140000_rfq.sql`
- `20260614160000_stock_rls_and_movements.sql`
- `20260614180000_stock_movement_receipt.sql`
- `20260614200000_ap_accounts_expenses.sql`
- `20260614220000_ap_draft_lifecycle.sql`
- `20260614240000_employee_assigned_project.sql`
- `20260614260000_project_budgets.sql`
- `20260614280000_cost_commitments.sql`
- `20260614300000_petty_cash.sql`
- `20260614320000_bank_reconciliation.sql`
- `20260614340000_treasury_facilities.sql`
- `20260615100000_supplier_retention.sql`
- `20260615120000_daily_site_reports.sql`
- `20260615140000_project_wbs.sql`
- `20260615160000_project_resource_allocations.sql`
- `20260615180000_project_risks.sql`
- `20260615200000_project_warranties_dlp.sql`
- `20260615220000_project_site_records.sql`
- `20260615240000_inventory_gl_mappings.sql`
- `20260615260000_clients_crm_fields.sql`
- `20260615280000_competitor_tracking.sql`
- `20260615300000_competency_training.sql`
- `20260615320000_attendance.sql`
- `20260616190000_communication_module.sql`
- `20260616193000_user_smtp_and_call_lifecycle.sql`
- `20260616200000_meeting_lifecycle.sql`
- `20260616201000_reap_stale_meetings.sql`
