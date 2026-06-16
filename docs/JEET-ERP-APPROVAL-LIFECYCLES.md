# JEET ERP — Document Approval Lifecycles (who drafts → revises → approves)

How every key document moves through its stages and **which role may perform each
transition**. Built from the live workflow engine (`workflow_definitions /
_statuses / _transitions`, seeded in `seed_default_workflows`) plus the
service-level status logic.

**How it's enforced:** each transition row carries `allowed_roles`, an
`approval_mode` (NONE / SINGLE), optional named `approvers`, and an `sla_hours`.
The reusable **`WorkflowPanel`** on a record's page shows only the transitions the
**current user's role** is allowed to fire; `workflowService.executeTransition`
re-checks the role and advances the status (writing to `workflow_instances.history`
and surfacing pending items + SLA breaches in *Admin → Workflow Analytics* and
*My Workspace → Approvals*).

> `admin` may perform every transition (omitted below for brevity). Where a role
> list is `[]`, anyone with access to the record may fire it (e.g. "submit").

## Roles (hierarchy)
`admin` (L10) · `gm` General Manager (L20) · `commercial_mgr` Commercial Manager
(L30) · `pm` Project Manager (L40) · `accountant` (L50) · `hr` HR Manager (L60) ·
`coordinator` Service Coordinator (L70) · `procurement` Procurement Officer (L80) ·
`estimator` (L80) · `fleet_coordinator` / `storekeeper` (L90) · `site_eng` Site
Engineer / `technician` Field Technician (L100) · `viewer` Auditor (L200).

---

## A. Engine-enforced workflows (9) — exact, from the seed

### 1. Tender `TND` — Tender Lifecycle  *(simplified — `20260616210000`)*
**Draft (Estimator)** → **Engineer Revision (Site Engineer)** → **Manager Approval (Manager)** → **Approved to Bid → Bid Submitted → Awarded / Lost**

| Stage | → action | Allowed roles | SLA |
|-------|----------|---------------|-----|
| DRAFT | SUBMIT_REVISION | anyone | — |
| ENGINEER_REVISION | SUBMIT_APPROVAL | engineer · site_eng · estimator | 48h |
| ENGINEER_REVISION | REVISION_RETURN → Draft | engineer · site_eng · manager | — |
| PENDING_APPROVAL | APPROVE *(SINGLE: manager)* | manager · gm | 48h |
| PENDING_APPROVAL | REJECT → Draft | manager · gm | — |
| APPROVED | SUBMIT_BID | anyone | — |
| SUBMITTED | AWARD / LOSE | anyone | — |

### 1b. BOQ `BOQ` — BOQ Approval  *(new — `20260616210000`)*
**Draft (Estimator / Engineer)** → **Procurement Cost Review (Procurement)** → **Commercial Approval (Commercial Mgr / Manager)** → **Approved → Linked to Quotation**

| Stage | → action | Allowed roles | SLA |
|-------|----------|---------------|-----|
| DRAFT | SUBMIT_REVIEW | estimator · engineer · site_eng | — |
| COST_REVIEW | COST_APPROVE *(SINGLE: procurement)* | procurement · manager | 48h |
| COST_REVIEW | COST_RETURN → Draft | procurement · manager | — |
| PENDING_APPROVAL | APPROVE *(SINGLE: commercial_mgr)* | commercial_mgr · manager · gm | 48h |
| PENDING_APPROVAL | REJECT | commercial_mgr · manager | — |
| REJECTED | REVISE → Draft | estimator · engineer · site_eng | — |
| APPROVED | LINK_QUOTE → Quotation | estimator · commercial_mgr · manager | — |

### 2. Quotation `QTN` — Quotation Approval
**Draft (estimator)** → **Commercial Review (Commercial Manager)** → **GM Approval (General Manager)** → **Approved → Sent → Client Accept/Reject**

| Stage | → action | Allowed roles | SLA |
|-------|----------|---------------|-----|
| DRAFT | SUBMIT | anyone | — |
| PENDING_COMMERCIAL | COMMERCIAL_APPROVE *(SINGLE: commercial_mgr)* | commercial_mgr · manager | 48h |
| PENDING_COMMERCIAL | RETURN → Draft | commercial_mgr · manager | — |
| PENDING_GM | GM_APPROVE *(SINGLE: gm)* | gm · manager | 48h |
| PENDING_GM | GM_RETURN → Draft | gm · manager | — |
| APPROVED → SENT → ACCEPTED/REJECTED | SEND / CLIENT_ACCEPT / CLIENT_REJECT | anyone | — |

### 3. Variation Order `VO` — Variation Order Approval
**Draft (PM / Site Engineer)** → **Internal Approval (General Manager)** → **Awaiting Client** → **Client Approved → Closed (Manager / GM)**

| Stage | → action | Allowed roles | SLA |
|-------|----------|---------------|-----|
| DRAFT | SUBMIT | anyone | — |
| PENDING_INTERNAL | APPROVE *(SINGLE: gm)* → send to client | gm · manager | 72h |
| PENDING_INTERNAL | REJECT | gm · manager | — |
| PENDING_CLIENT | CLIENT_APPROVE / CLIENT_REJECT | anyone | — |
| REJECTED | REVISE → Draft | anyone | — |
| CLIENT_APPROVED | CLOSE | manager · gm | — |

### 4. Client Invoice `INV` — Client Invoice Approval (AR)
**Draft (Accountant)** → **Finance Approval (Accountant)** → **Approved → Sent → Paid** *(or Written-off by GM)*

| Stage | → action | Allowed roles | SLA |
|-------|----------|---------------|-----|
| DRAFT | SUBMIT | anyone | — |
| PENDING_APPROVAL | APPROVE *(SINGLE: account)* | account · manager · gm | 48h |
| PENDING_APPROVAL | RETURN → Draft | account · manager · gm | — |
| APPROVED | SEND | account | — |
| SENT | MARK_PAID | account | — |
| SENT | WRITE_OFF | gm | — |

### 5. Goods Receipt `GRN` — Goods Receipt Inspection
**Received** → **Under Inspection (Storekeeper / Site Engineer)** → **Accepted / Partial-return → Closed (Storekeeper / Manager)**

| Stage | → action | Allowed roles | SLA |
|-------|----------|---------------|-----|
| RECEIVED | INSPECT | storekeeper · engineer · manager | 24h |
| UNDER_INSPECTION | ACCEPT / FLAG_RETURNS | storekeeper · engineer · manager | — |
| ACCEPTED / PARTIAL_RETURN | CLOSE / CLOSE_RETURNS | storekeeper · manager | — |

### 6. Project `PRJ` — Project Delivery Phases
**Mobilization** → **In Progress (PM / Site Engineer)** → **Testing & Comm.** → **Handover (Manager approval)** → **DLP** → **Closed (GM)**

| Stage | → action | Allowed roles |
|-------|----------|---------------|
| MOBILIZATION | START_WORKS | manager · pm · engineer |
| IN_PROGRESS | START_TC | manager · pm · engineer |
| TESTING | HANDOVER *(SINGLE: manager)* | manager · pm |
| HANDOVER | ENTER_DLP | manager · pm |
| DLP | CLOSE | manager · gm |
| IN_PROGRESS ↔ ON_HOLD | HOLD / RESUME | manager · gm |

### 7. Service Ticket `SERVICE_REQ` — Service Ticket Flow
**New** → **Assigned (Coordinator / Manager)** → **In Progress (Technician)** → **Resolved → Closed (Manager)**

| Stage | → action | Allowed roles | SLA |
|-------|----------|---------------|-----|
| NEW | ASSIGN | manager · engineer (coordinator) | 4h |
| ASSIGNED | START | anyone | 8h |
| IN_PROGRESS ↔ ON_HOLD | HOLD / RESUME (parts) | anyone | — |
| IN_PROGRESS | RESOLVE | anyone | 48h |
| RESOLVED | CLOSE / REOPEN | manager (close) | — |

### 8. Leave Request `LEAVE` — Leave Request Approval
**Submitted (Employee)** → **Manager Review (Manager)** → **HR Confirmation (HR Manager)** → **Approved** *(reject at any stage)*

| Stage | → action | Allowed roles | SLA |
|-------|----------|---------------|-----|
| SUBMITTED | ROUTE → Manager | anyone | 24h |
| MANAGER_REVIEW | MANAGER_APPROVE *(SINGLE: manager)* | manager · gm | 48h |
| MANAGER_REVIEW | MANAGER_REJECT | manager · gm | — |
| HR_REVIEW | HR_CONFIRM | hr · manager | 24h |
| HR_REVIEW | HR_REJECT | hr · manager | — |

---

## B. Service-level chains (status logic, not yet in the workflow engine)

These advance through services rather than the seeded engine; the role column is
the **operating convention** (enforced in-app, not all DB-enforced yet).

| Document | Lifecycle (draft → … → approve) | Roles |
|----------|--------------------------------|-------|
| **Purchase Request (PR)** | DRAFT → Submit → **APPROVED** / Rejected | drafted by Site Engineer/Procurement → approved by **PM / Manager** |
| **Purchase Order (PO)** | DRAFT → Submit → PENDING_APPROVAL → **APPROVED** | drafted by **Procurement** → approval gated by `has_permission()` RPC, **threshold-based** → Manager / GM for high value |
| **Supplier Invoice (AP)** | DRAFT *(expected from PO)* → REGISTERED → **3-way match** → PAID | registered by **Accountant / Procurement**; match exceptions need override |
| **Snag / NCR** | OPEN → IN_PROGRESS → CLOSED → **VERIFIED** | raised by **Site Engineer / QA** → fixed by Engineer → **verified by PM** |
| **Testing & Commissioning** | Package → EXECUTE *(calibrated tool gate)* → WITNESS → PASS/FAIL→snag | executed by **Technician / Site Engineer** → witnessed by **Client / Consultant** |
| **Payroll Run** | DRAFT → Calculated → **APPROVED** → SIF/WPS → Paid | prepared by **Accountant / HR** → approved by **GM** |

*(BOQ is now an engine-enforced workflow — see §1b above. WorkflowPanel is wired
onto the BOQ workspace page and the Tender detail page.)*

---

## How to change any of these
All of section A is **data, not code** — edit it in **Admin → Workflow Designer**
(`/admin/workflows`): add/rename statuses, re-wire transitions, change the
`allowed_roles`, approval mode, named approvers, or SLA per step. No deployment
needed; `NOTIFY pgrst` refreshes the API. Section B items become engine-enforced
once a workflow is seeded for them and the service calls `executeTransition`.
