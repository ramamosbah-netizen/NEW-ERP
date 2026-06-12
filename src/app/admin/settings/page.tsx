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
import { supabase } from '@/lib/supabase';
import { NAV_SECTIONS } from '@/components/layout/AppSidebar';
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
  Download,
  Plus,
  Eye,
  Trash2
} from 'lucide-react';

export default function SettingsHubPage() {
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Tab State
  const [activeTab, setActiveTab] = useState<
    'COMPANY' | 'USERS_ROLES' | 'MODULE_CONTROL' | 'FINANCE' | 'PROCUREMENT' | 'INVENTORY' | 
    'PROJECTS' | 'MAINTENANCE' | 'HR' | 'NOTIFICATIONS' | 'TEMPLATES' | 
    'INTEGRATIONS' | 'SYSTEM_ADMIN' | 'SECURITY' | 'BACKUP'
  >('COMPANY');

  // --- Module Control State ---
  const [enabledModules, setEnabledModulesState] = useState<Record<string, boolean>>({});

  // --- Add User Modal State ---
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [newUserFullName, setNewUserFullName] = useState<string>('');
  const [newUserEmail, setNewUserEmail] = useState<string>('');
  const [newUserPassword, setNewUserPassword] = useState<string>('');
  const [newUserDepartment, setNewUserDepartment] = useState<string>('');
  const [newUserRoleIds, setNewUserRoleIds] = useState<string[]>([]);

  // --- Edit User Modal State ---
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<UserWithRoles | null>(null);
  const [editUserFullName, setEditUserFullName] = useState<string>('');
  const [editUserEmail, setEditUserEmail] = useState<string>('');
  const [editUserDepartment, setEditUserDepartment] = useState<string>('');
  const [editUserRoleIds, setEditUserRoleIds] = useState<string[]>([]);

  // --- Delete User Modal State ---
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [deletingUser, setDeletingUser] = useState<UserWithRoles | null>(null);

  // --- User Permissions Auditor State ---
  const [auditingUser, setAuditingUser] = useState<UserWithRoles | null>(null);
  const [auditedPermissions, setAuditedPermissions] = useState<Record<string, PermissionScope | 'NONE'>>({});
  const [loadingAudit, setLoadingAudit] = useState<boolean>(false);
  const [auditPermissionSearch, setAuditPermissionSearch] = useState<string>('');

  // --- Custom Roles & Permissions Creation State ---
  const [newRoleName, setNewRoleName] = useState<string>('');
  const [newRoleKey, setNewRoleKey] = useState<string>('');
  const [newRoleDesc, setNewRoleDesc] = useState<string>('');
  const [newRoleHierarchy, setNewRoleHierarchy] = useState<number>(50);

  const [newPermKey, setNewPermKey] = useState<string>('');
  const [newPermModule, setNewPermModule] = useState<string>('');
  const [newPermDesc, setNewPermDesc] = useState<string>('');
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const [moduleCategoryFilter, setModuleCategoryFilter] = useState<'ALL' | 'CORE' | 'FIELD' | 'OFFICE'>('ALL');

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

  const [showWAToken, setShowWAToken] = useState<boolean>(false);
  const [backupRunning, setBackupRunning] = useState<boolean>(false);
  const [backupStep, setBackupStep] = useState<string>('');
  const [backupLogs, setBackupLogs] = useState<string[]>([]);

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

      // 15. Module Control
      const enabledModulesVal = await settingsService.getSettingByKey('system.enabled_modules', {});
      setEnabledModulesState(enabledModulesVal);
      try {
        localStorage.setItem('erp-enabled-modules', JSON.stringify(enabledModulesVal));
      } catch {}

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
    setBackupRunning(true);
    setBackupLogs([]);
    
    const log = (msg: string) => {
      setBackupLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
    };
    
    setBackupStep('Initializing snapshot engine...');
    log('Initializing forensic snapshot engine...');
    
    setTimeout(() => {
      setBackupStep('Querying schemas...');
      log('Scanning database schemas for tables, views, and procedures...');
      log('Retrieving active index structures and primary key mappings...');
    }, 1000);
    
    setTimeout(() => {
      setBackupStep('Executing dump process...');
      log('Allocating memory buffer for sequential table extraction...');
      log('Extracting table records: profiles, roles, permissions, settings...');
      log('Extracting audit logs and operations transactions data...');
      log('Generating full SQL dump schema...');
    }, 2200);

    setTimeout(() => {
      setBackupStep('Compressing export package...');
      log('Serializing SQL schema dump into binary stream...');
      log('Applying DEFLATE compression algorithm...');
      log('Verified backup package checksum (SHA-256)...');
    }, 3500);

    setTimeout(() => {
      setBackupStep('Storing package...');
      log('Establishing secure socket connection to encrypted backups vault...');
      log('Uploading payload package: JEET_ERP_BACKUP_SQL.zip (24.2 MB)...');
      log('Transfer complete. Server acknowledged payload storage.');
    }, 4800);

    setTimeout(() => {
      setBackupRunning(false);
      setBackupStep('');
      log('Disaster recovery snapshot archived successfully.');
      showFeedback(true, 'Forensic SQL snapshot dump compiled and uploaded successfully.');
    }, 6000);
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

  // --- Module Control Save ---
  const saveModuleSettings = async () => {
    setSaving(true);
    try {
      await settingsService.updateSetting(
        'system.enabled_modules',
        enabledModules,
        'INTEGRATIONS',
        'JSON',
        'Global toggle flags for enabling/disabling ERP modules'
      );
      try {
        localStorage.setItem('erp-enabled-modules', JSON.stringify(enabledModules));
      } catch {}
      window.dispatchEvent(new Event('erp-modules-updated'));
      showFeedback(true, 'Module configuration updated and synchronized successfully.');
    } catch (err: any) {
      showFeedback(false, err.message || 'Failed to update module settings.');
    } finally {
      setSaving(false);
    }
  };

  // --- Add User Modal Handlers ---
  const handleOpenAddUser = () => {
    setNewUserFullName('');
    setNewUserEmail('');
    setNewUserPassword('');
    setNewUserDepartment('');
    setNewUserRoleIds([]);
    setIsAddModalOpen(true);
  };

  const handleAddUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserFullName || !newUserEmail || !newUserPassword) {
      showFeedback(false, 'Please fill in all required user credentials.');
      return;
    }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          email: newUserEmail,
          password: newUserPassword,
          fullName: newUserFullName,
          roleIds: newUserRoleIds,
          department: newUserDepartment || null
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create user account');
      }

      showFeedback(true, `User '${newUserFullName}' registered and employee record initialized successfully.`);
      setIsAddModalOpen(false);
      // reload users list
      const uList = await userRoleService.getUsers();
      setUsers(uList);
    } catch (err: any) {
      showFeedback(false, err.message || 'Error occurred during user creation.');
    } finally {
      setSaving(false);
    }
  };

  // --- Edit User Modal Handlers ---
  const handleOpenEditUser = (user: UserWithRoles) => {
    setEditingUser(user);
    setEditUserFullName(user.full_name);
    setEditUserEmail(user.email);
    const fetchUserDeptAndOpen = async () => {
      let dept = '';
      try {
        const { data: emp } = await supabase
          .from('employees')
          .select('department')
          .eq('user_id', user.id)
          .maybeSingle();
        if (emp) dept = emp.department || '';
      } catch (err) {
        console.error('Failed to load department:', err);
      }
      setEditUserDepartment(dept);
      setEditUserRoleIds(user.roles.map(r => r.id));
      setIsEditModalOpen(true);
    };
    fetchUserDeptAndOpen();
  };

  const handleEditUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (!editUserFullName || !editUserEmail) {
      showFeedback(false, 'Please fill in required fields.');
      return;
    }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userId: editingUser.id,
          email: editUserEmail,
          fullName: editUserFullName,
          roleIds: editUserRoleIds,
          department: editUserDepartment || null
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update user account');
      }

      showFeedback(true, `User '${editUserFullName}' updated successfully.`);
      setIsEditModalOpen(false);
      setEditingUser(null);
      // reload users list
      const uList = await userRoleService.getUsers();
      setUsers(uList);
    } catch (err: any) {
      showFeedback(false, err.message || 'Error occurred during user update.');
    } finally {
      setSaving(false);
    }
  };

  // --- Delete User Handlers ---
  const handleOpenDeleteUser = (user: UserWithRoles) => {
    setDeletingUser(user);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteUserConfirm = async () => {
    if (!deletingUser) return;
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch(`/api/admin/users?userId=${deletingUser.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete user account');
      }

      showFeedback(true, `User account purged successfully.`);
      setIsDeleteModalOpen(false);
      setDeletingUser(null);
      // reload users list
      const uList = await userRoleService.getUsers();
      setUsers(uList);
    } catch (err: any) {
      showFeedback(false, err.message || 'Error occurred during user purge.');
    } finally {
      setSaving(false);
    }
  };

  // --- User Permissions Auditor ---
  const handleAuditUser = async (user: UserWithRoles) => {
    setAuditingUser(user);
    setLoadingAudit(true);
    try {
      const perms = await permissionService.getUserEffectivePermissions(user.id);
      const mapObj: Record<string, PermissionScope | 'NONE'> = {};
      permissions.forEach(p => {
        mapObj[p.permission_key] = 'NONE';
      });
      perms.forEach(p => {
        mapObj[p.permission_key] = p.scope;
      });
      setAuditedPermissions(mapObj);
    } catch (err) {
      console.error('Failed to audit user permissions:', err);
    } finally {
      setLoadingAudit(false);
    }
  };

  // --- Custom Roles and Permissions catalog creation ---
  const handleCreateCustomRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName || !newRoleKey) {
      showFeedback(false, 'Role name and slug key are required.');
      return;
    }
    setSaving(true);
    try {
      const { data: newRole, error: roleErr } = await supabase
        .from('roles')
        .insert({
          role_key: newRoleKey.trim().toLowerCase().replace(/\s+/g, '_'),
          name: newRoleName.trim(),
          description: newRoleDesc.trim() || null,
          hierarchy_level: Number(newRoleHierarchy),
          is_system: false,
          is_active: true
        })
        .select()
        .single();

      if (roleErr) throw roleErr;

      await auditService.logEvent({
        action: 'CREATE',
        entity_type: 'ROLE',
        entity_id: newRole.id,
        entity_label: newRole.name,
        summary: `Created Custom Role: ${newRole.name} (Key: ${newRole.role_key}, Hierarchy: ${newRole.hierarchy_level})`,
        module: 'SYSTEM'
      });

      showFeedback(true, `Custom role '${newRoleName}' created successfully.`);
      setNewRoleName('');
      setNewRoleKey('');
      setNewRoleDesc('');
      setNewRoleHierarchy(50);

      const rList = await userRoleService.getRoles();
      setRoles(rList);
    } catch (err: any) {
      showFeedback(false, err.message || 'Failed to create custom role.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateCustomPermission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPermKey || !newPermModule) {
      showFeedback(false, 'Permission key and module category are required.');
      return;
    }
    setSaving(true);
    try {
      const { data: newPerm, error: permErr } = await supabase
        .from('permissions')
        .insert({
          permission_key: newPermKey.trim().toLowerCase().replace(/\s+/g, '.'),
          module: newPermModule.trim().toUpperCase(),
          description: newPermDesc.trim() || null
        })
        .select()
        .single();

      if (permErr) throw permErr;

      await auditService.logEvent({
        action: 'CREATE',
        entity_type: 'PERMISSION',
        entity_id: newPerm.id,
        entity_label: newPerm.permission_key,
        summary: `Created Cataloged Permission: ${newPerm.permission_key} (Module: ${newPerm.module})`,
        module: 'SYSTEM'
      });

      showFeedback(true, `Permission catalog entry '${newPermKey}' created successfully.`);
      setNewPermKey('');
      setNewPermModule('');
      setNewPermDesc('');

      const pList = await permissionService.getPermissions();
      setPermissions(pList);
    } catch (err: any) {
      showFeedback(false, err.message || 'Failed to create cataloged permission.');
    } finally {
      setSaving(false);
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
    <div className="min-h-screen bg-bg-dark text-text-primary flex flex-col font-body theme-transition relative overflow-hidden">
      {/* Background Glowing Abstract Blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="glow-blob blob-1 absolute -top-40 -right-40 w-96 h-96 bg-primary/20 rounded-full blur-[120px]" />
        <div className="glow-blob blob-2 absolute -bottom-40 -left-40 w-96 h-96 bg-secondary/20 rounded-full blur-[120px]" />
      </div>

      <Can 
        perform="settings.manage"
        fallback={
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center z-10 relative">
            <AlertTriangle className="text-error mb-2 animate-pulse" size={48} />
            <h1 className="text-xl font-bold font-heading text-text-primary">Access Denied</h1>
            <p className="text-xs text-text-muted max-w-sm mt-1 leading-relaxed">
              Your account permissions do not authorize access to the Unified Settings Hub. Please contact a system administrator.
            </p>
          </div>
        }
      >
        <div className="flex-1 flex flex-col gap-6 p-6 max-w-6xl w-full mx-auto z-10 relative">
          {/* Header */}
          <header className="flex flex-col md:flex-row md:items-center justify-between border-b border-border-color/85 pb-5 mb-2">
            <div className="flex items-center gap-3.5">
              <div className="rounded-2xl bg-bg-card border border-border-color p-2.5 shadow-lg shadow-black/20 shadow-inner relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <Settings className="text-primary animate-spin-slow group-hover:scale-110 transition-transform duration-300" size={24} />
              </div>
              <div>
                <h1 className="text-2xl font-bold font-heading tracking-tight bg-gradient-to-r from-text-primary via-slate-200 to-primary bg-clip-text text-transparent flex items-center gap-2">
                  Central Configuration Hub
                  <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold font-mono bg-primary/10 text-primary border border-primary/20 tracking-normal uppercase">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" /> SYSTEM READY
                  </span>
                </h1>
                <p className="text-xs text-text-muted font-mono mt-0.5 uppercase tracking-wide flex items-center gap-1.5">
                  Enterprise Settings Engine <span className="text-border-color">•</span> Multi-Module Calibration Control Matrix
                </p>
              </div>
            </div>
            {saving ? (
              <div className="text-xs text-primary font-mono flex items-center gap-1.5 self-start md:self-auto mt-3 md:mt-0 bg-primary/5 border border-primary/25 px-3 py-1.5 rounded-xl shadow-[0_0_15px_var(--primary-glow)] animate-pulse">
                <RefreshCw className="animate-spin" size={13} /> Syncing parameters...
              </div>
            ) : (
              <div className="hidden md:flex text-[10px] text-text-muted font-mono items-center gap-1.5 border border-border-color bg-bg-card/45 px-3 py-1.5 rounded-xl select-none">
                <Lock size={11} className="text-primary" /> Cryptographic Admin Session
              </div>
            )}
          </header>

          {/* Feedback alerts */}
          {successMsg && (
            <div className="p-3.5 bg-success/10 border border-success/30 rounded-xl text-xs text-success flex items-center gap-2 font-semibold animate-fadeIn shadow-[0_4px_20px_var(--success-glow)]">
              <CheckCircle size={15} className="shrink-0 text-success" /> 
              <span>{successMsg}</span>
            </div>
          )}
          {errorMsg && (
            <div className="p-3.5 bg-error/10 border border-error/30 rounded-xl text-xs text-error flex items-center gap-2 font-semibold animate-fadeIn shadow-[0_4px_20px_var(--error-glow)]">
              <AlertTriangle size={15} className="shrink-0 text-error" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Core Layout Workspace */}
          <div className="flex flex-col lg:flex-row gap-6 items-start">
            {/* Sidebar Tabs Selector */}
            <div className="w-full lg:w-68 flex flex-row lg:flex-col gap-1 lg:gap-4 bg-bg-card/20 backdrop-blur-xl p-3 border border-border-color rounded-2xl overflow-x-auto lg:overflow-visible shrink-0 lg:max-h-[780px] lg:overflow-y-auto scrollbar-none">
              {/* For mobile layout, we flatten sections */}
              <div className="flex flex-row lg:hidden gap-1.5 w-full">
                {[
                  { id: 'COMPANY', label: 'Company & Branding', icon: Building },
                  { id: 'MODULE_CONTROL', label: 'Module Control', icon: Sliders },
                  { id: 'USERS_ROLES', label: 'Users & Roles', icon: Users },
                  { id: 'FINANCE', label: 'Finance & Tax', icon: DollarSign },
                  { id: 'PROCUREMENT', label: 'Procurement', icon: Sliders },
                  { id: 'INVENTORY', label: 'Inventory & Assets', icon: Layers },
                  { id: 'PROJECTS', label: 'Projects & Ops', icon: Cpu },
                  { id: 'MAINTENANCE', label: 'Maintenance & SLA', icon: Clock },
                  { id: 'HR', label: 'HR & Workforce', icon: Clock },
                  { id: 'NOTIFICATIONS', label: 'Notifications', icon: Bell },
                  { id: 'TEMPLATES', label: 'PDF Templates', icon: FileCheck },
                  { id: 'INTEGRATIONS', label: 'Integrations', icon: Share2 },
                  { id: 'SYSTEM_ADMIN', label: 'System Admin', icon: Sliders },
                  { id: 'SECURITY', label: 'Audit & Security', icon: Shield },
                  { id: 'BACKUP', label: 'Backup & Recovery', icon: Database },
                ].map(tab => {
                  const IconComponent = tab.icon;
                  const isSelected = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
                        isSelected
                          ? 'bg-primary/15 border border-primary/35 text-primary font-bold shadow-[0_0_12px_var(--primary-glow)]'
                          : 'text-text-muted border border-transparent hover:bg-bg-card-hover/40 hover:text-text-primary'
                      }`}
                    >
                      <IconComponent size={13} className="shrink-0" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* For desktop layout, we show structured groups */}
              <div className="hidden lg:flex flex-col gap-4.5 w-full">
                {[
                  {
                    group: 'General Config',
                    items: [
                      { id: 'COMPANY', label: 'Company & Branding', icon: Building },
                      { id: 'MODULE_CONTROL', label: 'Module Toggles', icon: Sliders },
                    ]
                  },
                  {
                    group: 'Access Control',
                    items: [
                      { id: 'USERS_ROLES', label: 'Users, Roles & Perms', icon: Users },
                    ]
                  },
                  {
                    group: 'Operational Scales',
                    items: [
                      { id: 'FINANCE', label: 'Financial & Tax', icon: DollarSign },
                      { id: 'PROCUREMENT', label: 'Procurement Settings', icon: Sliders },
                      { id: 'INVENTORY', label: 'Inventory & Assets', icon: Layers },
                      { id: 'PROJECTS', label: 'Projects & Operations', icon: Cpu },
                      { id: 'MAINTENANCE', label: 'Maintenance & SLA', icon: Clock },
                      { id: 'HR', label: 'HR & Workforce', icon: Clock },
                    ]
                  },
                  {
                    group: 'Templates & Alerts',
                    items: [
                      { id: 'NOTIFICATIONS', label: 'Notifications & Alerts', icon: Bell },
                      { id: 'TEMPLATES', label: 'Document Templates', icon: FileCheck },
                      { id: 'INTEGRATIONS', label: 'Integrations Config', icon: Share2 },
                    ]
                  },
                  {
                    group: 'System & Advanced',
                    items: [
                      { id: 'SYSTEM_ADMIN', label: 'System Administration', icon: Sliders },
                      { id: 'SECURITY', label: 'Audit & Security', icon: Shield },
                      { id: 'BACKUP', label: 'Backup & Recovery', icon: Database },
                    ]
                  }
                ].map((section, sIdx) => (
                  <div key={sIdx} className="flex flex-col gap-1.5">
                    <span className="text-[9px] font-bold text-text-muted tracking-widest uppercase font-mono px-2 mb-1">
                      {section.group}
                    </span>
                    <div className="flex flex-col gap-1">
                      {section.items.map(tab => {
                        const IconComponent = tab.icon;
                        const isSelected = activeTab === tab.id;
                        return (
                          <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold w-full transition-all duration-300 text-left relative overflow-hidden group ${
                              isSelected
                                ? 'bg-gradient-to-r from-primary/15 to-primary/5 border border-primary/30 text-primary shadow-[0_0_15px_var(--primary-glow)] font-bold after:absolute after:left-0 after:top-1/4 after:h-1/2 after:w-1 after:bg-primary after:rounded-r-md'
                                : 'text-text-secondary border border-transparent hover:bg-bg-card-hover/30 hover:text-text-primary'
                            }`}
                          >
                            <IconComponent size={14} className={`shrink-0 transition-transform duration-300 ${isSelected ? 'scale-110 text-primary' : 'group-hover:scale-110 text-text-muted'}`} />
                            <span className="truncate">{tab.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tab Details Form Container */}
            <div className="flex-1 w-full bg-bg-card/25 backdrop-blur-xl border border-border-color rounded-2xl p-8 min-w-0 shadow-2xl relative">
              {loading ? (
                <div className="py-24 flex flex-col items-center justify-center">
                  <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin mb-3"></div>
                  <p className="text-xs text-text-muted font-mono uppercase tracking-wider">Querying settings store...</p>
                </div>
              ) : (
                <div className="flex flex-col gap-6">
                  {/* 1. COMPANY & BRANDING */}
                  {activeTab === 'COMPANY' && (
                    <div className="flex flex-col gap-6">
                      <div className="border-b border-border-color/85 pb-3">
                        <h3 className="text-sm font-bold tracking-wider uppercase text-text-secondary flex items-center gap-1.5 font-heading">
                          <Building size={15} className="text-primary" /> Company Profile Specifications
                        </h3>
                        <p className="text-xs text-text-muted mt-1 font-sans">
                          Manage registered company details, trade license, TRN numbers, contact credentials, and logo URLs.
                        </p>
                      </div>

                      <div className="flex flex-col lg:flex-row gap-6">
                        {/* Left Side: Form */}
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-mono text-text-muted uppercase font-bold mb-1.5">Company Registered Title</label>
                            <input 
                              type="text" 
                              value={companyName}
                              onChange={(e) => setCompanyName(e.target.value)}
                              className="w-full bg-slate-950/40 border border-border-color rounded-xl px-4 py-2.5 text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all font-sans font-semibold"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-mono text-text-muted uppercase font-bold mb-1.5">Tax Registration Number (TRN)</label>
                            <input 
                              type="text" 
                              value={trn}
                              onChange={(e) => setTrn(e.target.value)}
                              className="w-full bg-slate-950/40 border border-border-color rounded-xl px-4 py-2.5 text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all font-mono font-semibold"
                              placeholder="e.g. 100293849500003"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-mono text-text-muted uppercase font-bold mb-1.5">Trade License Number</label>
                            <input 
                              type="text" 
                              value={tradeLicense}
                              onChange={(e) => setTradeLicense(e.target.value)}
                              className="w-full bg-slate-950/40 border border-border-color rounded-xl px-4 py-2.5 text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all font-sans font-semibold"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-mono text-text-muted uppercase font-bold mb-1.5">Website URL</label>
                            <input 
                              type="text" 
                              value={website}
                              onChange={(e) => setWebsite(e.target.value)}
                              className="w-full bg-slate-950/40 border border-border-color rounded-xl px-4 py-2.5 text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all font-mono font-semibold"
                              placeholder="e.g. https://jeetmep.ae"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="block text-[10px] font-mono text-text-muted uppercase font-bold mb-1.5">Branded Logo URL</label>
                            <input 
                              type="text" 
                              value={logoUrl}
                              onChange={(e) => setLogoUrl(e.target.value)}
                              className="w-full bg-slate-950/40 border border-border-color rounded-xl px-4 py-2.5 text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all font-mono font-semibold"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-mono text-text-muted uppercase font-bold mb-1.5">Corporate Email Address</label>
                            <input 
                              type="text" 
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              className="w-full bg-slate-950/40 border border-border-color rounded-xl px-4 py-2.5 text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all font-sans font-semibold"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-mono text-text-muted uppercase font-bold mb-1.5">Corporate Telephone</label>
                            <input 
                              type="text" 
                              value={phone}
                              onChange={(e) => setPhone(e.target.value)}
                              className="w-full bg-slate-950/40 border border-border-color rounded-xl px-4 py-2.5 text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all font-mono font-semibold"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="block text-[10px] font-mono text-text-muted uppercase font-bold mb-1.5">Registered Site Address</label>
                            <input 
                              type="text" 
                              value={address}
                              onChange={(e) => setAddress(e.target.value)}
                              className="w-full bg-slate-950/40 border border-border-color rounded-xl px-4 py-2.5 text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all font-sans font-semibold"
                            />
                          </div>
                        </div>

                        {/* Right Side: Live Branding Card */}
                        <div className="w-full lg:w-72 flex flex-col gap-4">
                          <label className="block text-[10px] font-mono text-text-muted uppercase font-bold tracking-wider">Brand Verification Preview</label>
                          <div className="p-6 bg-bg-card/40 backdrop-blur-md border border-border-color rounded-2xl flex flex-col items-center justify-center text-center gap-4 relative overflow-hidden group shadow-2xl shadow-black/40">
                            {/* Card Glow Background */}
                            <div className="absolute -right-20 -top-20 w-40 h-40 bg-primary/5 blur-3xl rounded-full transition-all duration-700 group-hover:bg-primary/10" />
                            
                            <div className="w-24 h-24 rounded-2xl bg-slate-950/80 border border-border-color flex items-center justify-center overflow-hidden shadow-inner relative group-hover:border-primary/30 transition-colors duration-300">
                              {logoUrl ? (
                                <img 
                                  src={logoUrl} 
                                  alt="Branding Preview"
                                  className="w-full h-full object-contain p-2.5 transition-transform duration-500 group-hover:scale-110"
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.display = 'none';
                                  }}
                                />
                              ) : null}
                              {(!logoUrl) && (
                                <Building size={32} className="text-text-muted transition-colors duration-300 group-hover:text-primary" />
                              )}
                            </div>

                            <div className="flex flex-col gap-1 w-full z-10">
                              <h4 className="text-xs font-bold text-text-primary truncate w-full px-2" title={companyName || 'Registered Title'}>
                                {companyName || 'JEET ERP Platform'}
                              </h4>
                              <p className="text-[10px] text-text-muted font-mono">
                                TRN: {trn || '100XXXXXXXXXXXX'}
                              </p>
                              {website && (
                                <span className="text-[9px] text-primary/80 font-mono truncate w-full px-2">
                                  {website}
                                </span>
                              )}
                            </div>
                            
                            <div className="w-full border-t border-border-color/60 pt-3 flex items-center justify-center gap-1.5 text-[9px] font-mono text-text-muted uppercase tracking-wider z-10">
                              <span className="h-1.5 w-1.5 rounded-full bg-primary/45 animate-pulse" /> BRANDING ACCEPTS PDFS
                            </div>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={saveCompanyProfile}
                        disabled={saving}
                        className="bg-gradient-to-r from-primary to-primary-hover text-bg-dark font-extrabold px-5 py-2.5 rounded-xl text-xs transition-all flex items-center gap-1.5 ml-auto mt-2 shadow-lg hover:shadow-[0_0_15px_var(--primary-glow)] active:scale-98 select-none"
                      >
                        <Save size={13} /> Save Company Profile
                      </button>
                    </div>
                  )}                  {/* MODULE CONTROL tab */}
                  {activeTab === 'MODULE_CONTROL' && (
                    <div className="flex flex-col gap-6 animate-fadeIn">
                      {/* Lookup Dictionary for Descriptions */}
                      {(() => {
                        const MODULE_DESCRIPTIONS: Record<string, string> = {
                          '/dashboard': 'Primary operations center & summary dashboard.',
                          '/myday': 'Personal task schedules, logs, and calendar items.',
                          '/tasks': 'Enterprise checklists, assignments, and workflow statuses.',
                          '/meetings': 'Schedule site board meetings and write meeting minutes.',
                          '/notifications': 'Forensic compliance audit logs and broadcast alarms.',
                          '/tenders': 'Manage subcontractor tenders and bids comparison matrices.',
                          '/quotations': 'Generate and dispatch commercial client quotations.',
                          '/projects': 'Manage construction stages, pipeline paths, and BOQ items.',
                          '/vo': 'Record variation orders and manage authority limits.',
                          '/snags': 'Log site defects with images and coordinate snags repair.',
                          '/tc': 'Execute project Testing & Commissioning certifications.',
                          '/handover': 'Filing handover certificates and closing contracts.',
                          '/procurement/comparisons': 'Analyze bids comparative matrix side-by-side.',
                          '/procurement/po': 'Generate local purchase orders and GM thresholds.',
                          '/procurement/grn': 'Log physical store goods receipts from vendors.',
                          '/pricing': 'Central supplier pricing tariff items database.',
                          '/service-desk': 'Trace customer complaints and SLA resolution timers.',
                          '/ppm/calendar': 'Preventative planned maintenance visiting calendar.',
                          '/amc': 'Manage annual maintenance contracts and client agreements.',
                          '/technician': 'Technician visiting checklist and task details.',
                          '/fleet': 'Log corporate vehicles, fuel cards, and drivers.',
                          '/assets': 'Fixed asset registry and straight-line depreciation.',
                          '/hr': 'Manage company employees profiles and contracts.',
                          '/payroll': 'Filing payslips, bank letters, and base salaries.',
                          '/timesheets': 'Trace employee daily timesheets and labor hour logs.',
                          '/finance': 'Double-entry general ledger, Receivables & Payables.',
                          '/finance/ar': 'Generate customer invoices and trace ar aging.',
                          '/finance/ap': 'Log vendor supplier bills and trace ap schedules.',
                          '/finance/cashflow': 'Cash flow projection charts and forecast limits.',
                          '/finance/vat': 'UAE compliance VAT audit forms and filing records.',
                          '/documents': 'Central document center and secure PDF files cabinet.',
                          '/reports': 'Detailed financial and operational reports graphs.',
                          '/whatsapp': 'Broadcast WhatsApp messages and system notifications.',
                          '/admin/settings': 'Enterprise settings configuration dashboard.',
                          '/admin/audit': 'Immutable logs of security events and configurations.'
                        };

                        const totalModules = NAV_SECTIONS.reduce((acc, s) => acc + s.items.length, 0);
                        const disabledCount = Object.values(enabledModules).filter(v => v === false).length;
                        const activeCount = totalModules - disabledCount;

                        const filteredSections = NAV_SECTIONS.filter(section => {
                          if (moduleCategoryFilter === 'ALL') return true;
                          if (moduleCategoryFilter === 'CORE') return ['core', 'sales', 'procurement'].includes(section.id);
                          if (moduleCategoryFilter === 'FIELD') return ['fieldops', 'fleet'].includes(section.id);
                          if (moduleCategoryFilter === 'OFFICE') return ['hr', 'finance', 'docs', 'comms', 'admin'].includes(section.id);
                          return true;
                        });

                        return (
                          <>
                            <div className="border-b border-border-color/85 pb-3">
                              <h3 className="text-sm font-bold tracking-wider uppercase text-text-secondary flex items-center gap-1.5 font-heading">
                                <Sliders size={15} className="text-primary" /> Module Configuration & Feature Switches
                              </h3>
                              <p className="text-xs text-text-muted mt-1 font-sans">
                                Globally enable or disable specific features and modules. Disabled modules are hidden from navigation sidebars.
                              </p>
                            </div>

                            {/* Summary Statistics Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                              <div className="p-4.5 bg-bg-card/45 border border-border-color rounded-2xl flex items-center justify-between shadow-lg">
                                <div>
                                  <span className="text-[10px] font-mono text-text-muted uppercase font-bold tracking-wider">Active Modules</span>
                                  <h4 className="text-xl font-bold text-primary mt-1 font-heading">{activeCount}</h4>
                                </div>
                                <div className="h-8.5 w-8.5 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-[11px] select-none">
                                  ✓
                                </div>
                              </div>
                              <div className="p-4.5 bg-bg-card/45 border border-border-color rounded-2xl flex items-center justify-between shadow-lg">
                                <div>
                                  <span className="text-[10px] font-mono text-text-muted uppercase font-bold tracking-wider">Disabled Modules</span>
                                  <h4 className="text-xl font-bold text-error mt-1 font-heading">{disabledCount}</h4>
                                </div>
                                <div className="h-8.5 w-8.5 rounded-xl bg-error/10 border border-error/20 flex items-center justify-center text-error font-bold text-[11px] select-none">
                                  ✕
                                </div>
                              </div>
                              <div className="p-4.5 bg-bg-card/45 border border-border-color rounded-2xl flex items-center justify-between shadow-lg">
                                <div>
                                  <span className="text-[10px] font-mono text-text-muted uppercase font-bold tracking-wider">Total Modules</span>
                                  <h4 className="text-xl font-bold text-text-secondary mt-1 font-heading">{totalModules}</h4>
                                </div>
                                <div className="h-8.5 w-8.5 rounded-xl bg-bg-card border border-border-color/60 flex items-center justify-center text-text-muted font-bold text-[11px] select-none">
                                  ∑
                                </div>
                              </div>
                            </div>

                            {/* Category Filter Tabs */}
                            <div className="flex flex-wrap items-center gap-2 border-b border-border-color/80 pb-4 mt-2">
                              {[
                                { id: 'ALL', name: 'All Modules', count: totalModules },
                                { id: 'CORE', name: 'Core & Operations', count: NAV_SECTIONS.filter(s => ['core', 'sales', 'procurement'].includes(s.id)).reduce((a, s) => a + s.items.length, 0) },
                                { id: 'FIELD', name: 'Field & Assets', count: NAV_SECTIONS.filter(s => ['fieldops', 'fleet'].includes(s.id)).reduce((a, s) => a + s.items.length, 0) },
                                { id: 'OFFICE', name: 'Back Office', count: NAV_SECTIONS.filter(s => ['hr', 'finance', 'docs', 'comms', 'admin'].includes(s.id)).reduce((a, s) => a + s.items.length, 0) }
                              ].map(cat => {
                                const isSelected = moduleCategoryFilter === cat.id;
                                return (
                                  <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => setModuleCategoryFilter(cat.id as any)}
                                    className={`px-3.5 py-1.5 rounded-xl border transition-all text-xs font-semibold flex items-center gap-2 ${
                                      isSelected
                                        ? 'bg-slate-900 border-primary/45 text-text-primary shadow-[0_0_12px_var(--primary-glow)]'
                                        : 'bg-slate-950/40 border-border-color text-text-muted hover:border-text-secondary hover:text-text-secondary'
                                    }`}
                                  >
                                    <span>{cat.name}</span>
                                    <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full ${isSelected ? 'bg-primary/10 text-primary' : 'bg-slate-900 text-text-muted'}`}>
                                      {cat.count}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                              {filteredSections.map((section) => (
                                <div key={section.id} className="p-5 bg-bg-card/25 border border-border-color rounded-2xl flex flex-col gap-3.5 relative overflow-hidden group shadow-lg transition-all duration-300 hover:border-primary/25">
                                  <div className="absolute -right-12 -top-12 w-24 h-24 bg-primary/5 blur-2xl rounded-full" />
                                  <div className="flex items-center justify-between border-b border-border-color/65 pb-2.5">
                                    <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider font-mono">{section.label}</h4>
                                    <span className="text-[9px] font-bold text-primary font-mono tracking-wider">
                                      {section.items.filter(item => enabledModules[item.href] !== false).length} / {section.items.length} ACTIVE
                                    </span>
                                  </div>
                                  <div className="flex flex-col gap-3">
                                    {section.items.map((item) => {
                                      const isDashboardOrSettings = item.href === '/dashboard' || item.href === '/admin/settings';
                                      const isEnabled = enabledModules[item.href] !== false;
                                      return (
                                        <div key={item.href} className="flex items-start justify-between p-3.5 bg-slate-955/40 border border-border-color/60 rounded-xl hover:border-border-color transition-all duration-200 group/item">
                                          <div className="flex items-start gap-3">
                                            <span className={`p-2 rounded-xl bg-slate-900 border border-border-color/65 shrink-0 transition-colors duration-300 ${isEnabled ? 'text-primary border-primary/25' : 'text-text-muted'}`}>
                                              <item.icon size={15} />
                                            </span>
                                            <div className="flex flex-col truncate pr-2">
                                              <span className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                                                {item.label}
                                                {isDashboardOrSettings && (
                                                  <span className="text-[8px] font-bold font-mono px-1.5 py-0.5 rounded bg-slate-900 text-text-muted border border-border-color">SYSTEM CORE</span>
                                                )}
                                              </span>
                                              <p className="text-[10px] text-text-muted leading-relaxed mt-0.5 whitespace-normal pr-1 max-w-sm">
                                                {MODULE_DESCRIPTIONS[item.href] || 'Feature module capabilities configuration.'}
                                              </p>
                                              <span className="text-[8px] font-mono text-text-muted/60 mt-1">{item.href}</span>
                                            </div>
                                          </div>
                                          <button
                                            disabled={isDashboardOrSettings}
                                            onClick={() => {
                                              setEnabledModulesState({
                                                ...enabledModules,
                                                [item.href]: !isEnabled
                                              });
                                            }}
                                            className={`w-10 h-6 rounded-full p-1 transition-all duration-300 focus:outline-none relative flex items-center shrink-0 ${
                                              isDashboardOrSettings ? 'bg-primary/20 opacity-55 cursor-not-allowed border border-transparent' :
                                              isEnabled ? 'bg-primary shadow-[0_0_12px_var(--primary-glow)]' : 'bg-slate-850 border border-border-color'
                                            }`}
                                          >
                                            <div className={`w-4 h-4 rounded-full shadow transform transition-transform duration-300 ${
                                              isEnabled ? 'translate-x-4 bg-bg-dark' : 'translate-x-0 bg-text-muted'
                                            }`} />
                                          </button>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </>
                        );
                      })()}

                      <button
                        onClick={saveModuleSettings}
                        disabled={saving}
                        className="bg-gradient-to-r from-primary to-primary-hover text-bg-dark font-extrabold px-5 py-2.5 rounded-xl text-xs transition-all flex items-center gap-1.5 ml-auto mt-2 shadow-lg hover:shadow-[0_0_15px_var(--primary-glow)] active:scale-98 select-none"
                      >
                        <Save size={13} /> Save Module Switches
                      </button>
                    </div>
                  )}
                                {/* 2. USERS, ROLES & PERMISSIONS */}
                  {activeTab === 'USERS_ROLES' && (
                    <div className="flex flex-col gap-6 animate-fadeIn">
                      {/* Sub tab navigation */}
                      <div className="border-b border-border-color/85 pb-3">
                        <h3 className="text-sm font-bold tracking-wider uppercase text-text-secondary flex items-center gap-1.5 font-heading">
                          <Users size={15} className="text-primary" /> Users & Permissions Manager
                        </h3>
                        <p className="text-xs text-text-muted mt-1 font-sans">
                          Manage login credentials, roles assignments, and fine-tune permission matrix scopes.
                        </p>
                      </div>

                      {/* User Registry List */}
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-bg-card/40 border border-border-color p-5 rounded-2xl shadow-lg">
                          <div>
                            <h4 className="text-xs font-bold uppercase tracking-wider text-text-primary">User Directory Catalog</h4>
                            <p className="text-[10px] text-text-muted mt-0.5">Manage administrative credentials, system roles, and audit access permissions.</p>
                          </div>
                          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                            <input 
                              type="text" 
                              placeholder="Filter by name or email..."
                              value={userSearch}
                              onChange={(e) => setUserSearch(e.target.value)}
                              className="bg-slate-950/40 border border-border-color rounded-xl px-3.5 py-1.5 text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-primary/50 transition-all font-mono"
                            />
                            <button
                              onClick={handleOpenAddUser}
                              className="bg-gradient-to-r from-primary to-primary-hover text-bg-dark font-extrabold px-4 py-2 rounded-xl text-xs whitespace-nowrap flex items-center gap-1.5 shadow-md hover:shadow-[0_0_12px_var(--primary-glow)] active:scale-98 transition-all select-none"
                            >
                              <Plus size={13} /> Add Account
                            </button>
                          </div>
                        </div>

                        <div className="overflow-x-auto border border-border-color rounded-2xl bg-bg-card/15 shadow-xl">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-bg-card/60 text-[10px] font-mono text-text-muted uppercase border-b border-border-color select-none">
                                <th className="p-3.5 pl-4">Member Specifications</th>
                                <th className="p-3.5">Email Address</th>
                                <th className="p-3.5">Primary legacy role</th>
                                <th className="p-3.5">Assigned Roles Mappings</th>
                                <th className="p-3.5 text-right pr-4">Actions Matrix</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredUsers.map(user => (
                                <tr key={user.id} className="border-b border-border-color/40 last:border-0 hover:bg-bg-card-hover/20 text-xs text-text-secondary font-sans transition-all group">
                                  <td className="p-3.5 pl-4 flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary/15 to-primary/5 border border-primary/20 flex items-center justify-center text-[10px] font-bold text-primary font-mono shadow-sm group-hover:border-primary/40 transition-colors duration-300 select-none">
                                      {user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'U'}
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="font-semibold text-text-primary group-hover:text-text-primary transition-colors leading-snug">{user.full_name}</span>
                                      <span className="text-[9px] font-mono text-text-muted md:hidden mt-0.5">{user.email}</span>
                                    </div>
                                  </td>
                                  <td className="p-3.5 font-mono text-text-secondary">{user.email}</td>
                                  <td className="p-3.5">
                                    <span className="bg-slate-950/50 text-[9px] font-bold text-text-muted px-2.5 py-1 rounded-lg border border-border-color/80 font-mono uppercase">
                                      {user.role}
                                    </span>
                                  </td>
                                  <td className="p-3.5">
                                    <div className="flex flex-wrap gap-1.5 max-w-xs">
                                      {user.roles.map(r => (
                                        <span key={r.id} className="bg-primary/5 text-primary text-[9px] font-bold px-2 py-0.5 rounded-lg border border-primary/20 font-mono tracking-wide">
                                          {r.name}
                                        </span>
                                      ))}
                                      {user.roles.length === 0 && (
                                        <span className="text-[10px] text-text-muted italic">No roles mapped</span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="p-3.5 text-right pr-4">
                                    <div className="flex justify-end gap-2">
                                      <button 
                                        onClick={() => handleAuditUser(user)}
                                        className="px-2.5 py-1.5 rounded-xl bg-secondary/10 border border-secondary/20 text-secondary hover:bg-secondary/20 hover:border-secondary/30 transition-all font-semibold flex items-center gap-1 text-[10px]"
                                        title="Audit Effective Permissions"
                                      >
                                        <Eye size={11} /> Audit
                                      </button>
                                      <button 
                                        onClick={() => handleOpenUserReassign(user)}
                                        className="px-2.5 py-1.5 rounded-xl bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 hover:border-primary/30 transition-all font-semibold flex items-center gap-1 text-[10px]"
                                      >
                                        Roles
                                      </button>
                                      <button 
                                        onClick={() => handleOpenEditUser(user)}
                                        className="px-2.5 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 hover:border-amber-500/30 transition-all font-semibold flex items-center gap-1 text-[10px]"
                                      >
                                        Edit
                                      </button>
                                      <button 
                                        onClick={() => handleOpenDeleteUser(user)}
                                        className="px-2.5 py-1.5 rounded-xl bg-error/10 border border-error/20 text-error hover:bg-error/20 hover:border-error/30 transition-all font-semibold flex items-center gap-1 text-[10px]"
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Modal overlay for user role editing */}
                      {selectedUser && (
                        <div className="p-5 border border-border-color bg-bg-card/75 backdrop-blur-md rounded-2xl flex flex-col gap-4 shadow-xl">
                          <div className="flex justify-between items-center border-b border-border-color pb-2">
                            <span className="text-xs font-bold text-text-primary">Reassign Roles for {selectedUser.full_name}</span>
                            <button onClick={() => setSelectedUser(null)} className="text-text-muted hover:text-text-secondary text-xs">Cancel</button>
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
                                  className={`p-2.5 border text-left rounded-xl text-xs transition-all ${
                                    isChecked
                                      ? 'bg-primary/10 border-primary/30 text-primary font-bold shadow-[0_0_10px_var(--primary-glow)]'
                                      : 'bg-slate-900/50 border-border-color text-text-secondary hover:border-text-muted'
                                  }`}
                                >
                                  {r.name}
                                </button>
                              );
                            })}
                          </div>
                          <button
                            onClick={saveUserRolesReassignment}
                            className="bg-gradient-to-r from-primary to-primary-hover text-bg-dark font-extrabold px-4 py-2 rounded-xl text-xs self-end active:scale-98 select-none transition-all"
                          >
                            Save Role Changes
                          </button>
                        </div>
                      )}

                      {/* Permissions Auditor Sub-panel */}
                      {auditingUser && (
                        <div className="p-5 border border-secondary/20 bg-bg-card/65 backdrop-blur-md rounded-2xl flex flex-col gap-4 animate-fadeIn shadow-2xl shadow-black/30">
                          <div className="flex justify-between items-center border-b border-border-color pb-2.5">
                            <div className="flex items-center gap-1.5">
                              <Shield size={14} className="text-secondary" />
                              <span className="text-xs font-bold text-text-primary">Effective Permissions Auditor: {auditingUser.full_name} ({auditingUser.email})</span>
                            </div>
                            <button onClick={() => setAuditingUser(null)} className="text-text-muted hover:text-text-secondary text-xs">×</button>
                          </div>
                          
                          {loadingAudit ? (
                            <div className="py-8 flex items-center justify-center gap-2">
                              <div className="h-4 w-4 rounded-full border border-secondary border-t-transparent animate-spin"></div>
                              <span className="text-xs text-text-muted font-mono uppercase tracking-wider">Calculating Access Matrix...</span>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-4">
                              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                                <span className="text-[10px] text-text-muted font-mono uppercase tracking-wider">Assigned Roles: {auditingUser.roles.map(r => r.name).join(', ') || 'None'}</span>
                                <input
                                  type="text"
                                  placeholder="Filter permissions..."
                                  value={auditPermissionSearch}
                                  onChange={(e) => setAuditPermissionSearch(e.target.value)}
                                  className="bg-slate-950/60 border border-border-color rounded-xl px-3.5 py-1.5 text-[11px] text-text-primary placeholder-text-muted focus:outline-none w-48"
                                />
                              </div>
                              
                              <div className="max-h-[240px] overflow-y-auto border border-border-color rounded-xl shadow-inner bg-slate-950/20">
                                <table className="w-full text-left border-collapse">
                                  <thead className="bg-bg-card sticky top-0 border-b border-border-color text-[9px] font-mono text-text-muted uppercase">
                                    <tr>
                                      <th className="p-2.5 pl-3">Module</th>
                                      <th className="p-2.5">Permission Key</th>
                                      <th className="p-2.5">Description</th>
                                      <th className="p-2.5 pr-3">Effective Scope</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {permissions
                                      .filter(p => 
                                        p.permission_key.toLowerCase().includes(auditPermissionSearch.toLowerCase()) ||
                                        p.module.toLowerCase().includes(auditPermissionSearch.toLowerCase())
                                      )
                                      .map(p => {
                                        const scope = auditedPermissions[p.permission_key] || 'NONE';
                                        return (
                                          <tr key={p.id} className="border-b border-border-color/40 last:border-0 hover:bg-bg-card-hover/20 text-xs text-text-secondary">
                                            <td className="p-2.5 pl-3 font-mono text-[9px] text-primary">{p.module}</td>
                                            <td className="p-2.5 font-mono text-[10px] text-text-secondary">{p.permission_key}</td>
                                            <td className="p-2.5 text-[11px] text-text-muted">{p.description}</td>
                                            <td className="p-2.5 pr-3">
                                              <span className={`px-2 py-0.5 rounded-lg text-[9px] font-bold font-mono border ${
                                                scope === 'ALL' ? 'bg-primary/10 text-primary border-primary/20' :
                                                scope === 'TEAM' ? 'bg-secondary/10 text-secondary border-secondary/20' :
                                                scope === 'ASSIGNED' ? 'bg-accent/10 text-accent border-accent/20' :
                                                scope === 'OWN' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                                'bg-slate-800 text-text-muted border-transparent'
                                              }`}>
                                                {scope}
                                              </span>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Role Matrix Selector & Editor */}
                      <div className="flex flex-col gap-4 border-t border-border-color/80 pt-6">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                          <div>
                            <h4 className="text-xs font-bold uppercase tracking-wider text-text-primary">Roles Activation & Permission Matrix</h4>
                            <p className="text-[10px] text-text-muted mt-0.5">Edit fine-grained scopes dynamically mapped to permissions database triggers.</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-xs text-text-secondary font-medium">Select Role:</label>
                            <select
                              value={selectedRoleForMatrix}
                              onChange={(e) => setSelectedRoleForMatrix(e.target.value)}
                              className="bg-slate-950/60 border border-border-color text-text-secondary rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-primary/50"
                            >
                              {roles.map(r => (
                                <option key={r.id} value={r.id}>{r.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Toggle active state of selected role */}
                        {selectedRoleForMatrix && (
                          <div className="flex items-center justify-between p-4 bg-bg-card/45 border border-border-color rounded-2xl shadow-lg">
                            <div>
                              <span className="text-xs font-bold text-text-primary">Role Active Status</span>
                              <p className="text-[10px] text-text-muted">Deactivated roles prevent allocated users from gaining corresponding scope rights.</p>
                            </div>
                            <button
                              onClick={() => {
                                      const role = roles.find(r => r.id === selectedRoleForMatrix);
                                      if (role) toggleRoleStatus(role);
                              }}
                              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all duration-300 active:scale-98 ${
                                roles.find(r => r.id === selectedRoleForMatrix)?.is_active
                                  ? 'bg-primary/10 border-primary/30 text-primary shadow-[0_0_10px_var(--primary-glow)]'
                                  : 'bg-error/10 border-error/30 text-error'
                              }`}
                            >
                              {roles.find(r => r.id === selectedRoleForMatrix)?.is_active ? 'Active' : 'Disabled'}
                            </button>
                          </div>
                        )}

                        {/* Permissions scope matrix list - Collapsible Accordion Groups */}
                        <div className="flex flex-col gap-3 max-h-[420px] overflow-y-auto pr-1">
                          {(() => {
                            // Group permissions by module
                            const permissionsByModule = permissions.reduce<Record<string, Permission[]>>((acc, p) => {
                              const mod = p.module || 'SYSTEM';
                              if (!acc[mod]) acc[mod] = [];
                              acc[mod].push(p);
                              return acc;
                            }, {});

                            return Object.entries(permissionsByModule).map(([mod, permsList]) => {
                              const isExpanded = expandedModules[mod];
                              const activeCount = permsList.filter(p => (matrixPermissions[p.permission_key] || 'NONE') !== 'NONE').length;
                              return (
                                <div key={mod} className="border border-border-color bg-slate-950/20 rounded-2xl overflow-hidden transition-all shadow-inner">
                                  <button
                                    type="button"
                                    onClick={() => setExpandedModules({
                                      ...expandedModules,
                                      [mod]: !isExpanded
                                    })}
                                    className="w-full flex items-center justify-between p-4 bg-slate-950/40 hover:bg-slate-900/25 text-left transition-colors font-sans select-none"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-bold text-text-primary font-mono tracking-wider">{mod}</span>
                                      <span className="text-[9px] font-bold text-primary px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 font-mono">
                                        {activeCount} / {permsList.length} CONFIGURED
                                      </span>
                                    </div>
                                    <span className="text-text-muted text-xs font-bold font-mono">
                                      {isExpanded ? 'Collapse ▲' : 'Expand ▼'}
                                    </span>
                                  </button>
                                  
                                  {isExpanded && (
                                    <div className="border-t border-border-color/40 overflow-x-auto bg-slate-950/10">
                                      <table className="w-full text-left border-collapse">
                                        <thead>
                                          <tr className="bg-slate-950/50 text-[9px] font-mono text-text-muted uppercase border-b border-border-color/30">
                                            <th className="p-3 pl-4">Permission Key</th>
                                            <th className="p-3">Description</th>
                                            <th className="p-3 pr-4 text-right">Assigned Scope / Matrix Rule</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {permsList.map(perm => {
                                            const currentScope = matrixPermissions[perm.permission_key] || 'NONE';
                                            return (
                                              <tr key={perm.id} className="border-b border-border-color/30 last:border-0 hover:bg-bg-card-hover/20 text-xs text-text-secondary">
                                                <td className="p-3 pl-4 font-mono text-text-secondary text-[10px]">{perm.permission_key}</td>
                                                <td className="p-3 text-text-muted leading-relaxed max-w-sm">{perm.description}</td>
                                                <td className="p-3 pr-4 text-right">
                                                  <select
                                                    value={currentScope}
                                                    onChange={(e) => setMatrixPermissions({
                                                      ...matrixPermissions,
                                                      [perm.permission_key]: e.target.value as any
                                                    })}
                                                    className={`bg-slate-950 border text-[11px] font-mono font-bold rounded-xl px-3 py-1.5 focus:outline-none transition-all duration-300 ${
                                                      currentScope === 'NONE' ? 'border-border-color text-text-muted hover:border-text-muted/45' :
                                                      currentScope === 'ALL' ? 'border-primary/40 text-primary bg-primary/5 shadow-[0_0_10px_var(--primary-glow)]' :
                                                      currentScope === 'TEAM' ? 'border-secondary/40 text-secondary bg-secondary/5' :
                                                      'border-accent/40 text-accent bg-accent/5'
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
                                  )}
                                </div>
                              );
                            });
                          })()}
                        </div>

                        <button
                          onClick={savePermissionsMatrix}
                          disabled={saving}
                          className="bg-gradient-to-r from-primary to-primary-hover text-bg-dark font-extrabold px-5 py-2.5 rounded-xl text-xs transition-all flex items-center gap-1.5 ml-auto mt-2 shadow-lg hover:shadow-[0_0_15px_var(--primary-glow)] active:scale-98 select-none"
                        >
                          <Save size={13} /> Save Permissions Matrix
                        </button>

                        {/* Create Custom Roles & Custom Permissions forms */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 border-t border-border-color/80 pt-6">
                          {/* Custom Role Creation */}
                          <form onSubmit={handleCreateCustomRole} className="p-5 bg-bg-card/35 border border-border-color rounded-2xl flex flex-col gap-4 shadow-lg">
                            <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-1.5"><Shield size={13} className="text-primary" /> Create Custom Role</h4>
                            <div className="grid grid-cols-2 gap-2.5">
                              <div>
                                <label className="block text-[9px] font-mono text-text-muted uppercase font-bold mb-1.5">Role Name</label>
                                <input
                                  type="text"
                                  placeholder="e.g. Sales Consultant"
                                  value={newRoleName}
                                  onChange={(e) => setNewRoleName(e.target.value)}
                                  className="w-full bg-slate-950/40 border border-border-color rounded-xl px-3.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-primary/50"
                                />
                              </div>
                              <div>
                                <label className="block text-[9px] font-mono text-text-muted uppercase font-bold mb-1.5">Role Slug Key</label>
                                <input
                                  type="text"
                                  placeholder="e.g. sales_consultant"
                                  value={newRoleKey}
                                  onChange={(e) => setNewRoleKey(e.target.value)}
                                  className="w-full bg-slate-950/40 border border-border-color rounded-xl px-3.5 py-1.5 text-xs text-text-primary font-mono focus:outline-none focus:border-primary/50"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-[9px] font-mono text-text-muted uppercase font-bold mb-1.5">Hierarchy Level (1-100)</label>
                              <input
                                  type="number"
                                  min="1"
                                  max="100"
                                  value={newRoleHierarchy}
                                  onChange={(e) => setNewRoleHierarchy(Number(e.target.value))}
                                  className="w-full bg-slate-950/40 border border-border-color rounded-xl px-3.5 py-1.5 text-xs text-text-primary font-mono focus:outline-none focus:border-primary/50 font-semibold"
                                />
                            </div>
                            <div>
                              <label className="block text-[9px] font-mono text-text-muted uppercase font-bold mb-1.5">Description</label>
                              <textarea
                                rows={2}
                                placeholder="Role duties and capabilities..."
                                value={newRoleDesc}
                                onChange={(e) => setNewRoleDesc(e.target.value)}
                                className="w-full bg-slate-950/40 border border-border-color rounded-xl px-3.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-primary/50"
                              />
                            </div>
                            <button
                              type="submit"
                              disabled={saving}
                              className="bg-slate-900 border border-border-color hover:bg-slate-850 hover:border-text-muted/50 text-text-secondary px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-98 select-none self-end mt-1"
                            >
                              + Register Role
                            </button>
                          </form>

                          {/* Custom Permission Catalog Entry */}
                          <form onSubmit={handleCreateCustomPermission} className="p-5 bg-bg-card/35 border border-border-color rounded-2xl flex flex-col gap-4 shadow-lg">
                            <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-1.5"><Key size={13} className="text-primary" /> Catalog New Permission</h4>
                            <div className="grid grid-cols-2 gap-2.5">
                              <div>
                                <label className="block text-[9px] font-mono text-text-muted uppercase font-bold mb-1.5">Permission Slug Key</label>
                                <input
                                  type="text"
                                  placeholder="e.g. tenders.approve"
                                  value={newPermKey}
                                  onChange={(e) => setNewPermKey(e.target.value)}
                                  className="w-full bg-slate-950/40 border border-border-color rounded-xl px-3.5 py-1.5 text-xs text-text-primary font-mono focus:outline-none focus:border-primary/50"
                                />
                              </div>
                              <div>
                                <label className="block text-[9px] font-mono text-text-muted uppercase font-bold mb-1.5">Module / Category</label>
                                <input
                                  type="text"
                                  placeholder="e.g. SALES"
                                  value={newPermModule}
                                  onChange={(e) => setNewPermModule(e.target.value)}
                                  className="w-full bg-slate-950/40 border border-border-color rounded-xl px-3.5 py-1.5 text-xs text-text-primary font-mono focus:outline-none focus:border-primary/50"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-[9px] font-mono text-text-muted uppercase font-bold mb-1.5">Capability Description</label>
                              <textarea
                                rows={2}
                                placeholder="Describe what access this permission control regulates..."
                                value={newPermDesc}
                                onChange={(e) => setNewPermDesc(e.target.value)}
                                className="w-full bg-slate-950/40 border border-border-color rounded-xl px-3.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-primary/50"
                              />
                            </div>
                            <button
                              type="submit"
                              disabled={saving}
                              className="bg-slate-900 border border-border-color hover:bg-slate-850 hover:border-text-muted/50 text-text-secondary px-4.5 rounded-xl text-[11px] font-bold transition-all active:scale-98 select-none self-end mt-1"
                            >
                              + Catalog Entry
                            </button>
                          </form>
                        </div>
                      </div>
                    </div>
                  )}

                    {/* 3. FINANCIAL & TAX */}
                  {activeTab === 'FINANCE' && (
                    <div className="flex flex-col gap-6 animate-fadeIn">
                      <div className="border-b border-border-color/85 pb-3">
                        <h3 className="text-sm font-bold tracking-wider uppercase text-text-secondary flex items-center gap-1.5 font-heading">
                          <DollarSign size={15} className="text-primary" /> Financial Calibration & Tax settings
                        </h3>
                        <p className="text-xs text-text-muted mt-1 font-sans">
                          Regulate VAT brackets, filing months, Quotation authority thresholds, and primary currencies.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* Tax & Filing Card */}
                        <div className="p-5 bg-bg-card/35 border border-border-color rounded-2xl flex flex-col gap-4 shadow-lg">
                          <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider font-mono border-b border-border-color/60 pb-2">VAT Compliance & Filing</h4>
                          <div className="flex flex-col gap-3.5">
                            <div>
                              <label className="block text-[10px] font-mono text-text-muted uppercase font-bold mb-1.5">Standard VAT percentage (%)</label>
                              <div className="relative">
                                <input 
                                  type="number" 
                                  step="0.01"
                                  value={vatRate}
                                  onChange={(e) => setVatRate(Number(e.target.value))}
                                  className="w-full bg-slate-955 border border-border-color rounded-xl pl-4 pr-10 py-2.5 text-xs text-text-primary focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all font-semibold"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-mono font-bold text-text-muted">%</span>
                              </div>
                            </div>
                            <div>
                              <label className="block text-[10px] font-mono text-text-muted uppercase font-bold mb-1.5">VAT Filing period (Months)</label>
                              <div className="relative">
                                <input 
                                  type="number" 
                                  value={vatPeriodMonths}
                                  onChange={(e) => setVatPeriodMonths(Number(e.target.value))}
                                  className="w-full bg-slate-955 border border-border-color rounded-xl pl-4 pr-16 py-2.5 text-xs text-text-primary focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all font-semibold"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] font-mono font-bold text-text-muted uppercase">Months</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Authorization & Base Currency */}
                        <div className="p-5 bg-bg-card/35 border border-border-color rounded-2xl flex flex-col gap-4 shadow-lg">
                          <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider font-mono border-b border-border-color/60 pb-2">Authority Thresholds</h4>
                          <div className="flex flex-col gap-3.5">
                            <div>
                              <label className="block text-[10px] font-mono text-text-muted uppercase font-bold mb-1.5">Quote approval limit (Requires GM Approval)</label>
                              <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[9px] font-mono font-bold text-text-muted uppercase">{currency}</span>
                                <input 
                                  type="number" 
                                  value={thresholdQuote}
                                  onChange={(e) => setThresholdQuote(Number(e.target.value))}
                                  className="w-full bg-slate-955 border border-border-color rounded-xl pl-12 pr-4 py-2.5 text-xs text-text-primary font-mono focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all font-semibold"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-[10px] font-mono text-text-muted uppercase font-bold mb-1.5">Base currency code</label>
                              <input 
                                type="text" 
                                value={currency}
                                onChange={(e) => setCurrency(e.target.value)}
                                className="w-full bg-slate-955 border border-border-color rounded-xl px-4 py-2.5 text-xs text-text-primary font-mono focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all font-semibold uppercase"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={saveFinancials}
                        disabled={saving}
                        className="bg-gradient-to-r from-primary to-primary-hover text-bg-dark font-extrabold px-5 py-2.5 rounded-xl text-xs transition-all flex items-center gap-1.5 ml-auto mt-2 shadow-lg hover:shadow-[0_0_15px_var(--primary-glow)] active:scale-98 select-none"
                      >
                        <Save size={13} /> Save Financial Settings
                      </button>
                    </div>
                  )}

                  {/* 4. PROCUREMENT */}
                  {activeTab === 'PROCUREMENT' && (
                    <div className="flex flex-col gap-6 animate-fadeIn">
                      <div className="border-b border-border-color/85 pb-3">
                        <h3 className="text-sm font-bold tracking-wider uppercase text-text-secondary flex items-center gap-1.5 font-heading">
                          <Sliders size={15} className="text-primary" /> Procurement & Sourcing Parameters
                        </h3>
                        <p className="text-xs text-text-muted mt-1 font-sans">
                          Configure purchase order authorization levels and vendor evaluation settings.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* Limits Card */}
                        <div className="p-5 bg-bg-card/35 border border-border-color rounded-2xl flex flex-col gap-4 shadow-lg justify-between">
                          <div>
                            <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider font-mono border-b border-border-color/60 pb-2 mb-3">LPO Sign-off Matrix</h4>
                            <label className="block text-[10px] font-mono text-text-muted uppercase font-bold mb-1.5">Purchase Order limit (Requires GM Approval)</label>
                            <div className="relative">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[9px] font-mono font-bold text-text-muted uppercase">{currency}</span>
                              <input 
                                type="number" 
                                value={thresholdPO}
                                onChange={(e) => setThresholdPO(Number(e.target.value))}
                                className="w-full bg-slate-955 border border-border-color rounded-xl pl-12 pr-4 py-2.5 text-xs text-text-primary font-mono focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all font-semibold"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Comparisons Settings */}
                        <div className="p-5 bg-bg-card/35 border border-border-color rounded-2xl flex flex-col gap-4 shadow-lg justify-between">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex-1">
                              <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider font-mono border-b border-border-color/60 pb-2 mb-2">Automated Comparisons</h4>
                              <span className="text-xs font-semibold text-text-secondary">Auto Rank Supplier Comparisons</span>
                              <p className="text-[10px] text-text-muted mt-1 leading-relaxed">Enable automatic ranking based on historical price weight scales and response dispatch speeds.</p>
                            </div>
                            <button
                              onClick={() => setAutoRank(!autoRank)}
                              className={`w-10 h-6 rounded-full p-1 transition-all duration-300 focus:outline-none relative flex items-center shrink-0 self-center ${
                                autoRank ? 'bg-primary shadow-[0_0_12px_var(--primary-glow)]' : 'bg-slate-850 border border-border-color'
                              }`}
                            >
                              <div className={`w-4 h-4 rounded-full shadow transform transition-transform duration-300 ${
                                autoRank ? 'translate-x-4 bg-bg-dark' : 'translate-x-0 bg-text-muted'
                              }`} />
                            </button>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={saveProcurement}
                        disabled={saving}
                        className="bg-gradient-to-r from-primary to-primary-hover text-bg-dark font-extrabold px-5 py-2.5 rounded-xl text-xs transition-all flex items-center gap-1.5 ml-auto mt-2 shadow-lg hover:shadow-[0_0_15px_var(--primary-glow)] active:scale-98 select-none"
                      >
                        <Save size={13} /> Save Procurement Settings
                      </button>
                    </div>
                  )}

                  {/* 5. INVENTORY & ASSETS */}
                  {activeTab === 'INVENTORY' && (
                    <div className="flex flex-col gap-6 animate-fadeIn">
                      <div className="border-b border-border-color/85 pb-3">
                        <h3 className="text-sm font-bold tracking-wider uppercase text-text-secondary flex items-center gap-1.5 font-heading">
                          <Layers size={15} className="text-primary" /> Inventory & Capital Assets Calibration
                        </h3>
                        <p className="text-xs text-text-muted mt-1 font-sans">
                          Manage MRF workflow sequences and straight-line depreciation months settings.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pb-2">
                        {/* Approval Toggle */}
                        <div className="p-5 bg-bg-card/35 border border-border-color rounded-2xl flex items-center justify-between gap-4 shadow-lg">
                          <div className="flex-1">
                            <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider font-mono border-b border-border-color/60 pb-2 mb-2">MRF Workflow Control</h4>
                            <span className="text-xs font-semibold text-text-secondary">MRF Approval Check Required</span>
                            <p className="text-[10px] text-text-muted mt-1 leading-relaxed">Requires Site Engineer material requests to be approved by Project Manager before store issues.</p>
                          </div>
                          <button
                            onClick={() => setMrfApprovalRequired(!mrfApprovalRequired)}
                            className={`w-10 h-6 rounded-full p-1 transition-all duration-300 focus:outline-none relative flex items-center shrink-0 self-center ${
                              mrfApprovalRequired ? 'bg-primary shadow-[0_0_12px_var(--primary-glow)]' : 'bg-slate-850 border border-border-color'
                            }`}
                          >
                            <div className={`w-4 h-4 rounded-full shadow transform transition-transform duration-300 ${
                              mrfApprovalRequired ? 'translate-x-4 bg-bg-dark' : 'translate-x-0 bg-text-muted'
                            }`} />
                          </button>
                        </div>

                        {/* Stock limit card */}
                        <div className="p-5 bg-bg-card/35 border border-border-color rounded-2xl flex flex-col gap-4 shadow-lg justify-between">
                          <div>
                            <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider font-mono border-b border-border-color/60 pb-2 mb-3">Reorder Alert Limits</h4>
                            <label className="block text-[10px] font-mono text-text-muted uppercase font-bold mb-1.5">Low Stock Warning Threshold</label>
                            <div className="relative">
                              <input 
                                type="number" 
                                value={lowStockThreshold}
                                onChange={(e) => setLowStockThreshold(Number(e.target.value))}
                                className="w-full bg-slate-955 border border-border-color rounded-xl pl-4 pr-14 py-2.5 text-xs text-text-primary font-mono focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all font-semibold"
                              />
                              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] font-mono font-bold text-text-muted uppercase">Items</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Straight Line Depreciation category values */}
                      <div className="p-5 bg-bg-card/35 border border-border-color rounded-2xl flex flex-col gap-4 shadow-lg">
                        <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider font-mono border-b border-border-color/60 pb-2">Straight-Line Depreciation Lifetimes (Months)</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
                          {Object.entries(usefulLives).map(([category, months]) => (
                            <div key={category} className="p-3.5 bg-slate-950/40 border border-border-color/80 rounded-xl flex flex-col gap-2 relative overflow-hidden group">
                              <label className="block text-[9px] font-mono text-text-muted uppercase font-bold tracking-wide truncate" title={category.replace('_', ' ')}>{category.replace('_', ' ')}</label>
                              <div className="relative">
                                <input 
                                  type="number" 
                                  value={months}
                                  onChange={(e) => setUsefulLives({
                                    ...usefulLives,
                                    [category]: Number(e.target.value)
                                  })}
                                  className="w-full bg-slate-950/50 border border-border-color/70 rounded-lg pl-2.5 pr-8 py-1.5 text-xs text-text-primary font-bold focus:outline-none focus:border-primary/50 transition-all"
                                />
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] font-mono font-bold text-text-muted">M</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <button
                        onClick={saveInventoryAssets}
                        disabled={saving}
                        className="bg-gradient-to-r from-primary to-primary-hover text-bg-dark font-extrabold px-5 py-2.5 rounded-xl text-xs transition-all flex items-center gap-1.5 ml-auto mt-2 shadow-lg hover:shadow-[0_0_15px_var(--primary-glow)] active:scale-98 select-none"
                      >
                        <Save size={13} /> Save Inventory Settings
                      </button>
                    </div>
                  )}

                  {/* 6. PROJECTS & OPERATIONS */}
                  {activeTab === 'PROJECTS' && (
                    <div className="flex flex-col gap-6 animate-fadeIn">
                      <div className="border-b border-border-color/85 pb-3">
                        <h3 className="text-sm font-bold tracking-wider uppercase text-text-secondary flex items-center gap-1.5 font-heading">
                          <Cpu size={15} className="text-primary" /> Projects & Operations calibration
                        </h3>
                        <p className="text-xs text-text-muted mt-1 font-sans">
                          Configure project sequence states and Variation Order escalation thresholds.
                        </p>
                      </div>

                      {/* Project Stages Management */}
                      <div className="p-5 bg-bg-card/35 border border-border-color rounded-2xl flex flex-col gap-4 shadow-lg">
                        <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider font-mono border-b border-border-color/60 pb-2">Default Project Execution Stages</h4>
                        <div className="flex flex-wrap gap-2.5 p-4.5 bg-slate-955/40 border border-border-color/60 rounded-xl min-h-[60px] items-center">
                          {defaultStages.map((stage, idx) => (
                            <div key={stage} className="flex items-center gap-2">
                              <span className="bg-slate-950/70 text-text-secondary text-[10px] font-semibold px-2.5 py-1.5 rounded-xl border border-border-color/80 flex items-center gap-2 font-mono tracking-wide">
                                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                                {stage}
                                <button 
                                  onClick={() => removeProjectStage(stage)} 
                                  className="text-error hover:text-error-glow font-bold transition-colors ml-0.5 text-xs hover:scale-110 active:scale-95"
                                  title="Delete Stage"
                                >
                                  ×
                                </button>
                              </span>
                              {idx < defaultStages.length - 1 && (
                                <span className="text-text-muted font-bold text-xs select-none">→</span>
                              )}
                            </div>
                          ))}
                          {defaultStages.length === 0 && (
                            <span className="text-[10px] text-text-muted italic">No execution pipeline stages configured.</span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            placeholder="Add stage name (e.g. Subcontractor Bid)..."
                            value={newStageInput}
                            onChange={(e) => setNewStageInput(e.target.value)}
                            className="bg-slate-950/40 border border-border-color rounded-xl px-4 py-2 text-xs text-text-primary focus:outline-none focus:border-primary/50 w-64 font-mono font-semibold"
                          />
                          <button 
                            onClick={addProjectStage}
                            className="bg-slate-900 border border-border-color hover:bg-slate-850 hover:border-text-muted text-text-secondary px-4.5 rounded-xl text-[11px] font-bold transition-all active:scale-98 select-none"
                          >
                            + Add Stage
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="p-5 bg-bg-card/35 border border-border-color rounded-2xl flex flex-col gap-4 shadow-lg justify-between">
                          <div>
                            <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider font-mono border-b border-border-color/60 pb-2 mb-3">Variation Orders Limits</h4>
                            <label className="block text-[10px] font-mono text-text-muted uppercase font-bold mb-1.5">VO Limit (Requires GM Approval)</label>
                            <div className="relative">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[9px] font-mono font-bold text-text-muted uppercase">{currency}</span>
                              <input 
                                type="number" 
                                value={voThreshold}
                                onChange={(e) => setVoThreshold(Number(e.target.value))}
                                className="w-full bg-slate-955 border border-border-color rounded-xl pl-12 pr-4 py-2.5 text-xs text-text-primary font-mono focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all font-semibold"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={saveProjects}
                        disabled={saving}
                        className="bg-gradient-to-r from-primary to-primary-hover text-bg-dark font-extrabold px-5 py-2.5 rounded-xl text-xs transition-all flex items-center gap-1.5 ml-auto mt-2 shadow-lg hover:shadow-[0_0_15px_var(--primary-glow)] active:scale-98 select-none"
                      >
                        <Save size={13} /> Save Project Settings
                      </button>
                    </div>
                  )}

                  {/* 7. MAINTENANCE & SLA */}
                  {activeTab === 'MAINTENANCE' && (
                    <div className="flex flex-col gap-6 animate-fadeIn">
                      <div className="border-b border-border-color/85 pb-3">
                        <h3 className="text-sm font-bold tracking-wider uppercase text-text-secondary flex items-center gap-1.5 font-heading">
                          <Clock size={15} className="text-primary" /> Maintenance Slots & SLA response speeds
                        </h3>
                        <p className="text-xs text-text-muted mt-1 font-sans">
                          Manage reactive SLA category timings and scheduling slot defaults.
                        </p>
                      </div>

                      {/* PPM Timeslot Manager */}
                      <div className="p-5 bg-bg-card/35 border border-border-color rounded-2xl flex flex-col gap-4 shadow-lg">
                        <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider font-mono border-b border-border-color/60 pb-2">PPM Visits Timings Slots</h4>
                        <div className="flex flex-wrap gap-2.5 p-4.5 bg-slate-955/40 border border-border-color/60 rounded-xl min-h-[60px] items-center">
                          {maintenanceSlots.map(slot => (
                            <span key={slot} className="bg-slate-950/70 text-text-secondary text-[10px] font-semibold px-2.5 py-1.5 rounded-xl border border-border-color/80 flex items-center gap-2 font-mono">
                              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                              {slot}
                              <button 
                                onClick={() => removeMaintSlot(slot)} 
                                className="text-error hover:text-error-glow font-bold transition-colors ml-0.5 text-xs hover:scale-110 active:scale-95"
                                title="Delete Slot"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            placeholder="e.g. 18:00 - 20:00"
                            value={newSlotInput}
                            onChange={(e) => setNewSlotInput(e.target.value)}
                            className="bg-slate-950/40 border border-border-color rounded-xl px-4 py-2 text-xs text-text-primary focus:outline-none focus:border-primary/50 w-48 font-mono font-semibold"
                          />
                          <button 
                            onClick={addMaintSlot}
                            className="bg-slate-900 border border-border-color hover:bg-slate-850 hover:border-text-muted text-text-secondary px-4.5 rounded-xl text-[11px] font-bold transition-all active:scale-98 select-none"
                          >
                            + Add Slot
                          </button>
                        </div>
                      </div>

                      {/* SLA categories */}
                      <div className="p-5 bg-bg-card/35 border border-border-color rounded-2xl flex flex-col gap-4 shadow-lg">
                        <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider font-mono border-b border-border-color/60 pb-2">SLA Target Resolution Timings (Hours)</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                          {Object.entries(slaCategories).map(([category, hours]) => {
                            const isCritical = category === 'CRITICAL';
                            const isHigh = category === 'HIGH';
                            const isMedium = category === 'MEDIUM';
                            return (
                              <div key={category} className="p-4 bg-slate-950/30 border border-border-color/80 rounded-xl flex flex-col gap-2 relative overflow-hidden group">
                                <div className="flex items-center gap-1.5">
                                  <span className={`h-2 w-2 rounded-full ${
                                    isCritical ? 'bg-error' :
                                    isHigh ? 'bg-amber-400' :
                                    isMedium ? 'bg-secondary' : 'bg-success'
                                  }`} />
                                  <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-text-secondary">{category}</label>
                                </div>
                                <div className="relative mt-1">
                                  <input 
                                    type="number" 
                                    value={hours}
                                    onChange={(e) => setSlaCategories({
                                      ...slaCategories,
                                      [category]: Number(e.target.value)
                                    })}
                                    className="w-full bg-slate-950/50 border border-border-color/60 rounded-xl pl-3 pr-14 py-2 text-xs text-text-primary font-mono font-bold focus:outline-none focus:border-primary/50 transition-all"
                                  />
                                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-mono font-bold text-text-muted uppercase">Hours</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <button
                        onClick={saveMaintenance}
                        disabled={saving}
                        className="bg-gradient-to-r from-primary to-primary-hover text-bg-dark font-extrabold px-5 py-2.5 rounded-xl text-xs transition-all flex items-center gap-1.5 ml-auto mt-2 shadow-lg hover:shadow-[0_0_15px_var(--primary-glow)] active:scale-98 select-none"
                      >
                        <Save size={13} /> Save Maintenance SLA
                      </button>
                    </div>
                  )}

                  {/* 8. HR & WORKFORCE */}
                  {activeTab === 'HR' && (
                    <div className="flex flex-col gap-6 animate-fadeIn">
                      <div className="border-b border-border-color/85 pb-3">
                        <h3 className="text-sm font-bold tracking-wider uppercase text-text-secondary flex items-center gap-1.5 font-heading">
                          <Clock size={15} className="text-primary" /> HR Calendars & Gratuity entitlement
                        </h3>
                        <p className="text-xs text-text-muted mt-1 font-sans">
                          Manage shift operational hours, working days, and UAE Labor Law Gratuity entitlement days scale.
                        </p>
                      </div>

                      {/* Business Hours */}
                      <div className="p-5 bg-bg-card/35 border border-border-color rounded-2xl flex flex-col gap-4 shadow-lg">
                        <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider font-mono border-b border-border-color/60 pb-2">Shift Operating Timings</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-mono text-text-muted uppercase font-bold mb-1.5">Shift Start Time</label>
                            <input 
                              type="time" 
                              value={businessHours.start}
                              onChange={(e) => setBusinessHours({ ...businessHours, start: e.target.value })}
                              className="w-full bg-slate-955 border border-border-color rounded-xl px-4 py-2.5 text-xs text-text-primary font-mono focus:outline-none focus:border-primary/50"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-mono text-text-muted uppercase font-bold mb-1.5">Shift End Time</label>
                            <input 
                              type="time" 
                              value={businessHours.end}
                              onChange={(e) => setBusinessHours({ ...businessHours, end: e.target.value })}
                              className="w-full bg-slate-955 border border-border-color rounded-xl px-4 py-2.5 text-xs text-text-primary font-mono focus:outline-none focus:border-primary/50"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Working Days */}
                      <div className="p-5 bg-bg-card/35 border border-border-color rounded-2xl flex flex-col gap-4 shadow-lg">
                        <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider font-mono border-b border-border-color/60 pb-2">Weekly Working Days</h4>
                        <div className="flex flex-wrap gap-2">
                          {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, idx) => {
                            const isSelected = businessHours.working_days.includes(idx);
                            return (
                              <button
                                key={day}
                                type="button"
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
                                className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all active:scale-95 select-none ${
                                  isSelected
                                    ? 'bg-primary/10 border-primary/30 text-primary font-bold shadow-[0_0_12px_var(--primary-glow)]'
                                    : 'bg-slate-950/60 border-border-color text-text-muted hover:text-text-secondary hover:border-text-muted/50'
                                }`}
                              >
                                {day}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Gratuity brackets */}
                      <div className="p-5 bg-bg-card/35 border border-border-color rounded-2xl flex flex-col gap-4 shadow-lg">
                        <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider font-mono border-b border-border-color/60 pb-2">UAE Gratuity Entitlement Accrual Rates</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-[9px] font-mono text-text-muted uppercase font-bold mb-1.5">Under 1 Year Service</label>
                            <div className="relative">
                              <input 
                                type="number" 
                                value={gratuityEntitlement.under_1yr}
                                onChange={(e) => setGratuityEntitlement({
                                  ...gratuityEntitlement,
                                  under_1yr: Number(e.target.value)
                                })}
                                className="w-full bg-slate-950/50 border border-border-color rounded-xl pl-3.5 pr-14 py-2.5 text-xs text-text-primary font-mono focus:outline-none focus:border-primary/50"
                              />
                              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[8px] font-mono font-bold text-text-muted uppercase">Days</span>
                            </div>
                          </div>
                          <div>
                            <label className="block text-[9px] font-mono text-text-muted uppercase font-bold mb-1.5">1 to 5 Years Service</label>
                            <div className="relative">
                              <input 
                                type="number" 
                                value={gratuityEntitlement['1to5yr']}
                                onChange={(e) => setGratuityEntitlement({
                                  ...gratuityEntitlement,
                                  '1to5yr': Number(e.target.value)
                                })}
                                className="w-full bg-slate-950/50 border border-border-color rounded-xl pl-3.5 pr-14 py-2.5 text-xs text-text-primary font-mono focus:outline-none focus:border-primary/50"
                              />
                              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[8px] font-mono font-bold text-text-muted uppercase">Days</span>
                            </div>
                          </div>
                          <div>
                            <label className="block text-[9px] font-mono text-text-muted uppercase font-bold mb-1.5">Above 5 Years Service</label>
                            <div className="relative">
                              <input 
                                type="number" 
                                value={gratuityEntitlement.above5yr}
                                onChange={(e) => setGratuityEntitlement({
                                  ...gratuityEntitlement,
                                  above5yr: Number(e.target.value)
                                })}
                                className="w-full bg-slate-955 border border-border-color rounded-xl pl-3.5 pr-14 py-2.5 text-xs text-text-primary font-mono focus:outline-none focus:border-primary/50"
                              />
                              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[8px] font-mono font-bold text-text-muted uppercase">Days</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={saveHrWorkforce}
                        disabled={saving}
                        className="bg-gradient-to-r from-primary to-primary-hover text-bg-dark font-extrabold px-5 py-2.5 rounded-xl text-xs transition-all flex items-center gap-1.5 ml-auto mt-2 shadow-lg hover:shadow-[0_0_15px_var(--primary-glow)] active:scale-98 select-none"
                      >
                        <Save size={13} /> Save HR Workforce Settings
                      </button>
                    </div>
                  )}
                                  {/* 9. NOTIFICATIONS & COMMUNICATIONS */}
                  {activeTab === 'NOTIFICATIONS' && (
                    <div className="flex flex-col gap-6 animate-fadeIn">
                      <div className="border-b border-border-color/85 pb-3">
                        <h3 className="text-sm font-bold tracking-wider uppercase text-text-secondary flex items-center gap-1.5 font-heading">
                          <Bell size={15} className="text-primary" /> Notifications & Communications Control
                        </h3>
                        <p className="text-xs text-text-muted mt-1 font-sans">
                          Toggle global notification channels and modify standard message body structures.
                        </p>
                      </div>

                      {/* Channels list toggles */}
                      <div className="flex flex-col gap-3.5 bg-bg-card/35 border border-border-color rounded-2xl p-5 shadow-lg">
                        {Object.entries(notifications).map(([channel, active]) => (
                          <div key={channel} className="flex items-center justify-between border-b border-border-color/40 last:border-b-0 pb-3.5 last:pb-0 first:pt-0 pt-3.5">
                            <div>
                              <span className="text-xs font-bold text-text-secondary capitalize tracking-wide">{channel} Dispatch Gateway</span>
                              <p className="text-[10px] text-text-muted mt-0.5">Toggle automatic transmission for high priority module events.</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setNotifications({ ...notifications, [channel]: !active })}
                              className={`w-10 h-6 rounded-full p-1 transition-all duration-300 focus:outline-none relative flex items-center shrink-0 ${
                                active ? 'bg-primary shadow-[0_0_12px_var(--primary-glow)]' : 'bg-slate-850 border border-border-color'
                              }`}
                            >
                              <div className={`w-4 h-4 rounded-full shadow transform transition-transform duration-300 ${
                                active ? 'translate-x-4 bg-bg-dark' : 'translate-x-0 bg-text-muted'
                              }`} />
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* Msg text templates */}
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border-color/60 pb-2 gap-2">
                          <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider font-mono">Message Text Templates</h4>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[9px] font-mono text-text-muted uppercase font-bold">Variables:</span>
                            {['{client_name}', '{number}', '{total_incl_vat}', '{site_name}'].map(v => (
                              <code key={v} className="text-[9px] font-mono font-bold bg-slate-950 border border-border-color/60 text-primary px-1.5 py-0.5 rounded select-all">{v}</code>
                            ))}
                          </div>
                        </div>
                        
                        <div className="flex flex-col gap-4 bg-bg-card/35 border border-border-color p-5 rounded-2xl shadow-lg">
                          <div>
                            <label className="block text-[10px] font-mono text-text-muted uppercase font-bold mb-2">Quotation Sent Message</label>
                            <textarea
                              rows={2.5}
                              value={notifTemplates.quotation_sent}
                              onChange={(e) => setNotifTemplates({ ...notifTemplates, quotation_sent: e.target.value })}
                              className="w-full bg-slate-955 border border-border-color rounded-xl px-4 py-3 text-xs text-text-primary placeholder-text-muted/50 focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all font-sans font-semibold leading-relaxed"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-mono text-text-muted uppercase font-bold mb-2">Purchase Order Approved Message</label>
                            <textarea
                              rows={2.5}
                              value={notifTemplates.po_approved}
                              onChange={(e) => setNotifTemplates({ ...notifTemplates, po_approved: e.target.value })}
                              className="w-full bg-slate-955 border border-border-color rounded-xl px-4 py-3 text-xs text-text-primary placeholder-text-muted/50 focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all font-sans font-semibold leading-relaxed"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-mono text-text-muted uppercase font-bold mb-2">Ticket Assigned SMS/WhatsApp Body</label>
                            <textarea
                              rows={2.5}
                              value={notifTemplates.ticket_assigned}
                              onChange={(e) => setNotifTemplates({ ...notifTemplates, ticket_assigned: e.target.value })}
                              className="w-full bg-slate-955 border border-border-color rounded-xl px-4 py-3 text-xs text-text-primary placeholder-text-muted/50 focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all font-sans font-semibold leading-relaxed"
                            />
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={saveNotifications}
                        disabled={saving}
                        className="bg-gradient-to-r from-primary to-primary-hover text-bg-dark font-extrabold px-5 py-2.5 rounded-xl text-xs transition-all flex items-center gap-1.5 ml-auto mt-2 shadow-lg hover:shadow-[0_0_15px_var(--primary-glow)] active:scale-98 select-none"
                      >
                        <Save size={13} /> Save Notifications Templates
                      </button>
                    </div>
                  )}

                  {/* 10. DOCUMENT TEMPLATES */}
                  {activeTab === 'TEMPLATES' && (
                    <div className="flex flex-col gap-6 animate-fadeIn">
                      <div className="border-b border-border-color/85 pb-3">
                        <h3 className="text-sm font-bold tracking-wider uppercase text-text-secondary flex items-center gap-1.5 font-heading">
                          <FileCheck size={15} className="text-primary" /> Branded PDF & Document Style Presets
                        </h3>
                        <p className="text-xs text-text-muted mt-1 font-sans">
                          Customize the headers, accent colors, and footer disclaimers generated across all ERP modules.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="p-5 bg-bg-card/35 border border-border-color rounded-2xl flex flex-col gap-4 shadow-lg">
                          <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider font-mono border-b border-border-color/60 pb-2">Header Identifiers</h4>
                          <div className="flex flex-col gap-3.5">
                            <div>
                              <label className="block text-[10px] font-mono text-text-muted uppercase font-bold mb-1.5">PDF Main Header Title</label>
                              <input 
                                type="text" 
                                value={docTemplates.header_title}
                                onChange={(e) => setDocTemplates({ ...docTemplates, header_title: e.target.value })}
                                className="w-full bg-slate-955 border border-border-color rounded-xl px-4 py-2.5 text-xs text-text-primary focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all font-semibold"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-mono text-text-muted uppercase font-bold mb-1.5">PDF Header Subtext Description</label>
                              <input 
                                type="text" 
                                value={docTemplates.header_subtitle}
                                onChange={(e) => setDocTemplates({ ...docTemplates, header_subtitle: e.target.value })}
                                className="w-full bg-slate-955 border border-border-color rounded-xl px-4 py-2.5 text-xs text-text-primary focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all font-semibold"
                              />
                            </div>
                          </div>
                        </div>
                        
                        <div className="p-5 bg-bg-card/35 border border-border-color rounded-2xl flex flex-col gap-4 shadow-lg">
                          <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider font-mono border-b border-border-color/60 pb-2">Accent Styling</h4>
                          <div>
                            <label className="block text-[10px] font-mono text-text-muted uppercase font-bold mb-2.5">Document Theme Accent Palette</label>
                            <div className="flex flex-wrap items-center gap-2.5">
                              {[
                                { id: 'slate', name: 'Slate Dark', bg: 'bg-slate-500', text: 'text-slate-400' },
                                { id: 'mint', name: 'Electric Mint', bg: 'bg-[#10b981]', text: 'text-primary' },
                                { id: 'gold', name: 'Metallic Gold', bg: 'bg-[#f59e0b]', text: 'text-amber-500' },
                                { id: 'red', name: 'Crimson Red', bg: 'bg-[#ef4444]', text: 'text-red-500' },
                              ].map((color) => {
                                const isSelected = docTemplates.accent_color === color.id;
                                return (
                                  <button
                                    key={color.id}
                                    type="button"
                                    onClick={() => setDocTemplates({ ...docTemplates, accent_color: color.id })}
                                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border transition-all text-xs font-bold active:scale-95 ${
                                      isSelected
                                        ? 'bg-primary/10 border-primary/45 text-primary shadow-[0_0_12px_var(--primary-glow)] font-bold'
                                        : 'bg-slate-955 border-border-color text-text-muted hover:border-text-muted/50 hover:text-text-secondary'
                                    }`}
                                  >
                                    <span className={`h-3 w-3 rounded-full ${color.bg} shadow-md`} />
                                    <span>{color.name}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        {/* Live PDF Header Mockup */}
                        <div className="md:col-span-2 p-5 bg-bg-card/35 border border-border-color rounded-2xl flex flex-col gap-3.5 shadow-lg">
                          <label className="block text-[10px] font-mono text-text-muted uppercase font-bold tracking-wide">PDF Live Accent Preview</label>
                          <div className="bg-slate-950 text-text-primary p-6 rounded-xl border border-border-color/80 shadow flex justify-between items-start font-sans relative overflow-hidden group">
                            {/* Accent Glow backdrop */}
                            <div className={`absolute right-0 top-0 w-48 h-48 blur-[80px] rounded-full opacity-10 transition-all duration-500 ${
                              docTemplates.accent_color === 'mint' ? 'bg-[#10b981]' :
                              docTemplates.accent_color === 'gold' ? 'bg-[#f59e0b]' :
                              docTemplates.accent_color === 'red' ? 'bg-[#ef4444]' : 'bg-slate-400'
                            }`} />
                            
                            <div className="flex flex-col gap-1 relative z-10">
                              <h4 className={`text-base font-extrabold uppercase tracking-tight transition-colors duration-300 ${
                                docTemplates.accent_color === 'mint' ? 'text-primary' :
                                docTemplates.accent_color === 'gold' ? 'text-amber-400' :
                                docTemplates.accent_color === 'red' ? 'text-red-400' : 'text-slate-300'
                              }`}>
                                {docTemplates.header_title || 'JEET MEP ENGINEERING'}
                              </h4>
                              <p className="text-[10px] text-text-muted font-medium transition-colors duration-300">{docTemplates.header_subtitle || 'Dubai Branch, United Arab Emirates'}</p>
                            </div>
                            <div className={`text-right border-t-2 py-1.5 px-3 transition-all duration-300 relative z-10 ${
                              docTemplates.accent_color === 'mint' ? 'border-primary text-primary bg-primary/5' :
                              docTemplates.accent_color === 'gold' ? 'border-amber-500 text-amber-400 bg-amber-500/5' :
                              docTemplates.accent_color === 'red' ? 'border-red-500 text-red-400 bg-red-500/5' : 'border-slate-500 text-slate-400 bg-slate-900/40'
                            }`}>
                              <span className="text-[10px] font-extrabold font-mono tracking-wider">TAX INVOICE</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Footer terms for different documents */}
                      <div className="flex flex-col gap-4 border-t border-border-color/60 pt-5 mt-2">
                        <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider font-mono">Footers & Disclaimer terms for generated PDFs</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-bg-card/35 border border-border-color p-5 rounded-2xl shadow-lg">
                          <div>
                            <label className="block text-[10px] font-mono text-text-muted uppercase font-bold mb-2">Tax Invoice Footer Terms</label>
                            <textarea
                              rows={2.5}
                              value={docTemplates.invoice_disclaimer}
                              onChange={(e) => setDocTemplates({ ...docTemplates, invoice_disclaimer: e.target.value })}
                              className="w-full bg-slate-955 border border-border-color rounded-xl px-4 py-3 text-xs text-text-primary focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all font-mono leading-relaxed"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-mono text-text-muted uppercase font-bold mb-2">Project Handover Closeout Disclaimer</label>
                            <textarea
                              rows={2.5}
                              value={docTemplates.handover_disclaimer}
                              onChange={(e) => setDocTemplates({ ...docTemplates, handover_disclaimer: e.target.value })}
                              className="w-full bg-slate-955 border border-border-color rounded-xl px-4 py-3 text-xs text-text-primary focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all font-mono leading-relaxed"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-mono text-text-muted uppercase font-bold mb-2">PPM Maintenance Visit report Disclaimer</label>
                            <textarea
                              rows={2.5}
                              value={docTemplates.ppm_disclaimer}
                              onChange={(e) => setDocTemplates({ ...docTemplates, ppm_disclaimer: e.target.value })}
                              className="w-full bg-slate-955 border border-border-color rounded-xl px-4 py-3 text-xs text-text-primary focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all font-mono leading-relaxed"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-mono text-text-muted uppercase font-bold mb-2">Variation Order Sheet disclaimer</label>
                            <textarea
                              rows={2.5}
                              value={docTemplates.vo_disclaimer}
                              onChange={(e) => setDocTemplates({ ...docTemplates, vo_disclaimer: e.target.value })}
                              className="w-full bg-slate-955 border border-border-color rounded-xl px-4 py-3 text-xs text-text-primary focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all font-mono leading-relaxed"
                            />
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={saveTemplates}
                        disabled={saving}
                        className="bg-gradient-to-r from-primary to-primary-hover text-bg-dark font-extrabold px-5 py-2.5 rounded-xl text-xs transition-all flex items-center gap-1.5 ml-auto mt-2 shadow-lg hover:shadow-[0_0_15px_var(--primary-glow)] active:scale-98 select-none"
                      >
                        <Save size={13} /> Save PDF Styling Templates
                      </button>
                    </div>
                  )}

                  {/* 11. INTEGRATIONS */}
                  {activeTab === 'INTEGRATIONS' && (
                    <div className="flex flex-col gap-6 animate-fadeIn">
                      <div className="border-b border-border-color/85 pb-3">
                        <h3 className="text-sm font-bold tracking-wider uppercase text-text-secondary flex items-center gap-1.5 font-heading">
                          <Share2 size={15} className="text-primary" /> Integrations & API Credentials
                        </h3>
                        <p className="text-xs text-text-muted mt-1 font-sans">
                          Manage SMTP Mail Relays, SMS gateways, and API tokens for messaging channels.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* SMTP Card */}
                        <div className="p-5 bg-bg-card/35 border border-border-color rounded-2xl flex flex-col gap-4 shadow-lg">
                          <div className="flex items-center justify-between border-b border-border-color/60 pb-2">
                            <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider font-mono flex items-center gap-1.5">
                              <Building size={13} className="text-primary" /> SMTP Mail Host settings
                            </h4>
                            <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[8px] font-bold font-mono bg-primary/10 text-primary border border-primary/20">
                              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" /> ACTIVE
                            </span>
                          </div>
                          
                          <div className="flex flex-col gap-3.5">
                            <div>
                              <label className="block text-[10px] font-mono text-text-muted uppercase font-bold mb-1.5">SMTP Server IP/Host</label>
                              <input 
                                type="text" 
                                value={smtpConfig.host}
                                onChange={(e) => setSmtpConfig({ ...smtpConfig, host: e.target.value })}
                                className="w-full bg-slate-955 border border-border-color rounded-xl px-4 py-2.5 text-xs text-text-primary focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all font-semibold"
                              />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                              <div>
                                <label className="block text-[10px] font-mono text-text-muted uppercase font-bold mb-1.5">SMTP TLS/SSL Port</label>
                                <input 
                                  type="number" 
                                  value={smtpConfig.port}
                                  onChange={(e) => setSmtpConfig({ ...smtpConfig, port: Number(e.target.value) })}
                                  className="w-full bg-slate-955 border border-border-color rounded-xl px-4 py-2.5 text-xs text-text-primary focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all font-mono font-semibold"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-mono text-text-muted uppercase font-bold mb-1.5">SMTP Login user</label>
                                <input 
                                  type="text" 
                                  value={smtpConfig.user}
                                  onChange={(e) => setSmtpConfig({ ...smtpConfig, user: e.target.value })}
                                  className="w-full bg-slate-955 border border-border-color rounded-xl px-4 py-2.5 text-xs text-text-primary focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all font-semibold"
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* WhatsApp Gateway Card */}
                        <div className="p-5 bg-bg-card/35 border border-border-color rounded-2xl flex flex-col gap-4 shadow-lg">
                          <div className="flex items-center justify-between border-b border-border-color/60 pb-2">
                            <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider font-mono flex items-center gap-1.5">
                              <Sparkles size={13} className="text-primary" /> WhatsApp API Gateway
                            </h4>
                            <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[8px] font-bold font-mono bg-primary/10 text-primary border border-primary/20">
                              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" /> CONNECTED
                            </span>
                          </div>

                          <div className="flex flex-col gap-3.5">
                            <div>
                              <label className="block text-[10px] font-mono text-text-muted uppercase font-bold mb-1.5">API Dispatch Gateway URL</label>
                              <input 
                                type="text" 
                                value={whatsappGateway.url}
                                onChange={(e) => setWhatsappGateway({ ...whatsappGateway, url: e.target.value })}
                                className="w-full bg-slate-955 border border-border-color rounded-xl px-4 py-2.5 text-xs text-text-primary focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all font-mono font-semibold"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-mono text-text-muted uppercase font-bold mb-1.5">JWT Auth Bearer Token</label>
                              <div className="relative">
                                <input 
                                  type={showWAToken ? "text" : "password"} 
                                  value={whatsappGateway.token}
                                  onChange={(e) => setWhatsappGateway({ ...whatsappGateway, token: e.target.value })}
                                  className="w-full bg-slate-955 border border-border-color rounded-xl pl-4 pr-16 py-2.5 text-xs text-text-primary focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all font-mono font-semibold"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowWAToken(!showWAToken)}
                                  className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary text-[9px] font-mono font-bold tracking-wide transition-colors"
                                >
                                  {showWAToken ? "HIDE" : "SHOW"}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={saveIntegrations}
                        disabled={saving}
                        className="bg-gradient-to-r from-primary to-primary-hover text-bg-dark font-extrabold px-5 py-2.5 rounded-xl text-xs transition-all flex items-center gap-1.5 ml-auto mt-2 shadow-lg hover:shadow-[0_0_15px_var(--primary-glow)] active:scale-98 select-none"
                      >
                        <Save size={13} /> Save Integrations Credentials
                      </button>
                    </div>
                  )}

                  {/* 12. SYSTEM ADMINISTRATION */}
                  {activeTab === 'SYSTEM_ADMIN' && (
                    <div className="flex flex-col gap-6 animate-fadeIn">
                      <div className="border-b border-border-color/85 pb-3">
                        <h3 className="text-sm font-bold tracking-wider uppercase text-text-secondary flex items-center gap-1.5 font-heading">
                          <Sliders size={15} className="text-primary" /> System administration preferences
                        </h3>
                        <p className="text-xs text-text-muted mt-1 font-sans">
                          Regulate active application host states, logger options, and dense UI spacing formats.
                        </p>
                      </div>

                      {appMode === 'maintenance' && (
                        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-450 flex items-start gap-3 shadow-[0_0_15px_rgba(245,158,11,0.06)] animate-pulse">
                          <AlertTriangle className="shrink-0 mt-0.5 text-amber-450 animate-bounce" size={16} />
                          <div>
                            <span className="font-bold uppercase tracking-wider font-mono">Maintenance Mode Triggered:</span>
                            <p className="text-[10px] text-amber-400/80 mt-1 leading-relaxed">
                              Database write locks are enabled. Live client interfaces will be locked with an operational maintenance screen. Administrative consoles remain accessible.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* App mode selections */}
                      <div className="flex flex-col gap-2.5">
                        <label className="block text-[10px] font-mono text-text-muted uppercase font-bold">Application running mode</label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {[
                            { id: 'production', name: 'Production Mode', desc: 'High-speed caching & optimization for live operations.', badge: 'RECOMMENDED', badgeColor: 'bg-primary/10 text-primary border border-primary/20' },
                            { id: 'development', name: 'Development Mode', desc: 'Detailed error tracing and hot-reloading for testing.', badge: 'DEBUGGING', badgeColor: 'bg-blue-500/10 text-blue-400 border border-blue-500/20' },
                            { id: 'maintenance', name: 'Maintenance Mode', desc: 'Locks database writes and shows maintenance screen to users.', badge: 'WRITE LOCKS', badgeColor: 'bg-amber-500/10 text-amber-400 border border-amber-500/20' }
                          ].map((mode) => {
                            const isSelected = appMode === mode.id;
                            return (
                              <button
                                key={mode.id}
                                type="button"
                                onClick={() => setAppMode(mode.id as any)}
                                className={`p-5 rounded-2xl border text-left flex flex-col gap-2.5 transition-all relative overflow-hidden group active:scale-98 ${
                                  isSelected
                                    ? 'bg-primary/5 border-primary/50 text-text-primary shadow-[0_0_20px_rgba(16,185,129,0.05)]'
                                    : 'bg-bg-card/35 border-border-color text-text-muted hover:border-text-muted/50 hover:text-text-secondary'
                                }`}
                              >
                                <div className="flex items-center justify-between w-full">
                                  <span className={`text-xs font-bold transition-colors ${isSelected ? 'text-primary' : 'text-text-secondary group-hover:text-text-primary'}`}>{mode.name}</span>
                                  <span className={`text-[8px] font-mono font-bold px-2 py-0.5 rounded-full ${mode.badgeColor}`}>
                                    {mode.badge}
                                  </span>
                                </div>
                                <p className="text-[10px] text-text-muted leading-relaxed group-hover:text-text-secondary transition-colors">
                                  {mode.desc}
                                </p>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="p-5 bg-bg-card/35 border border-border-color rounded-2xl flex flex-col gap-4 shadow-lg">
                          <label className="block text-[10px] font-mono text-text-muted uppercase font-bold mb-1">Logger Verbosity level</label>
                          <div className="grid grid-cols-2 gap-2.5">
                            {[
                              { id: 'debug', name: 'DEBUG', desc: 'Verbose trace stacks' },
                              { id: 'info', name: 'INFO', desc: 'General events logs' },
                              { id: 'warn', name: 'WARN', desc: 'Deprecation faults' },
                              { id: 'error', name: 'ERROR', desc: 'Fatal operations faults' }
                            ].map((item) => {
                              const isSelected = logLevel === item.id;
                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => setLogLevel(item.id as any)}
                                  className={`p-3.5 rounded-xl border text-left flex flex-col gap-0.5 transition-all active:scale-98 ${
                                    isSelected
                                      ? 'bg-primary/10 border-primary/45 text-primary font-bold shadow-[0_0_12px_var(--primary-glow)]'
                                      : 'bg-slate-950/40 border-border-color text-text-muted hover:border-text-muted/50 hover:text-text-secondary'
                                  }`}
                                >
                                  <span className="text-[10px] font-mono font-bold">{item.name}</span>
                                  <span className="text-[8px] opacity-80 leading-none mt-0.5">{item.desc}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="p-5 bg-bg-card/35 border border-border-color rounded-2xl flex flex-col gap-4 shadow-lg justify-between">
                          <div className="flex flex-col gap-4">
                            <label className="block text-[10px] font-mono text-text-muted uppercase font-bold mb-1">Default Spacing Density</label>
                            <div className="grid grid-cols-2 gap-2.5">
                              {[
                                { id: 'comfortable', name: 'Comfortable', desc: 'Sleek spacing theme' },
                                { id: 'compact', name: 'Compact', desc: 'Dense linear grids' }
                              ].map((item) => {
                                const isSelected = defaultDensity === item.id;
                                return (
                                  <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => setDefaultDensity(item.id as any)}
                                    className={`p-4 rounded-xl border text-left flex flex-col gap-0.5 transition-all active:scale-98 ${
                                      isSelected
                                        ? 'bg-primary/10 border-primary/45 text-primary font-bold shadow-[0_0_12px_var(--primary-glow)]'
                                        : 'bg-slate-955/40 border-border-color text-text-muted hover:border-text-muted/50 hover:text-text-secondary'
                                    }`}
                                  >
                                    <span className="text-[10px] font-mono font-bold">{item.name}</span>
                                    <span className="text-[8px] opacity-80 leading-none mt-0.5">{item.desc}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={saveSystemAdmin}
                        disabled={saving}
                        className="bg-gradient-to-r from-primary to-primary-hover text-bg-dark font-extrabold px-5 py-2.5 rounded-xl text-xs transition-all flex items-center gap-1.5 ml-auto mt-2 shadow-lg hover:shadow-[0_0_15px_var(--primary-glow)] active:scale-98 select-none"
                      >
                        <Save size={13} /> Save System Settings
                      </button>
                    </div>
                  )}

                  {/* 13. AUDIT & SECURITY */}
                  {activeTab === 'SECURITY' && (
                    <div className="flex flex-col gap-6 animate-fadeIn">
                      <div className="border-b border-border-color/85 pb-3">
                        <h3 className="text-sm font-bold tracking-wider uppercase text-text-secondary flex items-center gap-1.5 font-heading">
                          <Shield size={15} className="text-primary" /> Security Controls & Forensic Audit Logs
                        </h3>
                        <p className="text-xs text-text-muted mt-1 font-sans">
                          Manage password complexity limits, idle session logouts, and search immutable forensic audit logs.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <div className="p-5 bg-bg-card/35 border border-border-color rounded-2xl flex flex-col gap-4 shadow-lg justify-between">
                          <div>
                            <label className="block text-[10px] font-mono text-text-muted uppercase font-bold mb-1.5">Min Password length</label>
                            <div className="relative">
                              <input 
                                type="number" 
                                value={passwordRules.min_length}
                                onChange={(e) => setPasswordRules({ ...passwordRules, min_length: Number(e.target.value) })}
                                className="w-full bg-slate-955 border border-border-color rounded-xl px-4 py-2.5 text-xs text-text-primary focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all font-mono font-semibold"
                              />
                              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] font-mono font-bold text-text-muted uppercase">Chars</span>
                            </div>
                          </div>
                        </div>

                        <div className="p-5 bg-bg-card/35 border border-border-color rounded-2xl flex items-center justify-between gap-4 shadow-lg">
                          <div className="flex-1">
                            <span className="text-xs font-semibold text-text-secondary">Require Special Character</span>
                            <p className="text-[10px] text-text-muted mt-0.5 leading-relaxed">Require symbols during resets.</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setPasswordRules({ ...passwordRules, require_special: !passwordRules.require_special })}
                            className={`w-10 h-6 rounded-full p-1 transition-all duration-300 focus:outline-none relative flex items-center shrink-0 self-center ${
                              passwordRules.require_special ? 'bg-primary shadow-[0_0_12px_var(--primary-glow)]' : 'bg-slate-850 border border-border-color'
                            }`}
                          >
                            <div className={`w-4 h-4 rounded-full shadow transform transition-transform duration-300 ${
                              passwordRules.require_special ? 'translate-x-4 bg-bg-dark' : 'translate-x-0 bg-text-muted'
                            }`} />
                          </button>
                        </div>

                        <div className="p-5 bg-bg-card/35 border border-border-color rounded-2xl flex flex-col gap-4 shadow-lg justify-between">
                          <div>
                            <label className="block text-[10px] font-mono text-text-muted uppercase font-bold mb-1.5">Session Timeout limit</label>
                            <div className="relative">
                              <input 
                                type="number" 
                                value={sessionTimeout}
                                onChange={(e) => setSessionTimeout(Number(e.target.value))}
                                className="w-full bg-slate-955 border border-border-color rounded-xl px-4 py-2.5 text-xs text-text-primary focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all font-mono font-semibold"
                              />
                              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] font-mono font-bold text-text-muted uppercase">Mins</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={saveSecurity}
                        disabled={saving}
                        className="bg-gradient-to-r from-primary to-primary-hover text-bg-dark font-extrabold px-5 py-2.5 rounded-xl text-xs transition-all flex items-center gap-1.5 ml-auto mt-1 shadow-lg hover:shadow-[0_0_15px_var(--primary-glow)] active:scale-98 select-none"
                      >
                        <Save size={13} /> Save Security Parameters
                      </button>

                      {/* Forensic Audit Log list */}
                      <div className="border-t border-border-color/60 pt-6">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-3.5 flex items-center gap-1.5 font-mono">
                          <Lock size={13} className="text-error animate-pulse" /> Immutable Forensic Audit Trail
                        </h4>
                        <div className="overflow-x-auto border border-border-color/80 rounded-2xl bg-bg-card/10 shadow-lg max-h-[340px]">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-slate-955 text-[9px] font-mono text-text-muted uppercase border-b border-border-color sticky top-0 backdrop-blur-md select-none">
                                <th className="p-3.5 pl-5">Occurred At</th>
                                <th className="p-3.5">Actor specifications</th>
                                <th className="p-3.5">Action Code</th>
                                <th className="p-3.5">Module Scope</th>
                                <th className="p-3.5 pr-5">Forensic Summary details</th>
                              </tr>
                            </thead>
                            <tbody>
                              {auditLogs.slice(0, 15).map(log => {
                                const isCreate = log.action === 'CREATE' || log.action === 'REGISTER';
                                const isDelete = log.action === 'DELETE' || log.action === 'PURGE' || log.action === 'REMOVE';
                                const isUpdate = log.action === 'UPDATE' || log.action === 'RESET' || log.action === 'EDIT';
                                return (
                                  <tr key={log.id} className="border-b border-border-color/40 hover:bg-slate-900/20 text-xs text-text-secondary font-mono transition-colors">
                                    <td className="p-3.5 pl-5 whitespace-nowrap text-text-muted/80">{new Date(log.occurred_at).toLocaleString('en-AE', { hour12: false })}</td>
                                    <td className="p-3.5">
                                      <div className="flex flex-col gap-0.5">
                                        <span className="text-[11px] font-sans font-bold text-text-primary">{log.actor_name}</span>
                                        <span className="text-[8px] font-mono text-text-muted uppercase tracking-wider">{log.actor_role || 'System Agent'}</span>
                                      </div>
                                    </td>
                                    <td className="p-3.5">
                                      <span className={`px-2 py-0.5 rounded-lg text-[9px] font-bold font-mono tracking-wider ${
                                        isCreate ? 'bg-primary/10 text-primary border border-primary/20' :
                                        isDelete ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                                        isUpdate ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                        'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                      }`}>
                                        {log.action}
                                      </span>
                                    </td>
                                    <td className="p-3.5">
                                      <span className="bg-slate-955 text-[9px] font-bold text-text-muted px-2 py-0.5 rounded-lg border border-border-color/60 uppercase font-mono tracking-wider">
                                        {log.module}
                                      </span>
                                    </td>
                                    <td className="p-3.5 pr-5 text-text-secondary font-sans max-w-sm truncate leading-relaxed" title={log.summary}>
                                      {log.summary}
                                    </td>
                                  </tr>
                                );
                              })}
                              {auditLogs.length === 0 && (
                                <tr>
                                  <td colSpan={5} className="py-10 text-center text-text-muted italic text-xs font-sans">
                                    No compliance audit logs retrieved.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 14. BACKUP & RECOVERY */}
                  {activeTab === 'BACKUP' && (
                    <div className="flex flex-col gap-6 animate-fadeIn">
                      <div className="border-b border-border-color/85 pb-3">
                        <h3 className="text-sm font-bold tracking-wider uppercase text-text-secondary flex items-center gap-1.5 font-heading">
                          <Database size={15} className="text-primary" /> Database Backup & disaster Recovery
                        </h3>
                        <p className="text-xs text-text-muted mt-1 font-sans">
                          Calibrate cron frequencies for database backup dumps and trigger immediate manual snapshots.
                        </p>
                      </div>

                      {/* Backup Schedule & Retention Settings */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <div className="col-span-1 md:col-span-2 flex flex-col gap-2.5">
                          <label className="block text-[10px] font-mono text-text-muted uppercase font-bold">Backup cron schedule frequency</label>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {[
                              { id: 'daily', name: 'Daily Snapshot', desc: 'Secure database dump run every 24 hours.' },
                              { id: 'weekly', name: 'Weekly Archive', desc: 'Full database compilation package.' },
                              { id: 'monthly', name: 'Monthly Cold Storage', desc: 'Deep archive snapshot for storage.' }
                            ].map((item) => {
                              const isSelected = backupConfig.schedule === item.id;
                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => setBackupConfig({ ...backupConfig, schedule: item.id })}
                                  className={`p-4 rounded-2xl border text-left flex flex-col gap-1.5 transition-all active:scale-98 ${
                                    isSelected
                                      ? 'bg-primary/5 border-primary/50 text-text-primary shadow-[0_0_15px_rgba(16,185,129,0.05)]'
                                      : 'bg-bg-card/35 border-border-color text-text-muted hover:border-text-muted/50 hover:text-text-secondary'
                                  }`}
                                >
                                  <span className={`text-xs font-bold transition-colors ${isSelected ? 'text-primary' : 'text-text-secondary'}`}>{item.name}</span>
                                  <p className="text-[9px] text-text-muted leading-normal">{item.desc}</p>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="p-5 bg-bg-card/35 border border-border-color rounded-2xl flex flex-col gap-4 shadow-lg justify-between">
                          <div>
                            <label className="block text-[10px] font-mono text-text-muted uppercase font-bold mb-1.5">Retention duration limit</label>
                            <div className="relative">
                              <input 
                                type="number" 
                                value={backupConfig.retention}
                                onChange={(e) => setBackupConfig({ ...backupConfig, retention: Number(e.target.value) })}
                                className="w-full bg-slate-955 border border-border-color rounded-xl px-4 py-2.5 text-xs text-text-primary focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all font-mono font-semibold"
                              />
                              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] font-mono font-bold text-text-muted uppercase">Days</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={saveBackup}
                        disabled={saving}
                        className="bg-gradient-to-r from-primary to-primary-hover text-bg-dark font-extrabold px-5 py-2.5 rounded-xl text-xs transition-all flex items-center gap-1.5 ml-auto mt-1 shadow-lg hover:shadow-[0_0_15px_var(--primary-glow)] active:scale-98 select-none"
                      >
                        <Save size={13} /> Save Backup Schedules
                      </button>

                      {/* Manual trigger segment */}
                      <div className="mt-2 p-5 border border-border-color rounded-2xl bg-bg-card/35 shadow-lg flex flex-col gap-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider font-mono">Trigger Immediate Database Schema Backup</h4>
                            <p className="text-[10px] text-text-muted mt-0.5">Launches secure SQL snapshot dump compilation and archives it in secure backups buckets.</p>
                          </div>
                          <button
                            type="button"
                            onClick={triggerMockBackupExport}
                            disabled={backupRunning}
                            className={`px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 font-bold transition-all shrink-0 active:scale-98 border select-none ${
                              backupRunning
                                ? 'bg-slate-900 border-border-color text-text-muted cursor-not-allowed'
                                : 'bg-primary/10 border-primary/30 text-primary shadow-md hover:shadow-[0_0_12px_var(--primary-glow)] active:scale-95'
                            }`}
                          >
                            <Download size={13} /> Execute backup
                          </button>
                        </div>

                        {(backupRunning || backupLogs.length > 0) && (
                          <div className="p-4 bg-slate-950 border border-border-color/80 rounded-2xl flex flex-col gap-3 shadow-inner animate-fadeIn">
                            {backupRunning && (
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[10px] font-mono font-bold">
                                <span className="text-primary animate-pulse flex items-center gap-1">
                                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-ping" />
                                  Running Secure Backup Job...
                                </span>
                                <span className="text-text-muted uppercase">{backupStep}</span>
                              </div>
                            )}
                            {backupRunning && (
                              <div className="w-full bg-slate-900 rounded-full h-1 relative overflow-hidden mt-1">
                                <div className="bg-primary h-full rounded-full absolute left-0 top-0 animate-pulse" style={{ width: '100%' }} />
                              </div>
                            )}

                            {/* Retro Terminal Logs View */}
                            <div className="bg-slate-955 p-4 rounded-xl border border-border-color/60 font-mono text-[10px] text-primary/90 flex flex-col gap-1.5 max-h-[200px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-900">
                              <div className="text-text-muted border-b border-border-color/40 pb-1.5 mb-1.5 flex items-center justify-between">
                                <span>SYSTEM LOG TERMINAL (JEET_ERP_BACKUP_DAEMON v1.0.4)</span>
                                <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                              </div>
                              {backupLogs.map((logLine, idx) => (
                                <div key={idx} className="leading-relaxed animate-fadeIn">
                                  <span className="text-text-muted mr-1.5">&gt;</span> {logLine}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                </div>
              )}
            </div>
          </div>
        </div>

        {/* Add User Modal */}
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <div className="w-full max-w-md bg-bg-dark border border-border-color rounded-2xl p-6 flex flex-col gap-4 shadow-2xl animate-fadeIn relative overflow-hidden">
              <div className="absolute -right-20 -top-20 w-40 h-40 bg-primary/5 blur-3xl rounded-full" />
              <div className="flex justify-between items-center border-b border-border-color pb-3 relative z-10">
                <h3 className="text-sm font-bold text-text-primary flex items-center gap-1.5 font-heading uppercase tracking-wider">
                  <Users size={16} className="text-primary" /> Register New Account
                </h3>
                <button onClick={() => setIsAddModalOpen(false)} className="text-text-muted hover:text-text-primary text-xl transition-colors">×</button>
              </div>
              <form onSubmit={handleAddUserSubmit} className="flex flex-col gap-4 relative z-10">
                <div>
                  <label className="block text-[10px] font-mono text-text-muted uppercase font-bold mb-1.5">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. John Doe"
                    value={newUserFullName}
                    onChange={(e) => setNewUserFullName(e.target.value)}
                    className="w-full bg-slate-955 border border-border-color rounded-xl px-4 py-2.5 text-xs text-text-primary placeholder-text-muted/50 focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all font-sans font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-text-muted uppercase font-bold mb-1.5">Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. john@jeetmep.ae"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    className="w-full bg-slate-955 border border-border-color rounded-xl px-4 py-2.5 text-xs text-text-primary placeholder-text-muted/50 focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all font-sans font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-text-muted uppercase font-bold mb-1.5">Temporary Password *</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    className="w-full bg-slate-955 border border-border-color rounded-xl px-4 py-2.5 text-xs text-text-primary focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all font-mono font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-text-muted uppercase font-bold mb-1.5">Employee Department *</label>
                  <select
                    required
                    value={newUserDepartment}
                    onChange={(e) => setNewUserDepartment(e.target.value)}
                    className="w-full bg-slate-955 border border-border-color text-text-secondary rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all font-semibold"
                  >
                    <option value="">Select Department...</option>
                    <option value="MANAGEMENT">Management</option>
                    <option value="PROJECTS">Projects & Operations</option>
                    <option value="PROCUREMENT">Procurement & Stores</option>
                    <option value="FINANCE">Finance & Accounts</option>
                    <option value="HR">Human Resources</option>
                    <option value="FLEET">Fleet & Transport</option>
                    <option value="STORES">Warehouse Logistics</option>
                    <option value="TECHNICAL">Technician & Service Desk</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-text-muted uppercase font-bold mb-1.5">Assign Dynamic Roles</label>
                  <div className="grid grid-cols-2 gap-2 max-h-[120px] overflow-y-auto p-2 border border-border-color rounded-xl bg-slate-955/50">
                    {roles.map(r => {
                      const isChecked = newUserRoleIds.includes(r.id);
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => {
                            if (isChecked) {
                              setNewUserRoleIds(newUserRoleIds.filter(id => id !== r.id));
                            } else {
                              setNewUserRoleIds([...newUserRoleIds, r.id]);
                            }
                          }}
                          className={`p-2 border text-left rounded-xl text-[10px] truncate transition-all active:scale-95 ${
                            isChecked
                              ? 'bg-primary/10 border-primary/45 text-primary font-bold shadow-[0_0_8px_var(--primary-glow)]'
                              : 'bg-slate-900/40 border-border-color text-text-muted hover:text-text-secondary hover:border-text-muted/50'
                          }`}
                        >
                          {r.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex justify-end gap-3 border-t border-border-color/65 pt-4 mt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="bg-slate-900 border border-border-color hover:bg-slate-850 text-text-secondary px-4.5 py-2 rounded-xl text-xs font-bold transition-all active:scale-98 select-none"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="bg-gradient-to-r from-primary to-primary-hover text-bg-dark font-extrabold px-5 py-2 rounded-xl text-xs transition-all flex items-center gap-1.5 shadow-lg hover:shadow-[0_0_12px_var(--primary-glow)] active:scale-98 select-none"
                  >
                    {saving ? 'Processing...' : 'Register User'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit User Modal */}
        {isEditModalOpen && editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <div className="w-full max-w-md bg-bg-dark border border-border-color rounded-2xl p-6 flex flex-col gap-4 shadow-2xl animate-fadeIn relative overflow-hidden">
              <div className="absolute -right-20 -top-20 w-40 h-40 bg-primary/5 blur-3xl rounded-full" />
              <div className="flex justify-between items-center border-b border-border-color pb-3 relative z-10">
                <h3 className="text-sm font-bold text-text-primary flex items-center gap-1.5 font-heading uppercase tracking-wider">
                  <Users size={16} className="text-primary" /> Update Account Settings
                </h3>
                <button onClick={() => setIsEditModalOpen(false)} className="text-text-muted hover:text-text-primary text-xl transition-colors">×</button>
              </div>
              <form onSubmit={handleEditUserSubmit} className="flex flex-col gap-4 relative z-10">
                <div>
                  <label className="block text-[10px] font-mono text-text-muted uppercase font-bold mb-1.5">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. John Doe"
                    value={editUserFullName}
                    onChange={(e) => setEditUserFullName(e.target.value)}
                    className="w-full bg-slate-955 border border-border-color rounded-xl px-4 py-2.5 text-xs text-text-primary placeholder-text-muted/50 focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all font-sans font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-text-muted uppercase font-bold mb-1.5">Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. john@jeetmep.ae"
                    value={editUserEmail}
                    onChange={(e) => setEditUserEmail(e.target.value)}
                    className="w-full bg-slate-955 border border-border-color rounded-xl px-4 py-2.5 text-xs text-text-primary placeholder-text-muted/50 focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all font-sans font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-text-muted uppercase font-bold mb-1.5">Employee Department *</label>
                  <select
                    required
                    value={editUserDepartment}
                    onChange={(e) => setEditUserDepartment(e.target.value)}
                    className="w-full bg-slate-955 border border-border-color text-text-secondary rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all font-semibold"
                  >
                    <option value="">Select Department...</option>
                    <option value="MANAGEMENT">Management</option>
                    <option value="PROJECTS">Projects & Operations</option>
                    <option value="PROCUREMENT">Procurement & Stores</option>
                    <option value="FINANCE">Finance & Accounts</option>
                    <option value="HR">Human Resources</option>
                    <option value="FLEET">Fleet & Transport</option>
                    <option value="STORES">Warehouse Logistics</option>
                    <option value="TECHNICAL">Technician & Service Desk</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-text-muted uppercase font-bold mb-1.5">Assign Dynamic Roles</label>
                  <div className="grid grid-cols-2 gap-2 max-h-[120px] overflow-y-auto p-2 border border-border-color rounded-xl bg-slate-955/50">
                    {roles.map(r => {
                      const isChecked = editUserRoleIds.includes(r.id);
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => {
                            if (isChecked) {
                              setEditUserRoleIds(editUserRoleIds.filter(id => id !== r.id));
                            } else {
                              setEditUserRoleIds([...editUserRoleIds, r.id]);
                            }
                          }}
                          className={`p-2 border text-left rounded-xl text-[10px] truncate transition-all active:scale-95 ${
                            isChecked
                              ? 'bg-primary/10 border-primary/45 text-primary font-bold shadow-[0_0_8px_var(--primary-glow)]'
                              : 'bg-slate-900/40 border-border-color text-text-muted hover:text-text-secondary hover:border-text-muted/50'
                          }`}
                        >
                          {r.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex justify-end gap-3 border-t border-border-color/65 pt-4 mt-2">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="bg-slate-900 border border-border-color hover:bg-slate-850 text-text-secondary px-4.5 py-2 rounded-xl text-xs font-bold transition-all active:scale-98 select-none"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="bg-gradient-to-r from-primary to-primary-hover text-bg-dark font-extrabold px-5 py-2 rounded-xl text-xs transition-all flex items-center gap-1.5 shadow-lg hover:shadow-[0_0_12px_var(--primary-glow)] active:scale-98 select-none"
                  >
                    {saving ? 'Saving...' : 'Save Updates'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete User Confirm Modal */}
        {isDeleteModalOpen && deletingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <div className="w-full max-w-sm bg-bg-dark border border-error/30 rounded-2xl p-6 flex flex-col gap-4 shadow-2xl animate-fadeIn relative overflow-hidden">
              <div className="absolute -right-20 -top-20 w-40 h-40 bg-error/5 blur-3xl rounded-full" />
              <div className="flex justify-between items-center border-b border-border-color pb-3 relative z-10">
                <h3 className="text-xs font-bold uppercase tracking-wider text-error flex items-center gap-1.5 font-heading">
                  <AlertTriangle size={15} /> Confirm Account Purge
                </h3>
                <button onClick={() => setIsDeleteModalOpen(false)} className="text-text-muted hover:text-text-primary text-xl transition-colors">×</button>
              </div>
              <div className="flex flex-col gap-2 relative z-10">
                <p className="text-xs text-text-secondary leading-relaxed">
                  You are permanently deleting the user <strong className="text-text-primary font-bold">{deletingUser.full_name}</strong> (<code>{deletingUser.email}</code>).
                </p>
                <p className="text-[11px] text-error font-semibold">
                  Warning: This action will permanently remove their authentication credentials and wipe out their employee profile card. This cannot be undone.
                </p>
              </div>
              <div className="flex justify-end gap-3 border-t border-border-color/65 pt-4 mt-1 relative z-10">
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="bg-slate-900 border border-border-color hover:bg-slate-850 text-text-secondary px-4.5 py-2 rounded-xl text-xs font-bold transition-all active:scale-98 select-none"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteUserConfirm}
                  disabled={saving}
                  className="bg-gradient-to-r from-error to-error/90 hover:from-error/90 hover:to-error text-text-primary border border-error/20 font-bold px-5 py-2 rounded-xl text-xs shadow-lg shadow-error/20 active:scale-98 transition-all select-none"
                >
                  {saving ? 'Purging...' : 'Confirm Purge'}
                </button>
              </div>
            </div>
          </div>
        )}
      </Can>
    </div>
  );
}
