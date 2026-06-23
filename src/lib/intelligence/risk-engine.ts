// ============================================================
// AURA 0.2 — Risk Engine (Phase 2A · Batch 1, pure)
//
// Event-driven, deterministic, no LLM. Consumes ONE event from the ledger and
// emits Risk Alerts only. Coverage = exactly the seven Batch-1 events.
//
// Scoring is FACTOR-SUMMED: each rule emits RiskFactor[] with point `impact`s;
// score = clamp(Σ impact, 0, 100) → severity band. So every score is traceable.
// Bands: 0-39 LOW · 40-69 MEDIUM · 70-89 HIGH · 90-100 CRITICAL.
//
// Payload-tolerant: a missing field drops that factor / lowers confidence — it
// never throws and never stops the processor. No DB / no Core access.
// ============================================================

import type { IngestEvent, EngineOutput, RiskDomain, RiskFactor } from '@/types/intelligence.types';
import { ctx, emptyOutput, pickNum, pickStr, clamp, severityFromScore, dedupKey, aed } from './engine-utils';

interface RiskEval {
  title: string;
  detail: string;
  factors: RiskFactor[];
  confidence: number;
}

interface RiskRule {
  domain: RiskDomain;
  category: string;
  scope: 'entity' | 'project'; // which id the dedup fingerprint scopes to
  evaluate: (e: IngestEvent) => RiskEval;
}

/** Build one explainable factor. */
const rf = (key: string, value: number | string | boolean | null, impact: number, label?: string): RiskFactor =>
  ({ key, value: value ?? null, impact: Math.round(impact), label });

const named = (p: Record<string, any>) =>
  pickStr(p, ['project_name', 'name', 'title', 'document_name', 'reference', 'employee_name', 'item_name']);

// ── The seven Batch-1 rules (and ONLY these seven) ─────────────────────────
const RULES: Record<string, RiskRule> = {
  'budget.exceeded': {
    domain: 'FINANCE', category: 'COST', scope: 'project',
    evaluate(e) {
      const p = e.payload;
      const budget = pickNum(p, ['budget', 'approved_budget', 'budget_amount']);
      const actual = pickNum(p, ['actual', 'spent', 'actual_cost', 'amount']);
      let overPct = pickNum(p, ['overrun_pct', 'over_pct', 'overage_pct']);
      if (overPct === undefined && budget !== undefined && actual !== undefined && budget > 0) {
        overPct = ((actual - budget) / budget) * 100;
      }
      const factors: RiskFactor[] = [rf('budget_breach', true, 70, 'Budget exceeded')];
      if (overPct !== undefined) factors.push(rf('overrun_pct', Math.round(overPct), clamp(overPct * 0.5, 0, 30), 'Overrun %'));
      if (budget !== undefined) factors.push(rf('budget', budget, 0, 'Approved budget'));
      if (actual !== undefined) factors.push(rf('actual', actual, 0, 'Actual spend'));
      return {
        title: `Budget exceeded${named(p) ? ` — ${named(p)}` : ''}`,
        detail: 'Recorded spend has exceeded the approved budget. Review cost control and re-baseline if needed.',
        factors, confidence: overPct !== undefined ? 0.9 : 0.6,
      };
    },
  },

  'project.budget_overrun': {
    domain: 'PROJECT', category: 'COST', scope: 'project',
    evaluate(e) {
      const p = e.payload;
      const cpi = pickNum(p, ['cpi', 'cost_performance_index']);
      const budget = pickNum(p, ['budget', 'approved_budget']);
      const eac = pickNum(p, ['eac', 'forecast', 'estimate_at_completion']);
      const factors: RiskFactor[] = [rf('cost_overrun', true, 70, 'Forecast over budget')];
      if (cpi !== undefined) factors.push(rf('cpi', cpi, cpi < 1 ? clamp((1 - cpi) * 100, 0, 30) : 0, 'Cost Performance Index'));
      else if (budget !== undefined && eac !== undefined && budget > 0) {
        factors.push(rf('eac_vs_budget', Math.round(eac - budget), eac > budget ? clamp((eac - budget) / budget * 50, 0, 30) : 0, 'EAC over budget'));
      }
      return {
        title: `Project cost overrun${named(p) ? ` — ${named(p)}` : ''}`,
        detail: 'Cost performance indicates the project will finish over budget (CPI < 1 / EAC > budget).',
        factors, confidence: cpi !== undefined || (budget !== undefined && eac !== undefined) ? 0.85 : 0.6,
      };
    },
  },

  'po.high_value': {
    domain: 'PROCUREMENT', category: 'SPEND', scope: 'entity',
    evaluate(e) {
      const p = e.payload;
      const v = pickNum(p, ['value', 'amount', 'total', 'po_value', 'grand_total']);
      const band = v === undefined ? 0 : v >= 5_000_000 ? 45 : v >= 1_000_000 ? 30 : v >= 100_000 ? 10 : 0;
      const factors: RiskFactor[] = [rf('high_value_po', true, 45, 'High-value PO raised')];
      if (v !== undefined) factors.push(rf('po_value', v, band, 'PO value band'));
      return {
        title: `High-value PO${v !== undefined ? ` — ${aed(v)}` : ''}`,
        detail: 'A high-value purchase order was raised. Confirm budget cover, approval authority and competitive sourcing.',
        factors, confidence: v !== undefined ? 0.85 : 0.5,
      };
    },
  },

  'three_way_match.exception': {
    domain: 'PROCUREMENT', category: 'INVOICE_MATCH', scope: 'entity',
    evaluate(e) {
      const p = e.payload;
      const varc = pickNum(p, ['variance', 'variance_amount', 'diff']);
      const varPct = pickNum(p, ['variance_pct', 'variance_percent']);
      const factors: RiskFactor[] = [rf('match_exception', true, 55, '3-way match mismatch')];
      if (varPct !== undefined) factors.push(rf('variance_pct', varPct, clamp(Math.abs(varPct) * 1.5, 0, 35), 'Variance %'));
      else if (varc !== undefined) factors.push(rf('variance', varc, clamp(Math.abs(varc) / 10_000 * 5, 0, 35), 'Variance amount'));
      else factors.push(rf('variance_unknown', null, 15, 'Variance not quantified'));
      return {
        title: 'Three-way match exception',
        detail: 'PO, GRN and invoice do not reconcile. Investigate before releasing payment.',
        factors, confidence: varPct !== undefined || varc !== undefined ? 0.85 : 0.6,
      };
    },
  },

  'invoice.overdue': {
    domain: 'FINANCE', category: 'OVERDUE', scope: 'entity',
    evaluate(e) {
      const p = e.payload;
      const days = pickNum(p, ['days_overdue', 'days', 'overdue_days']);
      const amount = pickNum(p, ['amount', 'value', 'outstanding', 'balance']);
      const factors: RiskFactor[] = [rf('overdue', true, 50, 'Invoice overdue')];
      if (days !== undefined) factors.push(rf('days_overdue', Math.round(days), clamp(days * 0.4, 0, 40), 'Days overdue'));
      if (amount !== undefined) factors.push(rf('amount', amount, clamp(amount / 100_000 * 2, 0, 10), 'Outstanding amount'));
      return {
        title: `Invoice overdue${days !== undefined ? ` (${Math.round(days)}d)` : ''}${amount !== undefined ? ` — ${aed(amount)}` : ''}`,
        detail: 'An invoice is past its due date and unpaid. Follow up to limit exposure.',
        factors, confidence: days !== undefined ? 0.9 : 0.6,
      };
    },
  },

  'employee.visa_expiring': {
    domain: 'HR', category: 'COMPLIANCE', scope: 'entity',
    evaluate(e) {
      const p = e.payload;
      const days = pickNum(p, ['days_to_expiry', 'days', 'days_remaining']);
      const band = days === undefined ? 0 : days <= 0 ? 40 : days <= 7 ? 35 : days <= 30 ? 20 : days <= 60 ? 5 : 0;
      const factors: RiskFactor[] = [rf('visa_expiring', true, 60, 'Visa / permit expiring')];
      if (days !== undefined) factors.push(rf('days_to_expiry', Math.round(days), band, 'Days to expiry'));
      return {
        title: `Visa / work permit expiring${named(p) ? ` — ${named(p)}` : ''}`,
        detail: 'An employee visa or work permit is nearing expiry. Renew to avoid a labour-compliance breach.',
        factors, confidence: days !== undefined ? 0.9 : 0.6,
      };
    },
  },

  'material.shortage': {
    domain: 'SUPPLY', category: 'SHORTAGE', scope: 'project',
    evaluate(e) {
      const p = e.payload;
      const blocks = p.blocks_project === true || p.critical === true;
      const shortQty = pickNum(p, ['shortage_qty', 'shortage', 'qty_short']);
      const impact = blocks ? 25 : shortQty !== undefined && shortQty > 0 ? 15 : 10;
      const factors: RiskFactor[] = [rf('material_shortage', true, 65, 'Material shortage')];
      factors.push(rf(blocks ? 'blocks_project' : 'shortage_qty', blocks ? true : (shortQty ?? null), impact, blocks ? 'Blocks project' : 'Shortage quantity'));
      return {
        title: `Material shortage${named(p) ? ` — ${named(p)}` : ''}`,
        detail: 'A material shortage threatens project demand. Expedite procurement / reallocate stock.',
        factors, confidence: shortQty !== undefined || blocks ? 0.85 : 0.6,
      };
    },
  },

  // ── Batch 2A additions (temporal CORE signals, emitted by signal-scan) ──────
  'project.delay': {
    domain: 'PROJECT', category: 'SCHEDULE', scope: 'project',
    evaluate(e) {
      const p = e.payload;
      const days = pickNum(p, ['days_overdue', 'days', 'overdue_days']);
      const value = pickNum(p, ['contract_value', 'value', 'amount']);
      const factors: RiskFactor[] = [rf('schedule_overrun', true, 55, 'Past planned end date')];
      if (days !== undefined) factors.push(rf('days_overdue', Math.round(days), clamp(days * 0.5, 0, 35), 'Days overdue'));
      if (value !== undefined) factors.push(rf('contract_value', value, clamp(value / 1_000_000 * 5, 0, 10), 'Contract value'));
      return {
        title: `Project delayed${named(p) ? ` — ${named(p)}` : ''}${days !== undefined ? ` (${Math.round(days)}d)` : ''}`,
        detail: 'The project is past its planned end date and not marked complete. Re-baseline the schedule and assess LD exposure.',
        factors, confidence: days !== undefined ? 0.85 : 0.6,
      };
    },
  },

  'quotation.expiring': {
    domain: 'GENERAL', category: 'COMMERCIAL', scope: 'entity',
    evaluate(e) {
      const p = e.payload;
      const days = pickNum(p, ['days_to_expiry', 'days', 'days_remaining']);
      const value = pickNum(p, ['value', 'amount', 'grand_total', 'grand_total_with_vat']);
      const band = days === undefined ? 0 : days <= 0 ? 30 : days <= 3 ? 25 : days <= 7 ? 15 : 5;
      const factors: RiskFactor[] = [rf('quote_expiring', true, 40, 'Quotation nearing expiry')];
      if (days !== undefined) factors.push(rf('days_to_expiry', Math.round(days), band, 'Days to expiry'));
      if (value !== undefined) factors.push(rf('quote_value', value, clamp(value / 1_000_000 * 15, 0, 30), 'Quote value at risk'));
      return {
        title: `Quotation expiring${named(p) ? ` — ${named(p)}` : ''}${days !== undefined ? ` (${Math.round(days)}d)` : ''}`,
        detail: 'A sent quotation is nearing its validity expiry with no client response. Follow up to avoid losing the deal.',
        factors, confidence: days !== undefined ? 0.85 : 0.6,
      };
    },
  },
};

/** The seven event types this engine covers (Batch 1). */
export const RISK_EVENT_TYPES = Object.keys(RULES);

export function analyzeRisk(e: IngestEvent): EngineOutput {
  const out = emptyOutput();
  const rule = RULES[e.event_type];
  if (!rule) return out; // Batch 1: ignore everything outside the seven

  const res = rule.evaluate(e);
  const score = Math.round(clamp(res.factors.reduce((s, f) => s + (f.impact || 0), 0), 0, 100));
  const scopeId = rule.scope === 'project'
    ? (e.project_id ?? e.entity_id ?? null)
    : (e.entity_id ?? e.project_id ?? null);

  out.riskAlerts.push({
    ...ctx(e),
    engine: 'RISK',
    risk_domain: rule.domain,
    category: rule.category,
    severity: severityFromScore(score),
    score,
    dedup_key: dedupKey(e, scopeId),
    title: res.title,
    detail: res.detail,
    confidence: res.confidence,
    factors: res.factors,
  });

  return out;
}
