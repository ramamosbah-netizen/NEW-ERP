// ============================================================
// JEET ERP — Project Cost Control and Financials Service
// Computes: Budget vs Committed vs Accrued vs Actual vs Revenue Billed
// ============================================================

import { supabase } from '@/lib/supabase';
import { round2 } from './invoiceMathService';

interface ProjectFinancialsSummary {
  projectId: string;
  projectName: string;
  projectNumber: string;
  contractValue: number;
  budgetCost: number; // BOQ estimated cost
  committedCost: number; // approved/sent POs value
  actualCost: number; // total actual cost (material + labour)
  actualLabourCost: number; // timesheet cost amount sum
  budgetLabourCost: number; // labor budget from BOQ
  accruedUnbilledCost: number; // GRNs received but not yet invoiced
  revenueBilled: number; // client invoices
  revenueCollected: number; // client payments
  realizedMargin: number; // revenueBilled - actualCost
  realizedMarginPercent: number;
  projectedCostAtCompletion: number; // actualCost + max(0, committedCost - invoicedCommittedCost)
  projectedMargin: number; // contractValue - projectedCostAtCompletion
  projectedMarginPercent: number;
  isMarginEroded: boolean; // if projected cost > 95% of contract value
}

export const projectFinancialsService = {
  /**
   * Computes the complete financial matrix for a project.
   * Queries run in parallel WAVES (same results as before, concurrent execution).
   */
  async computeProjectFinancials(projectId: string): Promise<ProjectFinancialsSummary> {
    // ---- WAVE 1: queries depending only on projectId (or global) run together ----
    const [
      projectRes,
      posRes,
      invoiceItemsRes,
      grnMatchesRes,
      stockTxsRes,
      labourCostsRes,
      clientInvoicesRes,
    ] = await Promise.all([
      supabase
        .from('projects')
        .select('name, project_number, contract_value, budget_cost, boq_id')
        .eq('id', projectId)
        .single(),
      supabase
        .from('purchase_orders')
        .select('id, subtotal')
        .eq('project_id', projectId)
        .in('status', ['APPROVED', 'SENT', 'ACKNOWLEDGED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'CLOSED']),
      supabase
        .from('supplier_invoice_items')
        .select(`
          taxable_amount,
          po_item_id,
          supplier_invoices!inner(id, status, project_id)
        `)
        .eq('supplier_invoices.project_id', projectId)
        .in('supplier_invoices.status', ['REGISTERED', 'PENDING_APPROVAL', 'APPROVED', 'SCHEDULED', 'PARTIALLY_PAID', 'PAID']),
      supabase
        .from('grn_items')
        .select('po_item_id, grns!inner(is_stock_item)')
        .eq('grns.is_stock_item', true),
      supabase
        .from('stock_transactions')
        .select('qty, unit_cost')
        .eq('project_id', projectId)
        .in('type', ['ISSUE_TO_PROJECT', 'RETURN_FROM_SITE']),
      supabase
        .from('project_labour_costs')
        .select('cost_amount')
        .eq('project_id', projectId),
      supabase
        .from('client_invoices')
        .select('id, taxable_amount, amount_paid, net_due')
        .eq('project_id', projectId)
        .in('status', ['APPROVED', 'SENT', 'PARTIALLY_PAID', 'PAID']),
    ]);

    if (projectRes.error) throw projectRes.error;
    const project = projectRes.data;
    const pos = posRes.data;
    const invoiceItems = invoiceItemsRes.data;
    const grnMatches = grnMatchesRes.data;
    const stockTxs = stockTxsRes.data;
    const labourCosts = labourCostsRes.data;
    const clientInvoices = clientInvoicesRes.data;

    const contractValue = Number(project.contract_value || 0);
    const budgetCost = Number(project.budget_cost || 0);

    const committedCost = (pos || []).reduce((sum, po) => sum + Number(po.subtotal || 0), 0);

    const stockedPoItemIds = new Set((grnMatches || []).map((g: any) => g.po_item_id));
    const directMaterialCost = (invoiceItems || []).reduce((sum: number, item: any) => {
      if (item.po_item_id && stockedPoItemIds.has(item.po_item_id)) {
        return sum; // Skip, it is a stocked item and hits project actuals via MRF issues
      }
      return sum + Number(item.taxable_amount || 0);
    }, 0);

    const stockIssuesCost = (stockTxs || []).reduce((sum: number, tx: any) => {
      // tx.qty is signed (- for issues, + for returns)
      return sum - (Number(tx.qty) * Number(tx.unit_cost));
    }, 0);

    const actualMaterialCost = directMaterialCost + stockIssuesCost;

    const actualLabourCost = (labourCosts || []).reduce((sum: number, item: any) => sum + Number(item.cost_amount || 0), 0);
    const totalActualCost = actualMaterialCost + actualLabourCost;

    const revenueBilled = (clientInvoices || []).reduce((sum: number, inv: any) => sum + Number(inv.taxable_amount || 0), 0);
    const invoiceIds = (clientInvoices || []).map((inv: any) => inv.id);
    const poIds = (pos || []).map((po: any) => po.id);

    // ---- WAVE 2: depend on Wave 1 results (boq_id, invoice ids, po ids) ----
    const [boqRes, allocationsRes, poItemsRes] = await Promise.all([
      project.boq_id
        ? supabase.from('boqs').select('items').eq('id', project.boq_id).maybeSingle()
        : Promise.resolve({ data: null as any }),
      invoiceIds.length > 0
        ? supabase.from('payment_allocations').select('allocated_amount').in('invoice_id', invoiceIds)
        : Promise.resolve({ data: [] as any[] }),
      poIds.length > 0
        ? supabase.from('po_items').select('id, qty_received, unit_price').in('po_id', poIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    let budgetLabourCost = 0;
    const boq = boqRes.data;
    if (boq && Array.isArray(boq.items)) {
      budgetLabourCost = boq.items.reduce((sum: number, item: any) => sum + Number(item.labor_total_cost || 0), 0);
    }

    const revenueCollected = (allocationsRes.data || []).reduce((sum: number, alloc: any) => sum + Number(alloc.allocated_amount || 0), 0);

    const poItems = poItemsRes.data;

    // ---- WAVE 3: unbilled accrual (depends on poItems + invoiceItems) ----
    let accruedUnbilledCost = 0;
    let invoicedCommittedCost = 0;
    const poItemIds = (poItems || []).map((item: any) => item.id);
    if (poItemIds.length > 0) {
      const supplierInvoiceIds = (invoiceItems || [])
        .map((item: any) => (item.supplier_invoices as any)?.id)
        .filter(Boolean);

      const { data: supItems } = await supabase
        .from('supplier_invoice_items')
        .select('po_item_id, quantity')
        .in('po_item_id', poItemIds)
        .in('supplier_invoice_id', supplierInvoiceIds); // approved/registered only

      const invoicedQtyMap = new Map<string, number>();
      if (supItems) {
        for (const item of supItems) {
          if (item.po_item_id) {
            const prev = invoicedQtyMap.get(item.po_item_id) || 0;
            invoicedQtyMap.set(item.po_item_id, prev + Number(item.quantity));
          }
        }
      }

      for (const item of poItems || []) {
        const qtyReceived = Number(item.qty_received || 0);
        const qtyInvoiced = invoicedQtyMap.get(item.id) || 0;
        const unbilledQty = Math.max(0, qtyReceived - qtyInvoiced);
        accruedUnbilledCost += unbilledQty * Number(item.unit_price || 0);
        invoicedCommittedCost += qtyInvoiced * Number(item.unit_price || 0);
      }
    }

    // Round core values
    const roundedCommitted = round2(committedCost);
    const roundedActual = round2(totalActualCost);
    const roundedLabour = round2(actualLabourCost);
    const roundedBudgetLabour = round2(budgetLabourCost);
    const roundedAccrued = round2(accruedUnbilledCost);
    const roundedBilled = round2(revenueBilled);
    const roundedCollected = round2(revenueCollected);
    const roundedInvoicedCommitted = round2(invoicedCommittedCost);

    // Margins calculations
    const realizedMargin = round2(roundedBilled - roundedActual);
    const realizedMarginPercent = roundedBilled > 0 ? round2((realizedMargin / roundedBilled) * 100) : 0;

    // Projected cost at completion: Actual Cost + remaining committed cost
    const remainingCommitted = Math.max(0, roundedCommitted - roundedInvoicedCommitted);
    const projectedCostAtCompletion = round2(roundedActual + remainingCommitted);

    const projectedMargin = round2(contractValue - projectedCostAtCompletion);
    const projectedMarginPercent = contractValue > 0 ? round2((projectedMargin / contractValue) * 100) : 0;

    // Warning limit: if projected cost exceeds 95% of contract value
    const isMarginEroded = contractValue > 0 && (projectedCostAtCompletion > (contractValue * 0.95));

    return {
      projectId,
      projectName: project.name,
      projectNumber: project.project_number,
      contractValue,
      budgetCost,
      committedCost: roundedCommitted,
      actualCost: roundedActual,
      actualLabourCost: roundedLabour,
      budgetLabourCost: roundedBudgetLabour,
      accruedUnbilledCost: roundedAccrued,
      revenueBilled: roundedBilled,
      revenueCollected: roundedCollected,
      realizedMargin,
      realizedMarginPercent,
      projectedCostAtCompletion,
      projectedMargin,
      projectedMarginPercent,
      isMarginEroded
    };
  }
};
export default projectFinancialsService;