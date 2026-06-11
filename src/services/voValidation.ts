// ============================================================
// JEET ERP — Variation Order Validation Schemas (Zod)
// Location: src/services/voValidation.ts
// ============================================================

import { z } from 'zod';

// Item validator
export const voItemSchema = z.object({
  action: z.enum(['ADD', 'OMIT', 'RE_RATE']),
  pricing_item_id: z.string().uuid().nullable().optional(),
  boq_item_ref: z.string().nullable().optional(),
  description: z.string().min(3, 'Description must be at least 3 characters'),
  unit: z.string().min(1, 'Unit is required'),
  quantity: z.number().refine(val => val !== 0, {
    message: 'Quantity cannot be zero (omissions should be negative)'
  }),
  unit_cost: z.number().nonnegative('Unit cost cannot be negative'),
  unit_sell: z.number().nonnegative('Unit sell cannot be negative'),
  system: z.string().nullable().optional(),
  notes: z.string().nullable().optional()
});

// Master VO form validator
export const voFormSchema = z.object({
  project_id: z.string().uuid('Please select a valid project'),
  title: z.string().min(5, 'Title must be at least 5 characters'),
  vo_type: z.enum(['ADDITION', 'OMISSION', 'SUBSTITUTION', 'RATE_CHANGE', 'DAYWORKS', 'PROVISIONAL_SUM_ADJ']),
  origin: z.enum(['CLIENT_INSTRUCTION', 'SITE_INSTRUCTION', 'CONSULTANT', 'RFI', 'DESIGN_CHANGE', 'SITE_CONDITION']),
  instruction_reference: z.string().min(2, 'Instruction reference is required'),
  instruction_date: z.string().refine(val => !isNaN(Date.parse(val)), {
    message: 'Please select a valid instruction date'
  }),
  instruction_document_id: z.string().uuid().nullable().optional(),
  description: z.string().optional().nullable(),
  justification: z.string().optional().nullable(),
  pricing_basis: z.enum(['BOQ_RATES', 'NEW_RATES', 'DAYWORKS', 'NEGOTIATED']),
  time_impact_days: z.number().int().default(0),
  work_status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED']).default('NOT_STARTED')
});

export type VOFormInput = z.infer<typeof voFormSchema>;
export type VOItemInput = z.infer<typeof voItemSchema>;
