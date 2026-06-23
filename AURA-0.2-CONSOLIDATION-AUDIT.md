# AURA 0.2 — Consolidation Audit & Target Architecture

> Inventory + classification of **AURA** (`Desktop/Aura`) and **NEW-ERP** (`Desktop/NEW-ERP`) to define the single, consolidated **Aura 0.2** system. **No code in this document — this is the plan that gates all further building.**

**Date:** 2026-06-22 · **Status:** Draft for sign-off · **Decision owner:** you

---

## 0. Method & confidence

- AURA classified from its **full Prisma schema** (1,809 lines, ~80 models), `src/lib` (~60 engines/services), and ~48 app routes — read directly.
- NEW-ERP classified from `supabase/*.sql` (~25 schemas), `src/services` (~100+ services), `src/components/layout/hubs.ts` (26 hubs = authoritative module map), and the UI kit — read directly.
- **Completeness ratings are structural** (schema + service + page present + wired into nav). I did *not* read all ~100 NEW-ERP services line-by-line. Ratings marked `~` are inferred and should be confirmed during each merge.

## 1. Executive thesis

| | AURA | NEW-ERP |
|---|---|---|
| **Identity** | The **brain** — intelligence & orchestration | The **body** — transactional core & ERP breadth |
| **Stack** | Next.js 15 · Prisma · **SQLite (dev)** | Next.js 16 · **Supabase/Postgres** · supabase-js |
| **Strength** | Event sourcing, AI engines, autonomy, RAG memory, knowledge graph, Hermes, workspace cognitive layer, **mature pre-contract deal-chain** | Finance (GL/AP/AR/treasury/VAT), full P2P, inventory, HR/payroll, fleet/assets, AMC/service, EVM/WBS, themed shell, RBAC, multi-company |
| **Weakness** | No back-office breadth; SQLite/in-proc bus not prod-grade; persona-switch (not real auth) | Thin AI (one finance agent + basic rules); no event-driven intelligence; no autonomy/memory/agents |
| **Verdict** | **Port its intelligence into NEW-ERP** | **Keep as the base & system of record** |

**Aura 0.2 = NEW-ERP shell + core (system of record) with AURA's intelligence & deal-chain ported on top as event-driven layers.** This was already started: the Intelligence layer scaffold (`intel_*` tables + risk/margin/forecast engines + event-processor + `/intelligence` hub) shipped on 2026-06-22.

---

## 2. Repository profiles

| Dimension | AURA | NEW-ERP |
|---|---|---|
| Framework | Next.js 15 (App Router, RSC) | Next.js 16 (App Router, RSC) |
| Data access | Prisma ORM | supabase-js (+ `supabaseAdmin` service role) |
| DB | SQLite dev → Postgres prod (JSON-as-TEXT) | Supabase Postgres (raw SQL migrations, RLS) |
| Events | `Event` model + **in-process bus** + replay engine | `system_events` ledger + `event_types` registry (Postgres, append-only, `processed_at`) |
| AuthZ | `rbac.ts` (RBAC+ABAC, approval limits) + cookie persona switch | `permissions/routeAccess.ts` + Supabase auth + RLS |
| Multi-tenant | `tenantId` on every model | `company_id` + CompanyProvider/Switcher (⚠ `system_events` lacks `company_id`) |
| UI | Custom pages, intelligence-first | `AppShell`/`AppSidebar`/`AppTopbar`, hub nav, theme (light/dark/compact), full UI kit |
| Nav model | Flat routes | **Hub-based** (`HUBS` → sidebar; sub-pages = `HubHeader` tabs) |
| Scale signal | ~80 models, ~60 lib engines, ~48 routes | ~25 SQL schemas, ~100+ services, 26 hubs, ~150+ pages |

---

## 3. MODULE MATRIX

Legend — **Class:** Complete / Partial / Duplicate / Obsolete · **Decision:** KEEP-NEW / KEEP-AURA / MERGE / REPLACE

| # | Module / Domain | AURA | NEW-ERP | Class | Decision | Rationale |
|---|---|---|---|---|---|---|
| 1 | **Shell / theme / nav** | basic | Complete | Duplicate | **KEEP-NEW** | NEW-ERP's AppShell/hub nav/theme is the chosen skin |
| 2 | **Auth / RBAC / multi-company** | RBAC+ABAC, persona cookie | Supabase auth + RLS + routeAccess | Duplicate | **MERGE** | Keep Supabase auth; port AURA ABAC approval-limit ceiling |
| 3 | **Event ledger** | Event + in-proc bus | system_events + registry | Duplicate | **MERGE** | Postgres ledger = store of record; port AURA bus/observer/replay semantics over it; add `company_id` |
| 4 | **Intelligence (Risk/Margin/Forecast)** | ai-engine, risk-engine, finance/*-engines | thin (`aiFinanceService`) | Partial→Complete | **KEEP-AURA** | Already seeded in 0.2 as `intel_*` + engines |
| 5 | **AI agents / observer** | agents (multi-agent board), observer | — | Complete | **KEEP-AURA** | Port as Intelligence-layer services |
| 6 | **Autonomy (rules + actions)** | rules-engine, autonomy-engine, action-registry, risk-engine, approval-matrix, autonomy-queue, modes | `rulesService` + `/admin/rules` (basic) | Duplicate | **MERGE** | Keep NEW-ERP rules UI/store; adopt AURA execution brain (modes/registry/matrix/queue) |
| 7 | **RAG memory / embeddings** | memory, embeddings (384-dim local; Voyage) | — | Complete | **KEEP-AURA** | Port; move vectors to **pgvector** for prod |
| 8 | **Knowledge graph** | knowledge-graph (staged, no UI) | — | Partial | **KEEP-AURA** | Port + build `/graph` UI later |
| 9 | **Hermes comms orchestration** | hermes + predictive engine | — | Complete | **KEEP-AURA** | Port over NEW-ERP comms/notification services |
| 10 | **Workspace cognitive layer** | workspace projection/memory/ai-engine (Today Brain), 8 tabs | `/workspace` (tasks/approvals/calendar/activity) | Duplicate | **MERGE** | Keep NEW-ERP workspace shell; port AURA "Chief of Staff" brain |
| 11 | **Pre-contract: Tender** | Tender suite + RFI + EventLog + lineage | schema-tenders + pages | Duplicate | **MERGE** | AURA deal-chain richer; persist on NEW-ERP Postgres |
| 12 | **Pre-contract: Bid decision** | BidEvaluation (7-criteria AI) | — | Complete | **KEEP-AURA** | Port |
| 13 | **Estimation / BOQ** | Estimation+BoqItem, estimation-service | schema-boq + boq-calculations/export | Duplicate | **MERGE** | Reconcile to one BOQ model |
| 14 | **Pricing engine** | PricingTemplate/Run/Line (full rate analysis), lock+revision | schema-pricing + pricing-service/engine | Duplicate | **MERGE** | AURA's rate-analysis model is richer → canonical; reuse NEW-ERP UI |
| 15 | **Quotation** | Quote/QuoteLine/EventLog (locked snapshot, versioned) | schema-quotation + quotation-service/pdf | Duplicate | **MERGE** | AURA's locked-snapshot semantics canonical |
| 16 | **Supplier comparison** | SupplierQuote, sourcing-service (AI score) | schema-comparison + comparison-* (scoring/margin/excel) | Duplicate | **MERGE** | NEW-ERP comparison deeper for procurement; add AURA AI scoring |
| 17 | **Sales contract → project handoff** | SalesContract + lineage + masterProjectCode | — | Complete | **KEEP-AURA** | Port deal-chain handoff |
| 18 | **CRM (leads/clients/opps)** | Lead/Client/Opportunity/Activity | sales hub (pipeline/clients/competitors/win-loss) | Duplicate | **MERGE** | Keep NEW-ERP sales UI; reconcile entities |
| 19 | **Projects — execution** | digital twin, lifecycle (17-stage), workstation, phase logs, closure | EVM, WBS, schedule, daily reports, snags, site records, resources, controls | Duplicate | **MERGE** | NEW-ERP execution = record; AURA lifecycle/twin/closure = overlay |
| 20 | **Procurement P2P** | procurement-service, autopilot | PR/RFQ/PO/GRN/3-way/payables/spend/savings (full) | Duplicate | **MERGE** | NEW-ERP P2P = record; AURA autopilot/sourcing = intelligence |
| 21 | **Finance — GL/AP/AR/treasury** | GLAccount/JournalEntry/JournalLine (basic) | GL, AP, AR, budget, treasury, VAT, bankRec, pettyCash, retention, commitments, executive | Duplicate | **KEEP-NEW** | NEW-ERP finance far deeper; **drop AURA GL** |
| 22 | **Finance — intelligence** | margin/reconciliation/consistency/pricing-truth engines | — | Complete | **KEEP-AURA** | Port as analysis layer over NEW-ERP finance |
| 23 | **Risk** | Risk model, risk-engine, risk-propagation | riskRegisterService + /projects/risks | Duplicate | **MERGE** | NEW-ERP register = record; AURA propagation = intelligence |
| 24 | **Variation Orders** | VariationOrder + gate + EventLog | schema-vo + vo* services (validation/approval/impact) | Duplicate | **MERGE** | Reconcile; NEW-ERP has impact services, AURA has gate discipline |
| 25 | **Claims (EOT/cost)** | Claim + EventLog + gate | — | Complete | **KEEP-AURA** | Port |
| 26 | **HSE (incident/permit/audit)** | Incident/WorkPermit/SafetyAudit + EventLog | ~partial (project site records) | Complete | **KEEP-AURA** | Port (verify NEW-ERP overlap) |
| 27 | **Mobilization (permits/readiness)** | Permit/ReadinessChecklistItem | — | Complete | **KEEP-AURA** | Port |
| 28 | **Inventory / warehouse** | — | stock, movements, count, weighted-avg, aging, dead-stock, forecast, GL | Complete | **KEEP-NEW** | AURA has none |
| 29 | **HR / payroll / timesheets** | Employee/Allocation (basic) | attendance, leave, gratuity (EOSB), SIF, payroll, competency, timesheet | Complete | **KEEP-NEW** | NEW-ERP far deeper; drop AURA workforce model |
| 30 | **Fleet / assets / tools** | — | vehicle, fuel, maintenance, fines, depreciation, disposal, fixed assets | Complete | **KEEP-NEW** | AURA has none |
| 31 | **Service / AMC / PPM** | — | SLA, tickets, AMC, billing, PPM schedule, warranty | Complete | **KEEP-NEW** | AURA has none |
| 32 | **Meetings** | (tasks only) | schema-meetings + scheduler/minutes/calendar-sync | Complete | **KEEP-NEW** | — |
| 33 | **Comms / notifications** | comms.ts, Notification, CommunicationLog | comms hub, notification/announcement/whatsapp/push services | Duplicate | **KEEP-NEW** + Hermes | NEW-ERP channels = transport; Hermes = routing brain |
| 34 | **Workflow engine** | workflow-engine, lifecycle-gate-engine | workflow/engine + `/admin/workflows` designer | Duplicate | **MERGE** | Keep NEW-ERP designer/UI; adopt AURA gate/lifecycle semantics |
| 35 | **Document management / intelligence** | TenderDocument.extractedJson (stub) | documents hub, document-service, offer-extraction (partial) | Partial | **MERGE** | Neither has real OCR/extract → **gap** |
| 36 | **Admin (forms/numbering/templates)** | — | form builder, numbering, templates, audit | Complete | **KEEP-NEW** | — |
| 37 | **Tasks / notes / todos** | Task/Note/Todo | taskService + tasks hub | Duplicate | **KEEP-NEW** | Reconcile to NEW-ERP task model |
| 38 | **News / marketing** | NewsPost/Campaign | (comms announcements) | Partial | **KEEP-AURA**→fold | Low priority; fold into comms |
| 39 | **Production microservices (NestJS/Kafka)** | `production/` scaffold | — | Obsolete (for 0.2) | **DEFER** | Revisit only at true multi-service scale |
| 40 | **Core orchestrator** | aura-core-orchestrator, system-state-resolver, event-replay-engine | — | Complete | **KEEP-AURA** | Port as Event/Intelligence backbone |

---

## 4. FEATURE MATRIX (overlap & critical capabilities)

| Capability | AURA | NEW-ERP | Target in 0.2 |
|---|---|---|---|
| Append-only event store | ✅ (Prisma) | ✅ (Postgres) | **NEW-ERP `system_events`** (+ `company_id`, versioned) |
| In-process pub/sub + wildcard subs | ✅ | ❌ | Port AURA bus as ledger dispatcher/processor |
| Event replay | ✅ event-replay-engine | ❌ | Port AURA |
| AI delay/cost/health prediction | ✅ ai-engine | ❌ | Port |
| Multi-agent reasoning board | ✅ agents | ❌ | Port |
| Autonomy modes (Observer→Operator) | ✅ | ❌ | Port |
| Action registry + risk classification + approval matrix + queue | ✅ | ❌ | Port |
| RAG semantic recall | ✅ memory/embeddings | ❌ | Port → **pgvector** |
| Knowledge graph traversal | ✅ (staged) | ❌ | Port + UI |
| Communication routing/escalation | ✅ Hermes | ❌ (channels only) | Port Hermes over NEW-ERP channels |
| Chief-of-Staff daily brief | ✅ Today Brain | ❌ | Port into NEW-ERP workspace |
| Locked-snapshot pricing + revision chain | ✅ | partial | **AURA model canonical** |
| 7-criteria bid/no-bid AI | ✅ | ❌ | Port |
| Deal-chain lineage (tender→project) | ✅ | ❌ | Port |
| EVM / SPI / CPI | partial (Project fields) | ✅ evmService | **NEW-ERP** + AURA forecast overlay |
| WBS / schedule / Gantt | ❌ | ✅ | KEEP-NEW |
| GL posting / journals | basic | ✅ deep | KEEP-NEW |
| VAT / treasury / bank rec | ❌ | ✅ | KEEP-NEW |
| 3-way match (PO/GRN/Invoice) | ❌ | ✅ | KEEP-NEW |
| Payroll (EOSB/SIF/gratuity) | ❌ | ✅ | KEEP-NEW |
| Depreciation / disposals | ❌ | ✅ | KEEP-NEW |
| OCR / document extraction | stub | partial | **GAP — build later** |
| Real auth / SSO | ❌ (persona) | ✅ Supabase | KEEP-NEW |

---

## 5. DATA MODEL MATRIX

**Convention shift:** AURA `tenantId` → NEW-ERP `company_id`/tenant hierarchy; AURA JSON-as-TEXT → Postgres `jsonb`.

| AURA model(s) | NEW-ERP table(s) | Class | Decision |
|---|---|---|---|
| `Event` | `system_events` + `event_types` | Duplicate | **REPLACE** AURA → use ledger (add `company_id`, `event_version`) |
| `AuraObject` + `ObjectLink` | (none — concrete tables) | Unique | **OVERLAY ONLY** — add `entity_links` for graph; do **not** retrofit core |
| `Project` | schema-projects + project services | Duplicate | **MERGE** — NEW-ERP columns + AURA lifecycle/twin fields |
| `Contract` (twin) / `SalesContract` | schema (contracts in projects/finance) | Duplicate/Unique | **MERGE**; keep AURA `SalesContract` deal-chain |
| `Vendor`,`MaterialRequest`,`PurchaseOrder`,`POItem` | schema-po-grn + procurement | Duplicate | **KEEP-NEW** (record) |
| `Invoice` | schema-finance (AP/AR) | Duplicate | **KEEP-NEW** |
| `GLAccount/JournalEntry/JournalLine` | schema-finance GL | Duplicate | **REPLACE** AURA → KEEP-NEW |
| `Risk` | riskRegister (schema) | Duplicate | **MERGE** |
| `WorkflowDefinition/Instance/Task` | workflow schema | Duplicate | **MERGE** (NEW-ERP store + AURA semantics) |
| `AIInsight` | `intel_insight` (new in 0.2) | Duplicate | **REPLACE** → `intel_*` family |
| `Tender*`,`BidEvaluation` | schema-tenders | Duplicate/Unique | **MERGE**; keep `BidEvaluation` |
| `Estimation/BoqItem` | schema-boq | Duplicate | **MERGE** |
| `PricingTemplate/Run/Line/EventLog` | schema-pricing | Duplicate | **MERGE** (AURA canonical) |
| `Quote/QuoteLine/EventLog/QuoteCommunication` | schema-quotation | Duplicate | **MERGE** (AURA canonical) |
| `SupplierQuote` | schema-comparison | Duplicate | **MERGE** |
| `VariationOrder*` | schema-vo | Duplicate | **MERGE** |
| `Claim*` | — | Unique | **KEEP-AURA** |
| `Incident/WorkPermit/SafetyAudit*`,`Permit/Readiness*` | ~partial | Unique | **KEEP-AURA** |
| `Employee/Allocation` | schema-hr | Duplicate | **REPLACE** AURA → KEEP-NEW |
| `Task/Note/Todo` | schema-tasks | Duplicate | **KEEP-NEW** |
| `Notification/CommunicationLog` | schema-notifications/whatsapp | Duplicate | **KEEP-NEW** |
| `HermesDispatch` | — | Unique | **KEEP-AURA** |
| `BusinessRule/AutonomousAction/AutonomyQueueItem` | rules (basic) | Duplicate/Unique | **MERGE** (keep AURA queue/action) |
| `Memory` | — | Unique | **KEEP-AURA** → pgvector |
| `WorkspaceMemory` | — | Unique | **KEEP-AURA** |
| `Setting` | settingsService store | Duplicate | **KEEP-NEW** |
| (none) | inventory/fleet/assets/AMC/service/payroll/meetings schemas | Unique | **KEEP-NEW** |

---

## 6. SERVICE MATRIX (logic layer)

| Concern | AURA `src/lib` | NEW-ERP `src/services`/`lib` | Decision |
|---|---|---|---|
| Object/graph | object-service, knowledge-graph | — | KEEP-AURA (overlay) |
| Events | events, event-replay-engine, core orchestrator | eventService | MERGE (AURA brain + NEW-ERP store) |
| Intelligence | ai-engine, agents, observer, risk-engine, finance/*, risk/* | aiFinanceService | KEEP-AURA |
| Autonomy | rules-engine, autonomy-engine, action-registry, approval-matrix, autonomy-queue | rulesService | MERGE |
| Memory | embeddings, memory | — | KEEP-AURA |
| Comms | comms, hermes, hermes-predictive | comms/notification/announcement/push/whatsapp | KEEP-NEW transport + KEEP-AURA Hermes |
| Workspace | workspace/* | taskService, kpiService | MERGE |
| Pre-contract | bid-engine, estimation, pricing, quote, tender, contract, closure | rfq, comparison-*, pricing-*, quotation-*, boq-* | MERGE (AURA canonical for pricing/quote/bid) |
| Procurement | procurement, sourcing | poApproval, poFromComparison, threeWayMatch, mrf, grn*, supplierPerformance | KEEP-NEW + AURA autopilot |
| Projects | project, workstation, mobilization, hse, claims, variation-order, lifecycle-gate, workflow-forecast | evm, wbs, dailySiteReport, snag, handover, siteRecords, resourcePlanning, riskRegister, tc | MERGE |
| Finance | finance/* (margin/reconciliation/consistency/pricing-truth) | budget, cashFlow, treasury, vat, bankReconciliation, retention, pettyCash, commitment*, executiveFinance, gl, grnExpense | KEEP-NEW + KEEP-AURA intelligence |
| Back-office | — | payroll, gratuity, sif, leave, attendance, timesheet, vehicle, fuel, maintenance, depreciation, disposal, amc, sla, ticket, ppm, warranty, stock*, warehouse | KEEP-NEW |
| Platform | rbac, session, settings, format, id, json | permissionService, settingsService, numberingService, logger, security/policy, audit | KEEP-NEW + port ABAC |

---

## 7. UI MATRIX

| Surface | AURA routes | NEW-ERP hub | Decision |
|---|---|---|---|
| Shell/nav/theme | flat | AppShell + 26 hubs | KEEP-NEW |
| Dashboard / CEO | `/` | `/dashboard`, `/workspace` | KEEP-NEW + AURA Today Brain |
| Intelligence | `/ai`,`/ai/board`,`/memory`,`/autonomy`,`/hermes`,`/events` | `/intelligence` (new in 0.2) | KEEP-AURA → consolidate under Intelligence hub |
| Workspace | `/workspace` (8 tabs) | `/workspace` (tabs) | MERGE |
| Pre-sales | `/tenders`,`/estimation`,`/pricing`,`/quotes`,`/contracts`,`/crm` | Sales hub (`/sales`,`/tenders`,`/quotations`) | MERGE (AURA depth into NEW-ERP hub) |
| Projects | `/projects`,`/projects/[id]/*` (twin) | Projects hub | MERGE |
| Procurement | `/procurement`,`/suppliers` | Procurement hub | KEEP-NEW + AURA |
| Finance | `/finance` | Finance hub (16 tabs) | KEEP-NEW + AURA AI tab |
| Workforce | `/workforce` | HR hub | KEEP-NEW |
| Inventory/Fleet/Service/AMC | — | hubs | KEEP-NEW |
| News/Marketing | `/news`,`/marketing` | comms | FOLD |

---

## 8. Gap analysis

### 8.1 Missing capabilities (neither, or thin in both)
- **Document Intelligence** — real OCR/extraction/classification (both stubbed). Highest-value gap.
- **pgvector** — memory currently JSON cosine in-process; won't scale.
- **Real-time event delivery at scale** — Kafka/queue (deferred; processor is fine near-term).
- **BIM / engineering** (Three.js/IFC) — planned, never built.
- **Mobile/field offline** — NEW-ERP has `offlineQueue` + camera (partial).
- **Cross-company consolidation reporting** (group-level rollups).

### 8.2 Overlapping capabilities (must dedup) — priority order
1. **Event system** (2 stores) → unify on `system_events`.
2. **Pre-contract** (tender/pricing/quote/comparison in both) → AURA model canonical, NEW-ERP UI.
3. **Workflow + rules** (2 engines) → NEW-ERP store/UI + AURA execution.
4. **Projects / procurement / risk / VO** (record in NEW-ERP, intelligence in AURA).
5. **Workspace / comms** (NEW-ERP surface + AURA brain).
6. **Tasks / CRM / finance-GL** (collapse to NEW-ERP).

### 8.3 Technical debt
- **AURA:** SQLite + JSON-as-TEXT; in-process bus won't survive serverless/multi-instance; persona-switch is not real auth; Prisma↔Supabase divergence.
- **NEW-ERP:** `system_events` has **no `company_id`** (multi-tenant leak risk); event emission not yet wired across all core mutations; raw-SQL migrations (no ORM migration safety net); RLS coverage per-table unverified; ~100 services may vary in pattern; deprecated bits (e.g. `TenderAssignment`).
- **Both:** two parallel implementations of events + pre-contract = duplicated truth.

### 8.4 Migration risks
| Risk | Severity | Mitigation |
|---|---|---|
| Porting AURA engines off Prisma → supabase-js | **High** | Thin repository layer; port read-only intelligence first (no core writes) |
| Pre-contract dedup (two live models + data) | **High** | Pick canonical tables; write one-time data reconciliation; freeze one path during cutover |
| Multi-tenancy unification (tenantId vs company_id + auth) | **High** | Define tenant→company hierarchy before any port; backfill `company_id` |
| Event emission coverage (intelligence starved without it) | Medium | Add emit calls per module as it's merged; the processor already drains the ledger |
| Breaking working NEW-ERP during port | Medium | Intelligence layer is additive/read-only; merges behind feature flags |
| RLS/security parity for new intel tables | Medium | Mirror existing RLS; service-role only for processor |
| Vector store swap (JSON→pgvector) | Low | Provider abstraction already exists in AURA `embeddings.ts` |

---

## 9. TARGET ARCHITECTURE — Aura 0.2

**One repo (NEW-ERP), one database (Supabase/Postgres), four layers. Strict dependency direction: Experience → Core → Event → Intelligence. Intelligence may read Core/Event but never writes Core.**

```
┌─────────────────────────────────────────────────────────────┐
│ EXPERIENCE  Next.js App Router · AppShell · hub nav · theme   │
│   + AURA workspace "Today Brain" · Intelligence hub           │
├─────────────────────────────────────────────────────────────┤
│ CORE (system of record, ACID)  NEW-ERP services + Postgres    │
│   Finance · P2P · Inventory · HR/Payroll · Fleet · AMC ·      │
│   Projects(exec) · Pre-contract(canonical) · RBAC/RLS/company │
│   → every mutation EMITS an event                             │
├─────────────────────────────────────────────────────────────┤
│ EVENT  system_events ledger (+company_id, versioned)          │
│   + dispatcher/observer/replay (ported from AURA bus)         │
├─────────────────────────────────────────────────────────────┤
│ INTELLIGENCE (read-only on Core/Event; writes only intel_*)   │
│   Risk/Margin/Forecast engines · agents · autonomy(modes/     │
│   registry/matrix/queue) · RAG memory(pgvector) · knowledge   │
│   graph · Hermes routing · finance/risk intelligence          │
└─────────────────────────────────────────────────────────────┘
```

**Decided defaults (override if you disagree):**
- **DB/ORM:** single Postgres; **supabase-js is the standard data access**. Prisma retired; AURA engines ported through a thin repository module. *(Open decision #1.)*
- **Universal Object Model:** adopt as a **graph overlay** (`entity_links`) + event/lifecycle patterns — do **not** retrofit concrete core tables. *(Open decision #2.)*
- **Pre-contract canonical owner:** **AURA's deal-chain model** (Pricing/Quote/SalesContract/Bid + lineage) persisted on Postgres; NEW-ERP comparison/3-way kept for procurement. *(Open decision #3.)*
- **Multi-tenancy:** unify on `tenant → company` hierarchy; backfill `company_id` everywhere incl. `system_events`. *(Open decision #4.)*
- **Auth:** Supabase auth only; persona-switch dropped.
- **Boundary rule (enforced):** intelligence engines are pure + read-only on core; only the event-processor writes `intel_*` and stamps the ledger.

---

## 10. CONSOLIDATION PLAN (sequenced — no code until each phase is approved)

| Phase | Goal | Key work | Risk |
|---|---|---|---|
| **0 — done** | Intelligence scaffold | `intel_*` tables, risk/margin/forecast engines, processor, `/intelligence` hub | — |
| **1 — Foundation** | Make the spine consolidatable | Add `company_id` + `event_version` to `system_events`; define canonical **event taxonomy**; unify tenant/company + auth; decide ORM | High |
| **2 — Intelligence port (read-only)** | Move AURA brain in safely | Port autonomy(modes/registry/matrix/queue), memory→pgvector, Hermes, agents, observer as Intelligence services reading the ledger | Medium |
| **3 — Event emission** | Feed the brain | Wire core mutations (PO, invoice, project status, quote, tender…) to emit to ledger | Medium |
| **4 — Pre-contract merge** | Kill the biggest duplicate | Choose canonical tender/pricing/quote/contract tables; migrate data; retire NEW-ERP or AURA path | High |
| **5 — Domain overlays** | Layer intelligence on records | Projects(twin/lifecycle/closure), procurement(autopilot), finance(margin/reconciliation), risk(propagation), VO/claims/HSE | Medium |
| **6 — Experience** | Surface the brain | Port Today Brain + Hermes UI into NEW-ERP shell; consolidate AURA intel routes under Intelligence hub | Low |
| **7 — Gaps & hardening** | Production-grade | Document Intelligence (OCR), RLS audit, perf, group consolidation reporting | Medium |

---

## 11. OPEN DECISIONS (need your call before Phase 1)

1. **ORM strategy** — supabase-js everywhere *(recommended)* / introduce Prisma over Supabase / coexist.
2. **Universal Object Model** — graph overlay only *(recommended)* / retrofit core *(high risk)* / drop entirely.
3. **Pre-contract canonical owner** — AURA deal-chain model *(recommended)* / NEW-ERP existing tables / hand-picked hybrid.
4. **Multi-tenancy** — confirm `tenant → company` hierarchy and `company_id` backfill scope.
5. **Confirm base** — NEW-ERP repo is the single home for Aura 0.2 *(assumed)*.
```
