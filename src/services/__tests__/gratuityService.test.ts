import { describe, it, expect } from 'vitest';
import { gratuityService } from '@/services/gratuityService';

const base = {
  basicSalary: 3000,
  totalSalary: 3000,
  unpaidLeaveDays: 0,
  leaveBalanceDays: 0,
  pendingSalaryDays: 0,
  outstandingAdvances: 0,
};

describe('UAE EOSB / gratuity (Decree-Law 33/2021)', () => {
  it('pays no gratuity below one year of service', () => {
    const r = gratuityService.calculateEOSB({
      ...base,
      joinDate: '2024-01-01',
      exitDate: '2024-06-01',
    });
    expect(r.gratuityAmount).toBe(0);
  });

  it('pays 21 days of basic for the first full year', () => {
    const r = gratuityService.calculateEOSB({
      ...base,
      joinDate: '2023-01-01',
      exitDate: '2024-01-01', // 366 inclusive days
      unpaidLeaveDays: 1, // -> exactly 365 effective service days
    });
    expect(r.effectiveServiceDays).toBe(365);
    // 21 days * (basic/30) = 21 * 100 = 2100
    expect(r.gratuityAmount).toBeCloseTo(2100, 2);
  });

  it('caps gratuity at 24 months of basic', () => {
    const r = gratuityService.calculateEOSB({
      ...base,
      joinDate: '1990-01-01',
      exitDate: '2030-01-01', // 40 years -> well over the cap
    });
    expect(r.gratuityAmount).toBe(3000 * 24); // 72,000
  });

  it('encashes leave at total salary / 30', () => {
    const r = gratuityService.calculateEOSB({
      ...base,
      totalSalary: 6000,
      leaveBalanceDays: 10,
      joinDate: '2024-01-01',
      exitDate: '2024-03-01', // under a year -> gratuity 0
    });
    expect(r.leaveEncashmentAmount).toBe(2000); // 10 * (6000/30)
    expect(r.totalSettlement).toBe(2000);
  });

  it('deducts outstanding advances from the settlement', () => {
    const r = gratuityService.calculateEOSB({
      ...base,
      totalSalary: 6000,
      leaveBalanceDays: 10,
      outstandingAdvances: 500,
      joinDate: '2024-01-01',
      exitDate: '2024-03-01',
    });
    expect(r.totalSettlement).toBe(1500); // 2000 leave - 500 advances
  });
});
