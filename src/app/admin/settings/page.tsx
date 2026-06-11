'use client';

import React, { useState, useEffect } from 'react';
import settingsService from '@/services/settingsService';
import userRoleService from '@/services/userRoleService';
import permissionService from '@/services/permissionService';
import auditService from '@/services/auditService';
import type { Role, UserRole, Permission, PermissionScope } from '@/types/rbac.types';
import type { UserWithRoles } from '@/services/userRoleService';
import type { AuditLog } from '@/types/audit.types';
import Can from '@/lib/permissions/Can';
import { 
  Settings, 
  Building, 
  DollarSign, 
  Clock, 
  Bell, 
  Save, 
  CheckCircle, 
  AlertTriangle, 
  FileText, 
  Shield, 
  Users, 
  Database, 
  Layers, 
  Sliders, 
  RefreshCw, 
  Key, 
  FileCheck, 
  Share2, 
  ArrowUpRight,
  Sparkles,
  Cpu,
  Lock,
  Download
} from 'lucide-react';

export default function SettingsHubPage() {
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Tab State
  const [activeTab, setActiveTab] = useState<
    'COMPANY' | 'USERS_ROLES' | 'FINANCE' | 'PROCUREMENT' | 'INVENTORY' | 
    'PROJECTS' | 'MAINTENANCE' | 'HR' | 'NOTIFICATIONS' | 'TEMPLATES' | 
    'INTEGRATIONS' | 'SYSTEM_ADMIN' | 'SECURITY' | 'BACKUP'
  >('COMPANY');

  // --- Tab 1: Company Profile states ---
  const [companyName, setCompanyName] = useState<string>('');
  const [tradeLicense, setTradeLicense] = useState<string>('');
  const [trn, setTrn] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [website, setWebsite] = useState<string>('');

  // --- Tab 2: Users & Roles states ---
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
  const [selectedUserRoles, setSelectedUserRoles] = useState<string[]>([]);
  const [selectedRoleForMatrix, setSelectedRoleForMatrix] = useState<string>('');
  const [matrixPermissions, setMatrixPermissions] = useState<Record<string, PermissionScope | 'NONE'>>({});
  const [userSearch, setUserSearch] = useState<string>('');

  // --- Tab 3: Finance & Tax ---
  const [vatRate, setVatRate] = useState<number>(5.00);
  const [vatPeriodMonths, setVatPeriodMonths] = useState<number>(3);
  const [thresholdQuote, setThresholdQuote] = useState<number>(50000);
  const [currency, setCurrency] = useState<string>('AED');

  // --- Tab 4: Procurement ---
  const [thresholdPO, setThresholdPO] = useState<number>(20000);
  const [autoRank, setAutoRank] = useState<boolean>(true);

  // --- Tab 5: Inventory & Assets ---
  const [mrfApprovalRequired, setMrfApprovalRequired] = useState<boolean>(true);
  const [lowStockThreshold, setLowStockThreshold] = useState<number>(10);
  const [usefulLives, setUsefulLives] = useState<Record<string, number>>({
    VEHICLE: 60,
    IT_EQUIPMENT: 36,
    TOOLS_INSTRUMENTS: 48,
    OFFICE_FURNITURE: 84,
    SOFTWARE: 36
  });

  // --- Tab 6: Projects & Operations ---
  const [defaultStages, setDefaultStages] = useState<string[]>([]);
  const [newStageInput, setNewStageInput] = useState<string>('');
  const [voThreshold, setVoThreshold] = useState<number>(15000);

  // --- Tab 7: Maintenance & SLA ---
  const [maintenanceSlots, setMaintenanceSlots] = useState<string[]>([]);
  const [newSlotInput, setNewSlotInput] = useState<string>('');
  const [slaCategories, setSlaCategories] = useState({
    CRITICAL: 2,
    HIGH: 4,
    MEDIUM: 8,
    LOW: 24
  });

  // --- Tab 8: HR & Workforce ---
  const [businessHours, setBusinessHours] = useState({
    start: '08:00',
    end: '17:00',
    working_days: [0, 1, 2, 3, 4]
  });
  const [gratuityEntitlement, setGratuityEntitlement] = useState({
    under_1yr: 0,
    '1to5yr': 21,
    above5yr: 30
  });

  // --- Tab 9: Notifications & Communications ---
  const [notifications, setNotifications] = useState({
    email: true,
    whatsapp: true,
    push: true
  });
  const [notifTemplates, setNotifTemplates] = useState({
    quotation_sent: '',
    po_approved: '',
    ticket_assigned: ''
  });

  // --- Tab 10: Document Templates ---
  const [docTemplates, setDocTemplates] = useState({
    header_title: '',
    header_subtitle: '',
    accent_color: 'mint',
    invoice_disclaimer: '',
    handover_disclaimer: '',
    ppm_disclaimer: '',
    vo_disclaimer: ''
  });

  // --- Tab 11: Integrations ---
  const [smtpConfig, setSmtpConfig] = useState({
    host: '',
    port: 587,
    user: ''
  });
  const [whatsappGateway, setWhatsappGateway] = useState({
    url: '',
    token: ''
  });

  // --- Tab 12: System Admin ---
  const [appMode, setAppMode] = useState<'development' | 'production' | 'maintenance'>('production');
  const [logLevel, setLogLevel] = useState<'debug' | 'info' | 'warn' | 'error'>('info');
  const [defaultDensity, setDefaultDensity] = useState<'compact' | 'comfortable'>('comfortable');

  // --- Tab 13: Audit & Security ---
  const [passwordRules, setPasswordRules] = useState({
    min_length: 8,
    require_special: true
  });
  const [sessionTimeout, setSessionTimeout] = useState<number>(30);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // --- Tab 14: Backup & Recovery ---
  const [backupConfig, setBackupConfig] = useState({
    schedule: 'daily',
    retention: 30
  });

  const loadSettings = async () => {
    setLoading(true);
    try {
      // 1. Fetch Company Settings
      const profile = await settingsService.getCompanyProfile();
      setCompanyName(profile.company_name);
      setTradeLicense(profile.trade_license_number);
      setTrn(profile.trn);
      setAddress(profile.address);
      setPhone(profile.phone);
      setEmail(profile.email);
      setLogoUrl(profile.logo_url);
      setWebsite(profile.website);

      // 2. Fetch Users & Roles & Permissions for Tab 2
      const [uList, rList, pList] = await Promise.all([
        userRoleService.getUsers(),
        userRoleService.getRoles(),
        permissionService.getPermissions()
      ]);
      setUsers(uList);
      setRoles(rList);
      setPermissions(pList);
      if (rList.length > 0) {
        setSelectedRoleForMatrix(rList[0].id);
      }

      // 3. Fetch Finance & Tax settings
      const vatRateVal = await settingsService.getSettingByKey('finance.vat_rate', 5.00);
      setVatRate(Number(vatRateVal));

      const vatPeriodVal = await settingsService.getSettingByKey('finance.vat_period_months', 3);
      setVatPeriodMonths(Number(vatPeriodVal));

      const threshQuoteVal = await settingsService.getSettingByKey('finance.approval_threshold_quotation', 50000);
      setThresholdQuote(Number(threshQuoteVal));

      const currencyVal = await settingsService.getSettingByKey('finance.currency', 'AED');
      setCurrency(String(currencyVal));

      // 4. Procurement settings
      const threshPOVal = await settingsService.getSettingByKey('finance.approval_threshold_po', 20000);
      setThresholdPO(Number(threshPOVal));

      const autoRankVal = await settingsService.getSettingByKey('procurement.auto_rank', true);
      setAutoRank(Boolean(autoRankVal));

      // 5. Inventory & Assets
      const mrfAppVal = await settingsService.getSettingByKey('inventory.mrf_approval_required', true);
      setMrfApprovalRequired(Boolean(mrfAppVal));

      const stockThreshVal = await settingsService.getSettingByKey('inventory.low_stock_threshold', 10);
      setLowStockThreshold(Number(stockThreshVal));

      const usefulLivesVal = await settingsService.getSettingByKey('fleet.depreciation_lives_months', {
        VEHICLE: 60,
        IT_EQUIPMENT: 36,
        TOOLS_INSTRUMENTS: 48,
        OFFICE_FURNITURE: 84,
        SOFTWARE: 36
      });
      setUsefulLives(usefulLivesVal);

      // 6. Projects & Operations
      const projStages = await settingsService.getSettingByKey('projects.default_stages', [
        'Tender', 'BOQ Mapping', 'Quotation Draft', 'Sent to Client', 'Project Active', 'DLP Stage', 'Handovered'
      ]);
      setDefaultStages(projStages);

      const voThreshVal = await settingsService.getSettingByKey('projects.vo_threshold', 15000);
      setVoThreshold(Number(voThreshVal));

      // 7. Maintenance & SLA
      const maintSlots = await settingsService.getSettingByKey('maintenance.slots', [
        '08:00 - 10:00', '10:00 - 12:00', '13:00 - 15:00', '15:00 - 17:00'
      ]);
      setMaintenanceSlots(maintSlots);

      const slaVal = await settingsService.getSettingByKey('maintenance.sla_categories', {
        CRITICAL: 2,
        HIGH: 4,
        MEDIUM: 8,
        LOW: 24
      });
      setSlaCategories(slaVal);

      // 8. HR & Workforce
      const bizHours = await settingsService.getSettingByKey('workflow.business_hours', {
        start: '08:00',
        end: '17:00',
        working_days: [0, 1, 2, 3, 4]
      });
      setBusinessHours(bizHours);

      const gratuity = await settingsService.getSettingByKey('payroll.gratuity_entitlement_days', {
        under_1yr: 0,
        '1to5yr': 21,
        above5yr: 30
      });
      setGratuityEntitlement(gratuity);

      // 9. Notifications & Communications
      const notifCh = await settingsService.getSettingByKey('notifications.channel_toggles', {
        email: true,
        whatsapp: true,
        push: true
      });
      setNotifications(notifCh);

      const templatesVal = await settingsService.getSettingByKey('notifications.templates', {
        quotation_sent: 'Dear {client_name}, your quotation {quotation_number} has been issued successfully. Grand Total: {total_incl_vat} AED.',
        po_approved: 'LPO Reference {po_number} has been authorized and issued to your supply queue.',
        ticket_assigned: 'A reactive service ticket {ticket_number} at site {site_name} has been allocated to your profile.'
      });
      setNotifTemplates(templatesVal);

      // 10. Document Templates
      const docTemplatesVal = await settingsService.getDocumentTemplates();
      setDocTemplates(docTemplatesVal);

      // 11. Integrations
      const smtp = await settingsService.getSettingByKey('integrations.smtp_config', {
        host: 'smtp.mailgun.org',
        port: 587,
        user: 'postmaster@jeetmep.ae'
      });
      setSmtpConfig(smtp);

      const wa = await settingsService.getSettingByKey('integrations.whatsapp_gateway', {
        url: 'https://api.whatsapp.com/v1/messages',
        token: 'WA_TOKEN_DEFAULT_83918'
      });
      setWhatsappGateway(wa);

      // 12. System Admin
      const appMVal = await settingsService.getSettingByKey<'development' | 'production' | 'maintenance'>('system.app_mode', 'production');
      setAppMode(appMVal);

      const logLVal = await settingsService.getSettingByKey<'debug' | 'info' | 'warn' | 'error'>('system.log_level', 'info');
      setLogLevel(logLVal);

      const densityVal = await settingsService.getSettingByKey<'compact' | 'comfortable'>('system.default_density', 'comfortable');
      setDefaultDensity(densityVal);

      // 13. Audit & Security
      const pwVal = await settingsService.getSettingByKey('security.password_rules', {
        min_length: 8,
        require_special: true
      });
      setPasswordRules(pwVal);

      const timeoutVal = await settingsService.getSettingByKey('security.session_timeout', 30);
      setSessionTimeout(Number(timeoutVal));

      const logs = await auditService.getLogs();
      setAuditLogs(logs);

      // 14. Backup
      const backVal = await settingsService.getSettingByKey('backup.settings', {
        schedule: 'daily',
        retention: 30
      });
      setBackupConfig(backVal);

    } catch (err) {
      console.error('Failed to load full parameters settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  // Fetch matrix mappings when role selection changes
  useEffect(() => {
    if (!selectedRoleForMatrix) return;
    const fetchMatrix = async () => {
      try {
        const mappings = await permissionService.getRolePermissions(selectedRoleForMatrix);
        const mapObj: Record<string, PermissionScope | 'NONE'> = {};
        permissions.forEach(p => {
          const match = mappings.find(m => m.permission_id === p.id);
          mapObj[p.permission_key] = match ? match.scope : 'NONE';
        });
        setMatrixPermissions(mapObj);
      } catch (err) {
        console.error('Failed to load matrix mappings:', err);
      }
    };
    fetchMatrix();
  }, [selectedRoleForMatrix, permissions]);

  const showFeedback = (success: boolean, msg: string) => {
    if (success) {
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(null), 4000);
    } else {
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(null), 4000);
    }
  };

  // --- Save Handlers ---
  const saveCompanyProfile = async () => {
    if (trn.replace(/[\s-]/g, '').length !== 15) {
      showFeedback(false, 'UAE TRN must contain exactly 15 digits.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        company_name: companyName,
        trade_license_number: tradeLicense,
        trn,
        address,
        phone,
        email,
        logo_url: logoUrl,
        website
      };
      await settingsService.updateSetting('company.profile', payload, 'COMPANY', 'JSON', 'Company Specifications and branding details');
      showFeedback(true, 'Company & Branding parameters saved successfully.');
    } catch (err: any) {
      showFeedback(false, err.message || 'Failed to update company parameters.');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenUserReassign = (user: UserWithRoles) => {
    setSelectedUser(user);
    setSelectedUserRoles(user.roles.map(r => r.id));
  };

  const saveUserRolesReassignment = async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      await userRoleService.updateUserRoles(selectedUser.id, selectedUserRoles);
      showFeedback(true, `Roles updated for user: ${selectedUser.full_name}`);
      setSelectedUser(null);
      // reload lists
      const uList = await userRoleService.getUsers();
      setUsers(uList);
    } catch (err: any) {
      showFeedback(false, err.message || 'Failed to reassign user roles.');
    } finally {
      setSaving(false);
    }
  };

  const savePermissionsMatrix = async () => {
    if (!selectedRoleForMatrix) return;
    setSaving(true);
    try {
      const mappings: { permissionId: string; scope: PermissionScope }[] = [];
      Object.entries(matrixPermissions).forEach(([key, scope]) => {
        if (scope === 'NONE') return;
        const matched = permissions.find(p => p.permission_key === key);
        if (matched) {
          mappings.push({
            permissionId: matched.id,
            scope
          });
        }
      });
      await permissionService.updateRolePermissions(selectedRoleForMatrix, mappings);
      showFeedback(true, 'Role Permissions Matrix updated successfully.');
    } catch (err: any) {
      showFeedback(false, err.message || 'Failed to save matrix parameters.');
    } finally {
      setSaving(false);
    }
  };

  const saveFinancials = async () => {
    setSaving(true);
    try {
      await settingsService.updateSetting('finance.vat_rate', vatRate, 'FINANCE', 'NUMBER', 'VAT Percentage rate');
      await settingsService.updateSetting('finance.vat_period_months', vatPeriodMonths, 'FINANCE', 'NUMBER', 'VAT Period in months');
      await settingsService.updateSetting('finance.approval_threshold_quotation', thresholdQuote, 'FINANCE', 'NUMBER', 'Quotation GM Limit');
      await settingsService.updateSetting('finance.currency', currency, 'FINANCE', 'STRING', 'Primary active currency symbol');
      showFeedback(true, 'Financial & Tax thresholds saved successfully.');
    } catch (err: any) {
      showFeedback(false, err.message || 'Failed to save financials settings.');
    } finally {
      setSaving(false);
    }
  };

  const saveProcurement = async () => {
    setSaving(true);
    try {
      await settingsService.updateSetting('finance.approval_threshold_po', thresholdPO, 'FINANCE', 'NUMBER', 'PO GM Threshold Limit');
      await settingsService.updateSetting('procurement.auto_rank', autoRank, 'FINANCE', 'BOOLEAN', 'Automatic comparison ranking weight toggling');
      showFeedback(true, 'Procurement configuration saved successfully.');
    } catch (err: any) {
      showFeedback(false, err.message || 'Failed to save procurement settings.');
    } finally {
      setSaving(false);
    }
  };

  const saveInventoryAssets = async () => {
    setSaving(true);
    try {
      await settingsService.updateSetting('inventory.mrf_approval_required', mrfApprovalRequired, 'FINANCE', 'BOOLEAN', 'MRF authorization toggle');
      await settingsService.updateSetting('inventory.low_stock_threshold', lowStockThreshold, 'FINANCE', 'NUMBER', 'Low stock alert threshold count');
      await settingsService.updateSetting('fleet.depreciation_lives_months', usefulLives, 'FINANCE', 'JSON', 'Straight line depreciation useful lives');
      showFeedback(true, 'Inventory & Assets rules updated successfully.');
    } catch (err: any) {
      showFeedback(false, err.message || 'Failed to save asset depreciation settings.');
    } finally {
      setSaving(false);
    }
  };

  const saveProjects = async () => {
    setSaving(true);
    try {
      await settingsService.updateSetting('projects.default_stages', defaultStages, 'WORKFLOW', 'ARRAY', 'Default stages array for projects pipeline');
      await settingsService.updateSetting('projects.vo_threshold', voThreshold, 'WORKFLOW', 'NUMBER', 'Variation orders GM approval threshold limit');
      showFeedback(true, 'Projects & Operations pipeline settings saved.');
    } catch (err: any) {
      showFeedback(false, err.message || 'Failed to save projects parameters.');
    } finally {
      setSaving(false);
    }
  };

  const saveMaintenance = async () => {
    setSaving(true);
    try {
      await settingsService.updateSetting('maintenance.slots', maintenanceSlots, 'WORKFLOW', 'ARRAY', 'Daily maintenance visiting slots');
      await settingsService.updateSetting('maintenance.sla_categories', slaCategories, 'WORKFLOW', 'JSON', 'SLA resolution hours scale details');
      showFeedback(true, 'Maintenance visiting slots & SLA response matrix saved.');
    } catch (err: any) {
      showFeedback(false, err.message || 'Failed to save SLA schedules.');
    } finally {
      setSaving(false);
    }
  };

  const saveHrWorkforce = async () => {
    setSaving(true);
    try {
      await settingsService.updateSetting('workflow.business_hours', businessHours, 'WORKFLOW', 'JSON', 'Shift operating timings');
      await settingsService.updateSetting('payroll.gratuity_entitlement_days', gratuityEntitlement, 'HR', 'JSON', 'Labor law gratuity brackets');
      showFeedback(true, 'Workforce calendars & Gratuity entitlement rules saved.');
    } catch (err: any) {
      showFeedback(false, err.message || 'Failed to save HR workforce parameters.');
    } finally {
      setSaving(false);
    }
  };

  const saveNotifications = async () => {
    setSaving(true);
    try {
      await settingsService.updateSetting('notifications.channel_toggles', notifications, 'NOTIFICATIONS', 'JSON', 'Global communication channels toggle flags');
      await settingsService.updateSetting('notifications.templates', notifTemplates, 'NOTIFICATIONS', 'JSON', 'Broadcast message formatting structures');
      showFeedback(true, 'Channels toggles & message notification templates saved.');
    } catch (err: any) {
      showFeedback(false, err.message || 'Failed to save communications templates.');
    } finally {
      setSaving(false);
    }
  };

  const saveTemplates = async () => {
    setSaving(true);
    try {
      await settingsService.updateSetting('company.document_templates', docTemplates, 'COMPANY', 'JSON', 'Branding presets and PDF layout specifications');
      showFeedback(true, 'Document templates layout specifications saved.');
    } catch (err: any) {
      showFeedback(false, err.message || 'Failed to save document templates.');
    } finally {
      setSaving(false);
    }
  };

  const saveIntegrations = async () => {
    setSaving(true);
    try {
      await settingsService.updateSetting('integrations.smtp_config', smtpConfig, 'INTEGRATIONS', 'JSON', 'SMTP Mail gateway configuration');
      await settingsService.updateSetting('integrations.whatsapp_gateway', whatsappGateway, 'INTEGRATIONS', 'JSON', 'WhatsApp API gateway URL & JWT Token');
      showFeedback(true, 'Gateway endpoints & credentials saved.');
    } catch (err: any) {
      showFeedback(false, err.message || 'Failed to save integrations config.');
    } finally {
      setSaving(false);
    }
  };

  const saveSystemAdmin = async () => {
    setSaving(true);
    try {
      await settingsService.updateSetting('system.app_mode', appMode, 'INTEGRATIONS', 'STRING', 'Active application compilation mode');
      await settingsService.updateSetting('system.log_level', logLevel, 'INTEGRATIONS', 'STRING', 'Verbose logger limit level');
      await settingsService.updateSetting('system.default_density', defaultDensity, 'INTEGRATIONS', 'STRING', 'Client interface layout spacing preference');
      showFeedback(true, 'System administration parameters updated.');
    } catch (err: any) {
      showFeedback(false, err.message || 'Failed to save app modes.');
    } finally {
      setSaving(false);
    }
  };

  const saveSecurity = async () => {
    setSaving(true);
    try {
      await settingsService.updateSetting('security.password_rules', passwordRules, 'INTEGRATIONS', 'JSON', 'Authentication complexity rules');
      await settingsService.updateSetting('security.session_timeout', sessionTimeout, 'INTEGRATIONS', 'NUMBER', 'Active session lock expiry minutes');
      showFeedback(true, 'Security credentials complexity rules updated.');
    } catch (err: any) {
      showFeedback(false, err.message || 'Failed to save security regulations.');
    } finally {
      setSaving(false);
    }
  };

  const saveBackup = async () => {
    setSaving(true);
    try {
      await settingsService.updateSetting('backup.settings', backupConfig, 'INTEGRATIONS', 'JSON', 'Database backup frequency config');
      showFeedback(true, 'Backup cron frequency & retention metrics updated.');
    } catch (err: any) {
      showFeedback(false, err.message || 'Failed to save backup schedules.');
    } finally {
      setSaving(false);
    }
  };

  const triggerMockBackupExport = () => {
    showFeedback(true, 'Forensic schema dump compiled. Downloading: JEET_ERP_BACKUP_SQL.zip (24.2 MB)...');
  };

  const toggleRoleStatus = async (role: Role) => {
    try {
      const updated = await userRoleService.toggleRoleStatus(role.id, !role.is_active);
      setRoles(roles.map(r => r.id === role.id ? updated : r));
      showFeedback(true, `Role '${role.name}' status set to ${updated.is_active ? 'Active' : 'Disabled'}`);
    } catch (err: any) {
      showFeedback(false, err.message || 'Failed to toggle role state.');
    }
  };

  // Helper lists for tag editing
  const addProjectStage = () => {
    if (!newStageInput.trim()) return;
    if (defaultStages.includes(newStageInput.trim())) return;
    setDefaultStages([...defaultStages, newStageInput.trim()]);
    setNewStageInput('');
  };

  const removeProjectStage = (stage: string) => {
    setDefaultStages(defaultStages.filter(s => s !== stage));
  };

  const addMaintSlot = () => {
    if (!newSlotInput.trim()) return;
    if (maintenanceSlots.includes(newSlotInput.trim())) return;
    setMaintenanceSlots([...maintenanceSlots, newSlotInput.trim()]);
    setNewSlotInput('');
  };

  const removeMaintSlot = (slot: string) => {
    setMaintenanceSlots(maintenanceSlots.filter(s => s !== slot));
  };

  const filteredUsers = users.filter(u => 
    u.full_name.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(userSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans theme-transition">
      <Can 
        perform="settings.manage"
        fallback={
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <AlertTriangle className="text-red-400 mb-2 animate-pulse" size={48} />
            <h1 className="text-xl font-bold font-heading">Access Denied</h1>
            <p className="text-xs text-slate-500 max-w-sm mt-1 leading-relaxed">
              Your account permissions do not authorize access to the Unified Settings Hub. Please contact a system administrator.
            </p>
          </div>
        }
      >
        <div className="flex-1 flex flex-col gap-5 p-6 max-w-6xl w-full mx-auto">
          {/* Header */}
          <header className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-900 pb-4">
            <div>
              <h1 className="text-2xl font-bold font-heading tracking-tight flex items-center gap-2">
                <Settings className="text-emerald-400 animate-spin-slow" size={24} /> Central Configuration Hub
              </h1>
              <p className="text-xs text-slate-400 font-mono mt-1 uppercase">
                Enterprise Settings Engine • Multi-Module Calibration Control Matrix
              </p>
            </div>
            {saving && (
              <div className="text-xs text-emerald-400 font-mono flex items-center gap-1.5 self-start md:self-auto mt-2 md:mt-0 bg-emerald-950/25 border border-emerald-500/20 px-2 py-1 rounded">
                <RefreshCw className="animate-spin" size={13} /> Processing request...
              </div>
            )}
          </header>

          {/* Feedback alerts */}
          {successMsg && (
            <div className="p-3 bg-emerald-950/20 border border-emerald-500/30 rounded text-xs text-emerald-400 flex items-center gap-2 font-medium animate-fadeIn">
              <CheckCircle size={15} /> {successMsg}
            </div>
          )}
          {errorMsg && (
            <div className="p-3 bg-red-950/20 border border-red-500/30 rounded text-xs text-red-400 flex items-center gap-2 font-medium animate-fadeIn">
              <AlertTriangle size={15} /> {errorMsg}
            </div>
          )}

          {/* Core Layout Workspace */}
          <div className="flex flex-col lg:flex-row gap-6 items-start">
            {/* Sidebar Tabs Selector */}
            <div className="w-full lg:w-64 flex flex-row lg:flex-col gap-1 bg-slate-900/30 p-1.5 border border-slate-900/80 rounded-lg overflow-x-auto lg:overflow-visible shrink-0 lg:max-h-[720px] lg:overflow-y-auto">
              {[
                { id: 'COMPANY', label: 'Company & Branding', icon: Building },
                { id: 'USERS_ROLES', label: 'Users, Roles & Perms', icon: Users },
                { id: 'FINANCE', label: 'Financial & Tax', icon: DollarSign },
                { id: 'PROCUREMENT', label: 'Procurement Settings', icon: Sliders },
                { id: 'INVENTORY', label: 'Inventory & Assets', icon: Layers },
                { id: 'PROJECTS', label: 'Projects & Operations', icon: Cpu },
                { id: 'MAINTENANCE', label: 'Maintenance & SLA', icon: Clock },
                { id: 'HR', label: 'HR & Workforce', icon: Clock },
                { id: 'NOTIFICATIONS', label: 'Notifications & Alerts', icon: Bell },
                { id: 'TEMPLATES', label: 'Document Templates', icon: FileCheck },
                { id: 'INTEGRATIONS', label: 'Integrations Config', icon: Share2 },
                { id: 'SYSTEM_ADMIN', label: 'System Administration', icon: Sliders },
                { id: 'SECURITY', label: 'Audit & Security', icon: Shield },
                { id: 'BACKUP', label: 'Backup & Recovery', icon: Database },
              ].map(tab => {
                const IconComponent = tab.icon;
                const isSelected = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-2 px-3 py-2 rounded text-xs font-semibold whitespace-nowrap lg:w-full transition-all text-left ${
                      isSelected
                        ? 'bg-emerald-500 text-slate-950 font-bold'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                    }`}
                  >
                    <IconComponent size={14} className="shrink-0" />
                    <span className="truncate">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Tab Details Form Container */}
            <div className="flex-1 w-full bg-slate-900/10 border border-slate-900 rounded-lg p-5 min-w-0">
              {loading ? (
                <div className="py-24 flex flex-col items-center justify-center">
                  <div className="h-7 w-7 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin mb-3"></div>
                  <p className="text-xs text-slate-500 font-mono uppercase">Querying settings store...</p>
                </div>
              ) : (
                <div className="flex flex-col gap-6">

                  {/* 1. COMPANY & BRANDING */}
                  {activeTab === 'COMPANY' && (
                    <div className="flex flex-col gap-4">
                      <div className="border-b border-slate-900 pb-3">
                        <h3 className="text-sm font-bold tracking-wider uppercase text-slate-400 flex items-center gap-1.5 font-heading">
                          <Building size={15} className="text-emerald-400" /> Company Profile Specifications
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 font-sans">
                          Manage registered company details, trade license, TRN numbers, contact credentials, and logo URLs.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-mono text-slate-500 uppercase font-bold mb-1">Company Registered Title</label>
                          <input 
                            type="text" 
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-900 rounded px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50 font-semibold"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-mono text-slate-500 uppercase font-bold mb-1">Tax Registration Number (TRN)</label>
                          <input 
                            type="text" 
                            value={trn}
                            onChange={(e) => setTrn(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-900 rounded px-2.5 py-1.5 text-xs text-slate-300 font-mono focus:outline-none focus:border-emerald-500/50"
                            placeholder="e.g. 100293849500003"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-mono text-slate-500 uppercase font-bold mb-1">Trade License Number</label>
                          <input 
                            type="text" 
                            value={tradeLicense}
                            onChange={(e) => setTradeLicense(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-900 rounded px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-mono text-slate-500 uppercase font-bold mb-1">Website URL</label>
                          <input 
                            type="text" 
                            value={website}
                            onChange={(e) => setWebsite(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-900 rounded px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-mono text-slate-500 uppercase font-bold mb-1">Branded Logo URL</label>
                          <input 
                            type="text" 
                            value={logoUrl}
                            onChange={(e) => setLogoUrl(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-900 rounded px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-mono text-slate-500 uppercase font-bold mb-1">Corporate Email Address</label>
                          <input 
                            type="text" 
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-900 rounded px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-mono text-slate-500 uppercase font-bold mb-1">Corporate Telephone</label>
                          <input 
                            type="text" 
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-900 rounded px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-mono text-slate-500 uppercase font-bold mb-1">Registered Site Address</label>
                          <input 
                            type="text" 
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-900 rounded px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50"
                          />
                        </div>
                      </div>

                      <button
                        onClick={saveCompanyProfile}
                        disabled={saving}
                        className="bg-emerald-500 text-slate-950 font-bold px-4 py-2 rounded text-xs hover:bg-emerald-400 transition-all flex items-center gap-1.5 ml-auto mt-2"
                      >
                        <Save size={13} /> Save Company Profile
                      </button>
                    </div>
                  )}

                  {/* 2. USERS, ROLES & PERMISSIONS */}
                  {activeTab === 'USERS_ROLES' && (
                    <div className="flex flex-col gap-6">
                      {/* Sub tab navigation */}
                      <div className="border-b border-slate-900 pb-3">
                        <h3 className="text-sm font-bold tracking-wider uppercase text-slate-400 flex items-center gap-1.5 font-heading">
                          <Users size={15} className="text-emerald-400" /> Users & Permissions Manager
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 font-sans">
                          Manage login credentials roles assignments and fine-tune permission matrix scopes.
                        </p>
                      </div>

                      {/* User Registry List */}
                      <div className="flex flex-col gap-3">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">Registered Users ({users.length})</h4>
                          <input 
                            type="text" 
                            placeholder="Search user..."
                            value={userSearch}
                            onChange={(e) => setUserSearch(e.target.value)}
                            className="bg-slate-950 border border-slate-900 rounded px-2 py-1 text-xs text-slate-300 focus:outline-none w-full sm:w-48 font-mono"
                          />
                        </div>

                        <div className="overflow-x-auto border border-slate-900 rounded-lg">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-slate-900/50 text-[10px] font-mono text-slate-400 uppercase border-b border-slate-900">
                                <th className="p-3">User Name</th>
                                <th className="p-3">Email Address</th>
                                <th className="p-3">Primary Legacy</th>
                                <th className="p-3">Active Assigned Roles</th>
                                <th className="p-3 text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredUsers.map(user => (
                                <tr key={user.id} className="border-b border-slate-900 hover:bg-slate-900/20 text-xs text-slate-300 font-sans">
                                  <td className="p-3 font-semibold text-slate-200">{user.full_name}</td>
                                  <td className="p-3 font-mono text-slate-400">{user.email}</td>
                                  <td className="p-3">
                                    <span className="bg-slate-800 text-[10px] font-bold text-slate-400 px-1.5 py-0.5 rounded font-mono uppercase">
                                      {user.role}
                                    </span>
                                  </td>
                                  <td className="p-3">
                                    <div className="flex flex-wrap gap-1">
                                      {user.roles.map(r => (
                                        <span key={r.id} className="bg-emerald-500/10 text-emerald-400 text-[9px] font-bold px-1.5 py-0.5 rounded border border-emerald-500/10 font-mono">
                                          {r.name}
                                        </span>
                                      ))}
                                      {user.roles.length === 0 && (
                                        <span className="text-[10px] text-slate-500 italic">No role mappings</span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="p-3 text-right">
                                    <button 
                                      onClick={() => handleOpenUserReassign(user)}
                                      className="text-emerald-400 hover:text-emerald-300 hover:underline text-[11px] font-semibold"
                                    >
                                      Reassign Roles
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Modal overlay for user role editing */}
                      {selectedUser && (
                        <div className="p-4 border border-slate-800 bg-slate-950/70 rounded-lg flex flex-col gap-3.5">
                          <div className="flex justify-between items-center border-b border-slate-900 pb-2">
                            <span className="text-xs font-bold text-slate-200">Reassign Roles for {selectedUser.full_name}</span>
                            <button onClick={() => setSelectedUser(null)} className="text-slate-500 hover:text-slate-300 text-xs">Cancel</button>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {roles.map(r => {
                              const isChecked = selectedUserRoles.includes(r.id);
                              return (
                                <button
                                  key={r.id}
                                  onClick={() => {
                                    if (isChecked) {
                                      setSelectedUserRoles(selectedUserRoles.filter(id => id !== r.id));
                                    } else {
                                      setSelectedUserRoles([...selectedUserRoles, r.id]);
                                    }
                                  }}
                                  className={`p-2 border text-left rounded text-xs transition-all ${
                                    isChecked
                                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-bold'
                                      : 'bg-slate-900 border-slate-800 text-slate-400'
                                  }`}
                                >
                                  {r.name}
                                </button>
                              );
                            })}
                          </div>
                          <button
                            onClick={saveUserRolesReassignment}
                            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-3 py-1.5 rounded text-xs self-end"
                          >
                            Save Role Changes
                          </button>
                        </div>
                      )}

                      {/* Role Matrix Selector & Editor */}
                      <div className="flex flex-col gap-4 border-t border-slate-900 pt-6">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                          <div>
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">Roles Activation & Permission Matrix</h4>
                            <p className="text-[10px] text-slate-500 mt-0.5">Edit fine-grained scopes dynamically mapped to permissions database triggers.</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-xs text-slate-400 font-medium">Select Role:</label>
                            <select
                              value={selectedRoleForMatrix}
                              onChange={(e) => setSelectedRoleForMatrix(e.target.value)}
                              className="bg-slate-950 border border-slate-900 text-slate-300 rounded px-2.5 py-1.5 text-xs font-semibold focus:outline-none"
                            >
                              {roles.map(r => (
                                <option key={r.id} value={r.id}>{r.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Toggle active state of selected role */}
                        {selectedRoleForMatrix && (
                          <div className="flex items-center justify-between p-3 bg-slate-950/40 border border-slate-900 rounded">
                            <div>
                              <span className="text-xs font-bold text-slate-200">Role Active Status</span>
                              <p className="text-[10px] text-slate-500">Deactivated roles prevent allocated users from gaining corresponding scope rights.</p>
                            </div>
                            <button
                              onClick={() => {
                                const role = roles.find(r => r.id === selectedRoleForMatrix);
                                if (role) toggleRoleStatus(role);
                              }}
                              className={`px-3 py-1.5 rounded text-xs font-bold border ${
                                roles.find(r => r.id === selectedRoleForMatrix)?.is_active
                                  ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-400'
                                  : 'bg-red-500/15 border-red-500/35 text-red-400'
                              }`}
                            >
                              {roles.find(r => r.id === selectedRoleForMatrix)?.is_active ? 'Active' : 'Disabled'}
                            </button>
                          </div>
                        )}

                        {/* Permissions scope matrix list */}
                        <div className="max-h-[380px] overflow-y-auto border border-slate-900 rounded-lg">
                          <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-900/50 sticky top-0 border-b border-slate-900">
                              <tr className="text-[10px] font-mono text-slate-400 uppercase">
                                <th className="p-3">Module</th>
                                <th className="p-3">Permission Key</th>
                                <th className="p-3">Description</th>
                                <th className="p-3">Assigned Scope / Matrix Rule</th>
                              </tr>
                            </thead>
                            <tbody>
                              {permissions.map(perm => {
                                const currentScope = matrixPermissions[perm.permission_key] || 'NONE';
                                return (
                                  <tr key={perm.id} className="border-b border-slate-900/70 hover:bg-slate-900/10 text-xs text-slate-300">
                                    <td className="p-3 font-bold text-emerald-400/80 font-mono text-[10px]">{perm.module}</td>
                                    <td className="p-3 font-mono text-slate-400 text-[11px]">{perm.permission_key}</td>
                                    <td className="p-3 leading-relaxed max-w-xs">{perm.description}</td>
                                    <td className="p-3">
                                      <select
                                        value={currentScope}
                                        onChange={(e) => setMatrixPermissions({
                                          ...matrixPermissions,
                                          [perm.permission_key]: e.target.value as any
                                        })}
                                        className={`bg-slate-950 border text-[11px] font-mono rounded px-2 py-1 focus:outline-none ${
                                          currentScope === 'NONE'
                                            ? 'border-slate-800 text-slate-500'
                                            : 'border-emerald-500/30 text-emerald-400 font-bold'
                                        }`}
                                      >
                                        <option value="NONE">NONE (Disabled)</option>
                                        <option value="ALL">ALL (Full Access)</option>
                                        <option value="TEAM">TEAM (Departmental)</option>
                                        <option value="ASSIGNED">ASSIGNED (Direct Only)</option>
                                        <option value="OWN">OWN (Created Only)</option>
                                      </select>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        <button
                          onClick={savePermissionsMatrix}
                          disabled={saving}
                          className="bg-emerald-500 text-slate-950 font-bold px-4 py-2 rounded text-xs hover:bg-emerald-400 transition-all flex items-center gap-1.5 ml-auto mt-2"
                        >
                          <Save size={13} /> Save Permissions Matrix
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 3. FINANCIAL & TAX */}
                  {activeTab === 'FINANCE' && (
                    <div className="flex flex-col gap-4">
                      <div className="border-b border-slate-900 pb-3">
                        <h3 className="text-sm font-bold tracking-wider uppercase text-slate-400 flex items-center gap-1.5 font-heading">
                          <DollarSign size={15} className="text-emerald-400" /> Financial Calibration & Tax settings
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 font-sans">
                          Regulate VAT brackets, filing months, Quotation authority thresholds, and primary currencies.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-mono text-slate-500 uppercase font-bold mb-1">Standard VAT percentage (%)</label>
                          <input 
                            type="number" 
                            step="0.01"
                            value={vatRate}
                            onChange={(e) => setVatRate(Number(e.target.value))}
                            className="w-full bg-slate-950 border border-slate-900 rounded px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50 font-semibold"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-mono text-slate-500 uppercase font-bold mb-1">VAT Filing period (Months)</label>
                          <input 
                            type="number" 
                            value={vatPeriodMonths}
                            onChange={(e) => setVatPeriodMonths(Number(e.target.value))}
                            className="w-full bg-slate-950 border border-slate-900 rounded px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50 font-semibold"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-mono text-slate-500 uppercase font-bold mb-1">Quote approval limit (Requires GM Approval)</label>
                          <input 
                            type="number" 
                            value={thresholdQuote}
                            onChange={(e) => setThresholdQuote(Number(e.target.value))}
                            className="w-full bg-slate-950 border border-slate-900 rounded px-2.5 py-1.5 text-xs text-slate-300 font-mono focus:outline-none focus:border-emerald-500/50"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-mono text-slate-500 uppercase font-bold mb-1">Base currency code</label>
                          <input 
                            type="text" 
                            value={currency}
                            onChange={(e) => setCurrency(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-900 rounded px-2.5 py-1.5 text-xs text-slate-300 font-mono focus:outline-none focus:border-emerald-500/50"
                          />
                        </div>
                      </div>

                      <button
                        onClick={saveFinancials}
                        disabled={saving}
                        className="bg-emerald-500 text-slate-950 font-bold px-4 py-2 rounded text-xs hover:bg-emerald-400 transition-all flex items-center gap-1.5 ml-auto mt-2"
                      >
                        <Save size={13} /> Save Financial Settings
                      </button>
                    </div>
                  )}

                  {/* 4. PROCUREMENT */}
                  {activeTab === 'PROCUREMENT' && (
                    <div className="flex flex-col gap-4">
                      <div className="border-b border-slate-900 pb-3">
                        <h3 className="text-sm font-bold tracking-wider uppercase text-slate-400 flex items-center gap-1.5 font-heading">
                          <Sliders size={15} className="text-emerald-400" /> Procurement & Sourcing Parameters
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 font-sans">
                          Configure purchase order authorization levels and vendor evaluation settings.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-mono text-slate-500 uppercase font-bold mb-1">Purchase Order limit (Requires GM Approval)</label>
                          <input 
                            type="number" 
                            value={thresholdPO}
                            onChange={(e) => setThresholdPO(Number(e.target.value))}
                            className="w-full bg-slate-950 border border-slate-900 rounded px-2.5 py-1.5 text-xs text-slate-300 font-mono focus:outline-none focus:border-emerald-500/50"
                          />
                        </div>
                        <div className="flex items-center justify-between p-3 bg-slate-950/40 border border-slate-900 rounded mt-5">
                          <div>
                            <span className="text-xs font-bold text-slate-200">Auto Rank Supplier Comparisons</span>
                            <p className="text-[10px] text-slate-500">Enable automatic ranking based on price and delivery speeds.</p>
                          </div>
                          <button
                            onClick={() => setAutoRank(!autoRank)}
                            className={`w-11 h-6 rounded-full p-1 transition-colors duration-200 focus:outline-none ${
                              autoRank ? 'bg-emerald-500' : 'bg-slate-800'
                            }`}
                          >
                            <div className={`bg-slate-950 w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                              autoRank ? 'translate-x-5' : 'translate-x-0'
                            }`} />
                          </button>
                        </div>
                      </div>

                      <button
                        onClick={saveProcurement}
                        disabled={saving}
                        className="bg-emerald-500 text-slate-950 font-bold px-4 py-2 rounded text-xs hover:bg-emerald-400 transition-all flex items-center gap-1.5 ml-auto mt-2"
                      >
                        <Save size={13} /> Save Procurement Settings
                      </button>
                    </div>
                  )}

                  {/* 5. INVENTORY & ASSETS */}
                  {activeTab === 'INVENTORY' && (
                    <div className="flex flex-col gap-4">
                      <div className="border-b border-slate-900 pb-3">
                        <h3 className="text-sm font-bold tracking-wider uppercase text-slate-400 flex items-center gap-1.5 font-heading">
                          <Layers size={15} className="text-emerald-400" /> Inventory & Capital Assets Calibration
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 font-sans">
                          Manage MRF workflow sequences and straight-line depreciation months settings.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 border-b border-slate-900">
                        <div className="flex items-center justify-between p-3 bg-slate-950/40 border border-slate-900 rounded">
                          <div>
                            <span className="text-xs font-bold text-slate-200">MRF Approval Check Required</span>
                            <p className="text-[10px] text-slate-500">Requires Site Engineer requests to be approved by PM before store issues.</p>
                          </div>
                          <button
                            onClick={() => setMrfApprovalRequired(!mrfApprovalRequired)}
                            className={`w-11 h-6 rounded-full p-1 transition-colors duration-200 focus:outline-none ${
                              mrfApprovalRequired ? 'bg-emerald-500' : 'bg-slate-800'
                            }`}
                          >
                            <div className={`bg-slate-950 w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                              mrfApprovalRequired ? 'translate-x-5' : 'translate-x-0'
                            }`} />
                          </button>
                        </div>
                        <div>
                          <label className="block text-[10px] font-mono text-slate-500 uppercase font-bold mb-1">Low Stock Warning Threshold</label>
                          <input 
                            type="number" 
                            value={lowStockThreshold}
                            onChange={(e) => setLowStockThreshold(Number(e.target.value))}
                            className="w-full bg-slate-950 border border-slate-900 rounded px-2.5 py-1.5 text-xs text-slate-300 font-mono focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Straight Line Depreciation category values */}
                      <div>
                        <h4 className="text-xs font-bold text-slate-300 mb-2.5">Straight-Line Depreciation Lifetimes (Months)</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                          {Object.entries(usefulLives).map(([category, months]) => (
                            <div key={category} className="p-3 bg-slate-950 border border-slate-900 rounded">
                              <label className="block text-[9px] font-mono text-slate-500 uppercase font-bold mb-1 truncate">{category.replace('_', ' ')}</label>
                              <input 
                                type="number" 
                                value={months}
                                onChange={(e) => setUsefulLives({
                                  ...usefulLives,
                                  [category]: Number(e.target.value)
                                })}
                                className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 font-bold focus:outline-none"
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      <button
                        onClick={saveInventoryAssets}
                        disabled={saving}
                        className="bg-emerald-500 text-slate-950 font-bold px-4 py-2 rounded text-xs hover:bg-emerald-400 transition-all flex items-center gap-1.5 ml-auto mt-2"
                      >
                        <Save size={13} /> Save Inventory Settings
                      </button>
                    </div>
                  )}

                  {/* 6. PROJECTS & OPERATIONS */}
                  {activeTab === 'PROJECTS' && (
                    <div className="flex flex-col gap-4">
                      <div className="border-b border-slate-900 pb-3">
                        <h3 className="text-sm font-bold tracking-wider uppercase text-slate-400 flex items-center gap-1.5 font-heading">
                          <Cpu size={15} className="text-emerald-400" /> Projects & Operations calibration
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 font-sans">
                          Configure project sequence states and Variation Order escalation thresholds.
                        </p>
                      </div>

                      <div className="flex flex-col gap-3">
                        <label className="block text-[10px] font-mono text-slate-500 uppercase font-bold">Default Project Execution Stages</label>
                        <div className="flex flex-wrap gap-1.5 p-3 bg-slate-950/40 border border-slate-900 rounded-lg min-h-[50px]">
                          {defaultStages.map(stage => (
                            <span key={stage} className="bg-slate-900 text-slate-300 text-[10px] px-2 py-1 rounded border border-slate-800 flex items-center gap-1.5 font-mono">
                              {stage}
                              <button onClick={() => removeProjectStage(stage)} className="text-red-400 hover:text-red-300 font-bold">×</button>
                            </span>
                          ))}
                          {defaultStages.length === 0 && (
                            <span className="text-[10px] text-slate-600 italic">No stages configured.</span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            placeholder="Add stage title..."
                            value={newStageInput}
                            onChange={(e) => setNewStageInput(e.target.value)}
                            className="bg-slate-950 border border-slate-900 rounded px-2.5 py-1 text-xs text-slate-300 focus:outline-none w-48 font-mono"
                          />
                          <button 
                            onClick={addProjectStage}
                            className="bg-slate-900 hover:bg-slate-800 border border-slate-850 px-3 rounded text-[11px] font-semibold text-slate-300"
                          >
                            + Add
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                        <div>
                          <label className="block text-[10px] font-mono text-slate-500 uppercase font-bold mb-1">VO Limit (Requires GM Approval)</label>
                          <input 
                            type="number" 
                            value={voThreshold}
                            onChange={(e) => setVoThreshold(Number(e.target.value))}
                            className="w-full bg-slate-950 border border-slate-900 rounded px-2.5 py-1.5 text-xs text-slate-300 font-mono focus:outline-none"
                          />
                        </div>
                      </div>

                      <button
                        onClick={saveProjects}
                        disabled={saving}
                        className="bg-emerald-500 text-slate-950 font-bold px-4 py-2 rounded text-xs hover:bg-emerald-400 transition-all flex items-center gap-1.5 ml-auto mt-2"
                      >
                        <Save size={13} /> Save Project Settings
                      </button>
                    </div>
                  )}

                  {/* 7. MAINTENANCE & SLA */}
                  {activeTab === 'MAINTENANCE' && (
                    <div className="flex flex-col gap-4">
                      <div className="border-b border-slate-900 pb-3">
                        <h3 className="text-sm font-bold tracking-wider uppercase text-slate-400 flex items-center gap-1.5 font-heading">
                          <Clock size={15} className="text-emerald-400" /> Maintenance Slots & SLA response speeds
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 font-sans">
                          Manage reactive SLA category timings and scheduling slot defaults.
                        </p>
                      </div>

                      <div className="flex flex-col gap-3">
                        <label className="block text-[10px] font-mono text-slate-500 uppercase font-bold">PPM Visits Timings Slots</label>
                        <div className="flex flex-wrap gap-1.5 p-3 bg-slate-950/40 border border-slate-900 rounded-lg min-h-[50px]">
                          {maintenanceSlots.map(slot => (
                            <span key={slot} className="bg-slate-900 text-slate-300 text-[10px] px-2 py-1 rounded border border-slate-800 flex items-center gap-1.5 font-mono">
                              {slot}
                              <button onClick={() => removeMaintSlot(slot)} className="text-red-400 hover:text-red-300 font-bold">×</button>
                            </span>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            placeholder="e.g. 18:00 - 20:00"
                            value={newSlotInput}
                            onChange={(e) => setNewSlotInput(e.target.value)}
                            className="bg-slate-950 border border-slate-900 rounded px-2.5 py-1 text-xs text-slate-300 focus:outline-none w-48 font-mono"
                          />
                          <button 
                            onClick={addMaintSlot}
                            className="bg-slate-900 hover:bg-slate-800 border border-slate-850 px-3 rounded text-[11px] font-semibold text-slate-300"
                          >
                            + Add
                          </button>
                        </div>
                      </div>

                      {/* SLA categories */}
                      <div className="mt-2">
                        <h4 className="text-xs font-bold text-slate-300 mb-2.5">SLA Target Resolution Timings (Hours)</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {Object.entries(slaCategories).map(([category, hours]) => (
                            <div key={category} className="p-3 bg-slate-950 border border-slate-900 rounded">
                              <label className="block text-[9px] font-mono text-slate-500 uppercase font-bold mb-1 truncate text-emerald-400">{category}</label>
                              <input 
                                type="number" 
                                value={hours}
                                onChange={(e) => setSlaCategories({
                                  ...slaCategories,
                                  [category]: Number(e.target.value)
                                })}
                                className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 font-mono font-bold focus:outline-none"
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      <button
                        onClick={saveMaintenance}
                        disabled={saving}
                        className="bg-emerald-500 text-slate-950 font-bold px-4 py-2 rounded text-xs hover:bg-emerald-400 transition-all flex items-center gap-1.5 ml-auto mt-2"
                      >
                        <Save size={13} /> Save Maintenance SLA
                      </button>
                    </div>
                  )}

                  {/* 8. HR & WORKFORCE */}
                  {activeTab === 'HR' && (
                    <div className="flex flex-col gap-4">
                      <div className="border-b border-slate-900 pb-3">
                        <h3 className="text-sm font-bold tracking-wider uppercase text-slate-400 flex items-center gap-1.5 font-heading">
                          <Clock size={15} className="text-emerald-400" /> HR Calendars & Gratuity entitlement
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 font-sans">
                          Manage shift operational hours, working days, and UAE Labor Law Gratuity entitlement days scale.
                        </p>
                      </div>

                      {/* Business Hours */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 border-b border-slate-900">
                        <div>
                          <label className="block text-[10px] font-mono text-slate-500 uppercase font-bold mb-1">Shift Start Time</label>
                          <input 
                            type="time" 
                            value={businessHours.start}
                            onChange={(e) => setBusinessHours({ ...businessHours, start: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-900 rounded px-2.5 py-1.5 text-xs text-slate-300 font-mono focus:outline-none focus:border-emerald-500/50"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-mono text-slate-500 uppercase font-bold mb-1">Shift End Time</label>
                          <input 
                            type="time" 
                            value={businessHours.end}
                            onChange={(e) => setBusinessHours({ ...businessHours, end: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-900 rounded px-2.5 py-1.5 text-xs text-slate-300 font-mono focus:outline-none focus:border-emerald-500/50"
                          />
                        </div>
                      </div>

                      {/* Working Days */}
                      <div className="pb-4 border-b border-slate-900">
                        <label className="block text-[10px] font-mono text-slate-500 uppercase font-bold mb-2">Weekly Working Days</label>
                        <div className="flex flex-wrap gap-2">
                          {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, idx) => {
                            const isSelected = businessHours.working_days.includes(idx);
                            return (
                              <button
                                key={day}
                                onClick={() => {
                                  const currentDays = [...businessHours.working_days];
                                  const index = currentDays.indexOf(idx);
                                  if (index === -1) {
                                    currentDays.push(idx);
                                  } else {
                                    currentDays.splice(index, 1);
                                  }
                                  setBusinessHours({
                                    ...businessHours,
                                    working_days: currentDays.sort()
                                  });
                                }}
                                className={`px-3 py-1.5 rounded text-xs font-semibold border transition-all ${
                                  isSelected
                                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 font-bold'
                                    : 'bg-slate-950 border-slate-900 text-slate-500 hover:text-slate-300'
                                }`}
                              >
                                {day}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Gratuity brackets */}
                      <div>
                        <h4 className="text-xs font-bold text-slate-300 mb-2.5">UAE Gratuity Entitlement Accrual Rates (Days per Year)</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-[9px] font-mono text-slate-500 uppercase font-bold mb-1">Under 1 Year Service</label>
                            <input 
                              type="number" 
                              value={gratuityEntitlement.under_1yr}
                              onChange={(e) => setGratuityEntitlement({
                                ...gratuityEntitlement,
                                under_1yr: Number(e.target.value)
                              })}
                              className="w-full bg-slate-950 border border-slate-900 rounded px-2.5 py-1.5 text-xs text-slate-300 font-mono focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-mono text-slate-500 uppercase font-bold mb-1">1 to 5 Years Service</label>
                            <input 
                              type="number" 
                              value={gratuityEntitlement['1to5yr']}
                              onChange={(e) => setGratuityEntitlement({
                                ...gratuityEntitlement,
                                '1to5yr': Number(e.target.value)
                              })}
                              className="w-full bg-slate-950 border border-slate-900 rounded px-2.5 py-1.5 text-xs text-slate-300 font-mono focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-mono text-slate-500 uppercase font-bold mb-1">Above 5 Years Service</label>
                            <input 
                              type="number" 
                              value={gratuityEntitlement.above5yr}
                              onChange={(e) => setGratuityEntitlement({
                                ...gratuityEntitlement,
                                above5yr: Number(e.target.value)
                              })}
                              className="w-full bg-slate-950 border border-slate-900 rounded px-2.5 py-1.5 text-xs text-slate-300 font-mono focus:outline-none"
                            />
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={saveHrWorkforce}
                        disabled={saving}
                        className="bg-emerald-500 text-slate-950 font-bold px-4 py-2 rounded text-xs hover:bg-emerald-400 transition-all flex items-center gap-1.5 ml-auto mt-2"
                      >
                        <Save size={13} /> Save HR Workforce Settings
                      </button>
                    </div>
                  )}

                  {/* 9. NOTIFICATIONS & COMMUNICATIONS */}
                  {activeTab === 'NOTIFICATIONS' && (
                    <div className="flex flex-col gap-4">
                      <div className="border-b border-slate-900 pb-3">
                        <h3 className="text-sm font-bold tracking-wider uppercase text-slate-400 flex items-center gap-1.5 font-heading">
                          <Bell size={15} className="text-emerald-400" /> Notifications & Communications Control
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 font-sans">
                          Toggle global notification channels and modify standard message body structures.
                        </p>
                      </div>

                      {/* Channels list toggles */}
                      <div className="flex flex-col gap-3.5 bg-slate-950/40 p-4 border border-slate-900 rounded-lg">
                        {Object.entries(notifications).map(([channel, active]) => (
                          <div key={channel} className="flex items-center justify-between border-b border-slate-900/60 last:border-b-0 pb-3 last:pb-0 first:pt-0 pt-3">
                            <div>
                              <span className="text-xs font-bold text-slate-200 capitalize">{channel} Dispatch Gateway</span>
                              <p className="text-[10px] text-slate-500 mt-0.5">Toggle transmission for high priority events.</p>
                            </div>
                            <button
                              onClick={() => setNotifications({ ...notifications, [channel]: !active })}
                              className={`w-11 h-6 rounded-full p-1 transition-colors duration-200 focus:outline-none ${
                                active ? 'bg-emerald-500' : 'bg-slate-800'
                              }`}
                            >
                              <div className={`bg-slate-950 w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                                active ? 'translate-x-5' : 'translate-x-0'
                              }`} />
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* Msg text templates */}
                      <div className="flex flex-col gap-3">
                        <h4 className="text-xs font-bold text-slate-300">Message Text Templates (Use variables like {`{number}`}, {`{client_name}`})</h4>
                        <div>
                          <label className="block text-[9px] font-mono text-slate-500 uppercase font-bold mb-1">Quotation Sent Message</label>
                          <textarea
                            rows={2}
                            value={notifTemplates.quotation_sent}
                            onChange={(e) => setNotifTemplates({ ...notifTemplates, quotation_sent: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-900 rounded px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-mono text-slate-500 uppercase font-bold mb-1">Purchase Order Approved Message</label>
                          <textarea
                            rows={2}
                            value={notifTemplates.po_approved}
                            onChange={(e) => setNotifTemplates({ ...notifTemplates, po_approved: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-900 rounded px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-mono text-slate-500 uppercase font-bold mb-1">Ticket Assigned SMS/WhatsApp Body</label>
                          <textarea
                            rows={2}
                            value={notifTemplates.ticket_assigned}
                            onChange={(e) => setNotifTemplates({ ...notifTemplates, ticket_assigned: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-900 rounded px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none"
                          />
                        </div>
                      </div>

                      <button
                        onClick={saveNotifications}
                        disabled={saving}
                        className="bg-emerald-500 text-slate-950 font-bold px-4 py-2 rounded text-xs hover:bg-emerald-400 transition-all flex items-center gap-1.5 ml-auto mt-2"
                      >
                        <Save size={13} /> Save Notifications Templates
                      </button>
                    </div>
                  )}

                  {/* 10. DOCUMENT TEMPLATES */}
                  {activeTab === 'TEMPLATES' && (
                    <div className="flex flex-col gap-4">
                      <div className="border-b border-slate-900 pb-3">
                        <h3 className="text-sm font-bold tracking-wider uppercase text-slate-400 flex items-center gap-1.5 font-heading">
                          <FileCheck size={15} className="text-emerald-400" /> Branded PDF & Document Style Presets
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 font-sans">
                          Customize the headers, accent colors, and footer disclaimers generated across all ERP modules.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-mono text-slate-500 uppercase font-bold mb-1">PDF Main Header Title</label>
                          <input 
                            type="text" 
                            value={docTemplates.header_title}
                            onChange={(e) => setDocTemplates({ ...docTemplates, header_title: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-900 rounded px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-mono text-slate-500 uppercase font-bold mb-1">PDF Header Subtext Description</label>
                          <input 
                            type="text" 
                            value={docTemplates.header_subtitle}
                            onChange={(e) => setDocTemplates({ ...docTemplates, header_subtitle: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-900 rounded px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-mono text-slate-500 uppercase font-bold mb-1">Document Theme Accent Palette</label>
                          <select
                            value={docTemplates.accent_color}
                            onChange={(e) => setDocTemplates({ ...docTemplates, accent_color: e.target.value as any })}
                            className="w-full bg-slate-950 border border-slate-900 text-slate-300 rounded px-2.5 py-1.5 text-xs font-semibold focus:outline-none"
                          >
                            <option value="slate">Slate Dark (Primary Slate-900)</option>
                            <option value="mint">Electric Mint (Electric UAE Mint)</option>
                            <option value="gold">Amber Metallic Gold (Defects Liability DLP Gold)</option>
                            <option value="red">Crimson Alert Red (Credit Notes Accent)</option>
                          </select>
                        </div>
                      </div>

                      {/* Footer terms for different documents */}
                      <div className="flex flex-col gap-3.5 border-t border-slate-900 pt-4 mt-2">
                        <h4 className="text-xs font-bold text-slate-300">Footers & Disclaimer terms for generated PDFs</h4>
                        <div>
                          <label className="block text-[9px] font-mono text-slate-500 uppercase font-bold mb-1">Tax Invoice Footer Terms</label>
                          <textarea
                            rows={2}
                            value={docTemplates.invoice_disclaimer}
                            onChange={(e) => setDocTemplates({ ...docTemplates, invoice_disclaimer: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-900 rounded px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-mono text-slate-500 uppercase font-bold mb-1">Project Handover Closeout Disclaimer</label>
                          <textarea
                            rows={2}
                            value={docTemplates.handover_disclaimer}
                            onChange={(e) => setDocTemplates({ ...docTemplates, handover_disclaimer: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-900 rounded px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-mono text-slate-500 uppercase font-bold mb-1">PPM Maintenance Visit report Disclaimer</label>
                          <textarea
                            rows={2}
                            value={docTemplates.ppm_disclaimer}
                            onChange={(e) => setDocTemplates({ ...docTemplates, ppm_disclaimer: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-900 rounded px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-mono text-slate-500 uppercase font-bold mb-1">Variation Order Sheet disclaimer</label>
                          <textarea
                            rows={2}
                            value={docTemplates.vo_disclaimer}
                            onChange={(e) => setDocTemplates({ ...docTemplates, vo_disclaimer: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-900 rounded px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none font-mono"
                          />
                        </div>
                      </div>

                      <button
                        onClick={saveTemplates}
                        disabled={saving}
                        className="bg-emerald-500 text-slate-950 font-bold px-4 py-2 rounded text-xs hover:bg-emerald-400 transition-all flex items-center gap-1.5 ml-auto mt-2"
                      >
                        <Save size={13} /> Save PDF Styling Templates
                      </button>
                    </div>
                  )}

                  {/* 11. INTEGRATIONS */}
                  {activeTab === 'INTEGRATIONS' && (
                    <div className="flex flex-col gap-4">
                      <div className="border-b border-slate-900 pb-3">
                        <h3 className="text-sm font-bold tracking-wider uppercase text-slate-400 flex items-center gap-1.5 font-heading">
                          <Share2 size={15} className="text-emerald-400" /> Integrations & API Credentials
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 font-sans">
                          Manage SMTP Mail Relays, SMS gateways, and API tokens for messaging channels.
                        </p>
                      </div>

                      <div className="flex flex-col gap-4 bg-slate-950/40 p-4 border border-slate-900 rounded-lg">
                        <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5"><Sliders size={13} className="text-emerald-400" /> SMTP Mail Host settings</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-[9px] font-mono text-slate-500 uppercase font-bold mb-1">SMTP Server IP/Host</label>
                            <input 
                              type="text" 
                              value={smtpConfig.host}
                              onChange={(e) => setSmtpConfig({ ...smtpConfig, host: e.target.value })}
                              className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-mono text-slate-500 uppercase font-bold mb-1">SMTP TLS/SSL Port</label>
                            <input 
                              type="number" 
                              value={smtpConfig.port}
                              onChange={(e) => setSmtpConfig({ ...smtpConfig, port: Number(e.target.value) })}
                              className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-mono text-slate-500 uppercase font-bold mb-1">SMTP Login user</label>
                            <input 
                              type="text" 
                              value={smtpConfig.user}
                              onChange={(e) => setSmtpConfig({ ...smtpConfig, user: e.target.value })}
                              className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-4 bg-slate-950/40 p-4 border border-slate-900 rounded-lg mt-2">
                        <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5 font-sans"><Sparkles size={13} className="text-emerald-400" /> WhatsApp API gateway credentials</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[9px] font-mono text-slate-500 uppercase font-bold mb-1">API Dispatch Gateway URL</label>
                            <input 
                              type="text" 
                              value={whatsappGateway.url}
                              onChange={(e) => setWhatsappGateway({ ...whatsappGateway, url: e.target.value })}
                              className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-mono text-slate-500 uppercase font-bold mb-1">JWT Auth Bearer Token</label>
                            <input 
                              type="password" 
                              value={whatsappGateway.token}
                              onChange={(e) => setWhatsappGateway({ ...whatsappGateway, token: e.target.value })}
                              className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none font-mono"
                            />
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={saveIntegrations}
                        disabled={saving}
                        className="bg-emerald-500 text-slate-950 font-bold px-4 py-2 rounded text-xs hover:bg-emerald-400 transition-all flex items-center gap-1.5 ml-auto mt-2"
                      >
                        <Save size={13} /> Save Integrations Credentials
                      </button>
                    </div>
                  )}

                  {/* 12. SYSTEM ADMINISTRATION */}
                  {activeTab === 'SYSTEM_ADMIN' && (
                    <div className="flex flex-col gap-4">
                      <div className="border-b border-slate-900 pb-3">
                        <h3 className="text-sm font-bold tracking-wider uppercase text-slate-400 flex items-center gap-1.5 font-heading">
                          <Sliders size={15} className="text-emerald-400" /> System administration preferences
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 font-sans">
                          Regulate active application host states, logger options, and dense UI spacing formats.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-[10px] font-mono text-slate-500 uppercase font-bold mb-1">Application running mode</label>
                          <select
                            value={appMode}
                            onChange={(e) => setAppMode(e.target.value as any)}
                            className="w-full bg-slate-950 border border-slate-900 text-slate-300 rounded px-2.5 py-1.5 text-xs font-semibold focus:outline-none"
                          >
                            <option value="development">Development (Detailed UI messages)</option>
                            <option value="production">Production (High speed caching)</option>
                            <option value="maintenance">Maintenance mode (DB write locks)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-mono text-slate-500 uppercase font-bold mb-1">Logger Verbosity level</label>
                          <select
                            value={logLevel}
                            onChange={(e) => setLogLevel(e.target.value as any)}
                            className="w-full bg-slate-950 border border-slate-900 text-slate-300 rounded px-2.5 py-1.5 text-xs font-semibold focus:outline-none"
                          >
                            <option value="debug">DEBUG (Trace stack traces)</option>
                            <option value="info">INFO (General events logs)</option>
                            <option value="warn">WARNINGS (Only deprecations)</option>
                            <option value="error">ERRORS (Severe operations faults)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-mono text-slate-500 uppercase font-bold mb-1">Default Spacing Density</label>
                          <select
                            value={defaultDensity}
                            onChange={(e) => setDefaultDensity(e.target.value as any)}
                            className="w-full bg-slate-950 border border-slate-900 text-slate-300 rounded px-2.5 py-1.5 text-xs font-semibold focus:outline-none"
                          >
                            <option value="comfortable">Comfortable spacing</option>
                            <option value="compact">Dense / Compact spacing (Linear-grade)</option>
                          </select>
                        </div>
                      </div>

                      <button
                        onClick={saveSystemAdmin}
                        disabled={saving}
                        className="bg-emerald-500 text-slate-950 font-bold px-4 py-2 rounded text-xs hover:bg-emerald-400 transition-all flex items-center gap-1.5 ml-auto mt-2"
                      >
                        <Save size={13} /> Save System Settings
                      </button>
                    </div>
                  )}

                  {/* 13. AUDIT & SECURITY */}
                  {activeTab === 'SECURITY' && (
                    <div className="flex flex-col gap-6">
                      <div className="border-b border-slate-900 pb-3">
                        <h3 className="text-sm font-bold tracking-wider uppercase text-slate-400 flex items-center gap-1.5 font-heading">
                          <Shield size={15} className="text-emerald-400" /> Security Controls & Forensic Audit Logs
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 font-sans">
                          Manage password complexity limits, idle session logouts, and search immutable forensic audit logs.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-[10px] font-mono text-slate-500 uppercase font-bold mb-1">Min Password length</label>
                          <input 
                            type="number" 
                            value={passwordRules.min_length}
                            onChange={(e) => setPasswordRules({ ...passwordRules, min_length: Number(e.target.value) })}
                            className="w-full bg-slate-950 border border-slate-900 rounded px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none"
                          />
                        </div>
                        <div className="flex items-center justify-between p-3 bg-slate-950/40 border border-slate-900 rounded">
                          <div>
                            <span className="text-xs font-bold text-slate-200">Require Special Character</span>
                            <p className="text-[9px] text-slate-500">Require special symbol during passwords resets.</p>
                          </div>
                          <button
                            onClick={() => setPasswordRules({ ...passwordRules, require_special: !passwordRules.require_special })}
                            className={`w-10 h-5.5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none ${
                              passwordRules.require_special ? 'bg-emerald-500' : 'bg-slate-800'
                            }`}
                          >
                            <div className={`bg-slate-950 w-4 h-4 rounded-full shadow transform transition-transform duration-200 ${
                              passwordRules.require_special ? 'translate-x-4.5' : 'translate-x-0'
                            }`} />
                          </button>
                        </div>
                        <div>
                          <label className="block text-[10px] font-mono text-slate-500 uppercase font-bold mb-1">Session timeout (Minutes)</label>
                          <input 
                            type="number" 
                            value={sessionTimeout}
                            onChange={(e) => setSessionTimeout(Number(e.target.value))}
                            className="w-full bg-slate-950 border border-slate-900 rounded px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none font-mono"
                          />
                        </div>
                      </div>

                      <button
                        onClick={saveSecurity}
                        disabled={saving}
                        className="bg-emerald-500 text-slate-950 font-bold px-4 py-2 rounded text-xs hover:bg-emerald-400 transition-all flex items-center gap-1.5 ml-auto"
                      >
                        <Save size={13} /> Save Security Parameters
                      </button>

                      {/* Forensic Audit Log list */}
                      <div className="border-t border-slate-900 pt-6">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2.5 flex items-center gap-1.5">
                          <Lock size={13} className="text-red-400" /> Immutable Forensic Audit Trail (Last 15 logs)
                        </h4>
                        <div className="overflow-x-auto border border-slate-900 rounded-lg max-h-[300px]">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-slate-900/50 text-[10px] font-mono text-slate-400 uppercase border-b border-slate-900">
                                <th className="p-3">Occurred At</th>
                                <th className="p-3">Actor Role</th>
                                <th className="p-3">Actor Name</th>
                                <th className="p-3">Action</th>
                                <th className="p-3">Module</th>
                                <th className="p-3">Audit Summary details</th>
                              </tr>
                            </thead>
                            <tbody>
                              {auditLogs.slice(0, 15).map(log => (
                                <tr key={log.id} className="border-b border-slate-900 hover:bg-slate-900/10 text-[11px] text-slate-400 font-mono">
                                  <td className="p-3 whitespace-nowrap">{new Date(log.occurred_at).toLocaleString('en-AE')}</td>
                                  <td className="p-3 uppercase text-[10px]">{log.actor_role || 'System'}</td>
                                  <td className="p-3 text-slate-300 font-sans">{log.actor_name}</td>
                                  <td className="p-3 font-bold text-emerald-400">{log.action}</td>
                                  <td className="p-3">{log.module}</td>
                                  <td className="p-3 text-slate-200 font-sans max-w-sm truncate">{log.summary}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 14. BACKUP & RECOVERY */}
                  {activeTab === 'BACKUP' && (
                    <div className="flex flex-col gap-4">
                      <div className="border-b border-slate-900 pb-3">
                        <h3 className="text-sm font-bold tracking-wider uppercase text-slate-400 flex items-center gap-1.5 font-heading">
                          <Database size={15} className="text-emerald-400" /> Database Backup & disaster Recovery
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 font-sans">
                          Calibrate cron frequencies for database backup dumps and trigger immediate manual snapshots.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-mono text-slate-500 uppercase font-bold mb-1">Backup cron schedule frequency</label>
                          <select
                            value={backupConfig.schedule}
                            onChange={(e) => setBackupConfig({ ...backupConfig, schedule: e.target.value as any })}
                            className="w-full bg-slate-950 border border-slate-900 text-slate-300 rounded px-2.5 py-1.5 text-xs font-semibold focus:outline-none"
                          >
                            <option value="daily">Daily database snapshot (Recommended)</option>
                            <option value="weekly">Weekly schema dump</option>
                            <option value="monthly">Monthly database archive</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-mono text-slate-500 uppercase font-bold mb-1">Retention duration limit (Days)</label>
                          <input 
                            type="number" 
                            value={backupConfig.retention}
                            onChange={(e) => setBackupConfig({ ...backupConfig, retention: Number(e.target.value) })}
                            className="w-full bg-slate-950 border border-slate-900 rounded px-2.5 py-1.5 text-xs text-slate-300 font-mono focus:outline-none"
                          />
                        </div>
                      </div>

                      <button
                        onClick={saveBackup}
                        disabled={saving}
                        className="bg-emerald-500 text-slate-950 font-bold px-4 py-2 rounded text-xs hover:bg-emerald-400 transition-all flex items-center gap-1.5 ml-auto mt-2"
                      >
                        <Save size={13} /> Save Backup Schedules
                      </button>

                      {/* Manual trigger segment */}
                      <div className="mt-4 p-4 border border-slate-900 rounded-lg bg-slate-950/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <h4 className="text-xs font-bold text-slate-300">Trigger immediate Database Schema Backup</h4>
                          <p className="text-[10px] text-slate-500 mt-0.5">Launches an immediate secure SQL snapshot dump compilation and archives it in secure backups buckets.</p>
                        </div>
                        <button
                          onClick={triggerMockBackupExport}
                          className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 px-4 py-2 rounded text-xs flex items-center gap-1.5 font-bold transition-all shrink-0"
                        >
                          <Download size={13} /> Execute backup
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              )}
            </div>
          </div>
        </div>
      </Can>
    </div>
  );
}
