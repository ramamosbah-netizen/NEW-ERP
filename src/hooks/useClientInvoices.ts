// ============================================================
// JEET ERP — Client Invoice React Hooks
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { invoiceService } from '@/services/invoiceService';
import type { ClientInvoice, ClientInvoiceItem } from '@/types/finance.types';

export interface InvoiceFilters {
  status?: string;
  projectId?: string;
  clientId?: string;
  search?: string;
}

/**
 * Hook to retrieve and filter the list of Client Invoices.
 */
export function useClientInvoices(filters: InvoiceFilters = {}) {
  const [invoices, setInvoices] = useState<ClientInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchList = useCallback(async () => {
    try {
      setLoading(true);
      const data = await invoiceService.fetchInvoices(filters);
      setInvoices(data);
      setError(null);
    } catch (err: any) {
      console.error('Error in useClientInvoices hook:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  return { invoices, loading, error, refetch: fetchList };
}

/**
 * Hook to retrieve detailed view of a single Client Invoice and perform workflow actions.
 */
export function useClientInvoice(id: string) {
  const [invoice, setInvoice] = useState<(ClientInvoice & { items: ClientInvoiceItem[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await invoiceService.fetchInvoiceById(id);
      setInvoice(data);
      setError(null);
    } catch (err: any) {
      console.error(`Error in useClientInvoice hook for ${id}:`, err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  // Workflow Actions
  const createDraft = async (
    invoiceData: Omit<Partial<ClientInvoice>, 'id' | 'created_at' | 'updated_at'>,
    itemsData: Array<Omit<Partial<ClientInvoiceItem>, 'id' | 'invoice_id' | 'created_at'>>
  ): Promise<ClientInvoice> => {
    const doc = await invoiceService.createInvoiceDraft(invoiceData, itemsData);
    await fetchDetail();
    return doc;
  };

  const submitApproval = async () => {
    await invoiceService.submitForApproval(id);
    await fetchDetail();
  };

  const approve = async () => {
    await invoiceService.approveInvoice(id);
    await fetchDetail();
  };

  const reject = async (reason: string) => {
    await invoiceService.rejectInvoice(id, reason);
    await fetchDetail();
  };

  const markSent = async () => {
    await invoiceService.markAsSent(id);
    await fetchDetail();
  };

  const writeOff = async (reason: string) => {
    await invoiceService.writeOffInvoice(id, reason);
    await fetchDetail();
  };

  const deleteDraft = async () => {
    await invoiceService.deleteInvoice(id);
    setInvoice(null);
  };

  return {
    invoice,
    loading,
    error,
    refetch: fetchDetail,
    createDraft,
    submitApproval,
    approve,
    reject,
    markSent,
    writeOff,
    deleteDraft,
  };
}
