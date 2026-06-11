// ============================================================
// JEET ERP — Supplier Comparison Sheet Validation Schemas
// Zod schemas for comparisons, items, offers, and approvals
// ============================================================

import { z } from 'zod';

// 1. Supplier Offer Validation Schema
export const supplierOfferSchema = z.object({
  id: z.string().uuid().optional(),
  comparison_item_id: z.string().uuid().optional(),
  supplier_id: z.string().uuid().nullable().optional(),
  supplier_name: z.string().min(1, 'Supplier name is required'),
  offer_source: z.enum(['MANUAL', 'EXTRACTED_PDF', 'EXTRACTED_EXCEL', 'EMAIL']).default('MANUAL'),
  offer_document_url: z.string().nullable().optional(),
  extraction_confidence: z.number().min(0).max(100).nullable().optional(),
  offer_reference: z.string().nullable().optional(),
  offer_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)').nullable().optional().or(z.literal('')),
  
  unit_price: z.number().nonnegative('Unit price cannot be negative'),
  total_price: z.number().nonnegative().optional(),
  
  delivery_days: z.number().int().nonnegative().nullable().optional(),
  payment_terms_days: z.number().int().nonnegative().default(30),
  warranty_months: z.number().int().nonnegative().nullable().optional(),
  brand_offered: z.string().nullable().optional(),
  is_compliant: z.boolean().default(true),
  compliance_notes: z.string().nullable().optional(),
  validity_days: z.number().int().nonnegative().nullable().optional(),
  valid_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)').nullable().optional().or(z.literal('')),
  moq: z.number().nonnegative().default(0),
  includes_delivery: z.boolean().default(true),
  
  // Scores (internal calculation values)
  score_price: z.number().min(0).max(100).default(0),
  score_delivery: z.number().min(0).max(100).default(0),
  score_history: z.number().min(0).max(100).default(0),
  score_payment: z.number().min(0).max(100).default(0),
  score_compliance: z.number().min(0).max(100).default(0),
  score_total: z.number().min(0).max(100).default(0),
  
  rank: z.number().int().positive().nullable().optional(),
  is_recommended: z.boolean().default(false),
  notes: z.string().nullable().optional()
});

// 2. Comparison Item Validation Schema
export const comparisonItemSchema = z.object({
  id: z.string().uuid().optional(),
  comparison_id: z.string().uuid().optional(),
  boq_line_id: z.string().uuid('Invalid BOQ Line ID'),
  line_number: z.number().int().positive(),
  item_code: z.string().nullable().optional(),
  description: z.string().min(1, 'Description is required'),
  category: z.string().min(1, 'Category is required'),
  system: z.string().min(1, 'System is required'),
  unit: z.string().min(1, 'Unit is required'),
  quantity: z.number().positive('Quantity must be greater than zero'),
  
  spec_reference: z.string().nullable().optional(),
  required_brand: z.string().nullable().optional(),
  
  boq_unit_material_cost: z.number().nonnegative().default(0),
  boq_total_material_cost: z.number().nonnegative().default(0),
  quotation_unit_sell: z.number().nonnegative().default(0),
  quotation_total_sell: z.number().nonnegative().default(0),
  
  offers_count: z.number().int().nonnegative().default(0),
  compliant_offers_count: z.number().int().nonnegative().default(0),
  
  selected_supplier_offer_id: z.string().uuid().nullable().optional(),
  recommended_supplier_offer_id: z.string().uuid().nullable().optional(),
  lowest_price_offer_id: z.string().uuid().nullable().optional(),
  
  selection_matches_recommendation: z.boolean().default(true),
  override_reason: z.string().nullable().optional(),
  override_cost_impact: z.number().default(0),
  
  selected_unit_cost: z.number().nonnegative().default(0),
  selected_total_cost: z.number().nonnegative().default(0),
  
  item_margin_amount: z.number().default(0),
  item_margin_pct: z.number().default(0),
  item_margin_status: z.enum(['HEALTHY', 'WARNING', 'CRITICAL']).default('HEALTHY'),
  item_savings_vs_boq: z.number().default(0),
  price_spread_pct: z.number().default(0),
  
  is_optional: z.boolean().default(false),
  is_exception: z.boolean().default(false),
  exception_reason: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  sort_order: z.number().int().nonnegative()
});

// 3. Supplier Comparison Header Validation Schema
export const supplierComparisonSchema = z.object({
  id: z.string().uuid().optional(),
  comparison_number: z.string().optional(),
  revision: z.number().int().nonnegative().default(0),
  status: z.enum([
    'DRAFT', 'PRICING_IN_PROGRESS', 'PENDING_COMMERCIAL', 'PENDING_GM', 'APPROVED', 'REVISED', 'SUPERSEDED', 'REJECTED'
  ]).default('DRAFT'),
  quotation_id: z.string().uuid('Invalid Quotation ID'),
  boq_id: z.string().uuid('Invalid BOQ ID'),
  project_id: z.string().uuid('Invalid Project ID'),
  client_id: z.string().uuid('Invalid Client ID'),
  
  // Snapshots
  project_ref: z.string().min(1, 'Project reference is required'),
  project_name: z.string().min(1, 'Project name is required'),
  project_address: z.string().nullable().optional(),
  tender_ref: z.string().nullable().optional(),
  quotation_ref: z.string().nullable().optional(),
  client_name: z.string().min(1, 'Client name is required'),
  client_address: z.string().nullable().optional(),
  client_contact_person: z.string().nullable().optional(),
  client_contact_email: z.string().email('Invalid email').or(z.literal('')).nullable().optional(),
  client_contact_phone: z.string().nullable().optional(),
  
  comparison_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  target_margin_pct: z.number().min(0).max(100).default(15.00),
  approval_threshold: z.number().nonnegative().default(50000.00),
  currency: z.string().default('AED'),
  
  total_boq_material_cost: z.number().nonnegative().default(0),
  total_quotation_material_revenue: z.number().nonnegative().default(0),
  total_selected_supplier_cost: z.number().nonnegative().default(0),
  total_lowest_supplier_cost: z.number().nonnegative().default(0),
  total_savings_vs_boq: z.number().default(0),
  total_savings_pct: z.number().default(0),
  overall_margin_amount: z.number().default(0),
  overall_margin_pct: z.number().default(0),
  margin_status: z.enum(['HEALTHY', 'WARNING', 'CRITICAL']).default('HEALTHY'),
  
  override_count: z.number().int().nonnegative().default(0),
  exception_count: z.number().int().nonnegative().default(0),
  potential_extra_savings: z.number().nonnegative().default(0),
  
  prepared_by: z.string().uuid().optional(),
  prepared_by_name: z.string().optional(),
  
  notes: z.string().nullable().optional(),
  is_locked: z.boolean().default(false),
  previous_comparison_id: z.string().uuid().nullable().optional()
});

// 4. Comparison Approval Validation Schema
export const comparisonApprovalSchema = z.object({
  comparison_id: z.string().uuid(),
  stage: z.enum(['COMMERCIAL', 'GM']),
  action: z.enum(['SUBMITTED', 'APPROVED', 'REJECTED', 'RETURNED']),
  comment: z.string().max(1000, 'Comment must be less than 1000 characters').nullable().optional()
});

// Typings
export type SupplierOfferInput = z.infer<typeof supplierOfferSchema>;
export type ComparisonItemInput = z.infer<typeof comparisonItemSchema>;
export type SupplierComparisonInput = z.infer<typeof supplierComparisonSchema>;
export type ComparisonApprovalInput = z.infer<typeof comparisonApprovalSchema>;
