import { z } from 'zod';

export const vehicleValidationSchema = z.object({
  plate_number: z.string().min(1, 'Plate number is required'),
  plate_emirate: z.enum(['DUBAI', 'ABU_DHABI', 'SHARJAH', 'AJMAN', 'UMM_AL_QUWAIN', 'RAS_AL_KHAIMAH', 'FUJAIRAH']),
  plate_category: z.string().optional().nullable(),
  make: z.string().min(1, 'Make is required'),
  model: z.string().min(1, 'Model is required'),
  year: z.number().int().min(1900).max(new Date().getFullYear() + 1),
  vehicle_type: z.enum(['PICKUP', 'VAN', 'CAR', 'TRUCK', 'BUS', 'LIFT_MACHINE']),
  chassis_no: z.string().min(1, 'Chassis number is required'),
  engine_no: z.string().min(1, 'Engine number is required'),
  color: z.string().min(1, 'Color is required'),
  seating_capacity: z.number().int().positive().optional().nullable(),
  ownership: z.enum(['OWNED', 'LEASED', 'RENTED']),
  purchase_date: z.string().optional().nullable(),
  purchase_cost: z.number().nonnegative().optional().nullable(),
  fixed_asset_id: z.string().uuid().optional().nullable(),
  assigned_driver_id: z.string().uuid().optional().nullable(),
  assigned_department: z.string().optional().nullable(),
  home_location: z.string().optional().nullable(),
  registration_expiry: z.string().min(1, 'Registration expiry date is required'),
  insurance_expiry: z.string().min(1, 'Insurance expiry date is required'),
  insurance_company: z.string().min(1, 'Insurance company is required'),
  insurance_policy_no: z.string().min(1, 'Insurance policy number is required'),
  salik_tag_number: z.string().optional().nullable(),
  salik_account: z.string().optional().nullable(),
  status: z.enum(['ACTIVE', 'IN_WORKSHOP', 'OFF_ROAD', 'SOLD', 'DISPOSED']).default('ACTIVE'),
  odometer_km: z.number().int().nonnegative().default(0),
  notes: z.string().optional().nullable(),
  photo_path: z.string().optional().nullable(),
  is_active: z.boolean().default(true)
});

export const vehicleAssignmentValidationSchema = z.object({
  vehicle_id: z.string().uuid('Invalid vehicle ID'),
  driver_id: z.string().uuid('Invalid driver ID'),
  from_date: z.string().min(1, 'From date is required'),
  to_date: z.string().optional().nullable(),
  project_id: z.string().uuid().optional().nullable(),
  purpose: z.string().min(1, 'Purpose is required'),
  handover_odometer: z.number().int().nonnegative('Odometer must be non-negative'),
  return_odometer: z.number().int().nonnegative().optional().nullable(),
  condition_notes: z.string().optional().nullable(),
  signature_path: z.string().optional().nullable()
}).refine(data => {
  if (data.return_odometer !== null && data.return_odometer !== undefined) {
    return data.return_odometer >= data.handover_odometer;
  }
  return true;
}, {
  message: 'Return odometer cannot be less than handover odometer',
  path: ['return_odometer']
});

export const vehicleFineValidationSchema = z.object({
  vehicle_id: z.string().uuid('Invalid vehicle ID'),
  fine_number: z.string().min(1, 'Fine number is required'),
  fine_date: z.string().min(1, 'Fine date is required'),
  fine_time: z.string().optional().nullable(),
  location: z.string().min(1, 'Location is required'),
  violation_type: z.string().min(1, 'Violation type is required'),
  amount: z.number().positive('Amount must be positive'),
  black_points: z.number().int().nonnegative().default(0),
  source: z.enum(['DUBAI_POLICE', 'ABU_DHABI_POLICE', 'SHARJAH_POLICE', 'RTA', 'OTHER']),
  driver_id: z.string().uuid().optional().nullable(),
  status: z.enum(['UNPAID', 'PAID', 'DISPUTED', 'TRANSFERRED_TO_DRIVER']).default('UNPAID'),
  paid_date: z.string().optional().nullable(),
  paid_by: z.enum(['COMPANY', 'DRIVER']).optional().nullable(),
  document_id: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable()
});

export const fuelLogValidationSchema = z.object({
  vehicle_id: z.string().uuid('Invalid vehicle ID'),
  log_date: z.string().min(1, 'Log date is required'),
  odometer_km: z.number().int().nonnegative('Odometer must be non-negative'),
  litres: z.number().positive('Litres must be greater than zero'),
  amount: z.number().positive('Amount must be greater than zero'),
  fuel_type: z.enum(['SPECIAL_95', 'SUPER_98', 'DIESEL', 'ELECTRIC']),
  station: z.string().optional().nullable(),
  card_number: z.string().optional().nullable(),
  driver_id: z.string().uuid('Invalid driver ID'),
  project_id: z.string().uuid().optional().nullable(),
  receipt_document_id: z.string().uuid().optional().nullable()
});

export const vehicleMaintenanceValidationSchema = z.object({
  vehicle_id: z.string().uuid('Invalid vehicle ID'),
  type: z.enum(['SERVICE', 'REPAIR', 'TYRE', 'BATTERY', 'ACCIDENT', 'INSPECTION']),
  service_date: z.string().min(1, 'Service date is required'),
  odometer_km: z.number().int().nonnegative('Odometer must be non-negative'),
  vendor: z.string().min(1, 'Vendor is required'),
  description: z.string().min(1, 'Description is required'),
  cost: z.number().nonnegative('Cost must be non-negative'),
  next_service_odometer: z.number().int().positive().optional().nullable(),
  next_service_date: z.string().optional().nullable(),
  invoice_document_id: z.string().uuid().optional().nullable(),
  downtime_days: z.number().int().nonnegative().default(0),
  status: z.enum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED']).default('SCHEDULED')
});

export const fixedAssetValidationSchema = z.object({
  name: z.string().min(1, 'Asset name is required'),
  category: z.enum(['VEHICLE', 'IT_EQUIPMENT', 'TOOLS_INSTRUMENTS', 'OFFICE_FURNITURE', 'SITE_EQUIPMENT', 'SOFTWARE', 'OTHER']),
  description: z.string().optional().nullable(),
  acquisition_date: z.string().min(1, 'Acquisition date is required'),
  acquisition_cost: z.number().positive('Cost must be positive'),
  supplier_id: z.string().uuid().optional().nullable(),
  source_po_id: z.string().uuid().optional().nullable(),
  source_invoice_id: z.string().uuid().optional().nullable(),
  salvage_value: z.number().nonnegative('Salvage value must be non-negative').default(0),
  useful_life_months: z.number().int().positive('Useful life months must be positive'),
  depreciation_method: z.literal('STRAIGHT_LINE').default('STRAIGHT_LINE'),
  custodian_id: z.string().uuid().optional().nullable(),
  location: z.string().optional().nullable(),
  linked_vehicle_id: z.string().uuid().optional().nullable(),
  linked_tool_id: z.string().uuid().optional().nullable(),
  document_id: z.string().uuid().optional().nullable()
}).refine(data => {
  return data.salvage_value <= data.acquisition_cost;
}, {
  message: 'Salvage value cannot exceed acquisition cost',
  path: ['salvage_value']
});

export const assetDisposalValidationSchema = z.object({
  asset_id: z.string().uuid('Invalid asset ID'),
  disposal_date: z.string().min(1, 'Disposal date is required'),
  method: z.enum(['SALE', 'SCRAP', 'TRADE_IN', 'LOST']),
  proceeds: z.number().nonnegative('Proceeds must be non-negative').default(0),
  buyer: z.string().optional().nullable(),
  document_id: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable()
});
