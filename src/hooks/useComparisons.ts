// ============================================================
// JEET ERP — Supplier Comparison Sheet React Hooks
// Hooks for data fetching, scoring recomputations, and state updates
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  comparisonService, 
  type ComparisonFilters 
} from '@/lib/comparison-service';
import { scoreOffers } from '@/lib/comparison-scoring';

// 1. Fetch Comparison Registry List
export function useComparisons(filters: ComparisonFilters = {}) {
  const [comparisons, setComparisons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchList = useCallback(async () => {
    try {
      setLoading(true);
      const data = await comparisonService.fetchComparisons(filters);
      setComparisons(data);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching comparisons:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  return { comparisons, loading, error, refetch: fetchList };
}

// 2. Fetch Single Comparison Details and Actions
export function useComparison(id: string) {
  const [comparison, setComparison] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await comparisonService.fetchComparisonById(id);
      setComparison(data);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching comparison details:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  // Actions
  const addOffer = async (itemId: string, offerData: any) => {
    const res = await comparisonService.addOffer(itemId, offerData);
    await fetchDetail();
    return res;
  };

  const updateOffer = async (offerId: string, offerData: any) => {
    const res = await comparisonService.updateOffer(offerId, offerData);
    await fetchDetail();
    return res;
  };

  const deleteOffer = async (offerId: string) => {
    const res = await comparisonService.deleteOffer(offerId);
    await fetchDetail();
    return res;
  };

  const selectSupplier = async (itemId: string, offerId: string | null, overrideReason: string) => {
    const res = await comparisonService.selectSupplier(itemId, offerId, overrideReason);
    await fetchDetail();
    return res;
  };

  const removeSupplierColumn = async (supplierName: string) => {
    const res = await comparisonService.removeSupplierColumn(id, supplierName);
    await fetchDetail();
    return res;
  };

  const renameSupplierColumn = async (oldName: string, newName: string) => {
    const res = await comparisonService.renameSupplierColumn(id, oldName, newName);
    await fetchDetail();
    return res;
  };

  const saveOffers = async (offersToSave: any[]) => {
    const res = await comparisonService.saveOffers(offersToSave, id);
    await fetchDetail();
    return res;
  };

  const bulkSelectRecommended = async () => {
    const res = await comparisonService.bulkSelectRecommended(id);
    await fetchDetail();
    return res;
  };

  const recalculateAll = async () => {
    const res = await comparisonService.recalculateAll(id);
    await fetchDetail();
    return res;
  };

  const submitForReview = async () => {
    const res = await comparisonService.submitForReview(id);
    await fetchDetail();
    return res;
  };

  const commercialApprove = async (comment: string) => {
    const res = await comparisonService.commercialApprove(id, comment);
    await fetchDetail();
    return res;
  };

  const commercialReject = async (reason: string) => {
    const res = await comparisonService.commercialReject(id, reason);
    await fetchDetail();
    return res;
  };

  const gmApprove = async (comment: string) => {
    const res = await comparisonService.gmApprove(id, comment);
    await fetchDetail();
    return res;
  };

  const gmReject = async (reason: string) => {
    const res = await comparisonService.gmReject(id, reason);
    await fetchDetail();
    return res;
  };

  const createRevision = async () => {
    const newId = await comparisonService.createRevision(id);
    return newId;
  };

  const pushPricesToCatalog = async () => {
    const res = await comparisonService.pushPricesToCatalog(id);
    return res;
  };

  return {
    comparison,
    loading,
    error,
    refetch: fetchDetail,
    actions: {
      addOffer,
      updateOffer,
      deleteOffer,
      selectSupplier,
      removeSupplierColumn,
      renameSupplierColumn,
      saveOffers,
      bulkSelectRecommended,
      recalculateAll,
      submitForReview,
      commercialApprove,
      commercialReject,
      gmApprove,
      gmReject,
      createRevision,
      pushPricesToCatalog
    }
  };
}

// 3. Debounced scoring computation hook
export function useComparisonScoring(
  offers: any[],
  weights: any,
  histories: Record<string, number>,
  delay: number = 150
) {
  const [scoredOffers, setScoredOffers] = useState<any[]>([]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (!offers || offers.length === 0) {
        setScoredOffers([]);
        return;
      }
      const scored = scoreOffers(offers, weights, histories);
      setScoredOffers(scored);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [offers, weights, histories, delay]);

  return scoredOffers;
}

// 4. Scoring Weights state settings
export function useScoringWeights() {
  const [weights, setWeights] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchWeights = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('comparison_scoring_weights')
        .select('*')
        .single();
      
      if (error) throw error;
      setWeights(data);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching scoring weights:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const saveWeights = async (newWeights: any) => {
    const { error } = await supabase
      .from('comparison_scoring_weights')
      .update({
        weight_price: newWeights.weight_price,
        weight_delivery: newWeights.weight_delivery,
        weight_history: newWeights.weight_history,
        weight_payment: newWeights.weight_payment,
        weight_compliance: newWeights.weight_compliance,
        updated_at: new Date().toISOString()
      })
      .eq('id', true);

    if (error) throw error;
    await fetchWeights();
    return true;
  };

  useEffect(() => {
    fetchWeights();
  }, [fetchWeights]);

  return { weights, loading, error, saveWeights, refetch: fetchWeights };
}
