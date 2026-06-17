// ============================================================
// JEET ERP — Hub navigation model (single source of truth)
// The sidebar shows only these top-level business hubs; each hub's
// sub-pages are exposed as header tabs (see HubHeader). Routes are
// unchanged — this is purely a navigation re-organisation over the
// existing pages, so every deep link keeps working.
// ============================================================

import {
  LayoutDashboard, Briefcase, FolderKanban, ShoppingCart, Package,
  Truck, Wrench, Users, DollarSign, MessageSquare, Settings,
  type LucideIcon,
} from 'lucide-react';

export interface HubTab {
  label: string;
  href: string;
}

export interface Hub {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Landing route the sidebar entry points to. */
  href: string;
  /** Path prefixes that belong to this hub (for active detection). */
  match: string[];
  tabs: HubTab[];
}

export const HUBS: Hub[] = [
  {
    id: 'home', label: 'Home', icon: LayoutDashboard, href: '/dashboard',
    match: ['/dashboard', '/myday', '/tasks', '/workspace', '/meetings', '/notifications'],
    tabs: [
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'My Day', href: '/myday' },
      { label: 'Tasks', href: '/tasks' },
      { label: 'Approvals', href: '/workspace/approvals' },
      { label: 'Calendar', href: '/workspace/calendar' },
      { label: 'Activity', href: '/workspace/activity' },
      { label: 'Alerts', href: '/notifications' },
    ],
  },
  {
    id: 'sales', label: 'Sales', icon: Briefcase, href: '/sales',
    match: ['/sales', '/tenders', '/quotations'],
    tabs: [
      { label: 'Overview', href: '/sales' },
      { label: 'Dashboard', href: '/sales/dashboard' },
      { label: 'Tenders', href: '/tenders' },
      { label: 'Pipeline', href: '/sales/pipeline' },
      { label: 'Quotations', href: '/quotations' },
      { label: 'Quote Analytics', href: '/sales/quotations' },
      { label: 'Win / Loss', href: '/sales/win-loss' },
      { label: 'Margin', href: '/sales/margin' },
      { label: 'Clients', href: '/sales/clients' },
      { label: 'Deadlines', href: '/sales/deadlines' },
      { label: 'Follow-ups', href: '/sales/follow-ups' },
      { label: 'Performance', href: '/sales/performance' },
      { label: 'Competitors', href: '/sales/competitors' },
    ],
  },
  {
    id: 'projects', label: 'Projects', icon: FolderKanban, href: '/projects',
    match: ['/projects', '/vo', '/snags', '/tc', '/handover'],
    tabs: [
      { label: 'Projects', href: '/projects' },
      { label: 'Controls', href: '/projects/controls' },
      { label: 'Daily Reports', href: '/projects/daily-reports' },
      { label: 'WBS', href: '/projects/wbs' },
      { label: 'Schedule', href: '/projects/schedule' },
      { label: 'Progress & EVM', href: '/projects/evm' },
      { label: 'Resources', href: '/projects/resources' },
      { label: 'Risks', href: '/projects/risks' },
      { label: 'Dashboard', href: '/projects/dashboard' },
      { label: 'Variations', href: '/vo' },
      { label: 'Snags', href: '/snags' },
      { label: 'Snag QA', href: '/projects/snag-analytics' },
      { label: 'Testing & Comm.', href: '/tc' },
      { label: 'Handover', href: '/handover' },
      { label: 'DLP', href: '/projects/dlp' },
      { label: 'Site Records', href: '/projects/site-records' },
    ],
  },
  {
    id: 'procurement', label: 'Procurement', icon: ShoppingCart, href: '/procurement',
    match: ['/procurement'],
    tabs: [
      { label: 'Overview', href: '/procurement' },
      { label: 'Dashboard', href: '/procurement/dashboard' },
      { label: 'Requests', href: '/procurement/pr' },
      { label: 'RFQ', href: '/procurement/rfq' },
      { label: 'Comparisons', href: '/procurement/comparisons' },
      { label: 'Orders', href: '/procurement/po' },
      { label: 'Goods Receipt', href: '/procurement/grn' },
      { label: 'Spend', href: '/procurement/spend' },
      { label: 'Suppliers', href: '/procurement/suppliers' },
      { label: 'Deliveries', href: '/procurement/deliveries' },
      { label: 'PR Pipeline', href: '/procurement/pr-pipeline' },
      { label: '3-Way Match', href: '/procurement/match' },
      { label: 'GRN Analytics', href: '/procurement/grn-analytics' },
      { label: 'Savings', href: '/procurement/savings' },
      { label: 'Payables', href: '/procurement/payables' },
    ],
  },
  {
    id: 'inventory', label: 'Inventory', icon: Package, href: '/warehouse/dashboard',
    match: ['/warehouse', '/pricing'],
    tabs: [
      { label: 'Dashboard', href: '/warehouse/dashboard' },
      { label: 'Store', href: '/warehouse/store' },
      { label: 'Movements', href: '/warehouse/movements' },
      { label: 'Requisitions', href: '/warehouse/mrf' },
      { label: 'Stock Count', href: '/warehouse/stock-count' },
      { label: 'Replenishment', href: '/warehouse/replenishment' },
      { label: 'Aging', href: '/warehouse/aging' },
      { label: 'Dead Stock', href: '/warehouse/dead-stock' },
      { label: 'Serials', href: '/warehouse/serials' },
      { label: 'Installed Assets', href: '/warehouse/installed' },
      { label: 'Forecast', href: '/warehouse/forecast' },
      { label: 'GL Integration', href: '/warehouse/gl' },
      { label: 'Suppliers', href: '/warehouse/suppliers' },
      { label: 'Pricing Catalog', href: '/pricing' },
    ],
  },
  {
    id: 'fleet', label: 'Fleet & Assets', icon: Truck, href: '/fleet/hub',
    match: ['/fleet', '/assets', '/tools'],
    tabs: [
      { label: 'Hub', href: '/fleet/hub' },
      { label: 'Registry', href: '/fleet' },
      { label: 'Dashboard', href: '/fleet/dashboard' },
      { label: 'Compliance', href: '/fleet/compliance' },
      { label: 'Fuel', href: '/fleet/fuel-analytics' },
      { label: 'Fines', href: '/fleet/fines-analytics' },
      { label: 'Maintenance', href: '/fleet/maintenance' },
      { label: 'Cost of Ownership', href: '/fleet/tco' },
      { label: 'Fixed Assets', href: '/assets' },
      { label: 'Asset Dashboard', href: '/assets/dashboard' },
      { label: 'Depreciation', href: '/assets/depreciation-forecast' },
      { label: 'Disposals', href: '/assets/disposals' },
      { label: 'Tools', href: '/tools' },
      { label: 'Calibration', href: '/tools/calibration' },
    ],
  },
  {
    id: 'service', label: 'Service', icon: Wrench, href: '/service/dashboard',
    match: ['/service', '/service-desk', '/ppm', '/amc', '/technician'],
    tabs: [
      { label: 'Dashboard', href: '/service/dashboard' },
      { label: 'Service Desk', href: '/service-desk' },
      { label: 'SLA', href: '/service/sla' },
      { label: 'Technicians', href: '/service/technicians' },
      { label: 'Spare Parts', href: '/service/parts' },
      { label: 'History', href: '/service/history' },
      { label: 'PPM Schedule', href: '/ppm/calendar' },
      { label: 'PPM Compliance', href: '/service/ppm-compliance' },
      { label: 'AMC Contracts', href: '/amc' },
      { label: 'Renewals', href: '/amc/pipeline' },
      { label: 'Profitability', href: '/amc/profitability' },
      { label: 'Equipment', href: '/amc/equipment' },
      { label: 'Billing', href: '/amc/billing' },
      { label: 'Technician Hub', href: '/technician' },
    ],
  },
  {
    id: 'hr', label: 'HR & Payroll', icon: Users, href: '/hr/hub',
    match: ['/hr', '/payroll', '/timesheets'],
    tabs: [
      { label: 'Hub', href: '/hr/hub' },
      { label: 'Dashboard', href: '/hr/dashboard' },
      { label: 'Employees', href: '/hr' },
      { label: 'Doc Compliance', href: '/hr/compliance-tracker' },
      { label: 'Workforce', href: '/hr/workforce' },
      { label: 'Leave', href: '/hr/leave-analytics' },
      { label: 'Labour Cost', href: '/hr/labour-cost' },
      { label: 'Manpower', href: '/hr/manpower' },
      { label: 'Certifications', href: '/hr/certifications' },
      { label: 'Competency', href: '/hr/competency' },
      { label: 'Attendance', href: '/hr/attendance' },
      { label: 'Documents', href: '/hr/documents' },
      { label: 'Payroll', href: '/payroll' },
      { label: 'Payroll Analytics', href: '/payroll/analytics' },
      { label: 'EOSB', href: '/payroll/eosb-liability' },
      { label: 'Timesheets', href: '/timesheets' },
      { label: 'Utilization', href: '/timesheets/analytics' },
    ],
  },
  {
    id: 'finance', label: 'Finance', icon: DollarSign, href: '/finance',
    match: ['/finance'],
    tabs: [
      { label: 'Hub', href: '/finance' },
      { label: 'Receivables', href: '/finance/ar' },
      { label: 'Payables', href: '/finance/ap' },
      { label: 'Budget & Cost', href: '/finance/budget' },
      { label: 'Commitments', href: '/finance/commitments' },
      { label: 'Profitability', href: '/finance/project-profitability' },
      { label: 'Cash Flow', href: '/finance/cashflow' },
      { label: 'Project Cash Flow', href: '/finance/project-cashflow' },
      { label: 'Retentions', href: '/finance/retentions' },
      { label: 'Petty Cash', href: '/finance/petty-cash' },
      { label: 'Bank Rec', href: '/finance/bank-reconciliation' },
      { label: 'Treasury', href: '/finance/treasury' },
      { label: 'Reports', href: '/finance/reports' },
      { label: 'GRN-to-Expense', href: '/finance/grn-expense' },
      { label: 'AI Agent', href: '/finance/ai' },
      { label: 'VAT', href: '/finance/vat' },
    ],
  },
  {
    id: 'comms', label: 'Comms', icon: MessageSquare, href: '/comms',
    match: ['/comms', '/whatsapp'],
    tabs: [
      { label: 'Messenger', href: '/comms' },
      { label: 'Announcements', href: '/comms/announcements' },
      { label: 'Shared Docs', href: '/comms/documents' },
      { label: 'Meetings', href: '/comms/meetings' },
      { label: 'Notifications', href: '/comms/notifications' },
      { label: 'Settings', href: '/comms/admin' },
      { label: 'WhatsApp', href: '/whatsapp' },
    ],
  },
  {
    id: 'admin', label: 'Admin', icon: Settings, href: '/admin/hub',
    match: ['/admin', '/documents', '/reports'],
    tabs: [
      { label: 'Hub', href: '/admin/hub' },
      { label: 'Audit Analytics', href: '/admin/audit/analytics' },
      { label: 'Access & Roles', href: '/admin/access' },
      { label: 'Permissions', href: '/admin/permissions' },
      { label: 'Workflow Analytics', href: '/admin/workflows/analytics' },
      { label: 'Configuration', href: '/admin/configuration' },
      { label: 'Workflow Designer', href: '/admin/workflows' },
      { label: 'Form Builder', href: '/admin/forms' },
      { label: 'Templates', href: '/admin/templates' },
      { label: 'Rules', href: '/admin/rules' },
      { label: 'Numbering', href: '/admin/numbering' },
      { label: 'Audit Log', href: '/admin/audit' },
      { label: 'Settings', href: '/admin/settings' },
      { label: 'Documents', href: '/documents' },
      { label: 'Reports', href: '/reports' },
    ],
  },
];

const matches = (prefix: string, pathname: string) =>
  pathname === prefix || pathname.startsWith(prefix + '/');

/** The hub that owns a given pathname (most specific match wins). */
export function findHub(pathname: string | null | undefined): Hub | null {
  if (!pathname) return null;
  let best: { hub: Hub; len: number } | null = null;
  for (const hub of HUBS) {
    for (const m of hub.match) {
      if (matches(m, pathname) && (!best || m.length > best.len)) {
        best = { hub, len: m.length };
      }
    }
  }
  return best?.hub ?? null;
}

/** The active tab within a hub for a given pathname (longest href match). */
export function findActiveTab(hub: Hub, pathname: string | null | undefined): HubTab | null {
  if (!pathname) return null;
  let best: { tab: HubTab; len: number } | null = null;
  for (const tab of hub.tabs) {
    if (matches(tab.href, pathname) && (!best || tab.href.length > best.len)) {
      best = { tab, len: tab.href.length };
    }
  }
  return best?.tab ?? null;
}

/** Full-bleed / chrome-less routes where the hub header should not render. */
export function shouldHideHubHeader(pathname: string | null | undefined): boolean {
  if (!pathname) return true;
  if (pathname === '/' || pathname.startsWith('/signin') || pathname.startsWith('/signup')) return true;
  if (pathname.startsWith('/comms/meeting/')) return true;
  if (/\/(pdf|print)(\/|$)/.test(pathname)) return true;
  return false;
}
