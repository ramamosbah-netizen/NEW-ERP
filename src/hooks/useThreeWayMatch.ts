// ============================================================
// JEET ERP — 3-Way Match Data Resolution Hook
// Resolves: PO details, received quantities (GRN),
// and previously invoiced quantities side-by-side.
// ============================================================

import { useState, useEffect, useCallback } from 'react';
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
  qtyOutstandingToInvoice: number; // qtyReceived - qtyPreviouslyInvoiced
}

export function useThreeWayMatch(poId?: string) {
  const [matchDetails, setMatchDetails] = useState<POItemMatchDetail[]>([]);
  const [poDetails, setPoDetails] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchMatchDetails = useCallback(async () => {
    if (!poId) {
      setMatchDetails([]);
      setPoDetails(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // 1. Fetch PO details
      const { data: po, error: poErr } = await supabase
        .from('purchase_orders')
        .select('*, pricing_suppliers(name, trn_number)')
        .eq('id', poId)
        .single();

      if (poErr) throw poErr;
      setPoDetails(po);

      // 2. Fetch PO Items
      const { data: poItems, error: itemsErr } = await supabase
        .from('po_items')
        .select('*')
        .eq('po_id', poId)
        .order('line_no', { ascending: true });

      if (itemsErr) throw itemsErr;

      // 3. Fetch past approved or registered supplier invoice items
      const { data: pastInvoiceItems, error: invErr } = await supabase
        .from('supplier_invoice_items')
        .select('po_item_id, quantity, supplier_invoices(status)')
        .eq('supplier_invoices.po_id', poId)
        .not('supplier_invoices.status', 'eq', 'CANCELLED');

      if (invErr) throw invErr;

      // Aggregate previously invoiced quantities
      const prevInvoicedMap = new Map<string, number>();
      if (pastInvoiceItems) {
        for (const line of pastInvoiceItems) {
          if (line.po_item_id) {
            const currentQty = prevInvoicedMap.get(line.po_item_id) || 0;
            prevInvoicedMap.set(line.po_item_id, currentQty + Number(line.quantity));
          }
        }
      }

      // Compile matching details line-by-line
      const compiled: POItemMatchDetail[] = (poItems || []).map(item => {
        const qtyReceived = Number(item.qty_received || 0);
        const qtyRejected = Number(item.qty_rejected || 0);
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
          qtyRejected,
          qtyPreviouslyInvoiced,
          qtyOutstandingToInvoice: Math.round(qtyOutstanding * 1000) / 1000,
        };
      });

      setMatchDetails(compiled);
    } catch (err: any) {
      console.error('Error fetching 3-way match details:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [poId]);

  useEffect(() => {
    fetchMatchDetails();
  }, [fetchMatchDetails]);

  return {
    poDetails,
    matchDetails,
    loading,
    error,
    refetch: fetchMatchDetails,
  };
}
export default useThreeWayMatch;
