# JEET ERP — Procurement — Current-State Report

Scope: `src/app/procurement/*`, `src/services/{prService, rfqService, poService,
poApprovalService, poFromComparisonService, poNumberService, poPDFService,
grnService, grnExpenseService, grnReceivablesService, supplierInvoiceService,
supplierPerformanceService, threeWayMatchService}.ts`, `src/types/{po,grn}.types.ts`.

Procurement is a **complete source-to-pay execution chain** — the gap is the
**analytics / dashboard layer** on top of it.

## 1. Pages (UI today)

| Route | Purpose |
|-------|---------|
| `/procurement/pr` + `/create` `/[id]` | Purchase Requests (raise, approve, convert/direct-purchase) |
| `/procurement/rfq` + `/new/[boqId]` | Quotation Requests (RFQ to suppliers from a BOQ) |
| `/procurement/comparisons` + `/[id]` `/review` `/approve` `/item/[itemId]` | Quote comparison & award (line-by-line) |
| `/procurement/po` + `/create` `/from-comparison/[id]` `/[id]` | Purchase Orders (create, award from comparison, approve, send, PDF) |
| `/procurement/grn` + `/create` `/[id]` `/receivables` | Goods Receipt Notes (receive against PO, to stock/expense) |
| `/procurement/suppliers/[id]/scorecard` | Per-supplier performance scorecard |

Sidebar **Procurement** group: Purchase Requests, Quotation Requests, Comparisons, Purchase Orders, Goods Receipt.

## 2. Data model (probed)

- **purchase_requests** — `pr_number, status, category, project_id, estimated_total, preferred_supplier_id, required_by_date, approved_by/at, converted_po_id, is_direct_purchase, payment_method`.
- **purchase_orders** — `po_number, revision_number, project_id, supplier_id/name/trn, po_type, origin, comparison_id, pr_id, subtotal, vat_amount, total, required_delivery_date, payment_terms_days, status, delivery_status, sent_at, acknowledged_at, pdf_document_id, proforma_*`.
- **grns** — `grn_number, po_id, project_id, received_by, received_at, status, is_stock_item, stock_location_id, delivery_note_*`.
- **pricing_suppliers** (21) — `name, systems_covered, payment_terms_days, preferred, supplier_type, trade, day_rate, is_active`.
- **supplier_invoices** — `supplier_id, po_id, project_id, invoice_type, total, taxable_amount, vat_amount, match_status, status, amount_paid, due_date, expense_category, cost_bucket`.
- **rfqs** — `rfq_number, tender_id, boq_id, items[], suppliers[], status, due_date`.

## 3. Services (logic today)

- **prService** — PR CRUD, approval, convert-to-PO / direct purchase.
- **rfqService** — RFQ creation from BOQ, supplier multi-select, mailto + PDF.
- **poService / poApprovalService / poFromComparisonService / poNumberService / poPDFService** — PO lifecycle, approval, award-from-comparison, numbering, branded PDF.
- **grnService / grnExpenseService / grnReceivablesService** — goods receipt → stock + finance (expense / receivable) pipeline.
- **supplierInvoiceService** — AP invoices linked to POs, three-way match status.
- **threeWayMatchService** — PO ↔ GRN ↔ invoice match.
- **supplierPerformanceService** — `recalculateSupplierPerformance`, `savePerformanceRecord`.

## 4. Business logic highlights

- **Source-to-pay:** PR → (RFQ → comparison → award) → PO → GRN → supplier invoice → three-way match → payment.
- **Commitment:** approved/sent POs feed `projectFinancialsService` committed cost.
- **GRN → store/expense:** receipt creates stock (if catalogue-linked) or expense accrual.

## 5. Gap analysis (build targets)

| # | Capability | Status today |
|---|-----------|--------------|
| 1 | **Procurement Dashboard** (spend, PR/PO/GRN status, exceptions) | ❌ none |
| 2 | **Spend Analysis** (by supplier/category/project/period) | ❌ none |
| 3 | **Supplier Performance Leaderboard** | 🟡 per-supplier scorecard only |
| 4 | **PO Delivery Tracking** (open, overdue, delivery status) | 🟡 status on PO, no view |
| 5 | **PR Pipeline & Cycle Time** (approval turnaround, conversion) | ❌ none |
| 6 | **Three-Way Match Exceptions** | 🟡 per-invoice match only |
| 7 | **Goods Receipt (GRN) Analytics** | ❌ none |
| 8 | **Savings & Comparison Analysis** | 🟡 per-comparison only |
| 9 | **Payables / Supplier Invoices overview** | 🟡 finance AP exists; no procurement-angle view |
| 10 | **Hub + Audit & Export Polish** | — |

**Reuse, don't rebuild:** the source-to-pay execution is mature — this program is
**analytics + dashboards** over POs, GRNs, supplier invoices and comparisons.
