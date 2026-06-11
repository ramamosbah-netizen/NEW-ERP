export type SettingCategory = 'COMPANY' | 'FINANCE' | 'WORKFLOW' | 'HR' | 'NOTIFICATIONS' | 'INTEGRATIONS';
export type SettingDataType = 'STRING' | 'NUMBER' | 'BOOLEAN' | 'JSON' | 'ARRAY';

export interface SystemSetting<T = any> {
  key: string;
  value: T;
  category: SettingCategory;
  data_type: SettingDataType;
  description: string | null;
  updated_by: string | null;
  updated_at: string;
}

export interface CompanySettings {
  company_name: string;
  trade_license_number: string;
  trn: string;
  address: string;
  phone: string;
  email: string;
  logo_url: string;
  website: string;
}

export interface DocumentTemplatesSettings {
  header_title: string;
  header_subtitle: string;
  accent_color: 'slate' | 'mint' | 'gold' | 'red';
  invoice_disclaimer: string;
  handover_disclaimer: string;
  ppm_disclaimer: string;
  vo_disclaimer: string;
}

export interface FinanceSettings {
  vat_rate: number;
  vat_period_months: number;
  approval_threshold_quotation: number;
  currency: string;
  depreciation_lives_months: {
    VEHICLE: number;
    IT_EQUIPMENT: number;
    TOOLS_INSTRUMENTS: number;
    OFFICE_FURNITURE: number;
    SOFTWARE: number;
    [key: string]: number;
  };
}

export interface ProcurementSettings {
  approval_threshold_po: number;
  auto_rank: boolean;
}

export interface InventorySettings {
  mrf_approval_required: boolean;
  low_stock_threshold: number;
}

export interface ProjectsSettings {
  default_stages: string[];
  vo_threshold: number;
}

export interface MaintenanceSettings {
  slots: string[];
  sla_categories: {
    CRITICAL: number; // hours
    HIGH: number;
    MEDIUM: number;
    LOW: number;
  };
}

export interface HrSettings {
  gratuity_entitlement_days: {
    under_1yr: number;
    '1to5yr': number;
    above5yr: number;
  };
  business_hours: {
    start: string;
    end: string;
    working_days: number[]; // e.g. [0, 1, 2, 3, 4] for Sunday-Thursday
  };
}

export interface NotificationSettings {
  channel_toggles: {
    email: boolean;
    whatsapp: boolean;
    push: boolean;
  };
  templates: {
    quotation_sent: string;
    po_approved: string;
    ticket_assigned: string;
  };
}

export interface IntegrationsSettings {
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  whatsapp_gateway_url: string;
  whatsapp_token: string;
}

export interface SystemAdminSettings {
  app_mode: 'development' | 'production' | 'maintenance';
  log_level: 'debug' | 'info' | 'warn' | 'error';
  default_density: 'compact' | 'comfortable';
}

export interface SecuritySettings {
  password_min_length: number;
  require_special_char: boolean;
  session_timeout_minutes: number;
}

export interface BackupSettings {
  backup_schedule: 'daily' | 'weekly' | 'monthly';
  retention_days: number;
}
