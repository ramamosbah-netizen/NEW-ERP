import { describe, it, expect } from 'vitest';
import {
  validateUAETrn,
  performThreeWayMatch,
} from '@/services/threeWayMatchService';

describe('validateUAETrn', () => {
  it('accepts 15-digit TRNs, ignoring spaces and dashes', () => {
    expect(validateUAETrn('100123456700003')).toBe(true);
    expect(validateUAETrn('100 1234 5670 0003')).toBe(true);
    expect(validateUAETrn('100-123456700003')).toBe(true);
  });

  it('rejects anything that is not 15 digits', () => {
    expect(validateUAETrn('12345')).toBe(false);
    expect(validateUAETrn('1001234567000031')).toBe(false);
    expect(validateUAETrn('10012345670000X')).toBe(false);
  });
});

const TRN = '100123456700003';
const poItem = {
  id: 'a',
  description: 'Cat6 cable',
  quantity: 10,
  unit_price: 100,
  qty_received: 5,
  qty_rejected: 0,
};

describe('performThreeWayMatch', () => {
  it('matches when price, quantity and TRN all agree', () => {
    const out = performThreeWayMatch({
      invoiceItems: [{ po_item_id: 'a', description: 'Cat6 cable', quantity: 5, unit_price: 100 }],
      poItems: [poItem],
      previouslyInvoicedQtys: {},
      invoiceSupplierTrn: TRN,
      dbSupplierTrn: TRN,
    });
    expect(out.status).toBe('MATCHED');
    expect(out.results.priceExceptions).toHaveLength(0);
    expect(out.results.qtyExceptions).toHaveLength(0);
    expect(out.results.trnValid).toBe(true);
  });

  it('tolerates a price variance within 0.5%', () => {
    const out = performThreeWayMatch({
      invoiceItems: [{ po_item_id: 'a', description: 'Cat6 cable', quantity: 5, unit_price: 100.4 }],
      poItems: [poItem],
      previouslyInvoicedQtys: {},
      invoiceSupplierTrn: TRN,
      dbSupplierTrn: TRN,
    });
    expect(out.status).toBe('MATCHED');
  });

  it('flags a price exception beyond 0.5%', () => {
    const out = performThreeWayMatch({
      invoiceItems: [{ po_item_id: 'a', description: 'Cat6 cable', quantity: 5, unit_price: 110 }],
      poItems: [poItem],
      previouslyInvoicedQtys: {},
      invoiceSupplierTrn: TRN,
      dbSupplierTrn: TRN,
    });
    expect(out.status).toBe('EXCEPTION');
    expect(out.results.priceExceptions).toHaveLength(1);
    expect(out.results.priceExceptions![0].diffPercent).toBe(10);
  });

  it('flags over-billing beyond received-minus-previously-invoiced', () => {
    const out = performThreeWayMatch({
      invoiceItems: [{ po_item_id: 'a', description: 'Cat6 cable', quantity: 6, unit_price: 100 }],
      poItems: [poItem], // qty_received = 5
      previouslyInvoicedQtys: {},
      invoiceSupplierTrn: TRN,
      dbSupplierTrn: TRN,
    });
    expect(out.status).toBe('EXCEPTION');
    expect(out.results.qtyExceptions).toHaveLength(1);
  });

  it('accounts for previously invoiced quantity', () => {
    const out = performThreeWayMatch({
      invoiceItems: [{ po_item_id: 'a', description: 'Cat6 cable', quantity: 3, unit_price: 100 }],
      poItems: [{ ...poItem, qty_received: 10 }],
      previouslyInvoicedQtys: { a: 8 }, // only 2 remaining
      invoiceSupplierTrn: TRN,
      dbSupplierTrn: TRN,
    });
    expect(out.status).toBe('EXCEPTION');
  });

  it('fails on a missing TRN', () => {
    const out = performThreeWayMatch({
      invoiceItems: [{ po_item_id: 'a', description: 'Cat6 cable', quantity: 5, unit_price: 100 }],
      poItems: [poItem],
      previouslyInvoicedQtys: {},
      invoiceSupplierTrn: '',
      dbSupplierTrn: TRN,
    });
    expect(out.status).toBe('EXCEPTION');
    expect(out.results.trnValid).toBe(false);
  });

  it('fails on a TRN mismatch with the supplier master', () => {
    const out = performThreeWayMatch({
      invoiceItems: [{ po_item_id: 'a', description: 'Cat6 cable', quantity: 5, unit_price: 100 }],
      poItems: [poItem],
      previouslyInvoicedQtys: {},
      invoiceSupplierTrn: TRN,
      dbSupplierTrn: '100123456700009',
    });
    expect(out.status).toBe('EXCEPTION');
    expect(out.results.trnValid).toBe(false);
  });

  it('skips PO checks for direct-expense lines (no po_item_id)', () => {
    const out = performThreeWayMatch({
      invoiceItems: [{ po_item_id: null, description: 'Courier', quantity: 1, unit_price: 75 }],
      poItems: [],
      previouslyInvoicedQtys: {},
      invoiceSupplierTrn: TRN,
      dbSupplierTrn: TRN,
    });
    expect(out.status).toBe('MATCHED');
  });
});
