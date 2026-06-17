// ============================================================
// Aura ERP — Client Receipts & Allocations Hook (React Query)
// ============================================================

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { paymentService } from '@/services/paymentService';
import type { ClientPayment } from '@/types/finance.types';

const paymentKeys = {
  lists: ['client-payments', 'list'] as const,
  list: (f: { clientId?: string }) => ['client-payments', 'list', f] as const,
};

export function usePayments(filters: { clientId?: string } = {}) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: paymentKeys.list(filters), queryFn: () => paymentService.fetchPayments(filters) });

  const record = async (
    paymentData: Omit<Partial<ClientPayment>, 'id' | 'payment_number' | 'created_by' | 'created_at'>,
    allocations: Array<{ invoiceId: string; amount: number }>,
  ) => {
    const payment = await paymentService.recordPayment(paymentData, allocations);
    await Promise.all([
      qc.invalidateQueries({ queryKey: paymentKeys.lists }),
      // a receipt changes invoice balances too
      qc.invalidateQueries({ queryKey: ['client-invoices'] }),
    ]);
    return payment;
  };

  return {
    payments: q.data ?? [],
    loading: q.isPending,
    error: (q.error as Error | null) ?? null,
    refetch: q.refetch,
    record,
  };
}
