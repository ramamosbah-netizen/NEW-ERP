// ============================================================
// JEET ERP — Client Receipts & Allocations Hook
// ============================================================

import { logger } from '@/lib/logger';
import { useState, useEffect, useCallback } from 'react';
import { paymentService } from '@/services/paymentService';
import type { ClientPayment } from '@/types/finance.types';

export function usePayments(filters: { clientId?: string } = {}) {
  const [payments, setPayments] = useState<ClientPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchList = useCallback(async () => {
    try {
      setLoading(true);
      const data = await paymentService.fetchPayments(filters);
      setPayments(data);
      setError(null);
    } catch (err: any) {
      logger.error('Error in usePayments hook:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const record = async (
    paymentData: Omit<Partial<ClientPayment>, 'id' | 'payment_number' | 'created_by' | 'created_at'>,
    allocations: Array<{ invoiceId: string; amount: number }>
  ) => {
    try {
      const payment = await paymentService.recordPayment(paymentData, allocations);
      await fetchList();
      return payment;
    } catch (err: any) {
      logger.error('Error recording payment in hook:', err);
      throw err;
    }
  };

  return {
    payments,
    loading,
    error,
    refetch: fetchList,
    record,
  };
}
