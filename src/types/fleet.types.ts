export type VehicleStatus = 'ACTIVE' | 'IN_WORKSHOP' | 'OFF_ROAD' | 'SOLD' | 'DISPOSED';
export type VehicleOwnership = 'OWNED' | 'LEASED' | 'RENTED';
export type VehicleType = 'PICKUP' | 'VAN' | 'CAR' | 'TRUCK' | 'BUS' | 'LIFT_MACHINE';

export interface Vehicle {
  id: string;
  vehicle_code: string;
  plate_number: string;
  plate_emirate: 'DUBAI' | 'ABU_DHABI' | 'SHARJAH' | 'AJMAN' | 'UMM_AL_QUWAIN' | 'RAS_AL_KHAIMAH' | 'FUJAIRAH';
  plate_category?: string | null;
  make: string;
  model: string;
  year: number;
  vehicle_type: VehicleType;
  chassis_no: string;
  engine_no: string;
  color: string;
  seating_capacity?: number | null;
  ownership: VehicleOwnership;
  purchase_date?: string | null;
  purchase_cost?: number | null;
  fixed_asset_id?: string | null;
  assigned_driver_id?: string | null;
  assigned_department?: string | null;
  home_location?: string | null;
  registration_expiry: string;
  insurance_expiry: string;
  insurance_company: string;
  insurance_policy_no: string;
  salik_tag_number?: string | null;
  salik_account?: string | null;
  status: VehicleStatus;
  odometer_km: number;
  notes?: string | null;
  photo_path?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  
  // Joined fields for convenience
  driver_name?: string;
  asset_number?: string;
}

export interface VehicleAssignment {
  id: string;
  vehicle_id: string;
  driver_id: string;
  from_date: string;
  to_date?: string | null;
  project_id?: string | null;
  purpose: string;
  handover_odometer: number;
  return_odometer?: number | null;
  condition_notes?: string | null;
  signature_path?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;

  // Joined fields
  driver_name?: string;
  vehicle_code?: string;
  plate_number?: string;
  project_name?: string;
}

export type FineStatus = 'UNPAID' | 'PAID' | 'DISPUTED' | 'TRANSFERRED_TO_DRIVER';
export type FineSource = 'DUBAI_POLICE' | 'ABU_DHABI_POLICE' | 'SHARJAH_POLICE' | 'RTA' | 'OTHER';

export interface VehicleFine {
  id: string;
  vehicle_id: string;
  fine_number: string;
  fine_date: string;
  fine_time?: string | null;
  location: string;
  violation_type: string;
  amount: number;
  black_points: number;
  source: FineSource;
  driver_id?: string | null;
  status: FineStatus;
  paid_date?: string | null;
  paid_by?: 'COMPANY' | 'DRIVER' | null;
  document_id?: string | null;
  payroll_adjustment_id?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;

  // Joined fields
  vehicle_code?: string;
  plate_number?: string;
  driver_name?: string;
}

export interface FuelLog {
  id: string;
  vehicle_id: string;
  log_date: string;
  odometer_km: number;
  litres: number;
  amount: number;
  fuel_type: 'SPECIAL_95' | 'SUPER_98' | 'DIESEL' | 'ELECTRIC';
  station?: string | null;
  card_number?: string | null;
  driver_id: string;
  project_id?: string | null;
  receipt_document_id?: string | null;
  efficiency_km_l: number;
  is_anomaly: boolean;
  created_by?: string | null;
  created_at: string;

  // Joined fields
  vehicle_code?: string;
  plate_number?: string;
  driver_name?: string;
  project_name?: string;
}

export type MaintenanceType = 'SERVICE' | 'REPAIR' | 'TYRE' | 'BATTERY' | 'ACCIDENT' | 'INSPECTION';
export type MaintenanceStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED';

export interface VehicleMaintenance {
  id: string;
  vehicle_id: string;
  type: MaintenanceType;
  service_date: string;
  odometer_km: number;
  vendor: string;
  description: string;
  cost: number;
  next_service_odometer?: number | null;
  next_service_date?: string | null;
  invoice_document_id?: string | null;
  downtime_days: number;
  status: MaintenanceStatus;
  created_by?: string | null;
  created_at: string;
  updated_at: string;

  // Joined fields
  vehicle_code?: string;
  plate_number?: string;
}
