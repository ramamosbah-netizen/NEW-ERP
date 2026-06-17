import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import type { 
  SystemSetting, 
  SettingCategory, 
  SettingDataType,
  CompanySettings, 
  DocumentTemplatesSettings,
  FinanceSettings,
  ProcurementSettings,
  InventorySettings,
  ProjectsSettings,
  MaintenanceSettings,
  HrSettings,
  NotificationSettings,
  IntegrationsSettings,
  SystemAdminSettings,
  SecuritySettings,
  BackupSettings
} from '@/types/settings.types';
import { recordAudit } from '@/lib/audit/recordAudit';

export const settingsService = {
  /**
   * Fetches all master settings.
   */
  async getSettings(category?: SettingCategory): Promise<SystemSetting[]> {
    let query = supabase.from('settings').select('*').order('key', { ascending: true });
    if (category) {
      query = query.eq('category', category);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data as SystemSetting[];
  },

  /**
   * Retrieves a specific setting value by key.
   */
  async getSettingByKey<T>(key: string, defaultValue?: T): Promise<T> {
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', key)
      .maybeSingle();

    if (error) {
      logger.error(`Error loading setting ${key}:`, error);
      if (defaultValue !== undefined) return defaultValue;
      throw error;
    }

    if (!data) {
      if (defaultValue !== undefined) return defaultValue;
      throw new Error(`Setting with key ${key} not found.`);
    }

    return data.value as T;
  },

  /**
   * Updates or inserts a setting value, records an audit log entry.
   */
  async updateSetting(
    key: string, 
    value: any, 
    category: SettingCategory = 'COMPANY', 
    dataType: SettingDataType = 'JSON', 
    description: string = 'System setting parameter'
  ): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();

    // 1. Fetch current setting for audit
    const { data: oldSetting } = await supabase
      .from('settings')
      .select('*')
      .eq('key', key)
      .maybeSingle();

    // 2. Perform database upsert
    const { error: updateError } = await supabase
      .from('settings')
      .upsert({
        key,
        value,
        category,
        data_type: dataType,
        description: oldSetting?.description || description,
        updated_by: user?.id || null,
        updated_at: new Date().toISOString()
      });

    if (updateError) throw updateError;

    // 3. Record Forensic Audit Trail
    await recordAudit({
      action: oldSetting ? 'UPDATE' : 'CREATE',
      entity_type: 'SYSTEM_SETTING',
      entity_id: key as any, // key serves as ID here
      entity_label: key,
      summary: `System setting '${key}' ${oldSetting ? 'updated' : 'created'}`,
      before: oldSetting ? { value: oldSetting.value } : null,
      after: { value },
      module: 'SYSTEM'
    });
  },

  /**
   * Gets the company profile metadata.
   */
  async getCompanyProfile(): Promise<CompanySettings> {
    return this.getSettingByKey<CompanySettings>('company.profile', {
      company_name: "JEET Contracting LLC",
      trade_license_number: "123456/789",
      trn: "100293849500003",
      address: "Office 402, Business Bay, Dubai, UAE",
      phone: "+971 4 456 7890",
      email: "info@jeet.ae",
      logo_url: "", // Set your company logo in Admin Center → Settings → Company & Branding
      website: "www.jeet.ae"
    });
  },

  /**
   * Gets the PDF document branding templates.
   */
  async getDocumentTemplates(): Promise<DocumentTemplatesSettings> {
    return this.getSettingByKey<DocumentTemplatesSettings>('company.document_templates', {
      header_title: "JEET MEP ERP",
      header_subtitle: "ELECTRICAL & MECHANICAL WORKS LLC",
      accent_color: "mint",
      invoice_disclaimer: "Office 402, Business Bay, Dubai, UAE | TRN: 100348291000003\nEmail: accounts@jeetmep.ae | Phone: +971 4 456 7890",
      handover_disclaimer: "This document certifies that the installation and testing works have been completed in accordance with compliance standards.",
      ppm_disclaimer: "Office 402, Business Bay, Dubai, UAE | TRN: 100348291000003\nEmail: service@jeetmep.ae | Phone: +971 4 456 7890",
      vo_disclaimer: "JEET INTECH L.L.C  |  Dubai, UAE  |  TRN: 100489562300003  |  info@jeetintech.com  |  Confidential Variation Sheet"
    });
  }
};

export default settingsService;
