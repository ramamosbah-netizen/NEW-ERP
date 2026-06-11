// ============================================================
// JEET ERP — Pure Scoring Engine for Supplier Comparison
// Weight-based composite multi-criteria scoring algorithm
// ============================================================

export type ScoringWeights = {
  weight_price: number;
  weight_delivery: number;
  weight_history: number;
  weight_payment: number;
  weight_compliance: number;
};

export type PerformanceHistory = {
  supplier_name: string;
  composite_history_score: number;
};

export type InputOffer = {
  id?: string;
  supplier_name: string;
  unit_price: number;
  delivery_days?: number | null;
  payment_terms_days?: number;
  is_compliant: boolean;
  score_history?: number;
  [key: string]: any;
};

export type ScoredOffer = InputOffer & {
  score_price: number;
  score_delivery: number;
  score_history: number;
  score_payment: number;
  score_compliance: number;
  score_total: number;
  rank: number;
  is_recommended: boolean;
  delivery_tbc?: boolean;
};

const round2 = (num: number): number => {
  return Math.round((num + Number.EPSILON) * 100) / 100;
};

/**
 * Pure function to calculate composite scores and ranks for a set of offers under a single line item.
 */
export function scoreOffers(
  offers: InputOffer[],
  weights: ScoringWeights = {
    weight_price: 45,
    weight_delivery: 20,
    weight_history: 20,
    weight_payment: 10,
    weight_compliance: 5
  },
  historyMap: Record<string, number> = {}
): ScoredOffer[] {
  if (!offers || offers.length === 0) return [];

  // 1. Identify reference values across compliant offers
  const compliantOffers = offers.filter(o => o.is_compliant);
  const priceReference = compliantOffers.length > 0 ? compliantOffers : offers;
  
  const minPrice = priceReference.length > 0 
    ? Math.min(...priceReference.map(o => o.unit_price).filter(p => p > 0)) 
    : 0;

  const deliveryDaysList = priceReference
    .map(o => o.delivery_days)
    .filter((d): d is number => typeof d === 'number' && d >= 0);
  const minDelivery = deliveryDaysList.length > 0 ? Math.min(...deliveryDaysList) : 0;

  // 2. Score each individual offer
  const scoredRaw: ScoredOffer[] = offers.map(offer => {
    // A. Price Score: Lower price = higher score
    let score_price = 0;
    if (offer.unit_price > 0 && minPrice > 0) {
      score_price = (minPrice / offer.unit_price) * 100;
    }

    // B. Delivery Score: Lower delivery days = higher score
    let score_delivery = 50;
    let delivery_tbc = false;
    if (typeof offer.delivery_days === 'number' && offer.delivery_days >= 0) {
      if (offer.delivery_days === 0 && minDelivery === 0) {
        score_delivery = 100;
      } else if (offer.delivery_days > 0 && minDelivery > 0) {
        score_delivery = (minDelivery / offer.delivery_days) * 100;
      }
    } else {
      delivery_tbc = true;
    }

    // C. History Score: default is 50, otherwise matching history map
    const nameKey = offer.supplier_name.toLowerCase().trim();
    const score_history = historyMap[nameKey] ?? offer.score_history ?? 50;

    // D. Payment terms score: capped at 90 days = 100%
    const termsDays = offer.payment_terms_days ?? 30;
    const score_payment = Math.min(termsDays / 90, 1) * 100;

    // E. Compliance score: 100 if compliant, else 0
    const score_compliance = offer.is_compliant ? 100 : 0;

    // F. Weighted total
    const score_total_raw =
      (score_price * weights.weight_price +
        score_delivery * weights.weight_delivery +
        score_history * weights.weight_history +
        score_payment * weights.weight_payment +
        score_compliance * weights.weight_compliance) /
      100;

    return {
      ...offer,
      score_price: round2(score_price),
      score_delivery: round2(score_delivery),
      score_history: round2(score_history),
      score_payment: round2(score_payment),
      score_compliance: round2(score_compliance),
      score_total: round2(score_total_raw),
      delivery_tbc,
      rank: 999, // default placeholder
      is_recommended: false
    };
  });

  // 3. Sort by compliance and score, then assign ranks
  // Compliant offers always rank higher than non-compliant ones
  const sorted = [...scoredRaw].sort((a, b) => {
    if (a.is_compliant && !b.is_compliant) return -1;
    if (!a.is_compliant && b.is_compliant) return 1;
    return b.score_total - a.score_total;
  });

  const finalScored = sorted.map((offer, index) => {
    return {
      ...offer,
      rank: index + 1,
      is_recommended: index === 0 // Rank 1 is recommended
    };
  });

  // Re-sort back to the original input order if IDs are present, or keep ranked order.
  // Standard matrix layouts read them in sorted/ranked order anyway, so returning ranked order is perfect.
  return finalScored;
}
