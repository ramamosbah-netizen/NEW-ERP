import { describe, it, expect } from 'vitest';
import {
  round2,
  round4,
  calculateInvoiceLine,
  calculateInvoiceTotals,
} from '@/services/invoiceMathService';

describe('round helpers', () => {
  it('round2 keeps two decimals', () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(2.344)).toBe(2.34);
    expect(round2(2.345)).toBe(2.35);
  });

  it('round4 keeps four decimals', () => {
    expect(round4(1.00005)).toBe(1.0001);
    expect(round4(0.123456)).toBe(0.1235);
  });
});

describe('calculateInvoiceLine (FTA line-level VAT)', () => {
  it('computes taxable, VAT and total at 5% by default', () => {
    expect(calculateInvoiceLine({ quantity: 10, unit_price: 100 })).toEqual({
      taxable_amount: 1000,
      vat_amount: 50,
      line_total: 1050,
    });
  });

  it('honours a custom VAT rate (e.g. zero-rated)', () => {
    expect(calculateInvoiceLine({ quantity: 4, unit_price: 25, vat_rate: 0 })).toEqual({
      taxable_amount: 100,
      vat_amount: 0,
      line_total: 100,
    });
  });

  it('clamps negative quantity and price to zero', () => {
    expect(calculateInvoiceLine({ quantity: -5, unit_price: 100 }).taxable_amount).toBe(0);
    expect(calculateInvoiceLine({ quantity: 5, unit_price: -100 }).taxable_amount).toBe(0);
  });

  it('rounds VAT at the line level (half-up)', () => {
    // 33.33 * 5% = 1.6665 -> 1.67
    expect(calculateInvoiceLine({ quantity: 1, unit_price: 33.33 }).vat_amount).toBe(1.67);
  });
});

describe('calculateInvoiceTotals', () => {
  it('sums lines and applies 5% VAT with no deductions', () => {
    const out = calculateInvoiceTotals({
      items: [
        { quantity: 10, unit_price: 100 },
        { quantity: 2, unit_price: 50 },
      ],
    });
    expect(out.taxable_amount).toBe(1100);
    expect(out.vat_amount).toBe(55);
    expect(out.total_incl_vat).toBe(1155);
    expect(out.gross_claim).toBe(1100);
    expect(out.net_due).toBe(1155);
  });

  it('holds retention against the gross claim', () => {
    const out = calculateInvoiceTotals({
      items: [{ quantity: 10, unit_price: 100 }],
      retention_rate: 0.1,
    });
    expect(out.retention_held).toBe(100); // 10% of 1000 gross
    expect(out.net_due).toBe(950); // 1050 incl vat - 100 retention
  });

  it('recovers the advance pro-rata to contract value', () => {
    const out = calculateInvoiceTotals({
      items: [{ quantity: 1, unit_price: 1 }],
      gross_claim_override: 100_000,
      contract_value: 1_000_000,
      total_advance_amount: 200_000,
    });
    // claim% = 100k / 1M = 10% -> recover 10% of the 200k advance
    expect(out.advance_recovery).toBe(20_000);
  });

  it('recovers the advance by explicit rate when provided', () => {
    const out = calculateInvoiceTotals({
      items: [{ quantity: 1, unit_price: 1 }],
      gross_claim_override: 100_000,
      total_advance_amount: 50_000,
      advance_recovery_rate: 0.2,
    });
    expect(out.advance_recovery).toBe(20_000); // 20% of the 100k claim
  });

  it('net due = (taxable + vat) - advance - retention', () => {
    const out = calculateInvoiceTotals({
      items: [{ quantity: 100, unit_price: 100 }], // 10,000 taxable
      gross_claim_override: 10_000,
      contract_value: 100_000,
      total_advance_amount: 20_000,
      retention_rate: 0.05,
    });
    // vat = 500; advance = (10k/100k)*20k = 2000; retention = 5% of 10k = 500
    expect(out.vat_amount).toBe(500);
    expect(out.advance_recovery).toBe(2000);
    expect(out.retention_held).toBe(500);
    expect(out.net_due).toBe(10_500 - 2000 - 500);
  });
});
