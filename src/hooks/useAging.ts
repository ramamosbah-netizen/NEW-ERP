// ============================================================
// Aura ERP — AR/AP Aging Analysis Hook (React Query)
// Outstanding balances split into 30-day buckets.
// ============================================================

import { useQuery } from '@tanstack/react-query';
import { invoiceService } from '@/services/invoiceService';
import type { ClientInvoice } from '@/types/finance.types';

export interface AgingBucket {
  totalOutstanding: number;
  current: number;
  bucket1_30: number;
  bucket31_60: number;
  bucket61_90: number;
  bucket90_plus: number;
}

export interface ClientAgingRecord extends AgingBucket {
  clientId: string;
  clientName: string;
  invoices: ClientInvoice[];
}

const EMPTY: AgingBucket = {
  totalOutstanding: 0, current: 0, bucket1_30: 0, bucket31_60: 0, bucket61_90: 0, bucket90_plus: 0,
};

const r2 = (n: number) => Math.round(n * 100) / 100;

function bucketize(target: AgingBucket, diffDays: number, outstanding: number) {
  target.totalOutstanding += outstanding;
  if (diffDays <= 0) target.current += outstanding;
  else if (diffDays <= 30) target.bucket1_30 += outstanding;
  else if (diffDays <= 60) target.bucket31_60 += outstanding;
  else if (diffDays <= 90) target.bucket61_90 += outstanding;
  else target.bucket90_plus += outstanding;
}

function round(b: AgingBucket) {
  b.totalOutstanding = r2(b.totalOutstanding); b.current = r2(b.current);
  b.bucket1_30 = r2(b.bucket1_30); b.bucket31_60 = r2(b.bucket31_60);
  b.bucket61_90 = r2(b.bucket61_90); b.bucket90_plus = r2(b.bucket90_plus);
}

async function computeAging(type: 'AR' | 'AP'): Promise<{ summary: AgingBucket; clientRecords: ClientAgingRecord[] }> {
  let invoices: any[] = [];
  if (type === 'AR') {
    invoices = await invoiceService.fetchInvoices();
  } else {
    const { supabase } = await import('@/lib/supabase');
    const { data } = await supabase
      .from('supplier_invoices')
      .select('*, pricing_suppliers(name)')
      .in('status', ['REGISTERED', 'APPROVED', 'SCHEDULED', 'PARTIALLY_PAID'])
      .order('due_date', { ascending: true });
    invoices = data || [];
  }

  const summary: AgingBucket = { ...EMPTY };
  const groupMap = new Map<string, { name: string; invoices: any[] }>();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const daysOverdue = (inv: any) => {
    const d = new Date(inv.due_date);
    d.setHours(0, 0, 0, 0);
    return Math.ceil((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  };
  const outstandingOf = (inv: any) => Number(inv.net_due || inv.total || 0) - Number(inv.amount_paid || 0);

  for (const inv of invoices) {
    const outstanding = outstandingOf(inv);
    if (outstanding <= 0.01) continue;

    const entityId = type === 'AR' ? inv.client_id : inv.supplier_id;
    const entityName = type === 'AR'
      ? inv.client_name
      : ((inv.pricing_suppliers as any)?.name || `Supplier Ref: ${inv.supplier_invoice_number}`);

    if (!groupMap.has(entityId)) groupMap.set(entityId, { name: entityName, invoices: [] });
    groupMap.get(entityId)!.invoices.push(inv);

    bucketize(summary, daysOverdue(inv), outstanding);
  }
  round(summary);

  const clientRecords: ClientAgingRecord[] = [];
  for (const [entityId, data] of groupMap.entries()) {
    const rec: ClientAgingRecord = { ...EMPTY, clientId: entityId, clientName: data.name, invoices: data.invoices };
    for (const inv of data.invoices) bucketize(rec, daysOverdue(inv), outstandingOf(inv));
    round(rec);
    clientRecords.push(rec);
  }

  return { summary, clientRecords };
}

export function useAging(type: 'AR' | 'AP' = 'AR') {
  const q = useQuery({
    queryKey: ['aging', type],
    queryFn: () => computeAging(type),
  });
  return {
    agingSummary: q.data?.summary ?? EMPTY,
    clientAging: q.data?.clientRecords ?? [],
    loading: q.isPending,
    error: (q.error as Error | null) ?? null,
    refetch: q.refetch,
  };
}

export default useAging;
