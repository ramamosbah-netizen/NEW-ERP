export type FixedAssetCategory = 'VEHICLE' | 'IT_EQUIPMENT' | 'TOOLS_INSTRUMENTS' | 'OFFICE_FURNITURE' | 'SITE_EQUIPMENT' | 'SOFTWARE' | 'OTHER';
export type FixedAssetStatus = 'ACTIVE' | 'FULLY_DEPRECIATED' | 'DISPOSED' | 'WRITTEN_OFF';
export type DepreciationMethod = 'STRAIGHT_LINE';
export type DisposalMethod = 'SALE' | 'SCRAP' | 'TRADE_IN' | 'LOST';

export interface FixedAsset {
  id: string;
  asset_number: string; // Format: JI-FA-YYYY-NNN
  name: string;
  category: FixedAssetCategory;
  description?: string | null;
  acquisition_date: string;
  acquisition_cost: number;
  supplier_id?: string | null;
  source_po_id?: string | null;
  source_invoice_id?: string | null;
  salvage_value: number;
  useful_life_months: number;
  depreciation_method: DepreciationMethod;
  accumulated_depreciation: number;
  net_book_value: number;
  status: FixedAssetStatus;
  custodian_id?: string | null;
  location?: string | null;
  linked_vehicle_id?: string | null;
  linked_tool_id?: string | null;
  disposal_date?: string | null;
  disposal_proceeds?: number | null;
  disposal_method?: DisposalMethod | null;
  document_id?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;

  // Joined fields
  supplier_name?: string;
  po_number?: string;
  invoice_number?: string;
  custodian_name?: string;
  vehicle_code?: string;
  tool_number?: string;
}

export interface DepreciationPeriodRow {
  id: string;
  asset_id: string;
  period_month: string; // Date string: "YYYY-MM-01"
  opening_nbv: number;
  depreciation_amount: number;
  closing_nbv: number;
  accumulated: number;
  posted: boolean;
  created_at: string;
}

export interface AssetDisposal {
  id: string;
  asset_id: string;
  disposal_date: string;
  method: DisposalMethod;
  proceeds: number;
  nbv_at_disposal: number;
  gain_loss: number; // proceeds - nbv_at_disposal
  buyer?: string | null;
  document_id?: string | null;
  approved_by?: string | null;
  created_at: string;

  // Joined fields
  asset_number?: string;
  asset_name?: string;
  approved_by_name?: string;
}
