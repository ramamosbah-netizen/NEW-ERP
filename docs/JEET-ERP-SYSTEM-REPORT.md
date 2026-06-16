# JEET ERP — Complete System Report

A full reference to the platform: architecture, every module and hub, the pages
inside them, the business logic, the data they touch, and how everything links
together. JEET ERP is an internal ERP for a UAE **ELV / MEP / security-systems
contractor** covering the full lifecycle from pre-sales bidding → project delivery
→ procurement → warehouse → field service → fleet → HR/payroll → finance, with a
no-code admin platform, a communication suite, and an enterprise analytics layer
over every domain.

> Scale: **13 modules · 257 page routes · 122 services · 45 data hooks · 44 SQL
> migrations.** Built additively; new analytics/collaboration layers never modified
> existing business logic.

---

## 1. Technology & architecture

| Layer | Technology / pattern |
|-------|----------------------|
| **Framework** | Next.js 16 (App Router, Turbopack, React Compiler), TypeScript, all feature pages are `'use client'` |
| **Backend** | Supabase — Postgres + Auth + Storage (`documents` bucket) + **Realtime** |
| **Data access** | Thin **service layer** (`src/services/*`) wrapping the Supabase client (`@/lib/supabase`); React **hooks** (`src/hooks/use*`) for stateful fetching/subscriptions |
| **Styling** | Tailwind v4 + a **design-token** system in `globals.css` (`@theme` + light/dark `:root`); tokens: `--bg-card/--surface`, `--border`, `--text-primary/secondary/muted/tertiary`, `--accent` (amber `#f59e0b`), `--primary` (slate), `--status-*` |
| **UI kit** | `PageHeader · Card · Button · EmptyState · Modal · Drawer · StatusChip · DataTable · KPICard · FormField · CommandPalette` (`src/components/ui`) |
| **Shell** | `AppShell` (page guard + access-denied screen) → `AppSidebar` (collapsible nav groups, role-filtered) |
| **Charts / export** | Recharts for analytics; `finance-export` for one-click **PDF + Excel** on analytics pages; per-domain PDF services (PO/VO/invoice/TC/handover) |
| **Migrations** | Idempotent SQL in `supabase/migrations/`; applied manually in the SQL editor (no DDL from the app); each ends `NOTIFY pgrst` |

### Architectural layers (request flow)
```
UI page (use client)
  → hook (use*) or direct service call
    → service (src/services/*)  ── builds Supabase queries, joins via separate
                                    keyed lookups (no FK embeds), graceful
                                    degradation (PGRST205 → [])
      → Supabase (Postgres + RLS + Realtime + Storage)
```

### Cross-cutting systems
- **Auth & identity** — Supabase Auth; current user via `supabase.auth.getUser()`; `profiles` (id, full_name, email, role) is the user directory.
- **RBAC / route gating** — `src/lib/permissions/routeAccess.ts` exports `isRouteAllowed(role, pathname)`. A universal **workspace allowlist** (`/`, `/dashboard`, `/myday`, `/tasks`, `/meetings`, `/notifications`, `/workspace`, `/comms`, `/whatsapp`) is open to all; `ROLE_ALLOWLIST` scopes restricted roles to their module prefixes; `admin/manager/engineer` are unrestricted. Drives **both** the sidebar (hides links) and `AppShell` (blocks deep-links). A richer catalogue lives in `roles / user_roles / permissions / role_permissions` (`permissionService`, `userRoleService`, `<Can>`, `usePermissions`). *Note: data-layer RLS is collaborative (`using(true)`) — a visibility fence, not a per-row security boundary.*
- **Workflow engine** — `workflow_definitions / workflow_instances`, `workflowService` (statuses, transitions, SLA, approvals), a reusable `WorkflowPanel`, and the **Workflow Designer** (`/admin/workflows`).
- **Numbering** — central document-number sequences (`numberingService` + per-doc `*NumberService`: PO, VO, comparison, quotation…).
- **Audit** — `auditService.logEvent({module, action, entity_type, entity_id, summary})` → `audit_log` (surfaced in Admin → Audit Analytics).
- **No-code platform** — Forms Builder, Rules Engine, Document Templates, Numbering — all admin-configurable.
- **Realtime** — `supabase.channel().on('postgres_changes', …)` (notifications, chat, project activity, WhatsApp).
- **Graceful degradation** — services catch `PGRST205/204` and return empty, so pages render before a migration is applied.

---

## 2. Module map (13 modules)

| # | Module (sidebar group) | Focus | Pages |
|---|------------------------|-------|------:|
| 1 | **Core / My Workspace** | Personal productivity + cross-module approvals | 13 |
| 2 | **Sales & Pre-Award** | Pre-sales, tenders, quotations, competitors | 14 |
| 3 | **Project Delivery & Execution** | Projects, controls, QA, VO, handover | 16 |
| 4 | **Procurement** | PR → RFQ → comparison → PO → GRN → match | 15 |
| 5 | **Warehouse & Inventory** | Stock, movements, costing, forecasting | 14 |
| 6 | **Field Operations** | Service desk, SLA, PPM, AMC | 14 |
| 7 | **Fleet & Assets** | Vehicles, fuel/fines, fixed assets, tools | ~14 |
| 8 | **HR & Payroll** | Employees, leave, payroll, EOSB, timesheets | 16 |
| 9 | **Finance** | AR/AP, budget, cash, treasury, VAT, reports | 17 |
| 10 | **Documents** | Document centre + reports | 2 |
| 11 | **Communications** | Chat, channels, meetings, announcements | 7 |
| 12 | **Administration** | Audit, access, workflow/forms/rules platform | 13 |
| 13 | **Settings** | 16 standalone configuration sections | 16 |

---

## 3. Module reference

### 1 · Core / My Workspace
Personal productivity surface + the cross-module **Approvals inbox**. Every page is **per-user** (a *Mine / Everyone* toggle defaults to *Mine*).

| Route | Page | Logic & linkage |
|-------|------|-----------------|
| `/workspace` | My Workspace hub | Personal rollup: my open/overdue tasks, unread alerts, today's meetings |
| `/workspace/approvals` | Approvals | Aggregates pending items from **10 sources** (PRs, POs, comparisons, MRFs, supplier invoices, quotations, payroll runs, leave, timesheets, AMC). Role-aware: approver roles see everything, others see their own submissions |
| `/dashboard` | Dashboard | Company KPI landing |
| `/myday` · `/tasks` (+`/analytics`, `/team`) | My Day / Tasks | `taskService`, `useTasks`; status TODO/IN_PROGRESS/BLOCKED/DONE; overdue = open & past due; team workload by assignee |
| `/meetings` (+`/analytics`) | Meetings | `meetingService`, `useMeetings`; action items, minutes-published rate |
| `/workspace/calendar` · `/workspace/activity` | Calendar / Activity | Unified month grid (tasks+meetings+leave+PPM); activity feed from `audit_log` |
| `/notifications` (+`/analytics`) | Alerts | `notificationService`, **realtime** `useNotifications`; severity, channel, read/actioned rates |

**Business logic:** completion = done ÷ non-cancelled; the Approvals inbox matches submissions on `created_by/requested_by/prepared_by` (or the employee record for leave/timesheets).

### 2 · Sales & Pre-Award
Bid-to-award pipeline. Sources: `tenders`, `quotations`, `clients`, `competitors`.

| Route | Page | Logic & linkage |
|-------|------|-----------------|
| `/sales` · `/sales/dashboard` | Pre-Sales hub / dashboard | Pipeline rollup |
| `/tenders` (`/[id]`, `/[id]/boq`) | Tenders | Tender register + BOQ; feeds quotations |
| `/sales/pipeline` | Sales Pipeline | Stage funnel |
| `/quotations` (+ `/[id]`, `/new/[boqId]`, `/[id]/review`, `/approve`, `/edit`, `/templates`) | Quotations | `useQuotations`; quote from BOQ, approval workflow, PDF; client-PO + linked project |
| `/sales/quotations` · `/win-loss` · `/margin` | Analytics | Quotation analytics, win/loss, margin analysis |
| `/sales/clients` | Client Directory | `clientService`; CRM fields |
| `/sales/deadlines` · `/follow-ups` · `/performance` | Radars | Tender deadlines, quote follow-ups, sales performance |
| `/sales/competitors` | Competitor Tracking | `competitorService`; `competitors` + `tender_competitors` (who won, est. price, loss reason) |

**Workflow:** Tender → BOQ → Quotation (draft → review → approve) → Client PO → **converts to a Project**.

### 3 · Project Delivery & Execution
Full PMC controls. Many sub-domains each with a service + migration.

| Route | Page | Service / linkage |
|-------|------|-------------------|
| `/projects` (`/[id]`) | Projects | `useProjects`, `projectPortfolioService`; tabs: finance/VO/files |
| `/projects/controls` · `/dashboard` | Controls / Exec dashboard | `projectFinancialsService` |
| `/projects/daily-reports` | Daily Site Reports (DSR) | `dailySiteReportService` |
| `/projects/wbs` · `/schedule` · `/evm` | WBS / Gantt / EVM | `wbsService`, `evmService` (earned value) |
| `/projects/resources` · `/risks` | Resource Planning / Risk Register | `resourcePlanningService`, `riskRegisterService` |
| `/vo` (`/[id]`, `/create`, `/approve`) | Variation Orders | `voService`, `voApprovalService`, `voContractImpactService`, `voPDFService`, `voNumberService` |
| `/snags` · `/projects/snag-analytics` | Snag List / QA | `snagService`, `snagExportService` |
| `/tc` (`/execute/[id]`, `/witness/[id]`) | Testing & Commissioning | `tcService`, `useTCExecution`, `tcReportPDFService`; **tool calibration gate** |
| `/handover` | Handover | `handoverService`, `handoverCertPDFService` |
| `/projects/dlp` · `/site-records` | DLP & Warranty / RFI-SI-NCR | `warrantyService`, `siteRecordsService` |

**Workflow:** Project (from won quote) → WBS/schedule → DSR + progress/EVM → VO (impact + approval) → snags/QA → T&C (with calibrated instruments) → Handover → DLP/warranty.

### 4 · Procurement
Source-to-pay. Strict numbering + 3-way match.

| Route | Page | Service / linkage |
|-------|------|-------------------|
| `/procurement` · `/dashboard` | Hub / dashboard | spend rollup |
| `/procurement/pr` (+ pipeline) | Purchase Requests | `prService`; `purchase_requests`, line-status |
| `/procurement/rfq` | Quotation Requests | `rfqService` |
| `/procurement/comparisons` (`/[id]`, `/new/[quotationId]`, `/review`, `/approve`, item detail) | Comparisons | supplier comparison → ranking → PO |
| `/procurement/po` (`/[id]`, `/create`) | Purchase Orders | `poService`, `poFromComparisonService`, `poApprovalService`, `poNumberService`, `poPDFService`; `WorkflowPanel` |
| `/procurement/grn` (`/create`) | Goods Receipt | `grnService` → auto store receipt + stock movement |
| `/procurement/match` | 3-Way Match | `threeWayMatchService` (PO ↔ GRN ↔ invoice) |
| `/procurement/suppliers` · `/savings` · `/spend` · `/deliveries` · `/grn-analytics` · `/payables` | Analytics | `supplierPerformanceService`, `supplierRetentionService`, `grnReceivablesService`, `grnExpenseService` |

**Workflow:** PR → RFQ → supplier Comparison (rank) → PO (approval workflow) → GRN (auto-receives into store) → 3-way match → Supplier invoice → **Finance AP** → payment.

### 5 · Warehouse & Inventory
Stock control + weighted-average costing + the **Pricing Catalog**.

| Route | Page | Service / linkage |
|-------|------|-------------------|
| `/warehouse/dashboard` | Inventory Dashboard | `warehouseService` |
| `/warehouse/store` · `/movements` | Store / Goods Movements | `stockService`, `stockTransactionService`, `transferService` |
| `/warehouse/mrf` | Requisitions (MRF) | `mrfService` |
| `/warehouse/stock-count` | Stock Count | `stockCountService` |
| `/warehouse/replenishment` · `/aging` · `/dead-stock` · `/forecast` | Planning analytics | reorder, aging, dead stock, material forecast |
| `/warehouse/serials` · `/installed` | Serial Tracking / Installed Assets | serial + installed-base ledger |
| `/warehouse/gl` | GL Integration | `inventoryGlService` (`inventory_gl_mappings`) |
| `/warehouse/suppliers` | Suppliers & Subcon | shared supplier master |
| `/pricing` | Pricing Catalog | `priceUpdateService`, `weightedAverageService`; own `pricing.css` palette (now on tokens) |

**Business logic:** GRN receipts post stock movements; valuation via weighted-average; replenishment off reorder points; GL mappings post inventory to finance accounts.

### 6 · Field Operations (Service / PPM / AMC)
After-sales: reactive service desk, preventive maintenance, contracts.

| Route | Page | Service / linkage |
|-------|------|-------------------|
| `/service/dashboard` · `/service-desk` (`/[id]`) | Service dashboard / desk | `ticketService`, `useTickets` |
| `/service/sla` | SLA Analytics | `slaService`, `useSLA` (response/resolution SLAs, breaches) |
| `/service/technicians` · `/parts` · `/history` | Ops analytics | technician load, spare parts, history |
| `/ppm/calendar` · `/service/ppm-compliance` | PPM | `ppmScheduleService`, `usePPMVisits`, `visitService`, `visitReportPDFService` |
| `/amc` · `/amc/pipeline` · `/profitability` · `/equipment` · `/billing` | AMC contracts | `amcService`, `amcBillingService`, `useAMCContracts`, `useRenewalPipeline` |
| `/technician` | Technician Hub | field technician console |

**Workflow:** AMC contract → PPM schedule (visits + reports) + reactive tickets (SLA-tracked) → billing/revenue; renewals pipeline drives retention.

### 7 · Fleet & Assets
Vehicles + fixed assets + tools. *(Enterprise analytics layer added in this build.)*

| Route | Page | Service / linkage |
|-------|------|-------------------|
| `/fleet/hub` | Fleet & Assets Hub | roll-up + attention strip |
| `/fleet` (`/[id]`, `/fines`) | Fleet Registry / detail / fines | `vehicleService`, `fineService`, `useVehicles`, `useFines` |
| `/fleet/dashboard` · `/compliance` · `/fuel-analytics` · `/fines-analytics` · `/maintenance` · `/tco` | Fleet analytics | `fuelService`, `maintenanceService`; **compliance** = registration/insurance expiry radar; **TCO** = purchase+fuel+fines+maintenance per vehicle |
| `/assets` (`/[id]`, `/depreciation`, `/dashboard`, `/depreciation-forecast`, `/disposals`) | Fixed Assets | `fixedAssetService`, `depreciationService`, `disposalService`; straight-line depreciation, NBV, disposal P&L |
| `/tools` · `/tools/calibration` | Tools & Equipment | `toolService`; calibration-due radar (feeds the T&C gate) |

### 8 · HR & Payroll
| Route | Page | Service / linkage |
|-------|------|-------------------|
| `/hr/hub` · `/dashboard` · `/hr` | HR hub / dashboard / employees | `employeeService`, `useEmployees` |
| `/hr/compliance-tracker` · `/documents` · `/certifications` · `/competency` | Compliance | doc/visa expiry, certifications, `competencyService` (training matrix) |
| `/hr/workforce` · `/labour-cost` · `/manpower` | Workforce analytics | headcount, project labour cost, manpower |
| `/hr/leave-analytics` · `/attendance` | Leave / Attendance | `leaveService`, `useLeave`, `attendanceService` (GPS) |
| `/payroll` (+ `/analytics`, `/eosb-liability`, `/settlement`, `/sif`) | Payroll | `payrollService`, `gratuityService` (EOSB), `sifService` (UAE WPS SIF), `usePayrollRun`, `useEOSB` |
| `/timesheets` (+ `/analytics`, `/approvals`) | Timesheets | `timesheetService`, `useTimesheet`; utilization |

**Business logic:** EOSB = UAE gratuity entitlement days × salary; SIF = WPS salary-information file; timesheet utilization feeds project labour cost.

### 9 · Finance
The accounting backbone — AR/AP, budgets, cash, treasury, VAT, reporting, AI agent.

| Route | Page | Service / linkage |
|-------|------|-------------------|
| `/finance` | Finance Hub | `kpiService`, `executiveFinanceService` |
| `/finance/ar` (`/[id]`, create/payment/statement/aging) | Receivables | `invoiceService`, `invoiceMathService`, `invoicePDFService`, `useClientInvoices`, `useAging` |
| `/finance/ap` (register/aging/match/schedule/expenses) | Payables | `supplierInvoiceService`, `paymentService`, `useSupplierInvoices` (links Procurement 3-way match) |
| `/finance/budget` · `/commitments` · `/project-profitability` · `/project-cashflow` | Cost control | `budgetService`, `commitmentService`/`commitmentLedgerService`, `projectCashFlowService` |
| `/finance/cashflow` · `/retentions` · `/petty-cash` · `/bank-reconciliation` · `/treasury` | Treasury | `cashFlowService`, `retentionService`, `pettyCashService`, `bankReconciliationService` (`statementImportService`), `treasuryService` |
| `/finance/reports` · `/grn-expense` · `/vat` | Reporting | `financialReportsService`, `grnExpenseService`, `vatService` (UAE VAT 201), `accountingExportService` |
| `/finance/ai` | AI Finance Agent | `aiFinanceService` — natural-language finance queries |
| `/assets` | Fixed Assets | shared with Fleet & Assets |

**Workflow:** Quote/Project → AR invoices (+ retention) → receipts; PO/GRN → AP supplier invoices (3-way match) → payments; budgets + commitments → project profitability + cash flow; period close → VAT 201 + financial reports.

### 10 · Documents
| `/documents` | Document Center — `projectDocumentService`, `useDocuments`, `useDocumentUpload`, `useReviewQueue`, `useExpiryAlerts`; Supabase Storage; review queue + expiry alerts |
| `/reports` | Reports — `reportingService` cross-module report hub |

### 11 · Communications *(built in this engagement)*
Realtime collaboration suite — see `docs/COMMUNICATION-MODULE-COMPLETE.md`.

| Route | Page | Service / linkage |
|-------|------|-------------------|
| `/comms` | Messenger | `commsService` — DMs, groups, 7 department channels, project rooms; **Supabase Realtime**; reactions, @mentions, threads, read receipts, attachments, search |
| `/comms/meeting/[roomId]` | Meeting room | Embedded **Jitsi** with full lifecycle (`comm_calls` + `comm_call_participants`, host-leave/empty-room/inactivity auto-close + `reap_stale_meetings()`) |
| `/comms/meetings` | Meeting Analytics | duration, peak, attendance |
| `/comms/announcements` | Announcements | `announcementService` — all/department/role, priority, pin |
| `/comms/documents` | Shared Documents | `commDocsService` — versioning + comments |
| `/comms/notifications` | Notifications Center | `commNotificationService` — feed + in-app/email/WhatsApp/push prefs |
| `/comms/admin` · `/whatsapp` | Settings / WhatsApp | channels, integrations, per-user SMTP; `whatsappService`, `useWhatsApp` |

### 12 · Administration
The governance + **no-code platform**. *(Enterprise analytics added in this build.)*

| Route | Page | Service / linkage |
|-------|------|-------------------|
| `/admin/hub` | Administration Hub | platform health rollup + activity feed |
| `/admin/audit/analytics` · `/admin/audit` | Audit | `auditService`; 30-day activity, security-sensitive actions, raw log |
| `/admin/access` · `/admin/permissions` | Access / Permissions Matrix | `userRoleService`, `permissionService`; role × module heat grid |
| `/admin/workflows` (`/[id]`, `/analytics`) | Workflow Designer + analytics | `workflowService`, `useWorkflow`; statuses/transitions/SLA |
| `/admin/forms` (`/[id]`) · `/admin/rules` · `/admin/numbering` · `/admin/templates` | No-code platform | `formBuilderService`, `rulesService`, `numberingService`, `templateService` |
| `/admin/configuration` · `/admin` | Config audit / Admin Center | inventory of workflows/forms/templates/rules |

### 13 · Settings
The former monolithic settings split into **16 standalone routes** under `/admin/settings/*` (Company, Module Toggles, Users/Roles, Sessions, Finance, Procurement, Inventory, Projects, Maintenance, HR, Notifications, PDF Templates, Integrations, System, Security, Backup) — all rendering a shared `SettingsWorkspace` component fixed to one section. `settingsService` (single batched `getSettings()` load). Smooth UI layer (`settings.css`).

---

## 4. End-to-end business workflows

1. **Bid → Cash:** Tender/BOQ → Quotation (approve) → Client PO → **Project** → delivery (WBS/DSR/EVM, VO, snags, T&C, handover) → AR invoicing (+retention) → receipts.
2. **Source → Pay:** PR → RFQ → Comparison → PO (workflow approval) → GRN (auto store receipt + stock movement) → 3-way match → AP supplier invoice → payment.
3. **Inventory valuation:** GRN → stock movement → weighted-average cost → GL mapping → finance.
4. **After-sales:** AMC → PPM visits (reports) + reactive tickets (SLA) → billing → renewals.
5. **Fleet/asset cost:** vehicle purchase → fuel/fines/maintenance → **TCO**; asset acquisition → straight-line depreciation → NBV → disposal P&L.
6. **People → Payroll:** employee → attendance/timesheets → payroll run → SIF/WPS + EOSB liability; timesheets → project labour cost.
7. **Governance:** every mutation → `audit_log`; approvals surface in **/workspace/approvals**; config changes via the no-code platform; period close → VAT 201 + financial reports.

---

## 5. Services catalogue (122) — by domain

- **Sales/CRM:** clientService, competitorService, quotation/pricing (priceUpdateService, weightedAverageService)
- **Projects:** projectPortfolioService, projectFinancialsService, projectCashFlowService, projectDocumentService, dailySiteReportService, wbsService, evmService, resourcePlanningService, riskRegisterService, siteRecordsService, warrantyService, walkthroughService, snagService/snagExportService, tcService/tcReportPDFService, handoverService/handoverCertPDFService, voService/voApprovalService/voContractImpactService/voPDFService/voNumberService/voValidation
- **Procurement:** prService, rfqService, poService/poFromComparisonService/poApprovalService/poNumberService/poPDFService, grnService/grnExpenseService/grnReceivablesService, threeWayMatchService, supplierInvoiceService, supplierPerformanceService, supplierRetentionService
- **Warehouse:** stockService, stockCountService, stockTransactionService, transferService, mrfService, warehouseService, inventoryGlService, storesValidation, deviceImportService
- **Field ops:** ticketService, slaService, visitService/visitReportPDFService, ppmScheduleService, amcService, amcBillingService, maintenanceService
- **Fleet/assets:** vehicleService, fuelService, fineService, fleetValidation, fixedAssetService, depreciationService, disposalService, toolService
- **HR/payroll:** employeeService, leaveService, payrollService, gratuityService, sifService, attendanceService, competencyService, timesheetService
- **Finance:** invoiceService/invoiceMathService/invoicePDFService, paymentService/paymentAccountService, budgetService, commitmentService/commitmentLedgerService, cashFlowService, retentionService, pettyCashService, bankReconciliationService/statementImportService, treasuryService, financialReportsService, executiveFinanceService, aiFinanceService, vatService, accountingExportService, amountInWordsService, kpiService, reportingService
- **Comms:** commsService, announcementService, commNotificationService, commDocsService, whatsappService
- **Platform/admin:** auditService, userRoleService, permissionService, workflowService, formBuilderService, rulesService, numberingService, templateService, settingsService, eventService, calendarSyncService, businessTime, pushService, taskService, meetingService, notificationService

---

## 6. Data model (44 migrations) — domains

Projects (`daily_site_reports, project_wbs, project_resource_allocations, project_risks, project_warranties_dlp, project_site_records, project_budgets, employee_assigned_project`) · Sales (`clients_crm_fields, competitor_tracking, quotation_*`) · Procurement (`purchase_requests, rfq, pr_item_line_status, payment_method_and_direct_purchase, supplier_subcontractor_fields, supplier_retention`) · Warehouse (`stock_rls_and_movements, stock_movement_receipt, grn_auto_store_receipt, grn_store_robust, inventory_gl_mappings`) · Finance (`ap_accounts_expenses, ap_draft_lifecycle, cost_commitments, petty_cash, bank_reconciliation, treasury_facilities, po_proforma_invoice`) · HR (`competency_training, attendance`) · VO (`vo_module`) · Platform (`admin_platform_engine, seed_default_workflows`) · **Comms** (`communication_module, user_smtp_and_call_lifecycle, meeting_lifecycle, reap_stale_meetings`) · plus numbering/pricing trigger fixes.

All RLS-enabled. Chat + collaborative tables use `using(true)` policies; `user_smtp_configs` is admin-only.

---

## 7. Notable design decisions & caveats
- **Separate-lookup joins** instead of PostgREST FK embeds (many tables intentionally have no FKs) — avoids PGRST200 failures and keeps services resilient.
- **Graceful degradation** everywhere — new pages render (empty) before their migration is applied.
- **Collaborative RLS** suits an internal trusted team; it is a *navigation/visibility* fence, **not** a per-row data boundary — harden with membership-keyed policies before exposing to less-trusted users.
- **External integrations** (Outlook/Gmail/SMTP email, WhatsApp Business, web-push, Jitsi) are framework-complete; outbound delivery needs provider credentials.
- **One design system** — every page (after the consolidation pass) uses the shared tokens (`var(--surface/--border/--text-*/--accent/--status-*)`), light/amber theme, Inter typography.

---

*Generated as a living reference. For module-specific detail see the companion docs:
`*-ENTERPRISE-COMPLETE.md` (Fleet, Admin, Workspace), `COMMUNICATION-MODULE-COMPLETE.md`,
`PERMISSIONS-ACCESS-REPORT.md`, and the per-module REPORT/ROADMAP files in `docs/`.*
