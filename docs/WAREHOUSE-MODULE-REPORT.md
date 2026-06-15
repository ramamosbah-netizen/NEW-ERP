# JEET ERP — Warehouse & Inventory — Current-State Report

Scope: `src/app/warehouse/*`, `src/services/{stockService, stockTransactionService,
stockCountService, mrfService, warehouseService, grnService, grnExpenseService,
grnReceivablesService, storesValidation}.ts`, `src/types/stock.types.ts`,
`src/lib/{stock-export, stock-movement-pdf}.ts`.

## 1. Pages (UI today)

| Route | Purpose |
|-------|---------|
| `/warehouse` | Hub — 4 cards: Suppliers, Store, Goods Movements, Pricing Catalogue |
| `/warehouse/suppliers` + `/[id]` | Supplier & subcontractor register; performance scoring from PO history |
| `/warehouse/store` | Stock on hand by item across locations; risk (OUT/LOW/OK); filters (location/category/system); register stock item (reorder level/qty); create location; **record movement** modal; Excel export; movement PDF receipt |
| `/warehouse/movements` | Goods-movement ledger (GRN/MRF/transfer/issue/return/adjust/write-off); handover-receipt download |

Sidebar group **Warehouse & Inventory**: Suppliers & Subcon, Store, Goods Movements.

## 2. Data model (`stock.types.ts`)

- **StockLocation** — MAIN_STORE / SUB_STORE / PROJECT_SITE / VAN; custodian; project link.
- **StockItem** — wraps a pricing-catalogue item; `is_serialized`, `reorder_level`, `reorder_qty`, `preferred_supplier_id`.
- **StockBalance** — qty_on_hand / avg_unit_cost / qty_reserved / qty_available per item+location.
- **StockTransaction** — GRN_RECEIPT, ISSUE_TO_PROJECT/TICKET, RETURN_FROM_SITE, RETURN_TO_SUPPLIER, TRANSFER_IN/OUT, ADJUSTMENT_IN/OUT, WRITE_OFF; project + counterparty links; performer.
- **SerialUnit** — per-serial lifecycle (IN_STORE/ISSUED/INSTALLED/FAULTY/RETURNED); warranty expiry.
- **MaterialRequisition (MRF)** + **MRFItem** — DRAFT→SUBMITTED→APPROVED→PARTIALLY_ISSUED→ISSUED→REJECTED.
- **StockCount** + **StockCountLine** — IN_PROGRESS→PENDING_REVIEW→POSTED; variance + variance_value.

## 3. Services (logic today)

- **stockService** — locations CRUD, stock-item CRUD, balances, **movement ledger**, **serial units**, **dead-stock report**, **valuation report**.
- **stockTransactionService** — `recordTransaction` (the single posting primitive; updates balances; collaborative RLS).
- **stockCountService** — `startStockCount`, `saveCountLines`, `postStockCount` (writes variance adjustments to the ledger).
- **mrfService** — `createMRF`, `getMRFs`, `getMRFDetail`, `approveMRF`, `issueMRF` (→ ISSUE_TO_PROJECT), `returnFromSite`.
- **warehouseService** — suppliers (list/detail/create/toggle, PO history → performance), stock rows for the Store grid.
- **grnService / grnExpenseService / grnReceivablesService** — goods receipt → stock + finance (AP/expense) pipeline.

## 4. Business logic highlights

- **Costing:** moving-average unit cost per item+location; issues to projects feed `projectFinancialsService` actual cost (stock issues vs direct material — no double count).
- **GRN → store:** receipt creates stock if a store location + catalogue link exist (see `[[grn-stock-pipeline]]`).
- **Reservations:** qty_available = on_hand − reserved.
- **RLS:** collaborative (`using(true)`), matching the rest of the app.

## 5. Gap analysis (build targets)

| # | Capability | Status today |
|---|-----------|--------------|
| 1 | **Inventory Dashboard / analytics** | ❌ none — no KPI/value/turns/risk overview |
| 2 | **Stock Count / Stock-take UI** | 🟡 `stockCountService` fully built, **no page** |
| 3 | **Material Requisition (MRF) UI** | 🟡 `mrfService` fully built, **no dedicated page** |
| 4 | **Valuation & Aging report** | 🟡 `getValuationReport` exists, **no page** |
| 5 | **Dead-stock report** | 🟡 `getDeadStockReport` exists, **no page** |
| 6 | **Serial-number tracking UI** | 🟡 `getSerialUnits` + type exist, **no page** |
| 7 | **Reorder / replenishment planning** | 🟡 levels captured + risk shown; no suggestion→PR |
| 8 | **Locations management page** | 🟡 create-in-modal only; no admin list |
| 9 | **Audit logging + PDF/Excel** | 🟡 partial; standardise across all pages |

**Reuse, don't rebuild:** stock-count, MRF, valuation, dead-stock and serial logic
already exist — surface them. New work is mostly UI + a dashboard + replenishment.
