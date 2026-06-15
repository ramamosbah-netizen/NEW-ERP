# JEET ERP — Pre-Sales — Current-State Report

Scope: `src/app/{tenders, quotations, pricing}/*`. Pre-sales today is a strong
**execution** chain (Tender → BOQ → Quotation → Project) but has **no analytics,
no CRM/clients page, and no pipeline/funnel view**.

## 1. Pages (UI today)

| Route | Purpose |
|-------|---------|
| `/tenders` | Tender (enquiry/opportunity) register |
| `/tenders/new`, `/tenders/[id]`, `/tenders/[id]/edit` | Create / view / edit a tender (scope, technical, client requirements) |
| `/tenders/[id]/boq` (2,359 lines) | **BOQ builder** — items, cost elements, financials (margin engine), print |
| `/quotations` | Quotation register |
| `/quotations/new/[boqId]` | Create a quotation from a BOQ |
| `/quotations/[id]` + `/edit` `/review` `/approve` `/pdf` | Quotation lifecycle: edit → commercial review → GM approve → PDF |
| `/quotations/templates` | Quotation T&C / templates |
| `/pricing` (1,365 lines) | Master rate catalogue (feeds BOQ + quotations) |

Sidebar **Sales & Projects**: Tenders, Quotations (then Projects…). No clients/CRM, no pre-sales dashboard.

## 2. Data model (probed)

- **tenders** — `title, project_name, client_name, location, deadline_date, budget, status` (Draft / Submitted / Under Review / Completed), `scope_of_work`, `tech_*`, `client_*` requirements, `status_history`, `project_id`. *(client is free-text, no client_id; owner = created_by.)*
- **boqs** — `tender_id, status (finalized/exported), items[], cost_elements, financials{} (direct_total, supply_total, labor_total, overhead, indirect_total, profit_pct, profit_value, risk_cost, …), project_id`. The **estimation/margin engine** lives here.
- **quotations** — full commercial doc: `quotation_number, revision, status (DRAFT/APPROVED/ACCEPTED/REJECTED/SUPERSEDED), boq_id, client_id, grand_total_with_vat, subtotal_ex_vat, valid_until, payment_terms`, review/approve fields (`commercial_reviewer_id`, `gm_approver_id`), `sent_to_client_at`, `client_responded_at`, `client_response`, `rejection_reason`, `linked_project_id / actual_project_id` (won → project).
- **clients** — minimal: `name, address, contact_person/email/phone`. *(No CRM fields, no UI page.)*

## 3. Business logic highlights

- **Funnel:** Tender → BOQ (priced with margin) → Quotation (reviewed → approved → sent) → client response → **won** (linked to a project) / rejected / superseded (revision chain via `previous_quotation_id`).
- **Margin:** computed in `boqs.financials` (direct + indirect + profit %).
- **Approval:** quotation commercial review + GM approval gates.

## 4. Gap analysis (build targets)

| # | Capability | Status today |
|---|-----------|--------------|
| 1 | **Pre-Sales Dashboard / funnel** | ❌ none |
| 2 | **Sales Pipeline (opportunities)** | 🟡 tender list only, no pipeline view |
| 3 | **Quotation Analytics** | ❌ none |
| 4 | **Win / Loss Analysis** | 🟡 data exists (client_response, rejection_reason), no view |
| 5 | **Estimation & Margin Analysis** | 🟡 per-BOQ only, no cross-portfolio view |
| 6 | **Client Directory & 360 (CRM)** | ❌ **no clients page at all** |
| 7 | **Tender Deadline Tracker** | ❌ none |
| 8 | **Quotation Follow-ups & Validity** | 🟡 fields exist, no view |
| 9 | **Sales Performance (by owner)** | ❌ none |
| 10 | **Hub + Audit & Export Polish** | — |

**Reuse, don't rebuild:** the tender/BOQ/quotation execution chain is mature — this
program is **analytics + a CRM/clients layer** over data that already exists.
