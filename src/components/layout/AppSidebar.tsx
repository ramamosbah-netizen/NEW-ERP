// ============================================================
// JEET ERP — Collapsible Sidebar Navigation
// All 26+ modules organized into grouped sections
// ============================================================

'use client';

import React, { useState, useEffect } from 'react';
import settingsService from '@/services/settingsService';
import { usePermissions } from '@/lib/permissions/usePermissions';
import { isRouteAllowed } from '@/lib/permissions/routeAccess';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Layers,
  LayoutDashboard,
  Sun,
  CheckSquare,
  Calendar,
  Bell,
  Briefcase,
  FileText,
  FolderKanban,
  GitCompare,
  ShoppingCart,
  Package,
  PackageX,
  ScanLine,
  HardHat,
  Truck,
  Wrench,
  Shield,
  CalendarClock,
  Ticket,
  Gauge,
  RefreshCw,
  Cpu,
  History,
  Car,
  Calculator,
  Users,
  Wallet,
  Clock,
  TrendingUp,
  FileSignature,
  Landmark,
  Sparkles,
  ListTree,
  GanttChartSquare,
  SlidersHorizontal,
  ArrowUpRight,
  ArrowDownLeft,
  Percent,
  BarChart3,
  MessageSquare,
  Settings,
  ClipboardList,
  AlertTriangle,
  ChevronsLeft,
  ChevronsRight,
  ChevronRight,
  Camera,
  ClipboardCheck,
  PackageCheck,
  DollarSign,
  Scale,
  Mail,
  Handshake
} from 'lucide-react';

// Navigation structure: grouped sections
const NAV_SECTIONS = [
  {
    id: 'core',
    label: 'Core',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/myday', label: 'My Day', icon: Sun },
      { href: '/tasks', label: 'Tasks', icon: CheckSquare },
      { href: '/meetings', label: 'Meetings', icon: Calendar },
      { href: '/notifications', label: 'Alerts & Logs', icon: Bell },
    ],
  },
  {
    id: 'sales',
    label: 'Sales & Projects',
    items: [
      { href: '/sales/dashboard', label: 'Pre-Sales Dashboard', icon: LayoutDashboard },
      { href: '/tenders', label: 'Tenders', icon: Briefcase },
      { href: '/sales/pipeline', label: 'Sales Pipeline', icon: Briefcase },
      { href: '/quotations', label: 'Quotations', icon: FileText },
      { href: '/projects', label: 'Projects', icon: FolderKanban },
      { href: '/projects/controls', label: 'Project Controls', icon: SlidersHorizontal },
      { href: '/projects/daily-reports', label: 'Daily Site Reports', icon: ClipboardList },
      { href: '/projects/wbs', label: 'WBS', icon: ListTree },
      { href: '/projects/schedule', label: 'Schedule (Gantt)', icon: GanttChartSquare },
      { href: '/projects/evm', label: 'Progress & EVM', icon: TrendingUp },
      { href: '/projects/resources', label: 'Resource Planning', icon: Users },
      { href: '/projects/risks', label: 'Risk Register', icon: AlertTriangle },
      { href: '/projects/dashboard', label: 'Executive Dashboard', icon: LayoutDashboard },
      { href: '/vo', label: 'Variation Orders', icon: GitCompare },
      { href: '/snags', label: 'Snag List', icon: Camera },
      { href: '/projects/snag-analytics', label: 'Snag Analytics & QA', icon: BarChart3 },
      { href: '/tc', label: 'Testing & Comm.', icon: ClipboardCheck },
      { href: '/handover', label: 'Handover', icon: Handshake },
      { href: '/projects/dlp', label: 'DLP & Warranty', icon: Shield },
      { href: '/projects/site-records', label: 'RFI / SI / NCR', icon: MessageSquare },
    ],
  },
  {
    id: 'procurement',
    label: 'Procurement',
    items: [
      { href: '/procurement/pr', label: 'Purchase Requests', icon: ClipboardList },
      { href: '/procurement/rfq', label: 'Quotation Requests', icon: Mail },
      { href: '/procurement/comparisons', label: 'Comparisons', icon: Scale },
      { href: '/procurement/po', label: 'Purchase Orders', icon: ShoppingCart },
      { href: '/procurement/grn', label: 'Goods Receipt', icon: PackageCheck },
    ],
  },
  {
    id: 'warehouse',
    label: 'Warehouse & Inventory',
    items: [
      { href: '/warehouse/dashboard', label: 'Inventory Dashboard', icon: LayoutDashboard },
      { href: '/warehouse/suppliers', label: 'Suppliers & Subcon', icon: Users },
      { href: '/warehouse/store', label: 'Store', icon: Package },
      { href: '/warehouse/movements', label: 'Goods Movements', icon: Truck },
      { href: '/warehouse/mrf', label: 'Requisitions (MRF)', icon: ClipboardList },
      { href: '/warehouse/stock-count', label: 'Stock Count', icon: ClipboardCheck },
      { href: '/warehouse/replenishment', label: 'Replenishment', icon: ShoppingCart },
      { href: '/warehouse/aging', label: 'Inventory Aging', icon: Clock },
      { href: '/warehouse/dead-stock', label: 'Dead Stock', icon: PackageX },
      { href: '/warehouse/serials', label: 'Serial Tracking', icon: ScanLine },
      { href: '/warehouse/installed', label: 'Installed Assets', icon: HardHat },
      { href: '/warehouse/forecast', label: 'Material Forecasting', icon: TrendingUp },
      { href: '/warehouse/gl', label: 'GL Integration', icon: Landmark },
      { href: '/pricing', label: 'Pricing Catalog', icon: Calculator },
    ],
  },
  {
    id: 'fieldops',
    label: 'Field Operations',
    items: [
      { href: '/service/dashboard', label: 'Service Dashboard', icon: LayoutDashboard },
      { href: '/service-desk', label: 'Service Desk', icon: Ticket },
      { href: '/service/sla', label: 'SLA Analytics', icon: Gauge },
      { href: '/service/technicians', label: 'Technicians', icon: Users },
      { href: '/service/parts', label: 'Spare Parts', icon: Wrench },
      { href: '/service/history', label: 'Service History', icon: History },
      { href: '/ppm/calendar', label: 'PPM Schedule', icon: CalendarClock },
      { href: '/service/ppm-compliance', label: 'PPM Compliance', icon: CalendarClock },
      { href: '/amc', label: 'AMC Contracts', icon: Shield },
      { href: '/amc/pipeline', label: 'Renewals Pipeline', icon: RefreshCw },
      { href: '/amc/profitability', label: 'Contract Profitability', icon: TrendingUp },
      { href: '/amc/equipment', label: 'Equipment Register', icon: Cpu },
      { href: '/amc/billing', label: 'Billing & Revenue', icon: DollarSign },
      { href: '/technician', label: 'Technician Hub', icon: Wrench },
    ],
  },
  {
    id: 'fleet',
    label: 'Fleet & Assets',
    items: [
      { href: '/fleet', label: 'Fleet Registry', icon: Car },
      { href: '/assets', label: 'Fixed Assets', icon: Calculator },
    ],
  },
  {
    id: 'hr',
    label: 'HR & Payroll',
    items: [
      { href: '/hr', label: 'Employees', icon: Users },
      { href: '/payroll', label: 'Payroll', icon: Wallet },
      { href: '/timesheets', label: 'Timesheets', icon: Clock },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    items: [
      { href: '/finance', label: 'Finance Hub', icon: DollarSign },
      { href: '/finance/ar', label: 'Receivables (AR)', icon: ArrowUpRight },
      { href: '/finance/ap', label: 'Payables (AP)', icon: ArrowDownLeft },
      { href: '/finance/budget', label: 'Budget & Cost', icon: Calculator },
      { href: '/finance/commitments', label: 'Commitments', icon: FileSignature },
      { href: '/finance/project-profitability', label: 'Project Profitability', icon: TrendingUp },
      { href: '/finance/cashflow', label: 'Cash Flow', icon: TrendingUp },
      { href: '/finance/project-cashflow', label: 'Project Cash Flow', icon: TrendingUp },
      { href: '/finance/retentions', label: 'Retentions', icon: Shield },
      { href: '/finance/petty-cash', label: 'Petty Cash', icon: Wallet },
      { href: '/finance/bank-reconciliation', label: 'Bank Reconciliation', icon: Landmark },
      { href: '/finance/treasury', label: 'Treasury', icon: Landmark },
      { href: '/assets', label: 'Fixed Assets', icon: Package },
      { href: '/finance/reports', label: 'Financial Reports', icon: BarChart3 },
      { href: '/finance/grn-expense', label: 'GRN-to-Expense', icon: PackageCheck },
      { href: '/finance/ai', label: 'AI Finance Agent', icon: Sparkles },
      { href: '/finance/vat', label: 'VAT Compliance', icon: Percent },
    ],
  },
  {
    id: 'docs',
    label: 'Documents',
    items: [
      { href: '/documents', label: 'Document Center', icon: ClipboardList },
      { href: '/reports', label: 'Reports', icon: BarChart3 },
    ],
  },
  {
    id: 'comms',
    label: 'Communications',
    items: [
      { href: '/whatsapp', label: 'WhatsApp', icon: MessageSquare },
    ],
  },
  {
    id: 'admin',
    label: 'Administration',
    items: [
      { href: '/admin', label: 'Admin Center', icon: Layers },
      { href: '/admin/workflows', label: 'Workflows', icon: GitCompare },
      { href: '/admin/settings', label: 'Settings', icon: Settings },
      { href: '/admin/audit', label: 'Audit Log', icon: AlertTriangle },
    ],
  },
];

const STORAGE_KEY = 'erp-sidebar-collapsed';
const SECTIONS_KEY = 'erp-sidebar-sections';

interface AppSidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function AppSidebar({ mobileOpen = false, onMobileClose }: AppSidebarProps) {
  const pathname = usePathname();
  const { role } = usePermissions();
  const [collapsed, setCollapsed] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    // All sections open by default
    const defaults: Record<string, boolean> = {};
    NAV_SECTIONS.forEach(s => { defaults[s.id] = true; });
    return defaults;
  });
  const [enabledModules, setEnabledModules] = useState<Record<string, boolean>>({});

  // Load persisted state
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved !== null) setCollapsed(JSON.parse(saved));

      const savedSections = localStorage.getItem(SECTIONS_KEY);
      if (savedSections) setOpenSections(JSON.parse(savedSections));
    } catch {
      // Ignore
    }
  }, []);

  // Load enabled modules and listen to events
  useEffect(() => {
    const loadModules = async () => {
      // 1. Quick initial cache load
      try {
        const savedModules = localStorage.getItem('erp-enabled-modules');
        if (savedModules) {
          setEnabledModules(JSON.parse(savedModules));
        }
      } catch {
        // Ignore
      }

      // 2. Fresh query from settings database
      try {
        const globalModules = await settingsService.getSettingByKey<Record<string, boolean>>('system.enabled_modules', {});
        setEnabledModules(globalModules);
        localStorage.setItem('erp-enabled-modules', JSON.stringify(globalModules));
      } catch (err) {
        console.error('Failed to fetch global modules config:', err);
      }
    };
    
    loadModules();
    
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'erp-enabled-modules') {
        loadModules();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('erp-modules-updated', loadModules);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('erp-modules-updated', loadModules);
    };
  }, []);

  // Filter navigation sections based on enabled modules
  const visibleSections = NAV_SECTIONS.map(section => {
    const visibleItems = section.items.filter(item =>
      enabledModules[item.href] !== false && isRouteAllowed(role, item.href));
    return { ...section, items: visibleItems };
  }).filter(section => section.items.length > 0);

  // Persist collapsed state
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(collapsed));
    } catch {
      // Ignore
    }
  }, [collapsed]);

  // Persist section open state
  useEffect(() => {
    try {
      localStorage.setItem(SECTIONS_KEY, JSON.stringify(openSections));
    } catch {
      // Ignore
    }
  }, [openSections]);

  const toggleSection = (id: string) => {
    if (collapsed) return; // Don't toggle sections when collapsed
    setOpenSections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    // For finance sub-routes: /finance should only match exact
    if (href === '/finance') return pathname === '/finance';
    // Admin hub should only match exact (sub-pages have their own links)
    if (href === '/admin') return pathname === '/admin';
    return pathname === href || (pathname?.startsWith(href + '/') ?? false);
  };

  // Close mobile sidebar when navigating
  useEffect(() => {
    onMobileClose?.();
  }, [pathname, onMobileClose]);

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div 
          className="sidebar-overlay visible" 
          onClick={onMobileClose} 
        />
      )}

      <aside 
        className={`erp-sidebar ${collapsed ? 'collapsed' : 'expanded'} ${mobileOpen ? 'mobile-open' : ''}`}
        id="erp-sidebar"
      >
        {/* Brand */}
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">
            <Layers size={18} />
          </div>
          <div className="sidebar-brand-text">
            <span className="sidebar-brand-name">JEET ERP</span>
            <span className="sidebar-brand-sub">Platform v2.0</span>
          </div>
        </div>

        {/* Nav Sections */}
        <nav className="sidebar-nav">
          {visibleSections.map((section, sIdx) => (
            <div key={section.id} className="sidebar-section">
              {/* Section Header */}
              {!collapsed && (
                <div 
                  className="sidebar-section-header" 
                  onClick={() => toggleSection(section.id)}
                >
                  <span className="sidebar-section-label">{section.label}</span>
                  <ChevronRight 
                    size={12} 
                    className={`sidebar-section-chevron ${openSections[section.id] ? 'open' : ''}`} 
                  />
                </div>
              )}

              {/* Collapsed: show divider between groups */}
              {collapsed && sIdx > 0 && <div className="sidebar-divider" />}

              {/* Section Items */}
              <div className={`sidebar-section-items ${collapsed || openSections[section.id] ? 'open' : 'closed'}`}>
                {section.items.map(item => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`sidebar-item ${active ? 'active' : ''}`}
                      data-tooltip={item.label}
                      id={`nav-${item.href.replace(/\//g, '-').replace(/^-/, '')}`}
                    >
                      <span className="sidebar-item-icon">
                        <Icon size={16} />
                      </span>
                      <span className="sidebar-item-label">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Collapse Toggle */}
        <button 
          className="sidebar-toggle" 
          onClick={() => setCollapsed(prev => !prev)}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          id="sidebar-toggle"
        >
          {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
        </button>
      </aside>
    </>
  );
}

// Export mobile toggle function for topbar
export { NAV_SECTIONS };
