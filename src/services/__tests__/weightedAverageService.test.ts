import { describe, it, expect } from 'vitest';
import { weightedAverageService as wac } from '@/services/weightedAverageService';

describe('weighted average cost', () => {
  it('blends current value with the new receipt', () => {
    // (100*10 + 100*12) / 200 = 11
    expect(wac.calculateNewAverage(100, 10, 100, 12)).toBe(11);
  });

  it('uses the receipt cost when there is no stock on hand', () => {
    expect(wac.calculateNewAverage(0, 0, 50, 12)).toBe(12);
    expect(wac.calculateNewAverage(-5, 8, 50, 12)).toBe(12);
  });

  it('keeps the current average when nothing usable is received', () => {
    expect(wac.calculateNewAverage(100, 10, 0, 99)).toBe(10); // addQty <= 0
    expect(wac.calculateNewAverage(100, 10, 50, 0)).toBe(10); // unitCost <= 0
    expect(wac.calculateNewAverage(100, 10, 50, -3)).toBe(10);
  });

  it('rounds the blended cost to 4 decimals', () => {
    // (3*10 + 1*11) / 4 = 10.25
    expect(wac.calculateNewAverage(3, 10, 1, 11)).toBe(10.25);
    // (1*1 + 2*2) / 3 = 1.6666... -> 1.6667
    expect(wac.calculateNewAverage(1, 1, 2, 2)).toBe(1.6667);
  });

  it('coerces non-numeric input safely', () => {
    expect(wac.calculateNewAverage(NaN as unknown as number, 10, 10, 10)).toBe(10);
  });
});
