// ============================================================
// JEET ERP — Hub navigation model (single source of truth)
// The sidebar shows only these top-level business hubs; each hub's
// sub-pages are exposed as header tabs (see HubHeader). Routes are
// unchanged — this is purely a navigation re-organisation over the
// existing pages, so every deep link keeps working.
// ============================================================

import {
  LayoutDashboard, Briefcase, FolderKanban, ShoppingCart, Package,
  Truck, Wrench, Users, DollarSign, MessageSquare, Settings, BrainCircuit,
  type LucideIcon,
} from 'lucide-react';

export interface HubTab {
  label: string;
  href: string;
  /** Optional cluster shown as a divider label in the hub header tab strip. */
  group?: string;
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
    id: 'home', label: 'My Workspace', icon: LayoutDashboard, href: '/workspace',
    match: ['/dashboard', '/myday', '/tasks', '/workspace', '/meetings', '/notifications'],
    tabs: [
      { label: 'Overview', href: '/workspace', group: 'Workspace' },
      { label: 'My Day', href: '/myday', group: 'Workspace' },
      { label: 'Tasks', href: '/tasks', group: 'Work' },
      { label: 'Approvals', href: '/workspace/approvals', group: 'Work' },
      { label: 'Meetings', href: '/meetings', group: 'Schedule' },
      { label: 'Calendar', href: '/workspace/calendar', group: 'Schedule' },
      { label: 'Activity', href: '/workspace/activity', group: 'Feed' },
      { label: 'Notifications', href: '/notifications', group: 'Feed' },
      { label: 'Dashboard', href: '/dashboard', group: 'Feed' },
    ],
  },
  {
    id: 'intelligence', label: 'Intelligence', icon: BrainCircuit, href: '/intelligence/exec',
    match: ['/intelligence'],
    tabs: [
      { label: 'Executive', href: '/intelligence/exec' },
      { label: 'Risk', href: '/intelligence' },
    ],
  },
  {
    id: 'sales', label: 'Sales', icon: Briefcase, href: '/sales',
    match: ['/sales', '/tenders', '/quotations'],
    tabs: [
      { label: 'Overview', href: '/sales', group: 'Pipeline' },
      { label: 'Dashboard', href: '/sales/dashboard', group: 'Pipeline' },
      { label: 'Pipeline', href: '/sales/pipeline', group: 'Pipeline' },
      { label: 'Performance', href: '/sales/performance', group: 'Pipeline' },
      { label: 'Tenders', href: '/tenders', group: 'Bids & Quotes' },
      { label: 'Quotations', href: '/quotations', group: 'Bids & Quotes' },
      { label: 'Quote Analytics', href: '/sales/quotations', group: 'Bids & Quotes' },
      { label: 'Deadlines', href: '/sales/deadlines', group: 'Bids & Quotes' },
      { label: 'Follow-ups', href: '/sales/follow-ups', group: 'Bids & Quotes' },
      { label: 'Win / Loss', href: '/sales/win-loss', group: 'Insight' },
      { label: 'Margin', href: '/sales/margin', group: 'Insight' },
      { label: 'Competitors', href: '/sales/competitors', group: 'Insight' },
      { label: 'Clients', href: '/sales/clients', group: 'Clients' },
    ],
  },
  {
    id: 'projects', label: 'Projects', icon: FolderKanban, href: '/projects',
    match: ['/projects', '/vo', '/snags', '/tc', '/handover'],
    tabs: [
      { label: 'Projects', href: '/projects', group: 'Delivery' },
      { label: 'Dashboard', href: '/projects/dashboard', group: 'Delivery' },
      { label: 'Daily Reports', href: '/projects/daily-reports', group: 'Delivery' },
      { label: 'Site Records', href: '/projects/site-records', group: 'Delivery' },
      { label: 'Controls', href: '/projects/controls', group: 'Planning' },
      { label: 'WBS', href: '/projects/wbs', group: 'Planning' },
      { label: 'Schedule', href: '/projects/schedule', group: 'Planning' },
      { label: 'Resources', href: '/projects/resources', group: 'Planning' },
      { label: 'Progress & EVM', href: '/projects/evm', group: 'Performance' },
      { label: 'Risks', href: '/projects/risks', group: 'Performance' },
      { label: 'Variations', href: '/vo', group: 'Performance' },
      { label: 'Snags', href: '/snags', group: 'Quality & Closeout' },
      { label: 'Snag QA', href: '/projects/snag-analytics', group: 'Quality & Closeout' },
      { label: 'Testing & Comm.', href: '/tc', group: 'Quality & Closeout' },
      { label: 'Handover', href: '/handover', group: 'Quality & Closeout' },
      { label: 'DLP', href: '/projects/dlp', group: 'Quality & Closeout' },
    ],
  },
  {
    id: 'procurement', label: 'Procurement', icon: ShoppingCart, href: '/procurement',
    match: ['/procurement'],
    tabs: [
      { label: 'Overview', href: '/procurement', group: 'Overview' },
      { label: 'Dashboard', href: '/procurement/dashboard', group: 'Overview' },
      { label: 'Requests', href: '/procurement/pr', group: 'Source to Order' },
      { label: 'PR Pipeline', href: '/procurement/pr-pipeline', group: 'Source to Order' },
      { label: 'RFQ', href: '/procurement/rfq', group: 'Source to Order' },
      { label: 'Comparisons', href: '/procurement/comparisons', group: 'Source to Order' },
      { label: 'Orders', href: '/procurement/po', group: 'Source to Order' },
      { label: 'Goods Receipt', href: '/procurement/grn', group: 'Receive & Pay' },
      { label: 'Deliveries', href: '/procurement/deliveries', group: 'Receive & Pay' },
      { label: '3-Way Match', href: '/procurement/match', group: 'Receive & Pay' },
      { label: 'Payables', href: '/procurement/payables', group: 'Receive & Pay' },
      { label: 'Spend', href: '/procurement/spend', group: 'Analytics' },
      { label: 'Savings', href: '/procurement/savings', group: 'Analytics' },
      { label: 'GRN Analytics', href: '/procurement/grn-analytics', group: 'Analytics' },
      { label: 'Suppliers', href: '/procurement/suppliers', group: 'Analytics' },
    ],
  },
  {
    id: 'inventory', label: 'Inventory', icon: Package, href: '/warehouse/dashboard',
    match: ['/warehouse', '/pricing'],
    tabs: [
      { label: 'Dashboard', href: '/warehouse/dashboard', group: 'Stock' },
      { label: 'Store', href: '/warehouse/store', group: 'Stock' },
      { label: 'Movements', href: '/warehouse/movements', group: 'Stock' },
      { label: 'Requisitions', href: '/warehouse/mrf', group: 'Stock' },
      { label: 'Stock Count', href: '/warehouse/stock-count', group: 'Stock' },
      { label: 'Replenishment', href: '/warehouse/replenishment', group: 'Optimise' },
      { label: 'Aging', href: '/warehouse/aging', group: 'Optimise' },
      { label: 'Dead Stock', href: '/warehouse/dead-stock', group: 'Optimise' },
      { label: 'Forecast', href: '/warehouse/forecast', group: 'Optimise' },
      { label: 'Serials', href: '/warehouse/serials', group: 'Tracking' },
      { label: 'Installed Assets', href: '/warehouse/installed', group: 'Tracking' },
      { label: 'GL Integration', href: '/warehouse/gl', group: 'Data' },
      { label: 'Suppliers', href: '/warehouse/suppliers', group: 'Data' },
      { label: 'Pricing Catalog', href: '/pricing', group: 'Data' },
    ],
  },
  {
    id: 'fleet', label: 'Fleet & Assets', icon: Truck, href: '/fleet/hub',
    match: ['/fleet', '/assets', '/tools'],
    tabs: [
      { label: 'Hub', href: '/fleet/hub', group: 'Fleet' },
      { label: 'Registry', href: '/fleet', group: 'Fleet' },
      { label: 'Dashboard', href: '/fleet/dashboard', group: 'Fleet' },
      { label: 'Compliance', href: '/fleet/compliance', group: 'Fleet' },
      { label: 'Maintenance', href: '/fleet/maintenance', group: 'Fleet' },
      { label: 'Fuel', href: '/fleet/fuel-analytics', group: 'Running Cost' },
      { label: 'Fines', href: '/fleet/fines-analytics', group: 'Running Cost' },
      { label: 'Cost of Ownership', href: '/fleet/tco', group: 'Running Cost' },
      { label: 'Fixed Assets', href: '/assets', group: 'Assets' },
      { label: 'Asset Dashboard', href: '/assets/dashboard', group: 'Assets' },
      { label: 'Depreciation', href: '/assets/depreciation-forecast', group: 'Assets' },
      { label: 'Disposals', href: '/assets/disposals', group: 'Assets' },
      { label: 'Tools', href: '/tools', group: 'Tools' },
      { label: 'Calibration', href: '/tools/calibration', group: 'Tools' },
    ],
  },
  {
    id: 'service', label: 'Service', icon: Wrench, href: '/service/dashboard',
    match: ['/service', '/service-desk', '/ppm', '/amc', '/technician'],
    tabs: [
      { label: 'Dashboard', href: '/service/dashboard', group: 'Service Desk' },
      { label: 'Service Desk', href: '/service-desk', group: 'Service Desk' },
      { label: 'SLA', href: '/service/sla', group: 'Service Desk' },
      { label: 'History', href: '/service/history', group: 'Service Desk' },
      { label: 'Technicians', href: '/service/technicians', group: 'Field' },
      { label: 'Technician Hub', href: '/technician', group: 'Field' },
      { label: 'Spare Parts', href: '/service/parts', group: 'Field' },
      { label: 'PPM Schedule', href: '/ppm/calendar', group: 'PPM' },
      { label: 'PPM Compliance', href: '/service/ppm-compliance', group: 'PPM' },
      { label: 'AMC Contracts', href: '/amc', group: 'AMC' },
      { label: 'Renewals', href: '/amc/pipeline', group: 'AMC' },
      { label: 'Profitability', href: '/amc/profitability', group: 'AMC' },
      { label: 'Equipment', href: '/amc/equipment', group: 'AMC' },
      { label: 'Billing', href: '/amc/billing', group: 'AMC' },
    ],
  },
  {
    id: 'hr', label: 'HR & Payroll', icon: Users, href: '/hr/hub',
    match: ['/hr', '/payroll', '/timesheets'],
    tabs: [
      { label: 'Hub', href: '/hr/hub', group: 'Workforce' },
      { label: 'Dashboard', href: '/hr/dashboard', group: 'Workforce' },
      { label: 'Employees', href: '/hr', group: 'Workforce' },
      { label: 'Manpower', href: '/hr/manpower', group: 'Workforce' },
      { label: 'Workforce', href: '/hr/workforce', group: 'Workforce' },
      { label: 'Doc Compliance', href: '/hr/compliance-tracker', group: 'Compliance' },
      { label: 'Certifications', href: '/hr/certifications', group: 'Compliance' },
      { label: 'Competency', href: '/hr/competency', group: 'Compliance' },
      { label: 'Documents', href: '/hr/documents', group: 'Compliance' },
      { label: 'Attendance', href: '/hr/attendance', group: 'Time' },
      { label: 'Timesheets', href: '/timesheets', group: 'Time' },
      { label: 'Utilization', href: '/timesheets/analytics', group: 'Time' },
      { label: 'Leave', href: '/hr/leave-analytics', group: 'Time' },
      { label: 'Payroll', href: '/payroll', group: 'Payroll' },
      { label: 'Payroll Analytics', href: '/payroll/analytics', group: 'Payroll' },
      { label: 'EOSB', href: '/payroll/eosb-liability', group: 'Payroll' },
      { label: 'Labour Cost', href: '/hr/labour-cost', group: 'Payroll' },
    ],
  },
  {
    id: 'finance', label: 'Finance', icon: DollarSign, href: '/finance',
    match: ['/finance'],
    tabs: [
      { label: 'Hub', href: '/finance', group: 'Overview' },
      { label: 'Reports', href: '/finance/reports', group: 'Overview' },
      { label: 'Receivables', href: '/finance/ar', group: 'AR / AP' },
      { label: 'Payables', href: '/finance/ap', group: 'AR / AP' },
      { label: 'Retentions', href: '/finance/retentions', group: 'AR / AP' },
      { label: 'GRN-to-Expense', href: '/finance/grn-expense', group: 'AR / AP' },
      { label: 'Budget & Cost', href: '/finance/budget', group: 'Cost & Margin' },
      { label: 'Commitments', href: '/finance/commitments', group: 'Cost & Margin' },
      { label: 'Profitability', href: '/finance/project-profitability', group: 'Cost & Margin' },
      { label: 'Cash Flow', href: '/finance/cashflow', group: 'Cash' },
      { label: 'Project Cash Flow', href: '/finance/project-cashflow', group: 'Cash' },
      { label: 'Petty Cash', href: '/finance/petty-cash', group: 'Cash' },
      { label: 'Treasury', href: '/finance/treasury', group: 'Cash' },
      { label: 'Bank Rec', href: '/finance/bank-reconciliation', group: 'Cash' },
      { label: 'General Ledger', href: '/finance/ledger', group: 'Ledger & Tax' },
      { label: 'VAT', href: '/finance/vat', group: 'Ledger & Tax' },
      { label: 'AI Agent', href: '/finance/ai', group: 'Ledger & Tax' },
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
      { label: 'Control Center', href: '/admin/hub', group: 'Governance' },
      { label: 'Companies', href: '/admin/companies', group: 'Governance' },
      { label: 'Roles & Access', href: '/admin/access', group: 'Governance' },
      { label: 'Security Center', href: '/admin/security', group: 'Governance' },
      { label: 'Audit', href: '/admin/audit', group: 'Governance' },
      { label: 'Workflow Designer', href: '/admin/workflows', group: 'Workflow' },
      { label: 'Workflow Override', href: '/admin/workflows/admin', group: 'Workflow' },
      { label: 'Workflow Analytics', href: '/admin/workflows/analytics', group: 'Workflow' },
      { label: 'Rules', href: '/admin/rules', group: 'Workflow' },
      { label: 'Form Builder', href: '/admin/forms', group: 'Builders' },
      { label: 'Templates', href: '/admin/templates', group: 'Builders' },
      { label: 'Numbering', href: '/admin/numbering', group: 'Builders' },
      { label: 'System Health', href: '/admin/system-health', group: 'System' },
      { label: 'Settings', href: '/admin/settings', group: 'System' },
      { label: 'Documents', href: '/documents', group: 'Library' },
      { label: 'Reports', href: '/reports', group: 'Library' },
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
