# JEET ERP — Full Reference (auto-generated)

> Generated from the source tree — every page route, every service function signature,
> every hook and migration. Pair with `JEET-ERP-SYSTEM-REPORT.md` (architecture & logic narrative).

**Totals:** 257 page routes · 3 API routes · 116 services exposing **586 functions** · 45 hooks · 44 migrations.

---

## 1. Pages by module

### `/` — 1 page

- `/`

### `/signin` — 1 page

- `/signin`

### `/signup` — 1 page

- `/signup`

### `/dashboard` — 1 page

- `/dashboard`

### `/myday` — 1 page

- `/myday`

### `/workspace` — 4 pages

- `/workspace`
- `/workspace/activity`
- `/workspace/approvals`
- `/workspace/calendar`

### `/tasks` — 4 pages

- `/tasks`
- `/tasks/analytics`
- `/tasks/team`
- `/tasks/workload`

### `/meetings` — 2 pages

- `/meetings`
- `/meetings/analytics`

### `/notifications` — 3 pages

- `/notifications`
- `/notifications/analytics`
- `/notifications/preferences`

### `/sales` — 12 pages

- `/sales`
- `/sales/clients`
- `/sales/clients/[id]`
- `/sales/competitors`
- `/sales/dashboard`
- `/sales/deadlines`
- `/sales/follow-ups`
- `/sales/margin`
- `/sales/performance`
- `/sales/pipeline`
- `/sales/quotations`
- `/sales/win-loss`

### `/tenders` — 6 pages

- `/tenders`
- `/tenders/[id]`
- `/tenders/[id]/boq`
- `/tenders/[id]/boq/print`
- `/tenders/[id]/edit`
- `/tenders/new`

### `/quotations` — 8 pages

- `/quotations`
- `/quotations/[id]`
- `/quotations/[id]/approve`
- `/quotations/[id]/edit`
- `/quotations/[id]/pdf`
- `/quotations/[id]/review`
- `/quotations/new/[boqId]`
- `/quotations/templates`

### `/vo` — 4 pages

- `/vo`
- `/vo/[id]`
- `/vo/approve`
- `/vo/create`

### `/projects` — 15 pages

- `/projects`
- `/projects/[id]`
- `/projects/controls`
- `/projects/daily-reports`
- `/projects/dashboard`
- `/projects/dlp`
- `/projects/evm`
- `/projects/new`
- `/projects/new/[quotationId]`
- `/projects/resources`
- `/projects/risks`
- `/projects/schedule`
- `/projects/site-records`
- `/projects/snag-analytics`
- `/projects/wbs`

### `/snags` — 2 pages

- `/snags`
- `/snags/capture`

### `/tc` — 4 pages

- `/tc`
- `/tc/[id]`
- `/tc/execute/[id]`
- `/tc/witness/[id]`

### `/handover` — 1 page

- `/handover`

### `/procurement` — 30 pages

- `/procurement`
- `/procurement/comparisons`
- `/procurement/comparisons/[id]`
- `/procurement/comparisons/[id]/approve`
- `/procurement/comparisons/[id]/item/[itemId]`
- `/procurement/comparisons/[id]/review`
- `/procurement/comparisons/new/[quotationId]`
- `/procurement/dashboard`
- `/procurement/deliveries`
- `/procurement/grn`
- `/procurement/grn-analytics`
- `/procurement/grn/[id]`
- `/procurement/grn/create`
- `/procurement/grn/receivables`
- `/procurement/match`
- `/procurement/payables`
- `/procurement/po`
- `/procurement/po/[id]`
- `/procurement/po/create`
- `/procurement/po/from-comparison/[id]`
- `/procurement/pr`
- `/procurement/pr-pipeline`
- `/procurement/pr/[id]`
- `/procurement/pr/create`
- `/procurement/rfq`
- `/procurement/rfq/new/[boqId]`
- `/procurement/savings`
- `/procurement/spend`
- `/procurement/suppliers`
- `/procurement/suppliers/[id]/scorecard`

### `/warehouse` — 17 pages

- `/warehouse`
- `/warehouse/aging`
- `/warehouse/dashboard`
- `/warehouse/dead-stock`
- `/warehouse/forecast`
- `/warehouse/gl`
- `/warehouse/installed`
- `/warehouse/movements`
- `/warehouse/mrf`
- `/warehouse/mrf/[id]`
- `/warehouse/replenishment`
- `/warehouse/serials`
- `/warehouse/stock-count`
- `/warehouse/stock-count/[id]`
- `/warehouse/store`
- `/warehouse/suppliers`
- `/warehouse/suppliers/[id]`

### `/pricing` — 1 page

- `/pricing`

### `/service` — 6 pages

- `/service/dashboard`
- `/service/history`
- `/service/parts`
- `/service/ppm-compliance`
- `/service/sla`
- `/service/technicians`

### `/service-desk` — 3 pages

- `/service-desk`
- `/service-desk/[id]`
- `/service-desk/new`

### `/ppm` — 2 pages

- `/ppm/calendar`
- `/ppm/execute/[id]`

### `/amc` — 8 pages

- `/amc`
- `/amc/[id]`
- `/amc/billing`
- `/amc/create`
- `/amc/equipment`
- `/amc/pipeline`
- `/amc/profitability`
- `/amc/renewal`

### `/technician` — 1 page

- `/technician`

### `/fleet` — 10 pages

- `/fleet`
- `/fleet/[id]`
- `/fleet/compliance`
- `/fleet/dashboard`
- `/fleet/fines`
- `/fleet/fines-analytics`
- `/fleet/fuel-analytics`
- `/fleet/hub`
- `/fleet/maintenance`
- `/fleet/tco`

### `/assets` — 6 pages

- `/assets`
- `/assets/[id]`
- `/assets/dashboard`
- `/assets/depreciation`
- `/assets/depreciation-forecast`
- `/assets/disposals`

### `/tools` — 2 pages

- `/tools`
- `/tools/calibration`

### `/hr` — 16 pages

- `/hr`
- `/hr/[id]`
- `/hr/approvals`
- `/hr/attendance`
- `/hr/calendar`
- `/hr/certifications`
- `/hr/competency`
- `/hr/compliance`
- `/hr/compliance-tracker`
- `/hr/dashboard`
- `/hr/documents`
- `/hr/hub`
- `/hr/labour-cost`
- `/hr/leave-analytics`
- `/hr/manpower`
- `/hr/workforce`

### `/payroll` — 6 pages

- `/payroll`
- `/payroll/analytics`
- `/payroll/eosb`
- `/payroll/eosb-liability`
- `/payroll/settlement`
- `/payroll/sif`

### `/timesheets` — 3 pages

- `/timesheets`
- `/timesheets/analytics`
- `/timesheets/approvals`

### `/finance` — 31 pages

- `/finance`
- `/finance/ai`
- `/finance/ap`
- `/finance/ap/aging`
- `/finance/ap/expenses`
- `/finance/ap/match/[id]`
- `/finance/ap/register`
- `/finance/ap/schedule`
- `/finance/ar`
- `/finance/ar/[id]`
- `/finance/ar/aging`
- `/finance/ar/create`
- `/finance/ar/from-phases`
- `/finance/ar/payment`
- `/finance/ar/statement`
- `/finance/bank-reconciliation`
- `/finance/bank-reconciliation/[id]`
- `/finance/budget`
- `/finance/budget/[id]`
- `/finance/cashflow`
- `/finance/commitments`
- `/finance/executive`
- `/finance/grn-expense`
- `/finance/petty-cash`
- `/finance/project-cashflow`
- `/finance/project-profitability`
- `/finance/project-profitability/[id]`
- `/finance/reports`
- `/finance/retentions`
- `/finance/treasury`
- `/finance/vat`

### `/documents` — 3 pages

- `/documents`
- `/documents/expiry`
- `/documents/review`

### `/reports` — 1 page

- `/reports`

### `/comms` — 7 pages

- `/comms`
- `/comms/admin`
- `/comms/announcements`
- `/comms/documents`
- `/comms/meeting/[roomId]`
- `/comms/meetings`
- `/comms/notifications`

### `/whatsapp` — 1 page

- `/whatsapp`

### `/admin` — 31 pages

- `/admin`
- `/admin/access`
- `/admin/audit`
- `/admin/audit/analytics`
- `/admin/configuration`
- `/admin/forms`
- `/admin/forms/[id]`
- `/admin/hub`
- `/admin/numbering`
- `/admin/permissions`
- `/admin/rules`
- `/admin/settings`
- `/admin/settings/backup`
- `/admin/settings/finance`
- `/admin/settings/hr`
- `/admin/settings/integrations`
- `/admin/settings/inventory`
- `/admin/settings/maintenance`
- `/admin/settings/modules`
- `/admin/settings/notifications`
- `/admin/settings/pdf-templates`
- `/admin/settings/procurement`
- `/admin/settings/projects`
- `/admin/settings/security`
- `/admin/settings/sessions`
- `/admin/settings/system`
- `/admin/settings/users`
- `/admin/templates`
- `/admin/workflows`
- `/admin/workflows/[id]`
- `/admin/workflows/analytics`

### `/settings` — 2 pages

- `/settings/scoring-weights`
- `/settings/whatsapp`

### API routes

- `/api/admin/sessions` (server)
- `/api/admin/users` (server)
- `/api/fleet/import-statement` (server)

---

## 2. Services — function reference

Every service object and its public functions (signatures extracted from source).

### `accountingExportService`
*JEET ERP — Accounting Journal Export Service (AP/AR Ledger) Formats: Excel (using SheetJS) & CSV formats for ERP syncing*

- `async generateJournalLines(startDate: string, endDate: string)`
- `async exportToCSV(startDate: string, endDate: string)`
- `async exportToExcel(startDate: string, endDate: string, filename: string = 'JEET_ERP_Accounting_Journal.xlsx')`

### `aiFinanceService`
*JEET ERP — Finance: AI Finance Agent (Phase 1, rule-based) Risk scoring + recommendations over existing finance data. No external LLM yet — deterministic heuristics with confidence*

- `async getInsights()`

### `amcBillingService`
*JEET ERP — AMC Billing Schedule Service Manages installment calculations and automated draft invoicing.*

- `async generateBillingSchedule(contract: AMCContract)`
- `async processDueInstallments()`
- `function addMonths(dateStr: string, months: number)`

### `amcService`
*JEET ERP — AMC Contracts Service Handles CRUD, quotation/project conversion, and activation.*

- `async fetchAMCContracts(filters: { status?: string; clientId?: string; search?: string; } = {})`
- `async fetchAMCContractById(id: string)`
- `async createAMCContract(contractData: Partial<AMCContract>)`
- `async updateAMCContract(id: string, updates: Partial<AMCContract>)`
- `async activateAMCContract(id: string)`
- `async addEquipmentToContract(contractId: string, equipmentItems: Array<Omit<Partial<AMCEquipment>, 'id' | 'contract_i…)`
- `async convertQuotationToAMC(quotationId: string, customStartDate: string)`
- `async convertProjectToAMC(projectId: string, customStartDate: string)`
- `async renewContract(oldContractId: string, customStartDate: string, newAnnualValue?: number)`

### `amountInWordsService`
*JEET ERP — Currency to English Words Conversion Service Formats: AED (Dirhams and Fils) Example: 1,250.50 -> One Thousand Two Hundred Fifty Dirhams and Fifty Fils Only*

- `function convertAmountToWords(amount: number)`

### `announcementService`
*JEET ERP — Company Announcements service*

- `async list(userId?: string)`
- `async create(a: Partial<Announcement>)`
- `async togglePin(id: string, pinned: boolean)`
- `async archive(id: string)`
- `async markRead(id: string, userId: string)`

### `attendanceService`
*JEET ERP — HR: Attendance & GPS service Daily check-in/out with geolocation. Audit-logged; degrades to [] before the migration is applied.*

- `async list(opts?: { date?: string })`
- `async checkIn(employee_id: string, geo?: { lat?: number; lng?: number; label?: string })`
- `async checkOut(record: Attendance, geo?: { lat?: number; lng?: number })`

### `auditService`

- `async logEvent(params: { actor_user_id?: string | null; action: string; entity_type: string; entity_id:…)`
- `async getLogs(filters?: AuditLogFilter)`

### `bankReconciliationService`
*JEET ERP — Finance: Bank Reconciliation service Imports statement lines, auto-matches them against system receipts (client_payments) and payments (supplier_payments +*

- `async list()`
- `async get(id: string)`
- `async create(input: { payment_account_id?: string | null; account_name?: string; statement_date: stri…)`
- `async importLines(reconId: string, rows: ImportRow[])`
- `async autoMatch(reconId: string)`
- `async setLine(lineId: string, patch: { matched?: boolean; match_type?: string; matched_ref?: string | …)`
- `async complete(id: string)`

### `budgetService`
*JEET ERP — Finance: Budget & Cost Control service Project budgets seeded from the BOQ, revisioned and frozen on approval. Committed cost is read live from commitments (LPOs),*

- `async createFromBoq(projectId: string)`
- `async list()`
- `async get(id: string)`
- `async approve(id: string)`

### `businessTime`
*JEET ERP — Business Time Utility Service Computes business-hours deadlines in Asia/Dubai (GST = UTC+4) Sunday–Thursday: 08:00 – 18:00 (10 hours/day). Fridays & Saturdays off.*

- `function getGSTParts(d: Date)`
- `function fromGSTParts(parts: Omit<GSTDateTime, 'dayOfWeek'>)`
- `function isWeekendOrHoliday(d: Date, holidays: string[] = [])`
- `function moveToNextBusinessDayStart(d: Date, holidays: string[] = [])`
- `function addBusinessHours(start: Date, hoursToAdd: number, holidays: string[] = [])`

### `calendarSyncService`
*JEET ERP — Google Calendar Synchronization client Interacts with Supabase Edge Functions for token refresh and API pushes 1. Invoke OAuth background sync edge function*

- `async syncMeeting(meetingId: string, action: 'create' | 'update' | 'cancel')`
- `async getAuthUrl(provider = 'google')`

### `cashFlowService`
*JEET ERP — Rolling 13-Week Cash Flow Forecast Service Computes weekly cash inflows (AR + Milestones) vs outflows (AP + POs)*

- `async get13WeekForecast(startingBalance: number = 500000)`

### `clientService`
*JEET ERP — Pre-Sales: Client / CRM service CRUD over clients (+ optional CRM fields with a PGRST204 fallback so it works before the migration is applied) and a*

- `async list()`
- `async get(id: string)`
- `async save(input: Partial<Client> & { name: string }, id?: string)`
- `async get360(id: string, clientName: string)`

### `commDocsService`
*JEET ERP — Document sharing with version control + comments*

- `async list()`
- `async getVersions(documentId: string)`
- `async getComments(documentId: string)`
- `async upload(file: File, ownerId: string)`
- `async create(p: { title: string; description?: string; ownerId: string; path: string; mime: string; s…)`
- `async addVersion(documentId: string, p: { path: string; size: number; note?: string; uploadedBy: string })`
- `async addComment(documentId: string, userId: string, body: string)`
- `async signedUrl(path: string)`

### `commNotificationService`
*JEET ERP — Communication notifications: in-app feed + channel preferences*

- `async list(userId: string)`
- `async unreadCount(userId: string)`
- `async markRead(id: string)`
- `async markAllRead(userId: string)`
- `async getPrefs(userId: string)`
- `async setPref(userId: string, channel: NotifChannel, eventType: string, enabled: boolean)`

### `commitmentLedgerService`
*JEET ERP — Finance: Commitments ledger (cross-project) Unifies manual commitments (cost_commitments table) with LIVE commitments derived from approved LPOs and outstanding payroll*

- `async list()`
- `async addManual(input: { project_id?: string | null; source_type: CommitmentSource; category?: string; v…)`
- `async cancelManual(id: string)`

### `commitmentService`
*JEET ERP — Cost Commitment Tracking Service*

- `async getProjectCostCommitments(projectId: string)`

### `commsService`
*JEET ERP — Communication & Collaboration — core service Conversations, messages, members, reactions, read receipts, search and Supabase Realtime helpers. Degrades gracefully when*

- `async getDirectory(excludeId?: string)`
- `async getMyConversations(userId: string)`
- `async getConversation(id: string, userId: string)`
- `async getChannel(channelKey: string)`
- `async getOrCreateDirect(meId: string, otherId: string)`
- `async createGroup(name: string, memberIds: string[], creatorId: string, type: 'GROUP' | 'PROJECT' = 'GROUP…)`
- `async getProjectRoom(projectId: string)`
- `async joinChannel(conversationId: string, userId: string)`
- `async addMembers(conversationId: string, userIds: string[])`
- `async getMessages(conversationId: string, limit = 80)`
- `async getThread(parentId: string)`
- `async sendMessage(p: { conversationId: string; senderId: string; body: string; attachments?: Attachment[];…)`
- `async editMessage(id: string, body: string)`
- `async deleteMessage(id: string)`
- `async toggleReaction(messageId: string, userId: string, emoji: string)`
- `async markRead(conversationId: string, userId: string, messageIds: string[] = [])`
- `async searchMessages(query: string, userId: string)`
- `subscribeToConversation(conversationId: string, onMessage: (m: any)`
- `subscribeToInbox(userId: string, onChange: ()`
- `async getUserSmtpConfig(userId: string)`
- `async saveUserSmtpConfig(userId: string, host: string, port: number, username: string, password: string, senderEm…)`
- `async deleteUserSmtpConfig(userId: string)`
- `async getAllUserSmtpConfigs()`
- `async getMeetingByRoom(roomName: string)`
- `async startMeeting(p: { roomName: string; type: 'voice' | 'video'; conversationId?: string | null; startedB…)`
- `async getOrStartMeeting(roomName: string, p: { type: 'voice' | 'video'; conversationId?: string | null; startedB…)`
- `async recordParticipantJoin(callId: string, userId: string, displayName?: string)`
- `async recordParticipantLeave(callId: string, userId: string)`
- `async updateMeetingActivity(callId: string, count: number)`
- `async updateMeetingStatus(callId: string, status: string)`
- `async endMeeting(callId: string)`
- `async endCall(callId: string)`
- `async reapStaleMeetings(thresholdMinutes = 15)`
- `async getMeetings(limit = 100)`
- `async getMeetingAttendance(callId: string)`

### `competencyService`
*JEET ERP — HR: Training & Competency service Skill catalogue, employee×skill matrix and training records. Audit-logged; degrades to [] before the migration is applied.*

- `async listSkills()`
- `async addSkill(input: { name: string; category?: string; description?: string })`
- `async removeSkill(id: string)`
- `async listCompetencies()`
- `async setCompetency(employee_id: string, skill_id: string, level: number)`
- `async listTraining()`
- `async addTraining(input: Partial<Training> & { employee_id: string; course_name: string })`
- `async removeTraining(id: string)`

### `competitorService`
*JEET ERP — Pre-Sales: Competitor Tracking service Competitor register + per-tender competitive log (who won, their estimated price, reason we lost). Audit-logged; separate-lookup.*

- `async listCompetitors()`
- `async createCompetitor(input: Partial<Competitor> & { name: string })`
- `async updateCompetitor(id: string, patch: Partial<Competitor>)`
- `async removeCompetitor(id: string)`
- `async listTenderCompetitors(opts?: { tenderId?: string })`
- `async addTenderCompetitor(input: Partial<TenderCompetitor> & { tender_id: string; competitor_id: string })`
- `async updateTenderCompetitor(id: string, patch: Partial<TenderCompetitor>)`
- `async removeTenderCompetitor(id: string)`

### `dailySiteReportService`
*JEET ERP — Projects: Daily Site Report (DSR) service*

- `async list(filters: { projectId?: string } = {})`
- `async get(id: string)`
- `async create(input: DSRInput)`
- `async setStatus(id: string, status: 'DRAFT' | 'SUBMITTED')`

### `depreciationService`

- `getPeriodMonth(dateStr: string)`
- `generateSchedule(acquisitionDateStr: string, acquisitionCost: number, salvageValue: number, usefulLifeMon…)`
- `getNbvAtPeriod(schedule: DepreciationScheduleRowInput[], targetPeriodMonthStr: string)`
- `truncateScheduleForDisposal(schedule: DepreciationScheduleRowInput[], disposalDateStr: string)`
- `calculateDisposalGainLoss(nbvAtDisposal: number, proceeds: number)`

### `deviceImportService`
*JEET ERP — Device Clipboard Import Service*

- `parsePasteData(pasteText: string)`
- `async importDevices(packageId: string, pasteText: string)`

### `disposalService`

- `async getDisposals()`
- `async disposeAsset(disposal: Omit<AssetDisposal, 'id' | 'nbv_at_disposal' | 'gain_loss' | 'created_at'>)`

### `employeeService`
*JEET ERP — Employee Master Service*

- `async getEmployees(filters?: { department?: string; status?: string })`
- `async getEmployeeById(employeeId: string)`
- `async createEmployee(params: Omit<Employee, 'id' | 'employee_number' | 'current_hourly_cost_rate' | 'created_…)`
- `async updateEmployee(employeeId: string, updates: Partial<Employee>)`
- `async deleteEmployee(employeeId: string)`
- `async getCompensationHistory(employeeId: string)`
- `async addCompensation(params: { employee_id: string; effective_from: string; basic_salary: number; housing_all…)`
- `async getCertifications(employeeId: string)`
- `async addCertification(params: Omit<EmployeeCertification, 'id' | 'created_at' | 'updated_at'>)`
- `async updateCertification(certId: string, updates: Partial<EmployeeCertification>)`
- `async deleteCertification(certId: string)`
- `async getLinkedDocuments(employeeId: string)`
- `async linkDocument(params: { employee_id: string; document_id: string; document_type: string; })`
- `async unlinkDocument(employeeDocId: string)`

### `eventService`
*JEET ERP — Platform Event Bus Service Provides single entry point to emit ERP system events*

- `async emitEvent(eventType: string, entityType?: string, entityId?: string, projectId?: string, payload: …)`

### `evmService`
*JEET ERP — Projects: Earned Value Management (EVM) PV / EV / AC and SPI / CPI / EAC over the WBS + project actuals. Read-only; reuses wbsService + projectFinancialsService.*

- `async compute(projectId: string)`

### `executiveFinanceService`
*JEET ERP — Finance: Executive Dashboard aggregator Pulls headline cash/AR/AP/commitment/profit numbers, chart series and risk alerts from existing services and tables. Read-only.*

- `async getDashboard()`
- `safe(supabase.from('client_invoices')`

### `financialReportsService`
*JEET ERP — Finance: Financial Reports P&L, Trial Balance, General Ledger, Cost/Revenue by project. Reads existing finance tables + the accounting journal. Read-only;*

- `async profitAndLoss(start: string, end: string)`
- `async trialBalance(start: string, end: string)`
- `async generalLedger(start: string, end: string)`
- `async balanceSheet(asOf: string)`
- `async byProject(start: string, end: string, kind: 'COST' | 'REVENUE')`

### `fineService`

- `async getFines()`
- `async getFinesByVehicleId(vehicleId: string)`
- `async resolveDriverForDate(vehicleId: string, fineDate: string)`
- `async createFine(fine: Omit<VehicleFine, 'id' | 'created_at' | 'updated_at'>)`
- `async updateFine(id: string, updates: Partial<VehicleFine>)`
- `async markFineDriverLiable(fineId: string, periodMonth: string)`
- `async bulkCreateFines(fines: Omit<VehicleFine, 'id' | 'created_at' | 'updated_at'>[])`

### `fixedAssetService`

- `async getFixedAssets()`
- `async getFixedAssetById(id: string)`
- `async createFixedAsset(asset: Omit<FixedAsset, 'id' | 'asset_number' | 'accumulated_depreciation' | 'net_book_v…)`
- `async runMonthlyDepreciation(periodMonth: string)`
- `async generateDepreciationJournal(periodMonth: string)`
- `async exportJournalToExcel(periodMonth: string, filename?: string)`

### `formBuilderService`
*JEET ERP — Form Builder Service Dynamic form definitions per module. Modules render the active form via getActiveForm() — no code changes needed*

- `async getDefinitions()`
- `async getDefinition(id: string)`
- `async getActiveForm(moduleKey: string)`
- `async createDefinition(input: { module_key: string; name: string; description?: string; schema?: FormSchema })`
- `async updateSchema(id: string, schema: FormSchema)`
- `async updateMeta(id: string, patch: { name?: string; description?: string })`
- `async activateDefinition(id: string)`
- `async deleteDefinition(id: string)`
- `flattenFields(schema: FormSchema)`
- `isFieldVisible(field: FormFieldDef, values: Record<string, unknown>)`
- `validate(schema: FormSchema, values: Record<string, unknown>)`

### `fuelService`

- `async getFuelLogs()`
- `async getFuelLogsByVehicleId(vehicleId: string)`
- `async createFuelLog(log: Omit<FuelLog, 'id' | 'efficiency_km_l' | 'is_anomaly' | 'created_at'>)`

### `gratuityService`
*JEET ERP — UAE Gratuity and EOSB Service Reference: UAE Federal Decree-Law No. 33 of 2021*

- `calculateEOSB(params: { joinDate: string; // YYYY-MM-DD exitDate: string; // YYYY-MM-DD basicSalary: n…)`

### `grnExpenseService`
*JEET ERP — GRN-to-Expense Finance Report Reconciles received goods value against supplier invoicing and payment, by project, for a period. Answers: what did we receive,*

- `async getReport(period: ExpensePeriod = 'ALL')`

### `grnReceivablesService`
*JEET ERP — GRN Receivables Consolidated view of every line item awaiting receipt across open LPOs (and direct-purchased PRs), with project, supplier,*

- `async getReceivables()`
- `async cancelLineItem(poItemId: string)`
- `async cancelPRLineItem(prItemId: string)`
- `throw(error.code === 'PGRST204' || /line_status/.test(error.message)`

### `grnService`
*JEET ERP — Goods Receipt Note (GRN) Service*

- `async recordGRN(grnData: Omit<GoodsReceiptNote, 'id' | 'grn_number' | 'received_by' | 'received_at' | 's…)`
- `async getGRNs(filters?: { project_id?: string; po_id?: string; search?: string; })`
- `async getGRNDetail(grnId: string)`
- `async getReturns(filters?: { status?: GRNReturnStatus; project_id?: string; })`
- `async updateReturnStatus(returnId: string, status: GRNReturnStatus, resolutionNotes?: string)`

### `handoverCertPDFService`
*JEET ERP — Handover Closeout Certificate PDF Service*

- `async generateAndFileHandoverCertificate(projectId: string)`
- `autoTable(doc, { startY: y, margin: { left: margin + 5, right: margin + 5 }, body: specsRows, them…)`

### `handoverService`
*JEET ERP — Handover / Closeout Service*

- `async getHandoverPackage(projectId: string)`
- `async initializeHandoverPackage(projectId: string)`
- `async checkGateStatus(projectId: string)`
- `async updateChecklistItemStatus(itemId: string, status: 'PENDING' | 'DONE' | 'WAIVED', params: { evidence_document_id?: …)`
- `async submitHandoverSignOff(projectId: string, params: { client_signatory_name: string; client_signatory_designation…)`

### `inventoryGlService`
*JEET ERP — Warehouse: Inventory GL Integration service Maps stock movement types to GL accounts and builds a period journal from the movement ledger. Degrades gracefully to built-in*

- `async getMappings()`
- `async upsertMapping(m: GlMapping)`
- `async getPeriodJournal(opts: { date_from?: string; date_to?: string })`

### `invoiceMathService`
*JEET ERP — Client Invoice Math Engine Handles: FTA-compliant line VAT (round half-up), advance recovery, retention deduction, and net due calculation.*

- `function round2(value: number)`
- `function round4(value: number)`
- `function calculateInvoiceLine(line: CalcLineInput)`
- `function calculateInvoiceTotals(input: InvoiceMathInput)`

### `invoicePDFService`
*JEET ERP — Client Invoice and Credit Note PDF Compiler Generates: FTA-compliant tax invoices & credit notes*

- `async generateInvoicePDF(invoice: ClientInvoice, items: ClientInvoiceItem[])`
- `String(idx + 1)`
- `autoTable(doc, { startY: y, margin: { left: margin, right: margin }, head: [['No', 'Description', …)`
- `async generateCreditNotePDF(creditNote: CreditNote, invoice: ClientInvoice)`

### `invoiceService`
*JEET ERP — Client Invoice Service Handles: CRUD, approvals, status transitions, PDF uploads, retention ledgering, and event triggers.*

- `async getBillableMilestones(projectId: string)`
- `async generateProgressFromMilestones(projectId: string, lines: Array<{ milestone_id: string; description: string; amount: num…)`
- `async fetchInvoices(filters: { status?: string; projectId?: string; clientId?: string; search?: string; } = {})`
- `async fetchInvoiceById(id: string)`
- `async createInvoiceDraft(invoiceData: Omit<Partial<ClientInvoice>, 'id' | 'created_at' | 'updated_at'>, itemsData…)`
- `async submitForApproval(id: string)`
- `async approveInvoice(id: string)`
- `async rejectInvoice(id: string, reason: string)`
- `async markAsSent(id: string)`
- `async writeOffInvoice(id: string, reason: string)`
- `async deleteInvoice(id: string)`
- `async fetchRetentionLedger(projectId: string)`
- `async releaseRetention(projectId: string, invoiceId: string, amount: number)`

### `kpiService`
*JEET ERP — Centralized KPI Aggregation Service Computes executive COE-level indicators and module stats*

- `async getExecutiveKPIs()`
- `async getFinanceKPIs()`

### `leaveService`
*JEET ERP — Leave & Attendance Management Service*

- `async getLeaveRequests(employeeId: string)`
- `async getApprovalsQueue()`
- `async calculateWorkingDays(fromDate: string, toDate: string)`
- `async createLeaveRequest(params: Omit<LeaveRequest, 'id' | 'status' | 'approver_id' | 'created_at' | 'updated_at'>)`
- `async approveLeaveRequest(requestId: string)`
- `async rejectLeaveRequest(requestId: string)`
- `async getLeaveCalendar(startDate: string, endDate: string)`

### `maintenanceService`

- `async getMaintenanceLogs()`
- `async getMaintenanceLogsByVehicleId(vehicleId: string)`
- `async createMaintenanceLog(log: Omit<VehicleMaintenance, 'id' | 'created_at' | 'updated_at'>)`
- `async updateMaintenanceLog(id: string, updates: Partial<VehicleMaintenance>)`
- `async syncVehicleOdometer(vehicleId: string, odometerKm: number)`

### `meetingService`
*JEET ERP — Meetings Service Client Handles creation, calendar feeds, responses, minutes, and AI parsing*

- `async fetchMeetings(filters: { project_id?: string; organizer_id?: string; status?: MeetingStatus; } = {})`
- `async fetchMeetingById(id: string)`
- `async createMeeting(meetingData: Omit<Meeting, 'id' | 'created_at' | 'attendees' | 'action_items'>, attendee…)`
- `async updateMeeting(id: string, updates: Partial<Meeting>)`
- `async respondToInvitation(meetingId: string, userId: string, response: AttendeeResponse)`
- `async extractActionItems(minutesText: string)`
- `async publishMinutes(meetingId: string, minutesMarkdown: string, actionItems: Array<{ description: string; as…)`

### `mrfService`
*JEET ERP — Material Requisition Form (MRF) & Issue Service*

- `async createMRF(mrf: Omit<MaterialRequisition, 'id' | 'mrf_number' | 'created_at' | 'updated_at' | 'requ…)`
- `async getMRFs(filters?: { project_id?: string; status?: MRFStatus })`
- `async getMRFDetail(id: string)`
- `async approveMRF(id: string, approvedItems: Array<{ id: string; qty_approved: number }>)`
- `async issueMRF(id: string, issueItems: Array<{ id: string; qty_to_issue: number; serialNumbers?: string…)`
- `async returnFromSite(params: { project_id: string; stock_item_id: string; location_id: string; qty: number; s…)`

### `notificationService`
*JEET ERP — Notification Engine Service Handles client-side notification fetching, updates, and user preferences*

- `async fetchNotifications(userId: string, limit = 50, onlyUnread = false)`
- `async markAsRead(notificationId: string, actioned = false)`
- `async markAllAsRead(userId: string)`
- `async fetchPreferences(userId: string)`
- `async updatePreference(userId: string, eventModule: string, channel: NotificationChannel, mode: NotificationPre…)`

### `numberingService`
*JEET ERP — Dynamic Numbering Service Configurable document numbering per module. Generation is atomic via the generate_document_number RPC (see migration).*

- `async getRules()`
- `async getRule(moduleKey: string)`
- `async upsertRule(rule: { id?: string; module_key: string; prefix: string; separator?: string; include_yea…)`
- `async deleteRule(id: string)`
- `async generateNumber(moduleKey: string)`
- `async previewNext(moduleKey: string)`
- `function previewNumber(rule: Pick<NumberingRule, 'prefix' | 'separator' | 'include_year' | 'include_month' | 'p)`

### `paymentAccountService`
*JEET ERP — Payment Accounts / Cards Cards, bank accounts and cash/petty-cash floats that pay for expenses. Balance = opening balance − everything paid from it.*

- `async list()`
- `safe(supabase.from('supplier_payments')`
- `async create(input: { name: string; type: AccountType; account_ref?: string | null; opening_balance?:…)`
- `async setActive(id: string, isActive: boolean)`

### `paymentService`
*JEET ERP — Client Payment and Allocation Service Handles: Cash receipts (payments), invoice allocations, status updates, and notification events.*

- `async fetchPayments(filters: { clientId?: string } = {})`
- `async fetchAllocations(paymentId: string)`
- `async recordPayment(paymentData: Omit<Partial<ClientPayment>, 'id' | 'payment_number' | 'created_by' | 'crea…)`

### `payrollService`

- `calculateEmployeeSalary(params: { periodMonth: string; // YYYY-MM-DD employee: Employee; compensation: EmployeeC…)`
- `async fetchMonthlyOtHours(employeeId: string, startDateStr: string, endDateStr: string)`
- `async fetchMonthlyLeaveDays(employeeId: string, startDateStr: string, endDateStr: string)`
- `async runPayrollForMonth(periodMonth: string)`
- `async approvePayrollRun(runId: string)`

### `permissionService`

- `async getPermissions()`
- `async getRolePermissions(roleId: string)`
- `async updateRolePermissions(roleId: string, mappings: { permissionId: string; scope: PermissionScope }[])`
- `async getUserEffectivePermissions(userId: string)`

### `pettyCashService`
*JEET ERP — Finance: Petty Cash service Funds (floats) + transactions (expense/replenish/return) with approval. Balance = opening + approved replenish/return − approved*

- `async listFunds()`
- `async listTransactions(limit = 100)`
- `async createFund(input: { name: string; custodian_name?: string; opening_balance?: number; low_threshold?…)`
- `async createTransaction(input: { fund_id: string; type: PettyTxnType; amount: number; category?: string; descrip…)`
- `async setStatus(id: string, status: PettyTxnStatus)`

### `poApprovalService`
*JEET ERP — PO Approval Workflow Service*

- `determineApprovalStages(totalWithVat: number)`
- `validatePOSubmission(po: Partial<PurchaseOrder>)`
- `async checkApprovalPermission(po: PurchaseOrder, userId: string, stage: POApprovalStage)`
- `async submitForApproval(poId: string, actorUserId?: string)`
- `async processApproval(poId: string, stage: POApprovalStage, action: POApprovalAction, comment: string | null, …)`

### `poFromComparisonService`
*JEET ERP — PO Generator From Comparison Service*

- `async findComparisonForProject(projectId: string)`
- `async getProposalsForProject(projectId: string)`
- `async generatePOProposalsFromComparison(comparisonId: string)`

### `poNumberService`
*JEET ERP — PO & GRN Sequence Number Service Consumes admin-configured numbering rules (numbering_rules table) when available; falls back to the legacy per-module*

- `async getNextPOPreview()`
- `async getNextGRNPreview()`

### `poPDFService`
*JEET ERP — Purchase Order (LPO) PDF Compiler Service*

- `async generatePOPDF(po: PurchaseOrder, items: POItem[])`
- `String(idx + 1)`
- `autoTable(doc, { startY: y, margin: { left: margin, right: margin }, head: [['No', 'Item Code', 'D…)`

### `poService`
*JEET ERP — Purchase Order (LPO) Core Service*

- `async getPOs(filters?: { status?: POStatus; project_id?: string; supplier_id?: string; search?: strin…)`
- `async getPODetail(poId: string)`
- `async createPO(poData: Omit<PurchaseOrder, 'id' | 'po_number' | 'revision_number' | 'is_latest' | 'stat…)`
- `async updatePO(poId: string, poData: Partial<PurchaseOrder>, items?: Array<Omit<POItem, 'id' | 'po_id' …)`
- `async sendPO(poId: string)`
- `async acknowledgePO(poId: string, ackReference: string, ackDate?: string)`
- `async cancelPO(poId: string, reason: string)`
- `async closeShortPO(poId: string, reason: string)`
- `async revisePO(poId: string)`

### `ppmScheduleService`
*JEET ERP — PPM Visits Scheduler Service Distributes PPM visits evenly across the contract duration.*

- `async generatePPMVisitsForContract(contract: AMCContract)`

### `prService`
*JEET ERP — Purchase Request (PR) Service Raise a PR (with or without a project), validate/approve it, then convert it into an LPO. The LPO links back via pr_id.*

- `async list(filters: { status?: string; category?: string } = {})`
- `async get(id: string)`
- `async create(input: PRInput)`
- `async submit(id: string)`
- `async approve(id: string)`
- `async reject(id: string, reason: string)`
- `async getDirectPurchaseThreshold()`
- `async markDirectPurchased(id: string)`
- `async markConverted(prId: string, poId: string)`
- `async _transition(id: string, to: PRStatus, allowedFrom: PRStatus[], summary: string)`

### `priceUpdateService`
*JEET ERP — Catalogue Price Auto-Update Updates pricing_items.material_cost from real supplier prices (supplier invoices, proformas, POs) and keeps a price-history*

- `async updateItemCost(pricingItemId: string, newCost: number, source: PriceSource, opts: { sourceRef?: string;…)`
- `async applyFromSupplierInvoice(invoiceId: string)`
- `async getHistory(pricingItemId: string, limit = 20)`

### `projectCashFlowService`
*JEET ERP — Finance: Project Cash Flow Per-project monthly cash in (client receipts) vs cash out (supplier payments + paid expenses) and cumulative position.*

- `async getProjectCashFlow(projectId: string)`

### `projectDocumentService`
*JEET ERP — Project Document Register Walks the full relationship graph for a project and returns every linked document (tender, BOQ, quotation, comparisons,*

- `async getLinkedRegister(project: ProjectInput)`
- `safe(supabase.from('purchase_orders')`
- `push('Tender', [{ category: 'Tender', reference: tender.title || `TND-${String(tender.id)`

### `projectFinancialsService`
*JEET ERP — Project Cost Control and Financials Service Computes: Budget vs Committed vs Accrued vs Actual vs Revenue Billed*

- `async computeProjectFinancials(projectId: string)`

### `projectPortfolioService`
*JEET ERP — Projects: Portfolio / Executive Dashboard service Read-only, BATCHED aggregation across all projects (no per-project N queries): contract/billed/collected/committed + projected margin,*

- `async getPortfolio()`

### `pushService`
*Utility helper to convert base64 VAPID key to Uint8Array*

- `async registerPushNotifications()`
- `async unsubscribePush()`

### `reportingService`

- `async getFinancialSummary()`
- `async getAgingReport(type: 'AR' | 'AP')`
- `async getProjectMarginKPIs()`
- `async getTicketSLAStats()`

### `resourcePlanningService`
*JEET ERP — Projects: Resource / Manpower Planning service CRUD over project_resource_allocations + a cross-project utilization summary. Audit-logged; separate-lookup pattern.*

- `async list(opts?: { projectId?: string })`
- `async create(input: Partial<ResourceAllocation> & { project_id: string; resource_name: string })`
- `async update(id: string, patch: Partial<ResourceAllocation>)`
- `async remove(id: string)`
- `async utilization(onDate?: string)`

### `retentionService`
*JEET ERP — Finance: Retention Management Read-only view over the existing project_retention_ledger (client-side retention receivable). Net held per invoice =*

- `async list()`

### `rfqService`
*JEET ERP — Request for Quotation (RFQ) service Drafts a sourcing request from a BOQ, records it as a log, and supports listing/export. The next step (AI) reads supplier email*

- `async getRecipients()`
- `async getBoqItems(boqId: string)`
- `async create(input: RFQInput)`
- `async list()`
- `async get(id: string)`
- `async markSent(id: string)`

### `riskRegisterService`
*JEET ERP — Projects: Risk Register service CRUD over project_risks + 5x5 matrix scoring. Audit-logged.*

- `async list(opts?: { projectId?: string })`
- `async nextRefCode(projectId: string)`
- `async create(input: Partial<ProjectRisk> & { project_id: string; title: string })`
- `async update(id: string, patch: Partial<ProjectRisk>)`
- `async remove(id: string)`
- `function ratingFor(score: number)`

### `rulesService`
*JEET ERP — Business Rules Service IF/THEN rules configurable from the Admin Center; modules call evaluate() at their trigger points.*

- `async getRules(moduleKey?: string)`
- `async upsertRule(rule: Partial<BusinessRule> & { module_key: string; name: string; trigger_event: RuleTri…)`
- `async toggleRule(id: string, isActive: boolean)`
- `async deleteRule(id: string)`
- `async evaluate(moduleKey: string, triggerEvent: RuleTriggerEvent, context: Record<string, unknown>)`

### `settingsService`

- `async getSettings(category?: SettingCategory)`
- `async getSettingByKey(key: string, defaultValue?: T)`
- `async updateSetting(key: string, value: any, category: SettingCategory = 'COMPANY', dataType: SettingDataTyp…)`
- `async getCompanyProfile()`
- `async getDocumentTemplates()`

### `sifService`
*JEET ERP — WPS SIF Generation Service Reference: MOHRE / UAE Central Bank Wages Protection System (WPS)*

- `validateUAEIBAN(iban: string)`
- `generateSIF(params: { establishmentId: string; // 13 digits bankRoutingCode: string; // 9 digits sal…)`

### `siteRecordsService`
*JEET ERP — Projects: RFI / SI / NCR register service One table, doc_type discriminator, per-type running ref. Audit-logged; separate-lookup pattern.*

- `async list(opts?: { projectId?: string; docType?: SiteDocType })`
- `async nextRef(projectId: string, docType: SiteDocType)`
- `async create(input: Partial<SiteRecord> & { project_id: string; doc_type: SiteDocType; title: string })`
- `async update(id: string, patch: Partial<SiteRecord>)`
- `async remove(id: string)`

### `slaService`
*JEET ERP — SLA Management Service Handles SLA calculation, timer pauses on parts-hold, and SLA breach checks (holidays and business hours aware).*

- `function calculateSLADeadlines(params: { priority: TicketPriority; sla_tier?: SLATier; contract_response_hours?: number)`
- `function pauseSLATimer(ticket: ServiceTicket, pauseTime: Date = new Date()`
- `function resumeSLATimer(ticket: ServiceTicket, resumeTime: Date = new Date()`
- `function evaluateSLABreach(ticket: ServiceTicket, checkTime: Date = new Date()`
- `function formatSLARemainingTime(dueTimeISO: string, pausedAtISO?: string | null)`

### `snagExportService`
*JEET ERP — Snag List Export Service*

- `async exportSnagsToPDF(projectId: string)`
- `autoTable(doc, { startY: y, margin: { left: margin, right: margin }, head: [['Ref #', 'Severity', …)`

### `snagService`
*JEET ERP — Snag / Punch List Service PostgREST embeds are unreliable in this setup (snags has no FK to profiles → PGRST200). Enrich rows with project + assignee/closer/verifier/creator names*

- `async getSnagsByProject(projectId: string)`
- `async getSnagById(snagId: string)`
- `async createSnag(params: { project_id: string; source: SnagSource; system: string; location: string; desc…)`
- `async updateSnag(snagId: string, updates: Partial<Snag>)`
- `async transitionSnagStatus(snagId: string, newStatus: SnagStatus, params: { photo_paths?: string[]; // closed evide…)`
- `async checkAndEmitAllClosedEvent(projectId: string)`

### `statementImportService`
*Extract the raw base64 string from data URL*

- `resolve(base64Data)`
- `async extractFinesFromStatement(file: File)`

### `stockCountService`
*JEET ERP — Stock Count & Reconciliation Service*

- `async startStockCount(locationId: string)`
- `async getStockCounts(locationId?: string)`
- `async getStockCountDetail(id: string)`
- `async saveCountLines(countId: string, lines: Array<{ stock_item_id: string; counted_qty: number; recount_flag…)`
- `async postStockCount(id: string, reason: string)`

### `stockService`
*JEET ERP — Stock and Location Service Plain select + separate name lookups — PostgREST embeds for project_id/custodian_id are unreliable here (schema-cache).*

- `async getLocations()`
- `async _resolveLocationNames(locs: any[])`
- `async getLocationDetail(id: string)`
- `async createLocation(loc: Omit<StockLocation, 'id' | 'created_at'>)`
- `async getStockItems()`
- `async getStockItemDetail(id: string)`
- `async createStockItem(item: Omit<StockItem, 'id' | 'created_at'>)`
- `async getBalances(filters?: { location_id?: string; stock_item_id?: string; })`
- `async getMovementLedger(filters?: { type?: string; location_id?: string; stock_item_id?: string; project_id?: st…)`
- `async getSerialUnits(filters?: { stock_item_id?: string; location_id?: string; status?: string; })`
- `async getDeadStockReport(inactiveDays: number = 180)`
- `async getValuationReport(locationId?: string)`

### `stockTransactionService`
*JEET ERP — Stock Transaction Service*

- `async recordTransaction(tx: Omit<StockTransaction, 'id' | 'transaction_number' | 'created_at' | 'performed_by'>,…)`

### `supplierInvoiceService`
*JEET ERP — Supplier Invoice (Accounts Payable) Service Handles: Registration, 3-way matching, exception overrides, approvals, and event triggers.*

- `async fetchSupplierInvoices(filters: { status?: string; poId?: string; supplierId?: string; projectId?: string; } = {})`
- `async fetchSupplierInvoiceById(id: string)`
- `async createExpectedFromPO(poId: string)`
- `async validateExpected(id: string, input: { supplier_invoice_number: string; invoice_date?: string; taxable_amo…)`
- `async recordExpense(input: { cost_bucket: 'PROJECT' | 'PETTY_CASH' | 'OFFICE'; project_id?: string | null; p…)`
- `async registerSupplierInvoice(invoiceData: Omit<Partial<SupplierInvoice>, 'id' | 'internal_ref' | 'created_by' | 'crea…)`
- `async approveSupplierInvoice(id: string)`
- `async overrideMatchException(id: string, reason: string)`
- `async recordSupplierPayment(paymentData: { supplier_id: string; amount: number; payment_date: string; method: string…)`

### `supplierPerformanceService`
*JEET ERP — Supplier Performance Writeback Service 1. Fetch current performance record (to preserve win_rate or fallback)*

- `async recalculateSupplierPerformance(supplierId: string)`
- `async savePerformanceRecord(data: any)`

### `supplierRetentionService`
*JEET ERP — Finance: Retention Payable (subcontractor retention) Net retention held per subcontractor/project from the supplier retention ledger (HELD − RELEASED), with release-schedule status.*

- `async list()`
- `async addHold(input: { supplier_id?: string | null; supplier_name: string; project_id?: string | null;…)`
- `async release(input: { supplier_id?: string | null; supplier_name: string; project_id?: string | null;…)`

### `taskService`
*JEET ERP — Task Management Service Client Handles task CRUD, comment additions, and workload analytics*

- `async fetchTasks(filters: { assignee_id?: string; project_id?: string; status?: TaskStatus; priority?: Ta…)`
- `async fetchTaskById(id: string)`
- `async createTask(taskData: Partial<Task>)`
- `async updateTask(id: string, updates: Partial<Task>)`
- `async deleteTask(id: string)`
- `async fetchComments(taskId: string)`
- `async addComment(taskId: string, body: string)`
- `async fetchWorkloadAnalytics()`
- `async parseNaturalLanguageTask(promptText: string)`

### `tcReportPDFService`
*JEET ERP — Testing & Commissioning PDF & DMS Service*

- `async generateAndFileTCReport(packageId: string)`
- `autoTable(doc, { startY: y, margin: { left: margin, right: margin }, head: [['No', 'Test Checklist…)`

### `tcService`
*JEET ERP — Testing & Commissioning (T&C) Service PostgREST embeds are unreliable in this setup (tc_packages has no FK to profiles → PGRST200). Enrich rows with project/engineer/creator names via*

- `async getPackagesByProject(projectId: string)`
- `async getPackageById(packageId: string)`
- `async createPackage(params: { project_id: string; system: string; title: string; assigned_engineer_id?: stri…)`
- `async getTestScripts(packageId: string)`
- `async getDevices(packageId: string)`
- `async logTestResult(params: { script_id: string; device_id?: string; result: 'PASS' | 'FAIL' | 'NA'; measure…)`
- `async recalculatePackageProgress(packageId: string)`
- `async scheduleWitness(packageId: string, witnessDate: string)`
- `async submitWitnessSignOff(params: { package_id: string; witness_stage: 'INTERNAL' | 'CONSULTANT' | 'CLIENT'; witne…)`

### `templateService`
*JEET ERP — Document Template Service Visual templates with {{variables}}, headers, footers, watermarks, QR placeholders and signature blocks.*

- `async getTemplates()`
- `async getTemplate(idOrKey: string)`
- `async createTemplate(input: { template_key: string; name: string; module_key?: string; description?: string; })`
- `async updateTemplate(id: string, patch: Partial<Pick<DocumentTemplate, 'name' | 'description' | 'content' | '…)`
- `async deleteTemplate(id: string)`
- `async cloneTemplate(id: string)`
- `async renderToHtml(template: DocumentTemplate, variables: Record<string, unknown>)`
- `async print(templateKey: string, variables: Record<string, unknown>)`
- `setTimeout(()`

### `test-sla-service`
*JEET ERP — SLA Math Service Unit Tests Run: npx ts-node src/services/test-sla-service.ts Parse .env.local manually and set env vars*

- `assert('Standard SLA Response Due (24h business time)`

### `threeWayMatchService`
*JEET ERP — Supplier 3-Way Matching Engine Verifies: Invoiced Unit Price vs PO Price (0.5% tolerance) Invoiced Qty vs (GRN Received Qty - Prev Invoiced Qty)*

- `function validateUAETrn(trn: string)`
- `function performThreeWayMatch(input: MatchEngineInput)`

### `ticketService`
*JEET ERP — Reactive Service Tickets Service Handles ticket lifecycle, SLAs, status changes, parts usage, and auto-generation of chargeable invoices upon closure.*

- `async fetchTickets(filters: { status?: string; technicianId?: string; priority?: string; search?: string; }…)`
- `async fetchTicketById(id: string)`
- `async createTicket(ticketData: Omit<Partial<ServiceTicket>, 'id' | 'ticket_number' | 'created_at'>)`
- `async assignTicket(ticketId: string, technicianId: string)`
- `async dispatchTechnician(ticketId: string)`
- `async pauseTicketForParts(ticketId: string, reason: string)`
- `async resumeTicketFromHold(ticketId: string)`
- `async resolveTicket(ticketId: string, resolutionSummary: string, partsUsed: TicketPartItem[], clientSignName…)`
- `async closeTicket(ticketId: string)`
- `async addTicketComment(ticketId: string, commentText: string)`

### `timesheetService`
*JEET ERP — Timesheet and Labour Allocations Service*

- `async getTimesheet(employeeId: string, weekStart: string)`
- `async getOrCreateTimesheet(employeeId: string, weekStart: string)`
- `async saveEntries(timesheetId: string, entries: Omit<TimesheetEntry, 'id' | 'timesheet_id' | 'created_at'>[])`
- `async updateTimesheetTotals(timesheetId: string)`
- `async submitTimesheet(timesheetId: string)`
- `async approveTimesheet(timesheetId: string)`
- `async rejectTimesheet(timesheetId: string, reason: string)`
- `async getApprovalsQueue()`
- `async getPrefillSuggestions(employeeId: string, weekStart: string)`

### `toolService`
*JEET ERP — Tools & Equipment Register Service*

- `async getTools(filters?: { category?: ToolCategory; status?: ToolStatus; condition?: ToolCondition; req…)`
- `async getToolDetail(id: string)`
- `async createTool(tool: Omit<Tool, 'id' | 'tool_number' | 'created_at' | 'updated_at' | 'is_active'>)`
- `async getAssignments(filters?: { tool_id?: string; employee_id?: string })`
- `async assignTool(assignment: Omit<ToolAssignment, 'id' | 'issue_date' | 'returned_date' | 'issued_by' | '…)`
- `async returnTool(assignmentId: string, returnCondition: ToolCondition, notes?: string)`
- `async getMaintenanceLogs(toolId?: string)`
- `async recordMaintenance(log: Omit<ToolMaintenance, 'id' | 'created_at'>)`

### `transferService`
*JEET ERP — Stock Transfer Service*

- `async createTransfer(fromLocationId: string, toLocationId: string, items: Array<{ stock_item_id: string; qty:…)`

### `treasuryService`
*JEET ERP — Finance: Treasury service Bank facilities (loans/overdrafts/guarantees/LCs): limit vs utilization and maturity tracking. Self-contained.*

- `async list()`
- `async create(input: Partial<Facility>)`
- `async setStatus(id: string, status: FacilityStatus)`

### `userRoleService`

- `async getRoles()`
- `async getUsers()`
- `async getUserRoles(userId: string)`
- `async updateUserRoles(userId: string, roleIds: string[])`
- `async toggleRoleStatus(roleId: string, isActive: boolean)`

### `vatService`
*JEET ERP — UAE VAT Return (FTA Form 201) Service Computes outputs/inputs, Emirate splits, and handles locking.*

- `async fetchVATPeriods()`
- `async createVATPeriod(periodData: Omit<Partial<VATPeriod>, 'id' | 'status' | 'is_active' | 'created_by' | 'cre…)`
- `async lockVATPeriod(id: string)`
- `async computeForm201(periodId: string)`

### `vehicleService`

- `async getVehicles()`
- `async getVehicleById(id: string)`
- `async createVehicle(vehicle: Omit<Vehicle, 'id' | 'vehicle_code' | 'created_at' | 'updated_at'>)`
- `async updateVehicle(id: string, updates: Partial<Vehicle>)`
- `async deleteVehicle(id: string)`
- `async getAssignments(vehicleId: string)`
- `async getActiveAssignment(vehicleId: string)`
- `async assignVehicle(assignment: Omit<VehicleAssignment, 'id' | 'to_date' | 'created_at' | 'updated_at'>)`
- `async endAssignment(assignmentId: string, returnOdometer: number, conditionNotes?: string | null, signatureP…)`

### `visitReportPDFService`
*JEET ERP — PPM Visit Report PDF & DMS Service Compiles, uploads, and files signed PPM Visit reports.*

- `async generateAndFileVisitReport(visitId: string)`
- `autoTable(doc, { startY: y, margin: { left: margin, right: margin }, head: [['No', 'Maintenance Ve…)`

### `visitService`
*JEET ERP — PPM Visit Execution Service Handles visit scheduling, starts, checklist logging, completion, and defect auto-ticket generation.*

- `async fetchPPMVisits(filters: { status?: string; technicianId?: string; date?: string; } = {})`
- `async fetchPPMVisitById(id: string)`
- `async schedulePPMVisit(visitId: string, scheduledDate: string, scheduledSlot: 'AM' | 'PM', technicianId: string…)`
- `async startPPMVisit(visitId: string)`
- `async fetchChecklistTemplates()`
- `async fetchChecklistTemplateBySystem(system: string)`
- `async saveChecklistResult(resultData: Omit<PPMVisitChecklistResult, 'id' | 'created_at'>)`
- `async completePPMVisit(visitId: string, completeData: { signaturePath: string; clientSignName: string; clientSi…)`

### `voApprovalService`
*JEET ERP — Variation Order Approval Service Location: src/services/voApprovalService.ts Handles threshold routing, self-approval guards, and transition logic.*

- `async evaluateApprovalPermissions(vo: VariationOrder, userId: string)`

### `voContractImpactService`
*JEET ERP — Variation Order Contract Impact Calculation Engine Location: src/services/voContractImpactService.ts Pure, side-effect-free functions for contract value adjustments,*

- `function calculateVOMargin(sellAmount: number, costAmount: number)`
- `function calculateContractImpact(input: VOContractImpactInput)`
- `function validateInvoiceCeiling(revisedContractValue: number, cumulativeInvoiced: number, currentInvoiceGross: number)`

### `voNumberService`
*JEET ERP — Variation Order (VO) Number Sequence Service Location: src/services/voNumberService.ts Previews sequences before database trigger assignment.*

- `async getNextVOPreview()`
- `async getNextProjectVOSequencePreview(projectId: string)`

### `voPDFService`
*JEET ERP — Variation Order PDF Generation Service Location: src/services/voPDFService.ts Branded client-facing document generation using jsPDF + autoTable.*

- `async generateVOReport(vo: VariationOrder, items: VOItem[])`
- `autoTable(doc, { columns: columns, body: rows, startY: currentY, theme: 'plain', styles: { fontSiz…)`
- `addPageBorderAndFooter(doc: jsPDF, pageNum: number, totalPages: number, voNo: string, footerDisclaimer?: string…)`

### `voService`
*JEET ERP — Variation Order (VO) Service Location: src/services/voService.ts Handles database CRUD, workflow approval chains, PDF generation*

- `async fetchVOs(filters: VOFilters = {})`
- `async fetchVOById(id: string)`
- `async createVODraft(voData: Omit<Partial<VariationOrder>, 'id' | 'vo_number' | 'project_vo_sequence' | 'crea…)`
- `async submitInternalReview(id: string, comment?: string)`
- `async approveInternal(id: string, comment?: string)`
- `async submitToClient(id: string)`
- `async recordClientApproval(id: string, approvalRef: string, approvalDate: string, signedDocId?: string | null)`
- `async recordClientRejection(id: string, reason: string)`
- `async cancelVO(id: string, reason: string)`
- `async updateWorkStatus(id: string, workStatus: VOWorkStatus)`
- `async applyApprovedVOToBOQ(boqId: string, voItems: VOItem[], voNumber: string)`
- `async getProjectVOSummary(projectId: string)`
- `async fetchApprovalQueue()`

### `walkthroughService`
*JEET ERP — Walkthrough & Rapid Snag Logging Service*

- `async logWalkthrough(params: { project_id: string; inspector_name: string; client_representative: string; wal…)`

### `warehouseService`
*JEET ERP — Warehouse & Inventory Service Aggregates the supplier/subcontractor registry (with historic scoring from PO performance), the store (stock items +*

- `async getSuppliers()`
- `async getSupplierDetail(id: string)`
- `async createSupplier(input: { name: string; contact_person?: string; phone?: string; email?: string; payment_…)`
- `async toggleSupplierActive(id: string, isActive: boolean)`
- `async getStock(locationId?: string)`
- `async getLocations()`
- `async createLocation(input: { name: string; location_code: string; type: string })`
- `async getItemBalances(stockItemId: string)`
- `async getProjects()`
- `async getRegisterableItems()`
- `async registerStockItem(input: { pricing_item_id: string; reorder_level?: number | null; reorder_qty?: number | …)`
- `async getStockItemOptions()`
- `async recordManualMovement(input: { type: StockTransactionType; stock_item_id: string; location_id: string; quantit…)`
- `async getMovements(limit = 200)`

### `warrantyService`
*JEET ERP — Projects: DLP & Warranty Tracking service Warranty register (with expiry reminders) + DLP-period defect tracking. Extends the handover/DLP flow. Audit-logged.*

- `async listWarranties(opts?: { projectId?: string })`
- `async createWarranty(input: Partial<Warranty> & { project_id: string; item_name: string })`
- `async updateWarranty(id: string, patch: Partial<Warranty>)`
- `async removeWarranty(id: string)`
- `async listDefects(opts?: { projectId?: string })`
- `async nextDefectRef(projectId: string)`
- `async createDefect(input: Partial<DlpDefect> & { project_id: string; title: string })`
- `async updateDefect(id: string, patch: Partial<DlpDefect>)`
- `async removeDefect(id: string)`

### `wbsService`
*JEET ERP — Projects: WBS service Hierarchical work packages with budget/weight and rolled-up progress (leaf progress → parent by weighted average).*

- `async listFlat(projectId: string)`
- `walk(null, 0)`
- `async create(input: { project_id: string; parent_id?: string | null; name: string; code?: string; sys…)`
- `async update(id: string, patch: Partial<{ name: string; code: string; system_name: string; budget_cos…)`
- `async remove(id: string)`
- `async seedFromSystems(projectId: string)`

### `weightedAverageService`
*JEET ERP — Weighted Average Cost (WAC) Service (PURE MATH)*

- `round4(val: number)`
- `calculateNewAverage(currentQty: number, currentAvgCost: number, addedQty: number, unitCost: number)`

### `whatsappService`
*JEET ERP — WhatsApp Integration Service Client-side functions for managing chats, messages, and settings*

- `async fetchChats()`
- `async fetchMessages(chatId: string)`
- `async sendManualMessage(chatId: string, bodyText: string)`
- `async updateChatStatus(chatId: string, status: 'AUTO_REPLY' | 'HUMAN_AGENT' | 'CLOSED', assignedTo?: string | n…)`
- `async linkChatToClient(chatId: string, clientId: string | null, contractId: string | null)`
- `async fetchSettings()`
- `async saveSettings(updates: Partial<WhatsAppSettings>)`
- `async fetchTemplates()`
- `async updateTemplate(templateId: string, updates: Partial<WhatsAppTemplate>)`

### `workflowService`
*JEET ERP — Workflow Service CRUD for workflow definitions + runtime instance engine. Any module starts/advances workflows via this service without*

- `async getDefinitions()`
- `async getWorkflowGraph(workflowId: string)`
- `async createDefinition(input: { module_key: string; name: string; description?: string })`
- `async updateDefinition(id: string, patch: Partial<Pick<WorkflowDefinition, 'name' | 'description'>>)`
- `async activateDefinition(id: string)`
- `async deactivateDefinition(id: string)`
- `async deleteDefinition(id: string)`
- `async cloneDefinition(id: string, newName?: string)`
- `async upsertStatus(status: Partial<WorkflowStatus> & { workflow_id: string; status_key: string; label: stri…)`
- `async deleteStatus(id: string)`
- `async upsertTransition(t: Partial<WorkflowTransition> & { workflow_id: string; from_status_id: string; to_statu…)`
- `async deleteTransition(id: string)`
- `async getActiveWorkflow(moduleKey: string)`
- `async startInstance(moduleKey: string, entityId: string)`
- `async getInstance(moduleKey: string, entityId: string)`
- `async getMyAvailableTransitions(moduleKey: string, entityId: string, context: Record<string, unknown> = {})`
- `async executeTransition(moduleKey: string, entityId: string, transitionId: string, options: { comment?: string; …)`
- `async getWorkflowAnalytics(moduleKey: string)`

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
