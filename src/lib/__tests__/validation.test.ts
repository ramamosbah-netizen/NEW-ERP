import { describe, it, expect } from 'vitest';
import { validate, ValidationError } from '@/lib/validation/validate';
import { invoiceDraftSchema, invoiceItemDraftSchema } from '@/lib/validation/finance.schemas';

describe('validate() + finance schemas', () => {
  it('passes a valid invoice draft and ignores extra keys', () => {
    const ok = validate(
      invoiceDraftSchema,
      { client_id: 'c1', invoice_type: 'PROGRESS', invoice_date: '2026-06-01', due_date: '2026-07-01', extra: 'x' },
      'invoice',
    );
    expect(ok.client_id).toBe('c1');
  });

  it('throws ValidationError with issues on a bad draft', () => {
    try {
      validate(invoiceDraftSchema, { client_id: '', invoice_type: 'NOPE', invoice_date: '', due_date: '' }, 'invoice');
      expect.unreachable('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect((e as ValidationError).issues.length).toBeGreaterThan(0);
    }
  });

  it('coerces numeric strings on line items', () => {
    const ok = validate(invoiceItemDraftSchema, { description: 'Cable', quantity: '2', unit_price: '10' }, 'line');
    expect(ok.quantity).toBe(2);
    expect(ok.unit_price).toBe(10);
  });

  it('rejects a negative quantity', () => {
    expect(() => validate(invoiceItemDraftSchema, { description: 'X', quantity: -1, unit_price: 1 })).toThrow(ValidationError);
  });
});
