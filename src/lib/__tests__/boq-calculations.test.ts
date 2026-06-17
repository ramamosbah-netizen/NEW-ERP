import { describe, it, expect } from 'vitest';
import {
  createEmptyItem,
  createDefaultCostElements,
  calculateItemFinancials,
  recalculateAll,
  canRoleApprove,
  getNextApprovalStatus,
  type BOQItem,
} from '@/lib/boq-calculations';

function sampleItem(): BOQItem {
  return {
    ...createEmptyItem(),
    quantity: 10,
    material_unit_cost: 100,
    override_settings: true, // use the item's own rates, not globals
    wastage_pct: 5,
    risk_pct: 2,
    site_overhead_pct: 3,
    profit_pct: 15,
    labor_technician_hours: 2,
    labor_technician_count: 1,
    labor_technician_rate: 15,
    labor_engineer_count: 0,
    labor_pm_count: 0,
  };
}

describe('calculateItemFinancials (cost build-up)', () => {
  it('builds material -> direct -> total -> selling price', () => {
    const r = calculateItemFinancials(sampleItem());
    expect(r.material_total_cost).toBe(1000); // 10 * 100
    expect(r.wastage_cost).toBe(50); // 5% of 1000
    expect(r.gross_labour_cost).toBe(300); // 2h * 1 * 15 * 10
    expect(r.direct_cost).toBe(1350); // 1000 + 300 + 50
    expect(r.risk_cost).toBe(27); // 2% of 1350
    expect(r.site_overhead_cost).toBe(40.5); // 3% of 1350
    expect(r.total_cost).toBe(1417.5);
    expect(r.profit_value).toBe(212.63); // 15% of 1417.5, half-up
    expect(r.total_price).toBe(1630.13);
    expect(r.unit_price).toBe(163.01);
  });
});

describe('recalculateAll (aggregation)', () => {
  it('aggregates a single overridden item to the same totals', () => {
    const fin = recalculateAll([sampleItem()], createDefaultCostElements(), 15, 1);
    expect(fin.supply_total).toBe(1000);
    expect(fin.direct_total).toBe(1350);
    expect(fin.indirect_total).toBe(67.5); // risk 27 + overhead 40.5
    expect(fin.profit_value).toBe(212.63);
    expect(fin.total_selling_price).toBe(1630.13);
  });
});

describe('BOQ approval state machine', () => {
  it('lets each role approve only its stage', () => {
    expect(canRoleApprove('engineer', 'submitted')).toBe(true);
    expect(canRoleApprove('engineer', 'draft')).toBe(false);
    expect(canRoleApprove('manager', 'engineer_approved')).toBe(true);
    expect(canRoleApprove('manager', 'submitted')).toBe(false);
  });

  it('lets admin approve any pending stage', () => {
    expect(canRoleApprove('admin', 'submitted')).toBe(true);
    expect(canRoleApprove('admin', 'manager_approved')).toBe(true);
    expect(canRoleApprove('admin', 'finance_approved')).toBe(false);
  });

  it('advances to the correct next status', () => {
    expect(getNextApprovalStatus('engineer', 'submitted')).toBe('engineer_approved');
    expect(getNextApprovalStatus('manager', 'engineer_approved')).toBe('manager_approved');
    expect(getNextApprovalStatus('account', 'manager_approved')).toBe('finance_approved');
    expect(getNextApprovalStatus('manager', 'submitted')).toBeNull();
  });
});
