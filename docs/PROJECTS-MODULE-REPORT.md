# JEET ERP — Projects Module — Full Report

Delivery/execution module for UAE ELV/MEP projects: from quotation-won →
mobilization → execution → handover → DLP. Stack: Next.js App Router → React
hooks → services → Supabase (RLS). Currency AED, en-AE. Integrates with Finance
(AR billing, commitments, budget, profitability, cash flow) and Documents.

---

## 1. Pages

| Page | Route | Purpose |
|---|---|---|
| Project registry | `/projects` | List/search/filter all projects (status, type, client), KPIs |
| New (from quotation) | `/projects/new/[quotationId]` | Spin up a project from an accepted quotation (imports contract value, BOQ, client) |
| New (blank) | `/projects/new` | Manual project creation |
| Project detail | `/projects/[id]` | Tabbed workspace (below) |

**Detail tabs:** Overview · Documents · Commercials/Finance · Variation Orders ·
Milestones · Team · Compliance · Activity — plus a configurable **WorkflowPanel** (`PRJ`).

---

## 2. Data model

- **`projects`** — number, name, client, site (address/emirate/makani), `project_type`,
  `systems[]`, links (`tender_id`/`boq_id`/`quotation_id`), **contract_value** /
  original / `budget_cost`, client LPO no+date, **payment_terms / retention_pct /
  advance_pct / dlp_months**, dates (start / planned_end / actual_end / dlp_start /
  dlp_end), **project_manager_id / site_engineer_id**, status lifecycle
  (MOBILIZATION → … → ON_HOLD/CANCELLED), on-hold/cancel reasons, SIRA flag,
  consultant / main-contractor, tags, soft-delete.
- **`project_milestones`** — title, description, **planned_date / actual_date**,
  status (PENDING/DONE/DELAYED), **payment_linked + payment_pct**, sort_order.
- **`project_contacts`** — client/consultant/contractor contacts per project.
- **`project_status_history`** — status transition audit.
- **`project_number_sequences`** — JI-PRJ-YYYY-NNN numbering.

---

## 3. Services & key functions

- **projectFinancialsService.computeProjectFinancials** — contract, budget,
  committed, actual, billed, collected, realized & projected margin, FAC, margin-erosion flag.
- **commitmentService.getProjectCostCommitments** — committed cost by system vs budget.
- **projectCashFlowService.getProjectCashFlow** — per-project monthly in/out + cumulative.
- **projectDocumentService** — document register (tender, BOQ, quotations, LPOs, invoices, files).
- **snagService** — `getSnagsByProject`, `createSnag`, `updateSnag`, `transitionSnagStatus`
  (workflow), `checkAndEmitAllClosedEvent`. + `snagExportService`.
- **visitService** — PPM/site visits: schedule, start, checklist templates per system,
  save checklist result, complete. + `visitReportPDFService`.
- **walkthroughService.logWalkthrough** — site walkthroughs.
- **handoverService** — `getHandoverPackage`, `initializeHandoverPackage`,
  `checkGateStatus` (handover gates), `updateChecklistItemStatus`, `submitHandoverSignOff`.
  + `handoverCertPDFService`.
- **taskService** — tasks + comments + `fetchWorkloadAnalytics`.

---

## 4. Business logic & workflow

- **Quotation → Project**: accepted quotation seeds contract value, BOQ link, client,
  contract terms; project number auto-assigned.
- **Status lifecycle**: MOBILIZATION → EXECUTION → … → HANDOVER → DLP → CLOSED, with
  ON_HOLD (reason + expected resume) and CANCELLED (reason); transitions logged to
  `project_status_history`; configurable approvals via the `PRJ` workflow.
- **Milestones**: payment-linked milestones (payment_pct) feed **AR progress billing**
  (`/finance/ar/from-phases`) and the 13-week cash-flow forecast.
- **Commercials**: VO tab (variation orders adjust revised contract value); finance tab
  shows commitments, budget vs actual, margin (via finance services).
- **Handover**: gated checklist (snags closed, docs complete) → sign-off → DLP start;
  certificate PDF.
- **Snags**: per-project defect log with a status workflow; export; "all closed" event.
- **Compliance**: NOCs / SIRA / permits tracked on the Compliance tab.

---

## 5. Integrations
Finance (AR billing from milestones, commitments, budget, profitability, project
cash flow), Documents (register + DMS upload), Procurement (LPOs/commitments per
project), HR/Payroll (labour cost allocation by project), Events/notifications.

---

## 6. Known gaps (addressed in the enterprise roadmap)
- No **Gantt / schedule** (milestones are a flat list, no dependencies/critical path).
- No **% progress / earned-value (EVM)** tracking (planned vs earned vs actual).
- No **resource / manpower planning** (who's on which project, utilization).
- No **daily site report (DSR)** capture (manpower, weather, work done, photos).
- No **risk register** per project.
- No **project executive dashboard** (portfolio health, schedule + cost together).
- Potential PostgREST **embed 400s** to audit (same pattern fixed in finance).
- **Audit logging** not wired on all project write paths.

See `PROJECTS-ENTERPRISE-ROADMAP.md`.
