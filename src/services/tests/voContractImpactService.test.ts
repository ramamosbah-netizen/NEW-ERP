// ============================================================
// JEET ERP — Variation Order Calculations Unit Tests
// ============================================================
import { describe, it, expect } from 'vitest';
import {
  calculateVOMargin,
  calculateContractImpact,
  validateInvoiceCeiling,
} from '../voContractImpactService';

describe('calculateVOMargin', () => {
  it('computes margin for a positive addition VO', () => {
    const m = calculateVOMargin(25000, 15000);
    expect(m.marginAmount).toBe(10000);
    expect(m.marginPct).toBe(40);
  });

  it('computes margin for an omission (negative) VO', () => {
    const m = calculateVOMargin(-12000, -8000);
    expect(m.marginAmount).toBe(-4000);
    expect(m.marginPct).toBe(33.33);
  });

  it('handles a zero-value VO without dividing by zero', () => {
    const m = calculateVOMargin(0, 0);
    expect(m.marginAmount).toBe(0);
    expect(m.marginPct).toBe(0);
  });
});

describe('calculateContractImpact', () => {
  const approvedVOs = [
    { sell_amount: 25000, time_impact_days: 15 },
    { sell_amount: -12000, time_impact_days: -5 },
    { sell_amount: 5000, time_impact_days: 2 },
  ];

  it('recomputes revised contract value and completion date from approved VOs', () => {
    const impact = calculateContractImpact({
      originalContractValue: 500000,
      plannedEndDate: '2026-12-31',
      approvedVOs,
    });
    expect(impact.voCount).toBe(3);
    expect(impact.voTotalSell).toBe(18000); // 25k - 12k + 5k
    expect(impact.revisedContractValue).toBe(518000);
    // EOT net = 15 - 5 + 2 = 12 days -> 2026-12-31 + 12 = 2027-01-12
    expect(impact.revisedEndDate).toBe('2027-01-12');
  });
});

describe('validateInvoiceCeiling (over-claim guard)', () => {
  const revisedValue = 518000;

  it('allows a progress claim under the ceiling', () => {
    const g = validateInvoiceCeiling(revisedValue, 400000, 100000);
    expect(g.valid).toBe(true);
    expect(g.exceededBy).toBe(0);
  });

  it('allows a progress claim exactly at the ceiling', () => {
    const g = validateInvoiceCeiling(revisedValue, 500000, 18000);
    expect(g.valid).toBe(true);
  });

  it('blocks a progress claim above the ceiling and reports the overage', () => {
    const g = validateInvoiceCeiling(revisedValue, 500000, 20000);
    expect(g.valid).toBe(false);
    expect(g.exceededBy).toBe(2000);
  });
});
