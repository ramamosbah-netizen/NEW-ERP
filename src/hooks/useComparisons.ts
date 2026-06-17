// ============================================================
// Aura ERP — Supplier Comparison Sheet React Hooks (React Query)
// Data hooks use TanStack Query; the debounced scoring hook stays a pure
// client-side compute (no fetching).
// ============================================================

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { comparisonService, type ComparisonFilters } from '@/lib/comparison-service';
import { scoreOffers } from '@/lib/comparison-scoring';

const cmpKeys = {
  lists: ['comparisons', 'list'] as const,
  list: (f: ComparisonFilters) => ['comparisons', 'list', f] as const,
  detail: (id: string) => ['comparisons', 'detail', id] as const,
  weights: ['comparisons', 'weights'] as const,
};

// 1. Comparison registry list
export function useComparisons(filters: ComparisonFilters = {}) {
  const q = useQuery({ queryKey: cmpKeys.list(filters), queryFn: () => comparisonService.fetchComparisons(filters) });
  return {
    comparisons: q.data ?? [],
    loading: q.isPending,
    error: (q.error as Error | null) ?? null,
    refetch: q.refetch,
  };
}

// 2. Single comparison detail + actions
export function useComparison(id: string) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: cmpKeys.detail(id), queryFn: () => comparisonService.fetchComparisonById(id), enabled: !!id });

  const inv = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: cmpKeys.detail(id) }),
      qc.invalidateQueries({ queryKey: cmpKeys.lists }),
    ]);
  };

  const addOffer = async (itemId: string, offerData: any) => { const r = await comparisonService.addOffer(itemId, offerData); await inv(); return r; };
  const updateOffer = async (offerId: string, offerData: any) => { const r = await comparisonService.updateOffer(offerId, offerData); await inv(); return r; };
  const deleteOffer = async (offerId: string) => { const r = await comparisonService.deleteOffer(offerId); await inv(); return r; };
  const selectSupplier = async (itemId: string, offerId: string | null, overrideReason: string) => { const r = await comparisonService.selectSupplier(itemId, offerId, overrideReason); await inv(); return r; };
  const removeSupplierColumn = async (supplierName: string) => { const r = await comparisonService.removeSupplierColumn(id, supplierName); await inv(); return r; };
  const setItemException = async (itemId: string, isException: boolean, reason: string | null) => { const r = await comparisonService.setItemException(itemId, isException, reason); await inv(); return r; };
  const renameSupplierColumn = async (oldName: string, newName: string) => { const r = await comparisonService.renameSupplierColumn(id, oldName, newName); await inv(); return r; };
  const saveOffers = async (offersToSave: any[]) => { const r = await comparisonService.saveOffers(offersToSave, id); await inv(); return r; };
  const bulkSelectRecommended = async () => { const r = await comparisonService.bulkSelectRecommended(id); await inv(); return r; };
  const recalculateAll = async () => { const r = await comparisonService.recalculateAll(id); await inv(); return r; };
  const submitForReview = async () => { const r = await comparisonService.submitForReview(id); await inv(); return r; };
  const commercialApprove = async (comment: string) => { const r = await comparisonService.commercialApprove(id, comment); await inv(); return r; };
  const commercialReject = async (reason: string) => { const r = await comparisonService.commercialReject(id, reason); await inv(); return r; };
  const gmApprove = async (comment: string) => { const r = await comparisonService.gmApprove(id, comment); await inv(); return r; };
  const gmReject = async (reason: string) => { const r = await comparisonService.gmReject(id, reason); await inv(); return r; };
  const createRevision = async () => { const newId = await comparisonService.createRevision(id); await qc.invalidateQueries({ queryKey: cmpKeys.lists }); return newId; };
  const pushPricesToCatalog = async () => comparisonService.pushPricesToCatalog(id);

  return {
    comparison: q.data ?? null,
    loading: q.isPending,
    error: (q.error as Error | null) ?? null,
    refetch: q.refetch,
    actions: {
      addOffer, updateOffer, deleteOffer, selectSupplier, removeSupplierColumn,
      renameSupplierColumn, setItemException, saveOffers, bulkSelectRecommended,
      recalculateAll, submitForReview, commercialApprove, commercialReject,
      gmApprove, gmReject, createRevision, pushPricesToCatalog,
    },
  };
}

// 3. Debounced scoring computation (pure compute — unchanged)
export function useComparisonScoring(
  offers: any[],
  weights: any,
  histories: Record<string, number>,
  delay: number = 150,
) {
  const [scoredOffers, setScoredOffers] = useState<any[]>([]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (!offers || offers.length === 0) {
        setScoredOffers([]);
        return;
      }
      setScoredOffers(scoreOffers(offers, weights, histories));
    }, delay);
    return () => clearTimeout(handler);
  }, [offers, weights, histories, delay]);

  return scoredOffers;
}

// 4. Scoring weights
export function useScoringWeights() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: cmpKeys.weights,
    queryFn: async () => {
      const { data, error } = await supabase.from('comparison_scoring_weights').select('*').single();
      if (error) throw error;
      return data;
    },
  });

  const saveWeights = async (newWeights: any) => {
    const { error } = await supabase
      .from('comparison_scoring_weights')
      .update({
        weight_price: newWeights.weight_price,
        weight_delivery: newWeights.weight_delivery,
        weight_history: newWeights.weight_history,
        weight_payment: newWeights.weight_payment,
        weight_compliance: newWeights.weight_compliance,
        updated_at: new Date().toISOString(),
      })
      .eq('id', true);
    if (error) throw error;
    await qc.invalidateQueries({ queryKey: cmpKeys.weights });
    return true;
  };

  return {
    weights: q.data ?? null,
    loading: q.isPending,
    error: (q.error as Error | null) ?? null,
    saveWeights,
    refetch: q.refetch,
  };
}
