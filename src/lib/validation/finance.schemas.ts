// ============================================================
// Aura ERP — Finance validation schemas (zod)
// These mirror the DB NOT NULL / CHECK constraints so the app surfaces
// friendly errors at the write boundary *before* hitting Postgres. They
// are deliberately not stricter than the DB, so they reject nothing the
// database would otherwise accept.
// ============================================================

import { z } from 'zod';

export const invoiceDraftSchema = z.object({
  client_id: z.string().min(1, 'A client is required'),
  invoice_type: z.enum(['ADVANCE', 'PROGRESS', 'FINAL', 'RETENTION_RELEASE', 'STANDALONE']),
  invoice_date: z.string().min(1, 'Invoice date is required'),
  due_date: z.string().min(1, 'Due date is required'),
});

export const invoiceItemDraftSchema = z.object({
  description: z.string().min(1, 'Line description is required'),
  quantity: z.coerce.number().min(0, 'Quantity cannot be negative'),
  unit_price: z.coerce.number().min(0, 'Unit price cannot be negative'),
});
