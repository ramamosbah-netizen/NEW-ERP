// ============================================================
// JEET ERP — Inventory & Tools Validation Schemas (ZOD)
// ============================================================

import { z } from 'zod';

// 1. Stock Location validation
export const locationSchema = z.object({
  location_code: z.string().min(2, 'Location code must be at least 2 characters').max(20),
  name: z.string().min(3, 'Name must be at least 3 characters'),
  type: z.enum(['MAIN_STORE', 'SUB_STORE', 'PROJECT_SITE', 'VAN']),
  project_id: z.string().uuid().nullable().optional(),
  custodian_id: z.string().uuid().nullable().optional(),
  address: z.string().nullable().optional()
});

// 2. Stock Item validation
export const stockItemSchema = z.object({
  pricing_item_id: z.string().uuid('Please select a valid item from catalog'),
  is_serialized: z.boolean().default(false),
  reorder_level: z.number().nonnegative().nullable().optional(),
  reorder_qty: z.number().positive().nullable().optional(),
  preferred_supplier_id: z.string().uuid().nullable().optional()
});

// 3. Material Requisition Form (MRF) validation
export const mrfItemSchema = z.object({
  stock_item_id: z.string().uuid(),
  qty_requested: z.number().positive('Quantity must be greater than zero'),
  notes: z.string().max(250).nullable().optional()
});

export const mrfSchema = z.object({
  project_id: z.string().uuid('Please select a project'),
  location_id: z.string().uuid('Please select source store location'),
  needed_by: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Provide date in YYYY-MM-DD format'),
  notes: z.string().max(500).nullable().optional(),
  items: z.array(mrfItemSchema).min(1, 'Please add at least one item to requisition')
});

// 4. Tool Registry validation
export const toolSchema = z.object({
  name: z.string().min(3, 'Tool name must be at least 3 characters'),
  category: z.enum(['TEST_INSTRUMENT', 'POWER_TOOL', 'HAND_TOOL', 'ACCESS_EQUIPMENT', 'SAFETY', 'IT_DEVICE']),
  brand_model: z.string().nullable().optional(),
  serial_no: z.string().nullable().optional(),
  purchase_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Provide date in YYYY-MM-DD format').nullable().optional(),
  purchase_cost: z.number().nonnegative().nullable().optional(),
  supplier_id: z.string().uuid().nullable().optional(),
  requires_calibration: z.boolean().default(false),
  calibration_interval_months: z.number().int().positive().nullable().optional(),
  last_calibration_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Provide date in YYYY-MM-DD format').nullable().optional(),
  next_calibration_due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Provide date in YYYY-MM-DD format').nullable().optional(),
  condition: z.enum(['GOOD', 'FAIR', 'NEEDS_REPAIR']).default('GOOD'),
  photo_path: z.string().nullable().optional(),
  notes: z.string().nullable().optional()
});

// 5. Tool Assignment validation
export const toolAssignmentSchema = z.object({
  tool_id: z.string().uuid('Select a valid tool'),
  issued_to: z.string().uuid('Select an employee'),
  project_id: z.string().uuid().nullable().optional(),
  expected_return_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Provide date in YYYY-MM-DD format').nullable().optional(),
  issue_condition: z.enum(['GOOD', 'FAIR', 'NEEDS_REPAIR']),
  notes: z.string().nullable().optional()
});

// 6. Tool Calibration validation
export const toolCalibrationSchema = z.object({
  tool_id: z.string().uuid(),
  type: z.enum(['CALIBRATION', 'REPAIR', 'SERVICE']),
  performed_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Provide date in YYYY-MM-DD format'),
  vendor: z.string().min(2, 'Vendor name is required'),
  cost: z.number().nonnegative('Cost must be positive'),
  next_due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Provide date in YYYY-MM-DD format').nullable().optional(),
  notes: z.string().nullable().optional()
});