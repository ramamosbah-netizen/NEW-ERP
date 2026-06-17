// ============================================================
// Aura ERP — 3-Way Match Data Resolution Hook (React Query)
// Resolves PO details, received qty (GRN) and previously invoiced qty.
// ============================================================

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

interface POItemMatchDetail {
  poItemId: string;
  description: string;
  unit: string;
  poQty: number;
  poUnitPrice: number;
  poTotal: number;
  qtyReceived: number;
  qtyRejected: number;
  qtyPreviouslyInvoiced: number;
  qtyOutstandingToInvoice: number;
}

async function computeMatch(poId: string): Promise<{ poDetails: any; matchDetails: POItemMatchDetail[] }> {
  const { data: po, error: poErr } = await supabase
    .from('purchase_orders').select('*, pricing_suppliers(name)').eq('id', poId).single();
  if (poErr) throw poErr;

  const { data: poItems, error: itemsErr } = await supabase
    .from('po_items').select('*').eq('po_id', poId).order('line_no', { ascending: true });
  if (itemsErr) throw itemsErr;

  const { data: pastInvoiceItems, error: invErr } = await supabase
    .from('supplier_invoice_items')
    .select('po_item_id, quantity, supplier_invoices(status)')
    .eq('supplier_invoices.po_id', poId)
    .not('supplier_invoices.status', 'eq', 'CANCELLED');
  if (invErr) throw invErr;

  const prevInvoicedMap = new Map<string, number>();
  for (const line of pastInvoiceItems || []) {
    if (line.po_item_id) {
      prevInvoicedMap.set(line.po_item_id, (prevInvoicedMap.get(line.po_item_id) || 0) + Number(line.quantity));
    }
  }

  const matchDetails: POItemMatchDetail[] = (poItems || []).map(item => {
    const qtyReceived = Number(item.qty_received || 0);
    const qtyPreviouslyInvoiced = prevInvoicedMap.get(item.id) || 0;
    const qtyOutstanding = Math.max(0, qtyReceived - qtyPreviouslyInvoiced);
    return {
      poItemId: item.id,
      description: item.description,
      unit: item.unit,
      poQty: Number(item.quantity),
      poUnitPrice: Number(item.unit_price),
      poTotal: Number(item.line_total),
      qtyReceived,
      qtyRejected: Number(item.qty_rejected || 0),
      qtyPreviouslyInvoiced,
      qtyOutstandingToInvoice: Math.round(qtyOutstanding * 1000) / 1000,
    };
  });

  return { poDetails: po, matchDetails };
}

export function useThreeWayMatch(poId?: string) {
  const q = useQuery({
    queryKey: ['three-way-match', poId ?? ''],
    enabled: !!poId,
    queryFn: () => computeMatch(poId!),
  });
  return {
    poDetails: q.data?.poDetails ?? null,
    matchDetails: q.data?.matchDetails ?? [],
    loading: q.isLoading,
    error: (q.error as Error | null) ?? null,
    refetch: q.refetch,
  };
}

export default useThreeWayMatch;
