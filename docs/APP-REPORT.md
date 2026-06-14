# JEET ERP — Full Application Report

_Generated: 2026-06-14 · Branch: `feature-update`_

A full-scope **Enterprise Resource Planning** system for a UAE-based ELV / MEP /
security-systems contractor (JEET INTECH L.L.C). It covers the complete business
lifecycle: tendering → estimation → quotation → procurement → project delivery →
field service → finance → HR/payroll → fleet/assets — on top of a no-code
**Administration Platform** (workflows, forms, rules, numbering, document
templates) that lets admins reconfigure the system without code changes.

---

## 1. At a glance

| Metric | Value |
|---|---|
| App routes (pages) | ~121 |
| Service modules (`src/services`) | 90 |
| Domain libraries (`src/lib`) | 31 |
| React hooks (`src/hooks`) | 45 |
| Shared components | 45 |
| SQL schema files | 22 |
| Migrations | 15 |
| TypeScript LOC | ~110,000 |
| Currency / locale | AED · en-AE |

---

## 2. Technology stack

| Layer | Technology |
|---|---|
| Framework | **Next.js 16.2.7** (App Router, Turbopack), **React 19.2** |
| Language | TypeScript (strict) |
| Backend / DB | **Supabase** (PostgreSQL + Auth + Storage + Edge Functions + Realtime) |
| Data access | `@supabase/supabase-js`, RLS-secured tables, atomic RPCs |
| Styling | Tailwind CSS v4 + CSS variables (dark/light theming) |
| Tables | TanStack Table v8 |
| Charts | Recharts |
| Forms / validation | React Hook Form + Zod v4 |
| PDF | jsPDF + jspdf-autotable, @fileforge/react-print |
| Excel | xlsx |
| Icons | lucide-react |
| AI (optional) | Gemini (document/offer extraction) — degrades to manual when unconfigured |

**Architecture:** client pages → custom hooks → service layer (`src/services`,
`src/lib`) → Supabase. Business logic lives in pure, testable service/lib
functions; the workflow engine (`src/lib/workflow/engine.ts`) is side-effect-free.
Auth is per-page (`supabase.auth.getUser()`), with RBAC via `roles` /
`user_roles` / `permissions` and a `Can` permission gate.

---

## 3. Functional modules

### Sales & Pre-award
- **Tenders & Bid Management** — register tenders, attach documents (real
  Supabase Storage uploads), status workflow, **PDF export**, budget auto-filled
  from the linked BOQ, BOQ status + awarded-project links.
- **BOQ (Bill of Quantities) workspace** — 38-column estimator across 12 cost
  groups (supply, detailed technician/engineer/PM labour, subcontract, equipment,
  logistics, wastage, risk, overhead, profit, selling). Excel-style keyboard
  nav, frozen columns, pinned totals, **Simple/Detailed view toggle**, Master
  Rate Catalogue autocomplete (code or description) with **price intelligence**
  (last quoted price/client, market-avg placeholder).
- **Quotations** — build from BOQ, multi-stage approval (commercial → GM),
  revisions, **PDF**, **send-to-client email composer** (mailto + PDF attach),
  accept with **client LPO/contract upload**, link to existing project.

### Procurement & Supply
- **Requests for Quotation (RFQ)** — from any BOQ, draft a sourcing request:
  items prefilled from the BOQ and **fully editable**, multi-select
  suppliers/subcontractors, cover message + quote-by date. **Records to an RFQ
  log**, **exports a PDF** (suppliers asked + item table with blank price
  columns), and **opens a pre-filled email** (BCC) ready to send. Next step: an
  AI agent reads supplier email replies against each RFQ and suggests prices,
  feeding the comparison.
- **Purchase Requests (PR)** — raise with/without a project (tools, IT,
  furniture, consumables, samples = overhead), category, **mode of payment**,
  item grid with estimated costs, lifecycle (Draft→Submit→Approve/Reject),
  **PDF export + view**, **direct purchase** (no LPO) under a configurable
  threshold, or **convert to LPO**.
- **Supplier Comparisons** — multi-supplier offer grid, scoring (price /
  delivery / history / payment / compliance weights), per-item selection,
  **add/rename/remove supplier columns** (with auto-register into the supplier
  module), **procurement exception flag** with justification, approval chain,
  AI offer extraction (optional), Excel/PDF export.
- **Purchase Orders (LPO)** — manual or generated from a comparison (imports
  supplier + items + values), from a PR, or standalone; **mode of payment**,
  configurable comparison-justification threshold, approval workflow,
  **supplier proforma invoice** attach/upload/export, PDF, project commitment
  tracking with budget-overrun warnings.
- **Goods Receipt (GRN) & Returns** — receive against an LPO with per-item
  qty/rejection + photos, **delivery note** capture, **GRN receipt PDF
  download**. Receiving to **STORE auto-moves goods into inventory** — the RPC
  resolves the destination store and posts stock per catalogue line, no manual
  toggle. **GRN Receivables** view: consolidated items-to-receive across all
  open LPOs/PRs with project, delivery status and payment status; per-line
  **receive** and **cancel** (cascades to the LPO/PR). **GRN-to-Expense** report
  ties received value to supplier invoicing and payment.

### Warehouse & Inventory
- **Suppliers & Subcontractors** registry — register/manage, **subcontractor
  fields** (type, trade, day rate), **historic performance scoring** from PO
  history, **scorecard** detail page with PO-by-PO history.
- **Store** — stock items + balances across locations, valuation, **stock-risk**
  (out / below reorder), register stock items, manage locations.
- **Goods Movements** — receipts, issues to project/ticket, returns, transfers,
  adjustments, write-offs; **period filter (week/month/year)** + **CSV export**.
- **Pricing Catalogue** — master rate catalogue feeding BOQ/quotations;
  **price auto-update from supplier invoices** + price-history trail; freshness
  indicator showing when a rate was last refreshed.

### Projects & Delivery
- **Projects** — created from accepted quotation (budget/target cost imported
  from BOQ), Kanban, milestones, team, compliance NOCs, financials/commitments,
  activity stream, **Document Register** (traces tender, BOQ, all linked
  quotations, comparisons, LPOs, proformas, GRNs, invoices, files to the
  project), duplicate-project prevention + associate-quotation-to-project.
- **Variation Orders (VO)**, **Snag List** (photo capture), **Testing &
  Commissioning**, **Handover**.

### Field Operations
- **Service Desk / Tickets** (SLA tracking), **PPM Schedule**, **AMC Contracts**
  (billing, renewal pipeline), **Technician Hub**.

### Finance
- **AR** (client invoices, payments, aging, statements), **AP** (register,
  schedule, 3-way match, aging), **Cash Flow** forecast, **VAT Compliance**.

### HR / Payroll / Fleet / Assets
- **HR** (employees, compliance, approvals, calendar), **Payroll** (SIF, EOSB,
  settlement), **Timesheets**, **Fleet** (registry, fines), **Fixed Assets**
  (depreciation).

### Core & Comms
- **Dashboard** (executive KPI cockpit), **My Day**, **Tasks** (Kanban),
  **Meetings** (minutes, action tracking), **Notifications**, **Documents**
  (DMS, review queue, expiry alerts), **Reports**, **WhatsApp**.

---

## 4. Administration Platform (no-code engine)

`/admin` — configure the ERP without code:

| Area | Capability |
|---|---|
| **Users, Roles & Permissions** | RBAC: custom roles, module/action permissions, scopes (ALL/TEAM/ASSIGNED/OWN), per-user permission auditor |
| **Sessions & Access** | Last sign-in, force sign-out, ban/unban (server-side admin API) |
| **Workflow Builder** | Visual status pipeline per module: statuses, transitions, role gating, **approval matrix** (single/sequential/parallel + min-N), conditions, SLA, escalation, analytics |
| **Business Rules** | IF/THEN rules (require approval, notify, escalate, block, set field) per module/trigger |
| **Document Numbering** | Configurable formats per module (e.g. `MAR-2026-0001`), atomic race-safe RPC, period reset |
| **Forms Builder** | Tabs → sections → 15 field types, conditional visibility, validation; rendered by `DynamicForm` |
| **Document Templates** | Header/logo/QR, HTML body with `{{variables}}`, footer, watermark, signatures, live preview |
| **Global Settings** | Company, finance/VAT, procurement thresholds, SLA, integrations, security, backup |
| **Audit Log** | Immutable forensic trail (who/what/when, before/after) with diff inspector |

Engine: `src/lib/workflow/engine.ts` (pure), `workflowService`, `rulesService`,
`numberingService`, `formBuilderService`, `templateService`. Modules consume
config via `<WorkflowPanel>` (wired into PO, Quotation, VO, GRN, Invoice,
Tender, Service Desk, Project), `useWorkflow`, and `DynamicForm`.

---

## 5. Data model highlights

- **Identity/RBAC:** `profiles`, `roles`, `user_roles`, `permissions`,
  `role_permissions`.
- **Sales:** `tenders`, `tender_documents`, `boqs`, `quotations`,
  `quotation_lines`, `clients`.
- **Procurement:** `supplier_comparisons`, `comparison_items`,
  `supplier_offers`, `purchase_requests`, `purchase_request_items`,
  `purchase_orders`, `po_items`, `po_approvals`, `grns`, `grn_items`,
  `grn_returns`, `pricing_items`, `pricing_suppliers`, `pricing_price_history`.
- **Inventory:** `stock_locations`, `stock_items`, `stock_balances`,
  `stock_transactions`, `material_requisitions`, `tools`.
- **Projects:** `projects`, `project_status_history`, milestones, VOs.
- **Finance:** `client_invoices`, `client_payments`, `supplier_invoices`,
  `vat_periods`.
- **Platform:** `workflow_definitions/statuses/transitions/instances`,
  `business_rules`, `numbering_rules`, `form_definitions`, `document_templates`,
  `settings`, `audit_log`, `event_types`, `system_events`, `notification_rules`.

**Numbering** is generated atomically (`generate_document_number` RPC + the
quotation/comparison/PO triggers). **Document lineage** converges on the
project: each document links to exactly one owning project.

---

## 6. Integrations & cross-module automation

- **Auto-register suppliers** — names entered in comparisons/LPOs are
  find-or-created in the supplier registry (and scored).
- **Price write-back** — supplier-invoice line prices refresh the pricing
  catalogue (`priceUpdateService`) with history.
- **Comparison → LPO** — generate split LPOs per supplier (items, prices,
  contacts, proforma attach).
- **PR → LPO / direct purchase** — approved PRs convert to LPOs (pre-filled +
  linked) or are purchased directly under the configurable threshold.
- **GRN → stock (automatic)** — receipting to STORE auto-routes goods into
  inventory: the RPC resolves the destination store itself (first active
  MAIN/SUB store) and posts a `GRN_RECEIPT` transaction per catalogue line, no
  manual stock-item toggle required. Non-catalogue lines are skipped, not failed.
- **GRN → expense** — received value (qty × PO price) is reconciled against
  supplier invoices and payments in the **GRN-to-Expense** finance report.
- **Quotation → project** — budget/target cost imported from BOQ; lineage tracked.
- **Event bus** — `system_events` + `event_types` drive notifications.

---

## 7. Reports & exports

PDF: Tender, Quotation, Purchase Request, Goods Receipt Note, Comparison, BOQ.
Excel/CSV: Comparison, BOQ, Goods Movements log (by week/month/year),
**GRN-to-Expense** (received vs invoiced vs paid by project/period).
Document templates engine renders any configured PDF with live variables.

**GRN-to-Expense report** (`/finance/grn-expense`) — per-project received value
(receipted qty × PO price) reconciled against supplier invoices and payments,
filterable by month/quarter/year/all, surfacing **uninvoiced** (received but not
yet billed) and **outstanding** (invoiced not yet paid) balances, with CSV export.

---

## 8. Security

- Supabase Auth; per-page auth guards; admin-only API routes
  (`/api/admin/users`, `/api/admin/sessions`) using a server-side service-role
  client.
- RLS on all tables; admin writes gated by `is_erp_admin()`.
- RBAC permission scopes + `Can` gate.
- Immutable `audit_log` (write-once trigger) across settings, workflows, rules,
  numbering, users, sessions, and key documents.

---

## 9. Migrations to apply (Supabase SQL editor, in order)

All idempotent. Apply any not yet run, then `NOTIFY pgrst, 'reload schema';`.

| Migration | Purpose |
|---|---|
| `20260612090000_admin_platform_engine` | Workflows, rules, numbering RPC, forms, templates |
| `20260612130000_seed_default_workflows` | Default workflows (PO, QTN, VO, GRN, INV, TND, SERVICE_REQ, PRJ, LEAVE) |
| `20260613100000_fix_quotation_number_trigger` | Robust quotation numbering |
| `20260613120000_quotation_client_po_document` | Client LPO/contract on quotation |
| `20260613140000_po_proforma_invoice` | Supplier proforma on LPO |
| `20260613160000_fix_pricing_audit_trigger` | **Critical** — fixes broken pricing audit trigger (blocks supplier/stock writes) |
| `20260613180000_pricing_price_history` | Catalogue price-history table |
| `20260613200000_supplier_subcontractor_fields` | Subcontractor type/trade/day-rate |
| `20260613220000_fix_comparison_number_trigger` | Robust comparison numbering |
| `20260613240000_quotation_linked_project` | Quotation→project ownership link |
| `20260613260000_purchase_requests` | PR + PR items tables, `po.pr_id` |
| `20260613280000_payment_method_and_direct_purchase` | payment_method on LPO/PR, direct-purchase, PROCUREMENT settings category |
| `20260613300000_pr_item_line_status` | Per-line PR status (receive/cancel) |
| `20260614100000_grn_auto_store_receipt` | GRN auto-routes goods to store on receipt; skips non-catalogue lines safely |
| `20260614120000_grn_store_robust` | **Supersedes above** — auto-creates a default store if none, and a catalogue item for non-catalogue lines, so every received line becomes stock |
| `20260614140000_rfq` | RFQ (Request for Quotation) tables, numbering, RLS — sourcing requests from a BOQ |

Verify: `node scripts/verify-platform.mjs`.

---

## 10. Known gaps / next steps

- **Role-based action/display gating** across procurement (RBAC exists; wiring
  per-action is partial).
- **Per-line PR receive** (cancel done; "received" status transition pending UI).
- **Line-level payment status** (invoices are PO-level today).
- **AI automation** (Gemini key + `process-document` edge function not
  deployed; all AI paths degrade to manual cleanly).
- A few **stock service embeds** (`getMovementLedger` etc.) rely on PostgREST
  relationship resolution — robustify or reload the schema cache if hit.
- **Centralized auth middleware** (currently per-page).

---

## 11. Operational notes

- Console noise that is **not** a bug: `__cf_bm` cookie rejection (Cloudflare in
  front of Supabase), `[Fast Refresh]` (dev HMR), `source-map 404` (browser
  DevTools), Recharts `width(-1)` transient (mitigated with `minWidth={0}`),
  Supabase realtime websocket interruptions on reload.
- Admin bootstrap: `node scripts/bootstrap-admin.mjs` ensures the admin account
  + RBAC role.
- Docs: `docs/ADMIN-CENTER.md` (platform guide), this report.
