// ============================================================
// JEET ERP — Accounts Receivable (AR) Aging Analysis Hook
// Calculates: Outstanding balances divided into 30-day buckets
// ============================================================

import { logger } from '@/lib/logger';
import { useState, useEffect, useCallback } from 'react';
import { invoiceService } from '@/services/invoiceService';
import type { ClientInvoice } from '@/types/finance.types';

export interface AgingBucket {
  totalOutstanding: number;
  current: number; // 0 days overdue or not yet due
  bucket1_30: number; // 1-30 days overdue
  bucket31_60: number; // 31-60 days overdue
  bucket61_90: number; // 61-90 days overdue
  bucket90_plus: number; // 90+ days overdue
}

export interface ClientAgingRecord extends AgingBucket {
  clientId: string;
  clientName: string;
  invoices: ClientInvoice[];
}

export function useAging(type: 'AR' | 'AP' = 'AR') {
  const [agingSummary, setAgingSummary] = useState<AgingBucket>({
    totalOutstanding: 0,
    current: 0,
    bucket1_30: 0,
    bucket31_60: 0,
    bucket61_90: 0,
    bucket90_plus: 0
  });

  const [clientAging, setClientAging] = useState<ClientAgingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAging = useCallback(async () => {
    try {
      setLoading(true);
      
      // If we are looking for AP (Supplier aging), we fetch supplier invoices
      // If AR (Client aging), we fetch client invoices
      let invoices: any[] = [];
      if (type === 'AR') {
        invoices = await invoiceService.fetchInvoices();
      } else {
        // Supplier aging is done via supplierInvoiceService, which we will build next.
        // We will fetch from public.supplier_invoices directly for this hook to keep it generic
        const { supabase } = await import('@/lib/supabase');
        const { data } = await supabase
          .from('supplier_invoices')
          .select('*, pricing_suppliers(name)')
          .in('status', ['REGISTERED', 'APPROVED', 'SCHEDULED', 'PARTIALLY_PAID'])
          .order('due_date', { ascending: true });
        invoices = data || [];
      }

      const summary: AgingBucket = {
        totalOutstanding: 0,
        current: 0,
        bucket1_30: 0,
        bucket31_60: 0,
        bucket61_90: 0,
        bucket90_plus: 0
      };

      const groupMap = new Map<string, { name: string; invoices: any[] }>();

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (const inv of invoices) {
        // Outstanding amount
        const netDue = Number(inv.net_due || inv.total || 0);
        const amtPaid = Number(inv.amount_paid || 0);
        const outstanding = netDue - amtPaid;

        if (outstanding <= 0.01) continue;

        // Grouping ID & Name
        const entityId = type === 'AR' ? inv.client_id : inv.supplier_id;
        // fallback supplier name resolution
        let entityName = type === 'AR' 
          ? inv.client_name 
          : ((inv.pricing_suppliers as any)?.name || `Supplier Ref: ${inv.supplier_invoice_number}`);
        
        if (type === 'AP' && !inv.supplier_name) {
          // If we don't have supplier_name denormalized, we will query or resolve
          // For simplicity we will fetch supplier details in the listing or use supplier_invoice_number
        }

        if (!groupMap.has(entityId)) {
          groupMap.set(entityId, { name: entityName, invoices: [] });
        }
        groupMap.get(entityId)!.invoices.push(inv);

        // Aging Buckets
        const dueDate = new Date(inv.due_date);
        dueDate.setHours(0, 0, 0, 0);

        const diffTime = today.getTime() - dueDate.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        summary.totalOutstanding += outstanding;

        if (diffDays <= 0) {
          summary.current += outstanding;
        } else if (diffDays <= 30) {
          summary.bucket1_30 += outstanding;
        } else if (diffDays <= 60) {
          summary.bucket31_60 += outstanding;
        } else if (diffDays <= 90) {
          summary.bucket61_90 += outstanding;
        } else {
          summary.bucket90_plus += outstanding;
        }
      }

      // Format outputs to 2 decimals
      summary.totalOutstanding = Math.round(summary.totalOutstanding * 100) / 100;
      summary.current = Math.round(summary.current * 100) / 100;
      summary.bucket1_30 = Math.round(summary.bucket1_30 * 100) / 100;
      summary.bucket31_60 = Math.round(summary.bucket31_60 * 100) / 100;
      summary.bucket61_90 = Math.round(summary.bucket61_90 * 100) / 100;
      summary.bucket90_plus = Math.round(summary.bucket90_plus * 100) / 100;

      setAgingSummary(summary);

      // Now compile list per client/supplier
      const clientRecords: ClientAgingRecord[] = [];

      for (const [entityId, data] of groupMap.entries()) {
        const clientSummary: ClientAgingRecord = {
          clientId: entityId,
          clientName: data.name,
          totalOutstanding: 0,
          current: 0,
          bucket1_30: 0,
          bucket31_60: 0,
          bucket61_90: 0,
          bucket90_plus: 0,
          invoices: data.invoices
        };

        for (const inv of data.invoices) {
          const netDue = Number(inv.net_due || inv.total || 0);
          const amtPaid = Number(inv.amount_paid || 0);
          const outstanding = netDue - amtPaid;

          const dueDate = new Date(inv.due_date);
          dueDate.setHours(0, 0, 0, 0);

          const diffTime = today.getTime() - dueDate.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          clientSummary.totalOutstanding += outstanding;

          if (diffDays <= 0) {
            clientSummary.current += outstanding;
          } else if (diffDays <= 30) {
            clientSummary.bucket1_30 += outstanding;
          } else if (diffDays <= 60) {
            clientSummary.bucket31_60 += outstanding;
          } else if (diffDays <= 90) {
            clientSummary.bucket61_90 += outstanding;
          } else {
            clientSummary.bucket90_plus += outstanding;
          }
        }

        // Round client details
        clientSummary.totalOutstanding = Math.round(clientSummary.totalOutstanding * 100) / 100;
        clientSummary.current = Math.round(clientSummary.current * 100) / 100;
        clientSummary.bucket1_30 = Math.round(clientSummary.bucket1_30 * 100) / 100;
        clientSummary.bucket31_60 = Math.round(clientSummary.bucket31_60 * 100) / 100;
        clientSummary.bucket61_90 = Math.round(clientSummary.bucket61_90 * 100) / 100;
        clientSummary.bucket90_plus = Math.round(clientSummary.bucket90_plus * 100) / 100;

        clientRecords.push(clientSummary);
      }

      setClientAging(clientRecords);
      setError(null);
    } catch (err: any) {
      logger.error('Error fetching aging calculations:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    fetchAging();
  }, [fetchAging]);

  return {
    agingSummary,
    clientAging,
    loading,
    error,
    refetch: fetchAging
  };
}
export default useAging;
