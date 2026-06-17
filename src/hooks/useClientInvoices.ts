// ============================================================
// Aura ERP — Client Invoice React Hooks (React Query)
// Same public API as before; cached reads + mutations invalidate cache.
// ============================================================

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { invoiceService } from '@/services/invoiceService';
import type { ClientInvoice, ClientInvoiceItem } from '@/types/finance.types';

export interface InvoiceFilters {
  status?: string;
  projectId?: string;
  clientId?: string;
  search?: string;
}

const invKeys = {
  lists: ['client-invoices', 'list'] as const,
  list: (f: InvoiceFilters) => ['client-invoices', 'list', f] as const,
  detail: (id: string) => ['client-invoices', 'detail', id] as const,
};

/** List + filter Client Invoices. */
export function useClientInvoices(filters: InvoiceFilters = {}) {
  const q = useQuery({
    queryKey: invKeys.list(filters),
    queryFn: () => invoiceService.fetchInvoices(filters),
  });
  return {
    invoices: q.data ?? [],
    loading: q.isPending,
    error: (q.error as Error | null) ?? null,
    refetch: q.refetch,
  };
}

/** Single Client Invoice detail + workflow actions. */
export function useClientInvoice(id: string) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: invKeys.detail(id),
    queryFn: () => invoiceService.fetchInvoiceById(id),
    enabled: !!id,
  });

  const invalidate = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: invKeys.detail(id) }),
      qc.invalidateQueries({ queryKey: invKeys.lists }),
    ]);
  };

  const createDraft = async (
    invoiceData: Omit<Partial<ClientInvoice>, 'id' | 'created_at' | 'updated_at'>,
    itemsData: Array<Omit<Partial<ClientInvoiceItem>, 'id' | 'invoice_id' | 'created_at'>>,
  ): Promise<ClientInvoice> => {
    const doc = await invoiceService.createInvoiceDraft(invoiceData, itemsData);
    await invalidate();
    return doc;
  };

  const submitApproval = async () => { await invoiceService.submitForApproval(id); await invalidate(); };
  const approve = async () => { await invoiceService.approveInvoice(id); await invalidate(); };
  const reject = async (reason: string) => { await invoiceService.rejectInvoice(id, reason); await invalidate(); };
  const markSent = async () => { await invoiceService.markAsSent(id); await invalidate(); };
  const writeOff = async (reason: string) => { await invoiceService.writeOffInvoice(id, reason); await invalidate(); };
  const deleteDraft = async () => { await invoiceService.deleteInvoice(id); await invalidate(); };

  return {
    invoice: q.data ?? null,
    loading: q.isPending,
    error: (q.error as Error | null) ?? null,
    refetch: q.refetch,
    createDraft,
    submitApproval,
    approve,
    reject,
    markSent,
    writeOff,
    deleteDraft,
  };
}
