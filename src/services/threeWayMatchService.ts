// ============================================================
// JEET ERP — Supplier 3-Way Matching Engine
// Verifies: Invoiced Unit Price vs PO Price (0.5% tolerance)
//            Invoiced Qty vs (GRN Received Qty - Prev Invoiced Qty)
//            Supplier Tax Registration Number (TRN) validation
// ============================================================

import type { ThreeWayMatchResults, MatchStatus } from '@/types/finance.types';

interface MatchItemInput {
  po_item_id: string | null;
  description: string;
  quantity: number; // Qty on this supplier invoice
  unit_price: number; // Unit price on this supplier invoice
}

interface MatchPOItemInput {
  id: string;
  description: string;
  quantity: number; // Ordered Qty
  unit_price: number; // PO Unit Price
  qty_received: number; // Total Received from GRNs
  qty_rejected: number; // Total Rejected from GRNs
}

interface MatchEngineInput {
  invoiceItems: MatchItemInput[];
  poItems: MatchPOItemInput[];
  previouslyInvoicedQtys: Record<string, number>; // po_item_id -> sum(quantity) on past supplier invoices
  invoiceSupplierTrn?: string | null;
  dbSupplierTrn?: string | null;
}

interface MatchEngineOutput {
  status: 'MATCHED' | 'EXCEPTION';
  results: ThreeWayMatchResults;
}

/**
 * Validates UAE TRN formatting (15 digits).
 */
export function validateUAETrn(trn: string): boolean {
  const cleanTrn = trn.replace(/[\s-]/g, '');
  return /^\d{15}$/.test(cleanTrn);
}

/**
 * Performs a deterministic 3-way match audit on a registered supplier invoice.
 */
export function performThreeWayMatch(input: MatchEngineInput): MatchEngineOutput {
  const results: ThreeWayMatchResults = {
    priceExceptions: [],
    qtyExceptions: [],
    trnValid: true
  };

  // 1. TRN Check
  if (input.invoiceSupplierTrn || input.dbSupplierTrn) {
    const invTrn = (input.invoiceSupplierTrn || '').trim().replace(/[\s-]/g, '');
    const dbTrn = (input.dbSupplierTrn || '').trim().replace(/[\s-]/g, '');

    if (!invTrn) {
      results.trnValid = false;
      results.trnError = 'Supplier TRN is missing on invoice.';
    } else if (!validateUAETrn(invTrn)) {
      results.trnValid = false;
      results.trnError = 'Invoice TRN format is invalid (must be 15 digits).';
    } else if (dbTrn && invTrn !== dbTrn) {
      results.trnValid = false;
      results.trnError = `TRN Mismatch: Invoice has ${invTrn}, but database profile registers ${dbTrn}.`;
    }
  }

  // Map PO items for quick access
  const poItemMap = new Map<string, MatchPOItemInput>();
  for (const item of input.poItems) {
    poItemMap.set(item.id, item);
  }

  // 2. Line Item Audit
  for (const line of input.invoiceItems) {
    // If not matched to PO (e.g. direct expense), skip PO matching checks
    if (!line.po_item_id) continue;

    const poItem = poItemMap.get(line.po_item_id);
    if (!poItem) {
      // Flag as exception: po item ID mismatch
      results.qtyExceptions!.push({
        poItemId: line.po_item_id,
        description: line.description,
        grnQty: 0,
        prevInvoiced: 0,
        invQty: line.quantity
      });
      continue;
    }

    // Price Matching Check (±0.5% tolerance)
    const invPrice = line.unit_price;
    const poPrice = poItem.unit_price;
    const priceDiff = invPrice - poPrice;
    const priceDiffPercent = poPrice > 0 ? (priceDiff / poPrice) : 0;

    // Strict tolerance check (0.5% = 0.005)
    if (Math.abs(priceDiffPercent) > 0.005) {
      results.priceExceptions!.push({
        poItemId: line.po_item_id,
        description: line.description,
        poPrice,
        invPrice,
        diffPercent: Math.round(priceDiffPercent * 10000) / 100 // round to 2 decimals
      });
    }

    // Quantity Matching Check
    // Invoiced qty must be <= received qty - previously invoiced qty
    const prevInvoiced = input.previouslyInvoicedQtys[line.po_item_id] || 0;
    const grnQty = poItem.qty_received; // received qty from GRNs
    
    // We allow a microscopic floating point tolerance of 0.0001
    const maxAllowedInvoiced = grnQty - prevInvoiced;
    
    if (line.quantity > maxAllowedInvoiced + 0.0001) {
      results.qtyExceptions!.push({
        poItemId: line.po_item_id,
        description: line.description,
        grnQty,
        prevInvoiced,
        invQty: line.quantity
      });
    }
  }

  // 3. Status Determination
  const hasPriceException = results.priceExceptions!.length > 0;
  const hasQtyException = results.qtyExceptions!.length > 0;
  const trnIsOk = results.trnValid === true;

  const isMatched = !hasPriceException && !hasQtyException && trnIsOk;

  return {
    status: isMatched ? 'MATCHED' : 'EXCEPTION',
    results
  };
}
