// ============================================================
// JEET ERP — Supplier Invoices React Hooks
// ============================================================

import { logger } from '@/lib/logger';
import { useState, useEffect, useCallback } from 'react';
import { supplierInvoiceService } from '@/services/supplierInvoiceService';
import type { SupplierInvoice, SupplierInvoiceItem } from '@/types/finance.types';

export interface SupplierInvoiceFilters {
  status?: string;
  poId?: string;
  supplierId?: string;
  projectId?: string;
}

/**
 * Hook to retrieve and filter the list of Supplier Invoices (AP).
 */
export function useSupplierInvoices(filters: SupplierInvoiceFilters = {}) {
  const [invoices, setInvoices] = useState<SupplierInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchList = useCallback(async () => {
    try {
      setLoading(true);
      const data = await supplierInvoiceService.fetchSupplierInvoices(filters);
      setInvoices(data);
      setError(null);
    } catch (err: any) {
      logger.error('Error in useSupplierInvoices hook:', err);
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
 * Hook to retrieve details of a single supplier invoice and perform actions.
 */
export function useSupplierInvoice(id: string) {
  const [invoice, setInvoice] = useState<(SupplierInvoice & { items: SupplierInvoiceItem[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await supplierInvoiceService.fetchSupplierInvoiceById(id);
      setInvoice(data);
      setError(null);
    } catch (err: any) {
      logger.error(`Error in useSupplierInvoice hook for ${id}:`, err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const register = async (
    invoiceData: Omit<Partial<SupplierInvoice>, 'id' | 'internal_ref' | 'created_by' | 'created_at' | 'updated_at'>,
    itemsData: Array<Omit<Partial<SupplierInvoiceItem>, 'id' | 'supplier_invoice_id' | 'created_at'>>,
    trn?: string | null
  ) => {
    const doc = await supplierInvoiceService.registerSupplierInvoice(invoiceData, itemsData, trn);
    await fetchDetail();
    return doc;
  };

  const approve = async () => {
    await supplierInvoiceService.approveSupplierInvoice(id);
    await fetchDetail();
  };

  const overrideException = async (reason: string) => {
    await supplierInvoiceService.overrideMatchException(id, reason);
    await fetchDetail();
  };

  const recordPayment = async (
    paymentData: {
      supplier_id: string;
      amount: number;
      payment_date: string;
      method: string;
      reference?: string;
      bank_account?: string;
      notes?: string;
    },
    allocations: Array<{ invoiceId: string; amount: number }>
  ) => {
    const payment = await supplierInvoiceService.recordSupplierPayment(paymentData, allocations);
    await fetchDetail();
    return payment;
  };

  return {
    invoice,
    loading,
    error,
    refetch: fetchDetail,
    register,
    approve,
    overrideException,
    recordPayment
  };
}
export default useSupplierInvoices;
