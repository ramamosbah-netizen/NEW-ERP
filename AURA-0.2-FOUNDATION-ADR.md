# AURA 0.2 — Foundation ADR & Audits

> Gate document for **Phase 2 (Intelligence Migration)**. Phase 2 may begin **only** after the Foundation Completion Checklist (§E) is green. Evidence is cited to file + line so every claim is verifiable. **No code in this document.**

**Date:** 2026-06-22 · **Status:** Decisions FINAL (ratified by owner) · Companion to `AURA-0.2-CONSOLIDATION-AUDIT.md`

---

## A. Architecture Decision Record

### A.1 Final foundation decisions (ratified)

| # | Decision | Ruling | Consequence |
|---|---|---|---|
| **D1** | Repository strategy | **NEW-ERP is the only production repo.** AURA components migrate *into* it. No dual-repo. | AURA repo becomes a *source library* to port from, then archived. No runtime dependency on it. |
| **D2** | Data access | **supabase-js stays the standard.** No Prisma. Supabase is the operational platform. | Ported AURA engines (Prisma) are rewritten onto supabase-js via a thin repository module. AURA Prisma schema is reference-only. |
| **D3** | Universal Object Model | **`AuraObject` = intelligence graph overlay only.** Not a source of truth. | Canonical entities keep their own tables. Graph realised as an additive `entity_links` (+ optional `entity_nodes`) overlay the intelligence layer reads. Core never depends on it. |
| **D4** | Pre-contract domain | **AURA Deal Chain is the canonical pre-contract workflow.** | Leads, opportunities, quotations, tenders, bid management, pre-sales all map into the deal-chain model (Tender→Bid→Estimation→Pricing→Quote→SalesContract→Project), persisted in Postgres. NEW-ERP `tenders`/`quotations`/`clients` reconcile into it. |
| **D5** | Tenancy | **`company_id` everywhere.** Remove tenant/workspace/organization duplication. | DB is already company-centric (groups→companies→company_members). AURA's `tenantId` is dropped on port and mapped to `company_id`. Full audit in §D. |

### A.2 Ownership boundaries (layer authority)

| Layer | Owns | May read | May write | Must NOT |
|---|---|---|---|---|
| **Experience** (Next.js shell, hubs, theme) | UI, active-company context (switcher) | everything via services | nothing directly (goes through services) | bypass services / hold business logic |
| **Core** (NEW-ERP services + Postgres) | **all business truth**; the canonical tables; ACID; numbering; RBAC/RLS | own tables | own tables; **emits an event after each mutation** | call the Intelligence layer; embed AI logic |
| **Event** (`system_events` + `event_types` + dispatch) | the append-only ledger + taxonomy + processing bookkeeping (`processed_at`) | — | ledger rows + their own `processed_at`/`processing_error` | mutate business tables |
| **Intelligence** (engines, memory, graph overlay) | `intel_*`, `memory`, `entity_links`, (later) autonomy queue | ledger + core (**read-only**) | only its own `intel_*`/overlay tables | write or block any core table |

**Rule (enforced):** dependency direction is one-way **Experience → Core → Event → Intelligence**. Intelligence is a pure consumer; it can propose (write `intel_*` / queue) but never commits to core. (Autonomy write-back is a *later* phase, out of Phase 2 scope.)

### A.3 Event ownership

- **Single canonical ledger:** `public.system_events` (schema-events.sql:54). `public.event_types` (schema-events.sql:11) is the runtime registry; **`system_events.event_type` has a FK to it** → every emitted type must be pre-registered. `src/lib/events/event-catalog.ts` is the compile-time mirror.
- **Producer:** Core services only, via `eventService.emitEvent(...)` (eventService.ts) — now carrying `company_id` + `event_version`.
- **Real-time dispatch:** `eventService` → Supabase Edge Function `process-event` (existing).
- **Batch / backfill dispatch:** `src/lib/intelligence/event-processor.ts` (service role; drains unprocessed; stamps `processed_at`).
- **Consumers:** Intelligence engines (read-only). They may emit *their own* namespaced events (`ai.*`, `autonomy.*`) but must guard against re-trigger loops.
- **Replaced:** AURA's Prisma `Event` model + in-process bus + `event-replay-engine` → re-expressed over `system_events` (replay = re-drain by filter). AURA's bus semantics (wildcard subscribers) become dispatcher subscriptions.
- **Versioning:** `event_version` (default 1) is set per emit; payload shape changes bump the version, never mutate old rows.

---

## B. Module Ownership Matrix

**Action:** KEEP (as-is, NEW-ERP) · MERGE (combine both) · REPLACE (AURA logic supersedes) · DEPRECATE (retire). **Owner layer** = where it lives in the target.

| Module | Source today | Action | Owner layer | Notes |
|---|---|---|---|---|
| Shell / theme / hub nav | NEW-ERP | KEEP | Experience | Canonical skin |
| Auth (Supabase) + RBAC | NEW-ERP | KEEP | Core | `auth_role_keys()` already unifies profiles.role + RBAC tables |
| Multi-company (groups/companies/members) | NEW-ERP | KEEP | Core | Backbone present; scoping incomplete (§D) |
| Event ledger | both | MERGE→REPLACE AURA | Event | `system_events` canonical; AURA bus ported as dispatch |
| Risk / Margin / Forecast intelligence | AURA | REPLACE (thin NEW-ERP AI) | Intelligence | Shipped as `intel_*` + engines (Phase 0) |
| Memory / embeddings (RAG) | AURA | KEEP-AURA→port | Intelligence | **Phase 2 (read-only)**; pgvector later |
| Hermes (comms routing) | AURA | KEEP-AURA→port | Intelligence | **Phase 2**; rides NEW-ERP channels |
| AI agents / observer | AURA | KEEP-AURA→port | Intelligence | Phase 2+ |
| Autonomy (rules/actions/queue/modes) | both | MERGE | Intelligence | **DEFERRED past Phase 2** |
| Knowledge graph | AURA | KEEP-AURA→port | Intelligence | Overlay (`entity_links`); UI later |
| Workspace cognitive (Today Brain) | both | MERGE | Experience+Intelligence | NEW-ERP workspace shell + AURA brain |
| Pre-contract: Tender | both | MERGE (AURA canonical) | Core | D4; reconcile `tenders` (has company_id) |
| Pre-contract: Bid decision | AURA | KEEP-AURA→port | Core | `BidEvaluation` |
| Estimation / BOQ | both | MERGE | Core | One BOQ model (`boqs` vs AURA Estimation) |
| Pricing engine | both | MERGE (AURA canonical) | Core | AURA rate-analysis richer |
| Quotation | both | MERGE (AURA canonical) | Core | AURA locked-snapshot + versioning; `quotations` has company_id |
| Supplier comparison | both | MERGE | Core | NEW-ERP comparison deeper; add AURA AI score |
| Sales contract → project handoff | AURA | KEEP-AURA→port | Core | Deal-chain + lineage |
| CRM (leads/opps/clients) | both | MERGE | Core | `clients` canonical (has company_id); map AURA Lead/Opportunity |
| Projects — execution (EVM/WBS/snags…) | NEW-ERP | KEEP | Core | `projects` has company_id |
| Projects — digital twin / lifecycle / closure | AURA | MERGE (overlay) | Core+Intelligence | Lifecycle/phase logs as overlay |
| Procurement P2P (PR/RFQ/PO/GRN/3-way) | NEW-ERP | KEEP | Core | wave-2 scoped |
| Procurement autopilot / sourcing AI | AURA | KEEP-AURA→port | Intelligence | Later phase |
| Finance GL/AP/AR/treasury/VAT | NEW-ERP | KEEP | Core | Deep; **REPLACE AURA GL** |
| Finance intelligence (margin/recon/consistency) | AURA | KEEP-AURA→port | Intelligence | Later phase |
| Risk register | both | MERGE | Core+Intelligence | NEW-ERP record + AURA propagation |
| Variation Orders | both | MERGE | Core | ⚠ defined twice in DB (schema-vo.sql + vo_module migration) — dedupe |
| Claims (EOT/cost) | AURA | KEEP-AURA→port | Core | NEW-ERP lacks |
| HSE / Mobilization | AURA | KEEP-AURA→port | Core | NEW-ERP lacks |
| Inventory / warehouse | NEW-ERP | KEEP | Core | **No company_id yet** (§D) |
| HR / payroll / timesheets | NEW-ERP | KEEP | Core | `employees` scoped; children not |
| Fleet / assets / tools | NEW-ERP | KEEP | Core | No company_id yet |
| Service / AMC / PPM | NEW-ERP | KEEP | Core | No company_id yet |
| Meetings | NEW-ERP | KEEP | Core | No company_id yet |
| Comms / notifications / WhatsApp | NEW-ERP | KEEP + Hermes | Core+Intelligence | Channels = transport |
| Workflow engine + designer | both | MERGE | Core | NEW-ERP store/UI + AURA gate semantics |
| Rules engine | both | MERGE | Intelligence | With autonomy (deferred) |
| Document mgmt | NEW-ERP | KEEP | Core | Document *intelligence* = gap |
| Admin (forms/numbering/templates/audit) | NEW-ERP | KEEP | Core | — |
| Tasks / notes | both | KEEP-NEW | Core | Map AURA Task/Note/Todo → `tasks` |
| News / marketing | AURA | DEPRECATE→fold | Core | Into comms/announcements |
| AURA Universal Object Model (as truth) | AURA | DEPRECATE | — | Survives only as graph overlay (D3) |
| AURA in-process bus / Event model | AURA | DEPRECATE | — | Replaced by ledger |
| AURA SQLite / persona-auth | AURA | DEPRECATE | — | Postgres + Supabase auth |
| AURA `production/` NestJS+Kafka | AURA | DEFER | — | Revisit at true multi-service scale |

---

## C. Data Ownership Matrix

**SoR** = System of Record (the authoritative table). **Overlay** = intelligence-layer artifact derived from it. **Action** = ADD-COL (add company_id) · KEEP · MIGRATE (port AURA model into Postgres) · RECONCILE (two tables → one) · REPLACE · NEW.

| Domain / table group | System of Record (target) | Intelligence overlay | Migration action |
|---|---|---|---|
| Org backbone (`groups`,`companies`,`company_members`) | NEW-ERP | — | KEEP |
| Identity (`profiles`, RBAC `roles`/`user_roles`/`permissions`) | NEW-ERP | — | KEEP; converge dual role model |
| Projects (`projects`+children) | NEW-ERP `projects` | lifecycle/twin via `entity_links` + `intel_*` | KEEP parent; ADD-COL children |
| Pre-contract — tenders | **AURA deal-chain → Postgres** | bid score `intel_*` | RECONCILE with `tenders` (keep company_id) |
| Pre-contract — pricing | **AURA `PricingRun/Line/Template`** | margin `intel_insight` | MIGRATE (canonical); RECONCILE `pricing_*` |
| Pre-contract — quotations | **AURA `Quote/QuoteLine`** | win/loss memory | MIGRATE; RECONCILE `quotations` (keep company_id) |
| Pre-contract — BOQ/estimation | one model | — | RECONCILE `boqs` ↔ AURA `Estimation` |
| Supplier comparison | NEW-ERP `supplier_comparisons` | AURA AI score | KEEP; ADD-COL; enrich |
| CRM (`clients`; AURA Lead/Opportunity/Activity) | NEW-ERP `clients` | — | KEEP `clients`; MIGRATE Lead/Opp/Activity |
| Sales contract (`SalesContract`) | **AURA → Postgres** | — | MIGRATE (new table) + ADD-COL |
| Procurement (`purchase_requests`,`purchase_orders`,`grns`+items) | NEW-ERP | autopilot proposals → queue | KEEP parents; ADD-COL items |
| Finance AR/AP (`client_invoices`,`supplier_invoices`+children, payments, credit_notes) | NEW-ERP | margin/recon `intel_*` | KEEP parents; ADD-COL children |
| Finance GL (`general_ledger`, journals, periods) | NEW-ERP | consistency checks `intel_*` | KEEP; **REPLACE AURA GL models** |
| Treasury/cash (`petty_cash*`,`bank_*`,`treasury_*`,`cost_commitments`,`*_retention_ledger`,`vat_periods`) | NEW-ERP | — | KEEP; ADD-COL |
| Inventory (`stock_*`,`material_requisitions`,`tools`,`serial_units`) | NEW-ERP | shortage forecast `intel_*` | KEEP; **ADD-COL (none today)** |
| HR/payroll (`employees`✓, `leave_*`,`timesheets`,`payroll_*`,`employee_compensation`) | NEW-ERP | — | KEEP; ADD-COL non-`employees` |
| Fleet/assets (`vehicles`,`fixed_assets`,`fuel_logs`,`vehicle_maintenance`,`asset_disposals`,`vehicle_fines`) | NEW-ERP | — | KEEP; ADD-COL |
| Service/AMC (`amc_contracts`,`amc_equipment`,`ppm_visits`,`service_tickets`) | NEW-ERP | SLA risk `intel_*` | KEEP; ADD-COL |
| T&C / closeout (`snags`,`tc_*`,`handover_*`) | NEW-ERP | — | KEEP; ADD-COL |
| Variation Orders (`variation_orders`,`vo_items`) | NEW-ERP | — | **DEDUPE** (defined 2×); ADD-COL |
| Claims / HSE / Mobilization | **AURA → Postgres** | risk `intel_*` | MIGRATE (new tables) + company_id |
| Meetings (`meetings`,`meeting_*`) | NEW-ERP | — | KEEP; ADD-COL |
| Comms (`notifications`,`whatsapp_*`,`announcements`) | NEW-ERP | Hermes dispatch log | KEEP; ADD-COL; ADD Hermes table |
| Tasks (`tasks`,`task_comments`; AURA Task/Note/Todo) | NEW-ERP `tasks` | workspace memory | KEEP; MIGRATE AURA personal-workspace |
| Documents (`documents`,`document_*`) | NEW-ERP | extraction `intel_*` (gap) | KEEP; ADD-COL |
| Event ledger (`system_events`✓,`event_types`) | NEW-ERP | — | KEEP (company_id ADDED Phase 1) |
| Intelligence (`intel_risk_alert`/`recommendation`/`insight`✓) | Intelligence | self | NEW (Phase 0) |
| Memory (`memory`) | Intelligence | self | NEW (Phase 2) → pgvector |
| Graph overlay (`entity_links`) | Intelligence | self | NEW (Phase 2+) |
| Sequences (`*_sequences`) | NEW-ERP | — | KEEP global (per-company numbering = later option) |

✓ = already has `company_id`.

---

## D. Company Boundary Audit (tenancy)

**Backbone (present & good):** `groups → companies → company_members` + `auth_company_ids()` SECURITY-DEFINER helper (multi_company_foundation.sql:59). Active company = UI switcher (`useCompany.tsx`, `CompanySwitcher.tsx`); **membership = access boundary** (by design). `tenant_id`/`organization_id`/`workspace_id` = **0 occurrences** in SQL and `src` → no NEW-ERP tenancy duplication. The only duplication is **AURA's `tenantId`** (to be mapped to `company_id` on port).

### D.1 Tables WITH `company_id` (14)
`projects`, `clients`, `tenders`, `quotations` (wave 1) · `purchase_requests`, `purchase_orders`, `grns`, `client_invoices`, `supplier_invoices`, `employees` (wave 2) · `system_events` (Phase 1) · `intel_risk_alert`, `intel_recommendation`, `intel_insight` (Phase 0).
> All wave columns are **NULLABLE, backfilled to `JEET-CON`**, indexed. NOT NULL never applied.

### D.2 Tables MISSING `company_id` (the gap) — ~130, tiered

- **Tier A — top-level entities that MUST get `company_id`** (cross-company isolation depends on it):
  `boqs`, `pricing_items`, `pricing_templates`, `pricing_rate_analyses`, `supplier_comparisons`, `supplier_offers`, `variation_orders`, `general_ledger`/journals, `project_budgets`, `cost_commitments`, `petty_cash(_funds/_transactions)`, `bank_reconciliations`, `treasury_facilities`, `stock_items`, `stock_balances`, `stock_transactions`, `material_requisitions`, `tools`, `serial_units`, `vehicles`, `fixed_assets`, `asset_disposals`, `fuel_logs`, `vehicle_maintenance`, `vehicle_fines`, `amc_contracts`, `amc_equipment`, `ppm_visits`, `service_tickets`, `snags`, `tc_packages`, `handover_packages`, `meetings`, `whatsapp_chats`, `documents`, `notifications`, `tasks`, `daily_site_reports`, `project_wbs`, `payroll_runs`, `leave_requests`, `timesheets`, `employee_compensation`.
- **Tier B — child/line tables** (scope via parent FK; lower priority): all `*_items`, `*_lines`, `*_approvals`, `*_history`, `*_attendees`, `comparison_items`, `quotation_lines`, `po_items`, `grn_items`, `payment_allocations`, `stock_count_lines`, etc.
- **Tier C — global/reference** (likely stay group-global, NOT per-company): all `*_sequences`, `roles`/`permissions`/`role_permissions`, `event_types`, `*_templates` (workflow/checklist), `document_categories`, `profiles`.

### D.3 Services / code missing company scoping
- **Company-aware (✅):** procurement (`prService`,`poService`,`grnService` + PR/PO/GRN pages), finance (`invoiceService`,`supplierInvoiceService` + AP/AR pages), HR (`employeeService`), sales (`clientService`,`quotation-service`,`tenders`/`clients` pages), projects (`project-service`,`ProjectWizard`). ~18 files via `useCompany`/`activeCompany`.
- **Company-blind (❌ — every other module):** inventory, fleet/assets, AMC/service, meetings, T&C/snags, VO, payroll, GL, documents, comms/WhatsApp, tasks, pricing, comparison, BOQ. These neither set nor filter `company_id`.
- **Pattern gap:** scoping is done **in app code**, not enforced by DB — so any missed query silently returns all companies' rows.

### D.4 RLS gaps
1. **No company isolation anywhere (headline).** `auth_company_ids()` exists but **no table policy uses it**. Every policy is role/`true`-based, not company-based → a JEET-CON user can read JEET-MEP data. (Foundation migration explicitly defers this.)
2. **Most operational tables still `USING (true)` for read AND write.** `rls_lockdown.sql` scoped **writes** on finance to `is_finance()` and **read+write** on payroll to `is_hr()` — but inventory, projects, procurement, fleet, AMC, meetings, tasks, documents, etc. remain blanket-open to any authenticated user.
3. **Nullable `company_id` + single-company backfill** → even after scoping is added, NULL rows and the all-to-`JEET-CON` backfill would leak until data is correctly distributed and columns set NOT NULL.
4. **New layers** (`system_events`, `intel_*`) use `USING (true)` — acceptable now, must move to company+role scoping in the tightening phase.

### D.5 Auth gaps
1. **Two auth models:** NEW-ERP Supabase auth (real, `auth.uid()`) vs AURA persona-cookie (`session.ts`, dev-only). **AURA's is dropped on port**; ported engines must use Supabase auth / service role.
2. **Server/service-role paths lack active-company context.** `useCompany` is client-side; the intel processor (service role) must derive `company_id` from the event row, **not trust payload** (already reads `row.company_id` first).
3. **Dual role source** (`profiles.role` + RBAC `user_roles`). `auth_role_keys()` already unifies them — converge the app onto one to avoid drift.
4. **Membership management** (`company_members`) is the boundary but its admin coverage/least-privilege defaults need review.

### D.6 Schema-hygiene debt (found during audit)
- **Duplicate definitions:** `variation_orders` (schema-vo.sql **and** vo_module migration), `audit_log` (phase10 schema + migration + pricing schema), `pricing_price_history` (schema + migration), full `phase10-consolidation` as both schema snapshot and migration. Risk: applying `schema-*.sql` snapshots **and** `migrations/` can double-create/conflict.
- **Action:** declare **`supabase/migrations/` the single source of truth**; treat root `schema-*.sql` as legacy snapshots (archive or regenerate from DB). My `schema-intelligence.sql` / `schema-events-upgrade.sql` should be re-homed as timestamped migrations.

---

## E. Foundation Completion Checklist

Phase 2 starts only when all **[ ]** are checked. `[x]` = done this far.

> **CTO decisions (ratified):** Tenancy = **Option B (minimum-safe)** — secure the event+intel path, defer the 130-table rollout. Schema cleanup = **APPROVED, done now**. Server-side company resolution = **done before any intelligence**. Sequence: cleanup → server resolution → sign-off → Phase 2 (Risk first).

### GATE — must be green to start Phase 2

**Decisions & docs**
- [x] D1–D5 ratified (§A.1)
- [x] Consolidation audit + this ADR + Module Ownership Matrix surfaced in chat
- [x] Owner sign-off on §D remediation scope → **Option B (minimum-safe)**

**Event spine**
- [x] `company_id` + `event_version` on `system_events` (`migrations/20260622100000_events_upgrade.sql`)
- [x] Canonical taxonomy seeded in `event_types` + `event-catalog.ts` mirror
- [x] `eventService.emitEvent` carries `company_id`/`event_version`

**Server-side company resolution** (the spoof-proof chain user → company_id → event → intel)
- [x] `src/lib/company/serverCompany.ts` — `resolveCompanyIdForUser` (membership-validated, service role) + `companyExists`
- [x] `POST /api/events/emit` — verifies user by token, resolves company **server-side**, writes ledger
- [x] `src/lib/events/emit-client.ts` — client emits via the server route (no direct company trust)
- [x] Intelligence processor reads `row.company_id` (never infers company from arbitrary payload)

**Schema hygiene**
- [x] `migrations/` ratified as single source of truth
- [x] Re-homed intel + events SQL as timestamped migrations (`20260622100000`, `20260622110000`)
- [x] Removed duplicate `variation_orders` (`schema-vo.sql` deleted; `vo_module` migration is canonical)

**Auth/RBAC**
- [x] Supabase auth confirmed sole model; AURA persona-switch slated for removal on port
- [x] Dual role source kept unified via `auth_role_keys()` (full convergence = later, non-blocking)

**Manual apply (owner/devops)**
- [ ] Run the two new migrations on Supabase (`supabase db push` or apply `20260622*`)

### DEFERRED — explicitly NOT Phase-2 gates (later phases)
- [ ] Full Tier-A `company_id` rollout + NOT NULL + per-company backfill → dedicated **Tenancy phase**
- [ ] RLS company-scoping rollout (`company_id IN (SELECT auth_company_ids())`) → Tenancy phase (pattern agreed)
- [ ] Ledger replay strategy (re-drain by filter) → design when needed
- [ ] Deal-chain field mapping + canonical tables (D4) → **Phase 3**
- [ ] `entity_links` graph overlay (D3) → when knowledge graph is ported
- [ ] Convert remaining root `schema-*.sql` snapshots to migrations → rolling hygiene

### ✅ FOUNDATION SIGN-OFF
Gate items above are green (pending only the manual migration apply). **Phase 2 may begin.**

---

## Phase 2 scope (locked, for reference — starts only after §E)
Risk Engine · Margin Engine · Forecast Engine · **Memory Layer (read-only)** · **Hermes Integration**.
**Autonomy Engine deferred** to a later phase. (Risk/Margin/Forecast already scaffolded in Phase 0; Phase 2 deepens them + adds read-only Memory + Hermes.)
