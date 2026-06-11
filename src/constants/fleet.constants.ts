import { FixedAssetCategory } from '@/types/asset.types';

export const CAPITALIZATION_THRESHOLD = 1500; // in AED

export const DEFAULT_USEFUL_LIVES: Record<FixedAssetCategory, number> = {
  VEHICLE: 60,         // 5 years
  IT_EQUIPMENT: 36,    // 3 years
  TOOLS_INSTRUMENTS: 48, // 4 years
  OFFICE_FURNITURE: 84, // 7 years
  SITE_EQUIPMENT: 60,   // 5 years
  SOFTWARE: 36,         // 3 years
  OTHER: 60             // 5 years
};

export const UAE_EMIRATES = [
  { code: 'DUBAI', name: 'Dubai' },
  { code: 'ABU_DHABI', name: 'Abu Dhabi' },
  { code: 'SHARJAH', name: 'Sharjah' },
  { code: 'AJMAN', name: 'Ajman' },
  { code: 'UMM_AL_QUWAIN', name: 'Umm Al Quwain' },
  { code: 'RAS_AL_KHAIMAH', name: 'Ras Al Khaimah' },
  { code: 'FUJAIRAH', name: 'Fujairah' }
] as const;

export const FINE_SOURCES = [
  { code: 'DUBAI_POLICE', name: 'Dubai Police' },
  { code: 'ABU_DHABI_POLICE', name: 'Abu Dhabi Police' },
  { code: 'SHARJAH_POLICE', name: 'Sharjah Police' },
  { code: 'RTA', name: 'RTA' },
  { code: 'OTHER', name: 'Other' }
] as const;

export const FUEL_TYPES = [
  { code: 'SPECIAL_95', name: 'Special 95' },
  { code: 'SUPER_98', name: 'Super 98' },
  { code: 'DIESEL', name: 'Diesel' },
  { code: 'ELECTRIC', name: 'Electric' }
] as const;

export const VEHICLE_STATUSES = [
  { code: 'ACTIVE', name: 'Active' },
  { code: 'IN_WORKSHOP', name: 'In Workshop' },
  { code: 'OFF_ROAD', name: 'Off Road' },
  { code: 'SOLD', name: 'Sold' },
  { code: 'DISPOSED', name: 'Disposed' }
] as const;

export const VEHICLE_TYPES = [
  { code: 'PICKUP', name: 'Pickup' },
  { code: 'VAN', name: 'Van' },
  { code: 'CAR', name: 'Car' },
  { code: 'TRUCK', name: 'Truck' },
  { code: 'BUS', name: 'Bus' },
  { code: 'LIFT_MACHINE', name: 'Lift/Machine' }
] as const;

export const OWNERSHIP_TYPES = [
  { code: 'OWNED', name: 'Owned' },
  { code: 'LEASED', name: 'Leased' },
  { code: 'RENTED', name: 'Rented' }
] as const;

export const MAINTENANCE_TYPES = [
  { code: 'SERVICE', name: 'Scheduled Service' },
  { code: 'REPAIR', name: 'Repair' },
  { code: 'TYRE', name: 'Tyres replacement' },
  { code: 'BATTERY', name: 'Battery replacement' },
  { code: 'ACCIDENT', name: 'Accident Repair' },
  { code: 'INSPECTION', name: 'Inspection' }
] as const;

export const FIXED_ASSET_STATUSES = [
  { code: 'ACTIVE', name: 'Active' },
  { code: 'FULLY_DEPRECIATED', name: 'Fully Depreciated' },
  { code: 'DISPOSED', name: 'Disposed' },
  { code: 'WRITTEN_OFF', name: 'Written Off' }
] as const;

export const DISPOSAL_METHODS = [
  { code: 'SALE', name: 'Sale' },
  { code: 'SCRAP', name: 'Scrap' },
  { code: 'TRADE_IN', name: 'Trade In' },
  { code: 'LOST', name: 'Lost / Stolen' }
] as const;
