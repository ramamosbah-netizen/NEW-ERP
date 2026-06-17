// ============================================================
// Aura ERP — General Ledger hooks (React Query)
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { glService } from '@/services/glService';

const glKeys = {
  trialBalance: ['gl', 'trial-balance'] as const,
  periods: ['gl', 'periods'] as const,
  drafts: ['gl', 'drafts'] as const,
};

export function useTrialBalance() {
  return useQuery({ queryKey: glKeys.trialBalance, queryFn: () => glService.trialBalance() });
}

export function useAccountingPeriods() {
  return useQuery({ queryKey: glKeys.periods, queryFn: () => glService.listPeriods() });
}

export function useDraftEntries() {
  return useQuery({ queryKey: glKeys.drafts, queryFn: () => glService.draftEntries() });
}

export function usePeriodActions() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: glKeys.periods });

  const close = useMutation({ mutationFn: (code: string) => glService.closePeriod(code), onSuccess: invalidate });
  const reopen = useMutation({ mutationFn: (code: string) => glService.reopenPeriod(code), onSuccess: invalidate });

  return { close, reopen };
}
