// ============================================================
// Aura ERP — Supplier Invoices React Hooks (React Query)
// ============================================================

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supplierInvoiceService } from '@/services/supplierInvoiceService';
import type { SupplierInvoice, SupplierInvoiceItem } from '@/types/finance.types';

export interface SupplierInvoiceFilters {
  status?: string;
  poId?: string;
  supplierId?: string;
  projectId?: string;
  companyId?: string;
}

const sinvKeys = {
  lists: ['supplier-invoices', 'list'] as const,
  list: (f: SupplierInvoiceFilters) => ['supplier-invoices', 'list', f] as const,
  detail: (id: string) => ['supplier-invoices', 'detail', id] as const,
};

/** List + filter Supplier Invoices (AP). */
export function useSupplierInvoices(filters: SupplierInvoiceFilters = {}) {
  const q = useQuery({ queryKey: sinvKeys.list(filters), queryFn: () => supplierInvoiceService.fetchSupplierInvoices(filters) });
  return {
    invoices: q.data ?? [],
    loading: q.isPending,
    error: (q.error as Error | null) ?? null,
    refetch: q.refetch,
  };
}

/** Single supplier invoice detail + actions. */
export function useSupplierInvoice(id: string) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: sinvKeys.detail(id), queryFn: () => supplierInvoiceService.fetchSupplierInvoiceById(id), enabled: !!id });

  const invalidate = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: sinvKeys.detail(id) }),
      qc.invalidateQueries({ queryKey: sinvKeys.lists }),
    ]);
  };

  const register = async (
    invoiceData: Omit<Partial<SupplierInvoice>, 'id' | 'internal_ref' | 'created_by' | 'created_at' | 'updated_at'>,
    itemsData: Array<Omit<Partial<SupplierInvoiceItem>, 'id' | 'supplier_invoice_id' | 'created_at'>>,
    trn?: string | null,
  ) => {
    const doc = await supplierInvoiceService.registerSupplierInvoice(invoiceData, itemsData, trn);
    await invalidate();
    return doc;
  };

  const approve = async () => { await supplierInvoiceService.approveSupplierInvoice(id); await invalidate(); };
  const overrideException = async (reason: string) => { await supplierInvoiceService.overrideMatchException(id, reason); await invalidate(); };

  const recordPayment = async (
    paymentData: {
      supplier_id: string; amount: number; payment_date: string; method: string;
      reference?: string; bank_account?: string; notes?: string;
    },
    allocations: Array<{ invoiceId: string; amount: number }>,
  ) => {
    const payment = await supplierInvoiceService.recordSupplierPayment(paymentData, allocations);
    await invalidate();
    return payment;
  };

  return {
    invoice: q.data ?? null,
    loading: q.isPending,
    error: (q.error as Error | null) ?? null,
    refetch: q.refetch,
    register,
    approve,
    overrideException,
    recordPayment,
  };
}

export default useSupplierInvoices;
