// ============================================================
// AURA 0.2 — Margin Engine (pure)
// Watches commercial events, computes gross margin and flags
// deals below the margin guardrail. No DB / no CORE access.
// ============================================================

import type { IngestEvent, EngineOutput } from '@/types/intelligence.types';
import { ctx, emptyOutput, pickNum } from './engine-utils';

const MARGIN_GUARDRAIL = 10; // percent
const RELEVANT = new Set([
  'comparison.approved', 'comparison.submitted',
  'quotation.submitted', 'quotation.approved', 'quotation.accepted_by_client',
]);

export function analyzeMargin(e: IngestEvent): EngineOutput {
  const out = emptyOutput();
  if (!RELEVANT.has(e.event_type)) return out;

  const p = e.payload || {};
  const c = ctx(e);

  let marginPct = pickNum(p, ['margin_pct', 'marginPercent', 'margin_percentage', 'margin']);
  const cost = pickNum(p, ['cost', 'total_cost', 'buy', 'buy_price']);
  const price = pickNum(p, ['price', 'total_price', 'sell', 'sell_price', 'amount', 'value']);
  if (marginPct === undefined && cost !== undefined && price !== undefined && price > 0) {
    marginPct = ((price - cost) / price) * 100;
  }
  if (marginPct === undefined) return out;

  const scope = e.event_type.split('.')[0];
  out.insights.push({
    ...c, engine: 'MARGIN', kind: 'MARGIN',
    title: `Margin ${marginPct.toFixed(1)}% on ${scope}`,
    detail: `Computed gross margin for this ${scope}.`,
    metrics: { margin_pct: Number(marginPct.toFixed(2)), cost: cost ?? null, price: price ?? null },
    confidence: 0.8,
  });

  if (marginPct < MARGIN_GUARDRAIL) {
    out.recommendations.push({
      ...c, engine: 'MARGIN', action_type: 'REVIEW_MARGIN',
      priority: marginPct < 5 ? 'HIGH' : 'MEDIUM',
      title: `Thin margin (${marginPct.toFixed(1)}%) — review before commit`,
      detail: `Gross margin is below the ${MARGIN_GUARDRAIL}% guardrail.`,
      rationale: 'A low margin erodes profitability and leaves little buffer to absorb variations, delays or claims.',
      expected_impact: { margin_pct: Number(marginPct.toFixed(2)), guardrail: MARGIN_GUARDRAIL },
    });
  }

  return out;
}
